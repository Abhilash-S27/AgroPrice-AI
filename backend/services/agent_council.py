"""
backend/services/agent_council.py

Multi-Agent Council Engine — Phase 5.

Runs 7 specialist AI agents independently against the same crop/state,
then aggregates their verdicts into a council consensus.

Agents:
  1. Trend Analyst     — price momentum & direction
  2. Risk Analyst      — volatility & anomaly risk
  3. Seasonal Analyst  — seasonal positioning & cycle
  4. Supply/Demand     — inferred from price-vs-year & arrivals proxy
  5. Volatility        — detailed CV decomposition & regime
  6. Forecast Reliability — tier, staleness, training depth
  7. Opportunity       — composite opportunity scoring

Each agent returns:
  verdict, score (0-1), confidence ("high"|"medium"|"low"), reasoning_bullets,
  escalation_flags, supporting_metrics

Council output:
  consensus_strength, agreement_ratio, dominant_view, minority_view,
  contradiction_detected, weighted_recommendation, final_confidence,
  dissent_agents, vote_breakdown

CRITICAL: Fully deterministic. No Gemini calls. Uses only data from raw_ctx.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── Verdict categories ────────────────────────────────────────────────────────

_BULLISH  = {"STRONG_BULLISH", "BULLISH", "MILD_BULLISH"}
_BEARISH  = {"STRONG_BEARISH", "BEARISH", "MILD_BEARISH"}
_HIGH_R   = {"HIGH_RISK", "EXTREME_RISK"}
_LOW_R    = {"LOW_RISK", "MODERATE_RISK"}
_PEAK     = {"DEEP_PEAK", "PEAK_SEASON"}
_TROUGH   = {"LEAN_SEASON", "DEEP_TROUGH"}


# ── Agent result dataclass ────────────────────────────────────────────────────

@dataclass
class AgentVote:
    agent:            str
    display_name:     str
    verdict:          str        # canonical verdict string
    score:            float      # 0.0–1.0 (higher = more bullish / favorable)
    confidence:       str        # "high"|"medium"|"low"
    stance:           str        # "BULLISH"|"BEARISH"|"NEUTRAL"|"HIGH_RISK"|"FAVORABLE"
    reasoning:        list[str]  # 2-4 bullet points
    escalation_flags: list[str]  # e.g. ["VOLATILITY_SURGE"]
    metrics:          dict       = field(default_factory=dict)


# ── Council result dataclass ──────────────────────────────────────────────────

@dataclass
class CouncilResult:
    crop:                    str
    state:                   str
    has_data:                bool
    agents:                  list[AgentVote]
    vote_breakdown:          dict            # stance → count
    consensus_strength:      float           # 0.0–1.0
    agreement_ratio:         float           # fraction of agents sharing dominant view
    dominant_view:           str             # "BULLISH"|"BEARISH"|"NEUTRAL"|"HIGH_RISK"
    minority_view:           str | None
    contradiction_detected:  bool
    weighted_recommendation: str             # final action
    final_confidence:        str             # "high"|"medium"|"low"|"uncertain"
    council_summary:         str             # 1-2 sentence narrative
    dissent_agents:          list[str]       # agent names that dissent from dominant
    opportunity_score:       float           # 0.0–1.0


# ── Individual specialist agents ──────────────────────────────────────────────

def _trend_analyst(ctx: dict) -> AgentVote:
    """Specialist 1 — momentum and price direction."""
    mom         = ctx.get("momentum") or {}
    score_raw   = float(mom.get("score", 0.0))
    avg_7d      = mom.get("avg_7d", 0)
    avg_30d     = mom.get("avg_30d", 0)
    last_price  = ctx.get("last_price", 0)
    price_vs_yr = ctx.get("price_vs_year", 0.0)
    m7          = float(mom.get("7d_change_pct") or 0.0)
    m30         = float(mom.get("30d_change_pct") or 0.0)

    if score_raw >= 10:
        score, verdict, stance = 0.90, "STRONG_BULLISH", "BULLISH"
    elif score_raw >= 5:
        score, verdict, stance = 0.72, "BULLISH",        "BULLISH"
    elif score_raw >= 2:
        score, verdict, stance = 0.60, "MILD_BULLISH",   "BULLISH"
    elif score_raw >= -2:
        score, verdict, stance = 0.50, "NEUTRAL",        "NEUTRAL"
    elif score_raw >= -5:
        score, verdict, stance = 0.40, "MILD_BEARISH",   "BEARISH"
    elif score_raw >= -10:
        score, verdict, stance = 0.28, "BEARISH",        "BEARISH"
    else:
        score, verdict, stance = 0.10, "STRONG_BEARISH", "BEARISH"

    same_dir = (m7 > 0 and m30 > 0) or (m7 < 0 and m30 < 0)
    both_sig = abs(m7) > 2.0 and abs(m30) > 2.0
    coherent = same_dir and both_sig

    confidence = "high" if (abs(score_raw) > 5 and coherent) else ("medium" if abs(score_raw) > 2 else "low")

    reasoning = []
    if avg_7d and avg_30d:
        reasoning.append(f"7d avg ₹{avg_7d:,.0f} vs 30d avg ₹{avg_30d:,.0f} ({score_raw:+.1f}% momentum)")
    if price_vs_yr != 0:
        dir_ = "above" if price_vs_yr > 0 else "below"
        reasoning.append(f"Price {abs(price_vs_yr):.1f}% {dir_} annual baseline")
    if coherent:
        reasoning.append("Short and long-term momentum aligned — high conviction signal")
    elif both_sig and not same_dir:
        reasoning.append("Momentum divergence detected — short/long term disagree")
    if last_price:
        reasoning.append(f"Last recorded price ₹{last_price:,.0f}/quintal")

    flags = []
    if abs(m7) > 15:
        flags.append(f"RAPID_MOMENTUM — {m7:+.1f}% weekly move")

    return AgentVote(
        agent="trend_analyst",
        display_name="Trend Analyst",
        verdict=verdict,
        score=round(score, 2),
        confidence=confidence,
        stance=stance,
        reasoning=reasoning or ["Insufficient momentum data for analysis"],
        escalation_flags=flags,
        metrics={
            "momentum_score": round(score_raw, 1),
            "m7": round(m7, 1),
            "m30": round(m30, 1),
            "coherent": coherent,
        },
    )


def _risk_analyst(ctx: dict) -> AgentVote:
    """Specialist 2 — volatility and downside risk."""
    vol         = ctx.get("volatility") or {}
    anomalies   = ctx.get("anomalies") or []
    quality     = ctx.get("quality") or {}
    staleness   = ctx.get("staleness_days", 0)
    cv          = float(vol.get("cv") or 0.0)
    vol_level   = vol.get("level", "moderate")
    n_anom      = len(anomalies)
    high_anom   = sum(1 for a in anomalies if a.get("severity") in ("high", "medium"))
    q_score     = quality.get("score", 50)

    _BASE = {"stable": 0.12, "moderate": 0.38, "high": 0.68, "extreme": 0.90}
    risk_score = _BASE.get(vol_level, 0.38)
    if high_anom >= 2:
        risk_score += 0.15
    elif high_anom == 1:
        risk_score += 0.08
    if q_score < 35:
        risk_score += 0.10
    if staleness > 30:
        risk_score += 0.08
    risk_score = round(min(0.95, max(0.05, risk_score)), 2)

    # For council stance: invert (low risk = favorable = "BULLISH" side)
    score = 1.0 - risk_score  # 0=extreme risk, 1=very low risk

    if risk_score < 0.25:
        verdict, stance = "LOW_RISK",      "NEUTRAL"    # low risk = slightly positive
    elif risk_score < 0.50:
        verdict, stance = "MODERATE_RISK", "NEUTRAL"
    elif risk_score < 0.75:
        verdict, stance = "HIGH_RISK",     "HIGH_RISK"
    else:
        verdict, stance = "EXTREME_RISK",  "HIGH_RISK"

    confidence = "high" if cv > 0 and n_anom < 4 else "medium"

    reasoning = [
        f"Volatility CV {cv:.0f}% — {vol_level} volatility environment",
        f"{n_anom} price anomal{'y' if n_anom==1 else 'ies'} in 90-day window",
    ]
    if staleness > 15:
        reasoning.append(f"Data {staleness} days stale — adds uncertainty")
    if q_score < 40:
        reasoning.append(f"Data quality score {q_score}/100 — reduced reliability")
    else:
        reasoning.append(f"Data quality score {q_score}/100 — acceptable coverage")

    flags = []
    if cv > 40:
        flags.append(f"VOLATILITY_SURGE — CV {cv:.0f}% exceeds extreme threshold")
    elif cv > 30:
        flags.append(f"ELEVATED_VOLATILITY — CV {cv:.0f}%")
    if n_anom >= 3:
        flags.append(f"ANOMALY_CLUSTER — {n_anom} anomalies detected")

    return AgentVote(
        agent="risk_analyst",
        display_name="Risk Analyst",
        verdict=verdict,
        score=round(score, 2),
        confidence=confidence,
        stance=stance,
        reasoning=reasoning,
        escalation_flags=flags,
        metrics={"cv": cv, "anomaly_count": n_anom, "risk_score": risk_score},
    )


def _seasonal_analyst(ctx: dict) -> AgentVote:
    """Specialist 3 — seasonal cycle and positioning."""
    seas   = ctx.get("seasonal") or {}
    phase  = seas.get("current_phase", "normal")
    vs_nm  = float(seas.get("current_vs_norm", 0.0))
    peaks  = seas.get("peak_months", [])
    troughs = seas.get("trough_months", [])
    pk_pct = float(seas.get("peak_pct", 0.0))

    has_seas = bool(seas and not seas.get("error") and peaks)

    if not has_seas:
        return AgentVote(
            agent="seasonal_analyst",
            display_name="Seasonal Analyst",
            verdict="UNKNOWN",
            score=0.5,
            confidence="low",
            stance="NEUTRAL",
            reasoning=["Insufficient seasonal history for cycle analysis"],
            escalation_flags=[],
            metrics={},
        )

    if phase == "peak":
        score   = min(1.0, 0.70 + (vs_nm / 100) * 0.25)
        verdict = "DEEP_PEAK" if vs_nm > 20 else "PEAK_SEASON"
        stance  = "BULLISH"
    elif phase == "trough":
        score   = max(0.0, 0.30 - (abs(vs_nm) / 100) * 0.20)
        verdict = "DEEP_TROUGH" if abs(vs_nm) > 20 else "LEAN_SEASON"
        stance  = "BEARISH"
    else:
        score, verdict, stance = 0.50, "NORMAL", "NEUTRAL"

    confidence = "high" if len(peaks) >= 2 and abs(vs_nm) > 5 else "medium"

    reasoning = []
    if vs_nm != 0:
        dir_ = "above" if vs_nm > 0 else "below"
        reasoning.append(f"Prices {abs(vs_nm):.1f}% {dir_} annual average — {phase} positioning")
    if peaks:
        reasoning.append(f"Historical peaks: {', '.join(peaks[:3])} (+{pk_pct:.0f}% avg)")
    if troughs:
        reasoning.append(f"Historical troughs: {', '.join(troughs[:3])}")
    if phase == "normal" and pk_pct > 15:
        reasoning.append(f"Approaching peak window — prices typically rise +{pk_pct:.0f}%")

    flags = []
    if phase == "peak" and vs_nm < -5:
        flags.append("SEASONAL_ANOMALY — Peak season but prices below normal")

    return AgentVote(
        agent="seasonal_analyst",
        display_name="Seasonal Analyst",
        verdict=verdict,
        score=round(score, 2),
        confidence=confidence,
        stance=stance,
        reasoning=reasoning or ["Normal seasonal conditions"],
        escalation_flags=flags,
        metrics={"phase": phase, "vs_norm": vs_nm, "peak_months": peaks[:3]},
    )


def _supply_demand_analyst(ctx: dict) -> AgentVote:
    """Specialist 4 — supply/demand balance inference."""
    price_vs_yr = float(ctx.get("price_vs_year", 0.0))
    mom         = ctx.get("momentum") or {}
    m7          = float(mom.get("7d_change_pct") or 0.0)
    seas        = ctx.get("seasonal") or {}
    phase       = seas.get("current_phase", "normal")
    last_price  = ctx.get("last_price", 0)
    vol         = ctx.get("volatility") or {}
    cv          = float(vol.get("cv") or 0.0)

    # Supply/demand inference from price-vs-year + momentum
    # Price above baseline + bullish momentum = demand > supply
    # Price below baseline + bearish momentum = supply > demand
    sd_score = 0.50

    if price_vs_yr > 10 and m7 > 0:
        sd_score = 0.75   # strong demand signal
        verdict, stance = "DEMAND_DRIVEN",  "BULLISH"
    elif price_vs_yr > 5 or m7 > 3:
        sd_score = 0.62
        verdict, stance = "MILD_DEMAND",    "BULLISH"
    elif price_vs_yr < -10 and m7 < 0:
        sd_score = 0.25   # supply glut
        verdict, stance = "SUPPLY_GLUT",    "BEARISH"
    elif price_vs_yr < -5 or m7 < -3:
        sd_score = 0.38
        verdict, stance = "SUPPLY_PRESSURE", "BEARISH"
    else:
        verdict, stance = "BALANCED",       "NEUTRAL"

    # Seasonal context modifies interpretation
    if phase == "peak" and price_vs_yr < 0:
        verdict, stance = "SUPPLY_GLUT",    "BEARISH"
        sd_score = min(sd_score, 0.30)
    elif phase == "trough" and price_vs_yr > 5:
        sd_score = min(sd_score + 0.10, 0.80)

    confidence = "medium" if abs(price_vs_yr) > 5 else "low"
    if cv > 35:
        confidence = "low"  # volatile market → harder to read supply/demand

    reasoning = []
    if price_vs_yr != 0:
        dir_ = "above" if price_vs_yr > 0 else "below"
        reasoning.append(f"Price {abs(price_vs_yr):.1f}% {dir_} annual baseline suggests "
                         f"{'elevated demand' if price_vs_yr > 0 else 'supply pressure'}")
    if m7 != 0:
        dir_ = "rising" if m7 > 0 else "falling"
        reasoning.append(f"Prices {dir_} {abs(m7):.1f}% this week — "
                         f"{'demand absorbing supply' if m7 > 0 else 'selling pressure dominant'}")
    if phase == "peak" and price_vs_yr < 0:
        reasoning.append("Prices below normal during peak season — possible oversupply event")
    elif phase == "trough" and price_vs_yr > 5:
        reasoning.append("Prices above normal during trough — demand unusually strong")
    reasoning.append(f"Inference based on price differential; direct arrival data unavailable")

    return AgentVote(
        agent="supply_demand_analyst",
        display_name="Supply/Demand Analyst",
        verdict=verdict,
        score=round(sd_score, 2),
        confidence=confidence,
        stance=stance,
        reasoning=reasoning[:4],
        escalation_flags=[],
        metrics={"price_vs_year": price_vs_yr, "m7": m7, "phase": phase},
    )


def _volatility_analyst(ctx: dict) -> AgentVote:
    """Specialist 5 — deep volatility decomposition."""
    vol       = ctx.get("volatility") or {}
    anomalies = ctx.get("anomalies") or []
    mom       = ctx.get("momentum") or {}
    cv        = float(vol.get("cv") or 0.0)
    vol_7d    = float(vol.get("recent_7d_vol") or 0.0)
    vol_30d   = float(vol.get("recent_30d_vol") or 0.0)
    n_anom    = len(anomalies)
    m7        = float(mom.get("7d_change_pct") or 0.0)

    # Volatility clustering: rising short-term vol vs long-term
    vol_expanding = vol_7d > vol_30d * 1.3 if vol_7d > 0 and vol_30d > 0 else False

    if cv < 10:
        score, verdict, stance = 0.90, "ULTRA_STABLE",  "NEUTRAL"
    elif cv < 20:
        score, verdict, stance = 0.72, "STABLE_VOL",    "NEUTRAL"
    elif cv < 30:
        score, verdict, stance = 0.55, "NORMAL_VOL",    "NEUTRAL"
    elif cv < 40:
        score, verdict, stance = 0.35, "ELEVATED_VOL",  "HIGH_RISK"
    elif cv < 55:
        score, verdict, stance = 0.18, "HIGH_VOL",      "HIGH_RISK"
    else:
        score, verdict, stance = 0.05, "EXTREME_VOL",   "HIGH_RISK"

    if n_anom >= 3:
        score = min(score, 0.25)
    if vol_expanding:
        score = max(0.05, score - 0.10)

    confidence = "high" if cv > 0 and vol_30d > 0 else "medium"

    reasoning = [f"Coefficient of variation: {cv:.1f}% — "
                 f"{'stable' if cv < 20 else 'volatile' if cv < 40 else 'extreme'} environment"]
    if vol_30d > 0:
        reasoning.append(f"30-day price std deviation: ₹{vol_30d:,.0f}/quintal")
    if vol_expanding:
        reasoning.append(f"Volatility expanding — short-term variance ({vol_7d:.0f}) > long-term ({vol_30d:.0f})")
    if n_anom > 0:
        reasoning.append(f"{n_anom} price anomal{'y' if n_anom==1 else 'ies'} — clustering risk "
                         f"{'elevated' if n_anom >= 3 else 'present'}")
    else:
        reasoning.append("No anomalies detected — clean price history")

    flags = []
    if cv > 45:
        flags.append("EXTREME_VOLATILITY")
    if vol_expanding:
        flags.append("VOLATILITY_EXPANSION")
    if n_anom >= 3:
        flags.append("ANOMALY_CLUSTER")

    return AgentVote(
        agent="volatility_analyst",
        display_name="Volatility Analyst",
        verdict=verdict,
        score=round(score, 2),
        confidence=confidence,
        stance=stance,
        reasoning=reasoning[:4],
        escalation_flags=flags,
        metrics={"cv": cv, "vol_7d": vol_7d, "vol_30d": vol_30d,
                 "expanding": vol_expanding, "anomaly_count": n_anom},
    )


def _forecast_reliability_analyst(ctx: dict) -> AgentVote:
    """Specialist 6 — forecast system reliability assessment."""
    quality   = ctx.get("quality") or {}
    tier      = ctx.get("tier", "D")
    staleness = ctx.get("staleness_days", 0)
    rows      = quality.get("training_rows") or 0
    q_score   = quality.get("score", 50)
    has_fcst  = ctx.get("forecast_7d") is not None or ctx.get("forecast_30d") is not None

    score = 0.50
    verdict_parts = []

    if tier == "A":
        score += 0.20
        verdict_parts.append("TIER_A")
    elif tier == "B":
        score += 0.10
        verdict_parts.append("TIER_B")
    elif tier == "C":
        score -= 0.05
        verdict_parts.append("TIER_C")
    else:
        score -= 0.15
        verdict_parts.append("TIER_D")

    if has_fcst:
        score += 0.10
    else:
        score -= 0.10

    if staleness <= 7:
        score += 0.08
    elif staleness <= 30:
        pass
    elif staleness <= 90:
        score -= 0.10
    else:
        score -= 0.20

    approx_yrs = (rows * 2) / 365 if rows else 0
    if approx_yrs >= 5:
        score += 0.10
    elif approx_yrs >= 2:
        score += 0.05
    elif rows > 0:
        score -= 0.05

    score = round(min(0.95, max(0.05, score)), 2)

    if score >= 0.70:
        verdict, stance = "HIGH_RELIABILITY",    "NEUTRAL"
    elif score >= 0.50:
        verdict, stance = "MODERATE_RELIABILITY","NEUTRAL"
    elif score >= 0.30:
        verdict, stance = "LOW_RELIABILITY",     "NEUTRAL"
    else:
        verdict, stance = "UNRELIABLE",          "NEUTRAL"

    confidence = "high" if q_score >= 60 else "medium"

    reasoning = [f"Forecast tier: {tier} — "
                 f"{'Full Prophet model' if tier=='A' else 'XGBoost model' if tier=='B' else 'Sparse trend' if tier=='C' else 'Analytics only'}"]
    if has_fcst:
        reasoning.append("ML forecast model produced valid price projections")
    else:
        reasoning.append("No ML forecast available — analytics-only mode")
    if staleness > 0:
        reasoning.append(f"Data freshness: {staleness} days since last update")
    if rows > 0:
        reasoning.append(f"Training data: ~{approx_yrs:.1f} years ({rows} records)")

    flags = []
    if staleness > 60:
        flags.append(f"STALE_DATA — {staleness} days without update")
    if tier == "D" and not has_fcst:
        flags.append("NO_FORECAST — Analytics only, no ML projection")

    return AgentVote(
        agent="forecast_reliability_analyst",
        display_name="Forecast Reliability",
        verdict=verdict,
        score=score,
        confidence=confidence,
        stance=stance,  # Reliability is meta — doesn't affect bullish/bearish stance
        reasoning=reasoning[:4],
        escalation_flags=flags,
        metrics={"tier": tier, "staleness_days": staleness, "training_rows": rows,
                 "quality_score": q_score, "has_forecast": has_fcst},
    )


def _opportunity_analyst(ctx: dict) -> AgentVote:
    """Specialist 7 — composite opportunity scoring."""
    mom       = ctx.get("momentum") or {}
    vol       = ctx.get("volatility") or {}
    seas      = ctx.get("seasonal") or {}
    quality   = ctx.get("quality") or {}
    tier      = ctx.get("tier", "D")

    m_score      = float(mom.get("score", 0.0))
    cv           = float(vol.get("cv") or 0.0)
    phase        = seas.get("current_phase", "normal")
    vs_norm      = float(seas.get("current_vs_norm", 0.0))
    q_score      = quality.get("score", 50)
    price_vs_yr  = float(ctx.get("price_vs_year", 0.0))

    # Composite opportunity (0-1 scale)
    opp = 0.40  # neutral baseline

    # Momentum contribution
    if m_score >= 5:
        opp += 0.20
    elif m_score >= 2:
        opp += 0.10
    elif m_score <= -5:
        opp -= 0.20
    elif m_score <= -2:
        opp -= 0.10

    # Volatility penalty (high vol = lower reliable opportunity)
    if cv < 15:
        opp += 0.12
    elif cv < 25:
        opp += 0.04
    elif cv > 40:
        opp -= 0.15
    elif cv > 30:
        opp -= 0.08

    # Seasonal bonus
    if phase == "peak":
        opp += 0.12
    elif phase == "trough":
        opp -= 0.08

    # Price vs year baseline
    if price_vs_yr > 10:
        opp += 0.08
    elif price_vs_yr < -10:
        opp -= 0.08

    # Quality and tier
    if q_score >= 70:
        opp += 0.05
    if tier in ("A", "B"):
        opp += 0.05

    opp = round(min(0.95, max(0.05, opp)), 2)

    if opp >= 0.72:
        verdict, stance = "STRONG_OPPORTUNITY",  "BULLISH"
    elif opp >= 0.57:
        verdict, stance = "GOOD_OPPORTUNITY",    "BULLISH"
    elif opp >= 0.43:
        verdict, stance = "NEUTRAL_OPPORTUNITY", "NEUTRAL"
    elif opp >= 0.28:
        verdict, stance = "WEAK_OPPORTUNITY",    "BEARISH"
    else:
        verdict, stance = "POOR_OPPORTUNITY",    "BEARISH"

    confidence = "medium" if (tier in ("A", "B") and q_score >= 40) else "low"

    reasoning = [
        f"Composite opportunity score: {opp:.0%} — "
        f"{'strong' if opp >= 0.65 else 'moderate' if opp >= 0.50 else 'limited'} window"
    ]
    if m_score != 0:
        reasoning.append(f"Momentum contribution: {m_score:+.1f}% weekly change")
    if phase != "normal":
        reasoning.append(f"Seasonal factor: {phase} positioning "
                         f"({vs_norm:+.1f}% vs annual average)")
    reasoning.append(f"Data quality {q_score}/100, forecast tier {tier}")

    return AgentVote(
        agent="opportunity_analyst",
        display_name="Opportunity Analyst",
        verdict=verdict,
        score=opp,
        confidence=confidence,
        stance=stance,
        reasoning=reasoning[:4],
        escalation_flags=[],
        metrics={"opportunity_score": opp, "momentum": m_score, "cv": cv,
                 "phase": phase, "price_vs_year": price_vs_yr},
    )


# ── Council aggregation ────────────────────────────────────────────────────────

def _classify_stance(vote: AgentVote) -> str:
    """Map a vote to a simple stance for aggregation."""
    if vote.stance in ("HIGH_RISK",):
        return "HIGH_RISK"
    if vote.stance == "BULLISH":
        return "BULLISH"
    if vote.stance == "BEARISH":
        return "BEARISH"
    return "NEUTRAL"


_REC_WEIGHTS = {
    "trend_analyst":               0.22,
    "risk_analyst":                0.18,
    "seasonal_analyst":            0.15,
    "supply_demand_analyst":       0.15,
    "volatility_analyst":          0.12,
    "forecast_reliability_analyst": 0.08,
    "opportunity_analyst":         0.10,
}


def _aggregate_council(votes: list[AgentVote]) -> dict:
    """
    Aggregate 7 agent votes into a council decision.

    Vote stances: BULLISH, BEARISH, NEUTRAL, HIGH_RISK
    Weights sum to 1.0 across all 7 agents.
    """
    # Tally stances
    breakdown: dict[str, float] = {"BULLISH": 0.0, "BEARISH": 0.0,
                                    "NEUTRAL": 0.0, "HIGH_RISK": 0.0}
    total_w = 0.0
    weighted_score = 0.0

    for v in votes:
        w = _REC_WEIGHTS.get(v.agent, 0.10)
        stance = _classify_stance(v)
        breakdown[stance] += w
        weighted_score += v.score * w
        total_w += w

    if total_w > 0:
        weighted_score /= total_w  # normalize

    # Dominant view
    dominant = max(breakdown, key=breakdown.get)
    dominant_weight = breakdown[dominant]
    agreement_ratio = round(dominant_weight, 2)

    # If HIGH_RISK is dominant or significant, elevate it
    if breakdown["HIGH_RISK"] >= 0.30:
        dominant = "HIGH_RISK"
        dominant_weight = breakdown["HIGH_RISK"]

    # Minority view = second highest stance with meaningful weight
    sorted_stances = sorted(breakdown.items(), key=lambda x: -x[1])
    minority_view = None
    for st, w in sorted_stances[1:]:
        if w >= 0.18:
            minority_view = st
            break

    # Contradiction detection
    has_contradiction = (
        (breakdown["BULLISH"] >= 0.20 and breakdown["BEARISH"] >= 0.20)
        or (breakdown["BULLISH"] >= 0.25 and breakdown["HIGH_RISK"] >= 0.25)
    )

    # Consensus strength
    # 1.0 = unanimous, 0 = perfectly split
    consensus_strength = round(dominant_weight / max(total_w, 0.01), 2)

    # Dissenting agents (those whose stance differs from dominant)
    dissent = [v.display_name for v in votes if _classify_stance(v) != dominant]

    # Weighted recommendation
    rec = _derive_recommendation(dominant, breakdown, weighted_score)

    # Final confidence
    if consensus_strength >= 0.65:
        final_conf = "high"
    elif consensus_strength >= 0.45:
        final_conf = "medium"
    elif has_contradiction:
        final_conf = "uncertain"
    else:
        final_conf = "low"

    return {
        "vote_breakdown":          {k: round(v, 2) for k, v in breakdown.items()},
        "consensus_strength":      consensus_strength,
        "agreement_ratio":         agreement_ratio,
        "dominant_view":           dominant,
        "minority_view":           minority_view,
        "contradiction_detected":  has_contradiction,
        "weighted_recommendation": rec,
        "final_confidence":        final_conf,
        "weighted_score":          round(weighted_score, 2),
        "dissent_agents":          dissent,
    }


def _derive_recommendation(dominant: str, breakdown: dict, w_score: float) -> str:
    """Map council vote to action recommendation."""
    if dominant == "HIGH_RISK":
        return "HIGH_RISK_AVOIDANCE"
    if dominant == "BULLISH":
        if w_score >= 0.70:
            return "SELL_NOW"
        if w_score >= 0.58:
            return "SELL_SOON"
        return "HOLD"
    if dominant == "BEARISH":
        if breakdown["HIGH_RISK"] >= 0.20:
            return "WAIT"
        return "HOLD"
    # NEUTRAL dominant
    if breakdown["BULLISH"] > breakdown["BEARISH"]:
        return "WATCH"
    return "HOLD"


def _build_council_summary(
    crop: str, state: str,
    dominant: str, consensus: float,
    has_contradiction: bool,
    rec: str,
    all_flags: list[str],
) -> str:
    dom_word = {
        "BULLISH":   "a bullish consensus",
        "BEARISH":   "a bearish consensus",
        "NEUTRAL":   "a neutral consensus",
        "HIGH_RISK": "a high-risk consensus",
    }.get(dominant, "a mixed consensus")

    rec_word = rec.replace("_", " ").lower()

    if has_contradiction:
        return (
            f"The AI council is divided on {crop} in {state}: "
            f"significant disagreement between agents with contradictory signals detected. "
            f"Weighted analysis leans toward {rec_word}."
        )
    if consensus >= 0.65:
        return (
            f"The AI council has reached {dom_word} on {crop} in {state} "
            f"({consensus:.0%} weighted agreement). "
            f"Council recommendation: {rec_word}."
        )
    return (
        f"The AI council signals {dom_word} for {crop} in {state} "
        f"(consensus strength {consensus:.0%}). "
        f"Council recommendation: {rec_word}."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def run_council(raw_ctx: dict) -> CouncilResult:
    """
    Run all 7 specialist agents and aggregate into a council decision.

    Args:
        raw_ctx: Output from build_insight_context(crop, state).

    Returns:
        CouncilResult with full multi-agent analysis.
    """
    crop  = raw_ctx.get("crop", "Unknown")
    state = raw_ctx.get("state", "Unknown")

    if not raw_ctx.get("has_data"):
        return CouncilResult(
            crop=crop, state=state, has_data=False,
            agents=[], vote_breakdown={}, consensus_strength=0.0,
            agreement_ratio=0.0, dominant_view="UNKNOWN",
            minority_view=None, contradiction_detected=False,
            weighted_recommendation="WATCH", final_confidence="low",
            council_summary=f"Insufficient data for {crop} in {state}.",
            dissent_agents=[], opportunity_score=0.0,
        )

    # Run all 7 agents
    votes = [
        _trend_analyst(raw_ctx),
        _risk_analyst(raw_ctx),
        _seasonal_analyst(raw_ctx),
        _supply_demand_analyst(raw_ctx),
        _volatility_analyst(raw_ctx),
        _forecast_reliability_analyst(raw_ctx),
        _opportunity_analyst(raw_ctx),
    ]

    # Aggregate
    agg = _aggregate_council(votes)

    # Collect all escalation flags
    all_flags = []
    for v in votes:
        all_flags.extend(v.escalation_flags)

    summary = _build_council_summary(
        crop, state,
        agg["dominant_view"],
        agg["consensus_strength"],
        agg["contradiction_detected"],
        agg["weighted_recommendation"],
        all_flags,
    )

    opp_vote = next((v for v in votes if v.agent == "opportunity_analyst"), None)
    opp_score = opp_vote.score if opp_vote else 0.5

    return CouncilResult(
        crop=crop,
        state=state,
        has_data=True,
        agents=votes,
        vote_breakdown=agg["vote_breakdown"],
        consensus_strength=agg["consensus_strength"],
        agreement_ratio=agg["agreement_ratio"],
        dominant_view=agg["dominant_view"],
        minority_view=agg["minority_view"],
        contradiction_detected=agg["contradiction_detected"],
        weighted_recommendation=agg["weighted_recommendation"],
        final_confidence=agg["final_confidence"],
        council_summary=summary,
        dissent_agents=agg["dissent_agents"],
        opportunity_score=opp_score,
    )


def council_to_dict(result: CouncilResult) -> dict:
    """Serialize CouncilResult to a JSON-safe dict."""
    return {
        "crop":                    result.crop,
        "state":                   result.state,
        "has_data":                result.has_data,
        "agents": [
            {
                "agent":            v.agent,
                "display_name":     v.display_name,
                "verdict":          v.verdict,
                "score":            v.score,
                "confidence":       v.confidence,
                "stance":           v.stance,
                "reasoning":        v.reasoning,
                "escalation_flags": v.escalation_flags,
                "metrics":          v.metrics,
            }
            for v in result.agents
        ],
        "vote_breakdown":          result.vote_breakdown,
        "consensus_strength":      result.consensus_strength,
        "agreement_ratio":         result.agreement_ratio,
        "dominant_view":           result.dominant_view,
        "minority_view":           result.minority_view,
        "contradiction_detected":  result.contradiction_detected,
        "weighted_recommendation": result.weighted_recommendation,
        "final_confidence":        result.final_confidence,
        "council_summary":         result.council_summary,
        "dissent_agents":          result.dissent_agents,
        "opportunity_score":       result.opportunity_score,
    }
