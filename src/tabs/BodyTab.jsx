import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Progress, Stat, ValidationWarning, validateBody, SuccessToastCtrl, ConfirmCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, wUnit, convW, toKg, toLbs, chartCfg } from '../utils/helpers';
import { Undo } from '../utils/undo';
import { ShareCard } from '../utils/share';
import { checkAndAwardMissions } from './gamification';

export function parseHeightToM(h){
  if(!h)return null;
  const hs=String(h).trim();
  const cm=hs.match(/^([\d.]+)\s*cm$/i);if(cm)return parseFloat(cm[1])/100;
  const fi=hs.match(/^(\d+)['\s](\d+)/);if(fi)return(parseInt(fi[1])*12+parseInt(fi[2]))*0.0254;
  const ff=hs.match(/^(\d+)'?$/);if(ff)return parseInt(ff[1])*0.3048;
  return null;
}

export function BodyTab({s,d}){
  const [show,setShow]=useState(false);
  const emptyForm={date:today(),weight:"",bf:"",waist:"",hips:"",chest:"",neck:"",arms:"",thighs:"",calves:""};
  const [form,setForm]=useState(emptyForm);
  const [showMeasurements,setShowMeasurements]=useState(false);

  const save=()=>{
    d({type:"ADD_B",b:{id:uid(),date:form.date,
      weight:parseFloat(form.weight)||0,bf:parseFloat(form.bf)||0,
      waist:parseFloat(form.waist)||0,hips:parseFloat(form.hips)||0,
      chest:parseFloat(form.chest)||0,neck:parseFloat(form.neck)||0,
      arms:parseFloat(form.arms)||0,thighs:parseFloat(form.thighs)||0,
      calves:parseFloat(form.calves)||0}});
    Haptic.medium();SuccessToastCtrl.show("Logged ✓");
    setTimeout(()=>checkAndAwardMissions({...s,body:[b,...s.body]},d),400);
    setShow(false);
    const lastPhotoDate=s.photos[0]?.date;
    const daysSincePhoto=lastPhotoDate?Math.round((Date.now()-new Date(lastPhotoDate+"T12:00:00"))/86400000):99;
    if(daysSincePhoto>=7){
      setTimeout(()=>{
        ConfirmCtrl.show("Take a progress photo?",`It's been ${daysSincePhoto} days since your last one.`,
          ()=>d({type:"TAB",tab:"track_photos"}));
      },500);
    }
  };

  const latest=s.body[0]; const prev=s.body[1];
  const wc=latest&&prev?(parseFloat(latest.weight)||0)-(parseFloat(prev.weight)||0):0;

  const trend=useMemo(()=>
    s.body.filter(m=>m.date>=ago(s.range)).sort((a,b)=>a.date.localeCompare(b.date))
      .map(m=>({date:fmtShort(m.date),wt:+(parseFloat(m.weight)||0).toFixed(1),bf:+((parseFloat(m.bf)||0).toFixed(1))}))
  ,[s.body,s.range]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8}}>
        <Btn full onClick={()=>{setForm({...emptyForm,date:today()});setShowMeasurements(false);setShow(true);}}>
          {Icons.plus({size:16,color:V.bg})} Log Today
        </Btn>
        {s.body.find(b=>b.date===ago(1))&&(
          <Btn v="secondary" onClick={()=>{
            const yd=s.body.find(b=>b.date===ago(1));
            if(yd){setForm({date:today(),weight:yd.weight?.toString()||"",bf:yd.bf?.toString()||"",
              waist:yd.waist?.toString()||"",hips:yd.hips?.toString()||"",
              chest:yd.chest?.toString()||"",neck:yd.neck?.toString()||"",
              arms:yd.arms?.toString()||"",thighs:yd.thighs?.toString()||"",
              calves:yd.calves?.toString()||""});setShowMeasurements(false);setShow(true);}
          }} s={{flexShrink:0,fontSize:11}}>{Icons.copy({size:14,color:V.text2})} Yesterday</Btn>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{gridColumn:"1/-1"}}>
          <Stat icon={Icons.scale} label="Weight" value={(parseFloat(latest?.weight)||0).toFixed(1)||"—"} unit={wUnit(s.units)} color={V.purple}
            sub={wc!==0?`${wc>0?"↗ +":"↘ "}${wc.toFixed(1)} ${wUnit(s.units)}`:latest?"→ stable":undefined}/>
          {s.goals?.goalWeight&&latest?.weight&&(()=>{
            const cur=parseFloat(latest.weight)||0;const goal=parseFloat(s.goals.goalWeight)||0;
            const start=s.body.slice(-1)[0]?.weight?parseFloat(s.body.slice(-1)[0].weight)||cur:cur;
            if(!goal||goal===cur)return null;
            const losing=goal<start;const total=Math.abs(start-goal);const done=Math.abs(cur-start);
            const pct=total>0?Math.min(100,Math.round(done/total*100)):0;
            const remaining=Math.abs(goal-cur).toFixed(1);
            return(
              <div style={{marginTop:6,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:9,color:V.text3}}>Goal: {goal}{wUnit(s.units)}</span>
                  <span style={{fontSize:9,fontWeight:700,color:V.accent}}>{pct}% there · {remaining}{wUnit(s.units)} to go</span>
                </div>
                <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.06)"}}>
                  <div style={{height:5,borderRadius:3,width:`${pct}%`,
                    background:losing?"linear-gradient(90deg,#f43f5e,#f97316)":"linear-gradient(90deg,#22c55e,#86efac)",
                    transition:"width .5s"}}/>
                </div>
              </div>
            );
          })()}
        </div>
        <Stat icon={Icons.activity} label="Body Fat" value={((parseFloat(latest?.bf)||0).toFixed(1))||"—"} unit="%" color={V.danger}
          sub={(()=>{const prevBf=prev?parseFloat(prev.bf)||0:0;const curBf=latest?parseFloat(latest.bf)||0:0;const d2=curBf-prevBf;return d2!==0&&prevBf>0?`${d2>0?"↗ +":"↘ "}${d2.toFixed(1)}%`:curBf>0?"→ stable":undefined;})()}/>
      </div>

      {/* #18: Weekly average weight */}
      {s.body.length>=3&&(()=>{
        const last7=s.body.filter(b=>b.date>=ago(7)&&parseFloat(b.weight)>0);
        const last14=s.body.filter(b=>b.date>=ago(14)&&b.date<ago(7)&&parseFloat(b.weight)>0);
        const avg7=last7.length?last7.reduce((a,b2)=>a+parseFloat(b2.weight),0)/last7.length:0;
        const avg14=last14.length?last14.reduce((a,b2)=>a+parseFloat(b2.weight),0)/last14.length:0;
        const weekDiff=avg7&&avg14?avg7-avg14:0;
        if(!avg7)return null;
        return(
          <Card style={{padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:V.text3}}>7-DAY AVERAGE</div>
                <div style={{fontSize:20,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{avg7.toFixed(1)} <span style={{fontSize:10,color:V.text3}}>{wUnit(s.units)}</span></div>
              </div>
              {weekDiff!==0&&<div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:V.text3}}>vs prior week</div>
                <div style={{fontSize:14,fontWeight:700,color:weekDiff>0?V.warn:V.accent,fontFamily:V.mono}}>{weekDiff>0?"+":""}{weekDiff.toFixed(1)}</div>
              </div>}
            </div>
          </Card>
        );
      })()}

      {/* ── T4 #18: Body weight trend prediction ── */}
      {(()=>{
        const wtPts=s.body.filter(b=>parseFloat(b.weight)>0)
          .sort((a,b)=>a.date.localeCompare(b.date));
        if(wtPts.length<4)return null;
        // Simple linear regression over last 14 entries (or all if fewer)
        const pts=wtPts.slice(-14);
        const n=pts.length;
        const xs=pts.map((_,i)=>i);
        const ys=pts.map(p=>parseFloat(p.weight));
        const xMean=xs.reduce((a,x)=>a+x,0)/n;
        const yMean=ys.reduce((a,y)=>a+y,0)/n;
        const slope=xs.reduce((a,x,i)=>a+(x-xMean)*(ys[i]-yMean),0)/
                    xs.reduce((a,x)=>a+(x-xMean)**2,0);
        const intercept=yMean-slope*xMean;
        // Days between latest two entries
        const daysBetween=pts.length>=2?
          Math.round((new Date(pts[pts.length-1].date)-new Date(pts[pts.length-2].date))/86400000):1;
        const stepsToProject=Math.round(30/Math.max(daysBetween,1));
        const proj30=parseFloat((intercept+slope*(n-1+stepsToProject)).toFixed(1));
        const proj60=parseFloat((intercept+slope*(n-1+stepsToProject*2)).toFixed(1));
        const current=ys[ys.length-1];
        const delta30=parseFloat((proj30-current).toFixed(1));
        const delta60=parseFloat((proj60-current).toFixed(1));
        if(Math.abs(slope)<0.001)return null; // flat — not interesting
        const goalWeight=parseFloat(s.goals?.goalWeight)||0;
        // Days to goal
        let daysToGoal=null;
        if(goalWeight>0&&Math.abs(delta30)>0.05){
          const stepsNeeded=(goalWeight-intercept)/slope-(n-1);
          const daysNeeded=Math.round(stepsNeeded*daysBetween);
          if(daysNeeded>0&&daysNeeded<730)daysToGoal=daysNeeded;
        }
        const losing=slope<0;
        const trendColor=losing?V.accent:"#f97316";
        return(
          <div style={{padding:"12px 14px",borderRadius:12,
            background:`linear-gradient(135deg,${trendColor}08,rgba(0,0,0,0))`,
            border:`1px solid ${trendColor}22`}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",
              letterSpacing:".06em",marginBottom:10}}>📉 Trend Projection</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:daysToGoal?10:0}}>
              {[
                {label:"30-day projection",val:proj30,delta:delta30},
                {label:"60-day projection",val:proj60,delta:delta60},
              ].map(p=>(
                <div key={p.label} style={{padding:"9px 10px",borderRadius:10,
                  background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:9,color:V.text3,marginBottom:4}}>{p.label}</div>
                  <div style={{fontSize:18,fontWeight:800,color:trendColor,fontFamily:V.mono,lineHeight:1}}>
                    {p.val} <span style={{fontSize:9}}>{wUnit(s.units)}</span>
                  </div>
                  <div style={{fontSize:9,fontWeight:700,marginTop:3,
                    color:losing?(p.delta<0?V.accent:V.danger):(p.delta>0?V.accent:"#f97316")}}>
                    {p.delta>0?"+":""}{p.delta} {wUnit(s.units)}
                  </div>
                </div>
              ))}
            </div>
            {daysToGoal&&(
              <div style={{padding:"7px 10px",borderRadius:8,
                background:`${V.accent}08`,border:`1px solid ${V.accent}18`,
                fontSize:10,color:V.text2}}>
                🎯 At this rate, you'll reach {goalWeight}{wUnit(s.units)} in ~<strong style={{color:V.accent}}>{daysToGoal} days</strong>
              </div>
            )}
            <div style={{fontSize:8,color:V.text3,marginTop:8,opacity:0.6}}>
              Based on last {pts.length} weigh-ins · update by logging regularly
            </div>
          </div>
        );
      })()}

      <Card>
        <span style={{fontSize:11,color:V.text3,fontWeight:700,display:"block",marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Weight & BF%</span>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend}>
            <CartesianGrid {...chartCfg.grid} vertical={false}/>
            <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
            <YAxis yAxisId="w" domain={["dataMin-2","dataMax+2"]} {...chartCfg.axis} width={30}/>
            <YAxis yAxisId="b" orientation="right" domain={["dataMin-1","dataMax+1"]} {...chartCfg.axis} width={28}/>
            <Tooltip {...chartCfg.tip}/>
            {/* #17: Goal weight line */}
            {s.goals?.goalWeight>0&&<ReferenceLine yAxisId="w" y={s.goals.goalWeight} stroke={V.accent} strokeDasharray="6 3" strokeOpacity={0.6}
              label={{value:`Goal: ${s.goals.goalWeight}`,position:"insideTopRight",fill:V.accent,fontSize:8}}/>}
            <Line yAxisId="w" type="monotone" dataKey="wt" stroke={V.purple} strokeWidth={2} dot={{r:3}} name="Weight"/>
            <Line yAxisId="b" type="monotone" dataKey="bf" stroke={V.danger} strokeWidth={2} dot={{r:3}} name="BF%"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* FFMI / BMI / Lean Mass */}
      {(()=>{
        const latest=(s.body||[]).find(b=>b.weight);
        if(!latest?.weight||!latest?.bf)return null;
        const hm=parseHeightToM(s.profile?.height);
        if(!hm||hm<1)return null;
        const wKg=s.units==="kg"?parseFloat(latest.weight):parseFloat(latest.weight)*0.453592;
        const bf=parseFloat(latest.bf);
        if(!wKg||!bf||!isFinite(wKg)||!isFinite(bf))return null;
        const leanKg=wKg*(1-bf/100);
        const ffmi=Math.round((leanKg/(hm*hm))*10)/10;
        const bmi=Math.round((wKg/(hm*hm))*10)/10;
        const leanDisp=s.units==="kg"?`${Math.round(leanKg*10)/10} kg`:`${Math.round(leanKg*2.205)} lbs`;
        const ffmiRating=ffmi<18?"Below Avg":ffmi<20?"Average":ffmi<22?"Above Avg":ffmi<24?"Excellent":ffmi<26?"Elite":"World Class";
        const ffmiColor=ffmi<18?V.text3:ffmi<20?V.warn:ffmi<22?V.accent2:ffmi<24?V.accent:ffmi<26?"#f59e0b":"#f43f5e";
        const bmiNote=bmi<18.5?"Underweight":bmi<25?"Normal":bmi<30?"Overweight":"Obese";
        return(
          <Card style={{padding:14}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Body Composition</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              {[
                {label:"FFMI",value:ffmi,note:ffmiRating,color:ffmiColor},
                {label:"BMI",value:bmi,note:bmiNote,color:V.text2},
                {label:"Lean Mass",value:leanDisp,note:"fat-free",color:V.purple},
              ].map(m=>(
                <div key={m.label} style={{textAlign:"center",padding:"8px 4px",borderRadius:8,
                  background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:9,color:V.text3,marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>{m.label}</div>
                  <div style={{fontSize:m.label==="Lean Mass"?13:18,fontWeight:900,color:m.color,fontFamily:V.mono,lineHeight:1}}>{m.value}</div>
                  <div style={{fontSize:8,color:m.color,marginTop:3,fontWeight:600}}>{m.note}</div>
                </div>
              ))}
            </div>
            <div style={{padding:"7px 10px",borderRadius:8,background:`${ffmiColor}08`,border:`1px solid ${ffmiColor}18`,fontSize:10,color:V.text2,lineHeight:1.5}}>
              FFMI measures muscle per height. Natural range 18–25 · Elite natural ~25. Requires body fat % to be logged.
            </div>
          </Card>
        );
      })()}

      {/* #19: Measurement comparison card — since Day 1 */}
      {s.body.length>=2&&(()=>{
        const first=s.body[s.body.length-1];const last=s.body[0];
        const changes=[
          {l:"Weight",v1:parseFloat(first.weight)||0,v2:parseFloat(last.weight)||0,u:wUnit(s.units),c:V.purple},
          {l:"Body Fat",v1:parseFloat(first.bf)||0,v2:parseFloat(last.bf)||0,u:"%",c:V.danger},
          {l:"Waist",v1:parseFloat(first.waist)||0,v2:parseFloat(last.waist)||0,u:s.units==="kg"?"cm":"in",c:V.accent2},
          {l:"Hips",v1:parseFloat(first.hips)||0,v2:parseFloat(last.hips)||0,u:s.units==="kg"?"cm":"in",c:"#ec4899"},
          {l:"Chest",v1:parseFloat(first.chest)||0,v2:parseFloat(last.chest)||0,u:s.units==="kg"?"cm":"in",c:V.accent},
          {l:"Arms",v1:parseFloat(first.arms)||0,v2:parseFloat(last.arms)||0,u:s.units==="kg"?"cm":"in",c:V.warn},
          {l:"Thighs",v1:parseFloat(first.thighs)||0,v2:parseFloat(last.thighs)||0,u:s.units==="kg"?"cm":"in",c:V.purple},
          {l:"Calves",v1:parseFloat(first.calves)||0,v2:parseFloat(last.calves)||0,u:s.units==="kg"?"cm":"in",c:"#22c55e"},
        ].filter(c2=>c2.v1>0&&c2.v2>0);
        if(changes.length===0)return null;
        const days=Math.round((new Date(last.date)-new Date(first.date))/86400000);
        return(
          <Card style={{padding:14}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:4}}>Progress Since Day 1</div>
            <div style={{fontSize:9,color:V.text3,marginBottom:8}}>{fmtShort(first.date)} → {fmtShort(last.date)} ({days} days)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {changes.map(c2=>{
                const diff=c2.v2-c2.v1;
                return(
                  <div key={c2.l} style={{textAlign:"center",padding:8,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                    <div style={{fontSize:14,fontWeight:800,color:diff===0?V.text3:(c2.l==="Waist"||c2.l==="Body Fat"?(diff<0?V.accent:V.danger):(diff>0?V.accent:V.danger)),fontFamily:V.mono}}>
                      {diff>0?"+":""}{diff.toFixed(1)}
                    </div>
                    <div style={{fontSize:10,color:V.text3}}>{c2.l} ({c2.u})</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {latest&&(()=>{
        const unit=s.units==="kg"?"cm":"in";
        const meas=[
          {l:"Waist",v:latest.waist,c:V.accent2},
          {l:"Hips",v:latest.hips,c:"#ec4899"},
          {l:"Chest",v:latest.chest,c:V.accent},
          {l:"Arms",v:latest.arms,c:V.warn},
          {l:"Thighs",v:latest.thighs,c:V.purple},
          {l:"Calves",v:latest.calves,c:"#22c55e"},
          {l:"Neck",v:latest.neck,c:V.text3},
        ].filter(m=>parseFloat(m.v)>0);
        if(meas.length===0)return null;
        return(
          <Card style={{padding:14}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Measurements</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {meas.map(m=>(
                <div key={m.l} style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.02)",border:`1px solid ${m.c}20`}}>
                  <div style={{fontSize:9,color:V.text3,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>{m.l}</div>
                  <div style={{fontSize:20,fontWeight:800,color:m.c,fontFamily:V.mono,lineHeight:1}}>{(parseFloat(m.v)||0).toFixed(1)}<span style={{fontSize:10,fontWeight:400,color:V.text3}}> {unit}</span></div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {show&&(
        <Sheet title="Log Body" onClose={()=>setShow(false)}
          footer={<Btn full onClick={save}>{Icons.check({size:16,color:V.bg})} Save</Btn>}>
          <Field label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Essential</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Weight" type="number" value={form.weight} onChange={v=>setForm(f=>({...f,weight:v}))} unit={wUnit(s.units)} step="0.1"/>
              <Field label="Body Fat %" type="number" value={form.bf} onChange={v=>setForm(f=>({...f,bf:v}))} unit="%" step="0.1"/>
            </div>
          </div>
          <button onClick={()=>setShowMeasurements(v=>!v)}
            style={{width:"100%",padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.03)",
              border:`1px dashed ${showMeasurements?V.accent+"40":"rgba(255,255,255,0.1)"}`,
              cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",
              fontFamily:V.font,marginBottom:showMeasurements?10:0}}>
            <span style={{fontSize:12,fontWeight:600,color:showMeasurements?V.accent:V.text3}}>📏 Measurements <span style={{fontSize:10,fontWeight:400,color:V.text3}}>(optional)</span></span>
            <span style={{fontSize:14,color:V.text3}}>{showMeasurements?"▲":"▼"}</span>
          </button>
          {showMeasurements&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Waist" type="number" value={form.waist} onChange={v=>setForm(f=>({...f,waist:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
              <Field label="Hips" type="number" value={form.hips} onChange={v=>setForm(f=>({...f,hips:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
              <Field label="Chest" type="number" value={form.chest} onChange={v=>setForm(f=>({...f,chest:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
              <Field label="Neck" type="number" value={form.neck} onChange={v=>setForm(f=>({...f,neck:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
              <Field label="Biceps/Arms" type="number" value={form.arms} onChange={v=>setForm(f=>({...f,arms:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
              <Field label="Thighs" type="number" value={form.thighs} onChange={v=>setForm(f=>({...f,thighs:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
              <Field label="Calves" type="number" value={form.calves} onChange={v=>setForm(f=>({...f,calves:v}))} unit={s.units==="kg"?"cm":"in"} step="0.1"/>
            </div>
          )}
        </Sheet>
      )}

      {/* History Table */}
      <Card>
        <span style={{fontSize:11,color:V.text3,fontWeight:700,display:"block",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>History</span>
        {s.body.slice(0,10).map(m=>(
          <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",
            borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
            <span style={{fontSize:12,color:V.text3}}>{fmtShort(m.date)}</span>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:13,color:V.purple,fontFamily:V.mono}}>{(parseFloat(m.weight)||0).toFixed(1)}</span>
              <span style={{fontSize:12,color:V.danger,fontFamily:V.mono}}>{((parseFloat(m.bf)||0).toFixed(1))}%</span>
              <button onClick={()=>{ConfirmCtrl.show("Delete measurement?",fmtShort(m.date),()=>{Undo.set("Measurement deleted",m,"body");d({type:"DEL_B",id:m.id});SuccessToastCtrl.show("Measurement deleted");});}} aria-label="Delete measurement" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:12,color:V.text3})}</button>
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
