"""
AI Forecast Narrator — deterministic, data-driven insight generation.

Every sentence produced here is assembled from REAL metrics computed over
the actual AGMARKNET price series: tier classification, volatility CV,
continuity, momentum, seasonal profile, anomaly events, and reliability
scoring. Nothing is hardcoded per crop; the same rules produce different
text for every crop/state/horizon because the underlying numbers differ.

Architecture:
  build_insight_context()   — one shared context dict per crop+state
                              (cached by the API layer)
  build_narrative()         — market narrative paragraphs
  build_confidence()        — confidence reasoning (score + bullets)
  build_strategy()          — farmer / trader / storage guidance
  build_trend_story()       — cross-crop storytelling line
  explain_anomalies()       — per-event anomaly interpretation
  simulate_scenario()       — what-if market simulation
  compare_crops()           — multi-crop AI comparison

This rule-based layer is the deterministic fallback in the LLM provider
chain (see forecast_ai_chat.py) — when a live LLM is configured it can
consume the same context dict as its grounding data.
"""
from __future__ import annotations

import pandas as pd

from backend.core.database import db_manager
from backend.data.analytics import (
    MONTH_NAMES,
    classify_forecast_tier,
    compute_forecast_quality,
    compute_momentum_signal,
    compute_seasonal_profile,
    compute_volatility_metrics,
    detect_price_anomalies,
)
from backend.data.loaders.duckdb_queries import query_for_forecast
from backend.utils.constants import SOUTH_INDIAN_STATES
from backend.utils.crop_registry import CROP_REGISTRY, CATEGORY_LABELS, price_cap

_TIER_NAMES = {
    "A": "Tier A (full forecast)",
    "B": "Tier B (moderate forecast)",
    "C": "Tier C (sparse trend)",
    "D": "Tier D (analytics only)",
}


# ── Shared context builder ───────────────────────────────────────────────────

def build_insight_context(crop: str, state: str, days: int = 30) -> dict:
    """
    Compute the full metric context for one crop+state series.
    All downstream generators consume this dict — one query pass, many insights.
    """
    df = query_for_forecast(crop, state)
    if df.empty or len(df) < 14:
        return {"crop": crop, "state": state, "days": days, "has_data": False}

    df = df.sort_values("ds").reset_index(drop=True)

    latest_row = db_manager.execute(
        'SELECT MAX(TRY_CAST("Arrival_Date" AS DATE)) FROM prices'
    ).fetchone()
    dataset_end = pd.Timestamp(latest_row[0])
    recent_days = int((df["ds"] >= dataset_end - pd.Timedelta(days=365)).sum())

    vol  = compute_volatility_metrics(df, crop, state)
    mom  = compute_momentum_signal(df, crop, state)
    seas = compute_seasonal_profile(df, crop, state)
    qual = compute_forecast_quality(crop, state, len(df), vol["cv"])
    tier = classify_forecast_tier(crop, state, len(df), recent_days, vol["cv"])
    anomalies = detect_price_anomalies(df, crop, state, lookback_days=90)

    last_price    = float(df["y"].iloc[-1])
    df_30         = df["y"].tail(30)
    avg_30d       = float(df_30.mean())
    price_min_30d = round(float(df_30.min()))
    price_max_30d = round(float(df_30.max()))
    avg_365d      = float(df["y"].tail(365).mean())
    info = CROP_REGISTRY.get(crop)

    # months covered by the forecast horizon (for seasonal positioning)
    last_date = df["ds"].max()
    horizon_months = sorted({
        (last_date + pd.Timedelta(days=d)).month for d in range(1, days + 1)
    })

    return {
        "crop": crop, "state": state, "days": days, "has_data": True,
        "category": info.category if info else "vegetable",
        "category_label": CATEGORY_LABELS.get(info.category, "Crops") if info else "Crops",
        "tier": tier, "volatility": vol, "momentum": mom,
        "seasonal": None if seas.get("error") else seas,
        "quality": qual, "anomalies": anomalies,
        "last_price": round(last_price), "avg_30d": round(avg_30d),
        "price_min_30d": price_min_30d, "price_max_30d": price_max_30d,
        "price_series_30d": [round(float(p)) for p in df_30.tolist()],
        "avg_365d": round(avg_365d),
        "price_vs_year": round((avg_30d - avg_365d) / avg_365d * 100, 1) if avg_365d > 0 else 0.0,
        "horizon_months": [MONTH_NAMES[m] for m in horizon_months],
        "last_date": str(last_date.date()),
        "staleness_days": int((dataset_end - last_date).days),
    }


# ── State availability map (Phase 2.5: Mode-D regional intelligence) ────────

def state_availability(crop: str) -> list[dict]:
    """
    Per-state data profile for one crop — which states can actually support
    forecasting. One aggregate SQL pass over the prices view.
    Returns records sorted by forecast strength (recent days desc).
    """
    cap = price_cap(crop)
    states = ", ".join(f"'{s}'" for s in SOUTH_INDIAN_STATES)
    rows = db_manager.execute(
        f"""
        WITH daily AS (
            SELECT "State" AS st,
                   TRY_CAST("Arrival_Date" AS DATE) AS d,
                   AVG("Modal_Price") AS y
            FROM prices
            WHERE LOWER("Commodity") = LOWER(?)
              AND "State" IN ({states})
              AND "Modal_Price" BETWEEN 1 AND {cap}
              AND TRY_CAST("Arrival_Date" AS DATE) IS NOT NULL
            GROUP BY 1, 2
        ),
        latest AS (SELECT MAX(d) AS mx FROM daily)
        SELECT st,
               COUNT(*)                                                        AS days,
               COUNT(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 365 DAY
                          THEN 1 END)                                          AS recent,
               ROUND(STDDEV(y) / NULLIF(AVG(y), 0) * 100, 1)                   AS cv,
               ROUND(AVG(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 30 DAY
                              THEN y END), 0)                                  AS avg_30d
        FROM daily
        GROUP BY st
        ORDER BY recent DESC, days DESC
        """,
        [crop],
    ).fetchall()

    out = []
    for st, days_n, recent, cv, avg30 in rows:
        tier = classify_forecast_tier(crop, st, int(days_n), int(recent), float(cv or 0))
        out.append({
            "state": st, "training_days": int(days_n), "recent_days_365": int(recent),
            "continuity_score": tier["continuity_score"], "cv": float(cv or 0),
            "avg_30d": float(avg30) if avg30 is not None else None,
            "tier": tier["tier"], "forecast_capable": tier["tier"] in ("A", "B", "C"),
        })
    return out


def category_state_profile(category: str, state: str) -> list[dict]:
    """
    Same-category crops that DO have usable data in the given state —
    'similar crop alternatives' for Mode-D intelligence. One SQL pass.
    """
    crops = [c for c, info in CROP_REGISTRY.items() if info.category == category]
    if not crops:
        return []
    placeholders = ", ".join("?" * len(crops))
    cap = max(price_cap(c) for c in crops)
    rows = db_manager.execute(
        f"""
        WITH daily AS (
            SELECT "Commodity" AS crop,
                   TRY_CAST("Arrival_Date" AS DATE) AS d,
                   AVG("Modal_Price") AS y
            FROM prices
            WHERE "Commodity" IN ({placeholders})
              AND "State" = ?
              AND "Modal_Price" BETWEEN 1 AND {cap}
              AND TRY_CAST("Arrival_Date" AS DATE) IS NOT NULL
            GROUP BY 1, 2
        ),
        latest AS (SELECT MAX(TRY_CAST("Arrival_Date" AS DATE)) AS mx FROM prices)
        SELECT crop, COUNT(*),
               COUNT(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 365 DAY THEN 1 END),
               ROUND(STDDEV(y) / NULLIF(AVG(y), 0) * 100, 1)
        FROM daily GROUP BY crop ORDER BY 3 DESC
        """,
        [*crops, state],
    ).fetchall()

    out = []
    for name, days_n, recent, cv in rows:
        tier = classify_forecast_tier(name, state, int(days_n), int(recent), float(cv or 0))
        if tier["tier"] in ("A", "B"):
            out.append({"crop": name, "tier": tier["tier"],
                        "continuity_score": tier["continuity_score"],
                        "cv": float(cv or 0)})
    return out[:4]


def build_regional_intelligence(crop: str, state: str, ctx: dict,
                                availability: list[dict]) -> dict:
    """
    Mode-D intelligence: explains WHY forecasting is disabled for this
    crop+state pair and what the regional picture looks like — all from
    real per-state metrics. Returns narrative + observations + smart actions.
    """
    here = next((a for a in availability if a["state"] == state), None)
    valid = [a for a in availability if a["forecast_capable"] and a["state"] != state]
    info = CROP_REGISTRY.get(crop)

    # why disabled
    if here is None or here["training_days"] == 0:
        why = (f"{crop} has no usable price reporting in {state} — "
               "the dataset contains no valid mandi records for this pair.")
    elif here["recent_days_365"] <= 30:
        why = (f"{crop} lacks reporting continuity in {state}: only "
               f"{here['recent_days_365']} reporting day"
               f"{'s' if here['recent_days_365'] != 1 else ''} in the last year "
               f"({here['training_days']:,} total). Reliable model training "
               "needs sustained recent price discovery.")
    else:
        why = (f"{crop} in {state} has {here['training_days']:,} historical days but "
               f"only {here['continuity_score']}% recent continuity — below the "
               "threshold for trustworthy forecasting.")

    observations: list[str] = []
    if valid:
        names = " and ".join(v["state"] for v in valid[:2])
        observations.append(
            f"{names} remain the dominant {crop} market"
            f"{'s' if len(valid) > 1 else ''} "
            f"({valid[0]['state']}: {valid[0]['training_days']:,} days, "
            f"{valid[0]['continuity_score']}% continuity)."
        )
        steadiest = min(valid, key=lambda v: v["cv"] or 999)
        observations.append(
            f"{steadiest['state']} currently shows the lowest volatility "
            f"({steadiest['cv']:.0f}% CV) for {crop}."
        )
        priced = [v for v in valid if v["avg_30d"]]
        if priced:
            top = max(priced, key=lambda v: v["avg_30d"])
            observations.append(
                f"Recent 30-day pricing in {top['state']} averages "
                f"₹{top['avg_30d']:,.0f}/qtl."
            )
    if info and info.category == "cash":
        observations.append(
            "As an export-linked cash crop, prices stay sensitive to global "
            "demand beyond local mandi supply."
        )
    if ctx.get("has_data") and ctx.get("seasonal"):
        seas = ctx["seasonal"]
        observations.append(
            f"Seasonally, {crop} has historically peaked around "
            f"{'/'.join(seas['peak_months'])} ({seas['peak_pct']:+.0f}% vs annual mean)."
        )

    # smart fallback actions for the UI
    actions: list[dict] = []
    for v in valid[:2]:
        actions.append({"type": "switch_state", "state": v["state"],
                        "label": f"View {v['state']} forecast"})
    if len(valid) >= 2:
        actions.append({
            "type": "ask_compare",
            "prompt": f"Compare {crop} in {valid[0]['state']} vs {valid[1]['state']}",
            "label": f"Compare {valid[0]['state']} vs {valid[1]['state']}",
        })

    # AI analyst summary — one professional paragraph from the same facts
    summary_bits: list[str] = []
    if here is None or here["training_days"] == 0:
        summary_bits.append(
            f"{crop} pricing in {state} has no usable mandi reporting, "
            "so local price discovery cannot support forecasting."
        )
    else:
        summary_bits.append(
            f"{crop} pricing in {state} currently lacks sufficient reporting "
            f"continuity ({here['continuity_score']}% of the last year) for "
            "reliable forecasting."
        )
    if valid:
        best = valid[0]
        steadiest = min(valid, key=lambda v: v["cv"] or 999)
        clause = (f"{best['state']} remains the dominant benchmark market with "
                  f"{best['continuity_score']}% price-discovery continuity")
        if steadiest["state"] != best["state"]:
            clause += f", while {steadiest['state']} shows the steadier pricing ({steadiest['cv']:.0f}% CV)"
        else:
            clause += f" and comparatively steady pricing ({best['cv']:.0f}% CV)"
        summary_bits.append(clause + ".")
    if info and info.category == "cash":
        summary_bits.append(
            "Behaviour in this commodity class is export-linked, so demand "
            "sensitivity extends beyond local supply patterns."
        )
    elif here and here["cv"] and here["cv"] >= 45:
        summary_bits.append(
            f"The thin local series also shows unstable discovery patterns "
            f"({here['cv']:.0f}% CV), reinforcing the analytics-only classification."
        )

    # similar crops in the SAME category that do forecast well in this state
    alternatives = [
        a for a in category_state_profile(info.category if info else "vegetable", state)
        if a["crop"] != crop
    ]

    return {
        "why_disabled": why,
        "ai_summary": " ".join(summary_bits),
        "observations": observations,
        "actions": actions,
        "availability": availability,
        "alternatives": alternatives,
        "footer": (f"Forecast generation is disabled for {crop} in {state} due to "
                   "insufficient training continuity."),
    }


# ── Phase 3: smart insight cards ─────────────────────────────────────────────

def build_insight_cards(ctx: dict) -> list[dict]:
    """
    Compact AI insight cards derived purely from real metrics.
    Each card: {key, title, icon, tone, explanation, confidence}.
    tone: positive | caution | risk | info — drives card colouring.
    confidence: how strongly the data supports the card (0–100).
    """
    if not ctx.get("has_data"):
        return []

    cards: list[dict] = []
    cv = ctx["volatility"]["cv"]
    tier = ctx["tier"]
    mom = ctx["momentum"]["score"]
    seas = ctx["seasonal"]
    crop = ctx["crop"]

    if cv >= 55:
        cards.append({
            "key": "high_volatility", "title": "High Volatility Detected", "icon": "⚡",
            "tone": "risk",
            "explanation": f"Daily prices vary {cv:.0f}% around their mean — bulk positions face large adverse-swing risk.",
            "confidence": min(95, 60 + int(cv / 3)),
        })
    elif cv <= 25:
        cards.append({
            "key": "stable_trend", "title": "Stable Long-Term Trend", "icon": "🛡️",
            "tone": "positive",
            "explanation": f"At {cv:.0f}% CV this is one of the steadiest series tracked — pricing is consistent across seasons.",
            "confidence": min(95, 100 - int(cv * 1.5)),
        })

    if ctx["category"] == "cash":
        cards.append({
            "key": "export_sensitive", "title": "Export-Sensitive Commodity", "icon": "🚢",
            "tone": "info",
            "explanation": f"{crop} is an export-linked cash crop — global demand moves prices beyond local mandi supply.",
            "confidence": 80,
        })

    if tier["continuity_score"] < 40:
        cards.append({
            "key": "sparse_region", "title": "Sparse Reporting Region", "icon": "📡",
            "tone": "caution",
            "explanation": f"Only {tier['recent_days_365']} reporting days in the last year ({tier['continuity_score']}% continuity) — price discovery is thin here.",
            "confidence": 90,
        })
    elif tier["continuity_score"] >= 85:
        cards.append({
            "key": "strong_reporting", "title": "Strong Market Coverage", "icon": "📶",
            "tone": "positive",
            "explanation": f"{tier['continuity_score']}% reporting continuity over the last year keeps the model anchored to live market levels.",
            "confidence": 92,
        })

    if seas:
        if seas["current_phase"] == "trough" and mom > 3:
            cards.append({
                "key": "seasonal_recovery", "title": "Seasonal Recovery Underway", "icon": "🌱",
                "tone": "positive",
                "explanation": f"Prices are {abs(seas['current_vs_norm']):.0f}% below annual norm but momentum has turned +{mom:.1f}%/7d — the classic trough-exit pattern.",
                "confidence": 75,
            })
        spread = seas["peak_pct"] - seas["trough_pct"]
        if spread >= 40:
            cards.append({
                "key": "strong_seasonality", "title": "Pronounced Seasonal Cycle", "icon": "🔄",
                "tone": "info",
                "explanation": f"Prices swing {spread:.0f}% between {'/'.join(seas['peak_months'])} peaks and {'/'.join(seas['trough_months'])} troughs — timing matters more than usual.",
                "confidence": 85,
            })

    if ctx["price_vs_year"] >= 15:
        cards.append({
            "key": "compression_risk", "title": "Price Compression Risk", "icon": "📉",
            "tone": "caution",
            "explanation": f"Current prices run {ctx['price_vs_year']:+.1f}% above the 12-month mean — stretched levels raise mean-reversion risk for buyers.",
            "confidence": 70,
        })

    if mom >= 10:
        cards.append({
            "key": "strong_momentum", "title": "Strong Upward Momentum", "icon": "🚀",
            "tone": "caution",
            "explanation": f"7-day prices run {mom:+.1f}% above the prior-month baseline — fast moves often partially retrace.",
            "confidence": 78,
        })

    high_anoms = [a for a in ctx["anomalies"] if a["severity"] in ("high", "medium")]
    if high_anoms:
        a = high_anoms[0]
        cards.append({
            "key": "recent_shock", "title": "Recent Price Shock", "icon": "💥",
            "tone": "risk",
            "explanation": f"A {a['pct_deviation']:+.1f}% {a['event_type']} on {a['date']} shows this market can gap suddenly.",
            "confidence": 88,
        })

    return cards[:4]


# ── Phase 3: explainability drivers ─────────────────────────────────────────

def build_drivers(ctx: dict) -> list[dict]:
    """
    'Why this insight?' chips — the key data signals behind the AI's
    conclusions. Each: {label, tone(up|down|neutral), detail}.
    """
    if not ctx.get("has_data"):
        return []
    tier, vol, seas = ctx["tier"], ctx["volatility"], ctx["seasonal"]
    drivers: list[dict] = []

    cont = tier["continuity_score"]
    drivers.append({
        "label": f"{cont}% reporting continuity",
        "tone": "up" if cont >= 70 else "down" if cont < 40 else "neutral",
        "detail": f"{tier['recent_days_365']} of the last 365 days had price reporting in {ctx['state']}.",
    })
    drivers.append({
        "label": f"{vol['cv']:.0f}% volatility",
        "tone": "up" if vol["cv"] < 30 else "down" if vol["cv"] >= 55 else "neutral",
        "detail": f"Coefficient of variation of daily prices — classified '{vol['badge']}'.",
    })
    drivers.append({
        "label": f"{tier['training_days']:,} training days",
        "tone": "up" if tier["training_days"] >= 2000 else "neutral",
        "detail": "Depth of usable price history behind the model.",
    })
    if seas:
        spread = seas["peak_pct"] - seas["trough_pct"]
        drivers.append({
            "label": "consistent seasonality" if spread >= 25 else "weak seasonality",
            "tone": "up" if spread >= 25 else "neutral",
            "detail": f"Peak-to-trough seasonal spread of {spread:.0f}% across the year.",
        })
    if ctx["anomalies"]:
        drivers.append({
            "label": f"{len(ctx['anomalies'])} recent anomaly event{'s' if len(ctx['anomalies']) != 1 else ''}",
            "tone": "down",
            "detail": "Statistical spikes/crashes in the last 90 days add shock noise.",
        })
    if ctx["category"] == "cash":
        drivers.append({
            "label": "export-demand sensitivity",
            "tone": "neutral",
            "detail": "Cash crops respond to global demand beyond local supply.",
        })
    return drivers


# ── Task 1: market narrative ─────────────────────────────────────────────────

def build_narrative(ctx: dict) -> str:
    if not ctx.get("has_data"):
        return (f"{ctx['crop']} has insufficient reporting in {ctx['state']} "
                "to construct a market narrative.")

    crop, state, days = ctx["crop"], ctx["state"], ctx["days"]
    vol, mom, seas = ctx["volatility"], ctx["momentum"], ctx["seasonal"]
    tier = ctx["tier"]
    parts: list[str] = []

    # 1 — momentum + seasonal positioning
    score = mom["score"]
    if seas:
        phase, vs_norm = seas["current_phase"], seas["current_vs_norm"]
        if phase == "trough" and score > 3:
            parts.append(
                f"{crop} prices in {state} are entering a recovery phase after a "
                f"seasonal trough ({vs_norm}% below annual average), with 7-day "
                f"momentum running {score:+.1f}% against the prior month."
            )
        elif phase == "trough":
            parts.append(
                f"{crop} in {state} is moving through its seasonal trough "
                f"({vs_norm}% below annual average); momentum is "
                f"{'still soft at ' + format(score, '+.1f') + '%' if score < -3 else 'flattening out'}, "
                "which historically precedes a price floor."
            )
        elif phase == "peak" and score < -3:
            parts.append(
                f"{crop} in {state} appears to be rolling over from its seasonal peak "
                f"({vs_norm:+.1f}% above annual average) — 7-day momentum has turned "
                f"negative at {score:+.1f}%."
            )
        elif phase == "peak":
            parts.append(
                f"{crop} in {state} is trading in its seasonal peak window "
                f"({vs_norm:+.1f}% above annual average) with momentum at {score:+.1f}%."
            )
        else:
            direction = ("upward" if score > 3 else
                         "downward" if score < -3 else "sideways")
            parts.append(
                f"{crop} in {state} is in a normal seasonal phase with {direction} "
                f"short-term momentum ({score:+.1f}% over 7 days vs the prior month)."
            )
        # seasonal months inside the horizon
        peaks_in_horizon = [m for m in seas["peak_months"] if m in ctx["horizon_months"]]
        troughs_in_horizon = [m for m in seas["trough_months"] if m in ctx["horizon_months"]]
        if peaks_in_horizon:
            parts.append(
                f"Historically, {'/'.join(peaks_in_horizon)} falls inside the {days}-day "
                f"horizon and averages {seas['peak_pct']:+.1f}% above the annual mean — "
                "a supply-contraction window that supports firmer prices."
            )
        elif troughs_in_horizon:
            parts.append(
                f"The {days}-day horizon crosses {'/'.join(troughs_in_horizon)}, "
                f"historically a trough period ({seas['trough_pct']:.1f}% vs annual mean) "
                "when fresh arrivals typically pressure prices."
            )
    else:
        parts.append(
            f"{crop} in {state} shows {mom['signal'].lower()} behaviour with 7-day "
            f"momentum at {score:+.1f}%."
        )

    # 2 — volatility meaning
    cv = vol["cv"]
    if cv >= 60:
        parts.append(
            f"Volatility remains elevated at {cv:.0f}% CV, increasing uncertainty for "
            "bulk traders and widening realistic price outcomes."
        )
    elif cv >= 35:
        parts.append(
            f"Volatility is moderate ({cv:.0f}% CV) — price swings are meaningful but "
            "within the range typical for this commodity class."
        )
    else:
        parts.append(
            f"At {cv:.0f}% CV this is one of the steadier series in its class, "
            "which keeps forecast bands comparatively tight."
        )

    # 3 — anomalies
    if ctx["anomalies"]:
        a = ctx["anomalies"][0]
        parts.append(
            f"The last 90 days include {len(ctx['anomalies'])} statistical price "
            f"{'event' if len(ctx['anomalies']) == 1 else 'events'}; the sharpest was a "
            f"{a['event_type']} of {a['pct_deviation']:+.1f}% vs the rolling mean on {a['date']}, "
            "so the model's recent baseline carries shock residue."
        )

    # 4 — tier / data context
    parts.append(
        f"The series is classified {_TIER_NAMES[tier['tier']]} on "
        f"{tier['training_days']:,} training days with {tier['continuity_score']}% "
        f"reporting continuity over the last year."
    )

    # 5 — price level context
    pv = ctx["price_vs_year"]
    if abs(pv) >= 10:
        parts.append(
            f"Current 30-day average (₹{ctx['avg_30d']:,}/qtl) sits {pv:+.1f}% against the "
            f"12-month mean — {'a stretched level that increases mean-reversion risk' if pv > 0 else 'a discounted level that limits further downside'}."
        )

    return " ".join(parts)


# ── Phase 3: true weighted confidence scoring ───────────────────────────────

def compute_confidence_score(ctx: dict) -> dict:
    """
    Mathematically derived confidence (0–100) with an exposed breakdown.

    Factor weights (sum = 100):
      training depth        25   min(25, days/4000·25)
      recent continuity     30   continuity%·0.30
      volatility stability  20   20 − cv/5 (floored at 0)
      anomaly cleanliness   10   −3 per significant event in 90d
      seasonal consistency  10   repeatable cycles are predictable
      data recency           5   staleness of the last record
    """
    if not ctx.get("has_data"):
        return {"score": 0, "breakdown": []}

    tier, vol, seas = ctx["tier"], ctx["volatility"], ctx["seasonal"]
    breakdown: list[dict] = []

    earned = min(25.0, tier["training_days"] / 4000 * 25)
    breakdown.append({"factor": "Training depth", "weight": 25, "earned": round(earned, 1),
                      "detail": f"{tier['training_days']:,} historical days (caps at ~11 years)"})

    cont = tier["continuity_score"]
    earned_c = cont * 0.30
    breakdown.append({"factor": "Recent continuity", "weight": 30, "earned": round(earned_c, 1),
                      "detail": f"{tier['recent_days_365']} reporting days in the last 365 ({cont}%)"})

    earned_v = max(0.0, 20.0 - vol["cv"] / 5)
    breakdown.append({"factor": "Volatility stability", "weight": 20, "earned": round(earned_v, 1),
                      "detail": f"{vol['cv']:.0f}% CV — lower variation earns more"})

    sig = [a for a in ctx["anomalies"] if a["severity"] in ("high", "medium")]
    earned_a = max(0.0, 10.0 - 3.0 * len(sig))
    breakdown.append({"factor": "Anomaly cleanliness", "weight": 10, "earned": round(earned_a, 1),
                      "detail": f"{len(sig)} significant event{'s' if len(sig) != 1 else ''} in the last 90 days"})

    if seas:
        spread = seas["peak_pct"] - seas["trough_pct"]
        earned_s = 10.0 if spread >= 25 else 6.0 if spread >= 10 else 3.0
        det = f"peak-to-trough spread {spread:.0f}% — repeatable cycles aid prediction"
    else:
        earned_s, det = 3.0, "no clear seasonal decomposition available"
    breakdown.append({"factor": "Seasonal consistency", "weight": 10, "earned": earned_s,
                      "detail": det})

    stale = ctx.get("staleness_days", 0)
    earned_r = 5.0 if stale <= 7 else 3.0 if stale <= 30 else 1.0 if stale <= 90 else 0.0
    breakdown.append({"factor": "Data recency", "weight": 5, "earned": earned_r,
                      "detail": f"last record {stale} day{'s' if stale != 1 else ''} before dataset end"})

    score = round(sum(b["earned"] for b in breakdown))
    return {"score": score, "breakdown": breakdown}


# ── Task 2: confidence explanation ───────────────────────────────────────────

def build_confidence(ctx: dict) -> dict:
    if not ctx.get("has_data"):
        return {"level": "none", "score": 0, "summary": "No data available.",
                "reasons": [], "breakdown": []}

    tier, vol = ctx["tier"], ctx["volatility"]
    seas, anomalies = ctx["seasonal"], ctx["anomalies"]

    reasons: list[dict] = []   # {direction: up|down, text}

    if tier["training_days"] >= 3000:
        reasons.append({"direction": "up", "text":
            f"Deep historical record — {tier['training_days']:,} training days (~{tier['training_days']//365} years) anchor the seasonal model."})
    elif tier["training_days"] >= 1000:
        reasons.append({"direction": "up", "text":
            f"Solid history of {tier['training_days']:,} training days supports stable model fitting."})
    else:
        reasons.append({"direction": "down", "text":
            f"Limited history ({tier['training_days']:,} days) constrains how well seasonality can be learned."})

    cont = tier["continuity_score"]
    if cont >= 80:
        reasons.append({"direction": "up", "text":
            f"Strong reporting continuity ({cont}% of the last year) keeps the model anchored to current market levels."})
    elif cont >= 50:
        reasons.append({"direction": "down", "text":
            f"Reporting gaps in the last year ({cont}% continuity) widen real-world uncertainty beyond the statistical band."})
    else:
        reasons.append({"direction": "down", "text":
            f"Sparse recent reporting ({tier['recent_days_365']} days in the last year) is the dominant risk — the forecast anchors on aging prices."})

    cv = vol["cv"]
    if cv < 30:
        reasons.append({"direction": "up", "text":
            f"Low volatility ({cv:.0f}% CV) — price behaviour is consistent, so intervals stay tight."})
    elif cv < 55:
        reasons.append({"direction": "down", "text":
            f"Moderate volatility ({cv:.0f}% CV) widens the forecast interval proportionally."})
    else:
        reasons.append({"direction": "down", "text":
            f"High volatility ({cv:.0f}% CV) is the largest driver of forecast uncertainty for this crop."})

    if anomalies:
        high = [a for a in anomalies if a["severity"] in ("high", "medium")]
        if high:
            reasons.append({"direction": "down", "text":
                f"{len(high)} significant anomaly {'event' if len(high)==1 else 'events'} in the last 90 days inject shock noise into the recent baseline."})
    else:
        reasons.append({"direction": "up", "text":
            "No statistical anomalies in the last 90 days — the recent baseline is clean."})

    if seas:
        spread = seas["peak_pct"] - seas["trough_pct"]
        if spread >= 25:
            reasons.append({"direction": "up", "text":
                f"Pronounced, repeatable seasonality (peak-to-trough spread {spread:.0f}%) gives the model a strong predictable signal."})

    conf = compute_confidence_score(ctx)
    score = conf["score"]
    level = ("high" if score >= 70 else "medium" if score >= 50 else "low")
    reliability = ("Excellent" if score >= 80 else "Good" if score >= 65 else
                   "Moderate" if score >= 45 else "Low Confidence")
    up = sum(1 for r in reasons if r["direction"] == "up")
    down = len(reasons) - up
    summary = (
        f"Weighted confidence scores {score}/100 ({reliability}): "
        f"{up} factor{'s' if up != 1 else ''} supporting confidence, "
        f"{down} factor{'s' if down != 1 else ''} working against it."
    )
    return {"level": level, "score": score, "reliability": reliability,
            "summary": summary, "reasons": reasons,
            "breakdown": conf["breakdown"]}


# ── Task 3: market strategy ──────────────────────────────────────────────────

def build_strategy(ctx: dict) -> dict:
    if not ctx.get("has_data"):
        return {"farmer": [], "trader": [], "storage": [], "risks": []}

    crop = ctx["crop"]
    vol, mom, seas, tier = ctx["volatility"], ctx["momentum"], ctx["seasonal"], ctx["tier"]
    cv, score = vol["cv"], mom["score"]
    farmer, trader, storage, risks = [], [], [], []

    # selling-window guidance from seasonality
    if seas:
        phase = seas["current_phase"]
        peaks = "/".join(seas["peak_months"])
        troughs = "/".join(seas["trough_months"])
        if phase == "peak":
            farmer.append(f"Prices are in the historical peak window — staggered selling now captures the seasonal premium ({seas['peak_pct']:+.0f}% vs annual mean).")
            trader.append("Peak-phase entries carry mean-reversion risk; prefer quick-turn positions over accumulation.")
        elif phase == "trough":
            farmer.append(f"Current trough pricing ({seas['current_vs_norm']}% vs annual mean) argues against distress selling; the historical peak window is {peaks}.")
            trader.append(f"Trough phases have historically been the better accumulation window ahead of {peaks}.")
        else:
            farmer.append(f"Pricing is mid-cycle; the strongest historical selling months are {peaks}, the weakest {troughs}.")
            trader.append(f"Position sizing should respect the seasonal map: strength into {peaks}, pressure around {troughs}.")

    # momentum overlay
    if score > 10:
        trader.append(f"Strong positive momentum ({score:+.1f}%/7d) — trend-following entries are supported but use staged exits.")
    elif score < -10:
        farmer.append(f"Momentum is sharply negative ({score:+.1f}%/7d); if storage is viable, avoid panic selling into the decline.")
        trader.append(f"Falling-knife conditions ({score:+.1f}%/7d) — wait for momentum to flatten before procurement.")

    # storage guidance from volatility + category
    perishable = ctx["category"] in ("vegetable", "fruit", "core")
    if cv >= 55:
        storage.append(f"Avoid long-term storage — at {cv:.0f}% CV, holding exposes inventory to large adverse swings.")
    elif cv >= 35:
        storage.append(f"Moderate volatility ({cv:.0f}% CV) supports only short-cycle storage with predefined exit price levels.")
    else:
        storage.append(f"Stable pricing ({cv:.0f}% CV) supports inventory holding{' within shelf-life limits' if perishable else ' for positional plays'}.")
    if perishable:
        storage.append("As a perishable commodity, storage decisions must weigh spoilage cost against expected price gain.")

    # risk warnings
    if ctx["anomalies"]:
        a = ctx["anomalies"][0]
        risks.append(f"Recent {a['event_type']} of {a['pct_deviation']:+.1f}% ({a['date']}) shows this market can gap suddenly — keep position sizes conservative.")
    if tier["continuity_score"] < 60:
        risks.append(f"Reporting continuity is only {tier['continuity_score']}% — real market prices may have drifted from the model's anchor.")
    if cv >= 55:
        risks.append(f"Bulk procurement at {cv:.0f}% CV requires hedging through staggered purchase lots.")
    if ctx["price_vs_year"] >= 15:
        risks.append(f"Current prices run {ctx['price_vs_year']:+.1f}% above the 12-month mean — elevated mean-reversion risk for buyers.")
    if not risks:
        risks.append("No elevated risk flags — standard market discipline applies.")

    return {"farmer": farmer, "trader": trader, "storage": storage, "risks": risks}


# ── Task 7: trend storytelling ───────────────────────────────────────────────

def build_trend_story(ctx: dict, peers: list[dict] | None = None) -> str:
    """One-line market character statement, optionally ranked against category peers."""
    if not ctx.get("has_data"):
        return f"{ctx['crop']} lacks sufficient data for trend characterization."

    crop, cv = ctx["crop"], ctx["volatility"]["cv"]
    tier = ctx["tier"]["tier"]
    cat_label = ctx["category_label"]

    rank_clause = ""
    if peers:
        same_cat = [p for p in peers if p.get("category") == ctx["category"] and p.get("volatility_cv") is not None]
        if len(same_cat) >= 2:
            ranked = sorted(same_cat, key=lambda p: p["volatility_cv"])
            pos = next((i for i, p in enumerate(ranked) if p["crop"] == crop), None)
            if pos is not None:
                if pos == 0:
                    rank_clause = f" — the most stable series among {cat_label.lower()}"
                elif pos == len(ranked) - 1:
                    rank_clause = f" — the most reactive series among {cat_label.lower()}"

    if tier == "C":
        return (f"{crop} displays sparse but premium-value trend behaviour: thin reporting "
                f"({ctx['tier']['recent_days_365']} days/year) at price levels around "
                f"₹{ctx['avg_30d']:,}/qtl{rank_clause}.")
    if cv < 25:
        return f"{crop} continues to demonstrate one of the steadiest pricing cycles in its class ({cv:.0f}% CV){rank_clause}."
    if cv >= 55:
        return f"{crop} remains highly reactive to supply disruptions, swinging at {cv:.0f}% CV{rank_clause}."
    return f"{crop} trades with balanced {cv:.0f}%-CV behaviour, between defensive staples and high-beta perishables{rank_clause}."


# ── Task 8: anomaly explanation ──────────────────────────────────────────────

def explain_anomalies(ctx: dict) -> list[dict]:
    if not ctx.get("has_data") or not ctx["anomalies"]:
        return []

    seas = ctx["seasonal"]
    out = []
    for a in ctx["anomalies"]:
        month = MONTH_NAMES[int(a["date"][5:7])]
        is_spike = a["event_type"] == "spike"

        if seas and month in seas.get("peak_months", []) and is_spike:
            cause = (f"{month} is a historical peak month for {ctx['crop']}, so seasonal "
                     "supply contraction is the most plausible driver, amplified by short-term scarcity.")
        elif seas and month in seas.get("trough_months", []) and not is_spike:
            cause = (f"{month} falls in the historical trough window — heavy arrivals "
                     "typically pressure prices, and this event extends that pattern.")
        elif is_spike:
            cause = ("The spike falls outside normal seasonal patterns — consistent with a "
                     "supply shock (weather damage, transport disruption, or sudden demand).")
        else:
            cause = ("The crash falls outside normal seasonal patterns — consistent with a "
                     "supply glut, distress selling, or demand collapse.")

        significance = {
            "high":   "a >3.5σ event — statistically rare and market-moving",
            "medium": "a >2.5σ event — well outside normal day-to-day variation",
            "low":    "a >2σ event — notable but within stretch range",
        }[a["severity"]]

        implication = (
            f"Post-{'spike' if is_spike else 'crash'} sessions typically see partial mean reversion; "
            f"the rolling baseline near ₹{a['roll_mean']:,.0f}/qtl is the gravity level to watch."
        )

        out.append({
            "date": a["date"], "event_type": a["event_type"], "severity": a["severity"],
            "price": a["price"], "pct_deviation": a["pct_deviation"], "z_score": a["z_score"],
            "meaning": f"Price {'jumped' if is_spike else 'fell'} {abs(a['pct_deviation']):.1f}% against its 30-day rolling mean — {significance}.",
            "probable_cause": cause,
            "implication": implication,
        })
    return out


# ── Task 6: scenario simulation ──────────────────────────────────────────────

SCENARIOS = {
    "demand_surge": {
        "label": "Higher Demand", "icon": "📈",
        "desc": "Sustained consumption increase (festivals, exports, institutional buying)",
        "direction": +1, "base_impact": 8.0, "vol_mult": 0.5,
    },
    "supply_disruption": {
        "label": "Supply Disruption", "icon": "🚧",
        "desc": "Lower arrivals from crop damage, transport strikes, or regional shortfalls",
        "direction": +1, "base_impact": 14.0, "vol_mult": 0.8,
    },
    "heavy_rainfall": {
        "label": "Increased Rainfall", "icon": "🌧️",
        "desc": "Above-normal monsoon affecting harvesting and logistics",
        "direction": +1, "base_impact": 10.0, "vol_mult": 0.7,
    },
    "export_surge": {
        "label": "Export Surge", "icon": "🚢",
        "desc": "Strong international demand pulling stock from domestic mandis",
        "direction": +1, "base_impact": 9.0, "vol_mult": 0.4,
    },
    "storage_shortage": {
        "label": "Storage Shortage", "icon": "🏚️",
        "desc": "Cold-chain or warehouse capacity constraints forcing fast sales",
        "direction": -1, "base_impact": 7.0, "vol_mult": 0.6,
    },
    "bumper_harvest": {
        "label": "Bumper Harvest", "icon": "🌾",
        "desc": "Above-normal production increasing mandi arrivals",
        "direction": -1, "base_impact": 12.0, "vol_mult": 0.6,
    },
}


def simulate_scenario(ctx: dict, scenario_key: str) -> dict:
    """
    Deterministic what-if estimate. The scenario's base impact is modulated
    by the crop's REAL characteristics:
      - volatility amplifies the achievable swing (high-CV crops move more)
      - perishables react harder to rainfall/storage shocks
      - cash crops react harder to export shocks
      - seasonal phase shifts the effective magnitude
    """
    sc = SCENARIOS.get(scenario_key)
    if sc is None:
        raise ValueError(f"Unknown scenario '{scenario_key}'. Options: {list(SCENARIOS)}")
    if not ctx.get("has_data"):
        return {"scenario": scenario_key, "error": "no data"}

    cv = ctx["volatility"]["cv"]
    category = ctx["category"]
    perishable = category in ("vegetable", "fruit", "core")

    # volatility responsiveness: CV 20 → 0.7×, CV 70 → 1.7×
    vol_factor = 0.7 + min(cv, 100) / 100.0

    # category sensitivity
    cat_factor = 1.0
    if scenario_key in ("heavy_rainfall", "storage_shortage") and perishable:
        cat_factor = 1.4
    if scenario_key == "export_surge":
        cat_factor = 1.5 if category == "cash" else 0.8
    if scenario_key == "bumper_harvest" and category == "grain":
        cat_factor = 1.2

    # seasonal phase modifier: shocks during a trough hit a saturated market
    seas = ctx["seasonal"]
    phase_factor, phase_note = 1.0, ""
    if seas:
        if seas["current_phase"] == "peak" and sc["direction"] > 0:
            phase_factor = 1.25
            phase_note = "The market is already in its seasonal peak, so upward shocks compound an existing premium."
        elif seas["current_phase"] == "trough" and sc["direction"] < 0:
            phase_factor = 0.75
            phase_note = "Prices are already at seasonal lows, which cushions further downside."
        elif seas["current_phase"] == "trough" and sc["direction"] > 0:
            phase_factor = 1.15
            phase_note = "From a seasonal trough, supply-side shocks historically trigger sharp recoveries."

    impact = sc["base_impact"] * vol_factor * cat_factor * phase_factor * sc["direction"]
    lo, hi = round(impact * 0.6, 1), round(impact * 1.5, 1)
    if lo > hi:
        lo, hi = hi, lo

    vol_shift = round(sc["vol_mult"] * vol_factor * 10, 1)
    base = ctx["avg_30d"]
    price_lo = round(base * (1 + lo / 100))
    price_hi = round(base * (1 + hi / 100))

    risk = (
        f"At {cv:.0f}% CV this crop {'amplifies' if cv > 45 else 'absorbs'} external shocks; "
        f"{'perishability adds forced-sale pressure under logistics stress. ' if perishable and scenario_key in ('heavy_rainfall', 'storage_shortage') else ''}"
        f"Simulated outcomes assume the shock persists for most of the {ctx['days']}-day horizon."
    )

    return {
        "scenario": scenario_key, "label": sc["label"], "icon": sc["icon"],
        "description": sc["desc"],
        "expected_move_pct": {"low": lo, "high": hi},
        "expected_price_range": {"low": min(price_lo, price_hi), "high": max(price_lo, price_hi),
                                 "base": base},
        "volatility_shift_pct": vol_shift,
        "narrative": (
            f"Under a {sc['label'].lower()} scenario, {ctx['crop']} in {ctx['state']} would be "
            f"expected to move {lo:+.1f}% to {hi:+.1f}% from the current ₹{base:,}/qtl base, "
            f"with short-term volatility rising roughly {vol_shift:.0f}%. {phase_note}"
        ).strip(),
        "risk_note": risk,
        "drivers": {
            "volatility_factor": round(vol_factor, 2),
            "category_factor": cat_factor,
            "seasonal_factor": phase_factor,
        },
    }


# ── Task 10: multi-crop comparison ───────────────────────────────────────────

def compare_crops(records: list[dict]) -> dict:
    """
    AI comparison across crop records from the cross-crop analytics cache.
    Each record carries: crop, volatility_cv, momentum_score, reliability_score,
    tier, avg_price, current_phase, continuity_score.
    """
    rs = [r for r in records if r.get("has_analytics")]
    if len(rs) < 2:
        return {"summary": "Select at least two crops with analytics to compare.", "rankings": {}}

    by_stability  = sorted(rs, key=lambda r: r.get("volatility_cv", 999))
    by_momentum   = sorted(rs, key=lambda r: r.get("momentum_score", 0), reverse=True)
    by_confidence = sorted(rs, key=lambda r: r.get("reliability_score") or 0, reverse=True)

    most_stable, most_volatile = by_stability[0], by_stability[-1]
    fastest, best_conf = by_momentum[0], by_confidence[0]

    names = ", ".join(r["crop"] for r in rs)
    sentences = [
        f"Across {names}: {most_stable['crop']} is the most stable "
        f"({most_stable['volatility_cv']:.0f}% CV) while {most_volatile['crop']} carries the "
        f"highest swing risk ({most_volatile['volatility_cv']:.0f}% CV).",
        f"{fastest['crop']} has the strongest short-term momentum "
        f"({fastest.get('momentum_score', 0):+.1f}%/7d).",
        f"{best_conf['crop']} offers the most dependable forecast "
        f"(reliability {best_conf.get('reliability_score')}/100, Tier {best_conf.get('tier')}).",
    ]
    peaking = [r["crop"] for r in rs if r.get("current_phase") == "peak"]
    troughing = [r["crop"] for r in rs if r.get("current_phase") == "trough"]
    if peaking:
        sentences.append(f"Seasonally, {', '.join(peaking)} {'is' if len(peaking)==1 else 'are'} in a peak window (sell-side advantage).")
    if troughing:
        sentences.append(f"{', '.join(troughing)} {'is' if len(troughing)==1 else 'are'} at seasonal lows (buy-side advantage).")

    risk_order = [r["crop"] for r in by_stability]
    sentences.append(
        f"For risk-averse positioning the stability ranking is: {' → '.join(risk_order)}."
    )

    return {
        "summary": " ".join(sentences),
        "rankings": {
            "stability":  [{"crop": r["crop"], "cv": r.get("volatility_cv")} for r in by_stability],
            "momentum":   [{"crop": r["crop"], "score": r.get("momentum_score")} for r in by_momentum],
            "confidence": [{"crop": r["crop"], "score": r.get("reliability_score"), "tier": r.get("tier")} for r in by_confidence],
        },
    }
