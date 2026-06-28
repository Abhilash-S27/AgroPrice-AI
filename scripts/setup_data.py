"""
One-time data ingestion script.
Run this after placing parquet files in data/raw/parquet/ to build the DuckDB database.

Usage:
    python scripts/setup_data.py
"""
import sys
from pathlib import Path

# Allow imports from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.database import db_manager
from backend.data.pipeline.ingestion import run_ingestion_pipeline


def main():
    print("Connecting to DuckDB...")
    db_manager.connect()

    print("Running ingestion pipeline...")
    run_ingestion_pipeline()

    # Quick sanity check
    try:
        result = db_manager.execute("SELECT COUNT(*) FROM prices").fetchone()
        print(f"Total price records ingested: {result[0]:,}")
        crops = db_manager.execute("SELECT DISTINCT crop FROM prices ORDER BY crop").fetchall()
        print(f"Crops found: {[r[0] for r in crops]}")
    except Exception as e:
        print(f"Validation failed: {e}")
    finally:
        db_manager.close()
        print("Done.")


if __name__ == "__main__":
    main()
