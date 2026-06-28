"use strict";
const pptxgen = require("pptxgenjs");

// ─── THEME (identical to rest of deck) ────────────────────────────────────────
const C = {
  bg:"050816", bg2:"07101f", card:"0d1a2e", card2:"0f2040",
  border:"1e3a5f", border2:"2a4a7a",
  emerald:"10B981", cyan:"06B6D4", blue:"3B82F6", violet:"8B5CF6",
  amber:"F59E0B", red:"EF4444", white:"FFFFFF",
  gray1:"E2E8F0", gray2:"94A3B8", gray3:"475569",
};

const mkShadow = () => ({type:"outer",color:"000000",opacity:0.55,blur:18,offset:6,angle:135});
function addBg(s,c){ s.addShape("rect",{x:0,y:0,w:10,h:5.625,fill:{color:c||C.bg},line:{color:c||C.bg,width:0}}); }
function glow(s,x,y,w,h,color,t){ s.addShape("ellipse",{x,y,w,h,fill:{color,transparency:t||88},line:{color,transparency:100}}); }
function accentBar(s,x,y,h,color){ s.addShape("rect",{x,y,w:0.06,h,fill:{color:color||C.emerald},line:{color:color||C.emerald,transparency:100}}); }
function glassCard(s,x,y,w,h,o={}){ s.addShape("rect",{x,y,w,h,fill:{color:o.fill||C.card,transparency:o.fillT||0},line:{color:o.border||C.border,width:o.lw||1.0},shadow:o.shadow||null}); }
function pill(s,x,y,w,h,color,t){ s.addShape("roundRect",{x,y,w,h,fill:{color,transparency:t||80},line:{color,transparency:50,width:0.8},rectRadius:0.12}); }
function circle(s,x,y,r,fill,border){ s.addShape("ellipse",{x,y,w:r,h:r,fill:{color:fill},line:{color:border||fill,width:1.5}}); }
function hRule(s,x,y,w,color,t){ s.addShape("line",{x,y,w,h:0,line:{color:color||C.border2,width:0.8,transparency:t||0}}); }
function chip(s,x,y,w,h,color,t){ s.addShape("rect",{x,y,w,h,fill:{color,transparency:t||75},line:{color,transparency:55,width:0.8}}); }
function sectionTag(s,text,x,y,color){
  chip(s,x,y,2.80,0.25,color,80);
  s.addText(text,{x,y,w:2.80,h:0.25,fontSize:8,fontFace:"Calibri",color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1.5});
}
function slideTitle(s,text,x,y,w){ s.addText(text,{x,y,w:w||9.3,h:0.68,fontSize:36,fontFace:"Arial Black",color:C.white,bold:true,align:"left",valign:"middle",margin:0}); }

// Flow box helper for pipeline diagrams
function fbox(s,x,y,w,h,label,sub,color){
  glassCard(s,x,y,w,h,{fill:C.card2,border:color,lw:1.2,shadow:mkShadow()});
  accentBar(s,x,y,h,color);
  s.addText(label,{x:x+0.12,y:y+0.04,w:w-0.18,h:h*0.54,fontSize:9.5,fontFace:"Arial Black",color,bold:true,align:"center",valign:"middle",margin:0});
  if(sub) s.addText(sub,{x:x+0.10,y:y+h*0.55,w:w-0.16,h:h*0.40,fontSize:7.5,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
}
function arr(s,x,y,color){ s.addText("▶",{x,y,w:0.28,h:0.22,fontSize:9,fontFace:"Calibri",color:color||C.blue,align:"center",valign:"middle",margin:0}); }

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "S. Abhilash";
pres.title  = "AgroPrice AI — Generative AI Theory";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-01 — SECTION TITLE: GENERATIVE AI THEORY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  // Ambient glows — large and dramatic for section divider
  glow(s,-2.0,-1.0, 7.0,5.0, C.violet, 86);
  glow(s, 5.0, 1.5, 6.0,5.0, C.blue,   89);
  glow(s, 2.0, 3.0, 4.0,3.0, C.cyan,   92);

  // Section label chip
  chip(s,0.36,0.26,3.40,0.28,C.violet,72);
  s.addText("PART II  ·  GENERATIVE AI FOUNDATIONS",{x:0.36,y:0.26,w:3.40,h:0.28,fontSize:8,fontFace:"Calibri",color:C.violet,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1.5});

  // Main title — large
  s.addText("Generative AI",{x:0.36,y:0.72,w:9.28,h:1.10,fontSize:64,fontFace:"Arial Black",color:C.white,bold:true,align:"left",valign:"middle",margin:0});
  s.addText("Theoretical Foundations & Implementation Architecture",{x:0.36,y:1.84,w:9.28,h:0.44,fontSize:18,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});
  hRule(s,0.36,2.38,9.28,C.violet,55);

  // 8 topic chips in 2 rows
  const topics=[
    {label:"AI/ML/DL/GenAI Hierarchy",  color:C.blue   },
    {label:"LLM Token Prediction",       color:C.cyan   },
    {label:"Gemini 2.5 Flash",           color:C.violet },
    {label:"Prompt Engineering",         color:C.emerald},
    {label:"Grounding Pipeline",         color:C.amber  },
    {label:"7-Agent Council",            color:C.red    },
    {label:"Explainable AI (XAI)",       color:C.cyan   },
    {label:"Agricultural AI Ethics",     color:C.emerald},
  ];
  topics.forEach((t,i)=>{
    const col=i%4; const row=Math.floor(i/4);
    const x=0.36+col*2.40; const y=2.58+row*0.52;
    pill(s,x,y,2.20,0.38,t.color,74);
    s.addText(t.label,{x,y,w:2.20,h:0.38,fontSize:9,fontFace:"Calibri",color:t.color,bold:true,align:"center",valign:"middle",margin:0});
  });

  // Subtitle note
  glassCard(s,0.36,3.74,9.28,0.30,{fill:C.card2,border:C.violet,lw:0.8});
  s.addText("AgroPrice AI uses Gemini 2.5 Flash as its reasoning engine — grounded entirely on deterministic AGMARKNET data  ·  zero hallucination by design",
    {x:0.56,y:3.74,w:8.88,h:0.30,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});

  // Decorative grid lines
  for(let i=0;i<8;i++) s.addShape("line",{x:0,y:4.20+i*0.20,w:10,h:0,line:{color:C.border,width:0.4,transparency:82}});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-02 — AI / ML / DL / GenAI HIERARCHY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.0,5.0,5.0,C.blue,  89);
  glow(s, 6.0,0.5,5.0,4.0,C.violet,91);

  sectionTag(s,"GEN AI  ·  01  —  LANDSCAPE",0.35,0.22,C.blue);
  slideTitle(s,"The AI Intelligence Hierarchy",0.35,0.58);

  // LEFT: Nested concentric rectangle diagram
  // Outer: AI (blue), next: ML (cyan), next: DL (violet), inner: GenAI (emerald)
  const boxes=[
    {label:"ARTIFICIAL INTELLIGENCE",desc:"Rule-based systems, search, optimization, expert systems",color:C.blue,  x:0.30,y:1.40,w:4.60,h:3.72},
    {label:"MACHINE LEARNING",       desc:"Statistical learning from data — regression, classification, clustering",color:C.cyan,  x:0.60,y:1.76,w:4.00,h:3.04},
    {label:"DEEP LEARNING",          desc:"Neural networks — CNNs, RNNs, attention mechanisms",color:C.violet,x:0.90,y:2.12,w:3.40,h:2.34},
    {label:"GENERATIVE AI",          desc:"Creates text, images, code — Transformers, LLMs, diffusion",color:C.emerald,x:1.20,y:2.48,w:2.80,h:1.60},
  ];

  boxes.forEach(b=>{
    glassCard(s,b.x,b.y,b.w,b.h,{fill:C.card,border:b.color,lw:1.4,fillT:b.label==="ARTIFICIAL INTELLIGENCE"?0:20});
    s.addText(b.label,{x:b.x+0.14,y:b.y+0.06,w:b.w-0.24,h:0.24,fontSize:b.label==="GENERATIVE AI"?8:9,fontFace:"Arial Black",color:b.color,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1});
    s.addText(b.desc,{x:b.x+0.14,y:b.y+0.32,w:b.w-0.24,h:0.30,fontSize:7.5,fontFace:"Calibri",color:C.gray2,align:"left",valign:"top",margin:0});
  });

  // AgroPrice AI marker inside GenAI box
  glassCard(s,1.30,3.52,2.60,0.40,{fill:"0a2214",border:C.emerald,lw:1.2});
  s.addText("🎯  AgroPrice AI sits here",{x:1.34,y:3.52,w:2.52,h:0.40,fontSize:9,fontFace:"Calibri",color:C.emerald,bold:true,align:"center",valign:"middle",margin:0});

  // RIGHT: 4 comparison cards
  const rightCards=[
    {icon:"🤖",title:"Traditional AI",color:C.blue,
     pts:["Hardcoded rules","Expert system logic","Zero learning from data","Deterministic outputs"]},
    {icon:"📊",title:"Machine Learning",color:C.cyan,
     pts:["Learns from labeled data","Feature engineering needed","Statistical predictions","Prophet/XGBoost in AgroPrice AI"]},
    {icon:"🧠",title:"Deep Learning",color:C.violet,
     pts:["Hierarchical feature extraction","Requires large datasets","Transformer architecture","Foundation of LLMs"]},
    {icon:"✨",title:"Generative AI",color:C.emerald,
     pts:["Creates novel language output","Prompted with context","Gemini 2.5 Flash in our system","Narrates agricultural insights"]},
  ];
  rightCards.forEach((c,i)=>{
    const y=1.40+i*1.04;
    glassCard(s,5.10,y,4.58,0.96,{fill:C.card,border:c.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,5.10,y,0.96,c.color);
    s.addText(c.icon,{x:5.22,y,w:0.44,h:0.96,fontSize:18,fontFace:"Calibri",color:c.color,align:"center",valign:"middle",margin:0});
    s.addText(c.title,{x:5.72,y:y+0.06,w:3.82,h:0.26,fontSize:11,fontFace:"Arial Black",color:c.color,bold:true,align:"left",valign:"middle",margin:0});
    c.pts.slice(0,3).forEach((p,j)=>{
      s.addText([{text:"›  ",options:{color:c.color,bold:true}},{text:p,options:{color:C.gray1}}],
        {x:5.72,y:y+0.34+j*0.20,w:3.82,h:0.18,fontSize:8.5,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
    });
  });

  glassCard(s,0.30,5.10,9.40,0.26,{fill:C.card2,border:C.blue,lw:0.8});
  s.addText("AgroPrice AI combines ALL four layers: DuckDB deterministic engine + Prophet/XGBoost ML + Gemini 2.5 Flash GenAI = Grounded Agricultural Intelligence",
    {x:0.50,y:5.10,w:9.00,h:0.26,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-03 — HOW LARGE LANGUAGE MODELS WORK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,3.5,0.5,5.0,4.0,C.violet,89);
  glow(s,-0.5,2.5,4.5,3.5,C.cyan,  92);

  sectionTag(s,"GEN AI  ·  02  —  LLM ARCHITECTURE",0.35,0.22,C.violet);
  // Shorter title to avoid wrapping
  s.addText("LLM Architecture & Token Prediction",{x:0.35,y:0.56,w:9.30,h:0.60,fontSize:30,fontFace:"Arial Black",color:C.white,bold:true,align:"left",valign:"middle",margin:0});

  // TOP: Token prediction flow — 6 boxes, tightly spaced to fit in 9.44"
  // bw=1.44, increment=1.52 → i=5 right edge = 0.28+5*1.52+1.44 = 9.32" ✓
  const tflow=[
    {label:"Raw Prompt",     sub:"\"What is Tomato\nprice today?\"",   color:C.gray2 },
    {label:"Tokenizer",      sub:"['What','is','Tom','ato','price']",   color:C.cyan  },
    {label:"Embedding Layer",sub:"Token IDs → 768-dim vectors",         color:C.blue  },
    {label:"Transformer\nBlocks",sub:"32× Self-Attention layers",       color:C.violet},
    {label:"Logit Head",     sub:"Vocab probability dist.",             color:C.amber },
    {label:"Output Token",   sub:"Sampling at temp=0.2",               color:C.emerald},
  ];
  const bw=1.44; const gap=0.08;
  tflow.forEach((t,i)=>{
    const x=0.28+i*(bw+gap);
    fbox(s,x,1.30,bw,0.92,t.label,t.sub,t.color);
    if(i<tflow.length-1) arr(s,x+bw+0.01,1.30+0.35,t.color);
  });

  // Key insight label
  glassCard(s,0.28,2.34,9.44,0.28,{fill:"0a0d20",border:C.violet,lw:0.8});
  s.addText("Autoregressive: Each output token becomes input for the next — the model predicts ONE token at a time, left to right",
    {x:0.48,y:2.34,w:9.04,h:0.28,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0,italic:true});

  // BOTTOM: 4 key concept cards
  const concepts=[
    {icon:"🎯",title:"Attention Mechanism",color:C.violet,
     body:"Self-attention lets each token 'look at' all other tokens in the context window simultaneously. This gives the model understanding of long-range dependencies — e.g. relating 'tomato' to 'price' 50 tokens earlier."},
    {icon:"📏",title:"Context Window",color:C.blue,
     body:"Gemini 2.5 Flash supports up to 1M tokens context. AgroPrice AI injects the full PromptContext (market data, forecasts, history, analytics) here — the LLM reasons over this window."},
    {icon:"🌡",title:"Temperature (0.2)",color:C.amber,
     body:"Temperature controls output randomness. At temp=0.2, the model strongly prefers the highest-probability next token. Results are near-deterministic, consistent, and factual — critical for financial data narration."},
    {icon:"🔄",title:"Autoregressive Gen.",color:C.emerald,
     body:"Each generated token is appended to the input and the model runs again to predict the next. SSE streaming exploits this: each token is sent to the frontend as soon as it is generated, creating real-time typewriter output."},
  ];
  const cw=2.24;
  concepts.forEach((c,i)=>{
    const x=0.28+i*(cw+0.10);
    glassCard(s,x,2.88,cw,2.10,{fill:C.card,border:c.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,x,2.88,2.10,c.color);
    s.addText(c.icon,{x:x+0.12,y:2.92,w:0.44,h:0.40,fontSize:18,fontFace:"Calibri",color:c.color,align:"center",valign:"middle",margin:0});
    s.addText(c.title,{x:x+0.60,y:2.92,w:cw-0.70,h:0.38,fontSize:10,fontFace:"Arial Black",color:c.color,bold:true,align:"left",valign:"middle",margin:0});
    hRule(s,x+0.14,3.36,cw-0.24,c.color,70);
    s.addText(c.body,{x:x+0.14,y:3.42,w:cw-0.22,h:1.48,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0,lineSpacingMultiple:1.15});
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-04 — WHY GENAI IN AGRICULTURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,2.0,5.5,4.0,C.emerald,89);
  glow(s, 6.0,0.5,5.0,3.5,C.amber,  92);

  sectionTag(s,"GEN AI  ·  03  —  AGRICULTURAL AI",0.35,0.22,C.emerald);
  slideTitle(s,"Why Generative AI in Agriculture?",0.35,0.58);

  // LEFT: Pain points
  glassCard(s,0.28,1.38,4.50,3.50,{fill:C.card,border:C.red,lw:1.2,shadow:mkShadow()});
  accentBar(s,0.28,1.38,3.50,C.red);
  s.addText("THE PROBLEM",{x:0.50,y:1.46,w:4.10,h:0.28,fontSize:13,fontFace:"Arial Black",color:C.red,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.46,1.82,4.14,C.red,65);

  const problems=[
    {icon:"📊",title:"Data Complexity",
     body:"48.2M rows of raw price data across 5 states, 27 crops, 12 years. No farmer can read raw AGMARKNET tables and derive actionable decisions."},
    {icon:"⏰",title:"Time-Critical Decisions",
     body:"Harvesting, transportation, and mandi selection are irreversible decisions made under time pressure. Delayed or wrong insight = direct financial loss."},
    {icon:"🌐",title:"Expert Access Gap",
     body:"Agricultural market experts are scarce and expensive. 85% of South Indian farmers lack access to professional market advisory. GenAI democratizes expertise."},
    {icon:"🔀",title:"Multi-Variable Complexity",
     body:"Price is influenced by season, rainfall, transport, supply-demand, state policy, and market anomalies — too many variables for manual analysis."},
  ];
  problems.forEach((p,i)=>{
    const y=2.00+i*0.78;
    s.addText(p.icon,{x:0.46,y,w:0.42,h:0.62,fontSize:16,fontFace:"Calibri",color:C.red,align:"center",valign:"middle",margin:0});
    s.addText(p.title,{x:0.94,y:y+0.02,w:3.70,h:0.24,fontSize:10,fontFace:"Arial Black",color:C.red,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(p.body,{x:0.94,y:y+0.28,w:3.70,h:0.30,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0});
  });

  // Center connector arrows
  ["▶","▶","▶","▶"].forEach((_,i)=>{
    s.addText("▶",{x:4.82,y:2.02+i*0.78+0.18,w:0.28,h:0.26,fontSize:12,fontFace:"Calibri",color:C.emerald,align:"center",valign:"middle",margin:0});
  });

  // RIGHT: GenAI solutions
  glassCard(s,5.14,1.38,4.56,3.50,{fill:C.card,border:C.emerald,lw:1.2,shadow:mkShadow()});
  accentBar(s,5.14,1.38,3.50,C.emerald);
  s.addText("THE GENAI SOLUTION",{x:5.36,y:1.46,w:4.14,h:0.28,fontSize:13,fontFace:"Arial Black",color:C.emerald,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,5.32,1.82,4.18,C.emerald,65);

  const solutions=[
    {icon:"💬",title:"Natural Language Narration",
     body:"Gemini converts raw statistical metrics into plain-language advisory: 'Tomato prices show strong upward momentum with 18% growth in 7 days.'"},
    {icon:"🎯",title:"Grounded Decision Advisory",
     body:"Every narrative is backed by real DuckDB data. No hallucinations. The LLM reasons ABOUT truth — it does not invent price forecasts or trends."},
    {icon:"🗣",title:"Multi-Turn Conversational AI",
     body:"Farmers ask follow-up questions in natural language. Session memory preserves crop/state context across 10 turns (2h TTL) for continuity."},
    {icon:"🎭",title:"Persona-Adapted Responses",
     body:"4 personas: Farmer (plain language), Trader (momentum), Wholesale (procurement), Analyst (statistical). Gemini adapts its response style per audience."},
  ];
  solutions.forEach((sol,i)=>{
    const y=2.00+i*0.78;
    s.addText(sol.icon,{x:5.30,y,w:0.42,h:0.62,fontSize:16,fontFace:"Calibri",color:C.emerald,align:"center",valign:"middle",margin:0});
    s.addText(sol.title,{x:5.78,y:y+0.02,w:3.78,h:0.24,fontSize:10,fontFace:"Arial Black",color:C.emerald,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(sol.body,{x:5.78,y:y+0.28,w:3.78,h:0.30,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0});
  });

  glassCard(s,0.28,5.00,9.44,0.28,{fill:C.card2,border:C.emerald,lw:0.8});
  s.addText("Result: Agricultural intelligence previously available only to commodity traders is now accessible to every farmer via a conversational AI interface",
    {x:0.48,y:5.00,w:9.04,h:0.28,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-05 — GEMINI 2.5 FLASH — MODEL PROFILE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,0.5,6.0,5.0,C.violet,87);
  glow(s, 7.0,2.0,5.0,4.0,C.blue,  91);

  sectionTag(s,"GEN AI  ·  04  —  GEMINI 2.5 FLASH",0.35,0.22,C.violet);
  slideTitle(s,"Gemini 2.5 Flash — Model Architecture",0.35,0.58);

  // Model identity card (LEFT)
  glassCard(s,0.28,1.40,4.56,3.60,{fill:C.card,border:C.violet,lw:1.4,shadow:mkShadow()});
  accentBar(s,0.28,1.40,3.60,C.violet);
  s.addText("🤖",{x:0.40,y:1.46,w:0.60,h:0.60,fontSize:28,fontFace:"Calibri",color:C.violet,align:"center",valign:"middle",margin:0});
  s.addText("gemini-2.5-flash",{x:1.06,y:1.46,w:3.64,h:0.38,fontSize:18,fontFace:"Arial Black",color:C.violet,bold:true,align:"left",valign:"middle",margin:0});
  s.addText("Google DeepMind  ·  Multimodal Foundation Model",{x:1.06,y:1.84,w:3.64,h:0.24,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});
  hRule(s,0.44,2.16,4.22,C.violet,60);

  const specs=[
    {label:"Model family",    val:"Gemini 2.x Flash (efficient tier)",    color:C.violet},
    {label:"Context window",  val:"Up to 1,000,000 tokens",               color:C.cyan  },
    {label:"Modalities",      val:"Text · Code · Vision · Audio",          color:C.blue  },
    {label:"SDK used",        val:"google-genai 2.8.0 (native async)",    color:C.emerald},
    {label:"API call type",   val:"client.aio.models.generate_content",   color:C.amber },
    {label:"Safety settings", val:"types.SafetySetting (4 categories)",   color:C.red   },
    {label:"Output format",   val:"GeminiResult(text, error_type, ms)",   color:C.violet},
    {label:"Error types",     val:"8 structured: quota/key/safety/timeout",color:C.gray2},
  ];
  specs.forEach((sp,i)=>{
    const y=2.28+i*0.32;
    if(i%2===0) s.addShape("rect",{x:0.44,y,w:4.20,h:0.31,fill:{color:C.card2,transparency:40},line:{color:C.border,transparency:80}});
    s.addText(sp.label,{x:0.50,y,w:1.50,h:0.31,fontSize:8.5,fontFace:"Calibri",color:sp.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(sp.val,{x:2.04,y,w:2.56,h:0.31,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
  });

  // RIGHT: Why Flash over Pro/Ultra
  glassCard(s,5.04,1.40,4.66,1.50,{fill:C.card,border:C.cyan,lw:1.0,shadow:mkShadow()});
  accentBar(s,5.04,1.40,1.50,C.cyan);
  s.addText("Why Flash (not Pro or Ultra)?",{x:5.22,y:1.46,w:4.30,h:0.28,fontSize:12,fontFace:"Arial Black",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0});
  const whyFlash=[
    "Flash has 1M token context — sufficient for full PromptContext injection",
    "Latency: Flash averages 2–4s · Pro takes 8–15s — critical for live advisory",
    "Cost efficiency: Flash is 10× cheaper per token vs Pro at same context length",
    "Thinking disabled (budget=0) — narration task does not need deep reasoning",
  ];
  whyFlash.forEach((wf,j)=>{
    s.addText([{text:"✓  ",options:{color:C.cyan,bold:true}},{text:wf,options:{color:C.gray1}}],
      {x:5.22,y:1.82+j*0.24,w:4.30,h:0.22,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
  });

  // RIGHT: Multimodal capability visual
  glassCard(s,5.04,3.02,4.66,2.00,{fill:C.card,border:C.violet,lw:1.0,shadow:mkShadow()});
  accentBar(s,5.04,3.02,2.00,C.violet);
  s.addText("Multimodal Capability (used for text only in AgroPrice AI)",{x:5.22,y:3.08,w:4.30,h:0.28,fontSize:10,fontFace:"Arial Black",color:C.violet,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,5.20,3.42,4.30,C.violet,68);
  const modes=[
    {icon:"📝",label:"Text (PRIMARY)",   note:"All advisory, narration, analysis",          color:C.violet,active:true },
    {icon:"👁",label:"Vision",           note:"Not used — data is structured numeric",       color:C.gray3, active:false},
    {icon:"🎵",label:"Audio",            note:"Not used — TTS/STT via Web Speech API",      color:C.gray3, active:false},
    {icon:"💻",label:"Code",             note:"Blocked by agricultural guardrails",          color:C.gray3, active:false},
  ];
  modes.forEach((m,i)=>{
    const y=3.52+i*0.36;
    const col=m.active?m.color:C.gray3;
    s.addText(m.icon,{x:5.22,y,w:0.38,h:0.32,fontSize:14,fontFace:"Calibri",color:col,align:"center",valign:"middle",margin:0});
    s.addText(m.label,{x:5.64,y,w:1.20,h:0.32,fontSize:9,fontFace:"Calibri",color:col,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(m.note, {x:6.86,y,w:2.70,h:0.32,fontSize:8.5,fontFace:"Calibri",color:m.active?C.gray1:C.gray3,align:"left",valign:"middle",margin:0});
  });

  glassCard(s,0.28,5.10,9.44,0.26,{fill:"090e1a",border:C.violet,lw:0.8});
  s.addText("AgroPrice AI uses Gemini purely for natural language narration — all numerical intelligence comes from DuckDB + Prophet/XGBoost, not the LLM",
    {x:0.48,y:5.10,w:9.04,h:0.26,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0,italic:true});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-06 — TEMPERATURE & THINKING BUDGET EXPLAINED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-0.5,1.0,5.5,5.0,C.amber, 88);
  glow(s, 6.5,0.5,5.0,4.0,C.violet,91);

  sectionTag(s,"GEN AI  ·  05  —  MODEL CONFIGURATION",0.35,0.22,C.amber);
  slideTitle(s,"Temperature & Thinking Budget",0.35,0.58);

  // TEMPERATURE SECTION (left)
  glassCard(s,0.28,1.38,4.64,3.72,{fill:C.card,border:C.amber,lw:1.2,shadow:mkShadow()});
  accentBar(s,0.28,1.38,3.72,C.amber);
  s.addText("🌡  Temperature = 0.2",{x:0.46,y:1.44,w:4.28,h:0.36,fontSize:15,fontFace:"Arial Black",color:C.amber,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.44,1.88,4.30,C.amber,65);

  // Temperature scale visualization
  s.addText("TEMPERATURE SCALE",{x:0.46,y:2.00,w:4.28,h:0.22,fontSize:8,fontFace:"Calibri",color:C.gray3,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1.5});
  // Background gradient bar
  s.addShape("rect",{x:0.46,y:2.28,w:4.28,h:0.30,fill:{color:C.border,transparency:40},line:{color:C.border,transparency:80}});
  // Colored gradient segments
  const segs=[
    {x:0.46,w:1.06,color:"10B981"},{x:1.52,w:1.06,color:"06B6D4"},
    {x:2.58,w:1.06,color:"F59E0B"},{x:3.64,w:1.10,color:"EF4444"},
  ];
  segs.forEach(sg=>s.addShape("rect",{x:sg.x,y:2.28,w:sg.w,h:0.30,fill:{color:sg.color,transparency:45},line:{color:sg.color,transparency:100}}));
  // Scale labels
  [["0.0","Deterministic"],["0.2","Our Setting"],["0.5","Balanced"],["1.0","Creative"]].forEach(([val,lbl],i)=>{
    const x=0.46+i*1.42;
    const col=i===1?C.amber:C.gray3;
    s.addText(val,{x,y:2.62,w:1.06,h:0.20,fontSize:9,fontFace:"Arial Black",color:col,bold:i===1,align:"center",valign:"middle",margin:0});
    s.addText(lbl,{x,y:2.80,w:1.06,h:0.16,fontSize:7,fontFace:"Calibri",color:col,align:"center",valign:"middle",margin:0});
    if(i===1){
      s.addShape("line",{x:x+0.53,y:2.24,w:0,h:0.08,line:{color:C.amber,width:1.5}});
      s.addText("▲",{x:x+0.44,y:2.14,w:0.18,h:0.14,fontSize:7,fontFace:"Calibri",color:C.amber,align:"center",valign:"middle",margin:0});
    }
  });

  // Why 0.2 explanation
  const why02=[
    {icon:"✓",text:"Near-deterministic output — same market data → same advisory tone every time",color:C.emerald},
    {icon:"✓",text:"Reduces hallucination risk — model strongly prefers factual tokens over creative ones",color:C.emerald},
    {icon:"✓",text:"Enterprise consistency — farmers see reliable, coherent responses across sessions",color:C.emerald},
    {icon:"✗",text:"Higher temp (0.7+) would generate varied, creative answers — wrong for price data",color:C.red},
  ];
  why02.forEach((w,i)=>{
    s.addText([{text:w.icon+"  ",options:{color:w.color,bold:true}},{text:w.text,options:{color:w.color===C.red?C.gray2:C.gray1}}],
      {x:0.46,y:3.06+i*0.26,w:4.28,h:0.24,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
  });

  // THINKING BUDGET SECTION (right)
  glassCard(s,5.14,1.38,4.56,3.72,{fill:C.card,border:C.violet,lw:1.2,shadow:mkShadow()});
  accentBar(s,5.14,1.38,3.72,C.violet);
  s.addText("🧠  Thinking Budget = 0",{x:5.32,y:1.44,w:4.16,h:0.36,fontSize:15,fontFace:"Arial Black",color:C.violet,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,5.28,1.88,4.16,C.violet,65);

  s.addText("WHAT IS THINKING BUDGET?",{x:5.32,y:1.98,w:4.16,h:0.22,fontSize:8,fontFace:"Calibri",color:C.gray3,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1.5});
  s.addText("Gemini 2.5 Flash has a built-in 'thinking' capability — internal chain-of-thought reasoning before generating output. The thinking_budget parameter (0 = disabled) controls how many tokens are allocated to this internal reasoning phase.",
    {x:5.32,y:2.24,w:4.16,h:0.54,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0,lineSpacingMultiple:1.2});

  // Before/after comparison
  glassCard(s,5.28,2.88,1.96,1.64,{fill:C.card2,border:C.red,lw:1.0});
  s.addText("❌  Budget = AUTO",{x:5.38,y:2.94,w:1.76,h:0.24,fontSize:9,fontFace:"Calibri",color:C.red,bold:true,align:"center",valign:"middle",margin:0});
  const before=["Thinking tokens: ~800","Remaining for response: ~44","Output: 176 chars","Status: TRUNCATED ✗"];
  before.forEach((b,i)=>s.addText(b,{x:5.36,y:3.24+i*0.26,w:1.80,h:0.22,fontSize:8.5,fontFace:"Calibri",color:C.red,align:"center",valign:"middle",margin:0}));

  glassCard(s,7.36,2.88,2.22,1.64,{fill:C.card2,border:C.emerald,lw:1.0});
  s.addText("✅  Budget = 0",{x:7.46,y:2.94,w:2.02,h:0.24,fontSize:9,fontFace:"Calibri",color:C.emerald,bold:true,align:"center",valign:"middle",margin:0});
  const after=["Thinking tokens: 0","All 2048 for response","Output: 1325 chars","Status: COMPLETE ✓"];
  after.forEach((a,i)=>s.addText(a,{x:7.46,y:3.24+i*0.26,w:2.02,h:0.22,fontSize:8.5,fontFace:"Calibri",color:C.emerald,align:"center",valign:"middle",margin:0}));

  s.addText("Why disabled?",{x:5.32,y:4.60,w:4.16,h:0.20,fontSize:9,fontFace:"Calibri",color:C.violet,bold:true,align:"left",valign:"middle",margin:0});
  s.addText("Narration task — all facts are pre-injected. Gemini does not need to 'think'; it narrates. Thinking would only consume output token budget unnecessarily.",
    {x:5.32,y:4.82,w:4.16,h:0.26,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0});

  glassCard(s,0.28,5.12,9.44,0.24,{fill:"090e1a",border:C.amber,lw:0.8});
  s.addText("Combined effect: temp=0.2 + thinking_budget=0 = fast, deterministic, factual narration — ideal for financial agricultural advisory",
    {x:0.48,y:5.12,w:9.04,h:0.24,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-07 — PROMPTCONTEXT — THE GROUNDING CONTRACT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.5,5.5,4.5,C.cyan,  89);
  glow(s, 6.5,0.5,5.0,4.0,C.blue,  91);

  sectionTag(s,"GEN AI  ·  06  —  PROMPT CONTEXT",0.35,0.22,C.cyan);
  slideTitle(s,"PromptContext — The Grounding Contract",0.35,0.58);

  s.addText("The PromptContext dataclass is the contract between the deterministic engine and the LLM layer. Every field comes from real data — never invented.",
    {x:0.35,y:1.32,w:9.30,h:0.24,fontSize:10,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0,italic:true});

  // Two column layout: Deterministic (left) vs Computed (right)
  // Header labels
  glassCard(s,0.28,1.64,4.60,0.32,{fill:"081428",border:C.emerald,lw:1.0});
  s.addText("✅  DETERMINISTIC (from DuckDB)",{x:0.38,y:1.64,w:4.40,h:0.32,fontSize:10,fontFace:"Arial Black",color:C.emerald,bold:true,align:"center",valign:"middle",margin:0});

  glassCard(s,5.08,1.64,4.62,0.32,{fill:"081428",border:C.cyan,lw:1.0});
  s.addText("🔢  COMPUTED (from Analytics Engine)",{x:5.18,y:1.64,w:4.42,h:0.32,fontSize:10,fontFace:"Arial Black",color:C.cyan,bold:true,align:"center",valign:"middle",margin:0});

  const leftFields=[
    {name:"crop",              val:"Validated crop name (27-crop registry)",      color:C.emerald},
    {name:"state",             val:"South Indian state (5 states)",               color:C.emerald},
    {name:"current_modal_price",val:"Latest day's AVG(Modal_Price) from DuckDB", color:C.emerald},
    {name:"price_min_30d",     val:"MIN(y) over last 30 days in time series",     color:C.emerald},
    {name:"price_max_30d",     val:"MAX(y) over last 30 days in time series",     color:C.emerald},
    {name:"historical_summary",val:"AGMARKNET retrieval: year/month avg prices",  color:C.emerald},
  ];
  const rightFields=[
    {name:"volatility_cv",       val:"Coefficient of Variation = σ/μ × 100%",     color:C.cyan},
    {name:"momentum_signal",     val:"compute_momentum_signal() 7d vs 30d avg",   color:C.cyan},
    {name:"seasonal_phase",      val:"peak | trough | normal from monthly profile",color:C.cyan},
    {name:"anomaly_events",      val:"Z-score spike/crash detections (90d window)",color:C.amber},
    {name:"forecast_7d/30d/90d", val:"Prophet/XGBoost predicted price + CI",      color:C.blue },
    {name:"confidence_score",    val:"Reliability: training depth + staleness",    color:C.blue },
  ];

  leftFields.forEach((f,i)=>{
    const y=2.04+i*0.50;
    glassCard(s,0.28,y,4.60,0.44,{fill:C.card,border:C.emerald,lw:0.8});
    accentBar(s,0.28,y,0.44,C.emerald);
    s.addText(f.name,{x:0.44,y:y+0.02,w:2.20,h:0.20,fontSize:9,fontFace:"Calibri",color:C.emerald,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(f.val, {x:0.44,y:y+0.22,w:4.26,h:0.18,fontSize:8,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
  });
  rightFields.forEach((f,i)=>{
    const y=2.04+i*0.50;
    glassCard(s,5.08,y,4.62,0.44,{fill:C.card,border:f.color,lw:0.8});
    accentBar(s,5.08,y,0.44,f.color);
    s.addText(f.name,{x:5.24,y:y+0.02,w:2.50,h:0.20,fontSize:9,fontFace:"Calibri",color:f.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(f.val, {x:5.24,y:y+0.22,w:4.28,h:0.18,fontSize:8,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
  });

  // Bottom: The boundary
  glassCard(s,0.28,5.06,9.44,0.30,{fill:"0a1a08",border:C.emerald,lw:1.0});
  s.addText("The Deterministic Boundary  ·  Gemini NEVER generates or modifies these values  ·  It only reasons ABOUT them in natural language",
    {x:0.48,y:5.06,w:9.04,h:0.30,fontSize:10,fontFace:"Calibri",color:C.emerald,bold:true,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-08 — GROUNDING PIPELINE (Full Architecture Flow)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 0.0,0.5,5.0,4.0,C.blue,   89);
  glow(s, 5.5,1.5,5.5,4.0,C.emerald,91);

  sectionTag(s,"GEN AI  ·  07  —  GROUNDING PIPELINE",0.35,0.22,C.blue);
  slideTitle(s,"Grounded Generation Pipeline",0.35,0.58);

  // The 8-stage pipeline (2 rows of 4 boxes)
  const stages=[
    {n:"1",label:"User Query",        sub:"POST /advisor/ask",  color:C.gray2 },
    {n:"2",label:"Guardrails Check",  sub:"Domain + Injection", color:C.red   },
    {n:"3",label:"Session Memory",    sub:"Crop/state inherit", color:C.amber },
    {n:"4",label:"Intent Classify",   sub:"Rule-based NLP",     color:C.cyan  },
    {n:"5",label:"DuckDB + Analytics",sub:"Real price data",    color:C.emerald},
    {n:"6",label:"Agent Council",     sub:"7 specialist agents",color:C.blue  },
    {n:"7",label:"PromptBuilder",     sub:"Context injection",  color:C.violet},
    {n:"8",label:"Gemini Narrates",   sub:"temp=0.2, budget=0", color:C.violet},
  ];

  const bw=2.14; const bh=0.88;
  stages.forEach((st,i)=>{
    const row=Math.floor(i/4); const col=i%4;
    const x=0.28+col*(bw+0.30); const y=1.44+row*(bh+0.36);
    glassCard(s,x,y,bw,bh,{fill:C.card,border:st.color,lw:1.2,shadow:mkShadow()});
    accentBar(s,x,y,bh,st.color);
    circle(s,x+0.14,y+0.08,0.32,C.bg,st.color);
    s.addText(st.n,{x:x+0.14,y:y+0.08,w:0.32,h:0.32,fontSize:11,fontFace:"Arial Black",color:st.color,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(st.label,{x:x+0.54,y:y+0.08,w:bw-0.62,h:0.36,fontSize:10,fontFace:"Arial Black",color:st.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(st.sub,{x:x+0.54,y:y+0.48,w:bw-0.62,h:0.28,fontSize:8.5,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});
    // Row 1 arrows
    if(col<3) arr(s,x+bw+0.04,y+bh/2-0.11,st.color);
  });

  // Down arrow between rows
  s.addText("▼",{x:4.88,y:2.36,w:0.30,h:0.40,fontSize:16,fontFace:"Calibri",color:C.emerald,align:"center",valign:"middle",margin:0});

  // Row 2 right-to-left arrows (stage 5→6→7→8)
  [5,6,7].forEach(i=>{
    const col=i%4; const row=Math.floor(i/4);
    const x=0.28+col*(bw+0.30); const y=1.44+row*(bh+0.36);
    if(col<3) arr(s,x+bw+0.04,y+bh/2-0.11,stages[i].color);
  });

  // 3 grounding principles beneath the pipeline (fill empty space)
  const principles=[
    {icon:"🔒",label:"Zero Hallucination",desc:"Gemini receives exact DuckDB values — cannot contradict pre-injected facts",color:C.emerald},
    {icon:"⚡",label:"Sub-5ms Guardrails", desc:"Off-domain queries rejected before Gemini is ever invoked",             color:C.red    },
    {icon:"📋",label:"Full Audit Trail",   desc:"reasoning_trace captures every stage: crop→intent→trend→confidence",    color:C.cyan   },
  ];
  principles.forEach((p,i)=>{
    const x=0.28+i*3.22;
    glassCard(s,x,3.74,3.02,0.90,{fill:C.card,border:p.color,lw:0.8,shadow:mkShadow()});
    accentBar(s,x,3.74,0.90,p.color);
    s.addText(p.icon,{x:x+0.14,y:3.74,w:0.44,h:0.90,fontSize:18,fontFace:"Calibri",color:p.color,align:"center",valign:"middle",margin:0});
    s.addText(p.label,{x:x+0.62,y:3.80,w:2.26,h:0.24,fontSize:10,fontFace:"Arial Black",color:p.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(p.desc,{x:x+0.62,y:4.06,w:2.26,h:0.50,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0,lineSpacingMultiple:1.1});
  });

  // Output / result banner
  glassCard(s,0.28,4.80,9.44,0.30,{fill:"0a1a10",border:C.emerald,lw:1.2});
  s.addText("OUTPUT  →  AdvisorResponse {answer, intent, sources, grounded:true, error_type, latency_ms, agent_insights, reasoning_trace}",
    {x:0.48,y:4.80,w:9.04,h:0.30,fontSize:9.5,fontFace:"Calibri",color:C.emerald,bold:true,align:"center",valign:"middle",margin:0});

  // Key insight
  s.addText("\"Gemini narrates ABOUT the data — it does not create the data\"",
    {x:0.28,y:5.12,w:9.44,h:0.22,fontSize:9,fontFace:"Calibri",color:C.gray3,align:"center",valign:"middle",margin:0,italic:true});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-09 — PROMPT ENGINEERING & PERSONA FRAMING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.0,6.0,5.0,C.violet,88);
  glow(s, 7.0,2.0,5.0,4.0,C.cyan,  92);

  sectionTag(s,"GEN AI  ·  08  —  PROMPT ENGINEERING",0.35,0.22,C.violet);
  slideTitle(s,"Prompt Engineering & Persona Framing",0.35,0.58);

  // LEFT: Prompt structure anatomy
  glassCard(s,0.28,1.38,4.58,3.70,{fill:C.card,border:C.violet,lw:1.2,shadow:mkShadow()});
  accentBar(s,0.28,1.38,3.70,C.violet);
  s.addText("PROMPT ANATOMY (Section Order)",{x:0.46,y:1.44,w:4.22,h:0.26,fontSize:10,fontFace:"Arial Black",color:C.violet,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.44,1.78,4.24,C.violet,65);

  const sections=[
    {n:"1",title:"Persona Framing",       color:C.emerald,desc:"Audience & communication style set FIRST — frames everything after"},
    {n:"2",title:"System Identity",       color:C.cyan,  desc:"'You are an expert agricultural market analyst for South India...'"},
    {n:"3",title:"Market Data Section",   color:C.blue,  desc:"Current price, 30d range, trend direction, momentum signal"},
    {n:"4",title:"Forecast Section",      color:C.amber, desc:"7d / 30d / 90d predictions with confidence intervals"},
    {n:"5",title:"Correlation Signals",   color:C.violet,desc:"CONFIRMING / CONTRADICTION / MIXED agent signal pairs"},
    {n:"6",title:"Confidence Narrative",  color:C.cyan,  desc:"Model reliability: training depth, CV, staleness, tier"},
    {n:"7",title:"Anomaly + Historical",  color:C.red,   desc:"Spike/crash events, AGMARKNET historical comparisons"},
    {n:"8",title:"Question + Style",      color:C.emerald,desc:"User's question + output format constraints + domain lock"},
  ];
  sections.forEach((sec,i)=>{
    const y=1.92+i*0.40;
    circle(s,0.44,y+0.05,0.28,C.bg,sec.color);
    s.addText(sec.n,{x:0.44,y:y+0.05,w:0.28,h:0.28,fontSize:9,fontFace:"Arial Black",color:sec.color,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(sec.title,{x:0.80,y:y+0.02,w:1.66,h:0.20,fontSize:9,fontFace:"Calibri",color:sec.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(sec.desc,{x:0.80,y:y+0.22,w:3.88,h:0.16,fontSize:7.5,fontFace:"Calibri",color:C.gray2,align:"left",valign:"middle",margin:0});
  });

  // RIGHT: 4 Analyst Personas
  s.addText("4 ANALYST PERSONAS",{x:5.06,y:1.38,w:4.64,h:0.24,fontSize:10,fontFace:"Arial Black",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1.5});

  const personas=[
    {mode:"farmer",    icon:"🌾",color:C.emerald,
     style:"Plain language, action-oriented",
     focus:"Harvest timing · local mandi pricing · perishability · when to sell"},
    {mode:"trader",    icon:"📈",color:C.cyan,
     style:"Commercial, momentum-focused",
     focus:"7–30d price trajectory · volatility as opportunity · bulk decision timing"},
    {mode:"wholesale", icon:"🏭",color:C.blue,
     style:"Supply-chain, cost-conscious",
     focus:"Procurement timing · bulk pricing · cold storage · cross-market sourcing"},
    {mode:"analyst",   icon:"📊",color:C.violet,
     style:"Institutional brief, statistical rigour",
     focus:"Full CV citation · structured Outlook → Risk → Recommendation format"},
  ];
  personas.forEach((p,i)=>{
    const y=1.70+i*0.88;
    glassCard(s,5.06,y,4.64,0.82,{fill:C.card,border:p.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,5.06,y,0.82,p.color);
    s.addText(p.icon,{x:5.18,y,w:0.46,h:0.82,fontSize:18,fontFace:"Calibri",color:p.color,align:"center",valign:"middle",margin:0});
    pill(s,5.68,y+0.10,1.00,0.22,p.color,78);
    s.addText(p.mode.toUpperCase(),{x:5.68,y:y+0.10,w:1.00,h:0.22,fontSize:8,fontFace:"Calibri",color:p.color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1});
    s.addText(p.style,{x:6.74,y:y+0.08,w:2.82,h:0.22,fontSize:9,fontFace:"Calibri",color:C.gray1,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(p.focus,{x:5.68,y:y+0.38,w:3.88,h:0.36,fontSize:8,fontFace:"Calibri",color:C.gray2,align:"left",valign:"top",margin:0});
  });

  // Safety constraints note
  glassCard(s,0.28,5.08,9.44,0.28,{fill:"140a0a",border:C.red,lw:0.8});
  s.addText("Agricultural Domain Lock: coding, politics, crypto, medical, legal, recipes, entertainment  →  ALL rejected by guardrails before Gemini is invoked  ·  Response time: ~4ms",
    {x:0.48,y:5.08,w:9.04,h:0.28,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-10 — RAG-LIKE GROUNDING ARCHITECTURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 2.0,0.5,6.0,5.0,C.cyan,   88);
  glow(s,-1.0,2.0,5.0,4.0,C.emerald,91);

  sectionTag(s,"GEN AI  ·  09  —  RAG-LIKE GROUNDING",0.35,0.22,C.cyan);
  slideTitle(s,"Grounding vs Hallucination",0.35,0.58);

  // Main flow diagram: DATA → CONTEXT → GEMINI → RESPONSE
  const mainFlow=[
    {icon:"🗄", label:"AGMARKNET\nDuckDB",     color:C.emerald, x:0.28},
    {icon:"⚙",  label:"Analytics\nEngine",     color:C.blue,    x:2.50},
    {icon:"📋", label:"PromptContext\nAssembly",color:C.cyan,    x:4.72},
    {icon:"🤖", label:"Gemini\n2.5 Flash",     color:C.violet,  x:6.94},
    {icon:"💬", label:"Grounded\nResponse",    color:C.emerald, x:9.16},
  ];
  const fw=1.88; const fh=1.20;
  mainFlow.forEach((f,i)=>{
    glassCard(s,f.x,1.36,fw,fh,{fill:C.card,border:f.color,lw:1.4,shadow:mkShadow()});
    accentBar(s,f.x,1.36,fh,f.color);
    s.addText(f.icon,{x:f.x+0.08,y:1.36,w:fw-0.12,h:0.50,fontSize:20,fontFace:"Calibri",color:f.color,align:"center",valign:"middle",margin:0});
    s.addText(f.label,{x:f.x+0.10,y:1.88,w:fw-0.16,h:0.64,fontSize:9,fontFace:"Arial Black",color:f.color,bold:true,align:"center",valign:"middle",margin:0});
    if(i<mainFlow.length-1) arr(s,f.x+fw+0.04,1.36+fh/2-0.11,f.color);
  });

  // Comparison table: Traditional RAG vs AgroPrice Grounding
  glassCard(s,0.28,2.74,4.60,2.40,{fill:C.card,border:C.amber,lw:1.0,shadow:mkShadow()});
  accentBar(s,0.28,2.74,2.40,C.amber);
  s.addText("🔎  Traditional RAG",{x:0.46,y:2.80,w:4.24,h:0.28,fontSize:12,fontFace:"Arial Black",color:C.amber,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.44,3.14,4.24,C.amber,65);
  const ragPoints=[
    "Retrieves unstructured text chunks from vector DB",
    "Ambiguous relevance — cosine similarity only",
    "Hallucination risk: LLM may ignore retrieved context",
    "Retrieval may miss critical numeric values",
    "Works best for knowledge-base Q&A",
  ];
  ragPoints.forEach((p,i)=>s.addText([{text:"•  ",options:{color:C.amber,bold:true}},{text:p,options:{color:C.gray1}}],
    {x:0.46,y:3.22+i*0.32,w:4.24,h:0.28,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0}));

  glassCard(s,5.08,2.74,4.62,2.40,{fill:C.card,border:C.emerald,lw:1.0,shadow:mkShadow()});
  accentBar(s,5.08,2.74,2.40,C.emerald);
  s.addText("✅  AgroPrice Deterministic Grounding",{x:5.26,y:2.80,w:4.26,h:0.28,fontSize:12,fontFace:"Arial Black",color:C.emerald,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,5.24,3.14,4.26,C.emerald,65);
  const ourPoints=[
    "Retrieves exact SQL results from DuckDB (zero ambiguity)",
    "Typed numeric values: price=₹1,234/qtl, CV=28.4%",
    "Zero hallucination: Gemini only narrates pre-injected data",
    "Structured context: 12 typed PromptContext fields",
    "Purpose-built for financial time-series narration",
  ];
  ourPoints.forEach((p,i)=>s.addText([{text:"✓  ",options:{color:C.emerald,bold:true}},{text:p,options:{color:C.gray1}}],
    {x:5.26,y:3.22+i*0.32,w:4.26,h:0.28,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0}));

  glassCard(s,0.28,5.24,9.44,0.26,{fill:"0a1a10",border:C.cyan,lw:0.8});
  s.addText("Key differentiator: AgroPrice AI retrieves structured numeric facts, not prose chunks — Gemini narrates facts it cannot contradict",
    {x:0.48,y:5.24,w:9.04,h:0.26,fontSize:9.5,fontFace:"Calibri",color:C.cyan,align:"center",valign:"middle",margin:0,italic:true});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-11 — 7-AGENT COUNCIL ARCHITECTURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s, 3.5,0.5,5.0,4.5,C.blue,  88);
  glow(s,-1.0,2.0,5.0,4.0,C.violet,90);

  sectionTag(s,"GEN AI  ·  10  —  MULTI-AGENT COUNCIL",0.35,0.22,C.blue);
  slideTitle(s,"7-Agent Specialist Council",0.35,0.58);

  const agents=[
    {n:"1",name:"Trend Analyst",     icon:"📈",w:0.22,color:C.emerald,
     spec:"Price direction from momentum + 30d vs 90d rate comparison",
     stances:"STRONG_BULLISH / BULLISH / MILD_BULLISH / NEUTRAL / BEARISH"},
    {n:"2",name:"Risk Analyst",      icon:"⚠",  w:0.18,color:C.red,
     spec:"Volatility CV + anomaly cluster count + tier risk scoring",
     stances:"LOW_RISK / MODERATE / HIGH_RISK / EXTREME_RISK"},
    {n:"3",name:"Seasonal Analyst",  icon:"🌙",w:0.15,color:C.cyan,
     spec:"Seasonal phase positioning: peak / trough / lean / normal",
     stances:"DEEP_PEAK / PEAK_SEASON / LEAN / DEEP_TROUGH / NORMAL"},
    {n:"4",name:"Supply/Demand",     icon:"⚖",  w:0.15,color:C.amber,
     spec:"Price-vs-year-average inference (no arrival data in AGMARKNET)",
     stances:"BULLISH / BEARISH / NEUTRAL (inferred from momentum)"},
    {n:"5",name:"Volatility Analyst",icon:"〰",  w:0.12,color:C.violet,
     spec:"CV patterns, recent price standard deviation analysis",
     stances:"Inputs to Risk + Confidence engines"},
    {n:"6",name:"Opportunity Analyst",icon:"💎",w:0.10,color:C.blue,
     spec:"Opportunity score from combined signal synthesis",
     stances:"Score 0–100 (weighted composite)"},
    {n:"7",name:"Forecast Reliability",icon:"🎯",w:0.08,color:C.gray2,
     spec:"Training depth (rows), data staleness, model tier (A/B/C/D)",
     stances:"Reliability score + confidence label"},
  ];

  agents.forEach((ag,i)=>{
    const y=1.38+i*0.57;
    glassCard(s,0.28,y,9.44,0.52,{fill:C.card,border:ag.color,lw:0.8});
    accentBar(s,0.28,y,0.52,ag.color);
    circle(s,0.42,y+0.10,0.32,C.bg,ag.color);
    s.addText(ag.n,{x:0.42,y:y+0.10,w:0.32,h:0.32,fontSize:10,fontFace:"Arial Black",color:ag.color,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(ag.icon,{x:0.82,y,w:0.44,h:0.52,fontSize:16,fontFace:"Calibri",color:ag.color,align:"center",valign:"middle",margin:0});
    s.addText(ag.name,{x:1.32,y:y+0.04,w:2.00,h:0.22,fontSize:10,fontFace:"Arial Black",color:ag.color,bold:true,align:"left",valign:"middle",margin:0});
    // Weight bar
    const barW=Math.max(0.20,ag.w*4.0);
    s.addShape("rect",{x:1.32,y:y+0.30,w:2.00,h:0.12,fill:{color:C.border,transparency:60},line:{color:C.border,transparency:100}});
    s.addShape("rect",{x:1.32,y:y+0.30,w:barW,h:0.12,fill:{color:ag.color,transparency:30},line:{color:ag.color,transparency:100}});
    s.addText(`Weight: ${(ag.w*100).toFixed(0)}%`,{x:1.32,y:y+0.42,w:2.00,h:0.10,fontSize:7,fontFace:"Calibri",color:ag.color,align:"left",valign:"middle",margin:0});
    s.addText(ag.spec,{x:3.40,y:y+0.04,w:3.60,h:0.22,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
    s.addText(ag.stances,{x:3.40,y:y+0.30,w:3.60,h:0.18,fontSize:7.5,fontFace:"Calibri",color:C.gray3,align:"left",valign:"middle",margin:0,italic:true});
    pill(s,7.06,y+0.10,2.58,0.32,ag.color,78);
    s.addText("→ "+ag.stances.split("/")[0].trim(),{x:7.06,y:y+0.10,w:2.58,h:0.32,fontSize:8,fontFace:"Calibri",color:ag.color,bold:true,align:"center",valign:"middle",margin:0});
  });

  glassCard(s,0.28,5.40,9.44,0.22,{fill:C.card2,border:C.blue,lw:0.8});
  s.addText("Weighted aggregation → CouncilResult { dominant_view, minority_view, contradiction_detected, consensus_strength, dissent_agents, weighted_recommendation }",
    {x:0.48,y:5.40,w:9.04,h:0.22,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-12 — CONSENSUS & CORRELATION INTELLIGENCE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.0,5.5,5.0,C.emerald,88);
  glow(s, 6.0,0.5,5.0,4.0,C.blue,   91);

  sectionTag(s,"GEN AI  ·  11  —  CONSENSUS ENGINE",0.35,0.22,C.emerald);
  slideTitle(s,"Consensus & Correlation Intelligence",0.35,0.58);

  // LEFT: How consensus is built
  glassCard(s,0.28,1.38,4.58,3.70,{fill:C.card,border:C.emerald,lw:1.2,shadow:mkShadow()});
  accentBar(s,0.28,1.38,3.70,C.emerald);
  s.addText("CONSENSUS SCORING PIPELINE",{x:0.46,y:1.44,w:4.22,h:0.26,fontSize:10,fontFace:"Arial Black",color:C.emerald,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,0.44,1.78,4.22,C.emerald,65);

  const csteps=[
    {n:"1",title:"Individual Verdicts",   color:C.gray2,
     body:"Each of 7 agents returns: stance (BULLISH/BEARISH/etc.), confidence score (0–100), and reasoning bullets"},
    {n:"2",title:"Weighted Aggregation",  color:C.cyan,
     body:"weighted_score = Σ(agent.confidence × agent.weight) / Σ weights\nTotal weights sum to 1.00"},
    {n:"3",title:"Consensus Strength",    color:C.blue,
     body:"Agreement ratio: if 5/7 agents agree = 71% consensus. Below 40% triggers contradiction_detected=True"},
    {n:"4",title:"Confidence Collapse",   color:C.amber,
     body:"When CV>45% AND anomaly_count>3 AND trend contradicts season → confidence collapses to 'low' regardless of scores"},
    {n:"5",title:"Final Recommendation",  color:C.emerald,
     body:"SELL_NOW / SELL_SOON / HOLD / WAIT / WATCH based on weighted vote + opportunity score + seasonal timing"},
  ];
  csteps.forEach((cs,i)=>{
    const y=1.92+i*0.64;
    circle(s,0.44,y+0.06,0.30,C.bg,cs.color);
    s.addText(cs.n,{x:0.44,y:y+0.06,w:0.30,h:0.30,fontSize:10,fontFace:"Arial Black",color:cs.color,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(cs.title,{x:0.82,y:y+0.02,w:3.88,h:0.22,fontSize:10,fontFace:"Calibri",color:cs.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText(cs.body,{x:0.82,y:y+0.26,w:3.88,h:0.30,fontSize:8,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0,lineSpacingMultiple:1.1});
  });

  // RIGHT: Correlation signal types
  glassCard(s,5.08,1.38,4.62,3.70,{fill:C.card,border:C.cyan,lw:1.2,shadow:mkShadow()});
  accentBar(s,5.08,1.38,3.70,C.cyan);
  s.addText("CORRELATION SIGNAL TYPES",{x:5.26,y:1.44,w:4.26,h:0.26,fontSize:10,fontFace:"Arial Black",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,5.22,1.78,4.26,C.cyan,65);

  const correls=[
    {type:"CONFIRMING",     icon:"✅",color:C.emerald,
     ex1:"Bullish momentum + peak season → double confirmation",
     ex2:"Low risk + sell_soon → coherent strategy signal",
     inj:"Boosts Gemini's confidence in recommendation"},
    {type:"CONTRADICTION",  icon:"⚡",color:C.red,
     ex1:"Bearish trend + peak season → season should push prices up",
     ex2:"Bullish trend + extreme risk → unstable uptrend",
     inj:"Gemini advises caution; acknowledges conflicting signals"},
    {type:"MIXED SIGNAL",   icon:"🌀",color:C.amber,
     ex1:"Peak season + high volatility → opportunity but risky",
     ex2:"Bullish trend + falling demand inference",
     inj:"Gemini presents both sides without false certainty"},
    {type:"ANOMALY CONTEXT",icon:"🔴",color:C.violet,
     ex1:"3+ anomalies alongside upward trend",
     ex2:"Spike events during harvest season peak",
     inj:"Gemini contextualizes anomalies historically"},
  ];
  correls.forEach((cr,i)=>{
    const y=1.92+i*0.84;
    glassCard(s,5.22,y,4.36,0.78,{fill:C.card2,border:cr.color,lw:0.8});
    s.addText(cr.icon,{x:5.30,y,w:0.38,h:0.78,fontSize:16,fontFace:"Calibri",color:cr.color,align:"center",valign:"middle",margin:0});
    pill(s,5.72,y+0.08,1.30,0.22,cr.color,76);
    s.addText(cr.type,{x:5.72,y:y+0.08,w:1.30,h:0.22,fontSize:7.5,fontFace:"Calibri",color:cr.color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:0.8});
    s.addText(cr.ex1,{x:5.72,y:y+0.34,w:3.76,h:0.16,fontSize:8,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
    s.addText(cr.inj, {x:5.72,y:y+0.54,w:3.76,h:0.16,fontSize:7.5,fontFace:"Calibri",color:cr.color,align:"left",valign:"middle",margin:0,italic:true});
  });

  glassCard(s,0.28,5.18,9.44,0.26,{fill:C.card2,border:C.emerald,lw:0.8});
  s.addText("All correlation signals injected into PromptContext.correlation_signals → Gemini cites them explicitly in advisory ('confirming', 'however', 'despite') for nuanced narration",
    {x:0.48,y:5.18,w:9.04,h:0.26,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-13 — EXPLAINABLE AI (XAI) IN AGRICULTURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.5,6.0,4.5,C.amber, 87);
  glow(s, 6.0,0.5,5.5,4.0,C.blue,  91);

  sectionTag(s,"GEN AI  ·  12  —  EXPLAINABLE AI",0.35,0.22,C.amber);
  slideTitle(s,"Explainable AI (XAI) in Agriculture",0.35,0.58);

  // Why XAI matters in agriculture — top banner
  glassCard(s,0.28,1.36,9.44,0.48,{fill:C.card2,border:C.amber,lw:1.0});
  accentBar(s,0.28,1.36,0.48,C.amber);
  s.addText("Why XAI? In agriculture, a wrong recommendation means real crop loss, unsold inventory, or wrong harvest timing. Farmers need to TRUST the AI's reasoning — not just its verdict.",
    {x:0.46,y:1.36,w:9.14,h:0.48,fontSize:10,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0,lineSpacingMultiple:1.15});

  // 6-stage audit pipeline
  s.addText("6-STAGE DECISION AUDIT PIPELINE",{x:0.28,y:1.96,w:5.00,h:0.24,fontSize:9,fontFace:"Calibri",color:C.amber,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1.5});

  const auditStages=[
    {n:"1",title:"Data Layer",          color:C.emerald,result:"Real DuckDB price → verified numeric source"},
    {n:"2",title:"Analytics Layer",     color:C.cyan,   result:"5 functions → volatility, momentum, season, anomalies, quality"},
    {n:"3",title:"Agent Verdicts",      color:C.blue,   result:"7 agents → individual stances with confidence scores"},
    {n:"4",title:"Correlation Check",   color:C.amber,  result:"Cross-agent signal alignment → CONFIRMING / CONTRADICTION"},
    {n:"5",title:"Confidence Scoring",  color:C.violet, result:"Confidence engine → contributor / detractor bullets"},
    {n:"6",title:"Reasoning Trace",     color:C.red,    result:"crop|state|intent|trend|risk|seasonal|confidence|correlations"},
  ];
  auditStages.forEach((as,i)=>{
    const y=2.28+i*0.44;
    glassCard(s,0.28,y,6.80,0.40,{fill:C.card,border:as.color,lw:0.8});
    accentBar(s,0.28,y,0.40,as.color);
    circle(s,0.42,y+0.05,0.30,C.bg,as.color);
    s.addText(as.n,{x:0.42,y:y+0.05,w:0.30,h:0.30,fontSize:10,fontFace:"Arial Black",color:as.color,bold:true,align:"center",valign:"middle",margin:0});
    s.addText(as.title,{x:0.80,y,w:1.68,h:0.40,fontSize:9.5,fontFace:"Calibri",color:as.color,bold:true,align:"left",valign:"middle",margin:0});
    s.addText("→  "+as.result,{x:2.54,y,w:4.46,h:0.40,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"middle",margin:0});
  });

  // Right: XAI features in AgroPrice AI
  glassCard(s,7.28,1.96,2.42,2.76,{fill:C.card,border:C.amber,lw:1.0,shadow:mkShadow()});
  accentBar(s,7.28,1.96,2.76,C.amber);
  s.addText("XAI Features",{x:7.46,y:2.02,w:2.06,h:0.26,fontSize:11,fontFace:"Arial Black",color:C.amber,bold:true,align:"left",valign:"middle",margin:0});
  hRule(s,7.44,2.34,2.10,C.amber,65);
  const xaiFeats=[
    {icon:"📊",label:"Decision Trace Panel",color:C.amber},
    {icon:"🤝",label:"Agent Council View",  color:C.blue },
    {icon:"📈",label:"Confidence Engine",   color:C.cyan },
    {icon:"⚡",label:"Correlation Signals", color:C.emerald},
    {icon:"🔍",label:"Evidence Quality Bar",color:C.violet},
    {icon:"🎯",label:"Reasoning Trace Chips",color:C.red },
  ];
  xaiFeats.forEach((xf,i)=>{
    s.addText([{text:xf.icon+"  ",options:{color:xf.color}},{text:xf.label,options:{color:C.gray1}}],
      {x:7.44,y:2.42+i*0.34,w:2.10,h:0.30,fontSize:9,fontFace:"Calibri",align:"left",valign:"middle",margin:0});
  });

  // Reasoning trace example
  glassCard(s,0.28,4.56,9.44,0.64,{fill:"0a0d20",border:C.violet,lw:1.0});
  s.addText("REASONING TRACE EXAMPLE (injected into every advisory response)",{x:0.46,y:4.58,w:9.04,h:0.22,fontSize:8.5,fontFace:"Calibri",color:C.gray3,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1});
  s.addText('"crop: Tomato  |  state: Karnataka  |  intent: price_now  |  trend: BULLISH (72%)  |  risk: MODERATE (58%)  |  seasonal: PEAK_SEASON (91%)  |  confidence: high (74%)  |  correlations: 2 CONFIRMING"',
    {x:0.46,y:4.80,w:9.04,h:0.34,fontSize:9,fontFace:"Calibri",color:C.violet,align:"left",valign:"middle",margin:0,italic:true});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-14 — SSE STREAMING & REAL-TIME INFERENCE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,1.0,5.5,5.0,C.cyan,  88);
  glow(s, 6.0,1.5,5.5,4.0,C.emerald,91);

  sectionTag(s,"GEN AI  ·  13  —  STREAMING INFERENCE",0.35,0.22,C.cyan);
  slideTitle(s,"SSE Streaming & Real-Time Inference",0.35,0.58);

  // TOP: streaming pipeline horizontal flow
  const sfow=[
    {label:"Frontend\nasync generator",  color:C.blue  },
    {label:"POST /ask/stream\nFastAPI SSE",color:C.cyan },
    {label:"_prepare_query\n_context()",   color:C.amber },
    {label:"generate_stream()\nGemini API",color:C.violet},
    {label:"Token chunks\nSSE events",   color:C.emerald},
    {label:"Streaming UI\n'typewriter'", color:C.emerald},
  ];
  const sw=1.46; const gap=0.09;
  sfow.forEach((sf,i)=>{
    const x=0.28+i*(sw+gap+0.14);
    fbox(s,x,1.38,sw,0.88,sf.label,"",sf.color);
    if(i<sfow.length-1) arr(s,x+sw+0.06,1.38+0.34,sf.color);
  });

  // SSE event types
  s.addText("SSE EVENT PROTOCOL",{x:0.28,y:2.42,w:5.00,h:0.24,fontSize:9,fontFace:"Calibri",color:C.cyan,bold:true,align:"left",valign:"middle",margin:0,charSpacing:1.5});

  const events=[
    {type:"token",   color:C.emerald,
     payload:'{"type": "token", "token": "Current Tomato prices show..."}',
     when:"Fired for EVERY chunk received from Gemini stream — appended to message"},
    {type:"done",    color:C.blue,
     payload:'{"type": "done", "intent": "price_now", "grounded": true, "latency_ms": 2341, "agent_insights": {...}, "reasoning_trace": "..."}',
     when:"Fired ONCE when stream ends — triggers executive summary cards + reasoning panel"},
    {type:"error",   color:C.red,
     payload:'{"type": "error", "error_type": "quota_exceeded", "message": "..."}',
     when:"On any pipeline failure — frontend shows GeminiErrorBadge with actionable message"},
  ];
  events.forEach((ev,i)=>{
    const y=2.74+i*0.84;
    glassCard(s,0.28,y,9.44,0.78,{fill:C.card,border:ev.color,lw:0.8});
    accentBar(s,0.28,y,0.78,ev.color);
    pill(s,0.42,y+0.10,0.80,0.22,ev.color,78);
    s.addText(ev.type,{x:0.42,y:y+0.10,w:0.80,h:0.22,fontSize:9,fontFace:"Calibri",color:ev.color,bold:true,align:"center",valign:"middle",margin:0,charSpacing:1});
    s.addText(ev.payload,{x:1.30,y:y+0.06,w:8.24,h:0.26,fontSize:8.5,fontFace:"Calibri",color:C.cyan,align:"left",valign:"middle",margin:0,italic:true});
    s.addText(ev.when,  {x:1.30,y:y+0.38,w:8.24,h:0.32,fontSize:8.5,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0});
  });

  glassCard(s,0.28,5.28,9.44,0.26,{fill:"080f1a",border:C.cyan,lw:0.8});
  s.addText("AbortController: clearing chat or sending a new message cancels the in-flight SSE stream instantly  ·  Vite proxy bypassed: streaming uses native fetch() directly to :8001",
    {x:0.48,y:5.28,w:9.04,h:0.26,fontSize:9,fontFace:"Calibri",color:C.gray2,align:"center",valign:"middle",margin:0});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLIDE GEN-15 — AGRICULTURAL AI ETHICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  const s = pres.addSlide();
  addBg(s, C.bg);
  glow(s,-1.0,0.5,6.0,5.0,C.emerald,87);
  glow(s, 6.5,2.0,5.0,4.0,C.red,    92);

  sectionTag(s,"GEN AI  ·  14  —  AGRICULTURAL AI ETHICS",0.35,0.22,C.red);
  slideTitle(s,"Responsible AI in Agriculture",0.35,0.58);

  // The risk banner
  glassCard(s,0.28,1.38,9.44,0.44,{fill:"180808",border:C.red,lw:1.0});
  accentBar(s,0.28,1.38,0.44,C.red);
  s.addText("⚠  HALLUCINATION IN AGRICULTURE = DIRECT FINANCIAL HARM",{x:0.46,y:1.38,w:9.04,h:0.24,fontSize:12,fontFace:"Arial Black",color:C.red,bold:true,align:"center",valign:"middle",margin:0});
  s.addText("A fabricated ₹200/kg Tomato price could cause a farmer to hold crops until they perish, or sell when they should hold — irreversible real-world consequence.",
    {x:0.46,y:1.60,w:9.04,h:0.20,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});

  // 4 pillars of responsible AI
  const pillars=[
    {icon:"🔒",title:"Deterministic Grounding",color:C.emerald,
     body:"Every number Gemini uses comes from DuckDB — not generated from imagination. PromptContext fields are typed and verified before injection."},
    {icon:"🎭",title:"Domain Isolation",       color:C.cyan,
     body:"Guardrails block non-agricultural queries at millisecond speed (before Gemini is invoked). Coding, crypto, medical, political topics are categorically rejected."},
    {icon:"🔍",title:"Full Audit Trail",       color:C.amber,
     body:"Every response includes a reasoning_trace (pipe-separated decision log), agent verdicts, confidence scores, and correlation signals — fully traceable."},
    {icon:"📋",title:"Structured Uncertainty",  color:C.violet,
     body:"When data is insufficient, the system acknowledges it honestly ('data quality is low for this crop-state pair') rather than generating confident-sounding fiction."},
  ];
  pillars.forEach((p,i)=>{
    const col=i%2; const row=Math.floor(i/2);
    const x=0.28+col*4.84; const y=1.98+row*1.48;
    glassCard(s,x,y,4.64,1.38,{fill:C.card,border:p.color,lw:1.0,shadow:mkShadow()});
    accentBar(s,x,y,1.38,p.color);
    s.addText(p.icon,{x:x+0.14,y:y+0.06,w:0.50,h:0.50,fontSize:22,fontFace:"Calibri",color:p.color,align:"center",valign:"middle",margin:0});
    s.addText(p.title,{x:x+0.70,y:y+0.08,w:3.76,h:0.32,fontSize:12,fontFace:"Arial Black",color:p.color,bold:true,align:"left",valign:"middle",margin:0});
    hRule(s,x+0.14,y+0.48,4.34,p.color,65);
    s.addText(p.body,{x:x+0.14,y:y+0.56,w:4.38,h:0.74,fontSize:9,fontFace:"Calibri",color:C.gray1,align:"left",valign:"top",margin:0,lineSpacingMultiple:1.15});
  });

  // Responsible AI commitment bottom
  glassCard(s,0.28,4.98,9.44,0.54,{fill:"0a1a10",border:C.emerald,lw:1.2});
  s.addText("Our Responsible AI Commitment",{x:0.46,y:5.00,w:9.04,h:0.22,fontSize:10,fontFace:"Arial Black",color:C.emerald,bold:true,align:"center",valign:"middle",margin:0});
  s.addText("Grounded output · Structured uncertainty · Explainable decisions · Agricultural domain lock · Zero LLM-invented numbers",
    {x:0.46,y:5.22,w:9.04,h:0.26,fontSize:9.5,fontFace:"Calibri",color:C.gray1,align:"center",valign:"middle",margin:0});
}

// ─── WRITE ────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName:"AgroPrice_AI_GenAI_Theory.pptx" })
  .then(()=> console.log("OK AgroPrice_AI_GenAI_Theory.pptx written (15 slides)"))
  .catch(err => { console.error("ERROR:", err); process.exit(1); });
