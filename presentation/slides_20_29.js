"use strict";

const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout  = "LAYOUT_16x9";
pptx.title   = "AgroPrice AI — Intelligence Showcase (Slides 20–29)";
pptx.author  = "AgroPrice AI · MCA Research Project";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:"050816", bg2:"07101f", card:"0d1a2e", card2:"0f2040",
  border:"1e3a5f", border2:"2a4a7a",
  emerald:"10B981", emeraldD:"059669", cyan:"06B6D4",
  blue:"3B82F6", blueD:"1D4ED8", violet:"8B5CF6",
  amber:"F59E0B", red:"EF4444", white:"FFFFFF",
  gray1:"E2E8F0", gray2:"94A3B8", gray3:"475569",
};

// ── Factory functions (never reuse objects) ───────────────────────────────────
const mkShadow = () => ({ type:"outer", color:"000000", opacity:0.55, blur:18, offset:6,  angle:135 });
const mkGlowE  = () => ({ type:"outer", color:"10B981", opacity:0.25, blur:30, offset:0,  angle:0 });
const mkGlowC  = () => ({ type:"outer", color:"06B6D4", opacity:0.25, blur:30, offset:0,  angle:0 });
const mkGlowV  = () => ({ type:"outer", color:"8B5CF6", opacity:0.22, blur:26, offset:0,  angle:0 });
const mkGlowA  = () => ({ type:"outer", color:"F59E0B", opacity:0.22, blur:26, offset:0,  angle:0 });
const mkGlowR  = () => ({ type:"outer", color:"EF4444", opacity:0.22, blur:26, offset:0,  angle:0 });
const mkGlowB  = () => ({ type:"outer", color:"3B82F6", opacity:0.22, blur:26, offset:0,  angle:0 });

// ── Paths ─────────────────────────────────────────────────────────────────────
const IMG = "D:/mca/2nd semester/GEN AI/EL Project/AgroPrice-AI/presentation/screenshots/cropped/";

// ── Slide layout constants ────────────────────────────────────────────────────
// Images are 1280×660 (ratio 1.939:1). Use cover to fill SC_W×SC_H cleanly.
const SC_X=0.30, SC_Y=0.92, SC_W=9.40, SC_H=4.10;   // screenshot box
const CH_Y=5.05;                                        // chip strip Y (SC_Y+SC_H+0.03)

// ── Helpers ───────────────────────────────────────────────────────────────────
function bg(s) {
  s.addShape(pptx.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625,
    fill:{color:C.bg}, line:{color:C.bg} });
}

function pill(s, x, y, w, h, color, transp=78) {
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x,y,w,h,
    fill:{color, transparency:transp}, line:{color, width:1.2}, rectRadius:0.12 });
}

function glassCard(s, x, y, w, h, opts={}) {
  s.addShape(pptx.shapes.RECTANGLE, { x,y,w,h,
    fill:{color: opts.fill||C.card},
    line:{color: opts.border||C.border, width: opts.lw||1.0},
    ...(opts.shadow ? {shadow: opts.shadow} : {}) });
}

// Slide header: badge + title + subtitle
function header(s, slideNum, module, title, sub, accent=C.emerald) {
  bg(s);
  // Ambient glow behind screenshot area
  s.addShape(pptx.shapes.OVAL, { x:1.5, y:1.5, w:7.0, h:4.0,
    fill:{color:accent, transparency:97}, line:{color:accent, transparency:100} });
  // Badge pill
  pill(s, SC_X, 0.07, 3.00, 0.23, accent, 80);
  s.addText(`SLIDE ${slideNum}  ·  ${module}`, {
    x:SC_X, y:0.07, w:3.00, h:0.23,
    fontSize:7.5, fontFace:"Arial Black", color:accent,
    align:"center", valign:"middle", bold:true });
  // Slide number on right
  s.addText(`${slideNum}/29`, {
    x:8.80, y:0.07, w:0.90, h:0.23,
    fontSize:8, fontFace:"Calibri", color:C.gray3, align:"right", valign:"middle" });
  // Title
  s.addText(title, {
    x:SC_X, y:0.30, w:9.40, h:0.42,
    fontSize:24, fontFace:"Arial Black", color:C.white,
    bold:true, valign:"middle" });
  // Subtitle
  s.addText(sub, {
    x:SC_X, y:0.72, w:9.40, h:0.18,
    fontSize:9, fontFace:"Calibri", color:C.gray2, valign:"middle" });
}

// Screenshot with glow border
function scImg(s, file, glowFn=mkGlowE) {
  // Outer glow frame
  s.addShape(pptx.shapes.RECTANGLE, { x:SC_X-0.04, y:SC_Y-0.04, w:SC_W+0.08, h:SC_H+0.08,
    fill:{type:"none"},
    line:{color:C.border, width:1.0, transparency:55},
    shadow:glowFn() });
  // Image — cover-clip so 1280×660 fills the box without letterboxing
  s.addImage({ path:IMG+file, x:SC_X, y:SC_Y, w:SC_W, h:SC_H,
    sizing:{type:"cover", w:SC_W, h:SC_H} });
}

// Chip row below screenshot
function chipRow(s, items, accent=C.emerald) {
  const n = items.length;
  const cw = SC_W / n;
  items.forEach((item, i) => {
    const x = SC_X + i*cw;
    glassCard(s, x, CH_Y, cw-0.06, 0.23, {
      fill:C.card,
      border: i===0 ? accent : C.border,
      lw: i===0 ? 1.3 : 0.8,
      shadow: mkShadow()
    });
    s.addText(item, {
      x:x+0.08, y:CH_Y, w:cw-0.20, h:0.23,
      fontSize:8, fontFace: i===0?"Arial Black":"Calibri",
      color: i===0 ? accent : C.gray1,
      valign:"middle", bold: i===0 });
  });
}

// Callout annotation box (for use overlaid on screenshot)
function callout(s, x, y, w, h, icon, label, value, color=C.emerald) {
  glassCard(s, x, y, w, h, {fill:"000000", border:color, lw:1.2, shadow:mkShadow()});
  s.addShape(pptx.shapes.RECTANGLE, {x, y, w:0.04, h:h,
    fill:{color}, line:{color, width:0}});
  s.addText(icon+" "+label, {
    x:x+0.10, y:y+0.03, w:w-0.18, h:0.20,
    fontSize:7.5, fontFace:"Arial Black", color, valign:"middle"});
  s.addText(value, {
    x:x+0.10, y:y+0.22, w:w-0.18, h:0.22,
    fontSize:10, fontFace:"Arial Black", color:C.white, bold:true, valign:"middle"});
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 20 — Market Intelligence Dashboard
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 20, "LIVE DASHBOARD",
    "Market Intelligence Dashboard",
    "Real-time agricultural price analytics · AGMARKNET 2015–2026 · 5 South Indian states · 27 crops tracked",
    C.blue);
  scImg(s, "dashboard.png", mkGlowB);

  // Overlay callout badges on bottom-right of screenshot
  callout(s, 6.80, SC_Y+0.12, 2.78, 0.50, "📊", "TOTAL RECORDS",    "48,229,507", C.blue);
  callout(s, 6.80, SC_Y+0.72, 2.78, 0.50, "🌾", "CROPS TRACKED",    "380+ varieties", C.emerald);
  callout(s, 6.80, SC_Y+1.32, 2.78, 0.50, "🗺️", "STATES COVERED",   "TN · KA · AP · TS · KL", C.cyan);
  callout(s, 6.80, SC_Y+1.92, 2.78, 0.50, "⚡", "MARKET STRESS",    "100/100 — Extreme Alert", C.amber);

  chipRow(s,
    ["48.2M AGMARKNET Records","Latest: 2026-04-21","AI Brief — Live Ticker","Highest Priced: Banana ₹4,074/qtl"],
    C.blue);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 21 — Geographic Market Intelligence
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 21, "MARKET MAP",
    "Geographic Price Intelligence — South India",
    "5-state spatial analytics · State-level price heatmap · Regional spread analysis · Crop × State × Metric",
    C.cyan);
  scImg(s, "map.png", mkGlowC);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "📍", "HIGHEST PRICE",    "Kerala ₹3,184/qtl (+22%)", C.emerald);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "📉", "LOWEST PRICE",     "Telangana ₹1,070/qtl", C.red);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "↑", "STRONGEST TREND",   "Telangana +77.7% uptrend", C.cyan);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "📐", "REGIONAL SPREAD",  "198% Kerala vs Telangana", C.amber);

  chipRow(s,
    ["Tomato · Avg Price (30D)","5/5 South Indian States","AGMARKNET Spatial Intel","Kerala leads at ₹3,184/qtl"],
    C.cyan);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 22 — AI-Powered Forecasting Engine
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 22, "FORECAST ENGINE",
    "AI-Powered Price Forecasting Engine",
    "Prophet + XGBoost + Sparse-Trend models · 7/30/90-day horizons · Tier A/B/C/D crop registry · 27 crops",
    C.emerald);
  scImg(s, "forecast.png", mkGlowE);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "🧠", "AI CONFIDENCE",    "78/100 — Mean across 27 crops", C.emerald);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "⚖️", "MARKET STABILITY", "48/100 — Inverse of mean CV", C.cyan);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "🎯", "OPPORTUNITY",      "74/100 — 10 rising markets", C.amber);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "⚡", "STRESS METER",     "100/100 — 68 anomaly events", C.red);

  chipRow(s,
    ["Prophet · 4,050 Training Days","Tier A — 90-Day Horizon","South India AI Market Pulse · LIVE","Market Leaders — Beans +50.2%/7d"],
    C.emerald);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 23 — AI Visual Reasoning & Market Signals
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 23, "AI VISUAL REASONING",
    "AI Visual Reasoning — Live Market Signal Extraction",
    "4-dimension signal analysis · Generated from live DuckDB metrics · Anomaly detection · Volatility · Coverage · Seasonality",
    C.violet);
  scImg(s, "forecast_signals.png", mkGlowV);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "⚡", "HIGH VOLATILITY",   "Detected · 83% confidence", C.red);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "📡", "MARKET COVERAGE",   "Strong · 92% continuity score", C.emerald);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "🌿", "SEASONAL RECOVERY", "Underway · 75% signal strength", C.cyan);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "🔄", "SEASONAL CYCLE",    "Pronounced · 102% swing · 85%", C.violet);

  chipRow(s,
    ["All signals — generated from live metrics","Volatility 71% CV · Momentum +29.4%","Trust Index 79/100 · Anomaly Count 3","Tomato · Karnataka · AI Reasoning Module"],
    C.violet);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 24 — Autonomous Multi-Agent Market Monitor
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 24, "AUTONOMOUS AI",
    "Autonomous Multi-Agent Market Monitor",
    "Phase 4B · Regime detection · Escalation engine · Priority scoring · Bloomberg-style executive synthesis · Phase 5 Council",
    C.red);
  scImg(s, "advisor_monitor.png", mkGlowR);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "🚨", "MARKET REGIME",    "CRISIS — 5 crops affected", C.red);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "⚠️", "ESCALATIONS",      "13 signals require attention", C.amber);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "📊", "SHOCK PROBABILITY", "88% in next 30 days", C.violet);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "🤖", "AI AGENTS ACTIVE",  "Phase 4B+5 — 7-agent council", C.cyan);

  chipRow(s,
    ["CRITICAL: Tomato (Karnataka) — Panic / Volatility","CRITICAL: Onion (Tamil Nadu) — Panic / Volatility","Executive Synthesis — High Risk Consensus","Decision Intelligence Phase 5 — Bloomberg Style"],
    C.red);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 25 — AI-Powered Data Storytelling
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 25, "DATA STORYTELLING",
    "AI-Powered Data Storytelling — Market Story Mode",
    "AI analyst briefing mode · Seasonal pattern narration · Cross-state snapshot · Historical behaviour explanation",
    C.amber);
  scImg(s, "forecast_chart.png", mkGlowA);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "📖", "STORY MODE",       "4-part AI analyst briefing", C.amber);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "📅", "SEASONAL PATTERN", "Trough Season · -32.6% vs avg", C.red);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "🗺️", "5-STATE SNAPSHOT", "₹1,070 – ₹3,184 range", C.cyan);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "🤖", "AI NARRATIVE",     "Auto-generated from real data", C.emerald);

  chipRow(s,
    ["Market Story Mode · Tomato · Karnataka","PAST: How this market behaved","Peak Months Jul/Jun/Nov (+60.1%)","Trough Months Mar/Apr/Feb (-41.5%)"],
    C.amber);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 26 — Grounded Conversational AI Advisor
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 26, "AI ADVISOR",
    "Grounded Conversational AI Advisor",
    "Gemini 2.5 Flash · Grounded on AGMARKNET data · 4 analyst personas · Session memory · Voice input/output · SSE streaming",
    C.emerald);
  scImg(s, "advisor_chat_zone.png", mkGlowE);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "✦", "GEMINI 2.5 FLASH",  "Grounded · Gemini-powered", C.emerald);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "👤", "VIEW MODES",        "Farmer · Trader · Wholesale · Analyst", C.blue);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "🧠", "SESSION MEMORY",    "Crop/state inheritance · 2h TTL", C.violet);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "🎙️", "VOICE ENABLED",    "STT input + TTS output (en-IN)", C.cyan);

  chipRow(s,
    ["Zone 3 · LIVE AI WORKSPACE","Anomaly Alerts: 10 events · Last 90 days","Intelligence Rail — Tomato +29.4% · Alert Active","Guardrails: Domain-locked to agriculture"],
    C.emerald);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 27 — AI-Generated Intelligence Reports
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 27, "REPORTS",
    "AI-Generated Intelligence Reports",
    "Export intelligence · PDF + Excel export · AI Report Intelligence Studio · Farmer · Trader · Analyst modes",
    C.cyan);
  scImg(s, "reports.png", mkGlowC);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "📊", "DATASET",           "48.2M AGMARKNET records", C.cyan);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "🌾", "COVERAGE",          "27 crops · 5 states · 11 years", C.emerald);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "📁", "EXPORT FORMATS",    "PDF (ReportLab) + Excel (openpyxl)", C.blue);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "🤖", "REPORT TEMPLATES",  "Weekly · Seasonal · Coverage · Forecast", C.amber);

  chipRow(s,
    ["AI Report Intelligence Studio","Forecast Reliability Assessed — All 27 Crops","Intelligence V2.7 · AGROPRICE AI","5 Forecast Models — Prophet · 30/60/90-day"],
    C.cyan);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 28 — Explainable AI — Transparent Decision Pipeline
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 28, "EXPLAINABLE AI",
    "Explainable AI — Auditable Decision Pipeline",
    "How AI reached this forecast · 7-stage transparent pipeline · Every decision traceable from raw data to final output",
    C.violet);
  scImg(s, "forecast_pipeline.png", mkGlowV);

  callout(s, 6.76, SC_Y+0.12, 2.82, 0.50, "1️⃣", "DATA INGESTION",    "48.2M AGMARKNET records scanned", C.blue);
  callout(s, 6.76, SC_Y+0.72, 2.82, 0.50, "⚙️", "FORECAST ENGINE",   "Prophet · 30-day projection", C.emerald);
  callout(s, 6.76, SC_Y+1.32, 2.82, 0.50, "🎯", "CONFIDENCE",         "6 weighted factors · 79/100 Good", C.amber);
  callout(s, 6.76, SC_Y+1.92, 2.82, 0.50, "✅", "FINAL FORECAST",     "Rendered with full diagnostics", C.violet);

  chipRow(s,
    ["Data → Cleaning → Tier Classification","Forecast Engine → Confidence Engine","Advisory Engine → AI Narrator → Final Forecast","Auditable end-to-end · No black boxes"],
    C.violet);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 29 — System Intelligence Summary
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  bg(s);

  // Ambient glows
  s.addShape(pptx.shapes.OVAL, { x:0.5, y:0.5, w:4.0, h:3.0,
    fill:{color:C.emerald, transparency:96}, line:{color:C.emerald, transparency:100} });
  s.addShape(pptx.shapes.OVAL, { x:5.5, y:2.0, w:4.0, h:3.0,
    fill:{color:C.blue, transparency:96}, line:{color:C.blue, transparency:100} });

  // Header
  pill(s, 0.30, 0.07, 3.20, 0.23, C.white, 85);
  s.addText("SLIDE 29  ·  SYSTEM OVERVIEW", {
    x:0.30, y:0.07, w:3.20, h:0.23,
    fontSize:7.5, fontFace:"Arial Black", color:C.white,
    align:"center", valign:"middle", bold:true });

  s.addText("AgroPrice AI — Complete Intelligence System", {
    x:0.30, y:0.32, w:9.40, h:0.38,
    fontSize:23, fontFace:"Arial Black", color:C.white, bold:true, valign:"middle" });
  s.addText("From AGMARKNET data to Gemini-grounded AI advisor · End-to-end agricultural intelligence platform", {
    x:0.30, y:0.70, w:9.40, h:0.18,
    fontSize:9, fontFace:"Calibri", color:C.gray2, valign:"middle" });

  // 2x2 screenshot grid — images are 1280×660 (1.939:1), use cover to fill cells
  const GX = [0.26, 5.14];
  const GY = [1.00, 3.00];
  const GW = 4.76, GH = 1.90;

  const gridImgs = [
    { file:"dashboard.png",   label:"Market Dashboard",          color:C.blue    },
    { file:"map.png",         label:"Geographic Intelligence",   color:C.cyan    },
    { file:"forecast_pipeline.png", label:"AI Decision Pipeline", color:C.violet },
    { file:"advisor_monitor.png",   label:"Autonomous Monitor",  color:C.red     },
  ];

  gridImgs.forEach((g, i) => {
    const xi = GX[i%2], yi = GY[Math.floor(i/2)];
    // Glow border
    s.addShape(pptx.shapes.RECTANGLE, { x:xi-0.04, y:yi-0.04, w:GW+0.08, h:GH+0.08,
      fill:{type:"none"}, line:{color:g.color, width:1.2, transparency:55},
      shadow:{ type:"outer", color:g.color.replace("#",""), opacity:0.18, blur:20, offset:0, angle:0 } });
    // Image — cover-clip to grid cell
    s.addImage({ path:IMG+g.file, x:xi, y:yi, w:GW, h:GH,
      sizing:{type:"cover", w:GW, h:GH} });
    // Label pill
    pill(s, xi+0.10, yi+GH-0.30, 2.20, 0.22, g.color, 70);
    s.addText(g.label, {
      x:xi+0.12, y:yi+GH-0.30, w:2.16, h:0.22,
      fontSize:7.5, fontFace:"Arial Black", color:C.white,
      align:"center", valign:"middle" });
  });

  // Central divider with logo area
  s.addShape(pptx.shapes.LINE, { x:4.90, y:1.00, w:0, h:3.90,
    line:{color:C.border2, width:0.8, transparency:50} });
  s.addShape(pptx.shapes.LINE, { x:0.26, y:2.96, w:9.44, h:0,
    line:{color:C.border2, width:0.8, transparency:50} });

  // Bottom stat strip (5 chips)
  const bottomChips = [
    {label:"48.2M Records",      color:C.blue   },
    {label:"27 Crops · 5 States",color:C.emerald},
    {label:"2015 – 2026",        color:C.cyan   },
    {label:"Gemini 2.5 Flash",   color:C.violet },
    {label:"Phase 5 · Decision AI", color:C.amber},
  ];
  const bW = 9.40/5;
  bottomChips.forEach((bc, i) => {
    const x = 0.30 + i*bW;
    glassCard(s, x, 5.16, bW-0.06, 0.22, {
      fill:C.card, border:bc.color, lw:1.1, shadow:mkShadow()});
    s.addText(bc.label, {
      x:x+0.06, y:5.16, w:bW-0.14, h:0.22,
      fontSize:7.5, fontFace:"Arial Black", color:bc.color,
      align:"center", valign:"middle" });
  });
}

// ── Generate ──────────────────────────────────────────────────────────────────
const outPath = "D:/mca/2nd semester/GEN AI/EL Project/AgroPrice-AI/presentation/AgroPrice_AI_Slides_20_29.pptx";
pptx.writeFile({ fileName: outPath })
  .then(() => console.log("✓ Slides 20–29 written →", outPath))
  .catch(err => { console.error("ERROR:", err); process.exit(1); });
