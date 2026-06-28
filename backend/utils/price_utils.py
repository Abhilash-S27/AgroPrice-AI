import pandas as pd


def classify_trend(prices: pd.Series, window: int = 7) -> str:
    """
    Classify a price series trend over the last `window` days.
    Returns 'rising', 'falling', or 'stable'.
    """
    if len(prices) < window:
        return "stable"
    recent = prices.tail(window)
    change_pct = (recent.iloc[-1] - recent.iloc[0]) / recent.iloc[0] * 100
    if change_pct > 5:
        return "rising"
    if change_pct < -5:
        return "falling"
    return "stable"


def quintal_to_kg(price_per_quintal: float) -> float:
    """Convert ₹/quintal to ₹/kg (1 quintal = 100 kg)."""
    return round(price_per_quintal / 100, 2)


def kg_to_quintal(price_per_kg: float) -> float:
    """Convert ₹/kg to ₹/quintal."""
    return round(price_per_kg * 100, 2)


def price_change_pct(old: float, new: float) -> float:
    """Percentage change from old to new price."""
    if old == 0:
        return 0.0
    return round((new - old) / old * 100, 2)
