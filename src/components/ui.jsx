import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { V } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from './Icons';
import { Undo } from '../utils/undo';
import { isCardio, wUnit } from '../utils/helpers';

// ─── #2 Confirm Dialog ───
function ConfirmDialog({msg,detail,onConfirm,onCancel}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)"}} onClick={onCancel}/>
      <div role="alertdialog" aria-modal="true" aria-label={msg} style={{position:"relative",background:V.sheetBg,
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

// ─── #2 Undo Toast — with countdown bar ───
function UndoToast({d}){
  const [item,setItem]=useState(null);
  const [remaining,setRemaining]=useState(0);
  const UNDO_DURATION=6000;
  useEffect(()=>{
    Undo._setItem=setItem;
    Undo._setRemaining=setRemaining;
    Undo._duration=UNDO_DURATION;
    return()=>{Undo._setItem=null;Undo._setRemaining=null;};
  },[]);
  // Tick the countdown bar down in real-time
  useEffect(()=>{
    if(!item||remaining<=0)return;
    const iv=setInterval(()=>setRemaining(r=>Math.max(0,r-100)),100);
    return()=>clearInterval(iv);
  },[item,remaining>0]);
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
  const pct=Math.round((remaining/UNDO_DURATION)*100);
  return ReactDOM.createPortal(
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:1500,
      minWidth:220,background:"rgba(30,30,50,0.95)",borderRadius:12,border:`1px solid ${V.cardBorder}`,
      overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px"}}>
        <span style={{fontSize:12,color:V.text}}>{item.label}</span>
        <button onClick={doUndo} style={{padding:"4px 12px",borderRadius:6,background:V.accent,border:"none",
          cursor:"pointer",fontSize:11,fontWeight:700,color:V.bg,fontFamily:V.font,marginLeft:"auto"}}>Undo</button>
      </div>
      <div style={{height:3,background:"rgba(255,255,255,0.06)"}}>
        <div style={{height:"100%",background:V.accent,width:`${pct}%`,transition:"width .1s linear"}}/>
      </div>
    </div>,
    document.body
  );
}

// ─── Global Confirm Controller — replaces browser confirm() ───
let _confirmSetState=null;
const ConfirmCtrl={
  show:(msg,detail,onConfirm)=>{if(_confirmSetState)_confirmSetState({msg,detail,onConfirm});},
  clear:()=>{if(_confirmSetState)_confirmSetState(null);},
};
function GlobalConfirm(){
  const [state,setState]=useState(null);
  useEffect(()=>{_confirmSetState=setState;return()=>{_confirmSetState=null;};},[]);
  if(!state)return null;
  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9995,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)"}} onClick={()=>ConfirmCtrl.clear()}/>
      <div role="alertdialog" aria-modal="true" aria-label={state.msg} style={{position:"relative",background:V.sheetBg,
        borderRadius:16,padding:24,maxWidth:320,width:"100%",border:`1px solid ${V.cardBorder}`}}>
        <div style={{fontSize:15,fontWeight:700,color:V.text,marginBottom:6}}>{state.msg}</div>
        {state.detail&&<div style={{fontSize:12,color:V.text3,lineHeight:1.5,marginBottom:16}}>{state.detail}</div>}
        <div style={{display:"flex",gap:10}}>
          <Btn v="secondary" full onClick={()=>ConfirmCtrl.clear()}>Cancel</Btn>
          <Btn full onClick={()=>{state.onConfirm();ConfirmCtrl.clear();}} s={{background:V.danger}}>Confirm</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Message Banner System (iMessage-style in-app notifications) ───
let _msgBannerQueue=[];
let _msgBannerTimer=null;
const MsgBannerCtrl={
  push:(msg)=>{
    _msgBannerQueue.push({...msg,id:Date.now()+Math.random(),ts:Date.now()});
    if(_msgBannerQueue.length>5)_msgBannerQueue=_msgBannerQueue.slice(-5);
  },
  pop:()=>{
    if(_msgBannerQueue.length===0)return null;
    const oldest=_msgBannerQueue[0];
    if(Date.now()-oldest.ts>5000){_msgBannerQueue.shift();return null;}
    return oldest;
  },
  dismiss:()=>{_msgBannerQueue.shift();},
  clear:()=>{_msgBannerQueue=[];},
};

function MessageBanner({onTap}){
  const [banner,setBanner]=useState(null);
  const [show,setShow]=useState(false);
  useEffect(()=>{
    const iv=setInterval(()=>{
      const msg=MsgBannerCtrl.pop();
      if(msg&&!banner){setBanner(msg);setShow(true);
        setTimeout(()=>{setShow(false);setTimeout(()=>{setBanner(null);MsgBannerCtrl.dismiss();},300);},4000);
      }
    },500);
    return()=>clearInterval(iv);
  },[banner]);
  if(!banner)return null;
  return ReactDOM.createPortal(
    <div onClick={()=>{if(onTap)onTap(banner);setShow(false);setTimeout(()=>{setBanner(null);MsgBannerCtrl.dismiss();},100);}}
      style={{position:"fixed",top:0,left:0,right:0,zIndex:9998,padding:"8px 16px",
        paddingTop:"max(12px, env(safe-area-inset-top, 8px))",
        background:"rgba(20,20,35,0.96)",backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${V.cardBorder}`,cursor:"pointer",
        transform:show?"translateY(0)":"translateY(-100%)",transition:"transform .3s ease",
        boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,
          background:banner.type==="group"?`linear-gradient(135deg,${V.purple},#ec4899)`:`linear-gradient(135deg,${V.accent},${V.accent2})`,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:14,color:V.bg,fontWeight:900}}>{(banner.name||"?")[0].toUpperCase()}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:700,color:V.text}}>{banner.name}</span>
            <span style={{fontSize:9,color:V.text3}}>now</span>
          </div>
          <div style={{fontSize:12,color:V.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {banner.type==="group"&&<span style={{color:V.purple,fontSize:10}}>#{banner.group} · </span>}
            {banner.text}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Success Toast System ───
let _successMsg=null;let _successTimer=null;
let _successSetState=null;
const SuccessToastCtrl={
  show:(msg)=>{if(_successTimer)clearTimeout(_successTimer);if(_successSetState)_successSetState({msg,ts:Date.now()});_successTimer=setTimeout(()=>{if(_successSetState)_successSetState(null);},2500);},
  dismiss:()=>{if(_successTimer)clearTimeout(_successTimer);if(_successSetState)_successSetState(null);},
};

function SuccessToast(){
  const [msg,setMsg]=useState(null);
  useEffect(()=>{
    _successSetState=setMsg;
    return()=>{_successSetState=null;};
  },[]);
  if(!msg)return null;
  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",zIndex:1500,
      padding:"10px 20px",background:"rgba(0,245,160,0.12)",borderRadius:12,border:`1px solid ${V.accent}30`,
      display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",
      backdropFilter:"blur(12px)",animation:"fadeInDown .25s ease-out"}}>
      <div style={{width:20,height:20,borderRadius:10,background:V.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{color:V.bg,fontSize:12,fontWeight:900}}>✓</span>
      </div>
      <span style={{fontSize:13,fontWeight:600,color:V.text}}>{msg.msg}</span>
    </div>,
    document.body
  );
}

// ─── #3 Pre-save Validation ───
function validateWorkout(w,s){
  const warnings=[];
  w.exercises.forEach(ex=>{
    const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
    const cardio=isCardio(ex.exerciseId,s.exercises);
    ex.sets.forEach(st=>{
      if(cardio){
        if(st.duration>300)warnings.push(`${name}: ${st.duration} min seems extremely long`);
      }else{
        if(st.weight>800)warnings.push(`${name}: ${st.weight} ${wUnit(s.units)} seems extremely high`);
        if(st.reps>100)warnings.push(`${name}: ${st.reps} reps seems high`);
      }
    });
  });
  // Duplicate check
  // Exclude the workout itself (by id) when checking for duplicates — editing path
  const dupes=s.workouts.filter(wk=>wk.id!==w.id&&wk.date===w.date&&wk.exercises.map(e=>e.exerciseId).sort().join(",")===w.exercises.map(e=>e.exerciseId).sort().join(","));
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
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.7)"}} onClick={onCancel}/>
      <div role="alertdialog" aria-modal="true" style={{position:"relative",background:V.sheetBg,
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
  <div onClick={onClick} {...(onClick?{role:"button",tabIndex:0}:{})} style={{background:glow?`${V.accent}08`:V.card,border:`1px solid ${glow?`${V.accent}25`:V.cardBorder}`,
    borderRadius:16,padding:16,transition:"background .2s, border-color .2s",...(onClick?{cursor:"pointer",WebkitTapHighlightColor:"transparent"}:{}),...s}}>
    {children}
  </div>
);

// #38: Skeleton loading placeholders
const Skeleton=({rows=3,h=14,gap=10})=>(
  <div style={{display:"flex",flexDirection:"column",gap}}>
    {Array.from({length:rows}).map((_,i)=>(
      <div key={i} style={{height:h,borderRadius:6,
        background:"linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)",
        backgroundSize:"400px 100%",animation:"shimmer 1.5s infinite linear"}}/>
    ))}
  </div>
);
const SkeletonCard=({lines=2})=>(
  <Card style={{padding:14}}>
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:lines>1?10:0}}>
      <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.03)",
        backgroundImage:"linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)",
        backgroundSize:"400px 100%",animation:"shimmer 1.5s infinite linear",flexShrink:0}}/>
      <div style={{flex:1}}><Skeleton rows={1} h={12}/></div>
    </div>
    {lines>1&&<Skeleton rows={lines-1} h={10} gap={6}/>}
  </Card>
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

// Sheet — portalled to document.body so iOS position:fixed works correctly
// (position:fixed inside -webkit-overflow-scrolling:touch is broken on iOS Safari)
const Sheet = ({title,onClose,children,footer}) => ReactDOM.createPortal(
  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9990,background:V.sheetBg,
    display:"flex",flexDirection:"column"}}
    role="dialog" aria-modal="true" aria-label={title}>
    {/* Header */}
    <div className="sheet-head" style={{flexShrink:0,display:"flex",alignItems:"center",gap:12,
      paddingLeft:16,paddingRight:16,paddingBottom:12,borderBottom:`1px solid ${V.cardBorder}`,background:V.sheetBg,zIndex:2}}>
      <button onClick={onClose} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",
        cursor:"pointer",padding:"8px 4px",WebkitTapHighlightColor:"transparent",flexShrink:0}}>
        {Icons.chevLeft({size:20,color:V.accent})}
        <span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
      </button>
      <h3 style={{margin:0,fontSize:16,color:V.text,fontFamily:V.font,fontWeight:700,flex:1,textAlign:"center",paddingRight:50}}>{title}</h3>
    </div>
    {/* Scrollable content — flex:1 + minHeight:0 is the correct flex scroll pattern */}
    <div style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",
      overscrollBehavior:"contain",padding:20}}>
      {children}
    </div>
    {/* Footer — part of the flex column, never overlaps content */}
    {footer&&<div className="sheet-footer" style={{background:V.sheetBg}}>{footer}</div>}
  </div>,
  document.body
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

export {
  validateWorkout,
  validateNutrition,
  validateBody,
  ValidationWarning,
  ExercisePicker,
  Card,
  Skeleton,
  SkeletonCard,
  Btn,
  Field,
  Progress,
  Sheet,
  Chip,
  Stat,
  ConfirmDialog,
  UndoToast,
  GlobalConfirm,
  ConfirmCtrl,
  MessageBanner,
  MsgBannerCtrl,
  SuccessToast,
  SuccessToastCtrl,
};
