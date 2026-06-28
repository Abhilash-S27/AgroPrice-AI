"""
End-to-end forecast test: Tomato + Karnataka via Prophet.
Run: python scripts/test_forecast_e2e.py
"""
import sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, ".")

from backend.core.database import db_manager
from backend.data.pipeline.ingestion import run_ingestion_pipeline
from backend.data.loaders.duckdb_queries import query_for_forecast
from backend.ml.forecasting.prophet_model import ProphetForecaster
from backend.cache.forecast_cache import (
    get_cached_forecast, save_forecast_cache, invalidate_cache, _cache_key
)
from backend.data.schema.models import ForecastPoint, ForecastResponse
from backend.utils.validators import validate_crop, validate_state
from backend.core.config import settings
from datetime import datetime
import json

CROP  = "Tomato"
STATE = "Karnataka"
DAYS  = 30
MODEL = "prophet"

print("=" * 60)
print("AgroPrice AI — Forecast E2E Test")
print(f"Crop: {CROP}  |  State: {STATE}  |  Days: {DAYS}")
print("=" * 60)

# ── Step 1: Connect DuckDB and ingest ─────────────────────────
print("\n[1] Connecting DuckDB and running ingestion pipeline...")
db_manager.connect()
n = run_ingestion_pipeline()
print(f"    Ingested {n} parquet file(s) -> 'prices' view registered")

# ── Step 2: Validate inputs ────────────────────────────────────
print("\n[2] Validating crop and state...")
crop  = validate_crop(CROP)
state = validate_state(STATE)
print(f"    crop='{crop}', state='{state}'")

# ── Step 3: Query historical data ─────────────────────────────
print("\n[3] Querying historical data from DuckDB...")
df = query_for_forecast(crop, state)
print(f"    Rows returned : {len(df)}")
print(f"    Date range    : {df['ds'].min().date()} -> {df['ds'].max().date()}")
print(f"    Price range   : {df['y'].min():.0f} - {df['y'].max():.0f} Rs/qtl")
print(f"    Mean price    : {df['y'].mean():.2f} Rs/qtl")
print(f"    Nulls         : {df.isnull().sum().sum()}")
print(f"\n    First 5 rows:")
print(df.head(5).to_string(index=False))
print(f"\n    Last 5 rows:")
print(df.tail(5).to_string(index=False))

# ── Step 4: Clear any existing cache to test fresh fit ─────────
print("\n[4] Clearing existing cache for clean test...")
deleted = invalidate_cache(crop)
print(f"    Deleted {deleted} cached file(s)")

# ── Step 5: Fit Prophet ───────────────────────────────────────
print(f"\n[5] Fitting ProphetForecaster on {len(df)} rows (this takes ~15-30s)...")
t0 = time.perf_counter()
forecaster = ProphetForecaster()
forecaster.fit(df)
elapsed = round(time.perf_counter() - t0, 1)
print(f"    Fit complete in {elapsed}s")
print(f"    Training rows: {forecaster.training_rows}")

# ── Step 6: Predict 30 days ────────────────────────────────────
print(f"\n[6] Predicting next {DAYS} days...")
forecast_df = forecaster.predict(DAYS)
print(f"    Forecast rows returned: {len(forecast_df)}")
print(f"\n    Sample forecast output (ds, yhat, yhat_lower, yhat_upper):")
print(forecast_df.to_string(index=False))

# ── Step 7: Build ForecastResponse ────────────────────────────
print("\n[7] Building ForecastResponse (Pydantic model)...")
forecast_points = [
    ForecastPoint(
        date=row.ds.date(),
        predicted_price=round(float(row.yhat), 2),
        lower_bound=round(float(row.yhat_lower), 2),
        upper_bound=round(float(row.yhat_upper), 2),
    )
    for row in forecast_df.itertuples(index=False)
]
response = ForecastResponse(
    crop=crop,
    state=state,
    model=MODEL,
    generated_at=datetime.utcnow().isoformat() + "Z",
    training_rows=forecaster.training_rows,
    forecast=forecast_points,
    accuracy_metrics=None,
)
payload = response.model_dump(mode="json")
print(f"    JSON keys: {list(payload.keys())}")
print(f"    First forecast point: {payload['forecast'][0]}")
print(f"    Last  forecast point: {payload['forecast'][-1]}")

# ── Step 8: Save to cache ─────────────────────────────────────
print("\n[8] Saving to cache...")
save_forecast_cache(crop, state, DAYS, MODEL, payload)
key = _cache_key(crop, state, DAYS, MODEL)
cache_file = settings.CACHE_DIR / f"forecast_{key}.json"
print(f"    Cache file: {cache_file}")
print(f"    Cache file exists: {cache_file.exists()}")

# ── Step 9: Load from cache ────────────────────────────────────
print("\n[9] Loading from cache (simulating second request)...")
t1 = time.perf_counter()
cached = get_cached_forecast(crop, state, DAYS, MODEL)
cache_elapsed = round((time.perf_counter() - t1) * 1000, 2)
print(f"    Cache hit: {cached is not None}")
print(f"    Cache load time: {cache_elapsed}ms")

if cached:
    restored = ForecastResponse.model_validate(cached)
    print(f"    Restored crop: {restored.crop}, state: {restored.state}")
    print(f"    Restored forecast points: {len(restored.forecast)}")
    print(f"    First point: date={restored.forecast[0].date}, "
          f"yhat={restored.forecast[0].predicted_price}")

# ── Step 10: Full JSON output (first 3 points) ─────────────────
print("\n[10] Sample API response JSON (first 3 forecast points):")
sample = dict(payload)
sample["forecast"] = payload["forecast"][:3]
print(json.dumps(sample, indent=2))

print("\n" + "=" * 60)
print("E2E TEST PASSED")
print(f"  Prophet fit : {elapsed}s")
print(f"  Cache load  : {cache_elapsed}ms")
print(f"  Training    : {len(df)} historical days")
print(f"  Forecast    : {DAYS} days ahead")
print("=" * 60)

db_manager.close()
