"""
backend/services/confidence_engine.py

Dynamic recommendation confidence scoring — Phase 4A Step 7.

Synthesizes deterministic signals (training depth, volatility, anomalies,
momentum coherence, seasonal alignment, forecast availability) into a
structured confidence assessment that Gemini uses to calibrate its response.

CRITICAL ARCHITECTURE RULE:
  All inputs must originate from the deterministic engine (DuckDB analytics,
  ML evaluation). This module NEVER invents confidence figures — it combines
  real signals into a composite score.

Usage:
    from backend.services.confidence_engine import compute_recommendation_confidence
    assessment = compute_recommendation_confidence(raw_ctx, has_forecast=True)
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ConfidenceAssessment:
    score: float             # composite confidence 0.0 – 1.0
    label: str               # "high" | "medium" | "low" | "insufficient data"
    contributors: list[str]  # signals that increased confidence
    detractors: list[str]    # signals that reduced confidence
    narrative: str           # one-sentence summary for prompt injection


def compute_recommendation_confidence(
    raw_ctx: dict,
    has_forecast: bool,
) -> ConfidenceAssessment:
    """
    Compute a dynamic confidence score from deterministic analytics signals.

    Args:
        raw_ctx:      The insight context dict from build_insight_context().
        has_forecast: Whether the ML forecast engine produced valid predictions.

    Returns:
        ConfidenceAssessment with score, label, contributors, detractors, narrative.
    """
    score = 0.45  # neutral baseline — require positive evidence to reach "medium"
    contributors: list[str] = []
    detractors:   list[str] = []

    # ── Training depth (from quality metrics or computed rows) ─────────────────
    quality = raw_ctx.get("quality") or {}
    training_rows = quality.get("training_rows") or 0
    # Approximate days from rows (AGMARKNET ~3 records/week per mandi)
    approx_days = training_rows * 2  # conservative estimate
    if approx_days >= 365 * 5:
        score += 0.15
        contributors.append(f"{approx_days // 365}+ years of market history")
    elif approx_days >= 365 * 2:
        score += 0.10
        contributors.append(f"~{approx_days // 365} years of training data")
    elif approx_days >= 180:
        score += 0.05
        contributors.append("6+ months of training data")
    elif training_rows > 0:
        score -= 0.08
        detractors.append(f"limited training depth ({training_rows} records)")

    # ── Data recency — stale data reduces reliability ──────────────────────────
    staleness_days = raw_ctx.get("staleness_days", 0)
    if staleness_days <= 7:
        score += 0.05
        contributors.append("recent data (within 7 days)")
    elif staleness_days <= 30:
        pass  # acceptable, neutral
    elif staleness_days <= 90:
        score -= 0.05
        detractors.append(f"data is {staleness_days} days stale")
    else:
        score -= 0.12
        detractors.append(f"data is {staleness_days} days stale — reliability reduced")

    # ── Volatility — high CV → harder to forecast ──────────────────────────────
    vol = raw_ctx.get("volatility") or {}
    cv  = vol.get("cv") or 0.0
    if isinstance(cv, (int, float)) and cv > 0:
        if cv < 12:
            score += 0.12
            contributors.append(f"low volatility (CV {cv:.1f}% — stable price history)")
        elif cv < 25:
            score += 0.04
            contributors.append(f"moderate volatility (CV {cv:.1f}%)")
        elif cv < 40:
            score -= 0.08
            detractors.append(f"elevated volatility (CV {cv:.1f}%)")
        else:
            score -= 0.18
            detractors.append(f"extreme volatility (CV {cv:.1f}%) — forecasts less reliable")

    # ── Anomaly density — many anomalies → erratic market ─────────────────────
    anomalies  = raw_ctx.get("anomalies") or []
    n_anomalies = len(anomalies) if isinstance(anomalies, list) else 0
    if n_anomalies == 0:
        score += 0.06
        contributors.append("clean price history (no anomalies in 90-day window)")
    elif n_anomalies == 1:
        score -= 0.04
        detractors.append("1 recent price anomaly detected")
    elif n_anomalies <= 3:
        score -= 0.09
        detractors.append(f"{n_anomalies} price anomalies — elevated market noise")
    else:
        score -= 0.15
        detractors.append(f"{n_anomalies} anomalies — market currently erratic")

    # ── Momentum coherence — aligned short and long-term trend ─────────────────
    mom = raw_ctx.get("momentum") or {}
    m7  = mom.get("7d_change_pct")  or 0.0
    m30 = mom.get("30d_change_pct") or 0.0
    if isinstance(m7, (int, float)) and isinstance(m30, (int, float)):
        same_direction = (m7 > 0 and m30 > 0) or (m7 < 0 and m30 < 0)
        both_significant = abs(m7) > 2.0 and abs(m30) > 2.0
        if same_direction and both_significant:
            score += 0.08
            contributors.append("coherent momentum (short and long-term agree)")
        elif both_significant and not same_direction:
            score -= 0.07
            detractors.append("conflicting momentum (short and long-term diverge)")

    # ── ML forecast availability ───────────────────────────────────────────────
    if has_forecast:
        score += 0.10
        contributors.append("ML forecast model (Prophet/XGBoost) available")
    else:
        score -= 0.10
        detractors.append("no ML forecast available for this crop+state")

    # ── Seasonal pattern on record ─────────────────────────────────────────────
    seasonal = raw_ctx.get("seasonal") or {}
    if seasonal and not seasonal.get("error") and seasonal.get("peak_months"):
        score += 0.05
        contributors.append("seasonal pattern documented in AGMARKNET history")

    # ── Forecast quality tier bonus ────────────────────────────────────────────
    tier = raw_ctx.get("tier", "D")
    if tier == "A":
        score += 0.08
        contributors.append("Tier A forecast (full Prophet model)")
    elif tier == "B":
        score += 0.04
        contributors.append("Tier B forecast (moderate model)")
    elif tier == "C":
        score -= 0.04
        detractors.append("Tier C forecast (sparse trend only)")
    elif tier == "D":
        score -= 0.08
        detractors.append("Tier D (analytics only — no ML forecast)")

    # ── Clamp ─────────────────────────────────────────────────────────────────
    score = max(0.05, min(0.97, score))

    # ── Label ─────────────────────────────────────────────────────────────────
    if score >= 0.70:
        label = "high"
    elif score >= 0.48:
        label = "medium"
    elif score >= 0.28:
        label = "low"
    else:
        label = "insufficient data"

    # ── Narrative (one sentence for prompt injection) ─────────────────────────
    top_driver   = contributors[0] if contributors else "partial data coverage"
    top_detractor = detractors[0]  if detractors  else None

    if label == "insufficient data":
        narrative = (
            f"Confidence is insufficient ({score:.0%}) due to {top_detractor or 'sparse data'}. "
            "Treat recommendations as indicative only."
        )
    elif top_detractor:
        narrative = (
            f"Confidence is {label} ({score:.0%}), supported by {top_driver}, "
            f"but reduced by {top_detractor}."
        )
    else:
        narrative = (
            f"Confidence is {label} ({score:.0%}), well-supported by {top_driver}."
        )

    return ConfidenceAssessment(
        score=round(score, 3),
        label=label,
        contributors=contributors[:4],  # keep prompt concise
        detractors=detractors[:3],
        narrative=narrative,
    )
