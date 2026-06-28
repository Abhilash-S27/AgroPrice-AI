"""
TrendAgent — momentum & price direction intelligence.

Analyzes momentum signals, trend reversals, and bullish/bearish positioning.
Operates entirely on deterministic insight_context data — no LLM calls.
"""
from __future__ import annotations

from typing import Any


def analyze(ctx: dict[str, Any]) -> dict:
    """
    Analyze price trend and momentum for a crop+state.

    Args:
        ctx: dict from build_insight_context()

    Returns:
        Agent insight dict with headline, signals, score, verdict.
    """
    if not ctx.get("has_data"):
        return _no_data(ctx)

    mom    = ctx.get("momentum") or {}
    score  = float(mom.get("score", 0.0))   # % change 7d vs 30d
    signal = mom.get("signal", "neutral")
    avg_7d = mom.get("avg_7d", 0)
    avg_30d = mom.get("avg_30d", 0)
    last_price = ctx.get("last_price", 0)
    price_vs_year = ctx.get("price_vs_year", 0.0)

    # Normalize momentum score to 0-1 (1 = most bullish)
    if score >= 10:
        trend_score, verdict, label = 0.90, "STRONG_BULLISH", "very bullish"
    elif score >= 5:
        trend_score, verdict, label = 0.72, "BULLISH", "bullish"
    elif score >= 2:
        trend_score, verdict, label = 0.60, "MILD_BULLISH", "slightly bullish"
    elif score >= -2:
        trend_score, verdict, label = 0.50, "NEUTRAL", "neutral"
    elif score >= -5:
        trend_score, verdict, label = 0.40, "MILD_BEARISH", "slightly bearish"
    elif score >= -10:
        trend_score, verdict, label = 0.28, "BEARISH", "bearish"
    else:
        trend_score, verdict, label = 0.10, "STRONG_BEARISH", "very bearish"

    # Build signals
    signals: list[str] = []
    if avg_7d and avg_30d:
        dir_word = "above" if avg_7d > avg_30d else "below"
        signals.append(
            f"7-day avg ₹{avg_7d:,.0f}/qtl is {dir_word} the 30-day avg "
            f"₹{avg_30d:,.0f}/qtl ({score:+.1f}%)"
        )
    if price_vs_year != 0:
        yr_dir = "above" if price_vs_year > 0 else "below"
        signals.append(
            f"Current prices are {abs(price_vs_year):.1f}% {yr_dir} "
            f"the annual average"
        )
    if last_price:
        signals.append(f"Latest recorded price: ₹{last_price:,.0f}/quintal")

    # Trend reversal flag
    if abs(score) > 8 and price_vs_year * score < 0:
        signals.append("Possible trend reversal: short-term momentum diverges from annual baseline")

    direction_word = "rising" if score > 2 else "falling" if score < -2 else "stable"
    headline = (
        f"{ctx.get('crop','Crop')} prices in {ctx.get('state','market')} are "
        f"{direction_word} ({score:+.1f}% 7-day momentum) — market sentiment: {label}."
    )

    return {
        "agent":       "trend",
        "headline":    headline,
        "signals":     signals,
        "score":       round(trend_score, 2),
        "score_label": label,
        "verdict":     verdict,
        "details": {
            "momentum_score":   round(score, 1),
            "momentum_signal":  signal,
            "avg_7d":           avg_7d,
            "avg_30d":          avg_30d,
            "last_price":       last_price,
            "price_vs_year":    round(price_vs_year, 1),
            "direction":        direction_word,
        },
    }


def _no_data(ctx: dict) -> dict:
    return {
        "agent":       "trend",
        "headline":    f"Insufficient price data for {ctx.get('crop','crop')} in {ctx.get('state','state')}.",
        "signals":     ["No price series available for trend analysis."],
        "score":       0.5,
        "score_label": "unknown",
        "verdict":     "UNKNOWN",
        "details":     {},
    }
