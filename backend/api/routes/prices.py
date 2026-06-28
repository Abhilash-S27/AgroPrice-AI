from fastapi import APIRouter, HTTPException, Query
from datetime import date

import pandas as pd

from backend.core.database import db_manager
from backend.data.schema.models import PriceRecord, PriceSummary

router = APIRouter()


@router.get("/geographic-intelligence")
def get_geographic_intelligence(
    crop: str = Query(default="Tomato", description="Tier-1 crop to analyse"),
) -> dict:
    """
    Per-state market analytics for one crop across all 5 South Indian states.

    Each state entry contains:
      avg_price, change_pct, volatility_cv, volatility_level, momentum_signal,
      reliability, reliability_score, anomaly_count, current_phase, training_days

    Cached per crop after first call (~3s cold → ~10ms hot).
    """
    from backend.cache.query_cache import cache_get, cache_set
    from backend.data.loaders.duckdb_queries import query_for_forecast
    from backend.data.analytics import (
        compute_volatility_metrics,
        compute_seasonal_profile,
        compute_momentum_signal,
        compute_forecast_quality,
        detect_price_anomalies,
    )
    from backend.utils.constants import SOUTH_INDIAN_STATES
    from backend.utils.validators import validate_crop

    try:
        crop = validate_crop(crop)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    cache_key = f"geo_intel_{crop.lower().replace(' ', '_')}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    states_data: list[dict] = []

    for state in SOUTH_INDIAN_STATES:
        try:
            df = query_for_forecast(crop, state)
            if df.empty or len(df) < 14:
                states_data.append({
                    "state": state, "available": False, "reason": "insufficient data",
                })
                continue

            df = df.sort_values("ds").reset_index(drop=True)

            vol   = compute_volatility_metrics(df, crop, state)
            mom   = compute_momentum_signal(df, crop, state)
            qual  = compute_forecast_quality(crop, state, len(df), vol["cv"])
            seas  = compute_seasonal_profile(df, crop, state)
            anoms = detect_price_anomalies(df, crop, state, lookback_days=90)

            states_data.append({
                "state":             state,
                "available":         True,
                "avg_price":         round(float(df["y"].tail(30).mean()), 0),
                "avg_7d":            mom["avg_7d"],
                "change_pct":        mom["score"],
                "volatility_cv":     vol["cv"],
                "volatility_level":  vol["level"],
                "volatility_badge":  vol["badge"],
                "trend":             ("rising"  if mom["score"] >  3 else
                                      "falling" if mom["score"] < -3 else "stable"),
                "momentum_signal":   mom["signal"],
                "momentum_short":    mom["short"],
                "reliability":       qual["reliability"],
                "reliability_score": qual["score"],
                "training_days":     len(df),
                "anomaly_count":     len(anoms),
                "anomaly_severity":  anoms[0]["severity"] if anoms else None,
                "current_phase":     seas.get("current_phase", "normal"),
                "current_vs_norm":   seas.get("current_vs_norm", 0),
                "peak_months":       seas.get("peak_months", []),
            })
        except Exception:
            states_data.append({"state": state, "available": False, "reason": "error"})

    result = {
        "crop":        crop,
        "states":      states_data,
        "computed_at": str(pd.Timestamp.now().date()),
    }
    cache_set(cache_key, result)
    return result


@router.get("/analytics")
def get_market_analytics() -> dict:
    """
    Comprehensive market intelligence for all Tier-1 crops (home states).

    Computes five analytics layers:
      1. anomalies      — rolling z-score spike/crash events (last 90 days)
      2. volatility     — CV, rolling std, instability score, badge
      3. seasonal       — monthly deviation from annual mean, current phase
      4. momentum       — 7-day vs prior-30d signal (↑↑ / ↑ / → / ↓ / ↓↓)
      5. forecast_quality — reliability score 0-100 from training depth + volatility

    In-memory cached after first request (~6s cold → ~50ms hot).
    """
    from backend.cache.query_cache import cache_get, cache_set
    from backend.data.loaders.duckdb_queries import query_for_forecast
    from backend.data.analytics import (
        TIER1_HOME_STATE,
        detect_price_anomalies,
        compute_volatility_metrics,
        compute_seasonal_profile,
        compute_momentum_signal,
        compute_forecast_quality,
    )
    from backend.utils.constants import TIER1_CROPS

    CACHE_KEY = "market_analytics_v1"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    anomalies:        list[dict] = []
    volatility_rank:  list[dict] = []
    seasonal_list:    list[dict] = []
    momentum_list:    list[dict] = []
    quality_list:     list[dict] = []

    for crop in TIER1_CROPS:
        state = TIER1_HOME_STATE.get(crop, "Karnataka")
        try:
            df = query_for_forecast(crop, state)
            if df.empty or len(df) < 30:
                continue

            df = df.sort_values("ds").reset_index(drop=True)

            anomalies.extend(detect_price_anomalies(df, crop, state))

            vol = compute_volatility_metrics(df, crop, state)
            volatility_rank.append(vol)

            seasonal_list.append(compute_seasonal_profile(df, crop, state))
            momentum_list.append(compute_momentum_signal(df, crop, state))
            quality_list.append(compute_forecast_quality(crop, state, len(df), vol["cv"]))

        except Exception:
            continue

    # Sort for display priority
    anomalies.sort(key=lambda x: abs(x.get("z_score", 0)), reverse=True)
    volatility_rank.sort(key=lambda x: x.get("cv", 0), reverse=True)
    momentum_list.sort(key=lambda x: abs(x.get("score", 0)), reverse=True)
    quality_list.sort(key=lambda x: x.get("score", 0), reverse=True)

    result = {
        "computed_at":      str(pd.Timestamp.now().date()),
        "anomalies":        anomalies[:10],    # most severe across all crops
        "volatility":       volatility_rank,
        "seasonal":         seasonal_list,
        "momentum":         momentum_list,
        "forecast_quality": quality_list,
    }

    cache_set(CACHE_KEY, result)
    return result


@router.get("/market-pulse")
def get_market_pulse() -> list[dict]:
    """
    Returns 30-day price pulse for all Tier-1 crops across South India.

    Aggregates all South Indian states per crop (no state filter) to give
    a pan-South-India market view. In-memory cached after first request.

    Per crop returns:
      crop, avg_price (30d), avg_7d, change_pct (7d vs prior 30d),
      volatility_pct (CV), volatility_level, trend, sparkline (30 pts),
      total_days (dataset size), last_date
    """
    from backend.cache.query_cache import cache_get, cache_set
    from backend.data.loaders.duckdb_queries import query_for_forecast
    from backend.utils.constants import TIER1_CROPS

    CACHE_KEY = "market_pulse_v1"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    results = []
    for crop in TIER1_CROPS:
        try:
            df = query_for_forecast(crop)   # no state → all South Indian states
            if df.empty or len(df) < 14:
                continue

            df = df.sort_values("ds").reset_index(drop=True)
            n  = len(df)

            avg_7d     = float(df["y"].iloc[max(0, n - 7):].mean())
            avg_30d    = float(df["y"].iloc[max(0, n - 30):].mean())
            prior_avg  = float(df["y"].iloc[max(0, n - 60): max(0, n - 30)].mean()) \
                         if n >= 60 else avg_30d

            change_pct = round((avg_7d - prior_avg) / prior_avg * 100, 1) \
                         if prior_avg > 0 else 0.0
            cv = round(float(df["y"].std() / df["y"].mean() * 100), 1) \
                 if df["y"].mean() > 0 else 0.0

            trend = (
                "rising"  if change_pct >  3 else
                "falling" if change_pct < -3 else
                "stable"
            )
            volatility_level = (
                "low"    if cv < 25 else
                "medium" if cv < 45 else
                "high"
            )

            sparkline = [
                {"date": str(row.ds.date()), "price": round(float(row.y), 0)}
                for row in df.tail(30).itertuples()
            ]

            results.append({
                "crop":             crop,
                "avg_price":        round(avg_30d, 0),
                "avg_7d":           round(avg_7d, 0),
                "change_pct":       change_pct,
                "volatility_pct":   cv,
                "volatility_level": volatility_level,
                "trend":            trend,
                "sparkline":        sparkline,
                "total_days":       n,
                "last_date":        str(df["ds"].max().date()),
            })
        except Exception:
            continue

    # Never cache an empty pulse — a transient failure would poison the cache
    if results:
        cache_set(CACHE_KEY, results)
    return results


def _price_history(crop: str, state: str, limit: int) -> list[dict]:
    from backend.data.loaders.duckdb_queries import query_for_forecast
    from backend.utils.validators import validate_crop, validate_state

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    df = query_for_forecast(crop, state)
    if df.empty:
        return []

    df = df.tail(limit).copy()
    df["date"]        = df["ds"].astype(str)
    df["modal_price"] = df["y"].round(2)
    return df[["date", "modal_price"]].to_dict(orient="records")


@router.get("/history")
def get_price_history_q(
    crop: str = Query(..., description="Crop name (alias-aware)"),
    state: str = Query(..., description="South Indian state"),
    limit: int = Query(default=120, ge=7, le=365, description="Number of most-recent days to return"),
) -> list[dict]:
    """
    Query-param variant of /history/{crop}/{state}.

    Required for crops whose canonical names contain '/'
    (e.g. 'Arecanut (Betelnut/Supari)') — an encoded slash (%2F) in a path
    segment is rejected by the router with 404 before the handler runs.
    """
    return _price_history(crop, state, limit)


@router.get("/history/{crop}/{state}")
def get_price_history(
    crop: str,
    state: str,
    limit: int = Query(default=120, ge=7, le=365, description="Number of most-recent days to return"),
) -> list[dict]:
    """
    Return the last `limit` days of daily-aggregated modal prices for a crop and state.
    Uses the same query_for_forecast() pipeline (outlier-filtered, deduplicated per day).
    """
    return _price_history(crop, state, limit)


@router.get("/cross-crop-analytics")
def get_cross_crop_analytics() -> dict:
    """
    Cross-crop comparative analytics for all Phase 4 crops (Tier 1 + Tier 2 + Tier 3).

    Per crop returns: avg_price, volatility, momentum, seasonal phase, forecast readiness.
    Also derives market_leaders from the computed data:
      highest_price, fastest_rising, most_stable, most_volatile, best_forecast.

    Cached after first call (~12s cold → ~10ms hot).
    """
    from backend.cache.query_cache import cache_get, cache_set
    from backend.data.loaders.duckdb_queries import query_for_forecast
    from backend.data.analytics import (
        detect_price_anomalies,
        compute_volatility_metrics,
        compute_momentum_signal,
        compute_seasonal_profile,
        compute_forecast_quality,
        classify_forecast_tier,
    )
    from backend.utils.crop_registry import ALL_CROPS, CROP_REGISTRY

    CACHE_KEY = "cross_crop_analytics_v3"  # bumped: Phase 1 tier architecture (27 crops)
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    # Dataset end anchors the recency window — recency must be measured
    # against "now", not each crop's own last record, or dead series look fresh.
    latest_row = db_manager.execute(
        'SELECT MAX(TRY_CAST("Arrival_Date" AS DATE)) FROM prices'
    ).fetchone()
    dataset_end = pd.Timestamp(latest_row[0])

    crop_data: list[dict] = []

    for crop in ALL_CROPS:
        info  = CROP_REGISTRY[crop]
        state = info.home_state
        try:
            df = query_for_forecast(crop, state)
            if df.empty or len(df) < 14:
                crop_data.append({
                    "crop": crop, "state": state, "category": info.category,
                    "has_analytics": False, "training_days": 0,
                    "tier": "D", "readiness": "Analytics Only",
                    "readiness_level": "analytics", "method": "none",
                })
                continue

            df   = df.sort_values("ds").reset_index(drop=True)
            recent_days = int((df["ds"] >= dataset_end - pd.Timedelta(days=365)).sum())

            vol  = compute_volatility_metrics(df, crop, state)
            mom  = compute_momentum_signal(df, crop, state)
            seas = compute_seasonal_profile(df, crop, state)
            qual = compute_forecast_quality(crop, state, len(df), vol["cv"])
            tier = classify_forecast_tier(crop, state, len(df), recent_days, vol["cv"])
            anomalies = detect_price_anomalies(df, crop, state, lookback_days=90)

            crop_data.append({
                "crop":              crop,
                "state":             state,
                "category":          info.category,
                "has_analytics":     True,
                "training_days":     len(df),
                "recent_days_365":   recent_days,
                "continuity_score":  tier["continuity_score"],
                "avg_price":         round(float(df["y"].tail(30).mean()), 0),
                "avg_7d":            mom["avg_7d"],
                "tier":              tier["tier"],
                "method":            tier["method"],
                "readiness":         tier["readiness"],
                "readiness_level":   tier["level"],
                "forecast_eligible": tier["forecast_eligible"],
                "volatility_cv":     vol["cv"],
                "volatility_level":  vol["level"],
                "volatility_badge":  vol["badge"],
                "momentum_signal":   mom["signal"],
                "momentum_short":    mom["short"],
                "momentum_score":    mom["score"],
                "anomaly_count_90d": len(anomalies),
                "current_phase":     seas.get("current_phase", "normal") if not seas.get("error") else "normal",
                "current_vs_norm":   seas.get("current_vs_norm", 0)      if not seas.get("error") else 0,
                "peak_months":       seas.get("peak_months", [])         if not seas.get("error") else [],
                "reliability":       qual["reliability"],
                "reliability_score": qual["score"],
            })
        except Exception:
            crop_data.append({
                "crop": crop, "state": state, "category": info.category,
                "has_analytics": False, "training_days": 0,
                "tier": "D", "readiness": "Analytics Only",
                "readiness_level": "analytics", "method": "none",
            })

    available = [c for c in crop_data if c.get("has_analytics")]

    def _pick(seq, key, reverse=True):
        return sorted(seq, key=lambda c: c.get(key, 0), reverse=reverse)[0] if seq else None

    result = {
        "computed_at": str(pd.Timestamp.now().date()),
        "crops":       crop_data,
        "market_leaders": {
            "highest_price":  _pick(available, "avg_price",         reverse=True),
            "fastest_rising": _pick(available, "momentum_score",    reverse=True),
            "most_stable":    _pick(available, "volatility_cv",     reverse=False),
            "most_volatile":  _pick(available, "volatility_cv",     reverse=True),
            "best_forecast":  _pick(available, "reliability_score", reverse=True),
        },
    }
    cache_set(CACHE_KEY, result)
    return result


@router.get("/heatmap-data")
def get_heatmap_data() -> dict:
    """
    Crops × States coverage matrix for the Multi-Crop Heatmap.
    Returns distinct_days, avg_price, last_date per crop × state.
    Used to visualise data richness across the South Indian agricultural market.
    Single SQL query — cached after first call.
    """
    from backend.cache.query_cache import cache_get, cache_set
    from backend.data.loaders.duckdb_queries import query_coverage_matrix
    from backend.utils.constants import ALL_RECOMMENDED_CROPS

    CACHE_KEY = "heatmap_data_v1"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    try:
        df = query_coverage_matrix(crops=ALL_RECOMMENDED_CROPS)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database not ready: {exc}")

    result = {
        "computed_at": str(pd.Timestamp.now().date()),
        "matrix":      df.to_dict(orient="records"),
    }
    cache_set(CACHE_KEY, result)
    return result


@router.get("/", response_model=list[PriceRecord])
def get_prices(
    crop: str = Query(..., description="Crop name, e.g. Tomato"),
    state: str | None = Query(None),
    market: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(100, le=1000),
) -> list[PriceRecord]:
    # TODO Phase 2: query via data/loaders/duckdb_queries.py query_prices()
    raise NotImplementedError("Implement price query in Phase 2")


@router.get("/summary", response_model=PriceSummary)
def get_price_summary(
    crop: str = Query(...),
    state: str | None = Query(None),
) -> PriceSummary:
    # TODO Phase 2: query via duckdb_queries.query_price_summary()
    raise NotImplementedError("Implement price summary in Phase 2")


@router.get("/latest")
def get_latest_prices(crops: list[str] = Query(default=[])):
    # TODO Phase 2: query via duckdb_queries.query_latest_prices()
    raise NotImplementedError("Implement latest prices in Phase 2")
