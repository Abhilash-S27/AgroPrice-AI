"""
Model registry: maps model names to forecaster classes.
Add new models here when they are ready — routes and caches resolve by name.
"""
from backend.ml.forecasting.base import BaseForecaster
from backend.ml.forecasting.prophet_model import ProphetForecaster
from backend.ml.forecasting.xgboost_model import XGBoostForecaster

_REGISTRY: dict[str, type[BaseForecaster]] = {
    "prophet": ProphetForecaster,
    "xgboost": XGBoostForecaster,
}


def get_forecaster(model_name: str) -> BaseForecaster:
    """Instantiate and return a forecaster by name."""
    cls = _REGISTRY.get(model_name.lower())
    if cls is None:
        available = list(_REGISTRY.keys())
        raise ValueError(f"Unknown model '{model_name}'. Available: {available}")
    return cls()


def list_models() -> list[str]:
    return list(_REGISTRY.keys())
