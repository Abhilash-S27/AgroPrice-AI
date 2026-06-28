"""
Parquet schema inspection and data quality report.
Reads all yearly parquet files via DuckDB — no data loaded into memory.
Run: python scripts/inspect_parquet.py
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path
from collections import defaultdict

import duckdb
import pyarrow.parquet as pq

PARQUET_DIR = Path("data/raw/parquet")
SEP = "-" * 72


def section(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def run() -> None:
    files = sorted(PARQUET_DIR.glob("*.parquet"))
    if not files:
        print("No parquet files found in data/raw/parquet/")
        sys.exit(1)

    con = duckdb.connect(":memory:")

    # ── 1. Per-file schema snapshot ────────────────────────────────────────
    section("1. FILE INVENTORY & SCHEMA")
    schemas: dict[str, dict] = {}  # year → {col: dtype}
    row_counts: dict[str, int] = {}

    for f in files:
        year = f.stem
        pq_file = pq.ParquetFile(f)
        schema = pq_file.schema_arrow
        col_types = {schema.field(i).name: str(schema.field(i).type) for i in range(len(schema))}
        row_count = pq_file.metadata.num_rows
        schemas[year] = col_types
        row_counts[year] = row_count
        size_kb = round(f.stat().st_size / 1024, 1)
        print(f"\n  [{year}]  {row_count:>8,} rows   {size_kb:>8} KB")
        for col, dtype in col_types.items():
            print(f"          {col:<35} {dtype}")

    total_rows = sum(row_counts.values())
    print(f"\n  TOTAL ROWS: {total_rows:,}")

    # ── 2. Schema consistency check ────────────────────────────────────────
    section("2. SCHEMA CONSISTENCY CHECK")

    all_col_names = [set(s.keys()) for s in schemas.values()]
    reference_cols = all_col_names[0]
    reference_year = list(schemas.keys())[0]
    all_same = all(c == reference_cols for c in all_col_names)

    if all_same:
        print(f"  COLUMNS: Identical across all {len(files)} files.")
        print(f"  Columns: {sorted(reference_cols)}")
    else:
        print("  COLUMNS: MISMATCH DETECTED")
        for year, cols in schemas.items():
            missing = reference_cols - cols
            extra   = cols - reference_cols
            if missing:
                print(f"    {year}: MISSING columns → {missing}")
            if extra:
                print(f"    {year}: EXTRA   columns → {extra}")

    # Type consistency check
    print("\n  DTYPE CONSISTENCY:")
    all_years = list(schemas.keys())
    all_cols_union = set().union(*[set(s.keys()) for s in schemas.values()])

    type_issues = []
    for col in sorted(all_cols_union):
        types_seen = {}
        for year, schema in schemas.items():
            if col in schema:
                t = schema[col]
                types_seen.setdefault(t, []).append(year)
        if len(types_seen) == 1:
            dtype = list(types_seen.keys())[0]
            print(f"    {col:<35} {dtype}  ✓ consistent")
        else:
            print(f"    {col:<35} MIXED TYPES ←")
            for dtype, years in types_seen.items():
                print(f"       {dtype:<30} in {years}")
            type_issues.append(col)

    # ── 3. Row count per year ──────────────────────────────────────────────
    section("3. ROW COUNTS PER YEAR")
    for year, count in sorted(row_counts.items()):
        bar = "█" * (count // 50000)
        print(f"  {year}  {count:>9,}  {bar}")
    print(f"\n  Total: {total_rows:,} rows across {len(files)} years")

    # ── 4. Build unified DuckDB view ───────────────────────────────────────
    glob_path = str(PARQUET_DIR / "*.parquet").replace("\\", "/")
    con.execute(f"CREATE OR REPLACE VIEW prices AS SELECT * FROM read_parquet('{glob_path}')")

    # ── 5. Detect actual column names (lowercase map) ─────────────────────
    describe = con.execute("DESCRIBE prices").fetchall()
    actual_cols = {row[0].lower(): row[0] for row in describe}
    print()
    section("4. ACTUAL COLUMN NAMES IN UNIFIED VIEW")
    for orig, cased in actual_cols.items():
        print(f"  {cased}")

    # ── 5. Find the price, date, crop, state columns ──────────────────────
    # Try common naming patterns
    def find_col(candidates: list[str]) -> str | None:
        for c in candidates:
            if c.lower() in actual_cols:
                return actual_cols[c.lower()]
        return None

    col_date   = find_col(["date", "arrival_date", "price_date", "Date", "Arrival Date", "arrival date"])
    col_crop   = find_col(["commodity", "crop", "Commodity", "Crop", "commodity_name"])
    col_state  = find_col(["state", "State", "state_name"])
    col_market = find_col(["market", "Market", "district", "mandi", "market_name", "District"])
    col_modal  = find_col(["modal_price", "modal price", "Modal Price", "modalprice", "modal", "Modal"])
    col_min    = find_col(["min_price", "min price", "Min Price", "minimum price", "Minimum Price", "min"])
    col_max    = find_col(["max_price", "max price", "Max Price", "maximum price", "Maximum Price", "max"])

    section("5. SEMANTIC COLUMN MAPPING")
    print(f"  date column    → {col_date}")
    print(f"  crop column    → {col_crop}")
    print(f"  state column   → {col_state}")
    print(f"  market column  → {col_market}")
    print(f"  modal_price    → {col_modal}")
    print(f"  min_price      → {col_min}")
    print(f"  max_price      → {col_max}")

    missing_critical = [n for n, v in [
        ("date", col_date), ("crop", col_crop), ("modal_price", col_modal)
    ] if v is None]
    if missing_critical:
        print(f"\n  CRITICAL MISSING: {missing_critical}")
        print("  Cannot continue analysis without date, crop, and modal_price columns.")

    # ── 6. Date range analysis ─────────────────────────────────────────────
    section("6. DATE RANGE ANALYSIS")
    if col_date:
        date_q = f'SELECT MIN("{col_date}") AS min_d, MAX("{col_date}") AS max_d FROM prices'
        row = con.execute(date_q).fetchone()
        print(f"  Earliest date: {row[0]}")
        print(f"  Latest date:   {row[1]}")

        per_year_q = f"""
            SELECT
                YEAR(CAST("{col_date}" AS DATE)) AS yr,
                MIN("{col_date}") AS from_d,
                MAX("{col_date}") AS to_d,
                COUNT(*) AS rows,
                COUNT(DISTINCT MONTH(CAST("{col_date}" AS DATE))) AS months_covered
            FROM prices
            GROUP BY yr
            ORDER BY yr
        """
        rows = con.execute(per_year_q).fetchall()
        print(f"\n  {'Year':<6} {'From':<14} {'To':<14} {'Rows':>10} {'Months':>8}")
        print(f"  {'─'*6} {'─'*13} {'─'*13} {'─'*10} {'─'*8}")
        for r in rows:
            print(f"  {r[0]:<6} {str(r[1]):<14} {str(r[2]):<14} {r[3]:>10,} {r[4]:>8}")
    else:
        print("  SKIP — date column not found")

    # ── 7. Unique states ───────────────────────────────────────────────────
    section("7. UNIQUE STATES")
    if col_state:
        state_q = f'SELECT "{col_state}" AS state, COUNT(*) AS rows FROM prices GROUP BY state ORDER BY rows DESC'
        rows = con.execute(state_q).fetchall()
        print(f"  {'State':<40} {'Rows':>10}")
        print(f"  {'─'*40} {'─'*10}")
        for r in rows[:40]:
            print(f"  {str(r[0]):<40} {r[1]:>10,}")
        if len(rows) > 40:
            print(f"  ... and {len(rows)-40} more states")
        print(f"\n  Total unique states: {len(rows)}")
    else:
        print("  SKIP — state column not found")

    # ── 8. Unique crops ────────────────────────────────────────────────────
    section("8. UNIQUE CROPS (top 60 by row count)")
    if col_crop:
        crop_q = f'SELECT "{col_crop}" AS crop, COUNT(*) AS rows FROM prices GROUP BY crop ORDER BY rows DESC LIMIT 80'
        rows = con.execute(crop_q).fetchall()
        print(f"  {'Crop':<40} {'Rows':>10}")
        print(f"  {'─'*40} {'─'*10}")
        for r in rows:
            print(f"  {str(r[0]):<40} {r[1]:>10,}")
        total_crops_q = f'SELECT COUNT(DISTINCT "{col_crop}") FROM prices'
        total_crops = con.execute(total_crops_q).fetchone()[0]
        print(f"\n  Total unique crop names: {total_crops}")
    else:
        print("  SKIP — crop column not found")

    # ── 9. Null analysis ───────────────────────────────────────────────────
    section("9. NULL / MISSING VALUE ANALYSIS")
    for col_name, col_actual in [
        ("date", col_date), ("crop", col_crop), ("state", col_state),
        ("market", col_market), ("modal_price", col_modal),
        ("min_price", col_min), ("max_price", col_max)
    ]:
        if col_actual:
            null_q = f'SELECT COUNT(*) FROM prices WHERE "{col_actual}" IS NULL'
            null_count = con.execute(null_q).fetchone()[0]
            pct = null_count / total_rows * 100
            flag = "  ← PROBLEM" if pct > 1.0 else ""
            print(f"  {col_name:<20} nulls: {null_count:>8,}  ({pct:.2f}%){flag}")

    # ── 10. Price range sanity check ───────────────────────────────────────
    section("10. PRICE SANITY CHECK (modal_price)")
    if col_modal:
        price_q = f"""
            SELECT
                MIN("{col_modal}")  AS p_min,
                MAX("{col_modal}")  AS p_max,
                AVG("{col_modal}")  AS p_avg,
                STDDEV("{col_modal}") AS p_std,
                COUNT(*) FILTER (WHERE "{col_modal}" <= 0) AS zero_or_neg,
                COUNT(*) FILTER (WHERE "{col_modal}" > 500000) AS extreme_high
            FROM prices
        """
        r = con.execute(price_q).fetchone()
        print(f"  min_modal_price:   {r[0]:>12,.2f}")
        print(f"  max_modal_price:   {r[1]:>12,.2f}")
        print(f"  avg_modal_price:   {r[2]:>12,.2f}")
        print(f"  stddev:            {r[3]:>12,.2f}")
        print(f"  zero/negative:     {r[4]:>12,}  {'← PROBLEM' if r[4] > 0 else ''}")
        print(f"  extreme (>500k):   {r[5]:>12,}  {'← CHECK' if r[5] > 0 else ''}")

    # ── 11. Duplicate check ────────────────────────────────────────────────
    section("11. DUPLICATE ROW CHECK")
    if col_date and col_crop and col_state and col_market:
        dup_q = f"""
            SELECT COUNT(*) AS dup_count FROM (
                SELECT "{col_date}", "{col_crop}", "{col_state}", "{col_market}",
                       COUNT(*) AS cnt
                FROM prices
                GROUP BY "{col_date}", "{col_crop}", "{col_state}", "{col_market}"
                HAVING cnt > 1
            )
        """
        dup_count = con.execute(dup_q).fetchone()[0]
        print(f"  Duplicate (date+crop+state+market) groups: {dup_count:,}")
        if dup_count > 0:
            print("  ← These may be multiple varieties/grades per market on same day — normal in AGMARKNET data")

    # ── 12. South India filter check ─────────────────────────────────────
    section("12. SOUTH INDIA STATE COVERAGE")
    south_states = ['Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Kerala']
    if col_state:
        for s in south_states:
            q = f"SELECT COUNT(*) FROM prices WHERE LOWER(\"{col_state}\") = LOWER('{s}')"
            count = con.execute(q).fetchone()[0]
            print(f"  {s:<25} {count:>10,} rows")

    # ── 13. Forecasting readiness ─────────────────────────────────────────
    section("13. FORECASTING READINESS SUMMARY")
    if col_date and col_crop and col_modal and col_state:
        # Check continuity for top crop in biggest state
        continuity_q = f"""
            SELECT
                YEAR(CAST("{col_date}" AS DATE)) AS yr,
                COUNT(DISTINCT CAST("{col_date}" AS DATE)) AS distinct_days
            FROM prices
            WHERE LOWER("{col_state}") = 'tamil nadu'
              AND LOWER("{col_crop}") LIKE '%tomato%'
            GROUP BY yr
            ORDER BY yr
        """
        rows = con.execute(continuity_q).fetchall()
        print("  Date continuity for Tomato / Tamil Nadu:")
        for r in rows:
            completeness = r[1] / 365 * 100
            bar = "█" * (r[1] // 20)
            print(f"    {r[0]}  {r[1]:>4} distinct days ({completeness:.0f}%)  {bar}")

    con.close()
    print(f"\n{SEP}")
    print("  INSPECTION COMPLETE")
    print(SEP)


if __name__ == "__main__":
    run()
