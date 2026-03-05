import React, { useState, useEffect, useMemo, useRef } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, ago, fmtShort, fmtFull, uid } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl } from '../shared/index.jsx';
import { wUnit } from '../../data/plates.js';
import { PROGRAMS } from '../../data/programs.js';
import { FF_HACKS, FF_BRANDS } from '../../data/fastfood.js';
import { EXERCISE_SUBS, JOINT_MAP } from '../../data/substitutions.js';
import { CloudSync } from '../../services/sync.js';
import { SocialAPI } from '../../services/social.js';

// ─── Log Hub: Central action screen ───
// ─── #2 Goal Engine + Milestones ───
function GoalEngine({s,d}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({type:"weight",target:"",deadline:"",label:""});

  const goals=s.milestones||[];

  const addGoal=()=>{
    if(!form.target||!form.deadline)return;
    const g={id:uid(),type:form.type,target:parseFloat(form.target),deadline:form.deadline,
      label:form.label||`${form.type==="weight"?"Reach":"Hit"} ${form.target}`,
      created:today(),completed:false};
    d({type:"SET_MILESTONES",milestones:[...goals,g]});
    SuccessToastCtrl.show("Goal created");
    setForm({type:"weight",target:"",deadline:"",label:""});
    setShowAdd(false);
  };

  const deleteGoal=(id)=>{d({type:"SET_MILESTONES",milestones:goals.filter(g=>g.id!==id)});SuccessToastCtrl.show("Goal deleted");};
  const completeGoal=(id)=>{d({type:"SET_MILESTONES",milestones:goals.map(g=>g.id===id?{...g,completed:true,completedDate:today()}:g)});SuccessToastCtrl.show("Goal completed! 🎉");};

  const calcProgress=(g)=>{
    if(g.type==="weight"){
      const bw=s.body.find(b=>b.weight)?.weight||0;
      const startBW=s.body.slice(-1)[0]?.weight||bw;
      if(!startBW||!bw)return 0;
      const total=Math.abs(g.target-startBW);
      const done=Math.abs(bw-startBW);
      return total>0?Math.min(100,Math.round((done/total)*100)):0;
    }
    if(g.type==="strength"){
      const lifts={"bench":"bench","squat":"squat","deadlift":"deadlift","ohp":"ohp"};
      let maxW=0;
      s.workouts.forEach(w=>w.exercises.forEach(ex=>{
        ex.sets.forEach(st=>{if(st.weight>maxW)maxW=st.weight;});
      }));
      return maxW>=g.target?100:Math.min(99,Math.round((maxW/g.target)*100));
    }
    if(g.type==="nutrition"){
      const last30=s.nutrition.filter(n=>n.date>=ago(30));
      const hits=last30.filter(n=>n.protein>=s.goals.protein*.8).length;
      const target=parseInt(g.target)||25;
      return Math.min(100,Math.round((hits/target)*100));
    }
    if(g.type==="consistency"){
      const last30=s.workouts.filter(w=>w.date>=ago(30)).length;
      return Math.min(100,Math.round((last30/parseInt(g.target||16))*100));
    }
    return 0;
  };

  const daysLeft=(deadline)=>{
    const d2=Math.ceil((new Date(deadline)-new Date(today()))/(86400000));
    return d2;
  };

  const types=[
    {id:"weight",label:"Weight Goal",icon:"⚖️",ex:"Lose 10 lbs by summer"},
    {id:"strength",label:"Strength PR",icon:"💪",ex:"Bench 225 lbs"},
    {id:"nutrition",label:"Nutrition Streak",icon:"🥩",ex:"Hit protein 25/30 days"},
    {id:"consistency",label:"Consistency",icon:"🔥",ex:"Train 16x this month"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Goals & Milestones</div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",borderRadius:8,
          background:`${V.accent}12`,border:`1px solid ${V.accent}25`,cursor:"pointer",
          WebkitTapHighlightColor:"transparent",fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>
          + New Goal
        </button>
      </div>

      {goals.filter(g=>!g.completed).length===0&&!showAdd&&(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🎯</div>
          <div style={{fontSize:13,fontWeight:600,color:V.text,marginBottom:4}}>No active goals</div>
          <div style={{fontSize:11,color:V.text3}}>Set a target to stay focused and track progress</div>
        </Card>
      )}

      {goals.filter(g=>!g.completed).map(g=>{
        const pct=calcProgress(g);
        const dl=daysLeft(g.deadline);
        const c=pct>=100?V.accent:dl<0?V.danger:dl<7?V.warn:V.accent2;
        return(
          <Card key={g.id} style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:V.text}}>{g.label}</div>
                <div style={{fontSize:10,color:V.text3,marginTop:2}}>
                  {dl>0?`${dl} days left`:<span style={{color:V.danger}}>Overdue</span>}
                  {" · "}Target: {g.target}{g.type==="weight"?` ${s.units}`:g.type==="nutrition"?" days":""}
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {pct>=100&&<button onClick={()=>completeGoal(g.id)} style={{padding:"4px 8px",borderRadius:6,
                  background:`${V.accent}15`,border:"none",cursor:"pointer",fontSize:10,color:V.accent,fontWeight:700}}>✓ Done</button>}
                <button onClick={()=>deleteGoal(g.id)} style={{padding:"4px 8px",borderRadius:6,
                  background:"rgba(255,107,107,0.08)",border:"none",cursor:"pointer",fontSize:10,color:V.danger}}>✕</button>
              </div>
            </div>
            <Progress val={pct} max={100} color={c} h={8}/>
            <div style={{fontSize:10,color:c,fontWeight:700,marginTop:4,fontFamily:V.mono}}>{pct}%</div>
          </Card>
        );
      })}

      {/* Completed goals */}
      {goals.filter(g=>g.completed).length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:V.text3,marginBottom:6}}>Completed</div>
          {goals.filter(g=>g.completed).map(g=>(
            <Card key={g.id} style={{padding:10,marginBottom:6,opacity:0.6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:V.accent}}>✓</span>
                <span style={{fontSize:12,color:V.text,fontWeight:600}}>{g.label}</span>
                <span style={{flex:1}}/>
                <span style={{fontSize:9,color:V.text3}}>{g.completedDate}</span>
                <button onClick={()=>deleteGoal(g.id)} style={{background:"none",border:"none",cursor:"pointer",
                  fontSize:10,color:V.text3,padding:"2px 6px"}}>✕</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd&&(
        <Sheet title="New Goal" onClose={()=>setShowAdd(false)}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {types.map(t=>(
              <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))} style={{
                padding:"10px 14px",borderRadius:10,border:`1.5px solid ${form.type===t.id?V.accent:V.cardBorder}`,
                background:form.type===t.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",WebkitTapHighlightColor:"transparent",textAlign:"left"
              }}>
                <div style={{fontSize:14}}>{t.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:form.type===t.id?V.accent:V.text,marginTop:2}}>{t.label}</div>
                <div style={{fontSize:9,color:V.text3}}>{t.ex}</div>
              </button>
            ))}
          </div>
          <Field label="Label" value={form.label} onChange={v=>setForm(f=>({...f,label:v}))} placeholder="e.g. Bench 225 by August"/>
          <Field label="Target Number" type="number" value={form.target} onChange={v=>setForm(f=>({...f,target:v}))}
            placeholder={form.type==="weight"?"Target weight":form.type==="strength"?"Weight to hit":form.type==="nutrition"?"Days to hit":"Sessions per month"}/>
          <Field label="Deadline" type="date" value={form.deadline} onChange={v=>setForm(f=>({...f,deadline:v}))}/>
          <Btn full onClick={addGoal} s={{marginTop:8}}>{Icons.check({size:16,color:V.bg})} Set Goal</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── #1 Adaptive Program Builder ───
function AdaptiveCoach({s}){
  const r=useMemo(()=>calcReadiness(s),[s.workouts,s.nutrition,s.checkins,s.goals]);
  const dow=new Date().getDay();
  const todayType=s.schedule.overrides[today()]||s.schedule.weekly[dow]||"Rest";
  const u=wUnit(s.units);

  // Generate today's recommended workout based on schedule + readiness
  const program=useMemo(()=>{
    if(todayType==="Rest")return{type:"rest",message:"Recovery day. Focus on stretching, mobility, or light cardio.",exercises:[]};

    // Map muscle groups to exercises
    const muscleMap={
      "Push":["bench","incbench","ohp","lateralraise","tricep","dip"],
      "Pull":["deadlift","row","pullup","latpull","curl","facepull"],
      "Legs":["squat","legpress","rdl","hamcurl","hipthrust","calfraise"],
      "Chest":["bench","incbench","dbbench","flye","pecfly","dip"],
      "Back":["deadlift","row","pullup","latpull","cablerow","dbrow"],
      "Shoulders":["ohp","dbohp","lateralraise","facepull","reardelt","shrug"],
      "Arms":["curl","hammercurl","preacher","tricep","skullcrusher","ohtriext"],
      "Upper Body":["bench","row","ohp","latpull","curl","tricep"],
      "Lower Body":["squat","rdl","legpress","hamcurl","hipthrust","calfraise"],
      "Full Body":["squat","bench","row","ohp","deadlift","curl"],
      "Cardio":[]
    };

    const exIds=muscleMap[todayType]||muscleMap["Full Body"];
    if(exIds.length===0)return{type:"cardio",message:"Cardio day. 20-40 min steady state or HIIT.",exercises:[]};

    // Look up last performance for each exercise
    const recs=exIds.slice(0,r.score>=60?6:r.score>=40?5:4).map(eid=>{
      const ex=s.exercises.find(e=>e.id===eid);
      if(!ex)return null;

      // Find last time this exercise was done
      let lastSets=null;
      for(const w of s.workouts){
        const found=w.exercises.find(e=>e.exerciseId===eid);
        if(found){lastSets=found.sets;break;}
      }

      // Volume adjustment based on readiness
      let setCount=lastSets?lastSets.length:3;
      let weightMult=1.0;
      if(r.score>=80){weightMult=1.025;} // Push for progression
      else if(r.score>=60){weightMult=1.0;} // Maintain
      else if(r.score>=40){weightMult=0.9;setCount=Math.max(2,setCount-1);} // Reduce
      else{weightMult=0.8;setCount=Math.max(2,setCount-1);} // Deload

      const targetWeight=lastSets?Math.round(Math.max(...lastSets.map(st=>st.weight))*weightMult/5)*5:0;
      const targetReps=lastSets?Math.round(lastSets.reduce((s2,st)=>s2+st.reps,0)/lastSets.length):8;

      return{id:eid,name:ex.name,sets:setCount,reps:targetReps,weight:targetWeight,
        note:weightMult>1?"↑ Push weight":weightMult<0.95?"↓ Deload":"→ Maintain"};
    }).filter(Boolean);

    return{type:"workout",message:r.rec,exercises:recs};
  },[s.workouts,s.exercises,s.schedule,todayType,r]);

  if(program.type==="rest"){
    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Today's Program</div>
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🧘</div>
          <div style={{fontSize:14,fontWeight:700,color:V.text,marginBottom:4}}>Recovery Day</div>
          <div style={{fontSize:12,color:V.text3,lineHeight:1.5}}>{program.message}</div>
        </Card>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Today's Program</div>
          <div style={{fontSize:11,color:V.text3}}>{todayType} · Readiness {r.score}/100</div>
        </div>
        <div style={{padding:"4px 10px",borderRadius:8,background:`${r.color}15`,border:`1px solid ${r.color}25`}}>
          <span style={{fontSize:10,fontWeight:700,color:r.color}}>{r.level}</span>
        </div>
      </div>

      {/* Readiness-based note */}
      {r.score<60&&(
        <div style={{padding:"8px 12px",borderRadius:8,background:`${V.warn}08`,border:`1px solid ${V.warn}15`}}>
          <span style={{fontSize:11,color:V.warn}}>{program.message}</span>
        </div>
      )}

      {program.exercises.map((ex,i)=>(
        <Card key={ex.id} style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}12`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:12,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{i+1}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:V.text}}>{ex.name}</div>
              <div style={{fontSize:11,color:V.text3}}>
                {ex.sets}×{ex.reps} @ {ex.weight>0?`${ex.weight} ${u}`:"bodyweight"}
                <span style={{marginLeft:6,fontSize:9,color:ex.note.includes("↑")?V.accent:ex.note.includes("↓")?V.warn:V.text3,
                  fontWeight:600}}>{ex.note}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── #3 Cloud Sync Status Bar ───
function SyncStatus({s}){
  const lastSync=LS.get("ft-last-sync");
  const email=s.profile?.email;
  const [pending,setPending]=useState(parseInt(LS.get("ft-pending-sync"))||0);
  const [retrying,setRetrying]=useState(false);

  // Listen for sync completion from SW
  useEffect(()=>{
    const handler=(e)=>{
      if(e.data?.type==="SYNC_COMPLETE"){setPending(e.data.remaining||0);LS.set("ft-pending-sync",e.data.remaining||0);}
      if(e.data?.type==="QUEUE_COUNT"){setPending(e.data.count||0);}
    };
    navigator.serviceWorker?.addEventListener("message",handler);
    // Ask SW for current queue count
    navigator.serviceWorker?.controller?.postMessage({type:"GET_QUEUE_COUNT"});
    return()=>navigator.serviceWorker?.removeEventListener("message",handler);
  },[]);

  // Also update from localStorage on interval
  useEffect(()=>{
    const iv=setInterval(()=>setPending(parseInt(LS.get("ft-pending-sync"))||0),5000);
    return()=>clearInterval(iv);
  },[]);

  const retry=async()=>{
    setRetrying(true);
    const result=await SyncQueue.processAll();
    setPending(result.remaining);
    setRetrying(false);
  };

  const fmtAgo=(iso)=>{
    if(!iso)return"Never";
    const sec=Math.floor((Date.now()-new Date(iso).getTime())/1000);
    if(sec<60)return"Just now";
    if(sec<3600)return`${Math.floor(sec/60)}m ago`;
    if(sec<86400)return`${Math.floor(sec/3600)}h ago`;
    return`${Math.floor(sec/86400)}d ago`;
  };

  if(!email)return null;

  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",
        background:pending>0?"rgba(255,159,67,0.06)":"rgba(255,255,255,0.02)",
        borderRadius:6,border:`1px solid ${pending>0?"rgba(255,159,67,0.15)":V.cardBorder}`}}>
        <div style={{width:5,height:5,borderRadius:3,background:pending>0?V.warn:lastSync?V.accent:"rgba(255,255,255,0.15)"}}/>
        <span style={{fontSize:8,color:pending>0?V.warn:V.text3,fontWeight:600}}>
          {pending>0?`${pending} pending`:lastSync?`${fmtAgo(lastSync)}`:"No sync"}
        </span>
      </div>
      {pending>0&&(
        <button onClick={retry} disabled={retrying} style={{padding:"3px 6px",borderRadius:4,background:`${V.warn}12`,
          border:"none",cursor:"pointer",fontSize:7,color:V.warn,fontWeight:700}}>
          {retrying?"…":"Retry"}
        </button>
      )}
    </div>
  );
}

// ─── #8 Social: Workout Proof Card Generator ───
function WorkoutCard({workout,s}){
  const canvasRef=useRef(null);
  const [generated,setGenerated]=useState(false);

  const generateCard=()=>{
    const c=canvasRef.current;if(!c)return;
    const ctx=c.getContext("2d");
    c.width=600;c.height=400;

    // Background gradient
    const grad=ctx.createLinearGradient(0,0,600,400);
    grad.addColorStop(0,"#0a0a14");grad.addColorStop(1,"#14142a");
    ctx.fillStyle=grad;ctx.fillRect(0,0,600,400);

    // Accent bar
    ctx.fillStyle="#22d3ee";ctx.fillRect(0,0,4,400);

    // Title
    ctx.fillStyle="#ffffff";ctx.font="bold 28px -apple-system, sans-serif";
    ctx.fillText("WORKOUT COMPLETE",24,48);

    // Date
    ctx.fillStyle="#888";ctx.font="14px -apple-system, sans-serif";
    ctx.fillText(new Date(workout.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}),24,72);

    // Stats row
    const totalSets=workout.exercises.reduce((n,e)=>n+e.sets.length,0);
    const totalVol=workout.exercises.reduce((v,e)=>v+e.sets.reduce((s2,st)=>s2+st.weight*st.reps,0),0);
    const stats=[
      {l:"Duration",v:`${workout.dur||0}min`},{l:"Exercises",v:workout.exercises.length},
      {l:"Sets",v:totalSets},{l:"Volume",v:totalVol>1000?`${(totalVol/1000).toFixed(1)}k`:totalVol}
    ];

    stats.forEach((st,i)=>{
      const x=24+i*145;
      ctx.fillStyle="#22d3ee";ctx.font="bold 32px -apple-system, sans-serif";
      ctx.fillText(String(st.v),x,130);
      ctx.fillStyle="#666";ctx.font="11px -apple-system, sans-serif";
      ctx.fillText(st.l.toUpperCase(),x,148);
    });

    // Exercise list
    ctx.fillStyle="#444";ctx.fillRect(24,170,552,1);
    workout.exercises.slice(0,5).forEach((ex,i)=>{
      const y=198+i*36;
      const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      const best=Math.max(...ex.sets.map(st=>st.weight));
      ctx.fillStyle="#ddd";ctx.font="14px -apple-system, sans-serif";
      ctx.fillText(name,24,y);
      ctx.fillStyle="#22d3ee";ctx.font="bold 14px -apple-system, sans-serif";
      ctx.fillText(`${ex.sets.length}×${ex.sets[0]?.reps||0} @ ${best} ${wUnit(s.units)}`,400,y);
    });

    // Branding
    ctx.fillStyle="#333";ctx.font="bold 12px -apple-system, sans-serif";
    ctx.fillText("IRONLOG",24,380);
    ctx.fillStyle="#555";ctx.font="11px -apple-system, sans-serif";
    ctx.fillText("ironlog.space",110,380);

    // Rating stars
    if(workout.rating){
      ctx.fillStyle="#f59e0b";ctx.font="16px sans-serif";
      ctx.fillText("★".repeat(workout.rating),500,380);
    }

    setGenerated(true);
  };

  const share=()=>{
    const c=canvasRef.current;if(!c)return;
    c.toBlob(blob=>{
      if(navigator.share&&blob){
        navigator.share({files:[new File([blob],"workout.png",{type:"image/png"})],
          title:"Workout Complete",text:"Another one in the books 💪"}).catch(()=>{});
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=url;a.download=`workout-${workout.date}.png`;a.click();
        URL.revokeObjectURL(url);
      }
    },"image/png");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <canvas ref={canvasRef} style={{width:"100%",borderRadius:12,display:generated?"block":"none"}}/>
      {!generated?(
        <Btn full onClick={generateCard}>{Icons.target({size:14,color:V.bg})} Generate Proof Card</Btn>
      ):(
        <div style={{display:"flex",gap:8}}>
          <Btn full onClick={share}>{Icons.upload({size:14,color:V.bg})} Share</Btn>
          <Btn v="secondary" full onClick={()=>setGenerated(false)}>Close</Btn>
        </div>
      )}
    </div>
  );
}

// ─── #6 Form Check Workflow ───
function FormCheckTab({s,d}){
  const [selEx,setSelEx]=useState(null);
  const [recording,setRecording]=useState(false);
  const [videoUrl,setVideoUrl]=useState(null);
  const mediaRef=useRef(null);
  const videoRef=useRef(null);
  const chunks=useRef([]);

  const formCues={
    bench:["Bar path: straight up, slight arc back","Scapulae retracted and depressed","Feet flat, arch in lower back","Full ROM: bar to chest","Elbows ~45° angle"],
    squat:["Feet shoulder width, toes slightly out","Hit parallel or below","Knees track over toes","Chest up, neutral spine","Drive through heels"],
    deadlift:["Bar over mid-foot","Hips hinge, not squat","Lats engaged, no rounding","Lockout: hips fully extended","Bar close to body throughout"],
    ohp:["Core braced, glutes tight","Bar starts at collarbone","Press straight up, head through","Full lockout overhead","No excessive back lean"],
    row:["Torso ~45° angle","Pull to lower chest/stomach","Squeeze shoulder blades","Control the eccentric","No excessive body English"],
    pullup:["Full hang at bottom","Pull chest to bar","Scapulae retract at top","Control descent","No kipping unless intended"],
    curl:["Elbows pinned to sides","Full ROM: extend and contract","No swinging body","Squeeze at top","Control negative"],
  };

  const defaultCues=["Full range of motion","Control the eccentric (lowering)","Maintain neutral spine","Breathe: exhale on exertion","Focus on mind-muscle connection"];

  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
      videoRef.current.srcObject=stream;
      videoRef.current.play();
      const mr=new MediaRecorder(stream);
      chunks.current=[];
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data);};
      mr.onstop=()=>{
        const blob=new Blob(chunks.current,{type:"video/webm"});
        setVideoUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t=>t.stop());
      };
      mediaRef.current=mr;
      mr.start();
      setRecording(true);
    }catch(e){
      alert("Camera access needed for form check.");
    }
  };

  const stopRec=()=>{
    if(mediaRef.current&&mediaRef.current.state==="recording"){
      mediaRef.current.stop();
      setRecording(false);
    }
  };

  const exercises=s.exercises.filter(e=>["Chest","Back","Legs","Shoulders","Arms"].includes(e.cat)).slice(0,20);
  const cues=formCues[selEx]||defaultCues;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Form Check</div>
      <div style={{fontSize:12,color:V.text3}}>Record a set and review against form cues</div>

      {/* Exercise selector */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {exercises.slice(0,8).map(ex=>(
          <button key={ex.id} onClick={()=>setSelEx(ex.id)} style={{
            padding:"6px 12px",borderRadius:8,border:`1.5px solid ${selEx===ex.id?V.accent:V.cardBorder}`,
            background:selEx===ex.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",WebkitTapHighlightColor:"transparent",
            fontSize:11,fontWeight:600,color:selEx===ex.id?V.accent:V.text3,fontFamily:V.font
          }}>{ex.name.length>15?ex.name.slice(0,15)+"…":ex.name}</button>
        ))}
      </div>

      {selEx&&(
        <div>
          {/* Form cues checklist */}
          <Card style={{padding:12,marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Form Cues: {s.exercises.find(e=>e.id===selEx)?.name}</div>
            {cues.map((cue,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
                <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${V.accent}40`,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                  <span style={{fontSize:10,color:V.accent}}>✓</span>
                </div>
                <span style={{fontSize:11,color:V.text2,lineHeight:1.5}}>{cue}</span>
              </div>
            ))}
          </Card>

          {/* Video area */}
          <Card style={{padding:12}}>
            <video ref={videoRef} style={{width:"100%",borderRadius:8,background:"#000",display:recording?"block":"none"}} playsInline muted/>
            {videoUrl&&!recording&&(
              <video src={videoUrl} style={{width:"100%",borderRadius:8}} controls playsInline/>
            )}
            <div style={{display:"flex",gap:8,marginTop:10}}>
              {!recording&&!videoUrl&&(
                <Btn full onClick={startRec}>{Icons.target({size:14,color:V.bg})} Record Set</Btn>
              )}
              {recording&&(
                <Btn full onClick={stopRec} s={{background:V.danger}}>{Icons.x({size:14,color:"#fff"})} Stop</Btn>
              )}
              {videoUrl&&!recording&&(
                <div style={{display:"flex",gap:8,width:"100%"}}>
                  <Btn v="secondary" full onClick={()=>{setVideoUrl(null);}}>Retake</Btn>
                  <Btn full onClick={()=>{
                    const a=document.createElement("a");a.href=videoUrl;a.download=`formcheck-${selEx}-${today()}.webm`;a.click();
                  }}>{Icons.download({size:14,color:V.bg})} Save</Btn>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {!selEx&&(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:12,color:V.text3}}>Select an exercise above to see form cues and record a set</div>
        </Card>
      )}
    </div>
  );
}

// ─── #1 Data Integrity Safeguards ───
function useDataGuard(s){
  return useMemo(()=>{
    const warnings=[];
    // Body weight outliers
    const bw=s.body.filter(b=>b.weight>0).sort((a,b)=>a.date.localeCompare(b.date));
    for(let i=1;i<bw.length;i++){
      const diff=Math.abs(bw[i].weight-bw[i-1].weight);
      if(diff>15){warnings.push({type:"body",severity:"high",msg:`Weight jump: ${bw[i-1].weight}→${bw[i].weight} (${diff>0?"+":""}${(bw[i].weight-bw[i-1].weight).toFixed(1)} ${s.units}) on ${bw[i].date}`,date:bw[i].date,id:bw[i].id});}
      else if(diff>8){warnings.push({type:"body",severity:"med",msg:`Unusual weight change: ${diff.toFixed(1)} ${s.units} on ${bw[i].date}`,date:bw[i].date,id:bw[i].id});}
    }
    // Workout weight outliers per exercise
    const exMap={};
    s.workouts.forEach(w=>w.exercises.forEach(ex=>{
      ex.sets.forEach(st=>{if(st.weight>0){if(!exMap[ex.exerciseId])exMap[ex.exerciseId]=[];exMap[ex.exerciseId].push({w:st.weight,date:w.date,id:w.id});}});
    }));
    Object.entries(exMap).forEach(([eid,entries])=>{
      if(entries.length<3)return;
      const avg=entries.reduce((s2,e)=>s2+e.w,0)/entries.length;
      const std=Math.sqrt(entries.reduce((s2,e)=>s2+Math.pow(e.w-avg,2),0)/entries.length);
      entries.forEach(e=>{
        if(Math.abs(e.w-avg)>std*2.5&&std>10){
          const name=s.exercises.find(x=>x.id===eid)?.name||eid;
          warnings.push({type:"workout",severity:"med",msg:`${name}: ${e.w} ${s.units} is unusual (avg: ${Math.round(avg)}) on ${e.date}`,date:e.date,id:e.id});
        }
      });
    });
    // Duplicate workout detection (same date, very similar exercises)
    const dateMap={};
    s.workouts.forEach(w=>{if(!dateMap[w.date])dateMap[w.date]=[];dateMap[w.date].push(w);});
    Object.entries(dateMap).forEach(([date,ws])=>{
      if(ws.length>1){
        for(let i=1;i<ws.length;i++){
          const exA=ws[0].exercises.map(e=>e.exerciseId).sort().join(",");
          const exB=ws[i].exercises.map(e=>e.exerciseId).sort().join(",");
          if(exA===exB)warnings.push({type:"duplicate",severity:"high",msg:`Duplicate workout on ${date} (same exercises)`,date,id:ws[i].id});
          else warnings.push({type:"duplicate",severity:"low",msg:`Multiple workouts on ${date}`,date,id:ws[i].id});
        }
      }
    });
    // Calorie sanity
    s.nutrition.forEach(n=>{
      if(n.cal>6000)warnings.push({type:"nutrition",severity:"med",msg:`${n.cal} cal on ${n.date} seems high`,date:n.date,id:n.id});
      if(n.cal>0&&n.cal<500)warnings.push({type:"nutrition",severity:"low",msg:`Only ${n.cal} cal on ${n.date}`,date:n.date,id:n.id});
      if(n.protein>400)warnings.push({type:"nutrition",severity:"med",msg:`${n.protein}g protein on ${n.date} seems high`,date:n.date,id:n.id});
    });
    return warnings.sort((a,b)=>{const sev={high:0,med:1,low:2};return(sev[a.severity]||2)-(sev[b.severity]||2);});
  },[s.workouts,s.body,s.nutrition,s.exercises,s.units]);
}

function DataGuardTab({s,d}){
  const warnings=useDataGuard(s);
  const sevColor={high:V.danger,med:V.warn,low:V.text3};
  const sevLabel={high:"Critical",med:"Warning",low:"Info"};

  const deleteItem=(w)=>{
    if(w.type==="workout"||w.type==="duplicate")d({type:"DEL_W",id:w.id});
    else if(w.type==="body")d({type:"DEL_B",id:w.id});
    else if(w.type==="nutrition")d({type:"DEL_N",id:w.id});
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Data Integrity</div>
      <div style={{fontSize:12,color:V.text3}}>Auto-scanned for outliers, duplicates, and suspicious values</div>

      {warnings.length===0?(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>✅</div>
          <div style={{fontSize:14,fontWeight:700,color:V.accent}}>All clear</div>
          <div style={{fontSize:11,color:V.text3,marginTop:4}}>No data issues detected across {s.workouts.length} workouts, {s.nutrition.length} nutrition logs, and {s.body.length} measurements</div>
        </Card>
      ):(
        <div>
          <div style={{fontSize:11,color:V.text3,marginBottom:8}}>{warnings.length} issue{warnings.length>1?"s":""} found</div>
          {warnings.map((w,i)=>(
            <Card key={i} style={{padding:12,marginBottom:6}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{width:8,height:8,borderRadius:4,background:sevColor[w.severity],marginTop:4,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,fontWeight:700,color:sevColor[w.severity],textTransform:"uppercase",marginBottom:2}}>{sevLabel[w.severity]}</div>
                  <div style={{fontSize:12,color:V.text,lineHeight:1.4}}>{w.msg}</div>
                </div>
                {(w.type==="duplicate")&&(
                  <button onClick={()=>deleteItem(w)} style={{padding:"4px 8px",borderRadius:6,
                    background:"rgba(255,107,107,0.08)",border:"none",cursor:"pointer",fontSize:9,color:V.danger,fontWeight:700}}>Delete</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── #2 Phase/Cycle Tracking ───
function PhaseTracker({s,d}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({type:"cut",start:today(),end:"",notes:""});
  const phases=s.phases||[];

  const phaseTypes=[
    {id:"cut",label:"Cut",color:V.danger,icon:"🔥"},
    {id:"bulk",label:"Bulk",color:V.accent,icon:"💪"},
    {id:"maintain",label:"Maintain",color:V.accent2,icon:"⚖️"},
    {id:"strength",label:"Strength",color:V.purple,icon:"🏋️"},
    {id:"deload",label:"Deload",color:V.warn,icon:"🧘"},
  ];

  const addPhase=()=>{
    if(!form.start)return;
    const p={id:uid(),type:form.type,start:form.start,end:form.end||null,notes:form.notes,active:!form.end};
    d({type:"SET_PHASES",phases:[...phases,p]});
    SuccessToastCtrl.show("Phase started");
    setForm({type:"cut",start:today(),end:"",notes:""});setShowAdd(false);
  };

  const endPhase=(id)=>{d({type:"SET_PHASES",phases:phases.map(p=>p.id===id?{...p,end:today(),active:false}:p)});SuccessToastCtrl.show("Phase ended");};
  const deletePhase=(id)=>{d({type:"SET_PHASES",phases:phases.filter(p=>p.id!==id)});SuccessToastCtrl.show("Phase deleted");};

  const phaseStats=(phase)=>{
    const ws=s.workouts.filter(w=>w.date>=phase.start&&(!phase.end||w.date<=phase.end));
    const bs=s.body.filter(b=>b.date>=phase.start&&(!phase.end||b.date<=phase.end));
    const ns=s.nutrition.filter(n=>n.date>=phase.start&&(!phase.end||n.date<=phase.end));
    const startBW=bs.length?bs[bs.length-1].weight:null;
    const endBW=bs.length?bs[0].weight:null;
    const avgCal=ns.length?Math.round(ns.reduce((a,n)=>a+n.cal,0)/ns.length):0;
    const totalVol=ws.reduce((v,w)=>v+w.exercises.reduce((e,ex)=>e+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const days=phase.end?Math.ceil((new Date(phase.end)-new Date(phase.start))/86400000):Math.ceil((new Date()-new Date(phase.start))/86400000);
    return{workouts:ws.length,days,startBW,endBW,bwChange:startBW&&endBW?(endBW-startBW).toFixed(1):null,avgCal,totalVol};
  };

  const active=phases.find(p=>p.active);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Training Phases</div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",borderRadius:8,
          background:`${V.accent}12`,border:`1px solid ${V.accent}25`,cursor:"pointer",
          fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>+ New Phase</button>
      </div>

      {active&&(()=>{
        const pt=phaseTypes.find(t=>t.id===active.type)||phaseTypes[2];
        const stats=phaseStats(active);
        return(
          <Card glow style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{pt.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:V.text}}>Active: {pt.label}</div>
                  <div style={{fontSize:10,color:V.text3}}>Day {stats.days} · Started {active.start}</div>
                </div>
              </div>
              <button onClick={()=>endPhase(active.id)} style={{padding:"5px 10px",borderRadius:6,
                background:`${V.warn}12`,border:`1px solid ${V.warn}25`,cursor:"pointer",fontSize:10,fontWeight:700,color:V.warn}}>End Phase</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Workouts",v:stats.workouts,c:V.accent},{l:"Avg Cal",v:stats.avgCal,c:V.warn},
                {l:"BW Change",v:stats.bwChange?`${stats.bwChange>0?"+":""}${stats.bwChange}`:"--",c:V.accent2}
              ].map(m=>(
                <div key={m.l} style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                  <div style={{fontSize:16,fontWeight:800,color:m.c,fontFamily:V.mono}}>{m.v}</div>
                  <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{m.l}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {!active&&phases.length===0&&!showAdd&&(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>📊</div>
          <div style={{fontSize:13,fontWeight:600,color:V.text}}>No phases tracked yet</div>
          <div style={{fontSize:11,color:V.text3}}>Tag your training blocks to compare outcomes</div>
        </Card>
      )}

      {/* Past phases */}
      {phases.filter(p=>!p.active).length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:V.text3,marginBottom:6}}>Past Phases</div>
          {phases.filter(p=>!p.active).sort((a,b)=>b.start.localeCompare(a.start)).map(p=>{
            const pt=phaseTypes.find(t=>t.id===p.type)||phaseTypes[2];
            const stats=phaseStats(p);
            return(
              <Card key={p.id} style={{padding:12,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span>{pt.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:V.text}}>{pt.label} · {stats.days}d</div>
                      <div style={{fontSize:9,color:V.text3}}>{p.start} → {p.end}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.mono}}>{stats.workouts} workouts</div>
                      {stats.bwChange&&<div style={{fontSize:9,color:parseFloat(stats.bwChange)>0?V.accent:V.danger}}>{stats.bwChange>0?"+":""}{stats.bwChange} {s.units}</div>}
                    </div>
                    <button onClick={()=>deletePhase(p.id)} style={{background:"none",border:"none",cursor:"pointer",
                      fontSize:10,color:V.text3,padding:"2px 6px"}}>✕</button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd&&(
        <Sheet title="New Training Phase" onClose={()=>setShowAdd(false)}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {phaseTypes.map(t=>(
              <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))} style={{
                padding:"8px 14px",borderRadius:8,border:`1.5px solid ${form.type===t.id?t.color:V.cardBorder}`,
                background:form.type===t.id?`${t.color}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                <span>{t.icon}</span>
                <span style={{fontSize:12,fontWeight:600,color:form.type===t.id?t.color:V.text3}}>{t.label}</span>
              </button>
            ))}
          </div>
          <Field label="Start Date" type="date" value={form.start} onChange={v=>setForm(f=>({...f,start:v}))}/>
          <Field label="End Date (optional)" type="date" value={form.end} onChange={v=>setForm(f=>({...f,end:v}))}/>
          <Field label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="e.g. 500cal deficit, 4x/week"/>
          <Btn full onClick={addPhase} s={{marginTop:8}}>{Icons.check({size:16,color:V.bg})} Start Phase</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── #3 Exercise Substitution Intelligence ───
function SubstitutionFinder({s}){
  const [selEx,setSelEx]=useState(null);
  const subs=selEx?EXERCISE_SUBS[selEx]||[]:[];
  // Also suggest same-category exercises
  const selCat=s.exercises.find(e=>e.id===selEx)?.cat;
  const catSubs=selEx?s.exercises.filter(e=>e.cat===selCat&&e.id!==selEx&&!subs.includes(e.id)).slice(0,4):[];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Exercise Substitutions</div>
      <div style={{fontSize:12,color:V.text3}}>Find alternatives when equipment is unavailable</div>

      <Field label="Search exercise" value="" onChange={()=>{}} placeholder="Tap an exercise below"/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {s.exercises.filter(e=>!["Core","Cardio"].includes(e.cat)).slice(0,16).map(ex=>(
          <button key={ex.id} onClick={()=>setSelEx(ex.id)} style={{
            padding:"5px 10px",borderRadius:6,border:`1.5px solid ${selEx===ex.id?V.accent:V.cardBorder}`,
            background:selEx===ex.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",fontSize:10,fontWeight:600,color:selEx===ex.id?V.accent:V.text3,fontFamily:V.font
          }}>{ex.name.length>18?ex.name.slice(0,18)+"…":ex.name}</button>
        ))}
      </div>

      {selEx&&(
        <div>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:6}}>Best alternatives for {s.exercises.find(e=>e.id===selEx)?.name}</div>
          {subs.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {subs.map((sid,i)=>{
                const ex=s.exercises.find(e=>e.id===sid);
                if(!ex)return null;
                return(
                  <Card key={sid} style={{padding:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:24,height:24,borderRadius:6,background:`${V.accent}12`,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:11,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{i+1}</span>
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:V.text}}>{ex.name}</div>
                        <div style={{fontSize:10,color:V.text3}}>{ex.cat} · {i===0?"Best match":"Similar pattern"}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ):(
            <div style={{fontSize:11,color:V.text3}}>No preset substitutions. Try these from the same muscle group:</div>
          )}
          {catSubs.length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:V.text3,fontWeight:600,marginBottom:4}}>Same muscle group</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {catSubs.map(ex=>(
                  <span key={ex.id} style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.03)",
                    border:`1px solid ${V.cardBorder}`,fontSize:10,color:V.text2}}>{ex.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── #4 Injury-Aware Training ───
function InjuryManager({s,d}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({joint:"",severity:"moderate",notes:""});
  const injuries=s.injuries||[];

  const joints=[
    {id:"shoulder",label:"Shoulder",icon:"🦾"},{id:"knee",label:"Knee",icon:"🦵"},
    {id:"lower_back",label:"Lower Back",icon:"🔙"},{id:"elbow",label:"Elbow",icon:"💪"},
    {id:"wrist",label:"Wrist",icon:"✋"},{id:"hip",label:"Hip",icon:"🦴"},
  ];

  const addInjury=()=>{
    if(!form.joint)return;
    d({type:"SET_INJURIES",injuries:[...injuries,{id:uid(),joint:form.joint,severity:form.severity,notes:form.notes,date:today(),active:true}]});
    SuccessToastCtrl.show("Injury flagged");
    setForm({joint:"",severity:"moderate",notes:""});setShowAdd(false);
  };

  const resolveInjury=(id)=>{d({type:"SET_INJURIES",injuries:injuries.map(inj=>inj.id===id?{...inj,active:false,resolved:today()}:inj)});SuccessToastCtrl.show("Injury resolved");};
  const deleteInjury=(id)=>{d({type:"SET_INJURIES",injuries:injuries.filter(inj=>inj.id!==id)});SuccessToastCtrl.show("Injury removed");};

  const activeInjuries=injuries.filter(inj=>inj.active);
  const flaggedExercises=useMemo(()=>{
    const flagged=new Set();
    activeInjuries.forEach(inj=>{(JOINT_MAP[inj.joint]||[]).forEach(eid=>flagged.add(eid));});
    return flagged;
  },[activeInjuries]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Injury Awareness</div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",borderRadius:8,
          background:`${V.warn}12`,border:`1px solid ${V.warn}25`,cursor:"pointer",
          fontSize:11,fontWeight:700,color:V.warn,fontFamily:V.font}}>+ Flag Pain</button>
      </div>

      {activeInjuries.length>0?(
        <div>
          <div style={{padding:"8px 12px",borderRadius:8,background:`${V.danger}08`,border:`1px solid ${V.danger}15`,marginBottom:8}}>
            <span style={{fontSize:11,color:V.danger,fontWeight:600}}>{flaggedExercises.size} exercises flagged — consider substitutions or reduced load</span>
          </div>
          {activeInjuries.map(inj=>{
            const j=joints.find(j2=>j2.id===inj.joint);
            const affected=(JOINT_MAP[inj.joint]||[]).map(eid=>s.exercises.find(e=>e.id===eid)?.name).filter(Boolean);
            return(
              <Card key={inj.id} style={{padding:12,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>{j?.icon||"⚠️"}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>{j?.label||inj.joint}</div>
                      <div style={{fontSize:9,color:V.text3}}>Since {inj.date} · {inj.severity}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>resolveInjury(inj.id)} style={{padding:"4px 8px",borderRadius:6,
                      background:`${V.accent}12`,border:"none",cursor:"pointer",fontSize:9,color:V.accent,fontWeight:700}}>Resolved</button>
                    <button onClick={()=>deleteInjury(inj.id)} style={{padding:"4px 8px",borderRadius:6,
                      background:"rgba(255,107,107,0.08)",border:"none",cursor:"pointer",fontSize:9,color:V.danger}}>✕</button>
                  </div>
                </div>
                {inj.notes&&<div style={{fontSize:10,color:V.text3,fontStyle:"italic",marginBottom:6}}>{inj.notes}</div>}
                <div style={{fontSize:9,color:V.warn,fontWeight:600,marginBottom:4}}>Affected exercises:</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {affected.slice(0,8).map(n=>(
                    <span key={n} style={{padding:"2px 6px",borderRadius:4,background:`${V.warn}08`,fontSize:8,color:V.warn}}>{n}</span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ):(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>💚</div>
          <div style={{fontSize:13,fontWeight:600,color:V.accent}}>No active injuries</div>
          <div style={{fontSize:11,color:V.text3}}>Flag pain points to get safer exercise suggestions</div>
        </Card>
      )}

      {injuries.filter(inj=>!inj.active).length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:V.text3,marginBottom:4}}>Resolved</div>
          {injuries.filter(inj=>!inj.active).map(inj=>(
            <div key={inj.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",opacity:0.5}}>
              <span style={{fontSize:10}}>{joints.find(j=>j.id===inj.joint)?.icon||"✓"}</span>
              <span style={{fontSize:11,color:V.text3}}>{joints.find(j=>j.id===inj.joint)?.label} · {inj.date} → {inj.resolved}</span>
              <span style={{flex:1}}/>
              <button onClick={()=>deleteInjury(inj.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:V.text3}}>✕</button>
            </div>
          ))}
        </div>
      )}

      {showAdd&&(
        <Sheet title="Flag Pain / Injury" onClose={()=>setShowAdd(false)}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {joints.map(j=>(
              <button key={j.id} onClick={()=>setForm(f=>({...f,joint:j.id}))} style={{
                padding:"10px 14px",borderRadius:10,border:`1.5px solid ${form.joint===j.id?V.warn:V.cardBorder}`,
                background:form.joint===j.id?`${V.warn}10`:"rgba(255,255,255,0.02)",cursor:"pointer",
                display:"flex",alignItems:"center",gap:6}}>
                <span>{j.icon}</span>
                <span style={{fontSize:12,fontWeight:600,color:form.joint===j.id?V.warn:V.text3}}>{j.label}</span>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {["mild","moderate","severe"].map(sev=>(
              <button key={sev} onClick={()=>setForm(f=>({...f,severity:sev}))} style={{
                flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${form.severity===sev?(sev==="severe"?V.danger:sev==="moderate"?V.warn:V.accent2):V.cardBorder}`,
                background:form.severity===sev?`${sev==="severe"?V.danger:sev==="moderate"?V.warn:V.accent2}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",fontSize:11,fontWeight:600,color:form.severity===sev?V.text:V.text3,textTransform:"capitalize"}}>
                {sev}
              </button>
            ))}
          </div>
          <Field label="Notes (optional)" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="e.g. Sharp pain on overhead press"/>
          <Btn full onClick={addInjury} s={{marginTop:8}}>{Icons.check({size:16,color:V.bg})} Flag Injury</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── #6 Coach Summary Report ───
function WeeklySummary({s}){
  const canvasRef=useRef(null);
  const [generated,setGenerated]=useState(false);

  const stats=useMemo(()=>{
    const ws=s.workouts.filter(w=>w.date>=ago(7));
    const ns=s.nutrition.filter(n=>n.date>=ago(7));
    const r=calcReadiness(s);
    const totalVol=ws.reduce((v,w)=>v+w.exercises.reduce((e,ex)=>e+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const avgCal=ns.length?Math.round(ns.reduce((a,n)=>a+n.cal,0)/ns.length):0;
    const avgProt=ns.length?Math.round(ns.reduce((a,n)=>a+n.protein,0)/ns.length):0;
    const protHit=ns.filter(n=>n.protein>=s.goals.protein*0.8).length;
    const avgSleep=ns.filter(n=>parseFloat(n.sleep)>0).length?
      (ns.filter(n=>parseFloat(n.sleep)>0).reduce((a,n)=>a+(parseFloat(n.sleep)||0),0)/ns.filter(n=>parseFloat(n.sleep)>0).length).toFixed(1):0;
    const activePhase=(s.phases||[]).find(p=>p.active);
    return{workouts:ws.length,totalVol,avgCal,avgProt,protHit,avgSleep,readiness:r.score,readinessLevel:r.level,
      readinessColor:r.color,phase:activePhase?.type||null};
  },[s]);

  const gen=()=>{
    const c=canvasRef.current;if(!c)return;
    const ctx=c.getContext("2d");c.width=600;c.height=440;
    const grad=ctx.createLinearGradient(0,0,600,440);
    grad.addColorStop(0,"#0a0a14");grad.addColorStop(1,"#14142a");
    ctx.fillStyle=grad;ctx.fillRect(0,0,600,440);
    ctx.fillStyle="#22d3ee";ctx.fillRect(0,0,4,440);

    ctx.fillStyle="#fff";ctx.font="bold 24px -apple-system, sans-serif";
    ctx.fillText("WEEKLY REVIEW",24,40);
    ctx.fillStyle="#666";ctx.font="13px -apple-system, sans-serif";
    const end=new Date();const start=new Date();start.setDate(start.getDate()-7);
    ctx.fillText(`${start.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`,24,62);

    if(stats.phase){ctx.fillStyle="#a78bfa";ctx.font="bold 11px -apple-system, sans-serif";ctx.fillText(`PHASE: ${stats.phase.toUpperCase()}`,420,40);}

    const rows=[
      {l:"WORKOUTS",v:String(stats.workouts),sub:"/7 days"},
      {l:"VOLUME",v:stats.totalVol>1000?`${(stats.totalVol/1000).toFixed(1)}k`:""+stats.totalVol,sub:`total ${wUnit(s.units)}`},
      {l:"AVG CALORIES",v:String(stats.avgCal),sub:"kcal/day"},
      {l:"AVG PROTEIN",v:`${stats.avgProt}g`,sub:`hit ${stats.protHit}/7 days`},
      {l:"AVG SLEEP",v:`${stats.avgSleep}h`,sub:"per night"},
      {l:"READINESS",v:String(stats.readiness),sub:stats.readinessLevel},
    ];
    rows.forEach((r,i)=>{
      const y=100+i*52;
      ctx.fillStyle="#444";ctx.fillRect(24,y+35,552,1);
      ctx.fillStyle="#888";ctx.font="10px -apple-system, sans-serif";ctx.fillText(r.l,24,y+12);
      ctx.fillStyle="#22d3ee";ctx.font="bold 24px -apple-system, sans-serif";ctx.fillText(r.v,24,y+34);
      ctx.fillStyle="#555";ctx.font="12px -apple-system, sans-serif";ctx.fillText(r.sub,180,y+34);
    });

    ctx.fillStyle="#333";ctx.font="bold 11px -apple-system, sans-serif";ctx.fillText("IRONLOG",24,425);
    ctx.fillStyle="#555";ctx.font="10px -apple-system, sans-serif";ctx.fillText("ironlog.space",100,425);
    setGenerated(true);
  };

  const share=()=>{
    const c=canvasRef.current;if(!c)return;
    c.toBlob(blob=>{
      if(navigator.share&&blob){
        navigator.share({files:[new File([blob],"weekly-review.png",{type:"image/png"})],title:"Weekly Review"}).catch(()=>{});
      }else{
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`review-${today()}.png`;a.click();URL.revokeObjectURL(url);
      }
    },"image/png");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Weekly Summary</div>

      <Card style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{l:"Workouts",v:stats.workouts,c:V.accent},{l:"Avg Cal",v:stats.avgCal,c:V.warn},{l:"Readiness",v:stats.readiness,c:stats.readinessColor},
            {l:"Protein Hit",v:`${stats.protHit}/7`,c:V.accent2},{l:"Avg Sleep",v:`${stats.avgSleep}h`,c:V.purple},{l:"Volume",v:stats.totalVol>1000?`${(stats.totalVol/1000).toFixed(1)}k`:stats.totalVol,c:V.accent}
          ].map(m=>(
            <div key={m.l} style={{textAlign:"center",padding:"10px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:18,fontWeight:800,color:m.c,fontFamily:V.mono}}>{m.v}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{m.l}</div>
            </div>
          ))}
        </div>
      </Card>

      <canvas ref={canvasRef} style={{width:"100%",borderRadius:12,display:generated?"block":"none"}}/>
      {!generated?(
        <Btn full onClick={gen}>{Icons.chart({size:14,color:V.bg})} Generate Report Card</Btn>
      ):(
        <div style={{display:"flex",gap:8}}>
          <Btn full onClick={share}>{Icons.upload({size:14,color:V.bg})} Share</Btn>
          <Btn v="secondary" full onClick={()=>setGenerated(false)}>Close</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Fast Food Hacks Database ───
function FastFoodHacks({s,d}){
  const [search,setSearch]=useState("");
  const [brand,setBrand]=useState("All");
  const [sort,setSort]=useState("cal"); // cal, protein, name
  const [expanded,setExpanded]=useState(null);

  const brands=["All",...[...new Set(FF_HACKS.map(h=>h.r))].sort()];

  const filtered=useMemo(()=>{
    let list=FF_HACKS;
    if(brand!=="All")list=list.filter(h=>h.r===brand);
    if(search)list=list.filter(h=>h.r.toLowerCase().includes(search.toLowerCase())||h.d.toLowerCase().includes(search.toLowerCase()));
    if(sort==="cal")list=[...list].sort((a,b)=>a.cal-b.cal);
    else if(sort==="protein")list=[...list].sort((a,b)=>(b.p||0)-(a.p||0));
    else list=[...list].sort((a,b)=>a.r.localeCompare(b.r));
    return list;
  },[search,brand,sort]);

  const addToNutrition=(hack)=>{
    const n={id:uid(),date:today(),cal:hack.cal||0,protein:hack.p||0,carbs:0,fat:0,fiber:0,water:0,sleep:0,
      meals:[{name:"Fast Food",items:[{name:`${hack.r} Hack`,cal:hack.cal||0,protein:hack.p||0,carbs:0,fat:0}]}]};
    d({type:"ADD_N",n});
    SuccessToastCtrl.show(`${hack.r} hack logged`);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:V.text}}>Fast Food Hacks</div>
          <div style={{fontSize:11,color:V.text3}}>{filtered.length} macro-friendly meals under 600 cal</div>
        </div>
      </div>

      {/* Search */}
      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Icons.search({size:14,color:V.text3})}</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search restaurants or ingredients..."
          aria-label="Search fast food hacks"
          style={{width:"100%",padding:"10px 14px 10px 34px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:V.font}}/>
      </div>

      {/* Sort */}
      <div style={{display:"flex",gap:6}}>
        {[{k:"cal",l:"Lowest Cal"},{k:"protein",l:"Most Protein"},{k:"name",l:"A→Z"}].map(s2=>(
          <button key={s2.k} onClick={()=>setSort(s2.k)} style={{padding:"6px 12px",borderRadius:8,
            border:`1.5px solid ${sort===s2.k?V.accent:V.cardBorder}`,
            background:sort===s2.k?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",fontSize:10,fontWeight:600,color:sort===s2.k?V.accent:V.text3,fontFamily:V.font}}>{s2.l}</button>
        ))}
      </div>

      {/* Brand filter — horizontal scroll */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
        {brands.map(b=>{
          const info=FF_BRANDS[b];
          return(
            <button key={b} onClick={()=>setBrand(b)} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,
              border:`1.5px solid ${brand===b?(info?.color||V.accent):V.cardBorder}`,
              background:brand===b?`${info?.color||V.accent}15`:"rgba(255,255,255,0.02)",
              cursor:"pointer",fontSize:10,fontWeight:600,color:brand===b?(info?.color||V.accent):V.text3,
              fontFamily:V.font,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              {info?.emoji&&<span style={{fontSize:12}}>{info.emoji}</span>}
              {b}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.map((hack,i)=>{
        const info=FF_BRANDS[hack.r]||{color:V.accent,emoji:"🍽️"};
        const isExpanded=expanded===i;
        return(
          <div key={i} onClick={()=>setExpanded(isExpanded?null:i)} style={{
            background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,borderRadius:14,
            overflow:"hidden",cursor:"pointer",transition:"all .15s"}}>
            {/* Header */}
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${info.color}15`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {info.emoji}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:V.text,display:"flex",alignItems:"center",gap:6}}>
                  {hack.r}
                </div>
                <div style={{fontSize:10,color:V.text3,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {hack.d.split("\n")[0]}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:16,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{hack.cal}</div>
                <div style={{fontSize:8,color:V.text3,fontWeight:600}}>CAL</div>
              </div>
              {hack.p&&(
                <div style={{textAlign:"right",flexShrink:0,marginLeft:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{hack.p}g</div>
                  <div style={{fontSize:8,color:V.text3,fontWeight:600}}>PROT</div>
                </div>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded&&(
              <div style={{padding:"0 14px 14px",borderTop:`1px solid ${V.cardBorder}`}}>
                <div style={{padding:"10px 0",fontSize:12,color:V.text2,lineHeight:1.6,whiteSpace:"pre-line"}}>{hack.d}</div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={e=>{e.stopPropagation();addToNutrition(hack);}} style={{flex:1,padding:"10px",borderRadius:10,
                    background:`${V.accent}12`,border:`1px solid ${V.accent}25`,cursor:"pointer",
                    fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    {Icons.plus({size:14,color:V.accent})} Log This Meal
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:30,color:V.text3}}>
          <div style={{fontSize:28,marginBottom:8}}>🔍</div>
          <div style={{fontSize:13}}>No hacks found for "{search||brand}"</div>
        </div>
      )}
    </div>
  );
}

// ─── Meal Plan Generator ───
function MealPlanGenerator({s}){
  const [plan,setPlan]=useState(null);
  const goals=s.goals||{cal:2400,protein:180,carbs:250,fat:70};
  // Categorize foods by meal type
  const mealFoods={
    Breakfast:FOODS.filter(f=>["Dairy","Grains","Fruit"].includes(f.cat)||["Eggs (2 large)","Oatmeal (1 cup)","Greek Yogurt","Banana","Protein Shake","Peanut Butter (2 tbsp)","Whole Wheat Bread (2 slices)","Cottage Cheese (1 cup)"].includes(f.n)),
    Lunch:FOODS.filter(f=>["Protein","Grains","Vegetables"].includes(f.cat)||f.p>=15),
    Dinner:FOODS.filter(f=>["Protein","Vegetables","Grains"].includes(f.cat)||f.p>=20),
    Snacks:FOODS.filter(f=>f.cal<=250&&f.cal>=50),
  };
  const generate=()=>{
    const meals=["Breakfast","Lunch","Dinner","Snacks"];
    const splits=[0.28,0.32,0.3,0.1];
    const result=meals.map((name,i)=>{
      const calTarget=Math.round(goals.cal*splits[i]);
      const pool=(mealFoods[name]||FOODS).filter(f=>f.cal<=calTarget*0.6).sort(()=>Math.random()-0.5);
      const items=[];let cal=0,prot=0;
      for(const f of pool){
        if(cal+f.cal<=calTarget*1.1&&items.length<(name==="Snacks"?2:3)&&!items.some(x=>x.n===f.n)){
          items.push(f);cal+=f.cal;prot+=f.p;
        }
        if(items.length>=(name==="Snacks"?2:3))break;
      }
      return{name,items,cal,prot,target:{cal:calTarget,prot:Math.round(goals.protein*splits[i])}};
    });
    setPlan(result);SuccessToastCtrl.show("Meal plan generated");
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Daily Meal Plan</div>
      <div style={{fontSize:11,color:V.text3}}>Auto-generated to hit your macro targets: {goals.cal}cal / {goals.protein}g protein</div>
      <Btn full onClick={generate}>{Icons.refresh({size:14,color:V.bg})} Generate Plan</Btn>
      {plan&&plan.map((meal,i)=>(
        <Card key={i} style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:700,color:V.text}}>{meal.name}</span>
            <span style={{fontSize:10,color:V.accent,fontFamily:V.mono}}>{meal.cal}cal / {meal.prot}g</span>
          </div>
          {meal.items.map((f,j)=>(
            <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:11,
              borderBottom:j<meal.items.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
              <span style={{color:V.text2}}>{f.n}</span>
              <span style={{color:V.text3,fontFamily:V.mono}}>{f.cal}cal · {f.p}g</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

// ─── Workout Programs Marketplace ───
function ProgramMarketplace({s,d}){
  const [sel,setSel]=useState(null);
  const apply=(prog)=>{
    const weekly={};
    prog.schedule.forEach((label,i)=>{weekly[i]=label;});
    d({type:"SET_SCHEDULE",schedule:{weekly,overrides:{}}});
    SuccessToastCtrl.show(`${prog.name} applied to schedule`);
    setSel(null);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Training Programs</div>
      <div style={{fontSize:11,color:V.text3}}>Pick a program and it auto-populates your weekly schedule.</div>
      {PROGRAMS.map(p=>(
        <Card key={p.id} onClick={()=>setSel(sel===p.id?null:p.id)} style={{padding:14,cursor:"pointer",
          border:sel===p.id?`1.5px solid ${V.accent}`:`1px solid ${V.cardBorder}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:V.text}}>{p.name}</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2}}>{p.weeks} weeks · {p.days} days/week · {p.level}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:V.text2,marginTop:6,lineHeight:1.5}}>{p.desc}</div>
          {sel===p.id&&(
            <div style={{marginTop:10}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,i)=>(
                  <div key={i} style={{padding:"4px 8px",borderRadius:6,fontSize:9,fontWeight:600,
                    background:p.schedule[i]==="Rest"?"rgba(255,255,255,0.03)":`${V.accent}10`,
                    color:p.schedule[i]==="Rest"?V.text3:V.accent,border:`1px solid ${p.schedule[i]==="Rest"?V.cardBorder:V.accent+"25"}`}}>
                    <div>{day}</div><div style={{fontWeight:700}}>{p.schedule[i]}</div>
                  </div>
                ))}
              </div>
              {/* Exercise details per day */}
              {p.exercises&&(
                <div style={{marginBottom:10}}>
                  {[...new Set(p.schedule.filter(d2=>d2!=="Rest"))].map(day=>(
                    p.exercises[day]&&<div key={day} style={{marginBottom:6}}>
                      <div style={{fontSize:10,fontWeight:700,color:V.accent,marginBottom:2}}>{day}</div>
                      <div style={{fontSize:10,color:V.text3,lineHeight:1.6,paddingLeft:8}}>{p.exercises[day].join(" · ")}</div>
                    </div>
                  ))}
                </div>
              )}
              <Btn full onClick={()=>apply(p)}>{Icons.check({size:14,color:V.bg})} Start This Program</Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Supplement Tracker ───
const DEFAULT_SUPPS=["Creatine (5g)","Protein Shake","Multivitamin","Fish Oil","Vitamin D","Pre-Workout","Magnesium","Zinc"];

function SupplementTracker({s,d}){
  const [supps,setSupps]=useState(LS.get("ft-supplements")||DEFAULT_SUPPS.slice(0,4));
  const [checked,setChecked]=useState(LS.get(`ft-supps-${today()}`)||{});
  const [newSupp,setNewSupp]=useState("");

  const toggle=(name)=>{
    const next={...checked,[name]:!checked[name]};
    setChecked(next);LS.set(`ft-supps-${today()}`,next);
  };
  const addSupp=()=>{
    if(!newSupp.trim())return;
    const next=[...supps,newSupp.trim()];
    setSupps(next);LS.set("ft-supplements",next);setNewSupp("");
    SuccessToastCtrl.show("Supplement added");
  };
  const rmSupp=(name)=>{
    const next=supps.filter(s2=>s2!==name);
    setSupps(next);LS.set("ft-supplements",next);
  };
  const doneCount=Object.values(checked).filter(Boolean).length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Supplements</div>
          <div style={{fontSize:11,color:V.text3}}>Daily checklist · {doneCount}/{supps.length} taken today</div>
        </div>
        <div style={{fontSize:20,fontWeight:800,color:doneCount===supps.length?V.accent:V.text3,fontFamily:V.mono}}>
          {supps.length>0?Math.round(doneCount/supps.length*100):0}%
        </div>
      </div>
      {/* Progress bar */}
      <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
        <div style={{height:"100%",borderRadius:2,background:V.accent,width:`${supps.length>0?doneCount/supps.length*100:0}%`,transition:"width .3s"}}/>
      </div>
      {supps.map(name=>(
        <div key={name} onClick={()=>toggle(name)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
          background:checked[name]?`${V.accent}06`:"rgba(255,255,255,0.02)",border:`1px solid ${checked[name]?V.accent+"20":V.cardBorder}`,
          borderRadius:10,cursor:"pointer"}}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${checked[name]?V.accent:V.text3}`,
            background:checked[name]?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {checked[name]&&<span style={{color:V.bg,fontSize:12,fontWeight:900}}>✓</span>}
          </div>
          <span style={{flex:1,fontSize:13,color:checked[name]?V.accent:V.text,fontWeight:checked[name]?600:400,
            textDecoration:checked[name]?"line-through":"none"}}>{name}</span>
          <button onClick={e=>{e.stopPropagation();rmSupp(name);}} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>
            {Icons.x({size:12,color:V.text3})}
          </button>
        </div>
      ))}
      <div style={{display:"flex",gap:8}}>
        <input value={newSupp} onChange={e=>setNewSupp(e.target.value)} placeholder="Add supplement..."
          onKeyDown={e=>{if(e.key==="Enter")addSupp();}}
          style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",fontFamily:V.font}}/>
        <Btn onClick={addSupp} disabled={!newSupp.trim()}>{Icons.plus({size:14,color:V.bg})}</Btn>
      </div>
      <div style={{fontSize:9,color:V.text3}}>Suggestions: {DEFAULT_SUPPS.filter(s2=>!supps.includes(s2)).slice(0,3).join(", ")}</div>
    </div>
  );
}

// ─── Photo Comparison Slider ───
function PhotoCompare({s}){
  const photos=(s.photos||[]).filter(p=>!p.private&&p.data).sort((a,b)=>a.date.localeCompare(b.date));
  const [leftIdx,setLeftIdx]=useState(0);
  const [rightIdx,setRightIdx]=useState(Math.max(0,photos.length-1));
  const [sliderPos,setSliderPos]=useState(50);
  const containerRef=useRef(null);

  if(photos.length<2)return(
    <div style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:32,marginBottom:8}}>📸</div>
      <div style={{fontSize:14,fontWeight:700,color:V.text}}>Need at least 2 photos</div>
      <div style={{fontSize:11,color:V.text3,marginTop:4}}>Take progress photos over time to compare your transformation.</div>
    </div>
  );

  const handleSlide=(e)=>{
    const rect=containerRef.current?.getBoundingClientRect();
    if(!rect)return;
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const pct=Math.max(5,Math.min(95,((clientX-rect.left)/rect.width)*100));
    setSliderPos(pct);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Progress Compare</div>
      {/* Date selectors */}
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:V.text3,marginBottom:4,fontWeight:600}}>BEFORE</div>
          <select value={leftIdx} onChange={e=>setLeftIdx(parseInt(e.target.value))}
            style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}>
            {photos.map((p,i)=><option key={i} value={i} style={{background:"#14141f"}}>{fmtShort(p.date)}</option>)}
          </select>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:V.text3,marginBottom:4,fontWeight:600}}>AFTER</div>
          <select value={rightIdx} onChange={e=>setRightIdx(parseInt(e.target.value))}
            style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}>
            {photos.map((p,i)=><option key={i} value={i} style={{background:"#14141f"}}>{fmtShort(p.date)}</option>)}
          </select>
        </div>
      </div>
      {/* Time span */}
      {photos[leftIdx]&&photos[rightIdx]&&(()=>{
        const d1=new Date(photos[leftIdx].date),d2=new Date(photos[rightIdx].date);
        const days=Math.abs(Math.round((d2-d1)/(86400000)));
        const span=days<7?`${days} days`:days<60?`${Math.round(days/7)} weeks`:`${Math.round(days/30)} months`;
        return days>0?<div style={{textAlign:"center",fontSize:11,color:V.accent,fontWeight:600,padding:"4px 0"}}>{span} apart</div>:null;
      })()}
      {/* Slider comparison */}
      <div ref={containerRef} onMouseMove={e=>{if(e.buttons===1)handleSlide(e);}} onTouchMove={handleSlide}
        style={{position:"relative",borderRadius:14,overflow:"hidden",aspectRatio:"3/4",border:`1px solid ${V.cardBorder}`,cursor:"col-resize",touchAction:"none"}}>
        {/* Right (after) image — full */}
        <img src={photos[rightIdx]?.data} alt="After photo" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
        {/* Left (before) image — clipped */}
        <div style={{position:"absolute",inset:0,width:`${sliderPos}%`,overflow:"hidden"}}>
          <img src={photos[leftIdx]?.data} alt="Before photo" style={{position:"absolute",top:0,left:0,width:containerRef.current?containerRef.current.offsetWidth+"px":"100%",height:"100%",objectFit:"cover"}}/>
        </div>
        {/* Slider line */}
        <div style={{position:"absolute",top:0,bottom:0,left:`${sliderPos}%`,width:3,background:V.accent,transform:"translateX(-50%)",zIndex:10}}>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:32,height:32,borderRadius:16,
            background:V.accent,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>
            <span style={{color:V.bg,fontSize:12,fontWeight:900}}>⟷</span>
          </div>
        </div>
        {/* Labels */}
        <div style={{position:"absolute",bottom:8,left:8,padding:"4px 8px",borderRadius:6,background:"rgba(0,0,0,0.7)",fontSize:10,color:"#fff",fontWeight:600,zIndex:5}}>
          {fmtShort(photos[leftIdx]?.date)}
        </div>
        <div style={{position:"absolute",bottom:8,right:8,padding:"4px 8px",borderRadius:6,background:"rgba(0,0,0,0.7)",fontSize:10,color:"#fff",fontWeight:600,zIndex:5}}>
          {fmtShort(photos[rightIdx]?.date)}
        </div>
      </div>
    </div>
  );
}

// ─── AI Coach Chat (Claude API — BYOK + Free Tier) ───
function AICoachChat({s}){
  const defaultMsg=[{role:"assistant",content:"Hey! I'm your AI coach. Ask me anything about your training, nutrition, or recovery. I have access to all your workout data."}];
  const [msgs,setMsgs]=useState(LS.get("ft-ai-chat")||defaultMsg);
  const aiStreak=useStreak(s.workouts);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [dailyCount,setDailyCount]=useState(parseInt(LS.get(`ft-ai-count-${today()}`)||"0"));
  const userKey=LS.get("ft-anthropic-key");
  const FREE_LIMIT=5;
  const canSend=userKey||dailyCount<FREE_LIMIT;
  const scrollRef=useRef(null);
  // Persist messages
  useEffect(()=>{if(msgs.length>1)LS.set("ft-ai-chat",msgs.slice(-20));},[msgs]);

  const buildContext=()=>{
    const rw=s.workouts.slice(0,5).map(w=>`${w.date}: ${w.exercises.map(e=>`${s.exercises.find(x=>x.id===e.exerciseId)?.name||e.exerciseId} (${e.sets.length} sets)`).join(", ")}`).join("\n");
    const bw=s.body[0]?`Current weight: ${s.body[0].weight} ${wUnit(s.units)}`:"";
    const goals=s.goals?`Goals: ${s.goals.cal}cal, ${s.goals.protein}g protein`:"";
    const activePhase=(s.phases||[]).find(p=>p.active);
    const phase=activePhase?`Current phase: ${activePhase.type} (${activePhase.label||activePhase.type})`:"";
    const sched=s.schedule?.weekly||{};
    const todayType=s.schedule?.overrides?.[today()]||sched[new Date().getDay()]||"Rest";
    const schedule=`Today is ${todayType} day. Weekly: ${Object.values(sched).join(", ")}`;
    
    const injuries=(s.injuries||[]).filter(inj=>inj.active).map(inj=>inj.name||inj.area).join(", ");
    return`You are IRONLOG AI Coach. Be concise, actionable, encouraging. Max 3 paragraphs.\n\nUser data:\n${bw}\n${goals}\n${phase}\n${schedule}\nStreak: ${aiStreak} days\n${injuries?`Active injuries: ${injuries}`:""}\n\nRecent workouts:\n${rw}`;
  };

  const send=async()=>{
    if(!input.trim()||!canSend)return;
    const userMsg={role:"user",content:input.trim()};
    setMsgs(m=>[...m,userMsg]);setInput("");setLoading(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":userKey||"","anthropic-version":"2023-06-01",
          ...(userKey?{}:{"anthropic-dangerous-direct-browser-access":"true"})},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,
          system:buildContext(),
          messages:[...msgs.filter(m=>m.role!=="system"),userMsg].map(m=>({role:m.role,content:m.content}))
        })
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Sorry, I couldn't process that. Try again.";
      setMsgs(m=>[...m,{role:"assistant",content:reply}]);
      if(!userKey){const c=dailyCount+1;setDailyCount(c);LS.set(`ft-ai-count-${today()}`,c.toString());}
    }catch(e){
      setMsgs(m=>[...m,{role:"assistant",content:"Connection failed. Check your API key or internet."}]);
    }
    setLoading(false);
    setTimeout(()=>scrollRef.current?.scrollTo(0,scrollRef.current.scrollHeight),100);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 180px)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>AI Coach</div>
          <div style={{fontSize:10,color:V.text3}}>{userKey?"Using your API key":`${FREE_LIMIT-dailyCount} free messages left today`}</div>
        </div>
        <button onClick={()=>{const k=prompt("Paste your Anthropic API key for unlimited:");if(k){LS.set("ft-anthropic-key",k);SuccessToastCtrl.show("API key saved");}}}
          style={{padding:"5px 10px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            cursor:"pointer",fontSize:9,color:V.text3,fontFamily:V.font}}>{userKey?"Change Key":"Add API Key"}</button>
      </div>
      {/* Messages */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingBottom:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{padding:"10px 12px",borderRadius:12,maxWidth:"85%",lineHeight:1.5,fontSize:12,
            ...(m.role==="user"?{alignSelf:"flex-end",background:`${V.accent}15`,color:V.text}
              :{alignSelf:"flex-start",background:"rgba(255,255,255,0.04)",color:V.text2})}}>
            {m.content}
          </div>
        ))}
        {loading&&<div style={{alignSelf:"flex-start",padding:"10px 12px",borderRadius:12,background:"rgba(255,255,255,0.04)",fontSize:12,color:V.text3}}>Thinking...</div>}
      </div>
      {/* Input */}
      <div style={{display:"flex",gap:8,paddingTop:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder={canSend?"Ask your coach...":"Daily limit reached — add API key"}
          disabled={!canSend} onKeyDown={e=>{if(e.key==="Enter")send();}}
          style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,opacity:canSend?1:0.5}}/>
        <Btn onClick={send} disabled={!input.trim()||loading||!canSend}>{Icons.check({size:14,color:V.bg})}</Btn>
      </div>
    </div>
  );
}

export {
  GoalEngine, AdaptiveCoach, SyncStatus, WorkoutCard, FormCheckTab,
  DataGuardTab, PhaseTracker, SubstitutionFinder, InjuryManager,
  WeeklySummary as CoachSummary, FastFoodHacks, MealPlanGenerator,
  ProgramMarketplace, SupplementTracker, PhotoCompare, AICoachChat,
};
