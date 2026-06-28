"""
Report generation orchestrator.
Fetches data, then delegates to pdf_report.py or excel_report.py.
"""
from pathlib import Path

from backend.core.config import settings
from backend.core.logger import get_logger

logger = get_logger(__name__)

REPORTS_OUTPUT_DIR = Path("./reports/output")


def generate_pdf_report(crop: str, state: str | None, period: str) -> Path:
    """
    Build a PDF report for the given crop/state/period.
    Returns the path to the generated PDF file.
    """
    # TODO Phase 4:
    # 1. Fetch price data via duckdb_queries.query_prices()
    # 2. Build summary stats
    # 3. Call pdf_report.build_pdf(data, output_path)
    raise NotImplementedError("PDF report generation — implement in Phase 4")


def generate_excel_report(crop: str, state: str | None) -> Path:
    """
    Build an Excel report for the given crop/state.
    Returns the path to the generated .xlsx file.
    """
    # TODO Phase 4:
    # 1. Fetch price data via duckdb_queries.query_prices()
    # 2. Call excel_report.build_excel(data, output_path)
    raise NotImplementedError("Excel report generation — implement in Phase 4")
