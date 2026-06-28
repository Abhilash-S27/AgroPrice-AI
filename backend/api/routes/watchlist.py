"""
backend/api/routes/watchlist.py

AI Market Watchlist endpoint — Phase 4A Step 9.

Produces dynamic watchlist buckets by running the multi-agent briefing pipeline
across Tier-1 crops and sorting the results into actionable groups.

GET /api/watchlist
  → {
      momentum_leaders  : [{crop, state, verdict, score, headline}],
      risk_watch        : [{crop, state, verdict, score, headline}],
      safest_picks      : [{crop, state, verdict, score, headline}],
      seasonal_peaks    : [{crop, state, verdict, score, headline}],
      top_opportunity   : {crop, state, headline, opportunity_score} | null,
      generated_at      : ISO timestamp,
    }

All data comes from the deterministic agent pipeline. No LLM calls.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter

from backend.core.logger import get_logger

router   = APIRouter()
logger   = get_logger(__name__)

_BULLISH_TREND  = {"STRONG_BULLISH", "BULLISH", "MILD_BULLISH"}
_HIGH_RISK      = {"HIGH_RISK", "EXTREME_RISK"}
_LOW_RISK       = {"LOW_RISK", "MODERATE_RISK"}
_PEAK_SEASON    = {"DEEP_PEAK", "PEAK_SEASON"}


def _safe_briefing(crop: str, state: str) -> dict | None:
    """Run briefing for one crop/state. Returns None on failure."""
    try:
        from backend.services.market_briefing_engine import get_market_briefing
        b = get_market_briefing(crop, state)
        if b.get("has_data"):
            return b
    except Exception as exc:
        logger.debug("watchlist_briefing_fail crop=%s state=%s: %s", crop, state, exc)
    return None


def _entry(crop: str, state: str, agent_name: str, briefing: dict) -> dict:
    """Extract a compact watchlist entry from one agent's output."""
    agent  = (briefing.get("agents") or {}).get(agent_name) or {}
    return {
        "crop":     crop,
        "state":    state,
        "verdict":  agent.get("verdict", "UNKNOWN"),
        "score":    round(agent.get("score", 0.0), 3),
        "headline": agent.get("headline", ""),
        "opportunity_score": round(briefing.get("opportunity_score", 0.0), 3),
    }


@router.get("")
async def get_watchlist(max_crops: int = 8) -> dict:
    """
    Generate the AI Market Watchlist from Tier-1 crop briefings.

    Runs the deterministic 4-agent pipeline for each crop in parallel
    (asyncio.to_thread) and buckets the results.

    No LLM calls — pure deterministic analytics.
    """
    from backend.data.analytics import TIER1_HOME_STATE

    targets = list(TIER1_HOME_STATE.items())[:max_crops]

    # Run briefings concurrently in thread pool (each is sync DuckDB — safe)
    tasks   = [asyncio.to_thread(_safe_briefing, crop, state) for crop, state in targets]
    results = await asyncio.gather(*tasks)
    briefings: list[tuple[str, str, dict]] = [
        (crop, state, b)
        for (crop, state), b in zip(targets, results)
        if b is not None
    ]

    momentum_leaders: list[dict] = []
    risk_watch:       list[dict] = []
    safest_picks:     list[dict] = []
    seasonal_peaks:   list[dict] = []
    top_opp:          dict | None = None
    top_opp_score     = -1.0

    for crop, state, b in briefings:
        agents = b.get("agents") or {}

        trend_verdict = (agents.get("trend") or {}).get("verdict", "")
        risk_verdict  = (agents.get("risk")  or {}).get("verdict", "")
        sea_verdict   = (agents.get("seasonal") or {}).get("verdict", "")
        opp_score     = b.get("opportunity_score", 0.0)

        if trend_verdict in _BULLISH_TREND:
            momentum_leaders.append(_entry(crop, state, "trend", b))

        if risk_verdict in _HIGH_RISK:
            risk_watch.append(_entry(crop, state, "risk", b))

        if risk_verdict in _LOW_RISK and trend_verdict not in {"STRONG_BEARISH", "BEARISH"}:
            safest_picks.append(_entry(crop, state, "risk", b))

        if sea_verdict in _PEAK_SEASON:
            seasonal_peaks.append(_entry(crop, state, "seasonal", b))

        if opp_score > top_opp_score:
            top_opp_score = opp_score
            top_opp = {
                "crop":             crop,
                "state":            state,
                "headline":         (agents.get("recommendation") or {}).get("headline", ""),
                "opportunity_score": round(opp_score, 3),
                "verdict":          (agents.get("recommendation") or {}).get("verdict", ""),
            }

    # Sort each bucket by score descending
    def _sort_score(lst: list[dict]) -> list[dict]:
        return sorted(lst, key=lambda x: x["score"], reverse=True)[:4]

    return {
        "momentum_leaders":  _sort_score(momentum_leaders),
        "risk_watch":        _sort_score(risk_watch),
        "safest_picks":      _sort_score(safest_picks),
        "seasonal_peaks":    _sort_score(seasonal_peaks),
        "top_opportunity":   top_opp,
        "crops_analysed":    len(briefings),
        "generated_at":      datetime.now(timezone.utc).isoformat(),
    }
