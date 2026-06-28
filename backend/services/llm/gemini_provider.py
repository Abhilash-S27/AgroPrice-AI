"""
backend/services/llm/gemini_provider.py

Gemini LLM provider — migrated to google-genai SDK (Phase 2 stabilization).
The ONLY module allowed to call the Gemini API.

Architecture contract:
  - Frontend NEVER calls Gemini directly (no API key on client side)
  - This module owns the Gemini connection, configuration, and error handling
  - Deterministic engines supply the facts; Gemini supplies reasoning/narration
  - Returns GeminiResult(text, error_type, latency_ms) — never raises to caller

SDK: google-genai >= 2.0 (replaces deprecated google-generativeai 0.8.x)
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load backend/.env explicitly (CWD-independent) before importing settings,
# so the key is available regardless of where uvicorn was launched from.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.core.config import settings

logger = logging.getLogger(__name__)

# ── Model Configuration ────────────────────────────────────────────────────────
MODEL_ID = "gemini-2.5-flash"

_GENERATION_CONFIG = types.GenerateContentConfig(
    temperature=0.2,        # near-deterministic: reduces hallucination risk
    top_p=0.85,
    top_k=40,
    max_output_tokens=2048,  # increased: 2.5-flash thinking tokens eat into this budget
    # Disable internal thinking for advisory responses — all facts are pre-injected,
    # so no deep reasoning is needed. Eliminates token budget competition with response text.
    thinking_config=types.ThinkingConfig(thinking_budget=0),
    safety_settings=[
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",        threshold="BLOCK_MEDIUM_AND_ABOVE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",       threshold="BLOCK_MEDIUM_AND_ABOVE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
    ],
)

_REQUEST_TIMEOUT_SECONDS = 30
_MAX_RETRIES = 2          # retry on transient errors (timeout, 5xx)
_RETRY_BASE_DELAY = 1.0   # seconds; doubles each retry


# ── Result container ───────────────────────────────────────────────────────────

@dataclass
class GeminiResult:
    """
    Structured result from every GeminiProvider.generate() call.

    error_type is None on success.  Possible values on failure:
      key_not_configured  — GEMINI_API_KEY missing from .env
      quota_exceeded      — 429 rate limit / free-tier exhausted
      invalid_key         — 401/403 authentication rejected
      safety_blocked      — Gemini safety filter triggered
      empty_response      — API returned no text candidates
      timeout             — request exceeded timeout after retries
      server_error        — 5xx from Gemini API (after retries)
      network_error       — connection-level failure (after retries)
    """
    text: str
    error_type: Optional[str] = None   # None = success
    latency_ms: float = 0.0


# ── Provider ───────────────────────────────────────────────────────────────────

class GeminiProvider:
    """
    Thread-safe Gemini provider using the native async google-genai SDK.

    Startup validation:
      - Logs masked key prefix (never the full key) so you can confirm the
        correct key is loaded without exposing secrets in logs.
      - Sets self._ready = False if key is absent; generate() returns a
        structured fallback — callers never raise.

    Error handling:
      - quota_exceeded / invalid_key  → no retry (not transient)
      - timeout / server_error        → exponential retry up to _MAX_RETRIES
      - All failures return GeminiResult with error_type set
    """

    def __init__(self) -> None:
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

        if not api_key:
            logger.warning(
                "GEMINI_API_KEY is not set — GeminiProvider will return fallback responses. "
                "Add GEMINI_API_KEY=<key> to backend/.env and restart the server."
            )
            self._ready = False
            self._client: Optional[genai.Client] = None
            return

        # Log masked prefix for startup verification (never the full key)
        masked = f"{api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else "***"
        logger.info(
            "GeminiProvider initializing: model=%s key_prefix=%s key_len=%d",
            MODEL_ID, masked, len(api_key),
        )

        try:
            self._client = genai.Client(api_key=api_key)
            self._ready = True
            logger.info("GeminiProvider ready: model=%s", MODEL_ID)
        except Exception as exc:
            logger.error("GeminiProvider init failed: %s", exc)
            self._ready = False
            self._client = None

    # ── Public API ────────────────────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        *,
        timeout: float = _REQUEST_TIMEOUT_SECONDS,
    ) -> GeminiResult:
        """
        Send a grounded prompt to Gemini and return a GeminiResult.

        - Uses client.aio.models.generate_content() for native async (no thread pool).
        - Retries transient errors (timeout, server_error) with exponential backoff.
        - Never retries quota_exceeded or invalid_key (not transient).
        - Never raises — all failures produce a structured GeminiResult.
        """
        if not self._ready:
            return GeminiResult(
                text=self._fallback("Service temporarily unavailable — API key not configured."),
                error_type="key_not_configured",
            )

        for attempt in range(_MAX_RETRIES + 1):
            start = time.monotonic()
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=MODEL_ID,
                        contents=prompt,
                        config=_GENERATION_CONFIG,
                    ),
                    timeout=timeout,
                )
                latency_ms = (time.monotonic() - start) * 1000

                try:
                    text = (response.text or "").strip()
                except (ValueError, AttributeError):
                    logger.warning("Gemini safety filter triggered (attempt %d)", attempt + 1)
                    return GeminiResult(
                        text=self._fallback("The response was filtered. Please rephrase your question."),
                        error_type="safety_blocked",
                        latency_ms=latency_ms,
                    )

                if not text:
                    return GeminiResult(
                        text=self._fallback("No response generated. Please try rephrasing your question."),
                        error_type="empty_response",
                        latency_ms=latency_ms,
                    )

                finish = getattr(
                    getattr(getattr(response, "candidates", [None])[0], "finish_reason", None),
                    "name", "UNKNOWN"
                ) if getattr(response, "candidates", None) else "NO_CANDIDATES"
                logger.info(
                    "Gemini OK: %.0fms attempt=%d chars=%d finish=%s",
                    latency_ms, attempt + 1, len(text), finish,
                )
                return GeminiResult(text=text, latency_ms=latency_ms)

            except asyncio.TimeoutError:
                latency_ms = (time.monotonic() - start) * 1000
                logger.warning("Gemini timeout %.0fms attempt=%d", latency_ms, attempt + 1)
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_RETRY_BASE_DELAY * (2 ** attempt))
                    continue
                return GeminiResult(
                    text=self._fallback(
                        "The AI advisor is taking longer than expected. Please try again."
                    ),
                    error_type="timeout",
                    latency_ms=latency_ms,
                )

            except genai_errors.ClientError as exc:
                latency_ms = (time.monotonic() - start) * 1000
                code = getattr(exc, "code", None)
                msg  = str(exc).lower()

                if code == 429 or "quota" in msg or "rate" in msg or "resource exhausted" in msg:
                    logger.warning("Gemini quota exceeded (code=%s): %s", code, exc)
                    return GeminiResult(
                        text=self._fallback(
                            "Gemini free-tier quota exceeded. "
                            "Responses will resume once the quota resets (typically within a minute)."
                        ),
                        error_type="quota_exceeded",
                        latency_ms=latency_ms,
                    )

                if code in (401, 403) or "api key" in msg or "permission" in msg or "invalid" in msg:
                    logger.error("Gemini invalid/rejected key (code=%s): %s", code, exc)
                    return GeminiResult(
                        text=self._fallback(
                            "AI Advisor configuration error — the API key may be invalid. "
                            "Please check backend/.env and restart the server."
                        ),
                        error_type="invalid_key",
                        latency_ms=latency_ms,
                    )

                logger.error("Gemini client error (code=%s) attempt=%d: %s", code, attempt + 1, exc)
                return GeminiResult(
                    text=self._fallback("AI Advisor client error. Please retry."),
                    error_type="client_error",
                    latency_ms=latency_ms,
                )

            except genai_errors.ServerError as exc:
                latency_ms = (time.monotonic() - start) * 1000
                logger.warning("Gemini server error attempt=%d: %s", attempt + 1, exc)
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_RETRY_BASE_DELAY * (2 ** attempt))
                    continue
                return GeminiResult(
                    text=self._fallback(
                        "Gemini service is temporarily unavailable. Please retry shortly."
                    ),
                    error_type="server_error",
                    latency_ms=latency_ms,
                )

            except Exception as exc:
                latency_ms = (time.monotonic() - start) * 1000
                logger.error("Gemini unexpected error attempt=%d: %s", attempt + 1, exc, exc_info=True)
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_RETRY_BASE_DELAY * (2 ** attempt))
                    continue
                return GeminiResult(
                    text=self._fallback(
                        "AI Advisor encountered an unexpected error. Please retry."
                    ),
                    error_type="network_error",
                    latency_ms=latency_ms,
                )

        # Should never reach here (loop always returns inside)
        return GeminiResult(
            text=self._fallback("AI Advisor is temporarily unavailable."),
            error_type="unknown",
        )

    async def generate_stream(self, prompt: str, *, connection_timeout: float = 15.0):
        """
        Async generator — yields text tokens from a streaming Gemini response.

        Yields strings (text tokens) as they arrive. On any error, yields a
        single fallback string and stops. No retry logic — streaming errors
        surface immediately so the user can retry manually.

        Usage:
            async for token in _gemini.generate_stream(prompt):
                yield token          # write to SSE / WebSocket
        """
        if not self._ready:
            yield self._fallback("Service temporarily unavailable — API key not configured.")
            return

        start = time.monotonic()
        try:
            # Connect to the streaming endpoint (timeout for initial connection only)
            stream = await asyncio.wait_for(
                self._client.aio.models.generate_content_stream(
                    model=MODEL_ID,
                    contents=prompt,
                    config=_GENERATION_CONFIG,
                ),
                timeout=connection_timeout,
            )

            had_tokens = False
            async for chunk in stream:
                token = chunk.text or ""
                if token:
                    had_tokens = True
                    yield token

            if not had_tokens:
                yield self._fallback(
                    "No response generated. Please try rephrasing your question."
                )

            latency_ms = (time.monotonic() - start) * 1000
            logger.info("Gemini stream complete: %.0fms", latency_ms)

        except asyncio.TimeoutError:
            logger.warning("Gemini stream connection timeout after %.0fs", connection_timeout)
            yield self._fallback(
                "Connection to Gemini timed out. Please retry."
            )

        except genai_errors.ClientError as exc:
            latency_ms = (time.monotonic() - start) * 1000
            code = getattr(exc, "code", None)
            msg  = str(exc).lower()
            if code == 429 or "quota" in msg or "resource exhausted" in msg:
                logger.warning("Gemini stream quota exceeded: %s", exc)
                yield self._fallback(
                    "Gemini free-tier quota exceeded. Responses will resume shortly."
                )
            elif code in (401, 403) or "api key" in msg or "permission" in msg:
                logger.error("Gemini stream invalid key: %s", exc)
                yield self._fallback(
                    "AI Advisor configuration error — the API key may be invalid. "
                    "Please check backend/.env and restart the server."
                )
            else:
                logger.error("Gemini stream client error (code=%s): %s", code, exc)
                yield self._fallback("AI Advisor request error. Please retry.")

        except genai_errors.ServerError as exc:
            logger.warning("Gemini stream server error: %s", exc)
            yield self._fallback(
                "Gemini service is temporarily unavailable. Please retry shortly."
            )

        except Exception as exc:
            logger.error("Gemini stream unexpected error: %s", exc, exc_info=True)
            yield self._fallback(
                "AI Advisor encountered an unexpected error. Please retry."
            )

    def is_ready(self) -> bool:
        """True if the provider has a configured API key and client."""
        return self._ready

    def model_name(self) -> str:
        return MODEL_ID

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _fallback(message: str) -> str:
        """Professional fallback — always on-domain, never a raw traceback."""
        return (
            f"{message}\n\n"
            "For immediate assistance, please check the live price charts and "
            "AI forecast summaries available in the Forecast section."
        )
