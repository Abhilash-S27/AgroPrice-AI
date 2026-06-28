"""Phase 2.5 conversational AI verification — every required behaviour."""
import sys
import requests

BASE = "http://localhost:8001/api/ai"

def chat(message, crop="Bhindi (Ladies Finger)", state="Karnataka", history=None):
    r = requests.post(f"{BASE}/chat", json={
        "message": message, "crop": crop, "state": state, "days": 30,
        "history": history or [],
    }, timeout=120)
    r.raise_for_status()
    return r.json()

fails = []

def check(name, cond, reply):
    status = "PASS" if cond else "FAIL"
    if not cond:
        fails.append(name)
    print(f"[{status}] {name}")
    print(f"        {reply[:160]}")

# 1. greeting
r = chat("hi")
check("greeting", "Hello" in r["reply"] and "Snapshot" not in r["reply"], r["reply"])

# 2. profitability (state-aware)
r = chat("what crop should farmers grow for profit in Karnataka?")
check("profitability", r["intent"] == "profitability" and "1." in r["reply"], r["reply"])

# 3. historical month query
r = chat("what was Bhindi price in Jan 2025?")
check("historical month", r["intent"] == "historical" and "Jan 2025" in r["reply"] and "₹" in r["reply"], r["reply"])

# 4. multi-turn temporal follow-up
hist = [
    {"role": "user", "text": "what was Bhindi price in Jan 2025?"},
    {"role": "ai",   "text": r["reply"]},
]
r2 = chat("in 2024", history=hist)
check("follow-up 'in 2024'", r2["intent"] == "historical" and "2024" in r2["reply"] and "₹" in r2["reply"], r2["reply"])

# 5. year comparison
r = chat("Compare Bhindi prices in 2023 vs 2025")
check("year comparison", "2023" in r["reply"] and "2025" in r["reply"], r["reply"])

# 6. when most volatile
r = chat("When was Coffee most volatile?", crop="Coffee", state="Kerala")
check("most volatile when", r["intent"] == "most_volatile_when" and "CV" in r["reply"], r["reply"])

# 7. why stable (conversational, not snapshot)
r = chat("Why is Tapioca stable?", crop="Tapioca", state="Kerala")
check("why stable", "stable" in r["reply"].lower() and "%" in r["reply"] and "Snapshot" not in r["reply"], r["reply"])

# 8. analytics-only awareness (Coffee in Andhra Pradesh)
r = chat("What is the trend?", crop="Coffee", state="Andhra Pradesh")
check("analytics-only chat",
      r["intent"] == "analytics_only" and "insufficient continuity" in r["reply"].lower(),
      r["reply"])

# 9. crop comparison
r = chat("Is Banana safer than Onion?", crop="Banana", state="Kerala")
check("crop comparison", "CV" in r["reply"] and "Onion" in r["reply"], r["reply"])

# 10. state-vs-state comparison
r = chat("Compare Coffee in Karnataka vs Kerala", crop="Coffee", state="Andhra Pradesh")
check("state comparison", "Karnataka" in r["reply"] and "Kerala" in r["reply"], r["reply"])

# 11. inherited crop from history
hist = [{"role": "user", "text": "Tell me about Drumstick"},
        {"role": "ai", "text": "..."}]
r = chat("why is it volatile?", crop="Tomato", state="Karnataka", history=hist)
check("crop memory", "Drumstick" in r["reply"], r["reply"])

# 12. help
r = chat("what can you do?")
check("help", r["intent"] == "help" and "history" in r["reply"].lower(), r["reply"])

# 13. monsoon season query
r = chat("How does Tomato perform in monsoon?", crop="Tomato", state="Karnataka")
check("season query", "monsoon" in r["reply"].lower() or "₹" in r["reply"], r["reply"])

# 14. thanks
r = chat("thanks!")
check("thanks", r["intent"] == "thanks", r["reply"])

print()
print(f"{'ALL PASS' if not fails else 'FAILURES: ' + ', '.join(fails)}")
sys.exit(1 if fails else 0)
