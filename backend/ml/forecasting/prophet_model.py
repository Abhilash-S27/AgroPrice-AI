"""
Prophet-based price forecasting model.
Handles South Indian crop seasonality and harvest holiday effects.
"""
import logging

import pandas as pd

from backend.ml.forecasting.base import BaseForecaster

# Suppress verbose Stan/Prophet output during fitting
logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)


class ProphetForecaster(BaseForecaster):
    """
    Wraps Facebook Prophet for agricultural price forecasting.

    Prophet is well suited here because:
    - Handles missing market days natively (no need to forward-fill gaps)
    - Models yearly seasonality (harvest/off-season price cycles)
    - Provides calibrated uncertainty intervals (yhat_lower / yhat_upper)
    - Indian public holidays modeled via add_country_holidays("IN")
    """

    def __init__(
        self,
        yearly_seasonality: bool = True,
        weekly_seasonality: bool = False,
        daily_seasonality: bool = False,
        seasonality_mode: str = "multiplicative",
        changepoint_prior_scale: float = 0.05,
    ):
        self._model = None
        self._is_fitted = False
        self._training_rows: int = 0
        self._config = {
            "yearly_seasonality": yearly_seasonality,
            "weekly_seasonality": weekly_seasonality,
            "daily_seasonality": daily_seasonality,
            "seasonality_mode": seasonality_mode,
            "changepoint_prior_scale": changepoint_prior_scale,
        }

    def fit(self, df: pd.DataFrame) -> "ProphetForecaster":
        """
        Train Prophet on price data.

        df must have columns:
          ds — datetime64[ns], one row per calendar date
          y  — float, modal price (Rs/quintal)

        Missing dates are fine — Prophet interpolates across gaps.
        Returns self for chaining.
        """
        from prophet import Prophet  # lazy import: Prophet is ~2s to load

        m = Prophet(**self._config)
        m.add_country_holidays(country_name="IN")
        m.fit(df)

        self._model = m
        self._is_fitted = True
        self._training_rows = len(df)
        return self

    def predict(self, days: int) -> pd.DataFrame:
        """
        Forecast `days` into the future.

        Returns a DataFrame with columns:
          ds          — forecast date
          yhat        — predicted price (Rs/quintal)
          yhat_lower  — lower confidence bound
          yhat_upper  — upper confidence bound

        Only future rows are returned (tail `days` rows of Prophet output).
        Negative predictions are clipped to 0 (prices cannot be negative).
        """
        if not self._is_fitted:
            raise RuntimeError("Model is not fitted. Call fit() first.")

        future = self._model.make_future_dataframe(periods=days)
        forecast = self._model.predict(future)

        result = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(days).copy()
        result["yhat"] = result["yhat"].clip(lower=0)
        result["yhat_lower"] = result["yhat_lower"].clip(lower=0)
        result["yhat_upper"] = result["yhat_upper"].clip(lower=0)
        return result.reset_index(drop=True)

    @property
    def training_rows(self) -> int:
        return self._training_rows

    def get_model_name(self) -> str:
        return "prophet"
