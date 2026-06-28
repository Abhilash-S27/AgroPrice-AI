"""
Forecast evaluation metrics for price prediction accuracy.
Used for backtesting and model comparison.
"""
import numpy as np
import pandas as pd


def mae(actual: pd.Series, predicted: pd.Series) -> float:
    """Mean Absolute Error — average ₹ deviation."""
    return float(np.mean(np.abs(actual - predicted)))


def rmse(actual: pd.Series, predicted: pd.Series) -> float:
    """Root Mean Squared Error — penalizes large errors more."""
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def mape(actual: pd.Series, predicted: pd.Series) -> float:
    """Mean Absolute Percentage Error — scale-independent accuracy."""
    mask = actual != 0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def all_metrics(actual: pd.Series, predicted: pd.Series) -> dict[str, float]:
    """Return all metrics as a dict (used in ForecastResponse.accuracy_metrics)."""
    return {
        "mae": mae(actual, predicted),
        "rmse": rmse(actual, predicted),
        "mape": mape(actual, predicted),
    }
