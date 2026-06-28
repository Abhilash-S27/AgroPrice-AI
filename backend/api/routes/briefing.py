"""
backend/api/routes/briefing.py

Phase 2B — AI Market Briefing & Scenario Simulation API.

Endpoints:
  GET  /api/briefing/{crop}/{state}    → full AI market briefing (all agents)
  GET  /api/briefing/proactive         → cross-crop proactive intelligence
  POST /api/briefing/scenario          → "what-if" scenario simulation
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.core.logger import get_logger
from backend.utils.validators import validate_crop, validate_state

logger = get_logger(__name__)
router = APIRouter()


class ScenarioRequest(BaseModel):
    crop:     str
    state:    str
    scenario: str = Field(..., min_length=10, max_length=500,
                          description="Free-text what-if scenario")


@router.get("/proactive")
async def get_proactive_insights(
    crops: str = Query(default="", description="Comma-separated crop names (empty = Tier-1 defaults)"),
) -> dict:
    """
    Generate proactive intelligence across Tier-1 crops.

    Returns: top opportunity, biggest risk, safest market, strongest momentum,
    seasonal alert, anomaly alert.
    """
    from backend.services.market_briefing_engine import get_proactive_insights

    preferred = [c.strip() for c in crops.split(",") if c.strip()] or None
    try:
        result = await asyncio.to_thread(get_proactive_insights, 5, preferred)
        return result
    except Exception as exc:
        logger.error("proactive_insights_failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/{crop}/{state}")
async def get_market_briefing(crop: str, state: str) -> dict:
    """
    Full AI market briefing for one crop+state — all 4 agents.
    """
    from backend.services.market_briefing_engine import get_market_briefing as _get_briefing

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        result = await asyncio.to_thread(_get_briefing, crop, state)
        return result
    except Exception as exc:
        logger.error("market_briefing_failed crop=%s state=%s: %s", crop, state, exc)
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/recent/{crop}/{state}")
async def get_recent_market_changes(crop: str, state: str) -> dict:
    """
    Phase 3B — Deterministic recent market change detection.

    Returns prioritized change signals + analyst-grade narrative for a crop+state.
    Zero LLM calls — fully grounded in AGMARKNET analytics.
    """
    from backend.services.recent_market_changes import get_recent_changes_for

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        return await get_recent_changes_for(crop, state)
    except Exception as exc:
        logger.error("recent_changes_failed crop=%s state=%s: %s", crop, state, exc)
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/scenario")
async def simulate_scenario(request: ScenarioRequest) -> dict:
    """
    Heuristic "what-if" scenario simulation.

    Parses a free-text scenario and applies agricultural heuristics to
    estimate price direction, risk change, and farmer guidance.

    IMPORTANT: Results are heuristic estimates, NOT scientific forecasts.
    """
    from backend.services.scenario_engine import simulate_scenario as _simulate
    from backend.services.market_briefing_engine import get_market_briefing

    try:
        crop  = validate_crop(request.crop)
        state = validate_state(request.state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Fetch insight context for scaling (optional — graceful if fails)
    try:
        briefing = await asyncio.to_thread(get_market_briefing, crop, state)
        # Extract the raw insight_context data from the briefing
        # (approximate: use agent outputs to reconstruct key fields)
        ctx = _reconstruct_ctx_from_briefing(briefing, crop, state)
    except Exception:
        ctx = {"has_data": False}

    try:
        result = await asyncio.to_thread(
            _simulate, request.scenario, crop, state, ctx
        )
        return result
    except Exception as exc:
        logger.error("scenario_failed crop=%s state=%s: %s", crop, state, exc)
        raise HTTPException(status_code=502, detail=str(exc))


def _reconstruct_ctx_from_briefing(briefing: dict, crop: str, state: str) -> dict:
    """Reconstruct a minimal insight_context from a briefing dict."""
    agents = briefing.get("agents", {})
    risk   = agents.get("risk", {}).get("details", {})
    trend  = agents.get("trend", {}).get("details", {})
    return {
        "has_data":    briefing.get("has_data", False),
        "crop":        crop,
        "state":       state,
        "last_price":  trend.get("last_price", 0),
        "volatility":  {
            "cv":    risk.get("volatility_cv", 30),
            "level": risk.get("volatility_level", "moderate"),
            "badge": risk.get("volatility_badge", "Moderate"),
        },
    }
