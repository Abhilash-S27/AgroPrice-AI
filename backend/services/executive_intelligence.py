"""
Executive Intelligence Engine (Phase 4).

Bloomberg-style market command-center analytics, all derived from existing
computed metrics — primarily the cross-crop analytics cache (27 crops at
their home states) plus one cached crop×state pair matrix for heatmaps.
No metric is recomputed; nothing is invented.

Provides:
  executive_summary(peers)        — KPIs + pulse cards + insight ribbon + alerts
  pair_matrix()                   — crop×state metric grid (heatmaps)
  battle(peers, a, b)             — AI battle card comparison
  strategy(peers, prefs)          — decision-intelligence recommendations
  timeline(crop, state)           — market history storytelling events
  outlook_report(crop, state)     — markdown executive report
"""
from __future__ import annotations

import pandas as pd

from backend.core.database import db_manager
from backend.data.loaders.duckdb_queries import query_for_forecast
from backend.services.ai_forecast_narrator import (
    build_confidence,
    build_insight_context,
    build_narrative,
    build_strategy,
)
from backend.utils.constants import SOUTH_INDIAN_STATES
from backend.utils.crop_registry import ALL_CROPS, CROP_REGISTRY, price_cap


def _ok(peers: list[dict]) -> list[dict]:
    return [p for p in peers if p.get("has_analytics")]


# ── 1. Executive summary: KPIs + pulse + ribbon + alerts ─────────────────────

def executive_summary(peers: list[dict]) -> dict:
    pool = _ok(peers)
    if len(pool) < 5:
        return {"ready": False}

    n = len(pool)
    avg_rel = sum(p.get("reliability_score") or 0 for p in pool) / n
    avg_cv = sum(p.get("volatility_cv", 0) for p in pool) / n
    avg_mom = sum(p.get("momentum_score", 0) for p in pool) / n
    anom_total = sum(p.get("anomaly_count_90d", 0) or 0 for p in pool)
    rising = [p for p in pool if p.get("momentum_score", 0) > 3]
    troughs = [p for p in pool if p.get("current_phase") == "trough"]
    peaks = [p for p in pool if p.get("current_phase") == "peak"]

    # ── Executive KPI indices (transparent formulas) ────────────────────────
    kpis = [
        {"key": "confidence", "label": "AI Confidence Index",
         "value": round(avg_rel), "unit": "/100",
         "detail": f"mean forecast reliability across {n} crops"},
        {"key": "stability", "label": "Market Stability Index",
         "value": round(max(0, 100 - avg_cv * 1.4)), "unit": "/100",
         "detail": f"inverse of mean volatility ({avg_cv:.0f}% CV average)"},
        {"key": "opportunity", "label": "Opportunity Score",
         "value": round(min(100, max(0, 50 + avg_mom * 2 + len(troughs) * 2))), "unit": "/100",
         "detail": f"{len(rising)} rising markets, {len(troughs)} at seasonal lows (entry windows)"},
        {"key": "stress", "label": "AI Market Stress Meter",
         "value": round(min(100, anom_total * 4 + max(0, avg_cv - 30))), "unit": "/100",
         "detail": f"{anom_total} anomaly events across all crops in 90 days"},
    ]

    # ── Pulse cards (each: title, crop, headline, reasoning, confidence) ────
    def card(key, title, icon, p, headline, reasoning):
        return {"key": key, "title": title, "icon": icon, "crop": p["crop"],
                "state": p["state"], "headline": headline, "reasoning": reasoning,
                "confidence": p.get("reliability_score"), "tier": p.get("tier")}

    by_mom = sorted(pool, key=lambda p: p.get("momentum_score", 0), reverse=True)
    by_cv = sorted(pool, key=lambda p: p.get("volatility_cv", 99))
    by_rel = sorted(pool, key=lambda p: p.get("reliability_score") or 0, reverse=True)
    recovery = sorted(troughs, key=lambda p: p.get("momentum_score", 0), reverse=True)
    storables = [p for p in pool if p.get("category") in ("grain", "cash")]

    strongest = by_mom[0]
    safest = by_cv[0]
    volatile = by_cv[-1]
    confident = by_rel[0]
    anom = max(pool, key=lambda p: p.get("anomaly_count_90d", 0) or 0)

    pulse = [
        card("momentum", "Highest Momentum", "🚀", strongest,
             f"{strongest['crop']} leads South India with {strongest.get('momentum_score', 0):+.1f}%/7d momentum.",
             f"7-day prices vs prior-month baseline in {strongest['state']}; volatility {strongest.get('volatility_cv', 0):.0f}% CV."),
        card("safest", "Safest Market", "🛡️", safest,
             f"{safest['crop']} is the steadiest market at {safest.get('volatility_cv', 0):.0f}% CV.",
             f"Lowest coefficient of variation among {n} tracked crops; Tier {safest.get('tier')} data in {safest['state']}."),
        card("volatile", "Most Volatile", "⚡", volatile,
             f"{volatile['crop']} swings hardest at {volatile.get('volatility_cv', 0):.0f}% CV.",
             "High variation cuts both ways — opportunity on timing, risk on bulk positions."),
        card("confident", "Highest Forecast Confidence", "🎯", confident,
             f"{confident['crop']} carries the most dependable forecast ({confident.get('reliability_score')}/100).",
             f"{confident.get('training_days', 0):,} training days with {confident.get('continuity_score')}% continuity."),
    ]
    if recovery:
        r = recovery[0]
        pulse.append(card("recovery", "Strongest Recovery", "🌱", r,
            f"{r['crop']} shows strongest recovery momentum after exiting its seasonal trough.",
            f"Trough phase with momentum {r.get('momentum_score', 0):+.1f}%/7d in {r['state']} — the classic trough-exit pattern."))
    if (anom.get("anomaly_count_90d") or 0) > 0:
        pulse.append(card("anomaly", "Biggest Anomaly Cluster", "💥", anom,
            f"{anom['crop']} logged {anom['anomaly_count_90d']} statistical price events in 90 days.",
            "Rolling z-score spikes/crashes — the recent baseline carries shock residue."))
    if storables:
        st = min(storables, key=lambda p: p.get("volatility_cv", 99)
                 - (10 if p.get("current_phase") == "trough" else 0))
        pulse.append(card("storage", "Top Storage Candidate", "🏪", st,
            f"{st['crop']} is the strongest hold candidate ({st.get('volatility_cv', 0):.0f}% CV, {st.get('category')}).",
            "Non-perishable, stable pricing" + (", currently at seasonal lows" if st.get("current_phase") == "trough" else "") + "."))
    # trader vs farmer opportunity
    trader = max(pool, key=lambda p: abs(p.get("momentum_score", 0)) * 0.6 + p.get("volatility_cv", 0) * 0.2)
    farmer = max(pool, key=lambda p: (p.get("reliability_score") or 0) * 0.4
                 + max(0, 60 - p.get("volatility_cv", 60)) + p.get("momentum_score", 0) * 0.3)
    pulse.append(card("trader", "Top Trader Opportunity", "📊", trader,
        f"{trader['crop']} offers the most active trading conditions right now.",
        f"Momentum {trader.get('momentum_score', 0):+.1f}%/7d with {trader.get('volatility_cv', 0):.0f}% CV — movement traders can work with."))
    pulse.append(card("farmer", "Top Farmer Opportunity", "🌾", farmer,
        f"{farmer['crop']} balances stability and momentum best for growers.",
        f"{farmer.get('volatility_cv', 0):.0f}% CV, momentum {farmer.get('momentum_score', 0):+.1f}%/7d, reliability {farmer.get('reliability_score')}/100."))

    # ── Insight ribbon + alerts (severity-ranked) ───────────────────────────
    alerts: list[dict] = []
    for p in pool:
        cv = p.get("volatility_cv", 0)
        mom = p.get("momentum_score", 0)
        anoms = p.get("anomaly_count_90d", 0) or 0
        if anoms >= 2 and cv >= 55:
            alerts.append({"level": "critical", "icon": "🚨", "severity": min(100, 60 + anoms * 10 + (cv - 55)),
                           "crop": p["crop"], "state": p["state"],
                           "text": f"{p['crop']}: {anoms} anomaly events + {cv:.0f}% CV — unstable price discovery",
                           "action": "Avoid bulk positions; trade staggered lots only."})
        elif cv >= 55 or abs(mom) >= 25:
            alerts.append({"level": "warning", "icon": "⚠", "severity": min(90, 40 + cv / 2 + abs(mom) / 2),
                           "crop": p["crop"], "state": p["state"],
                           "text": f"{p['crop']}: {'volatility surge' if cv >= 55 else 'sharp momentum shift'} ({cv:.0f}% CV, {mom:+.1f}%/7d)",
                           "action": "Watch closely; fast moves often partially retrace."})
        elif p.get("current_phase") == "trough" and mom > 3:
            alerts.append({"level": "opportunity", "icon": "📈", "severity": min(80, 30 + mom),
                           "crop": p["crop"], "state": p["state"],
                           "text": f"{p['crop']}: seasonal recovery underway ({mom:+.1f}%/7d off trough lows)",
                           "action": "Historically a favourable accumulation window."})
        elif cv <= 25 and (p.get("reliability_score") or 0) >= 75:
            alerts.append({"level": "stable", "icon": "✓", "severity": 10,
                           "crop": p["crop"], "state": p["state"],
                           "text": f"{p['crop']}: stable ({cv:.0f}% CV) with high forecast confidence",
                           "action": "Suitable anchor for low-risk planning."})
    alerts.sort(key=lambda a: a["severity"], reverse=True)

    return {
        "ready": True,
        "computed_at": str(pd.Timestamp.now().date()),
        "kpis": kpis,
        "pulse": pulse[:10],
        "alerts": alerts[:12],
    }


# ── 2. Pair matrix for heatmaps (one cached SQL pass) ────────────────────────

def pair_matrix() -> dict:
    """
    crop×state metric grid: days, recency, cv, momentum, avg price per pair.
    One aggregate query over the prices view; heatmap metrics derive from it.
    """
    placeholders = ", ".join("?" * len(ALL_CROPS))
    states = ", ".join(f"'{s}'" for s in SOUTH_INDIAN_STATES)
    cap = max(price_cap(c) for c in ALL_CROPS)
    rows = db_manager.execute(
        f"""
        WITH daily AS (
            SELECT "Commodity" AS crop, "State" AS st,
                   TRY_CAST("Arrival_Date" AS DATE) AS d,
                   AVG("Modal_Price") AS y
            FROM prices
            WHERE "Commodity" IN ({placeholders})
              AND "State" IN ({states})
              AND "Modal_Price" BETWEEN 1 AND {cap}
              AND TRY_CAST("Arrival_Date" AS DATE) IS NOT NULL
            GROUP BY 1, 2, 3
        ),
        latest AS (SELECT MAX(d) AS mx FROM daily)
        SELECT crop, st,
               COUNT(*) AS days,
               COUNT(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 365 DAY THEN 1 END) AS recent,
               ROUND(STDDEV(y) / NULLIF(AVG(y), 0) * 100, 1) AS cv,
               ROUND(AVG(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 30 DAY THEN y END), 0) AS avg30,
               ROUND((AVG(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 30 DAY THEN y END)
                      / NULLIF(AVG(CASE WHEN d >= (SELECT mx FROM latest) - INTERVAL 90 DAY
                                          AND d < (SELECT mx FROM latest) - INTERVAL 30 DAY THEN y END), 0)
                      - 1) * 100, 1) AS mom30
        FROM daily GROUP BY crop, st
        """,
        list(ALL_CROPS),
    ).fetchall()

    cells: dict[str, dict[str, dict]] = {}
    for crop, st, days_n, recent, cv, avg30, mom30 in rows:
        cont = round(min(int(recent) / 365 * 100, 100.0), 1)
        cv_f = float(cv or 0)
        mom_f = float(mom30) if mom30 is not None else 0.0
        # derived heatmap metrics (0–100, transparent formulas)
        confidence = round(min(100, (min(int(days_n), 4000) / 4000) * 50 + cont * 0.5))
        risk = round(min(100, cv_f * 1.1 + max(0, 40 - cont) * 0.8))
        opportunity = round(min(100, max(0, 50 + mom_f * 1.5 - cv_f * 0.3 + cont * 0.15)))
        reasons = []
        reasons.append("high momentum" if mom_f > 8 else "soft momentum" if mom_f < -8 else "flat momentum")
        reasons.append("low volatility" if cv_f < 30 else "high volatility" if cv_f > 55 else "moderate volatility")
        reasons.append("strong continuity" if cont >= 70 else "sparse reporting" if cont < 40 else "moderate continuity")
        cells.setdefault(crop, {})[st] = {
            "days": int(days_n), "continuity": cont, "cv": cv_f,
            "momentum": mom_f, "avg_30d": float(avg30) if avg30 is not None else None,
            "confidence": confidence, "risk": risk, "opportunity": opportunity,
            "reason": " + ".join(reasons),
        }

    return {"crops": ALL_CROPS, "states": SOUTH_INDIAN_STATES, "cells": cells,
            "computed_at": str(pd.Timestamp.now().date())}


# ── 3. AI Battle comparison ──────────────────────────────────────────────────

_BATTLE_DIMS = [
    ("stability",   "Stability",      lambda p: max(0, 100 - p.get("volatility_cv", 60) * 1.3)),
    ("momentum",    "Momentum",       lambda p: min(100, max(0, 50 + p.get("momentum_score", 0) * 1.6))),
    ("confidence",  "Confidence",     lambda p: p.get("reliability_score") or 0),
    ("cleanliness", "Anomaly Calm",   lambda p: max(0, 100 - (p.get("anomaly_count_90d", 0) or 0) * 25)),
    ("continuity",  "Data Continuity", lambda p: p.get("continuity_score") or 0),
    ("storability", "Storability",    lambda p: (70 if p.get("category") in ("grain", "cash") else 25)
                                                + max(0, 30 - p.get("volatility_cv", 60) * 0.5)),
]


def battle(peers: list[dict], crop_a: str, crop_b: str) -> dict:
    pa = next((p for p in _ok(peers) if p["crop"] == crop_a), None)
    pb = next((p for p in _ok(peers) if p["crop"] == crop_b), None)
    if not pa or not pb:
        missing = crop_a if not pa else crop_b
        return {"error": f"No analytics available for {missing}."}

    dims, score_a, score_b = [], 0.0, 0.0
    for key, label, fn in _BATTLE_DIMS:
        va, vb = round(fn(pa)), round(fn(pb))
        dims.append({"key": key, "label": label, "a": va, "b": vb})
        score_a += va
        score_b += vb
    score_a, score_b = round(score_a / len(_BATTLE_DIMS)), round(score_b / len(_BATTLE_DIMS))

    winner, loser = (pa, pb) if score_a >= score_b else (pb, pa)
    w_dims = [d for d in dims if (d["a"] > d["b"]) == (winner is pa)]
    l_dims = [d for d in dims if d not in w_dims]

    def best_use(p):
        if p.get("volatility_cv", 0) >= 50 and abs(p.get("momentum_score", 0)) > 8:
            return "short-term momentum trading"
        if p.get("volatility_cv", 99) <= 28 and p.get("category") in ("grain", "cash"):
            return "stable low-risk holding"
        if p.get("current_phase") == "trough":
            return "seasonal accumulation entries"
        return "balanced positional plays"

    verdict = (
        f"{winner['crop']} wins the overall battle {max(score_a, score_b)}–{min(score_a, score_b)}, "
        f"taking {len(w_dims)} of {len(dims)} dimensions"
        + (f" ({', '.join(d['label'].lower() for d in w_dims[:3])})" if w_dims else "") + ". "
        f"{loser['crop']} stays superior for "
        + (", ".join(d["label"].lower() for d in l_dims[:2]) if l_dims else "no dimension") + " — "
        f"ideal use: {winner['crop']} for {best_use(winner)}, {loser['crop']} for {best_use(loser)}."
    )

    def profile(p, score):
        return {"crop": p["crop"], "state": p["state"], "score": score,
                "tier": p.get("tier"), "cv": p.get("volatility_cv"),
                "momentum": p.get("momentum_score"),
                "reliability": p.get("reliability_score"),
                "phase": p.get("current_phase"),
                "use_case": best_use(p)}

    return {"a": profile(pa, score_a), "b": profile(pb, score_b),
            "dimensions": dims, "verdict": verdict}


# ── 4. Decision-intelligence strategy ────────────────────────────────────────

def strategy(peers: list[dict], prefs: dict) -> dict:
    """
    prefs: risk_appetite (low|medium|high), horizon (short|medium|long),
           storage (none|limited|good), state (optional)
    Deterministic constraint filtering + ranking over real metrics.
    """
    pool = _ok(peers)
    if len(pool) < 5:
        return {"ready": False, "narrative": "Analytics still warming up."}

    risk = prefs.get("risk_appetite", "medium")
    horizon = prefs.get("horizon", "medium")
    storage = prefs.get("storage", "limited")
    state = prefs.get("state")

    cv_cap = {"low": 32, "medium": 50, "high": 999}[risk]
    candidates = [p for p in pool if p.get("volatility_cv", 99) <= cv_cap] or pool
    if state:
        in_state = [p for p in candidates if p.get("state") == state]
        candidates = in_state or candidates
    if storage == "none":
        candidates = [p for p in candidates
                      if not (p.get("category") in ("grain", "cash")
                              and p.get("current_phase") == "trough")] or candidates

    def rank(p):
        s = (p.get("reliability_score") or 0) * 0.3
        if horizon == "short":
            s += p.get("momentum_score", 0) * 1.2 + (12 if p.get("current_phase") == "peak" else 0)
        elif horizon == "long":
            s += max(0, 60 - p.get("volatility_cv", 60)) + (12 if p.get("current_phase") == "trough" else 0) \
                 + (10 if p.get("category") in ("grain", "cash") else 0)
        else:
            s += p.get("momentum_score", 0) * 0.5 + max(0, 45 - p.get("volatility_cv", 45)) * 0.6
        if risk == "high":
            s += p.get("volatility_cv", 0) * 0.25
        return s

    picks = sorted(candidates, key=rank, reverse=True)[:3]
    recs = []
    for p in picks:
        why = []
        why.append(f"{p.get('volatility_cv', 0):.0f}% CV fits a {risk}-risk profile")
        if p.get("momentum_score", 0) > 3:
            why.append(f"momentum {p.get('momentum_score', 0):+.1f}%/7d supports near-term strength")
        if p.get("current_phase") == "trough":
            why.append("entry near seasonal lows")
        elif p.get("current_phase") == "peak":
            why.append("currently in its premium selling window")
        why.append(f"forecast reliability {p.get('reliability_score')}/100 (Tier {p.get('tier')})")
        sell = ", ".join(p.get("peak_months", [])[:3]) or "seasonal peak months"
        recs.append({
            "crop": p["crop"], "state": p["state"], "tier": p.get("tier"),
            "cv": p.get("volatility_cv"), "momentum": p.get("momentum_score"),
            "reliability": p.get("reliability_score"),
            "reasons": why,
            "selling_window": sell,
            "storage_note": ("Suitable for holding within capacity"
                             if p.get("category") in ("grain", "cash") and storage != "none"
                             else "Sell on harvest cycles — storage not advised for this crop/profile"),
        })

    div = ""
    if len(picks) >= 2:
        cvs = [p.get("volatility_cv", 0) for p in picks]
        div = (f"Splitting across {picks[0]['crop']} and {picks[1]['crop']} mixes "
               f"{min(cvs):.0f}% and {max(cvs):.0f}% CV profiles, smoothing income against "
               "any single market's swings.")

    narrative = (
        f"For a {risk}-risk, {horizon}-horizon profile"
        + (f" focused on {state}" if state else "")
        + f" with {storage} storage capacity, the data favours "
        + ", ".join(p["crop"] for p in picks) + ". " + div
    )
    return {"ready": True, "recommendations": recs, "narrative": narrative,
            "prefs": {"risk_appetite": risk, "horizon": horizon,
                      "storage": storage, "state": state}}


# ── 5. Market history timeline ───────────────────────────────────────────────

def timeline(crop: str, state: str) -> dict:
    df = query_for_forecast(crop, state)
    if df.empty or len(df) < 120:
        return {"events": [], "note": f"Insufficient history for {crop} in {state}."}
    df = df.sort_values("ds").reset_index(drop=True)

    events: list[dict] = []

    # yearly character (volatility regime per year)
    by_year = df.groupby(df["ds"].dt.year)["y"].agg(["mean", "std", "count"])
    by_year = by_year[by_year["count"] >= 60]
    by_year["cv"] = by_year["std"] / by_year["mean"] * 100
    base_cv = by_year["cv"].median()
    for yr, row in by_year.iterrows():
        if row["cv"] > base_cv * 1.5:
            covid = " during the COVID supply-disruption period" if yr in (2020, 2021) else ""
            events.append({"date": f"{yr}", "type": "volatility", "icon": "⚡",
                           "title": f"Abnormal volatility regime in {yr}",
                           "text": f"{crop} ran at {row['cv']:.0f}% CV vs a {base_cv:.0f}% norm{covid} "
                                   f"(avg ₹{row['mean']:,.0f}/qtl)."})

    # all-time extremes
    hi = df.loc[df["y"].idxmax()]
    lo = df.loc[df["y"].idxmin()]
    events.append({"date": str(hi["ds"].date()), "type": "peak", "icon": "📈",
                   "title": "All-time recorded high",
                   "text": f"₹{hi['y']:,.0f}/qtl — the strongest single-day price in the series."})
    events.append({"date": str(lo["ds"].date()), "type": "trough", "icon": "📉",
                   "title": "All-time recorded low",
                   "text": f"₹{lo['y']:,.0f}/qtl — the weakest recorded level."})

    # biggest historical shocks (rolling z-score over the FULL history)
    roll = df["y"].rolling(30, min_periods=10)
    z = (df["y"] - roll.mean()) / roll.std()
    shocks = df.assign(z=z).dropna()
    shocks = shocks.reindex(shocks["z"].abs().sort_values(ascending=False).index).head(3)
    for _, s in shocks.iterrows():
        kind = "spike" if s["z"] > 0 else "crash"
        events.append({"date": str(s["ds"].date()), "type": kind,
                       "icon": "💥" if kind == "spike" else "🕳️",
                       "title": f"Major price {kind} ({s['z']:+.1f}σ)",
                       "text": f"₹{s['y']:,.0f}/qtl vs a ₹{roll.mean()[s.name]:,.0f} rolling mean — "
                               "consistent with a sudden supply/demand dislocation."})

    events.sort(key=lambda e: e["date"])
    return {"crop": crop, "state": state, "events": events[:10]}


# ── 6. Executive markdown report ─────────────────────────────────────────────

def outlook_report(crop: str, state: str, days: int = 30) -> str:
    ctx = build_insight_context(crop, state, days)
    lines = [
        f"# AgroPrice AI — Crop Outlook Report",
        f"**{crop} · {state} · {pd.Timestamp.now().date()}**",
        "",
        "_Generated deterministically from AGMARKNET analytics (2015–2026). "
        "All figures trace to computed metrics — no generative content._",
        "",
    ]
    if not ctx.get("has_data"):
        lines += ["## Status", f"{crop} has insufficient reporting in {state}; "
                  "this pair is classified analytics-only."]
        return "\n".join(lines)

    conf = build_confidence(ctx)
    strat = build_strategy(ctx)
    tier = ctx["tier"]
    lines += [
        "## Executive Summary",
        build_narrative(ctx),
        "",
        "## Market Profile",
        f"- Last price: ₹{ctx['last_price']:,}/qtl ({ctx['last_date']})",
        f"- 30-day average: ₹{ctx['avg_30d']:,}/qtl ({ctx['price_vs_year']:+.1f}% vs 12-month mean)",
        f"- Volatility: {ctx['volatility']['cv']:.0f}% CV ({ctx['volatility']['badge']})",
        f"- Momentum: {ctx['momentum']['score']:+.1f}%/7d ({ctx['momentum']['signal']})",
        f"- Forecast tier: {tier['tier']} — {tier['readiness']} "
        f"({tier['training_days']:,} days, {tier['continuity_score']}% continuity)",
        "",
        f"## Confidence Assessment — {conf['score']}/100 ({conf['reliability']})",
    ]
    for b in conf["breakdown"]:
        lines.append(f"- {b['factor']}: {b['earned']}/{b['weight']} — {b['detail']}")
    lines += ["", "## Strategy Guidance"]
    for grp, label in (("farmer", "Farmer"), ("trader", "Trader"), ("storage", "Storage")):
        for s in strat[grp]:
            lines.append(f"- **{label}:** {s}")
    lines += ["", "## Risk Notes"]
    for r in strat["risks"]:
        lines.append(f"- {r}")
    if ctx["anomalies"]:
        lines += ["", "## Recent Anomalies"]
        for a in ctx["anomalies"]:
            lines.append(f"- {a['date']}: {a['event_type']} {a['pct_deviation']:+.1f}% "
                         f"(severity {a['severity']}, ₹{a['price']:,.0f}/qtl)")
    lines += ["", "---",
              "_AgroPrice AI · South India Agricultural Market Intelligence · "
              "Tier-classified Prophet/sparse-trend forecasting with explainable confidence scoring._"]
    return "\n".join(lines)
