import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Stat, Progress, SuccessToastCtrl, MsgBannerCtrl } from '../components/ui';
import { today, ago, fmtShort, uid, friendDisplayName, convW, wUnit, calc1RM } from '../utils/helpers';
import { SocialAPI, SYNC_URL } from '../utils/sync';
import { IRON_RANKS, WAR_EPOCH } from '../data/ranks';
import { BADGE_DEFS, calcEarnedBadges } from '../data/badges';
import { ShareCard } from '../utils/share';
import { getActiveMultiplier } from './social';

export function IronScoreCard({s,compact,showShields}){
  const {xp,rank,nextRank,xpIntoRank,xpForNext,pct,streak}=useMemo(()=>calcIronScore(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);
  const shields=getShields();
  const multiplier=getActiveMultiplier(s);
  // Enhancement: next shield milestone countdown
  const lastAwardedStreak=LS.get("ft-shield-awarded-streak")||0;
  const nextShieldAt=Math.ceil((Math.max(streak,lastAwardedStreak)+1)/7)*7;
  const daysToShield=nextShieldAt-streak;

  if(compact){
    return(
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:36,height:36,borderRadius:10,
          background:`linear-gradient(135deg,${rank.color}30,${rank.tierColor}15)`,
          border:`2px solid ${rank.color}60`,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:18,flexShrink:0}}>
          {rank.icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:800,color:rank.color,lineHeight:1}}>{rank.name}</div>
          <div style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>{xp.toLocaleString()} XP</div>
        </div>
        {shields>0&&<div style={{fontSize:10,color:"#38bdf8"}}>{"🛡️".repeat(shields)}</div>}
        {multiplier.mult>1&&<div style={{fontSize:9,fontWeight:700,color:multiplier.color,
          background:`${multiplier.color}15`,padding:"2px 6px",borderRadius:4}}>{multiplier.icon} {multiplier.mult}×</div>}
      </div>
    );
  }

  return(
    <Card style={{padding:16,background:`linear-gradient(135deg,${rank.color}12,${rank.tierColor}06)`,
      border:`1.5px solid ${rank.color}40`}}>
      {/* Active multiplier banner */}
      {multiplier.mult>1&&(
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,
          background:`${multiplier.color}15`,border:`1px solid ${multiplier.color}30`,marginBottom:10}}>
          <span style={{fontSize:14}}>{multiplier.icon}</span>
          <span style={{fontSize:11,fontWeight:800,color:multiplier.color}}>{multiplier.label} active!</span>
          <HelpBtn topic="multipliers" color={multiplier.color}/>
          <span style={{fontSize:9,color:V.text3,marginLeft:"auto"}}>
            {multiplier.mult===3?"Expires after 1 workout":"All day"}
          </span>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:56,height:56,borderRadius:16,
            background:`linear-gradient(135deg,${rank.color}30,${rank.tierColor}15)`,
            border:`2.5px solid ${rank.color}70`,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:26,flexShrink:0,
            boxShadow:`0 0 16px ${rank.color}30`}}>
            {rank.icon}
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:rank.color,
              textTransform:"uppercase",opacity:0.7}}>{rank.tier}</div>
            <div style={{fontSize:20,fontWeight:900,color:rank.color,lineHeight:1.1}}>{rank.name}</div>
            <div style={{fontSize:9,color:V.text3}}>Level {rank.level} of 30</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:26,fontWeight:900,color:V.text,fontFamily:V.mono,lineHeight:1}}>{xp.toLocaleString()}</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:9,color:V.text3}}>IRON XP</span><HelpBtn topic="ironscore" color={rank.color}/></div>
        </div>
      </div>
      {/* Shields + streak + next milestone */}
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {shields>0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",gap:6,
            padding:"6px 10px",borderRadius:8,background:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.15)"}}>
            <span style={{fontSize:13}}>🛡️</span>
            <span style={{fontSize:11,fontWeight:700,color:"#38bdf8"}}>
              {shields} Shield{shields!==1?"s":""}
            </span>
            <HelpBtn topic="shields" color="#38bdf8"/>
          </div>
        )}
        {streak>0&&(
          <div style={{flex:shields>0?1:2,display:"flex",alignItems:"center",gap:6,
            padding:"6px 10px",borderRadius:8,background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)"}}>
            <span style={{fontSize:13}}>🔥</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>{streak}d streak</div>
              {daysToShield>0&&shields<3&&(
                <div style={{fontSize:8,color:V.text3}}>{daysToShield}d to 🛡️</div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Progress to next rank */}
      {nextRank?(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:9,color:V.text3}}>→ {nextRank.icon} {nextRank.name}</span>
            <span style={{fontSize:9,color:rank.color,fontWeight:700,fontFamily:V.mono}}>{xpIntoRank.toLocaleString()} / {xpForNext?.toLocaleString()} XP</span>
          </div>
          <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,
              background:`linear-gradient(90deg,${rank.color},${nextRank.color})`,
              width:`${pct}%`,transition:"width .7s ease",
              boxShadow:`0 0 10px ${rank.color}50`}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <div style={{fontSize:9,color:V.text3}}>
              ~{Math.ceil((xpForNext-xpIntoRank)/30)} workouts to go
            </div>
            <div style={{fontSize:9,color:V.text3,textAlign:"right"}}>
              {(xpForNext-xpIntoRank).toLocaleString()} XP to {nextRank.name}
            </div>
          </div>
        </div>
      ):(
        <div style={{fontSize:11,color:rank.color,fontWeight:800,textAlign:"center",
          padding:"8px",background:`${rank.color}12`,borderRadius:8}}>🐐 You are the G.O.A.T.</div>
      )}
    </Card>
  );
}

// ── Rank Badge (inline, for profiles) ──
export function RankBadge({rank,size}){
  const sz=size||"sm";
  const dim=sz==="lg"?48:sz==="md"?36:28;
  const fs=sz==="lg"?22:sz==="md"?16:12;
  const textSz=sz==="lg"?12:sz==="md"?10:9;
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:sz==="sm"?4:6,
      padding:sz==="sm"?"3px 8px":"5px 12px",borderRadius:sz==="sm"?8:10,
      background:`${rank.color}15`,border:`1px solid ${rank.color}35`}}>
      <span style={{fontSize:fs}}>{rank.icon}</span>
      <span style={{fontSize:textSz,fontWeight:800,color:rank.color}}>{rank.name}</span>
    </div>
  );
}

// ── Milestone Checker — fires on workout/PR save ──
export function checkMilestones(s, newWorkout, newPRs) {
  const totalWorkouts = (s.workouts||[]).length + 1; // +1 for the one just saved
  const milestoneKey = "ft-milestones-fired";
  const fired = LS.get(milestoneKey) || {};
  const toFire = [];

  // Workout count milestones
  const wMilestones = [1,10,25,50,100,200,365,500];
  wMilestones.forEach(n => {
    if(totalWorkouts === n && !fired["w_"+n]) {
      fired["w_"+n] = true;
      const labels = {1:"First workout logged! The journey begins.",10:"10 workouts down! You're building a habit.",
        25:"25 sessions! You're consistent now.",50:"50 workouts! That's real dedication.",
        100:"💯 100 workouts! You're an IRONLOG legend.",200:"200 sessions. Elite consistency.",
        365:"365 workouts — a year of training! Incredible.",500:"500 workouts. You are the definition of dedicated."};
      toFire.push({icon:n>=100?"🏆":"💪",title:`${n} Workouts!`,msg:labels[n]||`${n} workouts logged!`,color:"#00f5a0"});
    }
  });

  // Round number PR milestones (bench/squat/deadlift hitting 100/200/300/400/500)
  (newPRs||[]).forEach(pr => {
    const w = parseFloat(pr.weight)||0;
    [100,135,185,225,275,315,365,405,455,495].forEach(milestone => {
      const key = "pr_"+pr.name.replace(/\s/g,"_")+"_"+milestone;
      if(w >= milestone && !fired[key]) {
        // Check they didn't already have this PR before
        const hadBefore = (s.workouts||[]).some(wo => wo.exercises.some(e =>
          s.exercises?.find(x=>x.id===e.exerciseId)?.name===pr.name &&
          e.sets.some(st => parseFloat(st.weight)||0 >= milestone)
        ));
        if(!hadBefore) {
          fired[key] = true;
          toFire.push({icon:"🎯",title:`${pr.name} ${milestone}!`,
            msg:`You just ${w > milestone ? "passed" : "hit"} ${milestone} lbs on ${pr.name}. New milestone unlocked!`,
            color:"#f59e0b"});
        }
      }
    });
  });

  // Streak milestones
  const streak = (s.workouts||[]).filter(w => {
    // rough streak from saved workouts including today
    return true;
  }).length; // simplified — use workout count as proxy
  const streakMilestones = [7,14,30,60,100];
  const actualStreak = (()=>{let c=0,i=0;while((s.workouts||[]).some(w=>w.date===ago(i))||i===0){if((s.workouts||[]).some(w=>w.date===ago(i))||newWorkout?.date===ago(0))c++;else break;i++;}return c;})();
  streakMilestones.forEach(n => {
    if(actualStreak >= n && !fired["streak_"+n]) {
      fired["streak_"+n] = true;
      const streakMsgs = {7:"7-day streak! A whole week of consistency.",14:"14 days! Two full weeks — keep it going.",
        30:"🔥 30-day streak! You're unstoppable.",60:"60 days straight. That's elite.",100:"💯 100-day streak. You are legendary."};
      toFire.push({icon:"🔥",title:`${n}-Day Streak!`,msg:streakMsgs[n]||`${n} days in a row!`,color:"#f97316"});
    }
  });

  if(toFire.length > 0) {
    LS.set(milestoneKey, fired);
    // Show milestones sequentially
    toFire.forEach((m, i) => {
      setTimeout(() => {
        SuccessToastCtrl.show(`${m.icon} ${m.title} — ${m.msg}`);
        // Also award bonus XP for milestone
        addXPBonus(50, m.title);
      }, i * 2200);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DAILY XP MISSIONS
// 20-mission pool, seed-based rotation, 3 per day, refreshes midnight
// ═══════════════════════════════════════════════════════════════════

export const MISSION_POOL=[
  {id:"m_workout",    icon:"💪",title:"Iron Worker",      desc:"Log any workout today",               xp:40, cat:"workout",
    check:(s)=>s.workouts.some(w=>w.date===today())},
  {id:"m_protein",    icon:"🥩",title:"Protein Warrior",   desc:"Hit your protein goal today",         xp:35, cat:"nutrition",
    check:(s)=>s.nutrition.filter(n=>n.date===today()).reduce((a,n)=>a+(n.protein||0),0)>=(s.goals?.protein||150)},
  {id:"m_meal",       icon:"🥗",title:"Fuel Up",           desc:"Log at least one meal today",         xp:20, cat:"nutrition",
    check:(s)=>s.nutrition.some(n=>n.date===today())},
  {id:"m_checkin",    icon:"✅",title:"Daily Check-In",    desc:"Complete today's check-in",           xp:25, cat:"habits",
    check:(s)=>(s.checkins||[]).some(c=>c.date===today())},
  {id:"m_3exercises", icon:"🏋️",title:"Full Session",      desc:"Log a workout with 3+ exercises",     xp:45, cat:"workout",
    check:(s)=>s.workouts.find(w=>w.date===today())?.exercises?.length>=3},
  {id:"m_pr",         icon:"🎯",title:"PR Chaser",         desc:"Set a new personal record today",     xp:65, cat:"workout",
    check:(s)=>{
      const todayW=s.workouts.find(w=>w.date===today());
      if(!todayW)return false;
      return todayW.exercises.some(e=>{
        let prevBest=0;
        s.workouts.filter(w=>w.date<today()).forEach(w=>
          w.exercises.filter(ex=>ex.exerciseId===e.exerciseId).forEach(ex=>
            ex.sets.forEach(st=>{const wt=parseFloat(st.weight)||0;if(wt>prevBest)prevBest=wt;})
          )
        );
        return prevBest>0&&e.sets.some(st=>(parseFloat(st.weight)||0)>prevBest);
      });
    }},
  {id:"m_2meals",     icon:"🍽️",title:"Meal Planner",     desc:"Log 2 or more meals today",           xp:30, cat:"nutrition",
    check:(s)=>{
      const todayN=s.nutrition.find(n=>n.date===today());
      return (todayN?.meals||[]).length>=2;
    }},
  {id:"m_photo",      icon:"📸",title:"Snap It",           desc:"Log a progress photo",                xp:30, cat:"habits",
    check:(s)=>(s.photos||[]).some(p=>p.date===today())},
  {id:"m_5sets",      icon:"🔥",title:"Volume Beast",      desc:"Complete 5+ sets in a single exercise",xp:40, cat:"workout",
    check:(s)=>s.workouts.find(w=>w.date===today())?.exercises?.some(e=>e.sets?.length>=5)},
  {id:"m_macros",     icon:"🎯",title:"Macro Perfect",     desc:"Hit protein and calories within 10%", xp:50, cat:"nutrition",
    check:(s)=>{
      const todayN=s.nutrition.filter(n=>n.date===today());
      const prot=todayN.reduce((a,n)=>a+(n.protein||0),0);
      const cals=todayN.reduce((a,n)=>a+(n.cal||0),0);
      const gProt=s.goals?.protein||150;const gCals=s.goals?.cal||2200;
      return prot>=gProt*0.9&&cals>=gCals*0.9&&cals<=gCals*1.1;
    }},
  {id:"m_streak",     icon:"🔥",title:"Streak Keeper",    desc:"Train 3 or more days in a row",        xp:35, cat:"habits",
    check:(s)=>s.workouts.some(w=>w.date===today())&&s.workouts.some(w=>w.date===ago(1))&&s.workouts.some(w=>w.date===ago(2))},
  {id:"m_fullday",    icon:"⭐",title:"Full Logger",       desc:"Log workout + meal + check-in",       xp:55, cat:"habits",
    check:(s)=>s.workouts.some(w=>w.date===today())&&s.nutrition.some(n=>n.date===today())&&(s.checkins||[]).some(c=>c.date===today())},
  {id:"m_heavy",      icon:"🏅",title:"Heavy Day",         desc:"Log a set ≥ 80% of your all-time PR", xp:45, cat:"workout",
    check:(s)=>{
      const todayW=s.workouts.find(w=>w.date===today());
      if(!todayW)return false;
      let prMet=false;
      todayW.exercises.forEach(e=>{
        let allTimeBest=0;
        s.workouts.filter(w=>w.date<today()).forEach(w=>w.exercises.forEach(ex=>{
          if(ex.exerciseId===e.exerciseId)ex.sets.forEach(st=>{if((parseFloat(st.weight)||0)>allTimeBest)allTimeBest=parseFloat(st.weight)||0;});
        }));
        if(allTimeBest>0)e.sets.forEach(st=>{if((parseFloat(st.weight)||0)>=allTimeBest*0.8)prMet=true;});
      });
      return prMet;
    }},
  {id:"m_2days",      icon:"📅",title:"Back to Back",     desc:"Train 2 days in a row",               xp:35, cat:"habits",
    check:(s)=>s.workouts.some(w=>w.date===today())&&s.workouts.some(w=>w.date===ago(1))},
  {id:"m_water",      icon:"💧",title:"Stay Hydrated",    desc:"Log 8+ cups of water today",           xp:20, cat:"nutrition",
    check:(s)=>{
      const fromNutrition=s.nutrition.filter(n=>n.date===today()).reduce((a,n)=>a+(n.water||0),0);
      const fromWidget=parseInt(LS.get("ft-water-"+today()))||0;
      return Math.max(fromNutrition,fromWidget)>=8;
    }},
  {id:"m_weigh",      icon:"⚖️",title:"Weigh In",         desc:"Log your body weight today",           xp:20, cat:"habits",
    check:(s)=>(s.body||[]).some(b=>b.date===today()&&b.weight)},
  {id:"m_react",      icon:"👏",title:"Hype Squad",       desc:"React to a friend's activity today",   xp:15, cat:"social",
    check:(_s)=>LS.get("ft-reacted-today")===today()},
  {id:"m_supps",      icon:"💊",title:"Supplement Check", desc:"Log your supplements today",            xp:15, cat:"habits",
    check:(_s)=>LS.get("ft-supps-logged")===today()},
  {id:"m_note",       icon:"📝",title:"Reflect",          desc:"Complete a check-in with a note",      xp:25, cat:"habits",
    // B4 fix: removed c.mood — not a standard checkin field (schema uses notes)
    check:(s)=>(s.checkins||[]).some(c=>c.date===today()&&(c.note||c.notes))},
  {id:"m_bodycomp",   icon:"📏",title:"Body Scan",        desc:"Log any body measurement today",       xp:25, cat:"habits",
    check:(s)=>(s.body||[]).some(b=>b.date===today())},
  // ── 8 New Missions (Tier 2 expansion) ──
  {id:"m_dm",         icon:"💬",title:"Reach Out",        desc:"Send a message to a friend today",      xp:20, cat:"social",
    check:(_s)=>LS.get("ft-dm-sent-today")===today()},
  {id:"m_60min",      icon:"⏱️",title:"Marathon Session",  desc:"Log a workout 60+ minutes long",        xp:50, cat:"workout",
    check:(s)=>{const w=s.workouts.find(w=>w.date===today());return w&&parseInt(w.dur||0)>=60;}},
  {id:"m_4meals",     icon:"🍽️",title:"Meal Tracker Pro",  desc:"Log all 4 meal slots today",            xp:40, cat:"nutrition",
    check:(s)=>{const w=s.nutrition.find(n=>n.date===today());return(w?.meals||[]).length>=4;}},
  {id:"m_cardio",     icon:"🏃",title:"Cardio Day",        desc:"Log a cardio or conditioning workout",  xp:35, cat:"workout",
    check:(s)=>{const w=s.workouts.find(w=>w.date===today());if(!w)return false;
      const hasCardio=w.exercises?.some(e=>{const n=(s.exercises.find(x=>x.id===e.exerciseId)?.name||"").toLowerCase();return n.includes("cardio")||n.includes("run")||n.includes("bike")||n.includes("row")||n.includes("jump")||e.exerciseId==="cardio";});
      const isCatCardio=w.exercises?.some(e=>s.exercises.find(x=>x.id===e.exerciseId)?.cat==="Cardio");
      return hasCardio||isCatCardio;}},
  {id:"m_beat_last",  icon:"📈",title:"Beat Last Time",    desc:"Log a heavier set than your last session",xp:55,cat:"workout",
    check:(s)=>{const todayW=s.workouts.find(w=>w.date===today());if(!todayW)return false;
      return todayW.exercises.some(e=>{
        const prevW=s.workouts.find(w=>w.date<today()&&w.exercises.some(ex=>ex.exerciseId===e.exerciseId));
        if(!prevW)return false;
        const prevEx=prevW.exercises.find(ex=>ex.exerciseId===e.exerciseId);
        const prevMax=Math.max(...(prevEx?.sets||[]).map(st=>parseFloat(st.weight)||0));
        const todayMax=Math.max(...e.sets.map(st=>parseFloat(st.weight)||0));
        return todayMax>prevMax&&prevMax>0;});}},
  {id:"m_early_bird", icon:"🌅",title:"Early Bird",        desc:"Log a workout before 8am",              xp:45, cat:"workout",
    check:(s)=>{const w=s.workouts.find(w=>w.date===today());if(!w)return false;
      const flag=LS.get("ft-workout-early-"+today());
      return flag===true||flag==="true";}},
  {id:"m_sleep9",     icon:"😴",title:"Sleep Champion",    desc:"Log 9+ hours of sleep",                 xp:30, cat:"habits",
    check:(s)=>s.nutrition.filter(n=>n.date===today()).some(n=>(parseFloat(n.sleep)||0)>=9)||
      (s.checkins||[]).some(c=>c.date===today()&&(parseFloat(c.sleep)||0)>=9)},
  {id:"m_challenge",  icon:"🏆",title:"Challenge Mode",   desc:"Make progress on a weekly challenge",    xp:35, cat:"social",
    check:(s)=>{
      const weekW=s.workouts.filter(w=>w.date>=ago(7)).length;
      const protDays=s.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(s.goals?.protein||150)).length;
      return weekW>=2||protDays>=3;}},
];

export function getDailyMissions(dateStr){
  // Seeded shuffle: use date as seed for consistent daily rotation
  const seed=dateStr.split("-").reduce((a,n)=>a+parseInt(n),0);
  const shuffled=[...MISSION_POOL];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(((seed*(i+1))%997)/997*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  return shuffled.slice(0,3);
}

export function getMissionStatus(s){
  const missions=getDailyMissions(today());
  const completed=LS.get("ft-missions-completed")||{};
  const todayKey=today();
  return missions.map(m=>({
    ...m,
    done:!!(completed[todayKey]?.[m.id]),
    // live check — mission completed just now if check passes and not yet awarded
    live:m.check(s),
  }));
}

// Call this when any action might complete a mission
export function checkAndAwardMissions(s,dispatch){
  const missions=getMissionStatus(s);
  const completed=LS.get("ft-missions-completed")||{};
  const todayKey=today();
  if(!completed[todayKey])completed[todayKey]={};
  let totalAwarded=0;
  const newlyCompleted=[];
  missions.forEach(m=>{
    if(m.live&&!m.done&&!completed[todayKey][m.id]){
      completed[todayKey][m.id]=true;
      totalAwarded+=m.xp;
      newlyCompleted.push(m);
    }
  });
  if(totalAwarded>0){
    LS.set("ft-missions-completed",completed);
    addXPBonus(totalAwarded,"Daily Mission");
    // Check if all 3 done — bonus
    const allDone=missions.every(m=>completed[todayKey][m.id]||m.live);
    if(allDone&&!completed[todayKey].__all_bonus){
      completed[todayKey].__all_bonus=true;
      LS.set("ft-missions-completed",completed);
      addXPBonus(30,"All Missions Bonus");
      SuccessToastCtrl.show(`🌟 All missions complete! +${totalAwarded+30} XP`);
    } else {
      if(newlyCompleted.length===1){
        SuccessToastCtrl.show(`${newlyCompleted[0].icon} "${newlyCompleted[0].title}" · +${totalAwarded} XP`);
      } else {
        SuccessToastCtrl.show(`✅ ${newlyCompleted.length} missions complete · +${totalAwarded} XP`);
      }
    }
  }
}

// ── Daily Missions Card (shown on Home + Social Feed) ──
export function DailyMissionsCard({s,d,compact}){
  const [missions,setMissions]=useState(()=>getMissionStatus(s));
  // Refresh status whenever s changes
  useEffect(()=>setMissions(getMissionStatus(s)),[s.workouts,s.nutrition,s.checkins,s.body,s.photos]);
  const doneCount=missions.filter(m=>m.done||m.live).length;
  const allDone=doneCount===3;
  const [celebrated,setCelebrated]=useState(()=>LS.get("ft-mission-celebrated")===today());
  useEffect(()=>{
    if(allDone&&!celebrated){
      setCelebrated(true);LS.set("ft-mission-celebrated",today());
      setTimeout(()=>SuccessToastCtrl.show("🌟 All 3 missions complete! +30 bonus XP"),300);
    }
  },[allDone]);
  const completed=LS.get("ft-missions-completed")||{};
  const allBonusCollected=completed[today()]?.__all_bonus;
  const refreshAt=new Date();
  refreshAt.setDate(refreshAt.getDate()+1);refreshAt.setHours(0,0,0,0);
  const hoursLeft=Math.ceil((refreshAt-new Date())/3600000);

  if(compact){
    return(
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>d&&d({type:"TAB",tab:"social_ironscore"})}>
        <div style={{display:"flex",gap:3}}>
          {missions.map((m,i)=>(
            <div key={i} style={{width:10,height:10,borderRadius:2,
              background:m.done||m.live?"#22c55e":"rgba(255,255,255,0.1)"}}/>
          ))}
        </div>
        <span style={{fontSize:10,color:V.text3}}>{doneCount}/3 missions · {hoursLeft}h left</span>
      </div>
    );
  }

  return(
    <Card style={{padding:14,border:`1px solid ${allDone?"#22c55e":"rgba(99,102,241,0.25)"}30`,
      background:allDone?"rgba(34,197,94,0.04)":"rgba(99,102,241,0.03)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:800,color:V.text}}>🎯 Daily Missions</span><HelpBtn topic="missions" color="#22c55e"/></div>
          <div style={{fontSize:10,color:V.text3}}>Resets in {hoursLeft}h · Complete all 3 for +30 bonus XP</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:16,fontWeight:900,color:doneCount===3?"#22c55e":V.accent,fontFamily:V.mono}}>{doneCount}/3</div>
          {allBonusCollected&&<div style={{fontSize:8,color:"#22c55e",fontWeight:700}}>BONUS ✓</div>}
        </div>
      </div>
      {/* Progress dots */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {missions.map((m,i)=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,
            background:m.done||m.live?"#22c55e":"rgba(255,255,255,0.06)",
            transition:"background .3s"}}/>
        ))}
      </div>
      {/* Mission rows */}
      {missions.map((m,i)=>{
        const done=m.done||m.live;
        const dest=m.cat==="workout"?"log_workout":m.cat==="nutrition"?"log_nutrition":m.cat==="social"?"social_feed":m.cat==="habits"?"home":"log_body";
        return(
          <div key={i} onClick={()=>{if(!done&&d)d({type:"TAB",tab:dest});}}
            style={{display:"flex",alignItems:"center",gap:10,padding:"9px 4px",
              borderBottom:i<2?`1px solid rgba(255,255,255,0.04)`:"none",
              cursor:done?"default":"pointer",borderRadius:8,transition:"background .15s",
              WebkitTapHighlightColor:"transparent"}}
            onMouseEnter={e=>{if(!done)e.currentTarget.style.background="rgba(255,255,255,0.03)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
              background:done?"rgba(34,197,94,0.12)":"rgba(255,255,255,0.04)",
              border:`1px solid ${done?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.06)"}`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
              transition:"all .3s",boxShadow:done?"0 0 8px rgba(34,197,94,0.2)":"none"}}>
              {done?"✅":m.icon}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:done?"#22c55e":V.text,
                textDecoration:done?"line-through":"none",transition:"color .3s"}}>{m.title}</div>
              <div style={{fontSize:10,color:V.text3}}>{done?m.desc:<span>{m.desc} <span style={{color:V.accent}}>→ Go</span></span>}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
              <span style={{fontSize:11,fontWeight:800,color:done?"#22c55e":V.accent,
                fontFamily:V.mono}}>+{m.xp}</span>
              <span style={{fontSize:7,padding:"1px 4px",borderRadius:3,fontWeight:700,marginTop:1,
                background:m.cat==="workout"?`${V.accent}12`:m.cat==="nutrition"?"rgba(249,115,22,0.12)":m.cat==="social"?"rgba(236,72,153,0.12)":"rgba(34,197,94,0.12)",
                color:m.cat==="workout"?V.accent:m.cat==="nutrition"?V.warn:m.cat==="social"?"#ec4899":"#22c55e"}}>{m.cat}</span>
            </div>
          </div>
        );
      })}
      {allDone&&!allBonusCollected&&(
        <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:"rgba(34,197,94,0.1)",
          border:"1px solid rgba(34,197,94,0.2)",textAlign:"center",fontSize:11,fontWeight:700,color:"#22c55e"}}>
          🌟 All done! Bonus +30 XP earned
        </div>
      )}
      {!allDone&&(
        <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
          {missions.filter(m=>!m.done&&!m.live).map(m=>{
            const dest=m.cat==="workout"?"log_workout":m.cat==="nutrition"?"log_nutrition":m.cat==="social"?"social_feed":m.cat==="habits"?"home":"log_body";
            return(
              <button key={m.id} onClick={()=>d&&d({type:"TAB",tab:dest})}
                style={{padding:"5px 12px",borderRadius:8,
                  background:`${V.accent}08`,border:`1px solid ${V.accent}20`,
                  cursor:"pointer",fontSize:10,fontWeight:700,color:V.accent,fontFamily:V.font}}>
                {m.icon} {m.title} →
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── GamificationOverlay — wraps useLevelUp so the hook is ALWAYS called at top level ──
// Fixes: useLevelUp was previously called inside a conditional IIFE, violating Rules of Hooks.
// Now it lives in its own component that is conditionally *mounted* (not conditionally called).

export function GamificationOverlay({s}){
  const {celebrating,celebRank,dismiss}=useLevelUp(s);
  return(<>
    <IronNotifCheck s={s}/>
    {celebrating&&celebRank&&<LevelUpCelebration rank={celebRank} onDismiss={dismiss} s={s}/>}
  </>);
}

// ── Notification Checker (runs on mount & tab change) ──
export function IronNotifCheck({s}){
  useEffect(()=>{
    if(!s.onboarded)return;
    const now=new Date();const h=now.getHours();
    // Comeback bonus detection
    const lastW=s.workouts?.[0]?.date;
    if(lastW){
      const gapDays=Math.floor((Date.now()-new Date(lastW+"T12:00:00"))/86400000);
      const notifiedGap=LS.get("ft-comeback-notif-gap");
      if(gapDays>=5&&notifiedGap!==gapDays){
        LS.set("ft-comeback-notif-gap",gapDays);
        MsgBannerCtrl.push({name:"Welcome back! 💥",
          text:`${gapDays} days off = 3× XP on your next workout. No judgment.`,type:"system"});
      }
    }
    // Shield award check + shield activation check
    // Streak calc: try today first, else start from yesterday (mirrors useStreak logic)
    const streak=(()=>{let c=0;const d2=new Date();if(!(s.workouts||[]).some(w=>w.date===today()))d2.setDate(d2.getDate()-1);for(let i=0;i<365;i++){const ds=new Date(d2);ds.setDate(d2.getDate()-i);const dstr=ds.toISOString().split("T")[0];if((s.workouts||[]).some(w=>w.date===dstr))c++;else break;}return c;})();
    checkStreakShieldAward(streak);
    checkStreakShieldActivation(s); // auto-consume shield if user missed exactly 1 day
    // Enhancement: auto-detect completed war wins so they're never lost
    (()=>{
      const wIdx=Math.floor((Date.now()-WAR_EPOCH)/(7*86400000));
      // Check the previous week's war (Monday to Sunday)
      const prevWeekIdx=wIdx-1;
      const prevClaimedKey=`ft-war-claimed-${prevWeekIdx}`;
      const prevAutoKey=`ft-war-autochecked-${prevWeekIdx}`;
      if(!LS.get(prevClaimedKey)&&!LS.get(prevAutoKey)){
        LS.set(prevAutoKey,true);
        // We can't easily retroactively check if previous week's war was won without
        // knowing which war it was, so we just ensure current week win can be claimed.
        // No false-positive auto-win here — only real-time claim via button.
      }
    })();
    // Daily missions reminder (once per day, after 5pm if no missions done)
    const lastMissionNotif=LS.get("ft-mission-notif-date");
    if(h>=17&&lastMissionNotif!==today()){
      const missions=getMissionStatus(s);
      const doneCount=missions.filter(m=>m.done||m.live).length;
      if(doneCount<3){
        LS.set("ft-mission-notif-date",today());
        MsgBannerCtrl.push({name:`🎯 ${3-doneCount} mission${3-doneCount>1?"s":""} remaining`,
          text:"Complete daily missions before midnight for bonus XP",type:"system"});
      }
    }
    // Double XP day reminder (Tue/Thu morning)
    const dow=now.getDay();
    const dxpNotif=LS.get("ft-dxp-notif-date");
    if((dow===2||dow===4)&&h>=8&&dxpNotif!==today()){
      const todayWorked=s.workouts.some(w=>w.date===today());
      if(!todayWorked){
        LS.set("ft-dxp-notif-date",today());
        MsgBannerCtrl.push({name:"⚡ Double XP Day!",text:"Today is 2× XP — log a workout before midnight.",type:"system"});
      }
    }
    // ── Admin-triggered in-app notification flags (rate-limited: once per 30min) ──
    const lastAdminPoll=parseInt(LS.get("ft-admin-poll-ts")||"0");
    if(s.profile?.email&&Date.now()-lastAdminPoll>1800000){
      LS.set("ft-admin-poll-ts",Date.now());
      fetch(`${SYNC_URL}/api/admin`,{method:"POST",
        headers:{...AuthToken.getHeaders(s.profile.email),"Content-Type":"application/json"},
        body:JSON.stringify({action:"get_notif_flags"})})
      .then(r=>r.ok?r.json():null)
      .then(json=>{
        const flags=json?.flags;
        if(!flags)return;
        if(flags.streak_reminder)MsgBannerCtrl.push({name:"🔥 Keep Your Streak!",text:flags.streak_reminder===true?"Don't forget to log today's workout.":flags.streak_reminder,type:"system"});
        if(flags.double_xp)MsgBannerCtrl.push({name:"⚡ Double XP Active!",text:flags.double_xp===true?"2× XP on your next workout — make it count!":flags.double_xp,type:"system"});
        if(flags.comeback)MsgBannerCtrl.push({name:"Welcome back! 💥",text:flags.comeback===true?"3× XP on your next workout. Let's go.":flags.comeback,type:"system"});
        if(flags.mission_reminder)MsgBannerCtrl.push({name:"🎯 Daily Missions",text:flags.mission_reminder===true?"You still have missions to complete today for bonus XP.":flags.mission_reminder,type:"system"});
        if(flags.shield_awarded)MsgBannerCtrl.push({name:"🛡️ Streak Shield Earned!",text:flags.shield_awarded===true?"A shield has been added to your account.":flags.shield_awarded,type:"system"});
        if(flags.custom)MsgBannerCtrl.push({name:flags.custom_title||"IRONLOG",text:flags.custom,type:"system"});
        // Clear flags after consuming so they don't re-fire
        fetch(`${SYNC_URL}/api/admin`,{method:"POST",
          headers:{...AuthToken.getHeaders(s.profile.email),"Content-Type":"application/json"},
          body:JSON.stringify({action:"clear_notif_flags"})}).catch(()=>{});
      }).catch(()=>{});
    }
  },[s.tab]);
  return null;
}

// ── Updated SocialIronScore page ──

export function SocialIronScore({s,d}){
  const {xp,baseXP,bonusXP,rank,nextRank,xpIntoRank,xpForNext,pct,streak,big3}=useMemo(()=>calcIronScore(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);
  const {checks}=useMemo(()=>calcEarnedBadges(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);
  const badgeCount=Object.values(checks).filter(Boolean).length;
  const multiplier=getActiveMultiplier(s);
  const shields=getShields();
  const bonusLog=(getXPBonus().log||[]).slice(0,10);

  const xpSources=[
    {label:"Workouts Logged",  val:(s.workouts||[]).length, each:30, icon:"💪"},
    {label:"Streak Bonus",     val:streak,                  each:8,  icon:"🔥"},
    {label:"Big 3 Strength",   val:Math.floor(big3/8),      each:1,  icon:"🏋️",unit:"pts"},
    {label:"Nutrition Logs",   val:(s.nutrition||[]).length, each:8,  icon:"🥗"},
    {label:"Progress Photos",  val:(s.photos||[]).length,    each:15, icon:"📸"},
    {label:"Daily Check-ins",  val:(s.checkins||[]).length,  each:5,  icon:"✅"},
    {label:"Badges Earned",    val:badgeCount,               each:75, icon:"🏅"},
  ];

  // Group ranks by tier for the all-ranks display
  const tierGroups=[...new Set(IRON_RANKS.map(r=>r.tier))].map(tier=>({
    tier,ranks:IRON_RANKS.filter(r=>r.tier===tier)
  }));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16,fontWeight:800,color:V.text}}>Iron Score</span><HelpBtn topic="ironscore" color="#00f5a0"/></div>

      <IronScoreCard s={s} showShields/>

      {/* ── FEATURE #6: Weekly XP Momentum ── */}
      {(()=>{
        const bonusLog=(getXPBonus().log||[]);
        // Build 7-day XP bar data
        const days=Array.from({length:7}).map((_,i)=>{
          const date=ago(6-i);
          const dayBonus=bonusLog.filter(e=>e.date===date).reduce((a,e)=>a+(e.amount||0),0);
          const dayBase=(s.workouts||[]).filter(w=>w.date===date).length*30;
          return{date,xp:dayBase+dayBonus,worked:(s.workouts||[]).some(w=>w.date===date)};
        });
        const weekXP=days.reduce((a,d)=>a+d.xp,0);
        const prevWeekXP=(()=>{
          const prevLog=bonusLog.filter(e=>e.date>=ago(14)&&e.date<ago(7));
          const prevBase=(s.workouts||[]).filter(w=>w.date>=ago(14)&&w.date<ago(7)).length*30;
          return prevLog.reduce((a,e)=>a+(e.amount||0),0)+prevBase;
        })();
        const diff=prevWeekXP>0?Math.round((weekXP-prevWeekXP)/prevWeekXP*100):null;
        const maxXP=Math.max(...days.map(d=>d.xp),1);
        const dayLabels=["Su","Mo","Tu","We","Th","Fr","Sa"];
        return(
          <Card style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>This Week</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:2}}>
                  <span style={{fontSize:22,fontWeight:900,color:V.accent,fontFamily:V.mono}}>+{weekXP.toLocaleString()}</span>
                  <span style={{fontSize:11,color:V.text3}}>XP</span>
                  {diff!==null&&(
                    <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:5,
                      background:diff>=0?"rgba(0,245,160,0.1)":"rgba(255,107,107,0.1)",
                      color:diff>=0?V.accent:V.danger}}>
                      {diff>=0?"↑":"↓"}{Math.abs(diff)}% vs last week
                    </span>
                  )}
                </div>
              </div>
              <div style={{fontSize:10,color:V.text3,textAlign:"right"}}>
                <div style={{fontFamily:V.mono,fontWeight:700,color:V.purple}}>{xp.toLocaleString()} total</div>
                <div>all time</div>
              </div>
            </div>
            {/* 7-day XP sparkline bars */}
            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:48}}>
              {days.map((day,i)=>{
                const h=day.xp>0?Math.max(6,Math.round((day.xp/maxXP)*48)):4;
                const isToday=day.date===today();
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{width:"100%",height:h,borderRadius:3,
                      background:isToday?V.accent:day.worked?"rgba(0,245,160,0.4)":"rgba(255,255,255,0.06)",
                      transition:"height .3s ease",boxShadow:isToday?`0 0 6px ${V.accent}60`:"none"}}/>
                    <div style={{fontSize:7,color:isToday?V.accent:V.text3,fontWeight:isToday?700:400}}>
                      {dayLabels[new Date(day.date+"T12:00:00").getDay()]}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* XP recent activity log */}
            {bonusLog.slice(0,4).length>0&&(
              <div style={{marginTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:8}}>
                <div style={{fontSize:9,fontWeight:700,color:V.text3,textTransform:"uppercase",marginBottom:6}}>Recent XP</div>
                {bonusLog.slice(0,4).map((e,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",
                    borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                    <span style={{fontSize:10,color:V.text2}}>{e.reason}</span>
                    <span style={{fontSize:10,fontWeight:700,color:V.accent,fontFamily:V.mono}}>+{e.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Share rank card */}
      <button onClick={async()=>{
        const {xp,rank}=calcIronScore(s);
        const stats=[
          {value:rank.icon+" "+rank.name,label:"RANK",color:rank.color},
          {value:xp.toLocaleString(),label:"IRON XP",color:"#e8e8ec"},
          {value:`Lv ${rank.level}/30`,label:"LEVEL",color:rank.tierColor},
        ];
        const c2=await ShareCard.generate(`${rank.icon} ${rank.name}`,stats,`Level ${rank.level} · ${xp.toLocaleString()} Iron XP`);
        ShareCard.share(c2,`ironlog-rank-${today()}.png`);
      }} style={{width:"100%",padding:"10px",borderRadius:10,
        background:`rgba(255,255,255,0.03)`,border:`1px solid rgba(255,255,255,0.06)`,
        cursor:"pointer",fontSize:11,fontWeight:700,color:V.text3,fontFamily:V.font,
        display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        📤 Share Your Rank
      </button>

      {/* Active multiplier if any */}
      {multiplier.mult>1&&(
        <Card style={{padding:12,background:`${multiplier.color}08`,border:`1px solid ${multiplier.color}30`}}>
          <div style={{fontSize:11,fontWeight:700,color:multiplier.color}}>
            {multiplier.icon} {multiplier.label} is active right now
          </div>
          <div style={{fontSize:10,color:V.text3,marginTop:3}}>
            {multiplier.mult===3?"Log your comeback workout for 3× XP on base workout points":
             multiplier.mult===2?"It's Double XP Day — log a workout to maximize gains":
             "3-day combo streak — keep it going!"}
          </div>
        </Card>
      )}

      {/* Daily missions */}
      <DailyMissionsCard s={s} d={d}/>

      {/* XP Breakdown */}
      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>XP BREAKDOWN</div>
        {xpSources.map(src=>{
          const earned=src.val*src.each;
          return(
            <div key={src.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{src.icon}</span>
                <div>
                  <div style={{fontSize:11,color:V.text}}>{src.label}</div>
                  <div style={{fontSize:9,color:V.text3}}>{src.val} × {src.each} {src.unit||"XP"}</div>
                </div>
              </div>
              <span style={{fontSize:13,fontWeight:800,color:V.accent,fontFamily:V.mono}}>+{earned.toLocaleString()}</span>
            </div>
          );
        })}
        {bonusXP>0&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",
            borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}>⭐</span>
              <div>
                <div style={{fontSize:11,color:V.text}}>Bonus XP (Missions + Events)</div>
                <div style={{fontSize:9,color:V.text3}}>Multipliers, daily missions, comebacks</div>
              </div>
            </div>
            <span style={{fontSize:13,fontWeight:800,color:"#22c55e",fontFamily:V.mono}}>+{bonusXP.toLocaleString()}</span>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,marginTop:4,
          borderTop:`1px solid rgba(255,255,255,0.06)`}}>
          <span style={{fontSize:12,fontWeight:700,color:V.text}}>Total Iron XP</span>
          <span style={{fontSize:18,fontWeight:900,color:V.accent,fontFamily:V.mono}}>{xp.toLocaleString()}</span>
        </div>
      </Card>

      {/* Recent XP log */}
      {bonusLog.length>0&&(
        <Card style={{padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>RECENT XP EARNED</div>
          {bonusLog.map((entry,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"5px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
              <div>
                <div style={{fontSize:11,color:V.text}}>{entry.reason}</div>
                <div style={{fontSize:9,color:V.text3}}>{entry.date}</div>
              </div>
              <span style={{fontSize:12,fontWeight:800,color:"#22c55e",fontFamily:V.mono}}>+{entry.amount}</span>
            </div>
          ))}
        </Card>
      )}

      {/* All 30 ranks grouped by tier */}
      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:12}}>ALL 30 RANKS</div>
        {tierGroups.map(({tier,ranks:tRanks})=>{
          const tierRank=tRanks[0];
          const tierUnlocked=xp>=tierRank.xpNeeded;
          return(
            <div key={tier} style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <span style={{fontSize:12}}>{tierRank.icon}</span>
                <span style={{fontSize:10,fontWeight:800,color:tierUnlocked?tierRank.tierColor:V.text3,
                  letterSpacing:1,textTransform:"uppercase"}}>{tier}</span>
                <div style={{flex:1,height:1,background:tierUnlocked?`${tierRank.tierColor}30`:"rgba(255,255,255,0.06)"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2,paddingLeft:8}}>
                {tRanks.map(r=>{
                  const unlocked=xp>=r.xpNeeded;
                  const isCurrent=r.level===rank.level;
                  return(
                    <div key={r.level} style={{display:"flex",alignItems:"center",gap:8,
                      padding:"5px 8px",borderRadius:7,
                      background:isCurrent?`${r.color}15`:"transparent",
                      border:isCurrent?`1px solid ${r.color}35`:"1px solid transparent"}}>
                      <span style={{fontSize:13,opacity:unlocked?1:0.2}}>{r.icon}</span>
                      <div style={{flex:1}}>
                        <span style={{fontSize:11,fontWeight:isCurrent?800:400,
                          color:unlocked?r.color:V.text3}}>{r.name}</span>
                        {isCurrent&&<span style={{fontSize:9,color:V.text3,marginLeft:5}}>← you</span>}
                      </div>
                      <span style={{fontSize:8,color:unlocked?V.text3:"rgba(255,255,255,0.12)",
                        fontFamily:V.mono}}>{r.xpNeeded.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── Competitive: 1v1 Duels ───

export function SocialDuels({s,d}){
  const email=s.profile?.email;
  const myName=s.profile?.firstName?`${s.profile.firstName} ${s.profile.lastName||""}`.trim():"You";
  const [friends,setFriends]=useState(null);
  const [active,setActive]=useState(LS.get("ft-duels")||[]);
  const [showNew,setShowNew]=useState(false);
  const [rematchFriend,setRematchFriend]=useState(null); // pre-fill friend on rematch
  const [selFriend,setSelFriend]=useState(null);
  const [selMetric,setSelMetric]=useState("workouts");
  const [selDays,setSelDays]=useState(7);
  const [tab,setTab]=useState("active"); // active | history
  const streak=useStreak(s.workouts);
  const [record,setRecord]=useState(LS.get("ft-duel-record")||{wins:0,losses:0,ties:0});
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const w2=parseFloat(st.weight)||0;if(w2>b)b=w2;});}));return b;};

  useEffect(()=>{if(email)SocialAPI.getFriends(email).then(r=>{if(r)setFriends(r);});},[email]);

  // Pre-select friend on rematch open
  useEffect(()=>{
    if(showNew&&rematchFriend){
      setSelFriend(rematchFriend);
    }
  },[showNew]);

  const DUEL_METRICS=[
    {id:"workouts",label:"💪 Workouts",desc:"Most sessions logged in the window",unit:"workouts"},
    {id:"streak",label:"🔥 Streak",desc:"Who keeps a longer streak during the duel",unit:"days"},
    {id:"volume",label:"⚡ Total Volume",desc:"Most lbs moved (weight × reps)",unit:"lbs"},
    {id:"big3",label:"🏋️ Big 3",desc:"Highest bench + squat + deadlift combined",unit:"lbs"},
    {id:"protein",label:"🥗 Protein Days",desc:"Most days hitting your protein goal",unit:"days"},
  ];

  const getMyVal=(metric,sinceDate)=>{
    const since=sinceDate||ago(7);
    if(metric==="streak")return streak;
    if(metric==="workouts")return s.workouts.filter(w=>w.date>=since).length;
    if(metric==="volume")return Math.round(s.workouts.filter(w=>w.date>=since).reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
    if(metric==="big3")return getBest("bench")+getBest("squat")+getBest("deadlift");
    if(metric==="protein")return s.nutrition.filter(n=>n.date>=since&&(n.protein||0)>=(s.goals?.protein||150)).length;
    return 0;
  };

  // For absolute metrics (streak, big3): compare current value directly.
  // For delta metrics (workouts, volume, protein): subtract baseline captured at duel start.
  const ABSOLUTE_METRICS=["streak","big3"];
  const getDuelScore=(duel)=>{
    const raw=getMyVal(duel.metric,duel.startDate);
    if(ABSOLUTE_METRICS.includes(duel.metric))return raw;
    return Math.max(0,raw-(duel.myStartVal||0));
  };

  const saveActive=(updated)=>{setActive(updated);LS.set("ft-duels",updated);};

  const createDuel=()=>{
    if(!selFriend)return;
    const f=selFriend;
    const duel={id:uid(),friendEmail:f.email,friendName:friendDisplayName(f),
      metric:selMetric,days:selDays,startDate:today(),
      endDate:ago(-selDays),status:"active",resultSeen:false,
      myStartVal:getMyVal(selMetric),theirVal:parseInt(f.challenges?.find(c=>c.challenge_id===selMetric)?.value)||0};
    saveActive([...active,duel]);
    try{SocialAPI.logEvent(email,"DuelStarted",{to:f.email,metric:selMetric,days:selDays,name:myName},"friends");}catch(e){}
    setShowNew(false);setSelFriend(null);setRematchFriend(null);
    SuccessToastCtrl.show(`⚔️ Duel started with ${friendDisplayName(f)}!`);
  };

  const claimResult=(duel,iWon,tied)=>{
    // Update win/loss record and sync state so W/L bar re-renders immediately
    const cur=LS.get("ft-duel-record")||{wins:0,losses:0,ties:0};
    if(iWon)cur.wins=(cur.wins||0)+1;
    else if(tied)cur.ties=(cur.ties||0)+1;
    else cur.losses=(cur.losses||0)+1;
    LS.set("ft-duel-record",cur);
    setRecord({...cur});
    // XP for wins
    if(iWon){addXPBonus(50,"Duel Victory 🏆");SuccessToastCtrl.show("Victory! +50 XP 🏆");}
    // Snapshot final score so history shows accurate score even after more workouts are logged
    const finalMyScore=getDuelScore(duel);
    saveActive(active.map(dd=>dd.id===duel.id?{...dd,resultSeen:true,settled:true,finalMyScore}:dd));
  };

  const removeDuel=(id)=>saveActive(active.filter(dd=>dd.id!==id));

  const startRematch=(duel)=>{
    const f=(friends?.friends||[]).find(ff=>ff.email===duel.friendEmail);
    setSelFriend(f||{email:duel.friendEmail,name:duel.friendName});
    setRematchFriend(f||{email:duel.friendEmail,name:duel.friendName});
    setSelMetric(duel.metric);
    setSelDays(duel.days||7);
    setShowNew(true);
  };

  const metricDef=(m)=>DUEL_METRICS.find(dm=>dm.id===m);

  const now=new Date();
  const runningDuels=active.filter(dd=>new Date(dd.endDate)>=now);   // still in progress
  const pendingResults=active.filter(dd=>new Date(dd.endDate)<now&&!dd.resultSeen); // ended, not claimed
  const historyDuels=active.filter(dd=>new Date(dd.endDate)<now&&dd.resultSeen);   // settled
  const activeDuels=runningDuels; // alias used by tab label
  const totalDuels=Math.max(1,(record.wins||0)+(record.losses||0)+(record.ties||0)); // guard /0

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* ── Header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16,fontWeight:800,color:V.text}}>⚔️ 1v1 Duels</span><HelpBtn topic="duels" color="#f43f5e"/></div>
          <div style={{fontSize:11,color:V.text3}}>Challenge a friend head-to-head</div>
        </div>
        <button onClick={()=>{setRematchFriend(null);setSelFriend(null);setShowNew(true);}}
          style={{padding:"9px 18px",borderRadius:10,background:V.accent,border:"none",
            cursor:"pointer",fontSize:12,fontWeight:800,color:V.bg,fontFamily:V.font}}>
          + Challenge
        </button>
      </div>

      {/* ── Win/Loss record bar ── */}
      {((record.wins||0)+(record.losses||0)+(record.ties||0))>0&&(
        <Card style={{padding:"10px 14px",background:`linear-gradient(135deg,${V.accent}07,${V.purple}07)`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:16,alignItems:"center"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:V.accent,fontFamily:V.mono,lineHeight:1}}>{record.wins||0}</div>
                <div style={{fontSize:8,color:V.text3,fontWeight:700,letterSpacing:".06em"}}>WINS</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:V.danger,fontFamily:V.mono,lineHeight:1}}>{record.losses||0}</div>
                <div style={{fontSize:8,color:V.text3,fontWeight:700,letterSpacing:".06em"}}>LOSSES</div>
              </div>
              {(record.ties||0)>0&&(
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:V.warn,fontFamily:V.mono,lineHeight:1}}>{record.ties}</div>
                  <div style={{fontSize:8,color:V.text3,fontWeight:700,letterSpacing:".06em"}}>TIES</div>
                </div>
              )}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:18,fontWeight:900,color:V.text,fontFamily:V.mono}}>
                {Math.round(((record.wins||0)/totalDuels)*100)}%
              </div>
              <div style={{fontSize:9,color:V.text3}}>win rate · {(record.wins||0)+(record.losses||0)+(record.ties||0)} duels</div>
              {(record.wins||0)>=5&&(
                <div style={{fontSize:9,color:V.accent,fontWeight:700,marginTop:2}}>👑 Duel King</div>
              )}
            </div>
          </div>
          {/* win rate bar */}
          <div style={{marginTop:8,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
            <div style={{height:"100%",borderRadius:2,background:`linear-gradient(90deg,${V.accent},${V.purple})`,
              width:`${Math.round(((record.wins||0)/totalDuels)*100)}%`,transition:"width .5s"}}/>
          </div>
        </Card>
      )}

      {/* ── Pending results (auto-surfaced) ── */}
      {pendingResults.map(duel=>{
        const myV=duel.finalMyScore!==undefined?duel.finalMyScore:getDuelScore(duel);
        const theirV=duel.theirVal||0;
        const iWon=myV>theirV;
        const tied=myV===theirV;
        const def=metricDef(duel.metric);
        return(
          <div key={duel.id+"_result"} style={{padding:"14px 16px",borderRadius:16,
            background:iWon?"linear-gradient(135deg,rgba(0,245,160,0.12),rgba(0,245,160,0.03))"
              :tied?"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.03))"
              :"linear-gradient(135deg,rgba(244,63,94,0.12),rgba(244,63,94,0.03))",
            border:`1.5px solid ${iWon?V.accent:tied?V.warn:V.danger}35`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:32}}>{iWon?"🏆":tied?"🤝":"💀"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:900,color:iWon?V.accent:tied?V.warn:V.danger}}>
                  {iWon?"You Won!":tied?"It's a Tie!":"You Lost"}
                </div>
                <div style={{fontSize:11,color:V.text3}}>vs {duel.friendName} · {def?.label}</div>
              </div>
              {iWon&&<div style={{padding:"4px 10px",borderRadius:20,background:`${V.accent}15`,
                border:`1px solid ${V.accent}30`,fontSize:10,fontWeight:800,color:V.accent}}>+50 XP</div>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[{label:"You",val:myV,win:iWon||tied},{label:duel.friendName?.split(" ")[0]||"Them",val:theirV,win:!iWon||tied}].map(side=>(
                <div key={side.label} style={{padding:"10px",borderRadius:10,
                  background:side.win&&!tied?"rgba(0,245,160,0.06)":"rgba(255,255,255,0.03)",
                  textAlign:"center",border:`1px solid ${side.win&&!tied?V.accent+"20":"transparent"}`}}>
                  <div style={{fontSize:22,fontWeight:900,color:side.win?V.accent:V.text3,fontFamily:V.mono}}>{side.val}</div>
                  <div style={{fontSize:9,color:V.text3}}>{side.label}</div>
                  <div style={{fontSize:8,color:V.text3}}>{def?.unit}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>claimResult(duel,iWon,tied)}
                style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",
                  background:iWon?V.accent:tied?V.warn:V.danger,border:"none",
                  fontSize:12,fontWeight:800,color:V.bg,fontFamily:V.font}}>
                {iWon?"🏆 Claim Victory":tied?"🤝 Accept Tie":"💀 Accept Loss"}
              </button>
              <button onClick={()=>startRematch(duel)}
                style={{padding:"11px 14px",borderRadius:10,cursor:"pointer",
                  background:"rgba(255,255,255,0.06)",border:`1px solid ${V.cardBorder}`,
                  fontSize:12,fontWeight:700,color:V.text2,fontFamily:V.font}}>
                Rematch ⚔️
              </button>
              <button onClick={()=>{
                  const msg=iWon?`I beat ${duel.friendName} ${myV}–${theirV} on IRONLOG! 🏆`:`Rematch time — ${duel.friendName} got me ${theirV}–${myV} on IRONLOG ⚔️`;
                  if(navigator.share)navigator.share({title:"IRONLOG Duel",text:msg}).catch(()=>{});
                  else{navigator.clipboard?.writeText(msg);SuccessToastCtrl.show("Copied!");}
                }} style={{padding:"11px 12px",borderRadius:10,cursor:"pointer",
                  background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                  fontSize:12,color:V.text3,fontFamily:V.font}}>
                Share
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Tab selector ── */}
      {(activeDuels.length>0||historyDuels.length>0)&&(
        <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:`1px solid ${V.cardBorder}`}}>
          {[{id:"active",label:"Active"+(runningDuels.length>0?" ("+runningDuels.length+")":"")},
            {id:"history",label:"History"+(historyDuels.length>0?" ("+historyDuels.length+")":"")}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px 0",
              background:tab===t.id?V.accent:"transparent",border:"none",cursor:"pointer",
              fontSize:12,fontWeight:700,color:tab===t.id?V.bg:V.text3,fontFamily:V.font,transition:"all .2s"}}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {active.length===0&&pendingResults.length===0&&(
        <Card style={{padding:32,textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:10}}>⚔️</div>
          <div style={{fontSize:15,fontWeight:800,color:V.text,marginBottom:6}}>No active duels</div>
          <div style={{fontSize:12,color:V.text3,marginBottom:18,lineHeight:1.5}}>
            Challenge a friend and see who's really putting in work. Bragging rights included.
          </div>
          <button onClick={()=>setShowNew(true)} style={{padding:"12px 32px",borderRadius:12,
            background:V.accent,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,
            color:V.bg,fontFamily:V.font}}>
            ⚔️ Start a Duel
          </button>
        </Card>
      )}

      {/* ── Active duel cards ── */}
      {tab==="active"&&runningDuels.length===0&&(
        <div style={{padding:"18px 0",textAlign:"center"}}>
          <div style={{fontSize:12,color:V.text3,marginBottom:10}}>No active duels running right now</div>
          <button onClick={()=>{setRematchFriend(null);setSelFriend(null);setShowNew(true);}}
            style={{padding:"8px 20px",borderRadius:8,background:V.accent,border:"none",
              cursor:"pointer",fontSize:12,fontWeight:800,color:V.bg,fontFamily:V.font}}>
            + New Challenge
          </button>
        </div>
      )}
      {tab==="active"&&runningDuels.map(duel=>{
        const myV=getDuelScore(duel);
        const theirV=duel.theirVal||0;
        const winning=myV>theirV;
        const tied=myV===theirV;
        const max=Math.max(myV,theirV,1);
        const msLeft=new Date(duel.endDate)-new Date();
        const daysLeft=Math.max(0,Math.round(msLeft/86400000));
        const hoursLeft=Math.max(0,Math.round(msLeft/3600000));
        const totalMs=(duel.days||7)*86400000;
        const progressPct=Math.min(100,Math.round((1-msLeft/totalMs)*100));
        const def=metricDef(duel.metric);
        const statusColor=winning?V.accent:tied?"#f59e0b":V.danger;
        return(
          <Card key={duel.id} style={{padding:0,overflow:"hidden",
            border:`1.5px solid ${statusColor}25`}}>
            {/* Time progress bar at top */}
            <div style={{height:3,background:"rgba(255,255,255,0.05)"}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${statusColor},${statusColor}80)`,
                width:`${progressPct}%`,transition:"width .5s"}}/>
            </div>
            <div style={{padding:14}}>
              {/* Status + timer row */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:6,letterSpacing:".04em",
                  background:`${statusColor}15`,color:statusColor}}>
                  {winning?"🟢 WINNING":tied?"🟡 TIED":"🔴 BEHIND"}
                </span>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:10,color:V.text3}}>
                    {daysLeft>0?`${daysLeft}d left`:hoursLeft>0?`${hoursLeft}h left`:"Ending soon"}
                  </span>
                  <button onClick={()=>removeDuel(duel.id)}
                    style={{background:"none",border:"none",cursor:"pointer",
                      fontSize:13,color:V.text3,padding:"2px 4px",opacity:0.5}}>✕</button>
                </div>
              </div>

              {/* Metric label */}
              <div style={{fontSize:10,fontWeight:700,color:V.text3,marginBottom:10,
                display:"flex",alignItems:"center",gap:6}}>
                <span>{def?.label}</span>
                <span style={{opacity:0.4}}>·</span>
                <span>{duel.days}d duel</span>
              </div>

              {/* Score comparison */}
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,
                alignItems:"center",marginBottom:12}}>
                <div style={{background:winning?`${V.accent}08`:"rgba(255,255,255,0.02)",
                  borderRadius:10,padding:"10px 12px",border:`1px solid ${winning?V.accent+"20":"transparent"}`}}>
                  <div style={{fontSize:10,color:V.text3,marginBottom:2}}>You</div>
                  <div style={{fontSize:28,fontWeight:900,color:winning?V.accent:V.text,fontFamily:V.mono,lineHeight:1}}>{myV}</div>
                  <div style={{fontSize:8,color:V.text3,marginTop:1}}>{def?.unit}</div>
                </div>
                <div style={{fontSize:12,fontWeight:800,color:V.text3}}>vs</div>
                <div style={{background:!winning&&!tied?`${V.danger}08`:"rgba(255,255,255,0.02)",
                  borderRadius:10,padding:"10px 12px",textAlign:"right",
                  border:`1px solid ${!winning&&!tied?V.danger+"20":"transparent"}`}}>
                  <div style={{fontSize:10,color:V.text3,marginBottom:2}}>{duel.friendName?.split(" ")[0]||"Them"}</div>
                  <div style={{fontSize:28,fontWeight:900,color:!winning&&!tied?V.danger:V.text,fontFamily:V.mono,lineHeight:1}}>{theirV}</div>
                  <div style={{fontSize:8,color:V.text3,marginTop:1}}>{def?.unit}</div>
                </div>
              </div>

              {/* Dual progress bars */}
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontSize:9,color:V.text3,width:22,flexShrink:0}}>You</div>
                  <div style={{flex:1,height:7,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:4,
                      background:`linear-gradient(90deg,${V.accent},${V.accent}90)`,
                      width:`${Math.round(myV/max*100)}%`,transition:"width .5s"}}/>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontSize:9,color:V.text3,width:22,flexShrink:0,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {duel.friendName?.split(" ")[0]?.slice(0,4)||"Them"}
                  </div>
                  <div style={{flex:1,height:7,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:4,
                      background:`linear-gradient(90deg,${V.danger},${V.danger}90)`,
                      width:`${Math.round(theirV/max*100)}%`,transition:"width .5s"}}/>
                  </div>
                </div>
              </div>

              {/* Lead/gap callout */}
              {myV!==theirV&&(
                <div style={{marginTop:8,fontSize:10,color:V.text3,textAlign:"center",fontStyle:"italic"}}>
                  {winning
                    ?`You're ahead by ${myV-theirV} ${def?.unit||"pts"} — keep it up 🔥`
                    :`${theirV-myV} ${def?.unit||"pts"} behind — time to grind 💪`}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* ── History cards ── */}
      {tab==="history"&&(
        historyDuels.length===0
          ?<Card style={{padding:20,textAlign:"center"}}>
            <div style={{fontSize:12,color:V.text3}}>No completed duels yet</div>
          </Card>
          :historyDuels.slice().reverse().map((duel,i)=>{
            const myV=duel.finalMyScore!==undefined?duel.finalMyScore:getDuelScore(duel);
            const theirV=duel.theirVal||0;
            const won=myV>theirV;
            const tied=myV===theirV;
            const def=metricDef(duel.metric);
            return(
              <Card key={duel.id} style={{padding:12,opacity:0.8,
                border:`1px solid ${won?V.accent:tied?V.warn:V.danger}18`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>{won?"🏆":tied?"🤝":"💀"}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:won?V.accent:tied?V.warn:V.danger}}>
                        {won?"Won":tied?"Tied":"Lost"} vs {duel.friendName}
                      </div>
                      <div style={{fontSize:9,color:V.text3}}>{def?.label} · {duel.days}d</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,fontWeight:800,color:V.text,fontFamily:V.mono}}>{myV}–{theirV}</div>
                    <div style={{fontSize:8,color:V.text3}}>{def?.unit}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>startRematch(duel)}
                    style={{flex:1,padding:"7px",borderRadius:8,cursor:"pointer",
                      background:"rgba(255,255,255,0.04)",border:`1px solid ${V.accent}30`,
                      fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>
                    ⚔️ Rematch
                  </button>
                  <button onClick={()=>removeDuel(duel.id)}
                    style={{padding:"7px 12px",borderRadius:8,cursor:"pointer",
                      background:"rgba(255,255,255,0.03)",border:`1px solid ${V.cardBorder}`,
                      fontSize:11,color:V.text3,fontFamily:V.font}}>
                    Remove
                  </button>
                </div>
              </Card>
            );
          })
      )}

      {/* ── New duel Sheet (using proper Sheet component to fix iOS tap issue) ── */}
      {showNew&&(
        <Sheet title="⚔️ Start a Duel" onClose={()=>{setShowNew(false);setSelFriend(null);setRematchFriend(null);}}
          footer={
            <div style={{padding:"12px 20px",paddingBottom:"max(12px,env(safe-area-inset-bottom))"}}>
              <button onClick={()=>{if(selFriend)createDuel();}}
                disabled={!selFriend}
                style={{width:"100%",padding:"15px",borderRadius:12,
                  background:selFriend?V.accent:"rgba(255,255,255,0.08)",
                  border:"none",cursor:selFriend?"pointer":"default",
                  fontSize:15,fontWeight:800,color:selFriend?V.bg:V.text3,
                  fontFamily:V.font,transition:"all .2s",
                  opacity:selFriend?1:0.5}}>
                {selFriend?`⚔️ Challenge ${friendDisplayName(selFriend).split(" ")[0]}`:"Select an opponent first"}
              </button>
            </div>
          }>
          {/* Opponent */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,letterSpacing:".06em",
              textTransform:"uppercase",marginBottom:10}}>Choose Opponent</div>
            {!friends&&(
              <div style={{display:"flex",gap:10,alignItems:"center",padding:"12px 0"}}>
                <div style={{width:12,height:12,borderRadius:"50%",border:`2px solid ${V.accent}`,
                  borderTopColor:"transparent",animation:"spin 1s linear infinite"}}/>
                <span style={{fontSize:12,color:V.text3}}>Loading friends...</span>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(friends?.friends||[]).map(f=>{
                const sel=selFriend?.email===f.email;
                return(
                  <button key={f.email} onClick={()=>setSelFriend(sel?null:f)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                      borderRadius:12,width:"100%",textAlign:"left",fontFamily:V.font,
                      border:`1.5px solid ${sel?V.accent:V.cardBorder}`,
                      background:sel?`${V.accent}10`:"rgba(255,255,255,0.02)",
                      cursor:"pointer",transition:"all .15s",WebkitTapHighlightColor:"transparent"}}>
                    <div style={{width:40,height:40,borderRadius:20,overflow:"hidden",flexShrink:0,
                      background:f.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {f.avatar?<img src={f.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                        :<span style={{fontSize:15,color:"#fff",fontWeight:800}}>{friendDisplayName(f)[0]?.toUpperCase()}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:sel?V.accent:V.text}}>{friendDisplayName(f)}</div>
                      {f.username&&<div style={{fontSize:10,color:V.text3}}>@{f.username}</div>}
                    </div>
                    <div style={{width:22,height:22,borderRadius:11,
                      border:`2px solid ${sel?V.accent:V.cardBorder}`,
                      background:sel?V.accent:"transparent",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {sel&&<span style={{color:V.bg,fontSize:12,fontWeight:900}}>✓</span>}
                    </div>
                  </button>
                );
              })}
              {friends&&(friends?.friends||[]).length===0&&(
                <Card style={{padding:20,textAlign:"center"}}>
                  <div style={{fontSize:12,color:V.text3,marginBottom:10}}>Add friends first to challenge them</div>
                  <Btn onClick={()=>{setShowNew(false);d({type:"TAB",tab:"social_friends"});}}>Add Friends</Btn>
                </Card>
              )}
            </div>
          </div>

          {/* Metric */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,letterSpacing:".06em",
              textTransform:"uppercase",marginBottom:10}}>Metric</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {DUEL_METRICS.map(m=>{
                const myPreview=getMyVal(m.id);
                const sel=selMetric===m.id;
                return(
                  <button key={m.id} onClick={()=>setSelMetric(m.id)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"12px 14px",borderRadius:12,width:"100%",
                      border:`1.5px solid ${sel?V.accent:V.cardBorder}`,
                      background:sel?`${V.accent}10`:"rgba(255,255,255,0.02)",
                      cursor:"pointer",fontFamily:V.font,WebkitTapHighlightColor:"transparent"}}>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:13,fontWeight:700,color:sel?V.accent:V.text}}>{m.label}</div>
                      <div style={{fontSize:10,color:V.text3,marginTop:1}}>{m.desc}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                      <div style={{fontSize:15,fontWeight:900,color:sel?V.accent:V.text2,fontFamily:V.mono}}>{myPreview}</div>
                      <div style={{fontSize:8,color:V.text3}}>your {m.unit}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,letterSpacing:".06em",
              textTransform:"uppercase",marginBottom:10}}>Duration</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[3,7,14,30].map(dd=>{
                const sel=selDays===dd;
                return(
                  <button key={dd} onClick={()=>setSelDays(dd)}
                    style={{padding:"12px 0",borderRadius:10,
                      border:`1.5px solid ${sel?V.accent:V.cardBorder}`,
                      background:sel?`${V.accent}10`:"transparent",
                      cursor:"pointer",fontSize:13,fontWeight:700,
                      color:sel?V.accent:V.text3,fontFamily:V.font,
                      WebkitTapHighlightColor:"transparent"}}>
                    {dd}d
                  </button>
                );
              })}
            </div>
            <div style={{fontSize:10,color:V.text3,marginTop:8,textAlign:"center"}}>
              Ends {new Date(Date.now()+selDays*86400000).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ─── Competitive: Weekly Wars (group challenge) ───

export function SocialWeeklyWar({s,d}){
  const streak=useStreak(s.workouts);
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const w2=parseFloat(st.weight)||0;if(w2>b)b=w2;});}));return b;};
  const now=new Date();
  const dow=now.getDay();
  const mondayOffset=dow===0?6:dow-1;
  const weekStart=ago(mondayOffset);
  const weekEnd=ago(mondayOffset-6);
  const daysLeft=7-mondayOffset;

  // This week's stats
  const weekWorkouts=s.workouts.filter(w=>w.date>=weekStart).length;
  const weekVol=Math.round(s.workouts.filter(w=>w.date>=weekStart).reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
  const weekProteinDays=s.nutrition.filter(n=>n.date>=weekStart&&(n.protein||0)>=(s.goals?.protein||150)).length;

  // War challenges — 5 rotating weekly battles
  const weekIdx=Math.floor((Date.now()-WAR_EPOCH)/(7*86400000));
  const ALL_WARS=[
    {id:"workouts",name:"Most Workouts",desc:"Log as many sessions as possible",icon:"💪",
      myVal:weekWorkouts,target:5,unit:"workouts"},
    {id:"volume",name:"Volume King",desc:"Move the most total weight (lbs moved)",icon:"⚡",
      myVal:weekVol,target:20000,unit:"lbs"},
    {id:"protein",name:"Protein Perfect",desc:"Hit protein every day this week",icon:"🥗",
      myVal:weekProteinDays,target:7,unit:"days"},
    {id:"streak",name:"Consistency King",desc:"Keep your streak alive all week",icon:"🔥",
      myVal:Math.min(streak,7),target:7,unit:"days"},
    {id:"mixed",name:"The Gauntlet",desc:"3 workouts + 4 protein days + 1 new PR",icon:"👑",
      myVal:(weekWorkouts>=3?1:0)+(weekProteinDays>=4?1:0)+(()=>{
        // Real PR check: any exercise this week beat its all-time best before this week
        return s.workouts.filter(w=>w.date>=weekStart).some(w=>
          w.exercises.some(e=>{
            let prevBest=0;
            s.workouts.filter(pw=>pw.date<weekStart).forEach(pw=>
              pw.exercises.filter(pe=>pe.exerciseId===e.exerciseId).forEach(pe=>
                pe.sets.forEach(st=>{const wt=parseFloat(st.weight)||0;if(wt>prevBest)prevBest=wt;})
              )
            );
            return prevBest>0&&e.sets.some(st=>(parseFloat(st.weight)||0)>prevBest);
          })
        )?1:0;
      })(),
      target:3,unit:"tasks"},
  ];

  const wars=[ALL_WARS[weekIdx%ALL_WARS.length], ALL_WARS[(weekIdx+1)%ALL_WARS.length], ALL_WARS[(weekIdx+2)%ALL_WARS.length]];
  const mainWar=wars[0];

  // Weekly war streak from LS
  const [warWins,setWarWins]=useState(LS.get("ft-war-wins")||0);
  const [warStreak,setWarStreak]=useState(LS.get("ft-war-streak")||0);
  // B21 fix: track claimed wins per weekIdx so wins can actually be recorded
  const claimedKey=`ft-war-claimed-${weekIdx}`;
  const [winClaimed,setWinClaimed]=useState(!!LS.get(claimedKey));

  const claimVictory=()=>{
    if(winClaimed)return;
    const newWins=(LS.get("ft-war-wins")||0)+1;
    const lastWin=LS.get("ft-last-war-win");
    const prevWeekIdx=lastWin?Math.floor((Date.now()-WAR_EPOCH)/(7*86400000))-1:null;
    const newStreak=lastWin&&prevWeekIdx===weekIdx-1?(LS.get("ft-war-streak")||0)+1:1;
    LS.set("ft-war-wins",newWins);LS.set("ft-war-streak",newStreak);
    LS.set("ft-last-war-win",weekStart);LS.set(claimedKey,true);
    setWarWins(newWins);setWarStreak(newStreak);setWinClaimed(true);
    addXPBonus(100,"Weekly War Victory 🏆");
    SuccessToastCtrl.show(`🏆 War Won! +100 XP · ${newStreak} war win streak!`);
    Haptic.success();
  };

  const formatVal=(v)=>v>=10000?`${(v/1000).toFixed(1)}k`:v;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16,fontWeight:800,color:V.text}}>Weekly Wars</span><HelpBtn topic="war" color="#fbbf24"/></div>
          <div style={{fontSize:11,color:V.text3}}>New battles every Monday · {daysLeft}d remaining</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:900,color:"#fbbf24",fontFamily:V.mono}}>{warWins}</div>
          <div style={{fontSize:9,color:V.text3}}>WAR WINS</div>
        </div>
      </div>

      {/* Main war this week */}
      <Card style={{padding:16,background:`linear-gradient(135deg,#f43f5e10,#f9731608)`,
        border:`1px solid #f43f5e30`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:9,fontWeight:700,color:"#f43f5e",background:"#f43f5e15",
            padding:"2px 8px",borderRadius:6}}>⚔️ THIS WEEK</span>
          <span style={{fontSize:9,color:V.text3}}>{daysLeft} days left</span>
        </div>
        <div style={{fontSize:20,fontWeight:900,color:V.text,marginBottom:4}}>
          {mainWar.icon} {mainWar.name}
        </div>
        <div style={{fontSize:11,color:V.text3,marginBottom:12}}>{mainWar.desc}</div>

        {/* Progress */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:6}}>
          <div>
            <div style={{fontSize:32,fontWeight:900,color:mainWar.myVal>=mainWar.target?"#22c55e":V.accent,fontFamily:V.mono}}>
              {formatVal(mainWar.myVal)}
            </div>
            <div style={{fontSize:10,color:V.text3}}>of {formatVal(mainWar.target)} {mainWar.unit}</div>
          </div>
          {mainWar.myVal>=mainWar.target?(
            <div style={{fontSize:28}}>🏆</div>
          ):(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:800,color:V.warn}}>
                {formatVal(mainWar.target-mainWar.myVal)} {mainWar.unit} to go
              </div>
            </div>
          )}
        </div>
        <div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.06)"}}>
          <div style={{height:"100%",borderRadius:4,
            background:mainWar.myVal>=mainWar.target
              ?"linear-gradient(90deg,#22c55e,#86efac)"
              :"linear-gradient(90deg,#f43f5e,#f97316)",
            width:`${Math.min(100,mainWar.myVal/mainWar.target*100)}%`,
            transition:"width .5s",boxShadow:`0 0 10px ${mainWar.myVal>=mainWar.target?"#22c55e":"#f43f5e"}50`}}/>
        </div>
        {mainWar.myVal>=mainWar.target&&(
          <div style={{marginTop:10}}>
            {winClaimed?(
              <div style={{padding:"8px 12px",borderRadius:8,background:"#22c55e12",
                border:"1px solid #22c55e30",fontSize:11,fontWeight:700,color:"#22c55e",textAlign:"center"}}>
                🏆 Victory Claimed! +100 XP earned
              </div>
            ):(
              <button onClick={claimVictory} style={{width:"100%",padding:"10px 12px",borderRadius:8,
                background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",cursor:"pointer",
                fontSize:12,fontWeight:800,color:"#fff",fontFamily:V.font,
                boxShadow:"0 4px 12px rgba(34,197,94,0.4)"}}>
                🏆 Claim Victory · +100 XP
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Upcoming wars */}
      <div style={{fontSize:11,fontWeight:700,color:V.text3}}>COMING UP</div>
      {wars.slice(1).map((w,i)=>(
        <Card key={i} style={{padding:12,opacity:0.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>{w.icon}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:V.text}}>{w.name}</div>
                <div style={{fontSize:10,color:V.text3}}>{w.desc}</div>
              </div>
            </div>
            <span style={{fontSize:9,color:V.text3}}>In {i+1}w</span>
          </div>
        </Card>
      ))}

      {/* War record */}
      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>YOUR WAR RECORD</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {l:"Total Wins",v:warWins,c:"#22c55e",i:"🏆"},
            {l:"Win Streak",v:warStreak,c:"#f59e0b",i:"🔥"},
            {l:"Active Week",v:`${7-daysLeft}/7d`,c:V.accent,i:"📅"},
          ].map(st=>(
            <div key={st.l} style={{textAlign:"center",padding:"10px 6px",borderRadius:8,
              background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`}}>
              <div style={{fontSize:18,marginBottom:4}}>{st.i}</div>
              <div style={{fontSize:18,fontWeight:900,color:st.c,fontFamily:V.mono}}>{st.v}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600,marginTop:2}}>{st.l}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Competitive: Rivalries ───

export function SocialRivals({s,d}){
  const email=s.profile?.email;
  const [friends,setFriends]=useState(null);
  const [rivals,setRivals]=useState(LS.get("ft-rivals")||[]);
  const streak=useStreak(s.workouts);
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const w2=parseFloat(st.weight)||0;if(w2>b)b=w2;});}));return b;};
  const {xp:myXP}=useMemo(()=>calcIronScore(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);

  useEffect(()=>{if(email)SocialAPI.getFriends(email).then(r=>{if(r)setFriends(r);});},[email]);

  const addRival=(f)=>{
    if(rivals.find(r=>r.email===f.email))return;
    const updated=[...rivals,{email:f.email,name:friendDisplayName(f),avatar:f.avatar,addedDate:today()}];
    setRivals(updated);LS.set("ft-rivals",updated);
    SocialAPI.logEvent(email,"RivalAdded",{rival:f.email,name:friendDisplayName(f)},"friends");
    SuccessToastCtrl.show(`${friendDisplayName(f)} is now your rival!`);
  };
  const removeRival=(e)=>{
    const updated=rivals.filter(r=>r.email!==e);
    setRivals(updated);LS.set("ft-rivals",updated);
  };

  const getFriendStat=(f,metric)=>{
    if(metric==="streak")return parseInt(f.challenges?.find?.(c=>c.challenge_id==="streak")?.value)||0;
    if(metric==="big3")return parseInt(f.challenges?.find?.(c=>c.challenge_id==="big3")?.value)||0;
    return parseInt(f.challenges?.find?.(c=>c.challenge_id===metric)?.value)||0;
  };

  const rivalFriends=rivals.map(r=>{
    const f=friends?.friends?.find(fr=>fr.email===r.email)||{email:r.email,name:r.name,avatar:r.avatar};
    const theirStreak=getFriendStat(f,"streak");
    const theirBig3=getFriendStat(f,"big3");
    const theirXP=parseInt(f.challenges?.find?.(c=>c.challenge_id==="ironscore")?.value)||0;
    const myWins=[streak>theirStreak,getBest("bench")+getBest("squat")+getBest("deadlift")>theirBig3,myXP>theirXP].filter(Boolean).length;
    return{...f,...r,theirStreak,theirBig3,theirXP,myWins,total:3};
  });

  const nonRivalFriends=(friends?.friends||[]).filter(f=>!rivals.find(r=>r.email===f.email));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Rivals</div>
        <div style={{fontSize:11,color:V.text3}}>Track specific friends you compete against most</div>
      </div>

      {rivalFriends.length===0&&(
        <Card style={{padding:24,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>🎯</div>
          <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:6}}>No rivals yet</div>
          <div style={{fontSize:11,color:V.text3}}>Pick friends to track closely and stay competitive</div>
        </Card>
      )}

      {rivalFriends.map(r=>(
        <Card key={r.email} style={{padding:14,
          background:`linear-gradient(135deg,${V.danger}06,${V.purple}04)`,
          border:`1px solid ${V.danger}20`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:14,overflow:"hidden",flexShrink:0,
              background:r.avatar?"none":`linear-gradient(135deg,${V.danger},#f97316)`,
              display:"flex",alignItems:"center",justifyContent:"center",
              border:`2px solid ${V.danger}40`}}>
              {r.avatar?<img src={r.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                :<span style={{fontSize:18,color:"#fff",fontWeight:800}}>{(r.name||"?")[0]?.toUpperCase()||"?"}</span>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:V.text}}>{r.name}</div>
              <div style={{fontSize:11,fontWeight:700,color:r.myWins>r.total/2?"#22c55e":r.myWins===Math.floor(r.total/2)?"#f59e0b":"#f43f5e"}}>
                {r.myWins}/{r.total} categories winning
              </div>
            </div>
            <button onClick={()=>removeRival(r.email)} style={{background:"none",border:"none",
              cursor:"pointer",fontSize:11,color:V.text3,opacity:0.5}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[
              {label:"Streak",mine:streak,theirs:r.theirStreak,unit:"d"},
              {label:"Big 3",mine:getBest("bench")+getBest("squat")+getBest("deadlift"),theirs:r.theirBig3,unit:""},
              {label:"Iron XP",mine:myXP,theirs:r.theirXP||0,unit:""},
            ].map(stat=>{
              const winning=stat.mine>stat.theirs;
              return(
                <div key={stat.label} style={{padding:"8px",borderRadius:8,
                  background:winning?"rgba(34,197,94,0.06)":"rgba(244,63,94,0.06)",
                  border:`1px solid ${winning?"rgba(34,197,94,0.15)":"rgba(244,63,94,0.15)"}`}}>
                  <div style={{fontSize:8,color:V.text3,marginBottom:2}}>{stat.label}</div>
                  <div style={{fontSize:14,fontWeight:900,color:winning?"#22c55e":"#f43f5e",fontFamily:V.mono}}>
                    {stat.mine>=1000?(stat.mine/1000).toFixed(1)+"k":stat.mine}{stat.unit}
                  </div>
                  <div style={{fontSize:9,color:V.text3}}>vs {stat.theirs>=1000?(stat.theirs/1000).toFixed(1)+"k":stat.theirs}{stat.unit}</div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Add rival from friends */}
      {nonRivalFriends.length>0&&(
        <Card style={{padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>ADD A RIVAL</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {nonRivalFriends.map(f=>(
              <div key={f.email} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,overflow:"hidden",flexShrink:0,
                  background:f.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {f.avatar?<img src={f.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                    :<span style={{fontSize:14,color:"#fff",fontWeight:800}}>{friendDisplayName(f)[0]?.toUpperCase()}</span>}
                </div>
                <span style={{flex:1,fontSize:13,fontWeight:600,color:V.text}}>{friendDisplayName(f)}</span>
                <button onClick={()=>addRival(f)} style={{padding:"5px 14px",borderRadius:8,
                  background:`${V.danger}12`,border:`1px solid ${V.danger}30`,cursor:"pointer",
                  fontSize:10,fontWeight:700,color:V.danger,fontFamily:V.font}}>+ Rival</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Log Hub ───
