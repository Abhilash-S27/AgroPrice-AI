"""
backend/services/correlation_engine.py

Market signal correlation and contradiction detection — Phase 4A Step 6.

Identifies confirming agreements and contradictions between the 4 deterministic
agents (Trend, Risk, Seasonal, Recommendation) and the raw market context.
Pre-formats the findings as text that Gemini can reason about without inventing data.

CRITICAL ARCHITECTURE RULE:
  - All inputs come from the deterministic agent pipeline and raw_ctx.
  - No numeric values are invented here — we interpret existing verdicts.
  - Returns [] when agent data is absent (graceful no-op).

Usage:
    from backend.services.correlation_engine import detect_market_correlations
    signals = detect_market_correlations(agent_insights, raw_ctx)
    # Returns list[str] — each item is a pre-formatted correlation finding.
"""

from __future__ import annotations

_BULLISH   = {"STRONG_BULLISH", "BULLISH", "MILD_BULLISH"}
_BEARISH   = {"STRONG_BEARISH", "BEARISH", "MILD_BEARISH"}
_HIGH_RISK = {"HIGH_RISK", "EXTREME_RISK"}
_LOW_RISK  = {"LOW_RISK", "MODERATE_RISK"}
_PEAK      = {"DEEP_PEAK", "PEAK_SEASON"}
_TROUGH    = {"LEAN_SEASON", "DEEP_TROUGH"}
_SELL      = {"SELL_NOW", "SELL_SOON"}
_HOLD      = {"HOLD", "WAIT", "WATCH"}


def detect_market_correlations(
    agent_insights: dict,
    raw_ctx: dict,
) -> list[str]:
    """
    Detect confirming and contradicting signals across agent verdicts + raw context.

    Args:
        agent_insights: {trend, risk, seasonal, recommendation} agent result dicts.
        raw_ctx:        Full insight context from build_insight_context().

    Returns:
        List of pre-formatted signal strings (max 5) for prompt injection.
        Returns [] when agent data is insufficient.
    """
    trend_v = _v(agent_insights, "trend")
    risk_v  = _v(agent_insights, "risk")
    sea_v   = _v(agent_insights, "seasonal")
    rec_v   = _v(agent_insights, "recommendation")

    if not any([trend_v, risk_v, sea_v, rec_v]):
        return []

    signals: list[str] = []

    # ── CONFIRMING: aligned signals (raise conviction) ─────────────────────────

    if trend_v in _BULLISH and sea_v in _PEAK:
        signals.append(
            "CONFIRMING — Bullish momentum + peak season: rising prices during harvest "
            "season suggests strong demand absorption; prices may stay elevated."
        )

    if trend_v in _BEARISH and sea_v in _TROUGH:
        signals.append(
            "CONFIRMING — Bearish momentum + lean season: falling prices during off-season "
            "confirms weak demand; recovery unlikely until seasonal demand resumes."
        )

    if trend_v in _BULLISH and rec_v in _SELL:
        signals.append(
            "CONFIRMING — Upward trend + SELL recommendation: both momentum and "
            "strategy engines agree — this is a high-conviction selling window."
        )

    if trend_v in _BULLISH and risk_v in _LOW_RISK:
        signals.append(
            "CONFIRMING — Rising prices with low/moderate volatility: "
            "a stable uptrend with lower probability of sudden reversal."
        )

    if trend_v in _BEARISH and risk_v in _HIGH_RISK:
        signals.append(
            "CONFIRMING — Falling prices with high volatility: "
            "a dangerous combination; holding inventory risks both price decline and "
            "unpredictable swings."
        )

    # ── CONTRADICTING: conflicting signals (flag uncertainty) ─────────────────

    if trend_v in _BULLISH and risk_v in _HIGH_RISK:
        signals.append(
            "CONTRADICTION — Prices are rising but volatility is extreme: "
            "the uptrend may be fragile; sharp reversals are possible on supply news."
        )

    if trend_v in _BEARISH and sea_v in _PEAK:
        signals.append(
            "CONTRADICTION — Prices falling despite peak season: "
            "unusual — possible causes: oversupply, quality issues, or weak export demand. "
            "Investigate local mandi arrivals before acting."
        )

    if trend_v in _BULLISH and rec_v in _HOLD:
        signals.append(
            "MIXED SIGNAL — Bullish trend but HOLD/WAIT recommendation: "
            "risk or seasonal factors are tempering what would otherwise be a buy/hold signal. "
            "Review risk and seasonal panels before deciding."
        )

    if sea_v in _PEAK and risk_v in _HIGH_RISK:
        signals.append(
            "MIXED SIGNAL — Peak season + high volatility: "
            "seasonal demand should support prices, but extreme volatility makes "
            "precise timing difficult. A staged/partial sell strategy reduces exposure."
        )

    if trend_v in _BEARISH and rec_v in _SELL and sea_v in _TROUGH:
        signals.append(
            "TRIPLE BEAR — Bearish trend, lean season, and SELL recommendation all align: "
            "strong downside case. Holding inventory through this window carries elevated risk."
        )

    # ── ANOMALY context correlation ────────────────────────────────────────────
    n_anomalies = len(raw_ctx.get("anomalies") or [])
    if n_anomalies >= 2:
        direction = "upward" if trend_v in _BULLISH else ("downward" if trend_v in _BEARISH else "neutral")
        signals.append(
            f"ANOMALY CONTEXT — {n_anomalies} recent price anomalies detected alongside "
            f"{direction} trend: anomalies may be driving or distorting the apparent momentum. "
            "Treat trend signals with additional caution."
        )

    return signals[:5]  # cap at 5 to keep prompt concise


def _v(agent_insights: dict, agent_name: str) -> str:
    """Safe verdict extraction."""
    return (agent_insights.get(agent_name) or {}).get("verdict", "")
