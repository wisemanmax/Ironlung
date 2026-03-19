import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from './Icons';
import { Card, Btn, Field, Sheet, Chip, Progress } from './ui';
import { FOODS, FOOD_CATS } from '../data/foods';
import { PLATES, calcPlates, fmtTimer, today, ago, toKg, toLbs, wUnit, convW } from '../utils/helpers';

export function RestTimer(){
  const [active,setActive]=useState(false);
  const [secs,setSecs]=useState(90);
  const [rem,setRem]=useState(90);
  const [autoStart,setAutoStart]=useState(LS.get("ft-auto-rest")!==false);
  const iRef=useRef(null);
  const start=()=>{setRem(secs);setActive(true);};
  const stop=()=>{setActive(false);clearInterval(iRef.current);};
  // Register auto-start callback
  useEffect(()=>{RestTimerCtrl.register(()=>{if(autoStart&&!active){setRem(secs);setActive(true);}});},[autoStart,active,secs]);
  useEffect(()=>{
    if(active&&rem>0){
      iRef.current=setInterval(()=>setRem(r=>{if(r<=1){setActive(false);Haptic.heavy();return 0;}return r-1;}),1000);
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
          <span style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:700,color:rem===0?V.danger:V.text,fontFamily:V.mono}}>{fmtTimer(active?rem:secs)}</span>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
        {rem===0&&!active&&<div style={{fontSize:12,fontWeight:700,color:V.danger}}>REST COMPLETE — GO!</div>}
        <button onClick={()=>{const nv=!autoStart;setAutoStart(nv);LS.set("ft-auto-rest",nv);SuccessToastCtrl.show(nv?"Auto-start ON":"Auto-start OFF");}}
          style={{marginLeft:"auto",padding:"3px 8px",borderRadius:5,background:autoStart?`${V.accent}10`:"rgba(255,255,255,0.03)",
            border:`1px solid ${autoStart?V.accent+"20":V.cardBorder}`,cursor:"pointer",
            fontSize:8,fontWeight:600,color:autoStart?V.accent:V.text3,fontFamily:V.font}}>AUTO {autoStart?"ON":"OFF"}</button>
      </div>
    </div>
  );
}

// ─── Food Search ───
export function FoodSearch({onAdd}){
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
    // Save to recent foods
    const recent=LS.get("ft-recent-foods")||[];
    const updated=[food.n,...recent.filter(n=>n!==food.n)].slice(0,12);
    LS.set("ft-recent-foods",updated);
  };
  const recentFoods=(LS.get("ft-recent-foods")||[]).map(name=>FOODS.find(f=>f.n===name)).filter(Boolean);
  const addCustomFood=()=>{
    if(!custom.name.trim()||!custom.cal)return;
    onAdd({name:custom.name.trim(),cal:parseInt(custom.cal)||0,protein:parseInt(custom.protein)||0,
      carbs:parseInt(custom.carbs)||0,fat:parseInt(custom.fat)||0});
    // Save custom to recent
    const recent=LS.get("ft-recent-foods")||[];
    LS.set("ft-recent-foods",[custom.name.trim(),...recent.filter(n=>n!==custom.name.trim())].slice(0,12));
    setCustom({name:"",cal:"",protein:"",carbs:"",fat:""});setShowCustom(false);
  };
  return(
    <div>
      {/* Recent foods quick-add */}
      {recentFoods.length>0&&!q&&(
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:V.text3,marginBottom:6}}>RECENT</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {recentFoods.slice(0,8).map((food,i)=>(
              <button key={i} onClick={()=>addItem(food)} style={{padding:"6px 10px",borderRadius:8,
                background:`${V.accent}08`,border:`1px solid ${V.accent}15`,cursor:"pointer",
                fontSize:11,color:V.text,fontFamily:V.font,display:"flex",alignItems:"center",gap:4}}>
                <span>{food.n.split("(")[0].trim()}</span>
                <span style={{fontSize:9,color:V.accent,fontWeight:700}}>{food.cal}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
export function BarcodeScanner({onResult,onClose}){
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
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:1100,background:"rgba(0,0,0,0.92)",display:"flex",flexDirection:"column"}}>
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
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:"70%",height:2,background:V.accent,opacity:0.7,boxShadow:`0 0 20px ${V.accent}`,
                animation:"scanLine 2s ease-in-out infinite"}}/>
            </div>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,border:"2px solid transparent",
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
export function PlateCalc(){
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
export function useStreak(workouts){
  return useMemo(()=>{
    let streak=0;const d=new Date();
    if(!workouts.find(w=>w.date===today()))d.setDate(d.getDate()-1);
    while(true){const ds=d.toISOString().split("T")[0];
      if(workouts.find(w=>w.date===ds)){streak++;d.setDate(d.getDate()-1);}else break;}
    return streak;
  },[workouts]);
}
export function usePRs(workouts,exercises){
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

// ─── Nutrition streak (consecutive days with a log) ───
export function useNutritionStreak(nutrition){
  return useMemo(()=>{
    let c=0;
    const base=(nutrition||[]).some(n=>n.date===today())?0:1;
    for(let i=base;i<365;i++){
      if((nutrition||[]).some(n=>n.date===ago(i)))c++;
      else break;
    }
    return c;
  },[nutrition]);
}

// ─── Find last sets for an exercise (for auto-fill) ───
export function findLastSets(exerciseId,workouts,exercises){
  for(const w of workouts){
    const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
    if(ex&&ex.sets.length>0){
      if(isCardio(exerciseId,exercises||[])){
        return ex.sets.map(st=>({duration:(st.duration||"").toString(),distance:(st.distance||"").toString(),rpe:st.rpe?st.rpe.toString():"",done:true}));
      }
      return ex.sets.map(st=>({weight:st.weight.toString(),reps:st.reps.toString(),rpe:st.rpe?st.rpe.toString():"",done:true}));
    }
  }
  return null;
}

// ─── Readiness Score Engine ───
export function calcReadiness(s){
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
  if(lastW&&(lastW.exercises||[]).length>0){
    const avgRPE=(lastW.exercises||[]).reduce((sum,ex)=>{
      const rpes=(ex.sets||[]).filter(st=>st.rpe).map(st=>st.rpe);
      return sum+(rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:7);
    },0)/((lastW.exercises||[]).length||1);
    if(avgRPE<=7){score+=10;factors.push({label:"Low last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.accent,pts:10});}
    else if(avgRPE<=8.5){score+=6;factors.push({label:"Moderate intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.warn,pts:6});}
    else{score+=2;factors.push({label:"High last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.danger,pts:2});}
  }

  // 4. Training volume trend (-10 to +10) — overreaching detection
  if(recentW.length>0&&prevWeekW.length>0){
    const thisVol=recentW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0);
    const lastVol=prevWeekW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0);
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
export function CheckinModal({s,d,onClose}){
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
    Haptic.light();SuccessToastCtrl.show("Check-in logged +5 XP ✅");
    const fullCheckin={date:today(),soreness,energy,motivation,sleep:parseFloat(sleep)||0,notes};
    setTimeout(()=>checkAndAwardMissions({...s,checkins:[fullCheckin,...(s.checkins||[])]},d),400);
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
export function ReadinessCard({s,d}){
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
            {/* Quick action nudges for missing data */}
            {(()=>{
              const actions=[];
              const hasTodayNutr=s.nutrition.some(n=>n.date===today());
              const hasTodayWeight=(s.body||[]).some(b=>b.date===today()&&b.weight);
              if(!hasTodayNutr)actions.push({label:"Log Meal",tab:"log_nutrition",color:V.warn});
              if(!hasTodayWeight&&r.score<70)actions.push({label:"Weigh In",tab:"track_body",color:V.accent2});
              if(actions.length===0)return null;
              return(
                <div style={{display:"flex",gap:4,marginTop:4}}>
                  {actions.map(a=>(
                    <button key={a.tab} onClick={()=>d({type:"TAB",tab:a.tab})} style={{
                      padding:"3px 8px",borderRadius:6,background:`${a.color}10`,
                      border:`1px solid ${a.color}20`,cursor:"pointer",fontSize:9,
                      fontWeight:700,color:a.color,fontFamily:V.font}}>+ {a.label}</button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </Card>

      {/* Action tip based on readiness score */}
      {(()=>{
        if(r.score>=80)return(
          <div style={{marginTop:8,padding:"8px 12px",borderRadius:10,
            background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.15)",
            display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
            onClick={()=>d&&d({type:"TAB",tab:"log_workout"})}>
            <span style={{fontSize:16}}>💪</span>
            <span style={{fontSize:11,color:"#22c55e",fontWeight:700}}>Feeling great — great day for a heavy session</span>
            <span style={{fontSize:12,color:"#22c55e",marginLeft:"auto"}}>→</span>
          </div>
        );
        if(r.score<50)return(
          <div style={{marginTop:8,padding:"8px 12px",borderRadius:10,
            background:"rgba(244,63,94,0.08)",border:"1px solid rgba(244,63,94,0.15)",
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>😴</span>
            <span style={{fontSize:11,color:"#f43f5e",fontWeight:700}}>Low readiness — consider rest or light stretching today</span>
          </div>
        );
        return null;
      })()}
      {showCheckin&&<CheckinModal s={s} d={d} onClose={()=>setShowCheckin(false)}/>}
    </div>
  );
}

// ─── Readiness Trend (Track Hub) ───
// ── T3 #20: Sleep-to-Performance Correlation Card ──
export function SleepPerformanceCard({s}){
  const data=useMemo(()=>{
    // For each workout day in last 30d, find the prior-night sleep
    const pts=[];
    s.workouts.filter(w=>w.date>=ago(29)).forEach(w=>{
      // Prior night sleep: check checkin on same day or nutrition log
      const checkin=(s.checkins||[]).find(c=>c.date===w.date);
      const nutr=s.nutrition.find(n=>n.date===w.date);
      const sleep=parseFloat(checkin?.sleep||nutr?.sleep||0);
      if(sleep<3)return; // skip no-data days
      // Session volume
      const vol=Math.round(w.exercises.reduce((a,e)=>a+e.sets.reduce((b,st)=>b+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0));
      if(vol===0)return;
      pts.push({date:w.date,sleep,vol});
    });
    return pts;
  },[s.workouts,s.checkins,s.nutrition]);

  if(data.length<4)return null;

  // Bucket by sleep quality
  const poor=data.filter(p=>p.sleep<6);
  const ok=data.filter(p=>p.sleep>=6&&p.sleep<7.5);
  const good=data.filter(p=>p.sleep>=7.5);
  const avg=(arr)=>arr.length?Math.round(arr.reduce((a,p)=>a+p.vol,0)/arr.length):0;
  const poorAvg=avg(poor), okAvg=avg(ok), goodAvg=avg(good);

  // Insight text
  const maxBucket=[{l:"<6h",v:poorAvg,n:poor.length},{l:"6-7.5h",v:okAvg,n:ok.length},{l:"7.5h+",v:goodAvg,n:good.length}]
    .filter(b=>b.n>=2).sort((a,b)=>b.v-a.v);
  if(maxBucket.length<2)return null;
  const best=maxBucket[0], worst=maxBucket[maxBucket.length-1];
  const diff=best.v>0&&worst.v>0?Math.round((best.v-worst.v)/worst.v*100):0;
  const insight=diff>10
    ?`You lift ~${diff}% more volume after ${best.l} sleep vs ${worst.l}`
    :"Sleep quality has minimal impact on your volume — nice consistency";

  const bars=[
    {label:"<6h",avg:poorAvg,count:poor.length,color:"#f43f5e"},
    {label:"6–7.5h",avg:okAvg,count:ok.length,color:"#f59e0b"},
    {label:"7.5h+",avg:goodAvg,count:good.length,color:"#22c55e"},
  ].filter(b=>b.count>0);
  const maxVol=Math.max(...bars.map(b=>b.avg),1);

  return(
    <div style={{padding:"12px 14px",borderRadius:12,
      background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)"}}>
      <div style={{fontSize:11,fontWeight:700,color:V.purple,textTransform:"uppercase",letterSpacing:".06em",marginBottom:9}}>
        😴 Sleep vs Performance
      </div>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:10,height:60}}>
        {bars.map(bar=>{
          const h=bar.avg>0?Math.max(10,Math.round(bar.avg/maxVol*56)):8;
          return(
            <div key={bar.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{fontSize:8,color:bar.color,fontWeight:700,fontFamily:"monospace"}}>
                {bar.avg>=10000?(bar.avg/1000).toFixed(1)+"k":bar.avg>0?bar.avg:"—"}
              </div>
              <div style={{width:"100%",height:h,borderRadius:4,background:bar.avg>0?bar.color+"55":"rgba(255,255,255,0.06)",
                border:`1px solid ${bar.color}40`,transition:"height .4s ease"}}/>
              <div style={{fontSize:8,color:V.text3}}>{bar.label}</div>
              <div style={{fontSize:7,color:V.text3,opacity:0.6}}>{bar.count}d</div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:10,color:V.text2,lineHeight:1.5,padding:"7px 9px",
        background:"rgba(255,255,255,0.03)",borderRadius:8}}>
        💡 {insight}
      </div>
    </div>
  );
}

export function ReadinessTrend({s}){
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
                <ReferenceLine y={60} stroke={V.warn} strokeDasharray="3 3" strokeOpacity={0.4}/>
              </Recharts.AreaChart>
            </Recharts.ResponsiveContainer>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:6}}>
            <span style={{fontSize:9,color:V.text3}}>Above 60 = ready to train</span>
            <span style={{fontSize:9,color:V.warn}}>- - threshold</span>
          </div>
        </Card>
      )}

      {/* ── T3 #20: Sleep vs Performance card ── */}
      <SleepPerformanceCard s={s}/>

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
