from backend.utils.constants import SOUTH_INDIAN_STATES
from backend.utils.crop_registry import normalize_crop


def validate_crop(crop: str) -> str:
    """
    Normalize and validate a crop name via the central registry.

    Case-insensitive and alias-aware ('Black Pepper' → 'Black pepper',
    'Cardamom' → 'Cardamoms', 'bitter gourd' → 'Bitter gourd').
    Raises ValueError for unsupported crops.

    NOTE: the old implementation used str.title(), which silently broke
    canonical names that aren't title-cased ('Bitter gourd' → 'Bitter Gourd'
    → "Unknown crop"). The registry lookup has no such failure mode.
    """
    return normalize_crop(crop)


def validate_state(state: str) -> str:
    """Normalize and validate state name. Raises ValueError if unknown."""
    normalized = state.strip().title()
    if normalized not in SOUTH_INDIAN_STATES:
        raise ValueError(f"Unknown state '{state}'. Supported: {SOUTH_INDIAN_STATES}")
    return normalized


def validate_forecast_days(days: int) -> int:
    if days < 7:
        raise ValueError("Forecast must be at least 7 days")
    if days > 365:
        raise ValueError("Forecast cannot exceed 365 days")
    return days
