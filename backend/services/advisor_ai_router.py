"""
backend/services/advisor_ai_router.py

Orchestrates the full AI Advisor query pipeline (Phase 4A):

  Frontend request
    → sanitize + domain guardrail
    → session memory (context inheritance: crop, state, topic chain)
    → smart entity extraction from question text
    → intent classification (deterministic, rule-based)
    → AdvisorContextBuilder  →  PromptContext  (grounded facts)
    → Agent pipeline (Trend, Risk, Seasonal, Recommendation)
    → Confidence engine (Phase 4A — synthesized from deterministic signals)
    → Correlation engine (Phase 4A — confirming / contradicting signals)
    → Analyst persona injection (Phase 4A — view_mode framing)
    → build_grounded_prompt()
    → GeminiProvider.generate()   OR  GeminiProvider.generate_stream()
    → store turn in AdvisorMemoryManager (with intent, topic chain)
    → return structured result / SSE event stream

Design principles:
  1. Guardrails checked FIRST — Gemini never called for out-of-scope queries.
  2. Intent classification is DETERMINISTIC — Gemini does not classify intent.
  3. Context built from REAL DATA — Gemini never invents metrics.
  4. Persona framing via view_mode — materially changes response style, not data.
  5. Correlation + confidence provide richer grounding — no invented values.
  6. Streaming uses the SAME pipeline (shared _prepare_query_context).
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional

from backend.core.logger import get_logger
from backend.services.advisor_context_builder import advisor_context_builder
from backend.services.advisor_memory_manager import AdvisorMemoryManager, memory_manager
from backend.services.analyst_persona import get_persona_label, get_persona_section
from backend.services.confidence_engine import compute_recommendation_confidence
from backend.services.correlation_engine import detect_market_correlations
from backend.services.forecast_ai_chat import classify_intent
from backend.services.historical_market_service import fetch_historical
from backend.services.historical_query_parser import parse_historical_query
from backend.services.llm.gemini_provider import GeminiProvider
from backend.services.llm.prompt_builder import PromptContext, build_grounded_prompt
from backend.services.llm.response_guardrails import enforce_agriculture_scope, sanitize_prompt

# Intents that trigger historical database retrieval
_HISTORICAL_INTENTS = frozenset({
    "historical", "historical_price", "yearly_comparison",
    "all_time_peak", "all_time_trough", "trend_analysis", "seasonal_history",
})

logger = get_logger(__name__)

# Module-level provider singleton (one per process, initialized at import time)
_gemini = GeminiProvider()

# Rolling trace of the most recent request — surfaced by GET /api/advisor/debug
last_trace: dict = {"status": "no requests yet"}


def _trace_stage(trace: dict, stage: str, **info) -> None:
    trace["stages"].append({"stage": stage, "t_ms": round((time.monotonic() - trace["_t0"]) * 1000), **info})
    logger.info(f"advisor_stage_{stage}", **{k: str(v)[:120] for k, v in info.items()})


# ── Smart entity extraction ───────────────────────────────────────────────────

def _extract_entities_from_question(question: str) -> tuple[str | None, str | None]:
    """
    Scan question text for crop and state name mentions.
    Checks longer names first to avoid partial-match collisions.
    Returns (crop | None, state | None).
    """
    from backend.utils.constants import SOUTH_INDIAN_STATES
    from backend.utils.crop_registry import ALL_CROPS

    lower = question.lower()

    found_crop: str | None = None
    for crop in sorted(ALL_CROPS, key=len, reverse=True):
        if crop.lower() in lower:
            found_crop = crop
            break

    found_state: str | None = None
    for state in SOUTH_INDIAN_STATES:
        if state.lower() in lower:
            found_state = state
            break

    return found_crop, found_state


# ── Reasoning trace builder ───────────────────────────────────────────────────

def _build_reasoning_trace(
    agent_insights: dict,
    confidence_label: str | None,
    confidence_score: float | None,
    intent: str,
    correlation_count: int,
    eff_crop: str | None,
    eff_state: str | None,
) -> str:
    """
    Build a compact reasoning trace string shown in the frontend Explainability panel.

    Format: "crop: X | state: Y | intent: Z | trend: BULLISH (72%) | risk: LOW (85%) |
             seasonal: PEAK (91%) | rec: SELL_SOON (77%) | confidence: high (74%) | correlations: 2"
    """
    parts: list[str] = []
    if eff_crop:
        parts.append(f"crop: {eff_crop}")
    if eff_state:
        parts.append(f"state: {eff_state}")
    parts.append(f"intent: {intent}")

    for agent_name in ("trend", "risk", "seasonal", "recommendation"):
        insight = agent_insights.get(agent_name)
        if isinstance(insight, dict) and insight.get("verdict"):
            verdict = insight["verdict"].replace("_", " ")
            score   = insight.get("score", 0)
            parts.append(f"{agent_name}: {verdict} ({score:.0%})")

    if confidence_label:
        score_str = f" ({confidence_score:.0%})" if confidence_score is not None else ""
        parts.append(f"confidence: {confidence_label}{score_str}")

    if correlation_count:
        parts.append(f"correlations: {correlation_count}")

    return " | ".join(parts)


# ── Shared pre-Gemini pipeline ────────────────────────────────────────────────

async def _prepare_query_context(
    question: str,
    crop: Optional[str],
    state: Optional[str],
    session_id: str,
    view_mode: Optional[str] = None,
) -> dict:
    """
    Execute pipeline steps 1–9 (everything BEFORE the Gemini call).

    Phase 4A additions (steps 7a, 7b, 7c):
      7a. Confidence engine — synthesize dynamic confidence from deterministic signals
      7b. Correlation engine — detect confirming / contradicting agent patterns
      7c. Analyst persona — inject view_mode framing into PromptContext

    Shared by route_advisor_query (non-streaming) and route_advisor_query_stream.

    Returns a dict with:
      rejected, rejection_text, clean, eff_crop, eff_state,
      intent, full_prompt, prompt_ctx, sources, inferred,
      agent_insights, grounded, trace, reasoning_trace, persona_label
    """
    trace: dict = {
        "_t0": time.monotonic(),
        "question": question[:120],
        "crop_hint": crop, "state_hint": state,
        "session": session_id[:12],
        "view_mode": view_mode,
        "gemini_ready": _gemini.is_ready(),
        "stages": [],
    }

    # ── 1. Sanitize ───────────────────────────────────────────────────────────
    clean = sanitize_prompt(question)
    _trace_stage(trace, "sanitize", chars=len(clean))

    # ── 2. Domain guardrail ───────────────────────────────────────────────────
    rejection = enforce_agriculture_scope(clean)
    if rejection:
        _trace_stage(trace, "guardrail", verdict="rejected")
        trace["intent"] = "rejected"
        return {
            "rejected": True,
            "rejection_text": rejection,
            "clean": clean,
            "eff_crop": crop,
            "eff_state": state,
            "intent": "rejected",
            "full_prompt": "",
            "prompt_ctx": None,
            "sources": [],
            "inferred": [],
            "agent_insights": {},
            "grounded": False,
            "trace": trace,
            "reasoning_trace": None,
            "persona_label": None,
        }
    _trace_stage(trace, "guardrail", verdict="in_scope")

    # ── 3. Session memory — context inheritance ───────────────────────────────
    session   = memory_manager.get_or_create_session(session_id)
    eff_crop  = crop  or session.get("last_crop")
    eff_state = state or session.get("last_state")

    inferred: list[str] = []
    if crop  is None and session.get("last_crop"):
        inferred.append(f"crop: {session['last_crop']}")
    if state is None and session.get("last_state"):
        inferred.append(f"state: {session['last_state']}")

    # ── 3b. Smart entity extraction from question text ─────────────────────────
    if not eff_crop or not eff_state:
        ex_crop, ex_state = _extract_entities_from_question(clean)
        if not eff_crop and ex_crop:
            eff_crop = ex_crop
            inferred.append(f"crop: {ex_crop} (detected in question)")
        if not eff_state and ex_state:
            eff_state = ex_state
            inferred.append(f"state: {ex_state} (detected in question)")

    _trace_stage(trace, "memory", crop=eff_crop, state=eff_state,
                 inherited=bool(inferred), prior_turns=len(session.get("turns", [])))

    # ── 4. Intent classification (rule-based — no Gemini call) ────────────────
    intent = classify_intent(clean)
    trace["intent"] = intent
    _trace_stage(trace, "intent", intent=intent)

    # ── 5. Build grounded PromptContext ───────────────────────────────────────
    prompt_ctx: Optional[PromptContext] = None
    sources: list[str] = []
    raw_ctx: dict = {}

    if eff_crop and eff_state:
        try:
            prompt_ctx, raw_ctx = await advisor_context_builder.build_with_raw(eff_crop, eff_state)
            sources = [
                "AGMARKNET price data (2015-2026)",
                "ML forecast engine (Prophet/XGBoost)",
                "Volatility & anomaly analytics",
            ]
            _trace_stage(trace, "context", grounded=True,
                         has_price=prompt_ctx.current_modal_price is not None,
                         has_forecast=prompt_ctx.forecast_30d is not None)
        except Exception as exc:
            logger.warning("advisor_context_failed", crop=eff_crop, state=eff_state, error=str(exc))
            prompt_ctx = PromptContext(crop=eff_crop, state=eff_state)
            _trace_stage(trace, "context", grounded=False, error=str(exc)[:120])
    else:
        _trace_stage(trace, "context", grounded=False, reason="no crop/state in request or memory")

    # ── 5c. Run agents (deterministic, fast — no Gemini) ──────────────────────
    agent_insights: dict = {}
    if raw_ctx.get("has_data") and eff_crop and eff_state:
        try:
            from backend.services.agents.market_briefing_agent import run_briefing
            briefing = await asyncio.to_thread(run_briefing, raw_ctx)
            agent_insights = briefing.get("agents", {})
            # Attach price series for frontend sparklines (no extra DuckDB call)
            agent_insights["price_series_30d"] = raw_ctx.get("price_series_30d", [])
            if prompt_ctx and agent_insights:
                for agent_name, insight in agent_insights.items():
                    if not isinstance(insight, dict):
                        continue
                    hl = insight.get("headline", "")
                    if hl:
                        prompt_ctx.additional_facts[f"ai_{agent_name}_signal"] = hl[:200]
            _trace_stage(trace, "agents", agents_run=[k for k in agent_insights if k != "price_series_30d"])
        except Exception as exc:
            logger.warning("agents_failed", error=str(exc)[:120])
            _trace_stage(trace, "agents", error=str(exc)[:80])

    # ── 5b. Historical intelligence — retrieve real data from AGMARKNET ──────
    hq = parse_historical_query(clean)
    if hq.is_historical and eff_crop and eff_state:
        try:
            hist = await asyncio.to_thread(
                fetch_historical,
                eff_crop, eff_state,
                hq.query_type, hq.year, hq.year2, hq.month,
            )
            if prompt_ctx is None:
                prompt_ctx = PromptContext(crop=eff_crop, state=eff_state)
            prompt_ctx.historical_summary = hist.summary
            if hist.found:
                sources.append("AGMARKNET historical database (2015–2026)")
            _trace_stage(trace, "historical",
                         query_type=hq.query_type, found=hist.found, label=hq.description)
        except Exception as exc:
            logger.warning("historical_retrieval_failed", error=str(exc))
            _trace_stage(trace, "historical", found=False, error=str(exc)[:80])
    elif hq.is_historical and not (eff_crop and eff_state):
        _trace_stage(trace, "historical", skipped="no crop/state for historical query")

    # ── 7a. Phase 4A — Confidence engine ────────────────────────────────────
    confidence_label: str | None = None
    confidence_score: float | None = None
    if raw_ctx.get("has_data") and prompt_ctx:
        try:
            has_forecast = prompt_ctx.forecast_30d is not None
            ca = compute_recommendation_confidence(raw_ctx, has_forecast)
            prompt_ctx.confidence_narrative   = ca.narrative
            prompt_ctx.confidence_contributors = ca.contributors
            prompt_ctx.confidence_detractors   = ca.detractors
            # Only override confidence if not already set by the context builder
            if prompt_ctx.confidence_score is None:
                prompt_ctx.confidence_score = ca.score
            if prompt_ctx.confidence_label is None:
                prompt_ctx.confidence_label = ca.label
            confidence_label = ca.label
            confidence_score = ca.score
            _trace_stage(trace, "confidence", label=ca.label, score=round(ca.score, 2))
        except Exception as exc:
            logger.warning("confidence_engine_failed", error=str(exc)[:80])
            _trace_stage(trace, "confidence", error=str(exc)[:80])

    # ── 7b. Phase 4A — Correlation engine ───────────────────────────────────
    correlation_signals: list[str] = []
    if agent_insights and raw_ctx.get("has_data"):
        try:
            correlation_signals = detect_market_correlations(agent_insights, raw_ctx)
            if prompt_ctx and correlation_signals:
                prompt_ctx.correlation_signals = correlation_signals
            _trace_stage(trace, "correlations", count=len(correlation_signals))
        except Exception as exc:
            logger.warning("correlation_engine_failed", error=str(exc)[:80])
            _trace_stage(trace, "correlations", error=str(exc)[:80])

    # ── 7c. Phase 4A — Analyst persona ──────────────────────────────────────
    persona_label: str | None = None
    try:
        persona_section = get_persona_section(view_mode)
        persona_label   = get_persona_label(view_mode)
        if prompt_ctx is None:
            prompt_ctx = PromptContext()
        prompt_ctx.persona_section = persona_section
        _trace_stage(trace, "persona", mode=view_mode or "default", label=persona_label)
    except Exception as exc:
        logger.warning("persona_injection_failed", error=str(exc)[:80])

    # ── 6. Inject conversation history + topic context ────────────────────────
    history = memory_manager.get_history_string(session_id, max_turns=3)
    if history:
        if prompt_ctx is None:
            prompt_ctx = PromptContext(additional_facts={"recent_conversation": history})
        else:
            prompt_ctx.additional_facts["recent_conversation"] = history

    # Topic context — what the user has been exploring this session (Phase 4A)
    if hasattr(memory_manager, "get_topic_context"):
        topic_ctx = memory_manager.get_topic_context(session_id)
        if topic_ctx and prompt_ctx:
            prompt_ctx.topic_context = topic_ctx

    _trace_stage(trace, "history", injected=bool(history))

    # ── 8. Build structured prompt ────────────────────────────────────────────
    full_prompt = build_grounded_prompt(clean, prompt_ctx)
    _trace_stage(trace, "prompt", chars=len(full_prompt))

    # ── 9. Preliminary grounded flag ─────────────────────────────────────────
    grounded = prompt_ctx is not None and (
        prompt_ctx.current_modal_price is not None
        or prompt_ctx.historical_summary is not None
    )

    # ── Reasoning trace — compact summary of what the engine considered ────────
    reasoning_trace = _build_reasoning_trace(
        agent_insights=agent_insights,
        confidence_label=confidence_label,
        confidence_score=confidence_score,
        intent=intent,
        correlation_count=len(correlation_signals),
        eff_crop=eff_crop,
        eff_state=eff_state,
    )

    return {
        "rejected": False,
        "rejection_text": None,
        "clean": clean,
        "eff_crop": eff_crop,
        "eff_state": eff_state,
        "intent": intent,
        "full_prompt": full_prompt,
        "prompt_ctx": prompt_ctx,
        "sources": sources,
        "inferred": inferred,
        "agent_insights": agent_insights,
        "grounded": grounded,
        "trace": trace,
        "reasoning_trace": reasoning_trace,
        "persona_label": persona_label,
    }


# ── Public API — non-streaming ────────────────────────────────────────────────

async def route_advisor_query(
    question: str,
    crop: Optional[str],
    state: Optional[str],
    session_id: str,
    view_mode: Optional[str] = None,
) -> dict:
    """
    Execute the full AI Advisor pipeline for one user message (non-streaming).

    Returns dict with: answer, intent, sources, inferred_context, model_used,
                       error_type, latency_ms, grounded, agent_insights,
                       reasoning_trace, persona
    """
    global last_trace

    ctx   = await _prepare_query_context(question, crop, state, session_id, view_mode)
    trace = ctx["trace"]

    if ctx["rejected"]:
        last_trace = _finish_trace(trace)
        return _result(ctx["rejection_text"], "rejected", [], [], session_id)

    # ── Call Gemini ───────────────────────────────────────────────────────────
    gemini_result = await _gemini.generate(ctx["full_prompt"])
    answer     = gemini_result.text
    error_type = gemini_result.error_type
    latency_ms = gemini_result.latency_ms

    _trace_stage(trace, "gemini",
                 chars=len(answer), ready=_gemini.is_ready(),
                 error_type=str(error_type), latency_ms=round(latency_ms))

    # ── Store turn with intent (Phase 4A — enables topic chain tracking) ─────
    memory_manager.store_turn(
        session_id, ctx["clean"], answer,
        ctx["eff_crop"], ctx["eff_state"],
        intent=ctx["intent"],
    )
    if ctx["eff_crop"] or ctx["eff_state"]:
        memory_manager.update_context(session_id, crop=ctx["eff_crop"], state=ctx["eff_state"])

    trace["sources"]    = ctx["sources"]
    trace["error_type"] = error_type
    trace["latency_ms"] = round(latency_ms)
    trace["grounded"]   = ctx["grounded"]
    last_trace = _finish_trace(trace)

    logger.info("advisor_query_complete", intent=ctx["intent"],
                crop=str(ctx["eff_crop"]), state=str(ctx["eff_state"]),
                session=session_id[:8], error_type=str(error_type),
                persona=str(ctx.get("persona_label")))

    return _result(
        answer, ctx["intent"], ctx["sources"], ctx["inferred"], session_id,
        error_type=error_type, latency_ms=latency_ms,
        grounded=ctx["grounded"], agent_insights=ctx["agent_insights"],
        reasoning_trace=ctx.get("reasoning_trace"),
        persona=ctx.get("persona_label"),
    )


# ── Public API — streaming ─────────────────────────────────────────────────────

async def route_advisor_query_stream(
    question: str,
    crop: Optional[str],
    state: Optional[str],
    session_id: str,
    view_mode: Optional[str] = None,
):
    """
    Async generator — yields SSE event dicts for the streaming endpoint.

    Protocol:
      {"type": "token", "token": str}          — incremental text tokens
      {"type": "done",  "intent": ..., ...}    — final metadata after stream
      {"type": "error", "error_type": ..., ...} — on fatal pipeline failure
    """
    global last_trace

    ctx   = await _prepare_query_context(question, crop, state, session_id, view_mode)
    trace = ctx["trace"]

    # Rejection: stream the rejection text then close
    if ctx["rejected"]:
        last_trace = _finish_trace(trace)
        yield {"type": "token", "token": ctx["rejection_text"]}
        yield {
            "type":             "done",
            "intent":           "rejected",
            "sources":          [],
            "inferred_context": [],
            "grounded":         False,
            "error_type":       None,
            "latency_ms":       0,
            "agent_insights":   {},
            "session_id":       session_id,
            "model_used":       _gemini.model_name(),
            "reasoning_trace":  None,
            "persona":          None,
        }
        return

    # ── Stream Gemini response ────────────────────────────────────────────────
    start     = time.monotonic()
    collected: list[str] = []
    error_type: str | None = None

    try:
        async for token in _gemini.generate_stream(ctx["full_prompt"]):
            collected.append(token)
            yield {"type": "token", "token": token}
    except Exception as exc:
        logger.error("stream_gemini_error: %s", exc, exc_info=True)
        error_type = "stream_error"

    latency_ms = (time.monotonic() - start) * 1000
    answer     = "".join(collected)

    _trace_stage(trace, "gemini_stream",
                 chars=len(answer), latency_ms=round(latency_ms),
                 tokens=len(collected), error_type=str(error_type))

    # ── Store turn with intent (Phase 4A) ─────────────────────────────────────
    if answer:
        memory_manager.store_turn(
            session_id, ctx["clean"], answer,
            ctx["eff_crop"], ctx["eff_state"],
            intent=ctx["intent"],
        )
        if ctx["eff_crop"] or ctx["eff_state"]:
            memory_manager.update_context(
                session_id, crop=ctx["eff_crop"], state=ctx["eff_state"]
            )

    trace["sources"]    = ctx["sources"]
    trace["error_type"] = error_type
    trace["latency_ms"] = round(latency_ms)
    trace["grounded"]   = ctx["grounded"]
    last_trace = _finish_trace(trace)

    logger.info("advisor_stream_complete", intent=ctx["intent"],
                crop=str(ctx["eff_crop"]), state=str(ctx["eff_state"]),
                session=session_id[:8], latency_ms=round(latency_ms),
                persona=str(ctx.get("persona_label")))

    yield {
        "type":             "done",
        "intent":           ctx["intent"],
        "sources":          ctx["sources"],
        "inferred_context": ctx["inferred"],
        "grounded":         ctx["grounded"],
        "error_type":       error_type,
        "latency_ms":       round(latency_ms),
        "agent_insights":   ctx["agent_insights"],
        "session_id":       session_id,
        "model_used":       _gemini.model_name(),
        "reasoning_trace":  ctx.get("reasoning_trace"),
        "persona":          ctx.get("persona_label"),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _finish_trace(trace: dict) -> dict:
    trace["total_ms"] = round((time.monotonic() - trace["_t0"]) * 1000)
    trace.pop("_t0", None)
    return trace


def _result(
    answer: str,
    intent: str,
    sources: list[str],
    inferred: list[str],
    session_id: str,
    *,
    error_type: Optional[str] = None,
    latency_ms: float = 0.0,
    grounded: bool = False,
    agent_insights: dict | None = None,
    reasoning_trace: str | None = None,
    persona: str | None = None,
) -> dict:
    return {
        "answer":           answer,
        "intent":           intent,
        "sources":          sources,
        "inferred_context": inferred,
        "model_used":       _gemini.model_name(),
        "session_id":       session_id,
        "error_type":       error_type,
        "latency_ms":       round(latency_ms),
        "grounded":         grounded,
        "agent_insights":   agent_insights or {},
        "reasoning_trace":  reasoning_trace,
        "persona":          persona,
    }
