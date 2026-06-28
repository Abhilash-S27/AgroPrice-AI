"""
backend/services/strategy_engine.py

Strategic Recommendation Engine — Phase 5.

Generates actionable institutional recommendations by mode:
  - farmer    — practical field-level guidance
  - trader    — commercial momentum-focused strategy
  - wholesale — supply-chain and procurement strategy
  - analyst   — full statistical rigour

Recommendations include:
  - action: SELL_NOW | HOLD | WAIT | ACCUMULATE | REDUCE_EXPOSURE | ...
  - rationale bullets
  - timing_guidance
  - caution_notes
  - escalation_awareness
  - seasonal_context

CRITICAL: Fully deterministic. No Gemini calls. All text from templates.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class StrategyRecommendation:
    mode:                str          # "farmer"|"trader"|"wholesale"|"analyst"|"general"
    action:              str          # SELL_NOW | HOLD | WAIT | ACCUMULATE | ...
    action_label:        str          # display string
    urgency:             str          # "immediate"|"near_term"|"medium_term"|"monitor"
    rationale:           list[str]    # 3-5 bullet points
    timing_guidance:     str          # when to act
    caution_notes:       list[str]    # specific warnings
    escalation_awareness: list[str]   # alert flags
    seasonal_context:    str          # seasonal positioning note
    entry_guidance:      str | None   # price entry hint (if applicable)
    exit_guidance:       str | None   # price exit hint (if applicable)
    watch_triggers:      list[str]    # conditions to watch for


# ── Action config ─────────────────────────────────────────────────────────────

ACTION_CONFIG: dict[str, dict] = {
    "SELL_NOW":               {"label": "Sell Now",               "urgency": "immediate"},
    "SELL_SOON":              {"label": "Sell Soon",              "urgency": "near_term"},
    "HOLD":                   {"label": "Hold",                   "urgency": "medium_term"},
    "WAIT":                   {"label": "Wait",                   "urgency": "monitor"},
    "ACCUMULATE":             {"label": "Accumulate / Buy",       "urgency": "near_term"},
    "REDUCE_EXPOSURE":        {"label": "Reduce Exposure",        "urgency": "immediate"},
    "WAIT_FOR_STABILIZATION": {"label": "Wait for Stabilization", "urgency": "monitor"},
    "ENTER_AFTER_REVERSAL":   {"label": "Enter After Reversal",   "urgency": "monitor"},
    "HIGH_RISK_AVOIDANCE":    {"label": "Avoid — High Risk",      "urgency": "immediate"},
    "WATCH":                  {"label": "Watch",                  "urgency": "monitor"},
}


def compute_strategy(
    raw_ctx: dict,
    council_dict: dict,
    consensus_dict: dict,
    probability_dict: dict,
    mode: str = "general",
) -> StrategyRecommendation:
    """
    Generate mode-specific strategic recommendation.

    Args:
        raw_ctx:          Insight context from build_insight_context().
        council_dict:     Output from council_to_dict(run_council()).
        consensus_dict:   Output from consensus_to_dict(compute_consensus()).
        probability_dict: Output from outlook_to_dict(compute_probabilistic_outlook()).
        mode:             "farmer"|"trader"|"wholesale"|"analyst"|"general"

    Returns:
        StrategyRecommendation with full institutional guidance.
    """
    if not raw_ctx.get("has_data"):
        return _no_data_strategy(mode)

    mode = mode if mode in ("farmer", "trader", "wholesale", "analyst") else "general"

    # ── Extract signals ───────────────────────────────────────────────────────
    exec_rec   = consensus_dict.get("executive_recommendation", "WATCH")
    conf_label = consensus_dict.get("recommendation_confidence", "low")
    conf_score = float(consensus_dict.get("confidence_score", 0.3))
    stability  = consensus_dict.get("stability_label", "volatile")
    risk_adj   = consensus_dict.get("risk_adjustment", "normal")
    warning    = consensus_dict.get("instability_warning")

    dominant   = council_dict.get("dominant_view", "NEUTRAL")
    contradiction = bool(council_dict.get("contradiction_detected", False))

    up_prob    = float(probability_dict.get("upside_probability", 0.33))
    down_prob  = float(probability_dict.get("downside_probability", 0.33))
    shock_prob = float(probability_dict.get("volatility_shock_prob", 0.30))
    reversal_p = float(probability_dict.get("reversal_probability", 0.20))
    ci_pct     = float(probability_dict.get("confidence_interval_pct", 20.0))

    mom       = raw_ctx.get("momentum") or {}
    vol       = raw_ctx.get("volatility") or {}
    seas      = raw_ctx.get("seasonal") or {}
    anomalies = raw_ctx.get("anomalies") or []
    crop      = raw_ctx.get("crop", "this crop")
    state     = raw_ctx.get("state", "this market")

    m7        = float(mom.get("7d_change_pct") or 0.0)
    cv        = float(vol.get("cv") or 0.0)
    phase     = seas.get("current_phase", "normal")
    vs_norm   = float(seas.get("current_vs_norm", 0.0))
    last_p    = raw_ctx.get("last_price", 0)
    n_a       = len(anomalies)

    # ── Map to strategy action ────────────────────────────────────────────────
    action = _map_to_mode_action(exec_rec, mode, stability, conf_score, shock_prob)
    cfg    = ACTION_CONFIG.get(action, ACTION_CONFIG["WATCH"])

    # ── Build rationale ───────────────────────────────────────────────────────
    rationale = _build_rationale(
        action, mode, crop, state, up_prob, down_prob, conf_label,
        m7, cv, phase, vs_norm, contradiction
    )

    # ── Timing guidance ───────────────────────────────────────────────────────
    timing = _build_timing(action, mode, phase, reversal_p, ci_pct)

    # ── Caution notes ─────────────────────────────────────────────────────────
    cautions = _build_cautions(mode, cv, n_a, shock_prob, contradiction, stability, conf_score)

    # ── Escalation awareness ──────────────────────────────────────────────────
    escal = _build_escalations(cv, n_a, reversal_p, shock_prob, dominant)

    # ── Seasonal context ──────────────────────────────────────────────────────
    season_ctx = _build_seasonal_context(phase, vs_norm, seas)

    # ── Entry/Exit guidance ───────────────────────────────────────────────────
    entry, exit_ = _build_entry_exit(action, mode, last_p, ci_pct, up_prob, down_prob)

    # ── Watch triggers ────────────────────────────────────────────────────────
    watches = _build_watch_triggers(mode, cv, m7, phase, conf_label, contradiction)

    return StrategyRecommendation(
        mode=mode,
        action=action,
        action_label=cfg["label"],
        urgency=cfg["urgency"],
        rationale=rationale[:5],
        timing_guidance=timing,
        caution_notes=cautions[:4],
        escalation_awareness=escal[:4],
        seasonal_context=season_ctx,
        entry_guidance=entry,
        exit_guidance=exit_,
        watch_triggers=watches[:4],
    )


# ── Private helpers ────────────────────────────────────────────────────────────

def _map_to_mode_action(
    exec_rec: str, mode: str, stability: str,
    conf_score: float, shock_prob: float
) -> str:
    """Translate executive recommendation to mode-specific action."""
    # Crisis conditions override
    if stability == "crisis" and exec_rec in ("SELL_NOW", "SELL_SOON"):
        if mode == "trader":
            return "REDUCE_EXPOSURE"
        return "HIGH_RISK_AVOIDANCE"

    # Map wholesale/analyst to accumulate when exec says WAIT + stable
    if mode in ("wholesale", "analyst") and exec_rec == "WATCH" and stability == "stable":
        return "ACCUMULATE"

    # High shock risk reduces urgency for farmers
    if mode == "farmer" and shock_prob > 0.50 and exec_rec == "SELL_NOW":
        return "SELL_SOON"

    # Trader mode: convert HOLD to WATCH (traders monitor more actively)
    if mode == "trader" and exec_rec == "HOLD":
        return "WATCH"

    # Analyst mode: always adds ENTER_AFTER_REVERSAL if reversal is flagged
    if mode == "analyst" and exec_rec in ("WAIT", "HOLD") and conf_score < 0.35:
        return "WAIT_FOR_STABILIZATION"

    return exec_rec


def _build_rationale(
    action: str, mode: str, crop: str, state: str,
    up: float, dn: float, conf: str,
    m7: float, cv: float, phase: str, vs_norm: float,
    contradiction: bool,
) -> list[str]:
    bullets = []
    dir_ = "upward" if up > dn else "downward"
    opp  = up if up > dn else dn

    if mode == "farmer":
        bullets.append(
            f"Market signals show {opp:.0%} probability of {dir_} price movement — "
            f"{'favourable window for selling' if action in ('SELL_NOW','SELL_SOON') else 'wait for better conditions'}"
        )
        if phase == "peak":
            bullets.append(f"Currently in peak season ({vs_norm:+.1f}% above annual average) — use this seasonal advantage")
        elif phase == "trough":
            bullets.append(f"Currently in lean season ({abs(vs_norm):.1f}% below average) — prices likely to improve later")
        bullets.append(
            f"Weekly price momentum: {m7:+.1f}% — "
            f"{'strengthening' if m7 > 2 else 'weakening' if m7 < -2 else 'stable'}"
        )

    elif mode == "trader":
        bullets.append(
            f"Directional probability: {up:.0%} upside vs {dn:.0%} downside — "
            f"{'momentum-driven buying pressure' if up > 0.55 else 'selling pressure dominant' if dn > 0.55 else 'balanced flow'}"
        )
        bullets.append(f"7-day price velocity: {m7:+.1f}% — indicates {'acceleration' if abs(m7) > 5 else 'controlled movement'}")
        bullets.append(f"Market confidence level: {conf} — {'high conviction trade' if conf == 'high' else 'position sizing caution advised'}")
        if cv > 25:
            bullets.append(f"Volatility CV {cv:.0f}% — widen spreads and reduce position concentration")

    elif mode == "wholesale":
        bullets.append(
            f"Procurement intelligence: {opp:.0%} probability of {dir_} price movement "
            f"in the coming weeks — {'lock in supply at current rates' if action in ('ACCUMULATE',) else 'defer bulk purchases'}"
        )
        bullets.append(f"Price position vs annual benchmark: {vs_norm:+.1f}% — {'above average cost caution' if vs_norm > 10 else 'below average — favourable procurement window' if vs_norm < -10 else 'near annual average'}")
        if phase == "trough":
            bullets.append("Seasonal trough pricing — favourable for forward procurement / cold storage build")
        bullets.append(f"Supply chain risk: volatility CV {cv:.0f}% — {'plan buffer stock contingency' if cv > 30 else 'normal procurement planning'}")

    else:  # analyst / general
        bullets.append(
            f"Statistical outlook: {up:.0%} upside / {dn:.0%} downside / "
            f"{round(1-up-dn, 0):.0%} sideways probability"
        )
        bullets.append(
            f"Confidence assessment: {conf} — "
            f"{'strong evidentiary basis for recommendation' if conf == 'high' else 'moderate confidence, monitor closely' if conf == 'medium' else 'low confidence — directional guidance only'}"
        )
        bullets.append(f"Weekly price change: {m7:+.1f}% | Volatility: CV {cv:.0f}% | Season: {phase}")
        if contradiction:
            bullets.append("Agent disagreement detected — consensus formed from weighted vote, not unanimity")

    return bullets


def _build_timing(action: str, mode: str, phase: str, reversal_p: float, ci: float) -> str:
    if action == "SELL_NOW":
        return (
            "Act within 1–3 days — conditions are near-optimal. "
            "Delay risks losing the current price advantage."
        )
    if action == "SELL_SOON":
        window = "within this week" if mode == "trader" else "within 7–14 days"
        return f"Plan sale {window} while momentum holds. Monitor daily for signs of reversal."
    if action == "HOLD":
        if reversal_p >= 0.40:
            return "Hold for 5–10 days. Reversal probability is elevated — reassess when signals clarify."
        return "Hold for 2–4 weeks. Conditions may improve with seasonal progress."
    if action == "WAIT":
        return (
            "Delay market entry until volatility settles. "
            "Re-evaluate after 7–14 days or when anomalies stop accumulating."
        )
    if action in ("WAIT_FOR_STABILIZATION", "HIGH_RISK_AVOIDANCE"):
        return (
            "Do not transact until market stabilizes. "
            "Watch for 3 consecutive stable trading days before re-engaging."
        )
    if action == "ACCUMULATE":
        return "Gradual accumulation over 7–14 days is preferred — staged entry reduces exposure to intraday swings."
    if action == "ENTER_AFTER_REVERSAL":
        return "Wait for confirmed reversal signal (2–3 days of sustained opposite direction) before entering."
    if action == "REDUCE_EXPOSURE":
        return "Begin reducing exposure immediately. Staged exit over 2–3 days minimizes market impact."
    return (
        f"Monitor daily. Current ±{ci:.0f}% price range indicates significant uncertainty."
    )


def _build_cautions(
    mode: str, cv: float, n_a: int, shock_prob: float,
    contradiction: bool, stability: str, conf: float
) -> list[str]:
    notes = []
    if stability in ("crisis", "volatile"):
        notes.append(f"Market stability: '{stability}' — all actions carry elevated uncertainty")
    if shock_prob > 0.40:
        notes.append(f"Volatility shock probability {shock_prob:.0%} — sudden price events are plausible")
    if contradiction:
        notes.append("Agent disagreement detected — minority signals may prove correct; do not over-commit")
    if cv > 35:
        notes.append(f"High volatility environment (CV {cv:.0f}%) — price predictions carry wide error margins")
    if n_a >= 2:
        notes.append(f"{n_a} recent price anomalies — market currently erratic; normal signals may be distorted")
    if conf < 0.30:
        notes.append("Very low recommendation confidence — treat as directional guidance, not a firm call")
    if mode == "farmer":
        notes.append("Consider local mandi conditions and transport costs before acting on national price signals")
    return notes


def _build_escalations(cv: float, n_a: int, reversal_p: float, shock_p: float, dominant: str) -> list[str]:
    flags = []
    if cv > 45:
        flags.append(f"EXTREME_VOLATILITY — CV {cv:.0f}%: market in distress regime")
    elif cv > 30:
        flags.append(f"ELEVATED_VOLATILITY — CV {cv:.0f}%: heightened price risk")
    if n_a >= 3:
        flags.append(f"ANOMALY_CLUSTER — {n_a} anomalies: erratic price pattern")
    if reversal_p >= 0.50:
        flags.append(f"REVERSAL_WATCH — {reversal_p:.0%} probability: trend change imminent")
    if shock_p >= 0.50:
        flags.append(f"SHOCK_RISK — {shock_p:.0%} probability of sudden price event")
    if dominant == "HIGH_RISK":
        flags.append("COUNCIL_HIGH_RISK — majority of specialist agents signal risk dominance")
    return flags


def _build_seasonal_context(phase: str, vs_norm: float, seas: dict) -> str:
    peaks   = seas.get("peak_months", [])
    troughs = seas.get("trough_months", [])
    pk_pct  = seas.get("peak_pct", 0.0)

    if phase == "peak":
        return (
            f"Currently in peak season ({vs_norm:+.1f}% above annual average). "
            f"Peak months: {', '.join(peaks[:3])} — prices typically run +{pk_pct:.0f}% above baseline."
        )
    if phase == "trough":
        return (
            f"Currently in lean season ({abs(vs_norm):.0f}% below annual average). "
            f"Trough months: {', '.join(troughs[:3])}. "
            f"Seasonal recovery expected when peak months ({', '.join(peaks[:2])}) approach."
        )
    return (
        f"Mid-season positioning — neither peak nor trough. "
        f"Historical peaks: {', '.join(peaks[:3]) or 'data limited'}; "
        f"troughs: {', '.join(troughs[:3]) or 'data limited'}."
    )


def _build_entry_exit(
    action: str, mode: str, last_p: float, ci: float, up: float, dn: float
) -> tuple[str | None, str | None]:
    if not last_p:
        return None, None

    swing = last_p * (ci / 100)
    upper = last_p + swing
    lower = last_p - swing

    entry, exit_ = None, None

    if action in ("ACCUMULATE", "ENTER_AFTER_REVERSAL"):
        entry = (
            f"Entry consideration: current price ₹{last_p:,.0f}/qtl — "
            f"target entry zone ₹{lower:,.0f}–₹{last_p:,.0f}/qtl (lower bound of ±{ci:.0f}% range)"
        )
    if action in ("SELL_NOW", "SELL_SOON", "REDUCE_EXPOSURE"):
        exit_ = (
            f"Exit consideration: current ₹{last_p:,.0f}/qtl — "
            f"acceptable range ₹{last_p:,.0f}–₹{upper:,.0f}/qtl; "
            f"stop-loss if drops below ₹{lower:,.0f}/qtl"
        )

    return entry, exit_


def _build_watch_triggers(
    mode: str, cv: float, m7: float, phase: str, conf: str, contradiction: bool
) -> list[str]:
    triggers = []
    if cv > 25:
        triggers.append("Monitor if volatility CV drops below 20% — market stabilization signal")
    if abs(m7) > 5:
        dir_ = "downward" if m7 > 0 else "upward"
        triggers.append(f"Watch for momentum reversal — current {m7:+.1f}% weekly move may mean-revert")
    if phase == "trough":
        triggers.append("Watch for seasonal transition into peak months — price recovery likely")
    if contradiction:
        triggers.append("Monitor for consensus emergence — agents currently disagree; wait for alignment")
    if conf in ("low", "uncertain"):
        triggers.append("Track data freshness — confidence will improve with more recent market data")
    return triggers


def _no_data_strategy(mode: str) -> StrategyRecommendation:
    return StrategyRecommendation(
        mode=mode,
        action="WATCH",
        action_label="Watch",
        urgency="monitor",
        rationale=["Insufficient market data for grounded recommendation"],
        timing_guidance="Select a crop and state with available price history.",
        caution_notes=["Cannot generate grounded strategy without price data"],
        escalation_awareness=[],
        seasonal_context="No seasonal data available.",
        entry_guidance=None,
        exit_guidance=None,
        watch_triggers=["Await market data ingestion for this crop/state combination"],
    )


def strategy_to_dict(s: StrategyRecommendation) -> dict:
    """Serialize StrategyRecommendation to a JSON-safe dict."""
    return {
        "mode":                  s.mode,
        "action":                s.action,
        "action_label":          s.action_label,
        "urgency":               s.urgency,
        "rationale":             s.rationale,
        "timing_guidance":       s.timing_guidance,
        "caution_notes":         s.caution_notes,
        "escalation_awareness":  s.escalation_awareness,
        "seasonal_context":      s.seasonal_context,
        "entry_guidance":        s.entry_guidance,
        "exit_guidance":         s.exit_guidance,
        "watch_triggers":        s.watch_triggers,
    }
