"""
Reusable DuckDB query helpers.
All queries read from the 'prices' view (registered on startup via ingestion.py).

Column names come from backend/utils/constants.Cols — never hardcode strings here.

Deduplication strategy:
  AGMARKNET records multiple Variety rows per (date, crop, state, market).
  All queries GROUP BY date+crop+state+market and take AVG(Modal_Price)
  to produce one price per mandi per day — correct for forecasting and dashboards.

Outlier filter:
  Modal_Price clamped to [PRICE_OUTLIER_LOWER, PRICE_OUTLIER_UPPER] (1 .. 100,000 Rs/qtl).
  This removes 815 confirmed data-entry errors (values up to 918 million).
"""
from datetime import date

import pandas as pd

from backend.core.database import db_manager
from backend.utils.constants import (
    Cols,
    PRICE_OUTLIER_LOWER,
    PRICE_OUTLIER_UPPER,
    SOUTH_INDIAN_STATES,
    TAMIL_NADU_DATA_START,
)
from backend.utils.crop_registry import price_cap

# ── Internal helpers ───────────────────────────────────────────────────────

def _price_filter(crop: str | None = None) -> str:
    """
    Price sanity clause — include in every query touching Modal_Price.

    Per-crop upper bound from the registry: premium spices like Cardamoms
    legitimately trade above the default 100,000 Rs/qtl cap, so a global
    cap would silently delete their data.
    """
    upper = price_cap(crop) if crop else PRICE_OUTLIER_UPPER
    return (
        f'"{Cols.MODAL_PRICE}" BETWEEN {PRICE_OUTLIER_LOWER} AND {upper}'
    )


def _south_india_filter() -> str:
    states = ", ".join(f"'{s}'" for s in SOUTH_INDIAN_STATES)
    return f'"{Cols.STATE}" IN ({states})'


def _date_cast(col: str = None) -> str:
    col = col or Cols.DATE
    return f'TRY_CAST("{col}" AS DATE)'


# ── Core query: price records ──────────────────────────────────────────────

def query_prices(
    crop: str,
    state: str | None = None,
    market: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    south_india_only: bool = True,
    limit: int = 1000,
) -> pd.DataFrame:
    """
    Fetch deduplicated daily price records for a crop.

    Deduplication: one row per (date, crop, state, market) via AVG aggregation.
    Returns columns: date, crop, state, market, min_price, max_price, modal_price.
    """
    conditions = [
        f'LOWER("{Cols.COMMODITY}") = LOWER(?)',
        _price_filter(crop),
        f'{_date_cast()} IS NOT NULL',
    ]
    params: list = [crop]

    if south_india_only:
        conditions.append(_south_india_filter())
    if state:
        conditions.append(f'"{Cols.STATE}" = ?')
        params.append(state)
    if market:
        conditions.append(f'LOWER("{Cols.MARKET}") = LOWER(?)')
        params.append(market)
    if start_date:
        conditions.append(f'{_date_cast()} >= ?')
        params.append(str(start_date))
    if end_date:
        conditions.append(f'{_date_cast()} <= ?')
        params.append(str(end_date))

    where = " AND ".join(conditions)
    query = f"""
        SELECT
            {_date_cast()}              AS date,
            "{Cols.COMMODITY}"          AS crop,
            "{Cols.STATE}"              AS state,
            "{Cols.MARKET}"             AS market,
            AVG("{Cols.MIN_PRICE}")     AS min_price,
            AVG("{Cols.MAX_PRICE}")     AS max_price,
            AVG("{Cols.MODAL_PRICE}")   AS modal_price
        FROM prices
        WHERE {where}
        GROUP BY {_date_cast()}, "{Cols.COMMODITY}", "{Cols.STATE}", "{Cols.MARKET}"
        ORDER BY date DESC
        LIMIT {limit}
    """
    return db_manager.query_df(query, params)


# ── Core query: price summary stats ───────────────────────────────────────

def query_price_summary(
    crop: str,
    state: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> pd.DataFrame:
    """Return aggregate stats (min/max/avg/stddev) for a crop, optionally per state."""
    conditions = [
        f'LOWER("{Cols.COMMODITY}") = LOWER(?)',
        _price_filter(crop),
        _south_india_filter(),
    ]
    params: list = [crop]

    if state:
        conditions.append(f'"{Cols.STATE}" = ?')
        params.append(state)
    if start_date:
        conditions.append(f'{_date_cast()} >= ?')
        params.append(str(start_date))
    if end_date:
        conditions.append(f'{_date_cast()} <= ?')
        params.append(str(end_date))

    group_by = f'"{Cols.COMMODITY}"' + (f', "{Cols.STATE}"' if not state else '')

    where = " AND ".join(conditions)
    query = f"""
        SELECT
            "{Cols.COMMODITY}"                  AS crop,
            "{Cols.STATE}"                      AS state,
            MIN({_date_cast()})                 AS period_start,
            MAX({_date_cast()})                 AS period_end,
            MIN("{Cols.MODAL_PRICE}")           AS min_price,
            MAX("{Cols.MODAL_PRICE}")           AS max_price,
            ROUND(AVG("{Cols.MODAL_PRICE}"), 2) AS avg_price,
            ROUND(STDDEV("{Cols.MODAL_PRICE}"), 2) AS stddev_price,
            COUNT(DISTINCT {_date_cast()})      AS distinct_days,
            COUNT(*)                            AS total_records
        FROM prices
        WHERE {where}
        GROUP BY {group_by}
        ORDER BY avg_price DESC
    """
    return db_manager.query_df(query, params)


# ── Core query: Prophet-ready time series ─────────────────────────────────

def query_for_forecast(
    crop: str,
    state: str | None = None,
    start_date: date | None = None,
) -> pd.DataFrame:
    """
    Return a clean (ds, y) daily time series for Prophet.

    - ds: one row per calendar date
    - y: average Modal_Price across all markets for that crop/state/day
    - Missing dates are NOT filled here — Prophet handles gaps natively.
    - Tamil Nadu state: defaults to TAMIL_NADU_DATA_START if no start_date given.
    """
    conditions = [
        f'LOWER("{Cols.COMMODITY}") = LOWER(?)',
        _price_filter(crop),
        f'{_date_cast()} IS NOT NULL',
    ]
    params: list = [crop]

    if state:
        conditions.append(f'"{Cols.STATE}" = ?')
        params.append(state)
        # Tamil Nadu data only reliable from 2024 onwards
        if state == "Tamil Nadu" and start_date is None:
            start_date = date.fromisoformat(TAMIL_NADU_DATA_START)
    else:
        conditions.append(_south_india_filter())

    if start_date:
        conditions.append(f'{_date_cast()} >= ?')
        params.append(str(start_date))

    where = " AND ".join(conditions)
    query = f"""
        SELECT
            {_date_cast()}              AS ds,
            AVG("{Cols.MODAL_PRICE}")   AS y
        FROM prices
        WHERE {where}
        GROUP BY {_date_cast()}
        ORDER BY ds ASC
    """
    df = db_manager.query_df(query, params)
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].astype(float)
    return df.dropna()


# ── Core query: latest prices ──────────────────────────────────────────────

def query_latest_prices(
    crops: list[str],
    state: str | None = None,
) -> pd.DataFrame:
    """Most recent price observation for each crop (South India only)."""
    if not crops:
        return pd.DataFrame()

    placeholders = ", ".join("?" * len(crops))
    # widest registry cap among the requested crops (premium spices need >100k)
    widest = max(crops, key=price_cap)
    conditions = [
        f'LOWER("{Cols.COMMODITY}") IN ({placeholders})',
        _price_filter(widest),
        _south_india_filter(),
    ]
    params: list = [c.lower() for c in crops]

    if state:
        conditions.append(f'"{Cols.STATE}" = ?')
        params.append(state)

    where = " AND ".join(conditions)
    query = f"""
        SELECT DISTINCT ON ("{Cols.COMMODITY}")
            "{Cols.COMMODITY}"          AS crop,
            "{Cols.STATE}"              AS state,
            "{Cols.MARKET}"             AS market,
            {_date_cast()}              AS date,
            AVG("{Cols.MODAL_PRICE}") OVER (PARTITION BY "{Cols.COMMODITY}", {_date_cast()}) AS modal_price
        FROM prices
        WHERE {where}
        ORDER BY "{Cols.COMMODITY}", {_date_cast()} DESC
    """
    return db_manager.query_df(query, params)


# ── Core query: state-level price trend ───────────────────────────────────

def query_state_price_trend(
    crop: str,
    state: str,
    window_days: int = 30,
) -> pd.DataFrame:
    """
    Rolling average price for a crop in a state over the last `window_days` days.
    Returns: date, avg_price, rolling_avg.
    """
    query = f"""
        WITH daily AS (
            SELECT
                {_date_cast()}              AS ds,
                AVG("{Cols.MODAL_PRICE}")   AS avg_price
            FROM prices
            WHERE LOWER("{Cols.COMMODITY}") = LOWER(?)
              AND "{Cols.STATE}" = ?
              AND {_price_filter(crop)}
              AND {_date_cast()} IS NOT NULL
            GROUP BY {_date_cast()}
            ORDER BY ds
        )
        SELECT
            ds,
            avg_price,
            AVG(avg_price) OVER (
                ORDER BY ds
                ROWS BETWEEN {window_days - 1} PRECEDING AND CURRENT ROW
            ) AS rolling_avg_{window_days}d
        FROM daily
        ORDER BY ds DESC
        LIMIT 365
    """
    df = db_manager.query_df(query, [crop, state])
    df["ds"] = pd.to_datetime(df["ds"])
    return df


# ── Core query: crop × state coverage matrix ──────────────────────────────

def query_coverage_matrix(crops: list[str] | None = None) -> pd.DataFrame:
    """
    How many distinct days each crop is available per South Indian state.
    Useful for deciding which crop+state combos are forecastable.
    """
    crop_filter = ""
    params: list = []
    if crops:
        placeholders = ", ".join("?" * len(crops))
        crop_filter = f'AND LOWER("{Cols.COMMODITY}") IN ({placeholders})'
        params = [c.lower() for c in crops]

    query = f"""
        SELECT
            "{Cols.COMMODITY}"                              AS crop,
            "{Cols.STATE}"                                  AS state,
            COUNT(DISTINCT {_date_cast()})                  AS distinct_days,
            MIN({_date_cast()})                             AS first_date,
            MAX({_date_cast()})                             AS last_date,
            ROUND(AVG("{Cols.MODAL_PRICE}"), 2)             AS avg_price,
            COUNT(*)                                        AS total_records
        FROM prices
        WHERE {_south_india_filter()}
          AND {_price_filter(max(crops, key=price_cap) if crops else None)}
          AND {_date_cast()} IS NOT NULL
          {crop_filter}
        GROUP BY "{Cols.COMMODITY}", "{Cols.STATE}"
        ORDER BY "{Cols.COMMODITY}", distinct_days DESC
    """
    return db_manager.query_df(query, params)


# ── Core query: list distinct values ──────────────────────────────────────

def query_distinct_crops(south_india_only: bool = True) -> list[str]:
    """Return distinct commodity names available in the dataset."""
    where = _south_india_filter() if south_india_only else "1=1"
    rows = db_manager.execute(
        f'SELECT DISTINCT "{Cols.COMMODITY}" FROM prices WHERE {where} ORDER BY "{Cols.COMMODITY}"'
    ).fetchall()
    return [r[0] for r in rows]


def query_distinct_states() -> list[str]:
    rows = db_manager.execute(
        f'SELECT DISTINCT "{Cols.STATE}" FROM prices ORDER BY "{Cols.STATE}"'
    ).fetchall()
    return [r[0] for r in rows]


def query_distinct_markets(state: str | None = None) -> list[str]:
    where = f'"{Cols.STATE}" = ?' if state else "1=1"
    params = [state] if state else []
    rows = db_manager.execute(
        f'SELECT DISTINCT "{Cols.MARKET}" FROM prices WHERE {where} ORDER BY "{Cols.MARKET}"',
        params or None,
    ).fetchall()
    return [r[0] for r in rows]
