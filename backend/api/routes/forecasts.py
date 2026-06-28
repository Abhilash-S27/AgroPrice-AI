"""
Forecast API routes.

Phase 3:  GET /{crop}/{state} — Prophet forecast for any validated crop+state
Phase 4B: GET /coverage       — forecast readiness matrix
Phase 1 (stabilization):
  - 27-crop registry with aliases (no more "Unknown crop" for real crops)
  - per-request tier classification (A/B/C/D) on the ACTUAL crop+state series
  - Tier C crops get an honest sparse-trend fallback instead of a broken page
  - diagnostics metadata in every forecast response
  - /coverage grouped by crop category
"""
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from backend.cache.forecast_cache import get_cached_forecast, save_forecast_cache
from backend.core.config import settings
from backend.core.database import db_manager
from backend.core.logger import get_logger
from backend.data.loaders.duckdb_queries import query_for_forecast
from backend.data.schema.models import ForecastPoint, ForecastResponse
from backend.ml.forecasting.prophet_model import ProphetForecaster
from backend.ml.forecasting.sparse_trend import SparseTrendForecaster
from backend.utils.crop_registry import (
    ALL_CROPS,
    CATEGORY_LABELS,
    CROP_REGISTRY,
    crops_by_category,
)
from backend.utils.validators import validate_crop, validate_state

logger = get_logger(__name__)
router = APIRouter()


# ── Coverage registry ────────────────────────────────────────────────────────

@router.get("/coverage")
def get_forecast_coverage() -> dict:
    """
    Category-grouped forecast tier registry for all 27 supported crops.

    Derives from the cross-crop-analytics in-memory cache when warm (~5 ms).
    Before analytics warm-up it returns a registry stub (legacy Tier-1 crops
    marked forecastable) which is intentionally NOT cached, so the first
    warm call replaces it with real data.

    Response:
      computed_at, total_crops,
      tier_counts        — {A, B, C, D}
      categories         — [{key, label, crops:[<coverage record>]}]
      crops              — flat list (back-compat with Phase 4B consumers)
      forecast_enabled / limited_forecast / analytics_only — legacy counts
    """
    from backend.cache.query_cache import cache_get, cache_set

    CACHE_KEY = "forecast_coverage_v2"
    cached = cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    cc = cache_get("cross_crop_analytics_v3")
    if cc:
        coverage = []
        for c in cc.get("crops", []):
            coverage.append({
                "crop":              c["crop"],
                "state":             c.get("state", ""),
                "category":          c.get("category", "vegetable"),
                "tier":              c.get("tier", "D"),
                "method":            c.get("method", "none"),
                "readiness":         c.get("readiness", "Analytics Only"),
                "level":             c.get("readiness_level", "analytics"),
                "forecast_eligible": c.get("forecast_eligible", False),
                "training_days":     c.get("training_days"),
                "recent_days_365":   c.get("recent_days_365"),
                "continuity_score":  c.get("continuity_score"),
                "cv":                c.get("volatility_cv"),
                "anomaly_count_90d": c.get("anomaly_count_90d"),
                "avg_price":         c.get("avg_price"),
                "reliability":       c.get("reliability"),
                "reliability_score": c.get("reliability_score"),
            })
        is_stub = False
    else:
        # Cold-start stub from the registry — never cached.
        legacy_tier1 = {"Tomato", "Onion", "Banana", "Brinjal", "Green Chilli"}
        coverage = [
            {
                "crop":              crop,
                "state":             CROP_REGISTRY[crop].home_state,
                "category":          CROP_REGISTRY[crop].category,
                "tier":              "A" if crop in legacy_tier1 else "D",
                "method":            "prophet" if crop in legacy_tier1 else "none",
                "readiness":         "Full Forecast" if crop in legacy_tier1 else "Analytics Only",
                "level":             "forecast" if crop in legacy_tier1 else "analytics",
                "forecast_eligible": crop in legacy_tier1,
                "training_days":     None,
                "recent_days_365":   None,
                "continuity_score":  None,
                "cv":                None,
                "anomaly_count_90d": None,
                "avg_price":         None,
                "reliability":       None,
                "reliability_score": None,
            }
            for crop in ALL_CROPS
        ]
        is_stub = True

    by_crop = {c["crop"]: c for c in coverage}
    categories = [
        {
            "key":   key,
            "label": CATEGORY_LABELS[key],
            "crops": [by_crop[name] for name in names if name in by_crop],
        }
        for key, names in crops_by_category().items()
    ]
    tier_counts = {t: sum(1 for c in coverage if c["tier"] == t) for t in "ABCD"}

    result = {
        "computed_at":      str(pd.Timestamp.now().date()),
        "total_crops":      len(coverage),
        "tier_counts":      tier_counts,
        "categories":       categories,
        "crops":            coverage,
        # legacy counters (Phase 4B consumers)
        "forecast_enabled": sum(1 for c in coverage if c["level"] == "forecast"),
        "limited_forecast": sum(1 for c in coverage if c["level"] == "limited"),
        "analytics_only":   sum(1 for c in coverage if c["level"] == "analytics"),
    }
    if not is_stub:
        cache_set(CACHE_KEY, result)
    return result


# ── Forecast generation ──────────────────────────────────────────────────────

def _build_response(
    crop: str,
    state: str,
    forecaster,
    forecast_df: pd.DataFrame,
    tier_info: dict,
) -> ForecastResponse:
    points = [
        ForecastPoint(
            date=row.ds.date(),
            predicted_price=round(float(row.yhat), 2),
            lower_bound=round(float(row.yhat_lower), 2),
            upper_bound=round(float(row.yhat_upper), 2),
        )
        for row in forecast_df.itertuples(index=False)
    ]
    return ForecastResponse(
        crop=crop,
        state=state,
        model=forecaster.get_model_name(),
        generated_at=datetime.now(timezone.utc).isoformat(),
        training_rows=forecaster.training_rows,
        forecast=points,
        accuracy_metrics=None,
        tier=tier_info["tier"],
        method=tier_info["method"],
        diagnostics={
            "training_days":    tier_info["training_days"],
            "recent_days_365":  tier_info["recent_days_365"],
            "continuity_score": tier_info["continuity_score"],
            "cv":               tier_info["cv"],
            "readiness":        tier_info["readiness"],
        },
    )


def _generate_forecast(crop: str, state: str, days: int) -> ForecastResponse:
    """
    Tier-aware price forecast for a crop in a South Indian state.

    The crop+state series is classified at request time:
      Tier A/B → Prophet (full / moderate confidence)
      Tier C   → sparse-trend fallback (robust trend + seasonal approximation)
      Tier D   → 422 with a structured analytics-only hint (the UI renders
                 its analytics fallback — never a broken page)

    Crop names are alias-aware: 'Black Pepper', 'cardamom', 'bitter gourd'
    all resolve to their canonical dataset names.
    """
    from backend.data.analytics import classify_forecast_tier

    try:
        crop = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    logger.info("forecast_requested", crop=crop, state=state, days=days)

    # ── Cache check (either method) ─────────────────────────────────────────
    for model_name in ("prophet", "sparse_trend"):
        cached = get_cached_forecast(crop, state, days, model_name)
        if cached:
            return ForecastResponse.model_validate(cached)

    # ── Load series & classify the ACTUAL crop+state pair ───────────────────
    df = query_for_forecast(crop, state)

    if df.empty or len(df) < settings.MIN_DATA_POINTS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Insufficient historical data for {crop} in {state}: "
                f"{len(df)} days available (minimum {settings.MIN_DATA_POINTS}). "
                "Analytics-only mode applies."
            ),
        )

    df = df.sort_values("ds").reset_index(drop=True)

    latest_row = db_manager.execute(
        'SELECT MAX(TRY_CAST("Arrival_Date" AS DATE)) FROM prices'
    ).fetchone()
    dataset_end = pd.Timestamp(latest_row[0])
    recent_days = int((df["ds"] >= dataset_end - pd.Timedelta(days=365)).sum())

    y = df["y"]
    cv = float(y.std() / y.mean() * 100) if y.mean() > 0 else 0.0
    tier_info = classify_forecast_tier(crop, state, len(df), recent_days, cv)

    logger.info(
        "forecast_tier_classified",
        crop=crop, state=state, tier=tier_info["tier"],
        training_days=len(df), recent_days=recent_days, cv=round(cv, 1),
    )

    if tier_info["tier"] == "D":
        raise HTTPException(
            status_code=422,
            detail=(
                f"{crop} in {state} has too little usable history for any "
                f"forecast ({len(df)} days, continuity "
                f"{tier_info['continuity_score']}%). Analytics-only mode applies."
            ),
        )

    # ── Fit the tier-appropriate model ──────────────────────────────────────
    if tier_info["tier"] == "C":
        forecaster = SparseTrendForecaster()
    else:
        forecaster = ProphetForecaster()

    try:
        forecaster.fit(df)
        forecast_df = forecaster.predict(days)
    except Exception as exc:
        logger.error("forecast_failed", crop=crop, state=state, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Forecast model error: {exc}")

    response = _build_response(crop, state, forecaster, forecast_df, tier_info)

    save_forecast_cache(
        crop, state, days, forecaster.get_model_name(),
        response.model_dump(mode="json"),
    )
    logger.info(
        "forecast_complete",
        crop=crop, state=state, tier=tier_info["tier"],
        model=forecaster.get_model_name(),
        training_rows=forecaster.training_rows, forecast_days=days,
    )
    return response


@router.get("/by", response_model=ForecastResponse)
def forecast_by_query(
    crop: str = Query(..., description="Crop name (alias-aware)"),
    state: str = Query(..., description="South Indian state"),
    days: int = Query(default=30, ge=7, le=365, description="Number of days to forecast"),
) -> ForecastResponse:
    """
    Query-param variant of /{crop}/{state}.

    Required for crops whose canonical names contain '/'
    (e.g. 'Arecanut (Betelnut/Supari)') — an encoded slash (%2F) in a path
    segment is rejected by the router with 404 before the handler runs.
    """
    return _generate_forecast(crop, state, days)


@router.get("/{crop}/{state}", response_model=ForecastResponse)
def forecast_crop_state(
    crop: str,
    state: str,
    days: int = Query(default=30, ge=7, le=365, description="Number of days to forecast"),
) -> ForecastResponse:
    """Path variant — see _generate_forecast for behaviour."""
    return _generate_forecast(crop, state, days)
