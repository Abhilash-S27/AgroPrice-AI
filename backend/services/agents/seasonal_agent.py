"""
SeasonalAgent — seasonal cycle intelligence.

Interprets current seasonal positioning, peak/trough proximity,
and historical monthly patterns to generate seasonal intelligence.
Operates entirely on deterministic data — no LLM calls.
"""
from __future__ import annotations

from typing import Any


def analyze(ctx: dict[str, Any]) -> dict:
    """
    Analyze seasonal positioning for a crop+state.

    Score:   0.0 = deep trough | 1.0 = deep peak
    Verdict: DEEP_PEAK | PEAK_SEASON | NORMAL | LEAN_SEASON | DEEP_TROUGH
    """
    if not ctx.get("has_data"):
        return _no_data(ctx)

    seas = ctx.get("seasonal")
    if not seas or seas.get("error"):
        return _no_seasonal(ctx)

    phase         = seas.get("current_phase", "normal")
    vs_norm       = seas.get("current_vs_norm", 0.0)
    peak_months   = seas.get("peak_months",   [])
    trough_months = seas.get("trough_months", [])
    peak_pct      = seas.get("peak_pct",   0.0)
    trough_pct    = seas.get("trough_pct", 0.0)

    # Score calculation
    if phase == "peak":
        sea_score = min(1.0, 0.70 + (vs_norm / 100) * 0.25)
        verdict   = "DEEP_PEAK" if vs_norm > 20 else "PEAK_SEASON"
        label     = "peak season" if vs_norm < 20 else "deep seasonal peak"
    elif phase == "trough":
        sea_score = max(0.0, 0.30 - (abs(vs_norm) / 100) * 0.20)
        verdict   = "DEEP_TROUGH" if abs(vs_norm) > 20 else "LEAN_SEASON"
        label     = "lean season" if abs(vs_norm) < 20 else "deep seasonal trough"
    else:
        sea_score = 0.50
        verdict   = "NORMAL"
        label     = "normal season"

    signals: list[str] = []

    phase_text = {
        "peak":   "currently in a seasonal price peak",
        "trough": "currently in a seasonal lean period",
        "normal": "currently in the mid-season range",
    }.get(phase, "in normal seasonal range")

    if vs_norm != 0:
        direction = "above" if vs_norm > 0 else "below"
        signals.append(
            f"Prices are {abs(vs_norm):.1f}% {direction} the annual average "
            f"— {phase_text}"
        )

    if peak_months:
        signals.append(
            f"Historical peak months: {', '.join(peak_months[:3])} "
            f"(avg +{peak_pct:.0f}% above normal)"
        )
    if trough_months:
        signals.append(
            f"Historical lean months: {', '.join(trough_months[:3])} "
            f"(avg {trough_pct:.0f}% vs normal)"
        )

    # Upcoming season transition hint
    if phase == "normal" and peak_pct > 15:
        signals.append(
            f"Peak season approach: prices typically rise to +{peak_pct:.0f}% "
            f"in {', '.join(peak_months[:2])}"
        )

    headline = (
        f"{ctx.get('crop','Crop')} in {ctx.get('state','market')} is "
        f"{phase_text} ({vs_norm:+.1f}% vs annual mean). "
        f"Peak seasonality: {', '.join(peak_months[:2])}."
    )

    return {
        "agent":       "seasonal",
        "headline":    headline,
        "signals":     signals,
        "score":       round(sea_score, 2),
        "score_label": label,
        "verdict":     verdict,
        "details": {
            "current_phase":   phase,
            "current_vs_norm": vs_norm,
            "peak_months":     peak_months,
            "trough_months":   trough_months,
            "peak_pct":        peak_pct,
            "trough_pct":      trough_pct,
        },
    }


def _no_data(ctx: dict) -> dict:
    return {
        "agent":       "seasonal",
        "headline":    f"Seasonal profile unavailable for {ctx.get('crop','crop')} in {ctx.get('state','state')}.",
        "signals":     ["No historical data available for seasonal analysis."],
        "score":       0.5,
        "score_label": "unknown",
        "verdict":     "UNKNOWN",
        "details":     {},
    }


def _no_seasonal(ctx: dict) -> dict:
    return {
        "agent":       "seasonal",
        "headline":    f"Seasonal pattern data insufficient for {ctx.get('crop','crop')} in {ctx.get('state','state')}.",
        "signals":     ["Not enough historical months to compute a reliable seasonal profile."],
        "score":       0.5,
        "score_label": "limited data",
        "verdict":     "UNKNOWN",
        "details":     {},
    }
