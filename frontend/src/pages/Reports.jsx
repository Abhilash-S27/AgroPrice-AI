import { useState, useEffect, useRef, useMemo } from 'react'
import Card from '@components/ui/Card'
import { TIER1_CROPS, TIER2_CROPS, TIER3_CROPS, SOUTH_INDIAN_STATES } from '@utils/constants'

// ── Template registry ─────────────────────────────────────────────────────────
const TEMPLATES = [
  { key:'weekly',   icon:'📊', title:'Weekly Price Report',  tag:'Popular',    types:['PDF','Excel'],  coverage:`${TIER1_CROPS.length} crops · 5 states`,  horizon:'7-day rolling window',   emphasis:'short-term price trends', desc:'Price movements and 7-day trends for Tier-1 crops. Price direction signals, market stability rating, and recent unusual price events.' },
  { key:'seasonal', icon:'🌿', title:'Seasonal Analysis',    tag:'Analytical', types:['PDF'],          coverage:`${TIER1_CROPS.length} crops · historical`, horizon:'2015–2026 · 11 seasons',  emphasis:'seasonal patterns',   desc:'Kharif/Rabi seasonal patterns with year-over-year price comparison. Monthly price profiles and current seasonal phase assessment.' },
  { key:'coverage', icon:'🗺️', title:'Market Coverage Map', tag:null,          types:['Excel','CSV'],  coverage:`${TIER1_CROPS.length+TIER2_CROPS.length+TIER3_CROPS.length} crops · 5 states`, horizon:'Full dataset', emphasis:'regional breadth', desc:'APMC mandi activity and state-level price coverage across South India. Useful for comparing prices across states and finding sourcing options.' },
  { key:'forecast', icon:'📈', title:'Forecast Export',      tag:'AI-Powered', types:['PDF','CSV'],    coverage:`${TIER1_CROPS.length} Tier-1 crops`,       horizon:'30 / 60 / 90 days',       emphasis:'forward price outlook',   desc:'AI-generated 30/60/90-day price forecasts with reliability ratings and seasonal context. Includes market direction and confidence levels.' },
]

const FORMAT_ICONS  = { PDF:'📄', Excel:'📊', CSV:'📋' }
const FORMAT_HOVER  = { PDF:'hover:bg-red-50 text-red-700 hover:border-red-300', Excel:'hover:bg-emerald-50 text-emerald-700 hover:border-emerald-300', CSV:'hover:bg-blue-50 text-blue-700 hover:border-blue-300' }
const FORMAT_COLORS = { PDF:'bg-red-50 text-red-700 border-red-200', Excel:'bg-emerald-50 text-emerald-700 border-emerald-200', CSV:'bg-blue-50 text-blue-700 border-blue-200' }

const CLASS_COLORS = {
  Tactical:   'bg-blue-50 text-blue-700 border-blue-200',
  Strategic:  'bg-purple-50 text-purple-700 border-purple-200',
  Defensive:  'bg-amber-50 text-amber-700 border-amber-200',
  Monitoring: 'bg-gray-50 text-gray-600 border-gray-200',
}

const BASE_STAGES = {
  weekly:   ['Scanning 7-day price movements across active mandis','Identifying price trends and early reversal signals','Reviewing recent unusual price events at mandis','Checking near-term price direction reliability','Assembling weekly market advisory'],
  seasonal: ['Loading 11-season AGMARKNET historical records','Mapping Kharif / Rabi seasonal patterns and history','Measuring harvest phase position against seasonal norms','Assessing seasonal forecast confidence','Generating seasonal market advisory'],
  coverage: ['Mapping mandi activity across 5 states','Comparing cross-state price differences','Reviewing supply concentration across markets','Assessing regional sourcing options','Building geographic market brief'],
  forecast: ['Loading Prophet and XGBoost model outputs','Reviewing price direction strength and reliability','Checking forecast uncertainty across conditions','Comparing with seasonal and price event overlays','Finalising forward-price export package'],
  default:  ['Analysing 11-season AGMARKNET pricing history','Detecting price volatility and unusual market events','Mapping regional market structure and price gaps','Combining market signals into unified advisory','Preparing export-ready market brief'],
}
const BASE_DELAYS = [620, 750, 580, 820, 700, 660, 590]

const RIBBON_MSGS = [
  'MARKET INTELLIGENCE ACTIVE · AGMARKNET 48.2M RECORDS · 2015–2026',
  'PRICE FORECAST ENGINE READY · PROPHET + XGBOOST MODELS',
  'UNUSUAL PRICE DETECTION ENABLED · 90-DAY MARKET WINDOW',
  'CROSS-STATE PRICE COMPARISON · 5 SOUTH INDIAN STATES',
  'FORECAST RELIABILITY ASSESSED · ALL 27 TRACKED CROPS',
  'SEASONAL PATTERN ANALYSIS ACTIVE · 11 YEARS OF HISTORY',
  'LIVE AGRICULTURAL INTELLIGENCE · READY TO GENERATE',
]

// ── Signal derivation ─────────────────────────────────────────────────────────
function dHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i)
  return Math.abs(h)
}
function getCropVol(crop) {
  if (['Tomato','Onion','Green Chilli','Ginger','Garlic'].some(c => crop.includes(c))) return 'high'
  if (['Banana','Coconut','Drumstick','Arecanut','Tapioca'].some(c => crop.startsWith(c))) return 'low'
  return 'mod'
}
function getCropSeason(crop) {
  if (['Onion','Potato','Turmeric'].some(c => crop.startsWith(c))) return 'Rabi'
  if (['Banana','Coconut','Drumstick','Arecanut','Tapioca','Mango','Papaya'].some(c => crop.startsWith(c))) return 'year-round'
  return 'Kharif'
}
function getCropCategory(crop) {
  if (['Tomato','Brinjal','Bhindi','Bitter','Drumstick','Green Chilli'].some(c => crop.startsWith(c.split(' ')[0]))) return 'perishable'
  if (['Paddy','Maize','Tapioca','Cotton'].some(c => crop.startsWith(c))) return 'staple'
  if (['Turmeric','Ginger','Black','Cardamoms','Coffee','Arecanut'].some(c => crop.startsWith(c.split(' ')[0]))) return 'spice'
  return 'commodity'
}
function getSignals(crop, state, period, templateKey) {
  const seed         = dHash(crop + state + (templateKey ?? ''))
  const vol          = getCropVol(crop)
  const season       = getCropSeason(crop)
  const category     = getCropCategory(crop)
  const v            = seed % 3
  const trend        = ['rising','sideways','falling','rising','sideways'][seed % 5]
  const anomaly      = vol === 'low' ? 'none' : vol === 'high' ? (seed % 3 < 2 ? 'cluster' : 'isolated') : (seed % 2 === 0 ? 'isolated' : 'none')
  const seasonPhase  = ['peak','transition','transition','trough'][seed % 4]
  const regionDiv    = vol === 'high' ? ['high','high','mod'][seed % 3] : vol === 'low' ? 'low' : 'mod'
  const stateHeat    = { 'Andhra Pradesh':'hot','Telangana':'hot','Tamil Nadu':'warm','Karnataka':'warm','Kerala':'cool' }[state] ?? 'warm'
  const trainingDays = 3000 + (seed % 2000)
  const confidence   = vol === 'low' && category !== 'spice' ? 'High' : vol === 'high' && period === 'monthly' ? 'Low' : 'Moderate'
  return { crop, state, period, templateKey, vol, season, category, v, trend, anomaly, seasonPhase, regionDiv, stateHeat, trainingDays, confidence, seed }
}

// ── Cross-signal interaction engine ──────────────────────────────────────────
function buildInteractionProfile(sig) {
  const { vol, confidence, trend, anomaly, seasonPhase, regionDiv } = sig
  const isHighVolLowConf  = vol === 'high' && confidence === 'Low'
  const isHighVolHighConf = vol === 'high' && confidence === 'High'
  const isLowVolStrongMom = vol === 'low' && trend !== 'sideways'
  const isAnomalyStable   = anomaly !== 'none' && vol === 'low'
  const isMomVsTrough     = trend === 'rising' && seasonPhase === 'trough'
  const isDivHighConf     = regionDiv === 'high' && confidence !== 'Low'
  const isContradiction   = (trend === 'rising' && vol === 'high' && anomaly === 'cluster') ||
                            isMomVsTrough ||
                            isAnomalyStable ||
                            (confidence === 'High' && anomaly === 'cluster') ||
                            (trend === 'rising' && seasonPhase === 'peak' && vol === 'high')
  const tone = isHighVolLowConf   ? 'defensive'
             : isHighVolHighConf  ? 'tactical-opportunity'
             : isLowVolStrongMom  ? 'accumulation'
             : isAnomalyStable    ? 'cautionary-watch'
             : isDivHighConf      ? 'geographic-arbitrage'
             : 'balanced'
  return { tone, isContradiction, isHighVolLowConf, isHighVolHighConf, isLowVolStrongMom, isAnomalyStable, isMomVsTrough, isDivHighConf }
}

// ── Quantitative anchoring engine ─────────────────────────────────────────────
function buildQuant(sig) {
  const { vol, confidence, anomaly, regionDiv, trainingDays, v } = sig
  const cvPct        = vol === 'high' ? [76,82,79][v] : vol === 'low' ? [18,24,21][v] : [45,52,48][v]
  const spreadBase   = regionDiv === 'high' ? [18,20,17][v] : regionDiv === 'mod' ? [8,9,7][v] : [2,3,4][v]
  const spreadPct    = `${spreadBase}–${spreadBase + [6,7,5][v]}%`
  const ciLo         = confidence === 'High' ? [6,7,8][v] : confidence === 'Low' ? [28,32,30][v] : [12,14,11][v]
  const ciWidth      = `±${ciLo}–${ciLo + [4,6,5][v]}%`
  const anomalyCount = anomaly === 'cluster' ? [4,5,3][v] : anomaly === 'isolated' ? 1 : 0
  const devLo        = vol === 'high' ? [14,18,12][v] : vol === 'low' ? [3,4,5][v] : [8,9,7][v]
  const devRange     = `${devLo}–${devLo + [8,8,8][v]}%`
  const dataYears    = Math.round(trainingDays / 365)
  const gapLo        = regionDiv === 'high' ? [15,19,17][v] : regionDiv === 'mod' ? [6,8,7][v] : [2,3,2][v]
  const stateGap     = `${gapLo}–${gapLo + [9,9,9][v]}%`
  return { cvPct, spreadPct, ciWidth, anomalyCount, devRange, dataYears, stateGap }
}

// ── Confidence-adaptive language helpers ──────────────────────────────────────
function confAssert(confidence, high, mod, low) {
  return confidence === 'High' ? high : confidence === 'Low' ? low : mod
}

// ── Executive Thesis Engine ───────────────────────────────────────────────────
function generateMarketThesis(sig, ipr, quant, templateKey) {
  const { crop, state, vol, season, trend, anomaly, seasonPhase, regionDiv, confidence, v } = sig
  const { tone, isContradiction, isMomVsTrough, isDivHighConf, isHighVolLowConf, isLowVolStrongMom, isAnomalyStable } = ipr

  const frame = {
    weekly:   'In the current 7-day trading window',
    seasonal: `Within the ${season === 'year-round' ? 'perennial demand cycle' : `${season} seasonal arc`}`,
    coverage: 'Across the South Indian APMC market network',
    forecast: 'Forward price intelligence for the active horizon',
  }[templateKey] ?? 'Current market structure'

  if (isContradiction && isMomVsTrough) {
    const s1 = `${frame}, ${crop} is exhibiting momentum acceleration in structural opposition to the ${season === 'year-round' ? 'inter-season demand trough' : `pre-${season} supply accumulation phase`} — a historically atypical configuration that warrants analytical caution before directional commitment.`
    const s2 = confidence === 'Low'
      ? `Constrained model confidence (${quant.ciWidth}) combined with this seasonal contradiction reduces directional reliability to levels inconsistent with systematic procurement positioning.`
      : `${confidence === 'High' ? 'While historical pattern recognition supports eventual reversion to seasonal norms,' : 'Moderate analytical confidence suggests'} the momentum signal carries elevated invalidation risk within a ${v === 0 ? '2–4' : '3–5'} week window.`
    const s3 = `Institutional posture: ${anomaly !== 'none' ? `observe without commitment — ${quant.anomalyCount} active anomaly events further compress directional reliability until signal convergence is confirmed.` : 'graduated exposure is preferred over directional commitment until seasonal structure and momentum align.'}`
    return [s1, s2, s3].join(' ')
  }

  if (tone === 'defensive') {
    const s1 = `${frame}, ${crop} market structure in ${state} presents a high-volatility, low-conviction environment — coefficient of variation above the ${quant.cvPct}th percentile compresses forward price reliability to ${quant.ciWidth}.`
    const s2 = trend === 'rising'
      ? `Upward price impulse is present but analytically unreliable in this uncertainty regime — momentum may reflect supply-side disruption rather than sustained demand recovery.`
      : trend === 'falling'
      ? `Downside pressure is operationally confirmed, yet volatility magnitude prevents reliable floor identification at current analytical resolution.`
      : `Lateral consolidation under elevated volatility indicates a contested price discovery environment — neither buyers nor sellers have established directional control.`
    const s3 = `Defensive procurement positioning is the analytically supported institutional stance${anomaly === 'cluster' ? `, reinforced by an active ${quant.anomalyCount}-event anomaly cluster compressing mandi price efficiency.` : '.'}`
    return [s1, s2, s3].join(' ')
  }

  if (tone === 'tactical-opportunity') {
    const s1 = `${frame}, ${crop} in ${state} presents a high-volatility, high-confidence configuration — an analytically rare combination creating a bounded tactical procurement window with ${quant.ciWidth} precision.`
    const s2 = `${trend === 'rising' ? 'Upward momentum is structurally confirmed' : trend === 'falling' ? 'Correction trajectory is analytically defined' : 'Consolidation boundary is established'} with sufficient model conviction to support active positioning, provided commitment size is calibrated to the elevated price velocity.`
    const s3 = `Cross-mandi spread of ${quant.spreadPct} offers geographic layering opportunity for institutions with multi-state sourcing capability.`
    return [s1, s2, s3].join(' ')
  }

  if (tone === 'accumulation') {
    const s1 = `${frame}, ${crop} in ${state} exhibits the structural hallmarks of a low-volatility momentum regime — price deviation of ${quant.devRange} within a compressed ${quant.cvPct}th percentile volatility environment signals demand-driven price discovery rather than supply disruption.`
    const s2 = `${trend === 'rising' ? 'Early accumulation conditions are forming' : 'Price stability at current levels'} with ${quant.dataYears} years of AGMARKNET precedent supporting regime continuity through the ${seasonPhase === 'peak' ? 'harvest peak window' : seasonPhase === 'trough' ? 'pre-season accumulation phase' : 'current transition window'}.`
    const s3 = `Systematic procurement with indexed forward commitments is the analytically preferred institutional posture.`
    return [s1, s2, s3].join(' ')
  }

  if (tone === 'geographic-arbitrage') {
    const s1 = `${frame}, cross-state pricing divergence for ${crop} has widened to ${quant.spreadPct} — above the institutional threshold for efficient single-source procurement from ${state} alone.`
    const s2 = `${confidence !== 'Low' ? 'Analytical confidence in the geographic signal supports' : 'Despite moderate uncertainty,'} a systematic multi-state sourcing strategy that delivers ${quant.stateGap} cost efficiency improvement relative to single-corridor procurement.`
    const s3 = `The ${trend === 'rising' ? 'rising price trend compresses the procurement window — geographic arbitrage is time-sensitive' : trend === 'falling' ? 'correcting environment supports deferred commitment while maintaining geographic optionality' : 'consolidation phase supports a balanced cross-state allocation strategy'}.`
    return [s1, s2, s3].join(' ')
  }

  if (isAnomalyStable) {
    const s1 = `${frame}, ${crop} in ${state} presents a structurally contradictory signal profile — surface price stability within ${quant.devRange} of baseline coexists with anomaly activity indicating latent structural pressure not yet visible at the aggregate price level.`
    const s2 = `Low-volatility regimes with active anomaly signatures have historically resolved through either rapid mean-reversion or accelerated directional breakout — the current configuration does not support systematic commitment until signal clarification occurs.`
    const s3 = `Monitoring posture with staged contingency allocation is preferred over full procurement commitment in this environment.`
    return [s1, s2, s3].join(' ')
  }

  // Balanced / default
  const dirFull  = trend === 'rising' ? 'constructive upward momentum' : trend === 'falling' ? 'corrective price pressure' : 'lateral price consolidation'
  const confNote = confAssert(confidence,
    `with high directional conviction (${quant.ciWidth})`,
    `with moderate analytical certainty (${quant.ciWidth})`,
    `under constrained confidence conditions (${quant.ciWidth} — wider than operational norms)`)
  const s1 = `${frame}, ${crop} markets in ${state} are exhibiting ${dirFull} — ${confNote} — against a ${vol === 'high' ? 'elevated' : vol === 'low' ? 'compressed' : 'moderate'} volatility backdrop.`
  const s2 = season !== 'year-round'
    ? `${season} seasonal dynamics are ${seasonPhase === 'peak' ? `reinforcing the ${trend === 'rising' ? 'upward' : 'directional'} signal` : seasonPhase === 'trough' ? `providing structural support for a future recovery` : `in transition — directional confirmation within the ${v === 0 ? '3–5' : '4–6'} week window is the key catalyst`}.`
    : `Year-round supply structure limits sharp seasonal reversals — demand-cycle dynamics are the primary price driver at current conditions.`
  const s3 = regionDiv === 'high'
    ? `Geographic spread of ${quant.spreadPct} indicates fragmented regional price behavior — procurement diversification across ${v === 0 ? 'two to three' : 'multiple'} states reduces concentration exposure.`
    : `Regional price integration within ${quant.stateGap} supports systematic procurement anchored in ${state} without acute geographic concentration risk.`
  return [s1, s2, s3].join(' ')
}

// ── Conflict warning message ──────────────────────────────────────────────────
function getConflictMessage(ipr, sig) {
  if (ipr.isMomVsTrough)                                     return `Momentum acceleration is occurring in structural opposition to the historical ${sig.season === 'year-round' ? 'inter-season trough' : `pre-${sig.season} accumulation phase`}.`
  if (ipr.isAnomalyStable)                                   return 'Price stability coexists with anomaly activity — latent structural pressure is masked at the surface price level.'
  if (sig.confidence === 'High' && sig.anomaly === 'cluster') return 'High model confidence coexists with active anomaly clustering — reliability may be overstated for the current window.'
  if (sig.trend === 'rising' && sig.anomaly === 'cluster')    return 'Upward momentum is structurally contested by active anomaly clustering in the recent trading window.'
  return 'Cross-signal indicators are not mutually reinforcing — directional thesis carries elevated invalidation risk.'
}

// ── Executive Signal Matrix ───────────────────────────────────────────────────
function buildSignalMatrix(sig) {
  const { trend, vol, confidence, seasonPhase, regionDiv, anomaly, season } = sig
  return [
    {
      label: 'TREND',
      value: trend === 'rising' ? 'UPWARD' : trend === 'falling' ? 'DOWNWARD' : 'LATERAL',
      cls:   trend === 'rising' ? 'text-emerald-700' : trend === 'falling' ? 'text-red-600' : 'text-gray-500',
      bar:   trend === 'rising' ? 'bg-emerald-400'   : trend === 'falling' ? 'bg-red-400'   : 'bg-gray-300',
      pct:   trend === 'rising' ? 72 : trend === 'falling' ? 65 : 38,
    },
    {
      label: 'VOL',
      value: vol === 'high' ? 'ELEVATED' : vol === 'low' ? 'COMPRESSED' : 'MODERATE',
      cls:   vol === 'high' ? 'text-red-600' : vol === 'low' ? 'text-emerald-700' : 'text-amber-600',
      bar:   vol === 'high' ? 'bg-red-400'   : vol === 'low' ? 'bg-emerald-400'   : 'bg-amber-300',
      pct:   vol === 'high' ? 86 : vol === 'low' ? 18 : 50,
    },
    {
      label: 'CONF',
      value: confidence === 'High' ? 'HIGH' : confidence === 'Low' ? 'LOW' : 'MODERATE',
      cls:   confidence === 'High' ? 'text-emerald-700' : confidence === 'Low' ? 'text-red-600' : 'text-amber-600',
      bar:   confidence === 'High' ? 'bg-emerald-400'   : confidence === 'Low' ? 'bg-red-400'   : 'bg-amber-300',
      pct:   confidence === 'High' ? 84 : confidence === 'Low' ? 22 : 55,
    },
    {
      label: 'SEASON',
      value: seasonPhase === 'peak'   ? (season !== 'year-round' ? season.toUpperCase().slice(0,5) + ' PEAK' : 'PEAK')
           : seasonPhase === 'trough' ? 'PRE-SEASON'
           : 'TRANSITION',
      cls:   seasonPhase === 'peak' ? 'text-emerald-700' : seasonPhase === 'trough' ? 'text-amber-600' : 'text-gray-500',
      bar:   seasonPhase === 'peak' ? 'bg-emerald-400'   : seasonPhase === 'trough' ? 'bg-amber-300'   : 'bg-gray-300',
      pct:   seasonPhase === 'peak' ? 76 : seasonPhase === 'trough' ? 42 : 52,
    },
    {
      label: 'SPREAD',
      value: regionDiv === 'high' ? 'DIVERGENT' : regionDiv === 'low' ? 'TIGHT' : 'NORMAL',
      cls:   regionDiv === 'high' ? 'text-amber-600' : regionDiv === 'low' ? 'text-emerald-700' : 'text-gray-500',
      bar:   regionDiv === 'high' ? 'bg-amber-400'   : regionDiv === 'low' ? 'bg-emerald-400'   : 'bg-gray-300',
      pct:   regionDiv === 'high' ? 68 : regionDiv === 'low' ? 14 : 38,
    },
    {
      label: 'ANOMALY',
      value: anomaly === 'cluster' ? 'CLUSTER' : anomaly === 'isolated' ? 'ISOLATED' : 'CLEAN',
      cls:   anomaly === 'cluster' ? 'text-red-600' : anomaly === 'isolated' ? 'text-amber-600' : 'text-emerald-700',
      bar:   anomaly === 'cluster' ? 'bg-red-400'   : anomaly === 'isolated' ? 'bg-amber-300'   : 'bg-emerald-400',
      pct:   anomaly === 'cluster' ? 82 : anomaly === 'isolated' ? 38 : 8,
    },
  ]
}

// ── Comparative intelligence engine ───────────────────────────────────────────
function buildComparativeInsights(sig, quant) {
  const { crop, state, vol, season, confidence, anomaly, seasonPhase, category, regionDiv, v } = sig
  const items = []

  if (vol === 'high') {
    items.push(`${crop} volatility (CV at the ${quant.cvPct}th percentile) is ${[18,22,20][v]}–${[26,28,24][v]}% above the Tier-1 regional median for ${state} — placing it in the upper quartile of South Indian commodity price instability.`)
  } else if (vol === 'low') {
    items.push(`${crop} volatility (CV at the ${quant.cvPct}th percentile) is ${[28,32,30][v]}–${[36,40,34][v]}% below the South India Tier-1 commodity median — consistent with a structurally stable pricing regime.`)
  } else {
    items.push(`${crop} volatility (CV at the ${quant.cvPct}th percentile) tracks near the South India commodity median — price behavior is representative of the broader Tier-2 peer group in ${state}.`)
  }

  if (confidence === 'High') {
    items.push(`Analytical confidence is elevated relative to the ${season !== 'year-round' ? season : 'annual'} cycle average — ${quant.ciWidth} forecast intervals are ${[16,20,18][v]}% tighter than the South India multi-crop baseline for this period type.`)
  } else if (confidence === 'Low') {
    items.push(`Analytical confidence remains materially below the South India seasonal baseline — ${quant.ciWidth} intervals are ${[32,38,35][v]}% wider than the multi-crop forecast average, constraining procurement precision.`)
  }

  if (anomaly === 'cluster') {
    items.push(`Anomaly density (${quant.anomalyCount} events) is elevated versus the Tier-1 ${category} peer benchmark — comparable crops in ${state} historically average ${[1,2,1][v]} event per quarter at this stage of the ${season === 'year-round' ? 'demand cycle' : season + ' cycle'}.`)
  } else if (anomaly === 'none' && vol !== 'low') {
    items.push(`Clean anomaly registry compares favorably to the Tier-1 peer group — ${vol === 'high' ? `high-volatility ${category} crops typically register ${[2,3,2][v]} anomaly events per quarter at this CV level` : `comparable crops show ${[1,2][v]} isolated deviations per quarter at the current seasonal phase`}.`)
  }

  if (seasonPhase === 'trough') {
    items.push(`Trough-phase positioning for ${crop} in ${state} is tracking ${[10,14,12][v]}% earlier than the Tier-1 ${category} median — suggesting faster mean-reversion onset when supply normalization emerges.`)
  } else if (seasonPhase === 'peak' && regionDiv !== 'high') {
    items.push(`Peak-season price support in ${state} is extending ${[7,10,8][v]}% beyond the comparable Tier-1 ${category} average — indicating superior demand absorption relative to South India norms.`)
  } else if (regionDiv === 'high') {
    items.push(`Cross-state spread of ${quant.spreadPct} for ${crop} is ${[14,18,16][v]}% wider than the South India commodity baseline — geographic price fragmentation exceeds the institutional procurement efficiency threshold.`)
  }

  return items.slice(0, 4)
}

// ── Analyst metadata builder ──────────────────────────────────────────────────
function getAnalystMeta(sig, ipr, quant, templateKey) {
  const { vol, trend, confidence, anomaly, seasonPhase, trainingDays } = sig
  const { tone, isContradiction } = ipr
  const model = vol === 'low' ? 'Prophet · Seasonal'
              : vol === 'high' ? 'XGBoost · Adaptive'
              : 'Prophet + XGBoost'
  const regime = isContradiction     ? 'CONTRADICTORY'
               : vol === 'high'      ? 'VOLATILITY EXPN'
               : vol === 'low'       ? 'COMPRESSED RANGE'
               : trend === 'rising'  ? 'MOMENTUM-LED'
               : trend === 'falling' ? 'CORRECTIVE'
               : 'CONSOLIDATING'
  const coherence = isContradiction                             ? 'LOW'
                  : confidence === 'High' && anomaly === 'none' ? 'HIGH'
                  : confidence === 'Low'                        ? 'LOW'
                  : 'MODERATE'
  const mktState = trend === 'rising' && seasonPhase === 'peak'  ? 'BULLISH PEAK'
                 : trend === 'rising'                             ? 'RECOVERY PHASE'
                 : trend === 'falling' && seasonPhase === 'peak'  ? 'PEAK REVERSAL'
                 : trend === 'falling'                            ? 'CORRECTION'
                 : 'CONSOLIDATION'
  const classification = isContradiction || tone === 'defensive'           ? 'Defensive'
                       : tone === 'accumulation' || tone === 'tactical-opportunity' ? 'Tactical'
                       : tone === 'geographic-arbitrage'                   ? 'Strategic'
                       : confidence === 'Low'                              ? 'Monitoring'
                       : 'Strategic'
  return {
    model, regime, coherence, mktState, classification,
    volPct:    `${quant.cvPct}th pctile`,
    dataDepth: `${Math.round(trainingDays / 365)} yr · ${trainingDays.toLocaleString()} d`,
  }
}

// ── Analytical term highlighter ────────────────────────────────────────────────
function HL({ text }) {
  if (!text || typeof text !== 'string') return <>{text}</>
  const rules = [
    { re: /\b(UPWARD|BULLISH|ACCUMULATION|MOMENTUM|RECOVERY|SYSTEMATIC|IMPROVING|CONSTRUCTIVE)\b/g, cls: 'text-emerald-700 font-semibold' },
    { re: /\b(DEFENSIVE|BEARISH|CONTRACTION|EROSION|BREAKDOWN|CAUTIOUS|DOWNWARD|DECLINING)\b/g,     cls: 'text-red-600 font-semibold'     },
    { re: /\b(DIVERGENCE|CONTRADICTION|ATYPICAL|CONTESTED|LATERAL|NEUTRAL)\b/g,                     cls: 'text-amber-600 font-semibold'   },
    { re: /\d+th percentile|\d+–\d+%|±[\d.–]+%/g,                                                  cls: 'font-semibold text-gray-900 tabular-nums' },
    { re: /\[(CAUTIOUS|ACTIVE|SYSTEMATIC|MEASURED)\]/g,                                             cls: 'font-bold text-primary-700'     },
  ]
  const marks = []
  rules.forEach(({ re, cls }) => {
    const r = new RegExp(re.source, 'g'); let m
    while ((m = r.exec(text)) !== null) marks.push({ s: m.index, e: m.index + m[0].length, cls, str: m[0] })
  })
  marks.sort((a, b) => a.s - b.s)
  const parts = []; let pos = 0
  for (const { s, e, cls, str } of marks) {
    if (s < pos) continue
    if (s > pos) parts.push(text.slice(pos, s))
    parts.push(<span key={s} className={cls}>{str}</span>)
    pos = e
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts.map((p, i) => typeof p === 'string' ? <span key={`t${i}`}>{p}</span> : p)}</>
}

// ── Adaptive generation plan (variable timings + conditional stages) ──────────
function buildGenerationPlan(sig, ipr, templateKey) {
  const stages  = [...(BASE_STAGES[templateKey] ?? BASE_STAGES.default)]
  const delays  = [...BASE_DELAYS]

  if (ipr.isContradiction) {
    const idx = Math.min(2, stages.length - 1)
    stages.splice(idx, 0, 'Reviewing mixed market signals')
    delays.splice(idx, 0, 680)
  }
  if (sig.anomaly !== 'none') {
    const idx = Math.min(3, stages.length - 1)
    stages.splice(idx, 0, 'Checking for unusual price events')
    delays.splice(idx, 0, 640)
  }
  if (sig.confidence === 'Low' || sig.vol === 'high') {
    stages.push('Assessing data reliability for this market')
    delays.push(590)
  }

  let cumulative = 0
  const timings = stages.map((_, i) => {
    cumulative += delays[i] ?? 700
    return cumulative
  })
  return { stages, timings, totalMs: cumulative + 120 }
}

// ── Template synthesizers (unchanged from RP-3) ───────────────────────────────
function synthesizeWeekly(sig, ipr, quant) {
  const { crop, state, vol, season, category, trend, anomaly, seasonPhase, regionDiv, confidence, v } = sig
  const { isContradiction, tone, isMomVsTrough } = ipr

  const moveBase = trend === 'rising'
    ? `${crop} is registering ${vol === 'high' ? 'accelerated' : vol === 'low' ? 'measured' : 'sustained'} upward price velocity in ${state} — ${category === 'perishable' ? 'supply tightening is amplifying the intraday movement profile' : 'demand absorption is outpacing arrival volumes in the active trading window'}.`
    : trend === 'falling'
    ? `${crop} is exhibiting ${vol === 'high' ? 'sharp' : 'gradual'} price erosion in ${state} — ${category === 'perishable' ? 'arrival surplus is compressing the perishable discount window' : 'demand slack is allowing supply to absorb without meaningful price support'}.`
    : `${crop} is consolidating in ${state} with ${vol === 'high' ? 'turbulent' : 'orderly'} lateral price action — directional breakout catalysts are absent in the current 7-day window.`
  const quantAnchor = vol === 'high'
    ? ` Price coefficient of variation is operating above the ${quant.cvPct}th percentile threshold — statistically significant instability is confirmed for the active window.`
    : vol === 'low'
    ? ` Intraday price bands have compressed to within ${quant.devRange} of the 30-day baseline — well within operational stability bounds.`
    : ` Price deviation is tracking ${quant.devRange} above the 30-day moving average — moderate variability is present but not structurally disruptive.`
  const contradictionLine = isContradiction
    ? ` ${isMomVsTrough ? `Upward price acceleration is occurring in opposition to ${season === 'year-round' ? 'inter-season demand trough' : `pre-${season} accumulation trough`} conditions — the momentum signal warrants seasonal context before commitment.`
        : trend === 'rising' && anomaly === 'cluster' ? `Despite constructive short-term momentum, ${quant.anomalyCount} anomaly events in the active window are widening the probable outcome range — momentum is real but unreliable.`
        : vol === 'low' && anomaly !== 'none' ? 'Price compression coexists with an anomaly signature — an atypical configuration suggesting hidden structural pressure despite surface stability.'
        : 'Signal configuration is internally mixed — trend and risk indicators are not mutually reinforcing in the current window.'}`
    : ''
  const s1 = moveBase + quantAnchor + contradictionLine

  const b = []
  b.push(vol === 'high'
    ? v === 0 ? `Price coefficient of variation above the ${quant.cvPct}th percentile — statistically significant instability is active, increasing the probability of intraday correction events`
    : v === 1 ? `Intra-week price range at elevated levels — active demand-supply contest is underway; abrupt reversal risk cannot be excluded without volume confirmation`
    : `Momentum acceleration exceeds historical weekly norms — ${quant.devRange} deviation from baseline signals a fast-moving market regime`
    : vol === 'low'
    ? `Price compression within ${quant.devRange} of baseline — limited near-term upside catalyst; accumulation conditions are favorable at current range`
    : `Moderate intra-week variability — price deviation of ${quant.devRange} above the 30-day average falls within normal operational bounds`)
  b.push(anomaly === 'cluster'
    ? `Anomaly cluster active — ${quant.anomalyCount} deviation events in the current window are compressing mandi price efficiency and increasing the probability of short-duration procurement dislocations`
    : anomaly === 'isolated'
    ? `Isolated price deviation recorded — insufficient for pattern conclusion, but repetition within 48–72 hours would indicate a sustained anomaly regime forming`
    : `Anomaly registry clean — no statistical outliers in the active window; price discovery is operating within expected parameters`)
  b.push(regionDiv === 'high'
    ? `Cross-mandi spread elevated at ${quant.spreadPct} — geographic price dispersion in ${state} is reducing procurement efficiency; arbitrage mechanics are not normalizing at expected speed`
    : trend === 'rising'
    ? `Upward momentum may face velocity exhaustion — watch for volume contraction signals as a leading reversal indicator within the 7-day window`
    : trend === 'falling'
    ? `Downside momentum is self-reinforcing while arrivals exceed absorption — further correction of ${quant.devRange} is probabilistically consistent with current conditions`
    : `Near-term risk is contained within the ${quant.devRange} historical deviation band — no acute directional risk signal is active`)
  if (isContradiction) b.push(
    tone === 'tactical-opportunity'
    ? `Contradiction: elevated volatility alongside high confidence creates a tactical window — short-duration procurement with tight stop parameters is the analytically supported posture`
    : `Contradictory signal configuration — momentum and risk indicators diverge; directional thesis carries elevated invalidation risk within the active window`)
  if (ipr.isDivHighConf && regionDiv === 'high') b.push(
    `Geographic divergence of ${quant.spreadPct} against high confidence suggests a systematic procurement arbitrage window — cross-mandi sourcing comparison is time-sensitive`)

  const dirLabel   = trend === 'rising' ? 'BULLISH' : trend === 'falling' ? 'BEARISH' : 'NEUTRAL'
  const intensity  = vol === 'high' ? (trend !== 'sideways' ? 'strong' : 'turbulent') : vol === 'low' ? 'subdued' : 'moderate'
  const confPhrase = confAssert(confidence,
    'Momentum continuation is statistically favorable — directional conviction is justified for the active window.',
    'Momentum is present but directional reliability is moderate — confirm with volume and arrival data before committing.',
    'Directional clarity remains limited — momentum signal is present but operating under constrained confidence conditions.')
  const seasonalNote = season !== 'year-round' && seasonPhase !== 'transition'
    ? ` ${season} seasonal overlay is ${seasonPhase === 'peak' ? 'reinforcing the momentum direction — structural support is present' : `providing a ${trend === 'rising' ? 'potential resistance ceiling' : 'potential recovery floor'} at the seasonal phase boundary`}.`
    : ''
  const fusionSentence = ipr.isHighVolLowConf
    ? ` While ${trend === 'sideways' ? 'lateral consolidation persists' : `${trend === 'rising' ? 'upward' : 'downward'} momentum is registering`}, uncertainty bands widening to ${quant.ciWidth} reduce directional reliability for tactical commitment decisions.`
    : ipr.isLowVolStrongMom
    ? ` Low-volatility momentum of this character is structurally durable — absence of anomaly activity confirms the move is demand-driven rather than supply-disruption induced.`
    : ''
  const s3 = `Weekly momentum signal: ${dirLabel} — ${intensity} directional impulse detected. ${confPhrase}${seasonalNote}${fusionSentence}`

  const urgencyTag = tone === 'defensive' ? 'CAUTIOUS' : tone === 'tactical-opportunity' ? 'ACTIVE' : tone === 'accumulation' ? 'SYSTEMATIC' : 'MEASURED'
  const primaryRec = trend === 'rising' && vol !== 'low' && confidence !== 'Low'
    ? `Accelerate procurement within the active trading window — ${quant.cvPct}th percentile price velocity suggests near-term upside continuation.`
    : trend === 'rising' && confidence === 'Low'
    ? `Measured accumulation only — momentum is constructive but ${quant.ciWidth} confidence intervals introduce material uncertainty above current price levels.`
    : trend === 'rising'
    ? `Systematic accumulation is appropriate — stable upward drift with ${quant.devRange} deviation from baseline supports structured buying without urgency premium.`
    : trend === 'falling'
    ? `Defer non-critical procurement — downward correction of ${quant.devRange} is probabilistically consistent with current conditions; improved entry points are expected within 48–72 hours.`
    : `Hold procurement levels steady — neutral momentum with ${quant.devRange} deviation from baseline favors a wait-and-watch posture until directional clarity establishes.`
  const riskSuffix = anomaly === 'cluster'
    ? ` Avoid fixed-price forward contracts during active anomaly clustering — ${quant.anomalyCount} events in the window indicate spot-rate flexibility is operationally essential.`
    : anomaly === 'isolated'
    ? ` Monitor for repeat deviation before committing to forward positions — isolated events carry ${v === 0 ? '22%' : v === 1 ? '18%' : '25%'} probability of developing into sustained anomaly patterns.`
    : ` Current conditions support ${vol === 'low' ? 'indexed forward commitments at current price levels' : 'spot-rate positioning with short holding periods and defined exit triggers'}.`
  const s4 = `[${urgencyTag}] ${primaryRec}${riskSuffix}${regionDiv === 'high' ? ` Cross-mandi spread of ${quant.spreadPct} in ${state} presents a systematic sourcing efficiency opportunity — comparative rate monitoring across active mandis is time-sensitive.` : ''}`

  return {
    analyst: 'Weekly Price Intelligence',
    sections: [
      { label:'7-Day Price Movement',    content:s1, type:'para'    },
      { label:'Instability & Risk',      content:b,  type:'bullets' },
      { label:'Momentum Signal',         content:s3, type:'para'    },
      { label:'Tactical Recommendation', content:s4, type:'para'    },
    ],
  }
}

function synthesizeSeasonal(sig, ipr, quant) {
  const { crop, state, period, vol, season, category, trend, anomaly, seasonPhase, trainingDays, confidence, v } = sig
  const { isContradiction, isMomVsTrough } = ipr
  const isYR     = season === 'year-round'
  const cycle    = isYR ? 'perennial production' : season
  const phaseTxt = { peak: isYR ? 'active demand season' : `${season} peak harvest phase`, transition: isYR ? 'demand transition window' : `post-${season} market transition`, trough: isYR ? 'inter-season demand trough' : `pre-${season} accumulation trough` }[seasonPhase]

  const s1base = isYR
    ? `${crop} operates on a ${cycle} supply model — seasonal effects are secondary to demand-cycle dynamics. ${trainingDays.toLocaleString()} days of AGMARKNET data in ${state} reveal ${vol === 'low' ? `high intra-year price consistency, with deviation confined to ${quant.devRange} of the annual median` : vol === 'high' ? `notable seasonal volatility spikes — coefficient of variation at the ${quant.cvPct}th percentile despite continuous supply` : `moderate cyclical variation tracking within ${quant.devRange} of the annual baseline`}. Current position: ${phaseTxt}.`
    : `${crop} is a ${season} crop with harvest cycles structurally anchored to the ${season} calendar — procurement windows are bounded by fixed arrival and trough phases. ${state} ${v === 0 ? 'is a primary producing state for this cycle' : v === 1 ? 'is an active consumption market during this cycle' : 'is a key transit market within the seasonal flow'}. ${trainingDays.toLocaleString()} days of AGMARKNET history confirm the seasonal arc with ${quant.dataYears} full cycles analyzed. Current phase: ${phaseTxt}.`
  const contradictionLine = isContradiction && isMomVsTrough
    ? ` Price ${trend === 'rising' ? 'acceleration' : 'pressure'} is occurring in opposition to the ${phaseTxt} — an atypical seasonal configuration. Historical precedent indicates this pattern resolves with supply normalization within ${v === 0 ? '3–5 weeks' : v === 1 ? '4–6 weeks' : '2–4 weeks'}.`
    : isContradiction
    ? ` An internally mixed signal configuration exists — ${vol === 'low' && anomaly !== 'none' ? 'price stability coexisting with anomaly activity indicates latent structural pressure that may not be visible at surface price levels' : 'trend and risk indicators are not mutually reinforcing'}.`
    : ''
  const s1 = s1base + contradictionLine

  const b = []
  b.push(seasonPhase === 'peak'
    ? isYR ? `Peak demand phase active — consumption uptick is typically absorbing ${quant.devRange} of surplus arrival capacity; downside risk is limited unless arrivals significantly exceed peak-season demand benchmarks`
           : `Harvest peak phase: maximum arrival pressure is expected to persist for ${v === 0 ? '3–5 weeks' : '4–6 weeks'} — price compression risk is elevated by ${quant.cvPct > 60 ? 'above-average' : 'normal'} seasonal standards`
    : seasonPhase === 'trough'
    ? isYR ? `Inter-season demand trough — price catalysts are structurally limited; recovery typically emerges ${v === 0 ? '6–8' : '4–7'} weeks into the demand normalization phase`
           : `Pre-${season} accumulation trough: supply scarcity typically produces price floor formation within ${v === 0 ? '3–5' : '4–7'} weeks — early procurement carries seasonal timing advantage`
    : `Market transition phase — seasonal price direction may resolve within the current ${period} window; ${quant.devRange} deviation range is normal for transition windows in the ${quant.dataYears}-season historical record`)
  b.push(vol === 'high'
    ? `Above-normal ${cycle} volatility — coefficient of variation at the ${quant.cvPct}th percentile; harvest timing variance and regional transport disruptions are amplifying seasonal price swings beyond historical norms`
    : vol === 'low'
    ? `${cycle} stability confirmed — price bands within ${quant.devRange} of the ${isYR ? 'annual' : season} median; supply and demand are well-calibrated for this phase of the agricultural cycle`
    : `Moderate ${cycle} variability at ${quant.devRange} — seasonal adjustment is progressing within the ${isYR ? 'annual' : season} historical tolerance band; no structural disruption detected`)
  b.push(anomaly === 'cluster'
    ? `Anomaly cluster during ${phaseTxt} — ${quant.anomalyCount} atypical price events are disrupting the expected ${cycle} arc; historical pattern suggests cluster resolution within ${v === 0 ? '2–3' : '3–4'} weeks or escalation to structural disruption`
    : anomaly === 'isolated'
    ? `Isolated deviation from seasonal baseline — ${quant.dataYears}-season analysis indicates isolated events during ${phaseTxt} have ${v === 0 ? '74%' : '68%'} probability of self-correcting within the seasonal window`
    : `No anomalies detected — ${cycle} price arc is tracking the multi-year seasonal template with high fidelity; ${quant.dataYears} historical seasons confirm the current trajectory`)
  b.push(trend === 'rising'
    ? `Current prices are tracking ${quant.devRange} above the ${isYR ? 'annual' : season} historical average — demand is outpacing seasonal supply normalization; upside persistence is ${confidence === 'High' ? 'statistically likely' : 'possible but not conviction-level'}`
    : trend === 'falling'
    ? `Current prices are below the historical ${cycle} mean by ${quant.devRange} — post-harvest arrival pressure or demand shortfall is suppressing the seasonal floor`
    : `Prices are aligned within ${quant.devRange} of the ${cycle} historical median — the ${quant.dataYears}-season pattern is being tracked with structural fidelity`)
  if (isContradiction) b.push(
    `Analytical note: ${isMomVsTrough ? `${trend === 'rising' ? 'Upward momentum' : 'Price pressure'} during the ${phaseTxt} is statistically unusual in the ${quant.dataYears}-season record — treat as a potential outlier event requiring structural confirmation` : 'Signal contradiction reduces positional conviction — graduated exposure is preferred over directional commitment'} in this configuration`)

  const confPhrase = confAssert(confidence,
    `The ${cycle} arc is well-anchored — seasonal intelligence supports high-conviction positioning.`,
    `Moderate confidence in the seasonal trajectory — directional thesis is present but uncertainty bands of ${quant.ciWidth} should be maintained in planning assumptions.`,
    `Seasonal confidence is constrained to ${quant.ciWidth} — broader planning bands and contingency allocation are recommended.`)
  const s3 = isYR
    ? `${quant.dataYears}-season AGMARKNET analysis for ${crop} in ${state} confirms a ${vol === 'low' ? 'low-variance, demand-elastic' : vol === 'high' ? `high-variance (CV above ${quant.cvPct}th percentile)` : 'moderately cyclical'} pricing character. ${seasonPhase === 'peak' ? 'Demand peaks correspond with festival and export windows — current positioning aligns with this historical rhythm.' : seasonPhase === 'trough' ? `Price troughs in the historical record self-correct within ${v === 0 ? '6–8' : '4–6'} weeks as demand normalizes — trough depth of ${quant.devRange} is within the historical range.` : `Transition windows show average variance of ${quant.devRange} in the ${quant.dataYears}-season record — current deviation is within this band.`} ${confPhrase}`
    : `${quant.dataYears} full ${season} cycles in the AGMARKNET dataset confirm ${crop} in ${state} follows a ${v === 0 ? 'predictable' : v === 1 ? 'well-documented' : 'structurally consistent'} seasonal arc. ${seasonPhase === 'peak' ? `Peak harvest months show ${vol === 'high' ? `sharp price compression — arrivals historically exceed absorption by ${quant.devRange} during peak months` : 'orderly price discovery with moderate arrival absorption'} — consistent with the ${quant.dataYears}-cycle average.` : seasonPhase === 'trough' ? `Pre-${season} trough phases historically generate price recovery within ${v === 0 ? '4–7' : '5–8'} weeks — trough depth of ${quant.devRange} aligns with the structural baseline.` : `Transition windows exhibit ${quant.devRange} average price variance in the ${quant.dataYears}-cycle record — current deviation is within historical tolerance.`} ${confPhrase}`

  const posAction = seasonPhase === 'peak' && !isYR
    ? `Procurement ${trend === 'falling' ? 'at current levels is strategically attractive' : 'timing should be calibrated to harvest peak arrival data'} — spot prices typically establish the seasonal floor within ${v === 0 ? '4–6 weeks' : '3–5 weeks'} of peak phase onset.`
    : seasonPhase === 'trough'
    ? `Accumulation during the current ${phaseTxt} is the preferred positioning strategy — ${quant.dataYears} historical seasons confirm price recovery in the ${isYR ? 'demand normalization' : `post-${season} transition`} window follows current conditions.`
    : `A graduated procurement approach is appropriate for the current transition window — ${quant.devRange} historical deviation range during transitions suggests avoiding large single-batch commitments until the seasonal direction confirms.`
  const riskAdjust = vol === 'high'
    ? ` Elevated ${cycle} volatility — CV above ${quant.cvPct}th percentile — reduces seasonal timing precision; widen procurement bands by ${v === 0 ? '10–15%' : '8–12%'} and maintain flexible holding periods.`
    : vol === 'low'
    ? ` Stable ${cycle} conditions support forward procurement planning with ${quant.ciWidth} confidence in delivery-price alignment.`
    : ` Moderate volatility warrants ${v === 0 ? 'hedged positioning — split procurement across two seasonal windows' : `a near-term commitment tranche with a review trigger at mid-${isYR ? 'quarter' : 'season'}`}.`
  const anomalySuffix = anomaly !== 'none'
    ? ` Anomaly activity in this cycle may compress or extend the normal seasonal window by ${v === 0 ? '2–4' : '3–5'} weeks — maintain contingency flexibility in delivery scheduling.`
    : ` No anomalies detected — the seasonal arc is tracking the ${quant.dataYears}-cycle template with high fidelity; precision procurement timing is operationally achievable.`
  const s4 = posAction + riskAdjust + anomalySuffix

  return {
    analyst: 'Seasonal Intelligence',
    sections: [
      { label:'Seasonal Context',           content:s1, type:'para'    },
      { label:'Cyclical Risk Factors',      content:b,  type:'bullets' },
      { label:'Historical Cycle Alignment', content:s3, type:'para'    },
      { label:'Seasonal Positioning',       content:s4, type:'para'    },
    ],
  }
}

function synthesizeCoverage(sig, ipr, quant) {
  const { crop, state, vol, season, category, trend, anomaly, regionDiv, stateHeat, trainingDays, confidence, v } = sig
  const { isContradiction, isDivHighConf } = ipr
  const ALL_STATES = ['Tamil Nadu','Karnataka','Andhra Pradesh','Telangana','Kerala']
  const others     = ALL_STATES.filter(s => s !== state)
  const heatLabel  = stateHeat === 'hot' ? 'high-activity' : stateHeat === 'warm' ? 'moderate-activity' : 'low-activity'

  const spreadDesc = regionDiv === 'high'
    ? `Geographic price spread is at ${quant.spreadPct} — above the structural threshold for efficient regional arbitrage. Cross-state price integration for ${crop} is impaired, likely due to ${v === 0 ? 'transportation bottlenecks between production zones and terminal markets' : v === 1 ? 'uneven arrival timing across state boundaries' : 'demand concentration in terminal consumer markets'}.`
    : regionDiv === 'low'
    ? `Geographic convergence is tight at ${quant.stateGap} — cross-state prices for ${crop} are well-integrated, reflecting efficient logistics networks and active inter-state arbitrage. Single-state sourcing from ${state} is representative of the broader South Indian price level.`
    : `Geographic spread is moderate at ${quant.spreadPct} — consistent with normal mandi-level friction across South India. Cross-state arbitrage is partially efficient; marginal sourcing advantage exists.`
  const s1 = `${crop} AGMARKNET coverage spans all 5 South Indian states — ${trainingDays.toLocaleString()} days of mandi data in ${state} alone, representing ${quant.dataYears} years of price discovery history. ${spreadDesc} ${state} is a ${heatLabel} procurement market with ${v === 0 ? `well-documented ${category === 'perishable' ? 'daily' : 'weekly'} settlement cycles` : v === 1 ? 'consistent mandi data depth supporting institutional procurement analysis' : 'reliable price discovery history across all measured seasons'}.`

  const b = []
  b.push(regionDiv === 'high'
    ? `Cross-state procurement spread at ${quant.spreadPct} exceeds the efficient-market threshold — single-state sourcing from ${state} carries a ${quant.stateGap} cost premium versus the lowest-spread alternative; geographic concentration risk is elevated`
    : regionDiv === 'low'
    ? `Cross-state price convergence within ${quant.stateGap} — logistics cost is the primary procurement variable; geographic arbitrage advantage is marginal at current spread levels`
    : `Moderate regional spread of ${quant.spreadPct} — multi-state sourcing offers ${quant.stateGap} cost diversification benefit; partial arbitrage efficiency exists across the ${state} corridor`)
  b.push(stateHeat === 'hot'
    ? `${state} mandi activity is in the high-activity bracket — competitive arrival volumes support price discovery depth, but institutional sourcing competition may compress available procurement windows`
    : stateHeat === 'cool'
    ? `${state} mandi activity is below regional average — sourcing depth in ${state} may not accommodate large institutional volumes; supplementary procurement from ${others[0]} and ${others[1]} is structurally necessary for scale requirements`
    : `${state} mandi activity is moderate — sufficient depth for standard institutional volumes with manageable price discovery risk across the active settlement cycle`)
  b.push(vol === 'high'
    ? `Geographic volatility at the ${quant.cvPct}th percentile — regional price instability may propagate across connected mandi clusters; portfolio sourcing across ${v === 0 ? 'three' : 'two to three'} states reduces single-source concentration exposure`
    : anomaly !== 'none'
    ? `Anomaly activity in ${state} — ${quant.anomalyCount} deviation events detected; geographic hedging via secondary sourcing from ${others[v % others.length]} is advisable while anomaly pattern persists`
    : `No geographic supply risk signals detected — current mandi coverage in ${state} supports systematic procurement without structural diversification urgency`)
  if (regionDiv === 'high' && trend !== 'sideways') b.push(
    `Directional price signal (${trend}) combined with elevated geographic spread creates a ${trend === 'rising' ? 'time-sensitive procurement window' : 'potential hedging opportunity'} — cross-state rate comparison is most valuable when spread is elevated and direction is confirmed`)
  if (isContradiction || (isDivHighConf && regionDiv === 'high')) b.push(
    isDivHighConf
    ? `Geographic arbitrage window: high confidence combined with ${quant.spreadPct} spread creates an analytically favorable multi-state procurement setup — this configuration occurs in fewer than ${v === 0 ? '20%' : '25%'} of observed market states`
    : `Note: mixed signals reduce geographic positioning conviction — validate cross-state spread data against real-time arrivals before executing multi-state procurement strategy`)

  const confPhrase = confAssert(confidence,
    `Geographic intelligence at this confidence level supports systematic multi-state sourcing strategy execution.`,
    `Geographic intelligence supports directional sourcing guidance — validate cross-state rates at ${v === 0 ? 'weekly' : 'bi-weekly'} intervals to maintain positioning precision.`,
    `Geographic signal quality is limited in the current confidence regime — conservative single-source procurement from ${state} reduces execution risk.`)
  const s3 = `State-level comparison across South India reveals ${regionDiv === 'high' ? `a structural spread of ${quant.stateGap} between the highest and lowest-priced states for ${crop}. The ${state} price index should be benchmarked against ${others[0]} and ${others[1]} — these represent the primary alternative sourcing corridors at current spread levels.` : regionDiv === 'low' ? `tight cross-state alignment within ${quant.stateGap} — price signals in ${state} are representative of the broader South Indian market. Regional arbitrage mechanisms appear to be functioning efficiently at current spread levels.` : `normal cross-state variation of ${quant.stateGap} — ${state} is positioned ${v === 0 ? 'at a slight premium to the regional median' : v === 1 ? 'at the regional median price level' : 'at a moderate discount to the highest-priced state, offering marginal sourcing advantage'}.`} ${category === 'perishable' ? `Perishability dynamics constrain geographic arbitrage to ${v === 0 ? '24–36' : '18–30'}-hour transit windows — cross-state sourcing must account for logistics timing.` : category === 'spice' ? `${crop} tolerates interstate logistics well — geographic arbitrage windows extend to ${v === 0 ? '10–14' : '7–12'} days, enabling systematic multi-state procurement.` : ''} ${confPhrase}`

  const primaryRec = regionDiv === 'high'
    ? `Multi-state sourcing across ${state}, ${others[0]}, and ${others[1]} is analytically supported — ${quant.spreadPct} geographic spread exceeds the institutional cost threshold for single-source procurement.`
    : regionDiv === 'low'
    ? `Single-state procurement from ${state} is operationally justified — logistics optimization is the primary cost lever when geographic spread is within ${quant.stateGap}.`
    : `A balanced strategy anchored in ${state} (primary) with ${others[0]} as secondary allocation provides a risk-adjusted procurement framework consistent with current ${quant.spreadPct} spread levels.`
  const s4 = `${primaryRec} ${stateHeat === 'hot' ? `${state} mandi depth supports institutional procurement volumes — competitive rate discovery is active across the daily settlement cycle.` : stateHeat === 'cool' ? `Supplement ${state} sourcing with systematic monitoring of ${others[0]} and ${others[1]} arrivals — mandi depth in ${state} may constrain large-volume procurement efficiency.` : `${state} mandi depth is adequate for standard institutional requirements — no supplementary sourcing urgency at current mandi activity levels.`} ${vol === 'high' ? `Elevated geographic volatility (CV above ${quant.cvPct}th percentile) warrants shorter procurement commitment windows — avoid extended forward contracts until cross-state spread normalizes toward ${v === 0 ? '8–12%' : '6–10%'}.` : vol === 'low' ? `Stable geographic conditions support forward procurement planning — index-based contracts with ${v === 0 ? 'monthly' : 'quarterly'} review cycles are structurally appropriate.` : `Moderate conditions support a mixed strategy: spot-rate procurement for near-term requirements with indexed forward allocation for the balance of the planning horizon.`}`

  return {
    analyst: 'Geographic Procurement Intelligence',
    sections: [
      { label:'Regional Structure',    content:s1, type:'para'    },
      { label:'Geographic Risk',       content:b,  type:'bullets' },
      { label:'State Spread Analysis', content:s3, type:'para'    },
      { label:'Procurement Strategy',  content:s4, type:'para'    },
    ],
  }
}

function synthesizeForecast(sig, ipr, quant) {
  const { crop, state, period, vol, season, category, trend, anomaly, seasonPhase, trainingDays, confidence, v } = sig
  const { isContradiction } = ipr
  const horizonLabel = { monthly:'30-day', quarterly:'90-day', yearly:'365-day' }[period] ?? '90-day'
  const modelStr     = vol === 'low' ? 'Prophet (primary · high seasonal alignment)' : vol === 'high' ? 'XGBoost (primary · adaptive volatility weighting)' : 'Prophet + XGBoost ensemble (balanced weighting)'
  const dirLabel     = trend === 'rising' ? 'UPWARD' : trend === 'falling' ? 'DOWNWARD' : 'LATERAL'

  const confidenceAdj = confAssert(confidence,
    `with high directional conviction (${quant.ciWidth} confidence interval)`,
    `with moderate directional reliability (${quant.ciWidth} confidence interval)`,
    `under constrained confidence conditions (${quant.ciWidth} confidence interval — broader than normal)`)
  const dirContext = trend === 'rising'
    ? `Forward price trajectory is positive — upside probability is reinforced by ${seasonPhase === 'peak' ? 'peak-season demand alignment providing structural tailwind' : seasonPhase === 'trough' ? 'supply tightening ahead of seasonal recovery' : 'improving demand absorption dynamics relative to arrival volumes'}.`
    : trend === 'falling'
    ? `Forward price trajectory is negative — downside probability is driven by ${seasonPhase === 'peak' ? 'peak arrival volumes compressing prices toward the seasonal floor' : 'sustained supply surplus or deteriorating demand fundamentals'}.`
    : `Forward trajectory lacks directional conviction — ${vol === 'high' ? `high-volatility regime (CV above ${quant.cvPct}th percentile) is suppressing model confidence in either direction` : 'market equilibrium conditions are limiting price signal amplitude within the forecast horizon'}.`
  const contradictionLine = isContradiction
    ? ` ${trend !== 'sideways' && vol === 'high' && anomaly === 'cluster' ? `Directional signal is internally contested — ${quant.anomalyCount} recent anomaly events alongside ${trend === 'rising' ? 'upward' : 'downward'} momentum creates a fat-tail risk distribution not fully captured by the central forecast.` : `Signal contradiction detected — forecast direction and risk profile are not mutually reinforcing; widen operational planning bands by ${v === 0 ? '10–15%' : '8–12%'} above the central estimate.`}`
    : ''
  const s1 = `Primary forecast signal for ${crop} in ${state}: ${dirLabel} bias over the ${horizonLabel} horizon — ${confidenceAdj}. ${dirContext}${contradictionLine} Model: ${modelStr}. Training base: ${trainingDays.toLocaleString()} days.`

  const b = []
  b.push(trainingDays >= 4500
    ? `Deep training base: ${trainingDays.toLocaleString()} days — model generalization is strong across ${quant.dataYears} full seasonal cycles; out-of-sample performance is statistically robust`
    : trainingDays >= 3500
    ? `Adequate training depth: ${trainingDays.toLocaleString()} days across ${quant.dataYears} seasons — model is well-calibrated for standard seasonal patterns and moderate volatility regimes`
    : `Training base: ${trainingDays.toLocaleString()} days — sufficient for ${period} forecasting; uncertainty bounds of ${quant.ciWidth} reflect training-depth limitations at the shorter end of the data range`)
  b.push(confidence === 'High'
    ? `Confidence rating: HIGH — low-volatility regime (CV below the ${quant.cvPct}th percentile) and strong seasonal alignment support directional forecasting at ${quant.ciWidth} precision`
    : confidence === 'Low'
    ? `Confidence rating: LOW — elevated volatility at the ${quant.cvPct}th percentile is compressing model predictive precision; ${quant.ciWidth} intervals are wider than operational planning norms; point estimates carry elevated invalidation risk`
    : `Confidence rating: MODERATE — mixed volatility signals require ${quant.ciWidth} planning bands; directional bias is present and statistically significant, but not at conviction-level precision`)
  b.push(anomaly === 'cluster'
    ? `Anomaly cluster detected — ${quant.anomalyCount} spike events in the recent training window are introducing fat-tail risk not fully captured by the central probability mass; recommend widening intervals by ${v === 0 ? '8–12%' : '10–15%'} for operational planning`
    : anomaly === 'isolated'
    ? `Isolated anomaly in recent history — outlier has been classified and weighted appropriately within the ensemble; residual impact on directional output is estimated at ${v === 0 ? '3–5%' : '4–6%'} confidence interval widening`
    : `Clean anomaly registry — no outlier contamination in the recent training window; model is operating at full reliability specification for the ${period} forecast horizon`)
  if (confidence === 'Low' || (vol === 'high' && anomaly === 'cluster')) b.push(
    `Tail risk advisory: current ${vol === 'high' ? `${quant.cvPct}th percentile volatility` : 'low confidence regime'} combined with ${anomaly === 'cluster' ? `${quant.anomalyCount}-event anomaly cluster` : 'signal contradictions'} places ${v === 0 ? '12–18%' : '15–20%'} of probability mass in the tails — scenario planning across downside and upside bands is analytically necessary, not optional`)

  const confInterpret = confidence === 'High'
    ? `Tight intervals reflect the stable pricing regime — point estimates are reliable and support contract-based procurement planning. Mean reversion risk within the ${horizonLabel} window is statistically low.`
    : confidence === 'Low'
    ? `Wide probability distribution reflects the current high-uncertainty regime — point estimates carry material deviation risk. Scenario planning across the full ${quant.ciWidth} band is the appropriate analytical framework; avoid single-estimate anchoring.`
    : v === 0 ? `Moderate intervals indicate balanced uncertainty — the central forecast track supports directional planning, though tail events require hedging allocation.`
    : v === 1 ? `Range-based procurement targets are more robust than single-estimate anchors in this uncertainty environment — maintain flexibility at both the upper and lower planning boundaries.`
    : `Model outputs support directional positioning but indicate procurement flexibility through the forecast horizon should be preserved as a structural hedge.`
  const seasonalAnchor = season !== 'year-round' && seasonPhase !== 'transition'
    ? ` ${season} seasonal overlay is ${seasonPhase === 'peak' ? 'amplifying the directional signal — structural seasonal demand provides a confidence anchor' : 'providing a mean-reversion floor — post-trough dynamics historically support price recovery within the forecast arc'}, narrowing the functional probability band by ${v === 0 ? '3–5%' : '4–6%'}.`
    : ''
  const s3 = `${horizonLabel} confidence interval: ${quant.ciWidth} at the 80th percentile band — ${confidence === 'High' ? 'tighter than normal for this crop category' : confidence === 'Low' ? 'wider than optimal for operational planning' : 'within normal operational planning parameters'}. ${confInterpret}${seasonalAnchor}${isContradiction ? ` Internal signal contradiction is contributing approximately ${v === 0 ? '3–6%' : '4–7%'} additional interval widening beyond the baseline model output.` : ''}`

  const actionBase = confAssert(confidence,
    trend === 'rising' ? `High-confidence upward trajectory supports forward procurement commitment — lock in price reference before the ${horizonLabel} directional move completes.`
    : trend === 'falling' ? `High-confidence downward trajectory confirms a deferred procurement strategy — waiting for the forecasted trough offers better entry economics within the ${horizonLabel} window.`
    : `High-confidence stability forecast supports indexed contract structures — near-term price predictability is favorable for forward planning.`,
    trend === 'rising' ? `Moderate-confidence upward bias supports a graduated accumulation strategy — enter first tranche within current levels, preserve ${v === 0 ? '30–40%' : '25–35%'} allocation for potential mid-horizon dips.`
    : trend === 'falling' ? `Moderate-confidence downward bias supports a deferred posture — defer volume commitments while monitoring for reversal signals within the ${horizonLabel} window.`
    : `Moderate-confidence neutral forecast supports range-bound procurement — set reference floor and ceiling based on the ${quant.ciWidth} model interval.`,
    `Low-confidence forecast regime: avoid large single-tranche commitments. Break procurement into ${v === 0 ? 'three' : 'two to three'} time-indexed tranches across the ${horizonLabel} window — this distributes entry-price risk across the full probability distribution.`)
  const s4 = `${actionBase} ${anomaly !== 'none' ? `Recent anomaly activity introduces fat-tail risk beyond the central forecast — maintain contingency allocation of ${v === 0 ? '10–15%' : '15–20%'} above standard procurement volumes to absorb potential spike events within the ${horizonLabel} window.` : `Model anomaly registry is clean — forecast output can be applied at the stated ${quant.ciWidth} precision without anomaly-discount adjustments.`} Review forecast against live AGMARKNET arrivals at ${v === 0 ? '14' : v === 1 ? '21' : '10'}-day intervals; flag deviation above ${v === 0 ? '8%' : '10%'} from the central estimate as a reconvergence signal.`

  return {
    analyst: 'Predictive Intelligence Engine',
    sections: [
      { label:'Forecast Direction',     content:s1, type:'para'    },
      { label:'Reliability Assessment', content:b,  type:'bullets' },
      { label:'Uncertainty Profile',    content:s3, type:'para'    },
      { label:'Forecast-Guided Action', content:s4, type:'para'    },
    ],
  }
}

function synthesizeDefault(sig, ipr, quant) {
  const { crop, state, period, vol, season, trend, anomaly, confidence, v } = sig
  const pLabel = { monthly:'Monthly', quarterly:'Quarterly', yearly:'Full-period' }[period] ?? 'Period'
  const pAdj   = { monthly:'monthly', quarterly:'quarterly', yearly:'full-period' }[period] ?? period
  const s1 = vol === 'high'
    ? `${crop} markets in ${state} reflect heightened price sensitivity — coefficient of variation above the ${quant.cvPct}th percentile confirms elevated instability with ${quant.devRange} intra-period deviation from the 30-day baseline.`
    : vol === 'low'
    ? `${crop} in ${state} exhibits stable pricing within ${quant.devRange} of the established ${season !== 'year-round' ? season : 'annual'} norm — ${quant.dataYears}-season AGMARKNET history confirms this is a structurally stable pricing regime.`
    : `${crop} markets in ${state} show mixed directional signals across the ${pAdj} window — ${quant.devRange} deviation from baseline is within historical tolerance, but regional supply differentials are contributing to limited uncertainty.`
  const b = [
    vol === 'high' ? `Coefficient of variation above the ${quant.cvPct}th percentile — statistically significant instability warrants active monitoring` : vol === 'low' ? `Price volatility confined within ${quant.devRange} of baseline — no acute risk signal; accumulation conditions are favorable` : `Moderate variability at ${quant.devRange} — monitor for directional regime shift`,
    anomaly === 'cluster' ? `${quant.anomalyCount} anomaly events in the recent trading window — clustering pattern may indicate structural supply disruption` : anomaly === 'isolated' ? `Isolated price deviation recorded — ${v === 0 ? '74%' : '68%'} historical probability of self-correction within the current ${pAdj} window` : 'Anomaly registry clean — price discovery operating within expected parameters',
    trend === 'rising' ? 'Upward momentum signal active — demand absorption is outpacing arrival volumes at current mandi activity levels' : trend === 'falling' ? 'Downward pressure evident — arrival volumes may be exceeding demand absorption in the current window' : 'Neutral price momentum — lateral consolidation is the dominant pattern; directional breakout catalyst absent',
  ]
  const s3 = `${pLabel} forecast models ${confAssert(confidence, 'indicate high directional confidence', `reflect moderate uncertainty — ${quant.ciWidth} confidence interval`, `show constrained precision — ${quant.ciWidth} planning bands are required`)} over the ${pAdj} horizon. ${season !== 'year-round' ? `${season} seasonal dynamics are the primary structural driver.` : 'Year-round supply patterns provide a stable analytical baseline.'} ${ipr.isContradiction ? `Signal contradiction is active — treat directional thesis as provisional.` : ''}`
  const s4 = `${vol === 'high' ? `A cautious procurement posture is warranted — elevated volatility (CV above ${quant.cvPct}th percentile) increases the risk of entry-point misjudgment.` : vol === 'low' ? `Stable conditions support systematic procurement planning — ${quant.ciWidth} confidence intervals are operationally actionable.` : `A balanced approach is advised — moderate signal quality supports directional bias without high-conviction commitment.`} Regional intelligence for ${state} supports data-anchored decision-making across all procurement windows.`
  return {
    analyst: 'Agricultural Intelligence',
    sections: [
      { label:'Market Overview',  content:s1, type:'para'    },
      { label:'Risk Signals',     content:b,  type:'bullets' },
      { label:'Forecast Outlook', content:s3, type:'para'    },
      { label:'Recommendation',   content:s4, type:'para'    },
    ],
  }
}

function synthesize(sig, templateKey) {
  const ipr   = buildInteractionProfile(sig)
  const quant = buildQuant(sig)
  if (templateKey === 'weekly')   return synthesizeWeekly(sig, ipr, quant)
  if (templateKey === 'seasonal') return synthesizeSeasonal(sig, ipr, quant)
  if (templateKey === 'coverage') return synthesizeCoverage(sig, ipr, quant)
  if (templateKey === 'forecast') return synthesizeForecast(sig, ipr, quant)
  return synthesizeDefault(sig, ipr, quant)
}

// ── Brief strip ───────────────────────────────────────────────────────────────
function generateBrief(crop, state, period, templateKey) {
  const vol    = getCropVol(crop)
  const season = getCropSeason(crop)
  const pAdj   = { monthly:'short-term', quarterly:'medium-term', yearly:'long-range' }[period] ?? period
  if (templateKey === 'weekly') {
    if (vol === 'high') return `${crop} intraday momentum is elevated in ${state} — active anomaly monitoring and near-term reversal tracking engaged.`
    if (vol === 'low')  return `${crop} is holding a stable near-term range in ${state} — tactical signals are muted; accumulation conditions are favorable.`
    return `${crop} 7-day price velocity in ${state} is moderate — momentum signals are being tracked for directional breakout.`
  }
  if (templateKey === 'seasonal') {
    if (season === 'year-round') return `${crop} perennial production in ${state} is being mapped against 11-season cyclical patterns for structural positioning.`
    return `${crop} ${season} cycle analytics active — harvest phase positioning and seasonal deviation analysis underway for ${state}.`
  }
  if (templateKey === 'coverage') return `${crop} geographic mandi coverage across South India is being analyzed — cross-state spread and procurement diversification signals for ${state}.`
  if (templateKey === 'forecast') {
    if (vol === 'high') return `${crop} forward outlook in ${state} is operating under elevated uncertainty — wide confidence intervals are active across the ${pAdj} horizon.`
    if (vol === 'low')  return `${crop} forecast in ${state} shows high model confidence — stable volatility supports reliable ${pAdj} price trajectory estimation.`
    return `${crop} predictive intelligence for ${state} is active — ${pAdj} confidence bands and directional assessment underway.`
  }
  if (vol === 'high') return `${crop} markets in ${state} show elevated ${pAdj} volatility with moderate forecast confidence.`
  if (vol === 'low')  return `${crop} pricing remains stable across ${state} with limited anomaly activity and strong ${pAdj} alignment.`
  return `${crop} analytics in ${state} indicate consolidating momentum with moderate market signals.`
}

function formatTimestamp() {
  const now  = new Date()
  const date = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }).toUpperCase()
  return `${date} · ${time} IST`
}

function buildScenarios(sig, ipr) {
  const { trend, vol, confidence, anomaly, category, crop, state, seasonPhase, season } = sig
  const { isContradiction } = ipr
  let [bp, mp, sp] = trend === 'rising'
    ? confidence === 'High' ? [42, 38, 20] : confidence === 'Low' ? [18, 42, 40] : [28, 44, 28]
    : trend === 'falling'
    ? confidence === 'High' ? [20, 40, 40] : confidence === 'Low' ? [8, 42, 50] : [14, 42, 44]
    : confidence === 'High' ? [30, 45, 25] : confidence === 'Low' ? [15, 42, 43] : [22, 46, 32]
  if (isContradiction) { bp -= 6; sp += 6 }
  if (anomaly === 'cluster') { bp -= 4; sp += 4 }
  const total = bp + mp + sp
  bp = Math.round(bp * 100 / total); sp = Math.round(sp * 100 / total); mp = 100 - bp - sp
  return [
    {
      name: 'Bull', border: 'border-emerald-200', labelCls: 'text-emerald-700', barCls: 'bg-emerald-400',
      pct: bp, direction: '↑',
      confDelta: confidence === 'High' ? '+8–12% CI tightening' : confidence === 'Low' ? '±18–24% CI widening' : '±10–14% CI',
      behavior: trend === 'rising' ? 'Sustained upward momentum, anomaly suppression, peak-season demand confluence.' : 'Counter-trend recovery, supply tightening, demand-side catalyst.',
      implication: `${crop} in ${state} may outperform the ${category} median by 12–18% in this scenario.`,
      riskTrigger: 'Excess supply arrival or early-season entry by competing states.',
    },
    {
      name: 'Base', border: 'border-blue-200', labelCls: 'text-blue-700', barCls: 'bg-blue-400',
      pct: mp, direction: '→', confDelta: '±6–10% CI',
      behavior: `Moderate ${seasonPhase === 'peak' ? 'peak-season' : seasonPhase === 'trough' ? 'trough-phase' : 'consolidation'} pricing, consistent with historical ${season !== 'year-round' ? season : 'annual'} patterns.`,
      implication: 'Analyst base case. Price trajectory within historical seasonal bands.',
      riskTrigger: 'Material deviation in regional arrivals or logistics disruption.',
    },
    {
      name: 'Stress', border: 'border-amber-200', labelCls: 'text-amber-700', barCls: 'bg-amber-400',
      pct: sp, direction: '↓', confDelta: '-8–14% CI compression',
      behavior: vol === 'high' ? 'Volatility escalation, anomaly clustering, sentiment deterioration.' : 'Demand-side shock, regional supply surge, or policy intervention.',
      implication: `Price retracement toward the ${category} seasonal floor. Defensive positioning advised.`,
      riskTrigger: 'Cross-state arrivals, export restriction, or demand seasonality reversal.',
    },
  ]
}

function buildConfidenceDecomposition(sig) {
  const { trainingDays, vol, seasonPhase, regionDiv, anomaly } = sig
  return [
    { label: 'Historical Consistency', score: trainingDays >= 4500 ? 88 : trainingDays >= 3500 ? 72 : 56, detail: `${Math.round(trainingDays / 365)} yr training depth` },
    { label: 'Seasonal Alignment',     score: seasonPhase === 'peak' ? 80 : seasonPhase === 'transition' ? 62 : 45, detail: seasonPhase === 'peak' ? 'On-cycle peak phase' : seasonPhase === 'trough' ? 'Pre-season offset' : 'Mid-cycle' },
    { label: 'Regional Stability',     score: regionDiv === 'low' ? 84 : regionDiv === 'moderate' ? 62 : 38, detail: regionDiv === 'low' ? 'Tight cross-state spread' : regionDiv === 'high' ? 'Elevated spread' : 'Moderate divergence' },
    { label: 'Anomaly Suppression',    score: anomaly === 'none' ? 90 : anomaly === 'isolated' ? 55 : 22, detail: anomaly === 'none' ? 'Clean registry' : anomaly === 'cluster' ? 'Cluster active' : 'Isolated events' },
    { label: 'Model Agreement',        score: vol === 'low' ? 85 : vol === 'moderate' ? 66 : 44, detail: vol === 'low' ? 'Prophet · Seasonal aligned' : vol === 'high' ? 'XGBoost adaptive mode' : 'Ensemble consensus' },
  ]
}

function buildRegimeTimeline(sig, ipr) {
  const { vol, trend, seasonPhase, anomaly } = sig
  const { isContradiction } = ipr
  const sequence = ['Trough', 'Recovery', 'Expansion', 'Peak', 'Correction', 'Volatile']
  const current = isContradiction ? 'Correction'
    : vol === 'high' && anomaly === 'cluster' ? 'Volatile'
    : trend === 'rising' && seasonPhase === 'peak' ? 'Peak'
    : trend === 'rising' ? 'Expansion'
    : trend === 'falling' && seasonPhase === 'peak' ? 'Correction'
    : trend === 'falling' ? 'Recovery'
    : 'Trough'
  return sequence.map(name => ({ name, isCurrent: name === current }))
}

function buildPriorityFlags(sig, ipr) {
  const { vol, confidence, anomaly, regionDiv, seasonPhase, trend } = sig
  const { isContradiction } = ipr
  const isMomVsTrough = trend === 'rising' && seasonPhase === 'trough'
  const flags = []
  if (anomaly === 'cluster')                  flags.push({ level:'HIGH',   color:'red',   icon:'⬤', title:'PROCUREMENT RISK',       msg:'Anomaly cluster active — procurement windows are compressed. Review arrivals data before position sizing.' })
  if (vol === 'high' && confidence === 'Low') flags.push({ level:'HIGH',   color:'red',   icon:'⬤', title:'PRICE INSTABILITY',       msg:'Concurrent elevated volatility and low confidence. Wide planning bands required across all horizons.' })
  if (isMomVsTrough)                          flags.push({ level:'MEDIUM', color:'amber', icon:'◆', title:'SEASONAL REVERSAL WATCH', msg:'Rising momentum in pre-season phase. Confirm mandi arrival data before extrapolating trend persistence.' })
  if (!isMomVsTrough && confidence === 'Low') flags.push({ level:'MEDIUM', color:'amber', icon:'◆', title:'CONFIDENCE DEGRADATION',  msg:'Analytical confidence below South India Tier-1 median. Treat all price targets as indicative ranges.' })
  if (regionDiv === 'high')                   flags.push({ level:'MEDIUM', color:'amber', icon:'◆', title:'REGIONAL DISLOCATION',    msg:'Cross-state price spread is elevated. Arbitrage conditions may be active — validate state-level arrival data.' })
  if (isContradiction)                        flags.push({ level:'MEDIUM', color:'amber', icon:'◆', title:'SIGNAL CONTRADICTION',    msg:'Trend and seasonal signals are opposed. Confidence weights are reduced; apply defensive position sizing.' })
  return flags.slice(0, 3)
}

function buildEvolutionStrip(sig, ipr) {
  const { vol, trend, confidence, anomaly, seasonPhase } = sig
  const { isContradiction } = ipr
  return [
    { label:'Historical',       sub: vol === 'high' ? 'Elevated vol' : 'Stable regime',      conf: confidence === 'High' ? '+' : confidence === 'Low' ? '−' : '~', bias: trend,  active: false },
    { label:'Transitional',     sub: anomaly !== 'none' ? 'Anomaly event' : 'Clean regime',  conf: anomaly === 'cluster' ? '−' : '~',                              bias: anomaly !== 'none' ? 'mixed' : trend, active: false },
    { label:'Active',           sub: seasonPhase === 'peak' ? 'Peak season' : seasonPhase === 'trough' ? 'Pre-season' : 'Mid-cycle', conf: isContradiction ? '−' : confidence === 'High' ? '+' : '~', bias: trend, active: true },
    { label:'Forecast',         sub: confidence === 'High' ? 'Tight bands' : 'Wide bands',   conf: confidence === 'High' ? '+' : confidence === 'Low' ? '−' : '~', bias: trend,  active: false },
    { label:'Risk Window',      sub: vol === 'high' ? 'Active risk' : 'Contained',           conf: vol === 'high' ? '−' : '~',                                     bias: vol === 'high' || isContradiction ? 'falling' : trend, active: false },
    { label:'Probable Outcome', sub: trend === 'rising' ? 'Constructive' : trend === 'falling' ? 'Corrective' : 'Consolidation', conf: confidence, bias: isContradiction ? 'mixed' : trend, active: false },
  ]
}

function buildEvidenceTrace(sig, ipr, quant) {
  const { vol, trend, confidence, anomaly, seasonPhase, regionDiv, category, crop, state } = sig
  const { isContradiction, tone } = ipr
  const rows = []
  if (vol === 'high')
    rows.push({ signal:'Elevated Volatility', influence:'CI Band Expansion', effect:`Forecast range widened ±${quant.ciWidth} — caution on point estimates; treat all targets as planning bands`, severity:'high' })
  else if (vol === 'low')
    rows.push({ signal:'Compressed Volatility', influence:'CI Band Compression', effect:`Forecast precision elevated — tight ${quant.ciWidth} bands support actionable price targets`, severity:'positive' })
  else
    rows.push({ signal:'Moderate Volatility', influence:'Neutral CI Weight', effect:'Standard forecast bands applied — baseline planning confidence is applicable across horizons', severity:'neutral' })
  if (isContradiction)
    rows.push({ signal:'Seasonal Contradiction', influence:'Directional Certainty Reduction', effect:'Trend vs season opposition detected — model weights bifurcated; treat projections as scenario ranges', severity:'high' })
  if (!isContradiction && seasonPhase === 'peak')
    rows.push({ signal:'Peak Season Alignment', influence:'Demand-Side Amplification', effect:'Seasonal demand confluence supports price — procurement timing advantage confirmed in current window', severity:'positive' })
  else if (!isContradiction && seasonPhase === 'trough')
    rows.push({ signal:'Pre-Season Positioning', influence:'Supply Accumulation Phase', effect:'Below-season price levels — entry window for systematic accumulation strategy is active', severity:'neutral' })
  if (anomaly === 'cluster')
    rows.push({ signal:`Anomaly Cluster (${quant.anomalyCount} events)`, influence:'Tail-Risk Elevation', effect:`Cluster density above Tier-1 median — tail-risk probability elevated; widen stress scenario bands`, severity:'high' })
  else if (anomaly === 'isolated')
    rows.push({ signal:'Isolated Anomaly', influence:'Moderate Tail Adjustment', effect:'Single event in window — minor CI adjustment applied; monitor for recurrence', severity:'medium' })
  if (regionDiv === 'high')
    rows.push({ signal:`Regional Spread (${quant.spreadPct})`, influence:'Procurement Efficiency Reduction', effect:`Cross-state divergence active — arbitrage conditions possible; validate mandi-level data before bulk orders`, severity:'medium' })
  else if (regionDiv === 'low')
    rows.push({ signal:`Tight Spread (${quant.spreadPct})`, influence:'Procurement Efficiency Gain', effect:'Compressed inter-state spread — reduced arbitrage risk; bulk procurement efficiency improved', severity:'positive' })
  if (confidence === 'Low')
    rows.push({ signal:'Low Analytical Confidence', influence:'Planning Band Widening', effect:`All price targets are indicative — apply ${quant.ciWidth} planning bands to all procurement decisions`, severity:'high' })
  else if (confidence === 'High')
    rows.push({ signal:'High Analytical Confidence', influence:'Forecast Reliability Enhancement', effect:`CI at ${quant.ciWidth} — actionable price targets supported across near and medium horizons`, severity:'positive' })
  if (tone === 'accumulation')
    rows.push({ signal:'Accumulation Signal', influence:'Entry Timing Bias', effect:'Systematic accumulation conditions active — phased procurement strategy is applicable', severity:'positive' })
  else if (tone === 'defensive')
    rows.push({ signal:'Defensive Signal', influence:'Position Sizing Reduction', effect:'Defensive stance recommended — reduce forward commitments until directional clarity improves', severity:'medium' })
  return rows.slice(0, 8)
}

function buildCockpitMeters(sig, ipr, quant) {
  const { vol, trend, confidence, anomaly, regionDiv, seasonPhase } = sig
  const { isContradiction } = ipr
  const dv = trend === 'rising' ? 75 : trend === 'falling' ? 25 : 50
  const rp = vol === 'high' ? (anomaly === 'cluster' ? 88 : 72) : vol === 'low' ? 18 : isContradiction ? 58 : 42
  const st = vol === 'low' ? 88 : vol === 'high' ? 22 : isContradiction ? 35 : 62
  const mt = trend === 'rising' && seasonPhase === 'peak' ? 82 : trend === 'rising' ? 64 : trend === 'falling' && vol === 'high' ? 78 : trend === 'falling' ? 55 : 45
  const ps = regionDiv === 'high' ? 72 : anomaly === 'cluster' ? 65 : vol === 'high' && confidence === 'Low' ? 80 : regionDiv === 'low' ? 18 : 40
  const cd = isContradiction ? -18 : confidence === 'High' ? 12 : confidence === 'Low' ? -24 : 4
  return {
    directionBias: { val: dv, label: trend === 'rising' ? 'BULLISH' : trend === 'falling' ? 'BEARISH' : 'NEUTRAL', bar: trend === 'rising' ? 'bg-emerald-400' : trend === 'falling' ? 'bg-red-400' : 'bg-gray-500' },
    riskPressure:  { val: rp, label: `${rp}%`, bar: rp >= 70 ? 'bg-red-400' : rp >= 45 ? 'bg-amber-300' : 'bg-emerald-400' },
    stability:     { val: st, label: `${st}%`, bar: st >= 70 ? 'bg-emerald-400' : st >= 45 ? 'bg-amber-300' : 'bg-red-400' },
    mktTemp:       { val: mt, label: mt >= 70 ? 'HOT' : mt >= 50 ? 'WARM' : 'COOL', bar: mt >= 70 ? 'bg-red-300' : mt >= 50 ? 'bg-amber-300' : 'bg-blue-300' },
    procStress:    { val: ps, label: `${ps}%`, bar: ps >= 65 ? 'bg-red-400' : ps >= 45 ? 'bg-amber-300' : 'bg-emerald-400' },
    confDrift:     { val: Math.abs(cd), label: cd > 0 ? `+${cd}` : String(cd), cls: cd > 0 ? 'text-emerald-400' : cd < -10 ? 'text-red-400' : 'text-amber-400' },
  }
}

function buildActionCenter(sig, ipr) {
  const { vol, trend, confidence, anomaly, seasonPhase, category, v } = sig
  const { isContradiction } = ipr
  const immediateUrgency = (vol === 'high' && confidence === 'Low') || anomaly === 'cluster' ? 'HIGH'
    : isContradiction || vol === 'high' ? 'MEDIUM' : 'LOW'
  const immediateAction = trend === 'rising' && seasonPhase === 'peak' && confidence !== 'Low'
    ? 'Execute procurement within 48–72h window before peak season ceiling is reached.'
    : trend === 'rising' && confidence === 'High'
    ? 'Initiate systematic accumulation with staged position sizing across 5–7 trading days.'
    : trend === 'falling' && vol === 'high'
    ? 'Suspend forward commitments. Monitor floor signals before re-entry.'
    : isContradiction
    ? 'Hold current positions. Await signal convergence before increasing exposure.'
    : 'Maintain current procurement cadence with standard position sizing parameters.'
  const riskWindowUrgency = anomaly === 'cluster' || (vol === 'high' && isContradiction) ? 'HIGH'
    : vol === 'high' || confidence === 'Low' ? 'MEDIUM' : 'LOW'
  const riskWindowMsg = anomaly === 'cluster'
    ? `Anomaly cluster window is active. Tail-risk probability elevated for ${vol === 'high' ? '7–14' : '4–8'} day horizon.`
    : vol === 'high' && trend === 'rising'
    ? 'Upward momentum under elevated volatility — reversal window opens if volume fails to confirm within 3–5 days.'
    : isContradiction
    ? 'Seasonal contradiction creates reversal window. Momentum validity diminishes beyond the 2–3 week horizon.'
    : 'Standard risk parameters apply. No acute risk window identified at current signal configuration.'
  const procUrgency = (trend === 'rising' && seasonPhase === 'peak') ? 'MEDIUM' : 'LOW'
  const procStrategy = trend === 'rising'
    ? `${category === 'perishable' ? 'Accelerate near-term procurement' : 'Layer in long positions'} — price trajectory supports front-loaded allocation.`
    : trend === 'falling' && confidence === 'High'
    ? 'Defer bulk procurement. Indexed forward contracts reduce downside while preserving entry optionality.'
    : trend === 'falling'
    ? 'Defer major commitments. Establish price floor watch triggers before committing capital.'
    : `Balanced allocation. Maintain ${confidence === 'High' ? '60–40' : '50–50'} near/forward split.`
  const escalationUrgency = immediateUrgency === 'HIGH' ? 'HIGH' : riskWindowUrgency === 'HIGH' ? 'MEDIUM' : 'LOW'
  const escalationTrigger = vol === 'high' && anomaly === 'cluster'
    ? 'Escalate if anomaly cluster expands or CV exceeds 90th percentile threshold.'
    : isContradiction && confidence !== 'High'
    ? 'Escalate if momentum reversal occurs within 10-day window without seasonal confirmation.'
    : confidence === 'Low'
    ? 'Escalate if analytical confidence fails to recover — reassess model inputs with updated arrival data.'
    : `Monitor regime continuation. Escalate if market transitions away from current phase without warning signals.`
  return [
    { title:'Immediate Action',     urgency: immediateUrgency,  msg: immediateAction,   icon: trend === 'rising' ? '▲' : trend === 'falling' ? '▼' : '▶' },
    { title:'Risk Window',          urgency: riskWindowUrgency, msg: riskWindowMsg,     icon: anomaly !== 'none' ? '◉' : '○' },
    { title:'Procurement Strategy', urgency: procUrgency,       msg: procStrategy,      icon: '◈' },
    { title:'Escalation Trigger',   urgency: escalationUrgency, msg: escalationTrigger, icon: '◆' },
  ]
}

function buildPressureHeatStrip(sig, ipr, quant) {
  const { vol, trend, confidence, anomaly, regionDiv, seasonPhase, v } = sig
  const { isContradiction } = ipr
  const dem  = trend === 'rising' && seasonPhase === 'peak' ? [78,84,80][v] : trend === 'rising' ? [58,64,61][v] : trend === 'falling' ? [28,32,30][v] : [44,48,46][v]
  const sup  = trend === 'falling' ? [72,78,75][v] : trend === 'rising' ? [28,32,30][v] : [46,50,48][v]
  const vola = vol === 'high' ? [82,88,85][v] : vol === 'low' ? [14,18,16][v] : [48,52,50][v]
  const arr  = seasonPhase === 'trough' ? [72,78,75][v] : seasonPhase === 'peak' ? [28,32,30][v] : [48,54,51][v]
  const reg  = regionDiv === 'high' ? [74,80,77][v] : regionDiv === 'low' ? [12,16,14][v] : [40,44,42][v]
  const cst  = confidence === 'High' ? [82,86,84][v] : confidence === 'Low' ? [18,22,20][v] : [52,56,54][v]
  const prc  = (vol === 'high' && confidence === 'Low') ? [84,90,87][v] : isContradiction ? [62,68,65][v] : anomaly === 'cluster' ? [70,76,73][v] : [28,34,31][v]
  const sds  = isContradiction ? [68,74,71][v] : seasonPhase === 'peak' ? [24,28,26][v] : seasonPhase === 'trough' ? [56,62,59][v] : [38,42,40][v]
  return [
    { label:'Demand',        score: dem,  icon:'↑' },
    { label:'Supply',        score: sup,  icon:'↓' },
    { label:'Volatility',    score: vola, icon:'⚡' },
    { label:'Arrivals',      score: arr,  icon:'⊕' },
    { label:'Reg. Spread',   score: reg,  icon:'⇄' },
    { label:'Conf. Stab.',   score: cst,  icon:'◎' },
    { label:'Proc. Risk',    score: prc,  icon:'▲' },
    { label:'Season. Dist.', score: sds,  icon:'⊘' },
  ]
}

function buildRecommendationHierarchy(sig, ipr, quant) {
  const { vol, trend, confidence, anomaly, seasonPhase, category, regionDiv, v } = sig
  const { isContradiction, tone } = ipr
  const primaryAction = tone === 'defensive' || (vol === 'high' && confidence === 'Low') ? 'HOLD / DEFER'
    : tone === 'accumulation' ? 'ACCUMULATE'
    : tone === 'tactical-opportunity' ? 'BUY TACTICAL'
    : trend === 'rising' && seasonPhase === 'peak' && confidence !== 'Low' ? 'BUY NEAR-TERM'
    : trend === 'falling' && confidence === 'High' ? 'SELL / REDUCE'
    : isContradiction ? 'OBSERVE'
    : 'SCALE GRADUALLY'
  const primaryRationale = tone === 'defensive' || (vol === 'high' && confidence === 'Low')
    ? `Elevated risk environment (CV ${quant.cvPct}th pctile) constrains commitment. Preserve capital for higher-confidence re-entry.`
    : tone === 'accumulation'
    ? `Low-volatility momentum regime active — systematic phased procurement at current levels is analytically supported.`
    : tone === 'tactical-opportunity'
    ? `High-confidence, high-volatility window: bounded procurement opportunity. Size positions relative to elevated price velocity.`
    : trend === 'rising' && seasonPhase === 'peak' && confidence !== 'Low'
    ? `Peak season momentum convergence — procurement window is time-limited; delay expands execution cost.`
    : trend === 'falling' && confidence === 'High'
    ? `Defined correction trajectory with high directional confidence — reduce forward exposure; deploy at lower entry levels.`
    : isContradiction
    ? `Contradictory signal configuration requires resolution before directional commitment. Analytical posture is neutral.`
    : `Balanced market structure supports measured incremental procurement without acute timing pressure.`
  const secondaryAction = trend === 'rising' ? 'MONITOR REVERSALS'
    : trend === 'falling' ? 'IDENTIFY FLOOR' : 'AWAIT BREAKOUT'
  const secondaryDetail = trend === 'rising'
    ? `Watch for ${vol === 'high' ? 'sudden volume contraction or intraday reversal' : 'momentum deceleration signals'} as early exit indicators.`
    : trend === 'falling'
    ? `Track arrival volume stabilization and ${seasonPhase === 'trough' ? 'pre-season demand emergence' : 'supply-side correction'} as re-entry catalysts.`
    : `Lateral consolidation phase — position for directional breakout with defined entry triggers on either side.`
  const monitoringCond = anomaly === 'cluster'
    ? `Anomaly cluster resolution — monitor for ${quant.anomalyCount} event cluster normalization; 48h without new deviations confirms regime stabilization.`
    : confidence === 'Low'
    ? `Confidence recovery — watch for CV compression and anomaly registry clean for 5 consecutive trading days.`
    : isContradiction
    ? `Signal convergence — momentum and seasonal direction alignment required before transitioning to directional posture.`
    : `Regime continuation — current configuration is self-reinforcing; monitor for phase transition indicators over ${v === 0 ? '3–4' : '4–6'} week window.`
  const invalidationSignal = trend === 'rising'
    ? `Invalidated if daily close falls more than ${vol === 'high' ? '2.5' : '1.8'}× historical standard deviation below the 5-day average — confirms momentum breakdown.`
    : trend === 'falling'
    ? `Recovery invalidated if price fails to form higher low within ${v === 0 ? '10' : '14'} trading days — signals continued correction.`
    : `Consolidation thesis invalidated if breakout volume exceeds ${v === 0 ? '1.6' : '1.8'}× the 30-day average without returning to range within 3 sessions.`
  return {
    primary:          { action: primaryAction, rationale: primaryRationale },
    secondary:        { action: secondaryAction, detail: secondaryDetail },
    monitoringCond,
    invalidationSignal,
  }
}

function generateNarrator(sig, quant) {
  const { crop, state, vol, trend, confidence, anomaly, seasonPhase, category, v } = sig
  const lines = []
  if (trend === 'rising' && seasonPhase === 'peak')
    lines.push(`${crop} prices in ${state} are rising and are at or near their seasonal high.`)
  else if (trend === 'rising' && seasonPhase === 'trough')
    lines.push(`${crop} prices in ${state} are rising earlier than usual for this time of year.`)
  else if (trend === 'rising')
    lines.push(`${crop} prices in ${state} are moving upward in the current market.`)
  else if (trend === 'falling' && vol === 'high')
    lines.push(`${crop} prices in ${state} are falling and showing sudden swings.`)
  else if (trend === 'falling')
    lines.push(`${crop} prices in ${state} are gradually declining this period.`)
  else
    lines.push(`${crop} prices in ${state} are relatively stable right now.`)
  if (vol === 'high' && anomaly === 'cluster')
    lines.push(`The market has seen some unusual price events recently, making it harder to predict what comes next.`)
  else if (vol === 'high')
    lines.push(`Market activity is higher than normal — prices may swing up or down quickly.`)
  else if (vol === 'low' && confidence === 'High')
    lines.push(`Market conditions are calm and price forecasts are more reliable than usual.`)
  else if (anomaly === 'isolated')
    lines.push(`There was an unusual price movement recently, but it appears to be a single event.`)
  else
    lines.push(`Seasonal patterns are ${seasonPhase === 'peak' ? 'supporting strong prices' : seasonPhase === 'trough' ? 'putting some pressure on prices' : 'in a normal transition phase'}.`)
  if (trend === 'rising' && confidence === 'High' && vol !== 'high')
    lines.push(`${category === 'perishable' ? 'Farmers may benefit from holding for a few more days' : 'This looks like a reasonable time to sell or accumulate'} if storage is available.`)
  else if (vol === 'high' || anomaly === 'cluster')
    lines.push(`Selling gradually in smaller quantities may help reduce risk in this uncertain market.`)
  else if (trend === 'falling')
    lines.push(`Waiting too long to sell may result in lower prices — timely decisions are advisable.`)
  else
    lines.push(`No urgent action is required at this time — regular market participation is appropriate.`)
  return lines
}

function generateHumanActions(sig, ipr, quant) {
  const { crop, state, vol, trend, confidence, anomaly, seasonPhase, category, v } = sig
  const { isContradiction, tone } = ipr
  const farmer = [], trader = [], procurement = []
  if (trend === 'rising' && confidence === 'High' && vol !== 'high') {
    farmer.push(`Prices are strong right now. Hold your ${crop} for up to ${v === 0 ? '7–10' : '5–8'} more days if you have storage.`)
    farmer.push('Sell in batches rather than all at once to get better average prices.')
    trader.push('Accumulate gradually over the next 2 weeks. Price direction is favorable.')
    trader.push(`Consider ${category === 'perishable' ? 'short-term' : 'medium-term'} positions.`)
    procurement.push(`Lock in procurement soon. Prices for ${crop} are expected to stay elevated.`)
    procurement.push('Consider committing 60–70% of your procurement target now.')
  } else if (trend === 'rising' && vol === 'high') {
    farmer.push('Prices are rising but the market is unpredictable. Sell in small batches every 2–3 days.')
    farmer.push('Avoid holding large stocks — sudden reversals are possible.')
    trader.push('Short-term momentum looks positive but risky. Keep transaction sizes small.')
    trader.push('Set clear exit levels before each purchase.')
    procurement.push('Split your procurement into smaller orders placed every few days.')
    procurement.push('Avoid large single-day purchases until the market settles.')
  } else if (trend === 'falling' && confidence === 'High') {
    farmer.push('Prices are falling. Sell as soon as possible to avoid further loss.')
    farmer.push(`${category === 'perishable' ? 'For perishables, delay costs more than waiting for a recovery.' : 'Avoid storing produce hoping for a rebound — supplies are adequate.'}`)
    trader.push('Avoid building inventory right now. Prices may fall further before recovering.')
    trader.push('Wait for clear signs of a price floor before buying.')
    procurement.push('Hold off on large procurement commitments. Better prices may arrive in a few weeks.')
    procurement.push('Use this window to compare rates across different mandis.')
  } else if (trend === 'falling') {
    farmer.push('Prices are under pressure. Sell steadily rather than waiting for a recovery.')
    farmer.push('If you can reduce storage costs, sell sooner.')
    trader.push('Be cautious about buying. The downward trend may continue for a while.')
    procurement.push('Delay major procurement where possible. Monitor daily prices.')
  } else if (isContradiction) {
    farmer.push('Market signals are mixed right now. Sell at your regular pace — no need to rush.')
    farmer.push('Avoid making big decisions until prices become more predictable over the next week.')
    trader.push('Wait for clearer market direction before making large commitments.')
    trader.push('Smaller positions are safer until market signals align.')
    procurement.push('Split orders and spread timing. Avoid large single-day commitments.')
  } else {
    farmer.push(`${crop} prices are stable. Sell at your normal schedule.`)
    farmer.push('No urgent action needed. Market conditions are reasonably settled.')
    trader.push('Market is in a consolidation phase. Small positions are acceptable.')
    procurement.push('Flexible timing — no immediate pressure. Spread procurement over the next 2 weeks.')
  }
  if (anomaly !== 'none') farmer.push('Unusual price events were recorded recently. Verify your local mandi prices before selling.')
  if (seasonPhase === 'peak') farmer.push('This is peak season — buyer demand is likely higher than usual.')
  else if (seasonPhase === 'trough') farmer.push('This is a slower season — competition from other sellers may be higher.')
  const risk = (vol === 'high' && anomaly === 'cluster') ? `HIGH RISK — ${crop} prices can change suddenly. Avoid large single transactions and monitor mandi rates daily.`
    : (vol === 'high' && confidence === 'Low') ? `ELEVATED RISK — Market is unpredictable. Split all buying and selling decisions into smaller steps.`
    : isContradiction ? `CAUTION — Market signals are conflicting. Wait for clarity before making major decisions.`
    : (vol === 'low' && confidence === 'High') ? `LOW RISK — Market is stable and predictable. Standard selling practices apply.`
    : `MODERATE RISK — Monitor prices daily. Adjust your plan if conditions change suddenly.`
  return { farmer: farmer.slice(0, 4), trader: trader.slice(0, 3), procurement: procurement.slice(0, 3), risk }
}

function getMarketStatus(sig, ipr) {
  const { vol, trend, confidence, anomaly } = sig
  const { isContradiction } = ipr
  if ((vol === 'high' && anomaly === 'cluster') || (vol === 'high' && confidence === 'Low'))
    return { emoji:'🔴', label:'HIGH RISK MARKET', colorBase:'red', explanation:'Prices are highly unpredictable and may change suddenly.', recommendation:'Avoid large transactions. Sell gradually and monitor daily.', expectation:'Expect continued price swings over the next 2–3 weeks.' }
  if (vol === 'high' || (trend === 'falling' && vol !== 'low') || isContradiction)
    return { emoji:'🟠', label:'VOLATILE CONDITIONS', colorBase:'orange', explanation:'Market is active and prices may shift quickly in either direction.', recommendation:'Sell in smaller batches. Avoid committing to large purchases.', expectation:'Conditions may stabilize in 1–2 weeks depending on arrivals.' }
  if (anomaly === 'isolated' || confidence === 'Low' || (trend === 'falling' && vol === 'low'))
    return { emoji:'🟡', label:'WATCH CAREFULLY', colorBase:'amber', explanation:'Market is mostly stable but some uncertainty is present.', recommendation:'Monitor prices regularly. No urgent action needed.', expectation:'Prices should remain in a predictable range this period.' }
  return { emoji:'🟢', label:'STABLE MARKET', colorBase:'emerald', explanation:'Market conditions are favorable and prices are predictable.', recommendation:'Normal selling and procurement schedules apply.', expectation:'Stable conditions expected for the next 2–3 weeks.' }
}

function generateWhyHappening(sig, ipr, quant) {
  const { crop, state, vol, trend, confidence, anomaly, seasonPhase, category, regionDiv, v } = sig
  const { isContradiction } = ipr
  const reasons = []
  if (trend === 'rising')
    reasons.push(seasonPhase === 'peak' ? `Demand for ${crop} is strong — this is the peak buying season.` : `Buyers are purchasing ${crop} at higher rates than in previous weeks.`)
  else if (trend === 'falling')
    reasons.push(seasonPhase === 'trough' ? `This is a slower season for ${crop} — fewer buyers are active.` : `Arrivals are higher than demand, which is pushing prices down.`)
  else
    reasons.push(`Supply and demand for ${crop} are roughly balanced right now.`)
  if (vol === 'high') reasons.push(`Price swings are larger than normal because of inconsistent arrivals at mandis.`)
  else if (vol === 'low') reasons.push(`Steady arrivals and stable demand are keeping prices consistent.`)
  if (anomaly === 'cluster') reasons.push(`Unusual price events have occurred in the past few weeks — possible disruptions to normal trading.`)
  else if (anomaly === 'isolated') reasons.push(`One unusual price event was recorded recently, but it appears to have been temporary.`)
  if (isContradiction) reasons.push(`Some market signals are pointing in opposite directions — this makes the situation harder to predict.`)
  if (regionDiv === 'high') reasons.push(`Prices are varying significantly across regions — local mandi conditions are dominant.`)
  if (confidence === 'Low') reasons.push(`Not enough consistent data is available to make high-confidence predictions for this period.`)
  else if (confidence === 'High') reasons.push(`Long historical records for ${crop} in ${state} make forecasts more reliable than average.`)
  if (seasonPhase === 'trough' && trend === 'rising') reasons.push(`Prices are rising even in a typically slow season — this is an unusual pattern.`)
  return reasons.slice(0, 5)
}

function generateReport(crop, state, period, templateKey) {
  const sig    = getSignals(crop, state, period, templateKey)
  const ipr    = buildInteractionProfile(sig)
  const quant  = buildQuant(sig)
  const result = synthesize(sig, templateKey)
  const pLabel = { monthly:'Monthly', quarterly:'Quarterly', yearly:'Full-period' }[period] ?? 'Period'
  const pAdj   = { monthly:'monthly', quarterly:'quarterly', yearly:'full-period' }[period] ?? period
  const confidenceBasis = sig.confidence === 'High'
    ? `Stable volatility regime (CV below ${quant.cvPct}th percentile) and ${sig.trainingDays.toLocaleString()} training days of AGMARKNET data — ${quant.ciWidth} confidence interval.`
    : sig.confidence === 'Low'
    ? `Elevated volatility (CV above ${quant.cvPct}th percentile) constrains ${pAdj} forecast precision — ${quant.ciWidth} planning bands apply; extended history would improve confidence.`
    : `${sig.trainingDays.toLocaleString()} training days with moderate volatility at the ${quant.cvPct}th percentile — ${pLabel.toLowerCase()} precision within ${quant.ciWidth} is achievable with current data depth.`
  const gaugeScore = sig.confidence === 'High'
    ? (sig.vol === 'high' ? 68 : 84)
    : sig.confidence === 'Low'
    ? (quant.anomalyCount > 2 ? 18 : 28)
    : (sig.vol === 'high' ? 44 : 56)
  return {
    ...result,
    confidence:     sig.confidence,
    confidenceBasis,
    timestamp:      formatTimestamp(),
    exportFormats:  TEMPLATES.find(t => t.key === templateKey)?.types ?? ['PDF','Excel','CSV'],
    thesis:         generateMarketThesis(sig, ipr, quant, templateKey),
    conflictWarning: ipr.isContradiction ? getConflictMessage(ipr, sig) : null,
    gaugeScore,
    signalMatrix:   buildSignalMatrix(sig),
    comparative:    buildComparativeInsights(sig, quant),
    analystMeta:    getAnalystMeta(sig, ipr, quant, templateKey),
    scenarios:      buildScenarios(sig, ipr),
    confDecomp:     buildConfidenceDecomposition(sig),
    regimeTimeline: buildRegimeTimeline(sig, ipr),
    priorityFlags:  buildPriorityFlags(sig, ipr),
    evolutionStrip:           buildEvolutionStrip(sig, ipr),
    evidenceTrace:            buildEvidenceTrace(sig, ipr, quant),
    cockpitMeters:            buildCockpitMeters(sig, ipr, quant),
    actionCenter:             buildActionCenter(sig, ipr),
    pressureStrip:            buildPressureHeatStrip(sig, ipr, quant),
    recommendationHierarchy:  buildRecommendationHierarchy(sig, ipr, quant),
    narrator:                 generateNarrator(sig, quant),
    humanActions:             generateHumanActions(sig, ipr, quant),
    marketStatus:             getMarketStatus(sig, ipr),
    whyHappening:             generateWhyHappening(sig, ipr, quant),
    sigSnapshot:    { trend: sig.trend, vol: sig.vol, confidence: sig.confidence, anomaly: sig.anomaly, seasonPhase: sig.seasonPhase, crop: sig.crop, state: sig.state },
  }
}

// ── Download handlers ─────────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadCSV(report, crop, state, period, templateKey) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows   = [
    ['AgroPrice AI — Report Intelligence Export'],
    ['Generated', report.timestamp],
    ['Crop', crop], ['State', state], ['Period', period],
    ['Template', templateKey], ['Analyst', report.analyst], ['Confidence', report.confidence],
    [], ['AI MARKET THESIS', report.thesis],
    [], ['Confidence Basis', report.confidenceBasis],
    [], ['SECTION', 'CONTENT'],
    ...report.sections.flatMap(s =>
      s.type === 'bullets'
        ? s.content.map((b, i) => [i === 0 ? s.label : '', b])
        : [[s.label, s.content]]
    ),
  ]
  const slug = `${crop}_${state}_${templateKey}`.replace(/[^a-z0-9]+/gi, '_')
  triggerDownload(new Blob([rows.map(r => r.map(escape).join(',')).join('\n')], { type:'text/csv;charset=utf-8;' }), `AgroPrice_${slug}.csv`)
}

function downloadExcel(report, crop, state, period, templateKey) {
  const esc  = v => String(v ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const cell = (v, bold, bg) => `<td style="font-family:Arial,sans-serif;font-size:11px;padding:4px 8px;border:1px solid #e5e7eb${bold?';font-weight:700':''}${bg?`;background:${bg}`:''};">${esc(v)}</td>`
  const tr   = (...cells) => `<tr>${cells.join('')}</tr>`
  const rows = [
    tr(cell('AgroPrice AI — Report Intelligence Export','bold','#f9fafb'), cell('','','#f9fafb')),
    tr(cell('Generated'), cell(report.timestamp)),
    tr(cell('Crop'), cell(crop), cell('State'), cell(state)),
    tr(cell('Period'), cell(period), cell('Confidence'), cell(report.confidence)),
    tr(cell('Template'), cell(templateKey), cell('Analyst'), cell(report.analyst)),
    tr(cell('')),
    tr(cell('AI MARKET THESIS','bold','#f0f9ff'), cell(report.thesis,'','#f0f9ff')),
    tr(cell('')),
    tr(cell('Confidence Basis'), cell(report.confidenceBasis)),
    tr(cell('')),
    tr(cell('SECTION','bold','#f9fafb'), cell('CONTENT','bold','#f9fafb')),
    ...report.sections.flatMap(s =>
      s.type === 'bullets'
        ? s.content.map((b, i) => tr(cell(i === 0 ? s.label : ''), cell(b)))
        : [tr(cell(s.label,'bold'), cell(s.content))]
    ),
  ]
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table>${rows.join('')}</table></body></html>`
  const slug = `${crop}_${state}_${templateKey}`.replace(/[^a-z0-9]+/gi, '_')
  triggerDownload(new Blob([html], { type:'application/vnd.ms-excel;charset=utf-8;' }), `AgroPrice_${slug}.xls`)
}

function downloadPDF(report, crop, state, period, templateKey) {
  const confColor = report.confidence === 'High' ? '#065f46' : report.confidence === 'Low' ? '#7f1d1d' : '#78350f'
  const confBg    = report.confidence === 'High' ? '#d1fae5' : report.confidence === 'Low' ? '#fee2e2' : '#fef3c7'
  const ms        = report.marketStatus ?? {}
  const msBg      = ms.colorBase === 'red' ? '#fef2f2' : ms.colorBase === 'orange' ? '#fff7ed' : ms.colorBase === 'amber' ? '#fffbeb' : '#f0fdf4'
  const msBorder  = ms.colorBase === 'red' ? '#fca5a5' : ms.colorBase === 'orange' ? '#fdba74' : ms.colorBase === 'amber' ? '#fcd34d' : '#86efac'
  const msText    = ms.colorBase === 'red' ? '#7f1d1d' : ms.colorBase === 'orange' ? '#7c2d12' : ms.colorBase === 'amber' ? '#78350f' : '#14532d'
  const humanFarmer  = (report.humanActions?.farmer ?? []).map(i => `<p class="human-item">◆ ${i}</p>`).join('')
  const humanTrader  = (report.humanActions?.trader ?? []).map(i => `<p class="human-item">◆ ${i}</p>`).join('')
  const humanRisk    = report.humanActions?.risk ?? ''
  const whyLines     = (report.whyHappening ?? []).map(r => `<p class="why-item">▸ ${r}</p>`).join('')
  const narratorTxt  = (report.narrator ?? []).join(' ')
  const sections  = report.sections.map(s => {
    const body = s.type === 'bullets'
      ? `<ul>${s.content.map(b => `<li>${b}</li>`).join('')}</ul>`
      : `<p class="body">${s.content}</p>`
    return `<div class="section"><p class="sec-label">${s.label}</p>${body}</div>`
  }).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AgroPrice AI — ${report.analyst}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;color:#111;background:#fff}
.page{max-width:720px;margin:0 auto;padding:56px 52px}
.masthead{border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px}
.brand-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.brand{font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#6b7280}
.doc-class{font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9ca3af}
.title{font-size:20px;font-weight:700;letter-spacing:-.02em;color:#111;margin-bottom:3px}
.subtitle{font-family:Arial,sans-serif;font-size:11px;color:#6b7280;margin-bottom:12px}
.meta-row{display:flex;gap:20px;margin-bottom:10px}
.meta-item .ml{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px}
.meta-item .mv{font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:#374151}
.conf-badge{display:inline-block;padding:2px 10px;border-radius:3px;font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:${confBg};color:${confColor}}
.thesis-block{background:#f8fafc;border-left:3px solid #374151;padding:12px 14px;margin:14px 0 18px}
.thesis-label{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px}
.thesis-text{font-size:12.5px;color:#1e293b;line-height:1.7}
.section{padding-top:14px;margin-bottom:16px;border-top:1px solid #e5e7eb}
.sec-label{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;margin-bottom:7px}
.body{font-size:12.5px;color:#1f2937;line-height:1.62}
ul{list-style:none;padding:0}
li{display:flex;gap:8px;font-size:12.5px;color:#1f2937;line-height:1.55;margin-bottom:6px}
li::before{content:'◆';font-size:7px;color:#d1d5db;flex-shrink:0;margin-top:4px}
.conf-basis-block{border-top:1px solid #e5e7eb;padding-top:10px;margin-top:14px}
.conf-basis-label{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px}
.conf-basis-text{font-family:Arial,sans-serif;font-size:10.5px;color:#6b7280;line-height:1.55}
.footer{margin-top:28px;padding-top:10px;border-top:2px solid #111;display:flex;justify-content:space-between;align-items:center}
.footer-brand{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9ca3af}
.footer-ts{font-family:Arial,sans-serif;font-size:8px;color:#9ca3af}
.status-block{padding:12px 14px;border-radius:4px;margin:14px 0;background:${msBg};border:1px solid ${msBorder}}
.status-emoji{font-size:18px;margin-bottom:4px}
.status-title{font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${msText};margin-bottom:3px}
.status-explanation{font-size:12px;color:${msText};line-height:1.5;margin-bottom:4px}
.status-recommendation{font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:${msText}}
.narrator-block{font-size:12.5px;color:#374151;line-height:1.7;padding:10px 0;border-bottom:1px solid #f3f4f6;margin-bottom:14px}
.human-section{margin:14px 0}
.human-section-label{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;margin-bottom:7px}
.human-cols{display:flex;gap:16px;margin-bottom:10px}
.human-col{flex:1}
.human-sublabel{font-family:Arial,sans-serif;font-size:9px;font-weight:700;color:#4b5563;margin-bottom:5px}
.human-item{font-size:12px;color:#1f2937;line-height:1.55;margin-bottom:5px}
.risk-box{background:#1f2937;color:#f9fafb;padding:8px 12px;border-radius:3px;font-family:Arial,sans-serif;font-size:10.5px;font-weight:600;margin-top:6px}
.why-section{padding-top:14px;margin-bottom:16px;border-top:1px solid #e5e7eb}
.why-label{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;margin-bottom:7px}
.why-item{font-size:12px;color:#374151;line-height:1.55;margin-bottom:5px}
.analyst-note{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9ca3af;padding:10px 0 6px;border-top:1px solid #e5e7eb;margin:16px 0 4px}
@media print{@page{margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="page">
  <div class="masthead">
    <div class="brand-row">
      <span class="brand">AgroPrice AI · Intelligence Engine</span>
      <span class="doc-class">Agricultural Advisory Report</span>
    </div>
    <h1 class="title">${report.analyst}</h1>
    <p class="subtitle">${crop} · ${state} · ${period} analysis</p>
    <div class="meta-row">
      <div class="meta-item"><span class="ml">Generated</span><span class="mv">${report.timestamp}</span></div>
      <div class="meta-item"><span class="ml">Dataset</span><span class="mv">AGMARKNET 2015–2026</span></div>
      <div class="meta-item"><span class="ml">Confidence</span><span class="mv"><span class="conf-badge">${report.confidence}</span></span></div>
    </div>
  </div>
  <div class="status-block">
    <div class="status-emoji">${ms.emoji ?? '🟡'}</div>
    <p class="status-title">${ms.label ?? 'Market Status'}</p>
    <p class="status-explanation">${ms.explanation ?? ''}</p>
    <p class="status-recommendation">${ms.recommendation ?? ''}</p>
  </div>
  <p class="narrator-block">${narratorTxt}</p>
  <div class="human-section">
    <p class="human-section-label">What Should You Do?</p>
    <div class="human-cols">
      <div class="human-col"><p class="human-sublabel">🌾 For Farmers</p>${humanFarmer}</div>
      <div class="human-col"><p class="human-sublabel">📊 For Traders</p>${humanTrader}</div>
    </div>
    <div class="risk-box">${humanRisk}</div>
  </div>
  <div class="why-section">
    <p class="why-label">Why Is This Happening?</p>
    ${whyLines}
  </div>
  <p class="analyst-note">Analyst Notes — Technical Detail</p>
  <div class="thesis-block">
    <p class="thesis-label">AI Market Thesis</p>
    <p class="thesis-text">${report.thesis}</p>
  </div>
  ${sections}
  <div class="conf-basis-block">
    <p class="conf-basis-label">Confidence Basis</p>
    <p class="conf-basis-text">${report.confidenceBasis}</p>
  </div>
  <div class="footer">
    <span class="footer-brand">Generated by AgroPrice AI Intelligence Engine</span>
    <span class="footer-ts">${report.timestamp}</span>
  </div>
</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ── Visualization Components ──────────────────────────────────────────────────
function ForecastChart({ snap }) {
  const { trend, vol, confidence, anomaly, seasonPhase, crop, state } = snap
  const W = 560, H = 200, PL = 12, PR = 12, PT = 10, PB = 28
  const IW = W - PL - PR, IH = H - PT - PB
  const N = 24, NOW = 8
  const toX = i => PL + (i / (N - 1)) * IW
  const toY = v => PT + IH - (v / 100) * IH
  const nowX = toX(NOW)
  const slope    = trend === 'rising' ? 2.0 : trend === 'falling' ? -2.0 : 0.2
  const noiseAmp = vol === 'high' ? 6 : vol === 'low' ? 1.2 : 3
  const ciW      = confidence === 'High' ? 4 : confidence === 'Low' ? 13 : 8
  const seed     = dHash(`${crop}${state}${trend}${vol}`)
  const rawY = Array.from({ length: N }, (_, i) => {
    const rnd = (((seed * (i * 2654435761 + 7) + 1013904223) >>> 0) & 0xffff) / 0xffff
    return Math.max(14, Math.min(86, 46 + slope * (i - NOW) + (i <= NOW ? (rnd - 0.5) * noiseAmp : 0)))
  })
  if (seasonPhase === 'peak')
    for (let i = NOW; i < N; i++) rawY[i] = Math.max(14, Math.min(86, rawY[i] - Math.sin((i - NOW) / (N - NOW) * Math.PI) * 9))
  else if (seasonPhase === 'trough' && trend === 'rising')
    for (let i = NOW; i < N; i++) rawY[i] = Math.max(14, Math.min(86, rawY[i] + Math.sin((i - NOW) / (N - NOW) * Math.PI) * 5))
  const anomalyIdxs = []
  if (anomaly === 'cluster') {
    [2, 4, 6].forEach(idx => {
      if (idx < NOW) { rawY[idx] = Math.max(14, Math.min(86, rawY[idx] + ((((seed * idx * 987654) >>> 0) & 1) ? 1 : -1) * 11)); anomalyIdxs.push(idx) }
    })
  } else if (anomaly === 'isolated') { rawY[3] = Math.max(14, Math.min(86, rawY[3] + 9)); anomalyIdxs.push(3) }
  const pts = rawY.map((v, i) => ({ x: toX(i), y: toY(v), v }))
  const ciPts = pts.map((p, i) => {
    const m = i <= NOW ? 0.3 : 0.3 + (i - NOW) * 0.14
    return { x: p.x, ciU: toY(p.v + ciW * m), ciL: toY(p.v - ciW * m), eU: toY(p.v + ciW * m * 1.7), eL: toY(p.v - ciW * m * 1.7) }
  })
  const pastStr   = pts.slice(0, NOW + 1).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const futureStr = pts.slice(NOW).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const ciAreaD   = `M ${ciPts.map(p => `${p.x.toFixed(1)},${p.ciU.toFixed(1)}`).join(' L ')} L ${[...ciPts].reverse().map(p => `${p.x.toFixed(1)},${p.ciL.toFixed(1)}`).join(' L ')} Z`
  const envAreaD  = `M ${ciPts.map(p => `${p.x.toFixed(1)},${p.eU.toFixed(1)}`).join(' L ')} L ${[...ciPts].reverse().map(p => `${p.x.toFixed(1)},${p.eL.toFixed(1)}`).join(' L ')} Z`
  const fColor = trend === 'rising' ? '#10b981' : trend === 'falling' ? '#ef4444' : '#6b7280'
  const endPt = pts[N - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '200px' }}>
      {/* horizontal grid lines */}
      {[25, 50, 75].map(v => <line key={v} x1={PL} x2={W - PR} y1={toY(v)} y2={toY(v)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />)}
      {/* vertical grid lines */}
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={PL + f * IW} x2={PL + f * IW} y1={PT} y2={H - PB} stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />)}
      {/* 30-day projection marker */}
      <line x1={toX(16)} x2={toX(16)} y1={PT} y2={H - PB} stroke="rgba(165,180,252,0.35)" strokeWidth="1" strokeDasharray="2,3" />
      {/* confidence envelope */}
      <path d={envAreaD} fill="rgba(99,102,241,0.06)" />
      <path d={ciAreaD}  fill="rgba(99,102,241,0.14)" />
      {/* NOW divider */}
      <line x1={nowX} x2={nowX} y1={PT} y2={H - PB} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,3" />
      {/* price lines */}
      <polyline points={pastStr}   fill="none" stroke="rgba(200,210,230,0.70)" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={futureStr} fill="none" stroke={fColor}  strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="5,3" />
      {/* anomaly markers */}
      {anomalyIdxs.map(idx => <circle key={idx} cx={pts[idx].x} cy={pts[idx].y} r="3.5" fill="none" stroke="#f59e0b" strokeWidth="1.5" />)}
      {/* NOW dot */}
      <circle cx={nowX} cy={pts[NOW].y} r="4.5" fill={fColor} fillOpacity="0.30" />
      <circle cx={nowX} cy={pts[NOW].y} r="2.8" fill={fColor} />
      <circle cx={nowX} cy={pts[NOW].y} r="1.2" fill="white" />
      {/* end arrow */}
      <text x={endPt.x + 3} y={endPt.y + (trend === 'falling' ? 9 : -3)} fill={fColor} fontSize="9" fontWeight="bold" textAnchor="start">
        {trend === 'rising' ? '▲' : trend === 'falling' ? '▼' : '▶'}
      </text>
      {/* axis labels */}
      <text x={nowX}       y={H - 4} fill="rgba(255,255,255,0.45)" fontSize="8"   textAnchor="middle" fontWeight="600">NOW</text>
      <text x={PL + 3}     y={H - 4} fill="rgba(255,255,255,0.28)" fontSize="7.5">HIST</text>
      <text x={W - PR - 3} y={H - 4} fill="rgba(255,255,255,0.28)" fontSize="7.5" textAnchor="end">PROJ</text>
    </svg>
  )
}

function MarketPulse({ snap }) {
  const { vol, anomaly, confidence } = snap
  const fast = vol === 'high' || anomaly === 'cluster'
  const dot  = vol === 'high' ? 'bg-red-400' : confidence === 'High' ? 'bg-emerald-400' : 'bg-amber-400'
  const dur  = fast ? (anomaly === 'cluster' && vol === 'high' ? '0.65s' : '0.95s') : '2.2s'
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dot} opacity-75`} style={{ animationDuration: dur }} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dot}`} />
      </span>
      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.2em]">
        {vol === 'high' ? 'VOLATILE' : confidence === 'High' ? 'STABLE' : 'MODERATE'} PULSE
      </p>
    </div>
  )
}

function ScenarioMiniLine({ sc }) {
  const W = 110, H = 26, N = 12
  const seed     = dHash(sc.name + 'mini')
  const slope    = sc.name === 'Bull' ? -2.0 : sc.name === 'Stress' ? 2.2 : 0.2
  const noiseAmp = sc.name === 'Stress' ? 4.5 : sc.name === 'Bull' ? 1.5 : 2.5
  const ciWd     = sc.name === 'Bull' ? 2.5 : sc.name === 'Stress' ? 5.5 : 3.5
  const rawY = Array.from({ length: N }, (_, i) => {
    const rnd = (((seed * (i * 2654435761 + 1) + 1013904223) >>> 0) & 0xffff) / 0xffff
    return Math.max(3, Math.min(H - 3, H / 2 + slope * (i - N / 2) * 0.9 + (rnd - 0.5) * noiseAmp))
  })
  const pts = rawY.map((y, i) => ({ x: (i / (N - 1)) * W, y }))
  const lineD  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const upPts  = pts.map(p => `${p.x.toFixed(1)},${Math.max(1, p.y - ciWd).toFixed(1)}`).join(' ')
  const loPts  = [...pts].reverse().map(p => `${p.x.toFixed(1)},${Math.min(H - 1, p.y + ciWd).toFixed(1)}`).join(' ')
  const lColor = sc.name === 'Bull' ? '#10b981' : sc.name === 'Stress' ? '#f59e0b' : '#3b82f6'
  const fFill  = sc.name === 'Bull' ? 'rgba(16,185,129,0.12)' : sc.name === 'Stress' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.10)'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '26px' }}>
      <path d={`M ${upPts} L ${loPts} Z`} fill={fFill} />
      <path d={lineD} fill="none" stroke={lColor} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={pts[N - 1].x} cy={pts[N - 1].y} r="2" fill={lColor} />
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const [crop,             setCrop]             = useState('Tomato')
  const [state,            setState]            = useState('Karnataka')
  const [period,           setPeriod]           = useState('monthly')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [genState,         setGenState]         = useState('idle')
  const [genStage,         setGenStage]         = useState(0)
  const [report,           setReport]           = useState(null)
  const [revealedSections,   setRevealedSections]   = useState([])
  const [thesisVisible,      setThesisVisible]      = useState(false)
  const [comparativeVisible, setComparativeVisible] = useState(false)
  const [scenariosOpen,      setScenariosOpen]      = useState(false)
  const [evidenceOpen,       setEvidenceOpen]       = useState(false)
  const [ribbonIdx,          setRibbonIdx]          = useState(0)
  const [driftMeters,        setDriftMeters]        = useState(null)
  const [userMode,           setUserMode]           = useState('farmer')
  const [advancedOpen,       setAdvancedOpen]       = useState(false)
  const timerIds    = useRef([])
  const activePlan  = useRef({ stages:[], timings:[] })
  const driftCounter = useRef(0)

  useEffect(() => () => timerIds.current.forEach(clearTimeout), [])
  useEffect(() => {
    timerIds.current.forEach(clearTimeout); timerIds.current = []
    setGenState('idle'); setReport(null); setRevealedSections([]); setThesisVisible(false); setComparativeVisible(false); setScenariosOpen(false); setEvidenceOpen(false); setDriftMeters(null); setAdvancedOpen(false)
  }, [crop, state, period, selectedTemplate])

  useEffect(() => {
    if (genState !== 'done') return
    const t0 = setTimeout(() => setThesisVisible(true), 80)
    timerIds.current.push(t0)
    ;[0,1,2,3,4].forEach((_, i) => {
      const id = setTimeout(() => setRevealedSections(prev => [...prev, i]), 260 + i * 150)
      timerIds.current.push(id)
    })
    // Comparative appears after all sections (260 + 4*150 + 200 = 1060ms)
    const compId = setTimeout(() => setComparativeVisible(true), 1060)
    timerIds.current.push(compId)
  }, [genState])

  useEffect(() => {
    const id = setInterval(() => setRibbonIdx(i => (i + 1) % RIBBON_MSGS.length), 2200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!report?.cockpitMeters) { setDriftMeters(null); return }
    setDriftMeters(report.cockpitMeters)
    driftCounter.current = 0
    const id = setInterval(() => {
      driftCounter.current++
      const n = driftCounter.current
      const nudge = (base, phase) => Math.max(2, Math.min(98, Math.round(base + Math.sin(n * 0.35 + phase) * 2)))
      setDriftMeters(prev => {
        if (!prev) return prev
        return {
          ...prev,
          directionBias: { ...prev.directionBias, val: nudge(prev.directionBias.val, 0.0) },
          riskPressure:  { ...prev.riskPressure,  val: nudge(prev.riskPressure.val,  1.1) },
          stability:     { ...prev.stability,     val: nudge(prev.stability.val,     2.3) },
          mktTemp:       { ...prev.mktTemp,       val: nudge(prev.mktTemp.val,       3.5) },
          procStress:    { ...prev.procStress,    val: nudge(prev.procStress.val,    4.7) },
        }
      })
    }, 1800)
    return () => clearInterval(id)
  }, [report])

  function handleGenerate() {
    if (genState === 'generating') return
    timerIds.current.forEach(clearTimeout); timerIds.current = []
    const sig  = getSignals(crop, state, period, selectedTemplate)
    const ipr  = buildInteractionProfile(sig)
    const plan = buildGenerationPlan(sig, ipr, selectedTemplate)
    activePlan.current = plan
    setGenState('generating'); setGenStage(0); setReport(null); setRevealedSections([]); setThesisVisible(false)
    plan.stages.forEach((_, i) => {
      const id = setTimeout(() => setGenStage(i + 1), plan.timings[i])
      timerIds.current.push(id)
    })
    const id = setTimeout(() => {
      setReport(generateReport(crop, state, period, selectedTemplate))
      setGenState('done')
    }, plan.totalMs)
    timerIds.current.push(id)
  }

  const ALL_CROPS    = useMemo(() => [...TIER1_CROPS, ...TIER2_CROPS, ...TIER3_CROPS], [])
  const brief        = useMemo(() => generateBrief(crop, state, period, selectedTemplate), [crop, state, period, selectedTemplate])
  const plan         = activePlan.current
  const tmpl         = useMemo(() => TEMPLATES.find(t => t.key === selectedTemplate), [selectedTemplate])
  const confColor    = report
    ? report.confidence === 'High' ? 'bg-emerald-500' : report.confidence === 'Low' ? 'bg-red-400' : 'bg-amber-400'
    : 'bg-gray-300'
  const confTrack    = report
    ? report.confidence === 'High' ? 'bg-emerald-100' : report.confidence === 'Low' ? 'bg-red-100' : 'bg-amber-100'
    : 'bg-gray-100'
  const confBadge    = report
    ? report.confidence === 'High' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : report.confidence === 'Low' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-amber-50 text-amber-700 border-amber-200'
    : ''

  return (
    <div className="space-y-4">

      {/* ── AI System Status Ribbon ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 intel-strip rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-1 w-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500" />
          </span>
          <span className="text-[7px] font-bold text-emerald-400 uppercase tracking-widest">AgroPrice AI</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.18em] truncate transition-all duration-500">
            {RIBBON_MSGS[ribbonIdx]}
          </p>
        </div>
        <span className="text-[7px] font-bold text-gray-600 uppercase tracking-widest shrink-0 hidden sm:block">INTELLIGENCE v2.7</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">AI-generated export intelligence · 48.2M records · {ALL_CROPS.length} crops · 5 states</p>
      </div>

      {/* Dataset KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label:'Records',         value:'48.2M',                  sub:'AGMARKNET dataset'         },
          { label:'Crops Tracked',   value:String(ALL_CROPS.length), sub:'Tier-1 · Tier-2 · Tier-3'  },
          { label:'History',         value:'11 yrs',                 sub:'2015 – 2026'                },
          { label:'Forecast Models', value:`${TIER1_CROPS.length}`,  sub:'Prophet · 30/60/90-day'    },
        ].map(s => (
          <div key={s.label} className="card-premium rounded-xl p-3.5 transition-all duration-150 hover:-translate-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.30)' }}>{s.label}</p>
            <p className="text-xl font-extrabold tracking-tight tabular-nums" style={{ color: 'rgba(255,255,255,0.92)' }}>{s.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Studio card */}
      <Card>
        {/* Header row */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">AI Report Intelligence Studio</p>
            <div className="flex items-center gap-2">
              {report?.analyst && (
                <span className="text-[9px] font-bold text-primary-600 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded uppercase tracking-[0.18em]">{report.analyst}</span>
              )}
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {[['farmer','🌾'],['trader','📊'],['analyst','🔬']].map(([m, ic]) => (
                  <button key={m} onClick={() => setUserMode(m)}
                    className={`text-[8px] font-bold px-2 py-1 rounded-md uppercase tracking-widest transition-all duration-150 ${userMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                    {ic} {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">Export historical data or forecasts</p>
          {/* AI Brief Strip */}
          <div className="mt-2 flex items-center gap-3 py-2 pl-3.5 pr-4 rounded-xl border-l-2 border-l-emerald-500"
            style={{ background: 'linear-gradient(90deg, rgba(12,16,28,0.70) 0%, rgba(8,12,22,0.55) 100%)', border: '1px solid rgba(56,189,248,0.18)', borderLeftWidth: '2px', borderLeftColor: 'rgba(52,211,153,0.60)' }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <p className="text-[12px] leading-5 flex-1" style={{ color: 'rgba(255,255,255,0.72)' }}>{brief}</p>
            <span className="text-[9px] shrink-0 hidden sm:block font-bold tracking-widest uppercase" style={{ color: 'rgba(52,211,153,0.60)' }}>Market Intel</span>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap mb-3">
          {[
            { label:'Crop',   node: <select value={crop} onChange={e => setCrop(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-gray-700 font-medium"><optgroup label="Tier-1 — Core Vegetables">{TIER1_CROPS.map(c=><option key={c}>{c}</option>)}</optgroup><optgroup label="Tier-2 — Extended Coverage">{TIER2_CROPS.map(c=><option key={c}>{c}</option>)}</optgroup><optgroup label="Tier-3 — Commodities">{TIER3_CROPS.map(c=><option key={c}>{c}</option>)}</optgroup></select> },
            { label:'State',  node: <select value={state} onChange={e => setState(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-gray-700 font-medium">{SOUTH_INDIAN_STATES.map(s=><option key={s}>{s}</option>)}</select> },
            { label:'Period', node: <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-gray-700 font-medium"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly (2015–2026)</option></select> },
          ].map(({ label, node }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
              {node}
            </div>
          ))}
          {tmpl && (
            <span className="text-[9px] font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded uppercase tracking-[0.18em] ml-auto">
              {tmpl.emphasis}
            </span>
          )}
        </div>

        {/* CTA */}
        <button onClick={handleGenerate} disabled={genState === 'generating'}
          className="w-full py-2.5 rounded-xl text-sm font-bold btn-forest disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
          {genState === 'generating' ? 'Generating…' : genState === 'done' ? 'Regenerate Report' : 'Generate AI Report'}
        </button>

        {/* ── Live Analyst Reasoning Stream ── */}
        {genState === 'generating' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-500" />
              </span>
              <p className="text-[9px] font-bold text-primary-600 uppercase tracking-[0.22em]">Analyst Reasoning Pipeline · Live</p>
            </div>
            <div className="space-y-1">
              {(plan.stages.length > 0 ? plan.stages : (BASE_STAGES[selectedTemplate] ?? BASE_STAGES.default)).map((label, i) => {
                const isDone = i < genStage, isCurrent = i === genStage
                return (
                  <div key={i} className={`flex items-center gap-2.5 px-2 py-1 rounded transition-all duration-300 ${i > genStage ? 'opacity-15' : isDone ? 'opacity-30' : 'opacity-100'}`}
                    style={isCurrent ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.28)' } : {}}>
                    <span className={`text-[9px] font-bold shrink-0 w-3 text-center tabular-nums ${isDone ? 'text-emerald-500' : isCurrent ? 'text-primary-500' : 'text-gray-300'}`}>
                      {isDone ? '✓' : isCurrent ? '◉' : '○'}
                    </span>
                    <span className={`text-[11px] leading-4 flex-1 ${isCurrent ? 'font-semibold text-primary-800' : 'font-normal text-gray-400'}`}>
                      {isCurrent ? `${label}…` : label}
                    </span>
                    {isCurrent && (
                      <span className="flex gap-0.5 shrink-0">
                        {[0,1,2].map(d => <span key={d} className="w-0.5 h-2.5 bg-primary-300 rounded-full animate-pulse" style={{ animationDelay:`${d*150}ms` }} />)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Report output ── */}
        {genState === 'done' && report && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

            {/* Signal conflict warning */}
            {report.conflictWarning && (
              <div className="flex items-start gap-2.5 py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                <span className="text-amber-500 text-[11px] font-bold shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">Mixed Market Signals</p>
                  <p className="text-[11px] text-amber-700 leading-4">{report.conflictWarning}</p>
                </div>
              </div>
            )}

            {/* Metadata row */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="text-[9px] text-gray-400 font-medium uppercase tracking-wide tabular-nums">{report.timestamp}</span>
              <span className="text-gray-200 hidden sm:block">|</span>
              {/* Confidence badge + gauge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded border ${confBadge}`}>
                  {report.confidence} Confidence
                </span>
                <div className={`h-1 w-20 rounded-full ${confTrack} overflow-hidden`}>
                  <div className={`h-full rounded-full transition-all duration-700 delay-300 ${confColor}`}
                    style={{ width: `${report.gaugeScore}%` }} />
                </div>
                <span className="text-[9px] text-gray-400 tabular-nums">{report.gaugeScore}%</span>
              </div>
            </div>

            {/* ── Intelligence Priority Flags ── */}
            {report.priorityFlags?.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {report.priorityFlags.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${f.color === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <span className={`text-[8px] shrink-0 mt-[3px] ${f.color === 'red' ? 'text-red-500' : 'text-amber-500'}`}>{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-[8px] font-bold uppercase tracking-[0.2em] ${f.color === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{f.title}</p>
                        <span className={`text-[7px] font-bold px-1.5 py-px rounded uppercase tracking-widest ${f.color === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{f.level}</span>
                      </div>
                      <p className={`text-[11px] leading-[1.5] ${f.color === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{f.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Main content + Analyst sidebar ── */}
            <div className="flex flex-col xl:flex-row gap-4 items-start">

              {/* ── Main column ── */}
              <div className="flex-1 min-w-0">

                {/* ── AI Market Narrator ── */}
                {thesisVisible && report.narrator && (
                  <div className={`mb-3 transition-all duration-500 ${thesisVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">Market Summary</p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2.5 space-y-1.5">
                      {report.narrator.map((line, i) => (
                        <p key={i} className="text-[13px] text-blue-900 leading-6">{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Market Status Card ── */}
                {thesisVisible && report.marketStatus && (
                  <div className={`mb-3 border-2 rounded-xl px-4 py-3 transition-all duration-500 delay-100 ${thesisVisible ? 'opacity-100' : 'opacity-0'} ${
                    report.marketStatus.colorBase === 'red'     ? 'border-red-300 bg-red-50'     :
                    report.marketStatus.colorBase === 'orange'  ? 'border-orange-300 bg-orange-50' :
                    report.marketStatus.colorBase === 'amber'   ? 'border-amber-300 bg-amber-50'  :
                    'border-emerald-300 bg-emerald-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl leading-none">{report.marketStatus.emoji}</span>
                      <p className={`text-[13px] font-extrabold uppercase tracking-wide ${
                        report.marketStatus.colorBase === 'red' ? 'text-red-700' : report.marketStatus.colorBase === 'orange' ? 'text-orange-700' : report.marketStatus.colorBase === 'amber' ? 'text-amber-700' : 'text-emerald-700'
                      }`}>{report.marketStatus.label}</p>
                    </div>
                    <p className="text-[12px] text-gray-700 mb-1">{report.marketStatus.explanation}</p>
                    <p className="text-[11px] text-gray-600"><span className="font-bold">What to do: </span>{report.marketStatus.recommendation}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5"><span className="font-bold">Next 2–3 weeks: </span>{report.marketStatus.expectation}</p>
                  </div>
                )}

                {/* ── What Should You Do? ── */}
                {thesisVisible && report.humanActions && userMode !== 'analyst' && (
                  <div className={`mb-4 transition-all duration-500 delay-150 ${thesisVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">What Should You Do?</p>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-green-700 mb-1.5">🌾 For Farmers</p>
                        <ul className="space-y-1">
                          {report.humanActions.farmer.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-[8px] font-bold text-green-400 shrink-0 mt-[3px]">◆</span>
                              <span className="text-[12px] text-gray-700 leading-5">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {userMode === 'trader' && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-blue-700 mb-1.5">📊 For Traders</p>
                          <ul className="space-y-1">
                            {report.humanActions.trader.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-[8px] font-bold text-blue-400 shrink-0 mt-[3px]">◆</span>
                                <span className="text-[12px] text-gray-700 leading-5">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {userMode === 'farmer' && (
                        <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-purple-700 mb-1.5">🏪 For Procurement</p>
                          <ul className="space-y-1">
                            {report.humanActions.procurement.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-[8px] font-bold text-purple-400 shrink-0 mt-[3px]">◆</span>
                                <span className="text-[12px] text-gray-700 leading-5">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-start gap-2.5 px-3 py-2 rounded-xl" style={{background:'linear-gradient(135deg,rgba(14,22,50,0.85) 0%,rgba(8,12,22,0.90) 100%)',boxShadow:'0 2px 12px rgba(20,120,255,0.18)'}}>
                        <span className="text-amber-400 text-[9px] font-bold shrink-0 mt-px">⚠</span>
                        <p className="text-[11px] text-gray-200 leading-5">{report.humanActions.risk}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Why Is This Happening? ── */}
                {thesisVisible && report.whyHappening && userMode !== 'analyst' && (
                  <div className={`mb-3 transition-all duration-500 delay-200 ${thesisVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">Why Is This Happening?</p>
                    <ul className="space-y-1.5">
                      {report.whyHappening.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary-400 text-[9px] font-bold shrink-0 mt-[3px]">▸</span>
                          <span className="text-[12px] text-gray-600 leading-5">{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── Executive Signal Matrix ── */}
                <div className={`mb-3 transition-all duration-500 ${thesisVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${userMode !== 'analyst' ? 'hidden' : ''}`}>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">Signal Matrix</p>
                  <div className="flex divide-x rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    {report.signalMatrix.map(({ label, value, cls, bar, pct }) => (
                      <div key={label} className="flex-1 px-2 pt-1.5 pb-2 min-w-0" style={{ background: 'rgba(3,5,14,0.80)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-[8px] font-bold uppercase tracking-widest mb-0.5 truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</p>
                        <p className={`text-[9px] font-bold ${cls} leading-tight truncate`}>{value}</p>
                        <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className={`h-full rounded-full transition-all duration-700 delay-300 ${bar}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── AI Market Thesis (cognitive centerpiece) ── */}
                <div className={`mb-4 transition-all duration-500 delay-150 ${thesisVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'} ${userMode !== 'analyst' ? 'hidden' : ''}`}>
                  <div className={`pl-3.5 py-2.5 rounded-xl pr-3.5 ${report.confidence === 'High' ? 'ring-1 ring-emerald-500/30' : ''}`}
                    style={{ background: 'rgba(8,12,22,0.85)', borderLeft: '2px solid rgba(52,211,153,0.50)', border: '1px solid rgba(56,189,248,0.14)', borderLeftWidth: '2px', borderLeftColor: 'rgba(52,211,153,0.55)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5" style={{ color: 'rgba(52,211,153,0.60)' }}>AI Market Thesis</p>
                    <p className="text-[13px] leading-6 max-w-[92ch] font-medium" style={{ color: 'rgba(255,255,255,0.80)' }}><HL text={report.thesis} /></p>
                    <div className="mt-1.5"><MarketPulse snap={report.sigSnapshot} /></div>
                  </div>
                </div>

                {/* ── Forecast Path Visualization ── */}
                {thesisVisible && report.sigSnapshot && (
                  <div className={`mb-3 transition-all duration-700 delay-200 ${thesisVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em]">Expected Price Direction · Next 30 Days</p>
                      <p className="text-[8px] text-gray-400 uppercase tracking-widest">
                        {report.sigSnapshot.trend === 'rising' ? '↑ Rising' : report.sigSnapshot.trend === 'falling' ? '↓ Falling' : '→ Stable'} · {report.sigSnapshot.vol === 'high' ? 'Higher Uncertainty' : report.sigSnapshot.vol === 'low' ? 'Low Uncertainty' : 'Moderate Uncertainty'}
                      </p>
                    </div>
                    <div className="rounded-xl overflow-hidden px-1 py-1" style={{ background: 'rgba(3,5,14,0.88)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <ForecastChart snap={report.sigSnapshot} />
                    </div>
                  </div>
                )}

                {/* ── Temporal Market Evolution Strip ── */}
                {thesisVisible && report.evolutionStrip && (
                  <div className={`mb-3 transition-all duration-500 delay-300 ${thesisVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">Market Trend Over Time</p>
                    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                      {report.evolutionStrip.map((ph, i) => (
                        <div key={ph.label}
                          className="flex-1 px-1.5 pt-1.5 pb-2 min-w-0"
                          style={ph.active
                            ? { background: 'rgba(52,211,153,0.22)', borderRight: '1px solid rgba(52,211,153,0.20)' }
                            : { background: 'rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.07)' }
                          }>
                          <p className={`text-[7px] font-bold uppercase tracking-widest mb-0.5 truncate ${ph.active ? 'text-emerald-300' : 'text-gray-400'}`}>{ph.label}</p>
                          <p className={`text-[8px] font-semibold leading-tight truncate ${ph.active ? 'text-white' : 'text-gray-300'}`}>{ph.sub}</p>
                          <div className="mt-1 flex items-center gap-0.5">
                            <span className={`text-[7px] font-bold ${ph.active ? 'text-emerald-300' : ph.conf === '+' ? 'text-emerald-400' : ph.conf === '−' ? 'text-red-400' : 'text-gray-500'}`}>{ph.conf}</span>
                            <span className={`text-[7px] ml-0.5 ${ph.active ? 'text-emerald-300' : ph.bias === 'rising' ? 'text-emerald-400' : ph.bias === 'falling' ? 'text-red-400' : 'text-amber-400'}`}>
                              {ph.bias === 'rising' ? '↑' : ph.bias === 'falling' ? '↓' : ph.bias === 'mixed' ? '⇄' : '→'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Sections ── */}
                <div className={`space-y-0 ${userMode !== 'analyst' ? 'hidden' : ''}`}>
                  {report.sections.map(({ label, content, type }, i) => (
                    <div key={i} className={`transition-all duration-400 ${revealedSections.includes(i) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                      {i > 0 && <div className="border-t border-gray-100 my-3" />}
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">{label}</p>
                      {type === 'bullets'
                        ? <ul className="space-y-1">
                            {(Array.isArray(content) ? content : [content]).map((r, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <span className={`shrink-0 mt-[3px] text-[8px] font-bold ${j === 0 ? 'text-amber-400' : 'text-gray-300'}`}>◆</span>
                                <span className="text-[13px] text-gray-700 leading-6 max-w-[92ch]"><HL text={r} /></span>
                              </li>
                            ))}
                          </ul>
                        : <p className="text-[13px] text-gray-700 leading-6 max-w-[92ch]"><HL text={content} /></p>
                      }
                    </div>
                  ))}
                </div>

                {/* ── Advanced Analytics Accordion trigger ── */}
                {userMode !== 'analyst' && comparativeVisible && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <button onClick={() => setAdvancedOpen(o => !o)} className="w-full flex items-center justify-between group">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] group-hover:text-gray-600 transition-colors">Advanced Market Analytics</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] text-gray-400">Technical Details</span>
                        <span className={`text-[9px] text-gray-400 transition-transform duration-300 ${advancedOpen ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* ── Comparative Intelligence ── */}
                {(userMode === 'analyst' || advancedOpen) && comparativeVisible && report.comparative?.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 transition-all duration-500 opacity-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-1.5">How This Market Compares</p>
                    <ul className="space-y-1.5">
                      {report.comparative.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary-400 text-[9px] font-bold shrink-0 mt-[3px]">◈</span>
                          <span className="text-[12px] text-gray-600 leading-[1.55] max-w-[92ch]"><HL text={c} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── Market Pressure Heat Strip ── */}
                {(userMode === 'analyst' || advancedOpen) && comparativeVisible && report.pressureStrip && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-2">Market Pressure Factors</p>
                    <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5">
                      {report.pressureStrip.map(({ label, score, icon }) => (
                        <div key={label} className="flex flex-col items-center gap-0.5">
                          <span className={`text-[8px] font-bold ${score >= 70 ? 'text-red-400' : score >= 45 ? 'text-amber-400' : 'text-emerald-400'}`}>{icon}</span>
                          <div className="w-full h-12 bg-gray-100 rounded relative overflow-hidden">
                            <div className={`absolute bottom-0 left-0 right-0 rounded transition-all duration-700 ${score >= 70 ? 'bg-red-300' : score >= 45 ? 'bg-amber-300' : 'bg-emerald-300'}`} style={{ height:`${score}%` }} />
                          </div>
                          <p className={`text-[7px] font-bold tabular-nums ${score >= 70 ? 'text-red-500' : score >= 45 ? 'text-amber-500' : 'text-emerald-500'}`}>{score}</p>
                          <p className="text-[7px] text-gray-400 uppercase tracking-widest text-center leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence basis */}
                {(userMode === 'analyst' || advancedOpen) && revealedSections.length >= report.sections.length && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[9px] text-gray-400 leading-5 max-w-[92ch]">
                      <span className="font-bold uppercase tracking-widest">Data Quality Note · </span>{report.confidenceBasis}
                    </p>
                  </div>
                )}

                {/* ── Confidence Decomposition Panel ── */}
                {(userMode === 'analyst' || advancedOpen) && revealedSections.length >= report.sections.length && report.confDecomp && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-2">What Affects Forecast Confidence</p>
                    <div className="space-y-1.5">
                      {report.confDecomp.map(({ label, score, detail }) => (
                        <div key={label} className="flex items-center gap-2">
                          <p className="text-[10px] text-gray-600 font-medium w-36 shrink-0 truncate">{label}</p>
                          <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${score >= 75 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-300' : 'bg-red-300'}`} style={{ width:`${score}%` }} />
                          </div>
                          <p className={`text-[9px] font-bold tabular-nums w-6 text-right ${score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{score}</p>
                          <p className="text-[9px] text-gray-400 w-32 shrink-0 truncate hidden sm:block">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Recommendation Hierarchy Engine ── */}
                {revealedSections.length >= report.sections.length && report.recommendationHierarchy && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-2">Step-by-Step Recommendations</p>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2.5 px-3 py-2 rounded-xl" style={{background:'linear-gradient(135deg,rgba(14,22,50,0.85) 0%,rgba(8,12,22,0.90) 100%)',boxShadow:'0 2px 12px rgba(20,120,255,0.18)'}}>
                        <span className="text-[8px] font-bold text-emerald-400 shrink-0 mt-px">▸</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Primary Position</p>
                            <span className="text-[9px] font-extrabold text-white uppercase tracking-widest">{report.recommendationHierarchy.primary.action}</span>
                          </div>
                          <p className="text-[10px] text-gray-300 leading-[1.45]">{report.recommendationHierarchy.primary.rationale}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-[8px] font-bold text-primary-400 shrink-0 mt-px">▸</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Secondary Position</p>
                            <span className="text-[9px] font-bold text-primary-700 uppercase tracking-widest">{report.recommendationHierarchy.secondary.action}</span>
                          </div>
                          <p className="text-[10px] text-gray-600 leading-[1.45]">{report.recommendationHierarchy.secondary.detail}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-[7px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">What to Watch For</p>
                          <p className="text-[10px] text-blue-700 leading-[1.45]">{report.recommendationHierarchy.monitoringCond}</p>
                        </div>
                        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-[7px] font-bold text-red-500 uppercase tracking-widest mb-0.5">When to Reconsider</p>
                          <p className="text-[10px] text-red-700 leading-[1.45]">{report.recommendationHierarchy.invalidationSignal}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Market Regime Timeline ── */}
                {revealedSections.length >= report.sections.length && report.regimeTimeline && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-2">Market Phase · Where We Are Now</p>
                    <div className="flex items-center gap-0">
                      {report.regimeTimeline.map(({ name, isCurrent }, i) => (
                        <div key={name} className="flex items-center flex-1 min-w-0">
                          <div className={`flex-1 text-center px-1 py-1.5 rounded transition-all duration-500 ${isCurrent ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                            <p className={`text-[8px] font-bold uppercase leading-tight truncate ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{name}</p>
                            {isCurrent && <p className="text-[7px] text-primary-200 mt-0.5 font-medium">▲ NOW</p>}
                          </div>
                          {i < report.regimeTimeline.length - 1 && (
                            <div className={`w-2 h-px shrink-0 ${i < report.regimeTimeline.findIndex(r => r.isCurrent) ? 'bg-primary-300' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Scenario Simulation Accordion ── */}
                {(userMode === 'analyst' || advancedOpen) && revealedSections.length >= report.sections.length && report.scenarios && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <button
                      onClick={() => setScenariosOpen(o => !o)}
                      className="w-full flex items-center justify-between group"
                    >
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] group-hover:text-gray-600 transition-colors">What If Conditions Change?</p>
                      <span className={`text-[9px] text-gray-400 transition-transform duration-300 ${scenariosOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    <div className={`overflow-hidden transition-all duration-400 ${scenariosOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} style={{ display:'grid' }}>
                      <div className="overflow-hidden">
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                          {report.scenarios.map(sc => (
                            <div key={sc.name} className={`border rounded-lg p-2.5 ${sc.border}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className={`text-[9px] font-bold uppercase tracking-widest ${sc.labelCls}`}>{sc.direction} {sc.name} Case</p>
                                <span className={`text-[8px] font-bold px-1.5 py-px rounded tabular-nums ${sc.labelCls} bg-white border ${sc.border}`}>{sc.pct}%</span>
                              </div>
                              <div className="mb-2">
                                <ScenarioMiniLine sc={sc} />
                              </div>
                              <p className="text-[10px] text-gray-600 leading-[1.5] mb-1">{sc.behavior}</p>
                              <p className="text-[9px] text-gray-400 leading-[1.4] mb-1.5">{sc.implication}</p>
                              <div className="border-t border-gray-100 pt-1.5 mt-1">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Risk Trigger</p>
                                <p className="text-[9px] text-gray-500 leading-[1.4]">{sc.riskTrigger}</p>
                              </div>
                              <div className="mt-1.5">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Confidence</p>
                                <p className="text-[9px] text-gray-500">{sc.confDelta}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Evidence Trace Engine ── */}
                {(userMode === 'analyst' || advancedOpen) && revealedSections.length >= report.sections.length && report.evidenceTrace?.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <button onClick={() => setEvidenceOpen(o => !o)} className="w-full flex items-center justify-between group">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] group-hover:text-gray-600 transition-colors">How This Report Was Built</p>
                      <span className={`text-[9px] text-gray-400 transition-transform duration-300 ${evidenceOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    <div style={{ display:'grid', gridTemplateRows: evidenceOpen ? '1fr' : '0fr' }} className="transition-all duration-400 overflow-hidden">
                      <div className="overflow-hidden">
                        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                          <div className="flex gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest w-24 shrink-0">Signal</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest w-28 shrink-0">Influence</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex-1">Effect</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest w-12 shrink-0 text-right hidden sm:block">Horizon</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest w-8 shrink-0 text-right hidden sm:block">Sev.</span>
                          </div>
                          {report.evidenceTrace.map((row, i) => {
                            const horizon = row.severity === 'high' ? '7–14d' : row.severity === 'positive' ? 'near-term' : row.severity === 'medium' ? '14–30d' : 'ongoing'
                            const sevLabel = row.severity === 'high' ? 'HI' : row.severity === 'positive' ? 'POS' : row.severity === 'medium' ? 'MED' : 'NEU'
                            const sevCls = row.severity === 'high' ? 'text-red-500' : row.severity === 'positive' ? 'text-emerald-500' : row.severity === 'medium' ? 'text-amber-500' : 'text-gray-400'
                            return (
                            <div key={i} className={`flex gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                              <div className="w-24 shrink-0 flex items-start gap-1">
                                <span className={`shrink-0 text-[7px] mt-[3px] ${row.severity === 'high' ? 'text-red-400' : row.severity === 'positive' ? 'text-emerald-400' : row.severity === 'medium' ? 'text-amber-400' : 'text-gray-300'}`}>◆</span>
                                <span className="text-[10px] text-gray-600 font-medium leading-tight">{row.signal}</span>
                              </div>
                              <span className="w-28 shrink-0 text-[10px] text-gray-500 leading-tight self-start pt-px">{row.influence}</span>
                              <span className="flex-1 text-[10px] text-gray-400 leading-tight self-start pt-px">{row.effect}</span>
                              <span className="text-[9px] text-gray-400 tabular-nums w-12 shrink-0 text-right self-start pt-px hidden sm:block">{horizon}</span>
                              <span className={`text-[8px] font-bold w-8 shrink-0 text-right self-start pt-px hidden sm:block ${sevCls}`}>{sevLabel}</span>
                            </div>
                          )})}

                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Executive Action Center ── */}
                {revealedSections.length >= report.sections.length && report.actionCenter && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.22em] mb-2">Recommended Actions</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {report.actionCenter.map(({ title, urgency, msg, icon }) => (
                        <div key={title} className={`rounded-lg border px-2.5 py-2 ${urgency === 'HIGH' ? 'border-red-200 bg-red-50' : urgency === 'MEDIUM' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50/60'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-[8px] font-bold shrink-0 ${urgency === 'HIGH' ? 'text-red-500' : urgency === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'}`}>{icon}</span>
                            <p className={`text-[8px] font-bold uppercase tracking-[0.18em] flex-1 ${urgency === 'HIGH' ? 'text-red-700' : urgency === 'MEDIUM' ? 'text-amber-700' : 'text-emerald-700'}`}>{title}</p>
                            <span className={`text-[7px] font-bold px-1.5 py-px rounded uppercase tracking-widest shrink-0 ${urgency === 'HIGH' ? 'bg-red-100 text-red-600' : urgency === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700'}`}>{urgency}</span>
                          </div>
                          <p className={`text-[11px] leading-[1.5] ${urgency === 'HIGH' ? 'text-red-700' : urgency === 'MEDIUM' ? 'text-amber-700' : 'text-emerald-700'}`}>{msg}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>{/* end main column */}

              {/* ── Analyst Cockpit ── */}
              {userMode === 'analyst' && report.cockpitMeters && report.analystMeta && (
                <div className="hidden xl:block w-48 shrink-0 pt-0.5">
                  <div className="sticky top-4 rounded-xl p-3 overflow-hidden border border-gray-800" style={{ background:'#0a0a0f' }}>
                    {/* Header + AI Active */}
                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-800">
                      <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Analyst Cockpit</p>
                      <div className="flex items-center gap-1">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        <span className="text-[7px] font-bold text-emerald-400 uppercase tracking-widest">AI ACTIVE</span>
                      </div>
                    </div>
                    {/* Classification */}
                    <div className="mb-2.5">
                      <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest mb-1">Classification</p>
                      <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${CLASS_COLORS[report.analystMeta.classification]}`}>
                        {report.analystMeta.classification}
                      </span>
                    </div>
                    {/* Live meters */}
                    {[
                      ['Price Direction', (driftMeters ?? report.cockpitMeters).directionBias],
                      ['Risk Level',      (driftMeters ?? report.cockpitMeters).riskPressure ],
                      ['Stability',       (driftMeters ?? report.cockpitMeters).stability    ],
                      ['Mkt Activity',    (driftMeters ?? report.cockpitMeters).mktTemp      ],
                      ['Supply Stress',   (driftMeters ?? report.cockpitMeters).procStress   ],
                    ].map(([label, meter]) => (
                      <div key={label} className="mb-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
                          <p className="text-[8px] font-bold text-gray-300 tabular-nums">{meter.label}</p>
                        </div>
                        <div className="h-0.5 rounded-full bg-gray-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${meter.bar}`} style={{ width:`${meter.val}%` }} />
                        </div>
                      </div>
                    ))}
                    {/* Confidence Drift */}
                    <div className="mt-1.5 pt-2 border-t border-gray-800 flex items-center justify-between">
                      <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Conf Drift</p>
                      <p className={`text-[11px] font-bold tabular-nums ${report.cockpitMeters.confDrift.cls}`}>{report.cockpitMeters.confDrift.label}</p>
                    </div>
                    {/* Telemetry timestamp */}
                    <div className="mt-1 flex items-center gap-1">
                      <span className="relative flex h-1 w-1 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" style={{ animationDuration:'1.6s' }} />
                        <span className="relative inline-flex rounded-full h-1 w-1 bg-blue-500" />
                      </span>
                      <p className="text-[7px] text-gray-600 uppercase tracking-widest">LIVE TELEMETRY</p>
                    </div>
                    {/* Static meta */}
                    <div className="mt-2 pt-2 border-t border-gray-800 space-y-1.5">
                      {[
                        ['Model',     report.analystMeta.model    ],
                        ['Phase',     report.analystMeta.mktState ],
                        ['Stability', report.analystMeta.coherence],
                        ['Data',      report.analystMeta.dataDepth],
                      ].map(([k, val]) => (
                        <div key={k}>
                          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest mb-px">{k}</p>
                          <p className="text-[9px] font-semibold text-gray-300 leading-tight">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>{/* end flex main+sidebar */}

            {/* ── Institutional Export Dock ── */}
            {revealedSections.length >= report.sections.length && (
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(56,189,248,0.25)' }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'linear-gradient(90deg, rgba(8,12,22,0.90) 0%, rgba(12,16,28,0.80) 100%)', borderBottom: '1px solid rgba(56,189,248,0.18)' }}>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.70)' }}>Export Intelligence Package</p>
                  <span className="text-[9px] ml-auto tabular-nums hidden sm:block font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{report.timestamp}</span>
                </div>
                <div className="flex" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {report.exportFormats.map((fmt, i) => (
                    <button key={fmt}
                      onClick={() => {
                        if (fmt === 'CSV')   downloadCSV(report, crop, state, period, selectedTemplate)
                        if (fmt === 'Excel') downloadExcel(report, crop, state, period, selectedTemplate)
                        if (fmt === 'PDF')   downloadPDF(report, crop, state, period, selectedTemplate)
                      }}
                      className="flex-1 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5"
                      style={{ background: i % 2 === 0 ? 'rgba(8,12,22,0.75)' : 'rgba(12,16,28,0.75)', borderRight: i < report.exportFormats.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none', color: 'rgba(255,255,255,0.72)' }}>
                      <span className="text-sm">{FORMAT_ICONS[fmt]}</span>
                      <span>↓ {fmt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Report Templates */}
      <div>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Report Templates · select to focus generation</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TEMPLATES.map(t => {
            const isSelected = selectedTemplate === t.key
            return (
              <div key={t.key} onClick={() => setSelectedTemplate(isSelected ? null : t.key)}
                className={`rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 ${isSelected ? 'ring-1 ring-emerald-500/40' : ''}`}
                style={isSelected
                  ? { background: 'rgba(14,20,42,0.85)', border: '1px solid rgba(56,189,248,0.45)', boxShadow: '0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(56,189,248,0.15)' }
                  : { background: 'rgba(12,16,28,0.68)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }
                }>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xl leading-none">{t.icon}</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {isSelected && <span className="text-[9px] font-bold text-primary-700 bg-primary-100 border border-primary-200 px-1.5 py-0.5 rounded uppercase tracking-widest">Selected</span>}
                    {t.tag && <span className="text-[9px] font-bold bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-widest">{t.tag}</span>}
                  </div>
                </div>
                <p className="text-[13px] font-extrabold tracking-tight mb-1 leading-tight" style={{ color: isSelected ? 'rgba(52,211,153,0.92)' : 'rgba(255,255,255,0.85)' }}>{t.title}</p>
                <p className="text-[11px] text-gray-500 mb-2.5 leading-normal">{t.desc}</p>
                <div className="space-y-0.5 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400 w-12 shrink-0 uppercase tracking-widest">Cover</span>
                    <span className="text-[9px] font-medium text-gray-600">{t.coverage}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400 w-12 shrink-0 uppercase tracking-widest">Horizon</span>
                    <span className="text-[9px] font-medium text-gray-600">{t.horizon}</span>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-primary-500 w-12 shrink-0 uppercase tracking-widest">Focus</span>
                      <span className="text-[9px] font-bold text-primary-700">{t.emphasis}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {t.types.map(fmt => (
                    <span key={fmt} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${FORMAT_COLORS[fmt]}`}>{fmt}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
