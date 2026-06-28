export const SOUTH_INDIAN_STATES = [
  'Tamil Nadu',
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Kerala',
]

// Legacy tier lists — used by CropExplorer/Reports/AIAdvisor grouping and
// as a dropdown fallback while the coverage registry loads. Forecast
// capability is classified per-crop at runtime by the backend (Tier A–D).
export const TIER1_CROPS = [
  'Tomato',
  'Onion',
  'Banana',
  'Brinjal',
  'Green Chilli',
]

export const TIER2_CROPS = [
  'Paddy (Dhan)(Common)',
  'Bhindi (Ladies Finger)',
  'Drumstick',
  'Coconut',
  'Ginger (Green)',
  'Bitter gourd',
  'Carrot',
  'Cabbage',
  'Potato',
  'Cauliflower',
  'Beans',
  'Mango',
  'Papaya',
  'Turmeric',
  'Black pepper',
]

export const TIER3_CROPS = [
  'Arecanut (Betelnut/Supari)',
  'Tapioca',
  'Banana - Green',
  'Cotton',
  'Maize',
  'Cardamoms',
  'Coffee',
]

// Color palette for Recharts bar/line charts
export const CROP_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#64748b',
]

export const AI_ADVISOR_MODELS = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'gemini', label: 'Gemini (Google)' },
]

// ── Phase 1: 27-crop registry (mirrors backend/utils/crop_registry.py) ──────
// Names are EXACT dataset Commodity strings — never invent variants here.

export const CROP_CATEGORIES = {
  core: {
    label: 'Core Crops',
    crops: ['Tomato', 'Onion', 'Potato'],
  },
  vegetable: {
    label: 'Vegetables',
    crops: [
      'Brinjal', 'Green Chilli', 'Bhindi (Ladies Finger)', 'Cabbage',
      'Cauliflower', 'Beans', 'Carrot', 'Bitter gourd', 'Drumstick',
    ],
  },
  fruit: {
    label: 'Fruits',
    crops: ['Banana', 'Banana - Green', 'Mango', 'Papaya', 'Coconut'],
  },
  cash: {
    label: 'Cash & Spice Crops',
    crops: [
      'Turmeric', 'Ginger (Green)', 'Black pepper', 'Cardamoms',
      'Arecanut (Betelnut/Supari)', 'Coffee', 'Cotton',
    ],
  },
  grain: {
    label: 'Staples & Grains',
    crops: ['Paddy (Dhan)(Common)', 'Maize', 'Tapioca'],
  },
}

// All supported crops, registry order
export const PHASE4_ALL_CROPS = Object.values(CROP_CATEGORIES)
  .flatMap(c => c.crops)

// Forecast tier display metadata (Tier A–D)
export const TIER_META = {
  A: { label: 'Full Forecast',     icon: '◈', short: 'Tier A' },
  B: { label: 'Moderate Forecast', icon: '◑', short: 'Tier B' },
  C: { label: 'Sparse Trend',      icon: '◔', short: 'Tier C' },
  D: { label: 'Analytics Only',    icon: '◇', short: 'Tier D' },
}

// Short display names for long crop names in compact UI
export const CROP_SHORT_NAMES = {
  'Paddy (Dhan)(Common)':       'Paddy',
  'Bhindi (Ladies Finger)':     'Bhindi',
  'Ginger (Green)':             'Ginger',
  'Arecanut (Betelnut/Supari)': 'Arecanut',
  'Banana - Green':             'Banana (Green)',
  'Black pepper':               'Black Pepper',
  'Cardamoms':                  'Cardamom',
}

// Emoji map for all supported crops
export const CROP_EMOJIS = {
  'Tomato': '🍅', 'Onion': '🧅', 'Potato': '🥔',
  'Brinjal': '🍆', 'Green Chilli': '🌶️', 'Bhindi (Ladies Finger)': '🫑',
  'Cabbage': '🥬', 'Cauliflower': '🥦', 'Beans': '🫘', 'Carrot': '🥕',
  'Bitter gourd': '🥒', 'Drumstick': '🌿',
  'Banana': '🍌', 'Banana - Green': '🍃', 'Mango': '🥭', 'Papaya': '🧡', 'Coconut': '🥥',
  'Turmeric': '🟡', 'Ginger (Green)': '🫚', 'Black pepper': '⚫', 'Cardamoms': '💚',
  'Arecanut (Betelnut/Supari)': '🌴', 'Coffee': '☕', 'Cotton': '☁️',
  'Paddy (Dhan)(Common)': '🌾', 'Maize': '🌽', 'Tapioca': '🍠',
}

// Helper: get short name or fallback to full name
export const cropShortName = (name) => CROP_SHORT_NAMES[name] ?? name

// Helper: get emoji or fallback to generic
export const cropEmoji = (name) => CROP_EMOJIS[name] ?? '🌿'
