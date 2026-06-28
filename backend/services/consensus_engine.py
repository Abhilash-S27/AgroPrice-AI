"""
backend/services/consensus_engine.py

Decision Consensus Engine — Phase 5.

Converts multi-agent council output into institutional-grade decisions with
weighted scoring, confidence-adjusted recommendations, signal coherence analysis,
instability penalties, and anomaly/volatility penalties.

CRITICAL: Fully deterministic. No Gemini calls. Reads only from council + raw_ctx.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ConsensusDecision:
    executive_recommendation: str           # SELL_NOW | HOLD | WAIT | WATCH | ...
    recommendation_confidence: str          # "high"|"medium"|"low"|"uncertain"
    confidence_score:          float        # 0.0–1.0
    recommendation_rationale:  str          # 1-2 sentence explanation
    confidence_decomposition:  list[str]    # bullets explaining confidence level
    uncertainty_score:         float        # 0.0–1.0 (higher = more uncertain)
    stability_label:           str          # "stable"|"volatile"|"unstable"|"crisis"
    risk_adjustment:           str          # "normal"|"risk_elevated"|"risk_critical"
    confidence_collapse:       bool         # True when confidence drops severely
    contradictory_market:      bool         # True when agents fundamentally disagree
    instability_warning:       str | None   # Warning text if unstable


def compute_consensus(
    council_dict: dict,
    raw_ctx: dict,
) -> ConsensusDecision:
    """
    Convert a council result into an institutional consensus decision.

    Args:
        council_dict: Output from council_to_dict(run_council(raw_ctx)).
        raw_ctx:      Full insight context from build_insight_context().

    Returns:
        ConsensusDecision with executive-grade recommendation and rationale.
    """
    if not council_dict.get("has_data"):
        return ConsensusDecision(
            executive_recommendation="WATCH",
            recommendation_confidence="low",
            confidence_score=0.15,
            recommendation_rationale="Insufficient market data for a grounded decision.",
            confidence_decomposition=["No historical price data available"],
            uncertainty_score=0.85,
            stability_label="unstable",
            risk_adjustment="risk_elevated",
            confidence_collapse=True,
            contradictory_market=False,
            instability_warning="Data unavailable — treat any signals as unreliable.",
        )

    # ── Extract council signals ────────────────────────────────────────────────
    dominant_view      = council_dict.get("dominant_view", "NEUTRAL")
    consensus_strength = float(council_dict.get("consensus_strength", 0.5))
    contradiction      = bool(council_dict.get("contradiction_detected", False))
    base_rec           = council_dict.get("weighted_recommendation", "WATCH")
    council_conf_lbl   = council_dict.get("final_confidence", "medium")
    minority_view      = council_dict.get("minority_view")
    vote_breakdown     = council_dict.get("vote_breakdown", {})

    # ── Extract raw context signals ────────────────────────────────────────────
    vol        = raw_ctx.get("volatility") or {}
    cv         = float(vol.get("cv") or 0.0)
    anomalies  = raw_ctx.get("anomalies") or []
    n_anom     = len(anomalies)
    staleness  = raw_ctx.get("staleness_days", 0)
    tier       = raw_ctx.get("tier", "D")
    mom        = raw_ctx.get("momentum") or {}
    m7         = float(mom.get("7d_change_pct") or 0.0)

    # ── Build confidence score ────────────────────────────────────────────────
    conf = consensus_strength * 0.50   # base: council agreement

    # Volatility penalty
    if cv > 45:
        conf -= 0.20
    elif cv > 30:
        conf -= 0.10
    elif cv < 15:
        conf += 0.08

    # Anomaly penalty
    if n_anom >= 3:
        conf -= 0.15
    elif n_anom >= 2:
        conf -= 0.08
    elif n_anom == 0:
        conf += 0.06

    # Contradiction penalty
    if contradiction:
        conf -= 0.12

    # Forecast tier bonus
    if tier == "A":
        conf += 0.10
    elif tier == "B":
        conf += 0.06
    elif tier == "D":
        conf -= 0.08

    # Staleness penalty
    if staleness > 60:
        conf -= 0.15
    elif staleness > 30:
        conf -= 0.08

    conf = round(max(0.05, min(0.95, conf)), 3)

    # ── Confidence label ──────────────────────────────────────────────────────
    if conf >= 0.65:
        conf_label = "high"
    elif conf >= 0.45:
        conf_label = "medium"
    elif conf >= 0.25:
        conf_label = "low"
    else:
        conf_label = "uncertain"

    # ── Uncertainty score (inverse of confidence) ─────────────────────────────
    uncertainty = round(1.0 - conf, 3)

    # ── Stability classification ───────────────────────────────────────────────
    if cv > 45 or n_anom >= 4:
        stability = "crisis"
    elif cv > 30 or n_anom >= 2:
        stability = "volatile"
    elif cv > 15 or contradiction:
        stability = "unstable"
    else:
        stability = "stable"

    # ── Risk adjustment ────────────────────────────────────────────────────────
    if dominant_view == "HIGH_RISK" or cv > 40:
        risk_adj = "risk_critical"
    elif cv > 25 or n_anom >= 2 or contradiction:
        risk_adj = "risk_elevated"
    else:
        risk_adj = "normal"

    # ── Apply risk to recommendation ─────────────────────────────────────────
    exec_rec = base_rec
    if risk_adj == "risk_critical" and base_rec in ("SELL_NOW", "SELL_SOON"):
        exec_rec = "HIGH_RISK_AVOIDANCE"
    elif risk_adj == "risk_elevated" and base_rec == "SELL_NOW":
        exec_rec = "SELL_SOON"

    # Confidence collapse detection
    conf_collapse = conf < 0.22 or (contradiction and cv > 35)

    # Contradictory market detection
    contra_market = (
        contradiction
        and (vote_breakdown.get("BULLISH", 0) >= 0.25)
        and (vote_breakdown.get("BEARISH", 0) >= 0.25)
    )

    # ── Decomposition bullets ─────────────────────────────────────────────────
    decomp: list[str] = []

    decomp.append(
        f"Council agreement: {consensus_strength:.0%} — "
        f"{'strong' if consensus_strength >= 0.65 else 'moderate' if consensus_strength >= 0.45 else 'weak'} consensus"
    )

    if cv > 0:
        decomp.append(
            f"Market volatility: CV {cv:.0f}% — "
            f"{'low confidence impact' if cv < 20 else 'moderate penalty' if cv < 35 else 'significant penalty'}"
        )

    if n_anom > 0:
        decomp.append(f"Anomaly density: {n_anom} events — reduces forecast reliability")
    else:
        decomp.append("Clean price history: no anomalies boosts confidence")

    if tier in ("A", "B"):
        decomp.append(f"Tier {tier} ML forecast model supports higher confidence")
    elif tier == "D":
        decomp.append("No ML forecast — analytics-only mode limits precision")

    if staleness > 30:
        decomp.append(f"Data is {staleness} days old — staleness reduces reliability")

    if contradiction:
        decomp.append("Agent disagreement detected — confidence adjusted downward")

    # ── Rationale text ────────────────────────────────────────────────────────
    dom_word = {
        "BULLISH":   "bullish conditions",
        "BEARISH":   "bearish conditions",
        "NEUTRAL":   "balanced conditions",
        "HIGH_RISK": "elevated market risk",
    }.get(dominant_view, "mixed conditions")

    minority_clause = ""
    if minority_view and minority_view != dominant_view:
        minority_clause = (
            f" A minority of agents ({minority_view.lower()}) dissent, "
            f"suggesting caution."
        )

    rec_word = exec_rec.replace("_", " ").lower()

    rationale = (
        f"The council consensus points to {dom_word} with {conf_label} confidence "
        f"({conf:.0%}).{minority_clause} "
        f"Institutional recommendation: {rec_word}."
    )

    # ── Instability warning ────────────────────────────────────────────────────
    warning: str | None = None
    if stability == "crisis":
        warning = (
            f"MARKET CRISIS ALERT — extreme volatility (CV {cv:.0f}%) and "
            f"{n_anom} anomalies detected. All recommendations carry elevated uncertainty."
        )
    elif stability == "volatile":
        warning = (
            f"Elevated market instability — CV {cv:.0f}% and {n_anom} price anomalies. "
            f"Recommendations should be treated as directional guidance only."
        )
    elif conf_collapse:
        warning = (
            "Confidence has collapsed — contradictory signals and high volatility "
            "make reliable forecasting difficult at this time."
        )

    return ConsensusDecision(
        executive_recommendation=exec_rec,
        recommendation_confidence=conf_label,
        confidence_score=conf,
        recommendation_rationale=rationale,
        confidence_decomposition=decomp[:5],
        uncertainty_score=uncertainty,
        stability_label=stability,
        risk_adjustment=risk_adj,
        confidence_collapse=conf_collapse,
        contradictory_market=contra_market,
        instability_warning=warning,
    )


def consensus_to_dict(d: ConsensusDecision) -> dict:
    """Serialize ConsensusDecision to a JSON-safe dict."""
    return {
        "executive_recommendation": d.executive_recommendation,
        "recommendation_confidence": d.recommendation_confidence,
        "confidence_score":          d.confidence_score,
        "recommendation_rationale":  d.recommendation_rationale,
        "confidence_decomposition":  d.confidence_decomposition,
        "uncertainty_score":         d.uncertainty_score,
        "stability_label":           d.stability_label,
        "risk_adjustment":           d.risk_adjustment,
        "confidence_collapse":       d.confidence_collapse,
        "contradictory_market":      d.contradictory_market,
        "instability_warning":       d.instability_warning,
    }
