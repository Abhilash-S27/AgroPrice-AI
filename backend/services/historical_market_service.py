"""
backend/services/historical_market_service.py

Real AGMARKNET historical retrieval via DuckDB.

DESIGN RULE — ZERO HALLUCINATION:
  Every value returned here comes from the database.
  If data is absent, return found=False with a clear message.
  Gemini receives only values in `summary`; it MUST NOT invent replacements.

All functions are synchronous (run inside asyncio.to_thread in the router).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

import pandas as pd

from backend.data.loaders.duckdb_queries import query_for_forecast

logger = logging.getLogger(__name__)

_MONTH_LABEL = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
_MONTH_SHORT = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

# Minimum trading days required to treat a period as "reliable"
_MIN_DAYS = 15


@dataclass
class HistoricalResult:
    """
    Structured historical data block for injection into PromptContext.

    `found=False` means no data was available — Gemini must acknowledge this
    transparently rather than guessing.
    `summary` is a single dense string injected verbatim into the prompt.
    `details` holds raw metrics for any future use.
    """
    crop:        str
    state:       str
    label:       str            # human-readable period description
    found:       bool
    summary:     str            # injected into prompt as deterministic fact
    details:     dict           # raw values for extended use


# ── helpers ────────────────────────────────────────────────────────────────────

def _load(crop: str, state: str) -> pd.DataFrame:
    """Load full time series for crop+state; returns empty DataFrame on failure."""
    try:
        df = query_for_forecast(crop, state)
        if not df.empty:
            df["ds"] = pd.to_datetime(df["ds"])
            df["y"]  = df["y"].astype(float)
        return df
    except Exception as exc:
        logger.warning("historical_load_failed crop=%s state=%s: %s", crop, state, exc)
        return pd.DataFrame(columns=["ds", "y"])


def _no_data(crop: str, state: str, label: str, reason: str = "") -> HistoricalResult:
    msg = reason or f"No data found for {crop} in {state} for the requested period."
    return HistoricalResult(crop=crop, state=state, label=label,
                            found=False, summary=msg, details={})


def _recent_30d_avg(df: pd.DataFrame) -> float:
    """Safely return 30-day tail average."""
    tail = df.tail(30)
    return float(tail["y"].mean()) if not tail.empty else 0.0


# ── Public API ─────────────────────────────────────────────────────────────────

def get_price_for_month(crop: str, state: str, year: int, month: int) -> HistoricalResult:
    """Average price + range for a specific calendar month + year."""
    label = f"{_MONTH_LABEL[month]} {year}"
    df = _load(crop, state)
    if df.empty:
        return _no_data(crop, state, label)

    sub = df[(df["ds"].dt.year == year) & (df["ds"].dt.month == month)]
    if sub.empty or len(sub) < _MIN_DAYS // 2:
        # Check if the year itself exists at all
        yr_data = df[df["ds"].dt.year == year]
        if yr_data.empty:
            return _no_data(crop, state, label,
                            f"No records for {crop} in {state} in {year}. "
                            f"Data covers {df['ds'].dt.year.min()}–{df['ds'].dt.year.max()}.")
        return _no_data(crop, state, label,
                        f"Fewer than {_MIN_DAYS // 2} trading days recorded for "
                        f"{crop} in {state} during {label} ({len(sub)} found).")

    avg    = float(sub["y"].mean())
    lo     = float(sub["y"].min())
    hi     = float(sub["y"].max())
    days   = len(sub)

    yr_avg   = float(df[df["ds"].dt.year == year]["y"].mean())
    vs_yr    = (avg - yr_avg)   / yr_avg   * 100 if yr_avg > 0 else 0.0
    now_avg  = _recent_30d_avg(df)
    vs_now   = (now_avg - avg)  / avg      * 100 if avg    > 0 else 0.0

    summary = (
        f"HISTORICAL DATA — {crop} in {state}, {label}:\n"
        f"  Average price : ₹{avg:,.0f}/quintal\n"
        f"  Price range   : ₹{lo:,.0f} – ₹{hi:,.0f}/quintal\n"
        f"  Trading days  : {days}\n"
        f"  vs {year} annual avg : {vs_yr:+.1f}%\n"
        f"  Current 30d avg is {vs_now:+.1f}% {'higher' if vs_now > 0 else 'lower'} "
        f"than this historical period (₹{now_avg:,.0f}/quintal today)"
    )
    return HistoricalResult(
        crop=crop, state=state, label=label, found=True, summary=summary,
        details={"avg": avg, "lo": lo, "hi": hi, "days": days,
                 "yr_avg": yr_avg, "vs_yr": vs_yr, "now_avg": now_avg, "vs_now": vs_now},
    )


def get_yearly_average(crop: str, state: str, year: int) -> HistoricalResult:
    """Full-year average, range, volatility for one year."""
    label = f"Year {year}"
    df = _load(crop, state)
    if df.empty:
        return _no_data(crop, state, label)

    sub = df[df["ds"].dt.year == year]
    if sub.empty:
        return _no_data(crop, state, label,
                        f"No records for {crop} in {state} in {year}. "
                        f"Data covers {df['ds'].dt.year.min()}–{df['ds'].dt.year.max()}.")

    avg      = float(sub["y"].mean())
    lo       = float(sub["y"].min())
    hi       = float(sub["y"].max())
    cv       = float(sub["y"].std() / avg * 100) if avg > 0 else 0.0
    days     = len(sub)
    overall  = float(df["y"].mean())
    vs_all   = (avg - overall) / overall * 100 if overall > 0 else 0.0
    now_avg  = _recent_30d_avg(df)
    vs_now   = (now_avg - avg) / avg * 100 if avg > 0 else 0.0

    summary = (
        f"HISTORICAL DATA — {crop} in {state}, {year}:\n"
        f"  Annual average : ₹{avg:,.0f}/quintal\n"
        f"  Price range    : ₹{lo:,.0f} – ₹{hi:,.0f}/quintal\n"
        f"  Volatility     : {cv:.0f}% CV\n"
        f"  Trading days   : {days}\n"
        f"  vs all-time mean : {vs_all:+.1f}% (all-time avg ₹{overall:,.0f}/quintal)\n"
        f"  Current 30d avg is {vs_now:+.1f}% {'higher' if vs_now > 0 else 'lower'} "
        f"than {year} (₹{now_avg:,.0f}/quintal today)"
    )
    return HistoricalResult(
        crop=crop, state=state, label=label, found=True, summary=summary,
        details={"avg": avg, "lo": lo, "hi": hi, "cv": cv, "days": days,
                 "overall": overall, "vs_all": vs_all, "now_avg": now_avg, "vs_now": vs_now},
    )


def compare_periods(crop: str, state: str, year1: int, year2: Optional[int]) -> HistoricalResult:
    """Side-by-side comparison of two years (or one year vs current)."""
    y2     = year2 or date.today().year
    label  = f"{year1} vs {y2}"
    df     = _load(crop, state)
    if df.empty:
        return _no_data(crop, state, label)

    s1 = df[df["ds"].dt.year == year1]["y"]
    s2 = df[df["ds"].dt.year == y2]["y"]

    if s1.empty and s2.empty:
        return _no_data(crop, state, label,
                        f"No records found for {crop} in {state} in either {year1} or {y2}.")

    lines = [f"HISTORICAL COMPARISON — {crop} in {state}: {year1} vs {y2}"]
    details: dict = {"year1": year1, "year2": y2}

    for lbl, s, yr in ((str(year1), s1, year1), (str(y2), s2, y2)):
        if s.empty:
            lines.append(f"  {yr}: no data")
        else:
            avg = float(s.mean())
            cv  = float(s.std() / avg * 100) if avg > 0 else 0.0
            lines.append(
                f"  {yr}: avg ₹{avg:,.0f}/qtl  "
                f"range ₹{s.min():,.0f}–₹{s.max():,.0f}  "
                f"CV {cv:.0f}%  ({len(s)} trading days)"
            )
            details[f"avg{lbl}"] = avg
            details[f"cv{lbl}"]  = cv

    # Price change between the two periods
    a1_key = f"avg{year1}"
    a2_key = f"avg{y2}"
    if a1_key in details and a2_key in details:
        chg = (details[a2_key] - details[a1_key]) / details[a1_key] * 100
        direction = "rose" if chg > 0 else "fell"
        lines.append(
            f"  Average price {direction} {abs(chg):.1f}% from {year1} to {y2}"
        )
        details["price_change_pct"] = chg

    return HistoricalResult(
        crop=crop, state=state, label=label, found=True,
        summary="\n".join(lines), details=details,
    )


def get_peak_year(crop: str, state: str) -> HistoricalResult:
    """Year with the highest and lowest annual average price."""
    label = "all-time peak / trough"
    df = _load(crop, state)
    if df.empty:
        return _no_data(crop, state, label)

    by_year = df.groupby(df["ds"].dt.year)["y"].agg(["mean", "max", "min", "count"])
    by_year = by_year[by_year["count"] >= _MIN_DAYS]
    if by_year.empty or len(by_year) < 2:
        return _no_data(crop, state, label,
                        f"Insufficient annual data for {crop} in {state}.")

    pk_yr  = int(by_year["mean"].idxmax())
    tr_yr  = int(by_year["mean"].idxmin())
    pk_avg = float(by_year.loc[pk_yr, "mean"])
    tr_avg = float(by_year.loc[tr_yr, "mean"])
    spread = (pk_avg - tr_avg) / tr_avg * 100 if tr_avg > 0 else 0.0

    # Recent comparison
    now_avg = _recent_30d_avg(df)

    summary = (
        f"ALL-TIME PRICE RECORD — {crop} in {state}:\n"
        f"  Highest year : {pk_yr} — avg ₹{pk_avg:,.0f}/quintal\n"
        f"  Lowest year  : {tr_yr} — avg ₹{tr_avg:,.0f}/quintal\n"
        f"  Historical spread : {spread:.0f}% between peak and trough years\n"
        f"  Data range : {by_year.index.min()} – {by_year.index.max()}\n"
        f"  Current 30d avg   : ₹{now_avg:,.0f}/quintal"
    )
    return HistoricalResult(
        crop=crop, state=state, label=label, found=True, summary=summary,
        details={"peak_year": pk_yr, "peak_avg": pk_avg,
                 "trough_year": tr_yr, "trough_avg": tr_avg,
                 "spread": spread, "now_avg": now_avg},
    )


def get_historical_trend(crop: str, state: str) -> HistoricalResult:
    """Year-by-year price evolution (last 8 years + long-term change)."""
    label = "long-term price trend"
    df = _load(crop, state)
    if df.empty:
        return _no_data(crop, state, label)

    by_year = df.groupby(df["ds"].dt.year)["y"].agg(["mean", "count"])
    by_year = by_year[by_year["count"] >= _MIN_DAYS]
    if len(by_year) < 2:
        return _no_data(crop, state, label,
                        f"Not enough annual data for {crop} in {state}.")

    recent = by_year.tail(8)   # show up to 8 years
    yr_lines = "  " + "  →  ".join(
        f"{int(yr)}: ₹{row['mean']:,.0f}" for yr, row in recent.iterrows()
    )

    first_avg = float(by_year["mean"].iloc[0])
    last_avg  = float(by_year["mean"].iloc[-1])
    total_chg = (last_avg - first_avg) / first_avg * 100 if first_avg > 0 else 0.0

    summary = (
        f"LONG-TERM TREND — {crop} in {state} "
        f"({int(by_year.index.min())}–{int(by_year.index.max())}):\n"
        f"{yr_lines}\n"
        f"  Long-term price change: {total_chg:+.0f}% "
        f"from {int(by_year.index.min())} to {int(by_year.index.max())}\n"
        f"  Years with data: {len(by_year)}"
    )
    return HistoricalResult(
        crop=crop, state=state, label=label, found=True, summary=summary,
        details={"yearly_avgs": {int(yr): float(row["mean"])
                                  for yr, row in by_year.iterrows()},
                 "total_change_pct": total_chg},
    )


def get_monthly_pattern(crop: str, state: str, month: int) -> HistoricalResult:
    """Average price for a given calendar month across all available years."""
    label = f"{_MONTH_LABEL[month]} (historical pattern)"
    df = _load(crop, state)
    if df.empty:
        return _no_data(crop, state, label)

    sub = df[df["ds"].dt.month == month]
    if sub.empty:
        return _no_data(crop, state, label,
                        f"No {_MONTH_LABEL[month]} records for {crop} in {state}.")

    avg     = float(sub["y"].mean())
    lo      = float(sub["y"].min())
    hi      = float(sub["y"].max())
    days    = len(sub)
    overall = float(df["y"].mean())
    vs_all  = (avg - overall) / overall * 100 if overall > 0 else 0.0

    # Year-by-year for this month
    by_yr = sub.groupby(sub["ds"].dt.year)["y"].mean()
    yr_lines = "  " + "  ·  ".join(
        f"{int(yr)}: ₹{v:,.0f}" for yr, v in by_yr.items()
    )

    summary = (
        f"MONTHLY PATTERN — {crop} in {state} during {_MONTH_LABEL[month]}:\n"
        f"  Historical average : ₹{avg:,.0f}/quintal ({days} trading days)\n"
        f"  Range              : ₹{lo:,.0f} – ₹{hi:,.0f}/quintal\n"
        f"  vs annual mean     : {vs_all:+.1f}% (annual avg ₹{overall:,.0f}/quintal)\n"
        f"  Year-by-year:\n{yr_lines}"
    )
    trend_word = ("above" if vs_all > 3 else "below" if vs_all < -3 else "in line with")
    summary += f"\n  Typical {_MONTH_LABEL[month]} prices are {trend_word} the annual average."

    return HistoricalResult(
        crop=crop, state=state, label=label, found=True, summary=summary,
        details={"avg": avg, "lo": lo, "hi": hi, "days": days,
                 "overall": overall, "vs_all": vs_all,
                 "by_year": {int(yr): float(v) for yr, v in by_yr.items()}},
    )


# ── Dispatcher ─────────────────────────────────────────────────────────────────

def fetch_historical(
    crop: str,
    state: str,
    query_type: str,
    year: Optional[int] = None,
    year2: Optional[int] = None,
    month: Optional[int] = None,
) -> HistoricalResult:
    """
    Single entry point for the advisor_ai_router.

    Dispatches to the appropriate function based on query_type.
    All inputs come from HistoricalQuery (already validated by parser).
    """
    try:
        if query_type == "month_year" and year and month:
            return get_price_for_month(crop, state, year, month)
        if query_type == "yearly_avg" and year:
            return get_yearly_average(crop, state, year)
        if query_type == "comparison":
            return compare_periods(crop, state, year or date.today().year - 1, year2)
        if query_type == "all_time_peak":
            return get_peak_year(crop, state)
        if query_type == "all_time_trough":
            return get_peak_year(crop, state)   # same fn, trough in output
        if query_type == "monthly_pattern" and month:
            return get_monthly_pattern(crop, state, month)
        # default / trend_evolution
        return get_historical_trend(crop, state)
    except Exception as exc:
        logger.error("fetch_historical failed crop=%s state=%s type=%s: %s",
                     crop, state, query_type, exc)
        return HistoricalResult(
            crop=crop, state=state, label=query_type, found=False,
            summary=f"Historical data retrieval failed for {crop} in {state}.",
            details={},
        )
