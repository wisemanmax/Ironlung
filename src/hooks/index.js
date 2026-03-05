import { useMemo } from 'react';
import { today, ago, calc1RM } from '../utils.js';
import { LS } from '../utils.js';
import { V } from '../theme.js';

// ─── Hooks ───
function useStreak(workouts){
  return useMemo(()=>{
    let streak=0;const d=new Date();
    if(!workouts.find(w=>w.date===today()))d.setDate(d.getDate()-1);
    while(true){const ds=d.toISOString().split("T")[0];
      if(workouts.find(w=>w.date===ds)){streak++;d.setDate(d.getDate()-1);}else break;}
    return streak;
  },[workouts]);
}
function usePRs(workouts,exercises){
  return useMemo(()=>{
    const prs={};
    workouts.forEach(w=>w.exercises.forEach(ex=>{
      const name=exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      ex.sets.forEach(s=>{const e1rm=calc1RM(s.weight,s.reps);
        if(s.weight>0&&(!prs[ex.exerciseId]||e1rm>prs[ex.exerciseId].e1rm))
          prs[ex.exerciseId]={weight:s.weight,reps:s.reps,e1rm,date:w.date,name};
      });
    }));
    return prs;
  },[workouts,exercises]);
}

// ─── Find last sets for an exercise (for auto-fill) ───
function findLastSets(exerciseId,workouts){
  for(const w of workouts){
    const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
    if(ex&&ex.sets.length>0){
      return ex.sets.map(st=>({weight:st.weight.toString(),reps:st.reps.toString(),rpe:st.rpe?st.rpe.toString():"",done:true}));
    }
  }
  return null;
}

// ─── Readiness Score Engine ───
function calcReadiness(s){
  const td=today();
  const checkin=(s.checkins||[]).find(c=>c.date===td);
  const tn=s.nutrition.find(n=>n.date===td)||s.nutrition.find(n=>n.date===ago(1));
  const lastW=s.workouts[0]; // most recent workout
  const recentW=s.workouts.filter(w=>w.date>=ago(7));
  const prevWeekW=s.workouts.filter(w=>w.date>=ago(14)&&w.date<ago(7));

  let score=50; // baseline
  const factors=[];

  // 1. Sleep quality (0-25 pts) — from nutrition log or check-in
  const sleep=checkin?.sleep||tn?.sleep||0;
  if(sleep>0){
    if(sleep>=7.5){score+=25;factors.push({label:"Great sleep",val:`${sleep.toFixed(1)}h`,color:V.accent,pts:25});}
    else if(sleep>=6.5){score+=18;factors.push({label:"Decent sleep",val:`${sleep.toFixed(1)}h`,color:V.warn,pts:18});}
    else if(sleep>=5){score+=8;factors.push({label:"Low sleep",val:`${sleep.toFixed(1)}h`,color:V.danger,pts:8});}
    else{score+=0;factors.push({label:"Poor sleep",val:`${sleep.toFixed(1)}h`,color:V.danger,pts:0});}
  }

  // 2. Recovery time (0-15 pts) — days since last workout
  if(lastW){
    const daysSince=Math.floor((new Date(td)-new Date(lastW.date))/(86400000));
    if(daysSince===0){score+=5;factors.push({label:"Trained today",val:"0d rest",color:V.text3,pts:5});}
    else if(daysSince===1){score+=12;factors.push({label:"1 day rest",val:"Fresh",color:V.accent,pts:12});}
    else if(daysSince===2){score+=15;factors.push({label:"2 days rest",val:"Recovered",color:V.accent,pts:15});}
    else if(daysSince<=4){score+=10;factors.push({label:`${daysSince}d rest`,val:"Rested",color:V.accent2,pts:10});}
    else{score+=5;factors.push({label:`${daysSince}d rest`,val:"Detraining",color:V.warn,pts:5});}
  }

  // 3. Last workout intensity (0-10 pts) — lower intensity = more recovery
  if(lastW){
    const avgRPE=lastW.exercises.reduce((sum,ex)=>{
      const rpes=ex.sets.filter(st=>st.rpe).map(st=>st.rpe);
      return sum+(rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:7);
    },0)/(lastW.exercises.length||1);
    if(avgRPE<=7){score+=10;factors.push({label:"Low last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.accent,pts:10});}
    else if(avgRPE<=8.5){score+=6;factors.push({label:"Moderate intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.warn,pts:6});}
    else{score+=2;factors.push({label:"High last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.danger,pts:2});}
  }

  // 4. Training volume trend (-10 to +10) — overreaching detection
  if(recentW.length>0&&prevWeekW.length>0){
    const thisVol=recentW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const lastVol=prevWeekW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const ratio=lastVol>0?thisVol/lastVol:1;
    if(ratio>1.3){score-=10;factors.push({label:"Volume spike",val:`+${Math.round((ratio-1)*100)}%`,color:V.danger,pts:-10});}
    else if(ratio>1.1){score-=3;factors.push({label:"Volume up",val:`+${Math.round((ratio-1)*100)}%`,color:V.warn,pts:-3});}
    else if(ratio>=0.8){score+=5;factors.push({label:"Steady volume",val:"Balanced",color:V.accent,pts:5});}
    else{score+=0;factors.push({label:"Low volume",val:`${Math.round((ratio-1)*100)}%`,color:V.text3,pts:0});}
  }

  // 5. Self-report from check-in (0-20 pts)
  if(checkin){
    const avg=(checkin.soreness+checkin.energy+checkin.motivation)/3;
    const pts=Math.round(avg*4); // 1-5 scale → 4-20 pts
    score+=pts;
    const labels=["","Rough","Fair","Okay","Good","Excellent"];
    factors.push({label:"Self-report",val:labels[Math.round(avg)]||"--",color:avg>=4?V.accent:avg>=3?V.warn:V.danger,pts});
  }

  // 6. Nutrition adherence (+5 bonus)
  if(tn&&s.goals){
    const protPct=tn.protein/s.goals.protein;
    if(protPct>=0.8){score+=5;factors.push({label:"Protein on track",val:`${Math.round(protPct*100)}%`,color:V.accent,pts:5});}
  }

  score=Math.max(0,Math.min(100,score));

  // Determine readiness level + recommendation
  let level,color,rec;
  if(score>=80){level="Peak";color=V.accent;rec="Full intensity. Push for PRs.";}
  else if(score>=60){level="Ready";color=V.accent2;rec="Normal training. Follow your program.";}
  else if(score>=40){level="Moderate";color=V.warn;rec="Reduce volume 15-20%. Focus on technique.";}
  else if(score>=25){level="Fatigued";color="#f97316";rec="Light session or active recovery.";}
  else{level="Rest";color=V.danger;rec="Take a rest day. Recovery is gains.";}

  return{score:Math.round(score),level,color,rec,factors,hasCheckin:!!checkin};
}


export { useStreak, usePRs, findLastSets, calcReadiness };
