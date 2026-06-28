# AgroPrice AI

**South Indian Agricultural Market Intelligence Platform**

An AI-powered platform for crop price analysis, forecasting, and market insights across Tamil Nadu, Karnataka, Andhra Pradesh, Kerala, and Telangana — covering 2015–2026.

---

## Overview

AgroPrice AI combines:
- **DuckDB** for fast analytical queries on parquet datasets
- **Prophet + XGBoost** for time-series price forecasting
- **Claude / Gemini** as an AI agricultural advisor
- **FastAPI** backend with clean REST endpoints
- **React + Tailwind + Recharts** frontend dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Zustand |
| Backend | FastAPI, Uvicorn, Pydantic v2 |
| Data Engine | DuckDB, PyArrow, Pandas |
| ML Forecasting | Prophet, XGBoost, scikit-learn |
| AI Advisor | Anthropic Claude API, Google Gemini API |
| Reports | openpyxl (Excel), ReportLab (PDF) |
| Dataset Format | Apache Parquet |

---

## Project Structure

```
AgroPrice-AI/
├── backend/            FastAPI application (API, ML, AI, data, cache, reports)
├── frontend/           React application (dashboard, charts, advisor UI)
├── data/
│   ├── raw/parquet/    ← Place your parquet files here
│   ├── processed/      DuckDB-ready cleaned datasets
│   └── cache/          Forecast & query cache files
├── notebooks/          Jupyter EDA and model experiments
├── tests/              Pytest test suite
├── scripts/            Data ingestion and maintenance scripts
└── docs/               Architecture and API documentation
```

---

## Parquet Dataset Placement

Place all parquet files under:
```
data/raw/parquet/
```

Recommended naming convention:
```
data/raw/parquet/
├── tomato_2015_2020.parquet
├── tomato_2021_2026.parquet
├── onion_2015_2026.parquet
├── rice_tamilnadu_2015_2026.parquet
└── ...
```

See [docs/data_schema.md](docs/data_schema.md) for the expected column schema.

---

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r ../requirements.txt
cp ../.env.example ../.env     # Fill in your API keys
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

API docs available at: `http://localhost:8000/docs`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `DATA_PATH` | Absolute path to `data/` directory |
| `DUCKDB_PATH` | Path for persistent DuckDB file |
| `CACHE_TTL_HOURS` | How long to cache forecasts (default: 24) |

---

## Data Coverage

- **Crops**: Tomato, Onion, Rice, Wheat, Ragi, Banana, Coconut, Chilli, Turmeric, and more
- **States**: Tamil Nadu, Karnataka, Andhra Pradesh, Kerala, Telangana
- **Markets**: Major APMC mandis across South India
- **Period**: January 2015 – December 2026

---

## Architecture Decisions

- **DuckDB over SQLite**: Columnar storage is 10-100x faster for analytical queries on price time-series
- **Parquet as source of truth**: Portable, compressed, schema-preserving; works natively with DuckDB
- **Prophet for forecasting**: Handles seasonality, holidays (harvest cycles), and missing data well
- **File-based cache**: No Redis dependency; JSON/parquet cache files are sufficient for forecast results
- **Pydantic v2 settings**: Type-safe config management with `.env` support
- **Zustand over Redux**: Lightweight state management — no boilerplate for this scale

---

## Contributing

This is a student research project for MCA (AI specialization). See [docs/architecture.md](docs/architecture.md) for detailed design decisions.
