"""Tests for data loading and pipeline utilities."""
import pytest
from backend.data.pipeline.cleaner import (
    ensure_date_column, normalize_text_columns,
    remove_nulls, remove_price_outliers, run_cleaning_pipeline
)


def test_remove_nulls_drops_null_modal_price(sample_price_df):
    df = sample_price_df.copy()
    df.loc[0, "modal_price"] = None
    cleaned = remove_nulls(df)
    assert len(cleaned) == len(sample_price_df) - 1


def test_normalize_text_columns_lowercases(sample_price_df):
    df = sample_price_df.copy()
    df["crop"] = "TOMATO"
    df["state"] = "Tamil Nadu"
    cleaned = normalize_text_columns(df)
    assert cleaned["crop"].iloc[0] == "tomato"
    assert cleaned["state"].iloc[0] == "tamil nadu"


def test_run_cleaning_pipeline_returns_dataframe(sample_price_df):
    result = run_cleaning_pipeline(sample_price_df.copy())
    assert len(result) > 0
    assert "modal_price" in result.columns
    assert "date" in result.columns
