"""
backend/services/executive_synthesis_engine.py

Executive Synthesis Engine — Phase 5.

Generates Bloomberg/Reuters-style institutional briefings from deterministic data.

Produces:
  - executive_summary       (2–3 sentence overview)
  - strategic_outlook       (forward-looking guidance)
  - institutional_commentary (analytical depth)
  - market_posture          (one-word label: DEFENSIVE/OPPORTUNISTIC/NEUTRAL/CAUTIOUS)
  - escalation_briefing     (alert cards)
  - briefing_cards          (Bloomberg-style headline cards)

Tone: institutional research. Analytical. Not alarmist. Not cheerful.
CRITICAL: All text from real data via templates. No Gemini calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class ExecutiveSynthesis:
    crop:                    str
    state:                   str
    executive_summary:       str
    strategic_outlook:       str
    institutional_commentary: str
    market_posture:          str     # DEFENSIVE | OPPORTUNISTIC | NEUTRAL | CAUTIOUS | CRISIS
    posture_color:           str     # tailwind color
    escalation_briefing:     list[str]
    briefing_cards:          list[dict]   # [{title, body, severity, category}]
    generated_at:            str


def generate_executive_synthesis(
    raw_ctx: dict,
    council_dict: dict,
    consensus_dict: dict,
    probability_dict: dict,
    strategy_dict: dict,
) -> ExecutiveSynthesis:
    """
    Generate full executive synthesis from all intelligence layers.
    """
    crop  = raw_ctx.get("crop", "Unknown")
    state = raw_ctx.get("state", "Unknown")

    if not raw_ctx.get("has_data"):
        return ExecutiveSynthesis(
            crop=crop, state=state,
            executive_summary=f"Insufficient market data for {crop} in {state}.",
            strategic_outlook="No forward-looking guidance possible without price history.",
            institutional_commentary="Recommend establishing data coverage before analysis.",
            market_posture="NEUTRAL",
            posture_color="gray",
            escalation_briefing=[],
            briefing_cards=[],
            generated_at=str(date.today()),
        )

    # ── Extract signals ───────────────────────────────────────────────────────
    mom       = raw_ctx.get("momentum") or {}
    vol       = raw_ctx.get("volatility") or {}
    seas      = raw_ctx.get("seasonal") or {}
    anomalies = raw_ctx.get("anomalies") or []
    tier      = raw_ctx.get("tier", "D")
    last_p    = raw_ctx.get("last_price", 0)
    price_vs_yr = float(raw_ctx.get("price_vs_year", 0.0))

    m7       = float(mom.get("7d_change_pct") or 0.0)
    m30      = float(mom.get("30d_change_pct") or 0.0)
    cv       = float(vol.get("cv") or 0.0)
    phase    = seas.get("current_phase", "normal")
    vs_nm    = float(seas.get("current_vs_norm", 0.0))
    n_a      = len(anomalies)
    pk_months= seas.get("peak_months", [])

    dominant     = council_dict.get("dominant_view", "NEUTRAL")
    consensus_s  = float(council_dict.get("consensus_strength", 0.5))
    contradiction= bool(council_dict.get("contradiction_detected", False))
    final_rec    = council_dict.get("weighted_recommendation", "WATCH")
    council_conf = council_dict.get("final_confidence", "medium")

    conf_score   = float(consensus_dict.get("confidence_score", 0.3))
    stability    = consensus_dict.get("stability_label", "volatile")
    exec_rec     = consensus_dict.get("executive_recommendation", "WATCH")
    risk_adj     = consensus_dict.get("risk_adjustment", "normal")
    instab_warn  = consensus_dict.get("instability_warning")

    up_prob      = float(probability_dict.get("upside_probability", 0.33))
    dn_prob      = float(probability_dict.get("downside_probability", 0.33))
    shock_prob   = float(probability_dict.get("volatility_shock_prob", 0.30))
    reversal_p   = float(probability_dict.get("reversal_probability", 0.20))
    outlook_lbl  = probability_dict.get("risk_adjusted_outlook", "uncertain")

    action       = strategy_dict.get("action", "WATCH")
    timing       = strategy_dict.get("timing_guidance", "")

    # ── Market posture ─────────────────────────────────────────────────────────
    posture, posture_color = _classify_posture(
        dominant, stability, conf_score, shock_prob, exec_rec, contradiction
    )

    # ── Executive summary ─────────────────────────────────────────────────────
    summary = _build_executive_summary(
        crop, state, last_p, price_vs_yr, m7, cv, n_a, phase, vs_nm,
        dominant, consensus_s, final_rec, conf_score, posture
    )

    # ── Strategic outlook ─────────────────────────────────────────────────────
    outlook = _build_strategic_outlook(
        crop, state, up_prob, dn_prob, shock_prob, reversal_p,
        phase, pk_months, action, timing, risk_adj
    )

    # ── Institutional commentary ──────────────────────────────────────────────
    commentary = _build_institutional_commentary(
        crop, state, cv, n_a, contradiction, council_conf, consensus_s,
        tier, stability, m7, m30
    )

    # ── Escalation briefing ────────────────────────────────────────────────────
    escalations = _build_escalation_briefing(cv, n_a, contradiction, stability, shock_prob, reversal_p)

    # ── Bloomberg briefing cards ───────────────────────────────────────────────
    cards = _build_briefing_cards(
        crop, state, dominant, stability, n_a, cv, phase, vs_nm, contradiction,
        conf_score, shock_prob, m7, final_rec, posture
    )

    return ExecutiveSynthesis(
        crop=crop,
        state=state,
        executive_summary=summary,
        strategic_outlook=outlook,
        institutional_commentary=commentary,
        market_posture=posture,
        posture_color=posture_color,
        escalation_briefing=escalations,
        briefing_cards=cards,
        generated_at=str(date.today()),
    )


# ── Private helpers ────────────────────────────────────────────────────────────

def _classify_posture(
    dominant: str, stability: str, conf: float,
    shock_prob: float, exec_rec: str, contradiction: bool,
) -> tuple[str, str]:
    if stability == "crisis" or exec_rec == "HIGH_RISK_AVOIDANCE":
        return "CRISIS", "red"
    if dominant == "BULLISH" and conf >= 0.55 and not contradiction:
        return "OPPORTUNISTIC", "emerald"
    if dominant == "BEARISH" or stability == "volatile":
        return "DEFENSIVE", "amber"
    if contradiction or conf < 0.35:
        return "CAUTIOUS", "orange"
    return "NEUTRAL", "blue"


def _build_executive_summary(
    crop: str, state: str, last_p: float, price_vs_yr: float,
    m7: float, cv: float, n_a: int, phase: str, vs_nm: float,
    dominant: str, consensus_s: float, final_rec: str,
    conf_score: float, posture: str,
) -> str:
    p_str = f"₹{last_p:,.0f}/quintal" if last_p else "price data available"
    yr_str = (
        f"{abs(price_vs_yr):.1f}% {'above' if price_vs_yr > 0 else 'below'} the annual baseline"
    ) if price_vs_yr != 0 else "in line with annual baseline"

    dom_word = {
        "BULLISH":   "bullish",
        "BEARISH":   "bearish",
        "NEUTRAL":   "neutral",
        "HIGH_RISK": "high-risk",
    }.get(dominant, "mixed")

    trend_dir = "rising" if m7 > 2 else "falling" if m7 < -2 else "consolidating"
    risk_desc = (
        "significant downside risk" if cv > 40 else
        "elevated volatility" if cv > 25 else
        "moderate risk environment" if cv > 15 else
        "contained risk"
    )
    anom_note = f" {n_a} recent price anomal{'y' if n_a == 1 else 'ies'} detected." if n_a > 0 else ""
    sea_note  = f" Season: {phase} phase ({vs_nm:+.1f}% vs annual average)." if vs_nm != 0 else ""

    return (
        f"{crop} markets in {state} are {trend_dir} at current levels ({p_str}, {yr_str}), "
        f"with the AI council signalling a {dom_word} consensus "
        f"(strength {consensus_s:.0%}, confidence {conf_score:.0%}).{anom_note}{sea_note} "
        f"Recommendation: {final_rec.replace('_', ' ')} under a {posture.lower()} market posture."
    )


def _build_strategic_outlook(
    crop: str, state: str, up: float, dn: float,
    shock: float, reversal: float, phase: str,
    pk_months: list, action: str, timing: str, risk_adj: str,
) -> str:
    dir_ = "upward" if up > dn else "downward" if dn > up else "sideways"
    shock_clause = (
        f" Volatility shock probability stands at {shock:.0%} — "
        f"{'significant' if shock > 0.40 else 'manageable'} tail risk."
        if shock > 0.20 else ""
    )
    reversal_clause = (
        f" Reversal probability {reversal:.0%} — monitor for direction change." if reversal > 0.35 else ""
    )
    season_clause = ""
    if phase == "trough" and pk_months:
        season_clause = (
            f" Seasonal inflection approaching with peak months "
            f"({', '.join(pk_months[:2])}) on the horizon."
        )
    elif phase == "peak":
        season_clause = " Peak season pricing — window for advantageous sales may be limited."

    risk_clause = ""
    if risk_adj == "risk_critical":
        risk_clause = " Risk elevation has triggered conservative posture modification."

    return (
        f"Statistical models assign {up:.0%} probability to {dir_} continuation over the next 30 days.{shock_clause}"
        f"{reversal_clause}{season_clause}{risk_clause} "
        f"Institutional guidance: {action.replace('_', ' ')}. {timing}"
    )


def _build_institutional_commentary(
    crop: str, state: str, cv: float, n_a: int, contradiction: bool,
    council_conf: str, consensus_s: float, tier: str,
    stability: str, m7: float, m30: float,
) -> str:
    # Trend coherence
    same_dir = (m7 > 0 and m30 > 0) or (m7 < 0 and m30 < 0)
    both_sig = abs(m7) > 2 and abs(m30) > 2
    coh_note = (
        "Short and long-term momentum are coherently aligned, reinforcing the directional signal."
        if (same_dir and both_sig) else
        "Momentum divergence between short-term (7d) and long-term (30d) trends increases signal uncertainty."
        if (both_sig and not same_dir) else
        "Price momentum is subdued — directional conviction is limited."
    )

    # Vol commentary
    vol_comment = (
        f"Market volatility (CV {cv:.0f}%) is in {'extreme' if cv > 45 else 'high' if cv > 30 else 'moderate' if cv > 15 else 'low'} territory. "
        f"{'Forecast precision is materially reduced at this volatility level.' if cv > 35 else 'Forecasting conditions are acceptable.'}"
    )

    # Anomaly commentary
    anom_comment = (
        f"{n_a} price anomal{'y' if n_a == 1 else 'ies'} detected in the 90-day window "
        f"{'— clustering suggests systemic market disturbance' if n_a >= 3 else '— minor market disruption'}."
        if n_a > 0 else
        "No price anomalies detected — price history is clean, supporting higher model reliability."
    )

    # Council commentary
    council_comment = (
        "The agent council is internally divided — contradictory signals detected across specialists. "
        "Weighted aggregation resolves to a consensus but minority views carry informational value."
        if contradiction else
        f"The agent council converged with {consensus_s:.0%} weighted agreement "
        f"({council_conf} confidence) — "
        f"{'strong institutional conviction' if council_conf == 'high' else 'moderate directional lean' if council_conf == 'medium' else 'weak directional signal'}."
    )

    return f"{coh_note} {vol_comment} {anom_comment} {council_comment}"


def _build_escalation_briefing(
    cv: float, n_a: int, contradiction: bool, stability: str,
    shock_prob: float, reversal_p: float,
) -> list[str]:
    items = []
    if stability == "crisis":
        items.append("CRISIS CONDITION — market is in extreme distress regime. All risk management protocols apply.")
    elif stability == "volatile":
        items.append(f"VOLATILITY ALERT — CV {cv:.0f}% in high-risk territory. Reduce directional exposure.")
    if n_a >= 3:
        items.append(f"ANOMALY CLUSTER — {n_a} price anomalies suggest systemic disruption, not random noise.")
    if contradiction:
        items.append("AGENT DISAGREEMENT — specialist agents are fundamentally divided. Avoid high-conviction positions.")
    if shock_prob >= 0.50:
        items.append(f"VOLATILITY SHOCK RISK — {shock_prob:.0%} probability of sudden price event in next 30 days.")
    if reversal_p >= 0.50:
        items.append(f"REVERSAL RISK — {reversal_p:.0%} probability of trend change. Do not extend positions.")
    return items


def _build_briefing_cards(
    crop: str, state: str, dominant: str, stability: str, n_a: int,
    cv: float, phase: str, vs_nm: float, contradiction: bool,
    conf_score: float, shock_prob: float, m7: float, final_rec: str,
    posture: str,
) -> list[dict]:
    cards = []

    # Card 1: Market Outlook
    dom_word = {"BULLISH": "Bullish", "BEARISH": "Bearish", "NEUTRAL": "Neutral", "HIGH_RISK": "High Risk"}.get(dominant, "Mixed")
    cards.append({
        "title":    "Market Outlook",
        "headline": f"{dom_word} Consensus",
        "body":     f"Agent council verdict for {crop} in {state}: {dom_word.lower()} bias with {conf_score:.0%} confidence.",
        "severity": "high" if dominant in ("BEARISH", "HIGH_RISK") else "low",
        "category": "outlook",
        "color":    "emerald" if dominant == "BULLISH" else "red" if dominant in ("BEARISH","HIGH_RISK") else "blue",
        "icon":     "↑" if dominant == "BULLISH" else "↓" if dominant == "BEARISH" else "⚡" if dominant == "HIGH_RISK" else "→",
    })

    # Card 2: Risk Level
    risk_lbl = "Crisis" if stability == "crisis" else "Volatile" if stability == "volatile" else "Unstable" if stability == "unstable" else "Stable"
    cards.append({
        "title":    "Risk Level",
        "headline": f"Market {risk_lbl}",
        "body":     f"Volatility CV {cv:.0f}%, {n_a} anomalies. {risk_lbl} market environment.",
        "severity": "high" if stability in ("crisis", "volatile") else "medium" if stability == "unstable" else "low",
        "category": "risk",
        "color":    "red" if stability == "crisis" else "amber" if stability in ("volatile","unstable") else "blue",
        "icon":     "⚡" if stability == "crisis" else "⚠" if stability in ("volatile","unstable") else "✓",
    })

    # Card 3: Seasonal Signal
    sea_label = "Peak Season" if phase == "peak" else "Lean Season" if phase == "trough" else "Mid Season"
    sea_color = "purple" if phase == "peak" else "amber" if phase == "trough" else "gray"
    cards.append({
        "title":    "Seasonal Signal",
        "headline": sea_label,
        "body":     f"Prices {vs_nm:+.1f}% vs annual average. {sea_label} conditions for {crop}.",
        "severity": "medium",
        "category": "seasonal",
        "color":    sea_color,
        "icon":     "🌙" if phase == "peak" else "📉" if phase == "trough" else "↔",
    })

    # Card 4: Action Signal
    action_word = final_rec.replace("_", " ").title()
    act_color   = "emerald" if final_rec in ("SELL_NOW","SELL_SOON") else "amber" if final_rec == "HOLD" else "red" if final_rec in ("HIGH_RISK_AVOIDANCE","WAIT") else "blue"
    cards.append({
        "title":    "Recommended Action",
        "headline": action_word,
        "body":     f"Institutional recommendation based on 7-agent council and {conf_score:.0%} confidence assessment.",
        "severity": "high" if final_rec in ("SELL_NOW","HIGH_RISK_AVOIDANCE") else "medium",
        "category": "action",
        "color":    act_color,
        "icon":     "✓" if final_rec in ("SELL_NOW","SELL_SOON") else "⏸" if final_rec == "HOLD" else "✗",
    })

    # Card 5: Shock Risk (only if meaningful)
    if shock_prob >= 0.25:
        shock_sev = "high" if shock_prob >= 0.50 else "medium"
        cards.append({
            "title":    "Volatility Shock Risk",
            "headline": f"{shock_prob:.0%} Shock Probability",
            "body":     f"Statistical estimate of a large price event (>2σ) in the next 30 days based on CV {cv:.0f}% and {n_a} anomalies.",
            "severity": shock_sev,
            "category": "shock",
            "color":    "red" if shock_prob >= 0.50 else "amber",
            "icon":     "⚡",
        })

    # Card 6: Contradiction alert (only if present)
    if contradiction:
        cards.append({
            "title":    "Agent Disagreement",
            "headline": "Contradictory Signals",
            "body":     "Specialist agents are divided. Weighted consensus formed, but minority views carry risk information. Reduce position size.",
            "severity": "high",
            "category": "uncertainty",
            "color":    "orange",
            "icon":     "⚠",
        })

    return cards[:6]


def synthesis_to_dict(s: ExecutiveSynthesis) -> dict:
    """Serialize ExecutiveSynthesis to a JSON-safe dict."""
    return {
        "crop":                     s.crop,
        "state":                    s.state,
        "executive_summary":        s.executive_summary,
        "strategic_outlook":        s.strategic_outlook,
        "institutional_commentary": s.institutional_commentary,
        "market_posture":           s.market_posture,
        "posture_color":            s.posture_color,
        "escalation_briefing":      s.escalation_briefing,
        "briefing_cards":           s.briefing_cards,
        "generated_at":             s.generated_at,
    }
