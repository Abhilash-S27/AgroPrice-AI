"""
RiskAgent — market risk & volatility intelligence.

Interprets volatility metrics, anomaly events, and data quality
to produce a structured risk assessment.
Operates entirely on deterministic data — no LLM calls.
"""
from __future__ import annotations

from typing import Any


# Volatility level → base risk score mapping
_VOL_BASE: dict[str, float] = {
    "stable":   0.12,
    "moderate": 0.38,
    "high":     0.68,
    "extreme":  0.90,
}


def analyze(ctx: dict[str, Any]) -> dict:
    """
    Analyze market risk for a crop+state.

    Risk score:  0.0 = minimal risk | 1.0 = maximum risk
    Verdict:     LOW_RISK | MODERATE_RISK | HIGH_RISK | EXTREME_RISK
    """
    if not ctx.get("has_data"):
        return _no_data(ctx)

    vol       = ctx.get("volatility") or {}
    anomalies = ctx.get("anomalies")  or []
    quality   = ctx.get("quality")    or {}
    staleness = ctx.get("staleness_days", 0)

    vol_level = vol.get("level", "moderate")
    cv        = vol.get("cv", 0.0)
    badge     = vol.get("badge", "Moderate")
    vol_7d    = vol.get("recent_7d_vol", 0)
    vol_30d   = vol.get("recent_30d_vol", 0)

    # Base risk from volatility level
    risk_score = _VOL_BASE.get(vol_level, 0.38)

    # Adjust for anomaly count
    high_anomalies = sum(1 for a in anomalies if a.get("severity") in ("high", "medium"))
    if high_anomalies >= 2:
        risk_score += 0.15
    elif high_anomalies == 1:
        risk_score += 0.08

    # Adjust for data quality
    q_score = quality.get("score", 50)
    if q_score < 35:
        risk_score += 0.10
    elif q_score > 70:
        risk_score -= 0.05

    # Adjust for stale data
    if staleness > 30:
        risk_score += 0.08
    elif staleness > 15:
        risk_score += 0.04

    risk_score = round(min(0.95, max(0.05, risk_score)), 2)

    # Verdict
    if risk_score < 0.25:
        verdict, risk_label = "LOW_RISK",      "low risk"
    elif risk_score < 0.50:
        verdict, risk_label = "MODERATE_RISK", "moderate risk"
    elif risk_score < 0.75:
        verdict, risk_label = "HIGH_RISK",     "elevated risk"
    else:
        verdict, risk_label = "EXTREME_RISK",  "extreme risk"

    signals: list[str] = []
    signals.append(f"Price volatility: {badge} (CV {cv:.0f}%) — classified as {risk_label}")

    if vol_30d > 0:
        signals.append(f"30-day price standard deviation: ₹{vol_30d:,.0f}/quintal")

    if anomalies:
        top = anomalies[0]
        evt = "spike" if top.get("event_type") == "spike" else "crash"
        signals.append(
            f"Recent price {evt} detected: {top.get('pct_deviation', 0):+.1f}% on {top.get('date')} "
            f"(severity: {top.get('severity')})"
        )
    else:
        signals.append("No significant price anomalies detected in the last 90 days")

    if staleness > 15:
        signals.append(f"Data is {staleness} days old — treat forecasts with added caution")

    headline = (
        f"{ctx.get('crop','Crop')} in {ctx.get('state','market')} carries "
        f"{risk_label} (volatility CV {cv:.0f}%, "
        f"{len(anomalies)} anomal{'y' if len(anomalies)==1 else 'ies'} in 90 days)."
    )

    return {
        "agent":       "risk",
        "headline":    headline,
        "signals":     signals,
        "score":       risk_score,
        "score_label": risk_label,
        "verdict":     verdict,
        "details": {
            "volatility_cv":    cv,
            "volatility_level": vol_level,
            "volatility_badge": badge,
            "vol_7d_std":       vol_7d,
            "vol_30d_std":      vol_30d,
            "anomaly_count":    len(anomalies),
            "high_anomalies":   high_anomalies,
            "quality_score":    q_score,
            "staleness_days":   staleness,
        },
    }


def _no_data(ctx: dict) -> dict:
    return {
        "agent":       "risk",
        "headline":    f"Risk profile unavailable for {ctx.get('crop','crop')} in {ctx.get('state','state')}.",
        "signals":     ["Insufficient price history for risk assessment."],
        "score":       0.5,
        "score_label": "unknown",
        "verdict":     "UNKNOWN",
        "details":     {},
    }
