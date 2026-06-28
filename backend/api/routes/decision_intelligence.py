"""
backend/api/routes/decision_intelligence.py

Decision Intelligence endpoints — Phase 5.

GET /api/decision/council/{crop}/{state}
    Full 7-agent council decision for one crop+state.

GET /api/decision/probability/{crop}/{state}
    Probabilistic outlook (upside/downside/shock/reversal probabilities).

GET /api/decision/strategy/{crop}/{state}
    Mode-specific strategic recommendation.
    Optional query param: ?mode=farmer|trader|wholesale|analyst

GET /api/decision/relationships/{crop}
    Cross-market influence graph for a crop.

GET /api/decision/opportunities
    Multi-crop opportunity matrix with scoring across all dimensions.

GET /api/decision/executive-summary
    Executive synthesis across top crops.

All endpoints are deterministic — no Gemini calls.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


# ── Shared helper ──────────────────────────────────────────────────────────────

def _run_full_decision_pipeline(crop: str, state: str) -> dict | None:
    """
    Synchronous helper — run the full Phase 5 decision pipeline for one crop.
    Safe for asyncio.to_thread.
    Returns a dict with: raw_ctx, council, consensus, probability, strategy, trace, synthesis
    """
    try:
        from backend.services.ai_forecast_narrator import build_insight_context
        from backend.services.agents.market_briefing_agent import run_briefing
        from backend.services.agent_council import run_council, council_to_dict
        from backend.services.consensus_engine import compute_consensus, consensus_to_dict
        from backend.services.probability_engine import compute_probabilistic_outlook, outlook_to_dict
        from backend.services.strategy_engine import compute_strategy, strategy_to_dict
        from backend.services.decision_trace_engine import build_decision_trace, trace_to_dict
        from backend.services.executive_synthesis_engine import generate_executive_synthesis, synthesis_to_dict

        raw_ctx  = build_insight_context(crop, state, days=90)
        if not raw_ctx.get("has_data"):
            return None

        # Run existing agent briefing (Phase 2B)
        briefing = run_briefing(raw_ctx)
        agents   = briefing.get("agents", {})

        # Phase 5: council
        council_result = run_council(raw_ctx)
        council        = council_to_dict(council_result)

        # Phase 5: consensus
        consensus_result = compute_consensus(council, raw_ctx)
        consensus        = consensus_to_dict(consensus_result)

        # Phase 5: probability
        prob_result = compute_probabilistic_outlook(raw_ctx)
        probability = outlook_to_dict(prob_result)

        # Phase 5: strategy (default general mode — callers can specify)
        strat_result = compute_strategy(raw_ctx, council, consensus, probability)
        strategy     = strategy_to_dict(strat_result)

        # Phase 5: trace
        trace_result = build_decision_trace(raw_ctx, council, consensus, probability)
        trace        = trace_to_dict(trace_result)

        # Phase 5: synthesis
        synth_result = generate_executive_synthesis(raw_ctx, council, consensus, probability, strategy)
        synthesis    = synthesis_to_dict(synth_result)

        return {
            "crop":         crop,
            "state":        state,
            "has_data":     True,
            "council":      council,
            "consensus":    consensus,
            "probability":  probability,
            "strategy":     strategy,
            "trace":        trace,
            "synthesis":    synthesis,
            "legacy_agents": agents,   # Phase 2B agents for backward compat
        }
    except Exception as exc:
        logger.debug("decision_pipeline_fail crop=%s state=%s: %s", crop, state, exc)
        return None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/council/{crop}/{state}")
async def get_council(crop: str, state: str) -> dict:
    """
    Full 7-agent council decision for one crop+state.
    Returns: council with agent votes, consensus strength, recommendation.
    """
    from backend.utils.validators import validate_crop, validate_state

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = await asyncio.to_thread(_run_full_decision_pipeline, crop, state)

    if not result:
        return {
            "crop": crop, "state": state, "has_data": False,
            "council": {}, "consensus": {}, "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "crop":         result["crop"],
        "state":        result["state"],
        "has_data":     True,
        "council":      result["council"],
        "consensus":    result["consensus"],
        "trace":        result["trace"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/probability/{crop}/{state}")
async def get_probability(crop: str, state: str) -> dict:
    """
    Probabilistic outlook for one crop+state.
    Returns upside/downside/sideways probabilities, shock risk, reversal probability.
    """
    from backend.utils.validators import validate_crop, validate_state

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = await asyncio.to_thread(_run_full_decision_pipeline, crop, state)

    if not result:
        return {
            "crop": crop, "state": state, "has_data": False,
            "probability": {}, "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "crop":         result["crop"],
        "state":        result["state"],
        "has_data":     True,
        "probability":  result["probability"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/strategy/{crop}/{state}")
async def get_strategy(
    crop: str,
    state: str,
    mode: str = Query(default="general", description="farmer|trader|wholesale|analyst|general"),
) -> dict:
    """
    Mode-specific strategic recommendation for one crop+state.
    """
    from backend.utils.validators import validate_crop, validate_state
    from backend.services.strategy_engine import compute_strategy, strategy_to_dict

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = await asyncio.to_thread(_run_full_decision_pipeline, crop, state)

    if not result:
        return {
            "crop": crop, "state": state, "has_data": False,
            "strategy": {}, "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # Re-run strategy with the requested mode
    if mode not in ("farmer", "trader", "wholesale", "analyst", "general"):
        mode = "general"

    try:
        from backend.services.ai_forecast_narrator import build_insight_context

        raw_ctx = await asyncio.to_thread(build_insight_context, crop, state)
        strat   = compute_strategy(
            raw_ctx,
            result["council"],
            result["consensus"],
            result["probability"],
            mode=mode,
        )
        strategy = strategy_to_dict(strat)
    except Exception:
        strategy = result["strategy"]

    return {
        "crop":         result["crop"],
        "state":        result["state"],
        "mode":         mode,
        "has_data":     True,
        "strategy":     strategy,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/relationships/{crop}")
async def get_relationships(crop: str) -> dict:
    """
    Cross-market influence graph for a crop.
    Returns related crops, relationship types, contagion risk.
    """
    from backend.utils.validators import validate_crop
    from backend.services.cross_market_engine import get_crop_relationships

    try:
        crop = validate_crop(crop)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Optionally load current market state for contagion assessment
    raw_ctx = None
    try:
        from backend.services.ai_forecast_narrator import build_insight_context
        from backend.utils.crop_registry import get_crop_info

        info = get_crop_info(crop)
        if info:
            raw_ctx = await asyncio.to_thread(
                build_insight_context, crop, info.home_state, 90
            )
    except Exception:
        pass

    relationships = get_crop_relationships(crop, raw_ctx)
    relationships["generated_at"] = datetime.now(timezone.utc).isoformat()
    return relationships


@router.get("/opportunities")
async def get_opportunities(
    max_crops: int = Query(default=12, ge=4, le=27),
) -> dict:
    """
    Multi-crop opportunity matrix with scoring across 7 dimensions.
    Returns ranked crops with top opportunities, most dangerous, best stability, etc.
    """
    from backend.data.analytics import TIER1_HOME_STATE
    from backend.services.opportunity_matrix import (
        score_crop_for_matrix, build_opportunity_matrix, matrix_to_dict,
    )

    targets = list(TIER1_HOME_STATE.items())[:max_crops]

    async def _score_one(crop: str, state: str):
        try:
            result = await asyncio.to_thread(_run_full_decision_pipeline, crop, state)
            if not result or not result.get("has_data"):
                return None
            from backend.services.ai_forecast_narrator import build_insight_context
            raw_ctx = await asyncio.to_thread(build_insight_context, crop, state, 90)
            return score_crop_for_matrix(raw_ctx, result["council"], result["consensus"])
        except Exception as exc:
            logger.debug("opportunity_matrix_fail crop=%s: %s", crop, exc)
            return None

    tasks   = [_score_one(crop, state) for crop, state in targets]
    results = await asyncio.gather(*tasks)
    entries = [r for r in results if r is not None]

    matrix = build_opportunity_matrix(entries)
    return {
        "matrix":        matrix_to_dict(matrix),
        "crops_scored":  len(entries),
        "generated_at":  datetime.now(timezone.utc).isoformat(),
    }


@router.get("/executive-summary")
async def get_executive_summary(
    max_crops: int = Query(default=8, ge=3, le=15),
) -> dict:
    """
    Executive synthesis across top crops.
    Returns institutional briefings, posture distribution, escalations.
    """
    from backend.data.analytics import TIER1_HOME_STATE

    targets = list(TIER1_HOME_STATE.items())[:max_crops]
    tasks   = [asyncio.to_thread(_run_full_decision_pipeline, c, s) for c, s in targets]
    results = await asyncio.gather(*tasks)

    syntheses   = []
    posture_dist: dict[str, int] = {}
    all_escals  = []
    all_cards   = []

    for r in results:
        if not r or not r.get("has_data"):
            continue
        s = r.get("synthesis", {})
        syntheses.append({
            "crop":              r["crop"],
            "state":             r["state"],
            "executive_summary": s.get("executive_summary", ""),
            "strategic_outlook": s.get("strategic_outlook", ""),
            "market_posture":    s.get("market_posture", "NEUTRAL"),
            "posture_color":     s.get("posture_color", "gray"),
            "escalation_briefing": s.get("escalation_briefing", []),
        })
        posture = s.get("market_posture", "NEUTRAL")
        posture_dist[posture] = posture_dist.get(posture, 0) + 1
        all_escals.extend(s.get("escalation_briefing", []))
        cards = s.get("briefing_cards", [])
        for card in cards:
            if card.get("severity") == "high":
                all_cards.append({**card, "crop": r["crop"], "state": r["state"]})

    # Overall market posture
    dominant_posture = max(posture_dist, key=posture_dist.get) if posture_dist else "NEUTRAL"

    return {
        "syntheses":          syntheses,
        "posture_distribution": posture_dist,
        "dominant_posture":   dominant_posture,
        "critical_escalations": all_escals[:10],
        "high_priority_cards": all_cards[:8],
        "crops_analysed":     len(syntheses),
        "generated_at":       datetime.now(timezone.utc).isoformat(),
    }
