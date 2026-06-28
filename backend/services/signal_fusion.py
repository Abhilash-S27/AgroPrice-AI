"""
backend/services/signal_fusion.py

Signal fusion engine — Phase 4B Step 6.

Combines all deterministic signals (trend, risk, seasonal, confidence,
correlations, temporal) into a single FusedIntelligenceState per crop.

CRITICAL: All inputs from deterministic pipeline. No Gemini calls.
"""

from __future__ import annotations

from backend.services.regime_detector import detect_regime, RegimeInfo

_BULLISH   = {"STRONG_BULLISH", "BULLISH", "MILD_BULLISH"}
_BEARISH   = {"STRONG_BEARISH", "BEARISH", "MILD_BEARISH"}
_HIGH_RISK = {"HIGH_RISK", "EXTREME_RISK"}
_LOW_RISK  = {"LOW_RISK", "MODERATE_RISK"}


def fuse_signals(
    agent_insights:      dict,
    raw_ctx:             dict,
    correlation_signals: list[str],
    confidence_score:    float | None,
    temporal_direction:  str = "stable",
) -> dict:
    """
    Synthesize all deterministic signals into one intelligence state dict.

    Returns a plain dict (JSON-serialisable) with:
        regime_name, regime_label, regime_color, regime_icon, regime_description,
        priority_level, priority_score,
        escalations (list[str]),
        dominant_signal (str),
        recommendation (str),
        synthesis (str),
        temporal_direction (str),
        confidence_aligned (bool),
    """
    regime: RegimeInfo = detect_regime(agent_insights, raw_ctx)
    escalations        = _detect_escalations(agent_insights, raw_ctx, correlation_signals)
    priority_score, priority_level = _compute_priority(
        agent_insights, raw_ctx, escalations, regime
    )
    dominant   = _dominant_signal(agent_insights, raw_ctx, escalations)
    rec        = _v(agent_insights, "recommendation")
    aligned    = _check_alignment(rec, confidence_score, raw_ctx)
    synthesis  = _synthesize(regime, dominant, temporal_direction, escalations)

    return {
        "regime_name":        regime.name,
        "regime_label":       regime.label,
        "regime_color":       regime.color,
        "regime_icon":        regime.icon,
        "regime_description": regime.description,
        "priority_level":     priority_level,
        "priority_score":     priority_score,
        "escalations":        escalations,
        "dominant_signal":    dominant,
        "recommendation":     rec or "WATCH",
        "synthesis":          synthesis,
        "temporal_direction": temporal_direction,
        "confidence_aligned": aligned,
    }


# ── Private helpers ────────────────────────────────────────────────────────────

def _detect_escalations(agent_insights: dict, raw_ctx: dict, correlation_signals: list[str]) -> list[str]:
    events: list[str] = []

    vol = raw_ctx.get("volatility") or {}
    cv  = float(vol.get("cv") or 0.0)
    n_anomalies = len(raw_ctx.get("anomalies") or [])
    risk_v  = _v(agent_insights, "risk")
    trend_v = _v(agent_insights, "trend")
    mom     = raw_ctx.get("momentum") or {}
    m7      = float(mom.get("7d_change_pct") or 0.0)

    if cv > 40:
        events.append(f"VOLATILITY_SURGE — CV {cv:.0f}% exceeds high-risk threshold (40%)")
    elif cv > 30:
        events.append(f"ELEVATED_VOLATILITY — CV {cv:.0f}% above normal range")

    if n_anomalies >= 3:
        events.append(f"ANOMALY_CLUSTER — {n_anomalies} price anomalies in 90-day window")
    elif n_anomalies >= 2:
        events.append(f"ANOMALY_PAIR — {n_anomalies} anomalies detected; cluster risk elevated")

    if abs(m7) > 15:
        dir_str = "bullish" if m7 > 0 else "bearish"
        events.append(f"RAPID_MOMENTUM — {abs(m7):.1f}% price movement this week ({dir_str})")

    # Flag first CONTRADICTION or TRIPLE BEAR from correlation engine
    for sig in correlation_signals:
        if sig.startswith("CONTRADICTION") or sig.startswith("TRIPLE BEAR"):
            short = sig.split(" — ", 1)[1][:80] if " — " in sig else sig[:80]
            events.append(f"CONTRADICTORY_SIGNALS — {short}")
            break

    if risk_v == "EXTREME_RISK" and trend_v in _BULLISH:
        events.append("DIVERGENCE_ALERT — Bullish trend masked by extreme risk environment")

    return events[:4]


def _compute_priority(agent_insights: dict, raw_ctx: dict, escalations: list[str], regime: RegimeInfo) -> tuple[float, str]:
    score = 20.0

    vol = raw_ctx.get("volatility") or {}
    cv  = float(vol.get("cv") or 0.0)
    n_anomalies = len(raw_ctx.get("anomalies") or [])
    risk_v = _v(agent_insights, "risk")

    score += min(len(escalations) * 15, 30)
    score += min(cv / 2.5, 20)
    score += min(n_anomalies * 8, 20)

    if risk_v == "EXTREME_RISK":
        score += 20
    elif risk_v == "HIGH_RISK":
        score += 10

    if regime.name == "PANIC_VOLATILITY":
        score += 15
    elif regime.name == "SEASONAL_CORRECTION":
        score += 10
    elif regime.name in {"BULLISH_EXPANSION", "STABLE"}:
        score = max(score - 5, 10)

    score = min(100.0, score)

    if score >= 75:
        level = "CRITICAL"
    elif score >= 55:
        level = "HIGH_ATTENTION"
    elif score >= 35:
        level = "WATCH"
    else:
        level = "STABLE"

    return round(score, 1), level


def _dominant_signal(agent_insights: dict, raw_ctx: dict, escalations: list[str]) -> str:
    if escalations:
        first = escalations[0]
        return first.split(" — ", 1)[1] if " — " in first else first

    risk_v  = _v(agent_insights, "risk")
    trend_v = _v(agent_insights, "trend")
    sea_v   = _v(agent_insights, "seasonal")

    if risk_v in {"EXTREME_RISK", "HIGH_RISK"}:
        return f"High market risk — {risk_v.replace('_', ' ').lower()}"
    if trend_v in {"STRONG_BULLISH", "BULLISH"}:
        return "Strong upward price momentum"
    if trend_v in {"STRONG_BEARISH", "BEARISH"}:
        return "Significant price decline in progress"
    if sea_v in {"DEEP_PEAK", "PEAK_SEASON"}:
        return "Currently in peak demand season"
    if sea_v in {"LEAN_SEASON", "DEEP_TROUGH"}:
        return "Seasonal trough — demand at low point"
    return "Normal market conditions"


def _check_alignment(recommendation: str, confidence_score: float | None, raw_ctx: dict) -> bool:
    if confidence_score is None:
        return True
    if recommendation in {"SELL_NOW", "SELL_SOON"} and confidence_score < 0.35:
        return False
    return True


def _synthesize(regime: RegimeInfo, dominant_signal: str, temporal_direction: str, escalations: list[str]) -> str:
    dir_clause = {
        "accelerating":  " with accelerating momentum",
        "decelerating":  " with slowing momentum",
        "reversing":     " with signs of reversal",
        "stable":        "",
    }.get(temporal_direction, "")

    esc = len(escalations)
    base = dominant_signal.lower().rstrip(".")

    if esc >= 2:
        return f"{regime.label} regime{dir_clause} — {esc} escalation signals require attention."
    if escalations:
        return f"{regime.label} regime{dir_clause} — {base}."
    return f"{regime.label} regime{dir_clause} — {base}."


def _v(agent_insights: dict, key: str) -> str:
    return (agent_insights.get(key) or {}).get("verdict", "")
