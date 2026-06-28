"""Phase 3 conversational intelligence verification."""
import sys
import requests

BASE = "http://localhost:8001/api/ai"

def chat(message, crop="Tomato", state="Karnataka", history=None):
    r = requests.post(f"{BASE}/chat", json={
        "message": message, "crop": crop, "state": state, "days": 30,
        "history": history or [],
    }, timeout=180)
    r.raise_for_status()
    return r.json()

fails = []

def check(name, cond, info):
    print(f"[{'PASS' if cond else 'FAIL'}] {name}")
    print(f"        {str(info)[:170]}")
    if not cond:
        fails.append(name)

# A. multi-turn memory chain
r1 = chat("What was tomato price in Jan 2020?")
check("A1 Jan 2020 base", "Jan 2020" in r1["reply"] and "₹" in r1["reply"], r1["reply"])

h = [{"role": "user", "text": "What was tomato price in Jan 2020?"},
     {"role": "ai", "text": r1["reply"]}]
r2 = chat("What about Feb?", history=h)
check("A2 'What about Feb?' inherits year", "Feb 2020" in r2["reply"], r2["reply"])
check("A2 inferred pills", any("year" in p for p in r2.get("inferred_context", [])), r2.get("inferred_context"))

h += [{"role": "user", "text": "What about Feb?"}, {"role": "ai", "text": r2["reply"]}]
r3 = chat("And in Kerala?", history=h)
check("A3 'And in Kerala?' switches state, keeps crop+period",
      "Kerala" in r3["reply"] and "₹" in r3["reply"], r3["reply"])

# B. cross-crop comparison
r = chat("Compare Onion vs Tomato volatility", crop="Onion", state="Kerala")
check("B compare volatility", "CV" in r["reply"] and "Tomato" in r["reply"], r["reply"])

# C. farmer advisory
r = chat("What should Karnataka farmers grow for lower risk?")
check("C lower-risk advisory", r["intent"] == "adv_safest" and "CV" in r["reply"], f"[{r['intent']}] {r['reply']}")

r = chat("Which crop is safest right now?")
check("C2 safest ranking", r["intent"] == "adv_safest" and "1." in r["reply"], r["reply"])

r = chat("What should farmers store right now?")
check("C3 storage advisory", "storage" in r["reply"].lower() or "holding" in r["reply"].lower(), f"[{r['intent']}] {r['reply']}")

r = chat("Which crop has the strongest recovery momentum?")
check("C4 momentum advisory", r["intent"] == "adv_momentum" and "%/7d" in r["reply"], f"[{r['intent']}] {r['reply']}")

# D. fallback intelligence (chat-level)
r = chat("What's the trend?", crop="Coffee", state="Andhra Pradesh")
check("D Coffee/AP fallback", "insufficient continuity" in r["reply"] and "Karnataka" in r["reply"] or "Kerala" in r["reply"], r["reply"])

# regional alternatives present in insights for Mode-D pair
ri = requests.get(f"{BASE}/insights", params={"crop": "Coffee", "state": "Andhra Pradesh", "days": 30}, timeout=180).json()
check("D2 insights alternatives", isinstance(ri.get("regional", {}).get("alternatives"), list), ri.get("regional", {}).get("alternatives"))
check("D3 confidence breakdown exists (Mode A)",
      len(requests.get(f"{BASE}/insights", params={"crop": "Tomato", "state": "Karnataka", "days": 30}, timeout=180).json()
          .get("confidence", {}).get("breakdown", [])) == 6, "6 weighted factors")

# E. temporal reasoning
r = chat("How did tomato perform during covid?")
check("E covid era", "2020" in r["reply"] and "₹" in r["reply"], r["reply"])

r = chat("What was the price before covid?")
check("E2 pre-covid era", "2015" in r["reply"] or "2019" in r["reply"] or "pre-COVID" in r["reply"], r["reply"])

# dynamic greeting
r = chat("hi")
check("F dynamic greeting", "Tomato" in r["reply"] and ("momentum" in r["reply"] or "phase" in r["reply"]) and "Hello" in r["reply"], r["reply"])

# autonomous reasoning in historical answer
r = chat("What was tomato price in Jan 2020?")
check("G reasoning-enriched history",
      ("subdued" in r["reply"] or "elevated" in r["reply"] or "comparable" in r["reply"]) and "vs" in r["reply"].lower() or "against that period" in r["reply"],
      r["reply"])

print()
print("ALL PASS" if not fails else f"FAILURES: {fails}")
sys.exit(1 if fails else 0)
