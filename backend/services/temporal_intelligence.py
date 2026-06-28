"""
backend/services/temporal_intelligence.py

Temporal market intelligence — Phase 4B Step 5.

Adds time-awareness to market analysis:
  - Trend acceleration (is momentum speeding up or slowing down?)
  - Price velocity (rate of change vs prior period)
  - Momentum reversal detection

CRITICAL: All inputs from raw_ctx (deterministic DuckDB/pandas data).
          No Gemini calls. No invented values.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TemporalAnalysis:
    direction:      str    # "accelerating" | "decelerating" | "reversing" | "stable" | "unknown"
    velocity:       float  # % change this week (7d)
    prior_velocity: float  # implied % per week from 30d rate
    acceleration:   float  # positive = speeding up, negative = slowing down
    reversal_risk:  bool   # True if direction flipped vs prior period
    label:          str    # human-readable one-liner
    week_over_week: float  # current weekly rate minus prior weekly rate


def compute_temporal_intelligence(raw_ctx: dict) -> TemporalAnalysis:
    """
    Analyse the time dynamics of price movement.

    Uses momentum.7d_change_pct (recent velocity) and
    momentum.30d_change_pct (prior period reference).
    """
    mom = raw_ctx.get("momentum") or {}
    m7  = mom.get("7d_change_pct")  or 0.0
    m30 = mom.get("30d_change_pct") or 0.0

    if not isinstance(m7, (int, float)):
        m7 = 0.0
    if not isinstance(m30, (int, float)):
        m30 = 0.0

    # Implied weekly rate from 30-day figure (30d ÷ 4 weeks)
    velocity_recent = float(m7)
    velocity_prior  = float(m30) / 4.0

    # Acceleration ratio vs prior weekly rate
    if abs(velocity_prior) > 0.5:
        acceleration = (velocity_recent - velocity_prior) / abs(velocity_prior)
    else:
        acceleration = 0.0

    week_over_week = velocity_recent - velocity_prior

    # Reversal: significant movement in opposite direction
    reversal_risk = (
        abs(m7) > 2.0
        and abs(m30) > 2.0
        and ((m7 > 0) != (m30 > 0))
    )

    # Direction classification
    if abs(m7) < 0.5 and abs(m30) < 0.5:
        direction = "unknown"
    elif reversal_risk:
        direction = "reversing"
    elif acceleration > 0.20:
        direction = "accelerating"
    elif acceleration < -0.20:
        direction = "decelerating"
    else:
        direction = "stable"

    label_map = {
        "accelerating":  f"Momentum accelerating ({m7:+.1f}%/wk vs {velocity_prior:+.1f}%/wk prior)",
        "decelerating":  f"Momentum slowing ({m7:+.1f}%/wk vs {velocity_prior:+.1f}%/wk prior)",
        "reversing":     f"Reversal signal — direction flipped (7d: {m7:+.1f}%, 30d avg/wk: {velocity_prior:+.1f}%)",
        "stable":        f"Steady movement ({m7:+.1f}%/wk)",
        "unknown":       "Insufficient movement to determine temporal direction",
    }

    return TemporalAnalysis(
        direction=direction,
        velocity=round(velocity_recent, 2),
        prior_velocity=round(velocity_prior, 2),
        acceleration=round(acceleration, 3),
        reversal_risk=reversal_risk,
        label=label_map.get(direction, label_map["unknown"]),
        week_over_week=round(week_over_week, 2),
    )
