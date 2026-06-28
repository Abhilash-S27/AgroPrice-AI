"""Tests for ML evaluation metrics."""
import pandas as pd
import numpy as np
import pytest
from backend.ml.evaluation.metrics import mae, rmse, mape, all_metrics


def test_mae_perfect_prediction():
    actual = pd.Series([100.0, 200.0, 300.0])
    predicted = pd.Series([100.0, 200.0, 300.0])
    assert mae(actual, predicted) == 0.0


def test_rmse_known_value():
    actual = pd.Series([100.0, 100.0])
    predicted = pd.Series([90.0, 110.0])
    assert rmse(actual, predicted) == pytest.approx(10.0)


def test_mape_known_value():
    actual = pd.Series([100.0, 200.0])
    predicted = pd.Series([90.0, 210.0])
    # |10/100| + |10/200| = 0.1 + 0.05 = 0.075 → 7.5%
    assert mape(actual, predicted) == pytest.approx(7.5)


def test_all_metrics_returns_dict():
    actual = pd.Series([100.0, 200.0, 300.0])
    predicted = pd.Series([110.0, 190.0, 310.0])
    result = all_metrics(actual, predicted)
    assert set(result.keys()) == {"mae", "rmse", "mape"}
    assert all(isinstance(v, float) for v in result.values())
