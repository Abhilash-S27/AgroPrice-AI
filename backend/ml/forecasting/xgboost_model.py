"""
XGBoost-based price forecasting model.
Phase 2+ — requires feature engineering from data/pipeline/transformer.py.
Kept as a stub to establish the interface now.
"""
import pandas as pd

from backend.ml.forecasting.base import BaseForecaster


class XGBoostForecaster(BaseForecaster):
    """
    XGBoost recursive multi-step forecaster.
    Uses lag features, rolling statistics, and time features as inputs.
    Better than Prophet for non-seasonal volatile crops (e.g., tomato).
    """

    def __init__(self, n_estimators: int = 300, max_depth: int = 6, learning_rate: float = 0.05):
        self._model = None
        self._is_fitted = False
        self._config = {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "learning_rate": learning_rate,
        }

    def fit(self, df: pd.DataFrame) -> None:
        # TODO Phase 4:
        # from xgboost import XGBRegressor
        # from backend.data.pipeline.transformer import (
        #     add_lag_features, add_rolling_features, add_time_features, prepare_for_xgboost
        # )
        # df = add_lag_features(add_rolling_features(add_time_features(df)))
        # X, y = prepare_for_xgboost(df)
        # self._model = XGBRegressor(**self._config)
        # self._model.fit(X, y)
        # self._is_fitted = True
        raise NotImplementedError("Implement XGBoost.fit() in Phase 4")

    def predict(self, days: int) -> pd.DataFrame:
        # TODO Phase 4: recursive multi-step prediction
        raise NotImplementedError("Implement XGBoost.predict() in Phase 4")

    def get_model_name(self) -> str:
        return "xgboost_v1"
