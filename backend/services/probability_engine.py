"""
backend/services/probability_engine.py

Probabilistic Outlook Engine — Phase 5.

Converts deterministic signals into probabilistic forecasts using
heuristic statistical intelligence.

CRITICAL:
  - NO fake ML — uses only volatility, anomalies, trend coherence,
    forecast quality, and seasonal positioning
  - All probabilities are heuristic estimates from real market signals
  - Never invents probability scores

Outputs:
  - upside_probability    (0–1): chance of further price rise
  - downside_probability  (0–1): chance of price decline
  - sideways_probability  (0–1): chance of stable/flat prices
  - volatility_shock_prob (0–1): chance of a sudden price spike/crash
  - reversal_probability  (0–1): chance of trend reversal in next 30d
  - confidence_interval   (tuple): ±% range around current price in 30d
  - risk_adjusted_outlook (str): plain English outlook label

The three directional probabilities (up/down/sideways) sum to ~1.0.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProbabilisticOutlook:
    upside_probability:      float   # 0.0–1.0
    downside_probability:    float   # 0.0–1.0
    sideways_probability:    float   # 0.0–1.0
    volatility_shock_prob:   float   # 0.0–1.0 (independent dimension)
    reversal_probability:    float   # 0.0–1.0
    confidence_interval_pct: float   # ±% in 30 days (e.g. 12.5 means ±12.5%)
    risk_adjusted_outlook:   str     # label
    outlook_headline:        str     # 1-sentence summary
    probability_basis:       list[str]  # which signals drove the probabilities


def compute_probabilistic_outlook(raw_ctx: dict) -> ProbabilisticOutlook:
    """
    Compute probabilistic price outlook from deterministic analytics signals.

    Args:
        raw_ctx: Output from build_insight_context(crop, state).

    Returns:
        ProbabilisticOutlook with directional probabilities and uncertainty.
    """
    if not raw_ctx.get("has_data"):
        return ProbabilisticOutlook(
            upside_probability=0.33,
            downside_probability=0.33,
            sideways_probability=0.34,
            volatility_shock_prob=0.50,
            reversal_probability=0.50,
            confidence_interval_pct=25.0,
            risk_adjusted_outlook="uncertain",
            outlook_headline="Insufficient data — probability estimates unreliable.",
            probability_basis=["No historical price data available"],
        )

    # ── Extract signals ───────────────────────────────────────────────────────
    mom       = raw_ctx.get("momentum") or {}
    vol       = raw_ctx.get("volatility") or {}
    seas      = raw_ctx.get("seasonal") or {}
    anomalies = raw_ctx.get("anomalies") or []
    quality   = raw_ctx.get("quality") or {}
    tier      = raw_ctx.get("tier", "D")

    m7    = float(mom.get("7d_change_pct") or 0.0)
    m30   = float(mom.get("30d_change_pct") or 0.0)
    cv    = float(vol.get("cv") or 0.0)
    phase = seas.get("current_phase", "normal")
    vs_nm = float(seas.get("current_vs_norm", 0.0))
    n_a   = len(anomalies)
    q     = quality.get("score", 50)

    basis: list[str] = []

    # ── Step 1: Base directional probability from momentum ──────────────────
    # Trend-following: higher probability of continuation in the direction of momentum
    # Use a logistic-like mapping: m7 in [-20, +20] → [0.15, 0.85]
    def _mom_to_prob(m: float) -> float:
        """Convert momentum % to continuation probability."""
        return max(0.10, min(0.90, 0.50 + m * 0.025))

    trend_up_prob = _mom_to_prob(m7)
    trend_dn_prob = 1.0 - trend_up_prob

    # ── Step 2: Seasonal modifier ────────────────────────────────────────────
    # Peak season → boosts upside slightly; trough → boosts downside
    sea_up_adj = 0.0
    if phase == "peak":
        sea_up_adj = +0.06
        basis.append(f"Peak season adds +6% to upside probability")
    elif phase == "trough":
        sea_up_adj = -0.08
        basis.append(f"Trough season adds +8% to downside probability")

    # ── Step 3: Momentum coherence (m7 vs m30 agreement) ────────────────────
    same_dir = (m7 > 0 and m30 > 0) or (m7 < 0 and m30 < 0)
    both_sig = abs(m7) > 2.0 and abs(m30) > 2.0
    coherent = same_dir and both_sig

    coh_bonus = 0.0
    if coherent:
        coh_bonus = 0.05 if m7 > 0 else -0.05
        basis.append("Coherent short/long-term momentum — boosts continuation probability")
    elif both_sig and not same_dir:
        # Divergence reduces confidence in either direction
        coh_bonus = 0.0
        basis.append("Momentum divergence (m7 vs m30) — continuation less certain")

    # ── Step 4: Compose directional probs ───────────────────────────────────
    raw_up   = max(0.05, trend_up_prob + sea_up_adj + coh_bonus)
    raw_down = max(0.05, trend_dn_prob - sea_up_adj - coh_bonus)

    # Sideways: increases when volatility is low and momentum is weak
    if cv < 15 and abs(m7) < 3:
        sideways_bonus = 0.20
    elif cv < 25 and abs(m7) < 5:
        sideways_bonus = 0.10
    else:
        sideways_bonus = 0.05

    raw_side = sideways_bonus

    # Normalize to sum to 1.0
    total = raw_up + raw_down + raw_side
    up    = round(raw_up / total,   3)
    down  = round(raw_down / total, 3)
    side  = round(max(0.0, 1.0 - up - down), 3)

    basis.append(f"Momentum {m7:+.1f}% (7d) → base up/down: {up:.0%}/{down:.0%}")

    # ── Step 5: Volatility shock probability ────────────────────────────────
    # Probability of a large price event (>2σ) in next 30 days
    # Based on: CV, recent anomaly density, recent volatility acceleration
    shock_base = 0.05
    if cv > 45:
        shock_base = 0.55
    elif cv > 35:
        shock_base = 0.40
    elif cv > 25:
        shock_base = 0.28
    elif cv > 15:
        shock_base = 0.15

    # Anomaly density multiplier (recent anomalies → higher risk of more)
    anom_mult = 1.0 + (n_a * 0.20)
    shock_prob = round(min(0.90, shock_base * anom_mult), 3)

    if shock_prob > 0.30:
        basis.append(f"Volatility shock risk elevated: CV {cv:.0f}%, {n_a} anomalies")

    # ── Step 6: Reversal probability ─────────────────────────────────────────
    # Chance of trend reversing within 30 days
    # High when: momentum diverges, peak with negative trend, or high anomaly count
    reversal_base = 0.15

    # Divergent momentum → higher reversal risk
    if both_sig and not same_dir:
        reversal_base += 0.20

    # Trend vs season contradiction
    if phase == "peak" and m7 < -3:
        reversal_base += 0.15
        basis.append("Peak season + falling prices → elevated reversal probability")
    elif phase == "trough" and m7 > 3:
        reversal_base += 0.15
        basis.append("Trough season + rising prices → elevated reversal probability")

    # Extreme momentum = reversion risk (mean reversion heuristic)
    if abs(m7) > 15:
        reversal_base += 0.15
        basis.append(f"Extreme weekly move ({m7:+.0f}%) → mean-reversion risk elevated")
    elif abs(m7) > 8:
        reversal_base += 0.08

    # Anomaly clusters drive reversals
    if n_a >= 3:
        reversal_base += 0.10

    # Data quality penalizes reversal certainty
    if q < 40:
        reversal_base = max(reversal_base, 0.25)  # at least 25% uncertain

    reversal_prob = round(min(0.85, reversal_base), 3)

    # ── Step 7: Confidence interval for 30-day price range ──────────────────
    # Based on CV: a crop with CV=30% could plausibly move ±30% in a month
    # We use a fraction of annual CV as the 30-day range estimate
    ci_base = cv * 0.40  # rough 30-day range from annual CV
    ci_base += n_a * 3.0  # each anomaly adds uncertainty
    if not same_dir:
        ci_base += 5.0    # divergent momentum adds range
    if tier in ("A", "B"):
        ci_base *= 0.85   # better model = tighter interval
    confidence_interval = round(max(3.0, min(50.0, ci_base)), 1)

    # ── Step 8: Risk-adjusted outlook label ─────────────────────────────────
    if up >= 0.60:
        if shock_prob >= 0.35:
            outlook = "bullish-with-volatility"
        else:
            outlook = "bullish"
    elif down >= 0.60:
        if shock_prob >= 0.35:
            outlook = "bearish-with-volatility"
        else:
            outlook = "bearish"
    elif side >= 0.35:
        outlook = "sideways-consolidation"
    elif shock_prob >= 0.45:
        outlook = "highly-volatile"
    elif reversal_prob >= 0.45:
        outlook = "reversal-likely"
    else:
        outlook = "uncertain"

    # ── Headline ─────────────────────────────────────────────────────────────
    crop  = raw_ctx.get("crop", "This crop")
    state = raw_ctx.get("state", "the market")

    dir_word = "upward" if up > down else ("downward" if down > up else "sideways")
    headline = (
        f"{crop} in {state}: {up:.0%} probability of price continuation "
        f"({dir_word}), {shock_prob:.0%} volatility shock risk, "
        f"±{confidence_interval:.0f}% estimated 30-day price range."
    )

    return ProbabilisticOutlook(
        upside_probability=up,
        downside_probability=down,
        sideways_probability=side,
        volatility_shock_prob=shock_prob,
        reversal_probability=reversal_prob,
        confidence_interval_pct=confidence_interval,
        risk_adjusted_outlook=outlook,
        outlook_headline=headline,
        probability_basis=basis[:5],
    )


def outlook_to_dict(o: ProbabilisticOutlook) -> dict:
    """Serialize ProbabilisticOutlook to a JSON-safe dict."""
    return {
        "upside_probability":      o.upside_probability,
        "downside_probability":    o.downside_probability,
        "sideways_probability":    o.sideways_probability,
        "volatility_shock_prob":   o.volatility_shock_prob,
        "reversal_probability":    o.reversal_probability,
        "confidence_interval_pct": o.confidence_interval_pct,
        "risk_adjusted_outlook":   o.risk_adjusted_outlook,
        "outlook_headline":        o.outlook_headline,
        "probability_basis":       o.probability_basis,
    }
