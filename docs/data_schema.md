# Parquet File Schema

All parquet files placed in `data/raw/parquet/` must conform to this schema.
Run `python scripts/validate_parquet.py` to check your files before ingestion.

## Required Columns

| Column | Type | Description | Example |
|---|---|---|---|
| `date` | `date` or `string` (YYYY-MM-DD) | Price observation date | `2024-01-15` |
| `crop` | `string` | Crop name (case-insensitive) | `tomato`, `Tomato` |
| `state` | `string` | South Indian state (case-insensitive) | `Tamil Nadu` |
| `market` | `string` | APMC mandi name | `Koyambedu` |
| `min_price` | `float` | Minimum traded price (₹/quintal) | `800.0` |
| `max_price` | `float` | Maximum traded price (₹/quintal) | `1400.0` |
| `modal_price` | `float` | Most common traded price (₹/quintal) | `1100.0` |

## Optional Columns (enrichment, ignored if absent)

| Column | Type | Description |
|---|---|---|
| `variety` | `string` | Crop variety (e.g., `Hybrid`, `Desi`) |
| `grade` | `string` | Quality grade |
| `arrivals_tonnes` | `float` | Quantity arriving at market |

## Naming Convention

```
data/raw/parquet/
├── {crop}_{year_range}.parquet          # Single crop, year range
├── {crop}_{state}_{year_range}.parquet  # Single crop + state
└── all_crops_{year}.parquet             # All crops for one year
```

Examples:
```
tomato_2015_2020.parquet
onion_tamilnadu_2015_2026.parquet
all_crops_2024.parquet
```

## Data Quality Rules

- `modal_price` must be between `min_price` and `max_price`
- Prices are in ₹/quintal (1 quintal = 100 kg)
- Dates should be daily (not all markets trade every day — gaps are acceptable)
- Minimum 30 rows per crop to run a forecast

## Source

The recommended dataset source is the AGMARKNET portal (agmarknet.gov.in),
which provides daily APMC mandi prices for all major Indian crops.
