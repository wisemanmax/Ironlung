import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Progress, ExercisePicker, ValidationWarning, validateWorkout, SuccessToastCtrl, ConfirmDialog } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, calc1RM, calcPlates, PLATES, fmtTimer, convW, wUnit, dUnit, isCardio, toKg, toLbs } from '../utils/helpers';
import { Undo } from '../utils/undo';
import { ActiveWorkoutStore, SocialAPI } from '../utils/sync';
import { TEMPLATES } from '../data/templates';
import { ShareCard } from '../utils/share';
import { RestTimer, RestTimerCtrl, PlateCalc, findLastSets, usePRs } from '../components/dialogs';
import { getActiveMultiplier } from './social';
import { getOverloadSuggestion } from './AnalyticsTab';
import { checkAndAwardMissions, checkMilestones } from './gamification';
import { WorkoutCard } from './features';

function YTBtn({yt,size=24}){
  if(!yt)return null;
  const url=yt.startsWith("http")?yt:`https://www.youtube.com/watch?v=${yt}`;
  return <a href={url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:size/2,background:"rgba(255,0,0,0.15)",color:"#f00",textDecoration:"none",fontSize:size*0.5}}>▶</a>;
}

export function WorkoutTab({s,d}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({date:today(),dur:"",exercises:[],notes:"",rating:3});
  const [selEx,setSelEx]=useState("");
  const [catFilter,setCatFilter]=useState("All");
  const [showTemplates,setShowTemplates]=useState(false);
  const [showPlates,setShowPlates]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const [newPRs,setNewPRs]=useState([]);
  const [startTime,setStartTime]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [valWarnings,setValWarnings]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const [expandedId,setExpandedId]=useState(null);
  const [shareWorkout,setShareWorkout]=useState(null);
  const [histSearch,setHistSearch]=useState("");
  const cats=["All",...new Set(s.exercises.map(e=>e.cat))];
  const prs=usePRs(s.workouts,s.exercises);

  // Volume trend: compare last 2 workouts of same type for "up/down" insight
  const volTrend=useMemo(()=>{
    const recent=s.workouts.slice(0,10);
    if(recent.length<2)return null;
    const calcVol=(w)=>w.exercises.reduce((a,e)=>{const c=isCardio(e.exerciseId,s.exercises);return a+e.sets.reduce((b,st)=>b+(c?(parseFloat(st.duration)||0):(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)),0);},0);
    const last=calcVol(recent[0]);const prev=calcVol(recent[1]);
    if(!prev)return null;
    const diff=last-prev;const pct=Math.round(diff/prev*100);
    return{last:Math.round(last),prev:Math.round(prev),diff:Math.round(diff),pct,up:diff>=0};
  },[s.workouts]);

  // #11: Crash recovery — ActiveWorkoutStore.load() was never called anywhere.
  // The IDB save path existed but the load path was missing entirely, making crash recovery write-only.
  // On mount, check for a saved workout < 4 hours old and offer to resume it.
  const [crashWorkout,setCrashWorkout]=useState(null);

  // Returns last logged top set for an exercise — shown as "Last: 185×5 (Mar 1)" hint
  const getLastPerf=(exerciseId)=>{
    const cardio=isCardio(exerciseId,s.exercises);
    for(const w of s.workouts){
      const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
      if(ex&&ex.sets.length>0){
        if(cardio){
          const top=ex.sets.reduce((best,st)=>(parseFloat(st.duration)||0)>(parseFloat(best.duration)||0)?st:best,ex.sets[0]);
          return{date:w.date,sets:ex.sets.length,topDuration:parseFloat(top.duration)||0,topDistance:parseFloat(top.distance)||0,cardio:true};
        }
        const top=ex.sets.reduce((best,st)=>(parseFloat(st.weight)||0)>(parseFloat(best.weight)||0)?st:best,ex.sets[0]);
        return{date:w.date,sets:ex.sets.length,topWeight:parseFloat(top.weight)||0,topReps:parseInt(top.reps)||0};
      }
    }return null;
  };
  // Load coach-suggested draft if present (from AdaptiveCoach "Start This Workout")
  useEffect(()=>{
    const draft=LS.get("ft-coach-draft");
    if(draft&&!show){
      LS.set("ft-coach-draft",null);
      setForm({date:draft.date||today(),dur:draft.dur||"",exercises:draft.exercises||[],notes:draft.notes||"",rating:draft.rating||3});
      setStartTime(Date.now());setElapsed(0);setShow(true);
    }
  },[]);
  useEffect(()=>{
    if(show)return; // already in an active workout, skip
    ActiveWorkoutStore.load().then(saved=>{
      if(!saved)return;
      const age=(Date.now()-new Date(saved.savedAt||0).getTime())/1000/60; // minutes
      if(age<240)setCrashWorkout(saved); // offer restore if < 4 hours old
      else ActiveWorkoutStore.clear(); // stale — discard silently
    }).catch(()=>{});
  },[]);

  // Live workout timer
  useEffect(()=>{
    if(!startTime||!show)return; // only tick while sheet is open
    const iv=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000);
    return()=>clearInterval(iv);
  },[startTime,show]);

  const fmtElapsed=(sec)=>{const m=Math.floor(sec/60);const s2=sec%60;return`${m}:${s2<10?"0":""}${s2}`;};

  // Motivational messages
  const motivations=["Let's get it! 💪","Time to grind!","No excuses today.","Push your limits.","Stronger every rep.",
    "You showed up — that's half the battle.","Make it count.","Beast mode: ON"];
  const motiv=useMemo(()=>motivations[Math.floor(Math.random()*motivations.length)],[show]);

  const startNew=()=>{
    setForm({date:today(),dur:"",exercises:[],notes:"",rating:3});
    setNewPRs([]);setStartTime(Date.now());setElapsed(0);setShow(true);
  };

  // Start from last workout (repeat) — auto-fills exercises with last weights
  const repeatLast=()=>{
    if(s.workouts.length===0)return;
    const last=s.workouts[0];
    const exs=last.exercises.map(ex=>{
      const cardio=isCardio(ex.exerciseId,s.exercises);
      return{exerciseId:ex.exerciseId,
        sets:ex.sets.map(st=>cardio
          ?{duration:(st.duration||"").toString(),distance:(st.distance||"").toString(),rpe:st.rpe?st.rpe.toString():"",done:true}
          :{weight:st.weight.toString(),reps:st.reps.toString(),rpe:st.rpe?st.rpe.toString():"",done:true})};
    });
    setForm({date:today(),dur:"",exercises:exs,notes:"",rating:3});
    setNewPRs([]);setStartTime(Date.now());setElapsed(0);setShow(true);
  };

  const loadTemplate=(t)=>{
    // Pre-fill weights from last time each exercise was done
    const exs=t.exs.map(eid=>{
      const lastW=findLastSets(eid,s.workouts,s.exercises);
      const cardio=isCardio(eid,s.exercises);
      return{exerciseId:eid,sets:lastW||(cardio?[{duration:"",distance:"",rpe:"",done:true}]:[{weight:"",reps:"",rpe:"",done:true}])};
    });
    setForm(f=>({...f,exercises:exs}));
    setShowTemplates(false);setStartTime(Date.now());setElapsed(0);setShow(true);
  };

  const addEx=()=>{
    if(!selEx)return;
    Haptic.light();
    const cardio=isCardio(selEx,s.exercises);
    const lastW=findLastSets(selEx,s.workouts,s.exercises);
    if(cardio){
      const sets=lastW||[{duration:"",distance:"",rpe:"",done:true}];
      setForm(f=>({...f,exercises:[...f.exercises,{exerciseId:selEx,sets}]}));
      setSelEx("");
      return;
    }
    // #6: Apply overload suggestion to auto-fill weights
    const sug=getOverloadSuggestion(selEx,s.workouts,s.units);
    let sets=lastW||[{weight:"",reps:"",rpe:"",done:true}];
    if(sug&&lastW){
      const sugW=parseFloat(sug.suggest.split("×")[0])||0;
      if(sugW>0)sets=sets.map(st=>({...st,weight:sugW.toString()}));
    }
    setForm(f=>({...f,exercises:[...f.exercises,{exerciseId:selEx,sets}]}));
    setSelEx("");
  };
  const addSet=(ei)=>{Haptic.light();setForm(f=>{const exs=[...f.exercises];const l=exs[ei].sets[exs[ei].sets.length-1];const cardio=isCardio(exs[ei].exerciseId,s.exercises);const newSet=cardio?{duration:l.duration||"",distance:l.distance||"",rpe:l.rpe,done:true}:{weight:l.weight,reps:l.reps,rpe:l.rpe,done:true,warmup:false,drop:false,fail:false};exs[ei]={...exs[ei],sets:[...exs[ei].sets,newSet]};const next={...f,exercises:exs};saveActiveWkt(next);return next;});};
  // I8: Persist active workout to IDB for crash recovery
  const saveActiveWkt=useCallback((f)=>{if(f.exercises?.length>0)ActiveWorkoutStore.save({...f,startTime}).catch(()=>{});},[startTime]);
  const updSet=(ei,si,k,v)=>{setForm(f=>{const exs=[...f.exercises],sets=[...exs[ei].sets];const prev=sets[si][k];sets[si]={...sets[si],[k]:v};exs[ei]={...exs[ei],sets};
    // #2: Auto-start rest timer when reps filled (not for cardio)
    if(k==="reps"&&!prev&&v&&!sets[si].warmup&&!isCardio(exs[ei].exerciseId,s.exercises))setTimeout(()=>RestTimerCtrl.trigger(),100);
    return{...f,exercises:exs};});};
  const toggleSetFlag=(ei,si,flag)=>{setForm(f=>{const exs=[...f.exercises],sets=[...exs[ei].sets];sets[si]={...sets[si],[flag]:!sets[si][flag]};exs[ei]={...exs[ei],sets};return{...f,exercises:exs};});};
  const rmSet=(ei,si)=>setForm(f=>{const exs=[...f.exercises];exs[ei]={...exs[ei],sets:exs[ei].sets.filter((_,i)=>i!==si)};return{...f,exercises:exs};});
  const rmEx=(ei)=>setForm(f=>({...f,exercises:f.exercises.filter((_,i)=>i!==ei)}));
  const updExNote=(ei,v)=>{setForm(f=>{const exs=[...f.exercises];exs[ei]={...exs[ei],note:v};return{...f,exercises:exs};});};
  // #1: Warm-up set generator
  const addWarmups=(ei)=>{
    Haptic.light();
    setForm(f=>{
      const exs=[...f.exercises];const topWeight=parseFloat(exs[ei].sets[0]?.weight)||0;
      if(topWeight<=0)return f;
      const bar=s.units==="kg"?20:45;const inc=s.units==="kg"?2.5:5;
      const warmups=[
        {weight:bar.toString(),reps:"10",rpe:"",done:true,warmup:true,drop:false,fail:false},
        {weight:Math.round(topWeight*0.5/inc)*inc+"",reps:"8",rpe:"",done:true,warmup:true,drop:false,fail:false},
        {weight:Math.round(topWeight*0.7/inc)*inc+"",reps:"5",rpe:"",done:true,warmup:true,drop:false,fail:false},
        {weight:Math.round(topWeight*0.85/inc)*inc+"",reps:"3",rpe:"",done:true,warmup:true,drop:false,fail:false},
      ].filter(w=>parseFloat(w.weight)>=bar&&parseFloat(w.weight)<topWeight);
      exs[ei]={...exs[ei],sets:[...warmups,...exs[ei].sets]};
      return{...f,exercises:exs};
    });
    SuccessToastCtrl.show("Warm-up sets added");
  };
  // #3: Superset toggle
  const toggleSuperset=(ei)=>{
    setForm(f=>{
      const exs=[...f.exercises];
      const current=exs[ei].supersetGroup||null;
      if(current){exs[ei]={...exs[ei],supersetGroup:null};}
      else{
        // Find the next exercise and link them
        const nextEi=ei+1<exs.length?ei+1:null;
        const groupId=uid().slice(0,4);
        exs[ei]={...exs[ei],supersetGroup:groupId};
        if(nextEi!==null)exs[nextEi]={...exs[nextEi],supersetGroup:groupId};
      }
      return{...f,exercises:exs};
    });
  };
  const getSupersetLabel=(ex,ei)=>{
    if(!ex.supersetGroup)return null;
    // Find position within superset group
    let pos=0;
    for(let i=0;i<=ei;i++){if(form.exercises[i].supersetGroup===ex.supersetGroup)pos++;}
    return String.fromCharCode(64+pos); // A, B, C
  };

  const buildWorkout=()=>{
    const dur=parseInt(form.dur)||Math.round(elapsed/60)||0;
    return{id:editingId||uid(),date:form.date,dur,rating:form.rating,
      exercises:form.exercises.map(e=>{
        const cardio=isCardio(e.exerciseId,s.exercises);
        return{exerciseId:e.exerciseId,note:e.note||"",supersetGroup:e.supersetGroup||null,
          sets:e.sets.filter(st=>!st.warmup).map(st=>cardio
            ?{duration:parseFloat(st.duration)||0,distance:parseFloat(st.distance)||0,rpe:parseFloat(st.rpe)||0,done:st.done}
            :{weight:parseFloat(st.weight)||0,reps:parseInt(st.reps)||0,rpe:parseFloat(st.rpe)||0,done:st.done,drop:!!st.drop,fail:!!st.fail})};
      }),
      notes:form.notes};
  };
  const save=()=>{
    const w=buildWorkout();
    const warnings=validateWorkout(w,s);
    if(warnings.length>0&&!valWarnings){setValWarnings(warnings);return;}
    setValWarnings(null);
    const detected=[];
    w.exercises.forEach(ex=>{
      if(isCardio(ex.exerciseId,s.exercises))return;
      const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      ex.sets.forEach(st=>{const e1rm=calc1RM(st.weight,st.reps);const prev=prs[ex.exerciseId];
        if(st.weight>0&&(!prev||e1rm>prev.e1rm))detected.push({name,weight:st.weight,reps:st.reps,e1rm});});});
    setNewPRs(detected);
    if(detected.length>0)Haptic.success();
    if(editingId){d({type:"EDIT_W",w});setEditingId(null);SuccessToastCtrl.show("Workout updated");}
    else{d({type:"ADD_W",w});ActiveWorkoutStore.clear();Haptic.medium();
      // XP with multiplier
      const mult=getActiveMultiplier(s);
      const prBonus=detected.length*20;
      // B20 fix: always store PR bonus XP in pool; multiplier bonus is extra on top
      if(prBonus>0)addXPBonus(prBonus,`PR Bonus (${detected.length} PR${detected.length>1?"s":""})`);

      // ── T4 #9: Per-exercise consistency XP bonus ──
      // Award 10 XP per exercise trained 3+ times in last 14 days (streak per lift)
      let consistencyBonus=0;
      const consistencyDetails=[];
      w.exercises.forEach(ex=>{
        const exId=ex.exerciseId;
        const recentCount=s.workouts.filter(pw=>pw.date>=ago(13)&&pw.date<today())
          .filter(pw=>pw.exercises.some(e=>e.exerciseId===exId)).length;
        if(recentCount>=2){ // 2 in prior 14d + today = 3+ total
          const streakKey="ft-cons-"+exId;
          const lastAwarded=LS.get(streakKey);
          if(lastAwarded!==today()){
            LS.set(streakKey,today());
            const exName=s.exercises.find(e=>e.id===exId)?.name||exId;
            const shortName=exName.split(" ").slice(0,2).join(" ");
            consistencyBonus+=10;
            consistencyDetails.push(shortName);
          }
        }
      });
      if(consistencyBonus>0){
        addXPBonus(consistencyBonus,`Consistency (${consistencyDetails.slice(0,2).join(", ")}${consistencyDetails.length>2?"…":""})`);
      }

      const multBase=30+prBonus+consistencyBonus;
      const totalGain=Math.round(multBase*mult.mult);
      const multBonus=totalGain-multBase;
      if(multBonus>0){
        addXPBonus(multBonus, mult.label||"XP Multiplier");
        if(mult.mult===3)LS.set("ft-comeback-used",today());
      }
      const displayXP=30+prBonus+consistencyBonus+Math.max(0,multBonus);
      const xpMsg=mult.mult>1?`+${displayXP} XP ${mult.icon} (${mult.mult}\u00d7 bonus!)`:
        detected.length>0?`+${30+prBonus+consistencyBonus} XP \u00b7 ${detected.length} PR${detected.length>1?"s":""}! \U0001f3af`:consistencyBonus>0?`+${30+consistencyBonus} XP \u00b7 consistency bonus! 🔄`:`+30 XP \U0001f4aa`;
      SuccessToastCtrl.show("Workout logged · "+xpMsg);
      // Wire early bird mission flag (before 8am)
      if(new Date().getHours()<8)LS.set("ft-workout-early-"+today(),true);
      // Check missions + milestones
      setTimeout(()=>checkAndAwardMissions({...s,workouts:[w,...s.workouts]},d),500);
      checkMilestones(s, w, detected);
      if(s.profile?.email){const exNames=w.exercises.map(e=>s.exercises.find(x=>x.id===e.exerciseId)?.name||e.exerciseId);
        SocialAPI.logEvent(s.profile.email,"WorkoutLogged",{exercises:exNames,sets:w.exercises.reduce((a,e)=>a+e.sets.length,0)},
          (LS.get("ft-privacy")||{}).workouts?"friends":"private").catch(()=>{});
        // Log PRs to feed for reactions
        detected.forEach(pr=>{
          SocialAPI.logEvent(s.profile.email,"PRHit",{exercise:pr.name,weight:pr.weight,reps:pr.reps,e1rm:pr.e1rm},
            (LS.get("ft-privacy")||{}).workouts?"friends":"private").catch(()=>{});
        });
      }
    }
    setStartTime(null);
    if(detected.length===0)setShow(false);
  };

  const prevBest=(eid)=>{for(const w of s.workouts){const ex=w.exercises.find(e=>e.exerciseId===eid);
    if(ex){const b=ex.sets.reduce((m,st)=>st.weight>m.weight?st:m,{weight:0,reps:0});if(b.weight>0)return`${b.weight}×${b.reps}`;}};return null;};

  // PR celebration
  if(newPRs.length>0){
    return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",gap:20}}>
        <div style={{fontSize:60}}>🏆</div>
        <div style={{fontSize:22,fontWeight:800,color:V.warn,textAlign:"center"}}>NEW PR{newPRs.length>1?"s":""}!</div>
        {newPRs.map((pr,i)=>(
          <Card key={i} glow style={{width:"100%",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:V.text}}>{pr.name}</div>
            <div style={{fontSize:24,fontWeight:800,color:V.accent,fontFamily:V.mono,marginTop:4}}>{pr.weight} × {pr.reps}</div>
            <div style={{fontSize:12,color:V.text3,marginTop:2}}>Est. 1RM: {pr.e1rm} {wUnit(s.units)}</div>
          </Card>
        ))}
        <div style={{display:"flex",gap:8,width:"100%"}}>
          <Btn full onClick={()=>{setNewPRs([]);setShow(false);}}>Done</Btn>
          <Btn v="secondary" full onClick={async()=>{
            const stats=newPRs.map(pr=>({value:`${pr.weight}×${pr.reps}`,label:pr.name,color:"#22c55e"}));
            stats.push({value:`${newPRs.length} PR${newPRs.length>1?"s":""}`,label:"NEW RECORDS",color:"#f59e0b"});
            const c=await ShareCard.generate("🏆 New PR!",stats,`${fmtFull(today())} · IRONLOG`);
            ShareCard.share(c,`ironlog-pr-${today()}.png`);
          }}>Share</Btn>
        </div>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8}}>
        <Btn full onClick={startNew}>{Icons.plus({size:16,color:V.bg})} New Workout</Btn>
        {s.workouts.length>0&&(()=>{
          const last=s.workouts[0];const exNames=last.exercises.slice(0,3).map(e=>s.exercises.find(x=>x.id===e.exerciseId)?.name||e.exerciseId);
          return <Btn v="secondary" onClick={repeatLast} s={{flexShrink:0,fontSize:10,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            🔄 {exNames.join(", ")}{last.exercises.length>3?` +${last.exercises.length-3}`:""}</Btn>;
        })()}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" full onClick={()=>setShowTemplates(true)}>{Icons.copy({size:14,color:V.text2})} Templates</Btn>
        <Btn v="secondary" full onClick={()=>setShowPlates(true)}>{Icons.hash({size:14,color:V.text2})} Plates</Btn>
      </div>

      {showTemplates&&(
        <Sheet title="Workout Templates" onClose={()=>setShowTemplates(false)}>
          {TEMPLATES.map((t,i)=>(
            <Card key={i} onClick={()=>loadTemplate(t)} style={{marginBottom:8,padding:14}}>
              <div style={{fontSize:14,fontWeight:700,color:V.text}}>{t.name}</div>
              <div style={{fontSize:11,color:V.text3,marginTop:2}}>{t.desc}</div>
              <div style={{fontSize:10,color:V.accent,marginTop:4,fontFamily:V.mono}}>{t.exs.length} exercises</div>
            </Card>
          ))}
        </Sheet>
      )}
      {showPlates&&(<Sheet title="Plate Calculator" onClose={()=>setShowPlates(false)}><PlateCalc/></Sheet>)}

      {show&&(
        <Sheet title="Log Workout" onClose={()=>{setShow(false);setStartTime(null);}}
          footer={<Btn full onClick={save} disabled={form.exercises.length===0}>{Icons.check({size:16,color:V.bg})} Save Workout</Btn>}>
          {/* Live timer + motivation */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,
            padding:"10px 14px",background:`${V.accent}06`,borderRadius:12,border:`1px solid ${V.accent}12`}}>
            <div style={{fontSize:11,color:V.text3,fontStyle:"italic"}}>{motiv}</div>
            {startTime&&(
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:6,height:6,borderRadius:3,background:V.accent,animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{fmtElapsed(elapsed)}</span>
              </div>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
            <Field label="Duration" type="number" value={form.dur} onChange={v=>setForm(f=>({...f,dur:v}))} unit="min" placeholder="60"/>
          </div>

          <RestTimer/>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Add Exercise</div>
            <ExercisePicker exercises={s.exercises} value={selEx} onChange={id=>{setSelEx(id);}} catFilter={catFilter} setCatFilter={setCatFilter} todayType={s.schedule?.overrides?.[today()]||s.schedule?.weekly?.[new Date().getDay()]||null}/>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              {selEx&&(()=>{const yt=s.exercises.find(e=>e.id===selEx)?.yt;return yt?<YTBtn yt={yt} size={38}/>:null;})()}
              {selEx&&<Btn full onClick={addEx}>{Icons.plus({size:14,color:V.bg})} Add {s.exercises.find(e=>e.id===selEx)?.name||""}</Btn>}
            </div>
            {/* #5: Last workout preview for selected exercise */}
            {selEx&&!isCardio(selEx,s.exercises)&&(()=>{
              const sug=getOverloadSuggestion(selEx,s.workouts,s.units);
              if(!sug)return null;
              return(
                <div style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:`${V.accent}05`,border:`1px solid ${V.accent}12`}}>
                  <div style={{fontSize:10,fontWeight:700,color:V.text3,marginBottom:4}}>LAST SESSION · {fmtShort(sug.date)}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {sug.allSets.split("  ").map((set,i)=>(
                      <span key={i} style={{padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,0.04)",
                        fontSize:12,fontWeight:600,color:V.text,fontFamily:V.mono}}>{set}</span>
                    ))}
                  </div>
                  <div style={{marginTop:6,fontSize:11,fontWeight:700,color:sug.type==="deload"?V.warn:V.accent}}>
                    → Today: {sug.suggest} <span style={{fontWeight:400,color:V.text3}}>({sug.reason})</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {form.exercises.map((ex,ei)=>{
            const info=s.exercises.find(e=>e.id===ex.exerciseId);
            const pb=prevBest(ex.exerciseId);
            const ssLabel=getSupersetLabel(ex,ei);
            return(
              <div key={ei} style={{marginBottom:14,padding:14,background:"rgba(255,255,255,0.02)",borderRadius:14,
                border:`1px solid ${ex.supersetGroup?V.purple+"30":V.cardBorder}`,
                ...(ex.supersetGroup?{borderLeft:`3px solid ${V.purple}`}:{})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                    {ssLabel&&<span style={{fontSize:10,fontWeight:800,color:V.purple,background:`${V.purple}15`,padding:"2px 6px",borderRadius:4}}>{ssLabel}</span>}
                    <span style={{fontSize:14,color:V.text,fontWeight:700}}>{info?.name}</span>
                    <YTBtn yt={info?.yt} size={24}/>
                    {pb&&<span style={{fontSize:10,color:V.text3}}>PR:{pb}</span>}
                    {(()=>{const lp=getLastPerf(ex.exerciseId);if(!lp||pb)return null;
                      if(lp.cardio)return lp.topDuration>0?<span style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>Last: {lp.topDuration}min · {lp.topDistance}{dUnit(s.units)}</span>:null;
                      if(lp.topWeight===0)return null;
                      return <span style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>Last: {lp.topWeight}×{lp.topReps}</span>;})()}
                  </div>
                  <div style={{display:"flex",gap:2}}>
                    <button onClick={()=>toggleSuperset(ei)} title="Superset" style={{background:ex.supersetGroup?`${V.purple}15`:"none",border:"none",padding:4,cursor:"pointer",borderRadius:4}}>
                      <span style={{fontSize:11,color:ex.supersetGroup?V.purple:V.text3}}>SS</span></button>
                    <button onClick={()=>rmEx(ei)} aria-label="Remove exercise" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:14,color:V.text3})}</button>
                  </div>
                </div>
                {(()=>{if(isCardio(ex.exerciseId,s.exercises))return null;const sug=getOverloadSuggestion(ex.exerciseId,s.workouts,s.units);return sug?(
                  <div style={{marginBottom:10,padding:"8px 10px",
                    background:sug.type==="deload"?`${V.warn}08`:sug.type==="increase"?`${V.accent}08`:`${V.accent2}08`,
                    borderRadius:8,border:`1px solid ${sug.type==="deload"?V.warn:sug.type==="increase"?V.accent:V.accent2}15`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {Icons.zap({size:12,color:sug.type==="deload"?V.warn:V.accent})}
                      <span style={{fontSize:11,color:sug.type==="deload"?V.warn:V.accent,fontWeight:700}}>
                        {sug.type==="increase"?"↑ Increase":sug.type==="deload"?"↓ Deload":sug.type==="repeat"?"→ Repeat":"→ +1 Rep"}
                      </span>
                      <span style={{flex:1}}/>
                      <span style={{fontSize:10,color:V.text3,fontFamily:V.mono}}>E1RM: {sug.e1rm}</span>
                    </div>
                    <div style={{fontSize:11,color:V.text2,marginTop:4}}>
                      Last: <span style={{fontFamily:V.mono}}>{sug.allSets}</span>
                    </div>
                    <div style={{fontSize:12,color:V.text,fontWeight:700,marginTop:2,fontFamily:V.mono}}>
                      → Try {sug.suggest}
                    </div>
                    <div style={{fontSize:9,color:V.text3,marginTop:2}}>{sug.reason}</div>
                  </div>
                ):null;})()}
                {(()=>{const cardio=isCardio(ex.exerciseId,s.exercises);return cardio?(
                  <React.Fragment>
                  <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 28px",gap:4,marginBottom:6}}>
                    <span style={{fontSize:9,color:V.text3,textAlign:"center"}}>#</span>
                    <span style={{fontSize:9,color:V.text3}}>MIN</span><span style={{fontSize:9,color:V.text3}}>DIST ({dUnit(s.units)})</span>
                    <span style={{fontSize:9,color:V.text3}}>RPE</span><span/>
                  </div>
                  {ex.sets.map((st,si)=>(
                    <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 28px",gap:4,marginBottom:4,alignItems:"center"}}>
                      <span style={{fontSize:12,color:V.text3,textAlign:"center",fontFamily:V.mono}}>{si+1}</span>
                      {["duration","distance","rpe"].map(k=>(
                        <input key={k} type="number" inputMode="decimal" value={st[k]||""} onChange={e=>updSet(ei,si,k,e.target.value)}
                          placeholder="0" style={{padding:"10px 8px",background:"rgba(255,255,255,0.04)",
                            border:"1px solid rgba(255,255,255,0.05)",
                            borderRadius:10,color:V.text,fontSize:15,fontFamily:V.mono,outline:"none",width:"100%",
                            boxSizing:"border-box",textAlign:"center",minHeight:40,WebkitAppearance:"none"}}/>
                      ))}
                      <button onClick={()=>rmSet(ei,si)} disabled={ex.sets.length<=1}
                        style={{background:"none",border:"none",padding:"5px 4px",cursor:ex.sets.length<=1?"default":"pointer",opacity:ex.sets.length<=1?.2:1,minHeight:28}}>
                        {Icons.x({size:12,color:V.text3})}</button>
                    </div>
                  ))}
                  </React.Fragment>
                ):(
                  <React.Fragment>
                <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 46px",gap:4,marginBottom:6}}>
                  <span style={{fontSize:9,color:V.text3,textAlign:"center"}}>#</span>
                  <span style={{fontSize:9,color:V.text3}}>{wUnit(s.units).toUpperCase()}</span><span style={{fontSize:9,color:V.text3}}>REPS</span>
                  <span style={{fontSize:9,color:V.text3}}>RPE</span><span style={{fontSize:8,color:V.text3,textAlign:"center"}}>FLAG</span>
                </div>
                {ex.sets.map((st,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 46px",gap:4,marginBottom:4,alignItems:"center",
                    ...(st.warmup?{opacity:0.5}:{})}}>
                    <span style={{fontSize:12,color:st.warmup?V.warn:V.text3,textAlign:"center",fontFamily:V.mono}}>
                      {st.warmup?"W":si+1-ex.sets.filter((s2,i2)=>i2<si&&s2.warmup).length}
                    </span>
                    {["weight","reps","rpe"].map(k=>(
                      <input key={k} type="number" inputMode="decimal" value={st[k]} onChange={e=>updSet(ei,si,k,e.target.value)}
                        placeholder="0" style={{padding:"10px 8px",background:st.warmup?"rgba(255,159,67,0.06)":"rgba(255,255,255,0.04)",
                          border:`1px solid ${st.warmup?"rgba(255,159,67,0.15)":"rgba(255,255,255,0.05)"}`,
                          borderRadius:10,color:V.text,fontSize:15,fontFamily:V.mono,outline:"none",width:"100%",
                          boxSizing:"border-box",textAlign:"center",minHeight:40,WebkitAppearance:"none"}}/>
                    ))}
                    <div style={{display:"flex",gap:2,alignItems:"center",justifyContent:"center"}}>
                      {!st.warmup&&<button onClick={()=>toggleSetFlag(ei,si,"drop")} style={{background:st.drop?`${V.accent2}20`:"rgba(255,255,255,0.03)",
                        border:`1px solid ${st.drop?V.accent2+"40":"rgba(255,255,255,0.06)"}`,padding:"5px 6px",cursor:"pointer",borderRadius:5,fontSize:11,color:st.drop?V.accent2:V.text3,fontWeight:700,minWidth:26,minHeight:28,lineHeight:1}}>D</button>}
                      {!st.warmup&&<button onClick={()=>toggleSetFlag(ei,si,"fail")} style={{background:st.fail?`${V.danger}20`:"rgba(255,255,255,0.03)",
                        border:`1px solid ${st.fail?V.danger+"40":"rgba(255,255,255,0.06)"}`,padding:"5px 6px",cursor:"pointer",borderRadius:5,fontSize:11,color:st.fail?V.danger:V.text3,fontWeight:700,minWidth:26,minHeight:28,lineHeight:1}}>F</button>}
                      <button onClick={()=>rmSet(ei,si)} disabled={ex.sets.length<=1}
                        style={{background:"none",border:"none",padding:"5px 4px",cursor:ex.sets.length<=1?"default":"pointer",opacity:ex.sets.length<=1?.2:1,minHeight:28}}>
                        {Icons.x({size:12,color:V.text3})}</button>
                    </div>
                  </div>
                ))}
                  </React.Fragment>
                );})()}
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <Btn v="small" onClick={()=>addSet(ei)} s={{flex:1}}>{Icons.plus({size:13,color:V.accent})} Add Set</Btn>
                  {!isCardio(ex.exerciseId,s.exercises)&&ex.sets.some(st=>parseFloat(st.weight)>0)&&!ex.sets.some(st=>st.warmup)&&(
                    <Btn v="small" onClick={()=>addWarmups(ei)} s={{flex:0,flexShrink:0,fontSize:10,padding:"6px 10px",background:`${V.warn}10`,color:V.warn,border:`1px solid ${V.warn}20`}}>🔥 Warm-up</Btn>
                  )}
                </div>
                {/* #4: Notes per exercise */}
                <input value={ex.note||""} onChange={e=>updExNote(ei,e.target.value)} placeholder="Notes (form cues, tempo...)"
                  style={{width:"100%",marginTop:8,padding:"8px 10px",background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,
                    borderRadius:8,color:V.text3,fontSize:11,outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
              </div>
            );
          })}

          {/* Rating */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Workout Rating</div>
            <div style={{display:"flex",gap:6}}>
              {[1,2,3,4,5].map(r=>(
                <button key={r} onClick={()=>setForm(f=>({...f,rating:r}))}
                  style={{fontSize:22,background:"none",border:"none",cursor:"pointer",padding:4,
                    color:r<=form.rating?V.warn:V.text3,WebkitTapHighlightColor:"transparent"}}>★</button>
              ))}
            </div>
          </div>

          <Field label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="How did it feel?"/>
          {valWarnings&&<ValidationWarning warnings={valWarnings} onConfirm={()=>{setValWarnings(null);save();}} onCancel={()=>setValWarnings(null)}/>}
        </Sheet>
      )}

      {/* Delete confirmation */}
      {confirmDel&&<ConfirmDialog msg="Delete workout?" detail={`${fmtFull(confirmDel.date)} — this cannot be undone.`}
        onConfirm={()=>{Undo.set("Workout deleted",confirmDel,"workout");d({type:"DEL_W",id:confirmDel.id});setConfirmDel(null);SuccessToastCtrl.show("Workout deleted");}}
        onCancel={()=>setConfirmDel(null)}/>}

      {/* #11: Crash recovery banner — prompt user to resume a workout saved before a crash/close */}
      {crashWorkout&&!show&&(
        <Card style={{background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.4)",padding:14}}>
          <div style={{fontSize:13,fontWeight:700,color:V.warn,marginBottom:6}}>⚡ Unsaved workout found</div>
          <div style={{fontSize:11,color:V.text3,marginBottom:10}}>
            {crashWorkout.exercises?.length||0} exercise{(crashWorkout.exercises?.length||0)!==1?"s":""} — saved {Math.round((Date.now()-new Date(crashWorkout.savedAt).getTime())/60000)} min ago
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn full onClick={()=>{setForm({date:crashWorkout.date||today(),dur:crashWorkout.dur||"",exercises:crashWorkout.exercises||[],notes:crashWorkout.notes||"",rating:crashWorkout.rating||3});setStartTime(crashWorkout.startTime||Date.now());setElapsed(0);setShow(true);setCrashWorkout(null);}}>Resume</Btn>
            <Btn v="secondary" onClick={()=>{ActiveWorkoutStore.clear();setCrashWorkout(null);}}>Discard</Btn>
            <Btn v="ghost" onClick={()=>setCrashWorkout(null)} s={{flexShrink:0,color:V.text3,fontSize:11}}>Later</Btn>
          </div>
        </Card>
      )}

      {/* History */}
      {s.workouts.length>0&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text3}}>HISTORY</div>
          {volTrend&&(
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:6,
              background:volTrend.up?"rgba(34,197,94,0.12)":"rgba(244,63,94,0.12)",
              color:volTrend.up?"#22c55e":"#f43f5e"}}>
              {volTrend.up?"↗":"↘"} {Math.abs(volTrend.pct)}% vs last session
            </span>
          )}
        </div>
      )}
      {s.workouts.length>3&&(
        <div style={{position:"relative"}}>
          <input value={histSearch} onChange={e=>setHistSearch(e.target.value)}
            placeholder="Search by exercise..."
            style={{width:"100%",padding:"8px 12px 8px 32px",background:"rgba(255,255,255,0.04)",
              border:`1px solid ${V.cardBorder}`,borderRadius:10,color:V.text,fontSize:12,
              outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12,opacity:0.4}}>🔍</span>
          {histSearch&&<button onClick={()=>setHistSearch("")} style={{position:"absolute",right:8,top:"50%",
            transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:V.text3,padding:2}}>×</button>}
        </div>
      )}
      {(()=>{
        const filteredW=histSearch.trim()
          ?s.workouts.filter(w=>w.exercises.some(ex=>(s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId).toLowerCase().includes(histSearch.toLowerCase())))
          :s.workouts;
        return filteredW.length===0?(
          <div style={{textAlign:"center",padding:40,color:V.text3,fontSize:13}}>{histSearch?"No workouts match that exercise":"No workouts yet"}</div>
        ):filteredW.slice(0,showAll?999:15).map(w=>{
        const vol=w.exercises.reduce((s2,e)=>{const c=isCardio(e.exerciseId,s.exercises);return s2+e.sets.filter(st=>!st.warmup).reduce((ss,st)=>ss+(c?(parseFloat(st.duration)||0):(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)),0);},0);
        const expanded=expandedId===w.id;
        return(
          <Card key={w.id} onClick={()=>setExpandedId(expanded?null:w.id)} style={{padding:14,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,color:V.text2}}>{fmtFull(w.date)}</span>
                {w.rating&&<span style={{fontSize:11,color:V.warn,letterSpacing:1}}>{Array.from({length:w.rating}).map(()=>"★").join("")}</span>}
                {(()=>{const hasPR=w.exercises.some(ex=>prs[ex.exerciseId]?.date===w.date);return hasPR?<span style={{fontSize:8,fontWeight:800,color:"#f59e0b",background:"rgba(245,158,11,0.12)",padding:"1px 5px",borderRadius:4}}>🎯 PR</span>:null;})()}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:10,color:V.text3}}>{w.dur}min</span>
                <button onClick={async(e)=>{e.stopPropagation();
                  const exNames=w.exercises.map(ex=>s.exercises.find(e2=>e2.id===ex.exerciseId)?.name||ex.exerciseId);
                  const stats=[{value:w.exercises.length,label:"EXERCISES",color:"#22c55e"},
                    {value:w.exercises.reduce((a,e2)=>a+e2.sets.length,0),label:"SETS",color:"#06b6d4"},
                    {value:vol>1000?`${(vol/1000).toFixed(1)}k`:vol,label:"VOLUME",color:"#a78bfa"}];
                  const c=await ShareCard.generate("💪 Workout Complete",stats,`${fmtFull(w.date)} · ${exNames.slice(0,3).join(", ")}${exNames.length>3?" +more":""}`);
                  ShareCard.share(c,`ironlog-workout-${w.date}.png`);
                }} aria-label="Share workout" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>
                  <span style={{fontSize:10,color:V.text3}}>📤</span></button>
                <button onClick={e=>{e.stopPropagation();setEditingId(w.id);setForm({date:w.date,dur:w.dur?.toString()||"",exercises:w.exercises,notes:w.notes||"",rating:w.rating||3});setShow(true);}}
                  aria-label="Edit workout" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.edit?.({size:12,color:V.text3})||<span style={{fontSize:10,color:V.text3}}>✏️</span>}</button>
                <button onClick={e=>{e.stopPropagation();setConfirmDel(w);}} aria-label="Delete workout"
                  style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:12,color:V.text3})}</button>
              </div>
            </div>
            {w.exercises.map((ex,i)=>{
              const exInfo=s.exercises.find(e=>e.id===ex.exerciseId);
              const cardio=isCardio(ex.exerciseId,s.exercises);
              const top=cardio
                ?ex.sets.reduce((m,st)=>(parseFloat(st.duration)||0)>(parseFloat(m.duration)||0)?st:m,{duration:0,distance:0})
                :ex.sets.reduce((m,st)=>st.weight>m.weight?st:m,{weight:0,reps:0});
              return(
                <div key={i}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",
                    borderBottom:i<w.exercises.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:12,color:V.text}}>{exInfo?.name||ex.exerciseId}</span>
                      <YTBtn yt={exInfo?.yt} size={18}/>
                    </div>
                    <span style={{fontSize:11,color:V.accent,fontFamily:V.mono}}>{cardio?`${top.duration}min · ${top.distance}${dUnit(s.units)}`:`${top.weight}×${top.reps} · ${ex.sets.length}s`}</span>
                  </div>
                  {/* #7 Expanded detail: all sets */}
                  {expanded&&(
                    <div style={{padding:"4px 0 8px 12px"}}>
                      {ex.sets.map((st,si)=>(
                        <div key={si} style={{display:"flex",gap:8,fontSize:10,color:V.text3,padding:"2px 0",alignItems:"center"}}>
                          <span>Set {si+1}:</span>
                          {cardio?(
                            <span style={{color:V.accent,fontFamily:V.mono}}>{st.duration}min · {st.distance}{dUnit(s.units)}</span>
                          ):(
                            <span style={{color:V.accent,fontFamily:V.mono}}>{st.weight}×{st.reps}</span>
                          )}
                          {st.rpe>0&&<span>RPE {st.rpe}</span>}
                          {!cardio&&st.drop&&<span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:`${V.accent2}15`,color:V.accent2,fontWeight:700}}>DROP</span>}
                          {!cardio&&st.fail&&<span style={{fontSize:8,padding:"1px 4px",borderRadius:3,background:`${V.danger}15`,color:V.danger,fontWeight:700}}>FAIL</span>}
                        </div>
                      ))}
                      {ex.note&&<div style={{fontSize:9,color:V.text3,fontStyle:"italic",marginTop:4}}>📝 {ex.note}</div>}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{marginTop:4,fontSize:11,color:V.accent2,fontFamily:V.mono,textAlign:"right"}}>{vol.toLocaleString()} {wUnit(s.units)}</div>
            {expanded&&w.notes&&<div style={{fontSize:10,color:V.text3,fontStyle:"italic",marginTop:4}}>{w.notes}</div>}
            {expanded&&(
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <button onClick={e=>{e.stopPropagation();setShareWorkout(shareWorkout===w.id?null:w.id);}}
                  style={{padding:"4px 10px",borderRadius:6,background:`${V.accent}10`,border:`1px solid ${V.accent}20`,
                    cursor:"pointer",fontSize:9,fontWeight:700,color:V.accent,fontFamily:V.font}}>
                  {shareWorkout===w.id?"Hide":"Share"} Card
                </button>
                <button onClick={e=>{e.stopPropagation();
                  setForm({date:today(),dur:"",exercises:w.exercises.map(ex=>({...ex,sets:ex.sets.filter(st=>!st.warmup).map(st=>({...st,done:false}))})),notes:"",rating:3});
                  setShow(true);setStartTime(Date.now());setElapsed(0);setEditingId(null);
                  SuccessToastCtrl.show("Loaded — adjust and save");}}
                  style={{padding:"4px 10px",borderRadius:6,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",
                    cursor:"pointer",fontSize:9,fontWeight:700,color:"#22c55e",fontFamily:V.font}}>
                  🔁 Do Again
                </button>
              </div>
            )}
            {shareWorkout===w.id&&<div style={{marginTop:8}}><WorkoutCard workout={w} s={s}/></div>}
          </Card>
        );
      });
      })()}
      {s.workouts.length>15&&!showAll&&(
        <button onClick={()=>setShowAll(true)} style={{width:"100%",padding:12,background:"rgba(255,255,255,0.02)",
          border:`1px solid ${V.cardBorder}`,borderRadius:10,cursor:"pointer",fontSize:11,color:V.accent,fontWeight:600,fontFamily:V.font}}>
          Show all {s.workouts.length} workouts
        </button>
      )}
    </div>
  );
}


// ═══════════════════════════════════════
//  NUTRITION TAB
// ═══════════════════════════════════════
