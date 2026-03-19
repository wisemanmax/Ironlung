import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Progress, Stat, ValidationWarning, validateNutrition, SuccessToastCtrl, ConfirmCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, wUnit, chartCfg } from '../utils/helpers';
import { Undo } from '../utils/undo';
import { FOODS, FOOD_CATS } from '../data/foods';
import { FoodSearch, BarcodeScanner, useNutritionStreak } from '../components/dialogs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShareCard } from '../utils/share';
import { checkAndAwardMissions } from './gamification';

export function NutritionTab({s,d}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({date:today(),cal:"",protein:"",carbs:"",fat:"",fiber:"",water:"",sleep:"",
    meals:[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
  const [activeMeal,setActiveMeal]=useState(null);
  const [scanMeal,setScanMeal]=useState(null);
  const [valWarnings,setValWarnings]=useState(null);
  const [favName,setFavName]=useState("");
  const [showFavInput,setShowFavInput]=useState(false);
  const [editingNId,setEditingNId]=useState(null);
  const td=today();
  const [waterCount,setWaterCount]=useState(()=>parseInt(LS.get("ft-water-"+today()))||0);

  const start=()=>{
    const ex=s.nutrition.find(n=>n.date===today());
    if(ex){setForm({...ex,cal:ex.cal.toString(),protein:ex.protein.toString(),carbs:ex.carbs.toString(),fat:ex.fat.toString(),
      fiber:(ex.fiber||"").toString(),water:(ex.water||"").toString(),sleep:(ex.sleep||"").toString(),
      meals:ex.meals||[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
      setEditingNId(ex.id);
    }else{setForm({date:today(),cal:"",protein:"",carbs:"",fat:"",fiber:"",water:"",sleep:"",
      meals:[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
      setEditingNId(null);
    }
    setShow(true);
  };

  // #12 Copy from yesterday
  const copyYesterday=()=>{
    const yd=ago(1);
    const prev=s.nutrition.find(n=>n.date===yd);
    if(prev){
      setForm({date:today(),cal:prev.cal.toString(),protein:prev.protein.toString(),carbs:prev.carbs.toString(),
        fat:prev.fat.toString(),fiber:(prev.fiber||"").toString(),water:(prev.water||"").toString(),sleep:"",
        meals:prev.meals||[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
      setShow(true);
    }
  };

  const addFoodToMeal=(mi,food)=>{setForm(f=>{const m=[...f.meals];m[mi]={...m[mi],items:[...(m[mi].items||[]),food]};return{...f,meals:m};});};
  const rmFoodFromMeal=(mi,fi)=>{setForm(f=>{const m=[...f.meals];m[mi]={...m[mi],items:m[mi].items.filter((_,i)=>i!==fi)};return{...f,meals:m};});};

  const autoCalc=()=>{
    let cal=0,protein=0,carbs=0,fat=0;
    form.meals.forEach(m=>(m.items||[]).forEach(i=>{cal+=(i.cal||0);protein+=(i.protein||0);carbs+=(i.carbs||0);fat+=(i.fat||0);}));
    setForm(f=>({...f,cal:cal.toString(),protein:protein.toString(),carbs:carbs.toString(),fat:fat.toString()}));
  };

  const save=()=>{
    const n={id:editingNId||uid(),date:form.date,cal:parseInt(form.cal)||0,protein:parseInt(form.protein)||0,
      carbs:parseInt(form.carbs)||0,fat:parseInt(form.fat)||0,fiber:parseInt(form.fiber)||0,
      water:parseInt(form.water)||0,sleep:parseFloat(form.sleep)||0,meals:form.meals};
    const warnings=validateNutrition(n);
    if(warnings.length>0&&!valWarnings){setValWarnings(warnings);return;}
    setValWarnings(null);
    if(editingNId){d({type:"EDIT_N",n});SuccessToastCtrl.show("Nutrition updated");}
    else{d({type:"ADD_N",n});SuccessToastCtrl.show("Nutrition logged +8 XP 🥗");
      setTimeout(()=>checkAndAwardMissions({...s,nutrition:[n,...s.nutrition]},d),400);}
    Haptic.medium();setEditingNId(null);setShow(false);
  };

  const editEntry=(n)=>{
    setForm({...n,cal:n.cal?.toString()||"",protein:n.protein?.toString()||"",carbs:n.carbs?.toString()||"",
      fat:n.fat?.toString()||"",fiber:(n.fiber||"").toString(),water:(n.water||"").toString(),sleep:(n.sleep||"").toString(),
      meals:n.meals||[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
    setEditingNId(n.id);setShow(true);
  };

  const week=s.nutrition.filter(n=>n.date>=ago(7));
  const avgCal=week.length?Math.round(week.reduce((s,n)=>s+n.cal,0)/week.length):0;
  const avgP=week.length?Math.round(week.reduce((s,n)=>s+n.protein,0)/week.length):0;
  const protGoalVal=s.goals?.protein||0;
  const protHitDays=protGoalVal>0?week.filter(n=>n.protein>=protGoalVal*0.9).length:0;
  const protHitRate=week.length&&protGoalVal>0?Math.round(protHitDays/week.length*100):0;
  const todayNutr=s.nutrition.find(n=>n.date===td);
  const MacroRing=({value,goal,color,label})=>{
    const pct=goal>0?Math.min(1,value/goal):0;
    const r=22,c=2*Math.PI*r;
    return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <svg width={54} height={54} style={{transform:"rotate(-90deg)"}}>
          <circle cx={27} cy={27} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/>
          <circle cx={27} cy={27} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={c} strokeDashoffset={c*(1-pct)} strokeLinecap="round"
            style={{transition:"stroke-dashoffset .5s"}}/>
        </svg>
        <div style={{marginTop:-40,display:"flex",flexDirection:"column",alignItems:"center",height:40,justifyContent:"center"}}>
          <div style={{fontSize:11,fontWeight:800,color,fontFamily:V.mono}}>{value}</div>
          <div style={{fontSize:7,color:V.text3}}>/{goal}</div>
        </div>
        <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{label}</div>
      </div>
    );
  };
  const totalItems=form.meals.reduce((s,m)=>(m.items||[]).length+s,0);

  const macroChart=useMemo(()=>
    s.nutrition.filter(n=>n.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date))
      .map(n=>({date:fmtShort(n.date),P:n.protein,C:n.carbs,F:n.fat}))
  ,[s.nutrition,s.range]);

  const todayN=s.nutrition.find(n=>n.date===today());
  const tCal=todayN?.cal||0,tProt=todayN?.protein||0,tCarbs=todayN?.carbs||0,tFat=todayN?.fat||0;
  const calGoal=s.goals?.cal||2400,protGoal=s.goals?.protein||180;
  const calPct=Math.min(100,Math.round(tCal/calGoal*100)),protPct=Math.min(100,Math.round(tProt/protGoal*100));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Daily summary bar — enhanced */}
      <Card style={{padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,fontWeight:700,color:V.text}}>Today</span>
            {(()=>{const ns=useNutritionStreak(s.nutrition);return ns>0?<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4,background:"rgba(251,191,36,0.12)",color:"#fbbf24"}}>🥗 {ns}d streak</span>:null;})()}
          </div>
          {/* #3: Deficit/surplus indicator — vs TDEE if set, else vs goal */}
          {tCal>0?(()=>{
            const baseline=parseInt(s.goals?.tdee)||calGoal;
            const lbl=parseInt(s.goals?.tdee)?"vs TDEE":"vs goal";
            const diff=tCal-baseline;
            return <span style={{fontSize:10,color:diff>100?V.warn:diff<-100?V.accent:V.text3,fontWeight:600}}>
              {tCal} cal · {diff>0?"+":""}{diff} <span style={{opacity:0.5,fontWeight:400}}>({lbl})</span>
            </span>;
          })():<span style={{fontSize:10,color:V.text3}}>0 / {calGoal} cal</span>}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
              <div style={{height:"100%",borderRadius:2,background:calPct>=100?V.accent:V.warn,width:`${calPct}%`,transition:"width .3s"}}/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {/* #2: Macro pie chart */}
          {tCal>0&&(()=>{
            const total=tProt+tCarbs+tFat;if(total===0)return null;
            const pPct=tProt/total*100,cPct=tCarbs/total*100;
            const r2=16,cx=20,cy=20,circ=2*Math.PI*r2;
            return(
              <svg width={40} height={40} style={{flexShrink:0}}>
                <circle cx={cx} cy={cy} r={r2} fill="none" stroke={V.accent} strokeWidth={5}
                  strokeDasharray={`${pPct/100*circ} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`}/>
                <circle cx={cx} cy={cy} r={r2} fill="none" stroke={V.accent2} strokeWidth={5}
                  strokeDasharray={`${cPct/100*circ} ${circ}`} strokeDashoffset={`-${pPct/100*circ}`} transform={`rotate(-90 ${cx} ${cy})`}/>
                <circle cx={cx} cy={cy} r={r2} fill="none" stroke={V.warn} strokeWidth={5}
                  strokeDasharray={`${(100-pPct-cPct)/100*circ} ${circ}`} strokeDashoffset={`-${(pPct+cPct)/100*circ}`} transform={`rotate(-90 ${cx} ${cy})`}/>
              </svg>
            );
          })()}
          <div style={{display:"flex",gap:12,fontSize:10,fontFamily:V.mono,flex:1}}>
            <span style={{color:tProt>=protGoal?V.accent:V.text3}}>{tProt}g P</span>
            <span style={{color:V.text3}}>{tCarbs}g C</span>
            <span style={{color:V.text3}}>{tFat}g F</span>
            <span style={{marginLeft:"auto",color:protPct>=100?V.accent:V.warn}}>{protPct}%</span>
          </div>
        </div>
      </Card>

      {/* 7-day macro adherence mini heatmap */}
      {s.nutrition.length>0&&(
        <Card style={{padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text}}>7-Day Adherence</div>
            <div style={{fontSize:9,color:V.text3}}>Cal & Protein goals</div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {Array.from({length:7}).map((_,i)=>{
              const day=ago(6-i);
              const n=s.nutrition.find(x=>x.date===day);
              const calOk=n&&s.goals?.cal?n.cal>=s.goals.cal*0.85:false;
              const protOk=n&&s.goals?.protein?n.protein>=s.goals.protein*0.9:false;
              const both=calOk&&protOk;const either=calOk||protOk;
              const isToday=day===today();
              return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                  <div style={{width:"100%",height:28,borderRadius:5,
                    background:both?"linear-gradient(180deg,#22c55e,#16a34a)":either?"linear-gradient(180deg,#f59e0b,#d97706)":n?"rgba(244,63,94,0.25)":"rgba(255,255,255,0.04)",
                    border:isToday?`1px solid ${V.accent}40`:"none",
                    boxShadow:both?"0 0 6px rgba(34,197,94,0.25)":"none"}}/>
                  <div style={{fontSize:7,color:isToday?V.accent:V.text3,fontWeight:isToday?700:400}}>
                    {["Su","Mo","Tu","We","Th","Fr","Sa"][new Date(day+"T12:00:00").getDay()]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            {[{c:"#22c55e",l:"Both goals"},{c:"#f59e0b",l:"Partial"},{c:"rgba(244,63,94,0.4)",l:"Logged, missed"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:8,height:8,borderRadius:2,background:x.c}}/>
                <span style={{fontSize:7,color:V.text3}}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {/* #1: Water tracking — persistent tap counter */}
      <Card style={{padding:10}}>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {Icons.droplet({size:16,color:V.accent2})}
              <span style={{fontSize:12,fontWeight:700,color:V.text}}>Water</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>{
                if(waterCount>0){const n=waterCount-1;setWaterCount(n);LS.set("ft-water-"+td,n);}
              }} style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:V.text3}}>−</button>
              <div style={{minWidth:54,textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,color:V.accent2,fontFamily:V.mono}}>{waterCount}</span>
                <span style={{fontSize:10,color:V.text3}}>/8</span>
              </div>
              <button onClick={()=>{
                Haptic.light();
                const n=waterCount+1;setWaterCount(n);LS.set("ft-water-"+td,n);
                if(n>=8)SuccessToastCtrl.show("💧 Hydration goal hit!");
              }} style={{width:32,height:32,borderRadius:8,background:`${V.accent2}15`,border:`1px solid ${V.accent2}25`,
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:V.accent2,fontWeight:700}}>+</button>
            </div>
          </div>
          <Progress val={waterCount} max={8} color={V.accent2} h={6}/>
        </div>
      </Card>

      {/* Today's macro progress rings */}
      {todayNutr&&(
        <Card style={{padding:12}}>
          <div style={{fontSize:10,fontWeight:700,color:V.text,marginBottom:8}}>Today's Macros</div>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            <MacroRing value={todayNutr.cal||0} goal={s.goals?.cal||2200} color={V.accent} label="Cals"/>
            <MacroRing value={todayNutr.protein||0} goal={s.goals?.protein||150} color="#f43f5e" label="Protein"/>
            <MacroRing value={todayNutr.carbs||0} goal={s.goals?.carbs||250} color={V.warn} label="Carbs"/>
            <MacroRing value={todayNutr.fat||0} goal={s.goals?.fat||70} color={V.accent2} label="Fat"/>
          </div>
        </Card>
      )}
      <div style={{display:"flex",gap:8}}>
        <Btn full onClick={start}>{Icons.plus({size:16,color:V.bg})} Log Nutrition</Btn>
        {s.nutrition.find(n=>n.date===ago(1))&&(
          <Btn v="secondary" onClick={copyYesterday} s={{flexShrink:0,fontSize:11}}>{Icons.copy({size:14,color:V.text2})} Copy Yesterday</Btn>
        )}
      </div>

      {/* Meal Favorites */}
      {(()=>{
        const favs=LS.get("ft-meal-favs")||[];
        if(favs.length===0)return null;
        return(
          <div>
            <div style={{fontSize:10,fontWeight:700,color:V.text3,marginBottom:6}}>SAVED MEALS</div>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
              {favs.map((fav,i)=>(
                <button key={i} onClick={()=>{
                  setForm(f=>({...f,meals:fav.meals,cal:fav.cal?.toString()||"",protein:fav.protein?.toString()||"",
                    carbs:fav.carbs?.toString()||"",fat:fav.fat?.toString()||""}));
                  setShow(true);SuccessToastCtrl.show(`Loaded: ${fav.name}`);
                }} style={{padding:"8px 12px",borderRadius:8,background:`${V.accent}06`,border:`1px solid ${V.accent}15`,
                  cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,textAlign:"left"}}>
                  <div style={{fontSize:11,fontWeight:600,color:V.text}}>{fav.name}</div>
                  <div style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>{fav.cal}cal · {fav.protein}P</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Stat icon={Icons.flame} label="Avg Calories" value={avgCal} unit="kcal" color={V.warn}/>
        <Stat icon={Icons.target} label="Avg Protein" value={avgP} unit="g" color={V.accent}
          sub={week.length?`${protHitDays}/${Math.min(week.length,7)}d hit goal`:undefined}/>
      </div>
      {/* Protein hit rate bar */}
      {week.length>0&&(
        <div style={{padding:"8px 12px",borderRadius:10,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:10,color:V.text3,fontWeight:700}}>PROTEIN GOAL RATE (7d)</span>
            <span style={{fontSize:10,fontWeight:800,color:protHitRate>=80?"#22c55e":protHitRate>=50?V.warn:"#f43f5e",fontFamily:V.mono}}>{protHitRate}%</span>
          </div>
          <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)"}}>
            <div style={{height:"100%",borderRadius:3,transition:"width .5s",
              width:`${protHitRate}%`,
              background:protHitRate>=80?"linear-gradient(90deg,#22c55e,#86efac)":protHitRate>=50?"linear-gradient(90deg,#f59e0b,#fcd34d)":"linear-gradient(90deg,#f43f5e,#fb7185)"}}/> 
          </div>
        </div>
      )}

      {/* ── T3 #17: Nutrition gap/pattern analysis ── */}
      {(()=>{
        if(s.nutrition.length<7)return null;
        const protGoal=s.goals?.protein||150;
        const calGoal=s.goals?.cal||2200;
        const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        // Analyse last 28 days grouped by day-of-week
        const dowData=Array.from({length:7},(_,dow)=>{
          const entries=s.nutrition.filter(n=>{
            const d=new Date(n.date+"T12:00:00");
            return d.getDay()===dow&&n.date>=ago(27);
          });
          return{
            dow,name:dayNames[dow],
            count:entries.length,
            protHit:entries.filter(n=>n.protein>=protGoal*0.9).length,
            calHit:entries.filter(n=>n.cal>=calGoal*0.8&&n.cal<=calGoal*1.15).length,
            avgProt:entries.length?Math.round(entries.reduce((a,n)=>a+(n.protein||0),0)/entries.length):0,
          };
        });
        // Find worst protein days (logged but consistently missed)
        const weakDays=dowData.filter(d=>d.count>=2&&d.protHit/d.count<0.5).map(d=>d.name);
        // Find strongest days
        const strongDays=dowData.filter(d=>d.count>=2&&d.protHit/d.count>=0.85).map(d=>d.name);
        // Streak insights: how many days logged this week vs last week
        const thisW=s.nutrition.filter(n=>n.date>=ago(6)).length;
        const lastW=s.nutrition.filter(n=>n.date>=ago(13)&&n.date<ago(6)).length;
        const insights=[];
        if(weakDays.length>0)insights.push({icon:"⚠️",color:V.warn,text:`Protein gap on ${weakDays.slice(0,2).join(" & ")} — plan ahead`});
        if(strongDays.length>0)insights.push({icon:"💪",color:V.accent,text:`Nailing protein on ${strongDays.slice(0,2).join(" & ")} — keep that up`});
        if(thisW>lastW)insights.push({icon:"📈",color:V.accent,text:`${thisW} days logged this week vs ${lastW} last — consistency building`});
        else if(thisW<lastW&&lastW>=4)insights.push({icon:"📉",color:V.warn,text:`${lastW-thisW} fewer logs than last week — stay on track`});
        // Check if frequently under-eating
        const under=s.nutrition.filter(n=>n.date>=ago(13)&&n.cal>0&&n.cal<calGoal*0.75).length;
        if(under>=4)insights.push({icon:"🔋",color:V.danger,text:`Under-fuelling ${under} days lately — calories too low`});
        if(insights.length===0)return null;
        return(
          <div style={{padding:"12px 14px",borderRadius:12,
            background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",
              letterSpacing:".06em",marginBottom:9}}>📊 Patterns</div>
            {/* 7-day DOW protein heat strip */}
            <div style={{display:"flex",gap:3,marginBottom:10}}>
              {dowData.map(d=>{
                const rate=d.count>0?d.protHit/d.count:null;
                const bg=rate===null?"rgba(255,255,255,0.04)":rate>=0.85?"rgba(0,245,160,0.35)":rate>=0.5?"rgba(245,158,11,0.35)":"rgba(244,63,94,0.25)";
                return(
                  <div key={d.dow} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{width:"100%",height:20,borderRadius:4,background:bg,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {d.count>0&&<span style={{fontSize:7,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{d.avgProt}g</span>}
                    </div>
                    <span style={{fontSize:7,color:V.text3}}>{d.name.slice(0,2)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {insights.slice(0,3).map((ins,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                  <span style={{fontSize:12,flexShrink:0}}>{ins.icon}</span>
                  <span style={{fontSize:10,color:V.text2,lineHeight:1.4}}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <Card>
        <span style={{fontSize:11,color:V.text3,fontWeight:700,display:"block",marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Macros</span>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={macroChart} barSize={8}>
            <CartesianGrid {...chartCfg.grid} vertical={false}/>
            <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
            <YAxis {...chartCfg.axis} width={28}/>
            <Tooltip {...chartCfg.tip}/>
            <Bar dataKey="P" stackId="a" fill={V.accent}/>
            <Bar dataKey="C" stackId="a" fill={V.accent2}/>
            <Bar dataKey="F" stackId="a" fill={V.warn} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {show&&(
        <Sheet title={editingNId?"Edit Nutrition":"Log Nutrition"} onClose={()=>{setShow(false);setEditingNId(null);}}
          footer={<Btn full onClick={save}>{Icons.check({size:16,color:V.bg})} {editingNId?"Update":"Save"} Nutrition</Btn>}>
          <Field label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>

          {/* Meals with food database search */}
          {form.meals.map((meal,mi)=>{
            const mCal=(meal.items||[]).reduce((s,i)=>s+i.cal,0);
            const mP=(meal.items||[]).reduce((s,i)=>s+i.protein,0);
            return(
              <div key={mi} style={{marginBottom:12,padding:12,background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${V.cardBorder}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:700,color:V.text}}>{meal.name}</span>
                    <input type="time" value={meal.time||""} onChange={e=>setForm(f=>{const ms=[...f.meals];ms[mi]={...ms[mi],time:e.target.value};return{...f,meals:ms};})}
                      style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                        color:V.text3,fontSize:11,fontFamily:V.mono,outline:"none",width:80,minHeight:32}}/>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {mCal>0&&<span style={{fontSize:10,color:V.warn,fontFamily:V.mono}}>{mCal}cal · {mP}P</span>}
                    <button onClick={()=>setScanMeal(mi)}
                      style={{background:`${V.accent2}15`,border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",
                        display:"flex",alignItems:"center",gap:3,WebkitTapHighlightColor:"transparent"}}>
                      {Icons.scan({size:12,color:V.accent2})}
                    </button>
                    <button onClick={()=>setActiveMeal(activeMeal===mi?null:mi)}
                      style={{background:`${V.accent}15`,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",
                        fontSize:11,color:V.accent,fontWeight:600,WebkitTapHighlightColor:"transparent"}}>
                      {activeMeal===mi?"Close":"+ Food"}
                    </button>
                  </div>
                </div>
                {(meal.items||[]).map((item,fi)=>(
                  <div key={fi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                    <span style={{fontSize:12,color:V.text2,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      <span style={{fontSize:10,color:V.text3,fontFamily:V.mono}}>{item.cal} · {item.protein}P</span>
                      <button onClick={()=>rmFoodFromMeal(mi,fi)} aria-label="Remove food item" style={{background:"none",border:"none",padding:2,cursor:"pointer"}}>{Icons.x({size:12,color:V.text3})}</button>
                    </div>
                  </div>
                ))}
                {activeMeal===mi&&<div style={{marginTop:8}}><FoodSearch onAdd={(food)=>addFoodToMeal(mi,food)}/></div>}
              </div>
            );
          })}

          {totalItems>0&&<Btn v="small" full onClick={autoCalc} s={{marginBottom:12}}>Auto-calculate totals from food items</Btn>}
          {totalItems>0&&!showFavInput&&(
            <button onClick={()=>setShowFavInput(true)} style={{width:"100%",padding:"8px",borderRadius:8,background:"rgba(255,255,255,0.02)",
              border:`1px dashed ${V.cardBorder}`,cursor:"pointer",fontSize:11,color:V.accent,
              fontFamily:V.font,marginBottom:12}}>⭐ Save as Meal Favorite</button>
          )}
          {showFavInput&&(
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              <input value={favName} onChange={e=>setFavName(e.target.value)} placeholder="Name (e.g. My usual day)"
                autoFocus style={{flex:1,padding:"8px 10px",background:V.card,border:`1px solid ${V.cardBorder}`,
                  borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}/>
              <Btn onClick={()=>{
                if(!favName.trim()){setShowFavInput(false);return;}
                autoCalc();
                setTimeout(()=>{
                  const favs=LS.get("ft-meal-favs")||[];
                  const cal=form.meals.reduce((s2,m)=>(m.items||[]).reduce((a,i)=>a+i.cal,0)+s2,0);
                  const protein=form.meals.reduce((s2,m)=>(m.items||[]).reduce((a,i)=>a+i.protein,0)+s2,0);
                  const carbs=form.meals.reduce((s2,m)=>(m.items||[]).reduce((a,i)=>a+(i.carbs||0),0)+s2,0);
                  const fat=form.meals.reduce((s2,m)=>(m.items||[]).reduce((a,i)=>a+(i.fat||0),0)+s2,0);
                  const updated=[{name:favName.trim(),meals:form.meals,cal,protein,carbs,fat},...favs.filter(f=>f.name!==favName.trim())].slice(0,10);
                  LS.set("ft-meal-favs",updated);
                  SuccessToastCtrl.show(`Saved: ${favName.trim()}`);
                  setFavName("");setShowFavInput(false);
                },100);
              }} s={{flexShrink:0}}>Save</Btn>
              <button onClick={()=>{setFavName("");setShowFavInput(false);}} style={{padding:"8px",borderRadius:8,
                background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:11,color:V.text3}}>✕</button>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Calories" type="number" value={form.cal} onChange={v=>setForm(f=>({...f,cal:v}))} unit="kcal"/>
            <Field label="Protein" type="number" value={form.protein} onChange={v=>setForm(f=>({...f,protein:v}))} unit="g"/>
            <Field label="Carbs" type="number" value={form.carbs} onChange={v=>setForm(f=>({...f,carbs:v}))} unit="g"/>
            <Field label="Fat" type="number" value={form.fat} onChange={v=>setForm(f=>({...f,fat:v}))} unit="g"/>
            <Field label="Water" type="number" value={form.water} onChange={v=>setForm(f=>({...f,water:v}))} unit="cups"/>
            <Field label="Sleep" type="number" value={form.sleep} onChange={v=>setForm(f=>({...f,sleep:v}))} unit="hrs" step="0.5"/>
          </div>
        </Sheet>
      )}

      {scanMeal!==null&&(
        <BarcodeScanner
          onResult={(food)=>addFoodToMeal(scanMeal,food)}
          onClose={()=>setScanMeal(null)}
        />
      )}

      {/* History */}
      {s.nutrition.slice(0,14).map(n=>(
        <Card key={n.id} onClick={()=>editEntry(n)} style={{padding:14,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:V.text2}}>{fmtFull(n.date)}</span>
              {n.sleep>0&&<span style={{fontSize:10,color:V.purple}}>{Icons.moon({size:10,color:V.purple})} {(parseFloat(n.sleep)||0).toFixed(1)}h</span>}
            </div>
            <button onClick={()=>{ConfirmCtrl.show("Delete nutrition log?",fmtFull(n.date),()=>{Undo.set("Nutrition deleted",n,"nutrition");d({type:"DEL_N",id:n.id});SuccessToastCtrl.show("Nutrition deleted");});}} aria-label="Delete nutrition entry" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:13,color:V.text3})}</button>
          </div>
          <div style={{display:"flex",gap:12,marginTop:8,alignItems:"baseline"}}>
            <span style={{fontSize:18,fontWeight:700,color:V.warn,fontFamily:V.mono}}>{n.cal}<span style={{fontSize:10,color:V.text3}}> kcal</span></span>
            <span style={{fontSize:12,color:V.accent,fontFamily:V.mono}}>{n.protein}P</span>
            <span style={{fontSize:12,color:V.accent2,fontFamily:V.mono}}>{n.carbs}C</span>
            <span style={{fontSize:12,color:V.warn,fontFamily:V.mono}}>{n.fat}F</span>
            {n.water>0&&<span style={{fontSize:10,color:V.accent2}}>{Icons.droplet({size:9,color:V.accent2})} {n.water}</span>}
          </div>
          {/* Meal timing */}
          {n.meals?.some(m=>m.time)&&(
            <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
              {n.meals.filter(m=>m.time).map((m,i)=>(
                <span key={i} style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:"rgba(255,255,255,0.03)",color:V.text3}}>
                  {m.name} {m.time}
                </span>
              ))}
            </div>
          )}
          <Progress val={n.cal} max={s.goals.cal} color={V.warn} h={4}/>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  BODY TAB
// ═══════════════════════════════════════
// ─── Height string to meters ───
