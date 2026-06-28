from datetime import date, timedelta


def get_date_range(months_back: int) -> tuple[date, date]:
    """Return (start_date, today) for a rolling window of N months."""
    today = date.today()
    start = today - timedelta(days=months_back * 30)
    return start, today


def year_range(start_year: int = 2015, end_year: int = 2026) -> list[int]:
    return list(range(start_year, end_year + 1))


def is_harvest_period(d: date) -> bool:
    """True if the date falls in a major South Indian harvest window."""
    from backend.utils.constants import KHARIF_MONTHS, RABI_MONTHS
    return d.month in KHARIF_MONTHS or d.month in RABI_MONTHS


def format_date_label(d: date) -> str:
    """Format date as 'Jan 2024' — used in chart x-axis labels."""
    return d.strftime("%b %Y")
