# AgroPrice AI — Architecture Document

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                      │
│  Dashboard │ Forecast │ CropExplorer │ Reports │ AI Advisor  │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP / REST (Axios)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  FastAPI Backend                              │
│                                                              │
│  /api/prices   /api/forecasts   /api/crops                  │
│  /api/reports  /api/advisor                                 │
│                                                              │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Data    │  │    ML      │  │   AI     │  │  Cache   │  │
│  │  Layer   │  │  Layer     │  │  Layer   │  │  Layer   │  │
│  │ DuckDB   │  │ Prophet    │  │ Claude   │  │ JSON     │  │
│  │ Parquet  │  │ XGBoost    │  │ Gemini   │  │ TTLCache │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┘
         │
┌────────▼────────────────────┐
│   data/raw/parquet/*.parquet │  ← Source of truth
│   data/processed/            │  ← Cleaned output
│   data/cache/                │  ← Forecast results
└──────────────────────────────┘
```

## Key Architectural Decisions

### 1. DuckDB as the analytical engine
DuckDB reads parquet files directly via SQL without needing to load everything into memory.
For a dataset spanning 2015–2026 across 5 states and 16 crops, this gives 10-100x faster
aggregation than pandas `read_csv` + `groupby`.

### 2. Parquet as the data format
- Schema-preserving (column types survive round-trips)
- Columnar — DuckDB can read only the columns it needs
- Compressed — typically 5-10x smaller than equivalent CSV
- Industry standard for analytical workloads

### 3. File-based forecast cache (no Redis)
Forecast cache files live in `data/cache/*.json`. TTL is enforced on read.
This is sufficient for a research project — Redis adds operational complexity
with no benefit until the system serves multiple concurrent users.

### 4. Abstract base classes for ML + AI
`BaseForecaster` and `BaseAdvisor` define the interfaces.
Adding a new model (e.g., SARIMA, LightGBM) or a new AI provider (e.g., OpenAI)
requires only: implement the interface, register in the registry.

### 5. Zustand over Redux
No boilerplate. No providers. The app has 3 pages with shared filter state —
Zustand's minimal API is the right fit. Redux would be justified at 10+ stores.

### 6. Vite proxy for local development
`vite.config.js` proxies `/api/*` to `localhost:8000`, so the frontend dev
server never touches CORS issues during development.

## Data Flow

```
Parquet files
    → DuckDB view registration (startup)
    → Unified 'prices' SQL view
    → DuckDB queries (duckdb_queries.py)
    → Pydantic models (schema/models.py)
    → FastAPI JSON response
    → Axios service layer (priceService.js)
    → Zustand store (usePriceStore.js)
    → Recharts component
```

## Forecast Flow

```
API request → check forecast_cache.py
  cache HIT  → return JSON directly
  cache MISS →
    → duckdb_queries.query_for_forecast()
    → pipeline/transformer.prepare_for_prophet()
    → ProphetForecaster.fit() + .predict()
    → ml/evaluation/metrics.all_metrics()
    → save to forecast_cache.py
    → return ForecastResponse
```

## Phase Roadmap

| Phase | Focus |
|---|---|
| 1 (current) | Architecture, config, schema |
| 2 | Parquet ingestion, price API, DuckDB queries |
| 3 | Prophet forecasting, forecast cache, forecast API |
| 4 | XGBoost model, PDF/Excel reports |
| 5 | Claude/Gemini AI advisor integration |
| 6 | Frontend dashboard with live data |
