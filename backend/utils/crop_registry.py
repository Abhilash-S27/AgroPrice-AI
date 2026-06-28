"""
Centralized crop registry — single source of truth for every crop the
platform supports.

Each entry records:
  canonical   — EXACT dataset Commodity string (case-sensitive)
  category    — core | vegetable | fruit | cash | grain
  home_state  — best state for forecasting (chosen by data depth + recency
                from the Phase-1 dataset audit, scripts/audit_crops.py)
  price_cap   — per-crop Modal_Price upper sanity bound (Rs/qtl).
                Default 100,000 covers everything except Cardamoms
                (avg ₹122,799/qtl — a premium spice, not a data error).
  aliases     — lowercase alternative spellings accepted from API callers

normalize_crop() resolves any user-facing spelling to the canonical
dataset name, replacing the old .title()-based validation that broke
'Bitter gourd' and could never support 'Black pepper' / 'Cardamoms'.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CropInfo:
    canonical: str
    category: str
    home_state: str
    price_cap: int = 100_000
    aliases: tuple[str, ...] = field(default_factory=tuple)


# ── The registry ─────────────────────────────────────────────────────────────
# home_state per Phase-1 audit: best (recent_days_365, distinct_days) combo.
_CROPS: list[CropInfo] = [
    # ── Core forecast crops ──────────────────────────────────────────────
    CropInfo("Tomato",                     "core",      "Karnataka"),
    CropInfo("Onion",                      "core",      "Kerala"),
    CropInfo("Potato",                     "core",      "Kerala"),
    # ── Vegetables ───────────────────────────────────────────────────────
    CropInfo("Brinjal",                    "vegetable", "Telangana"),
    CropInfo("Green Chilli",               "vegetable", "Andhra Pradesh",
             aliases=("green chili", "green chillies")),
    CropInfo("Bhindi (Ladies Finger)",     "vegetable", "Karnataka",
             aliases=("bhindi", "ladies finger", "okra")),
    CropInfo("Cabbage",                    "vegetable", "Karnataka"),
    CropInfo("Cauliflower",                "vegetable", "Kerala"),
    CropInfo("Beans",                      "vegetable", "Karnataka"),
    CropInfo("Carrot",                     "vegetable", "Karnataka"),
    CropInfo("Bitter gourd",               "vegetable", "Kerala",
             aliases=("bitter gourd", "bittergourd")),
    CropInfo("Drumstick",                  "vegetable", "Kerala"),
    # ── Fruits ───────────────────────────────────────────────────────────
    CropInfo("Banana",                     "fruit",     "Kerala"),
    CropInfo("Banana - Green",             "fruit",     "Kerala",
             aliases=("banana green", "green banana")),
    CropInfo("Mango",                      "fruit",     "Kerala"),
    CropInfo("Papaya",                     "fruit",     "Kerala"),
    CropInfo("Coconut",                    "fruit",     "Kerala"),
    # ── Cash / spice crops ───────────────────────────────────────────────
    CropInfo("Turmeric",                   "cash",      "Telangana"),
    CropInfo("Ginger (Green)",             "cash",      "Kerala",
             aliases=("ginger", "green ginger")),
    CropInfo("Black pepper",               "cash",      "Kerala",
             aliases=("black pepper", "pepper")),
    CropInfo("Cardamoms",                  "cash",      "Kerala",
             price_cap=500_000,
             aliases=("cardamom", "cardamoms", "elaichi")),
    CropInfo("Arecanut (Betelnut/Supari)", "cash",      "Karnataka",
             aliases=("arecanut", "betelnut", "supari")),
    CropInfo("Coffee",                     "cash",      "Kerala"),
    CropInfo("Cotton",                     "cash",      "Andhra Pradesh"),
    # ── Staples / grains ─────────────────────────────────────────────────
    CropInfo("Paddy (Dhan)(Common)",       "grain",     "Telangana",
             aliases=("paddy", "rice paddy", "dhan")),
    CropInfo("Maize",                      "grain",     "Karnataka"),
    CropInfo("Tapioca",                    "grain",     "Kerala",
             aliases=("cassava",)),
]

CATEGORY_LABELS: dict[str, str] = {
    "core":      "Core Crops",
    "vegetable": "Vegetables",
    "fruit":     "Fruits",
    "cash":      "Cash & Spice Crops",
    "grain":     "Staples & Grains",
}

# ── Lookup tables (built once) ───────────────────────────────────────────────
CROP_REGISTRY: dict[str, CropInfo] = {c.canonical: c for c in _CROPS}
ALL_CROPS: list[str] = [c.canonical for c in _CROPS]

_ALIAS_INDEX: dict[str, str] = {}
for _c in _CROPS:
    _ALIAS_INDEX[_c.canonical.lower()] = _c.canonical
    for _a in _c.aliases:
        _ALIAS_INDEX[_a.lower()] = _c.canonical


def normalize_crop(raw: str) -> str:
    """
    Resolve any accepted spelling to the canonical dataset Commodity name.
    Case-insensitive; understands aliases ('Black Pepper' → 'Black pepper',
    'Cardamom' → 'Cardamoms'). Raises ValueError for unsupported crops.
    """
    key = raw.strip().lower()
    canonical = _ALIAS_INDEX.get(key)
    if canonical is None:
        raise ValueError(
            f"Unknown crop '{raw}'. Supported crops: {ALL_CROPS}"
        )
    return canonical


def crop_info(crop: str) -> CropInfo:
    """Registry record for a canonical crop name (call normalize_crop first)."""
    return CROP_REGISTRY[crop]


def home_state(crop: str) -> str:
    return CROP_REGISTRY[crop].home_state


def price_cap(crop: str) -> int:
    info = CROP_REGISTRY.get(crop)
    return info.price_cap if info else 100_000


def crops_by_category() -> dict[str, list[str]]:
    """{category: [canonical names]} preserving registry order."""
    out: dict[str, list[str]] = {}
    for c in _CROPS:
        out.setdefault(c.category, []).append(c.canonical)
    return out
