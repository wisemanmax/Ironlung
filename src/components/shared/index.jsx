import React, { useState, useEffect, useMemo } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, wUnit, calc1RM, fmtTimer, Undo } from '../../utils.js';

// ─── #11 Error Boundary ───
class ErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return{err:e};}
  componentDidCatch(e,info){console.error("IRONLOG Error:",e,info);}
  render(){
    if(this.state.err)return React.createElement("div",{style:{padding:40,textAlign:"center",background:V.bg,color:V.text,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:V.font}},
      React.createElement("div",{style:{fontSize:48}},"⚠️"),
      React.createElement("div",{style:{fontSize:18,fontWeight:700}},"Something went wrong"),
      React.createElement("div",{style:{fontSize:12,color:V.text3,maxWidth:300}},this.state.err?.message||"Unknown error"),
      React.createElement("button",{onClick:()=>window.location.reload(),style:{padding:"12px 24px",borderRadius:10,background:V.accent,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,color:V.bg}},"Reload App"),
      React.createElement("button",{onClick:()=>{try{const d=JSON.stringify({workouts:JSON.parse(localStorage.getItem("ft-w")||"[]"),nutrition:JSON.parse(localStorage.getItem("ft-n")||"[]"),body:JSON.parse(localStorage.getItem("ft-b")||"[]")});const b=new Blob([d],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="ironlog-emergency-backup.json";a.click();}catch(e){alert("Export failed: "+e.message);}},
        style:{padding:"8px 16px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:11,color:V.text3}},"Emergency Data Export")
    );
    return this.props.children;
  }
}

// ─── #2 Confirm Dialog ───
function ConfirmDialog({msg,detail,onConfirm,onCancel}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)"}} onClick={onCancel}/>
      <div role="alertdialog" aria-modal="true" aria-label={msg} style={{position:"relative",background:"linear-gradient(180deg,#1a1a28,#0e0e16)",
        borderRadius:16,padding:24,maxWidth:320,width:"100%",border:`1px solid ${V.cardBorder}`}}>
        <div style={{fontSize:15,fontWeight:700,color:V.text,marginBottom:6}}>{msg}</div>
        {detail&&<div style={{fontSize:12,color:V.text3,lineHeight:1.5,marginBottom:16}}>{detail}</div>}
        <div style={{display:"flex",gap:10}}>
          <Btn v="secondary" full onClick={onCancel}>Cancel</Btn>
          <Btn full onClick={onConfirm} s={{background:V.danger}}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── #2 Undo Toast ───
function UndoToast({d}){
  const [item,setItem]=useState(null);
  useEffect(()=>{
    const iv=setInterval(()=>{const u=Undo.get();setItem(u);},200);
    return()=>clearInterval(iv);
  },[]);
  if(!item)return null;
  const doUndo=()=>{
    const u=Undo.get();if(!u)return;
    if(u.type==="workout")d({type:"ADD_W",w:u.item});
    else if(u.type==="nutrition")d({type:"ADD_N",n:u.item});
    else if(u.type==="body")d({type:"ADD_B",b:u.item});
    else if(u.type==="photo")d({type:"ADD_PHOTO",photo:u.item});
    Undo.clear();setItem(null);
    SuccessToastCtrl.show("Restored");
  };
  return(
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:1500,
      padding:"10px 16px",background:"rgba(30,30,50,0.95)",borderRadius:12,border:`1px solid ${V.cardBorder}`,
      display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
      <span style={{fontSize:12,color:V.text}}>{item.label}</span>
      <button onClick={doUndo} style={{padding:"4px 12px",borderRadius:6,background:V.accent,border:"none",
        cursor:"pointer",fontSize:11,fontWeight:700,color:V.bg,fontFamily:V.font}}>Undo</button>
    </div>
  );
}

// ─── Success Toast System ───
let _successMsg=null;let _successTimer=null;
const SuccessToastCtrl={
  show:(msg)=>{_successMsg={msg,ts:Date.now()};if(_successTimer)clearTimeout(_successTimer);_successTimer=setTimeout(()=>{_successMsg=null;},2500);},
  get:()=>_successMsg,
};

function SuccessToast(){
  const [msg,setMsg]=useState(null);
  useEffect(()=>{
    const iv=setInterval(()=>{setMsg(SuccessToastCtrl.get());},150);
    return()=>clearInterval(iv);
  },[]);
  if(!msg)return null;
  return(
    <div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:1500,
      padding:"10px 20px",background:"rgba(0,245,160,0.12)",borderRadius:12,border:`1px solid ${V.accent}30`,
      display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",
      backdropFilter:"blur(12px)",animation:"fadeInDown .25s ease-out"}}>
      <div style={{width:20,height:20,borderRadius:10,background:V.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{color:V.bg,fontSize:12,fontWeight:900}}>✓</span>
      </div>
      <span style={{fontSize:13,fontWeight:600,color:V.text}}>{msg.msg}</span>
    </div>
  );
}

// ─── #3 Pre-save Validation ───
function validateWorkout(w,s){
  const warnings=[];
  w.exercises.forEach(ex=>{
    const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
    ex.sets.forEach(st=>{
      if(st.weight>800)warnings.push(`${name}: ${st.weight} ${wUnit(s.units)} seems extremely high`);
      if(st.reps>100)warnings.push(`${name}: ${st.reps} reps seems high`);
    });
  });
  // Duplicate check
  const dupes=s.workouts.filter(wk=>wk.date===w.date&&wk.exercises.map(e=>e.exerciseId).sort().join(",")===w.exercises.map(e=>e.exerciseId).sort().join(","));
  if(dupes.length>0)warnings.push("You already logged a similar workout today");
  return warnings;
}
function validateNutrition(n){
  const w=[];
  if(n.cal>8000)w.push(`${n.cal} calories seems extremely high`);
  if(n.protein>500)w.push(`${n.protein}g protein seems very high`);
  return w;
}
function validateBody(b,s){
  const w=[];
  const last=s.body[0];
  if(last&&b.weight>0&&Math.abs(b.weight-last.weight)>20)
    w.push(`Weight change of ${Math.abs(b.weight-last.weight).toFixed(1)} ${wUnit(s.units)} from last entry`);
  return w;
}

// ─── #3 Validation Confirm Dialog ───
function ValidationWarning({warnings,onConfirm,onCancel}){
  if(!warnings||warnings.length===0)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)"}} onClick={onCancel}/>
      <div role="alertdialog" aria-modal="true" style={{position:"relative",background:"linear-gradient(180deg,#1a1a28,#0e0e16)",
        borderRadius:16,padding:24,maxWidth:340,width:"100%",border:`1px solid ${V.warn}30`}}>
        <div style={{fontSize:15,fontWeight:700,color:V.warn,marginBottom:8}}>⚠️ Heads up</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
          {warnings.map((w,i)=><div key={i} style={{fontSize:12,color:V.text2,lineHeight:1.4,padding:"6px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>• {w}</div>)}
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn v="secondary" full onClick={onCancel}>Go Back</Btn>
          <Btn full onClick={onConfirm}>Save Anyway</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── #5 Searchable Exercise Picker ───
function ExercisePicker({exercises,value,onChange,catFilter,setCatFilter,todayType}){
  const [search,setSearch]=useState("");
  const cats=["All",...new Set(exercises.map(e=>e.cat))];
  const recent=LS.get("ft-recent-exercises")||[];
  // Split-to-category mapping for suggestions
  const splitCats={Push:["Chest","Shoulders","Triceps"],Pull:["Back","Biceps"],Legs:["Legs","Glutes"],
    "Upper Power":["Chest","Back","Shoulders"],"Lower Power":["Legs","Glutes"],"Upper Hyper":["Chest","Back","Biceps","Triceps"],
    "Lower Hyper":["Legs","Glutes"],Chest:["Chest"],Back:["Back"],Shoulders:["Shoulders"],Arms:["Biceps","Triceps"]};
  const filtered=useMemo(()=>{
    let list=exercises;
    if(catFilter&&catFilter!=="All")list=list.filter(e=>e.cat===catFilter);
    if(search)list=list.filter(e=>e.name.toLowerCase().includes(search.toLowerCase()));
    // Pin schedule-suggested then recent to top
    if(!search&&(!catFilter||catFilter==="All")){
      const sugCats=todayType?splitCats[todayType]:null;
      const sugExs=sugCats?list.filter(e=>sugCats.includes(e.cat)):[];
      const recentExs=recent.map(id=>exercises.find(e=>e.id===id)).filter(Boolean);
      const pinned=[...sugExs,...recentExs.filter(e=>!sugExs.some(s2=>s2.id===e.id))];
      const rest=list.filter(e=>!pinned.some(p=>p.id===e.id));
      list=[...pinned,...rest];
    }
    return list.slice(0,30);
  },[exercises,catFilter,search,recent,todayType]);

  const select=(id)=>{
    onChange(id);
    // Track recent
    const r=[id,...(recent||[]).filter(r2=>r2!==id)].slice(0,5);
    LS.set("ft-recent-exercises",r);
  };

  return(
    <div>
      <div style={{position:"relative",marginBottom:8}}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Icons.search({size:14,color:V.text3})}</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search exercises..."
          aria-label="Search exercises"
          style={{width:"100%",padding:"10px 14px 10px 34px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",boxSizing:"border-box",minHeight:40,fontFamily:V.font}}/>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}} role="tablist">
        {cats.map(c=><Chip key={c} label={c} active={(catFilter||"All")===c} onClick={()=>setCatFilter(c==="All"?null:c)}/>)}
      </div>
      <div style={{maxHeight:200,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {filtered.map(ex=>(
          <button key={ex.id} onClick={()=>select(ex.id)} aria-label={`Add ${ex.name}`}
            style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",background:value===ex.id?`${V.accent}10`:"transparent",
              border:"none",borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:value===ex.id?V.accent:V.text,fontWeight:value===ex.id?700:400}}>{ex.name}</div>
              <div style={{fontSize:9,color:V.text3}}>{ex.cat}{recent.includes(ex.id)?" · Recent":""}{todayType&&splitCats[todayType]?.includes(ex.cat)&&!recent.includes(ex.id)?" · Today's split":""}</div>
            </div>
            {ex.yt&&<span style={{fontSize:8,color:V.text3}}>📹</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Mobile Components ───
const Card = ({children, style:s={}, onClick, glow}) => (
  <div onClick={onClick} style={{background:glow?`${V.accent}08`:V.card,border:`1px solid ${glow?`${V.accent}25`:V.cardBorder}`,
    borderRadius:16,padding:16,transition:"all .2s",...(onClick?{cursor:"pointer",WebkitTapHighlightColor:"transparent"}:{}),...s}}>
    {children}
  </div>
);

const Btn = ({children,v="primary",full,disabled,onClick,s:extra={}}) => {
  const base = {display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderRadius:12,border:"none",
    fontSize:14,fontWeight:600,fontFamily:V.font,cursor:disabled?"default":"pointer",opacity:disabled?.4:1,
    WebkitTapHighlightColor:"transparent",transition:"all .15s",minHeight:44,...(full?{width:"100%"}:{}),...extra};
  const vars = {
    primary:{...base,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,color:V.bg,padding:"12px 20px"},
    secondary:{...base,background:"rgba(255,255,255,0.06)",color:V.text2,padding:"12px 20px",border:`1px solid ${V.cardBorder}`},
    danger:{...base,background:"rgba(255,107,107,0.12)",color:V.danger,padding:"12px 20px"},
    ghost:{...base,background:"transparent",color:V.text2,padding:"8px 12px"},
    small:{...base,background:`${V.accent}15`,color:V.accent,padding:"8px 14px",fontSize:12,borderRadius:10,minHeight:36},
  };
  return <button onClick={disabled?undefined:onClick} style={vars[v]||vars.primary}>{children}</button>;
};

const Field = ({label,value,onChange,type="text",unit,placeholder,min,max,step,autoFocus}) => (
  <div style={{marginBottom:12}}>
    {label&&<div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>{label}</div>}
    <div style={{position:"relative"}}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        min={min} max={max} step={step} autoFocus={autoFocus}
        style={{width:"100%",padding:"12px 14px",paddingRight:unit?44:14,background:"rgba(255,255,255,0.04)",
          border:`1px solid ${V.cardBorder}`,borderRadius:12,color:V.text,fontSize:16,fontFamily:V.mono,
          outline:"none",boxSizing:"border-box",WebkitAppearance:"none",minHeight:44}} />
      {unit&&<span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:11,color:V.text3}}>{unit}</span>}
    </div>
  </div>
);

const Progress = ({val,max,color=V.accent,h=6}) => (
  <div style={{width:"100%",height:h,background:"rgba(255,255,255,0.05)",borderRadius:h,overflow:"hidden"}}>
    <div style={{width:`${Math.min(100,(val/max)*100)}%`,height:"100%",
      background:val>max?V.danger:`linear-gradient(90deg,${color},${color}bb)`,borderRadius:h,transition:"width .4s ease"}}/>
  </div>
);

const Sheet = ({title,onClose,children,footer}) => (
  <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} role="dialog" aria-modal="true" aria-label={title}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(6px)"}} onClick={onClose}/>
    <div style={{position:"relative",background:"linear-gradient(180deg,#1a1a28,#0e0e16)",borderRadius:"20px 20px 0 0",
      maxHeight:"92vh",display:"flex",flexDirection:"column",paddingBottom:"env(safe-area-inset-bottom, 20px)"}}>
      {/* Drag handle */}
      <div style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:4}}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)"}}/>
      </div>
      {/* Header with back button */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 16px 12px",
        borderBottom:`1px solid ${V.cardBorder}`}}>
        <button onClick={onClose} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",
          cursor:"pointer",padding:"8px 4px",WebkitTapHighlightColor:"transparent",flexShrink:0}}>
          {Icons.chevLeft({size:20,color:V.accent})}
          <span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
        </button>
        <h3 style={{margin:0,fontSize:16,color:V.text,fontFamily:V.font,fontWeight:700,flex:1,textAlign:"center",paddingRight:50}}>{title}</h3>
      </div>
      <div style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",
        overscrollBehavior:"contain",padding:20,paddingBottom:footer?8:20}}>{children}</div>
      {footer&&(
        <div style={{flexShrink:0,padding:"12px 20px 16px",borderTop:`1px solid ${V.cardBorder}`,
          background:"linear-gradient(180deg,#1a1a28,#0e0e16)"}}>{footer}</div>
      )}
    </div>
  </div>
);

const Chip = ({label,active,onClick,color}) => (
  <button onClick={onClick} style={{padding:"7px 14px",borderRadius:20,border:"none",fontSize:12,fontWeight:600,
    fontFamily:V.font,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"all .15s",
    background:active?`${color||V.accent}18`:"rgba(255,255,255,0.04)",
    color:active?(color||V.accent):V.text3}}>
    {label}
  </button>
);

const Stat = ({icon,label,value,unit,color=V.accent,sub}) => (
  <Card>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:38,height:38,borderRadius:11,background:`${color}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {icon({size:17,color})}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>{label}</div>
        <div style={{fontSize:22,fontWeight:700,color:V.text,fontFamily:V.mono,lineHeight:1.2}}>
          {value}<span style={{fontSize:11,color:V.text3,marginLeft:3}}>{unit}</span>
        </div>
        {sub&&<div style={{fontSize:10,color:V.text3,marginTop:1}}>{sub}</div>}
      </div>
    </div>
  </Card>
);

const chartCfg = {
  grid:{stroke:"rgba(255,255,255,0.04)"},
  axis:{stroke:"transparent",fontSize:9,fill:V.text3,tickLine:false,axisLine:false},
  tip:{contentStyle:{background:"#1a1a28",border:`1px solid ${V.cardBorder}`,borderRadius:10,fontSize:11,color:V.text2,fontFamily:V.font,padding:"8px 12px"},cursor:{stroke:V.accent,strokeWidth:1,strokeDasharray:"4 4"}},
};

// ─── YouTube Button ───
const YTBtn=({yt,size=22})=>yt?(
  <a href={`https://www.youtube.com/watch?v=${yt}`} target="_blank" rel="noopener noreferrer"
    style={{width:size,height:size,borderRadius:size/3,background:"rgba(255,0,0,0.10)",
      display:"inline-flex",alignItems:"center",justifyContent:"center",textDecoration:"none",
      WebkitTapHighlightColor:"transparent",flexShrink:0}}>
    {Icons.play({size:size/2.5,color:"#ff4444"})}</a>
):null;

// ─── Global Footer ───
const Footer=()=>(
  <div style={{textAlign:"center",padding:"20px 0 8px",borderTop:"1px solid rgba(255,255,255,0.03)",marginTop:16}}>
    <div style={{fontSize:11,fontWeight:700,color:V.text3}}>Created by <span style={{color:V.text2}}>Byheir Wise</span></div>
    <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:4}}>
      <a href="https://byheir.com" target="_blank" rel="noopener" style={{fontSize:10,color:V.accent,textDecoration:"none",fontWeight:600}}>Byheir.com</a>
      <span style={{fontSize:10,color:V.text3}}>·</span>
      <a href="https://ironlog.space" target="_blank" rel="noopener" style={{fontSize:10,color:V.accent,textDecoration:"none",fontWeight:600}}>Ironlog.space</a>
    </div>
    <div style={{fontSize:9,color:V.text3,marginTop:4,opacity:0.6}}>IRONLOG v{APP_VERSION} · For updates visit ironlog.space</div>
  </div>
);

// ─── Rest Timer ───
function RestTimer(){
  const [active,setActive]=useState(false);
  const [secs,setSecs]=useState(90);
  const [rem,setRem]=useState(90);
  const iRef=useRef(null);
  const start=()=>{setRem(secs);setActive(true);};
  const stop=()=>{setActive(false);clearInterval(iRef.current);};
  useEffect(()=>{
    if(active&&rem>0){
      iRef.current=setInterval(()=>setRem(r=>{if(r<=1){setActive(false);try{navigator.vibrate?.(200);}catch(e){}return 0;}return r-1;}),1000);
      return()=>clearInterval(iRef.current);
    }
  },[active,rem]);
  const pct=active?(rem/secs)*100:100;
  return(
    <div style={{padding:"8px 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{position:"relative",width:48,height:48}}>
          <svg width={48} height={48} style={{transform:"rotate(-90deg)"}}>
            <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3}/>
            <circle cx={24} cy={24} r={20} fill="none" stroke={rem===0?"#ff6b6b":V.accent} strokeWidth={3}
              strokeDasharray={`${pct*1.257} ${125.7}`} strokeLinecap="round" style={{transition:"stroke-dasharray .3s"}}/>
          </svg>
          <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:700,color:rem===0?V.danger:V.text,fontFamily:V.mono}}>{fmtTimer(active?rem:secs)}</span>
        </div>
        <div style={{display:"flex",gap:5}}>
          {[60,90,120,180].map(s=>(
            <button key={s} onClick={()=>{setSecs(s);if(!active)setRem(s);}}
              style={{padding:"6px 10px",borderRadius:8,border:"none",fontSize:10,fontWeight:700,fontFamily:V.font,
                background:secs===s?`${V.accent}15`:"rgba(255,255,255,0.04)",color:secs===s?V.accent:V.text3,
                cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>{s}s</button>
          ))}
        </div>
        <button onClick={active?stop:start} style={{marginLeft:"auto",width:40,height:40,borderRadius:12,border:"none",
          background:active?"rgba(255,107,107,0.15)":`${V.accent}15`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          WebkitTapHighlightColor:"transparent"}}>
          {active?Icons.pause({size:16,color:V.danger}):Icons.play({size:16,color:V.accent})}
        </button>
      </div>
      {rem===0&&!active&&<div style={{marginTop:6,fontSize:12,fontWeight:700,color:V.danger,textAlign:"center"}}>REST COMPLETE — GO!</div>}
    </div>
  );
}

// ─── Food Search ───
function FoodSearch({onAdd}){
  const [q,setQ]=useState("");
  const [dq,setDq]=useState("");
  const [cat,setCat]=useState("All");
  const [qty,setQty]=useState({});
  const [showCustom,setShowCustom]=useState(false);
  const [custom,setCustom]=useState({name:"",cal:"",protein:"",carbs:"",fat:""});
  // #6 Debounce search
  useEffect(()=>{const t=setTimeout(()=>setDq(q),150);return()=>clearTimeout(t);},[q]);
  const results=useMemo(()=>{
    if(!dq&&cat==="All")return FOODS.slice(0,20);
    return FOODS.filter(f=>{const mc=cat==="All"||f.cat===cat;const mq=!dq||f.n.toLowerCase().includes(dq.toLowerCase());return mc&&mq;}).slice(0,30);
  },[dq,cat]);
  const addItem=(food)=>{
    const m=parseFloat(qty[food.n])||1;
    onAdd({name:food.n,cal:Math.round(food.cal*m),protein:Math.round(food.p*m),carbs:Math.round(food.c*m),fat:Math.round(food.f*m)});
    setQty(r=>({...r,[food.n]:""}));
  };
  const addCustomFood=()=>{
    if(!custom.name.trim()||!custom.cal)return;
    onAdd({name:custom.name.trim(),cal:parseInt(custom.cal)||0,protein:parseInt(custom.protein)||0,
      carbs:parseInt(custom.carbs)||0,fat:parseInt(custom.fat)||0});
    setCustom({name:"",cal:"",protein:"",carbs:"",fat:""});setShowCustom(false);
  };
  return(
    <div>
      <div style={{position:"relative",marginBottom:10}}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Icons.search({size:16,color:V.text3})}</div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search 500+ foods..."
          style={{width:"100%",padding:"12px 14px 12px 38px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:12,color:V.text,fontSize:14,outline:"none",boxSizing:"border-box",minHeight:44,fontFamily:V.font}}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        {FOOD_CATS.map(c=><Chip key={c} label={c} active={cat===c} onClick={()=>setCat(c)}/>)}
      </div>
      <div style={{maxHeight:220,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {results.map((food,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,color:V.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{food.n}</div>
              <div style={{fontSize:10,color:V.text3,fontFamily:V.mono}}>
                <span style={{color:V.warn}}>{food.cal}</span> · <span style={{color:V.accent}}>{food.p}P</span> · <span style={{color:V.accent2}}>{food.c}C</span> · <span style={{color:V.warn}}>{food.f}F</span>
              </div>
            </div>
            <input type="number" inputMode="decimal" value={qty[food.n]||""} onChange={e=>setQty(q2=>({...q2,[food.n]:e.target.value}))}
              placeholder="1" step="0.5" style={{width:44,padding:"6px 4px",background:"rgba(255,255,255,0.04)",
                border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,fontFamily:V.mono,textAlign:"center",outline:"none"}}/>
            <button onClick={()=>addItem(food)} style={{width:36,height:36,borderRadius:10,background:`${V.accent}15`,
              border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>
              {Icons.plus({size:14,color:V.accent})}</button>
          </div>
        ))}
        {results.length===0&&<div style={{textAlign:"center",padding:16,color:V.text3,fontSize:12}}>No results for "{q}"</div>}
      </div>
      {/* Custom food entry */}
      {!showCustom?(
        <button onClick={()=>setShowCustom(true)} style={{width:"100%",padding:"10px",marginTop:8,
          background:"rgba(255,255,255,0.02)",border:`1px dashed ${V.cardBorder}`,borderRadius:10,
          cursor:"pointer",fontSize:11,color:V.accent,fontWeight:600,fontFamily:V.font,
          WebkitTapHighlightColor:"transparent"}}>
          + Add Custom Food
        </button>
      ):(
        <div style={{marginTop:8,padding:10,background:"rgba(255,255,255,0.02)",borderRadius:10,border:`1px solid ${V.cardBorder}`}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Custom Food Entry</div>
          <input value={custom.name} onChange={e=>setCustom(c=>({...c,name:e.target.value}))} placeholder="Food name *"
            style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:12,outline:"none",marginBottom:6,boxSizing:"border-box",fontFamily:V.font}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4,marginBottom:8}}>
            {[{k:"cal",l:"Cal",u:""},{k:"protein",l:"Prot",u:"g"},{k:"carbs",l:"Carb",u:"g"},{k:"fat",l:"Fat",u:"g"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:8,color:V.text3,fontWeight:600,marginBottom:2}}>{f.l}</div>
                <input type="number" inputMode="numeric" value={custom[f.k]} onChange={e=>setCustom(c=>({...c,[f.k]:e.target.value}))}
                  placeholder="0" style={{width:"100%",padding:"6px 4px",background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${V.cardBorder}`,borderRadius:6,color:V.text,fontSize:11,fontFamily:V.mono,
                    textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowCustom(false)} style={{flex:1,padding:"7px",borderRadius:8,
              background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",
              fontSize:10,color:V.text3,fontFamily:V.font}}>Cancel</button>
            <button onClick={addCustomFood} disabled={!custom.name.trim()||!custom.cal}
              style={{flex:1,padding:"7px",borderRadius:8,background:V.accent,border:"none",cursor:"pointer",
                fontSize:10,fontWeight:700,color:V.bg,fontFamily:V.font,
                opacity:(!custom.name.trim()||!custom.cal)?0.4:1}}>Add Food</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Barcode Scanner ───
function BarcodeScanner({onResult,onClose}){
  const videoRef=useRef(null);
  const streamRef=useRef(null);
  const [status,setStatus]=useState("init"); // init, scanning, loading, found, error, unsupported
  const [product,setProduct]=useState(null);
  const [manualCode,setManualCode]=useState("");
  const scanningRef=useRef(false);

  const stopCam=useCallback(()=>{
    scanningRef.current=false;
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
  },[]);

  const lookupBarcode=useCallback(async(code)=>{
    setStatus("loading");
    try{
      const res=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      const data=await res.json();
      if(data.status===1&&data.product){
        const p=data.product;
        const n=p.nutriments||{};
        const name=p.product_name||p.product_name_en||"Unknown Product";
        const serving=p.serving_quantity||100;
        const prod={
          name:name.length>40?name.slice(0,37)+"...":name,
          brand:p.brands||"",
          cal:Math.round(n["energy-kcal_serving"]||n["energy-kcal_100g"]||0),
          protein:Math.round(n.proteins_serving||n.proteins_100g||0),
          carbs:Math.round(n.carbohydrates_serving||n.carbohydrates_100g||0),
          fat:Math.round(n.fat_serving||n.fat_100g||0),
          fiber:Math.round(n.fiber_serving||n.fiber_100g||0),
          serving:p.serving_size||`${serving}g`,
          barcode:code,
          image:p.image_small_url||null,
        };
        setProduct(prod);setStatus("found");
      }else{setStatus("error");}
    }catch(e){setStatus("error");}
  },[]);

  const startCam=useCallback(async()=>{
    if(!navigator.mediaDevices?.getUserMedia){setStatus("unsupported");return;}
    try{
      // Try rear camera, fallback to any camera
      let stream;
      try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});}
      catch(e1){try{stream=await navigator.mediaDevices.getUserMedia({video:true});}
        catch(e2){setStatus("unsupported");return;}}
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.setAttribute("playsinline","true");await videoRef.current.play().catch(()=>{});}
      setStatus("scanning");scanningRef.current=true;
      // Use BarcodeDetector if available (Chrome Android), otherwise camera stays open for visual ref
      if("BarcodeDetector" in window){
        try{
          const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39"]});
          const scan=async()=>{
            if(!scanningRef.current||!videoRef.current)return;
            try{
              const barcodes=await detector.detect(videoRef.current);
              if(barcodes.length>0){stopCam();lookupBarcode(barcodes[0].rawValue);return;}
            }catch(e){console.warn("Error:",e);}
            if(scanningRef.current)requestAnimationFrame(scan);
          };
          requestAnimationFrame(scan);
        }catch(e){/* BarcodeDetector failed, keep camera open with manual entry */}
      }
      // No else — camera stays open, user types barcode manually
    }catch(e){setStatus("unsupported");}
  },[stopCam,lookupBarcode]);

  useEffect(()=>{startCam();return stopCam;},[startCam,stopCam]);

  const addProduct=()=>{
    if(product){onResult({name:product.name+(product.brand?` (${product.brand})`:""),cal:product.cal,protein:product.protein,carbs:product.carbs,fat:product.fat});onClose();}
  };

  const manualLookup=()=>{if(manualCode.trim().length>=8)lookupBarcode(manualCode.trim());};

  return(
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.92)",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",flexShrink:0}}>
        <button onClick={()=>{stopCam();onClose();}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:V.accent}}>
          {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,fontWeight:600}}>Back</span>
        </button>
        <span style={{fontSize:15,fontWeight:700,color:V.text}}>Scan Barcode</span>
        <div style={{width:60}}/>
      </div>

      {/* Camera / Status */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 20px",gap:16}}>
        {(status==="init"||status==="scanning")&&(
          <div style={{position:"relative",width:"100%",maxWidth:320,aspectRatio:"4/3",borderRadius:16,overflow:"hidden",border:`2px solid ${V.accent}30`}}>
            <video ref={videoRef} playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            {/* Scan overlay */}
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:"70%",height:2,background:V.accent,opacity:0.7,boxShadow:`0 0 20px ${V.accent}`,
                animation:"scanLine 2s ease-in-out infinite"}}/>
            </div>
            <div style={{position:"absolute",inset:0,border:"2px solid transparent",
              borderImage:`linear-gradient(${V.accent},${V.accent2}) 1`,opacity:0.3}}/>
          </div>
        )}

        {status==="scanning"&&(
          <div style={{fontSize:12,color:V.text3,textAlign:"center"}}>
            {"BarcodeDetector" in window?"Point camera at barcode":"Camera open — read the barcode number and type it below"}
          </div>
        )}

        {status==="loading"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:20,border:`3px solid ${V.accent}30`,borderTopColor:V.accent,
              animation:"spin 0.8s linear infinite"}}/>
            <span style={{fontSize:13,color:V.text3}}>Looking up product...</span>
          </div>
        )}

        {status==="found"&&product&&(
          <div style={{width:"100%",maxWidth:340}}>
            <Card style={{padding:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                {product.image&&<img src={product.image} alt="" style={{width:48,height:48,borderRadius:10,objectFit:"cover",background:"rgba(255,255,255,0.05)"}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:V.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{product.name}</div>
                  {product.brand&&<div style={{fontSize:11,color:V.text3}}>{product.brand}</div>}
                  <div style={{fontSize:10,color:V.text3,marginTop:2}}>Per {product.serving}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[{l:"Cal",v:product.cal,c:V.warn},{l:"Protein",v:`${product.protein}g`,c:V.accent},
                  {l:"Carbs",v:`${product.carbs}g`,c:V.accent2},{l:"Fat",v:`${product.fat}g`,c:V.warn}].map(m=>(
                  <div key={m.l} style={{textAlign:"center",padding:"8px 4px",background:`${m.c}08`,borderRadius:8}}>
                    <div style={{fontSize:16,fontWeight:800,color:m.c,fontFamily:V.mono}}>{m.v}</div>
                    <div style={{fontSize:8,color:V.text3,fontWeight:600,textTransform:"uppercase",marginTop:2}}>{m.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn v="secondary" full onClick={()=>{setProduct(null);setStatus("init");startCam();}}>Scan Again</Btn>
                <Btn full onClick={addProduct}>{Icons.plus({size:14,color:V.bg})} Add</Btn>
              </div>
            </Card>
          </div>
        )}

        {status==="error"&&(
          <div style={{width:"100%",maxWidth:340}}>
            <Card style={{padding:16,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>🔍</div>
              <div style={{fontSize:14,fontWeight:700,color:V.text,marginBottom:4}}>Product Not Found</div>
              <div style={{fontSize:12,color:V.text3,marginBottom:12}}>This barcode isn't in the database. Try another product or enter nutrition manually.</div>
              <Btn v="secondary" full onClick={()=>{setProduct(null);setStatus("init");startCam();}}>Try Again</Btn>
            </Card>
          </div>
        )}

        {status==="unsupported"&&(
          <div style={{width:"100%",maxWidth:340}}>
            <Card style={{padding:16}}>
              <div style={{fontSize:14,fontWeight:700,color:V.text,marginBottom:8,textAlign:"center"}}>Enter Barcode Manually</div>
              <div style={{fontSize:11,color:V.text3,marginBottom:12,textAlign:"center"}}>Camera not available — this may be a permissions issue. Check your browser settings, or type the barcode number below.</div>
              <div style={{display:"flex",gap:8}}>
                <input value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="e.g. 049000042566"
                  inputMode="numeric" style={{flex:1,padding:"12px 14px",background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${V.cardBorder}`,borderRadius:12,color:V.text,fontSize:15,fontFamily:V.mono,
                    outline:"none",boxSizing:"border-box",minHeight:44}}/>
                <Btn onClick={manualLookup}>{Icons.search({size:16,color:V.bg})}</Btn>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Manual entry fallback always available */}
      {(status==="scanning"||status==="init")&&(
        <div style={{padding:"0 20px 24px",flexShrink:0}}>
          <div style={{display:"flex",gap:8}}>
            <input value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="Or type barcode..."
              inputMode="numeric" style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.04)",
                border:`1px solid ${V.cardBorder}`,borderRadius:10,color:V.text,fontSize:13,fontFamily:V.mono,
                outline:"none",boxSizing:"border-box",minHeight:40}}/>
            <button onClick={manualLookup} disabled={manualCode.trim().length<8} style={{padding:"10px 16px",borderRadius:10,border:"none",
              background:manualCode.trim().length>=8?V.accent:"rgba(255,255,255,0.04)",
              color:manualCode.trim().length>=8?V.bg:V.text3,fontWeight:700,fontSize:12,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
              Look Up
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanLine{0%,100%{transform:translateY(-30px);opacity:0.3}50%{transform:translateY(30px);opacity:0.9}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

// ─── Plate Calculator ───
function PlateCalc(){
  const [w,setW]=useState("");
  const plates=w?calcPlates(parseFloat(w)):null;
  return(
    <div>
      <Field label="Target Weight" type="number" value={w} onChange={setW} unit="lbs" placeholder="225"/>
      {plates&&<div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center",padding:"10px 0"}}>
        <div style={{fontSize:10,color:V.text3}}>Each side:</div>
        {plates.map((p,i)=>(
          <div key={i} style={{padding:"6px 10px",borderRadius:8,fontSize:13,fontWeight:700,fontFamily:V.mono,
            background:p>=45?`${V.accent}18`:p>=25?`${V.accent2}15`:p>=10?`${V.purple}15`:`${V.warn}15`,
            color:p>=45?V.accent:p>=25?V.accent2:p>=10?V.purple:V.warn}}>{p}</div>))}
      </div>}
      {w&&parseFloat(w)>45&&!plates&&<div style={{fontSize:12,color:V.danger,textAlign:"center",padding:8}}>Can't be loaded evenly</div>}
      {w&&parseFloat(w)<=45&&<div style={{fontSize:12,color:V.text3,textAlign:"center",padding:8}}>Just the bar (45 lbs)</div>}
    </div>
  );
}


export {
  ErrorBoundary, ConfirmDialog, UndoToast, SuccessToastCtrl, SuccessToast,
  validateWorkout, validateNutrition, validateBody, ValidationWarning,
  ExercisePicker, Card, Btn, Field, Progress, Sheet, Chip, Stat, chartCfg,
  YTBtn, Footer,
};
