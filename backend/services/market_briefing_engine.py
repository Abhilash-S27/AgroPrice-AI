"""
backend/services/market_briefing_engine.py

Orchestrates the multi-agent AI pipeline to produce market briefings
and proactive cross-crop intelligence reports.

Design:
  - Calls build_insight_context() once per crop+state
  - Runs all 4 agents via market_briefing_agent.run_briefing()
  - Returns structured briefing dicts (no Gemini calls here)
  - Gemini narration is added by the advisor_ai_router when needed

Usage:
    from backend.services.market_briefing_engine import get_market_briefing, get_proactive_insights
    briefing = get_market_briefing("Tomato", "Karnataka")
    proactive = get_proactive_insights()
"""
from __future__ import annotations

import logging
from typing import Optional

from backend.data.analytics import TIER1_HOME_STATE
from backend.services.agents.market_briefing_agent import run_briefing
from backend.services.ai_forecast_narrator import build_insight_context

logger = logging.getLogger(__name__)


def get_market_briefing(crop: str, state: str) -> dict:
    """
    Generate a full AI market briefing for one crop+state.

    Returns the complete run_briefing() output including all agent insights.
    Safe to call from API routes (synchronous — wrap in asyncio.to_thread if needed).
    """
    try:
        ctx = build_insight_context(crop, state, days=90)
    except Exception as exc:
        logger.error("briefing_context_failed crop=%s state=%s: %s", crop, state, exc)
        return {
            "crop": crop, "state": state, "has_data": False,
            "agents": {},
            "executive_summary": f"Data unavailable for {crop} in {state}.",
            "opportunity_score": 0.0,
            "risk_level": "unknown",
            "error": str(exc),
        }

    return run_briefing(ctx)


def get_proactive_insights(
    max_crops: int = 5,
    preferred_crops: Optional[list[str]] = None,
) -> dict:
    """
    Run briefings across Tier-1 crops and extract the most actionable signals.

    Returns:
        {
            top_opportunity:   {crop, state, headline, score},
            biggest_risk:      {crop, state, headline, risk_score},
            safest_market:     {crop, state, headline, risk_score},
            strongest_momentum:{crop, state, headline, trend_score},
            seasonal_alert:    {crop, state, headline, phase} | None,
            anomaly_alert:     {crop, state, headline, count} | None,
            generated_for:     list[str],
        }
    """
    targets = preferred_crops or list(TIER1_HOME_STATE.keys())
    targets = targets[:max_crops]

    briefings: list[dict] = []
    for crop in targets:
        state = TIER1_HOME_STATE.get(crop, "Karnataka")
        try:
            b = get_market_briefing(crop, state)
            if b.get("has_data"):
                briefings.append(b)
        except Exception as exc:
            logger.warning("proactive_briefing_failed crop=%s: %s", crop, exc)

    if not briefings:
        return {"error": "No data available for any Tier-1 crop."}

    # Top opportunity (highest opportunity_score)
    top_opp = max(briefings, key=lambda b: b.get("opportunity_score", 0))
    # Biggest risk (highest risk agent score)
    biggest_risk = max(briefings, key=lambda b: b["agents"]["risk"]["score"]
                       if "risk" in b.get("agents", {}) else 0)
    # Safest market (lowest risk agent score)
    safest = min(briefings, key=lambda b: b["agents"]["risk"]["score"]
                 if "risk" in b.get("agents", {}) else 1)
    # Strongest momentum (highest trend agent score)
    strongest_mom = max(briefings, key=lambda b: b["agents"]["trend"]["score"]
                        if "trend" in b.get("agents", {}) else 0)
    # Seasonal alert — any crop in peak/trough
    seasonal_alert = None
    for b in briefings:
        seas = b.get("agents", {}).get("seasonal", {})
        phase = seas.get("details", {}).get("current_phase", "normal")
        if phase in ("peak", "trough"):
            seasonal_alert = {
                "crop":     b["crop"],
                "state":    b["state"],
                "headline": seas.get("headline", ""),
                "phase":    phase,
            }
            break

    # Anomaly alert — any crop with high anomalies
    anomaly_alert = None
    for b in briefings:
        risk_d = b.get("agents", {}).get("risk", {}).get("details", {})
        cnt = risk_d.get("anomaly_count", 0)
        if cnt >= 2:
            anomaly_alert = {
                "crop":     b["crop"],
                "state":    b["state"],
                "headline": b["agents"]["risk"].get("headline", ""),
                "count":    cnt,
            }
            break

    def _snap(b: dict, extra: dict = {}) -> dict:
        out = {
            "crop":     b["crop"],
            "state":    b["state"],
            "headline": b.get("executive_summary", "")[:120],
            "score":    b.get("opportunity_score", 0),
        }
        out.update(extra)
        return out

    return {
        "top_opportunity":    _snap(top_opp),
        "biggest_risk":       _snap(biggest_risk, {
            "risk_score": biggest_risk.get("agents", {}).get("risk", {}).get("score", 0)
        }),
        "safest_market":      _snap(safest, {
            "risk_score": safest.get("agents", {}).get("risk", {}).get("score", 0)
        }),
        "strongest_momentum": _snap(strongest_mom, {
            "trend_score": strongest_mom.get("agents", {}).get("trend", {}).get("score", 0)
        }),
        "seasonal_alert":     seasonal_alert,
        "anomaly_alert":      anomaly_alert,
        "generated_for":      [b["crop"] for b in briefings],
    }
