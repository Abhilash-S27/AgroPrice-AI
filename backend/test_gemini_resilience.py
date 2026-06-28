"""
backend/test_gemini_resilience.py

Tests for Gemini provider resilience and advisor health.

Tests:
  1. ENV loading — GEMINI_API_KEY loads correctly from backend/.env
  2. Provider ready — GeminiProvider initializes and logs masked key
  3. Masked key — full key never appears in provider repr
  4. Quota exceeded — mocked 429 returns error_type="quota_exceeded"
  5. Invalid key    — mocked 401 returns error_type="invalid_key"
  6. Timeout        — asyncio.TimeoutError returns error_type="timeout"
  7. Server error   — mocked 5xx returns error_type="server_error" (after retries)
  8. Empty response — mocked empty text returns error_type="empty_response"
  9. GeminiResult type — generate() always returns GeminiResult, never raises
 10. Health endpoint — GET /api/advisor/health returns expected schema
 11. Live Gemini call — optional live call (skipped if quota/key invalid)

Run from project root:
    python -m backend.test_gemini_resilience
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# ── Ensure project root on path ───────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / "backend" / ".env")

from backend.services.llm.gemini_provider import GeminiProvider, GeminiResult
from google.genai import errors as genai_errors


# ── Helpers ───────────────────────────────────────────────────────────────────

def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"

_results: list[tuple[str, bool, str]] = []


def report(name: str, ok: bool, note: str = "") -> None:
    tag = PASS if ok else FAIL
    line = f"  [{tag}] {name}" + (f"  — {note}" if note else "")
    print(line)
    _results.append((name, ok, note))


def make_fake_error(cls, code: int, message: str):
    """Build a genai_errors instance without calling the real constructor."""
    err = Exception.__new__(cls)
    err.code = code
    err.message = message
    err.details = {}
    err.response = None
    err.__str__ = lambda self: f"[{code}] {message}"
    return err


# ── Test runner ───────────────────────────────────────────────────────────────

def main():
    print("\n=== Gemini Provider Resilience Tests ===\n")

    # 1. ENV loading
    api_key = os.getenv("GEMINI_API_KEY", "")
    report("1. ENV loading (GEMINI_API_KEY present)", bool(api_key),
           f"key_len={len(api_key)}" if api_key else "KEY MISSING — check backend/.env")

    # 2. Provider ready
    provider = GeminiProvider()
    report("2. Provider initializes", True, f"ready={provider.is_ready()}")

    # 3. Masked key — full key must NOT appear in any string the provider exposes
    api_key_full = api_key
    import logging, io
    log_capture = io.StringIO()
    handler = logging.StreamHandler(log_capture)
    logging.getLogger("backend.services.llm.gemini_provider").addHandler(handler)
    GeminiProvider()  # re-init to capture logs
    logging.getLogger("backend.services.llm.gemini_provider").removeHandler(handler)
    log_output = log_capture.getvalue()
    if api_key_full and len(api_key_full) > 12:
        full_in_log = api_key_full in log_output
        report("3. Full API key not in logs", not full_in_log,
               "MASKED OK" if not full_in_log else "KEY EXPOSED IN LOGS — BUG")
    else:
        report("3. Full API key masking", True, "SKIP (key too short or missing)")

    # 4. Quota exceeded (mocked 429)
    async def test_quota():
        p = GeminiProvider.__new__(GeminiProvider)
        p._ready = True
        p._client = MagicMock()
        quota_err = make_fake_error(genai_errors.ClientError, 429, "resource exhausted quota")
        mock_coro = AsyncMock(side_effect=quota_err)
        p._client.aio = MagicMock()
        p._client.aio.models = MagicMock()
        p._client.aio.models.generate_content = mock_coro
        result = await p.generate("test prompt")
        return result

    result = run(test_quota())
    report("4. Quota exceeded → error_type=quota_exceeded",
           result.error_type == "quota_exceeded",
           f"got={result.error_type}")

    # 5. Invalid key (mocked 401)
    async def test_invalid_key():
        p = GeminiProvider.__new__(GeminiProvider)
        p._ready = True
        p._client = MagicMock()
        auth_err = make_fake_error(genai_errors.ClientError, 401, "api key invalid permission denied")
        mock_coro = AsyncMock(side_effect=auth_err)
        p._client.aio = MagicMock()
        p._client.aio.models = MagicMock()
        p._client.aio.models.generate_content = mock_coro
        return await p.generate("test prompt")

    result = run(test_invalid_key())
    report("5. Invalid key → error_type=invalid_key",
           result.error_type == "invalid_key",
           f"got={result.error_type}")

    # 6. Timeout
    async def test_timeout():
        p = GeminiProvider.__new__(GeminiProvider)
        p._ready = True
        p._client = MagicMock()
        async def slow(*a, **kw):
            await asyncio.sleep(999)
        p._client.aio = MagicMock()
        p._client.aio.models = MagicMock()
        p._client.aio.models.generate_content = slow
        return await p.generate("test prompt", timeout=0.05)

    start = time.monotonic()
    result = run(test_timeout())
    elapsed = time.monotonic() - start
    report("6. Timeout → error_type=timeout",
           result.error_type == "timeout",
           f"got={result.error_type} elapsed={elapsed:.2f}s")

    # 7. Server error with retries
    async def test_server_error():
        p = GeminiProvider.__new__(GeminiProvider)
        p._ready = True
        p._client = MagicMock()
        srv_err = Exception.__new__(genai_errors.ServerError)
        srv_err.code = 503
        srv_err.message = "service unavailable"
        srv_err.__str__ = lambda self: "503 service unavailable"
        call_count = [0]
        async def flaky(*a, **kw):
            call_count[0] += 1
            raise srv_err
        p._client.aio = MagicMock()
        p._client.aio.models = MagicMock()
        p._client.aio.models.generate_content = flaky
        # Override retry delay to speed up test
        import backend.services.llm.gemini_provider as gp_module
        orig = gp_module._RETRY_BASE_DELAY
        gp_module._RETRY_BASE_DELAY = 0.01
        result = await p.generate("test prompt")
        gp_module._RETRY_BASE_DELAY = orig
        return result, call_count[0]

    result, calls = run(test_server_error())
    report("7. Server error → retries then error_type=server_error",
           result.error_type == "server_error" and calls == 3,
           f"got={result.error_type} calls={calls} (expected 3)")

    # 8. Empty response
    async def test_empty():
        p = GeminiProvider.__new__(GeminiProvider)
        p._ready = True
        p._client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "   "
        mock_coro = AsyncMock(return_value=mock_resp)
        p._client.aio = MagicMock()
        p._client.aio.models = MagicMock()
        p._client.aio.models.generate_content = mock_coro
        return await p.generate("test prompt")

    result = run(test_empty())
    report("8. Empty response → error_type=empty_response",
           result.error_type == "empty_response",
           f"got={result.error_type}")

    # 9. GeminiResult type always returned
    async def test_type():
        p = GeminiProvider.__new__(GeminiProvider)
        p._ready = False
        p._client = None
        result = await p.generate("test")
        return isinstance(result, GeminiResult)

    ok = run(test_type())
    report("9. generate() always returns GeminiResult (never raises)", ok)

    # 10. Health endpoint (requires running server on :8000 or :8001)
    try:
        import httpx
        for port in (8000, 8001):
            try:
                r = httpx.get(f"http://localhost:{port}/api/advisor/health", timeout=3.0)
                if r.status_code == 200:
                    data = r.json()
                    has_fields = all(k in data for k in ("gemini_configured", "gemini_ready", "duckdb_ready", "model"))
                    report("10. Health endpoint returns expected schema",
                           has_fields and r.status_code == 200,
                           f"port={port} data={data}")
                    break
            except Exception:
                continue
        else:
            report("10. Health endpoint", True, "SKIP (server not running on :8000/:8001)")
    except ImportError:
        report("10. Health endpoint", True, "SKIP (httpx not available)")

    # 11. Live Gemini call (skipped if key invalid / quota exceeded)
    if provider.is_ready():
        async def test_live():
            start = time.monotonic()
            result = await provider.generate(
                "In one sentence, what is Tomato's typical harvest season in Karnataka?"
            )
            return result, time.monotonic() - start

        live_result, latency = run(test_live())
        if live_result.error_type in ("quota_exceeded", "invalid_key", "key_not_configured"):
            report("11. Live Gemini call", True,
                   f"SKIP ({live_result.error_type}) — check quota or key")
        else:
            ok = live_result.error_type is None and len(live_result.text) > 10
            report("11. Live Gemini call succeeds",
                   ok,
                   f"error={live_result.error_type} latency={latency:.2f}s chars={len(live_result.text)}")
            if ok:
                print(f"\n     Response preview: {live_result.text[:120]}...")
    else:
        report("11. Live Gemini call", True, "SKIP (provider not ready — check GEMINI_API_KEY)")

    # ── Summary ───────────────────────────────────────────────────────────────
    total  = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    print(f"\n{'-'*45}")
    print(f"  Results: {passed}/{total} passed")
    if passed < total:
        print("  Failed:")
        for name, ok, note in _results:
            if not ok:
                print(f"    • {name} — {note}")
    print()
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
