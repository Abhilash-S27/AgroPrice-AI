"""
Phase 1B — live advisor health test.

Sends REAL requests through the running backend (full grounding pipeline +
Gemini invocation), validates response shape, exercises multi-turn memory
and guardrails, and prints the server-side stage trace from /api/advisor/debug.

Run (server must be up on :8001):
    python -m backend.test_live_advisor_request
"""
import sys

import requests

BASE = "http://localhost:8001"


def ask(question, crop=None, state=None, session_id=None):
    r = requests.post(f"{BASE}/api/advisor/ask", json={
        "question": question, "crop": crop, "state": state,
        "session_id": session_id, "include_price_context": True,
    }, timeout=120)
    return r


def main() -> int:
    fails = []

    def check(name, cond, info=""):
        print(f"[{'PASS' if cond else 'FAIL'}] {name}")
        if info:
            print(f"        {str(info)[:180]}")
        if not cond:
            fails.append(name)

    # 0. debug endpoint reachable + Gemini status
    dbg = requests.get(f"{BASE}/api/advisor/debug", timeout=30).json()
    print(f"\n=== /api/advisor/debug ===\n  gemini.ready={dbg['gemini']['ready']}  "
          f"api_key_loaded={dbg['gemini']['api_key_loaded']}  model={dbg['gemini']['model']}\n")
    check("debug endpoint", dbg.get("route") == "ok", dbg["gemini"])
    check("Gemini key loaded", dbg["gemini"]["api_key_loaded"])

    # 1. grounded outlook query (full pipeline + Gemini)
    r = ask("What is the market outlook for Tomato prices in Karnataka over the next month?",
            crop="Tomato", state="Karnataka")
    ok = r.status_code == 200
    d = r.json() if ok else {}
    check("Tomato/Karnataka outlook (HTTP 200)", ok, f"{r.status_code} {r.text[:120]}")
    if ok:
        check("  answer non-empty", len(d.get("answer", "")) > 50, d.get("answer", "")[:150])
        check("  grounded sources", len(d.get("sources", [])) > 0, d.get("sources"))
        check("  model_used", d.get("model_used") == "gemini-2.5-flash", d.get("model_used"))
        session = d.get("session_id")

    # 2. follow-up memory (no crop/state — must inherit from session)
    r2 = ask("And what about over the next three months?", session_id=session)
    d2 = r2.json() if r2.status_code == 200 else {}
    check("follow-up memory (inherits Tomato/Karnataka)",
          r2.status_code == 200 and any("Tomato" in p for p in d2.get("inferred_context", [])),
          d2.get("inferred_context"))

    # 3. safest crop advisory
    r3 = ask("Which crop is the safest for farmers right now?")
    check("safest crop query", r3.status_code == 200 and len(r3.json().get("answer", "")) > 30,
          r3.json().get("answer", "")[:140] if r3.status_code == 200 else r3.text[:120])

    # 4. volatility explanation
    r4 = ask("Why are Tomato prices so volatile?", crop="Tomato", state="Karnataka")
    check("volatility explanation", r4.status_code == 200, r4.json().get("answer", "")[:140])

    # 5. seasonal reasoning
    r5 = ask("How do seasonal patterns affect Onion prices in Kerala?", crop="Onion", state="Kerala")
    check("seasonal reasoning", r5.status_code == 200, r5.json().get("answer", "")[:140])

    # 6. off-domain rejection (guardrail — Gemini must NOT be called)
    r6 = ask("Write me a Python script to scrape websites please and thanks")
    d6 = r6.json() if r6.status_code == 200 else {}
    check("off-domain rejection", r6.status_code == 200 and d6.get("intent") == "rejected",
          f"intent={d6.get('intent')} :: {d6.get('answer', '')[:120]}")

    # full server-side trace of the last request
    trace = requests.get(f"{BASE}/api/advisor/debug", timeout=30).json()["last_request_trace"]
    print("\n=== last request stage trace ===")
    for s in trace.get("stages", []):
        print(f"  {s['t_ms']:>6}ms  {s['stage']:<10} "
              + "  ".join(f"{k}={v}" for k, v in s.items() if k not in ("stage", "t_ms")))
    print(f"  total: {trace.get('total_ms')}ms\n")

    print("ALL PASS" if not fails else f"FAILURES: {fails}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
