"use strict";
const pptxgen = require("pptxgenjs");

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:       "050816",
  bg2:      "07101f",
  card:     "0d1a2e",
  card2:    "0f2040",
  border:   "1e3a5f",
  border2:  "2a4a7a",
  emerald:  "10B981",
  emeraldD: "059669",
  cyan:     "06B6D4",
  blue:     "3B82F6",
  blueD:    "1D4ED8",
  violet:   "8B5CF6",
  amber:    "F59E0B",
  red:      "EF4444",
  white:    "FFFFFF",
  gray1:    "E2E8F0",
  gray2:    "94A3B8",
  gray3:    "475569",
};

// ─── FACTORY FUNCTIONS (fresh object every call — prevents PptxGenJS mutation bug) ───
const mkShadow  = () => ({ type:"outer", color:"000000", opacity:0.55, blur:18, offset:6,  angle:135 });
const mkGlowE   = () => ({ type:"outer", color:"10B981", opacity:0.18, blur:24, offset:0,  angle:0   });
const mkGlowB   = () => ({ type:"outer", color:"3B82F6", opacity:0.20, blur:22, offset:0,  angle:0   });
const mkGlowV   = () => ({ type:"outer", color:"8B5CF6", opacity:0.20, blur:22, offset:0,  angle:0   });

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
function addBg(s, color) { s.background = { color: color || C.bg }; }

function glow(s, x, y, w, h, color, transp) {
  s.addShape("ellipse", { x,y,w,h,
    fill:{ color, transparency: transp||88 },
    line:{ color, transparency:100 },
  });
}

function accentBar(s, x, y, h, color) {
  s.addShape("rect", { x,y, w:0.06, h,
    fill:{ color: color||C.emerald },
    line:{ color: color||C.emerald, transparency:100 },
  });
}

function glassCard(s, x, y, w, h, opts={}) {
  s.addShape("rect", { x,y,w,h,
    fill:{ color: opts.fill||C.card, transparency: opts.fillT||0 },
    line:{ color: opts.border||C.border, width: opts.lw||1.0 },
    shadow: opts.shadow||null,
  });
}

function chip(s, x, y, w, h, color, transp) {
  s.addShape("rect", { x,y,w,h,
    fill:{ color, transparency: transp||75 },
    line:{ color, transparency:55, width:0.8 },
  });
}

function dot(s, x, y, size, color) {
  s.addShape("ellipse", { x,y, w:size, h:size,
    fill:{ color },
    line:{ color, transparency:100 },
  });
}

function pill(s, x, y, w, h, color, transp) {
  s.addShape("roundRect", { x,y,w,h,
    fill:{ color, transparency: transp||80 },
    line:{ color, transparency:50, width:0.8 },
    rectRadius:0.12,
  });
}

function circle(s, x, y, r, fill, border) {
  s.addShape("ellipse", { x,y, w:r, h:r,
    fill:{ color: fill },
    line:{ color: border||fill, width:1.5 },
  });
}

function hRule(s, x, y, w, color, transp) {
  s.addShape("line", { x,y,w, h:0,
    line:{ color: color||C.border2, width:0.8, transparency: transp||0 },
  });
}

// ─── TEXT SHORTCUTS ───────────────────────────────────────────────────────────
function heroText(s, text, x, y, w, h, size, color, align) {
  s.addText(text, { x,y,w,h,
    fontSize: size||52, fontFace:"Arial Black", color: color||C.white,
    bold:true, align: align||"left", valign:"middle", margin:0,
  });
}

function bodyText(s, text, x, y, w, h, size, color, align) {
  s.addText(text, { x,y,w,h,
    fontSize: size||13, fontFace:"Calibri", color: color||C.gray1,
    align: align||"left", valign:"top", margin:0,
  });
}

function sectionTag(s, text, x, y, color) {
  chip(s, x, y, 2.60, 0.25, color, 80);
  s.addText(text, { x, y, w:2.60, h:0.25,
    fontSize:8, fontFace:"Calibri", color, bold:true,
    align:"center", valign:"middle", margin:0, charSpacing:1.5,
  });
}

function slideTitle(s, text, x, y, w) {
  s.addText(text, { x, y, w: w||9.3, h:0.68,
    fontSize:36, fontFace:"Arial Black", color:C.white,
    bold:true, align:"left", valign:"middle", margin:0,
  });
}

function labelText(s, text, x, y, w, h, size, color) {
  s.addText(text, { x,y,w,h,
    fontSize: size||9, fontFace:"Calibri", color: color||C.gray2,
    align:"left", valign:"middle", margin:0, charSpacing:1.8, bold:true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENTATION
// ═══════════════════════════════════════════════════════════════════════════════
const pres = new pptxgen();
pres.layout  = "LAYOUT_16x9";   // 10 × 5.625 inches
pres.author  = "S. Abhilash";
pres.title   = "AgroPrice AI — Gen AI Project";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 1 — TITLE
// Layout verified: all elements ≤ y 5.40 (slide height 5.625)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);

  // Ambient glows
  glow(s, -1.5, -1.0, 5.5, 4.5, C.emerald, 84);
  glow(s,  6.5,  2.0, 5.5, 4.5, C.blue,    86);
  glow(s,  3.5, -0.5, 4.0, 3.5, C.violet,  91);

  // Left accent bar
  s.addShape("rect", { x:0, y:0, w:0.18, h:5.625,
    fill:{ color:C.emerald, transparency:60 },
    line:{ color:C.emerald, transparency:100 },
  });

  // Top tag
  sectionTag(s, "GEN AI PROJECT  ·  MCA 2ND SEMESTER  ·  RVCE", 0.35, 0.28, C.cyan);

  // Main title — "AgroPrice " in white, "AI" in emerald
  s.addText([
    { text:"AgroPrice ", options:{ color:C.white } },
    { text:"AI",        options:{ color:C.emerald } },
  ], { x:0.35, y:0.66, w:9.3, h:1.42,
    fontSize:72, fontFace:"Arial Black", bold:true,
    align:"left", valign:"middle", margin:0,
  });

  // Subtitle
  s.addText("AI-Powered Agricultural Market Intelligence & Forecasting Platform", {
    x:0.35, y:2.16, w:8.0, h:0.50,
    fontSize:17, fontFace:"Calibri", color:C.gray1,
    align:"left", valign:"middle", margin:0,
  });

  // State coverage line
  s.addText("Tamil Nadu  ·  Karnataka  ·  Andhra Pradesh  ·  Kerala  ·  Telangana", {
    x:0.35, y:2.70, w:8.0, h:0.30,
    fontSize:11.5, fontFace:"Calibri", color:C.gray2,
    charSpacing:1.5, align:"left", valign:"middle", margin:0,
  });

  hRule(s, 0.35, 3.10, 9.30, C.border2, 30);

  // Team section: 3 members (left) + Professor (right)
  pill(s, 0.35, 3.14, 2.10, 0.20, C.emerald, 80);
  s.addText("TEAM  MEMBERS", { x:0.35, y:3.14, w:2.10, h:0.20,
    fontSize:7, fontFace:"Calibri", color:C.emerald, bold:true,
    align:"center", valign:"middle", charSpacing:2, margin:0 });

  pill(s, 7.02, 3.14, 2.60, 0.20, C.violet, 80);
  s.addText("UNDER THE GUIDANCE OF", { x:7.02, y:3.14, w:2.60, h:0.20,
    fontSize:7, fontFace:"Calibri", color:C.violet, bold:true,
    align:"center", valign:"middle", charSpacing:1.5, margin:0 });

  // Team member cards
  [
    { name:"S Abhilash",  usn:"1RV25MC084", color:C.emerald },
    { name:"Rajath S",    usn:"1RV25MC080", color:C.cyan    },
    { name:"Praveen K R", usn:"1RV25MC076", color:C.blue    },
  ].forEach((m, i) => {
    const mx = 0.35 + i * 2.18;
    glassCard(s, mx, 3.38, 2.08, 0.50, {fill:C.card2, border:m.color, lw:1.0, shadow:mkShadow()});
    s.addShape("rect", {x:mx, y:3.38, w:0.04, h:0.50,
      fill:{color:m.color}, line:{color:m.color, transparency:100}});
    s.addText(m.name, {x:mx+0.12, y:3.40, w:1.88, h:0.24,
      fontSize:11, fontFace:"Arial Black", color:m.color,
      bold:true, align:"left", valign:"middle", margin:0});
    s.addText(m.usn, {x:mx+0.12, y:3.63, w:1.88, h:0.20,
      fontSize:8.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"middle", charSpacing:1.5, margin:0});
  });

  // Professor card
  glassCard(s, 7.02, 3.38, 2.60, 0.50, {fill:C.card2, border:C.violet, lw:1.2, shadow:mkShadow()});
  s.addShape("rect", {x:7.02, y:3.38, w:0.04, h:0.50,
    fill:{color:C.violet}, line:{color:C.violet, transparency:100}});
  s.addText("Prof. Usha J", {x:7.14, y:3.40, w:2.40, h:0.24,
    fontSize:11, fontFace:"Arial Black", color:C.violet,
    bold:true, align:"left", valign:"middle", margin:0});
  s.addText("Dept. of MCA  ·  RVCE, Bengaluru", {x:7.14, y:3.63, w:2.40, h:0.20,
    fontSize:8.5, fontFace:"Calibri", color:C.gray2,
    align:"left", valign:"middle", charSpacing:1, margin:0});

  // 4 stat chips — y=4.00, h=0.82, bottom=4.82 ✓
  const stats = [
    { val:"27",      lbl:"CROPS",     col:C.emerald },
    { val:"5",       lbl:"STATES",    col:C.cyan    },
    { val:"12 YRS",  lbl:"2015–2026", col:C.blue    },
    { val:"GEMINI",  lbl:"2.5 FLASH", col:C.violet  },
  ];
  stats.forEach((st, i) => {
    const x = 0.35 + i * 2.38;
    glassCard(s, x, 4.00, 2.10, 0.82, { fill:C.card2, border:st.col, lw:1.0, shadow:mkShadow() });
    s.addText(st.val, { x:x+0.12, y:4.06, w:1.86, h:0.36,
      fontSize:20, fontFace:"Arial Black", color:st.col,
      bold:true, align:"center", valign:"middle", margin:0,
    });
    s.addText(st.lbl, { x:x+0.12, y:4.44, w:1.86, h:0.24,
      fontSize:8.5, fontFace:"Calibri", color:C.gray2,
      charSpacing:2, align:"center", valign:"middle", margin:0, bold:true,
    });
  });

  // Email
  s.addText("sabhilash.mca25@rvce.edu.in", { x:6.5, y:5.12, w:3.3, h:0.20,
    fontSize:8, fontFace:"Calibri", color:C.gray3,
    align:"right", valign:"middle", margin:0,
  });

  // Slide number
  s.addText("01", { x:9.6, y:5.36, w:0.32, h:0.20,
    fontSize:8, fontFace:"Calibri", color:C.gray3,
    align:"right", valign:"middle", margin:0,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 2 — PROJECT OVERVIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, -1.0, -1.0, 4.5, 4.0, C.emerald, 90);
  glow(s,  7.5,  2.5, 4.0, 3.5, C.blue,    91);

  sectionTag(s, "01  ·  OVERVIEW", 0.35, 0.22, C.emerald);
  slideTitle(s, "What is AgroPrice AI?", 0.35, 0.58);

  s.addText("An end-to-end agentic platform that converts 12 years of South Indian mandi data into real-time price intelligence, AI-grounded forecasts, and institutional-grade advisory.", {
    x:0.35, y:1.32, w:9.30, h:0.66,
    fontSize:13.5, fontFace:"Calibri", color:C.gray1,
    align:"left", valign:"top", margin:0,
  });

  // 3-column cards: Problem | Engine | Impact
  const cols = [
    { title:"THE PROBLEM", color:C.red,     icon:"⚠",
      lines:["Price volatility with no forecasting","Fragmented mandi data across states","No AI advisory for farmers or traders"] },
    { title:"THE ENGINE",  color:C.cyan,    icon:"⚙",
      lines:["DuckDB + Prophet + SparseTrend ML","Gemini 2.5 Flash grounded narration","7-agent council + probabilistic outlook"] },
    { title:"THE IMPACT",  color:C.emerald, icon:"✦",
      lines:["27 crops × 5 states × 12 years","Real-time streaming AI advisory","Decision intelligence for all user roles"] },
  ];
  cols.forEach((col, i) => {
    const x = 0.30 + i * 3.22;
    const y = 2.14;
    const w = 3.02;
    const h = 2.80;
    glassCard(s, x, y, w, h, { fill:C.card, border:col.color, lw:1.2, shadow:mkShadow() });
    accentBar(s, x, y, h, col.color);

    s.addText(col.icon, { x:x+0.18, y:y+0.12, w:0.48, h:0.46,
      fontSize:22, fontFace:"Calibri", color:col.color,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(col.title, { x:x+0.70, y:y+0.14, w:2.18, h:0.36,
      fontSize:11, fontFace:"Arial Black", color:col.color,
      bold:true, align:"left", valign:"middle", margin:0, charSpacing:1.5,
    });
    hRule(s, x+0.16, y+0.62, w-0.32, col.color, 68);

    col.lines.forEach((line, j) => {
      s.addText([
        { text:"▸  ", options:{ color:col.color, bold:true } },
        { text:line,  options:{ color:C.gray1 } },
      ], { x:x+0.16, y:y+0.76+j*0.58, w:w-0.26, h:0.52,
        fontSize:11.5, fontFace:"Calibri",
        align:"left", valign:"middle", margin:0,
      });
    });
  });

  // Bottom stat strip  y=5.00, h=0.36, bottom=5.36 ✓
  const heroStats = [
    { n:"12", u:"Yearly Parquet Files", c:C.amber   },
    { n:"27", u:"Crops Tracked",        c:C.emerald },
    { n:"10", u:"API Route Groups",     c:C.cyan    },
    { n:"39", u:"Live Endpoints",       c:C.blue    },
  ];
  heroStats.forEach((hs, i) => {
    const x = 0.30 + i * 2.42;
    pill(s, x, 5.02, 2.22, 0.34, hs.c, 82);
    s.addText(`${hs.n}  ${hs.u}`, { x:x+0.10, y:5.02, w:2.02, h:0.34,
      fontSize:10.5, fontFace:"Calibri", color:hs.c,
      bold:true, align:"center", valign:"middle", margin:0,
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 3 — INTRODUCTION
// Fixed: cap cards repositioned so none overlap the bottom bar; bottom bar at y=4.96
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,  5.5, -0.5, 5.5, 4.0, C.violet, 89);
  glow(s, -1.0,  2.0, 4.0, 3.5, C.cyan,   92);

  sectionTag(s, "02  ·  INTRODUCTION", 0.35, 0.22, C.violet);
  slideTitle(s, "Introduction", 0.35, 0.58);

  // Left narrative card — h=2.98, bottom=4.40 ✓
  glassCard(s, 0.30, 1.42, 4.40, 2.98, { fill:C.card2, border:C.violet, lw:1.2, shadow:mkShadow() });
  accentBar(s, 0.30, 1.42, 2.98, C.violet);
  s.addText("The Market Intelligence Gap", { x:0.52, y:1.54, w:4.00, h:0.34,
    fontSize:13, fontFace:"Arial Black", color:C.violet,
    bold:true, align:"left", valign:"middle", margin:0,
  });
  hRule(s, 0.50, 1.94, 3.90, C.violet, 68);
  s.addText(
    "South Indian agricultural markets move thousands of crores of rupees — yet most farmers and traders "
    +"navigate price decisions with little more than guesswork.\n\n"
    +"AgroPrice AI replaces that uncertainty with real-time intelligence grounded in 12 years of AGMARKNET "
    +"mandi price data across 5 states and 27 crops.",
    { x:0.52, y:2.02, w:3.96, h:2.28,
      fontSize:12, fontFace:"Calibri", color:C.gray1,
      align:"left", valign:"top", margin:0,
    }
  );

  // 4 right capability cards — h=0.66, spacing=0.74
  // Card 0: y=1.42   bottom=2.08
  // Card 1: y=2.16   bottom=2.82
  // Card 2: y=2.90   bottom=3.56
  // Card 3: y=3.64   bottom=4.30 ✓
  const caps = [
    { icon:"📈", title:"Price Forecasting",     desc:"7d / 30d / 90d Prophet predictions with calibrated confidence bands",  color:C.emerald },
    { icon:"🤖", title:"Gemini AI Advisory",    desc:"Streaming conversational AI grounded in real DuckDB metrics",          color:C.blue    },
    { icon:"⚡", title:"Anomaly Detection",      desc:"Rolling z-score spike/crash detection across all 27 crops",           color:C.amber   },
    { icon:"🎯", title:"Decision Intelligence",  desc:"7-agent council + probabilistic outlook + 4 analyst personas",        color:C.violet  },
  ];
  caps.forEach((cap, i) => {
    const x = 4.90;
    const y = 1.42 + i * 0.74;
    glassCard(s, x, y, 4.80, 0.66, { fill:C.card, border:cap.color, lw:1.0, shadow:mkShadow() });
    accentBar(s, x, y, 0.66, cap.color);
    s.addText(cap.icon, { x:x+0.18, y, w:0.50, h:0.66,
      fontSize:20, fontFace:"Calibri", color:cap.color,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(cap.title, { x:x+0.76, y:y+0.05, w:3.80, h:0.24,
      fontSize:12, fontFace:"Arial Black", color:cap.color,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(cap.desc, { x:x+0.76, y:y+0.32, w:3.80, h:0.28,
      fontSize:9.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"middle", margin:0,
    });
  });

  // Bottom highlight bar  y=4.54, h=0.48, bottom=5.02 ✓
  glassCard(s, 0.30, 4.54, 9.40, 0.48, { fill:C.card2, border:C.cyan, lw:0.8 });
  s.addText("Platform scope:  27 Crops  ·  5 South Indian States  ·  AGMARKNET 2015–2026  ·  Gemini 2.5 Flash", {
    x:0.50, y:4.54, w:9.00, h:0.48,
    fontSize:12, fontFace:"Calibri", color:C.cyan,
    align:"center", valign:"middle", margin:0,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 4 — OBJECTIVES
// Fixed: Card 8 accent changed from gray to blue for visual consistency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 3.5, 1.5, 5.0, 4.0, C.emerald, 92);

  sectionTag(s, "03  ·  OBJECTIVES", 0.35, 0.22, C.emerald);
  slideTitle(s, "Project Objectives", 0.35, 0.58);

  const objs = [
    { num:"01", title:"Price Forecasting",        desc:"Multi-horizon Prophet forecasts (7d / 30d / 90d) with calibrated confidence bands for all 27 crops", color:C.emerald },
    { num:"02", title:"Anomaly Detection",         desc:"Rolling z-score spike/crash detection; severity low/medium/high over a 90-day lookback window",      color:C.red     },
    { num:"03", title:"Conversational AI Advisor", desc:"Grounded multi-turn Gemini advisory with session memory, entity extraction & 4 analyst personas",   color:C.blue    },
    { num:"04", title:"Market Regime Detection",   desc:"7 market regime classifications (Bullish Expansion to Panic Volatility) via deterministic signal fusion",color:C.amber  },
    { num:"05", title:"Cross-Crop Intelligence",   desc:"25+ crop relationship graph (complement/substitute/seasonal/regional) with contagion risk scoring",  color:C.cyan    },
    { num:"06", title:"Explainable AI",            desc:"6-stage decision trace, confidence engine, correlation signals — every response is fully traceable", color:C.violet  },
    { num:"07", title:"Probabilistic Decisions",   desc:"Heuristic up/down/sideways probabilities + volatility shock + reversal risk per crop and state",    color:C.emeraldD},
    { num:"08", title:"Institutional Reporting",   desc:"Executive synthesis with 5 market postures, Bloomberg-style briefings, PDF/Excel report generation", color:C.cyan    },
  ];

  // 2×4 grid  card h=0.82, spacing=0.88
  // Row 0 cards: y=1.36  bottom=2.18
  // Row 1 cards: y=2.24  bottom=3.06
  // Row 2 cards: y=3.12  bottom=3.94
  // Row 3 cards: y=4.00  bottom=4.82 ✓
  objs.forEach((obj, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.30 + col * 4.88;
    const y = 1.36 + row * 0.88;
    const w = 4.64;
    const h = 0.80;

    glassCard(s, x, y, w, h, { fill:C.card, border:obj.color, lw:1.0, shadow:mkShadow() });

    circle(s, x+0.14, y+0.18, 0.44, C.card2, obj.color);
    s.addText(obj.num, { x:x+0.14, y:y+0.18, w:0.44, h:0.44,
      fontSize:11, fontFace:"Arial Black", color:obj.color,
      bold:true, align:"center", valign:"middle", margin:0,
    });
    s.addText(obj.title, { x:x+0.70, y:y+0.06, w:w-0.82, h:0.28,
      fontSize:11.5, fontFace:"Arial Black", color:obj.color,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(obj.desc, { x:x+0.70, y:y+0.36, w:w-0.82, h:0.38,
      fontSize:9.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"top", margin:0,
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 5 — PROBLEM STATEMENT
// Fixed: pillar card h reduced to 2.74 (bottom=4.90); solution bar at y=5.02
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, -1.0, -0.5, 5.0, 4.0, C.red,   88);
  glow(s,  7.0,  2.5, 4.5, 3.5, C.amber, 90);

  sectionTag(s, "04  ·  PROBLEM STATEMENT", 0.35, 0.22, C.red);
  slideTitle(s, "The Problem", 0.35, 0.58);

  // Hero warning strip
  glassCard(s, 0.30, 1.38, 9.40, 0.54, { fill:"1a0808", border:C.red, lw:1.2 });
  s.addText("Agricultural price volatility devastates millions — yet farmers navigate markets with guesswork and fragmented phone calls.", {
    x:0.50, y:1.38, w:9.00, h:0.54,
    fontSize:13, fontFace:"Calibri", color:C.gray1,
    align:"center", valign:"middle", margin:0, italic:true,
  });

  // 3 pillar cards  y=2.08, h=2.74, bottom=4.82 ✓
  const problems = [
    {
      icon:"📉", title:"Price Volatility Crisis", stat:"400%", statL:"swing within 90 days",
      color:C.red,
      points:["Tomato prices crash post-harvest then spike 4× in off-season",
              "No forecasting system exists for mandi-level prediction",
              "Farmers sell at market bottoms due to post-harvest pressure"],
    },
    {
      icon:"🗄",  title:"Data Fragmentation", stat:"815", statL:"data-entry errors removed",
      color:C.amber,
      points:["AGMARKNET has 3+ Variety rows per crop/day — no deduplication",
              "Raw dataset contains prices up to Rs 918 million",
              "No unified analytics layer across 5 South Indian states"],
    },
    {
      icon:"🧠", title:"Intelligence Gap", stat:"ZERO", statL:"AI advisory for farmers",
      color:C.violet,
      points:["Traders rely on phone networks and delayed mandi reports",
              "No cross-crop relationship analysis for arbitrage decisions",
              "Zero explainable AI to justify a sell/hold recommendation"],
    },
  ];

  problems.forEach((prob, i) => {
    const x = 0.30 + i * 3.22;
    const y = 2.08;
    const w = 3.02;
    const h = 2.74;

    glassCard(s, x, y, w, h, { fill:C.card, border:prob.color, lw:1.2, shadow:mkShadow() });
    accentBar(s, x, y, h, prob.color);

    s.addText(prob.icon, { x:x+0.18, y:y+0.10, w:0.50, h:0.46,
      fontSize:22, fontFace:"Calibri", color:prob.color,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(prob.title, { x:x+0.72, y:y+0.10, w:2.16, h:0.46,
      fontSize:11.5, fontFace:"Arial Black", color:prob.color,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    hRule(s, x+0.14, y+0.64, w-0.28, prob.color, 65);

    // Stat block
    s.addText(prob.stat, { x:x+0.14, y:y+0.74, w:w-0.28, h:0.48,
      fontSize:32, fontFace:"Arial Black", color:prob.color,
      bold:true, align:"center", valign:"middle", margin:0,
    });
    s.addText(prob.statL, { x:x+0.14, y:y+1.22, w:w-0.28, h:0.22,
      fontSize:8.5, fontFace:"Calibri", color:C.gray2,
      charSpacing:1, align:"center", valign:"middle", margin:0,
    });
    hRule(s, x+0.14, y+1.50, w-0.28, prob.color, 72);

    // 3 bullet points
    prob.points.forEach((pt, j) => {
      s.addText([
        { text:"›  ", options:{ color:prob.color, bold:true } },
        { text:pt,    options:{ color:C.gray1 } },
      ], { x:x+0.14, y:y+1.60+j*0.36, w:w-0.22, h:0.32,
        fontSize:9.5, fontFace:"Calibri",
        align:"left", valign:"top", margin:0,
      });
    });
  });

  // Solution teaser  y=5.02, h=0.30, bottom=5.32 ✓
  glassCard(s, 0.30, 5.02, 9.40, 0.30, { fill:"0a1408", border:C.emerald, lw:0.8 });
  s.addText("SOLUTION  →  AgroPrice AI delivers grounded AI intelligence so every market decision is backed by real data", {
    x:0.50, y:5.02, w:9.00, h:0.30,
    fontSize:9.5, fontFace:"Calibri", color:C.emerald,
    align:"center", valign:"middle", margin:0, bold:true,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 6 — APPLICATIONS
// Fixed: removed j*0.00 bug; each role card shows desc + ONE feature correctly
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 3.0, 1.5, 6.0, 4.5, C.cyan, 91);

  sectionTag(s, "05  ·  APPLICATIONS", 0.35, 0.22, C.cyan);
  slideTitle(s, "Who Benefits?", 0.35, 0.58);

  const roles = [
    { icon:"🌾", title:"Farmer",           color:C.emerald, mode:"Farmer Mode",
      desc:"Should I sell now or wait? Practical harvest-timing guidance in plain language with mandi selection advice.",
      feature:"Sell / Hold / Wait verdict + seasonal timing" },
    { icon:"📦", title:"Wholesale Buyer",  color:C.cyan,    mode:"Wholesale Mode",
      desc:"Procurement timing, bulk pricing windows, cold storage feasibility — cost-conscious supply chain intelligence.",
      feature:"Procurement recommendation + 30d price range" },
    { icon:"📊", title:"Commodity Trader", color:C.blue,    mode:"Trader Mode",
      desc:"7–30d price trajectory, momentum inflection points, volatility as opportunity, and position sizing guidance.",
      feature:"7d momentum signal + volatility regime badge" },
    { icon:"🏛",  title:"Policy Analyst",  color:C.violet,  mode:"Analyst Mode",
      desc:"Full statistical rigour — CV, anomaly clusters, probabilistic outlook with confidence intervals.",
      feature:"Probabilistic outlook (P up/down) + 7-agent council" },
    { icon:"🏭", title:"Procurement Mgr", color:C.amber,   mode:"Wholesale Mode",
      desc:"Food processors: seasonal availability windows, holding cost vs price-movement risk, bulk entry guidance.",
      feature:"Entry / exit price hints + escalation alerts" },
    { icon:"📱", title:"Agri-Business",   color:C.red,     mode:"All Modes",
      desc:"Executive synthesis across all 27 crops — dominant market posture and cross-crop opportunity matrix.",
      feature:"Bloomberg-style briefing + autonomous monitor" },
  ];

  // 3×2 grid  card h=1.78, spacing 1.88
  // Row 0: y=1.38  bottom=3.16
  // Row 1: y=3.26  bottom=5.04 ✓
  roles.forEach((role, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.28 + col * 3.24;
    const y = 1.36 + row * 1.66;   // row 1 bottom = 3.02+1.60 = 4.62 ✓
    const w = 3.04;
    const h = 1.60;

    glassCard(s, x, y, w, h, { fill:C.card, border:role.color, lw:1.0, shadow:mkShadow() });
    accentBar(s, x, y, h, role.color);

    // Icon + title
    s.addText(role.icon, { x:x+0.18, y:y+0.08, w:0.44, h:0.44,
      fontSize:20, fontFace:"Calibri", color:role.color,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(role.title, { x:x+0.68, y:y+0.08, w:2.20, h:0.26,
      fontSize:13, fontFace:"Arial Black", color:role.color,
      bold:true, align:"left", valign:"middle", margin:0,
    });

    // Mode tag
    pill(s, x+0.68, y+0.34, 1.60, 0.20, role.color, 82);
    s.addText(role.mode, { x:x+0.68, y:y+0.34, w:1.60, h:0.20,
      fontSize:7.5, fontFace:"Calibri", color:role.color,
      bold:true, align:"center", valign:"middle", margin:0, charSpacing:1,
    });

    hRule(s, x+0.14, y+0.60, w-0.28, role.color, 70);

    // Description — compact to h=0.48 (card is now h=1.60)
    s.addText(role.desc, { x:x+0.16, y:y+0.68, w:w-0.26, h:0.48,
      fontSize:9.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"top", margin:0,
    });

    // Single feature line — y+1.20 within card, bottom=y+1.50 < h=1.60 ✓
    s.addText([
      { text:"·  ", options:{ color:role.color, bold:true } },
      { text:role.feature, options:{ color:C.gray1 } },
    ], { x:x+0.16, y:y+1.20, w:w-0.24, h:0.30,
      fontSize:9.5, fontFace:"Calibri",
      align:"left", valign:"middle", margin:0,
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 7 — GEN AI CONCEPTS
// Fixed: use-case cards repositioned so card 4 ends at y=4.74; config box at y=4.84
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, -1.0, 0.5, 5.0, 4.5, C.violet, 88);
  glow(s,  7.0, -0.5,4.5, 3.5, C.blue,   90);

  sectionTag(s, "06  ·  GENERATIVE AI CONCEPTS", 0.35, 0.22, C.violet);
  slideTitle(s, "Gen AI Concepts Used", 0.35, 0.58);

  // LEFT: Architecture pipeline layers
  const layers = [
    { label:"AGMARKNET Parquet 2015–2026  (DuckDB lazy view)",       col:C.emerald },
    { label:"Analytics Engine  (volatility · momentum · anomaly · seasonal)", col:C.cyan   },
    { label:"ML Forecasting  (Prophet + SparseTrend → yhat, CI)",    col:C.blue   },
    { label:"PromptContext  —  12-field deterministic data contract", col:C.amber  },
    { label:"Gemini 2.5 Flash  (temperature=0.2, thinking_budget=0)",col:C.violet },
    { label:"Structured Response  →  SSE stream  →  Frontend",       col:C.gray2  },
  ];

  // Layer cards: y=1.42, h=0.48, spacing=0.54
  // Layer 5 (last): y=1.42+5*0.54=4.12 bottom=4.60 ✓
  layers.forEach((layer, i) => {
    const y = 1.42 + i * 0.54;
    glassCard(s, 0.30, y, 5.40, 0.46, { fill:C.card, border:layer.col, lw:1.0 });
    accentBar(s, 0.30, y, 0.46, layer.col);
    s.addText(layer.label, { x:0.52, y, w:5.00, h:0.46,
      fontSize:10.5, fontFace:"Calibri", color:C.gray1,
      align:"left", valign:"middle", margin:0,
    });
    if (i < layers.length - 1) {
      s.addText("▾", { x:2.50, y:y+0.46, w:0.50, h:0.10,
        fontSize:9, fontFace:"Calibri", color:layer.col,
        align:"center", valign:"middle", margin:0,
      });
    }
  });

  // Grounding principle — y=4.72, h=0.40, bottom=5.12 ✓
  glassCard(s, 0.30, 4.72, 5.40, 0.40, { fill:"0d1a10", border:C.emerald, lw:1.0 });
  s.addText("🔒  Gemini reasons ABOUT injected facts — it never invents prices, forecasts, or confidence scores.", {
    x:0.50, y:4.72, w:5.00, h:0.40,
    fontSize:9.5, fontFace:"Calibri", color:C.emerald,
    align:"left", valign:"middle", margin:0, italic:true,
  });

  // RIGHT: 4 use-case cards  h=0.72, spacing=0.80
  // Card 0: y=1.42  bottom=2.14
  // Card 1: y=2.22  bottom=2.94
  // Card 2: y=3.02  bottom=3.74
  // Card 3: y=3.82  bottom=4.54 ✓
  const usecases = [
    { icon:"💬", title:"Grounded Narration",  col:C.violet,
      desc:"All Gemini responses cite real DuckDB metrics injected via PromptContext dataclass" },
    { icon:"🎭", title:"Analyst Personas",    col:C.blue,
      desc:"4 modes (Farmer / Trader / Wholesale / Analyst) materially change response register" },
    { icon:"🔊", title:"Voice Advisory",      col:C.cyan,
      desc:"Web Speech API STT + speechSynthesis TTS — voice I/O for farmer accessibility" },
    { icon:"📡", title:"SSE Streaming",       col:C.amber,
      desc:"Token-by-token Gemini output via /api/advisor/ask/stream (native async generator)" },
  ];

  usecases.forEach((uc, i) => {
    const x = 5.90;
    const y = 1.42 + i * 0.80;
    glassCard(s, x, y, 3.80, 0.72, { fill:C.card, border:uc.col, lw:1.0, shadow:mkShadow() });
    accentBar(s, x, y, 0.72, uc.col);
    s.addText(uc.icon, { x:x+0.18, y, w:0.52, h:0.72,
      fontSize:20, fontFace:"Calibri", color:uc.col,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(uc.title, { x:x+0.76, y:y+0.06, w:2.88, h:0.24,
      fontSize:12, fontFace:"Arial Black", color:uc.col,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(uc.desc, { x:x+0.76, y:y+0.34, w:2.88, h:0.32,
      fontSize:9.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"top", margin:0,
    });
  });

  // Gemini config box  y=4.64, h=0.48, bottom=5.12 ✓
  glassCard(s, 5.90, 4.64, 3.80, 0.48, { fill:C.card2, border:C.violet, lw:1.0 });
  s.addText("gemini-2.5-flash  ·  temp=0.2  ·  thinking_budget=0\nmax_output_tokens=2048  ·  retry ×2 (exp backoff)", {
    x:6.06, y:4.64, w:3.48, h:0.48,
    fontSize:8.5, fontFace:"Calibri", color:C.violet,
    align:"center", valign:"middle", margin:0,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 8 — TIME SERIES FORECASTING THEORY
// Fixed: forecast output fields rendered as single rich-text block (no i*0.0 bug)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, -1.0, 1.0, 5.0, 4.5, C.blue,    90);
  glow(s,  6.5, 0.5, 5.0, 3.5, C.emerald, 92);

  sectionTag(s, "07  ·  FORECASTING THEORY", 0.35, 0.22, C.blue);
  slideTitle(s, "Time Series Forecasting", 0.35, 0.58);

  // LEFT: Prophet model — h=3.82, bottom=5.26 ✓
  glassCard(s, 0.30, 1.42, 4.40, 3.82, { fill:C.card, border:C.blue, lw:1.2, shadow:mkShadow() });
  accentBar(s, 0.30, 1.42, 3.82, C.blue);

  s.addText("🔵  Prophet Model", { x:0.52, y:1.54, w:4.00, h:0.36,
    fontSize:14, fontFace:"Arial Black", color:C.blue,
    bold:true, align:"left", valign:"middle", margin:0,
  });
  s.addText("Facebook Prophet — Bayesian additive decomposition", { x:0.52, y:1.92, w:4.00, h:0.26,
    fontSize:10.5, fontFace:"Calibri", color:C.gray2,
    align:"left", valign:"middle", margin:0,
  });

  // Formula box
  glassCard(s, 0.52, 2.24, 3.80, 0.50, { fill:C.card2, border:C.blueD, lw:0.8 });
  s.addText("y(t)  =  g(t)  +  s(t)  +  h(t)  +  ε", { x:0.60, y:2.24, w:3.64, h:0.50,
    fontSize:14, fontFace:"Calibri", color:C.cyan,
    bold:true, align:"center", valign:"middle", margin:0, italic:true,
  });

  // Components
  const comps = [
    { sym:"g(t)", desc:"Trend — piecewise linear changepoints (scale=0.05)", col:C.emerald },
    { sym:"s(t)", desc:"Seasonality — yearly multiplicative (no weekly/daily)", col:C.blue  },
    { sym:"h(t)", desc:"Holidays — Indian public holidays via add_country_holidays(IN)", col:C.amber },
    { sym:"ε",    desc:"Noise — residual uncertainty captured in CI bands", col:C.gray2    },
  ];
  comps.forEach((c, i) => {
    const y = 2.90 + i * 0.46;
    glassCard(s, 0.52, y, 3.80, 0.38, { fill:C.card2, border:c.col, lw:0.7 });
    s.addText(c.sym, { x:0.60, y, w:0.56, h:0.38,
      fontSize:12, fontFace:"Calibri", color:c.col,
      bold:true, italic:true, align:"center", valign:"middle", margin:0,
    });
    s.addText(c.desc, { x:1.20, y, w:3.00, h:0.38,
      fontSize:10, fontFace:"Calibri", color:C.gray1,
      align:"left", valign:"middle", margin:0,
    });
  });

  // Config block
  glassCard(s, 0.52, 4.78, 3.80, 0.30, { fill:C.card2, border:C.blue, lw:0.7 });
  s.addText("seasonality_mode=multiplicative  ·  yearly=True  ·  weekly=False  ·  daily=False", {
    x:0.58, y:4.78, w:3.68, h:0.30,
    fontSize:8, fontFace:"Calibri", color:C.gray2,
    align:"center", valign:"middle", margin:0,
  });

  // RIGHT: Forecast horizons table
  glassCard(s, 4.90, 1.42, 4.80, 2.10, { fill:C.card, border:C.emerald, lw:1.2, shadow:mkShadow() });
  accentBar(s, 4.90, 1.42, 2.10, C.emerald);

  s.addText("📅  Forecast Horizons", { x:5.10, y:1.54, w:4.40, h:0.34,
    fontSize:13, fontFace:"Arial Black", color:C.emerald,
    bold:true, align:"left", valign:"middle", margin:0,
  });
  hRule(s, 5.08, 1.94, 4.44, C.emerald, 65);

  const hdrs = ["HORIZON","USE CASE","CI BAND"];
  hdrs.forEach((h, i) => {
    s.addText(h, { x:5.08+i*1.46, y:2.00, w:1.42, h:0.22,
      fontSize:8, fontFace:"Calibri", color:C.gray3,
      bold:true, charSpacing:1.5, align:"left", valign:"middle", margin:0,
    });
  });

  const horizons = [
    { hz:"7 Days",  use:"Immediate sell/hold decision",    conf:"Narrow",  col:C.emerald },
    { hz:"30 Days", use:"Procurement / trade planning",   conf:"Medium",  col:C.cyan    },
    { hz:"90 Days", use:"Seasonal strategy / planting",    conf:"Wider",   col:C.amber   },
  ];
  horizons.forEach((hz, i) => {
    const y = 2.28 + i * 0.38;
    s.addText(hz.hz, { x:5.08, y, w:1.42, h:0.34,
      fontSize:11.5, fontFace:"Arial Black", color:hz.col,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(hz.use, { x:6.54, y, w:1.46, h:0.34,
      fontSize:9.5, fontFace:"Calibri", color:C.gray1,
      align:"left", valign:"middle", margin:0,
    });
    pill(s, 8.04, y+0.06, 0.92, 0.22, hz.col, 78);
    s.addText(hz.conf, { x:8.04, y:y+0.06, w:0.92, h:0.22,
      fontSize:9, fontFace:"Calibri", color:hz.col,
      bold:true, align:"center", valign:"middle", margin:0,
    });
  });

  // Output fields card — FIXED: single rich-text block, not a loop with i*0.0
  glassCard(s, 4.90, 3.68, 4.80, 1.08, { fill:C.card, border:C.cyan, lw:1.0 });
  accentBar(s, 4.90, 3.68, 1.08, C.cyan);
  s.addText("Forecast Output Fields", { x:5.10, y:3.76, w:4.40, h:0.28,
    fontSize:11, fontFace:"Arial Black", color:C.cyan,
    bold:true, align:"left", valign:"middle", margin:0,
  });
  // All 3 fields in ONE text call using rich text + breakLine — no overprint
  s.addText([
    { text:"·  yhat",       options:{ color:C.cyan, bold:true } },
    { text:"  — predicted modal price (Rs/quintal)",  options:{ color:C.gray1, breakLine:true } },
    { text:"·  yhat_lower", options:{ color:C.cyan, bold:true } },
    { text:"  — lower confidence bound",              options:{ color:C.gray1, breakLine:true } },
    { text:"·  yhat_upper", options:{ color:C.cyan, bold:true } },
    { text:"  — upper confidence bound",              options:{ color:C.gray1 } },
  ], { x:5.10, y:4.08, w:4.40, h:0.60,
    fontSize:10, fontFace:"Calibri",
    align:"left", valign:"top", margin:0,
  });

  // SparseTrend fallback
  glassCard(s, 4.90, 4.88, 4.80, 0.40, { fill:C.card2, border:C.amber, lw:1.0 });
  s.addText("SparseTrend Fallback (Tier C/D):  Theil-Sen median slopes + monthly multipliers + 80% CI", {
    x:5.08, y:4.88, w:4.52, h:0.40,
    fontSize:9, fontFace:"Calibri", color:C.amber,
    align:"left", valign:"middle", margin:0,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 9 — AI ARCHITECTURE CONCEPTS
// Fixed: uniform 5-card grid (3-top + 2-bottom even widths); clean descriptions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 3.0, 1.5, 6.0, 4.5, C.blue, 90);
  glow(s,-1.0, 0.5, 4.5, 3.5, C.cyan, 92);

  sectionTag(s, "08  ·  AI ARCHITECTURE", 0.35, 0.22, C.blue);
  slideTitle(s, "AI Architecture Concepts", 0.35, 0.58);

  // 8-stage pipeline
  const stages = [
    { n:"1", label:"Sanitize\nGuardrails",  col:C.red     },
    { n:"2", label:"Session\nMemory",        col:C.cyan    },
    { n:"3", label:"Entity\nExtract",        col:C.amber   },
    { n:"4", label:"Intent\nClassify",       col:C.blue    },
    { n:"5", label:"Context\nBuild",         col:C.emerald },
    { n:"6", label:"7-Agent\nCouncil",        col:C.violet  },
    { n:"7", label:"Confidence\n+Corr.",     col:C.cyan    },
    { n:"8", label:"Gemini\nGenerate",       col:C.amber   },
  ];

  const stageW   = 1.15;
  const stageGap = 0.03;
  const totalW   = stages.length * stageW + (stages.length - 1) * stageGap;
  const startX   = (10 - totalW) / 2;
  const stageY   = 1.44;

  stages.forEach((st, i) => {
    const x = startX + i * (stageW + stageGap);
    glassCard(s, x, stageY, stageW, 0.88, { fill:C.card2, border:st.col, lw:1.0, shadow:mkShadow() });
    circle(s, x + stageW/2 - 0.18, stageY+0.06, 0.36, C.bg, st.col);
    s.addText(st.n, { x:x+stageW/2-0.18, y:stageY+0.06, w:0.36, h:0.36,
      fontSize:11, fontFace:"Arial Black", color:st.col,
      bold:true, align:"center", valign:"middle", margin:0,
    });
    s.addText(st.label, { x:x+0.04, y:stageY+0.46, w:stageW-0.08, h:0.38,
      fontSize:7.5, fontFace:"Calibri", color:C.gray2,
      align:"center", valign:"middle", margin:0,
    });
    if (i < stages.length - 1) {
      s.addText("›", { x:x+stageW+0.00, y:stageY+0.20, w:0.05, h:0.44,
        fontSize:13, fontFace:"Calibri", color:C.border2,
        align:"center", valign:"middle", margin:0,
      });
    }
  });

  // 5 concept cards — uniform 3+2 layout with even widths
  // Row 1: 3 cards at w=3.02  x=[0.30, 3.34, 6.38]  y=2.50  h=1.16  bottom=3.66
  // Row 2: 2 cards at w=4.60  x=[0.30, 5.02]         y=3.74  h=1.16  bottom=4.90 ✓
  const concepts = [
    { icon:"🛡", title:"Guardrails",       color:C.red,
      desc:"Hard/soft blocks prevent off-topic queries (coding, crypto, politics) from reaching Gemini. Checked FIRST on every single call." },
    { icon:"🧠", title:"Session Memory",   color:C.cyan,
      desc:"In-process TTL sessions (2h, max 10 turns). Crop/state context inherited across follow-up turns. Optional Redis backend." },
    { icon:"🎯", title:"Intent Classify",  color:C.blue,
      desc:"Fully deterministic rule-based classification. 20+ intent patterns. No LLM involved in routing decisions." },
    { icon:"📐", title:"Data Grounding",   color:C.emerald,
      desc:"PromptContext carries 12 injected fields from real DuckDB/ML data. Gemini narrates ABOUT deterministic facts — never invents them." },
    { icon:"🎭", title:"Persona Framing",  color:C.violet,
      desc:"4 analyst personas prepended before system identity. Changes Gemini response register, language, and focus — not the underlying data." },
  ];

  concepts.forEach((c, i) => {
    const inRow1 = i < 3;
    const col    = inRow1 ? i : i - 3;
    const x      = inRow1 ? 0.30 + col * 3.22 : 0.30 + col * 4.82;
    const w      = inRow1 ? 3.02 : 4.62;
    const y      = inRow1 ? 2.50 : 3.74;
    const h      = 1.16;

    glassCard(s, x, y, w, h, { fill:C.card, border:c.color, lw:1.0, shadow:mkShadow() });
    accentBar(s, x, y, h, c.color);

    s.addText(c.icon, { x:x+0.18, y, w:0.52, h:h,
      fontSize:20, fontFace:"Calibri", color:c.color,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(c.title, { x:x+0.76, y:y+0.08, w:w-0.86, h:0.28,
      fontSize:12.5, fontFace:"Arial Black", color:c.color,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(c.desc, { x:x+0.76, y:y+0.40, w:w-0.86, h:0.68,
      fontSize:9.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"top", margin:0,
    });
  });

  // Bottom bar  y=5.02, h=0.28, bottom=5.30 ✓
  glassCard(s, 0.30, 5.02, 9.40, 0.28, { fill:C.card2, border:C.blue, lw:0.7 });
  s.addText("8-stage pipeline  ·  Deterministic intent  ·  Grounded PromptContext  ·  Session memory  ·  SSE streaming  ·  Exponential retry", {
    x:0.50, y:5.02, w:9.00, h:0.28,
    fontSize:8.5, fontFace:"Calibri", color:C.gray2,
    align:"center", valign:"middle", margin:0,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 10 — VISUAL INTELLIGENCE + EXPLAINABLE AI
// Fixed: XAI card h=0.94, gap=0.04 (last card bottom=5.46); shorter descriptions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, -0.5, 0.5, 5.0, 4.5, C.violet,  89);
  glow(s,  6.5, 1.5, 5.0, 3.5, C.emerald, 91);

  sectionTag(s, "09  ·  VISUAL INTELLIGENCE & XAI", 0.35, 0.22, C.violet);
  slideTitle(s, "Explainable AI & Visualizations", 0.35, 0.58);

  // LEFT: 6 visualization components — h=0.46, spacing=0.52
  // Comp 5 (last): y=1.78+5*0.52=4.38, bottom=4.84 ✓
  labelText(s, "AI VISUALIZATION COMPONENTS", 0.30, 1.38, 4.70, 0.26);

  const vizComponents = [
    { name:"MiniSparkline",    desc:"Bezier-smoothed 30-day price with halo dot on last point",  col:C.emerald, sym:"📈" },
    { name:"VolatilityMeter",  desc:"SVG gauge arc — CV% mapped to low/high/extreme color",     col:C.amber,   sym:"⚡" },
    { name:"ConfidenceGauge",  desc:"Radial arc showing forecast reliability score (0–100%)",    col:C.blue,    sym:"🎯" },
    { name:"RiskHeatBar",      desc:"Color-gradient bar from low risk (emerald) to extreme (red)", col:C.red,  sym:"🔴" },
    { name:"SeasonalPosition", desc:"Phase chip: DEEP_PEAK / PEAK / NORMAL / LEAN / TROUGH",    col:C.violet,  sym:"🌙" },
    { name:"MomentumArrow",    desc:"Directional arrow: STRONG_BULLISH to STRONG_BEARISH",       col:C.cyan,    sym:"→" },
  ];

  vizComponents.forEach((viz, i) => {
    const y = 1.72 + i * 0.52;
    glassCard(s, 0.30, y, 4.70, 0.44, { fill:C.card, border:viz.col, lw:0.8 });
    accentBar(s, 0.30, y, 0.44, viz.col);
    s.addText(viz.sym, { x:0.44, y, w:0.40, h:0.44,
      fontSize:16, fontFace:"Calibri", color:viz.col,
      align:"center", valign:"middle", margin:0,
    });
    s.addText(viz.name, { x:0.90, y:y+0.03, w:1.50, h:0.18,
      fontSize:10, fontFace:"Arial Black", color:viz.col,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(viz.desc, { x:0.90, y:y+0.24, w:3.96, h:0.18,
      fontSize:8.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"middle", margin:0,
    });
  });

  // RIGHT: 4 XAI layers — h=0.90, gap=0.06
  // Layer 0: y=1.38           bottom=2.28
  // Layer 1: y=2.34           bottom=3.24
  // Layer 2: y=3.30           bottom=4.20
  // Layer 3: y=4.26           bottom=5.16 ✓
  labelText(s, "EXPLAINABILITY LAYERS", 5.20, 1.38, 4.50, 0.26);

  const xaiLayers = [
    { title:"Confidence Engine",    color:C.blue,
      desc:"Composite score from training depth, volatility CV, anomaly count, momentum coherence, and forecast availability. Returns score + contributors + detractors." },
    { title:"Correlation Engine",   color:C.cyan,
      desc:"Reads 4 agent verdicts and emits CONFIRMING / CONTRADICTION / MIXED signals (e.g. 'Bullish momentum + peak season: CONFIRMING'). Max 5 signals per response." },
    { title:"Decision Trace",       color:C.violet,
      desc:"6-stage pipeline trace: data quality, context build, agents, confidence, correlation, prompt. Shows agreed vs dissenting agents and evidence quality score." },
    { title:"Reasoning Panel",      color:C.amber,
      desc:"Frontend component: agent verdict cards, reasoning trace as pill chips, persona tag, and correlation badges rendered below every streaming AI response." },
  ];

  xaiLayers.forEach((layer, i) => {
    const y = 1.72 + i * 0.88;   // spacing=0.88: layer 3 bottom=1.72+3*0.88+0.82=5.18 ✓
    glassCard(s, 5.20, y, 4.50, 0.82, { fill:C.card, border:layer.color, lw:1.0, shadow:mkShadow() });
    accentBar(s, 5.20, y, 0.82, layer.color);
    s.addText(layer.title, { x:5.42, y:y+0.06, w:4.10, h:0.24,
      fontSize:11.5, fontFace:"Arial Black", color:layer.color,
      bold:true, align:"left", valign:"middle", margin:0,
    });
    s.addText(layer.desc, { x:5.42, y:y+0.34, w:4.10, h:0.42,
      fontSize:9.5, fontFace:"Calibri", color:C.gray2,
      align:"left", valign:"top", margin:0,
    });
  });
  // Footer removed — space reclaimed for right-column cards
}

// ─── WRITE ────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName:"AgroPrice_AI_Slides_1_10.pptx" })
  .then(() => console.log("✅  AgroPrice_AI_Slides_1_10.pptx written"))
  .catch(err => { console.error("❌ ", err); process.exit(1); });
