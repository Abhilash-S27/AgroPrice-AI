"""
Phase 1 audit: profile data availability for all 27 target forecast crops.

Read-only — opens its own DuckDB connection against the parquet files,
does not touch the running backend.

For each crop:
  - exact name match check (case-sensitive + case-insensitive candidates)
  - total records, distinct days, date range (South India)
  - best state by distinct days
  - recent continuity: distinct days in last 365 days of dataset
  - volatility CV (best state)
"""
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
PARQUET_GLOB = str(ROOT / "data" / "raw" / "parquet" / "*.parquet").replace("\\", "/")

SOUTH = "('Tamil Nadu','Karnataka','Andhra Pradesh','Telangana','Kerala')"
PRICE = 'Modal_Price BETWEEN 1 AND 100000'
DATE = "TRY_CAST(Arrival_Date AS DATE)"

TARGET_CROPS = [
    # core
    "Tomato", "Onion", "Potato",
    # vegetables
    "Brinjal", "Green Chilli", "Bhindi (Ladies Finger)", "Cabbage",
    "Cauliflower", "Beans", "Carrot", "Bitter gourd", "Drumstick",
    # fruits
    "Banana", "Banana - Green", "Mango", "Papaya", "Coconut",
    # cash / spice
    "Turmeric", "Ginger (Green)", "Black Pepper", "Cardamom",
    "Arecanut (Betelnut/Supari)", "Coffee", "Cotton",
    # staples
    "Paddy (Dhan)(Common)", "Maize", "Tapioca",
]

con = duckdb.connect()
con.execute(f"CREATE VIEW prices AS SELECT * FROM read_parquet('{PARQUET_GLOB}')")

# dataset latest date (anchor for recency windows)
latest = con.execute(
    f"SELECT MAX({DATE}) FROM prices WHERE {DATE} IS NOT NULL"
).fetchone()[0]
print(f"DATASET LATEST DATE: {latest}\n")

print(f"{'crop':<32}{'match':<8}{'records':>10}{'days':>7}{'best_state':<18}"
      f"{'st_days':>8}{'rec365':>7}{'cv%':>7}  range")
print("-" * 120)

for crop in TARGET_CROPS:
    # 1. exact-name presence
    exact = con.execute(
        f"SELECT COUNT(*) FROM prices WHERE Commodity = ? AND State IN {SOUTH} AND {PRICE}",
        [crop],
    ).fetchone()[0]

    if exact == 0:
        # case-insensitive candidates
        cands = con.execute(
            f"""SELECT DISTINCT Commodity FROM prices
                WHERE LOWER(Commodity) LIKE LOWER(?) AND State IN {SOUTH}
                LIMIT 5""",
            [f"%{crop.split('(')[0].strip()}%"],
        ).fetchall()
        names = [c[0] for c in cands]
        print(f"{crop:<32}{'MISS':<8}{'0':>10}{'':>7}  candidates: {names}")
        continue

    # 2. South-India aggregate profile
    days, dmin, dmax = con.execute(
        f"""SELECT COUNT(DISTINCT {DATE}), MIN({DATE}), MAX({DATE})
            FROM prices WHERE Commodity=? AND State IN {SOUTH} AND {PRICE}
              AND {DATE} IS NOT NULL""",
        [crop],
    ).fetchone()

    # 3. best state
    st, st_days = con.execute(
        f"""SELECT State, COUNT(DISTINCT {DATE}) AS d FROM prices
            WHERE Commodity=? AND State IN {SOUTH} AND {PRICE} AND {DATE} IS NOT NULL
            GROUP BY State ORDER BY d DESC LIMIT 1""",
        [crop],
    ).fetchone()

    # 4. recent continuity in best state (last 365 days of dataset)
    rec = con.execute(
        f"""SELECT COUNT(DISTINCT {DATE}) FROM prices
            WHERE Commodity=? AND State=? AND {PRICE}
              AND {DATE} >= (DATE '{latest}' - INTERVAL 365 DAY)""",
        [crop, st],
    ).fetchone()[0]

    # 5. CV in best state (daily averages)
    cv = con.execute(
        f"""WITH daily AS (
              SELECT {DATE} AS d, AVG(Modal_Price) AS y FROM prices
              WHERE Commodity=? AND State=? AND {PRICE} AND {DATE} IS NOT NULL
              GROUP BY {DATE})
            SELECT ROUND(STDDEV(y)/AVG(y)*100, 1) FROM daily""",
        [crop, st],
    ).fetchone()[0]

    print(f"{crop:<32}{'OK':<8}{exact:>10,}{days:>7}{st:<18}{st_days:>8}{rec:>7}{cv:>7}  {dmin}..{dmax}")

con.close()
