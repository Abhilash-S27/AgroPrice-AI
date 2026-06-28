"""
backend/services/decision_trace_engine.py

AI Decision Trace System — Phase 5.

Produces explainable intelligence traces showing:
  - Which agents agreed
  - Which agents disagreed
  - Strongest evidence
  - Weakest evidence
  - Confidence contributors
  - Risk contributors
  - Anomaly impact
  - Seasonal impact

Format: institutional-quality reasoning chain.
CRITICAL: Fully deterministic. No Gemini calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class DecisionTrace:
    crop:                str
    state:               str
    pipeline_stages:     list[dict]      # ordered reasoning stages
    agreed_agents:       list[str]       # display names that agreed
    dissenting_agents:   list[str]       # display names that dissented
    strongest_evidence:  list[str]       # top 3 strongest signals
    weakest_evidence:    list[str]       # 2 weakest / conflicting signals
    confidence_drivers:  list[str]       # what boosted confidence
    risk_drivers:        list[str]       # what elevated risk
    anomaly_impact:      str             # narrative on anomaly effects
    seasonal_impact:     str             # narrative on seasonal effects
    final_verdict:       str             # the council's recommendation
    evidence_quality:    str             # "strong"|"moderate"|"weak"|"mixed"
    trace_summary:       str             # 2-sentence executive trace


def build_decision_trace(
    raw_ctx: dict,
    council_dict: dict,
    consensus_dict: dict,
    probability_dict: dict,
) -> DecisionTrace:
    """
    Build a full decision trace from all intelligence layers.

    Args:
        raw_ctx:          Insight context.
        council_dict:     Multi-agent council result.
        consensus_dict:   Consensus engine result.
        probability_dict: Probabilistic outlook result.

    Returns:
        DecisionTrace with institutional-quality reasoning chain.
    """
    crop  = raw_ctx.get("crop", "Unknown")
    state = raw_ctx.get("state", "Unknown")

    if not raw_ctx.get("has_data"):
        return DecisionTrace(
            crop=crop, state=state,
            pipeline_stages=[], agreed_agents=[], dissenting_agents=[],
            strongest_evidence=["Insufficient market data"],
            weakest_evidence=[], confidence_drivers=[], risk_drivers=[],
            anomaly_impact="No data available for anomaly analysis.",
            seasonal_impact="No data available for seasonal analysis.",
            final_verdict="WATCH",
            evidence_quality="weak",
            trace_summary=f"No market data available for {crop} in {state}. Cannot generate decision trace.",
        )

    # ── Extract signals ───────────────────────────────────────────────────────
    agents          = council_dict.get("agents", [])
    dominant        = council_dict.get("dominant_view", "NEUTRAL")
    contradiction   = bool(council_dict.get("contradiction_detected", False))
    consensus_str   = float(council_dict.get("consensus_strength", 0.5))
    dissent_names   = council_dict.get("dissent_agents", [])
    final_rec       = council_dict.get("weighted_recommendation", "WATCH")

    conf_score      = float(consensus_dict.get("confidence_score", 0.3))
    conf_decomp     = consensus_dict.get("confidence_decomposition", [])
    stability       = consensus_dict.get("stability_label", "volatile")
    risk_adj        = consensus_dict.get("risk_adjustment", "normal")
    instab_warning  = consensus_dict.get("instability_warning")

    up_prob         = float(probability_dict.get("upside_probability", 0.33))
    dn_prob         = float(probability_dict.get("downside_probability", 0.33))
    shock_prob      = float(probability_dict.get("volatility_shock_prob", 0.30))
    reversal_p      = float(probability_dict.get("reversal_probability", 0.20))
    prob_basis      = probability_dict.get("probability_basis", [])

    vol       = raw_ctx.get("volatility") or {}
    anomalies = raw_ctx.get("anomalies") or []
    seas      = raw_ctx.get("seasonal") or {}
    mom       = raw_ctx.get("momentum") or {}
    tier      = raw_ctx.get("tier", "D")

    cv    = float(vol.get("cv") or 0.0)
    n_a   = len(anomalies)
    phase = seas.get("current_phase", "normal")
    vs_nm = float(seas.get("current_vs_norm", 0.0))
    m7    = float(mom.get("7d_change_pct") or 0.0)

    # ── Pipeline stages ───────────────────────────────────────────────────────
    stages = [
        {
            "stage": "1. Data Ingestion",
            "description": f"AGMARKNET price data loaded for {crop} in {state}",
            "result": f"Tier {tier} dataset — {'adequate' if tier in ('A','B') else 'limited'} coverage",
            "status": "complete",
        },
        {
            "stage": "2. Analytics Engine",
            "description": "Volatility, momentum, seasonality, and anomaly computation",
            "result": f"CV {cv:.0f}% | m7 {m7:+.1f}% | {n_a} anomalies | {phase} season",
            "status": "complete",
        },
        {
            "stage": "3. Multi-Agent Council (7 agents)",
            "description": "7 specialist agents independently analyze the market",
            "result": (
                f"Dominant view: {dominant} | Consensus: {consensus_str:.0%} | "
                f"{'Contradiction detected' if contradiction else 'No contradiction'}"
            ),
            "status": "complete",
        },
        {
            "stage": "4. Consensus Engine",
            "description": "Weighted aggregation with volatility, anomaly, and tier penalties",
            "result": f"Confidence: {conf_score:.0%} ({consensus_dict.get('recommendation_confidence','?')}) | Stability: {stability}",
            "status": "complete",
        },
        {
            "stage": "5. Probability Engine",
            "description": "Heuristic directional probability estimation",
            "result": f"Upside {up_prob:.0%} / Downside {dn_prob:.0%} / Shock risk {shock_prob:.0%}",
            "status": "complete",
        },
        {
            "stage": "6. Strategy Engine",
            "description": "Mode-specific actionable guidance generation",
            "result": f"Final recommendation: {final_rec.replace('_',' ')}",
            "status": "complete",
        },
    ]

    # ── Agreed vs dissenting agents ───────────────────────────────────────────
    agreed    = [a["display_name"] for a in agents if a["display_name"] not in dissent_names]
    dissenting = [a["display_name"] for a in agents if a["display_name"] in dissent_names]

    # ── Strongest evidence ────────────────────────────────────────────────────
    strongest: list[str] = []
    # Evidence rank: high confidence agents first
    high_conf = [a for a in agents if a.get("confidence") == "high"]
    for a in sorted(high_conf, key=lambda x: x.get("score", 0.5), reverse=True)[:3]:
        if a.get("reasoning"):
            strongest.append(f"[{a['display_name']}] {a['reasoning'][0]}")

    if not strongest:
        for a in sorted(agents, key=lambda x: abs(x.get("score", 0.5) - 0.5), reverse=True)[:3]:
            if a.get("reasoning"):
                strongest.append(f"[{a['display_name']}] {a['reasoning'][0]}")

    # ── Weakest evidence ──────────────────────────────────────────────────────
    weakest: list[str] = []
    low_conf = [a for a in agents if a.get("confidence") == "low"]
    for a in low_conf[:2]:
        if a.get("reasoning"):
            weakest.append(f"[{a['display_name']}] {a['reasoning'][0]}")
    if contradiction:
        weakest.append("Agent contradiction detected — directional signals conflict")

    # ── Confidence drivers ────────────────────────────────────────────────────
    conf_drivers = [c for c in conf_decomp if "boost" in c.lower() or "support" in c.lower()
                    or "clean" in c.lower() or "tier A" in c or "tier B" in c or "coherent" in c.lower()]
    if not conf_drivers:
        conf_drivers = conf_decomp[:3]

    # ── Risk drivers ─────────────────────────────────────────────────────────
    risk_drivers: list[str] = []
    if cv > 30:
        risk_drivers.append(f"High volatility (CV {cv:.0f}%) reduces forecast precision")
    if n_a >= 2:
        risk_drivers.append(f"{n_a} price anomalies — market noise elevated")
    if contradiction:
        risk_drivers.append("Agent disagreement — minority signals present meaningful alternative view")
    if instab_warning:
        risk_drivers.append(instab_warning[:100])
    if risk_adj != "normal":
        risk_drivers.append(f"Risk adjustment: {risk_adj.replace('_',' ')} — recommendation modified")

    # ── Anomaly impact narrative ──────────────────────────────────────────────
    if n_a == 0:
        anomaly_impact = (
            "No price anomalies detected in the 90-day window. "
            "Clean price history supports higher confidence in directional signals."
        )
    elif n_a == 1:
        anom = anomalies[0]
        evt  = "spike" if anom.get("event_type") == "spike" else "crash"
        anomaly_impact = (
            f"1 price {evt} detected ({anom.get('pct_deviation', 0):+.1f}% on {anom.get('date', 'recent date')}, "
            f"severity: {anom.get('severity', 'unknown')}). "
            "Single anomaly adds modest uncertainty but does not dominate the signal."
        )
    else:
        high_sev = sum(1 for a in anomalies if a.get("severity") in ("high", "medium"))
        anomaly_impact = (
            f"{n_a} price anomalies detected in the 90-day window "
            f"({high_sev} high/medium severity). "
            "Anomaly clustering indicates market instability; all directional signals carry elevated uncertainty."
        )

    # ── Seasonal impact narrative ─────────────────────────────────────────────
    peaks  = seas.get("peak_months", [])
    troughs= seas.get("trough_months", [])
    pk_pct = float(seas.get("peak_pct", 0.0))

    if not peaks:
        seasonal_impact = (
            "Seasonal data unavailable — seasonal impact on decision cannot be quantified. "
            "Directional signals rely on momentum and volatility only."
        )
    elif phase == "peak":
        seasonal_impact = (
            f"Currently in peak season ({vs_nm:+.1f}% above annual average). "
            f"Seasonal tailwind supports {dominant.lower()} signals. "
            f"Peak months ({', '.join(peaks[:3])}) historically deliver +{pk_pct:.0f}% above baseline."
        )
    elif phase == "trough":
        seasonal_impact = (
            f"Currently in lean season ({abs(vs_nm):.0f}% below annual average). "
            f"Seasonal headwind amplifies bearish signals. "
            f"Peak recovery expected in {', '.join(peaks[:2] or ['upcoming months'])}."
        )
    else:
        seasonal_impact = (
            f"Mid-season positioning — no strong seasonal tailwind or headwind. "
            f"Seasonal signal adds limited directional bias; momentum is the primary driver."
        )

    # ── Evidence quality ─────────────────────────────────────────────────────
    if consensus_str >= 0.65 and conf_score >= 0.55 and n_a < 2:
        evidence_quality = "strong"
    elif consensus_str >= 0.50 and conf_score >= 0.40 and not contradiction:
        evidence_quality = "moderate"
    elif contradiction or conf_score < 0.25 or n_a >= 4:
        evidence_quality = "weak"
    else:
        evidence_quality = "mixed"

    # ── Trace summary ─────────────────────────────────────────────────────────
    agree_count = len(agreed)
    total_count = len(agents)
    trace_summary = (
        f"{agree_count}/{total_count} specialist agents converged on a {dominant.lower()} view "
        f"(consensus strength {consensus_str:.0%}, evidence quality: {evidence_quality}). "
        f"Final weighted recommendation: {final_rec.replace('_', ' ')}."
    )

    return DecisionTrace(
        crop=crop,
        state=state,
        pipeline_stages=stages,
        agreed_agents=agreed,
        dissenting_agents=dissenting,
        strongest_evidence=strongest[:3],
        weakest_evidence=weakest[:3],
        confidence_drivers=conf_drivers[:4],
        risk_drivers=risk_drivers[:4],
        anomaly_impact=anomaly_impact,
        seasonal_impact=seasonal_impact,
        final_verdict=final_rec,
        evidence_quality=evidence_quality,
        trace_summary=trace_summary,
    )


def trace_to_dict(t: DecisionTrace) -> dict:
    """Serialize DecisionTrace to a JSON-safe dict."""
    return {
        "crop":                t.crop,
        "state":               t.state,
        "pipeline_stages":     t.pipeline_stages,
        "agreed_agents":       t.agreed_agents,
        "dissenting_agents":   t.dissenting_agents,
        "strongest_evidence":  t.strongest_evidence,
        "weakest_evidence":    t.weakest_evidence,
        "confidence_drivers":  t.confidence_drivers,
        "risk_drivers":        t.risk_drivers,
        "anomaly_impact":      t.anomaly_impact,
        "seasonal_impact":     t.seasonal_impact,
        "final_verdict":       t.final_verdict,
        "evidence_quality":    t.evidence_quality,
        "trace_summary":       t.trace_summary,
    }
