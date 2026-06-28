"use strict";

const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.title  = "AgroPrice AI — Analysis & Conclusion (Slides 30–39)";
pptx.author = "AgroPrice AI · MCA Research Project";

// ── Colour palette ─────────────────────────────────────────────────────────
const C = {
  bg:"050816", bg2:"07101f", card:"0d1a2e", card2:"0f2040",
  border:"1e3a5f", border2:"2a4a7a",
  emerald:"10B981", emeraldD:"059669", cyan:"06B6D4",
  blue:"3B82F6", blueD:"1D4ED8", violet:"8B5CF6",
  amber:"F59E0B", red:"EF4444", white:"FFFFFF",
  gray1:"E2E8F0", gray2:"94A3B8", gray3:"475569",
};

// ── Shadow / glow factories ────────────────────────────────────────────────
const mkShadow = () => ({ type:"outer", color:"000000", opacity:0.55, blur:18, offset:6, angle:135 });
const mkGlowE  = () => ({ type:"outer", color:"10B981", opacity:0.25, blur:30, offset:0, angle:0 });
const mkGlowC  = () => ({ type:"outer", color:"06B6D4", opacity:0.25, blur:30, offset:0, angle:0 });
const mkGlowV  = () => ({ type:"outer", color:"8B5CF6", opacity:0.22, blur:26, offset:0, angle:0 });
const mkGlowA  = () => ({ type:"outer", color:"F59E0B", opacity:0.22, blur:26, offset:0, angle:0 });
const mkGlowR  = () => ({ type:"outer", color:"EF4444", opacity:0.22, blur:26, offset:0, angle:0 });
const mkGlowB  = () => ({ type:"outer", color:"3B82F6", opacity:0.22, blur:26, offset:0, angle:0 });

// ── Base helpers ──────────────────────────────────────────────────────────
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

function header(s, slideNum, module, title, sub, accent=C.emerald) {
  bg(s);
  s.addShape(pptx.shapes.OVAL, { x:1.5, y:1.5, w:7.0, h:4.0,
    fill:{color:accent, transparency:97}, line:{color:accent, transparency:100} });
  pill(s, 0.30, 0.07, 3.00, 0.23, accent, 80);
  s.addText(`SLIDE ${slideNum}  ·  ${module}`, {
    x:0.30, y:0.07, w:3.00, h:0.23,
    fontSize:7.5, fontFace:"Arial Black", color:accent,
    align:"center", valign:"middle", bold:true });
  s.addText(`${slideNum}/39`, {
    x:8.80, y:0.07, w:0.90, h:0.23,
    fontSize:8, fontFace:"Calibri", color:C.gray3, align:"right", valign:"middle" });
  s.addText(title, {
    x:0.30, y:0.30, w:9.40, h:0.42,
    fontSize:24, fontFace:"Arial Black", color:C.white, bold:true, valign:"middle" });
  s.addText(sub, {
    x:0.30, y:0.72, w:9.40, h:0.18,
    fontSize:9, fontFace:"Calibri", color:C.gray2, valign:"middle" });
}

// Large stat card — hero number + label + sub
function statCard(s, x, y, w, h, value, label, sub, color=C.emerald) {
  glassCard(s, x, y, w, h, {fill:C.card, border:color, lw:1.3, shadow:mkShadow()});
  s.addShape(pptx.shapes.RECTANGLE, {x, y, w:0.05, h:h,
    fill:{color}, line:{color, width:0}});
  const vLen = String(value).length;
  const vSize = vLen <= 5 ? 26 : vLen <= 8 ? 20 : 16;
  s.addText(value, {
    x:x+0.14, y:y+0.06, w:w-0.20, h:h*0.50,
    fontSize:vSize, fontFace:"Arial Black", color, bold:true, valign:"middle"});
  s.addText(label, {
    x:x+0.14, y:y+h*0.57, w:w-0.20, h:0.18,
    fontSize:8, fontFace:"Arial Black", color:C.gray1, valign:"middle"});
  if (sub) s.addText(sub, {
    x:x+0.14, y:y+h*0.78, w:w-0.20, h:0.14,
    fontSize:6.5, fontFace:"Calibri", color:C.gray2, valign:"middle"});
}

// Quality row: accent dot + bold label + description + optional bar
function qualRow(s, x, y, w, h, icon, label, desc, color=C.emerald, score=null) {
  glassCard(s, x, y, w, h, {fill:C.card2, border:color, lw:1.0, shadow:mkShadow()});
  s.addShape(pptx.shapes.RECTANGLE, {x, y, w:0.04, h:h,
    fill:{color}, line:{color, width:0}});
  s.addText(icon, {x:x+0.12, y, w:0.28, h:h,
    fontSize:14, fontFace:"Segoe UI Emoji", valign:"middle", align:"center"});
  s.addText(label, {
    x:x+0.44, y:y+0.05, w: score!==null ? w-1.30 : w-0.52, h:0.22,
    fontSize:9, fontFace:"Arial Black", color, bold:true, valign:"middle"});
  s.addText(desc, {
    x:x+0.44, y:y+0.26, w: score!==null ? w-1.30 : w-0.52, h:h-0.30,
    fontSize:7.5, fontFace:"Calibri", color:C.gray1, valign:"top"});
  if (score !== null) {
    // Score pill on right
    const pw = 0.72, ph = 0.26;
    const px = x+w-pw-0.08, py = y+(h-ph)/2;
    pill(s, px, py, pw, ph, color, 70);
    s.addText(`${score}%`, {x:px, y:py, w:pw, h:ph,
      fontSize:11, fontFace:"Arial Black", color, bold:true,
      align:"center", valign:"middle"});
  }
}

// Challenge/solution card (2-col grid)
function csCard(s, x, y, w, h, num, title, body, color=C.red) {
  glassCard(s, x, y, w, h, {fill:C.card, border:color, lw:1.2, shadow:mkShadow()});
  // Number badge
  pill(s, x+0.12, y+0.10, 0.28, 0.24, color, 72);
  s.addText(String(num), {x:x+0.12, y:y+0.10, w:0.28, h:0.24,
    fontSize:9, fontFace:"Arial Black", color, align:"center", valign:"middle", bold:true});
  s.addText(title, {
    x:x+0.48, y:y+0.08, w:w-0.60, h:0.26,
    fontSize:10, fontFace:"Arial Black", color, bold:true, valign:"middle"});
  s.addText(body, {
    x:x+0.12, y:y+0.40, w:w-0.22, h:h-0.46,
    fontSize:8, fontFace:"Calibri", color:C.gray1, valign:"top"});
}

// Bottom chip strip (5 items)
function chipStrip(s, items, accent=C.emerald) {
  const n = items.length;
  const cw = 9.40/n;
  const cy = 5.12;
  items.forEach((item, i) => {
    const x = 0.30 + i*cw;
    glassCard(s, x, cy, cw-0.06, 0.22, {
      fill:C.card, border: i===0 ? accent : C.border,
      lw: i===0 ? 1.3 : 0.8, shadow:mkShadow()});
    s.addText(item, {x:x+0.08, y:cy, w:cw-0.20, h:0.22,
      fontSize:7.5, fontFace: i===0 ? "Arial Black" : "Calibri",
      color: i===0 ? accent : C.gray1, valign:"middle", bold:i===0});
  });
}

// Divider line
function divider(s, x, y, w, color=C.border2) {
  s.addShape(pptx.shapes.LINE, {x, y, w, h:0,
    line:{color, width:0.8, transparency:50}});
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 30 — Quantitative Analysis
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 30, "QUANTITATIVE ANALYSIS",
    "By the Numbers — AgroPrice AI at Scale",
    "Measured performance across data depth · model accuracy · system reliability · intelligence coverage",
    C.blue);

  // 4 × 3 stat grid — cw=2.24, ch=1.16, gapX=0.06, gapY=0.08
  const CW=2.24, CH=1.16;
  const XS=[0.30, 2.60, 4.90, 7.20];
  const YS=[0.97, 2.21, 3.45];

  const stats = [
    // Row 1 — Scale
    { v:"48.2M",  l:"AGMARKNET Records",   sub:"Dataset 2015–2026", color:C.blue },
    { v:"27",     l:"Crop Varieties",       sub:"Tier A/B/C/D registry", color:C.emerald },
    { v:"5",      l:"South Indian States",  sub:"TN · KA · AP · KL · TS", color:C.cyan },
    { v:"11 Yrs", l:"Historical Depth",     sub:"Jan 2015 – Apr 2026", color:C.violet },
    // Row 2 — Intelligence
    { v:"3",      l:"ML Models",            sub:"Prophet + XGBoost + Sparse-Trend", color:C.amber },
    { v:"7",      l:"AI Council Agents",    sub:"Phase 5 · Weighted consensus", color:C.violet },
    { v:"92%",    l:"Data Continuity",      sub:"Reporting consistency score", color:C.emerald },
    { v:"78/100", l:"AI Confidence",        sub:"Mean across 27 crops", color:C.blue },
    // Row 3 — Performance
    { v:"<3s",    l:"API Response",         sub:"Real-time intelligence delivery", color:C.cyan },
    { v:"22",     l:"Signal Types",         sub:"Bullish → Panic regime map", color:C.emerald },
    { v:"68",     l:"Price Anomalies",      sub:"Detected in live dataset", color:C.red },
    { v:"5",      l:"Build Phases",         sub:"Jan – Jun 2026 · MCA Project", color:C.amber },
  ];

  stats.forEach((st, i) => {
    statCard(s, XS[i%4], YS[Math.floor(i/4)], CW, CH,
      st.v, st.l, st.sub, st.color);
  });

  chipStrip(s, ["AGMARKNET · 2015–2026", "DuckDB Query Engine", "Prophet · XGBoost · Sparse-Trend", "Gemini 2.5 Flash · SSE", "Phase 5 · 7-Agent Council"], C.blue);
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 31 — Qualitative Analysis
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 31, "QUALITATIVE ANALYSIS",
    "System Quality — Intelligence, Integrity & Experience",
    "Grounding · guardrails · explainability · user experience · agentic design",
    C.emerald);

  // Left column (4 rows), Right column (4 rows)
  const LX=0.28, RX=5.20, CW=4.52, RH=0.84, GAP=0.10;
  const YS=[0.97, 1.91, 2.85, 3.79];

  const leftItems = [
    { icon:"🔒", label:"Zero Hallucination",      desc:"Every Gemini response is grounded on DuckDB facts. The LLM narrates data — it never generates prices, forecasts, or volatility values independently.", color:C.emerald, score:100 },
    { icon:"🛡️", label:"Domain Security",          desc:"Agricultural guardrails block 100% of off-topic queries (coding, finance, medical, politics) before Gemini is ever invoked. <4ms rejection latency.", color:C.cyan, score:100 },
    { icon:"🎯", label:"Analyst Personas",          desc:"4 audience-specific modes — Farmer (plain language), Trader (momentum focus), Wholesale (procurement), Analyst (Bloomberg-style statistical brief).", color:C.blue, score:92 },
    { icon:"🧠", label:"Contextual Memory",         desc:"Session-aware 2h TTL memory. Crop/state inheritance across turns. Topic chain tracks conversation arc. Redis opt-in for multi-process deployments.", color:C.violet, score:88 },
  ];

  const rightItems = [
    { icon:"⚡", label:"Streaming Intelligence",   desc:"SSE real-time token delivery via /ask/stream. AbortController cancellation. Typing cursor animation. Executive cards render only after stream completes.", color:C.amber, score:95 },
    { icon:"🔍", label:"Explainability",            desc:"Full 7-stage decision trace per query: data ingestion → cleaning → classification → engine → confidence → narrative → output. Every decision auditable.", color:C.emerald, score:97 },
    { icon:"🎙️", label:"Voice Interface",            desc:"Web Speech API STT (Chrome/Edge) + speechSynthesis TTS in Indian English (en-IN). Markdown stripped before speaking. Unmount-safe stateless hooks.", color:C.cyan, score:85 },
    { icon:"🏆", label:"Executive UX",              desc:"Bloomberg Terminal aesthetic. 7-zone command center. Immersive mode. Density toggles (compact/balanced/expanded). Priority-sorted insight cards.", color:C.blue, score:90 },
  ];

  leftItems.forEach((it, i) => {
    qualRow(s, LX, YS[i], CW, RH, it.icon, it.label, it.desc, it.color, it.score);
  });
  rightItems.forEach((it, i) => {
    qualRow(s, RX, YS[i], CW, RH, it.icon, it.label, it.desc, it.color, it.score);
  });

  // Vertical separator
  s.addShape(pptx.shapes.LINE, {x:4.98, y:0.95, w:0, h:3.80,
    line:{color:C.border2, width:0.8, transparency:40}});

  chipStrip(s, ["Grounding Architecture", "Guardrails · Zero Injection", "4 Analyst Personas", "7-Stage Decision Trace", "Voice STT · TTS · en-IN"], C.emerald);
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 32 — Comparisons
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 32, "COMPARISONS",
    "AgroPrice AI vs Existing Solutions",
    "Feature-by-feature comparison against current agricultural market information systems",
    C.cyan);

  // Table: 4 columns (feature + 3 systems), 10 rows
  // Header row y=0.96, data rows y=0.96+0.30*n
  const TX=0.28, TY=0.96;
  const COLS=[3.20, 2.00, 2.00, 2.00];  // widths: feature col, 3 system cols
  const ROW_H=0.42;
  const XS=[TX, TX+COLS[0]+0.04, TX+COLS[0]+COLS[1]+0.08, TX+COLS[0]+COLS[1]+COLS[2]+0.12];

  const systems = ["AgroPrice AI", "Agmarknet Portal", "eNAM Platform"];
  const sColors = [C.emerald, C.gray3, C.gray3];

  // Header row
  glassCard(s, TX, TY, 9.44, 0.34, {fill:C.card2, border:C.border2, lw:1.2});
  s.addText("FEATURE", {x:XS[0]+0.10, y:TY, w:COLS[0]-0.14, h:0.34,
    fontSize:8, fontFace:"Arial Black", color:C.gray2, valign:"middle", bold:true});
  systems.forEach((sys, i) => {
    s.addText(sys, {x:XS[i+1], y:TY, w:COLS[i+1]-0.04, h:0.34,
      fontSize:8.5, fontFace:"Arial Black", color:sColors[i],
      align:"center", valign:"middle", bold:true});
  });

  const features = [
    { name:"AI Price Forecasting (7/30/90d)", vals:["✓ Prophet + XGBoost", "✗ None", "✗ None"] },
    { name:"Grounded Conversational AI",      vals:["✓ Gemini 2.5 Flash", "✗ None", "✗ None"] },
    { name:"Historical Analysis (10+ years)", vals:["✓ 2015–2026 AGMARKNET", "⚠ Basic query", "⚠ 3–5 years"] },
    { name:"Multi-Agent Intelligence",        vals:["✓ 7-Agent Council", "✗ None", "✗ None"] },
    { name:"Voice Input / Output",            vals:["✓ STT + TTS (en-IN)", "✗ None", "✗ None"] },
    { name:"Export Reports (PDF + Excel)",    vals:["✓ AI-Narrated Reports", "⚠ CSV only", "⚠ PDF only"] },
    { name:"Real-time Anomaly Detection",     vals:["✓ 90-day z-score scan", "✗ None", "✗ None"] },
    { name:"Explainable AI Pipeline",         vals:["✓ 7-stage trace", "✗ None", "✗ None"] },
  ];

  const valColors = { "✓":C.emerald, "⚠":C.amber, "✗":C.red };

  features.forEach((f, i) => {
    const ry = TY + 0.36 + i * ROW_H;
    const rowFill = i%2===0 ? C.card : C.bg2;
    glassCard(s, TX, ry, 9.44, ROW_H-0.02, {fill:rowFill, border:C.border, lw:0.6});
    s.addText(f.name, {x:XS[0]+0.10, y:ry, w:COLS[0]-0.16, h:ROW_H-0.02,
      fontSize:8, fontFace:"Calibri", color:C.gray1, valign:"middle"});
    f.vals.forEach((v, j) => {
      const tick = v[0];
      const vc = valColors[tick] || C.gray1;
      s.addText(v, {x:XS[j+1], y:ry, w:COLS[j+1]-0.04, h:ROW_H-0.02,
        fontSize:7.5, fontFace: j===0?"Arial Black":"Calibri",
        color:j===0 ? vc : C.gray2,
        align:"center", valign:"middle", bold:j===0});
    });
  });

  // Legend
  const LY = TY + 0.36 + features.length*ROW_H + 0.06;
  [["✓ Full Support",C.emerald],["⚠ Partial",C.amber],["✗ Not Available",C.red]].forEach(([txt,col],i)=>{
    s.addText(txt, {x:0.30+i*2.80, y:LY, w:2.60, h:0.18,
      fontSize:7.5, fontFace:"Calibri", color:col, valign:"middle"});
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 33 — Challenges
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 33, "CHALLENGES",
    "Real-World Obstacles We Encountered",
    "Data · modelling · AI safety · infrastructure · domain constraints",
    C.red);

  const CW=4.54, CH=1.28, GAP=0.12;
  const XS=[0.28, 4.90];
  const YS=[0.97, 2.33, 3.69];

  // y[2]+ch = 3.69+1.28 = 4.97, chipStrip at 5.12 ✓
  // But let me check: 4.97 < 5.40 ✓, chipStrip 5.12+0.22=5.34 ✓

  const challenges = [
    { num:1, title:"Data Sparsity",         body:"Many mandis report intermittently — some crops show months-long gaps. Irregular time-series breaks standard ML assumptions and degrades Prophet forecasts on thin datasets.", color:C.red },
    { num:2, title:"Extreme Price Volatility", body:"Tomato CV = 54.7%. Prices swing ₹200→₹5,500/qtl within weeks. High volatility widens confidence intervals and reduces forecast reliability for perishable crops.", color:C.amber },
    { num:3, title:"LLM Hallucination Risk",  body:"LLMs confidently invent plausible-sounding prices and forecasts. Without architectural grounding, Gemini would fabricate numbers rather than narrate real AGMARKNET data.", color:C.red },
    { num:4, title:"Cold-Start Problem",      body:"New crops entering the registry (Tier C/D) have <1 year of data. Prophet requires 2+ seasonal cycles; XGBoost needs >500 training rows for reliable gradient boosting.", color:C.violet },
    { num:5, title:"Rural Connectivity",      body:"Target users (farmers, mandi traders) often have 2G connections. Heavy SPA bundles and cloud-dependent AI responses create latency barriers in rural South India.", color:C.cyan },
    { num:6, title:"Cross-State Heterogeneity", body:"Tomato in Kerala trades at 3× Telangana prices for identical quality. A single pan-India model fails; per-state modelling multiplies compute and maintenance complexity.", color:C.amber },
  ];

  challenges.forEach((c, i) => {
    csCard(s, XS[i%2], YS[Math.floor(i/2)], CW, CH,
      c.num, c.title, c.body, c.color);
  });

  chipStrip(s, ["6 Core Challenges", "Data Quality", "ML Robustness", "LLM Safety", "Infrastructure"], C.red);
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 34 — Solutions
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 34, "SOLUTIONS",
    "How We Solved Each Challenge",
    "Architectural decisions · custom models · grounding framework · tier system · local-first design",
    C.emerald);

  const CW=4.54, CH=1.28;
  const XS=[0.28, 4.90];
  const YS=[0.97, 2.33, 3.69];

  const solutions = [
    { num:1, title:"Sparse-Trend Model",        body:"Custom third forecasting model purpose-built for irregular series. Falls back from Prophet → XGBoost → Sparse-Trend based on data depth. Tier A/B/C/D registry ensures graceful degradation.", color:C.emerald },
    { num:2, title:"Volatility-Aware Scoring",  body:"Confidence engine weights CV, anomaly count, training rows, and forecast model tier. High-CV crops (Tomato) receive lower confidence scores with wider confidence intervals shown to users.", color:C.cyan },
    { num:3, title:"Deterministic Grounding",   body:"Architectural boundary: LLM receives pre-computed AGMARKNET facts via PromptContext and narrates — it never generates numbers. 7-stage trace makes every decision auditable end-to-end.", color:C.emerald },
    { num:4, title:"Crop Tier Registry",        body:"27 crops classified Tier A (5+ years, daily) → Tier D (sparse, seasonal only). Tier controls model selection, confidence floors, and UI warnings. New crops auto-degrade gracefully.", color:C.violet },
    { num:5, title:"DuckDB Local-First",        body:"Embedded analytical database — no network call, no cloud dependency for data queries. Parquet files on disk. Sub-200ms queries on 48M rows. Works in offline/low-bandwidth scenarios.", color:C.amber },
    { num:6, title:"Per-State Ensemble",        body:"Separate model training per crop × state combination. Karnataka Tomato and Tamil Nadu Tomato are independent models. State-level ensemble captures regional market dynamics independently.", color:C.blue },
  ];

  solutions.forEach((sl, i) => {
    csCard(s, XS[i%2], YS[Math.floor(i/2)], CW, CH,
      sl.num, sl.title, sl.body, sl.color);
  });

  chipStrip(s, ["Sparse-Trend Model", "Grounding Architecture", "Tier A/B/C/D System", "DuckDB Local-First", "Per-State Ensemble"], C.emerald);
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 35 — Future Scope
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 35, "FUTURE SCOPE",
    "Roadmap — AgroPrice AI Next Frontiers",
    "6 planned phases extending the platform into mobile · weather · live markets · satellite intelligence",
    C.violet);

  // 2 × 3 roadmap cards with phase numbers and timeline labels
  const CW=4.54, CH=1.28;
  const XS=[0.28, 4.90];
  const YS=[0.97, 2.33, 3.69];

  const roadmap = [
    { phase:"Phase 6", timeline:"Q3 2026", icon:"🌦️", title:"Weather Data Fusion",      body:"Integrate IMD (India Meteorological Department) API. Correlate rainfall, temperature, and humidity with crop price volatility. Weather-augmented Gemini advisory.", color:C.cyan },
    { phase:"Phase 7", timeline:"Q3 2026", icon:"📱", title:"Mobile App",                body:"React Native PWA with offline DuckDB cache. WhatsApp bot for voice-based price queries. Designed for 2G connectivity — <200KB initial payload.", color:C.emerald },
    { phase:"Phase 8", timeline:"Q4 2026", icon:"🏛️", title:"eNAM Live Integration",     body:"Connect to the National Agriculture Market (eNAM) real-time API for live mandi arrivals and trade volumes — replacing inferred supply/demand signals.", color:C.blue },
    { phase:"Phase 9", timeline:"Q4 2026", icon:"🛰️", title:"Satellite Yield Prediction", body:"Fuse NDVI satellite imagery (Sentinel-2) with price models. Predict supply shocks 6–8 weeks ahead by tracking crop health across South Indian districts.", color:C.violet },
    { phase:"Phase 10", timeline:"Q1 2027", icon:"🔔", title:"Proactive Alert System",    body:"Push notification framework for price anomaly alerts, forecast reversals, and seasonal entry windows. Subscriptions per crop × state × threshold.", color:C.amber },
    { phase:"Phase 11", timeline:"Q1 2027", icon:"🤝", title:"Cooperative Intelligence",  body:"Multi-tenant platform for Farmer Producer Organisations (FPOs). Shared crop pools, collective bargaining signals, inter-mandi arbitrage identification.", color:C.emerald },
  ];

  roadmap.forEach((r, i) => {
    const x = XS[i%2], y = YS[Math.floor(i/2)];
    glassCard(s, x, y, CW, CH, {fill:C.card, border:r.color, lw:1.2, shadow:mkShadow()});
    s.addShape(pptx.shapes.RECTANGLE, {x, y, w:0.05, h:CH,
      fill:{color:r.color}, line:{color:r.color, width:0}});
    // Phase badge
    pill(s, x+0.14, y+0.10, 0.74, 0.20, r.color, 75);
    s.addText(r.phase, {x:x+0.14, y:y+0.10, w:0.74, h:0.20,
      fontSize:7, fontFace:"Arial Black", color:r.color,
      align:"center", valign:"middle", bold:true});
    // Timeline
    s.addText(r.timeline, {x:x+0.96, y:y+0.10, w:1.20, h:0.20,
      fontSize:7, fontFace:"Calibri", color:C.gray2, valign:"middle"});
    // Icon + title
    s.addText(r.icon+" "+r.title, {x:x+0.14, y:y+0.36, w:CW-0.22, h:0.24,
      fontSize:10, fontFace:"Arial Black", color:r.color, bold:true, valign:"middle"});
    // Body
    s.addText(r.body, {x:x+0.14, y:y+0.62, w:CW-0.22, h:CH-0.68,
      fontSize:7.5, fontFace:"Calibri", color:C.gray1, valign:"top"});
  });

  chipStrip(s, ["Phase 6–11 Roadmap", "Weather + IMD API", "Mobile PWA · WhatsApp", "eNAM Live Data", "Satellite NDVI Yield"], C.violet);
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 36 — Conclusion
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 36, "CONCLUSION",
    "AgroPrice AI — What We Built and Why It Matters",
    "End-to-end agricultural intelligence · grounded AI · real data · real decisions · real impact",
    C.emerald);

  // 5 conclusion points in a vertical stack with numbered accent
  const pts = [
    { n:"01", txt:"Closes the intelligence gap.",      desc:"48.2M AGMARKNET records transformed into actionable price intelligence for South Indian farmers, traders, and agribusinesses — democratising market access.", color:C.emerald },
    { n:"02", txt:"Grounded AI prevents harm.",        desc:"Deterministic engine generates every number. Gemini 2.5 Flash narrates insights about real data. Zero hallucination by architectural design, verified end-to-end.", color:C.cyan },
    { n:"03", txt:"Multi-agent depth, not gimmick.",   desc:"7-agent specialist council (Phase 5), regime detection, probability engine, and cross-market influence graph — all deterministic, traceable, and explainable.", color:C.blue },
    { n:"04", txt:"Production-grade, deployable now.", desc:"FastAPI :8001 + React+Vite :5173 + DuckDB + Prophet/XGBoost stack. 5-phase iterative build from Jan–Jun 2026. Extensible for FPOs and government agri-portals.", color:C.violet },
    { n:"05", txt:"Blueprint for responsible AI.",     desc:"Clear deterministic ↔ LLM boundary, domain guardrails, confidence scoring, and a 7-stage auditable pipeline. A reusable framework for any agricultural AI system.", color:C.amber },
  ];

  const PH=0.74, GAP=0.07;
  pts.forEach((p, i) => {
    const y = 0.97 + i*(PH+GAP);
    glassCard(s, 0.28, y, 9.44, PH, {fill:C.card, border:p.color, lw:1.2, shadow:mkShadow()});
    s.addShape(pptx.shapes.RECTANGLE, {x:0.28, y, w:0.05, h:PH,
      fill:{color:p.color}, line:{color:p.color, width:0}});
    // Number
    pill(s, 0.38, y+(PH-0.28)/2, 0.38, 0.28, p.color, 72);
    s.addText(p.n, {x:0.38, y:y+(PH-0.28)/2, w:0.38, h:0.28,
      fontSize:9, fontFace:"Arial Black", color:p.color,
      align:"center", valign:"middle", bold:true});
    // Bold text
    s.addText(p.txt, {x:0.86, y:y+0.08, w:2.60, h:PH-0.16,
      fontSize:10, fontFace:"Arial Black", color:p.color, bold:true, valign:"middle"});
    // Divider
    s.addShape(pptx.shapes.LINE, {x:3.50, y:y+0.18, w:0, h:PH-0.36,
      line:{color:p.color, width:0.8, transparency:60}});
    // Description
    s.addText(p.desc, {x:3.64, y:y+0.06, w:5.96, h:PH-0.12,
      fontSize:8.5, fontFace:"Calibri", color:C.gray1, valign:"middle"});
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 37 — Contribution
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 37, "CONTRIBUTIONS",
    "Technical & Academic Contributions",
    "Novel architectures · open-source frameworks · domain datasets · reproducible AI design patterns",
    C.blue);

  // Left col: Technical contributions (5 cards)
  // Right col: Academic contributions (3 cards) + team card
  const LX=0.28, RX=5.06, CW=4.52;

  // Section labels
  pill(s, LX, 0.95, 2.20, 0.22, C.blue, 80);
  s.addText("TECHNICAL CONTRIBUTIONS", {x:LX, y:0.95, w:2.20, h:0.22,
    fontSize:7, fontFace:"Arial Black", color:C.blue,
    align:"center", valign:"middle", bold:true});

  pill(s, RX, 0.95, 2.20, 0.22, C.violet, 80);
  s.addText("ACADEMIC CONTRIBUTIONS", {x:RX, y:0.95, w:2.20, h:0.22,
    fontSize:7, fontFace:"Arial Black", color:C.violet,
    align:"center", valign:"middle", bold:true});

  const techItems = [
    { icon:"⚙️", t:"Grounded LLM Architecture",    d:"Novel deterministic ↔ LLM boundary preventing hallucination in domain-specific AI applications. Reusable for any structured-data advisory system.", color:C.emerald },
    { icon:"🤖", t:"Multi-Agent Council Framework", d:"7-specialist agent council with weighted aggregation, dissent detection, and consensus scoring. Extensible to any multi-signal market system.", color:C.cyan },
    { icon:"📈", t:"Sparse-Trend Forecasting",      d:"Custom model for irregular agricultural time-series. Tier A/B/C/D degradation pattern for new-crop cold-start scenarios.", color:C.blue },
    { icon:"🏗️", t:"FastAPI + DuckDB + Gemini Stack", d:"Production blueprint: embedded DuckDB analytics + FastAPI backend + React Vite frontend + SSE streaming + Gemini advisory, fully open-source.", color:C.violet },
    { icon:"🌿", t:"South India Crop Corpus",       d:"48.2M AGMARKNET records (2015–2026) cleaned, indexed in DuckDB Parquet, and enriched with 27-crop registry + 22-signal intelligence framework.", color:C.amber },
  ];

  const acadItems = [
    { icon:"📄", t:"Responsible AI Design Pattern", d:"Demonstrates guardrail architecture, domain scope enforcement, and confidence transparency for LLM-backed advisory systems in high-stakes domains.", color:C.violet },
    { icon:"🔬", t:"Agentic Intelligence Study",    d:"Empirical study of multi-agent consensus vs single-model recommendations across 27 South Indian crops and 5 states (2015–2026 data).", color:C.blue },
    { icon:"🌾", t:"AgriTech AI Framework",         d:"End-to-end open-source framework for agricultural AI: data pipeline, forecasting ensemble, grounded LLM layer, and agentic decision intelligence.", color:C.emerald },
  ];

  const ITEM_H=0.74, ITEM_GAP=0.06;

  techItems.forEach((it, i) => {
    const y = 1.24 + i*(ITEM_H+ITEM_GAP);
    glassCard(s, LX, y, CW, ITEM_H, {fill:C.card, border:it.color, lw:1.0, shadow:mkShadow()});
    s.addShape(pptx.shapes.RECTANGLE, {x:LX, y, w:0.04, h:ITEM_H,
      fill:{color:it.color}, line:{color:it.color, width:0}});
    s.addText(it.icon+" "+it.t, {x:LX+0.14, y:y+0.05, w:CW-0.22, h:0.22,
      fontSize:8.5, fontFace:"Arial Black", color:it.color, bold:true, valign:"middle"});
    s.addText(it.d, {x:LX+0.14, y:y+0.28, w:CW-0.22, h:ITEM_H-0.34,
      fontSize:7.5, fontFace:"Calibri", color:C.gray1, valign:"top"});
  });

  acadItems.forEach((it, i) => {
    const y = 1.24 + i*(ITEM_H+ITEM_GAP);
    glassCard(s, RX, y, CW, ITEM_H, {fill:C.card, border:it.color, lw:1.0, shadow:mkShadow()});
    s.addShape(pptx.shapes.RECTANGLE, {x:RX, y, w:0.04, h:ITEM_H,
      fill:{color:it.color}, line:{color:it.color, width:0}});
    s.addText(it.icon+" "+it.t, {x:RX+0.14, y:y+0.05, w:CW-0.22, h:0.22,
      fontSize:8.5, fontFace:"Arial Black", color:it.color, bold:true, valign:"middle"});
    s.addText(it.d, {x:RX+0.14, y:y+0.28, w:CW-0.22, h:ITEM_H-0.34,
      fontSize:7.5, fontFace:"Calibri", color:C.gray1, valign:"top"});
  });

  // Team card bottom-right
  const TCY = 1.24 + 3*(ITEM_H+ITEM_GAP);
  glassCard(s, RX, TCY, CW, ITEM_H, {fill:C.card2, border:C.emerald, lw:1.3, shadow:mkShadow()});
  s.addShape(pptx.shapes.RECTANGLE, {x:RX, y:TCY, w:0.04, h:ITEM_H,
    fill:{color:C.emerald}, line:{color:C.emerald, width:0}});
  s.addText("🎓 MCA Research Project — 2nd Semester", {
    x:RX+0.14, y:TCY+0.05, w:CW-0.22, h:0.22,
    fontSize:8.5, fontFace:"Arial Black", color:C.emerald, bold:true, valign:"middle"});
  s.addText("Department of Master of Computer Applications\nR.V. College of Engineering, Bengaluru · June 2026\nGuided under Generative AI Elective", {
    x:RX+0.14, y:TCY+0.28, w:CW-0.22, h:ITEM_H-0.34,
    fontSize:7.5, fontFace:"Calibri", color:C.gray1, valign:"top"});

  divider(s, 4.84, 0.95, 0, C.border2);
  s.addShape(pptx.shapes.LINE, {x:4.84, y:0.95, w:0, h:4.20,
    line:{color:C.border2, width:0.8, transparency:40}});
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 38 — References
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  header(s, 38, "REFERENCES",
    "Data Sources, Research & Technology Stack",
    "All data · models · frameworks · and libraries that power AgroPrice AI",
    C.gray1);

  const refs = [
    { n:"01", cat:"Dataset",       color:C.blue,    text:"AGMARKNET (Agricultural Marketing Information Network). Directorate of Marketing & Inspection, Government of India. Daily mandi prices 2015–2026. data.gov.in" },
    { n:"02", cat:"Forecasting",   color:C.emerald, text:'Taylor, S.J. & Letham, B. (2018). "Forecasting at Scale." The American Statistician, 72(1), 37–45. doi:10.1080/00031305.2017.1380080 — Facebook Prophet.' },
    { n:"03", cat:"Forecasting",   color:C.emerald, text:'Chen, T. & Guestrin, C. (2016). "XGBoost: A Scalable Tree Boosting System." Proc. 22nd ACM SIGKDD, pp. 785–794. doi:10.1145/2939672.2939785' },
    { n:"04", cat:"LLM / AI",      color:C.violet,  text:"Google DeepMind (2024). Gemini: A Family of Highly Capable Multimodal Models. Technical Report. Accessed via Google AI Studio — model: gemini-2.5-flash." },
    { n:"05", cat:"Database",      color:C.cyan,    text:'Raasveldt, M. & Mühleisen, H. (2019). "DuckDB: An Embeddable Analytical Database." Proc. SIGMOD 2019. doi:10.1145/3299869.3320212' },
    { n:"06", cat:"Backend",       color:C.amber,   text:"Ramírez, S. (2018–2026). FastAPI — High Performance Python Web Framework. fastapi.tiangolo.com. Used with uvicorn ASGI server (v0.20+)." },
    { n:"07", cat:"Frontend",      color:C.blue,    text:"Meta Open Source (2013–2026). React — A JavaScript Library for Building User Interfaces. react.dev. Vite build system by Evan You (vitejs.dev)." },
    { n:"08", cat:"Styling",       color:C.gray2,   text:"Tailwind CSS (v3.4). A utility-first CSS framework. tailwindcss.com. TailwindCSS UI + custom glassmorphism + Bloomberg-style dark theme." },
  ];

  const RH=0.56, GAP=0.04;
  refs.forEach((r, i) => {
    const y = 0.97 + i*(RH+GAP);
    glassCard(s, 0.28, y, 9.44, RH, {
      fill: i%2===0 ? C.card : C.bg2,
      border: r.color, lw: 0.8, shadow:mkShadow()});
    // Number badge
    pill(s, 0.36, y+(RH-0.24)/2, 0.28, 0.24, r.color, 75);
    s.addText(r.n, {x:0.36, y:y+(RH-0.24)/2, w:0.28, h:0.24,
      fontSize:8, fontFace:"Arial Black", color:r.color,
      align:"center", valign:"middle", bold:true});
    // Category pill
    pill(s, 0.72, y+(RH-0.20)/2, 0.80, 0.20, r.color, 82);
    s.addText(r.cat, {x:0.72, y:y+(RH-0.20)/2, w:0.80, h:0.20,
      fontSize:6.5, fontFace:"Arial Black", color:r.color,
      align:"center", valign:"middle", bold:true});
    // Reference text
    s.addText(r.text, {x:1.62, y:y+0.04, w:8.00, h:RH-0.08,
      fontSize:7.5, fontFace:"Calibri", color:C.gray1, valign:"middle"});
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 39 — Thank You (Cinematic Closing)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();

  // Deep dark background
  s.addShape(pptx.shapes.RECTANGLE, { x:0, y:0, w:10, h:5.625,
    fill:{color:"020b18"}, line:{color:"020b18"} });

  // Layered ambient glows — multiple ovals
  s.addShape(pptx.shapes.OVAL, { x:-1.0, y:0.5, w:6.0, h:4.0,
    fill:{color:"10B981", transparency:95}, line:{color:"10B981", transparency:100} });
  s.addShape(pptx.shapes.OVAL, { x:4.5,  y:0.8, w:6.5, h:4.5,
    fill:{color:"3B82F6", transparency:94}, line:{color:"3B82F6", transparency:100} });
  s.addShape(pptx.shapes.OVAL, { x:2.5,  y:2.5, w:5.0, h:3.0,
    fill:{color:"8B5CF6", transparency:96}, line:{color:"8B5CF6", transparency:100} });

  // Horizontal scan line above center
  s.addShape(pptx.shapes.LINE, { x:0.40, y:2.02, w:9.20, h:0,
    line:{color:"10B981", width:0.6, transparency:70} });
  s.addShape(pptx.shapes.LINE, { x:0.40, y:3.82, w:9.20, h:0,
    line:{color:"3B82F6", width:0.6, transparency:70} });

  // Top module label
  pill(s, 3.50, 0.32, 3.00, 0.26, "10B981", 80);
  s.addText("AGROPRICE AI  ·  MCA PROJECT  ·  2026", {
    x:3.50, y:0.32, w:3.00, h:0.26,
    fontSize:7.5, fontFace:"Arial Black", color:"10B981",
    align:"center", valign:"middle", bold:true });

  // Main "Thank You" — massive cinematic text
  s.addText("Thank You", {
    x:0.30, y:0.68, w:9.40, h:1.30,
    fontSize:72, fontFace:"Arial Black", color:"FFFFFF",
    bold:true, align:"center", valign:"middle" });

  // Tagline
  s.addText("Empowering South India's Farmers with Grounded Artificial Intelligence", {
    x:0.50, y:2.10, w:9.00, h:0.36,
    fontSize:13, fontFace:"Calibri", color:"E2E8F0",
    align:"center", valign:"middle", italic:true });

  // Stats row — 3 glass pills in a row
  const stats = [
    { v:"48.2M Records", sub:"AGMARKNET 2015–2026", color:"10B981" },
    { v:"Gemini 2.5 Flash", sub:"Grounded · Zero Hallucination", color:"3B82F6" },
    { v:"Phase 5 Complete", sub:"7-Agent Decision Council", color:"8B5CF6" },
  ];

  stats.forEach((st, i) => {
    const sw=2.80, sx=0.55 + i*(sw+0.28), sy=2.60;
    glassCard(s, sx, sy, sw, 0.66, {fill:"0d1a2e", border:st.color, lw:1.3, shadow:mkShadow()});
    s.addShape(pptx.shapes.RECTANGLE, {x:sx, y:sy, w:0.04, h:0.66,
      fill:{color:st.color}, line:{color:st.color, width:0}});
    s.addText(st.v, {x:sx+0.14, y:sy+0.04, w:sw-0.20, h:0.28,
      fontSize:11, fontFace:"Arial Black", color:st.color, bold:true, valign:"middle"});
    s.addText(st.sub, {x:sx+0.14, y:sy+0.34, w:sw-0.20, h:0.26,
      fontSize:7.5, fontFace:"Calibri", color:"94A3B8", valign:"middle"});
  });

  // "Questions?" prompt
  s.addText("Questions & Discussion", {
    x:0.30, y:3.40, w:9.40, h:0.38,
    fontSize:18, fontFace:"Arial Black", color:"10B981",
    align:"center", valign:"middle", bold:true });

  // Contact / repo row
  s.addText("sabhilash.mca25@rvce.edu.in   ·   R.V. College of Engineering, Bengaluru   ·   MCA 2nd Semester · GEN AI Elective Project", {
    x:0.30, y:3.84, w:9.40, h:0.22,
    fontSize:8, fontFace:"Calibri", color:"475569",
    align:"center", valign:"middle" });

  // Bottom divider + framework credits
  s.addShape(pptx.shapes.LINE, { x:0.40, y:4.16, w:9.20, h:0,
    line:{color:"1e3a5f", width:0.8, transparency:30} });

  const credits = ["FastAPI + Python 3.13", "DuckDB + Prophet + XGBoost", "React + Vite + TailwindCSS", "Gemini 2.5 Flash", "AGMARKNET · Gov. of India"];
  const cw = 9.40/credits.length;
  credits.forEach((cr, i) => {
    s.addText(cr, {x:0.30+i*cw, y:4.24, w:cw, h:0.18,
      fontSize:7, fontFace:"Calibri", color:"2a4a7a",
      align:"center", valign:"middle"});
  });

  // Slide counter
  s.addText("39/39", {x:8.80, y:0.07, w:0.90, h:0.23,
    fontSize:8, fontFace:"Calibri", color:"475569", align:"right", valign:"middle"});

  // Small AgroPrice AI watermark bottom right
  s.addText("AgroPrice AI", {x:7.60, y:5.28, w:2.00, h:0.22,
    fontSize:7.5, fontFace:"Arial Black", color:"1e3a5f",
    align:"right", valign:"middle"});
}


// ── Generate ──────────────────────────────────────────────────────────────────
const outPath = "D:/mca/2nd semester/GEN AI/EL Project/AgroPrice-AI/presentation/AgroPrice_AI_Slides_30_39.pptx";
pptx.writeFile({ fileName: outPath })
  .then(() => console.log("✓ Slides 30–39 written →", outPath))
  .catch(err => { console.error("ERROR:", err); process.exit(1); });
