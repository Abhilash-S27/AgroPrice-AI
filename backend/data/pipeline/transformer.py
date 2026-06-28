"""
Feature engineering for ML models.
Operates on DataFrames already cleaned and returned by duckdb_queries.py.
Column names here: 'date', 'modal_price' (lowercase, as aliased in queries).
Prophet input needs 'ds', 'y' — use prepare_for_prophet() for that conversion.
"""
import pandas as pd


def add_lag_features(df: pd.DataFrame, lags: list[int] = [7, 14, 30]) -> pd.DataFrame:
    df = df.sort_values("date").copy()
    for lag in lags:
        df[f"lag_{lag}"] = df["modal_price"].shift(lag)
    return df


def add_rolling_features(df: pd.DataFrame, windows: list[int] = [7, 30]) -> pd.DataFrame:
    df = df.sort_values("date").copy()
    for window in windows:
        df[f"rolling_mean_{window}"] = df["modal_price"].rolling(window).mean()
        df[f"rolling_std_{window}"]  = df["modal_price"].rolling(window).std()
    return df


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["day_of_week"]      = df["date"].dt.dayofweek
    df["month"]            = df["date"].dt.month
    df["quarter"]          = df["date"].dt.quarter
    # South India harvest seasons: Kharif (Jun-Oct), Rabi (Nov-Mar)
    df["is_kharif_season"] = df["month"].isin([6, 7, 8, 9, 10]).astype(int)
    df["is_rabi_season"]   = df["month"].isin([11, 12, 1, 2, 3]).astype(int)
    return df


def prepare_for_prophet(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert a price DataFrame into Prophet's (ds, y) format.
    Input must have 'date' and 'modal_price' columns.
    If the input already comes from query_for_forecast(), it already has 'ds','y'.
    """
    if "ds" in df.columns and "y" in df.columns:
        return df[["ds", "y"]].dropna()
    return (
        df[["date", "modal_price"]]
        .rename(columns={"date": "ds", "modal_price": "y"})
        .dropna()
    )


def prepare_for_xgboost(df: pd.DataFrame, target_col: str = "modal_price") -> tuple:
    """Build (X, y) for XGBoost. Requires lag and rolling features to be added first."""
    feature_cols = [
        c for c in df.columns
        if c.startswith(("lag_", "rolling_", "month", "quarter", "day_", "is_"))
    ]
    df_clean = df.dropna(subset=feature_cols + [target_col])
    return df_clean[feature_cols], df_clean[target_col]
