"""
Phase 1 verification: run EVERY registered crop through the live forecast
API at its home state. Asserts each crop ends in a working state:
Prophet forecast (Tier A/B), sparse-trend (Tier C), or a structured
analytics-only 422 (Tier D) — never an unhandled failure.

Also validates alias resolution and forecast realism (non-flat unless
the series is genuinely stable, positive prices, sane bands).
"""
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.utils.crop_registry import _CROPS  # noqa: E402

BASE = "http://localhost:8001"

results = []
t0 = time.time()
for c in _CROPS:
    url = f"{BASE}/api/forecasts/{requests.utils.quote(c.canonical)}/{requests.utils.quote(c.home_state)}"
    try:
        r = requests.get(url, params={"days": 30}, timeout=300)
        if r.status_code == 200:
            d = r.json()
            fc = d["forecast"]
            prices = [p["predicted_price"] for p in fc]
            spread = max(prices) - min(prices)
            flat = spread < 0.001 * (sum(prices) / len(prices))
            ok_bands = all(p["lower_bound"] <= p["predicted_price"] <= p["upper_bound"] for p in fc)
            ok_pos = all(p["predicted_price"] > 0 for p in fc)
            status = "OK" if (ok_bands and ok_pos) else "BAD-OUTPUT"
            results.append((c.canonical, c.home_state, d.get("tier"), d.get("method"),
                            d["training_rows"], status, "FLAT?" if flat else ""))
        elif r.status_code == 422:
            detail = r.json().get("detail", "")
            ok = "Analytics-only" in detail or "analytics" in detail.lower()
            results.append((c.canonical, c.home_state, "D", "none", 0,
                            "OK-ANALYTICS" if ok else "BAD-422", detail[:50]))
        else:
            results.append((c.canonical, c.home_state, "?", "?", 0, f"HTTP-{r.status_code}", r.text[:60]))
    except Exception as e:
        results.append((c.canonical, c.home_state, "?", "?", 0, "EXCEPTION", str(e)[:60]))

print(f"\n{'crop':<32}{'state':<16}{'tier':<6}{'method':<14}{'rows':>6}  status")
print("-" * 95)
fails = 0
for crop, state, tier, method, rows, status, note in results:
    if not status.startswith("OK"):
        fails += 1
    print(f"{crop:<32}{state:<16}{tier or '?':<6}{method or '?':<14}{rows:>6}  {status} {note}")

# alias checks via API
print("\nAlias checks:")
for alias in ["Black Pepper", "cardamom", "bitter gourd", "okra"]:
    r = requests.get(f"{BASE}/api/prices/history/{requests.utils.quote(alias)}/Kerala",
                     params={"limit": 5}, timeout=60)
    print(f"  {alias!r:18s} -> HTTP {r.status_code}")
    if r.status_code != 200:
        fails += 1

mins = (time.time() - t0) / 60
print(f"\n{len(results)} crops verified in {mins:.1f} min — {'ALL PASS' if fails == 0 else f'{fails} FAILURES'}")
sys.exit(1 if fails else 0)
