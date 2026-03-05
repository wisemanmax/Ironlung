import React, { useState, useMemo } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, fmtShort, fmtFull, uid } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl, validateBody, ValidationWarning } from '../shared/index.jsx';
import { wUnit, convW } from '../../data/plates.js';

function BodyTab({s,d}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({date:today(),weight:"",bf:"",chest:"",waist:"",arms:"",thighs:""});

  const save=()=>{
    d({type:"ADD_B",b:{id:uid(),date:form.date,weight:parseFloat(form.weight)||0,bf:parseFloat(form.bf)||0,
      chest:parseFloat(form.chest)||0,waist:parseFloat(form.waist)||0,arms:parseFloat(form.arms)||0,thighs:parseFloat(form.thighs)||0}});
    SuccessToastCtrl.show("Measurement saved");
    setShow(false);
  };

  const latest=s.body[0]; const prev=s.body[1];
  const wc=latest&&prev?(parseFloat(latest.weight)||0)-(parseFloat(prev.weight)||0):0;

  const trend=useMemo(()=>
    s.body.filter(m=>m.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date))
      .map(m=>({date:fmtShort(m.date),wt:+(parseFloat(m.weight)||0).toFixed(1),bf:+((parseFloat(m.bf)||0).toFixed(1))}))
  ,[s.body,s.range]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Btn full onClick={()=>{setForm({date:today(),weight:"",bf:"",chest:"",waist:"",arms:"",thighs:""});setShow(true);}}>
        {Icons.plus({size:16,color:V.bg})} Log Measurement
      </Btn>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Stat icon={Icons.scale} label="Weight" value={(parseFloat(latest?.weight)||0).toFixed(1)||"—"} unit={wUnit(s.units)} color={V.purple}
          sub={wc!==0?`${wc>0?"↗ +":"↘ "}${wc.toFixed(1)} ${wUnit(s.units)}`:latest?"→ stable":undefined}/>
        <Stat icon={Icons.activity} label="Body Fat" value={((parseFloat(latest?.bf)||0).toFixed(1))||"—"} unit="%" color={V.danger}
          sub={(()=>{const prevBf=prev?parseFloat(prev.bf)||0:0;const curBf=latest?parseFloat(latest.bf)||0:0;const d2=curBf-prevBf;return d2!==0&&prevBf>0?`${d2>0?"↗ +":"↘ "}${d2.toFixed(1)}%`:curBf>0?"→ stable":undefined;})()}/>
      </div>

      <Card>
        <span style={{fontSize:13,color:V.text2,fontWeight:600,display:"block",marginBottom:12}}>Weight & BF%</span>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend}>
            <CartesianGrid {...chartCfg.grid} vertical={false}/>
            <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
            <YAxis yAxisId="w" domain={["dataMin-2","dataMax+2"]} {...chartCfg.axis} width={30}/>
            <YAxis yAxisId="b" orientation="right" domain={["dataMin-1","dataMax+1"]} {...chartCfg.axis} width={28}/>
            <Tooltip {...chartCfg.tip}/>
            <Line yAxisId="w" type="monotone" dataKey="wt" stroke={V.purple} strokeWidth={2} dot={{r:3}} name="Weight"/>
            <Line yAxisId="b" type="monotone" dataKey="bf" stroke={V.danger} strokeWidth={2} dot={{r:3}} name="BF%"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {latest&&(
        <Card>
          <span style={{fontSize:13,color:V.text2,fontWeight:600,display:"block",marginBottom:12}}>Measurements</span>
          {[{l:"Chest",v:latest.chest},{l:"Waist",v:latest.waist},{l:"Arms",v:latest.arms},{l:"Thighs",v:latest.thighs}].map(m=>(
            <div key={m.l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{width:54,fontSize:12,color:V.text2}}>{m.l}</span>
              <div style={{flex:1,height:22,background:"rgba(255,255,255,0.03)",borderRadius:6,overflow:"hidden"}}>
                <div style={{width:`${(m.v/50)*100}%`,height:"100%",background:`linear-gradient(90deg,${V.accent}30,${V.accent2}30)`,borderRadius:6}}/>
              </div>
              <span style={{fontSize:14,color:V.text,fontFamily:V.mono,minWidth:44,textAlign:"right"}}>{((parseFloat(m.v)||0).toFixed(1))}"</span>
            </div>
          ))}
        </Card>
      )}

      {show&&(
        <Sheet title="Log Measurement" onClose={()=>setShow(false)}
          footer={<Btn full onClick={save}>{Icons.check({size:16,color:V.bg})} Save Measurement</Btn>}>
          <Field label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Weight" type="number" value={form.weight} onChange={v=>setForm(f=>({...f,weight:v}))} unit={wUnit(s.units)} step="0.1"/>
            <Field label="Body Fat" type="number" value={form.bf} onChange={v=>setForm(f=>({...f,bf:v}))} unit="%" step="0.1"/>
            <Field label="Chest" type="number" value={form.chest} onChange={v=>setForm(f=>({...f,chest:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
            <Field label="Waist" type="number" value={form.waist} onChange={v=>setForm(f=>({...f,waist:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
            <Field label="Arms" type="number" value={form.arms} onChange={v=>setForm(f=>({...f,arms:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
            <Field label="Thighs" type="number" value={form.thighs} onChange={v=>setForm(f=>({...f,thighs:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
          </div>
        </Sheet>
      )}

      {/* History Table */}
      <Card>
        <span style={{fontSize:13,color:V.text2,fontWeight:600,display:"block",marginBottom:10}}>History</span>
        {s.body.slice(0,10).map(m=>(
          <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",
            borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
            <span style={{fontSize:12,color:V.text3}}>{fmtShort(m.date)}</span>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:13,color:V.purple,fontFamily:V.mono}}>{(parseFloat(m.weight)||0).toFixed(1)}</span>
              <span style={{fontSize:12,color:V.danger,fontFamily:V.mono}}>{((parseFloat(m.bf)||0).toFixed(1))}%</span>
              <button onClick={()=>{if(confirm("Delete this measurement?")){Undo.set("Measurement deleted",m,"body");d({type:"DEL_B",id:m.id});SuccessToastCtrl.show("Measurement deleted");}}} aria-label="Delete measurement" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:12,color:V.text3})}</button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════
//  ANALYTICS TAB
// ═══════════════════════════════════════
function AnalyticsTab({s}){
  const [selEx,setSelEx]=useState("bench");

  const exProg=useMemo(()=>{
    return s.workouts.filter(w=>w.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date)).reduce((arr,w)=>{
      const ex=w.exercises.find(e=>e.exerciseId===selEx);
      if(ex){
        const mw=Math.max(...ex.sets.map(st=>st.weight));
        const vol=ex.sets.reduce((s,st)=>s+st.weight*st.reps,0);
        const e1rm=Math.max(...ex.sets.map(st=>st.weight*(1+st.reps/30)));
        arr.push({date:fmtShort(w.date),max:mw,vol,e1rm:Math.round(e1rm)});
      }
      return arr;
    },[]);
  },[s.workouts,selEx,s.range]);

  const volByGroup=useMemo(()=>{
    const g={};
    s.workouts.filter(w=>w.date>=ago(s.range)).forEach(w=>w.exercises.forEach(ex=>{
      const info=s.exercises.find(e=>e.id===ex.exerciseId);
      if(info){const v=ex.sets.reduce((s,st)=>s+st.weight*st.reps,0);g[info.cat]=(g[info.cat]||0)+v;}
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
  const exOpts=[...new Set(s.workouts.flatMap(w=>w.exercises.map(e=>e.exerciseId)))];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Exercise Selector */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:13,color:V.text2,fontWeight:600}}>Exercise Progression</span>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {exOpts.map(id=>(
            <Chip key={id} label={s.exercises.find(e=>e.id===id)?.name||id} active={selEx===id} onClick={()=>setSelEx(id)}/>
          ))}
        </div>
        <span style={{fontSize:11,color:V.text3,display:"block",marginBottom:6}}>Max Weight & Est. 1RM</span>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={exProg}>
            <CartesianGrid {...chartCfg.grid} vertical={false}/>
            <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
            <YAxis {...chartCfg.axis} width={30}/>
            <Tooltip {...chartCfg.tip}/>
            <Line type="monotone" dataKey="max" stroke={V.accent} strokeWidth={2} dot={{r:3}} name="Max"/>
            <Line type="monotone" dataKey="e1rm" stroke={V.purple} strokeWidth={2} strokeDasharray="5 5" dot={{r:2}} name="E1RM"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Volume Pie */}
      <Card>
        <span style={{fontSize:13,color:V.text2,fontWeight:600,display:"block",marginBottom:12}}>Volume by Muscle</span>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={volByGroup} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
              {volByGroup.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}
            </Pie>
            <Tooltip {...chartCfg.tip}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
          {volByGroup.map((g,i)=>(
            <span key={g.name} style={{fontSize:10,color:colors[i%colors.length],display:"flex",alignItems:"center",gap:4,fontWeight:600}}>
              <span style={{width:7,height:7,borderRadius:2,background:colors[i%colors.length]}}/>{g.name}
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
              <span style={{fontSize:11,color:V.accent,fontFamily:V.mono}}>{f.n}</span>
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
const WORKOUT_TYPES = ["Rest","Chest","Back","Legs","Shoulders","Arms","Core","Cardio","Push","Pull","Upper","Lower","Full Body","Custom"];
const typeColors = {
  "Rest":"#333","Chest":V.accent,"Back":V.accent2,"Legs":V.purple,"Shoulders":V.warn,
  "Arms":"#ff6b9d","Core":"#ffd93d","Cardio":"#ff6b6b","Push":V.accent,"Pull":V.accent2,
  "Upper":"#e879f9","Lower":"#fb923c","Full Body":"#34d399","Custom":"#94a3b8",
};
const WORKOUT_TYPES_COLORS = typeColors;

function CalendarTab({s,d}){
  const [viewDate,setViewDate]=useState(()=>{const n=new Date();return{y:n.getFullYear(),m:n.getMonth()};});
  const [selDate,setSelDate]=useState(null);
  const [editWeekly,setEditWeekly]=useState(false);
  const [weeklyDraft,setWeeklyDraft]=useState(s.schedule.weekly);
  const [assignSheet,setAssignSheet]=useState(null); // date string for override assign

  const todayStr=today();
  const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Build calendar grid
  const calDays=useMemo(()=>{
    const first=new Date(viewDate.y,viewDate.m,1);
    const startDay=first.getDay();
    const daysInMonth=new Date(viewDate.y,viewDate.m+1,0).getDate();
    const prevMonthDays=new Date(viewDate.y,viewDate.m,0).getDate();
    const cells=[];
    // Previous month filler
    for(let i=startDay-1;i>=0;i--){
      const d=prevMonthDays-i;
      const dt=new Date(viewDate.y,viewDate.m-1,d);
      cells.push({day:d,date:dt.toISOString().split("T")[0],inMonth:false});
    }
    // Current month
    for(let i=1;i<=daysInMonth;i++){
      const dt=new Date(viewDate.y,viewDate.m,i);
      cells.push({day:i,date:dt.toISOString().split("T")[0],inMonth:true});
    }
    // Next month filler
    const remaining=7-(cells.length%7);
    if(remaining<7){
      for(let i=1;i<=remaining;i++){
        const dt=new Date(viewDate.y,viewDate.m+1,i);
        cells.push({day:i,date:dt.toISOString().split("T")[0],inMonth:false});
      }
    }
    return cells;
  },[viewDate]);

  // Get workout type for a date
  const getType=(dateStr)=>{
    if(s.schedule.overrides[dateStr])return s.schedule.overrides[dateStr];
    const dow=new Date(dateStr+"T12:00:00").getDay();
    return s.schedule.weekly[dow]||"Rest";
  };

  // Get the workout done on a date
  const getWorkout=(dateStr)=>s.workouts.find(w=>w.date===dateStr);

  // Get the LAST workout matching a type (looking backwards from date)
  const getLastOfType=(type,beforeDate)=>{
    // Map type to exercise categories
    const catMap={"Chest":"Chest","Back":"Back","Legs":"Legs","Shoulders":"Shoulders","Arms":"Arms","Core":"Core","Cardio":"Cardio",
      "Push":"Chest","Pull":"Back","Upper":"Chest","Lower":"Legs","Full Body":"Chest"};
    // Find workouts that had exercises in this category
    const matchingCat=catMap[type];
    if(!matchingCat)return null;
    // For compound types, just find any recent workout
    if(["Push","Pull","Upper","Lower","Full Body"].includes(type)){
      return s.workouts.filter(w=>w.date<beforeDate).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
    }
    // For specific categories, find workouts that included that muscle group
    for(const w of s.workouts.filter(wk=>wk.date<beforeDate).sort((a,b)=>b.date.localeCompare(a.date))){
      const hasCategory=w.exercises.some(ex=>{
        const info=s.exercises.find(e=>e.id===ex.exerciseId);
        return info?.cat===matchingCat;
      });
      if(hasCategory)return w;
    }
    return null;
  };

  // Get recommended exercises for a workout type
  const getExercisesForType=(type)=>{
    const catMap={"Chest":"Chest","Back":"Back","Legs":"Legs","Shoulders":"Shoulders","Arms":"Arms","Core":"Core","Cardio":"Cardio"};
    const multiMap={"Push":["Chest","Shoulders","Arms"],"Pull":["Back","Arms"],"Upper":["Chest","Back","Shoulders","Arms"],
      "Lower":["Legs","Core"],"Full Body":["Chest","Back","Legs","Shoulders","Arms"]};
    const cats=multiMap[type]?multiMap[type]:(catMap[type]?[catMap[type]]:[]);
    return s.exercises.filter(e=>cats.includes(e.cat));
  };

  const prevMonth=()=>setViewDate(v=>v.m===0?{y:v.y-1,m:11}:{...v,m:v.m-1});
  const nextMonth=()=>setViewDate(v=>v.m===11?{y:v.y+1,m:0}:{...v,m:v.m+1});
  const goToday=()=>{const n=new Date();setViewDate({y:n.getFullYear(),m:n.getMonth()});};

  const saveWeekly=()=>{
    Object.entries(weeklyDraft).forEach(([day,label])=>{
      d({type:"SET_WEEKLY",day:parseInt(day),label});
      SuccessToastCtrl.show("Schedule updated");
    });
    setEditWeekly(false);
  };

  // Selected day detail
  const selType=selDate?getType(selDate):null;
  const selWorkout=selDate?getWorkout(selDate):null;
  const selLastOfType=selDate&&selType&&selType!=="Rest"?getLastOfType(selType,selDate):null;
  const selExercises=selType?getExercisesForType(selType):[];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Month Navigation */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={prevMonth} aria-label="Previous month" style={{background:"none",border:"none",padding:10,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          {Icons.chevLeft({size:20,color:V.text2})}
        </button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:700,color:V.text}}>{monthNames[viewDate.m]}</div>
          <div style={{fontSize:12,color:V.text3}}>{viewDate.y}</div>
        </div>
        <button onClick={nextMonth} aria-label="Next month" style={{background:"none",border:"none",padding:10,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          {Icons.chevRight({size:20,color:V.text2})}
        </button>
      </div>

      {/* Today button */}
      <div style={{display:"flex",justifyContent:"center"}}>
        <Btn v="small" onClick={goToday} s={{fontSize:11}}>Today</Btn>
      </div>

      {/* Weekly Plan Strip */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:12,color:V.text2,fontWeight:700}}>Weekly Plan</span>
          <Btn v="ghost" onClick={()=>{setWeeklyDraft({...s.schedule.weekly});setEditWeekly(true);}} s={{fontSize:11,padding:"4px 8px"}}>Edit</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {dayNames.map((dn,i)=>{
            const type=s.schedule.weekly[i]||"Rest";
            const color=typeColors[type]||V.text3;
            return(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:9,color:V.text3,marginBottom:3,fontWeight:600}}>{dn}</div>
                <div style={{fontSize:9,color:color,fontWeight:700,padding:"4px 2px",
                  background:`${color}12`,borderRadius:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {type==="Rest"?"—":type.slice(0,4)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card style={{padding:12}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
          {dayNames.map(dn=>(
            <div key={dn} style={{textAlign:"center",fontSize:10,color:V.text3,fontWeight:700,padding:"4px 0"}}>{dn}</div>
          ))}
        </div>
        {/* Date cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {calDays.map((cell,i)=>{
            const type=getType(cell.date);
            const isToday=cell.date===todayStr;
            const isSel=cell.date===selDate;
            const hasWorkout=!!getWorkout(cell.date);
            const color=typeColors[type]||"#333";
            const isOverride=!!s.schedule.overrides[cell.date];
            return(
              <button key={i} onClick={()=>setSelDate(cell.date===selDate?null:cell.date)}
                style={{
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  aspectRatio:"1",borderRadius:10,border:isSel?`2px solid ${V.accent}`:isToday?`1.5px solid ${V.accent}50`:"2px solid transparent",
                  background:isSel?`${V.accent}12`:type!=="Rest"?`${color}08`:"transparent",
                  cursor:"pointer",padding:2,WebkitTapHighlightColor:"transparent",position:"relative",
                  opacity:cell.inMonth?1:0.25,
                }}>
                <span style={{fontSize:13,fontWeight:isToday?800:500,color:cell.inMonth?V.text:V.text3,
                  fontFamily:V.mono,lineHeight:1}}>{cell.day}</span>
                {type!=="Rest"&&cell.inMonth&&(
                  <span style={{fontSize:6,color:color,fontWeight:800,marginTop:1,textTransform:"uppercase",lineHeight:1}}>
                    {type.slice(0,3)}
                  </span>
                )}
                {hasWorkout&&cell.inMonth&&(
                  <div style={{position:"absolute",bottom:3,width:4,height:4,borderRadius:2,background:V.accent}}/>
                )}
                {isOverride&&cell.inMonth&&(
                  <div style={{position:"absolute",top:2,right:3,width:4,height:4,borderRadius:2,background:V.warn}}/>
                )}
              </button>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:V.text3,display:"flex",alignItems:"center",gap:3}}>
            <span style={{width:5,height:5,borderRadius:3,background:V.accent}}/> Completed
          </span>
          <span style={{fontSize:9,color:V.text3,display:"flex",alignItems:"center",gap:3}}>
            <span style={{width:5,height:5,borderRadius:3,background:V.warn}}/> Override
          </span>
        </div>
      </Card>

      {/* Selected Day Detail */}
      {selDate&&(
        <Card glow>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:V.text}}>{fmtFull(selDate)}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                <span style={{fontSize:12,fontWeight:700,color:typeColors[selType]||V.text3,
                  background:`${typeColors[selType]||V.text3}15`,padding:"3px 10px",borderRadius:8}}>
                  {selType}
                </span>
                {selDate===todayStr&&<span style={{fontSize:10,color:V.accent,fontWeight:700}}>TODAY</span>}
              </div>
            </div>
            <Btn v="small" onClick={()=>setAssignSheet(selDate)} s={{fontSize:11}}>Change</Btn>
          </div>

          {/* What was done */}
          {selWorkout?(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:V.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8,
                display:"flex",alignItems:"center",gap:5}}>
                {Icons.check({size:13,color:V.accent})} Completed · {selWorkout.dur}min
              </div>
              {selWorkout.exercises.map((ex,i)=>{
                const exInfo=s.exercises.find(e=>e.id===ex.exerciseId);
                const top=ex.sets.reduce((m,st)=>st.weight>m.weight?st:m,{weight:0,reps:0});
                return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",
                    borderBottom:i<selWorkout.exercises.length-1?`1px solid rgba(255,255,255,0.04)`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:13,color:V.text}}>{exInfo?.name||ex.exerciseId}</span>
                      {exInfo?.yt&&(
                        <a href={`https://www.youtube.com/watch?v=${exInfo.yt}`} target="_blank" rel="noopener noreferrer"
                          style={{width:20,height:20,borderRadius:5,background:"rgba(255,0,0,0.10)",
                            display:"inline-flex",alignItems:"center",justifyContent:"center",textDecoration:"none",
                            WebkitTapHighlightColor:"transparent"}}>
                          {Icons.play({size:8,color:"#ff4444"})}
                        </a>
                      )}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:12,color:V.accent,fontFamily:V.mono}}>{top.weight}×{top.reps}</span>
                      <span style={{fontSize:10,color:V.text3,marginLeft:6}}>{ex.sets.length}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ):(
            selType!=="Rest"&&(
              <div style={{padding:"12px 0",marginBottom:10,borderBottom:`1px solid ${V.cardBorder}`}}>
                <div style={{fontSize:11,color:V.text3,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                  {Icons.clock({size:13,color:V.text3})} Not yet completed
                </div>
              </div>
            )
          )}

          {/* Last time this type was done */}
          {selType!=="Rest"&&selLastOfType&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:V.warn,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
                Last {selType} Day — {fmtFull(selLastOfType.date)}
              </div>
              {selLastOfType.exercises.map((ex,i)=>{
                const exInfo=s.exercises.find(e=>e.id===ex.exerciseId);
                const top=ex.sets.reduce((m,st)=>st.weight>m.weight?st:m,{weight:0,reps:0});
                return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",
                    borderBottom:i<selLastOfType.exercises.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:12,color:V.text2}}>{exInfo?.name||ex.exerciseId}</span>
                      {exInfo?.yt&&(
                        <a href={`https://www.youtube.com/watch?v=${exInfo.yt}`} target="_blank" rel="noopener noreferrer"
                          style={{width:18,height:18,borderRadius:5,background:"rgba(255,0,0,0.08)",
                            display:"inline-flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}}>
                          {Icons.play({size:7,color:"#ff4444"})}
                        </a>
                      )}
                    </div>
                    <span style={{fontSize:11,color:V.text3,fontFamily:V.mono}}>{top.weight}×{top.reps} · {ex.sets.length}s</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggested exercises for this day */}
          {selType!=="Rest"&&selExercises.length>0&&(
            <div>
              <div style={{fontSize:11,color:V.text3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
                {selType} Exercises
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {selExercises.slice(0,12).map(ex=>(
                  <a key={ex.id} href={ex.yt?`https://www.youtube.com/watch?v=${ex.yt}`:undefined}
                    target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",
                      background:`${typeColors[selType]||V.text3}08`,border:`1px solid ${typeColors[selType]||V.text3}15`,
                      borderRadius:8,textDecoration:"none",WebkitTapHighlightColor:"transparent"}}>
                    <span style={{fontSize:11,color:V.text2}}>{ex.name}</span>
                    {ex.yt&&Icons.play({size:8,color:"#ff4444"})}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Edit Weekly Schedule Sheet */}
      {editWeekly&&(
        <Sheet title="Edit Weekly Plan" onClose={()=>setEditWeekly(false)}>
          <div style={{fontSize:12,color:V.text3,marginBottom:16}}>
            Assign a workout type to each day of the week. This sets your recurring plan.
          </div>
          {dayNames.map((dn,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{width:40,fontSize:13,color:V.text,fontWeight:700}}>{dn}</span>
              <div style={{flex:1,display:"flex",gap:4,flexWrap:"wrap"}}>
                {WORKOUT_TYPES.map(t=>(
                  <button key={t} onClick={()=>setWeeklyDraft(d=>({...d,[i]:t}))}
                    style={{padding:"6px 10px",borderRadius:8,border:"none",fontSize:11,fontWeight:600,
                      fontFamily:V.font,cursor:"pointer",WebkitTapHighlightColor:"transparent",
                      background:weeklyDraft[i]===t?`${typeColors[t]||V.text3}25`:"rgba(255,255,255,0.04)",
                      color:weeklyDraft[i]===t?(typeColors[t]||V.text3):V.text3}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <Btn v="secondary" full onClick={()=>setEditWeekly(false)}>Cancel</Btn>
            <Btn full onClick={saveWeekly}>{Icons.check({size:16,color:V.bg})} Save</Btn>
          </div>
        </Sheet>
      )}

      {/* Assign Override Sheet */}
      {assignSheet&&(
        <Sheet title={`Assign — ${fmtFull(assignSheet)}`} onClose={()=>setAssignSheet(null)}>
          <div style={{fontSize:12,color:V.text3,marginBottom:12}}>
            Override the workout type for this specific date. Tap "Use Weekly Default" to remove the override.
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {WORKOUT_TYPES.map(t=>{
              const current=s.schedule.overrides[assignSheet];
              const isActive=current===t;
              return(
                <button key={t} onClick={()=>{d({type:"SET_OVERRIDE",date:assignSheet,label:t});setAssignSheet(null);setSelDate(assignSheet);SuccessToastCtrl.show(`${assignSheet} → ${t}`);}}
                  style={{padding:"12px 16px",borderRadius:12,border:`1.5px solid ${isActive?typeColors[t]||V.text3:V.cardBorder}`,
                    fontSize:13,fontWeight:600,fontFamily:V.font,cursor:"pointer",WebkitTapHighlightColor:"transparent",
                    background:isActive?`${typeColors[t]||V.text3}15`:"rgba(255,255,255,0.03)",
                    color:typeColors[t]||V.text3,minWidth:80,textAlign:"center"}}>
                  {t}
                </button>
              );
            })}
          </div>
          {s.schedule.overrides[assignSheet]&&(
            <Btn v="ghost" full onClick={()=>{d({type:"SET_OVERRIDE",date:assignSheet,label:null});setAssignSheet(null);}}
              s={{marginTop:14,color:V.text3}}>
              Use Weekly Default
            </Btn>
          )}
        </Sheet>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  SETTINGS TAB (More)
// ═══════════════════════════════════════

export { BodyTab };
export default BodyTab;
