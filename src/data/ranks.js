// ─── Iron Ranks (Gamification Progression Tiers) ───
export const IRON_RANKS=[
  // ── Bronze Tier (0–500 XP) — first couple weeks ──
  {level:1,tier:"Bronze",name:"Bronze I",    icon:"🥉",xpNeeded:0,    color:"#cd7f32",tierColor:"#cd7f32"},
  {level:2,tier:"Bronze",name:"Bronze II",   icon:"🥉",xpNeeded:200,  color:"#c87533",tierColor:"#cd7f32"},
  {level:3,tier:"Bronze",name:"Bronze III",  icon:"🥉",xpNeeded:500,  color:"#b87333",tierColor:"#cd7f32"},
  // ── Silver Tier (1k–2.8k XP) — first month ──
  {level:4,tier:"Silver",name:"Silver I",    icon:"🥈",xpNeeded:1000, color:"#94a3b8",tierColor:"#c0c0c0"},
  {level:5,tier:"Silver",name:"Silver II",   icon:"🥈",xpNeeded:1800, color:"#c0c0c0",tierColor:"#c0c0c0"},
  {level:6,tier:"Silver",name:"Silver III",  icon:"🥈",xpNeeded:2800, color:"#e2e8f0",tierColor:"#c0c0c0"},
  // ── Gold Tier (4k–7.5k XP) — months 2–4 ──
  {level:7,tier:"Gold",  name:"Gold I",      icon:"🥇",xpNeeded:4000, color:"#fbbf24",tierColor:"#f59e0b"},
  {level:8,tier:"Gold",  name:"Gold II",     icon:"🥇",xpNeeded:5500, color:"#f59e0b",tierColor:"#f59e0b"},
  {level:9,tier:"Gold",  name:"Gold III",    icon:"🥇",xpNeeded:7500, color:"#d97706",tierColor:"#f59e0b"},
  // ── Platinum Tier (10k–17k XP) — months 5–8 ──
  {level:10,tier:"Platinum",name:"Platinum I",  icon:"💠",xpNeeded:10000,color:"#67e8f9",tierColor:"#22d3ee"},
  {level:11,tier:"Platinum",name:"Platinum II", icon:"💠",xpNeeded:13000,color:"#22d3ee",tierColor:"#22d3ee"},
  {level:12,tier:"Platinum",name:"Platinum III",icon:"💠",xpNeeded:17000,color:"#06b6d4",tierColor:"#22d3ee"},
  // ── Diamond Tier (22k–35k XP) — year 1 ──
  {level:13,tier:"Diamond",name:"Diamond I",  icon:"💎",xpNeeded:22000,color:"#a5b4fc",tierColor:"#6366f1"},
  {level:14,tier:"Diamond",name:"Diamond II", icon:"💎",xpNeeded:28000,color:"#6366f1",tierColor:"#6366f1"},
  {level:15,tier:"Diamond",name:"Diamond III",icon:"💎",xpNeeded:35000,color:"#4f46e5",tierColor:"#6366f1"},
  // ── Master Tier (43k–63k XP) — 18 months ──
  {level:16,tier:"Master",name:"Master I",   icon:"⚔️",xpNeeded:43000,color:"#f87171",tierColor:"#f43f5e"},
  {level:17,tier:"Master",name:"Master II",  icon:"⚔️",xpNeeded:52000,color:"#f43f5e",tierColor:"#f43f5e"},
  {level:18,tier:"Master",name:"Master III", icon:"⚔️",xpNeeded:63000,color:"#e11d48",tierColor:"#f43f5e"},
  // ── Grandmaster Tier (76k–108k XP) — year 2 ──
  {level:19,tier:"Grandmaster",name:"Grandmaster I",  icon:"👑",xpNeeded:76000, color:"#f9a8d4",tierColor:"#ec4899"},
  {level:20,tier:"Grandmaster",name:"Grandmaster II", icon:"👑",xpNeeded:91000, color:"#ec4899",tierColor:"#ec4899"},
  {level:21,tier:"Grandmaster",name:"Grandmaster III",icon:"👑",xpNeeded:108000,color:"#db2777",tierColor:"#ec4899"},
  // ── Champion Tier (128k–175k XP) — 3 years ──
  {level:22,tier:"Champion",name:"Champion I",  icon:"🏆",xpNeeded:128000,color:"#fb923c",tierColor:"#f97316"},
  {level:23,tier:"Champion",name:"Champion II", icon:"🏆",xpNeeded:150000,color:"#f97316",tierColor:"#f97316"},
  {level:24,tier:"Champion",name:"Champion III",icon:"🏆",xpNeeded:175000,color:"#ea580c",tierColor:"#f97316"},
  // ── Iron Legend Tier (205k–280k XP) — dedicated athletes ──
  {level:25,tier:"Iron Legend",name:"Iron Legend I",  icon:"⚜️",xpNeeded:205000,color:"#34d399",tierColor:"#10b981"},
  {level:26,tier:"Iron Legend",name:"Iron Legend II", icon:"⚜️",xpNeeded:240000,color:"#10b981",tierColor:"#10b981"},
  {level:27,tier:"Iron Legend",name:"Iron Legend III",icon:"⚜️",xpNeeded:280000,color:"#059669",tierColor:"#10b981"},
  // ── Immortal Tier (325k–380k XP) — elite few ──
  {level:28,tier:"Immortal",name:"Immortal I", icon:"🔱",xpNeeded:325000,color:"#c4b5fd",tierColor:"#8b5cf6"},
  {level:29,tier:"Immortal",name:"Immortal II",icon:"🔱",xpNeeded:380000,color:"#8b5cf6",tierColor:"#8b5cf6"},
  // ── G.O.A.T. — only the most dedicated ──
  {level:30,tier:"G.O.A.T.",name:"G.O.A.T.",icon:"🐐",xpNeeded:450000,color:"#fde68a",tierColor:"#f59e0b"},
];

export const WAR_EPOCH=new Date("2026-01-05").getTime(); // Monday week-0 anchor — change only on season reset
