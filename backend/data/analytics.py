"""
Agricultural market analytics computations.

Provides five analytical functions used by the /api/prices/analytics endpoint:
  1. detect_price_anomalies   — rolling z-score spike/crash detection
  2. compute_volatility_metrics — CV, rolling std, instability score, badge
  3. compute_seasonal_profile  — monthly deviation from annual mean
  4. compute_momentum_signal   — 7d vs prior-30d trend signal
  5. compute_forecast_quality  — reliability score from training depth + volatility

All functions accept a clean (ds, y) DataFrame from query_for_forecast()
and return plain Python dicts — easy to JSON-serialize and cache.
"""
import numpy as np
import pandas as pd

# The South Indian state with the most data for each Tier-1 crop.
# Used by the analytics endpoint to select which state's price series to analyse.
TIER1_HOME_STATE: dict[str, str] = {
    "Tomato":       "Karnataka",
    "Onion":        "Tamil Nadu",
    "Banana":       "Kerala",
    "Brinjal":      "Telangana",
    "Green Chilli": "Andhra Pradesh",
}

MONTH_NAMES = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr",
    5: "May", 6: "Jun", 7: "Jul", 8: "Aug",
    9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}


# ── Feature 1: Price Shock Detection ──────────────────────────────────────────

def detect_price_anomalies(
    df: pd.DataFrame,
    crop: str,
    state: str,
    window: int = 30,
    z_threshold: float = 2.0,
    lookback_days: int = 90,
    max_per_crop: int = 3,
) -> list[dict]:
    """
    Rolling z-score anomaly detection on a daily price series.

    z_score[t] = (price[t] − rolling_mean[t]) / rolling_std[t]

    Severity:
      |z| ≥ 2.0            → low
      |z| ≥ 2.5            → medium
      |z| ≥ 3.5            → high

    Returns the `max_per_crop` most severe anomaly events from the last
    `lookback_days` days, sorted by |z_score| descending.
    """
    df = df.copy().sort_values("ds").reset_index(drop=True)

    roll  = df["y"].rolling(window, min_periods=max(10, window // 3))
    df["roll_mean"] = roll.mean()
    df["roll_std"]  = roll.std()
    df["z_score"]   = np.where(
        df["roll_std"].fillna(0) > 0,
        (df["y"] - df["roll_mean"]) / df["roll_std"],
        np.nan,
    )

    cutoff = df["ds"].max() - pd.Timedelta(days=lookback_days)
    recent = df[(df["ds"] >= cutoff) & (df["z_score"].abs() >= z_threshold)].copy()

    results = []
    for row in recent.itertuples():
        z    = float(row.z_score)
        mean = float(row.roll_mean)
        pct  = round((float(row.y) - mean) / mean * 100, 1) if mean > 0 else 0.0

        severity = (
            "high"   if abs(z) >= 3.5 else
            "medium" if abs(z) >= 2.5 else
            "low"
        )

        results.append({
            "crop":          crop,
            "state":         state,
            "date":          str(row.ds.date()),
            "price":         round(float(row.y), 0),
            "z_score":       round(z, 2),
            "roll_mean":     round(mean, 0),
            "event_type":    "spike" if z > 0 else "crash",
            "severity":      severity,
            "pct_deviation": pct,
        })

    results.sort(key=lambda x: abs(x["z_score"]), reverse=True)
    return results[:max_per_crop]


# ── Feature 2: Volatility Intelligence ────────────────────────────────────────

def compute_volatility_metrics(
    df: pd.DataFrame,
    crop: str,
    state: str,
) -> dict:
    """
    Coefficient of variation, rolling std, instability score, and badge.

    Badge thresholds (CV):
      < 20%  → Stable
      < 35%  → Moderate
      < 50%  → High Risk
      ≥ 50%  → Extremely Volatile
    """
    df = df.sort_values("ds")
    y  = df["y"]
    mean = float(y.mean())

    if mean <= 0:
        return {"crop": crop, "state": state, "cv": 0.0, "badge": "Stable", "level": "stable"}

    cv         = round(float(y.std()) / mean * 100, 1)
    recent_7d  = round(float(y.tail(7).std()),  0) if len(y) >= 7  else 0
    recent_30d = round(float(y.tail(30).std()), 0) if len(y) >= 30 else 0

    # Instability = recent-90d vol relative to full-history mean
    instability = round(float(y.tail(90).std()) / mean * 100, 1) \
                  if len(y) >= 90 else cv

    badge, level = (
        ("Stable",             "stable")   if cv < 20  else
        ("Moderate",           "moderate") if cv < 35  else
        ("High Risk",          "high")     if cv < 50  else
        ("Extremely Volatile", "extreme")
    )

    return {
        "crop":              crop,
        "state":             state,
        "cv":                cv,
        "badge":             badge,
        "level":             level,
        "recent_7d_vol":     recent_7d,
        "recent_30d_vol":    recent_30d,
        "instability_score": instability,
    }


# ── Feature 3: Seasonal Intelligence ──────────────────────────────────────────

def compute_seasonal_profile(
    df: pd.DataFrame,
    crop: str,
    state: str,
) -> dict:
    """
    Monthly price profile relative to the full-history annual average.

    pct_deviation[month] = (monthly_avg − overall_avg) / overall_avg × 100

    Returns:
      peak_months    — top-3 months by positive deviation
      trough_months  — bottom-3 months by negative deviation
      current_phase  — "peak" | "trough" | "normal"
      current_vs_norm — % deviation for the current month
    """
    df = df.copy()
    df["month"] = df["ds"].dt.month
    overall_mean = float(df["y"].mean())

    if overall_mean <= 0:
        return {"crop": crop, "state": state, "error": "insufficient data"}

    monthly_avg = df.groupby("month")["y"].mean()
    monthly_pct = ((monthly_avg - overall_mean) / overall_mean * 100).round(1)

    peak_months   = monthly_pct.nlargest(3).index.tolist()
    trough_months = monthly_pct.nsmallest(3).index.tolist()

    current_month    = int(df["ds"].max().month)
    current_vs_norm  = round(float(monthly_pct.get(current_month, 0.0)), 1)

    current_phase = (
        "peak"   if current_month in peak_months   else
        "trough" if current_month in trough_months else
        "normal"
    )

    return {
        "crop":            crop,
        "state":           state,
        "peak_months":     [MONTH_NAMES[m] for m in peak_months],
        "trough_months":   [MONTH_NAMES[m] for m in trough_months],
        "peak_pct":        round(float(monthly_pct.max()), 1),
        "trough_pct":      round(float(monthly_pct.min()), 1),
        "current_phase":   current_phase,
        "current_vs_norm": current_vs_norm,
        "monthly_profile": {
            MONTH_NAMES[int(m)]: round(float(v), 1)
            for m, v in monthly_pct.items()
        },
    }


# ── Feature 4: Momentum Signals ───────────────────────────────────────────────

def compute_momentum_signal(
    df: pd.DataFrame,
    crop: str,
    state: str,
) -> dict:
    """
    7-day momentum vs prior-30-day baseline.

    score = (avg_7d − prior_avg) / prior_avg × 100

    Signals:
      score >  10  → Strong Uptrend ↑↑
      score >   3  → Uptrend ↑
      score ≥  −3  → Stable →
      score < −3   → Downtrend ↓
      score < −10  → Strong Downtrend ↓↓
    """
    df = df.sort_values("ds")
    n  = len(df)

    avg_7d     = float(df["y"].iloc[max(0, n - 7):].mean())
    avg_30d    = float(df["y"].iloc[max(0, n - 30):].mean())
    prior_avg  = float(df["y"].iloc[max(0, n - 60): max(0, n - 30)].mean()) \
                 if n >= 60 else avg_30d

    score = round((avg_7d - prior_avg) / prior_avg * 100, 1) if prior_avg > 0 else 0.0

    signal, short = (
        ("Strong Uptrend",   "↑↑") if score >  10 else
        ("Uptrend",          "↑")  if score >   3 else
        ("Strong Downtrend", "↓↓") if score < -10 else
        ("Downtrend",        "↓")  if score <  -3 else
        ("Stable",           "→")
    )

    return {
        "crop":    crop,
        "state":   state,
        "signal":  signal,
        "short":   short,
        "score":   score,
        "avg_7d":  round(avg_7d, 0),
        "avg_30d": round(avg_30d, 0),
    }


# ── Feature 5: Forecast Quality Scoring ───────────────────────────────────────

def compute_forecast_quality(
    crop: str,
    state: str,
    training_days: int,
    cv: float,
) -> dict:
    """
    Reliability score 0–100.

    training_score (0–50): depth of historical record
      − maxes out at 4 000 days (≈11 years)
    volatility_score (0–50): how predictable the series is
      − decreases as CV rises; zero at CV ≥ 100%

    Reliability labels:
      ≥ 70 → Excellent
      ≥ 52 → Good
      ≥ 35 → Moderate
       < 35 → Low Confidence
    """
    t_score = min(50.0, (training_days / 4_000) * 50)
    v_score = max(0.0, 50.0 - (cv / 2))
    total   = round(t_score + v_score)

    reliability = (
        "Excellent"      if total >= 70 else
        "Good"           if total >= 52 else
        "Moderate"       if total >= 35 else
        "Low Confidence"
    )

    return {
        "crop":          crop,
        "state":         state,
        "reliability":   reliability,
        "score":         total,
        "training_days": training_days,
        "cv":            round(cv, 1),
    }


# ── Feature 6: Forecast Tier Classification (Phase 1) ─────────────────────────
#
# Honest, data-driven 4-tier classification. Unlike the previous readiness
# logic, this also measures RECENCY: a crop with 3,000 historical days but
# 13 days in the last year (Turmeric/TN in the audit) must not be classified
# as fully forecastable — its forecast would anchor on stale prices.
#
#   Tier A — Full Prophet Forecast    deep history, strong recent continuity
#   Tier B — Moderate Forecast        Prophet runs, but recency/depth gaps
#                                     widen real uncertainty
#   Tier C — Sparse Trend Forecast    Prophet unreliable; trend + seasonal
#                                     approximation fallback
#   Tier D — Analytics Only           no reliable forecasting possible

_TIER_A = {"min_days": 1000, "min_continuity": 70.0, "max_cv": 75.0}
_TIER_B = {"min_days":  500, "min_continuity": 40.0, "max_cv": 120.0}
_TIER_C = {"min_days":  120}

_TIER_META = {
    "A": ("Full Forecast",     "prophet",       "forecast"),
    "B": ("Moderate Forecast", "prophet",       "limited"),
    "C": ("Sparse Trend",      "sparse_trend",  "sparse"),
    "D": ("Analytics Only",    "none",          "analytics"),
}


def classify_forecast_tier(
    crop: str,
    state: str,
    training_days: int,
    recent_days_365: int,
    cv: float,
) -> dict:
    """
    Classify a crop+state series into forecast Tier A/B/C/D.

    Inputs:
      training_days   — distinct price days in the full series
      recent_days_365 — distinct price days within the last 365 days of the
                        dataset (NOT of the series — measures staleness)
      cv              — coefficient of variation (%) of daily prices

    Returns tier + method + diagnostics. `level` is a compatibility alias
    used by existing frontend grouping (forecast/limited/sparse/analytics).
    """
    continuity = round(min(recent_days_365 / 365 * 100, 100.0), 1)

    if (training_days >= _TIER_A["min_days"]
            and continuity >= _TIER_A["min_continuity"]
            and cv <= _TIER_A["max_cv"]):
        tier = "A"
    elif (training_days >= _TIER_B["min_days"]
            and continuity >= _TIER_B["min_continuity"]
            and cv <= _TIER_B["max_cv"]):
        tier = "B"
    elif training_days >= _TIER_C["min_days"]:
        tier = "C"
    else:
        tier = "D"

    readiness, method, level = _TIER_META[tier]
    return {
        "crop":              crop,
        "state":             state,
        "tier":              tier,
        "readiness":         readiness,
        "method":            method,
        "level":             level,
        "forecast_eligible": tier in ("A", "B", "C"),
        # ── diagnostics ──
        "training_days":     training_days,
        "recent_days_365":   recent_days_365,
        "continuity_score":  continuity,
        "cv":                round(cv, 1),
    }
