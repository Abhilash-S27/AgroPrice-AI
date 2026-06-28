"""Validate registry home-state choices: depth + recency + CV for each pair."""
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.utils.crop_registry import _CROPS  # noqa: E402

PARQUET_GLOB = str(ROOT / "data" / "raw" / "parquet" / "*.parquet").replace("\\", "/")
DATE = "TRY_CAST(Arrival_Date AS DATE)"

con = duckdb.connect()
con.execute(f"CREATE VIEW prices AS SELECT * FROM read_parquet('{PARQUET_GLOB}')")
latest = con.execute(f"SELECT MAX({DATE}) FROM prices").fetchone()[0]

print(f"{'crop':<32}{'home_state':<18}{'depth':>7}{'rec365':>8}{'cv%':>7}")
print("-" * 75)
for c in _CROPS:
    depth, rec, cv = con.execute(
        f"""WITH daily AS (
              SELECT {DATE} AS d, AVG(Modal_Price) AS y FROM prices
              WHERE Commodity=? AND State=?
                AND Modal_Price BETWEEN 1 AND {c.price_cap}
                AND {DATE} IS NOT NULL
              GROUP BY {DATE})
            SELECT COUNT(*),
                   COUNT(CASE WHEN d >= (DATE '{latest}' - INTERVAL 365 DAY) THEN 1 END),
                   ROUND(STDDEV(y)/AVG(y)*100, 1)
            FROM daily""",
        [c.canonical, c.home_state],
    ).fetchone()
    flag = "  ! WEAK" if (depth or 0) < 1000 or (rec or 0) < 150 else ""
    print(f"{c.canonical:<32}{c.home_state:<18}{depth:>7}{rec:>8}{cv:>7}{flag}")
con.close()
