"""
MarketBriefingAgent — orchestrates all agents to produce a comprehensive briefing.

Runs TrendAgent, RiskAgent, SeasonalAgent, and RecommendationAgent in sequence,
then produces an executive summary string.

This is still purely deterministic — no LLM calls. Gemini narration is added
by the router AFTER receiving the briefing dict.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from backend.services.agents import (
    trend_analyze,
    risk_analyze,
    seasonal_analyze,
    recommendation_analyze,
)


def run_briefing(insight_context: dict[str, Any]) -> dict:
    """
    Run all agents and produce a market briefing dict.

    Args:
        insight_context: dict from build_insight_context()

    Returns:
        {
            crop, state, has_data,
            agents: {trend, risk, seasonal, recommendation},
            executive_summary: str,
            opportunity_score: float,
            risk_level: str,
            generated_at: str,
        }
    """
    crop  = insight_context.get("crop", "Unknown")
    state = insight_context.get("state", "Unknown")

    if not insight_context.get("has_data"):
        return {
            "crop": crop, "state": state, "has_data": False,
            "agents": {},
            "executive_summary": (
                f"Insufficient market data for {crop} in {state}. "
                "No historical price series available."
            ),
            "opportunity_score": 0.0,
            "risk_level": "unknown",
            "generated_at": str(date.today()),
        }

    # Run all 4 agents
    trend      = trend_analyze(insight_context)
    risk       = risk_analyze(insight_context)
    seasonal   = seasonal_analyze(insight_context)
    rec        = recommendation_analyze(insight_context, trend, risk, seasonal)

    # Composite opportunity score (from recommendation agent)
    opp_score  = rec.get("score", 0.5)
    risk_level = risk.get("verdict", "MODERATE_RISK").replace("_", " ").lower()

    executive_summary = _build_executive_summary(
        crop, state, trend, risk, seasonal, rec, insight_context
    )

    return {
        "crop":  crop,
        "state": state,
        "has_data": True,
        "agents": {
            "trend":          trend,
            "risk":           risk,
            "seasonal":       seasonal,
            "recommendation": rec,
        },
        "executive_summary": executive_summary,
        "opportunity_score": round(opp_score, 2),
        "risk_level":        risk_level,
        "generated_at":      str(date.today()),
    }


def _build_executive_summary(
    crop: str, state: str,
    trend: dict, risk: dict, seasonal: dict, rec: dict,
    ctx: dict,
) -> str:
    """
    Generate a 2-3 sentence deterministic executive summary.
    All numbers come from real data — no invention.
    """
    last_price   = ctx.get("last_price", 0)
    price_vs_yr  = ctx.get("price_vs_year", 0.0)
    mom_score    = trend.get("details", {}).get("momentum_score", 0)
    cv           = risk.get("details", {}).get("volatility_cv", 0)
    phase        = seasonal.get("details", {}).get("current_phase", "normal")
    verdict      = rec.get("verdict", "HOLD")
    adv          = rec.get("details", {}).get("advice", "")

    price_str = f"₹{last_price:,.0f}/quintal" if last_price else "N/A"
    yr_str    = (
        f"{abs(price_vs_yr):.1f}% {'above' if price_vs_yr > 0 else 'below'} "
        "the annual baseline"
    ) if price_vs_yr != 0 else "in line with the annual baseline"

    trend_dir = "rising" if mom_score > 2 else "falling" if mom_score < -2 else "stable"

    season_note = {
        "peak":   "Currently in peak season — prices typically elevated.",
        "trough": "Currently in lean season — prices typically subdued.",
        "normal": "Currently in mid-season — normal price range expected.",
    }.get(phase, "")

    return (
        f"{crop} in {state}: current price {price_str} ({yr_str}), "
        f"trend {trend_dir} ({mom_score:+.1f}% 7-day momentum), "
        f"volatility CV {cv:.0f}%. {season_note} "
        f"AI recommendation: {verdict.replace('_',' ')}."
    )
