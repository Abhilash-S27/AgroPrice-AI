"""
backend/services/market_monitor.py

Autonomous Market Monitor — Phase 4B Steps 1-3.

Builds a full CropIntelligence assessment for one crop+state by running:
  - Agent pipeline (trend, risk, seasonal, recommendation)
  - Confidence engine
  - Correlation engine
  - Regime detector
  - Signal fusion
  - Temporal intelligence

The /api/intelligence/monitor route calls this across all Tier-1 crops in parallel.

CRITICAL: All analytics deterministic. No Gemini calls here.
"""

from __future__ import annotations

import logging

from backend.services.confidence_engine import compute_recommendation_confidence
from backend.services.correlation_engine import detect_market_correlations
from backend.services.signal_fusion import fuse_signals
from backend.services.temporal_intelligence import compute_temporal_intelligence

logger = logging.getLogger(__name__)

PRIORITY_CONFIG: dict[str, dict] = {
    "CRITICAL":       {"color": "red",    "icon": "🔴", "label": "Critical"},
    "HIGH_ATTENTION": {"color": "amber",  "icon": "🟠", "label": "High Attention"},
    "WATCH":          {"color": "blue",   "icon": "🔵", "label": "Watch"},
    "STABLE":         {"color": "gray",   "icon": "⚪", "label": "Stable"},
}


def build_crop_intelligence(
    crop:     str,
    state:    str,
    briefing: dict,
    raw_ctx:  dict,
) -> dict:
    """
    Build a complete autonomous intelligence assessment for one crop+state.

    Args:
        crop:     Crop name.
        state:    State name.
        briefing: Output from run_briefing(raw_ctx) — contains agents{} and opportunity_score.
        raw_ctx:  Output from build_insight_context(crop, state).

    Returns:
        A flat JSON-serialisable dict with all intelligence fields.
    """
    if not raw_ctx.get("has_data"):
        return {"crop": crop, "state": state, "has_data": False}

    agents    = briefing.get("agents") or {}
    opp_score = briefing.get("opportunity_score", 0.0)

    # ── Temporal analysis ──────────────────────────────────────────────────────
    ta = compute_temporal_intelligence(raw_ctx)

    # ── Confidence assessment ──────────────────────────────────────────────────
    has_forecast = bool((agents.get("recommendation") or {}).get("score"))
    ca = compute_recommendation_confidence(raw_ctx, has_forecast)

    # ── Correlation signals ────────────────────────────────────────────────────
    correlation_signals = detect_market_correlations(agents, raw_ctx)

    # ── Full signal fusion (regime + priority + escalations + synthesis) ───────
    fused = fuse_signals(
        agent_insights=agents,
        raw_ctx=raw_ctx,
        correlation_signals=correlation_signals,
        confidence_score=ca.score,
        temporal_direction=ta.direction,
    )

    return {
        "crop":  crop,
        "state": state,
        "has_data": True,

        # Fused intelligence (regime, priority, escalations, synthesis)
        **fused,

        # Temporal
        "temporal_label":    ta.label,
        "reversal_risk":     ta.reversal_risk,
        "velocity":          ta.velocity,
        "prior_velocity":    ta.prior_velocity,

        # Agent verdicts (for quick access)
        "trend_verdict":          (agents.get("trend")          or {}).get("verdict", "NEUTRAL"),
        "risk_verdict":           (agents.get("risk")           or {}).get("verdict", "MODERATE_RISK"),
        "seasonal_verdict":       (agents.get("seasonal")       or {}).get("verdict", "NORMAL"),
        "recommendation_verdict": (agents.get("recommendation") or {}).get("verdict", "WATCH"),

        # Scores
        "opportunity_score":  round(float(opp_score), 3),
        "confidence_score":   ca.score,
        "confidence_label":   ca.label,
        "confidence_aligned": fused["confidence_aligned"],

        # Correlation signals (for downstream use)
        "correlation_signals": correlation_signals,
    }
