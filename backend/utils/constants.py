"""
Domain constants derived from actual parquet schema inspection.
Column names map directly to the AGMARKNET dataset columns.
"""

# ── Actual parquet column names ────────────────────────────────────────────
# These are the real column names found in the AGMARKNET yearly parquet files.
# Use these everywhere — do not hardcode strings in queries.
class Cols:
    DATE          = "Arrival_Date"    # stored as string 'YYYY-MM-DD', parseable
    COMMODITY     = "Commodity"       # crop name
    VARIETY       = "Variety"         # e.g. 'Deshi', 'Local', 'Other'
    GRADE         = "Grade"
    STATE         = "State"
    DISTRICT      = "District"        # sub-region within state
    MARKET        = "Market"          # APMC mandi name
    MIN_PRICE     = "Min_Price"       # float, Rs/quintal
    MAX_PRICE     = "Max_Price"       # float, Rs/quintal
    MODAL_PRICE   = "Modal_Price"     # float, Rs/quintal — primary price for forecasting
    COMMODITY_CODE= "Commodity_Code"  # int, redundant — skip in most queries


# ── Price outlier threshold ────────────────────────────────────────────────
# 815 rows have Modal_Price > 500,000 — confirmed data entry errors.
# 100,000 safely covers all legitimate South Indian crop prices (incl. Arecanut ~28k avg).
PRICE_OUTLIER_UPPER = 100_000   # Rs/quintal
PRICE_OUTLIER_LOWER = 1         # exclude zero/near-zero prices


# ── South Indian states ────────────────────────────────────────────────────
# Exactly as they appear in the State column.
SOUTH_INDIAN_STATES = [
    "Tamil Nadu",
    "Karnataka",
    "Andhra Pradesh",
    "Telangana",
    "Kerala",
]


# ── Recommended crops for South India forecasting ─────────────────────────
# Phase-1 architecture: the central registry (backend/utils/crop_registry.py)
# is the single source of truth for crop names, categories, aliases, home
# states and per-crop price caps. The lists below are kept as back-compat
# views over the registry for older imports.
from backend.utils.crop_registry import ALL_CROPS as ALL_RECOMMENDED_CROPS  # noqa: F401

# Historical tier groupings (pre-Phase-1, kept for any legacy callers).
# Forecast capability is now classified per-crop at runtime (Tier A–D)
# from data depth + recency + volatility — not from these static lists.
TIER1_CROPS = [
    "Tomato",
    "Onion",
    "Banana",
    "Brinjal",
    "Green Chilli",
]

TIER2_CROPS = [
    "Paddy (Dhan)(Common)",
    "Bhindi (Ladies Finger)",
    "Drumstick",
    "Coconut",
    "Ginger (Green)",
    "Bitter gourd",
    "Carrot",
    "Cabbage",
]

TIER3_CROPS = [
    "Arecanut (Betelnut/Supari)",
    "Tapioca",
    "Banana - Green",
    "Cotton",
    "Maize",
]


# ── Tamil Nadu data availability notes ────────────────────────────────────
# Tamil Nadu reporting varies by crop:
#   Banana  : 3136 days — good from 2015 onwards
#   Onion   : 653 days  — starts Nov 2016
#   Tomato  : 623 days  — starts Oct 2023
#   Most others: sparse before 2024
# Safe default for Tomato/Chilli forecasting in Tamil Nadu: use 2024-01-01.
# For Banana/Onion in Tamil Nadu: data goes back further — use all available.
TAMIL_NADU_TOMATO_START  = "2023-10-01"   # Tomato in TN starts Oct 2023
TAMIL_NADU_DEFAULT_START = "2024-01-01"   # Safe default for most TN crops
TAMIL_NADU_DATA_START    = TAMIL_NADU_DEFAULT_START   # kept for back-compat


# ── Agricultural seasons (South India) ────────────────────────────────────
# Kharif (June–October): monsoon crops — rice, maize, groundnut
# Rabi  (November–March): winter crops — tomato, onion, carrot
KHARIF_MONTHS = {6, 7, 8, 9, 10}
RABI_MONTHS   = {11, 12, 1, 2, 3}


# ── Price unit ─────────────────────────────────────────────────────────────
PRICE_UNIT = "Rs/quintal"
PRICE_UNIT_SYMBOL = "₹/qtl"
