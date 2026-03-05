import React, { useState, useMemo } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, fmtShort, uid } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl, validateNutrition, ValidationWarning } from '../shared/index.jsx';
import { FOODS, FOOD_CATS } from '../../data/foods.js';

function NutritionTab({s,d}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({date:today(),cal:"",protein:"",carbs:"",fat:"",fiber:"",water:"",sleep:"",
    meals:[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
  const [activeMeal,setActiveMeal]=useState(null);
  const [scanMeal,setScanMeal]=useState(null);
  const [valWarnings,setValWarnings]=useState(null);

  const start=()=>{
    const ex=s.nutrition.find(n=>n.date===today());
    if(ex)setForm({...ex,cal:ex.cal.toString(),protein:ex.protein.toString(),carbs:ex.carbs.toString(),fat:ex.fat.toString(),
      fiber:(ex.fiber||"").toString(),water:(ex.water||"").toString(),sleep:(ex.sleep||"").toString(),
      meals:ex.meals||[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
    else setForm({date:today(),cal:"",protein:"",carbs:"",fat:"",fiber:"",water:"",sleep:"",
      meals:[{name:"Breakfast",items:[]},{name:"Lunch",items:[]},{name:"Dinner",items:[]},{name:"Snacks",items:[]}]});
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
    form.meals.forEach(m=>(m.items||[]).forEach(i=>{cal+=i.cal;protein+=i.protein;carbs+=i.carbs||0;fat+=i.fat||0;}));
    setForm(f=>({...f,cal:cal.toString(),protein:protein.toString(),carbs:carbs.toString(),fat:fat.toString()}));
  };

  const save=()=>{
    const n={id:uid(),date:form.date,cal:parseInt(form.cal)||0,protein:parseInt(form.protein)||0,
      carbs:parseInt(form.carbs)||0,fat:parseInt(form.fat)||0,fiber:parseInt(form.fiber)||0,
      water:parseInt(form.water)||0,sleep:parseFloat(form.sleep)||0,meals:form.meals};
    const warnings=validateNutrition(n);
    if(warnings.length>0&&!valWarnings){setValWarnings(warnings);return;}
    setValWarnings(null);
    d({type:"ADD_N",n});
    SuccessToastCtrl.show("Nutrition logged");
    setShow(false);
  };

  const week=s.nutrition.filter(n=>n.date>=ago(7));
  const avgCal=week.length?Math.round(week.reduce((s,n)=>s+n.cal,0)/week.length):0;
  const avgP=week.length?Math.round(week.reduce((s,n)=>s+n.protein,0)/week.length):0;
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
      {/* Daily summary bar */}
      <Card style={{padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:V.text}}>Today</span>
          <span style={{fontSize:10,color:V.text3}}>{tCal} / {calGoal} cal</span>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
              <div style={{height:"100%",borderRadius:2,background:calPct>=100?V.accent:V.warn,width:`${calPct}%`,transition:"width .3s"}}/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:12,fontSize:10,fontFamily:V.mono}}>
          <span style={{color:tProt>=protGoal?V.accent:V.text3}}>{tProt}g P</span>
          <span style={{color:V.text3}}>{tCarbs}g C</span>
          <span style={{color:V.text3}}>{tFat}g F</span>
          <span style={{marginLeft:"auto",color:protPct>=100?V.accent:V.warn}}>{protPct}% protein</span>
        </div>
      </Card>

      <div style={{display:"flex",gap:8}}>
        <Btn full onClick={start}>{Icons.plus({size:16,color:V.bg})} Log Nutrition</Btn>
        {s.nutrition.find(n=>n.date===ago(1))&&(
          <Btn v="secondary" onClick={copyYesterday} s={{flexShrink:0,fontSize:11}}>{Icons.copy({size:14,color:V.text2})} Copy Yesterday</Btn>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Stat icon={Icons.flame} label="Avg Calories" value={avgCal} unit="kcal" color={V.warn}/>
        <Stat icon={Icons.target} label="Avg Protein" value={avgP} unit="g" color={V.accent}/>
      </div>

      <Card>
        <span style={{fontSize:13,color:V.text2,fontWeight:600,display:"block",marginBottom:12}}>Macros</span>
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
        <Sheet title="Log Nutrition" onClose={()=>setShow(false)}
          footer={<Btn full onClick={save}>{Icons.check({size:16,color:V.bg})} Save Nutrition</Btn>}>
          <Field label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>

          {/* Meals with food database search */}
          {form.meals.map((meal,mi)=>{
            const mCal=(meal.items||[]).reduce((s,i)=>s+i.cal,0);
            const mP=(meal.items||[]).reduce((s,i)=>s+i.protein,0);
            return(
              <div key={mi} style={{marginBottom:12,padding:12,background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${V.cardBorder}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:700,color:V.text}}>{meal.name}</span>
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
        <Card key={n.id} style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:12,color:V.text2}}>{fmtFull(n.date)}</span>
              {n.sleep>0&&<span style={{fontSize:10,color:V.purple}}>{Icons.moon({size:10,color:V.purple})} {(parseFloat(n.sleep)||0).toFixed(1)}h</span>}
            </div>
            <button onClick={()=>{if(confirm("Delete this nutrition log?")){Undo.set("Nutrition deleted",n,"nutrition");d({type:"DEL_N",id:n.id});SuccessToastCtrl.show("Nutrition deleted");}}} aria-label="Delete nutrition entry" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:13,color:V.text3})}</button>
          </div>
          <div style={{display:"flex",gap:12,marginTop:8,alignItems:"baseline"}}>
            <span style={{fontSize:18,fontWeight:700,color:V.warn,fontFamily:V.mono}}>{n.cal}<span style={{fontSize:10,color:V.text3}}> kcal</span></span>
            <span style={{fontSize:12,color:V.accent,fontFamily:V.mono}}>{n.protein}P</span>
            <span style={{fontSize:12,color:V.accent2,fontFamily:V.mono}}>{n.carbs}C</span>
            <span style={{fontSize:12,color:V.warn,fontFamily:V.mono}}>{n.fat}F</span>
          </div>
          <Progress val={n.cal} max={s.goals.cal} color={V.warn} h={4}/>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  BODY TAB
// ═══════════════════════════════════════

export { NutritionTab };
export default NutritionTab;
