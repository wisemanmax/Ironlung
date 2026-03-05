import React, { useState, useEffect, useMemo, useRef } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, ago, fmtShort, fmtFull, uid } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl, ValidationWarning, ExercisePicker, YTBtn } from '../shared/index.jsx';
import { calcReadiness } from '../../hooks/index.js';
import { wUnit, convW } from '../../data/plates.js';

// ─── Daily Check-in Modal ───
function CheckinModal({s,d,onClose}){
  const [soreness,setSoreness]=useState(3);
  const [energy,setEnergy]=useState(3);
  const [motivation,setMotivation]=useState(3);
  const [sleep,setSleep]=useState("");
  const [notes,setNotes]=useState("");

  const labels={soreness:["","Very sore","Sore","Normal","Fresh","Fully recovered"],
    energy:["","Drained","Low","Normal","High","Wired"],
    motivation:["","None","Low","Okay","Pumped","On fire"]};

  const Slider=({label,value,onChange,type})=>(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:12,fontWeight:600,color:V.text}}>{label}</span>
        <span style={{fontSize:11,color:value>=4?V.accent:value>=3?V.warn:V.danger,fontWeight:700,fontFamily:V.mono}}>
          {labels[type][value]}
        </span>
      </div>
      <div style={{display:"flex",gap:6}}>
        {[1,2,3,4,5].map(v=>(
          <button key={v} onClick={()=>onChange(v)} style={{
            flex:1,height:36,borderRadius:8,border:`1.5px solid ${value>=v?(v>=4?V.accent:v>=3?V.warn:V.danger):V.cardBorder}`,
            background:value>=v?`${v>=4?V.accent:v>=3?V.warn:V.danger}15`:"rgba(255,255,255,0.02)",
            cursor:"pointer",WebkitTapHighlightColor:"transparent",
            fontSize:13,fontWeight:700,color:value>=v?(v>=4?V.accent:v>=3?V.warn:V.danger):V.text3,fontFamily:V.mono,
          }}>{v}</button>
        ))}
      </div>
    </div>
  );

  const save=()=>{
    d({type:"ADD_CHECKIN",c:{
      date:today(),soreness,energy,motivation,
      sleep:parseFloat(sleep)||0,notes,
      timestamp:new Date().toISOString()
    }});
    SuccessToastCtrl.show("Check-in logged");
    onClose();
  };

  return(
    <Sheet title="Daily Check-in" onClose={onClose}
      footer={<Btn full onClick={save}>{Icons.check({size:16,color:V.bg})} Log Check-in</Btn>}>
      <div style={{fontSize:12,color:V.text3,marginBottom:14,lineHeight:1.5}}>
        Quick 30-second check. This powers your readiness score and helps adjust your training.
      </div>

      <Slider label="Muscle Soreness" value={soreness} onChange={setSoreness} type="soreness"/>
      <Slider label="Energy Level" value={energy} onChange={setEnergy} type="energy"/>
      <Slider label="Motivation" value={motivation} onChange={setMotivation} type="motivation"/>

      <Field label="Sleep Last Night" type="number" value={sleep} onChange={setSleep} unit="hrs" placeholder="e.g. 7.5" step="0.5"/>
      <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="How are you feeling?"/>
    </Sheet>
  );
}

// ─── Readiness Card (Home Page) ───
function ReadinessCard({s,d}){
  const [showCheckin,setShowCheckin]=useState(false);
  const r=useMemo(()=>calcReadiness(s),[s.workouts,s.nutrition,s.checkins,s.goals]);

  const circumference=2*Math.PI*38;
  const dashOffset=circumference-(r.score/100)*circumference;

  return(
    <div>
      <Card style={{padding:14}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {/* Circular gauge */}
          <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
            <svg width="72" height="72" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="38" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6"/>
              <circle cx="42" cy="42" r="38" fill="none" stroke={r.color} strokeWidth="6"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform="rotate(-90 42 42)"
                style={{transition:"stroke-dashoffset 0.8s ease"}}/>
            </svg>
            <div style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:22,fontWeight:900,color:r.color,fontFamily:V.mono,lineHeight:1}}>{r.score}</div>
              <div style={{fontSize:7,color:V.text3,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{r.level}</div>
            </div>
          </div>

          {/* Info */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <div style={{fontSize:13,fontWeight:700,color:V.text}}>Readiness</div>
              {!r.hasCheckin&&(
                <button onClick={()=>setShowCheckin(true)} style={{
                  padding:"4px 10px",borderRadius:8,background:`${V.accent}12`,border:`1px solid ${V.accent}25`,
                  cursor:"pointer",WebkitTapHighlightColor:"transparent",
                  fontSize:10,fontWeight:700,color:V.accent,fontFamily:V.font
                }}>Check in</button>
              )}
              {r.hasCheckin&&(
                <span style={{fontSize:9,color:V.accent,fontWeight:600}}>{Icons.check({size:10,color:V.accent})} Logged</span>
              )}
            </div>
            <div style={{fontSize:11,color:V.text3,lineHeight:1.5,marginBottom:6}}>{r.rec}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {r.factors.slice(0,3).map((f,i)=>(
                <span key={i} style={{fontSize:8,padding:"2px 6px",borderRadius:4,
                  background:`${f.color}10`,color:f.color,fontWeight:600}}>
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {showCheckin&&<CheckinModal s={s} d={d} onClose={()=>setShowCheckin(false)}/>}
    </div>
  );
}

// ─── Readiness Trend (Track Hub) ───
function ReadinessTrend({s}){
  const data=useMemo(()=>{
    const days=[];
    for(let i=13;i>=0;i--){
      const d=ago(i);
      const checkin=(s.checkins||[]).find(c=>c.date===d);
      const tn=s.nutrition.find(n=>n.date===d);
      // Simplified readiness for historical (no self-report for past days without checkin)
      let score=50;
      const sleep=checkin?.sleep||tn?.sleep||0;
      if(sleep>=7.5)score+=25;else if(sleep>=6.5)score+=18;else if(sleep>=5)score+=8;
      if(checkin){
        const avg=(checkin.soreness+checkin.energy+checkin.motivation)/3;
        score+=Math.round(avg*4);
      }
      const wThatDay=s.workouts.find(w=>w.date===d);
      if(wThatDay)score+=5;
      days.push({date:fmtShort(d),score:Math.min(100,Math.max(0,score)),hasCheckin:!!checkin});
    }
    return days;
  },[s.checkins,s.nutrition,s.workouts]);

  const checkinHistory=(s.checkins||[]).slice(0,10);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Readiness Trend</div>

      {data.length>0&&(
        <Card style={{padding:14}}>
          <div style={{fontSize:12,color:V.text3,fontWeight:600,marginBottom:10}}>Last 14 Days</div>
          <div style={{height:120}}>
            <Recharts.ResponsiveContainer width="100%" height="100%">
              <Recharts.AreaChart data={data}>
                <Recharts.XAxis dataKey="date" tick={{fontSize:8,fill:V.text3}} tickLine={false} axisLine={false}/>
                <Recharts.YAxis domain={[0,100]} tick={{fontSize:8,fill:V.text3}} tickLine={false} axisLine={false} width={25}/>
                <Recharts.Area type="monotone" dataKey="score" stroke={V.accent} fill={`${V.accent}20`} strokeWidth={2}/>
                <Recharts.ReferenceLine y={60} stroke={V.warn} strokeDasharray="3 3" strokeOpacity={0.4}/>
              </Recharts.AreaChart>
            </Recharts.ResponsiveContainer>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:6}}>
            <span style={{fontSize:9,color:V.text3}}>Above 60 = ready to train</span>
            <span style={{fontSize:9,color:V.warn}}>- - threshold</span>
          </div>
        </Card>
      )}

      {/* Check-in history */}
      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Recent Check-ins</div>
      {checkinHistory.length===0?(
        <Card style={{padding:16,textAlign:"center"}}>
          <div style={{fontSize:12,color:V.text3}}>No check-ins yet. Log your first from the Home page.</div>
        </Card>
      ):checkinHistory.map(c=>(
        <Card key={c.date} style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:V.text}}>{fmtShort(c.date)}</span>
            {c.sleep>0&&<span style={{fontSize:10,color:V.purple,fontFamily:V.mono}}>{Icons.moon({size:10,color:V.purple})} {(parseFloat(c.sleep)||0).toFixed(1)}h</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            {[{l:"Soreness",v:c.soreness,c2:c.soreness>=4?V.accent:c.soreness>=3?V.warn:V.danger},
              {l:"Energy",v:c.energy,c2:c.energy>=4?V.accent:c.energy>=3?V.warn:V.danger},
              {l:"Motivation",v:c.motivation,c2:c.motivation>=4?V.accent:c.motivation>=3?V.warn:V.danger}
            ].map(m=>(
              <div key={m.l} style={{flex:1,textAlign:"center",padding:"6px 0",borderRadius:8,background:`${m.c2}08`}}>
                <div style={{fontSize:16,fontWeight:800,color:m.c2,fontFamily:V.mono}}>{m.v}</div>
                <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{m.l}</div>
              </div>
            ))}
          </div>
          {c.notes&&<div style={{fontSize:10,color:V.text3,marginTop:6,fontStyle:"italic"}}>{c.notes}</div>}
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  HOME TAB
// ═══════════════════════════════════════
function HomeTab({s,d}){
  const [shareCard,setShareCard]=useState(false);
  const td=today();
  const streak=useStreak(s.workouts);
  const prs=usePRs(s.workouts,s.exercises);
  const tn=s.nutrition.find(n=>n.date===td);
  const todayW=s.workouts.find(w=>w.date===td);
  const ww=s.workouts.filter(w=>w.date>=ago(7)).length;
  const vol=s.workouts.filter(w=>w.date>=ago(7)).reduce((sum,w)=>sum+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
  const dow=new Date().getDay();
  const todayType=s.schedule.overrides[td]||s.schedule.weekly[dow]||"Rest";
  const u=wUnit(s.units);
  const hr=new Date().getHours();
  const greeting=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening";
  const displayName=s.profile?.nickname||s.profile?.firstName||"";
  const latestBW=s.body.find(b=>b.weight)?.weight;

  // Weekly dots
  const weekDays=["S","M","T","W","T","F","S"];
  const last7=Array.from({length:7}).map((_,i)=>{
    const d2=new Date();d2.setDate(d2.getDate()-6+i);
    const ds=d2.toISOString().slice(0,10);
    return{day:weekDays[d2.getDay()],active:s.workouts.some(w=>w.date===ds),isToday:ds===td};
  });

  const strengthData=useMemo(()=>{
    const map={};
    s.workouts.filter(w=>w.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(w=>{
      w.exercises.forEach(ex=>{
        if(["bench","squat","deadlift"].includes(ex.exerciseId)){
          const mx=Math.max(...ex.sets.map(st=>st.weight));
          if(!map[w.date])map[w.date]={date:fmtShort(w.date)};
          map[w.date][ex.exerciseId]=mx;
        }
      });
    });
    return Object.values(map);
  },[s.workouts,s.range]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10,paddingBottom:4}}>

      {/* Hero: Greeting + Today + Streak */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:12,color:V.text3}}>{greeting}{displayName?`, ${displayName}`:""}</div>
            {LS.get("ft-last-sync")&&<div style={{fontSize:9,color:V.text3,marginTop:2,display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:6,height:6,borderRadius:3,background:V.accent}}/>
              Synced {(()=>{const d2=new Date(LS.get("ft-last-sync"));const m=Math.round((Date.now()-d2)/60000);return m<1?"just now":m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`;})()}
            </div>}
            <SyncStatus s={s}/>
          </div>
          <div style={{fontSize:20,fontWeight:800,color:V.text,lineHeight:1.2}}>
            {todayType==="Rest"?"Recovery Day":`${todayType} Day`}
          </div>
        </div>
        {streak>0&&(
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:10,
            background:"rgba(255,159,67,0.1)",border:"1px solid rgba(255,159,67,0.12)"}}>
            {Icons.flame({size:14,color:V.warn})}
            <span style={{fontSize:15,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{streak}</span>
          </div>
        )}
      </div>

      {/* Accountability partner nudge */}
      {(()=>{
        const partners=LS.get("ft-accountability")||[];
        const myLastW=s.workouts[0]?.date;
        const myDaysOff=myLastW?Math.floor((Date.now()-new Date(myLastW+"T12:00:00"))/86400000):99;
        if(partners.length>0&&myDaysOff>=2)return(
          <Card style={{padding:12,border:`1px solid rgba(255,159,67,0.2)`,background:"rgba(255,159,67,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>🤝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:V.warn}}>Your accountability partner is counting on you</div>
                <div style={{fontSize:10,color:V.text3,marginTop:2}}>{myDaysOff} days since your last workout — don't break the chain!</div>
              </div>
            </div>
            <Btn full onClick={()=>d({type:"TAB",tab:"log_workout"})} s={{marginTop:8,background:V.warn}}>Log a Workout</Btn>
          </Card>
        );
        return null;
      })()}

      {/* Quick Actions — compact */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[
          {id:"log_workout",icon:Icons.dumbbell,label:"Workout",color:V.accent},
          {id:"log_nutrition",icon:Icons.fork,label:"Nutrition",color:V.warn},
          {id:"log_body",icon:Icons.scale,label:"Weigh In",color:V.accent2},
        ].map(a=>(
          <button key={a.id} onClick={()=>d({type:"TAB",tab:a.id})} style={{
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"12px 6px",
            background:`${a.color}06`,border:`1px solid ${a.color}15`,borderRadius:12,
            cursor:"pointer",WebkitTapHighlightColor:"transparent",
          }}>
            <div style={{width:34,height:34,borderRadius:10,background:`${a.color}12`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {a.icon({size:16,color:a.color})}
            </div>
            <span style={{fontSize:10,fontWeight:700,color:a.color}}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Readiness Score */}
      <ReadinessCard s={s} d={d}/>

      {/* Week + Stats combined in one card */}
      <Card style={{padding:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",gap:4}}>
            {last7.map((day,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <span style={{fontSize:8,color:day.isToday?V.accent:V.text3,fontWeight:day.isToday?700:400}}>{day.day}</span>
                <div style={{width:26,height:26,borderRadius:8,
                  background:day.active?`${V.accent}20`:"rgba(255,255,255,0.03)",
                  border:day.isToday?`1.5px solid ${V.accent}`:"1px solid rgba(255,255,255,0.04)",
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {day.active&&Icons.check({size:11,color:V.accent})}
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{ww}<span style={{fontSize:10,color:V.text3,fontWeight:500}}>/7</span></div>
          </div>
        </div>
        <div style={{display:"flex",gap:0,borderTop:`1px solid ${V.cardBorder}`,paddingTop:10}}>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:V.accent2,fontFamily:V.mono}}>{vol>1000?`${(vol/1000).toFixed(1)}k`:vol}</div>
            <div style={{fontSize:8,color:V.text3,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Volume</div>
          </div>
          <div style={{width:1,background:V.cardBorder}}/>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{latestBW||"--"}</div>
            <div style={{fontSize:8,color:V.text3,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Weight ({u})</div>
          </div>
          <div style={{width:1,background:V.cardBorder}}/>
          {(()=>{
            const bw2=s.body.find(b=>b.weight)?.weight||s.goals.goalWeight||180;
            const ss=calcStrengthScore(s.workouts,bw2);
            return(
              <div style={{flex:1,textAlign:"center",cursor:"pointer"}} onClick={()=>d({type:"TAB",tab:"track_strength"})}>
                <div style={{fontSize:16,fontWeight:800,color:ss.rankColor,fontFamily:V.mono}}>{ss.score.toFixed(2)}</div>
                <div style={{fontSize:8,color:V.text3,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Strength</div>
              </div>
            );
          })()}
        </div>
      </Card>

      {/* Today's Nutrition — compact */}
      {tn ? (
        <Card style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:12,color:V.text3,fontWeight:600}}>Today's Intake</span>
            <span style={{fontSize:16,fontWeight:700,color:V.warn,fontFamily:V.mono}}>{tn.cal}<span style={{fontSize:10,color:V.text3}}>/{s.goals.cal}</span></span>
          </div>
          <Progress val={tn.cal} max={s.goals.cal} color={V.warn} h={6}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
            {[{l:"P",v:tn.protein,g:s.goals.protein,c:V.accent},{l:"C",v:tn.carbs,g:s.goals.carbs,c:V.accent2},{l:"F",v:tn.fat,g:s.goals.fat,c:V.warn}].map(m=>(
              <div key={m.l}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,color:m.c,fontWeight:700}}>{m.l}</span>
                  <span style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>{m.v}/{m.g}</span>
                </div>
                <Progress val={m.v} max={m.g} color={m.c} h={4}/>
              </div>
            ))}
          </div>
          {(tn.water>0||tn.sleep>0)&&(
            <div style={{display:"flex",alignItems:"center",gap:14,marginTop:8}}>
              {tn.water>0&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                {Icons.droplet({size:11,color:V.accent2})}<span style={{fontSize:11,color:V.accent2,fontFamily:V.mono,fontWeight:600}}>{tn.water}/8</span>
              </div>}
              {tn.sleep>0&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                {Icons.moon({size:11,color:V.purple})}<span style={{fontSize:11,color:V.purple,fontFamily:V.mono,fontWeight:600}}>{t(parseFloat(n.sleep)||0).toFixed(1)}h</span>
              </div>}
            </div>
          )}
        </Card>
      ) : (
        <button onClick={()=>d({type:"TAB",tab:"log_nutrition"})} style={{
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px",
          background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:14,
          cursor:"pointer",WebkitTapHighlightColor:"transparent"
        }}>
          {Icons.fork({size:14,color:V.warn})}
          <span style={{fontSize:12,color:V.warn,fontWeight:600}}>Log today's nutrition</span>
        </button>
      )}

      {/* Today's Workout — only if completed */}
      {todayW&&(
        <Card glow style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:shareCard?10:0}}>
            {Icons.check({size:14,color:V.accent})}
            <span style={{fontSize:12,color:V.accent,fontWeight:700}}>Workout Complete</span>
            <span style={{flex:1}}/>
            <span style={{fontSize:10,color:V.text3}}>{todayW.exercises.reduce((n,e)=>n+e.sets.length,0)}s · {todayW.dur}m</span>
            {todayW.rating&&<span style={{fontSize:9,color:V.warn}}>{"★".repeat(todayW.rating)}</span>}
            <button onClick={()=>setShareCard(!shareCard)} style={{marginLeft:4,padding:"3px 8px",borderRadius:6,
              background:`${V.accent}12`,border:"none",cursor:"pointer",fontSize:9,color:V.accent,fontWeight:700}}>
              {shareCard?"Hide":"Share"}
            </button>
          </div>
          {shareCard&&<WorkoutCard workout={todayW} s={s}/>}
        </Card>
      )}

      {/* Strength Chart — compact */}
      {strengthData.length>1&&(
        <Card style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:V.text3,fontWeight:600}}>Strength</span>
            <div style={{display:"flex",gap:6}}>
              {[{c:V.accent,l:"B"},{c:V.accent2,l:"S"},{c:V.purple,l:"D"}].map(e=>(
                <span key={e.l} style={{fontSize:8,color:e.c,display:"flex",alignItems:"center",gap:2,fontWeight:700}}>
                  <span style={{width:5,height:2.5,background:e.c,borderRadius:1}}/>{e.l}</span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={strengthData}>
              <CartesianGrid {...chartCfg.grid} vertical={false}/>
              <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
              <YAxis {...chartCfg.axis} width={28}/>
              <Tooltip {...chartCfg.tip}/>
              <Line type="monotone" dataKey="bench" stroke={V.accent} strokeWidth={1.5} dot={{r:2}} connectNulls/>
              <Line type="monotone" dataKey="squat" stroke={V.accent2} strokeWidth={1.5} dot={{r:2}} connectNulls/>
              <Line type="monotone" dataKey="deadlift" stroke={V.purple} strokeWidth={1.5} dot={{r:2}} connectNulls/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* PR Wall — top 3 only, inline */}
      {Object.keys(prs).length>0&&(
        <Card style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              {Icons.trophy({size:13,color:V.warn})}
              <span style={{fontSize:12,color:V.text3,fontWeight:600}}>Top PRs</span>
            </div>
            <button onClick={()=>d({type:"TAB",tab:"track_workouts"})} style={{background:"none",border:"none",cursor:"pointer",
              fontSize:10,color:V.accent,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>All</button>
          </div>
          {Object.entries(prs).sort((a,b)=>b[1].e1rm-a[1].e1rm).slice(0,3).map(([id,pr])=>(
            <div key={id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <span style={{fontSize:11,color:V.text}}>{pr.name}</span>
              <span style={{fontSize:12,color:V.accent,fontFamily:V.mono,fontWeight:700}}>{pr.weight}×{pr.reps}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Recent — 2 workouts, compact rows */}
      {s.workouts.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,color:V.text3,fontWeight:600}}>Recent</span>
            <button onClick={()=>d({type:"TAB",tab:"track_workouts"})} style={{background:"none",border:"none",cursor:"pointer",
              fontSize:10,color:V.accent,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>All</button>
          </div>
          {s.workouts.slice(0,2).map(w=>{
            const names=w.exercises.map(e=>s.exercises.find(x=>x.id===e.exerciseId)?.name||e.exerciseId);
            const sets=w.exercises.reduce((n,e)=>n+e.sets.length,0);
            return(
              <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:6,
                background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:12}}>
                <div style={{width:32,height:32,borderRadius:9,background:`${V.accent}10`,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {Icons.dumbbell({size:14,color:V.accent})}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:V.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{names.join(", ")}</div>
                  <div style={{fontSize:10,color:V.text3,marginTop:1}}>{fmtShort(w.date)} · {sets}s · {w.dur}m</div>
                </div>
                {w.rating&&<span style={{fontSize:8,color:V.warn}}>{"★".repeat(w.rating)}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {s.workouts.length===0&&!tn&&(
        <Card style={{textAlign:"center",padding:"24px 16px"}}>
          <div style={{fontSize:32,marginBottom:8}}>💪</div>
          <div style={{fontSize:15,fontWeight:700,color:V.text,marginBottom:4}}>Ready to start?</div>
          <div style={{fontSize:11,color:V.text3,marginBottom:14}}>Log your first workout to see your dashboard come to life.</div>
          <Btn full onClick={()=>d({type:"TAB",tab:"log_workout"})}>{Icons.dumbbell({size:16,color:V.bg})} Log First Workout</Btn>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  WORKOUT TAB
// ═══════════════════════════════════════

export { HomeTab };
export default HomeTab;
