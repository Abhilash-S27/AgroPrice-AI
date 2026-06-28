"""
backend/services/historical_query_parser.py

Lightweight regex-based parser that extracts temporal parameters from a
natural language agricultural question.

Purpose: turn free-text queries like "What was onion price in October 2016?"
or "Compare tomato prices between 2019 and 2024" into a structured
HistoricalQuery so the historical_market_service can run precise DuckDB queries.

Design rules:
  - Pure parsing only — no DuckDB calls here.
  - All numeric outputs come from the query text, never invented.
  - Returns HistoricalQuery.is_historical=False for non-historical questions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Optional


# ── Month name → int mapping ───────────────────────────────────────────────────
MONTH_MAP: dict[str, int] = {
    "january": 1,  "jan": 1,
    "february": 2, "feb": 2,
    "march": 3,    "mar": 3,
    "april": 4,    "apr": 4,
    "may": 5,
    "june": 6,     "jun": 6,
    "july": 7,     "jul": 7,
    "august": 8,   "aug": 8,
    "september": 9,"sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11,"nov": 11,
    "december": 12,"dec": 12,
}

MONTH_LABEL: dict[int, str] = {v: k.capitalize() for k, v in MONTH_MAP.items()
                                 if len(k) > 3}   # keep full names only

_CURRENT_YEAR = date.today().year

# ── Signals that mark a query as "historical" ──────────────────────────────────
_HISTORICAL_SIGNALS = re.compile(
    r"""
    \b(
        was | were | had | have\s+been | used\s+to |
        history | historical | historically |
        in\s+\d{4} | during\s+\d{4} | back\s+in |
        between | compared?\s+to | vs\.? |
        highest\s+ever | lowest\s+ever |
        all[- ]time | peak | best\s+year | worst\s+year |
        record\s+high | record\s+low |
        performed? | how\s+did | what\s+was | what\s+were |
        trend\s+over | evolution | long[- ]term
    )\b
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Also historical if any 4-digit year appears
_YEAR_PRESENT = re.compile(r'\b(20\d{2}|19\d{2})\b')


@dataclass
class HistoricalQuery:
    """
    Structured result of parsing one user question.

    is_historical=False  → not a historical query; skip historical service
    query_type values:
        month_year       — specific month + year (e.g., "October 2016")
        yearly_avg       — full year average (e.g., "2022 prices")
        comparison       — two years side-by-side (e.g., "2019 vs 2024")
        all_time_peak    — year with highest average price
        all_time_trough  — year with lowest average price
        trend_evolution  — year-by-year price evolution
        monthly_pattern  — a month across all years (e.g., "January prices historically")
    """
    is_historical:  bool
    query_type:     str            = "yearly_avg"
    year:           Optional[int]  = None   # primary year
    year2:          Optional[int]  = None   # second year for comparisons
    month:          Optional[int]  = None   # 1-12; None = full year
    description:    str            = ""     # human-readable for prompt injection


def parse_historical_query(text: str) -> HistoricalQuery:
    """
    Parse a user question and return a HistoricalQuery.

    Never raises — returns is_historical=False on any parsing failure.
    """
    try:
        return _parse(text)
    except Exception:
        return HistoricalQuery(is_historical=False)


def _parse(text: str) -> HistoricalQuery:
    lower = text.lower()

    # ── Step 1: is this a historical question at all? ──────────────────────────
    is_hist = bool(_HISTORICAL_SIGNALS.search(lower)) or bool(_YEAR_PRESENT.search(text))
    if not is_hist:
        return HistoricalQuery(is_historical=False)

    # ── Step 2: extract years (4-digit, valid range) ────────────────────────────
    years_found = [
        int(y) for y in _YEAR_PRESENT.findall(text)
        if 2000 <= int(y) <= _CURRENT_YEAR
    ]
    year1 = years_found[0] if years_found else None
    year2 = years_found[1] if len(years_found) >= 2 else None

    # ── Step 3: extract month ───────────────────────────────────────────────────
    month = None
    month_label = None
    for name, num in MONTH_MAP.items():
        if re.search(r'\b' + re.escape(name) + r'\b', lower):
            month = num
            month_label = MONTH_LABEL.get(num, name.capitalize())
            break

    # ── Step 4: classify query_type ─────────────────────────────────────────────
    # All-time superlatives
    if re.search(r'\b(highest\s+ever|all[- ]time\s+high|record\s+high|best\s+year|most\s+expensive)\b', lower):
        return HistoricalQuery(
            is_historical=True,
            query_type="all_time_peak",
            description="all-time peak year",
        )
    if re.search(r'\b(lowest\s+ever|all[- ]time\s+low|record\s+low|worst\s+year|cheapest)\b', lower):
        return HistoricalQuery(
            is_historical=True,
            query_type="all_time_trough",
            description="all-time trough year",
        )

    # Year-over-year evolution / trend
    if re.search(r'\b(trend\s+over|evolution|long[- ]term|year\s+by\s+year|over\s+the\s+(years|decade))\b', lower):
        return HistoricalQuery(
            is_historical=True,
            query_type="trend_evolution",
            year=year1,
            description="long-term price evolution",
        )

    # Comparison between two years
    if year2 is not None or re.search(r'\b(between|vs\.?|versus|compare[d]?\s+to|difference\s+between)\b', lower):
        desc = f"{year1} vs {year2}" if year1 and year2 else "year comparison"
        return HistoricalQuery(
            is_historical=True,
            query_type="comparison",
            year=year1,
            year2=year2,
            description=desc,
        )

    # Specific month + year
    if month and year1:
        return HistoricalQuery(
            is_historical=True,
            query_type="month_year",
            year=year1,
            month=month,
            description=f"{month_label} {year1}",
        )

    # Month pattern across all years (no specific year)
    if month and not year1:
        return HistoricalQuery(
            is_historical=True,
            query_type="monthly_pattern",
            month=month,
            description=f"{month_label} (historical average across all years)",
        )

    # Full year average
    if year1:
        return HistoricalQuery(
            is_historical=True,
            query_type="yearly_avg",
            year=year1,
            description=f"year {year1}",
        )

    # Historical signal present but no year/month — generic historical question
    return HistoricalQuery(
        is_historical=True,
        query_type="trend_evolution",
        description="historical trend",
    )
