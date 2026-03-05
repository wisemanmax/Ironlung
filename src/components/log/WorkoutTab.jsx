import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, ago, fmtShort, fmtFull, uid, fmtTimer } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl, ValidationWarning, ExercisePicker, YTBtn, validateWorkout } from '../shared/index.jsx';
import { wUnit, convW, calcPlates, PLATES } from '../../data/plates.js';
import { findLastSets } from '../../hooks/index.js';
import { TEMPLATES } from '../../data/templates.js';

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

// ─── Hooks ───
function useStreak(workouts){
  return useMemo(()=>{
    let streak=0;const d=new Date();
    if(!workouts.find(w=>w.date===today()))d.setDate(d.getDate()-1);
    while(true){const ds=d.toISOString().split("T")[0];
      if(workouts.find(w=>w.date===ds)){streak++;d.setDate(d.getDate()-1);}else break;}
    return streak;
  },[workouts]);
}
function usePRs(workouts,exercises){
  return useMemo(()=>{
    const prs={};
    workouts.forEach(w=>w.exercises.forEach(ex=>{
      const name=exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      ex.sets.forEach(s=>{const e1rm=calc1RM(s.weight,s.reps);
        if(s.weight>0&&(!prs[ex.exerciseId]||e1rm>prs[ex.exerciseId].e1rm))
          prs[ex.exerciseId]={weight:s.weight,reps:s.reps,e1rm,date:w.date,name};
      });
    }));
    return prs;
  },[workouts,exercises]);
}

// ─── Readiness Score Engine ───
function calcReadiness(s){
  const td=today();
  const checkin=(s.checkins||[]).find(c=>c.date===td);
  const tn=s.nutrition.find(n=>n.date===td)||s.nutrition.find(n=>n.date===ago(1));
  const lastW=s.workouts[0]; // most recent workout
  const recentW=s.workouts.filter(w=>w.date>=ago(7));
  const prevWeekW=s.workouts.filter(w=>w.date>=ago(14)&&w.date<ago(7));

  let score=50; // baseline
  const factors=[];

  // 1. Sleep quality (0-25 pts) — from nutrition log or check-in
  const sleep=checkin?.sleep||tn?.sleep||0;
  if(sleep>0){
    if(sleep>=7.5){score+=25;factors.push({label:"Great sleep",val:`${sleep.toFixed(1)}h`,color:V.accent,pts:25});}
    else if(sleep>=6.5){score+=18;factors.push({label:"Decent sleep",val:`${sleep.toFixed(1)}h`,color:V.warn,pts:18});}
    else if(sleep>=5){score+=8;factors.push({label:"Low sleep",val:`${sleep.toFixed(1)}h`,color:V.danger,pts:8});}
    else{score+=0;factors.push({label:"Poor sleep",val:`${sleep.toFixed(1)}h`,color:V.danger,pts:0});}
  }

  // 2. Recovery time (0-15 pts) — days since last workout
  if(lastW){
    const daysSince=Math.floor((new Date(td)-new Date(lastW.date))/(86400000));
    if(daysSince===0){score+=5;factors.push({label:"Trained today",val:"0d rest",color:V.text3,pts:5});}
    else if(daysSince===1){score+=12;factors.push({label:"1 day rest",val:"Fresh",color:V.accent,pts:12});}
    else if(daysSince===2){score+=15;factors.push({label:"2 days rest",val:"Recovered",color:V.accent,pts:15});}
    else if(daysSince<=4){score+=10;factors.push({label:`${daysSince}d rest`,val:"Rested",color:V.accent2,pts:10});}
    else{score+=5;factors.push({label:`${daysSince}d rest`,val:"Detraining",color:V.warn,pts:5});}
  }

  // 3. Last workout intensity (0-10 pts) — lower intensity = more recovery
  if(lastW){
    const avgRPE=lastW.exercises.reduce((sum,ex)=>{
      const rpes=ex.sets.filter(st=>st.rpe).map(st=>st.rpe);
      return sum+(rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:7);
    },0)/(lastW.exercises.length||1);
    if(avgRPE<=7){score+=10;factors.push({label:"Low last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.accent,pts:10});}
    else if(avgRPE<=8.5){score+=6;factors.push({label:"Moderate intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.warn,pts:6});}
    else{score+=2;factors.push({label:"High last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.danger,pts:2});}
  }

  // 4. Training volume trend (-10 to +10) — overreaching detection
  if(recentW.length>0&&prevWeekW.length>0){
    const thisVol=recentW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const lastVol=prevWeekW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const ratio=lastVol>0?thisVol/lastVol:1;
    if(ratio>1.3){score-=10;factors.push({label:"Volume spike",val:`+${Math.round((ratio-1)*100)}%`,color:V.danger,pts:-10});}
    else if(ratio>1.1){score-=3;factors.push({label:"Volume up",val:`+${Math.round((ratio-1)*100)}%`,color:V.warn,pts:-3});}
    else if(ratio>=0.8){score+=5;factors.push({label:"Steady volume",val:"Balanced",color:V.accent,pts:5});}
    else{score+=0;factors.push({label:"Low volume",val:`${Math.round((ratio-1)*100)}%`,color:V.text3,pts:0});}
  }

  // 5. Self-report from check-in (0-20 pts)
  if(checkin){
    const avg=(checkin.soreness+checkin.energy+checkin.motivation)/3;
    const pts=Math.round(avg*4); // 1-5 scale → 4-20 pts
    score+=pts;
    const labels=["","Rough","Fair","Okay","Good","Excellent"];
    factors.push({label:"Self-report",val:labels[Math.round(avg)]||"--",color:avg>=4?V.accent:avg>=3?V.warn:V.danger,pts});
  }

  // 6. Nutrition adherence (+5 bonus)
  if(tn&&s.goals){
    const protPct=tn.protein/s.goals.protein;
    if(protPct>=0.8){score+=5;factors.push({label:"Protein on track",val:`${Math.round(protPct*100)}%`,color:V.accent,pts:5});}
  }

  score=Math.max(0,Math.min(100,score));

  // Determine readiness level + recommendation
  let level,color,rec;
  if(score>=80){level="Peak";color=V.accent;rec="Full intensity. Push for PRs.";}
  else if(score>=60){level="Ready";color=V.accent2;rec="Normal training. Follow your program.";}
  else if(score>=40){level="Moderate";color=V.warn;rec="Reduce volume 15-20%. Focus on technique.";}
  else if(score>=25){level="Fatigued";color="#f97316";rec="Light session or active recovery.";}
  else{level="Rest";color=V.danger;rec="Take a rest day. Recovery is gains.";}

  return{score:Math.round(score),level,color,rec,factors,hasCheckin:!!checkin};
}

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
function WorkoutTab({s,d}){
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
  const cats=["All",...new Set(s.exercises.map(e=>e.cat))];
  const prs=usePRs(s.workouts,s.exercises);

  // Live workout timer
  useEffect(()=>{
    if(!startTime)return;
    const iv=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000);
    return()=>clearInterval(iv);
  },[startTime]);

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
    const exs=last.exercises.map(ex=>({
      exerciseId:ex.exerciseId,
      sets:ex.sets.map(st=>({weight:st.weight.toString(),reps:st.reps.toString(),rpe:st.rpe?st.rpe.toString():"",done:true}))
    }));
    setForm({date:today(),dur:"",exercises:exs,notes:"",rating:3});
    setNewPRs([]);setStartTime(Date.now());setElapsed(0);setShow(true);
  };

  const loadTemplate=(t)=>{
    // Pre-fill weights from last time each exercise was done
    const exs=t.exs.map(eid=>{
      const lastW=findLastSets(eid,s.workouts);
      return{exerciseId:eid,sets:lastW||[{weight:"",reps:"",rpe:"",done:true}]};
    });
    setForm(f=>({...f,exercises:exs}));
    setShowTemplates(false);setStartTime(Date.now());setElapsed(0);setShow(true);
  };

  const addEx=()=>{
    if(!selEx)return;
    // Auto-fill from last workout
    const lastW=findLastSets(selEx,s.workouts);
    setForm(f=>({...f,exercises:[...f.exercises,{exerciseId:selEx,sets:lastW||[{weight:"",reps:"",rpe:"",done:true}]}]}));
    setSelEx("");
  };
  const addSet=(ei)=>{setForm(f=>{const exs=[...f.exercises];const l=exs[ei].sets[exs[ei].sets.length-1];exs[ei]={...exs[ei],sets:[...exs[ei].sets,{weight:l.weight,reps:l.reps,rpe:l.rpe,done:true}]};return{...f,exercises:exs};});};
  const updSet=(ei,si,k,v)=>{setForm(f=>{const exs=[...f.exercises],sets=[...exs[ei].sets];sets[si]={...sets[si],[k]:v};exs[ei]={...exs[ei],sets};return{...f,exercises:exs};});};
  const rmSet=(ei,si)=>setForm(f=>{const exs=[...f.exercises];exs[ei]={...exs[ei],sets:exs[ei].sets.filter((_,i)=>i!==si)};return{...f,exercises:exs};});
  const rmEx=(ei)=>setForm(f=>({...f,exercises:f.exercises.filter((_,i)=>i!==ei)}));

  const buildWorkout=()=>{
    const dur=parseInt(form.dur)||Math.round(elapsed/60)||0;
    return{id:editingId||uid(),date:form.date,dur,rating:form.rating,
      exercises:form.exercises.map(e=>({...e,sets:e.sets.map(st=>({weight:parseFloat(st.weight)||0,reps:parseInt(st.reps)||0,rpe:parseFloat(st.rpe)||0,done:st.done}))})),
      notes:form.notes};
  };
  const save=()=>{
    const w=buildWorkout();
    const warnings=validateWorkout(w,s);
    if(warnings.length>0&&!valWarnings){setValWarnings(warnings);return;}
    setValWarnings(null);
    const detected=[];
    w.exercises.forEach(ex=>{
      const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      ex.sets.forEach(st=>{const e1rm=calc1RM(st.weight,st.reps);const prev=prs[ex.exerciseId];
        if(st.weight>0&&(!prev||e1rm>prev.e1rm))detected.push({name,weight:st.weight,reps:st.reps,e1rm});});});
    setNewPRs(detected);
    if(editingId){d({type:"EDIT_W",w});setEditingId(null);SuccessToastCtrl.show("Workout updated");}
    else{d({type:"ADD_W",w});SuccessToastCtrl.show("Workout logged");
      if(s.profile?.email){const exNames=w.exercises.map(e=>s.exercises.find(x=>x.id===e.exerciseId)?.name||e.exerciseId);
        SocialAPI.logEvent(s.profile.email,"WorkoutLogged",{exercises:exNames,sets:w.exercises.reduce((a,e)=>a+e.sets.length,0)},
          (LS.get("ft-privacy")||{}).workouts?"friends":"private").catch(()=>{});
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
        <Btn full onClick={()=>{setNewPRs([]);setShow(false);}}>Done</Btn>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8}}>
        <Btn full onClick={startNew}>{Icons.plus({size:16,color:V.bg})} New Workout</Btn>
        {s.workouts.length>0&&<Btn v="secondary" onClick={repeatLast} s={{flexShrink:0,fontSize:11}}>{Icons.refresh({size:14,color:V.text2})} Repeat</Btn>}
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
          </div>

          {form.exercises.map((ex,ei)=>{
            const info=s.exercises.find(e=>e.id===ex.exerciseId);
            const pb=prevBest(ex.exerciseId);
            return(
              <div key={ei} style={{marginBottom:14,padding:14,background:"rgba(255,255,255,0.02)",borderRadius:14,border:`1px solid ${V.cardBorder}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                    <span style={{fontSize:14,color:V.text,fontWeight:700}}>{info?.name}</span>
                    <YTBtn yt={info?.yt} size={24}/>
                    {pb&&<span style={{fontSize:10,color:V.text3}}>PR:{pb}</span>}
                  </div>
                  <button onClick={()=>rmEx(ei)} aria-label="Remove exercise" style={{background:"none",border:"none",padding:8,cursor:"pointer"}}>{Icons.trash({size:14,color:V.text3})}</button>
                </div>
                {(()=>{const sug=getOverloadSuggestion(ex.exerciseId,s.workouts,s.units);return sug?(
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
                <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 28px",gap:4,marginBottom:6}}>
                  <span style={{fontSize:9,color:V.text3,textAlign:"center"}}>#</span>
                  <span style={{fontSize:9,color:V.text3}}>{wUnit(s.units).toUpperCase()}</span><span style={{fontSize:9,color:V.text3}}>REPS</span>
                  <span style={{fontSize:9,color:V.text3}}>RPE</span><span/>
                </div>
                {ex.sets.map((st,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 28px",gap:4,marginBottom:4,alignItems:"center"}}>
                    <span style={{fontSize:12,color:V.text3,textAlign:"center",fontFamily:V.mono}}>{si+1}</span>
                    {["weight","reps","rpe"].map(k=>(
                      <input key={k} type="number" inputMode="decimal" value={st[k]} onChange={e=>updSet(ei,si,k,e.target.value)}
                        placeholder="0" style={{padding:"10px 8px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.05)`,
                          borderRadius:10,color:V.text,fontSize:15,fontFamily:V.mono,outline:"none",width:"100%",
                          boxSizing:"border-box",textAlign:"center",minHeight:40,WebkitAppearance:"none"}}/>
                    ))}
                    <button onClick={()=>rmSet(ei,si)} disabled={ex.sets.length<=1}
                      style={{background:"none",border:"none",padding:4,cursor:ex.sets.length<=1?"default":"pointer",opacity:ex.sets.length<=1?.2:1}}>
                      {Icons.x({size:13,color:V.text3})}</button>
                  </div>
                ))}
                <Btn v="small" onClick={()=>addSet(ei)} s={{marginTop:8,width:"100%"}}>{Icons.plus({size:13,color:V.accent})} Add Set</Btn>
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

      {/* History */}
      {s.workouts.length===0?(
        <div style={{textAlign:"center",padding:40,color:V.text3,fontSize:13}}>No workouts yet</div>
      ):s.workouts.slice(0,showAll?999:15).map(w=>{
        const vol=w.exercises.reduce((s2,e)=>s2+e.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0);
        const expanded=expandedId===w.id;
        return(
          <Card key={w.id} onClick={()=>setExpandedId(expanded?null:w.id)} style={{padding:14,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,color:V.text2}}>{fmtFull(w.date)}</span>
                {w.rating&&<span style={{fontSize:8,color:V.warn}}>{Array.from({length:w.rating}).map(()=>"★").join("")}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:10,color:V.text3}}>{w.dur}min</span>
                <button onClick={e=>{e.stopPropagation();setEditingId(w.id);setForm({date:w.date,dur:w.dur?.toString()||"",exercises:w.exercises,notes:w.notes||"",rating:w.rating||3});setShow(true);}}
                  aria-label="Edit workout" style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.edit?.({size:12,color:V.text3})||<span style={{fontSize:10,color:V.text3}}>✏️</span>}</button>
                <button onClick={e=>{e.stopPropagation();setConfirmDel(w);}} aria-label="Delete workout"
                  style={{background:"none",border:"none",padding:4,cursor:"pointer"}}>{Icons.trash({size:12,color:V.text3})}</button>
              </div>
            </div>
            {w.exercises.map((ex,i)=>{
              const exInfo=s.exercises.find(e=>e.id===ex.exerciseId);
              const top=ex.sets.reduce((m,st)=>st.weight>m.weight?st:m,{weight:0,reps:0});
              return(
                <div key={i}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",
                    borderBottom:i<w.exercises.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:12,color:V.text}}>{exInfo?.name||ex.exerciseId}</span>
                      <YTBtn yt={exInfo?.yt} size={18}/>
                    </div>
                    <span style={{fontSize:11,color:V.accent,fontFamily:V.mono}}>{top.weight}×{top.reps} · {ex.sets.length}s</span>
                  </div>
                  {/* #7 Expanded detail: all sets */}
                  {expanded&&(
                    <div style={{padding:"4px 0 8px 12px"}}>
                      {ex.sets.map((st,si)=>(
                        <div key={si} style={{display:"flex",gap:8,fontSize:10,color:V.text3,padding:"2px 0"}}>
                          <span>Set {si+1}:</span>
                          <span style={{color:V.accent,fontFamily:V.mono}}>{st.weight}×{st.reps}</span>
                          {st.rpe>0&&<span>RPE {st.rpe}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{marginTop:4,fontSize:11,color:V.accent2,fontFamily:V.mono,textAlign:"right"}}>{vol.toLocaleString()} {wUnit(s.units)}</div>
            {expanded&&w.notes&&<div style={{fontSize:10,color:V.text3,fontStyle:"italic",marginTop:4}}>{w.notes}</div>}
          </Card>
        );
      })}
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

export { WorkoutTab };
export default WorkoutTab;
