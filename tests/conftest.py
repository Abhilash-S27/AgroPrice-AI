"""
Shared pytest fixtures used across all test modules.
"""
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="session")
def client():
    """FastAPI test client — reused across the session."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_price_df():
    """Minimal price DataFrame for unit tests."""
    return pd.DataFrame({
        "date": pd.date_range("2024-01-01", periods=60, freq="D"),
        "crop": "tomato",
        "state": "tamil nadu",
        "market": "koyambedu",
        "min_price":   [800.0 + i for i in range(60)],
        "max_price":   [1200.0 + i for i in range(60)],
        "modal_price": [1000.0 + i for i in range(60)],
    })


@pytest.fixture
def sample_prophet_df(sample_price_df):
    """Prophet-ready (ds, y) DataFrame."""
    return sample_price_df[["date", "modal_price"]].rename(
        columns={"date": "ds", "modal_price": "y"}
    )
