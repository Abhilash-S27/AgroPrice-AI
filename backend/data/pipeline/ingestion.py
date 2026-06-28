"""
Ingestion pipeline: registers all yearly parquet files as a single DuckDB view.

The AGMARKNET parquet files have this actual schema:
    State (string), District (string), Market (string), Commodity (string),
    Variety (string), Grade (string), Arrival_Date (string YYYY-MM-DD),
    Min_Price (double), Max_Price (double), Modal_Price (double),
    Commodity_Code (int64)

No data is copied or transformed — DuckDB reads parquet files lazily.
The 'prices' view is the single source of truth for all query modules.
"""
from pathlib import Path

from backend.core.config import settings
from backend.core.database import db_manager
from backend.core.logger import get_logger
from backend.utils.constants import Cols

logger = get_logger(__name__)

REQUIRED_COLUMNS = {
    Cols.DATE, Cols.COMMODITY, Cols.STATE, Cols.MARKET,
    Cols.MIN_PRICE, Cols.MAX_PRICE, Cols.MODAL_PRICE,
}


def run_ingestion_pipeline() -> int:
    """
    Register all parquet files as the 'prices' DuckDB view.
    Returns number of parquet files found.
    Raises if required columns are missing.
    """
    parquet_dir: Path = settings.parquet_dir
    files = sorted(parquet_dir.glob("*.parquet"))

    if not files:
        logger.warning("No parquet files found", dir=str(parquet_dir))
        return 0

    logger.info("Registering parquet files", count=len(files), dir=str(parquet_dir))

    glob_path = str(parquet_dir / "*.parquet").replace("\\", "/")
    _create_prices_view(glob_path)
    _validate_schema()

    total = db_manager.execute("SELECT COUNT(*) FROM prices").fetchone()[0]
    logger.info("Ingestion complete", files=len(files), total_rows=f"{total:,}")
    return len(files)


def _create_prices_view(glob_path: str) -> None:
    """
    Create the unified 'prices' view using DuckDB's native parquet glob reader.
    DuckDB reads only the columns/rows needed per query — fully lazy.
    """
    db_manager.execute(
        f"CREATE OR REPLACE VIEW prices AS "
        f"SELECT * FROM read_parquet('{glob_path}')"
    )
    logger.info("prices view created", glob=glob_path)


def _validate_schema() -> None:
    """Verify all required columns exist in the unified view."""
    result = db_manager.execute("DESCRIBE prices").fetchall()
    actual = {row[0] for row in result}
    missing = REQUIRED_COLUMNS - actual
    if missing:
        raise ValueError(
            f"Parquet schema is missing required columns: {missing}. "
            f"Found: {sorted(actual)}"
        )
    logger.info("Schema validation passed", columns=sorted(actual))


def get_dataset_stats() -> dict:
    """
    Quick stats about the loaded dataset.
    Called by /health or admin endpoints.
    """
    try:
        r = db_manager.execute(f"""
            SELECT
                COUNT(*)                                    AS total_rows,
                COUNT(DISTINCT "{Cols.COMMODITY}")          AS unique_crops,
                COUNT(DISTINCT "{Cols.STATE}")              AS unique_states,
                MIN(TRY_CAST("{Cols.DATE}" AS DATE))        AS earliest_date,
                MAX(TRY_CAST("{Cols.DATE}" AS DATE))        AS latest_date
            FROM prices
            WHERE TRY_CAST("{Cols.DATE}" AS DATE) IS NOT NULL
        """).fetchone()
        return {
            "total_rows":    f"{r[0]:,}",
            "unique_crops":  r[1],
            "unique_states": r[2],
            "earliest_date": str(r[3]),
            "latest_date":   str(r[4]),
        }
    except Exception as e:
        return {"error": str(e)}
