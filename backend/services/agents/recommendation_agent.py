"""
RecommendationAgent — actionable agricultural intelligence.

Synthesizes trend, risk, and seasonal signals into a concrete
recommendation for farmers and traders.
Operates entirely on deterministic data — no LLM calls.
"""
from __future__ import annotations

from typing import Any


def analyze(
    ctx: dict[str, Any],
    trend: dict,
    risk: dict,
    seasonal: dict,
) -> dict:
    """
    Generate an actionable recommendation by synthesizing all agent outputs.

    Args:
        ctx:      Raw insight_context dict.
        trend:    TrendAgent output.
        risk:     RiskAgent output.
        seasonal: SeasonalAgent output.

    Returns:
        Agent insight dict with recommendation verdict.

    Verdicts: SELL_NOW | SELL_SOON | HOLD | WAIT | WATCH
    """
    if not ctx.get("has_data"):
        return _no_data(ctx)

    t_score = trend.get("score", 0.5)      # 0=bearish, 1=bullish
    r_score = risk.get("score", 0.5)       # 0=low risk, 1=high risk
    s_score = seasonal.get("score", 0.5)  # 0=deep trough, 1=deep peak

    phase       = seasonal.get("details", {}).get("current_phase", "normal")
    t_verdict   = trend.get("verdict", "NEUTRAL")
    r_verdict   = risk.get("verdict", "MODERATE_RISK")
    price_vs_yr = ctx.get("price_vs_year", 0.0)
    quality     = ctx.get("quality") or {}
    q_score     = quality.get("score", 50)

    # Composite opportunity score
    # High trend + low risk + peak season = highest opportunity
    opp_score = (t_score * 0.45) + ((1 - r_score) * 0.35) + (s_score * 0.20)
    opp_score = round(min(1.0, max(0.0, opp_score)), 2)

    # Decision logic
    verdict, action_label, confidence = _decide(
        t_score, r_score, s_score, phase, price_vs_yr, q_score
    )

    signals = _build_signals(ctx, trend, risk, seasonal, verdict)

    headline = _build_headline(ctx, verdict, action_label, t_score, r_score)

    advice = _build_advice(verdict, ctx, trend, risk, seasonal)

    return {
        "agent":       "recommendation",
        "headline":    headline,
        "signals":     signals,
        "score":       opp_score,
        "score_label": action_label,
        "verdict":     verdict,
        "details": {
            "opportunity_score": opp_score,
            "trend_score":       t_score,
            "risk_score":        r_score,
            "seasonal_score":    s_score,
            "confidence":        confidence,
            "advice":            advice,
            "trend_verdict":     t_verdict,
            "risk_verdict":      r_verdict,
            "phase":             phase,
        },
    }


def _decide(
    t: float, r: float, s: float,
    phase: str, price_vs_yr: float, q: float
) -> tuple[str, str, str]:
    """Decision matrix → (verdict, label, confidence)."""

    # Quality guard: low data quality reduces confidence
    conf = "high" if q >= 65 else "moderate" if q >= 40 else "low"

    bullish = t >= 0.60
    bearish = t <= 0.40
    low_risk = r <= 0.40
    high_risk = r >= 0.65
    peak = phase == "peak"
    trough = phase == "trough"

    if bullish and low_risk and peak:
        return "SELL_NOW",  "sell now",   conf
    if bullish and low_risk:
        return "SELL_SOON", "sell soon",  conf
    if bullish and high_risk:
        return "HOLD",      "hold — wait for stability", conf
    if bearish and high_risk:
        return "WAIT",      "wait — adverse conditions", conf
    if bearish and low_risk and not trough:
        return "HOLD",      "hold — downtrend may reverse", conf
    if trough and not high_risk:
        return "WATCH",     "watch — seasonal recovery likely", conf
    if peak and not bearish:
        return "SELL_SOON", "sell soon — use seasonal peak",  conf
    return "HOLD", "hold — mixed signals", conf


def _build_signals(
    ctx: dict, trend: dict, risk: dict, seasonal: dict, verdict: str
) -> list[str]:
    signals: list[str] = []

    # Lead with the key driver
    t_v = trend.get("verdict", "NEUTRAL")
    r_v = risk.get("verdict", "MODERATE_RISK")
    s_v = seasonal.get("verdict", "NORMAL")

    signals.append(f"Trend: {t_v.replace('_',' ').title()} | Risk: {r_v.replace('_',' ').title()} | Season: {s_v.replace('_',' ').title()}")

    mom_score = trend.get("details", {}).get("momentum_score", 0)
    if abs(mom_score) > 2:
        dir_ = "upward" if mom_score > 0 else "downward"
        signals.append(f"Momentum is {dir_} ({mom_score:+.1f}%) — {'supports selling' if mom_score > 0 else 'suggests caution'}")

    anomaly_count = risk.get("details", {}).get("anomaly_count", 0)
    if anomaly_count > 0:
        signals.append(f"{anomaly_count} price anomal{'y' if anomaly_count==1 else 'ies'} detected — heightened volatility risk")

    phase = seasonal.get("details", {}).get("current_phase", "normal")
    vs_norm = seasonal.get("details", {}).get("current_vs_norm", 0)
    if phase == "peak":
        signals.append(f"Seasonal pricing advantage: {vs_norm:+.1f}% above annual average")
    elif phase == "trough":
        signals.append(f"Seasonal headwind: {vs_norm:.1f}% below annual average")

    return signals


def _build_headline(
    ctx: dict, verdict: str, label: str, t: float, r: float
) -> str:
    crop  = ctx.get("crop", "Crop")
    state = ctx.get("state", "market")
    return (
        f"Recommendation for {crop} in {state}: **{label.upper()}** "
        f"(opportunity score {round((t * 0.45 + (1-r) * 0.35) * 100):.0f}/100)."
    )


def _build_advice(
    verdict: str, ctx: dict, trend: dict, risk: dict, seasonal: dict
) -> str:
    """One-paragraph actionable advice based on verdict."""
    crop  = ctx.get("crop", "the crop")
    state = ctx.get("state", "the market")

    texts = {
        "SELL_NOW": (
            f"Market conditions are favorable for {crop} sellers in {state}. "
            "Bullish momentum, manageable risk, and seasonal positioning all align. "
            "Consider liquidating inventory or forward-selling at current rates."
        ),
        "SELL_SOON": (
            f"Conditions for {crop} in {state} are improving. "
            "Momentum is positive but risk or seasonality may not be fully optimal yet. "
            "Plan a sale within the next 1–2 weeks while the trend holds."
        ),
        "HOLD": (
            f"Mixed signals for {crop} in {state}. "
            "Either the market is improving but volatile, or prices are declining "
            "but the downtrend may not sustain. "
            "Hold stock and reassess in 5–10 days."
        ),
        "WAIT": (
            f"Adverse conditions for {crop} in {state}. "
            "Bearish trend combined with high volatility creates unfavorable selling risk. "
            "Delay market entry until volatility settles or momentum reverses."
        ),
        "WATCH": (
            f"{crop} in {state} is at a seasonal trough with manageable risk. "
            "Prices may recover as the season progresses. "
            "Monitor daily price signals — entry may improve in 2–4 weeks."
        ),
    }
    return texts.get(verdict, f"Monitor {crop} in {state} closely. Conditions are mixed.")


def _no_data(ctx: dict) -> dict:
    return {
        "agent":       "recommendation",
        "headline":    f"Cannot generate recommendation — insufficient data for {ctx.get('crop','crop')} in {ctx.get('state','state')}.",
        "signals":     ["Insufficient market data to generate a grounded recommendation."],
        "score":       0.5,
        "score_label": "unknown",
        "verdict":     "UNKNOWN",
        "details":     {"confidence": "none", "advice": "Select a crop and state for grounded recommendations."},
    }
