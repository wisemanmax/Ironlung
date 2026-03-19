import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Chip, Stat, Skeleton, SkeletonCard, Progress, Sheet, Field, SuccessToastCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, calc1RM, convW, wUnit, dUnit } from '../utils/helpers';
import { CloudSync } from '../utils/sync';
import { ShareCard } from '../utils/share';
import { BADGE_DEFS, calcEarnedBadges } from '../data/badges';
import { calcReadiness, useStreak, usePRs } from '../components/dialogs';
import { getActiveMultiplier } from './social';

export function HomeTab({s,d}){
  const [shareCard,setShareCard]=useState(false);
  const td=today();
  const streak=useStreak(s.workouts);
  const prs=usePRs(s.workouts,s.exercises);
  const tn=s.nutrition.find(n=>n.date===td);
  const todayW=s.workouts.find(w=>w.date===td);
  const ww=s.workouts.filter(w=>w.date>=ago(7)).length;
  const vol=s.workouts.filter(w=>w.date>=ago(7)).reduce((sum,w)=>sum+w.exercises.reduce((es,ex)=>{const c=isCardio(ex.exerciseId,s.exercises);return es+ex.sets.reduce((ss,st)=>ss+(c?(parseFloat(st.duration)||0):(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)),0);},0),0);
  const dow=new Date().getDay();
  const todayType=s.schedule.overrides[td]||s.schedule.weekly[dow]||"Rest";
  const u=wUnit(s.units);
  const hr=new Date().getHours();
  const greeting=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening";
  const displayName=s.profile?.nickname||s.profile?.firstName||"";
  const latestBW=s.body.find(b=>b.weight)?.weight;


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
    <div style={{display:"flex",flexDirection:"column",gap:14,paddingBottom:8}}>

      {/* Today's workout done — mini exercise strip */}
      {todayW&&(
        <div style={{padding:"10px 14px",borderRadius:12,
          background:"linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.04))",
          border:"1px solid rgba(99,102,241,0.15)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:11,fontWeight:800,color:V.accent}}>✅ Workout logged today</div>
            <div style={{fontSize:9,color:V.text3}}>{todayW.exercises.reduce((a,e)=>a+e.sets.length,0)} sets · {todayW.dur||"?"}min</div>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {todayW.exercises.map((ex,i)=>(
              <span key={i} style={{fontSize:9,padding:"2px 7px",borderRadius:5,
                background:"rgba(99,102,241,0.1)",color:V.accent2,fontWeight:600}}>
                {s.exercises.find(e=>e.id===ex.exerciseId)?.name?.split(" ")[0]||ex.exerciseId}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Streak at risk nudge — show only after 5pm if no workout today but had one yesterday */}
      {!todayW&&streak>0&&new Date().getHours()>=17&&(
        <div style={{padding:"10px 14px",borderRadius:12,
          background:"linear-gradient(135deg,rgba(245,158,11,0.1),rgba(249,115,22,0.06))",
          border:"1px solid rgba(245,158,11,0.2)",display:"flex",alignItems:"center",gap:10}}
          onClick={()=>d({type:"TAB",tab:"log_workout"})}>
          <span style={{fontSize:20}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:800,color:V.warn}}>Streak at risk</div>
            <div style={{fontSize:10,color:V.text3}}>Log any workout to keep your {streak}-day streak alive · expires at midnight</div>
          </div>
          <span style={{fontSize:18,color:V.warn}}>→</span>
        </div>
      )}
      {/* ── FEATURE #2: Morning Briefing Hero ── */}
      {(()=>{
        const mult=getActiveMultiplier(s);
        const tips=todayW
          ?["Rest up — recovery is where you grow.","Hydrate and hit your protein today.","Great session! Log your nutrition to complete the day."]
          :todayType==="Rest"
            ?["Active rest: mobility work keeps you limber.","Recovery day — prioritize sleep and protein.","Foam roll, stretch, recover strong."]
            :["Warm up for 5 min before your first set.","Focus on form today — quality over quantity.","Progressive overload: add 5 lbs if last session felt easy."];
        const tip=tips[new Date().getDate()%tips.length];
        const lastCheckin=(s.checkins||[]).find(c=>c.date===td);
        const readinessOk=lastCheckin&&(lastCheckin.energy>=3||lastCheckin.motivation>=3);
        return(
          <div style={{padding:"14px 16px",borderRadius:14,
            background:"linear-gradient(135deg,rgba(0,245,160,0.05),rgba(0,217,245,0.03))",
            border:"1px solid rgba(0,245,160,0.1)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div>
                <div style={{fontSize:11,color:V.text3,marginBottom:2}}>{greeting}{displayName?`, ${displayName}`:""}</div>
                <div style={{fontSize:19,fontWeight:800,color:V.text,lineHeight:1.1}}>
                  {todayType==="Rest"?"Recovery Day":`${todayType} Day`}
                  {todayW&&<span style={{fontSize:12,color:V.accent,marginLeft:8,fontWeight:600}}>✅ Done</span>}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <SyncStatus s={s}/>
                {mult.mult>1&&(
                  <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:6,
                    background:mult.color+"20",color:mult.color,letterSpacing:".04em"}}>
                    {mult.icon} {mult.label}
                  </span>
                )}
              </div>
            </div>
            <div style={{fontSize:10,color:V.text3,lineHeight:1.5,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:6,
              display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12}}>💡</span>
              <span>{tip}</span>
            </div>
            {!todayW&&todayType!=="Rest"&&(
              <button onClick={()=>d({type:"TAB",tab:"log_workout"})} style={{
                width:"100%",marginTop:10,padding:"9px",borderRadius:10,border:"none",
                background:`${V.accent}15`,cursor:"pointer",fontSize:12,fontWeight:700,
                color:V.accent,fontFamily:V.font,WebkitTapHighlightColor:"transparent"}}>
                Start {todayType} Workout →
              </button>
            )}
          </div>
        );
      })()}
        {streak>0&&(
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:10,
            background:"rgba(255,159,67,0.1)",border:"1px solid rgba(255,159,67,0.12)"}}>
            {Icons.flame({size:14,color:V.warn})}
            <span style={{fontSize:15,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{streak}</span>
            <HelpBtn topic="shields" color="#f59e0b"/>
            {(()=>{
              const shields=parseInt(LS.get("ft-streak-shields"))||0;
              if(shields<=0)return null;
              return(
                <span title={`${shields} streak shield${shields!==1?"s":""} — protects your streak for 1 missed day each`}
                  style={{display:"flex",alignItems:"center",gap:2,
                    padding:"1px 6px",borderRadius:5,background:"rgba(96,165,250,0.12)",
                    border:"1px solid rgba(96,165,250,0.25)"}}>
                  <span style={{fontSize:10}}>🛡️</span>
                  <span style={{fontSize:9,fontWeight:700,color:"#60a5fa"}}>{shields}</span>
                </span>
              );
            })()}
            {(()=>{
              // Calculate longest streak ever
              let best=0,cur=0;
              const dates=[...new Set(s.workouts.map(w=>w.date))].sort();
              for(let i=0;i<dates.length;i++){
                if(i===0||(new Date(dates[i])-new Date(dates[i-1]))/(86400000)<=1.5)cur++;
                else cur=1;
                if(cur>best)best=cur;
              }
              if(streak>=best&&streak>=7)return <span style={{fontSize:9,color:V.warn,marginLeft:2}}>🏆 Personal best!</span>;
              if(best>streak)return <span style={{fontSize:9,color:V.text3,marginLeft:2}}>{best-streak} to beat your record ({best})</span>;
              return null;
            })()}
          </div>
        )}

      {/* Today's Focus — unified workout CTA */}
      {(()=>{
        // Active training day, not yet logged → show plan + start
        if(todayType!=="Rest"&&todayType!=="Off"&&!todayW){
          const hoursLeft=23-hr;
          const splitExercises=(()=>{
            for(const prog of PROGRAMS){const exs=prog.exercises?.[todayType];if(exs)return exs;}
            const catMap={Push:["Chest","Shoulders","Triceps"],Pull:["Back","Biceps"],Legs:["Legs","Glutes"],
              "Full Body":["Chest","Back","Legs","Shoulders"],"Upper Power":["Chest","Back","Shoulders"],
              "Lower Power":["Legs","Glutes"],Chest:["Chest"],Back:["Back"],Shoulders:["Shoulders"],Arms:["Biceps","Triceps"]};
            const cats=catMap[todayType];
            if(cats)return s.exercises.filter(e=>cats.includes(e.cat)).slice(0,6).map(e=>e.name);
            return null;
          })();
          return(
            <Card style={{padding:14,border:`1px solid ${V.accent}20`,background:`${V.accent}05`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:splitExercises?10:0}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text}}>{todayType} Day</div>
                  <div style={{fontSize:11,color:hoursLeft<=4?V.danger:V.text3,marginTop:2}}>
                    {hoursLeft<=4?`Only ${hoursLeft}h left today`:`${splitExercises?splitExercises.length+" exercises":"Ready to train"}`}
                  </div>
                </div>
                <Btn onClick={()=>d({type:"TAB",tab:"log_workout"})} s={{padding:"8px 18px",fontSize:13}}>
                  {Icons.dumbbell({size:13,color:V.bg})} Start
                </Btn>
              </div>
              {splitExercises&&(
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {splitExercises.map((ex,i)=>(
                    <span key={i} style={{padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,0.04)",
                      fontSize:11,color:V.text2,border:`1px solid ${V.cardBorder}`}}>{ex}</span>
                  ))}
                </div>
              )}
            </Card>
          );
        }
        // Rest/done day → show next training day quietly
        for(let i=1;i<=7;i++){
          const nd=new Date();nd.setDate(nd.getDate()+i);
          const nds=nd.toISOString().slice(0,10);
          const nType=s.schedule.overrides[nds]||s.schedule.weekly[nd.getDay()]||"Rest";
          if(nType!=="Rest"&&nType!=="Off"){
            const dayName=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][nd.getDay()];
            return(
              <div style={{padding:"8px 14px",borderRadius:10,background:"rgba(255,255,255,0.02)",
                border:`1px solid ${V.cardBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,color:V.text3}}>Next: <span style={{color:V.text,fontWeight:600}}>{nType}</span></div>
                <span style={{fontSize:11,color:V.text3,fontFamily:V.mono}}>{i===1?"Tomorrow":`${dayName} · ${i}d`}</span>
              </div>
            );
          }
        }
        return null;
      })()}

      {/* Accountability partner nudge */}
      {(()=>{
        const partners=LS.get("ft-accountability")||[];
        if(partners.length===0)return null;
        const myLastW=s.workouts[0]?.date;
        const myDaysOff=myLastW?Math.floor((Date.now()-new Date(myLastW+"T12:00:00"))/86400000):99;
        const lastPartnerCheck=LS.get("ft-partner-check")||0;
        const hoursSinceCheck=Math.floor((Date.now()-lastPartnerCheck)/3600000);
        if(myDaysOff>=2)return(
          <Card style={{padding:12,border:`1px solid rgba(255,159,67,0.2)`,background:"rgba(255,159,67,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>🤝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:V.warn}}>Your accountability partner is counting on you</div>
                <div style={{fontSize:11,color:V.text3,marginTop:2}}>{myDaysOff} days since your last workout</div>
              </div>
            </div>
            <Btn full onClick={()=>d({type:"TAB",tab:"log_workout"})} s={{marginTop:10,background:V.warn}}>Log a Workout</Btn>
          </Card>
        );
        if(hoursSinceCheck>=48)return(
          <Card style={{padding:12,border:`1px solid rgba(6,182,212,0.2)`,background:"rgba(6,182,212,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>👋</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:V.accent2}}>Check on your partner</div>
                <div style={{fontSize:11,color:V.text3,marginTop:2}}>Send a quick message to stay on track</div>
              </div>
              <Btn v="small" onClick={()=>{LS.set("ft-partner-check",Date.now());d({type:"TAB",tab:"social_friends"});}}>Open</Btn>
            </div>
          </Card>
        );
        return null;
      })()}

      {/* ── FEATURE #4: Comeback card — shows after 2-14 days off ── */}
      {(()=>{
        const lastW=s.workouts[0]?.date;
        if(!lastW)return null;
        const daysOff=Math.floor((new Date()-new Date(lastW+"T12:00:00"))/86400000);
        const dismissedDate=LS.get("ft-comeback-dismissed");
        if(daysOff<2||daysOff>21||dismissedDate===lastW)return null;
        const mult=getActiveMultiplier(s);
        const msgs=[
          {d:2,h:"Welcome back — two days off is good recovery.",e:"💪"},
          {d:4,h:"Your muscles are rested and ready to fire.",e:"⚡"},
          {d:7,h:"A week off — your strength is still there, trust it.",e:"🔥"},
          {d:14,h:"The hardest workout is always the comeback one.",e:"🚀"},
        ];
        const msg=msgs.slice().reverse().find(m=>daysOff>=m.d)||msgs[0];
        return(
          <div style={{padding:"14px 16px",borderRadius:14,
            background:"linear-gradient(135deg,rgba(34,197,94,0.08),rgba(0,245,160,0.04))",
            border:"1px solid rgba(34,197,94,0.2)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:22}}>{msg.e}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"#22c55e"}}>
                    Welcome back{displayName?`, ${displayName}`:""}!
                  </div>
                  <div style={{fontSize:10,color:V.text3}}>{daysOff} days since your last session</div>
                </div>
              </div>
              <button onClick={()=>LS.set("ft-comeback-dismissed",lastW)} style={{
                background:"none",border:"none",cursor:"pointer",fontSize:14,color:V.text3,padding:4}}>✕</button>
            </div>
            <div style={{fontSize:11,color:V.text2,marginBottom:10,lineHeight:1.5}}>{msg.h}</div>
            {mult.mult>1&&(
              <div style={{fontSize:10,fontWeight:700,color:mult.color,marginBottom:8}}>
                {mult.icon} {mult.label} is active — great time to come back!
              </div>
            )}
            <button onClick={()=>d({type:"TAB",tab:"log_workout"})} style={{
              width:"100%",padding:"10px",borderRadius:10,border:"none",
              background:"#22c55e20",cursor:"pointer",fontSize:13,fontWeight:700,
              color:"#22c55e",fontFamily:V.font,WebkitTapHighlightColor:"transparent"}}>
              Log Your Comeback Workout →
            </button>
          </div>
        );
      })()}

      {/* ── T3 #16: Best Week Ever banner ── */}
      {(()=>{
        const dismissed=LS.get("ft-best-week-dismissed");
        if(dismissed===today())return null;
        const thisWeekWorkouts=s.workouts.filter(w=>w.date>=ago(6));
        if(thisWeekWorkouts.length<2)return null;
        const calcWeekVol=(ws)=>Math.round(ws.reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
        const thisVol=calcWeekVol(thisWeekWorkouts);
        const thisCount=thisWeekWorkouts.length;
        const priorVols=Array.from({length:10},(_,i)=>calcWeekVol(s.workouts.filter(w=>w.date>=ago(7*(i+1)+6)&&w.date<ago(7*(i+1)-1)))).filter(v=>v>0);
        const priorCounts=Array.from({length:10},(_,i)=>s.workouts.filter(w=>w.date>=ago(7*(i+1)+6)&&w.date<ago(7*(i+1)-1)).length).filter(v=>v>0);
        if(priorVols.length<1)return null;
        const bestPriorVol=Math.max(...priorVols);
        const bestPriorCount=Math.max(...priorCounts,0);
        const isBestVol=thisVol>0&&thisVol>bestPriorVol;
        const isBestCount=thisCount>bestPriorCount;
        if(!isBestVol&&!isBestCount)return null;
        const label=isBestVol&&isBestCount?"Most workouts AND highest volume week ever 🔥"
          :isBestVol?`${thisVol>=10000?(thisVol/1000).toFixed(1)+"k":thisVol.toLocaleString()} lbs — your highest volume week ever 📈`
          :`${thisCount} workouts — your most active week ever 🏆`;
        return(
          <div style={{padding:"11px 14px",borderRadius:12,
            background:"linear-gradient(135deg,rgba(250,204,21,0.09),rgba(251,146,60,0.05))",
            border:"1px solid rgba(250,204,21,0.22)",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:26,flexShrink:0}}>📈</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:800,color:"#fbbf24"}}>Best week ever!</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2,lineHeight:1.4}}>{label}</div>
            </div>
            <button onClick={()=>LS.set("ft-best-week-dismissed",today())}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:V.text3,padding:"4px 6px",flexShrink:0}}>✕</button>
          </div>
        );
      })()}

      {/* ── T3 #13: Friend workout nudge ── */}
      {(()=>{
        if(s.workouts.some(w=>w.date===today()))return null; // already trained
        const cachedFeed=LS.get("ft-feed-cache");
        if(!cachedFeed||!Array.isArray(cachedFeed.events))return null;
        const myEmail=s.profile?.email;
        const friendEvent=cachedFeed.events.find(ev=>
          ev.type==="WorkoutLogged"&&!ev.isOwn&&ev.email!==myEmail&&
          ev.created_at&&ev.created_at.slice(0,10)===today()
        );
        if(!friendEvent)return null;
        const fname=(friendEvent.name||"A friend").split(" ")[0];
        const exs=friendEvent.data?.exercises;
        const muscle=Array.isArray(exs)&&exs.length>0?exs[0]:null;
        return(
          <div onClick={()=>d({type:"TAB",tab:"log_workout"})}
            style={{padding:"10px 14px",borderRadius:12,cursor:"pointer",
              background:"linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.04))",
              border:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",gap:10,
              WebkitTapHighlightColor:"transparent"}}>
            <span style={{fontSize:22,flexShrink:0}}>👀</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:800,color:V.accent2}}>
                {fname} just hit the gym{muscle?` · ${muscle}`:""}
              </div>
              <div style={{fontSize:10,color:V.text3,marginTop:1}}>You haven't trained yet — your move 💪</div>
            </div>
            <span style={{fontSize:18,color:V.accent2,flexShrink:0}}>→</span>
          </div>
        );
      })()}

      {/* Quick Actions — compact */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[
          {id:"log_workout",icon:Icons.dumbbell,label:"Workout",color:V.accent},
          {id:"log_nutrition",icon:Icons.fork,label:"Nutrition",color:V.warn},
          {id:"log_body",icon:Icons.scale,label:"Weigh In",color:V.accent2},
        ].map(a=>(
          <button key={a.id} onClick={()=>d({type:"TAB",tab:a.id})} style={{
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,
            padding:"14px 6px",background:`${a.color}06`,border:`1px solid ${a.color}20`,
            borderRadius:12,cursor:"pointer",WebkitTapHighlightColor:"transparent",minHeight:72,
          }}>
            {a.icon({size:20,color:a.color})}
            <span style={{fontSize:11,fontWeight:700,color:a.color}}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Readiness Score */}
      <ReadinessCard s={s} d={d}/>

      {/* Daily XP Missions */}
      <DailyMissionsCard s={s} d={d}/>

      {/* ── FEATURE #1: Weekly Recap Card ── */}
      {(()=>{
        const isWeekend=new Date().getDay()===0||new Date().getDay()===6;
        const dismissed=LS.get("ft-weekly-recap-dismissed");
        const weekOf=ago(0); // today
        if(dismissed===weekOf&&!isWeekend)return null;
        const weekWorkouts=s.workouts.filter(w=>w.date>=ago(7));
        if(weekWorkouts.length<2)return null; // need at least 2 to be interesting
        const weekVol=Math.round(weekWorkouts.reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
        const prevWeekWorkouts=s.workouts.filter(w=>w.date>=ago(14)&&w.date<ago(7));
        const prevVol=Math.round(prevWeekWorkouts.reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
        const volDiff=prevVol>0?Math.round((weekVol-prevVol)/prevVol*100):null;
        const weekProt=s.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(s.goals?.protein||150)).length;
        const weekXP=(()=>{const log=(getXPBonus().log||[]);const cutoff=ago(7);return log.filter(e=>e.date>=cutoff).reduce((a,e)=>a+(e.amount||0),0)+weekWorkouts.length*30;})();
        const bestSession=weekWorkouts.reduce((best,w)=>{const v=w.exercises.reduce((a,e)=>a+e.sets.reduce((b,st)=>b+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0);return v>best.v?{v,w}:{...best};},{v:0,w:null});
        const goal=parseInt(s.goals?.workoutsPerWeek)||5;
        const hitGoal=weekWorkouts.length>=goal;
        return(
          <Card style={{padding:14,background:"linear-gradient(135deg,rgba(0,245,160,0.06),rgba(139,92,246,0.04))",
            border:`1px solid ${hitGoal?"rgba(0,245,160,0.2)":"rgba(255,255,255,0.08)"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>
                  {new Date().getDay()===0?"This Week's Summary":"Week in Review"}
                </div>
                <div style={{fontSize:14,fontWeight:800,color:hitGoal?V.accent:V.text,marginTop:2}}>
                  {hitGoal?"🏆 Goal smashed! "+weekWorkouts.length+"/"+goal+" workouts":"💪 "+weekWorkouts.length+" / "+goal+" workouts this week"}
                </div>
              </div>
              <button onClick={()=>LS.set("ft-weekly-recap-dismissed",weekOf)}
                style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:V.text3,padding:4}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              {[
                {label:"Volume",val:weekVol>=10000?`${(weekVol/1000).toFixed(1)}k`:weekVol.toLocaleString(),sub:volDiff!==null?(volDiff>=0?"↑"+volDiff+"%":"↓"+Math.abs(volDiff)+"%"):"lbs",c:volDiff===null?V.accent2:volDiff>=0?V.accent:V.danger},
                {label:"Protein Days",val:weekProt+"/7",sub:"days on target",c:weekProt>=5?V.accent:weekProt>=3?V.warn:V.danger},
                {label:"XP Earned",val:"+"+weekXP,sub:"this week",c:V.purple},
              ].map(stat=>(
                <div key={stat.label} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:15,fontWeight:800,color:stat.c,fontFamily:V.mono}}>{stat.val}</div>
                  <div style={{fontSize:8,color:V.text3,marginTop:2,fontWeight:600,textTransform:"uppercase"}}>{stat.label}</div>
                  <div style={{fontSize:8,color:stat.c,marginTop:1,fontWeight:600}}>{stat.sub}</div>
                </div>
              ))}
            </div>
            {bestSession.w&&(
              <div style={{fontSize:10,color:V.text3,padding:"6px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8}}>
                <span style={{color:V.accent,fontWeight:700}}>Best session: </span>
                {bestSession.w.exercises.map(e=>s.exercises.find(x=>x.id===e.exerciseId)?.name?.split(" ")[0]||e.exerciseId).join(", ")}
                {" · "}{bestSession.v>=10000?`${(bestSession.v/1000).toFixed(1)}k`:Math.round(bestSession.v)} lbs
              </div>
            )}
          </Card>
        );
      })()}

      {/* ── T4 #19: Session duration drop alert ── */}
      {(()=>{
        const wkts=s.workouts.filter(w=>parseInt(w.dur||0)>5);
        if(wkts.length<6)return null;
        const recent=wkts.filter(w=>w.date>=ago(13)).slice(0,5);
        const older=wkts.filter(w=>w.date>=ago(41)&&w.date<ago(14)).slice(0,8);
        if(recent.length<3||older.length<3)return null;
        const avgRecent=Math.round(recent.reduce((a,w)=>a+parseInt(w.dur),0)/recent.length);
        const avgOlder=Math.round(older.reduce((a,w)=>a+parseInt(w.dur),0)/older.length);
        const drop=avgOlder-avgRecent;
        const dropPct=Math.round(drop/avgOlder*100);
        if(dropPct<20)return null; // only flag if 20%+ drop
        const dismissed=LS.get("ft-dur-alert-dismissed");
        if(dismissed===ago(0))return null;
        return(
          <div style={{padding:"10px 14px",borderRadius:12,
            background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20,flexShrink:0}}>⏱️</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:800,color:V.warn}}>Sessions getting shorter</div>
              <div style={{fontSize:10,color:V.text3,marginTop:1,lineHeight:1.4}}>
                Avg {avgRecent}min lately vs {avgOlder}min before — {dropPct}% drop.
                Could be life getting busy, or a deload. Keep tabs on it.
              </div>
            </div>
            <button onClick={()=>LS.set("ft-dur-alert-dismissed",ago(0))}
              style={{background:"none",border:"none",cursor:"pointer",
                fontSize:14,color:V.text3,padding:"4px 6px",flexShrink:0}}>✕</button>
          </div>
        );
      })()}

      {/* Week + Stats combined in one card */}
      <Card style={{padding:14}}>
        {/* #1: 30-day calendar heat map */}
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>Last 30 Days</span>
            <span style={{fontSize:11,color:V.text3}}>{s.workouts.filter(w=>w.date>=ago(30)).length} workouts</span>
            {(()=>{const weekBest=s.workouts.filter(w=>w.date>=ago(7)).reduce((b,w)=>{const v=w.exercises.reduce((a,e)=>a+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0);return v>b?v:b;},0);return weekBest>0?<span style={{fontSize:11,color:V.accent}}>Best session: {weekBest>=10000?`${(weekBest/1000).toFixed(1)}k`:`${weekBest}`} lbs</span>:null;})()}
          </div>
          <div style={{display:"flex",gap:2,flexWrap:"nowrap"}}>
            {Array.from({length:30}).map((_,i)=>{
              const d2=new Date();d2.setDate(d2.getDate()-29+i);
              const ds=d2.toISOString().slice(0,10);
              const trained=s.workouts.some(w=>w.date===ds);
              const scheduled=s.schedule.weekly?.[d2.getDay()];
              const isRest=!scheduled||scheduled==="Rest"||scheduled==="Off";
              const missed=!trained&&!isRest&&ds<td;
              const isT=ds===td;
              return <div key={i} title={ds} style={{flex:1,height:14,borderRadius:2,
                background:trained?V.accent:(missed?`${V.danger}40`:"rgba(255,255,255,0.04)"),
                border:isT?`1.5px solid ${V.accent}`:"none",
                opacity:ds>td?0.3:1,transition:"all .2s"}}/>;
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
            <span style={{fontSize:10,color:V.text3}}>30d ago</span>
            <div style={{display:"flex",gap:6}}>
              <span style={{fontSize:10,color:V.accent,display:"flex",alignItems:"center",gap:3}}><span style={{width:6,height:6,borderRadius:1,background:V.accent}}/> Trained</span>
              <span style={{fontSize:10,color:V.danger,display:"flex",alignItems:"center",gap:3}}><span style={{width:6,height:6,borderRadius:1,background:`${V.danger}40`}}/> Missed</span>
            </div>
            <span style={{fontSize:10,color:V.text3}}>Today</span>
          </div>
        </div>
        {/* #5: Weekly goal ring + stats */}
        <div style={{display:"flex",gap:0,borderTop:`1px solid ${V.cardBorder}`,paddingTop:10}}>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {(()=>{
              const goal=parseInt(s.goals?.workoutsPerWeek)||5;
              const pct2=Math.min(100,Math.round(ww/goal*100));
              const r2=18,circ2=2*Math.PI*r2;
              return(
                <div style={{position:"relative",width:44,height:44}}>
                  <svg width={44} height={44} style={{transform:"rotate(-90deg)"}}>
                    <circle cx={22} cy={22} r={r2} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4}/>
                    <circle cx={22} cy={22} r={r2} fill="none" stroke={pct2>=100?V.accent:V.warn} strokeWidth={4}
                      strokeDasharray={circ2} strokeDashoffset={circ2*(1-pct2/100)} strokeLinecap="round"/>
                  </svg>
                  <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:11,fontWeight:800,color:pct2>=100?V.accent:V.text,fontFamily:V.mono}}>{ww}/{goal}</span>
                  </div>
                </div>
              );
            })()}
            <div>
              <div style={{fontSize:10,color:V.text3,fontWeight:700,letterSpacing:".04em"}}>WEEKLY GOAL</div>
            </div>
          </div>
          <div style={{width:1,background:V.cardBorder}}/>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:V.accent2,fontFamily:V.mono}}>{vol>1000?`${(vol/1000).toFixed(1)}k`:vol}</div>
            <div style={{fontSize:10,color:V.text3,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Volume</div>
          </div>
          <div style={{width:1,background:V.cardBorder}}/>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{latestBW||"--"}</div>
            <div style={{fontSize:10,color:V.text3,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Weight ({u})</div>
          </div>
          <div style={{width:1,background:V.cardBorder}}/>
          {(()=>{
            const bw2=s.body.find(b=>b.weight)?.weight||s.goals.goalWeight||180;
            const ss=calcStrengthScore(s.workouts,bw2);
            return(
              <div style={{flex:1,textAlign:"center",cursor:"pointer"}} onClick={()=>d({type:"TAB",tab:"track_strength"})}>
                <div style={{fontSize:16,fontWeight:800,color:ss.rankColor,fontFamily:V.mono}}>{ss.score.toFixed(2)}</div>
                <div style={{fontSize:10,color:V.text3,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Strength</div>
              </div>
            );
          })()}
        </div>
      </Card>

      {/* Today's Nutrition — compact */}
      {tn ? (
        <Card style={{padding:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>Today's Intake</span>
            <span style={{fontSize:16,fontWeight:700,color:V.warn,fontFamily:V.mono}}>{tn.cal}<span style={{fontSize:11,color:V.text3}}>/{s.goals.cal}</span></span>
          </div>
          <Progress val={tn.cal} max={s.goals.cal} color={V.warn} h={6}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:12}}>
            {[{l:"Protein",v:tn.protein,g:s.goals.protein,c:V.accent},{l:"Carbs",v:tn.carbs,g:s.goals.carbs,c:V.accent2},{l:"Fat",v:tn.fat,g:s.goals.fat,c:V.warn}].map(m=>(
              <div key={m.l}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:10,color:m.c,fontWeight:700}}>{m.l}</span>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.mono}}>{m.v}g</span>
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
                {Icons.moon({size:11,color:V.purple})}<span style={{fontSize:11,color:V.purple,fontFamily:V.mono,fontWeight:600}}>{(parseFloat(tn.sleep)||0).toFixed(1)}h</span>
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
            {todayW.rating&&<span style={{fontSize:10,color:V.warn}}>{"★".repeat(todayW.rating)}</span>}
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
        <Card style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>Strength</span>
            <div style={{display:"flex",gap:6}}>
              {[{c:V.accent,l:"B"},{c:V.accent2,l:"S"},{c:V.purple,l:"D"}].map(e=>(
                <span key={e.l} style={{fontSize:10,color:e.c,display:"flex",alignItems:"center",gap:3,fontWeight:700}}>
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
        <Card style={{padding:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              {Icons.trophy({size:13,color:V.warn})}
              <span style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>Latest PRs 🔥</span>
            </div>
            <button onClick={()=>d({type:"TAB",tab:"track_workouts"})} style={{background:"none",border:"none",cursor:"pointer",
              fontSize:10,color:V.accent,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>All</button>
          </div>
          {Object.entries(prs).sort((a,b)=>b[1].date.localeCompare(a[1].date)).slice(0,3).map(([id,pr])=>(
            <div key={id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <span style={{fontSize:12,color:V.text}}>{pr.name}</span>
              <div style={{textAlign:"right"}}><div style={{fontSize:12,color:V.accent,fontFamily:V.mono,fontWeight:700}}>{pr.weight}×{pr.reps}</div><div style={{fontSize:8,color:V.text3}}>{fmtShort(pr.date)}</div></div>
            </div>
          ))}
        </Card>
      )}

      {/* Recent — 2 workouts, compact rows */}
      {s.workouts.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>Recent</span>
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
                {w.rating&&<span style={{fontSize:10,color:V.warn}}>{"★".repeat(w.rating)}</span>}
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
