"use strict";
const pptxgen = require("pptxgenjs");

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:"050816", bg2:"07101f", card:"0d1a2e", card2:"0f2040",
  border:"1e3a5f", border2:"2a4a7a",
  emerald:"10B981", emeraldD:"059669", cyan:"06B6D4",
  blue:"3B82F6", blueD:"1D4ED8", violet:"8B5CF6",
  amber:"F59E0B", red:"EF4444", white:"FFFFFF",
  gray1:"E2E8F0", gray2:"94A3B8", gray3:"475569",
};

const mkShadow = () => ({ type:"outer", color:"000000", opacity:0.55, blur:18, offset:6,  angle:135 });
const mkGlowE  = () => ({ type:"outer", color:"10B981", opacity:0.18, blur:24, offset:0,  angle:0   });
const mkGlowB  = () => ({ type:"outer", color:"3B82F6", opacity:0.20, blur:22, offset:0,  angle:0   });
const mkGlowV  = () => ({ type:"outer", color:"8B5CF6", opacity:0.20, blur:22, offset:0,  angle:0   });

function addBg(s, c) {
  // Draw full-slide dark rect as first shape — survives InsertFromFile (unlike s.background property)
  s.addShape("rect", { x:0, y:0, w:10, h:5.625,
    fill:{ color: c || C.bg }, line:{ color: c || C.bg, width:0 } });
}
function glow(s,x,y,w,h,color,transp) {
  s.addShape("ellipse",{x,y,w,h,fill:{color,transparency:transp||88},line:{color,transparency:100}});
}
function accentBar(s,x,y,h,color) {
  s.addShape("rect",{x,y,w:0.06,h,fill:{color:color||C.emerald},line:{color:color||C.emerald,transparency:100}});
}
function glassCard(s,x,y,w,h,opts={}) {
  s.addShape("rect",{x,y,w,h,
    fill:{color:opts.fill||C.card,transparency:opts.fillT||0},
    line:{color:opts.border||C.border,width:opts.lw||1.0},
    shadow:opts.shadow||null,
  });
}
function chip(s,x,y,w,h,color,transp) {
  s.addShape("rect",{x,y,w,h,fill:{color,transparency:transp||75},line:{color,transparency:55,width:0.8}});
}
function pill(s,x,y,w,h,color,transp) {
  s.addShape("roundRect",{x,y,w,h,fill:{color,transparency:transp||80},line:{color,transparency:50,width:0.8},rectRadius:0.12});
}
function circle(s,x,y,r,fill,border) {
  s.addShape("ellipse",{x,y,w:r,h:r,fill:{color:fill},line:{color:border||fill,width:1.5}});
}
function hRule(s,x,y,w,color,transp) {
  s.addShape("line",{x,y,w,h:0,line:{color:color||C.border2,width:0.8,transparency:transp||0}});
}
function sectionTag(s,text,x,y,color) {
  chip(s,x,y,2.60,0.25,color,80);
  s.addText(text,{x,y,w:2.60,h:0.25,fontSize:8,fontFace:"Calibri",color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1.5});
}
function slideTitle(s,text,x,y,w) {
  s.addText(text,{x,y,w:w||9.3,h:0.68,fontSize:36,fontFace:"Arial Black",color:C.white,bold:true,align:"left",valign:"middle",margin:0});
}
function labelText(s,text,x,y,w,h,sz,color) {
  s.addText(text,{x,y,w,h,fontSize:sz||9,fontFace:"Calibri",color:color||C.gray2,align:"left",valign:"middle",margin:0,charSpacing:1.8,bold:true});
}

// ─── PRESENTATION ─────────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "S. Abhilash";
pres.title  = "AgroPrice AI — Slides 11-19";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 11 — AGMARKNET DATASET OVERVIEW
// 48.2M rows total (all India) · 12.6M South India · 12 yearly parquet files
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,-0.5,5.0,4.0,C.emerald,90);
  glow(s, 6.0, 2.0,5.0,3.5,C.cyan,   92);

  sectionTag(s,"10  ·  DATASET",0.35,0.22,C.emerald);
  slideTitle(s,"AGMARKNET Dataset",0.35,0.58);

  // ── 4 hero stats  y=1.38, h=0.58, bottom=1.96 ✓
  const heroStats = [
    {val:"48.2M",  lbl:"TOTAL ROWS\n(All India)",       col:C.emerald},
    {val:"12.6M",  lbl:"SOUTH INDIA\nSUBSET",           col:C.cyan   },
    {val:"12 YRS", lbl:"2015 – 2026\n(AGMARKNET)",      col:C.blue   },
    {val:"11",     lbl:"SCHEMA\nCOLUMNS",               col:C.violet },
  ];
  heroStats.forEach((hs,i)=>{
    const x=0.30+i*2.42;
    glassCard(s,x,1.38,2.22,0.58,{fill:C.card2,border:hs.col,lw:1.0,shadow:mkShadow()});
    s.addText(hs.val,{x:x+0.08,y:1.40,w:2.06,h:0.28,fontSize:20,fontFace:"Arial Black",color:hs.col,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(hs.lbl,{x:x+0.08,y:1.68,w:2.06,h:0.24,fontSize:7.5,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0,charSpacing:1});
  });

  // ── LEFT: State breakdown bars  x=0.30, y=2.08
  // Labels: y=2.08, bar below label; 5 states, spacing=0.48
  // State 4 (Telangana): y=2.08+4*0.50=4.08, h=0.40, bottom=4.48 ✓
  labelText(s,"SOUTH INDIA — ROWS PER STATE",0.30,2.04,4.80,0.22);

  const stateData=[
    {state:"Kerala",          rows:5113657, col:C.cyan   },
    {state:"Tamil Nadu",      rows:3913842, col:C.emerald},
    {state:"Karnataka",       rows:1938180, col:C.blue   },
    {state:"Telangana",       rows:1065019, col:C.violet },
    {state:"Andhra Pradesh",  rows:566504,  col:C.amber  },
  ];
  const maxRows = 5113657;
  const maxBarW  = 3.40;
  stateData.forEach((st,i)=>{
    const y = 2.30+i*0.50;
    const barW = Math.max(0.20, (st.rows/maxRows)*maxBarW);
    // background track
    s.addShape("rect",{x:1.72,y:y+0.08,w:maxBarW,h:0.22,fill:{color:C.border,transparency:55},line:{color:C.border,transparency:100}});
    // filled bar
    s.addShape("rect",{x:1.72,y:y+0.08,w:barW,h:0.22,fill:{color:st.col,transparency:20},line:{color:st.col,transparency:100}});
    // state label
    s.addText(st.state,{x:0.32,y,w:1.36,h:0.38,fontSize:10,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
    // row count badge
    const label = st.rows>=1000000 ? (st.rows/1000000).toFixed(1)+"M" : (st.rows/1000).toFixed(0)+"K";
    s.addText(label,{x:5.18,y,w:0.70,h:0.38,fontSize:9.5,fontFace:"Calibri",color:st.col,bold:true,align:"left",valign:"middle",margin:0});
  });

  // ── RIGHT: Year distribution chart  x=6.00, y=2.04
  labelText(s,"ROWS PER YEAR (SOUTH INDIA)",6.00,2.04,3.70,0.22);

  const yearData=[
    {yr:"2015",rows:913931},{yr:"2016",rows:955541},{yr:"2017",rows:956383},
    {yr:"2018",rows:809465},{yr:"2019",rows:775620},{yr:"2020",rows:645818},
    {yr:"2021",rows:724373},{yr:"2022",rows:894877},{yr:"2023",rows:892709},
    {yr:"2024",rows:2068018},{yr:"2025",rows:2645515},{yr:"2026",rows:314952},
  ];
  const maxYr = 2645515;
  const maxYrW = 3.00;
  // Single column for all 12 years: h=0.18, spacing=0.20
  // Year 11 (2026): y=2.30+11*0.20=4.50, bottom=4.68 ✓
  yearData.forEach((yd,i)=>{
    const y = 2.30+i*0.20;
    const barW = Math.max(0.05,(yd.rows/maxYr)*maxYrW);
    const colorH = yd.rows>1500000 ? C.amber : yd.rows>800000 ? C.cyan : C.blue;
    s.addText(yd.yr,{x:6.00,y,w:0.44,h:0.18,fontSize:8,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});
    s.addShape("rect",{x:6.48,y:y+0.01,w:barW,h:0.16,fill:{color:colorH,transparency:25},line:{color:colorH,transparency:100}});
    const lbl = yd.rows>=1000000 ? (yd.rows/1000000).toFixed(1)+"M" : (yd.rows/1000).toFixed(0)+"K";
    s.addText(lbl,{x:9.52,y,w:0.46,h:0.18,fontSize:7.5,fontFace:"Calibri",color:colorH,bold:true,align:"left",valign:"middle",margin:0});
  });

  // ── Bottom: 11 column name chips  y=4.72, h=0.24
  const cols=["State","District","Market","Commodity","Variety","Grade","Arrival_Date","Min_Price","Max_Price","Modal_Price","Commodity_Code"];
  const colColors=[C.blue,C.blue,C.blue,C.emerald,C.gray3,C.gray3,C.cyan,C.amber,C.amber,C.emerald,C.violet];
  const chipW=0.82; const chipGap=0.04; const chipY=4.74;
  cols.forEach((c,i)=>{
    const x=0.30+i*(chipW+chipGap);
    pill(s,x,chipY,chipW,0.26,colColors[i],78);
    s.addText(c,{x,y:chipY,w:chipW,h:0.26,fontSize:6.0,fontFace:"Calibri",color:colColors[i],bold:true,align:"center",valign:"middle",margin:0});
  });

  // ── Schema note
  glassCard(s,0.30,5.10,9.40,0.26,{fill:C.card2,border:C.emerald,lw:0.8});
  s.addText("Data source: AGMARKNET (Agricultural Marketing Information Network) · Open Government Data India · Parquet format via PyArrow",{x:0.50,y:5.10,w:9.00,h:0.26,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 12 — DATASET SCHEMA & DATA QUALITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.5,4.5,4.0,C.cyan,  91);
  glow(s, 7.0,0.5,4.0,3.5,C.red,   92);

  sectionTag(s,"11  ·  DATA SCHEMA & QUALITY",0.35,0.22,C.cyan);
  slideTitle(s,"Schema & Data Quality",0.35,0.58);

  // ── LEFT: Schema table  x=0.30, y=1.42, w=4.50
  glassCard(s,0.30,1.42,4.50,3.32,{fill:C.card,border:C.cyan,lw:1.2,shadow:mkShadow()});
  accentBar(s,0.30,1.42,3.32,C.cyan);
  s.addText("Schema (11 Columns)",{x:0.52,y:1.50,w:4.10,h:0.30,fontSize:12,fontFace:"Arial Black",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.50,1.86,4.10,C.cyan,68);

  const schemaRows=[
    {col:"State",             type:"VARCHAR", note:"South India filter applied",         color:C.blue  },
    {col:"District",          type:"VARCHAR", note:"Sub-state geography",                color:C.blue  },
    {col:"Market",            type:"VARCHAR", note:"Mandi name — used in deduplication", color:C.blue  },
    {col:"Commodity",         type:"VARCHAR", note:"27 crops in registry",               color:C.emerald},
    {col:"Variety",           type:"VARCHAR", note:"Multiple per crop/day → dedup",      color:C.amber },
    {col:"Grade",             type:"VARCHAR", note:"Quality tier (Medium/FAQ/etc.)",     color:C.gray3 },
    {col:"Arrival_Date",      type:"VARCHAR", note:"String YYYY-MM-DD → TRY_CAST DATE",  color:C.cyan  },
    {col:"Min_Price",         type:"DOUBLE",  note:"Rs/quintal — floor reference",       color:C.emerald},
    {col:"Max_Price",         type:"DOUBLE",  note:"Rs/quintal — ceiling reference",     color:C.emerald},
    {col:"Modal_Price",       type:"DOUBLE",  note:"Primary forecast target — AVG'd",    color:C.violet},
    {col:"Commodity_Code",    type:"BIGINT",  note:"AGMARKNET internal ID (unused)",     color:C.gray3 },
  ];

  // Row spacing 0.25 so row 10 bottom = 1.94+10*0.25+0.25 = 4.69 < card bottom 4.74 ✓
  schemaRows.forEach((row,i)=>{
    const y = 1.94+i*0.25;
    if (i%2===0) s.addShape("rect",{x:0.50,y,w:4.10,h:0.25,fill:{color:C.card2,transparency:30},line:{color:C.border,transparency:80}});
    s.addText(row.col,{x:0.54,y,w:1.36,h:0.25,fontSize:9,fontFace:"Calibri",color:row.color,bold:true,align:"left",valign:"middle",margin:0});
    pill(s,1.92,y+0.04,0.70,0.16,row.color,80);
    s.addText(row.type,{x:1.92,y:y+0.04,w:0.70,h:0.16,fontSize:7,fontFace:"Calibri",color:row.color,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(row.note,{x:2.66,y,w:1.84,h:0.25,fontSize:8.5,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});
  });

  // ── RIGHT: 3 data quality issues  x=5.00, y=1.42
  const issues=[
    {
      num:"01", title:"Duplicate Varieties",          icon:"⚠",  color:C.amber,
      problem:"AGMARKNET records 3+ Variety rows per (date, crop, state, market) — e.g. Tomato/Local, Tomato/Hybrid, Tomato/FAQ all on the same day.",
      fix:"GROUP BY (date, crop, state, market) + AVG(Modal_Price)\nOne price per mandi per day — correct for forecasting.",
    },
    {
      num:"02", title:"Extreme Price Outliers",       icon:"🔴", color:C.red,
      problem:"Raw dataset contains prices from Rs 0 to Rs 918,421,086 — confirmed data-entry errors (7 zeros of scale).",
      fix:"Filter: Modal_Price BETWEEN 1 AND 100,000 Rs/qtl\n815 outlier records removed. Cardamoms exempt: cap=500,000.",
    },
    {
      num:"03", title:"Tamil Nadu Data Gap",          icon:"📅", color:C.violet,
      problem:"Tamil Nadu mandi data shows very low coverage before 2024, making any pre-2024 price series unsuitable for forecasting.",
      fix:"TAMIL_NADU_DATA_START = '2024-01-01' applied automatically when state='Tamil Nadu' and no start_date supplied.",
    },
  ];

  issues.forEach((iss,i)=>{
    const y=1.42+i*1.08;
    const h=1.00;
    glassCard(s,5.00,y,4.70,h,{fill:C.card,border:iss.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,5.00,y,h,iss.color);
    s.addText(iss.icon,{x:5.16,y,w:0.46,h:h,fontSize:18,fontFace:"Calibri",color:iss.color,align:"center",valign:"middle",margin:0});
    s.addText(`${iss.num}  ${iss.title}`,{x:5.66,y:y+0.06,w:3.90,h:0.24,fontSize:11,fontFace:"Arial Black",color:iss.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(iss.problem,{x:5.66,y:y+0.34,w:3.90,h:0.30,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"left",valign:"top",margin:0});
    s.addText([
      {text:"FIX  ",options:{color:iss.color,bold:true}},
      {text:iss.fix, options:{color:C.gray1}},
    ],{x:5.66,y:y+0.66,w:3.90,h:0.28,fontSize:8.5,fontFace:"Calibri",align:"left",valign:"top",margin:0});
  });

  // Bottom summary
  glassCard(s,0.30,4.82,9.40,0.30,{fill:C.card2,border:C.cyan,lw:0.8});
  s.addText("After cleaning: one AVG(Modal_Price) per calendar day per crop×state — passed directly to Prophet as (ds, y) — no interpolation, no forward-fill",{x:0.50,y:4.82,w:9.00,h:0.30,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 13 — PREPROCESSING PIPELINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 3.5,1.0,5.0,4.5,C.blue,  90);
  glow(s,-1.0,2.0,4.0,3.5,C.emerald,93);

  sectionTag(s,"12  ·  PREPROCESSING PIPELINE",0.35,0.22,C.blue);
  slideTitle(s,"Data Preprocessing Pipeline",0.35,0.58);

  // Layout: h=0.56, spacing=0.61 → Step 5 (last): y=1.40+5*0.61=4.45, bottom=5.01 ✓
  const steps=[
    {n:"1", icon:"📁", title:"Parquet File Discovery",  color:C.amber,
     key:"sorted(parquet_dir.glob('*.parquet'))",
     d1:"12 yearly files (2015–2026) · data/raw/parquet/ · ~400 MB total",
     d2:"31–64 MB per file · loaded lazily by DuckDB via PyArrow driver",
     out:"12 parquet paths"},
    {n:"2", icon:"🦆", title:"DuckDB Lazy View",         color:C.cyan,
     key:"DuckDB VIEW: lazy query, zero data loaded into Python memory",
     d1:"Zero data copied into Python memory · query-time disk reads only",
     d2:"Predicate pushdown reads only the row groups each query needs",
     out:"prices VIEW active"},
    {n:"3", icon:"✅", title:"Schema Validation",        color:C.emerald,
     key:"DESCRIBE prices → 7 required columns verified at startup",
     d1:"Checks State, Commodity, Arrival_Date, Min/Max/Modal_Price fields",
     d2:"Raises ValueError immediately if any required column is missing",
     out:"Schema confirmed"},
    {n:"4", icon:"🔍", title:"Outlier Price Filter",     color:C.red,
     key:"Modal_Price BETWEEN 1 AND 100,000 Rs/qtl",
     d1:"815 outlier records removed · raw prices ranged 0 to Rs 918M",
     d2:"Applied per query via _price_filter(crop) — not a permanent delete",
     out:"Clean [1–100K] Rs/qtl"},
    {n:"5", icon:"🔗", title:"Deduplication  (AVG)",     color:C.violet,
     key:"GROUP BY (date, crop, state, market)  +  AVG(Modal_Price)",
     d1:"Collapses 3+ Variety rows per mandi/day into one avg price",
     d2:"AVG(Min_Price) and AVG(Max_Price) also computed · outlier-robust",
     out:"1 record/mandi/day"},
    {n:"6", icon:"📊", title:"Prophet-Ready Series",     color:C.blue,
     key:"Returns (ds, y) daily time series · Prophet.fit() ready",
     d1:"df['ds'] = datetime64[ns] · df['y'] = float64 daily modal price",
     d2:"Missing calendar dates NOT filled — Prophet handles sparse data",
     out:"(ds, y) DataFrame"},
  ];

  steps.forEach((st,i)=>{
    const y=1.40+i*0.61;
    const h=0.56;
    glassCard(s,0.30,y,9.40,h,{fill:C.card,border:st.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,0.30,y,h,st.color);

    // Step number circle
    circle(s,0.46,y+0.11,0.34,C.bg,st.color);
    s.addText(st.n,{x:0.46,y:y+0.11,w:0.34,h:0.34,fontSize:12,fontFace:"Arial Black",color:st.color,bold:true,align:"center",valign:"middle",margin:0});

    // Emoji icon
    s.addText(st.icon,{x:0.86,y,w:0.38,h,fontSize:15,fontFace:"Calibri",color:st.color,align:"center",valign:"middle",margin:0});

    // Step title — max 22 chars so fits in w=2.86 at 11pt Arial Black
    s.addText(st.title,{x:1.30,y:y+0.06,w:2.86,h:0.26,fontSize:11,fontFace:"Arial Black",color:st.color,bold:true,align:"left",valign:"middle",margin:0});

    // Italic key note below title
    s.addText(st.key,{x:1.30,y:y+0.34,w:2.86,h:0.18,fontSize:7.5,fontFace:"Calibri",color:st.color,align:"left",valign:"middle",margin:0,italic:true});

    // Vertical separator
    s.addShape("line",{x:4.22,y:y+0.08,w:0,h:h-0.16,line:{color:st.color,width:0.7,transparency:65}});

    // Detail text — two lines, well-contrasted
    s.addText(st.d1,{x:4.32,y:y+0.07,w:3.52,h:0.22,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
    s.addText(st.d2,{x:4.32,y:y+0.31,w:3.52,h:0.21,fontSize:8.5,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});

    // Output badge
    pill(s,7.90,y+0.16,1.68,0.24,st.color,78);
    s.addText("→  "+st.out,{x:7.90,y:y+0.16,w:1.68,h:0.24,fontSize:8.5,fontFace:"Calibri",color:st.color,bold:true,align:"center",valign:"middle",margin:0});

    // Arrow connector
    if(i<steps.length-1){
      s.addText("▾",{x:0.46,y:y+h,w:0.34,h:0.08,fontSize:8,fontFace:"Calibri",color:st.color,align:"center",valign:"middle",margin:0});
    }
  });

  // Bottom note
  glassCard(s,0.30,5.10,9.40,0.26,{fill:"090e1a",border:C.blue,lw:0.8});
  s.addText("Lazy evaluation: DuckDB reads parquet blocks on demand · Python memory stays low · Complete pipeline runs in < 50 ms per query",{x:0.50,y:5.10,w:9.00,h:0.26,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 14 — FEATURE ENGINEERING (5 Analytics Functions)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.5,5.5,4.0,C.violet,89);
  glow(s, 6.5,0.5,4.5,3.5,C.emerald,92);

  sectionTag(s,"13  ·  FEATURE ENGINEERING",0.35,0.22,C.violet);
  slideTitle(s,"Feature Engineering",0.35,0.58);

  // Input/output label
  s.addText("Input: query_for_forecast(crop, state) → (ds, y) DataFrame from DuckDB",{x:0.35,y:1.34,w:9.30,h:0.22,fontSize:10,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0,italic:true});

  const funcs=[
    {icon:"⚡",name:"detect_price_anomalies",    color:C.red,
     sig:"window=30, z_threshold=2.0, lookback=90d",
     formula:"z(t) = ( price(t) − μ_30d ) / σ_30d",
     outputs:["|z| ≥ 2.0 → LOW","  |z| ≥ 2.5 → MEDIUM","  |z| ≥ 3.5 → HIGH"],
     badge:"spike / crash events"},
    {icon:"📊",name:"compute_volatility_metrics",color:C.amber,
     sig:"full price history",
     formula:"CV = σ / μ × 100%",
     outputs:["CV < 20% → Stable","  CV < 35% → Moderate","  CV < 50% → High Risk","  CV ≥ 50% → Extremely Volatile"],
     badge:"instability_score + badge"},
    {icon:"🌙",name:"compute_seasonal_profile",  color:C.cyan,
     sig:"full price history → monthly groupby",
     formula:"dev[m] = ( μ_month − μ_annual ) / μ_annual × 100",
     outputs:["peak_months (top-3 +dev)","  trough_months (bottom-3 -dev)","  current_phase: peak|trough|normal"],
     badge:"monthly_profile dict"},
    {icon:"🚀",name:"compute_momentum_signal",   color:C.emerald,
     sig:"last 37 days",
     formula:"score = ( avg_7d − avg_prior30d ) / avg_prior30d × 100",
     outputs:["score > 10 → Strong Uptrend ↑↑","  3–10 → Uptrend ↑","  -3 to 3 → Flat →","  < -10 → Strong Downtrend ↓↓"],
     badge:"signal + change_pct"},
    {icon:"🎯",name:"compute_forecast_quality",  color:C.blue,
     sig:"training rows, staleness, volatility",
     formula:"score = depth_score − vol_penalty − staleness_penalty",
     outputs:["Training rows > 500 → +40pts","  CV < 20% → +0 penalty","  Staleness > 30d → −30pts"],
     badge:"reliability_score (0–100)"},
  ];

  // 3 + 2 card layout
  // Row 1: w=3.00, y=1.68, h=1.64, bottom=3.32
  // Row 2: w=4.62, y=3.38, h=1.64, bottom=5.02 ✓
  funcs.forEach((fn,i)=>{
    const inRow1 = i<3;
    const col    = inRow1 ? i : i-3;
    const x      = inRow1 ? 0.28+col*3.22 : 0.28+col*4.80;
    const w      = inRow1 ? 3.02          : 4.60;
    const y      = inRow1 ? 1.68          : 3.38;
    const h      = 1.60;

    glassCard(s,x,y,w,h,{fill:C.card,border:fn.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,x,y,h,fn.color);

    s.addText(fn.icon,{x:x+0.14,y,w:0.44,h:h,fontSize:18,fontFace:"Calibri",color:fn.color,align:"center",valign:"top",margin:0});
    // 3-col cards: w-0.72=2.30" — longest name is 28 chars → use 9.5pt; 2-col cards: 11pt
    s.addText(fn.name+"()",{x:x+0.62,y:y+0.06,w:w-0.72,h:0.26,fontSize:inRow1?9.5:11,fontFace:"Arial Black",color:fn.color,bold:true,align:"left",valign:"middle",margin:0});

    // Formula chip
    glassCard(s,x+0.62,y+0.34,w-0.72,0.22,{fill:C.bg2,border:fn.color,lw:0.7,fillT:0});
    s.addText(fn.formula,{x:x+0.66,y:y+0.34,w:w-0.80,h:0.22,fontSize:9.5,fontFace:"Calibri",color:fn.color,italic:true,align:"center",valign:"middle",margin:0});

    // Outputs
    fn.outputs.slice(0,3).forEach((op,j)=>{
      s.addText([
        {text:"›  ",options:{color:fn.color,bold:true}},
        {text:op.trim(),options:{color:C.gray1}},
      ],{x:x+0.62,y:y+0.62+j*0.26,w:w-0.72,h:0.24,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
    });

    // Badge
    pill(s,x+0.62,y+h-0.30,w-0.80,0.22,fn.color,78);
    s.addText("→  "+fn.badge,{x:x+0.64,y:y+h-0.30,w:w-0.84,h:0.22,fontSize:8.5,fontFace:"Calibri",color:fn.color,bold:true,align:"center",valign:"middle",margin:0});
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 15 — SYSTEM ARCHITECTURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,3.5,1.5,5.0,4.5,C.blue,  90);
  glow(s,-1.0,0.5,4.0,3.5,C.emerald,93);

  sectionTag(s,"14  ·  SYSTEM ARCHITECTURE",0.35,0.22,C.blue);
  slideTitle(s,"System Architecture",0.35,0.58);

  const layers=[
    {label:"PRESENTATION LAYER",   color:C.emerald,
     desc:"React 18.3 + Vite 5.2 + TailwindCSS 3.4",
     detail:"6 pages · 50+ AI components · 11 custom hooks · Recharts 2.12 · Zustand 4.5",
     icon:"🌐"},
    {label:"API GATEWAY",          color:C.cyan,
     desc:"FastAPI 0.136 + uvicorn 0.47  (port 8001)",
     detail:"10 route groups · 39+ endpoints · CORS · Request Logger middleware · OpenAPI /docs",
     icon:"⚡"},
    {label:"SERVICES LAYER",       color:C.blue,
     desc:"30+ orchestration service modules in backend/services/",
     detail:"advisor_ai_router · context_builder · memory_manager · agent_council (7 agents) · regime_detector · signal_fusion",
     icon:"⚙"},
    {label:"DATA ENGINE",          color:C.violet,
     desc:"DuckDB 1.5.2 + pandas 3.0 + PyArrow 24.0",
     detail:"5 analytics functions · Lazy parquet queries · Dedup + outlier filter · query_cache · 12.6M South India rows",
     icon:"🗄"},
    {label:"ML FORECASTING ENGINE",color:C.amber,
     desc:"Prophet 1.3 · SparseTrend · XGBoost 3.2",
     detail:"Tier A/B → ProphetForecaster  ·  Tier C/D → SparseTrendForecaster  ·  Forecast cache (disk JSON)  ·  7d / 30d / 90d",
     icon:"📈"},
    {label:"AI LAYER (GEMINI)",    color:C.red,
     desc:"google-genai 2.8.0 · Gemini 2.5 Flash · temp=0.2 · thinking_budget=0",
     detail:"PromptContext (12 fields) · 8 structured error types · SSE streaming · 8-stage grounded pipeline · 4 analyst personas",
     icon:"🤖"},
    {label:"STORAGE",              color:C.gray2,
     desc:"12 Parquet files (~400 MB) · forecast_cache/ · optional Redis",
     detail:"data/raw/parquet/*.parquet  ·  AGMARKNET 2015–2026  ·  ADVISOR_MEMORY_BACKEND=memory|redis",
     icon:"💾"},
  ];

  // 7 layers: y=1.40, h=0.48, spacing=0.52
  // Layer 6 (last): y=1.40+6*0.52=4.52, h=0.48, bottom=5.00 ✓
  const layerH=0.48; const layerSp=0.52;
  layers.forEach((lyr,i)=>{
    const y=1.40+i*layerSp;
    glassCard(s,0.30,y,9.00,layerH,{fill:C.card,border:lyr.color,lw:1.0,shadow:i===0?mkShadow():null});
    accentBar(s,0.30,y,layerH,lyr.color);

    s.addText(lyr.icon,{x:0.44,y,w:0.44,h:layerH,fontSize:16,fontFace:"Calibri",color:lyr.color,align:"center",valign:"middle",margin:0});

    pill(s,0.94,y+0.12,1.50,0.22,lyr.color,80);
    s.addText(lyr.label,{x:0.94,y:y+0.12,w:1.50,h:0.22,fontSize:6.5,fontFace:"Calibri",color:lyr.color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1});

    // desc was w:3.10 — at 10pt Arial Black that's only ~36 chars; many descs are 45-70 chars → wrap
    // Fix: expand to w:6.46 so all descs fit on one line
    s.addText(lyr.desc,{x:2.50,y:y+0.05,w:6.46,h:0.22,fontSize:10,fontFace:"Arial Black",color:lyr.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(lyr.detail,{x:2.50,y:y+0.28,w:6.46,h:0.18,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});

    // Flow arrow
    if(i<layers.length-1){
      s.addText("▾",{x:9.36,y:y+layerH-0.06,w:0.24,h:0.20,fontSize:9,fontFace:"Calibri",color:lyr.color,align:"center",valign:"middle",margin:0});
    }
  });

  // (Side annotation removed — layer detail text covers the same information)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 16 — MODULE STRUCTURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.5,4.5,4.0,C.cyan,  91);
  glow(s, 6.5,1.0,4.5,4.0,C.violet,92);

  sectionTag(s,"15  ·  MODULE STRUCTURE",0.35,0.22,C.cyan);
  slideTitle(s,"Module Structure",0.35,0.58);

  // ── BACKEND TREE (LEFT)
  glassCard(s,0.28,1.40,4.52,3.56,{fill:C.card,border:C.cyan,lw:1.2,shadow:mkShadow()});
  accentBar(s,0.28,1.40,3.56,C.cyan);
  s.addText("🔧  backend/",{x:0.50,y:1.48,w:4.10,h:0.28,fontSize:11.5,fontFace:"Arial Black",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.46,1.82,4.14,C.cyan,68);

  const backendItems=[
    {depth:1,text:"core/",                   col:C.gray2,  note:"config · database · logger"},
    {depth:1,text:"data/",                   col:C.emerald,note:"analytics.py (5 functions)"},
    {depth:2,text:"loaders/  pipeline/",     col:C.gray3,  note:"duckdb_queries · ingestion"},
    {depth:2,text:"schema/",                 col:C.gray3,  note:"models.py (Pydantic schemas)"},
    {depth:1,text:"ml/forecasting/",         col:C.amber,  note:"prophet · xgboost · sparse_trend"},
    {depth:2,text:"cache/",                  col:C.gray3,  note:"forecast_cache · query_cache"},
    {depth:1,text:"services/",               col:C.blue,   note:"30+ orchestration modules"},
    {depth:2,text:"llm/",                    col:C.violet, note:"GeminiProvider · PromptBuilder · Guardrails"},
    {depth:2,text:"agents/",                 col:C.violet, note:"5 agents (trend·risk·seasonal·rec·briefing)"},
    {depth:1,text:"api/routes/",             col:C.cyan,   note:"10 route groups (39+ endpoints)"},
    {depth:1,text:"reports/",                col:C.emerald,note:"generator.py — PDF + Excel"},
    {depth:1,text:"utils/",                  col:C.gray2,  note:"crop_registry · constants · validators"},
  ];

  backendItems.forEach((item,i)=>{
    const indent=item.depth===1 ? 0.60 : 0.96;
    const y=1.90+i*0.25;
    s.addText(item.depth===1?"▸  "+item.text:"   "+item.text,{x:indent,y,w:1.60,h:0.24,
      fontSize:item.depth===1?10:9,fontFace:"Calibri",color:item.col,
      bold:item.depth===1,align:"left",valign:"middle",margin:0});
    s.addText(item.note,{x:2.26,y,w:2.40,h:0.24,fontSize:8.5,fontFace:"Calibri",color:C.gray3,align:"left",valign:"middle",margin:0});
  });

  // ── FRONTEND TREE (RIGHT)
  glassCard(s,5.00,1.40,4.70,3.56,{fill:C.card,border:C.violet,lw:1.2,shadow:mkShadow()});
  accentBar(s,5.00,1.40,3.56,C.violet);
  s.addText("⚛  frontend/src/",{x:5.22,y:1.48,w:4.24,h:0.28,fontSize:11.5,fontFace:"Arial Black",color:C.violet,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,5.18,1.82,4.32,C.violet,68);

  const frontendItems=[
    {depth:1,text:"pages/",         col:C.emerald,note:"6 pages: Dashboard · Forecast · AIAdvisor · CropExplorer · MapIntelligence · Reports"},
    {depth:1,text:"components/ai/", col:C.violet, note:"50+ components: AdvisorChat · AICouncilPanel · AIProbabilityPanel · AICommandMode"},
    {depth:2,text:"charts/",        col:C.gray3,  note:"ForecastChart · PriceLineChart · CropBarChart"},
    {depth:2,text:"ui/",            col:C.gray3,  note:"DashPanel · IntelligenceGrid · Badge · Card"},
    {depth:1,text:"hooks/",         col:C.cyan,   note:"11 hooks: useAnalytics · useForecast · useSpeechRecognition · useTextToSpeech"},
    {depth:1,text:"services/",      col:C.blue,   note:"10 API service files: advisorService · decisionService · intelligenceService"},
    {depth:1,text:"store/",         col:C.amber,  note:"Zustand: useForecastStore · usePriceStore"},
    {depth:1,text:"utils/",         col:C.gray2,  note:"constants.js · formatters.js"},
  ];

  frontendItems.forEach((item,i)=>{
    const indent=item.depth===1 ? 5.28 : 5.64;
    const y=1.90+i*0.38;
    s.addText(item.depth===1?"▸  "+item.text:"   "+item.text,{x:indent,y,w:1.60,h:0.36,
      fontSize:item.depth===1?10:9,fontFace:"Calibri",color:item.col,
      bold:item.depth===1,align:"left",valign:"top",margin:0});
    s.addText(item.note,{x:6.90,y,w:2.66,h:0.36,fontSize:8.5,fontFace:"Calibri",color:C.gray3,align:"left",valign:"top",margin:0});
  });

  // File count note
  glassCard(s,0.28,5.04,9.42,0.30,{fill:C.card2,border:C.cyan,lw:0.8});
  s.addText("Backend: ~45 Python files  ·  Frontend: ~75 JSX/JS files  ·  Total: ~120 source modules",{x:0.48,y:5.04,w:9.02,h:0.30,fontSize:10,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 17 — TECHNOLOGY STACK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,3.0,1.5,6.0,5.0,C.blue,90);

  sectionTag(s,"16  ·  TECHNOLOGY STACK",0.35,0.22,C.blue);
  slideTitle(s,"Technology Stack",0.35,0.58);

  const techCards=[
    {title:"Backend Core",    icon:"🐍",color:C.blue,
     items:["Python 3.13",
            "FastAPI 0.136.1",
            "uvicorn 0.47.0",
            "pydantic-settings 2.14.1",
            "python-dotenv 1.2.2",
            "structlog 25.5.0"]},
    {title:"Data Layer",      icon:"🦆",color:C.cyan,
     items:["DuckDB 1.5.2  (in-process)",
            "pandas 3.0.0",
            "PyArrow 24.0.0",
            "scipy 1.17.0",
            "numpy (via prophet)",
            "12 Parquet files · 400 MB"]},
    {title:"ML / Forecasting",icon:"📈",color:C.amber,
     items:["Prophet 1.3.0",
            "XGBoost 3.2.0",
            "SparseTrend (custom)",
            "Yearly multiplicative seasonality",
            "Indian holidays (country='IN')",
            "Theil-Sen median slopes"]},
    {title:"Generative AI",   icon:"🤖",color:C.violet,
     items:["google-genai 2.8.0",
            "gemini-2.5-flash",
            "temperature = 0.2",
            "thinking_budget = 0",
            "max_output_tokens = 2048",
            "SSE streaming  ·  8 error types"]},
    {title:"Frontend",        icon:"⚛", color:C.emerald,
     items:["React 18.3.1",
            "Vite 5.2.12",
            "TailwindCSS 3.4.4",
            "Recharts 2.12.7",
            "Zustand 4.5.2",
            "react-router-dom 6.23"]},
    {title:"Reports & Infra", icon:"📄",color:C.red,
     items:["openpyxl 3.1.5  (Excel)",
            "reportlab 4.5.1  (PDF)",
            "Optional Redis memory",
            "CORS: allow_origin_regex",
            "Structured error responses",
            "start.bat dual-server launch"]},
  ];

  // 3×2 grid: w=2.96, h=1.72
  // Row 0: y=1.40, bottom=3.12
  // Row 1: y=3.18, bottom=4.90 ✓
  techCards.forEach((tc,i)=>{
    const col=i%3; const row=Math.floor(i/3);
    const x=0.28+col*3.22; const y=1.40+row*1.80;
    const w=3.02; const h=1.72;

    glassCard(s,x,y,w,h,{fill:C.card,border:tc.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,x,y,h,tc.color);

    s.addText(tc.icon,{x:x+0.14,y:y+0.08,w:0.44,h:0.40,fontSize:18,fontFace:"Calibri",color:tc.color,align:"center",valign:"middle",margin:0});
    s.addText(tc.title,{x:x+0.62,y:y+0.08,w:w-0.74,h:0.32,fontSize:12.5,fontFace:"Arial Black",color:tc.color,bold:true,align:"left",valign:"middle",margin:0});
    hRule(s,x+0.14,y+0.48,w-0.28,tc.color,72);

    tc.items.forEach((item,j)=>{
      s.addText([
        {text:"·  ",options:{color:tc.color,bold:true}},
        {text:item,options:{color:C.gray1}},
      ],{x:x+0.16,y:y+0.56+j*0.18,w:w-0.26,h:0.17,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
    });
  });

  // Bottom note
  glassCard(s,0.28,5.00,9.44,0.28,{fill:C.card2,border:C.blue,lw:0.8});
  s.addText("All packages pinned with exact versions · backend/requirements.txt · frontend managed by npm with package-lock.json",{x:0.48,y:5.00,w:9.04,h:0.28,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 18 — API ROUTE MAP
// 10 route groups · 39+ endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.0,4.5,4.0,C.emerald,92);
  glow(s, 7.0,2.0,4.0,3.5,C.violet, 91);

  sectionTag(s,"17  ·  API ROUTE MAP",0.35,0.22,C.emerald);
  slideTitle(s,"API Route Map",0.35,0.58);

  s.addText("10 route groups · FastAPI  ·  All routes prefixed  /api/",{x:0.35,y:1.34,w:9.30,h:0.22,fontSize:10.5,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0,italic:true});

  const routes=[
    {prefix:"/api/prices",        color:C.emerald,tag:"Prices",
     endpoints:["GET  /prices?crop=Tomato&state=Karnataka","GET  /analytics/{crop}","GET  /summary/{crop}","GET  /trend/{crop}/{state}?window=30"]},
    {prefix:"/api/forecasts",     color:C.cyan,   tag:"Forecasts",
     endpoints:["GET  /forecasts/{crop}/{state}?days=7|30|90","Runs Prophet → SparseTrend fallback","Returns yhat / yhat_lower / yhat_upper","Cached 24h per crop×state×horizon"]},
    {prefix:"/api/crops",         color:C.blue,   tag:"Registry",
     endpoints:["GET  /crops           — 27 crops in registry","GET  /crops/registry  — full CropInfo objects","GET  /crops/coverage  — distinct-days matrix","GET  /crops/{name}    — single crop details"]},
    {prefix:"/api/advisor",       color:C.amber,  tag:"AI Advisor",
     endpoints:["POST /advisor/ask      — grounded Gemini call","POST /advisor/ask/stream — SSE token stream","GET  /advisor/history  — session turns","GET  /advisor/health   — Gemini + DB status"]},
    {prefix:"/api/briefing",      color:C.violet, tag:"Briefing",
     endpoints:["GET  /briefing/{crop}/{state} — 4-agent brief","POST /briefing/scenario        — heuristic sim","GET  /briefing/proactive       — cross-crop","GET  /briefing/recent/{crop}   — change signals"]},
    {prefix:"/api/ai",            color:C.blue,   tag:"GenAI",
     endpoints:["GET  /ai/insights/{crop}/{state}","GET  /ai/narrative/{crop}/{state}","AI Forecast Narrator service","Returns grounded Gemini narration"]},
    {prefix:"/api/watchlist",     color:C.emerald,tag:"Watchlist",
     endpoints:["GET  /watchlist?max_crops=8","Returns 5 buckets: momentum_leaders","risk_watch · safest_picks · seasonal_peaks","top_opportunity banner"]},
    {prefix:"/api/intelligence",  color:C.red,    tag:"Monitor",
     endpoints:["GET  /intelligence/monitor?max_crops=N","7 market regimes · escalation types","GET  /intelligence/compare/{crop}/{state}","Priority: CRITICAL→HIGH→WATCH→STABLE"]},
    {prefix:"/api/decision",      color:C.violet, tag:"Decision",
     endpoints:["GET  /council/{crop}/{state}  — 7-agent vote","GET  /probability/{crop}/{state}","GET  /strategy/{crop}/{state}?mode=farmer","GET  /executive-summary?max_crops=8"]},
    {prefix:"/api/reports",       color:C.amber,  tag:"Reports",
     endpoints:["POST /reports/pdf    — openpyxl PDF","POST /reports/excel  — reportlab Excel","Forecast + analytics + anomalies","Multi-crop executive summary report"]},
  ];

  // 2 columns of 5 cards: w=4.62, h=0.74, spacing=0.80
  // Row 4 (last): y=1.62+4*0.80=4.82, h=0.74, bottom=5.56 → EXCEEDS
  // Use h=0.68, spacing=0.72: Row 4: y=1.62+4*0.72=4.50, h=0.68, bottom=5.18 ✓
  routes.forEach((rt,i)=>{
    const col=i<5 ? 0 : 1;
    const row=i<5 ? i : i-5;
    const x=col===0 ? 0.28 : 5.08;
    const y=1.62+row*0.72;
    const w=4.66; const h=0.68;

    glassCard(s,x,y,w,h,{fill:C.card,border:rt.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,x,y,h,rt.color);

    pill(s,x+0.14,y+0.10,0.86,0.20,rt.color,80);
    s.addText(rt.tag,{x:x+0.14,y:y+0.10,w:0.86,h:0.20,fontSize:7,fontFace:"Calibri",color:rt.color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1});
    s.addText(rt.prefix,{x:x+1.04,y:y+0.08,w:3.48,h:0.24,fontSize:11,fontFace:"Arial Black",color:rt.color,bold:true,align:"left",valign:"middle",margin:0});

    // 2 key endpoints shown (abbreviated)
    rt.endpoints.slice(0,2).forEach((ep,j)=>{
      s.addText([
        {text:"›  ",options:{color:rt.color,bold:true}},
        {text:ep,  options:{color:C.gray2}},
      ],{x:x+0.14,y:y+0.36+j*0.16,w:w-0.24,h:0.15,fontSize:8.5,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE 19 — HARDWARE & SOFTWARE SPECIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,0.5,5.0,4.5,C.blue,  91);
  glow(s, 6.5,2.0,4.5,3.5,C.emerald,93);

  sectionTag(s,"18  ·  HARDWARE & SOFTWARE SPECS",0.35,0.22,C.cyan);
  slideTitle(s,"Hardware & Software Specs",0.35,0.58);

  // ── Three spec columns  w=3.00, h=2.78
  // Bottom: y=1.42+2.78=4.20 ✓
  const specCols=[
    {title:"Development\nEnvironment",   icon:"💻",color:C.blue,
     items:[
       {label:"OS",      val:"Windows 11 Home Single Language"},
       {label:"Python",  val:"3.13 (virtual environment)"},
       {label:"Node.js", val:"18+ / npm 10+"},
       {label:"Backend", val:"uvicorn on port 8001"},
       {label:"Frontend",val:"Vite dev server on port 5173"},
       {label:"Launch",  val:"start.bat (dual terminal windows)"},
     ]},
    {title:"Data\nInfrastructure",       icon:"🗄", color:C.emerald,
     items:[
       {label:"Dataset",    val:"AGMARKNET 12 Parquet files"},
       {label:"Total size", val:"~400 MB on disk"},
       {label:"Engine",     val:"DuckDB 1.5.2 in-process"},
       {label:"Access",     val:"Exclusive single process"},
       {label:"Evaluation", val:"Lazy (no full file load)"},
       {label:"Cache",      val:"Forecast cache (disk JSON, 24h TTL)"},
     ]},
    {title:"Runtime\nConfiguration",     icon:"⚙", color:C.violet,
     items:[
       {label:"API key",    val:"GEMINI_API_KEY in backend/.env"},
       {label:"CORS",       val:"allow_origin_regex: localhost:*"},
       {label:"Memory",     val:"In-process TTL 2h or Redis"},
       {label:"Reload",     val:"Hot-reload safe for routes only"},
       {label:"Restart req.",val:"After .env changes (singleton)"},
       {label:"GPU",        val:"Not required — CPU-only ML"},
     ]},
  ];

  specCols.forEach((col,i)=>{
    const x=0.28+i*3.22; const y=1.40; const w=3.02; const h=2.74;
    glassCard(s,x,y,w,h,{fill:C.card,border:col.color,lw:1.2,shadow:mkShadow()});
    accentBar(s,x,y,h,col.color);
    s.addText(col.icon,{x:x+0.14,y:y+0.08,w:0.48,h:0.44,fontSize:20,fontFace:"Calibri",color:col.color,align:"center",valign:"middle",margin:0});
    s.addText(col.title,{x:x+0.66,y:y+0.08,w:2.22,h:0.44,fontSize:12,fontFace:"Arial Black",color:col.color,bold:true,align:"left",valign:"middle",margin:0});
    hRule(s,x+0.14,y+0.60,w-0.28,col.color,70);

    col.items.forEach((item,j)=>{
      const iy=y+0.70+j*0.34;
      s.addText(item.label,{x:x+0.18,y:iy,w:0.90,h:0.30,fontSize:8.5,fontFace:"Calibri",color:col.color,bold:true,align:"left",valign:"middle",margin:0,charSpacing:0.5});
      s.addText(item.val,{x:x+1.10,y:iy,w:w-1.20,h:0.30,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
    });
  });

  // ── Startup flow diagram  y=4.26, h=0.58
  glassCard(s,0.28,4.28,9.44,0.58,{fill:C.card2,border:C.cyan,lw:1.0});
  s.addText("STARTUP SEQUENCE",{x:0.44,y:4.32,w:1.40,h:0.22,fontSize:8,fontFace:"Calibri",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1.5});

  const startupSteps=[
    {n:"1",label:"start.bat",          col:C.amber  },
    {n:"2",label:"DuckDB connect()",   col:C.emerald},
    {n:"3",label:"Parquet VIEW created",col:C.cyan  },
    {n:"4",label:"Gemini singleton init",col:C.violet},
    {n:"5",label:"FastAPI ready :8001", col:C.blue  },
    {n:"6",label:"Vite dev :5173",     col:C.emerald},
  ];
  startupSteps.forEach((st,i)=>{
    const x=1.90+i*1.30;
    circle(s,x,4.38,0.30,C.bg,st.col);
    s.addText(st.n,{x,y:4.38,w:0.30,h:0.30,fontSize:10,fontFace:"Arial Black",color:st.col,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(st.label,{x:x-0.30,y:4.70,w:0.90,h:0.13,fontSize:7.5,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
    if(i<startupSteps.length-1){
      s.addText("→",{x:x+0.30,y:4.38,w:1.00,h:0.30,fontSize:11,fontFace:"Calibri",color:st.col,align:"center",valign:"middle",margin:0});
    }
  });

  // Bottom note
  glassCard(s,0.28,4.96,9.44,0.30,{fill:"090e1a",border:C.blue,lw:0.8});
  s.addText("No GPU · No Docker · No cloud dependency during development · Entire stack runs locally in < 30 seconds from cold start",{x:0.48,y:4.96,w:9.04,h:0.30,fontSize:9.5,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
}

// ─── WRITE ────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName:"AgroPrice_AI_Slides_11_19.pptx" })
  .then(()=> console.log("✅  AgroPrice_AI_Slides_11_19.pptx written"))
  .catch(err => { console.error("❌ ", err); process.exit(1); });
