"""
backend/services/opportunity_matrix.py

AI Opportunity Matrix — Phase 5.

Ranks crops across multiple dimensions like an investment opportunity board:
  - opportunity_score   (composite upside)
  - stability_score     (market predictability)
  - risk_score          (downside risk — inverted for ranking)
  - confidence_score    (data quality + model reliability)
  - timing_score        (seasonal + momentum alignment)
  - seasonal_score      (seasonal position advantage)
  - market_quality      (data depth + tier)
  - overall_rank_score  (weighted composite)

Outputs:
  - top_opportunities:  Best overall
  - most_dangerous:     Highest risk crops
  - best_stability:     Most predictable markets
  - highest_momentum:   Strongest price acceleration
  - best_seasonal:      Best seasonal positioning right now

CRITICAL: All scores deterministic from real analytics. No Gemini calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class CropMatrixEntry:
    crop:              str
    state:             str
    opportunity_score: float   # 0–1 (how good is the opportunity)
    stability_score:   float   # 0–1 (how stable/predictable is the market)
    risk_score:        float   # 0–1 (higher = more dangerous)
    confidence_score:  float   # 0–1 (data quality)
    timing_score:      float   # 0–1 (seasonal + momentum alignment)
    seasonal_score:    float   # 0–1 (seasonal positioning)
    market_quality:    float   # 0–1 (data depth + tier)
    overall_rank:      float   # 0–1 weighted composite
    recommendation:    str     # SELL_NOW | HOLD | WAIT | WATCH | ...
    momentum_label:    str     # rising | falling | stable
    risk_label:        str     # low | moderate | high | extreme
    confidence_label:  str     # high | medium | low
    season_phase:      str     # peak | trough | normal
    regime:            str     # regime name
    tier:              str     # A | B | C | D
    momentum_pct:      float   # 7-day % change
    cv:                float   # coefficient of variation


@dataclass
class OpportunityMatrix:
    entries:            list[CropMatrixEntry]
    top_opportunities:  list[CropMatrixEntry]
    most_dangerous:     list[CropMatrixEntry]
    best_stability:     list[CropMatrixEntry]
    highest_momentum:   list[CropMatrixEntry]
    best_seasonal:      list[CropMatrixEntry]
    generated_at:       str
    crops_ranked:       int


def score_crop_for_matrix(
    raw_ctx: dict,
    council_dict: dict,
    consensus_dict: dict,
) -> CropMatrixEntry | None:
    """
    Score a single crop for the opportunity matrix.

    Args:
        raw_ctx:      Insight context from build_insight_context().
        council_dict: Council result dict.
        consensus_dict: Consensus result dict.

    Returns:
        CropMatrixEntry or None if no data.
    """
    crop  = raw_ctx.get("crop", "Unknown")
    state = raw_ctx.get("state", "Unknown")

    if not raw_ctx.get("has_data"):
        return None

    mom       = raw_ctx.get("momentum") or {}
    vol       = raw_ctx.get("volatility") or {}
    seas      = raw_ctx.get("seasonal") or {}
    quality   = raw_ctx.get("quality") or {}
    tier      = raw_ctx.get("tier", "D")
    anomalies = raw_ctx.get("anomalies") or []

    m7      = float(mom.get("7d_change_pct") or 0.0)
    cv      = float(vol.get("cv") or 0.0)
    phase   = seas.get("current_phase", "normal")
    vs_nm   = float(seas.get("current_vs_norm", 0.0))
    q_score = quality.get("score", 50)
    n_a     = len(anomalies)
    staleness = raw_ctx.get("staleness_days", 0)

    # From council/consensus
    dominant   = council_dict.get("dominant_view", "NEUTRAL")
    consensus_s= float(council_dict.get("consensus_strength", 0.5))
    contradiction = bool(council_dict.get("contradiction_detected", False))
    opp_raw    = float(council_dict.get("opportunity_score", 0.5))
    final_rec  = council_dict.get("weighted_recommendation", "WATCH")

    conf_score = float(consensus_dict.get("confidence_score", 0.3))
    stability  = consensus_dict.get("stability_label", "volatile")
    exec_rec   = consensus_dict.get("executive_recommendation", "WATCH")

    # ── Opportunity score ──────────────────────────────────────────────────────
    opp = opp_raw

    # ── Stability score ────────────────────────────────────────────────────────
    # High stability = low CV, no anomalies, clean history
    # Denominator 80 chosen for South Indian vegetables where CV 40–70% is normal
    stab = 1.0 - min(1.0, cv / 80.0)  # CV 0→1.0, CV 80+→0.0
    if n_a >= 3:
        stab -= 0.20
    elif n_a >= 1:
        stab -= 0.08
    if contradiction:
        stab -= 0.10
    stab = round(max(0.0, min(1.0, stab)), 3)

    # ── Risk score ────────────────────────────────────────────────────────────
    risk = min(1.0, cv / 55.0)   # CV 0→0.0, CV 55+→1.0
    risk += min(0.30, n_a * 0.08)
    if contradiction:
        risk += 0.08
    if dominant == "HIGH_RISK":
        risk += 0.15
    risk = round(min(0.98, max(0.02, risk)), 3)

    # ── Confidence score ──────────────────────────────────────────────────────
    conf = conf_score  # from consensus engine

    # ── Timing score ──────────────────────────────────────────────────────────
    # Momentum × season alignment
    timing = 0.50
    if m7 > 5:
        timing += 0.15
    elif m7 > 2:
        timing += 0.08
    elif m7 < -5:
        timing -= 0.15
    elif m7 < -2:
        timing -= 0.08

    if phase == "peak" and m7 > 0:
        timing += 0.12   # momentum + peak season → great timing
    elif phase == "trough" and m7 < 0:
        timing -= 0.10   # falling + trough → poor timing
    timing = round(max(0.0, min(1.0, timing)), 3)

    # ── Seasonal score ────────────────────────────────────────────────────────
    if phase == "peak":
        seasonal = min(1.0, 0.70 + (vs_nm / 100) * 0.25)
    elif phase == "trough":
        seasonal = max(0.0, 0.30 - (abs(vs_nm) / 100) * 0.20)
    else:
        seasonal = 0.50
    seasonal = round(seasonal, 3)

    # ── Market quality ────────────────────────────────────────────────────────
    mq = q_score / 100.0
    if tier == "A":
        mq = min(1.0, mq + 0.10)
    elif tier == "B":
        mq = min(1.0, mq + 0.05)
    elif tier == "D":
        mq = max(0.0, mq - 0.10)
    if staleness > 60:
        mq = max(0.0, mq - 0.15)
    mq = round(max(0.0, min(1.0, mq)), 3)

    # ── Overall rank (weighted composite) ────────────────────────────────────
    # Opportunity 35%, Safety(1-risk) 20%, Confidence 20%, Timing 15%, Seasonal 10%
    safety = 1.0 - risk
    overall = (
        opp      * 0.35 +
        safety   * 0.20 +
        conf     * 0.20 +
        timing   * 0.15 +
        seasonal * 0.10
    )
    overall = round(min(1.0, max(0.0, overall)), 3)

    # ── Labels ────────────────────────────────────────────────────────────────
    mom_label = "rising" if m7 > 2 else "falling" if m7 < -2 else "stable"
    risk_lbl  = "extreme" if risk > 0.75 else "high" if risk > 0.50 else "moderate" if risk > 0.25 else "low"
    conf_lbl  = "high" if conf >= 0.65 else "medium" if conf >= 0.45 else "low"

    regime = "TRANSITIONAL"
    # Quick regime inference
    if risk > 0.65:
        regime = "PANIC_VOLATILITY"
    elif dominant == "BULLISH" and phase == "peak":
        regime = "SEASONAL_PEAK_RUN"
    elif dominant == "BULLISH" and risk < 0.35:
        regime = "BULLISH_EXPANSION"
    elif stability == "stable" and risk < 0.25:
        regime = "STABLE"
    elif dominant == "BEARISH" and phase == "peak":
        regime = "SEASONAL_CORRECTION"

    return CropMatrixEntry(
        crop=crop,
        state=state,
        opportunity_score=opp,
        stability_score=stab,
        risk_score=risk,
        confidence_score=conf,
        timing_score=timing,
        seasonal_score=seasonal,
        market_quality=mq,
        overall_rank=overall,
        recommendation=exec_rec,
        momentum_label=mom_label,
        risk_label=risk_lbl,
        confidence_label=conf_lbl,
        season_phase=phase,
        regime=regime,
        tier=tier,
        momentum_pct=round(m7, 1),
        cv=round(cv, 1),
    )


def build_opportunity_matrix(entries: list[CropMatrixEntry]) -> OpportunityMatrix:
    """
    Build sorted opportunity matrix from a list of crop matrix entries.
    """
    if not entries:
        return OpportunityMatrix(
            entries=[], top_opportunities=[], most_dangerous=[],
            best_stability=[], highest_momentum=[], best_seasonal=[],
            generated_at=str(date.today()), crops_ranked=0,
        )

    # Sort lists
    by_overall   = sorted(entries, key=lambda x: -x.overall_rank)
    by_risk      = sorted(entries, key=lambda x: -x.risk_score)
    by_stability = sorted(entries, key=lambda x: -x.stability_score)
    by_momentum  = sorted(entries, key=lambda x: -abs(x.momentum_pct))
    by_seasonal  = sorted(entries, key=lambda x: -x.seasonal_score)

    return OpportunityMatrix(
        entries=by_overall,
        top_opportunities=by_overall[:5],
        most_dangerous=by_risk[:5],
        best_stability=by_stability[:5],
        highest_momentum=by_momentum[:5],
        best_seasonal=by_seasonal[:5],
        generated_at=str(date.today()),
        crops_ranked=len(entries),
    )


def matrix_entry_to_dict(e: CropMatrixEntry) -> dict:
    """Serialize CropMatrixEntry to JSON-safe dict."""
    return {
        "crop":              e.crop,
        "state":             e.state,
        "opportunity_score": e.opportunity_score,
        "stability_score":   e.stability_score,
        "risk_score":        e.risk_score,
        "confidence_score":  e.confidence_score,
        "timing_score":      e.timing_score,
        "seasonal_score":    e.seasonal_score,
        "market_quality":    e.market_quality,
        "overall_rank":      e.overall_rank,
        "recommendation":    e.recommendation,
        "momentum_label":    e.momentum_label,
        "risk_label":        e.risk_label,
        "confidence_label":  e.confidence_label,
        "season_phase":      e.season_phase,
        "regime":            e.regime,
        "tier":              e.tier,
        "momentum_pct":      e.momentum_pct,
        "cv":                e.cv,
    }


def matrix_to_dict(m: OpportunityMatrix) -> dict:
    """Serialize OpportunityMatrix to JSON-safe dict."""
    def _list(entries):
        return [matrix_entry_to_dict(e) for e in entries]

    return {
        "entries":           _list(m.entries),
        "top_opportunities": _list(m.top_opportunities),
        "most_dangerous":    _list(m.most_dangerous),
        "best_stability":    _list(m.best_stability),
        "highest_momentum":  _list(m.highest_momentum),
        "best_seasonal":     _list(m.best_seasonal),
        "generated_at":      m.generated_at,
        "crops_ranked":      m.crops_ranked,
    }
