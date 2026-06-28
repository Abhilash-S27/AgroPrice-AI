"""
Abstract base class for all forecasting models.
Every model (Prophet, XGBoost, etc.) must implement this interface.
"""
from abc import ABC, abstractmethod

import pandas as pd


class BaseForecaster(ABC):

    @abstractmethod
    def fit(self, df: pd.DataFrame) -> None:
        """Train the model on a time-series DataFrame with 'ds' and 'y' columns."""
        ...

    @abstractmethod
    def predict(self, days: int) -> pd.DataFrame:
        """
        Generate a forecast for the next `days` days.
        Must return a DataFrame with columns: ds, yhat, yhat_lower, yhat_upper.
        """
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        """Return a short identifier string for the model (e.g. 'prophet_v1')."""
        ...
