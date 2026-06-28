"""
Pre-warms the forecast cache for the top crops.
Run after setup_data.py to make the first API requests fast.

Usage:
    python scripts/seed_cache.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

TOP_CROPS = ["Tomato", "Onion", "Rice", "Ragi", "Banana"]
FORECAST_DAYS = [30, 60, 90]


def main():
    print("Cache seeding will be available in Phase 3 (after Prophet is implemented).")
    print(f"Will pre-warm forecasts for: {TOP_CROPS}")
    print(f"For horizons: {FORECAST_DAYS} days")


if __name__ == "__main__":
    main()
