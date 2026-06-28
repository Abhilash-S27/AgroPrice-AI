"""
Data cleaning functions for price time-series DataFrames.

These operate on pandas DataFrames returned by duckdb_queries.py.
The DuckDB queries already handle:
  - outlier filtering via PRICE_OUTLIER_UPPER/LOWER
  - variety deduplication via GROUP BY + AVG
  - date casting via TRY_CAST

These functions are for additional in-memory cleaning before ML training.
Column names here match the OUTPUT of duckdb_queries.py (lowercase aliases),
not the raw parquet column names.
"""
import pandas as pd


def remove_price_outliers(df: pd.DataFrame, z_threshold: float = 3.5) -> pd.DataFrame:
    """
    Secondary outlier removal using z-score per crop group.
    Applied after DuckDB hard-threshold filter as a second pass.
    Only effective for crops with high natural price variance (e.g., Green Chilli).
    """
    def z_filter(group: pd.DataFrame) -> pd.DataFrame:
        std = group["modal_price"].std()
        if std == 0 or pd.isna(std):
            return group
        mean = group["modal_price"].mean()
        return group[(group["modal_price"] - mean).abs() / std <= z_threshold]

    if "crop" in df.columns:
        return df.groupby("crop", group_keys=False).apply(z_filter).reset_index(drop=True)
    return z_filter(df)


def ensure_date_dtype(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    """Ensure the date column is pandas datetime (may already be from DuckDB cast)."""
    if date_col in df.columns:
        df[date_col] = pd.to_datetime(df[date_col])
    return df


def sort_by_date(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    return df.sort_values(date_col).reset_index(drop=True)


def check_min_data_points(df: pd.DataFrame, min_points: int = 30) -> None:
    """Raise ValueError if the series is too short to forecast."""
    if len(df) < min_points:
        raise ValueError(
            f"Insufficient data for forecasting: {len(df)} rows < minimum {min_points}. "
            "Try a different crop/state combination or a wider date range."
        )


def run_cleaning_pipeline(df: pd.DataFrame, min_points: int = 30) -> pd.DataFrame:
    """Full cleaning chain for a price DataFrame ready for ML ingestion."""
    df = ensure_date_dtype(df)
    df = sort_by_date(df)
    df = remove_price_outliers(df)
    check_min_data_points(df, min_points)
    return df
