"""Smoke test for all modified modules after cleanup."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from backend.utils.constants import KHARIF_MONTHS, RABI_MONTHS, ALL_RECOMMENDED_CROPS, SOUTH_INDIAN_STATES
from backend.utils.validators import validate_crop, validate_state
from backend.utils.date_utils import get_date_range, is_harvest_period, format_date_label
from backend.utils.price_utils import classify_trend, quintal_to_kg
from backend.core.database import db_manager
from backend.core.config import settings
from backend.data.schema.models import PriceRecord, ForecastRequest, AdvisorRequest
from backend.api.routes import prices, forecasts, advisor, crops, reports
from backend.ai.advisor.claude_advisor import ClaudeAdvisor
from backend.ai.advisor.gemini_advisor import GeminiAdvisor
from backend.ml.models.registry import get_forecaster, list_models
from backend.cache.forecast_cache import get_cached_forecast, save_forecast_cache
from datetime import date

print("All imports OK")
print(f"KHARIF_MONTHS = {sorted(KHARIF_MONTHS)}")
print(f"RABI_MONTHS   = {sorted(RABI_MONTHS)}")
print(f"is_harvest_period(Jun 15) = {is_harvest_period(date(2024, 6, 15))}")
print(f"is_harvest_period(May 15) = {is_harvest_period(date(2024, 5, 15))}")
print(f"validate_state('Tamil Nadu') = {validate_state('Tamil Nadu')}")
print(f"validate_crop('Tomato') = {validate_crop('Tomato')}")
print(f"list_models() = {list_models()}")
print(f"ClaudeAdvisor.get_provider_name() = {ClaudeAdvisor().get_provider_name()}")
print(f"GeminiAdvisor.get_provider_name() = {GeminiAdvisor().get_provider_name()}")
print(f"db_manager has register_parquet = {hasattr(db_manager, 'register_parquet')}")
print("\nSmoke test PASSED")
