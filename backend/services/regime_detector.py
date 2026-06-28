"""
backend/services/regime_detector.py

Market regime detection — Phase 4B Step 7.

Maps agent verdicts + raw analytics into a named market regime.
Regimes provide a concise label for the dominant market dynamic.

CRITICAL: All inputs from deterministic pipeline. No Gemini calls.
"""

from __future__ import annotations

from dataclasses import dataclass

_BULLISH   = {"STRONG_BULLISH", "BULLISH", "MILD_BULLISH"}
_BEARISH   = {"STRONG_BEARISH", "BEARISH", "MILD_BEARISH"}
_HIGH_RISK = {"HIGH_RISK", "EXTREME_RISK"}
_LOW_RISK  = {"LOW_RISK", "MODERATE_RISK"}
_PEAK      = {"DEEP_PEAK", "PEAK_SEASON"}
_TROUGH    = {"LEAN_SEASON", "DEEP_TROUGH"}

REGIME_CONFIG: dict[str, dict] = {
    "BULLISH_EXPANSION": {
        "label":       "Bullish Expansion",
        "color":       "emerald",
        "icon":        "🚀",
        "description": "Sustained upward momentum with manageable risk",
    },
    "STABLE": {
        "label":       "Stable Market",
        "color":       "blue",
        "icon":        "⚖️",
        "description": "Low volatility, neutral direction, predictable environment",
    },
    "PANIC_VOLATILITY": {
        "label":       "Panic / Volatility",
        "color":       "red",
        "icon":        "⚡",
        "description": "Extreme volatility and/or anomaly cluster detected",
    },
    "SEASONAL_CORRECTION": {
        "label":       "Seasonal Correction",
        "color":       "amber",
        "icon":        "📉",
        "description": "Prices diverging from seasonal norms — correction underway",
    },
    "RECOVERY_PHASE": {
        "label":       "Recovery Phase",
        "color":       "teal",
        "icon":        "📈",
        "description": "Emerging from trough — early-stage recovery signals",
    },
    "SEASONAL_PEAK_RUN": {
        "label":       "Seasonal Peak Run",
        "color":       "purple",
        "icon":        "🌙",
        "description": "Peak season driving prices — demand-side momentum",
    },
    "TRANSITIONAL": {
        "label":       "Transitional",
        "color":       "gray",
        "icon":        "↔️",
        "description": "Mixed signals — regime change may be forming",
    },
}


@dataclass
class RegimeInfo:
    name:        str
    label:       str
    color:       str
    icon:        str
    description: str


def detect_regime(agent_insights: dict, raw_ctx: dict) -> RegimeInfo:
    """
    Classify the current market into a named regime.

    Args:
        agent_insights: {trend, risk, seasonal, recommendation} agent results.
        raw_ctx:        Full insight context from build_insight_context().

    Returns:
        RegimeInfo describing the dominant market regime.
    """
    trend_v = _v(agent_insights, "trend")
    risk_v  = _v(agent_insights, "risk")
    sea_v   = _v(agent_insights, "seasonal")

    vol         = raw_ctx.get("volatility") or {}
    cv          = float(vol.get("cv") or 0.0)
    n_anomalies = len(raw_ctx.get("anomalies") or [])

    # ── PANIC: extreme conditions take priority ───────────────────────────────
    if risk_v == "EXTREME_RISK" or (cv > 45 and n_anomalies >= 2):
        return _make("PANIC_VOLATILITY")

    # ── BULLISH with peak season → SEASONAL PEAK RUN ─────────────────────────
    if trend_v in _BULLISH and sea_v in _PEAK:
        return _make("SEASONAL_PEAK_RUN")

    # ── BULLISH with manageable risk → BULLISH EXPANSION ─────────────────────
    if trend_v in _BULLISH and risk_v in _LOW_RISK:
        return _make("BULLISH_EXPANSION")

    # ── RECOVERY: mild bullish coming out of trough ───────────────────────────
    if trend_v in {"MILD_BULLISH", "BULLISH"} and sea_v in _TROUGH:
        return _make("RECOVERY_PHASE")

    # ── SEASONAL CORRECTION: bearish during peak (contradiction) ──────────────
    if trend_v in _BEARISH and sea_v in _PEAK:
        return _make("SEASONAL_CORRECTION")

    # ── HIGH-RISK BEARISH → PANIC ─────────────────────────────────────────────
    if trend_v in _BEARISH and risk_v in _HIGH_RISK:
        return _make("PANIC_VOLATILITY")

    # ── STABLE: low risk, low volatility, neutral/mild trend ─────────────────
    if risk_v in _LOW_RISK and cv < 20 and n_anomalies == 0:
        return _make("STABLE")

    if risk_v == "LOW_RISK" and trend_v == "NEUTRAL":
        return _make("STABLE")

    # ── TRANSITIONAL: everything else ─────────────────────────────────────────
    return _make("TRANSITIONAL")


def _make(name: str) -> RegimeInfo:
    cfg = REGIME_CONFIG.get(name, REGIME_CONFIG["TRANSITIONAL"])
    return RegimeInfo(
        name=name,
        label=cfg["label"],
        color=cfg["color"],
        icon=cfg["icon"],
        description=cfg["description"],
    )


def _v(agent_insights: dict, key: str) -> str:
    return (agent_insights.get(key) or {}).get("verdict", "")
