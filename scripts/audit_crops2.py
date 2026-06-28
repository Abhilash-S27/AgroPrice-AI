"""Phase 1 audit part 2 — problem crops deep-dive."""
from pathlib import Path
import duckdb

ROOT = Path(__file__).resolve().parents[1]
PARQUET_GLOB = str(ROOT / "data" / "raw" / "parquet" / "*.parquet").replace("\\", "/")
SOUTH = "('Tamil Nadu','Karnataka','Andhra Pradesh','Telangana','Kerala')"
DATE = "TRY_CAST(Arrival_Date AS DATE)"

con = duckdb.connect()
con.execute(f"CREATE VIEW prices AS SELECT * FROM read_parquet('{PARQUET_GLOB}')")
latest = con.execute(f"SELECT MAX({DATE}) FROM prices").fetchone()[0]

print("== 1. Cardamom price distribution (is the 100k outlier cap killing it?) ==")
for name in ["Cardamom", "Cardamoms"]:
    r = con.execute(
        f"""SELECT COUNT(*), MIN(Modal_Price), ROUND(AVG(Modal_Price),0), MAX(Modal_Price),
                   COUNT(DISTINCT {DATE})
            FROM prices WHERE Commodity=? AND State IN {SOUTH}""",
        [name],
    ).fetchone()
    print(f"  {name:<12} rows={r[0]:>7,}  price min/avg/max = {r[1]}/{r[2]}/{r[3]}  days={r[4]}")
    if r[0]:
        st = con.execute(
            f"""SELECT State, COUNT(DISTINCT {DATE}) d,
                       COUNT(DISTINCT CASE WHEN {DATE} >= (DATE '{latest}' - INTERVAL 365 DAY) THEN {DATE} END) recent
                FROM prices WHERE Commodity=? AND State IN {SOUTH}
                GROUP BY State ORDER BY d DESC""",
            [name],
        ).fetchall()
        print(f"               per-state: {st}")

print("\n== 2. Black pepper profile ==")
r = con.execute(
    f"""SELECT State, COUNT(*) n, COUNT(DISTINCT {DATE}) AS d,
               COUNT(DISTINCT CASE WHEN {DATE} >= (DATE '{latest}' - INTERVAL 365 DAY) THEN {DATE} END) recent,
               ROUND(AVG(Modal_Price),0) avg_p, MAX(Modal_Price) max_p
        FROM prices WHERE Commodity='Black pepper' AND State IN {SOUTH}
          AND Modal_Price BETWEEN 1 AND 100000
        GROUP BY State ORDER BY d DESC""",
).fetchall()
for row in r:
    print(f"  {row}")

print("\n== 3. Turmeric per-state recency ==")
r = con.execute(
    f"""SELECT State, COUNT(DISTINCT {DATE}) AS d,
               COUNT(DISTINCT CASE WHEN {DATE} >= (DATE '{latest}' - INTERVAL 365 DAY) THEN {DATE} END) recent,
               MAX({DATE}) last_seen
        FROM prices WHERE Commodity='Turmeric' AND State IN {SOUTH}
          AND Modal_Price BETWEEN 1 AND 100000
        GROUP BY State ORDER BY recent DESC""",
).fetchall()
for row in r:
    print(f"  {row}")

print("\n== 4. Mango / Papaya / Coffee per-state recency ==")
for crop in ["Mango", "Papaya", "Coffee"]:
    r = con.execute(
        f"""SELECT State, COUNT(DISTINCT {DATE}) AS d,
                   COUNT(DISTINCT CASE WHEN {DATE} >= (DATE '{latest}' - INTERVAL 365 DAY) THEN {DATE} END) recent
            FROM prices WHERE Commodity=? AND State IN {SOUTH}
              AND Modal_Price BETWEEN 1 AND 100000
            GROUP BY State ORDER BY recent DESC LIMIT 3""",
        [crop],
    ).fetchall()
    print(f"  {crop}: {r}")

print("\n== 5. Paddy recency (dataset ends 2025-11-05 for it) ==")
r = con.execute(
    f"""SELECT State, COUNT(DISTINCT {DATE}) AS d,
               COUNT(DISTINCT CASE WHEN {DATE} >= (DATE '{latest}' - INTERVAL 365 DAY) THEN {DATE} END) recent,
               MAX({DATE}) last_seen
        FROM prices WHERE Commodity='Paddy (Dhan)(Common)' AND State IN {SOUTH}
          AND Modal_Price BETWEEN 1 AND 100000
        GROUP BY State ORDER BY recent DESC""",
).fetchall()
for row in r:
    print(f"  {row}")

con.close()
