import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, ReferenceDot } from 'recharts';
import { V } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Chip, Sheet, Stat, Progress } from '../components/ui';
import { today, ago, fmtShort, calc1RM, convW, wUnit, isCardio, chartCfg } from '../utils/helpers';
import { ShareCard } from '../utils/share';

export function getOverloadSuggestion(exerciseId, workouts, units){
  // Find last 3 sessions with this exercise
  const sessions=[];
  for(const w of workouts){
    const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
    if(ex&&ex.sets.some(s=>s.weight>0)){sessions.push({date:w.date,sets:ex.sets});if(sessions.length>=3)break;}
  }
  if(sessions.length===0)return null;

  const latest=sessions[0];
  const bestSet=latest.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
  const w=parseFloat(bestSet.weight)||0;
  const r=parseInt(bestSet.reps)||0;
  if(w===0)return null;

  const e1rm=Math.round(w*(1+r/30));
  const inc=units==="kg"?2.5:5;
  const targetReps=8;

  // Check if all sets hit target reps
  const allSetsHit=latest.sets.every(st=>parseInt(st.reps)>=targetReps);
  // Check for failure pattern (last 2-3 sessions struggling)
  const failCount=sessions.filter(sess=>{
    const bst=sess.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
    return parseInt(bst.reps)<targetReps-2;
  }).length;

  let type,sugWeight,sugReps,reason;
  if(failCount>=2){
    // Deload
    sugWeight=Math.max(inc,Math.round((w-inc*2)/inc)*inc);
    sugReps=targetReps;
    type="deload";
    reason="Struggling multiple sessions — deload to rebuild";
  }else if(allSetsHit){
    // Increase weight
    sugWeight=w+inc;
    sugReps=r;
    type="increase";
    reason="All sets completed — increase weight";
  }else if(r<targetReps-1){
    // Keep same, failed reps
    sugWeight=w;
    sugReps=targetReps;
    type="repeat";
    reason="Missed reps — repeat and aim higher";
  }else{
    // Keep same, almost there
    sugWeight=w;
    sugReps=r+1;
    type="reps";
    reason="Close to target — add a rep";
  }

  const zone80=Math.round(e1rm*0.80);
  const zone70=Math.round(e1rm*0.70);

  return{type,last:`${w}×${r}`,suggest:`${sugWeight}×${sugReps}`,e1rm,zone80,zone70,reason,
    allSets:latest.sets.map(st=>`${st.weight}×${st.reps}`).join("  "),date:sessions[0].date};
}

// ─── Muscle Heat Map Calculator ───
export function calcMuscleHeat(workouts,exercises,days=10){
  const now=new Date();
  const scores={};
  ALL_MUSCLES.forEach(m=>{scores[m]=0;});

  workouts.forEach(w=>{
    const daysAgo=Math.max(0,(now-new Date(w.date))/(1000*60*60*24));
    if(daysAgo>days)return;
    const decay=Math.max(0,1-daysAgo/days);

    w.exercises.forEach(ex=>{
      const map=MUSCLE_MAP[ex.exerciseId];
      if(!map)return;
      const setCount=ex.sets.length;
      const volume=ex.sets.reduce((s,st)=>(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)+s,0);
      const intensity=Math.min(1,volume/5000)+setCount*0.3;

      map.primary.forEach(m=>{scores[m]+=(intensity*3)*decay;});
      map.secondary.forEach(m=>{scores[m]+=(intensity*1.5)*decay;});
    });
  });

  // Normalize 0-10
  const mx=Math.max(...Object.values(scores),1);
  const norm={};
  ALL_MUSCLES.forEach(m=>{norm[m]=Math.min(10,Math.round(scores[m]/mx*10*10)/10);});
  return norm;
}

export function getMuscleColor(score){
  if(score<=0.5)return"rgba(255,255,255,0.06)";
  if(score<=3)return"rgba(250,204,21,0.4)";   // yellow
  if(score<=6)return"rgba(0,245,160,0.5)";     // green
  if(score<=8)return"rgba(0,245,160,0.8)";     // bright green
  return"rgba(255,107,107,0.7)";                // red (high fatigue)
}

export function getMuscleLabel(score){
  if(score<=0.5)return"Untrained";
  if(score<=3)return"Light";
  if(score<=6)return"Moderate";
  if(score<=8)return"Well Trained";
  return"High Volume";
}

// ─── Muscle Heat Map SVG Component ───
// ─── Volume Per Muscle Group ───
// ─── Exercise Progression Chart ───
export function ExerciseChart({s}){
  const [selEx,setSelEx]=useState(s.exercises[0]?.id||"bench");
  const data=useMemo(()=>{
    const pts=[];
    s.workouts.filter(w=>w.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(w=>{
      const ex=w.exercises.find(e=>e.exerciseId===selEx);
      if(ex){
        const best=ex.sets.reduce((m,st)=>parseFloat(st.weight)>m?parseFloat(st.weight):m,0);
        const topSet=ex.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
        const vol=ex.sets.reduce((a,st)=>(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)+a,0);
        if(best>0)pts.push({date:fmtShort(w.date),weight:best,reps:parseInt(topSet.reps)||0,
          e1rm:calc1RM(parseFloat(topSet.weight)||0,parseInt(topSet.reps)||0),vol,sets:ex.sets.length});
      }
    });
    return pts;
  },[selEx,s.workouts,s.range]);

  const exInfo=s.exercises.find(e=>e.id===selEx);
  const cats=["All",...new Set(s.exercises.map(e=>e.cat))];
  const [catF,setCatF]=useState("All");
  const filtered=catF==="All"?s.exercises:s.exercises.filter(e=>e.cat===catF);
  // Only exercises the user has actually logged
  const usedExIds=new Set();
  s.workouts.forEach(w=>w.exercises.forEach(e=>usedExIds.add(e.exerciseId)));
  const usedExercises=filtered.filter(e=>usedExIds.has(e.id));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Exercise Progression</div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {cats.map(c=><Chip key={c} label={c} active={catF===c} onClick={()=>setCatF(c)}/>)}
      </div>
      <select value={selEx} onChange={e=>setSelEx(e.target.value)}
        style={{padding:"10px 14px",background:V.bg,border:`1px solid ${V.cardBorder}`,borderRadius:10,
          color:V.text,fontSize:13,outline:"none",fontFamily:V.font}}>
        {usedExercises.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      {data.length>1?(
        <Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:8}}>{exInfo?.name} — Weight Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid {...chartCfg.grid} vertical={false}/>
              <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
              <YAxis {...chartCfg.axis} width={32}/>
              <Tooltip {...chartCfg.tip}/>
              <Line type="monotone" dataKey="weight" stroke={V.accent} strokeWidth={2} dot={{r:3,fill:V.accent}}/>
              <Line type="monotone" dataKey="e1rm" stroke={V.purple} strokeWidth={1.5} strokeDasharray="4 4" dot={false}/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:6}}>
            <span style={{fontSize:9,color:V.accent}}>■ Top Weight</span>
            <span style={{fontSize:9,color:V.purple}}>- - E1RM</span>
          </div>
        </Card>
      ):<Card style={{padding:20,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>Need 2+ sessions to chart</div></Card>}

      {data.length>0&&(
        <Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Session History</div>
          {data.slice().reverse().slice(0,10).map((d2,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:10}}>
              <span style={{color:V.text3}}>{d2.date}</span>
              <span style={{fontFamily:V.mono,color:V.accent}}>{d2.weight}×{d2.reps}</span>
              <span style={{fontFamily:V.mono,color:V.purple}}>E1RM:{d2.e1rm}</span>
              <span style={{color:V.text3}}>{d2.sets}s · {d2.vol>1000?`${(d2.vol/1000).toFixed(1)}k`:d2.vol}vol</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Workout Duration Trends ───
export function DurationTrends({s}){
  const data=useMemo(()=>{
    return s.workouts.filter(w=>w.date>=ago(s.range)&&w.dur>0).sort((a,b)=>a.date.localeCompare(b.date))
      .map(w=>({date:fmtShort(w.date),dur:w.dur,sets:w.exercises.reduce((a,e)=>a+e.sets.length,0),
        exercises:w.exercises.length}));
  },[s.workouts,s.range]);

  const avgDur=data.length?Math.round(data.reduce((a,d2)=>a+d2.dur,0)/data.length):0;
  const avgSets=data.length?Math.round(data.reduce((a,d2)=>a+d2.sets,0)/data.length):0;
  const longest=data.reduce((m,d2)=>d2.dur>m?d2.dur:m,0);
  const shortest=data.filter(d2=>d2.dur>0).reduce((m,d2)=>d2.dur<m?d2.dur:m,999);
  const trend=data.length>=2?data[data.length-1].dur-data[0].dur:0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Workout Duration</div>

      <Card style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
          <div><div style={{fontSize:18,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{avgDur}</div><div style={{fontSize:8,color:V.text3}}>AVG MIN</div></div>
          <div><div style={{fontSize:18,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{longest}</div><div style={{fontSize:8,color:V.text3}}>LONGEST</div></div>
          <div><div style={{fontSize:18,fontWeight:800,color:V.accent2,fontFamily:V.mono}}>{shortest<999?shortest:"—"}</div><div style={{fontSize:8,color:V.text3}}>SHORTEST</div></div>
          <div><div style={{fontSize:18,fontWeight:800,color:trend>0?V.warn:V.accent,fontFamily:V.mono}}>{trend>0?"+":""}{trend}</div><div style={{fontSize:8,color:V.text3}}>TREND</div></div>
        </div>
      </Card>

      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Sets per session: avg {avgSets}</div>
      </Card>

      {data.length>1?(
        <Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:8}}>Duration Over Time (min)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} barSize={10}>
              <CartesianGrid {...chartCfg.grid} vertical={false}/>
              <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
              <YAxis {...chartCfg.axis} width={28}/>
              <Tooltip {...chartCfg.tip}/>
              <ReferenceLine y={avgDur} stroke={V.accent} strokeDasharray="4 4" strokeOpacity={0.5}/>
              <Bar dataKey="dur" fill={V.purple} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{fontSize:9,color:V.text3,textAlign:"center",marginTop:4}}>Dashed line = average ({avgDur}min)</div>
        </Card>
      ):<Card style={{padding:20,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>Log workouts with duration to see trends</div></Card>}
    </div>
  );
}

export function VolumeTracker({s}){
  const data=useMemo(()=>{
    const weekWorkouts=s.workouts.filter(w=>w.date>=ago(7));
    const map={};
    // Map exercise categories to muscle groups
    const catToMuscle={Chest:"Chest",Back:"Back",Legs:"Legs",Shoulders:"Shoulders",Biceps:"Arms",Triceps:"Arms",
      Arms:"Arms",Core:"Core",Glutes:"Legs",Cardio:"Cardio"};
    weekWorkouts.forEach(w=>w.exercises.forEach(ex=>{
      const info=s.exercises.find(e=>e.id===ex.exerciseId);
      const muscle=catToMuscle[info?.cat]||info?.cat||"Other";
      if(!map[muscle])map[muscle]={sets:0,exercises:new Set(),workouts:new Set()};
      map[muscle].sets+=ex.sets.length;
      map[muscle].exercises.add(info?.name||ex.exerciseId);
      map[muscle].workouts.add(w.date);
    }));
    // Recommended ranges (weekly sets)
    const recs={Chest:{min:10,max:20},Back:{min:10,max:20},Legs:{min:10,max:20},Shoulders:{min:8,max:16},
      Arms:{min:8,max:16},Core:{min:6,max:12},Cardio:{min:2,max:5}};
    return Object.entries(map).map(([muscle,d])=>{
      const rec=recs[muscle]||{min:8,max:16};
      const status=d.sets<rec.min?"low":d.sets>rec.max?"high":"good";
      return{muscle,sets:d.sets,exercises:d.exercises.size,workouts:d.workouts.size,rec,status};
    }).sort((a,b)=>b.sets-a.sets);
  },[s.workouts,s.exercises]);

  const totalSets=data.reduce((a,d)=>a+d.sets,0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Weekly Volume</div>
      <div style={{fontSize:10,color:V.text3}}>Sets per muscle group this week · recommended ranges shown</div>

      <Card style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
          <div><div style={{fontSize:20,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{totalSets}</div><div style={{fontSize:9,color:V.text3}}>TOTAL SETS</div></div>
          <div><div style={{fontSize:20,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{data.length}</div><div style={{fontSize:9,color:V.text3}}>MUSCLES HIT</div></div>
          <div><div style={{fontSize:20,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{data.filter(d=>d.status==="low").length}</div><div style={{fontSize:9,color:V.text3}}>BELOW MIN</div></div>
        </div>
      </Card>

      {data.map((d,i)=>(
        <Card key={i} style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:V.text}}>{d.muscle}</div>
              <div style={{fontSize:9,color:V.text3}}>{d.exercises} exercises · {d.workouts} sessions</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:18,fontWeight:800,color:d.status==="good"?V.accent:d.status==="low"?V.danger:V.warn,fontFamily:V.mono}}>{d.sets}</div>
              <div style={{fontSize:8,color:V.text3}}>{d.rec.min}-{d.rec.max} rec</div>
            </div>
          </div>
          <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
            <div style={{height:"100%",borderRadius:2,transition:"width .3s",
              background:d.status==="good"?V.accent:d.status==="low"?V.danger:V.warn,
              width:`${Math.min(100,d.sets/d.rec.max*100)}%`}}/>
          </div>
          {d.status==="low"&&<div style={{fontSize:9,color:V.danger,marginTop:4}}>⚠️ Below minimum — add {d.rec.min-d.sets} more sets</div>}
          {d.status==="high"&&<div style={{fontSize:9,color:V.warn,marginTop:4}}>📈 Above recommended — watch for overtraining</div>}
          {d.status==="good"&&<div style={{fontSize:9,color:V.accent,marginTop:4}}>✅ In optimal range</div>}
        </Card>
      ))}
      {data.length===0&&<Card style={{padding:20,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>Log workouts this week to see volume breakdown</div></Card>}
    </div>
  );
}

export function MuscleHeatMap({s}){
  const heat=useMemo(()=>calcMuscleHeat(s.workouts,s.exercises),[s.workouts,s.exercises]);
  const [sel,setSel]=useState(null);
  const [view,setView]=useState("front");
  const [mode,setMode]=useState("activity");

  const muscleIdMap={
    chest_left:"chest",chest_right:"chest",
    front_delt_left:"front_delts",front_delt_right:"front_delts",
    biceps_left:"biceps",biceps_right:"biceps",
    core:"core",obliques_left:"core",obliques_right:"core",
    quads_left:"quads",quads_right:"quads",
    vmo_left:"quads",vmo_right:"quads",
    calves_left:"calves",calves_right:"calves",
    traps_front:"traps",
    traps_back:"traps",
    rear_delt_left:"rear_delts",rear_delt_right:"rear_delts",
    lats_left:"back",lats_right:"back",upper_back:"back",
    triceps_left:"triceps",triceps_right:"triceps",
    glutes_left:"glutes",glutes_right:"glutes",
    hamstrings_left:"hamstrings",hamstrings_right:"hamstrings",
    calves_back_left:"calves",calves_back_right:"calves",
  };

  const getScore=(id)=>heat[muscleIdMap[id]||id]||0;
  const getMuscleId=(svgId)=>muscleIdMap[svgId]||svgId;

  const heatColor=(score)=>{
    if(mode==="recovery"){
      if(score<=0)return"rgba(255,255,255,0.04)";
      if(score<=3)return"rgba(255,70,70,0.55)";
      if(score<=6)return"rgba(255,160,50,0.5)";
      return"rgba(0,245,160,0.45)";
    }
    if(score<=0)return"rgba(255,255,255,0.04)";
    if(score<=2)return"rgba(250,204,21,0.22)";
    if(score<=4)return"rgba(250,204,21,0.44)";
    if(score<=6)return"rgba(0,245,160,0.42)";
    if(score<=8)return"rgba(0,245,160,0.65)";
    return"rgba(255,80,80,0.68)";
  };

  const glowFilter=(score)=>{
    if(score<=1)return"none";
    const c=score>7?"rgba(255,80,80,0.5)":score>4?"rgba(0,245,160,0.35)":"rgba(250,204,21,0.28)";
    return`drop-shadow(0 0 ${Math.min(score*1.6,13)}px ${c})`;
  };

  const M=({id,d})=>{
    const score=getScore(id);
    const muscleId=getMuscleId(id);
    const selected=sel===muscleId;
    return(
      <path d={d} fill={heatColor(score)}
        stroke={selected?"#00f5a0":"rgba(255,255,255,0.09)"} strokeWidth={selected?2:0.7}
        style={{cursor:"pointer",transition:"fill .28s,filter .2s",filter:glowFilter(score)}}
        onClick={()=>setSel(sel===muscleId?null:muscleId)}/>
    );
  };

  const selDetail=useMemo(()=>{
    if(!sel)return null;
    const score=(heat[sel]||0).toFixed(1);
    const exIds=Object.entries(MUSCLE_MAP).filter(([eid,m])=>m.primary?.includes(sel)||m.secondary?.includes(sel)).map(([eid])=>eid);
    const recentW=s.workouts.slice(0,14);
    const exercises=[];let lastDate=null;
    recentW.forEach(w=>{
      w.exercises.forEach(ex=>{
        if(exIds.includes(ex.exerciseId)){
          const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
          const existing=exercises.find(e=>e.name===name);
          if(existing)existing.sets+=ex.sets.length;
          else exercises.push({name,sets:ex.sets.length});
          if(!lastDate||w.date>lastDate)lastDate=w.date;
        }
      });
    });
    const daysSince=lastDate?Math.floor((new Date()-new Date(lastDate+"T12:00:00"))/86400000):null;
    return{score,exercises:exercises.sort((a,b)=>b.sets-a.sets).slice(0,5),lastDate,daysSince};
  },[sel,heat,s.workouts,s.exercises]);

  const imbalances=useMemo(()=>{
    const msgs=[];
    const pairs=[["quads","hamstrings","Quad-to-hamstring"],["chest","back","Chest-to-back"],["biceps","triceps","Bicep-to-tricep"],["front_delts","rear_delts","Front-to-rear delt"]];
    pairs.forEach(([a,b,label])=>{
      if(heat[a]>0&&heat[b]<=0.5)msgs.push({msg:`${MUSCLE_LABELS[a]} trained but ${MUSCLE_LABELS[b]} neglected`,fix:b});
      else if(heat[a]>heat[b]*2.5&&heat[b]>0)msgs.push({msg:`${label} imbalance`,fix:b});
    });
    if(heat.calves<=0.5&&heat.quads>3)msgs.push({msg:"Calves untrained — add calf raises",fix:"calves"});
    if(heat.core<=0.5&&s.workouts.length>3)msgs.push({msg:"Core neglected — add ab work",fix:"core"});
    return msgs;
  },[heat,s.workouts.length]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Muscle Map</div>
          <div style={{fontSize:10,color:V.text3}}>Last 10 days · Tap a muscle for details</div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {["activity","recovery"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{padding:"5px 10px",borderRadius:6,
              border:`1.5px solid ${mode===m?V.accent:V.cardBorder}`,
              background:mode===m?`${V.accent}10`:"transparent",
              cursor:"pointer",fontSize:9,fontWeight:700,color:mode===m?V.accent:V.text3,
              fontFamily:V.font,textTransform:"capitalize"}}>{m}</button>
          ))}
        </div>
      </div>

      <Card style={{padding:16,background:"#05080b"}}>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:12}}>
          {["front","back"].map(v=>(
            <button key={v} onClick={()=>{setView(v);setSel(null);}} style={{padding:"6px 20px",borderRadius:8,
              border:`1.5px solid ${view===v?V.accent:V.cardBorder}`,
              background:view===v?`${V.accent}10`:"rgba(255,255,255,0.02)",
              cursor:"pointer",fontSize:11,fontWeight:700,color:view===v?V.accent:V.text3,
              fontFamily:V.font,textTransform:"uppercase"}}>{v}</button>
          ))}
        </div>

        <svg viewBox="130 -10 160 540" style={{width:"100%",maxWidth:280,margin:"0 auto",display:"block"}}>
          <defs>
            <linearGradient id="bodyFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0a1018"/>
              <stop offset="48%" stopColor="#0d1520"/>
              <stop offset="100%" stopColor="#0a1018"/>
            </linearGradient>
            <linearGradient id="bodyFillB" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#09111a"/>
              <stop offset="50%" stopColor="#0c1420"/>
              <stop offset="100%" stopColor="#09111a"/>
            </linearGradient>
          </defs>

          {/* ─── BODY BASE SILHOUETTE ─── */}
          <path d="M210,8 C221,8 231,14 233,27 C235,40 231,52 225,60 L223,70
            C239,76 257,87 267,102 C277,118 279,136 277,155 C275,169 271,183 271,197
            C273,209 273,221 269,234 L265,253
            C261,269 261,287 263,308 L261,328
            C257,313 249,307 241,309 C235,313 233,325 233,341
            C237,365 245,389 253,413 C259,431 263,451 259,471
            C253,495 239,509 225,515 C218,518 210,518 210,518
            C210,518 202,518 195,515 C181,509 167,495 161,471
            C157,451 161,431 167,413 C175,389 183,365 187,341
            C187,325 185,313 179,309 C171,307 163,313 159,328
            L157,308 C159,287 159,269 155,253 L151,234
            C147,221 147,209 149,197 C149,183 145,169 143,155
            C141,136 143,118 153,102 C163,87 181,76 197,70
            L195,60 C189,52 185,40 187,27 C189,14 199,8 210,8 Z"
            fill="url(#bodyFill)" stroke="#182433" strokeWidth="1.3"/>

          {/* Head */}
          <ellipse cx="210" cy="29" rx="21" ry="25" fill="#0d1624" stroke="#182433" strokeWidth="1.1"/>
          {/* Ear hints */}
          <path d="M189,26 C186,22 185,30 185,34 C185,38 186,42 189,40" fill="#0d1624" stroke="#182433" strokeWidth="0.9"/>
          <path d="M231,26 C234,22 235,30 235,34 C235,38 234,42 231,40" fill="#0d1624" stroke="#182433" strokeWidth="0.9"/>
          {/* Neck */}
          <rect x="200" y="55" width="20" height="17" rx="5" fill="#0d1624" stroke="#182433" strokeWidth="0.9"/>

          {/* ─── STRUCTURAL ANATOMY LINES ─── */}
          {/* Clavicles */}
          <path d="M210,73 C201,71 188,68 175,76" fill="none" stroke="#1e3248" strokeWidth="1.3" opacity="0.7"/>
          <path d="M210,73 C219,71 232,68 245,76" fill="none" stroke="#1e3248" strokeWidth="1.3" opacity="0.7"/>
          {/* Sternum line */}
          <line x1="210" y1="74" x2="210" y2="254" stroke="#182433" strokeWidth="0.5" opacity="0.45"/>
          {/* Linea alba / abs horizontal inscriptions */}
          <path d="M202,159 C205,157 208,157 210,157 C212,157 215,157 218,159" fill="none" stroke="#182433" strokeWidth="0.7" opacity="0.4"/>
          <path d="M201,175 C204,173 207,173 210,173 C213,173 216,173 219,175" fill="none" stroke="#182433" strokeWidth="0.7" opacity="0.4"/>
          <path d="M200,191 C203,189 207,189 210,189 C213,189 217,189 220,191" fill="none" stroke="#182433" strokeWidth="0.7" opacity="0.4"/>
          <path d="M200,207 C203,205 207,205 210,205 C213,205 217,205 220,207" fill="none" stroke="#182433" strokeWidth="0.7" opacity="0.4"/>
          {/* Navel */}
          <ellipse cx="210" cy="220" rx="3" ry="2.5" fill="none" stroke="#1e3248" strokeWidth="0.9" opacity="0.6"/>
          {/* Iliac crest hints */}
          <path d="M185,241 C181,238 177,236 172,238" fill="none" stroke="#182433" strokeWidth="0.9" opacity="0.4"/>
          <path d="M235,241 C239,238 243,236 248,238" fill="none" stroke="#182433" strokeWidth="0.9" opacity="0.4"/>
          {/* Quad separation line hints */}
          {view==="front"&&<>
            <path d="M191,292 C192,310 192,332 192,354 C193,364 195,372 196,376" fill="none" stroke="#182433" strokeWidth="0.5" opacity="0.3"/>
            <path d="M229,292 C228,310 228,332 228,354 C227,364 225,372 224,376" fill="none" stroke="#182433" strokeWidth="0.5" opacity="0.3"/>
            {/* Patella (kneecap) */}
            <ellipse cx="192" cy="370" rx="10" ry="8" fill="#0d1624" stroke="#1e3248" strokeWidth="0.9" opacity="0.6"/>
            <ellipse cx="228" cy="370" rx="10" ry="8" fill="#0d1624" stroke="#1e3248" strokeWidth="0.9" opacity="0.6"/>
            {/* Shin detail */}
            <path d="M192,382 C191,400 191,424 192,448" fill="none" stroke="#182433" strokeWidth="0.5" opacity="0.25"/>
            <path d="M228,382 C229,400 229,424 228,448" fill="none" stroke="#182433" strokeWidth="0.5" opacity="0.25"/>
          </>}
          {view==="back"&&<>
            {/* Scapula outlines */}
            <path d="M180,100 C174,112 172,128 176,142 C180,154 188,158 196,156 C202,154 206,146 206,136 C206,124 202,112 196,104 Z"
              fill="none" stroke="#1e3248" strokeWidth="0.9" opacity="0.5"/>
            <path d="M240,100 C246,112 248,128 244,142 C240,154 232,158 224,156 C218,154 214,146 214,136 C214,124 218,112 224,104 Z"
              fill="none" stroke="#1e3248" strokeWidth="0.9" opacity="0.5"/>
            {/* Spine of scapula */}
            <path d="M180,110 C190,106 200,106 206,110" fill="none" stroke="#1e3248" strokeWidth="0.7" opacity="0.4"/>
            <path d="M240,110 C230,106 220,106 214,110" fill="none" stroke="#1e3248" strokeWidth="0.7" opacity="0.4"/>
            {/* Vertebral column hint */}
            <path d="M210,72 L210,256" fill="none" stroke="#182433" strokeWidth="1" opacity="0.3" strokeDasharray="3,3"/>
            {/* Lumbar region detail */}
            <path d="M206,188 C205,196 205,208 205,220 C205,232 206,242 208,252
                     M214,188 C215,196 215,208 215,220 C215,232 214,242 212,252"
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" strokeLinecap="round"/>
            {/* Knee posterior detail */}
            <ellipse cx="192" cy="370" rx="8" ry="6" fill="none" stroke="#1e3248" strokeWidth="0.8" opacity="0.4"/>
            <ellipse cx="228" cy="370" rx="8" ry="6" fill="none" stroke="#1e3248" strokeWidth="0.8" opacity="0.4"/>
          </>}

          {view==="front"?(
            <g>
              {/* ── UPPER TRAPS (front) — sweep from neck out to acromions like epaulettes ── */}
              <M id="traps_front" d="
                M210,70
                C199,67 183,66 167,72 C153,78 145,90 147,103
                C149,113 159,119 172,115 C185,111 199,97 210,83
                C221,97 235,111 248,115 C261,119 271,113 273,103
                C275,90 267,78 253,72 C237,66 221,67 210,70 Z"/>

              {/* ── ANTERIOR DELTOID LEFT — rounded oval front of shoulder ── */}
              <M id="front_delt_left" d="
                M153,82
                C143,87 135,99 135,115 C135,131 143,143 153,149
                C163,155 173,151 177,139 C181,127 179,112 171,101
                C165,92 159,80 153,82 Z"/>

              {/* ── ANTERIOR DELTOID RIGHT ── */}
              <M id="front_delt_right" d="
                M267,82
                C277,87 285,99 285,115 C285,131 277,143 267,149
                C257,155 247,151 243,139 C239,127 241,112 249,101
                C255,92 261,80 267,82 Z"/>

              {/* ── PECTORALIS MAJOR LEFT — fan from sternum/clavicle to axilla ── */}
              <M id="chest_left" d="
                M208,82
                C196,78 177,80 163,89 C149,98 143,112 145,128
                C147,143 157,153 170,157 C182,161 194,155 202,143
                C210,130 210,113 206,99 C204,89 208,84 208,82 Z"/>

              {/* ── PECTORALIS MAJOR RIGHT ── */}
              <M id="chest_right" d="
                M212,82
                C224,78 243,80 257,89 C271,98 277,112 275,128
                C273,143 263,153 250,157 C238,161 226,155 218,143
                C210,130 210,113 214,99 C216,89 212,84 212,82 Z"/>

              {/* ── SERRATUS ANTERIOR LEFT — digitations on lateral ribs ── */}
              <path d="M169,150 C165,154 161,160 163,168 C161,172 155,178 157,184
                C159,188 165,188 169,184 C173,178 173,172 177,166 C179,160 179,154 175,150 Z"
                fill={heatColor(getScore("chest_left"))} stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="chest"?null:"chest")}/>
              {/* Second digitation */}
              <path d="M165,166 C161,170 159,176 161,182 C163,186 167,186 169,182 C171,178 171,172 169,168 Z"
                fill={heatColor(getScore("chest_left"))} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="chest"?null:"chest")}/>

              {/* ── SERRATUS ANTERIOR RIGHT ── */}
              <path d="M251,150 C255,154 259,160 257,168 C259,172 265,178 263,184
                C261,188 255,188 251,184 C247,178 247,172 243,166 C241,160 241,154 245,150 Z"
                fill={heatColor(getScore("chest_right"))} stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="chest"?null:"chest")}/>
              <path d="M255,166 C259,170 261,176 259,182 C257,186 253,186 251,182 C249,178 249,172 251,168 Z"
                fill={heatColor(getScore("chest_right"))} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="chest"?null:"chest")}/>

              {/* ── BICEPS BRACHII LEFT — classic teardrop fusiform shape ── */}
              <M id="biceps_left" d="
                M157,112
                C147,108 137,117 135,134 C133,150 135,168 141,182
                C145,194 153,202 161,200 C169,198 175,188 175,172
                C175,156 171,138 165,124 C161,114 159,112 157,112 Z"/>

              {/* ── BICEPS BRACHII RIGHT ── */}
              <M id="biceps_right" d="
                M263,112
                C273,108 283,117 285,134 C287,150 285,168 279,182
                C275,194 267,202 259,200 C251,198 245,188 245,172
                C245,156 249,138 255,124 C259,114 261,112 263,112 Z"/>

              {/* ── RECTUS ABDOMINIS (core) — segmented 6-pack column ── */}
              <M id="core" d="
                M203,150
                C201,146 201,142 205,140 L215,140
                C219,142 219,146 217,150
                L217,238 C215,250 212,256 210,258
                C208,256 205,250 203,238 Z"/>

              {/* Tendinous inscription lines (decorative over core) */}
              {[159,175,191,207].map((y,i)=>(
                <path key={i} d={`M204,${y} C207,${y-2} 210,${y-2} 210,${y-2} C210,${y-2} 213,${y-2} 216,${y}`}
                  fill="none" stroke="#060a0d" strokeWidth="1.2" opacity="0.6" style={{pointerEvents:"none"}}/>
              ))}

              {/* ── EXTERNAL OBLIQUE LEFT — diagonal sweep ribs→hip ── */}
              <M id="obliques_left" d="
                M201,152
                C191,157 179,169 171,185 C163,201 161,219 165,235
                C169,249 179,257 191,257 C201,257 209,249 211,237
                C211,221 209,203 205,187 C201,171 201,155 201,152 Z"/>

              {/* ── EXTERNAL OBLIQUE RIGHT ── */}
              <M id="obliques_right" d="
                M219,152
                C229,157 241,169 249,185 C257,201 259,219 255,235
                C251,249 241,257 229,257 C219,257 211,249 211,237
                C211,221 213,203 215,187 C219,171 219,155 219,152 Z"/>

              {/* ── VASTUS LATERALIS LEFT — large outer quad head ── */}
              <M id="quads_left" d="
                M181,264
                C172,260 163,266 159,280 C155,296 157,318 161,340
                C165,360 173,376 184,384 C192,390 200,386 204,376
                C208,362 207,342 203,322 C197,300 189,278 184,267
                C182,262 182,263 181,264 Z"/>

              {/* ── RECTUS FEMORIS LEFT — central quad, runs straight down ── */}
              <M id="quads_left" d="
                M205,270
                C201,263 195,261 191,267 C187,274 187,288 189,306
                C191,324 195,344 199,358 C201,366 205,370 209,369
                C213,366 215,358 214,346 C213,330 209,310 207,292
                C205,280 205,272 205,270 Z"/>

              {/* ── VASTUS MEDIALIS (VMO) LEFT — teardrop near knee ── */}
              <M id="vmo_left" d="
                M213,320
                C209,310 207,300 209,292 C211,284 215,282 219,286
                C223,290 225,302 225,316 C225,330 221,346 217,358
                C215,364 211,368 209,368 C207,364 207,356 209,344
                C211,334 213,328 213,320 Z"/>

              {/* ── VASTUS LATERALIS RIGHT ── */}
              <M id="quads_right" d="
                M239,264
                C248,260 257,266 261,280 C265,296 263,318 259,340
                C255,360 247,376 236,384 C228,390 220,386 216,376
                C212,362 213,342 217,322 C223,300 231,278 236,267
                C238,262 238,263 239,264 Z"/>

              {/* ── RECTUS FEMORIS RIGHT ── */}
              <M id="quads_right" d="
                M215,270
                C219,263 225,261 229,267 C233,274 233,288 231,306
                C229,324 225,344 221,358 C219,366 215,370 211,369
                C207,366 205,358 206,346 C207,330 211,310 213,292
                C215,280 215,272 215,270 Z"/>

              {/* ── VASTUS MEDIALIS (VMO) RIGHT ── */}
              <M id="vmo_right" d="
                M207,320
                C211,310 213,300 211,292 C209,284 205,282 201,286
                C197,290 195,302 195,316 C195,330 199,346 203,358
                C205,364 209,368 211,368 C213,364 213,356 211,344
                C209,334 207,328 207,320 Z"/>

              {/* ── TIBIALIS ANTERIOR LEFT — runs along shin ── */}
              <M id="calves_left" d="
                M184,386
                C176,392 172,406 172,422 C172,438 176,452 184,460
                C190,466 197,464 201,456 C205,444 205,428 201,414
                C197,400 191,386 184,386 Z"/>

              {/* ── TIBIALIS ANTERIOR RIGHT ── */}
              <M id="calves_right" d="
                M236,386
                C244,392 248,406 248,422 C248,438 244,452 236,460
                C230,466 223,464 219,456 C215,444 215,428 219,414
                C223,400 229,386 236,386 Z"/>

              {/* Medial gastrocnemius hint (visible from front) */}
              <path d="M196,444 C194,438 192,430 192,422 C192,414 194,408 196,406"
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M224,444 C226,438 228,430 228,422 C228,414 226,408 224,406"
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" strokeLinecap="round"/>

              {/* Forearm muscles (not heat-mapped, structural only) */}
              <path d="M143,200 C140,214 138,228 138,244 C138,260 140,274 143,285"
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" strokeLinecap="round"/>
              <path d="M277,200 C280,214 282,228 282,244 C282,260 280,274 277,285"
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" strokeLinecap="round"/>

              {/* Brachialis peek (just lateral to bicep) */}
              <path d="M133,152 C130,162 130,174 132,184 C134,190 138,194 142,192"
                fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" strokeLinecap="round"/>
              <path d="M287,152 C290,162 290,174 288,184 C286,190 282,194 278,192"
                fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" strokeLinecap="round"/>
            </g>
          ):(
            <g>
              {/* ─── BACK VIEW ─── */}

              {/* ── FULL TRAPEZIUS — large diamond, all 3 portions ── */}
              <M id="traps_back" d="
                M210,66
                C196,66 178,70 160,78 C144,86 136,98 138,112
                C140,124 152,132 166,132 C180,132 196,122 210,114
                C224,122 240,132 254,132 C268,132 280,124 282,112
                C284,98 276,86 260,78 C242,70 224,66 210,66
                M210,114 C204,126 200,140 202,156
                C204,168 207,178 210,182 C213,178 216,168 218,156
                C220,140 216,126 210,114 Z"/>

              {/* ── POSTERIOR DELTOID LEFT ── */}
              <M id="rear_delt_left" d="
                M151,84
                C141,89 133,101 133,117 C133,133 141,145 151,151
                C161,157 171,153 175,141 C179,127 177,112 169,102
                C163,92 157,82 151,84 Z"/>

              {/* ── POSTERIOR DELTOID RIGHT ── */}
              <M id="rear_delt_right" d="
                M269,84
                C279,89 287,101 287,117 C287,133 279,145 269,151
                C259,157 249,153 245,141 C241,127 243,112 251,102
                C257,92 263,82 269,84 Z"/>

              {/* ── INFRASPINATUS + TERES MINOR LEFT (scapula muscles) ── */}
              <path d="M183,110 C173,116 165,130 167,146 C169,160 179,166 191,164
                C201,162 207,152 207,140 C207,128 201,116 191,110
                C189,108 186,108 183,110 Z"
                fill={heatColor(getScore("rear_delt_left")*0.4)} stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="rear_delts"?null:"rear_delts")}/>

              {/* ── INFRASPINATUS + TERES RIGHT ── */}
              <path d="M237,110 C247,116 255,130 253,146 C251,160 241,166 229,164
                C219,162 213,152 213,140 C213,128 219,116 229,110
                C231,108 234,108 237,110 Z"
                fill={heatColor(getScore("rear_delt_right")*0.4)} stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="rear_delts"?null:"rear_delts")}/>

              {/* ── LATISSIMUS DORSI LEFT — huge fan from axilla to iliac crest ── */}
              <M id="lats_left" d="
                M188,108
                C176,114 162,128 154,146 C146,164 144,186 146,208
                C148,228 158,246 170,254 C180,260 192,258 198,246
                C204,232 204,212 202,192 C200,168 194,144 190,122
                C188,114 188,108 188,108 Z"/>

              {/* ── LATISSIMUS DORSI RIGHT ── */}
              <M id="lats_right" d="
                M232,108
                C244,114 258,128 266,146 C274,164 276,186 274,208
                C272,228 262,246 250,254 C240,260 228,258 222,246
                C216,232 216,212 218,192 C220,168 226,144 230,122
                C232,114 232,108 232,108 Z"/>

              {/* ── RHOMBOIDS + MIDDLE TRAP (upper_back) ── */}
              <M id="upper_back" d="
                M198,106
                C196,102 200,98 210,98 C220,98 224,102 222,106
                L222,182 C220,194 215,200 210,202
                C205,200 200,194 198,182 Z"/>

              {/* ── ERECTOR SPINAE (lower back columns) ── */}
              <path d="M204,192 C202,202 202,216 202,230 C202,244 204,254 206,258"
                fill="none" stroke={heatColor(getScore("upper_back"))} strokeWidth="6"
                strokeLinecap="round" style={{cursor:"pointer"}} onClick={()=>setSel(sel==="back"?null:"back")}/>
              <path d="M216,192 C218,202 218,216 218,230 C218,244 216,254 214,258"
                fill="none" stroke={heatColor(getScore("upper_back"))} strokeWidth="6"
                strokeLinecap="round" style={{cursor:"pointer"}} onClick={()=>setSel(sel==="back"?null:"back")}/>

              {/* ── TRICEPS LEFT — horseshoe posterior upper arm ── */}
              <M id="triceps_left" d="
                M157,100
                C147,107 137,122 135,140 C133,158 137,176 145,188
                C151,198 161,204 169,202 C177,200 181,190 179,174
                C177,156 171,136 165,118 C161,106 159,98 157,100 Z"/>

              {/* ── TRICEPS RIGHT ── */}
              <M id="triceps_right" d="
                M263,100
                C273,107 283,122 285,140 C287,158 283,176 275,188
                C269,198 259,204 251,202 C243,200 239,190 241,174
                C243,156 249,136 255,118 C259,106 261,98 263,100 Z"/>

              {/* ── GLUTEUS MEDIUS LEFT (partially above max) ── */}
              <path d="M172,250 C162,254 156,266 158,280 C160,292 170,300 182,298
                C192,296 198,286 196,274 C194,262 184,248 172,250 Z"
                fill={heatColor(getScore("glutes_left")*0.6)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.7"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="glutes"?null:"glutes")}/>

              {/* ── GLUTEUS MEDIUS RIGHT ── */}
              <path d="M248,250 C258,254 264,266 262,280 C260,292 250,300 238,298
                C228,296 222,286 224,274 C226,262 236,248 248,250 Z"
                fill={heatColor(getScore("glutes_right")*0.6)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.7"
                style={{cursor:"pointer"}} onClick={()=>setSel(sel==="glutes"?null:"glutes")}/>

              {/* ── GLUTEUS MAXIMUS LEFT — large rounded mass ── */}
              <M id="glutes_left" d="
                M175,260
                C165,265 157,278 155,294 C153,312 159,330 171,342
                C181,352 193,354 201,346 C209,336 209,320 205,302
                C201,284 191,266 180,258 C178,256 176,258 175,260 Z"/>

              {/* ── GLUTEUS MAXIMUS RIGHT ── */}
              <M id="glutes_right" d="
                M245,260
                C255,265 263,278 265,294 C267,312 261,330 249,342
                C239,352 227,354 219,346 C211,336 211,320 215,302
                C219,284 229,266 240,258 C242,256 244,258 245,260 Z"/>

              {/* ── HAMSTRINGS LEFT (biceps femoris + semi) ── */}
              <M id="hamstrings_left" d="
                M172,268
                C162,275 154,290 156,310 C158,330 166,352 178,366
                C186,376 196,380 202,374 C208,366 208,350 204,330
                C200,310 192,288 182,272 C176,262 174,264 172,268 Z"/>

              {/* ── HAMSTRINGS RIGHT ── */}
              <M id="hamstrings_right" d="
                M248,268
                C258,275 266,290 264,310 C262,330 254,352 242,366
                C234,376 224,380 218,374 C212,366 212,350 216,330
                C220,310 228,288 238,272 C244,262 246,264 248,268 Z"/>

              {/* ── GASTROCNEMIUS LEFT — classic diamond/heart calf shape ── */}
              {/* Medial head */}
              <M id="calves_back_left" d="
                M182,386
                C172,392 166,408 168,426 C170,444 180,460 192,464
                C198,466 204,462 208,452 C212,440 208,422 202,410
                C196,400 190,386 184,387
                C183,386 182,386 182,386 Z"/>

              {/* Lateral head */}
              <M id="calves_back_left" d="
                M196,388
                C190,392 186,400 186,412 C186,426 190,440 196,448
                C200,454 206,452 208,444 C210,434 208,420 204,410
                C201,402 198,390 196,388 Z"/>

              {/* ── GASTROCNEMIUS RIGHT ── */}
              <M id="calves_back_right" d="
                M238,386
                C248,392 254,408 252,426 C250,444 240,460 228,464
                C222,466 216,462 212,452 C208,440 212,422 218,410
                C224,400 230,386 236,387
                C237,386 238,386 238,386 Z"/>

              <M id="calves_back_right" d="
                M224,388
                C230,392 234,400 234,412 C234,426 230,440 224,448
                C220,454 214,452 212,444 C210,434 212,420 216,410
                C219,402 222,390 224,388 Z"/>

              {/* Soleus (below gastroc) Left */}
              <path d="M176,452 C170,462 170,474 176,480 C182,484 192,482 198,474 C202,466 202,456 198,450"
                fill="rgba(255,255,255,0.025)" stroke="#182433" strokeWidth="0.7"/>

              {/* Soleus Right */}
              <path d="M244,452 C250,462 250,474 244,480 C238,484 228,482 222,474 C218,466 218,456 222,450"
                fill="rgba(255,255,255,0.025)" stroke="#182433" strokeWidth="0.7"/>

              {/* Forearm extensors (back of forearm, structural) */}
              <path d="M137,200 C134,216 132,232 132,248 C132,264 134,278 137,288"
                fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="6" strokeLinecap="round"/>
              <path d="M283,200 C286,216 288,232 288,248 C288,264 286,278 283,288"
                fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="6" strokeLinecap="round"/>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:10}}>
          {(mode==="activity"?
            [{l:"None",c:"rgba(255,255,255,0.06)"},{l:"Light",c:"rgba(250,204,21,0.4)"},{l:"Moderate",c:"rgba(0,245,160,0.5)"},{l:"High",c:"rgba(255,80,80,0.65)"}]
            :[{l:"Recovered",c:"rgba(0,245,160,0.45)"},{l:"Recovering",c:"rgba(255,160,50,0.5)"},{l:"Fatigued",c:"rgba(255,70,70,0.55)"}]
          ).map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:3,background:x.c}}/>
              <span style={{fontSize:9,color:V.text3}}>{x.l}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Selected muscle detail */}
      {sel&&selDetail&&(
        <Card glow style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:15,fontWeight:800,color:V.text}}>{MUSCLE_LABELS[sel]}</div>
            <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",
              padding:4,fontSize:12,color:V.text3}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:18,fontWeight:800,color:parseFloat(selDetail.score)>7?V.danger:parseFloat(selDetail.score)>4?V.accent:V.warn,fontFamily:V.mono}}>{selDetail.score}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>WORKLOAD</div>
            </div>
            <div style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:14,fontWeight:800,color:V.accent2,fontFamily:V.mono}}>{selDetail.daysSince!==null?`${selDetail.daysSince}d`:"—"}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>LAST HIT</div>
            </div>
            <div style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:14,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{selDetail.exercises.length}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>EXERCISES</div>
            </div>
          </div>
          {selDetail.exercises.length>0?(
            <div>
              <div style={{fontSize:10,color:V.text3,fontWeight:600,marginBottom:4}}>Recent Exercises</div>
              {selDetail.exercises.map((ex,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",
                  borderBottom:i<selDetail.exercises.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                  <span style={{fontSize:12,color:V.text}}>{ex.name}</span>
                  <span style={{fontSize:11,color:V.accent,fontFamily:V.mono}}>{ex.sets} sets</span>
                </div>
              ))}
            </div>
          ):(
            <div style={{fontSize:11,color:V.text3,textAlign:"center",padding:8}}>No recent exercises for this muscle</div>
          )}
        </Card>
      )}

      {/* Ranked muscle list */}
      <Card style={{padding:12}}>
        <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Muscle Rankings</span>
        {ALL_MUSCLES.sort((a,b)=>(heat[b]||0)-(heat[a]||0)).map((m,i)=>{
          const score=heat[m]||0;
          return(
            <div key={m} onClick={()=>setSel(sel===m?null:m)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",
              background:sel===m?`${V.accent}08`:"transparent",borderRadius:6,cursor:"pointer",
              borderBottom:i<ALL_MUSCLES.length-1?`1px solid rgba(255,255,255,0.02)`:"none"}}>
              <div style={{width:24,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden",flexShrink:0}}>
                <div style={{width:`${Math.min(score/10*100,100)}%`,height:"100%",borderRadius:2,
                  background:score>7?V.danger:score>4?V.accent:score>1?V.warn:"transparent",transition:"width .3s"}}/>
              </div>
              <span style={{fontSize:11,color:V.text,flex:1,fontWeight:sel===m?700:400}}>{MUSCLE_LABELS[m]}</span>
              <span style={{fontSize:11,color:score>7?V.danger:score>4?V.accent:score>0?V.warn:V.text3,
                fontFamily:V.mono,fontWeight:700}}>{score.toFixed(1)}</span>
            </div>
          );
        })}
      </Card>

      {/* Imbalance Alerts */}
      {imbalances.length>0&&(
        <Card style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
            {Icons.zap({size:13,color:V.warn})}
            <span style={{fontSize:12,color:V.warn,fontWeight:700}}>Imbalance Alerts</span>
          </div>
          {imbalances.map((im,i)=>(
            <div key={i} style={{fontSize:11,color:V.text2,padding:"6px 0",borderBottom:i<imbalances.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
              {im.msg}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Strength Score System ───
export function calcStrengthScore(workouts,bodyWeight){
  const bw=parseFloat(bodyWeight)||180;
  const lifts={bench:0,squat:0,deadlift:0};

  // Find best e1RM for each lift
  workouts.forEach(w=>{
    w.exercises.forEach(ex=>{
      if(lifts.hasOwnProperty(ex.exerciseId)){
        ex.sets.forEach(st=>{
          const wt=parseFloat(st.weight)||0;
          const rp=parseInt(st.reps)||0;
          if(wt>0&&rp>0){
            const e1rm=Math.round(wt*(1+rp/30));
            lifts[ex.exerciseId]=Math.max(lifts[ex.exerciseId],e1rm);
          }
        });
      }
    });
  });

  const benchRatio=lifts.bench/bw;
  const squatRatio=lifts.squat/bw;
  const deadRatio=lifts.deadlift/bw;
  const score=benchRatio*0.30+squatRatio*0.35+deadRatio*0.35;

  let rank,rankColor;
  if(score<0.5){rank="Novice";rankColor=V.text3;}
  else if(score<1.0){rank="Beginner";rankColor=V.warn;}
  else if(score<1.5){rank="Intermediate";rankColor=V.accent2;}
  else if(score<2.0){rank="Advanced";rankColor=V.accent;}
  else{rank="Elite";rankColor=V.purple;}

  // Badges
  const badges=[];
  if(benchRatio>=1.5)badges.push({label:"Bench 1.5x BW",icon:"🏋️"});
  if(benchRatio>=2.0)badges.push({label:"Bench 2x BW",icon:"💎"});
  if(squatRatio>=2.0)badges.push({label:"Squat 2x BW",icon:"🦵"});
  if(squatRatio>=2.5)badges.push({label:"Squat 2.5x BW",icon:"👑"});
  if(deadRatio>=2.5)badges.push({label:"Dead 2.5x BW",icon:"🔥"});
  if(deadRatio>=3.0)badges.push({label:"Dead 3x BW",icon:"⚡"});
  if(score>=1.0)badges.push({label:"1000lb Club",icon:"🏆",cond:lifts.bench+lifts.squat+lifts.deadlift>=1000});

  return{score:Math.round(score*100)/100,rank,rankColor,lifts,benchRatio:Math.round(benchRatio*100)/100,
    squatRatio:Math.round(squatRatio*100)/100,deadRatio:Math.round(deadRatio*100)/100,
    badges:badges.filter(b=>b.cond===undefined||b.cond),total:lifts.bench+lifts.squat+lifts.deadlift,bw};
}

export function StrengthScoreCard({s}){
  const bw=s.body.find(b=>b.weight)?.weight||s.goals.goalWeight||180;
  const data=useMemo(()=>calcStrengthScore(s.workouts,bw),[s.workouts,bw]);
  const u=wUnit(s.units);

  // Monthly trend
  const trend=useMemo(()=>{
    const months={};
    s.workouts.forEach(w=>{
      const mo=w.date.slice(0,7);
      if(!months[mo])months[mo]=[];
      months[mo].push(w);
    });
    return Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([mo,wks])=>{
      const sc=calcStrengthScore(wks,bw);
      return{date:mo.slice(5),score:sc.score};
    });
  },[s.workouts,bw]);

  // Score ring
  const pct=Math.min(100,data.score/2.5*100);
  const r=44,circ=2*Math.PI*r,offset=circ*(1-pct/100);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Main Score */}
      <Card style={{padding:16,textAlign:"center"}}>
        <svg width={100} height={100} style={{display:"block",margin:"0 auto 8px"}}>
          <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6}/>
          <circle cx={50} cy={50} r={r} fill="none" stroke={data.rankColor} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 50 50)" style={{transition:"stroke-dashoffset 1s ease"}}/>
          <text x={50} y={44} textAnchor="middle" fill={V.text} fontSize={22} fontWeight={800} fontFamily={V.mono}>{data.score.toFixed(2)}</text>
          <text x={50} y={62} textAnchor="middle" fill={data.rankColor} fontSize={10} fontWeight={700}>{data.rank}</text>
        </svg>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:4}}>
          {[{l:"Bench",v:data.lifts.bench,r:data.benchRatio,c:V.accent},
            {l:"Squat",v:data.lifts.squat,r:data.squatRatio,c:V.accent2},
            {l:"Dead",v:data.lifts.deadlift,r:data.deadRatio,c:V.purple}].map(x=>(
            <div key={x.l} style={{padding:"8px 4px",background:`${x.c}08`,borderRadius:8}}>
              <div style={{fontSize:16,fontWeight:800,color:x.c,fontFamily:V.mono}}>{x.v||"--"}</div>
              <div style={{fontSize:8,color:V.text3,textTransform:"uppercase",marginTop:1}}>{x.l} E1RM</div>
              <div style={{fontSize:10,color:x.c,fontFamily:V.mono,marginTop:2}}>{x.r}x BW</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:10}}>
          <span style={{fontSize:11,color:V.text3}}>Total: <span style={{color:V.text,fontWeight:700,fontFamily:V.mono}}>{data.total} {u}</span></span>
          <span style={{fontSize:11,color:V.text3}}>BW: <span style={{color:V.text,fontWeight:700,fontFamily:V.mono}}>{bw} {u}</span></span>
        </div>
      </Card>

      {/* Rank Scale */}
      <Card style={{padding:12}}>
        <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Rank Scale</span>
        <div style={{display:"flex",gap:4,marginBottom:4}}>
          {[{l:"Novice",min:0,max:0.5,c:V.text3},{l:"Beginner",min:0.5,max:1.0,c:V.warn},
            {l:"Inter",min:1.0,max:1.5,c:V.accent2},{l:"Advanced",min:1.5,max:2.0,c:V.accent},
            {l:"Elite",min:2.0,max:2.5,c:V.purple}].map(tier=>(
            <div key={tier.l} style={{flex:1,textAlign:"center"}}>
              <div style={{height:6,borderRadius:3,marginBottom:4,
                background:data.score>=tier.min?tier.c:"rgba(255,255,255,0.04)"}}/>
              <span style={{fontSize:7,color:data.score>=tier.min?tier.c:V.text3,fontWeight:600}}>{tier.l}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Badges */}
      {data.badges.length>0&&(
        <Card style={{padding:12}}>
          <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Badges Earned</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {data.badges.map((b,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",
                background:`${V.accent}10`,borderRadius:8,border:`1px solid ${V.accent}20`}}>
                <span>{b.icon}</span>
                <span style={{fontSize:10,color:V.accent,fontWeight:600}}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* #24: Individual Lift Standards */}
      <Card style={{padding:12}}>
        <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Lift Standards</span>
        <div style={{fontSize:9,color:V.text3,marginBottom:10}}>Based on {bw} {u} body weight · ratios from strength standards</div>
        {[{l:"Bench Press",id:"bench",ratios:[0.5,0.75,1.0,1.25,1.5]},
          {l:"Squat",id:"squat",ratios:[0.75,1.0,1.25,1.75,2.25]},
          {l:"Deadlift",id:"deadlift",ratios:[1.0,1.25,1.5,2.0,2.5]},
          {l:"OHP",id:"ohp",ratios:[0.35,0.45,0.6,0.75,0.9]}].map(lift=>{
          const best=(()=>{let b=0;s.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===lift.id)e.sets.forEach(st=>{
            const e1=calc1RM(parseFloat(st.weight)||0,parseInt(st.reps)||0);if(e1>b)b=e1;});}));return b;})();
          const ratio=best>0?best/parseFloat(bw):0;
          const levels=["Beginner","Novice","Intermediate","Advanced","Elite"];
          const colors=[V.text3,V.warn,V.accent2,V.accent,V.purple];
          let level=0;
          for(let i=0;i<lift.ratios.length;i++){if(ratio>=lift.ratios[i])level=i;}
          const nextRatio=level<4?lift.ratios[level+1]:null;
          const nextWeight=nextRatio?Math.round(nextRatio*parseFloat(bw)):null;
          return(
            <div key={lift.id} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:600,color:V.text}}>{lift.l}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:800,color:colors[level],fontFamily:V.mono}}>{best||"--"}</span>
                  <span style={{padding:"2px 6px",borderRadius:4,background:`${colors[level]}15`,fontSize:8,fontWeight:700,color:colors[level]}}>{levels[level]}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:2}}>
                {levels.map((lv,li)=>(
                  <div key={li} style={{flex:1,height:4,borderRadius:2,background:li<=level?colors[li]:"rgba(255,255,255,0.04)"}}/>
                ))}
              </div>
              {nextWeight&&best>0&&<div style={{fontSize:8,color:V.text3,marginTop:3}}>{nextWeight-best} {u} to {levels[level+1]} ({nextWeight} {u})</div>}
            </div>
          );
        })}
      </Card>

      {/* Trend */}
      {trend.length>1&&(
        <Card style={{padding:12}}>
          <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Score Trend</span>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={trend}>
              <defs><linearGradient id="ssGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={V.accent} stopOpacity={0.2}/>
                <stop offset="100%" stopColor={V.accent} stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
              <YAxis {...chartCfg.axis} width={26} domain={[0,'dataMax+0.3']}/>
              <Tooltip {...chartCfg.tip}/>
              <Area type="monotone" dataKey="score" stroke={V.accent} strokeWidth={2} fill="url(#ssGrad)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─── Log Hub: Central action screen ───
// ─── #2 Goal Engine + Milestones ───

export function AnalyticsTab({s}){
  const [selEx,setSelEx]=useState("bench");

  const selIsCardio=isCardio(selEx,s.exercises);
  const exProg=useMemo(()=>{
    let runMax=0;
    return s.workouts.filter(w=>w.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date)).reduce((arr,w)=>{
      const ex=w.exercises.find(e=>e.exerciseId===selEx);
      if(ex){
        if(selIsCardio){
          const totalDur=ex.sets.reduce((s,st)=>s+(parseFloat(st.duration)||0),0);
          const totalDist=ex.sets.reduce((s,st)=>s+(parseFloat(st.distance)||0),0);
          const isPRPoint=totalDist>runMax;if(totalDist>runMax)runMax=totalDist;
          arr.push({date:fmtShort(w.date),max:totalDist,vol:totalDur,e1rm:0,isPR:isPRPoint});
        }else{
          const mw=Math.max(...ex.sets.map(st=>st.weight));
          const vol=ex.sets.reduce((s,st)=>s+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0);
          const e1rm=Math.max(...ex.sets.map(st=>st.weight*(1+st.reps/30)));
          const isPRPoint=mw>runMax;if(mw>runMax)runMax=mw;
          arr.push({date:fmtShort(w.date),max:mw,vol,e1rm:Math.round(e1rm),isPR:isPRPoint});
        }
      }
      return arr;
    },[]);
  },[s.workouts,selEx,s.range,selIsCardio]);

  const volByGroup=useMemo(()=>{
    const g={};
    s.workouts.filter(w=>w.date>=ago(s.range)).forEach(w=>w.exercises.forEach(ex=>{
      const info=s.exercises.find(e=>e.id===ex.exerciseId);
      if(info){const c=info.cat==="Cardio";const v=c?ex.sets.reduce((s,st)=>s+(parseFloat(st.duration)||0),0):ex.sets.reduce((s,st)=>s+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0);g[info.cat]=(g[info.cat]||0)+v;}
    }));
    return Object.entries(g).map(([name,value])=>({name,value}));
  },[s.workouts,s.exercises,s.range]);

  const freq=useMemo(()=>{
    const c={};
    s.workouts.filter(w=>w.date>=ago(s.range)).forEach(w=>{const dy=new Date(w.date+"T12:00:00").getDay();c[dy]=(c[dy]||0)+1;});
    return["S","M","T","W","T","F","S"].map((d,i)=>({d,n:c[i]||0}));
  },[s.workouts,s.range]);

  const maxF=Math.max(...freq.map(f=>f.n),1);
  const colors=[V.accent,V.accent2,V.purple,V.warn,V.danger,"#ffd93d"];
  const exOpts=useMemo(()=>{
    const freq={};
    s.workouts.forEach(w=>w.exercises.forEach(e=>{freq[e.exerciseId]=(freq[e.exerciseId]||0)+1;}));
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([id])=>id);
  },[s.workouts]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Exercise Selector */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:13,color:V.text2,fontWeight:600}}>Exercise Progression</span>
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
          {exOpts.map(id=>(
            <Chip key={id} label={s.exercises.find(e=>e.id===id)?.name||id} active={selEx===id} onClick={()=>setSelEx(id)}/>
          ))}
        </div>
        <span style={{fontSize:11,color:V.text3,display:"block",marginBottom:6}}>{selIsCardio?`Distance (${dUnit(s.units)}) & Duration`:"Max Weight & Est. 1RM"}</span>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={exProg}>
            <CartesianGrid {...chartCfg.grid} vertical={false}/>
            <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
            <YAxis {...chartCfg.axis} width={30}/>
            <Tooltip {...chartCfg.tip}/>
            <Line type="monotone" dataKey="max" stroke={V.accent} strokeWidth={2} dot={{r:3}} name={selIsCardio?"Distance":"Max"}/>
            {!selIsCardio&&<Line type="monotone" dataKey="e1rm" stroke={V.purple} strokeWidth={2} strokeDasharray="5 5" dot={{r:2}} name="E1RM"/>}
            {exProg.filter(p=>p.isPR).map((p,i)=>(
              <ReferenceDot key={i} x={p.date} y={p.max} r={6}
                fill="#f59e0b" stroke={V.bg} strokeWidth={2}
                label={{value:"PR",position:"top",fill:"#f59e0b",fontSize:8,fontWeight:800}}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Volume Pie */}
      <Card>
        <span style={{fontSize:11,color:V.text3,fontWeight:700,display:"block",marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Volume by Muscle</span>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={volByGroup} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
              {volByGroup.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}
            </Pie>
            <Tooltip {...chartCfg.tip}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",padding:"10px 4px 2px"}}>
          {volByGroup.map((g,i)=>(
            <span key={g.name} style={{fontSize:11,color:colors[i%colors.length],display:"flex",alignItems:"center",gap:5,fontWeight:600,
              padding:"3px 8px",borderRadius:6,background:`${colors[i%colors.length]}10`}}>
              <span style={{width:8,height:8,borderRadius:2,flexShrink:0,background:colors[i%colors.length]}}/>{g.name}
            </span>
          ))}
        </div>
      </Card>

      {/* Frequency */}
      <Card>
        <span style={{fontSize:13,color:V.text2,fontWeight:600,display:"block",marginBottom:14}}>Weekly Frequency</span>
        <div style={{display:"flex",gap:8,justifyContent:"center",padding:"8px 0"}}>
          {freq.map((f,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flex:1}}>
              <div style={{width:"100%",maxWidth:32,height:80,borderRadius:8,background:"rgba(255,255,255,0.03)",
                position:"relative",overflow:"hidden",display:"flex",alignItems:"flex-end"}}>
                <div style={{width:"100%",height:`${(f.n/maxF)*100}%`,background:`linear-gradient(to top,${V.accent}40,${V.accent2}40)`,
                  borderRadius:6,transition:"height .4s ease",minHeight:f.n>0?6:0}}/>
              </div>
              <span style={{fontSize:10,color:V.text3,fontWeight:600}}>{f.d}</span>
              <span style={{fontSize:10,color:f.n>0?V.accent:V.text3,fontFamily:V.mono,fontWeight:700}}>{f.n}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════
//  CALENDAR TAB
// ═══════════════════════════════════════
export const WORKOUT_TYPES = ["Rest","Chest","Back","Legs","Shoulders","Arms","Core","Cardio","Push","Pull","Upper","Lower","Full Body","Custom"];
export const typeColors = {
  "Rest":"#333","Chest":V.accent,"Back":V.accent2,"Legs":V.purple,"Shoulders":V.warn,
  "Arms":"#ff6b9d","Core":"#ffd93d","Cardio":"#ff6b6b","Push":V.accent,"Pull":V.accent2,
  "Upper":"#e879f9","Lower":"#fb923c","Full Body":"#34d399","Custom":"#94a3b8",
};
const WORKOUT_TYPES_COLORS = typeColors;

