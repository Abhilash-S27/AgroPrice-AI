"""
Validates parquet file schemas against the AGMARKNET column spec.
Run: python scripts/validate_parquet.py
"""
import sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, str(Path(__file__).parent.parent))

import pyarrow.parquet as pq

REQUIRED_COLUMNS = {
    "State", "District", "Market", "Commodity", "Variety", "Grade",
    "Arrival_Date", "Min_Price", "Max_Price", "Modal_Price", "Commodity_Code",
}
PRICE_COLUMNS = {"Min_Price", "Max_Price", "Modal_Price"}
PARQUET_DIR = Path("data/raw/parquet")


def validate_file(path: Path) -> bool:
    try:
        pf     = pq.ParquetFile(path)
        schema = pf.schema_arrow
        cols   = {schema.field(i).name for i in range(len(schema))}
        rows   = pf.metadata.num_rows
        size   = round(path.stat().st_size / 1024 / 1024, 1)

        missing = REQUIRED_COLUMNS - cols
        if missing:
            print(f"  FAIL  {path.name:<20}  missing: {sorted(missing)}")
            return False

        type_errors = []
        for i in range(len(schema)):
            name  = schema.field(i).name
            dtype = str(schema.field(i).type)
            if name in PRICE_COLUMNS and "float" not in dtype and "double" not in dtype and "int" not in dtype:
                type_errors.append(f"{name}={dtype}")
        if type_errors:
            print(f"  WARN  {path.name:<20}  bad dtypes: {type_errors}")

        print(f"  OK    {path.name:<20}  {rows:>9,} rows   {size:>6.1f} MB")
        return True
    except Exception as e:
        print(f"  ERROR {path.name:<20}  {e}")
        return False


def main():
    files = sorted(PARQUET_DIR.glob("*.parquet"))
    if not files:
        print(f"No .parquet files in {PARQUET_DIR}/")
        sys.exit(1)

    print(f"\nValidating {len(files)} file(s) in {PARQUET_DIR}/\n")
    results = [validate_file(f) for f in files]
    passed  = sum(results)
    print(f"\nResult: {passed}/{len(files)} files passed.")
    if passed < len(files):
        sys.exit(1)
    else:
        print("All files are ready for ingestion.")


if __name__ == "__main__":
    main()
