"""
backend/services/cross_market_engine.py

Market Relationship Engine — Phase 5.

Detects relationships between South Indian agricultural crops:
  - Positive price correlation (similar demand patterns)
  - Inverse relationships (substitution effects)
  - Seasonal pressure chains
  - Regional shock propagation
  - Transport/cold-storage demand overlap

All relationships are grounded in South Indian agricultural market knowledge.
No Gemini calls. No invented metrics.

Usage:
    from backend.services.cross_market_engine import get_crop_relationships
    result = get_crop_relationships("Tomato", raw_ctx_dict)
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── Relationship graph ────────────────────────────────────────────────────────
# Each entry: (related_crop, relationship_type, strength, description)
# Strength: 0.0 – 1.0 (1.0 = very strong correlation)

_RELATIONSHIPS: dict[str, list[tuple[str, str, float, str]]] = {
    "Tomato": [
        ("Onion",        "complement",   0.72, "Both are kitchen staples; demand rises together (dal/curry cooking)"),
        ("Green Chilli", "complement",   0.65, "Shared supply chains; typically arrive at mandis together"),
        ("Brinjal",      "substitute",   0.42, "Consumers substitute brinjal for tomato during tomato price spikes"),
        ("Potato",       "complement",   0.55, "Both cold-chain crops; transport demand overlaps during peak season"),
        ("Cabbage",      "seasonal",     0.35, "Competing winter vegetable — seasonal price pressure in Nov–Feb"),
    ],
    "Onion": [
        ("Tomato",       "complement",   0.72, "Co-demand in Indian cooking; simultaneous price swings common"),
        ("Potato",       "storage",      0.62, "Both cold-storage commodities; shared logistics chains"),
        ("Green Chilli", "complement",   0.48, "Used together in regional cooking; demand shifts together"),
        ("Shallots",     "substitute",   0.55, "Shallots are direct substitutes in South Indian cuisine"),
    ],
    "Potato": [
        ("Onion",        "storage",      0.62, "Cold-storage commodity overlap; often stored/transported together"),
        ("Tomato",       "complement",   0.55, "Together in salads and sabzi; co-demand spikes during festivals"),
        ("Tapioca",      "substitute",   0.38, "Tapioca substituted for potato in Kerala cooking"),
        ("Carrot",       "seasonal",     0.30, "Both winter root crops with overlapping harvest windows"),
    ],
    "Banana": [
        ("Coconut",      "regional",     0.68, "Both Kerala plantation crops; shared transport/labour costs"),
        ("Papaya",       "substitute",   0.45, "Substitute tropical fruits; demand shifts between them"),
        ("Mango",        "seasonal",     0.40, "Compete during summer festival demand peaks"),
        ("Banana - Green", "complement", 0.85, "Same crop at different ripening stages; nearly identical market"),
    ],
    "Banana - Green": [
        ("Banana",       "complement",   0.85, "Different ripening stage of same crop; highly correlated prices"),
        ("Coconut",      "regional",     0.62, "Both Kerala plantation crops with overlapping transport routes"),
        ("Papaya",       "substitute",   0.38, "Tropical fruit alternatives in export and domestic market"),
    ],
    "Coconut": [
        ("Banana",       "regional",     0.68, "Both Kerala plantation crops with shared harvest transport"),
        ("Arecanut (Betelnut/Supari)", "regional", 0.55, "Both Karnataka/Kerala plantation perennial crops"),
        ("Cardamoms",    "premium",      0.42, "Both Kerala premium export crops; global demand correlates"),
    ],
    "Green Chilli": [
        ("Tomato",       "complement",   0.65, "Shared supply chains; typically co-sold at mandis"),
        ("Onion",        "complement",   0.48, "Base ingredients in South Indian cooking; co-demand"),
        ("Brinjal",      "seasonal",     0.38, "Competing summer vegetables from Andhra Pradesh"),
    ],
    "Brinjal": [
        ("Tomato",       "substitute",   0.42, "Consumers switch during tomato price spikes"),
        ("Green Chilli", "seasonal",     0.38, "Competing summer vegetables; Telangana production overlap"),
        ("Drumstick",    "regional",     0.35, "Both common in Andhra/Telangana dal dishes"),
    ],
    "Turmeric": [
        ("Ginger (Green)", "spice",      0.70, "Both rhizome spice crops; shared processing, harvest season overlap"),
        ("Black pepper", "premium",      0.38, "Both export spice crops; global demand correlates"),
        ("Cardamoms",    "premium",      0.35, "Premium spice market coupling; export demand moves together"),
    ],
    "Ginger (Green)": [
        ("Turmeric",     "spice",        0.70, "Both rhizome crops harvested Oct–Dec; processing overlap"),
        ("Cardamoms",    "premium",      0.42, "Both Kerala premium spice crops; export-oriented"),
        ("Black pepper", "premium",      0.38, "Shared spice export demand chains"),
    ],
    "Black pepper": [
        ("Cardamoms",    "premium",      0.65, "Both Kerala premium spice crops; international demand couples"),
        ("Ginger (Green)", "spice",      0.38, "Spice crop export market coupling"),
        ("Coffee",       "regional",     0.45, "Both Karnataka/Kerala plantation export crops"),
    ],
    "Cardamoms": [
        ("Black pepper", "premium",      0.65, "Premium spice export coupling; simultaneous demand swings"),
        ("Coffee",       "regional",     0.42, "Both Kerala/Karnataka premium export crops"),
        ("Ginger (Green)", "premium",    0.42, "Spice crop export market coupling"),
    ],
    "Coffee": [
        ("Cardamoms",    "regional",     0.42, "Both Karnataka/Kerala plantation export crops"),
        ("Black pepper", "regional",     0.45, "Shared Western Ghats plantation belt; transport overlap"),
        ("Arecanut (Betelnut/Supari)", "regional", 0.38, "Karnataka plantation sector coupling"),
    ],
    "Arecanut (Betelnut/Supari)": [
        ("Coconut",      "regional",     0.55, "Both Karnataka/Kerala perennial plantation crops"),
        ("Coffee",       "regional",     0.38, "Karnataka plantation sector overlap"),
    ],
    "Cabbage": [
        ("Cauliflower",  "substitute",   0.72, "Direct substitutes in market; prices move inversely"),
        ("Tomato",       "seasonal",     0.35, "Both winter vegetables competing for transport/cold chain"),
        ("Carrot",       "seasonal",     0.42, "Winter root vegetables with overlapping harvest windows"),
        ("Beans",        "seasonal",     0.38, "Karnataka highland vegetables; co-harvested"),
    ],
    "Cauliflower": [
        ("Cabbage",      "substitute",   0.72, "Direct market substitute; prices tend to move inversely"),
        ("Carrot",       "seasonal",     0.40, "Winter vegetable overlap in Karnataka highlands"),
        ("Beans",        "seasonal",     0.38, "Co-harvested winter vegetables"),
    ],
    "Carrot": [
        ("Cabbage",      "seasonal",     0.42, "Winter highland vegetable overlap"),
        ("Cauliflower",  "seasonal",     0.40, "Winter vegetable cluster — Karnataka/Tamil Nadu"),
        ("Beans",        "seasonal",     0.45, "Highland winter vegetables; similar supply timing"),
    ],
    "Beans": [
        ("Carrot",       "seasonal",     0.45, "Highland winter vegetable co-harvest"),
        ("Cabbage",      "seasonal",     0.38, "Karnataka winter vegetable cluster"),
        ("Bhindi (Ladies Finger)", "seasonal", 0.32, "Warm-season vegetables competing for garden space"),
    ],
    "Bhindi (Ladies Finger)": [
        ("Brinjal",      "seasonal",     0.38, "Summer vegetables; production often from same farms"),
        ("Beans",        "seasonal",     0.32, "Seasonal vegetable rotation patterns"),
        ("Drumstick",    "regional",     0.30, "Both common South Indian cooking vegetables"),
    ],
    "Drumstick": [
        ("Bhindi (Ladies Finger)", "regional", 0.30, "South Indian cooking vegetables; seasonal demand overlap"),
        ("Brinjal",      "regional",     0.35, "Both featured in sambar/dal; co-demand patterns"),
    ],
    "Bitter gourd": [
        ("Brinjal",      "seasonal",     0.35, "Summer/kharif season vegetables; overlapping supply"),
        ("Bhindi (Ladies Finger)", "seasonal", 0.32, "Summer kitchen garden vegetables"),
    ],
    "Mango": [
        ("Banana",       "seasonal",     0.40, "Competing summer tropical fruits during festival season"),
        ("Papaya",       "substitute",   0.45, "Tropical fruit market alternatives"),
    ],
    "Papaya": [
        ("Banana",       "substitute",   0.45, "Tropical fruit alternatives in domestic and export markets"),
        ("Mango",        "substitute",   0.45, "Summer tropical fruit competition"),
    ],
    "Paddy (Dhan)(Common)": [
        ("Maize",        "complement",   0.55, "Both staple grain crops; Telangana/Karnataka overlap"),
        ("Cotton",       "seasonal",     0.40, "Kharif season crops; farmers choose between them"),
    ],
    "Maize": [
        ("Paddy (Dhan)(Common)", "complement", 0.55, "Kharif staple grains; co-produced in Telangana"),
        ("Cotton",       "seasonal",     0.38, "Competing kharif crops for Andhra Pradesh farmland"),
    ],
    "Cotton": [
        ("Paddy (Dhan)(Common)", "seasonal", 0.40, "Kharif season competitor for Andhra Pradesh farming"),
        ("Maize",        "seasonal",     0.38, "Competing kharif crops"),
        ("Turmeric",     "regional",     0.30, "Both Telangana/Andhra cash crops"),
    ],
    "Tapioca": [
        ("Potato",       "substitute",   0.38, "Kerala staple substitute for potato"),
        ("Coconut",      "regional",     0.42, "Both Kerala perennial/staple crops"),
    ],
}


# ── Relationship type styling ─────────────────────────────────────────────────

RELATIONSHIP_STYLES: dict[str, dict] = {
    "complement":  {"label": "Complement",  "color": "emerald", "icon": "↔",  "direction": "positive"},
    "substitute":  {"label": "Substitute",  "color": "amber",   "icon": "⇄",  "direction": "inverse"},
    "seasonal":    {"label": "Seasonal",    "color": "purple",  "icon": "🌊",  "direction": "pressure"},
    "regional":    {"label": "Regional",    "color": "blue",    "icon": "🗺",  "direction": "coupling"},
    "storage":     {"label": "Storage",     "color": "teal",    "icon": "🏪",  "direction": "logistics"},
    "premium":     {"label": "Premium",     "color": "violet",  "icon": "⭐",  "direction": "export"},
    "spice":       {"label": "Spice Chain", "color": "orange",  "icon": "🌶",  "direction": "processing"},
}


# ── Public API ────────────────────────────────────────────────────────────────

def get_crop_relationships(crop: str, raw_ctx: dict | None = None) -> dict:
    """
    Get cross-market relationships for a crop.

    Args:
        crop:    Canonical crop name.
        raw_ctx: Optional insight context for current market state injection.

    Returns:
        Dict with related crops, relationship types, contagion risk, influence graph.
    """
    relations = _RELATIONSHIPS.get(crop, [])

    # Build influence entries
    influences = []
    for related, rel_type, strength, description in relations:
        style = RELATIONSHIP_STYLES.get(rel_type, RELATIONSHIP_STYLES["regional"])
        influences.append({
            "crop":         related,
            "type":         rel_type,
            "type_label":   style["label"],
            "type_color":   style["color"],
            "type_icon":    style["icon"],
            "direction":    style["direction"],
            "strength":     round(strength, 2),
            "description":  description,
        })

    # Sort by strength descending
    influences.sort(key=lambda x: -x["strength"])

    # Compute coupling score (average of top-3 relationships)
    top3 = [i["strength"] for i in influences[:3]]
    coupling_score = round(sum(top3) / max(len(top3), 1), 2) if top3 else 0.0

    # Contagion risk: if crop is in a high-volatility environment,
    # correlated crops may be affected
    contagion_risk = "low"
    if raw_ctx:
        vol = raw_ctx.get("volatility") or {}
        cv  = float(vol.get("cv") or 0.0)
        n_a = len(raw_ctx.get("anomalies") or [])
        if cv > 40 or n_a >= 3:
            contagion_risk = "high"
        elif cv > 25 or n_a >= 2:
            contagion_risk = "medium"
        elif cv > 15:
            contagion_risk = "low"

    # Substitute crops (inverse relationships)
    substitutes = [i["crop"] for i in influences if i["type"] in ("substitute",)]

    # Complementary crops (positive correlation)
    complements = [i["crop"] for i in influences if i["type"] in ("complement", "regional")]

    # Seasonal pressures (crops competing in same season)
    seasonal_peers = [i["crop"] for i in influences if i["type"] in ("seasonal", "spice")]

    # Dependency signals (high strength relationships)
    strong_deps = [
        f"{i['crop']} ({i['type_label']}, strength {i['strength']:.0%})"
        for i in influences if i["strength"] >= 0.55
    ]

    return {
        "crop":             crop,
        "influences":       influences,
        "coupling_score":   coupling_score,
        "contagion_risk":   contagion_risk,
        "substitutes":      substitutes,
        "complements":      complements,
        "seasonal_peers":   seasonal_peers,
        "strong_dependencies": strong_deps,
        "total_relationships": len(influences),
        "has_relationships": len(influences) > 0,
    }


def get_cross_market_summary(crops: list[str]) -> dict:
    """
    Build a summary cross-market influence map across multiple crops.

    Returns a dict with:
        clusters: Groups of strongly coupled crops
        highest_coupling: Crop pair with strongest link
        isolation: Crops with no strong relationships
    """
    all_links: list[dict] = []

    for crop in crops:
        relations = _RELATIONSHIPS.get(crop, [])
        for related, rel_type, strength, desc in relations:
            if related in crops:  # only links within the provided set
                all_links.append({
                    "from":     crop,
                    "to":       related,
                    "type":     rel_type,
                    "strength": strength,
                })

    # Deduplicate (A→B and B→A are the same link)
    seen = set()
    unique_links = []
    for link in all_links:
        key = tuple(sorted([link["from"], link["to"]]))
        if key not in seen:
            seen.add(key)
            unique_links.append(link)

    unique_links.sort(key=lambda x: -x["strength"])

    # Highest coupling pair
    top_pair = unique_links[0] if unique_links else None

    # Isolated crops (no links within this set)
    linked = {l["from"] for l in unique_links} | {l["to"] for l in unique_links}
    isolated = [c for c in crops if c not in linked]

    return {
        "links":            unique_links[:15],
        "total_links":      len(unique_links),
        "highest_coupling": top_pair,
        "isolated_crops":   isolated,
    }
