"""
backend/services/recent_market_changes.py

Phase 3B — Deterministic recent market change detection and analyst narrative generation.

Analyzes the insight_context dict (from build_insight_context) and produces:
  - A list of MarketChangeSignal objects (what changed, severity, direction)
  - A market_narrative string (analyst-grade 1-2 sentence summary)

Architecture invariant: ZERO LLM calls. All outputs are template-based
using real values from the deterministic analytics pipeline.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, asdict
from datetime import date
from typing import Any

from backend.services.ai_forecast_narrator import build_insight_context
from backend.core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class MarketChangeSignal:
    type:      str   # "anomaly" | "momentum" | "seasonal" | "volatility" | "price" | "data"
    icon:      str   # emoji for UI
    severity:  str   # "critical" | "high" | "medium" | "low"
    headline:  str   # ≤60 chars, user-facing
    detail:    str   # one sentence with numbers
    direction: str   # "up" | "down" | "neutral"


def detect_recent_changes(insight: dict) -> list[MarketChangeSignal]:
    """
    Analyze insight_context and return a prioritized list of MarketChangeSignal.
    Ordered by severity (critical → high → medium → low).
    Returns empty list if no data.
    """
    if not insight.get("has_data"):
        return []

    signals: list[MarketChangeSignal] = []

    vol       = insight.get("volatility") or {}
    mom       = insight.get("momentum")   or {}
    seas      = insight.get("seasonal")   or {}
    anomalies = insight.get("anomalies")  or []

    last_price    = insight.get("last_price", 0)
    avg_30d       = insight.get("avg_30d", 0)
    avg_365d      = insight.get("avg_365d", 0)
    price_vs_year = insight.get("price_vs_year", 0.0)
    staleness     = insight.get("staleness_days", 0)
    mom_score     = mom.get("score", 0.0)
    cv            = vol.get("cv", 0.0)
    vol_level     = vol.get("level", "moderate")

    # ── Anomalies (highest priority) ─────────────────────────────────────────
    if anomalies:
        top = anomalies[0]
        ev   = "Spike" if top.get("event_type") == "spike" else "Crash"
        pct  = top.get("pct_deviation", 0)
        sev  = top.get("severity", "medium")
        sev_icon = "🔴" if sev == "high" else "🟠" if sev == "medium" else "🟡"
        signals.append(MarketChangeSignal(
            type="anomaly",
            icon=sev_icon,
            severity="critical" if sev == "high" else "high" if sev == "medium" else "medium",
            headline=f"Price {ev.lower()} detected — {abs(pct):.0f}% {'above' if pct > 0 else 'below'} baseline",
            detail=(
                f"Anomaly engine flagged a {pct:+.1f}% {ev.lower()} on {top.get('date','N/A')} "
                f"(z-score {top.get('z_score',0):.1f}, severity: {sev}). "
                f"{len(anomalies)} total event{'s' if len(anomalies)>1 else ''} in 90 days."
            ),
            direction="up" if pct > 0 else "down",
        ))

    # ── Momentum ─────────────────────────────────────────────────────────────
    if abs(mom_score) > 5:
        direction  = "up" if mom_score > 0 else "down"
        is_strong  = abs(mom_score) > 15
        sev        = "high" if is_strong else "medium"
        icon       = "📈" if mom_score > 0 else "📉"
        avg_7d     = mom.get("avg_7d", 0)
        avg_30d_m  = mom.get("avg_30d", avg_30d)
        signals.append(MarketChangeSignal(
            type="momentum",
            icon=icon,
            severity=sev,
            headline=f"{'Strong' if is_strong else 'Moderate'} {'upward' if mom_score > 0 else 'downward'} momentum ({mom_score:+.1f}%)",
            detail=(
                f"7-day average ₹{avg_7d:,.0f}/qtl vs 30-day average ₹{avg_30d_m:,.0f}/qtl — "
                f"{'bullish' if mom_score > 0 else 'bearish'} momentum of {mom_score:+.1f}%."
            ),
            direction=direction,
        ))
    elif abs(mom_score) > 2:
        direction = "up" if mom_score > 0 else "down"
        signals.append(MarketChangeSignal(
            type="momentum",
            icon="↗" if mom_score > 0 else "↘",
            severity="low",
            headline=f"Mild price {'rise' if mom_score > 0 else 'softening'} ({mom_score:+.1f}%)",
            detail=f"7-day trend shows a {mom_score:+.1f}% {'improvement' if mom_score > 0 else 'decline'} vs the 30-day average.",
            direction=direction,
        ))

    # ── Seasonal phase ────────────────────────────────────────────────────────
    if seas and not seas.get("error"):
        phase    = seas.get("current_phase", "normal")
        vs_norm  = seas.get("current_vs_norm", 0.0)
        if phase == "peak" and abs(vs_norm) > 10:
            peak_months = ", ".join(seas.get("peak_months", [])[:3])
            signals.append(MarketChangeSignal(
                type="seasonal",
                icon="🌾",
                severity="medium",
                headline=f"Seasonal peak pricing — {vs_norm:+.0f}% above annual mean",
                detail=f"Currently in peak phase ({vs_norm:+.1f}% vs annual avg). Historical peaks: {peak_months}.",
                direction="up",
            ))
        elif phase == "trough" and abs(vs_norm) > 10:
            trough_months = ", ".join(seas.get("trough_months", [])[:3])
            signals.append(MarketChangeSignal(
                type="seasonal",
                icon="📅",
                severity="medium",
                headline=f"Seasonal trough — {abs(vs_norm):.0f}% below annual mean",
                detail=f"Seasonal lean period ({vs_norm:.1f}% vs annual avg). Historical troughs: {trough_months}.",
                direction="down",
            ))

    # ── Volatility ────────────────────────────────────────────────────────────
    if vol_level in ("extreme", "high"):
        sev  = "high" if vol_level == "extreme" else "medium"
        icon = "⚡" if vol_level == "extreme" else "〰"
        vol_badge = vol.get("badge", vol_level.title())
        std_30d = vol.get("std_30d", 0)
        signals.append(MarketChangeSignal(
            type="volatility",
            icon=icon,
            severity=sev,
            headline=f"{vol_badge} price volatility — CV {cv:.0f}%",
            detail=(
                f"Price stability is {vol_badge.lower()} (coefficient of variation {cv:.1f}%). "
                f"30-day price std deviation: ₹{std_30d:,.0f}/qtl."
            ),
            direction="neutral",
        ))

    # ── Price vs annual average ────────────────────────────────────────────────
    if avg_365d > 0 and abs(price_vs_year) > 15:
        direction = "up" if price_vs_year > 0 else "down"
        signals.append(MarketChangeSignal(
            type="price",
            icon="💰" if price_vs_year > 0 else "🔻",
            severity="medium",
            headline=f"Price {price_vs_year:+.0f}% vs annual average",
            detail=(
                f"Current modal price ₹{last_price:,}/qtl vs "
                f"1-year average ₹{avg_365d:,.0f}/qtl "
                f"({price_vs_year:+.1f}%)."
            ),
            direction=direction,
        ))

    # ── Data staleness ────────────────────────────────────────────────────────
    if staleness > 14:
        signals.append(MarketChangeSignal(
            type="data",
            icon="⏱",
            severity="low",
            headline=f"Data is {staleness} days old — check market directly",
            detail=f"Latest AGMARKNET record is {staleness} days old. Live price verification recommended.",
            direction="neutral",
        ))

    # Sort: critical → high → medium → low
    _order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    signals.sort(key=lambda s: _order.get(s.severity, 4))
    return signals[:6]  # cap at 6 signals


def generate_market_narrative(crop: str, state: str, insight: dict, signals: list[MarketChangeSignal]) -> str:
    """
    Generate analyst-grade 1-2 sentence narrative from deterministic signals.
    All values are grounded in real data — no hallucination.
    """
    if not insight.get("has_data"):
        return f"Insufficient market data available for {crop} in {state}."

    mom       = insight.get("momentum") or {}
    vol       = insight.get("volatility") or {}
    seas      = insight.get("seasonal") or {}
    anomalies = insight.get("anomalies") or []

    mom_score = mom.get("score", 0.0)
    cv        = vol.get("cv", 0.0)
    vol_level = vol.get("level", "moderate")
    last_price= insight.get("last_price", 0)
    price_vs_year = insight.get("price_vs_year", 0.0)

    phase     = seas.get("current_phase", "normal") if seas and not seas.get("error") else "normal"
    vs_norm   = seas.get("current_vs_norm", 0.0) if seas and not seas.get("error") else 0.0

    # Build sentence 1: momentum + volatility
    if abs(mom_score) > 10:
        momentum_phrase = (
            f"surging with strong bullish momentum (+{mom_score:.1f}%)" if mom_score > 0
            else f"declining sharply (downtrend: {mom_score:.1f}%)"
        )
    elif abs(mom_score) > 3:
        momentum_phrase = (
            f"gaining momentum (+{mom_score:.1f}%)" if mom_score > 0
            else f"softening ({mom_score:.1f}%)"
        )
    else:
        momentum_phrase = "trending sideways"

    vol_phrase = (
        "despite extreme price volatility" if vol_level == "extreme"
        else "with elevated volatility" if vol_level == "high"
        else "under moderate market conditions" if vol_level == "moderate"
        else "in a relatively stable market"
    )

    sentence1 = f"{crop} in {state} is {momentum_phrase} {vol_phrase} (CV {cv:.0f}%, current price ₹{last_price:,}/qtl)."

    # Build sentence 2: seasonal + anomaly context
    parts2: list[str] = []
    if phase == "peak" and vs_norm > 10:
        parts2.append(f"Seasonal peak conditions are supporting prices ({vs_norm:+.0f}% above annual mean)")
    elif phase == "trough" and vs_norm < -10:
        parts2.append(f"Seasonal trough is weighing on prices ({vs_norm:.0f}% below annual mean)")

    if anomalies:
        top = anomalies[0]
        ev  = "price spike" if top.get("event_type") == "spike" else "price crash"
        pct = top.get("pct_deviation", 0)
        parts2.append(f"a recent {ev} of {abs(pct):.0f}% was detected by the anomaly engine")

    if abs(price_vs_year) > 20:
        pvy_phrase = "well above" if price_vs_year > 0 else "significantly below"
        parts2.append(f"prices are {pvy_phrase} the 1-year average ({price_vs_year:+.1f}%)")

    sentence2 = (
        (" ".join([parts2[0].capitalize() + ";" if len(parts2) > 1 else parts2[0].capitalize()] +
                  [p + "." for p in parts2[1:]]) if parts2 else "")
    )

    return f"{sentence1} {sentence2}".strip()


async def get_recent_changes_for(crop: str, state: str) -> dict:
    """
    Full async entry point — runs build_insight_context in thread pool.
    Returns {crop, state, changes: [...], narrative: str, has_data: bool}.
    """
    try:
        insight = await asyncio.to_thread(build_insight_context, crop, state, 90)
    except Exception as exc:
        logger.error("recent_changes build_insight failed: %s", exc)
        return {"crop": crop, "state": state, "has_data": False, "changes": [], "narrative": ""}

    if not insight.get("has_data"):
        return {"crop": crop, "state": state, "has_data": False, "changes": [], "narrative": ""}

    changes   = detect_recent_changes(insight)
    narrative = generate_market_narrative(crop, state, insight, changes)

    return {
        "crop":      crop,
        "state":     state,
        "has_data":  True,
        "changes":   [asdict(c) for c in changes],
        "narrative": narrative,
        "last_price":    insight.get("last_price"),
        "price_vs_year": insight.get("price_vs_year"),
        "generated_at":  str(date.today()),
    }
