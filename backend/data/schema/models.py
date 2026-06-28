"""
Pydantic models for API request/response validation.
Column names match the lowercase aliases used in duckdb_queries.py output.
"""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ── Price Models ───────────────────────────────────────────────────────────

class PriceRecord(BaseModel):
    date: date
    crop: str
    state: str
    market: str
    min_price: float  = Field(..., description="Min price Rs/quintal")
    max_price: float  = Field(..., description="Max price Rs/quintal")
    modal_price: float = Field(..., description="Modal (most common) price Rs/quintal")


class PriceSummary(BaseModel):
    crop: str
    state: str | None
    period_start: date
    period_end: date
    min_price: float
    max_price: float
    avg_price: float
    stddev_price: float
    distinct_days: int
    total_records: int
    price_trend: Literal["rising", "falling", "stable"] | None = None


# ── Forecast Models ────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    crop: str
    state: str | None = None
    market: str | None = None
    days: int = Field(default=90, ge=7, le=365)
    model: Literal["prophet", "xgboost"] = "prophet"
    # start_date lets callers override the training window start
    start_date: date | None = None


class ForecastPoint(BaseModel):
    date: date
    predicted_price: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    crop: str
    state: str | None
    model: str
    generated_at: str
    training_rows: int
    forecast: list[ForecastPoint]
    accuracy_metrics: dict[str, float] | None = None
    # Phase 1 tier architecture (optional — absent in pre-Phase-1 cache entries)
    tier: str | None = None              # A | B | C
    method: str | None = None            # prophet | sparse_trend
    diagnostics: dict | None = None      # continuity_score, cv, recency, ...


# ── AI Advisor Models ──────────────────────────────────────────────────────

class AdvisorRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    crop: str | None = None
    state: str | None = None
    include_price_context: bool = True
    session_id: str | None = None
    view_mode: str | None = None  # Phase 3B — "farmer"|"trader"|"wholesale"|"analyst" (scaffold)


class AdvisorResponse(BaseModel):
    answer: str
    model_used: str
    sources: list[str] = []
    session_id: str
    intent: str = "unknown"
    inferred_context: list[str] = []
    error_type: str | None = None   # None = success; see GeminiResult docstring
    latency_ms: float = 0.0
    grounded: bool = False          # True when real DuckDB data was injected
    agent_insights: dict = Field(default_factory=dict)  # Phase 2B — agent signals
    reasoning_trace: str | None = None  # Phase 4A — compact engine reasoning summary
    persona: str | None = None          # Phase 4A — active analyst mode label


# ── Dataset Info ───────────────────────────────────────────────────────────

class DatasetStats(BaseModel):
    total_rows: str
    unique_crops: int
    unique_states: int
    earliest_date: str
    latest_date: str
