import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, ago, fmtShort, fmtFull, uid, calc1RM, Undo, SYNC_URL } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl, YTBtn } from '../shared/index.jsx';
import { wUnit, convW } from '../../data/plates.js';
import { MUSCLE_MAP, ALL_MUSCLES, MUSCLE_LABELS } from '../../data/muscles.js';
import { usePRs, useStreak } from '../../hooks/index.js';

// ─── 1RM Calculator Standalone ───
function OneRMCalc({units}){
  const [w,setW]=useState("");
  const [r,setR]=useState("");
  const e1rm=w&&r?calc1RM(parseFloat(w),parseInt(r)):0;
  const pcts=[100,95,90,85,80,75,70,65,60];
  const u=wUnit(units);
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <Field label={`Weight (${u})`} type="number" value={w} onChange={setW} placeholder="225"/>
        <Field label="Reps" type="number" value={r} onChange={setR} placeholder="5"/>
      </div>
      {e1rm>0&&(
        <div>
          <div style={{textAlign:"center",padding:16,background:`${V.accent}08`,borderRadius:14,marginBottom:14}}>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em"}}>Estimated 1RM</div>
            <div style={{fontSize:32,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{e1rm}<span style={{fontSize:14}}> {u}</span></div>
          </div>
          <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8,fontWeight:600}}>Percentage Chart</div>
          {pcts.map(p=>{
            const val=Math.round(e1rm*p/100);
            const reps=p===100?1:p>=95?2:p>=90?3:p>=85?5:p>=80?6:p>=75?8:p>=70?10:p>=65?12:15;
            return(
              <div key={p} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <span style={{width:36,fontSize:12,color:V.accent,fontFamily:V.mono,fontWeight:700}}>{p}%</span>
                <div style={{flex:1,height:6,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                  <div style={{width:`${p}%`,height:"100%",borderRadius:3,background:V.accent,opacity:0.5}}/>
                </div>
                <span style={{fontSize:13,color:V.text,fontFamily:V.mono,fontWeight:600,minWidth:50,textAlign:"right"}}>{val} {u}</span>
                <span style={{fontSize:10,color:V.text3,minWidth:30}}>~{reps}r</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Progress Photos ───
// ─── Image Compression Utility ───
function compressImage(file,maxDim=800,quality=0.7){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){
        if(w>h){h=Math.round(h*(maxDim/w));w=maxDim;}
        else{w=Math.round(w*(maxDim/h));h=maxDim;}
      }
      const canvas=document.createElement("canvas");
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img,0,0,w,h);
      const compressed=canvas.toDataURL("image/jpeg",quality);
      resolve(compressed);
    };
    img.onerror=()=>resolve(null);
    img.src=URL.createObjectURL(file);
  });
}

function ProgressPhotos({s,d}){
  const fileRef=useRef(null);
  const [compressing,setCompressing]=useState(false);
  const [vaultLocked,setVaultLocked]=useState(true);
  const [pinInput,setPinInput]=useState("");
  const [showSetPin,setShowSetPin]=useState(false);
  const [newPin,setNewPin]=useState("");
  const [tab,setTab]=useState("public"); // public | vault

  const vaultPin=LS.get("ft-vault-pin");
  const hasVault=!!vaultPin;

  const unlockVault=()=>{
    if(pinInput===vaultPin){setVaultLocked(false);setPinInput("");SuccessToastCtrl.show("Vault unlocked");}
    else{SuccessToastCtrl.show("Wrong PIN");setPinInput("");}
  };
  const setupPin=()=>{
    if(newPin.length>=4){
      LS.set("ft-vault-pin",newPin);setNewPin("");setShowSetPin(false);
      SuccessToastCtrl.show("Vault PIN set");
      // Sync PIN to server immediately
      CloudSync.debouncedPush({...s});
    }
  };

  const handlePhoto=async(e,isPrivate)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setCompressing(true);
    const isVideo=file.type.startsWith("video/");

    if(isVideo){
      // Store video as blob URL (local only — too large for base64 sync)
      const reader=new FileReader();
      reader.onload=(ev)=>{
        const entry={id:uid(),date:today(),data:ev.target.result,note:"",
          size:file.size,original:file.name,private:!!isPrivate,type:"video",mime:file.type};
        d({type:"ADD_PHOTO",photo:entry});
        SuccessToastCtrl.show(isPrivate?"Video saved to vault (local only)":"Video saved (local only — won't sync to cloud)");
        setCompressing(false);
      };
      // Only store videos under 50MB
      if(file.size>50*1024*1024){SuccessToastCtrl.show("Video too large (max 50MB)");setCompressing(false);e.target.value="";return;}
      reader.readAsDataURL(file);
    }else{
      const compressed=await compressImage(file,800,0.7);
      if(compressed){
        const photo={id:uid(),date:today(),data:compressed,note:"",
          size:compressed.length,original:file.name,private:!!isPrivate,type:"photo"};
        d({type:"ADD_PHOTO",photo});
        if(s.profile?.email){
          try{
            await fetch(`${SYNC_URL}/api/photos/upload`,{
              method:"POST",headers:AuthToken.getHeaders(s.profile.email),
              body:JSON.stringify({email:s.profile.email,photoId:photo.id,date:photo.date,
                data:compressed,private:!!isPrivate})
            });
          }catch(e2){console.warn("Photo upload failed:",e2);}
        }
        SuccessToastCtrl.show(isPrivate?"Photo saved to vault":"Photo saved");
      }
      setCompressing(false);
    }
    e.target.value="";
  };

  const publicPhotos=(s.photos||[]).filter(p=>!p.private);
  const vaultPhotos=(s.photos||[]).filter(p=>p.private);

  const [viewPhoto,setViewPhoto]=useState(null); // full-screen photo viewer
  const [viewIdx,setViewIdx]=useState(0);

  const PhotoViewer=()=>{
    if(!viewPhoto)return null;
    const allPhotos=tab==="vault"?vaultPhotos:publicPhotos;
    const p=viewPhoto;
    const idx=allPhotos.findIndex(x=>x.id===p.id);
    const hasPrev=idx>0;
    const hasNext=idx<allPhotos.length-1;
    return(
      <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",
        touchAction:"none"}} onClick={()=>setViewPhoto(null)}>
        {/* Top bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",flexShrink:0}}
          onClick={e=>e.stopPropagation()}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{fmtFull(p.date)}</div>
            {p.private&&<div style={{fontSize:9,color:"#a855f7"}}>🔒 Private</div>}
          </div>
          <button onClick={()=>setViewPhoto(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",
            width:36,height:36,borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {Icons.x({size:18,color:"#fff"})}
          </button>
        </div>
        {/* Photo */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:8,minHeight:0,position:"relative"}}>
          {hasPrev&&(
            <button onClick={e=>{e.stopPropagation();setViewPhoto(allPhotos[idx-1]);}}
              style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",zIndex:10,
                width:40,height:40,borderRadius:20,background:"rgba(255,255,255,0.1)",border:"none",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              {Icons.chevLeft({size:20,color:"#fff"})}
            </button>
          )}
          {p.type==="video"?(
            <video src={p.data} controls autoPlay playsInline
              onError={e=>{e.target.style.display="none";e.target.parentNode.innerHTML='<div style="color:#888;text-align:center;padding:40px">Video unavailable</div>';}}
              style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8}}
              onClick={e=>e.stopPropagation()}/>
          ):(
            <img src={p.data} alt={`Progress photo from ${fmtShort(p.date)}`} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8}}
              onClick={e=>e.stopPropagation()}/>
          )}
          {hasNext&&(
            <button onClick={e=>{e.stopPropagation();setViewPhoto(allPhotos[idx+1]);}}
              style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",zIndex:10,
                width:40,height:40,borderRadius:20,background:"rgba(255,255,255,0.1)",border:"none",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
              {Icons.chevRight({size:20,color:"#fff"})}
            </button>
          )}
        </div>
        {/* Bottom bar */}
        <div style={{padding:"8px 16px 20px",display:"flex",justifyContent:"center",gap:12,flexShrink:0}}
          onClick={e=>e.stopPropagation()}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{idx+1} of {allPhotos.length}</span>
          <button onClick={()=>{if(confirm("Delete this photo?")){Undo.set("Photo deleted",p,"photo");d({type:"DEL_PHOTO",id:p.id});setViewPhoto(null);SuccessToastCtrl.show("Photo deleted");}}}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#ff6b6b",fontFamily:V.font}}>
            Delete
          </button>
        </div>
      </div>
    );
  };

  const PhotoGrid=({photos,isVault})=>(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
      {photos.map(p=>(
        <div key={p.id} onClick={()=>setViewPhoto(p)} style={{position:"relative",borderRadius:14,overflow:"hidden",aspectRatio:"3/4",
          border:`1px solid ${isVault?"rgba(168,85,247,0.3)":V.cardBorder}`,cursor:"pointer"}}>
          {p.type==="video"?(
            <video src={p.data} muted playsInline preload="metadata" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          ):(
            <img src={p.data} alt={`Progress photo from ${fmtShort(p.date)}`} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          )}
          {p.type==="video"&&(
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              width:36,height:36,borderRadius:18,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:16,color:"#fff",marginLeft:2}}>▶</span>
            </div>
          )}
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 10px 8px",
            background:"linear-gradient(transparent,rgba(0,0,0,0.8))"}}>
            <div style={{fontSize:11,color:"#fff",fontWeight:600}}>{fmtShort(p.date)}</div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              {p.type==="video"&&<span style={{fontSize:8,color:"#22d3ee"}}>🎥 Video</span>}
              {isVault&&<span style={{fontSize:8,color:"#a855f7"}}>🔒 Private</span>}
            </div>
          </div>
          <button onClick={e=>{e.stopPropagation();if(confirm(`Delete this ${p.type==="video"?"video":"photo"}?`)){Undo.set("Deleted",p,"photo");d({type:"DEL_PHOTO",id:p.id});SuccessToastCtrl.show("Deleted");}}} style={{position:"absolute",top:6,right:6,
            width:28,height:28,borderRadius:8,background:"rgba(0,0,0,0.6)",border:"none",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center"}}>{Icons.x({size:12,color:"#fff"})}</button>
        </div>
      ))}
    </div>
  );

  return(
    <div>
      <PhotoViewer/>
      {/* Tab toggle */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <button onClick={()=>setTab("public")} style={{flex:1,padding:"8px",borderRadius:8,
          border:`1.5px solid ${tab==="public"?V.accent:V.cardBorder}`,
          background:tab==="public"?`${V.accent}10`:"transparent",
          cursor:"pointer",fontSize:11,fontWeight:700,color:tab==="public"?V.accent:V.text3,fontFamily:V.font}}>
          📸 Photos
        </button>
        <button onClick={()=>setTab("vault")} style={{flex:1,padding:"8px",borderRadius:8,
          border:`1.5px solid ${tab==="vault"?"#a855f7":V.cardBorder}`,
          background:tab==="vault"?"rgba(168,85,247,0.08)":"transparent",
          cursor:"pointer",fontSize:11,fontWeight:700,color:tab==="vault"?"#a855f7":V.text3,fontFamily:V.font}}>
          🔒 Private Vault {vaultPhotos.length>0?`(${vaultPhotos.length})`:""}
        </button>
      </div>

      {tab==="public"?(
        <div>
          <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" onChange={e=>handlePhoto(e,false)}
            style={{display:"none"}}/>
          <Btn full onClick={()=>fileRef.current?.click()} disabled={compressing}>
            {compressing?<span>Compressing…</span>:<span>{Icons.plus({size:16,color:V.bg})} Add Photo or Video</span>}
          </Btn>
          {publicPhotos.length>0&&(
            <div style={{fontSize:9,color:V.text3,marginTop:4,textAlign:"center"}}>
              {publicPhotos.length} photo{publicPhotos.length>1?"s":""} · Compressed for cloud sync
            </div>
          )}
          <PhotoGrid photos={publicPhotos} isVault={false}/>
          {publicPhotos.length===0&&(
            <div style={{textAlign:"center",padding:30,color:V.text3,fontSize:13}}>No photos yet. Start tracking your progress!</div>
          )}
        </div>
      ):(
        <div>
          {!hasVault?(
            <Card style={{padding:20,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>🔒</div>
              <div style={{fontSize:14,fontWeight:700,color:V.text,marginBottom:4}}>Set up Private Vault</div>
              <div style={{fontSize:11,color:V.text3,marginBottom:14,lineHeight:1.5}}>
                Protect sensitive progress photos with a 4+ digit PIN. These photos won't be visible without the code.
              </div>
              {showSetPin?(
                <div style={{display:"flex",gap:8}}>
                  <input type="password" inputMode="numeric" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,""))}
                    placeholder="Enter PIN (4+ digits)" maxLength={8}
                    style={{flex:1,padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:16,textAlign:"center",fontFamily:V.mono,letterSpacing:8,outline:"none"}}/>
                  <Btn onClick={setupPin} disabled={newPin.length<4}>Set</Btn>
                </div>
              ):(
                <Btn full onClick={()=>setShowSetPin(true)} s={{background:"#a855f7"}}>Create Vault PIN</Btn>
              )}
            </Card>
          ):vaultLocked?(
            <Card style={{padding:20,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>🔒</div>
              <div style={{fontSize:14,fontWeight:700,color:V.text,marginBottom:4}}>Vault Locked</div>
              <div style={{fontSize:11,color:V.text3,marginBottom:14}}>Enter your PIN to view private photos</div>
              <div style={{display:"flex",gap:8,maxWidth:240,margin:"0 auto"}}>
                <input type="password" inputMode="numeric" value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,""))}
                  placeholder="PIN" maxLength={8} onKeyDown={e=>{if(e.key==="Enter")unlockVault();}}
                  style={{flex:1,padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                    borderRadius:10,color:V.text,fontSize:18,textAlign:"center",fontFamily:V.mono,letterSpacing:8,outline:"none"}}/>
                <Btn onClick={unlockVault} s={{background:"#a855f7"}}>Unlock</Btn>
              </div>
            </Card>
          ):(
            <div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" onChange={e=>handlePhoto(e,true)}
                  style={{display:"none"}}/>
                <Btn full onClick={()=>fileRef.current?.click()} disabled={compressing} s={{background:"#a855f7"}}>
                  {compressing?<span>Compressing…</span>:<span>{Icons.plus({size:16,color:V.bg})} Add to Vault 📸🎥</span>}
                </Btn>
                <Btn v="secondary" onClick={()=>{setVaultLocked(true);SuccessToastCtrl.show("Vault locked");}} s={{flexShrink:0}}>
                  🔒 Lock
                </Btn>
              </div>
              <PhotoGrid photos={vaultPhotos} isVault={true}/>
              {vaultPhotos.length===0&&(
                <div style={{textAlign:"center",padding:30,color:V.text3,fontSize:13}}>Vault is empty. Add private progress photos here.</div>
              )}
              <button onClick={()=>{if(confirm("Reset vault PIN? This won't delete photos.")){LS.set("ft-vault-pin",null);setVaultLocked(true);SuccessToastCtrl.show("Vault PIN reset");}}}
                style={{width:"100%",marginTop:12,padding:8,background:"none",border:"none",cursor:"pointer",
                  fontSize:10,color:V.text3,fontFamily:V.font}}>Reset Vault PIN</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export & Import ───
// ─── Profile Editor (Settings) ───
function ProfileEditor({s,d}){
  const p=s.profile||{};
  const [form,setForm]=useState({...p});
  const [saved,setSaved]=useState(false);
  const [syncing,setSyncing]=useState(false);

  const saveProfile=async()=>{
    d({type:"SET_PROFILE",profile:form});
    setSaved(true);
    SuccessToastCtrl.show("Profile updated");

    // Sync to backend
    setSyncing(true);
    try{
      await fetch(`${SYNC_URL}/api/users`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"update",...form,updatedAt:new Date().toISOString()}),
      });
    }catch(e){console.warn("Error:",e);}
    setSyncing(false);
    setTimeout(()=>setSaved(false),2000);
  };

  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Field label="First Name" value={form.firstName||""} onChange={v=>upd("firstName",v)}/>
        <Field label="Last Name" value={form.lastName||""} onChange={v=>upd("lastName",v)}/>
      </div>
      <Field label="Nickname" value={form.nickname||""} onChange={v=>upd("nickname",v)} placeholder="Display name"/>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:V.text3,marginBottom:4,fontWeight:600}}>Email</div>
        <div style={{padding:"10px 14px",background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,
          borderRadius:10,fontSize:14,color:V.text3,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{form.email||"—"}</span>
          <span style={{fontSize:9,color:V.text3,background:"rgba(255,255,255,0.04)",padding:"2px 6px",borderRadius:4}}>🔒 Locked</span>
        </div>
        <div style={{fontSize:9,color:V.text3,marginTop:3}}>Email cannot be changed. It's your account identifier.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Field label="Date of Birth" type="date" value={form.dob||""} onChange={v=>upd("dob",v)}/>
        <div>
          <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Sex</div>
          <div style={{display:"flex",gap:6}}>
            {["Male","Female"].map(sx=>(
              <button key={sx} onClick={()=>upd("sex",sx)} style={{
                flex:1,padding:"8px 0",borderRadius:8,border:`1.5px solid ${form.sex===sx?V.accent:V.cardBorder}`,
                background:form.sex===sx?`${V.accent}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",WebkitTapHighlightColor:"transparent",
                fontSize:12,fontWeight:600,color:form.sex===sx?V.accent:V.text,fontFamily:V.font,textAlign:"center"
              }}>{sx}</button>
            ))}
          </div>
        </div>
      </div>
      <Field label="Height" value={form.height||""} onChange={v=>upd("height",v)} placeholder="5'10"/>
      <Btn full onClick={saveProfile} s={{marginTop:4}}>
        {syncing?"Saving...":(saved?`${Icons.check({size:14,color:V.bg})} Saved!`:`${Icons.check({size:14,color:V.bg})} Save Profile`)}
      </Btn>
    </div>
  );
}

function DataManager({s,d}){
  const fileRef=useRef(null);
  const [msg,setMsg]=useState(null);
  const [restoring,setRestoring]=useState(false);
  const CURRENT_VERSION="4.2";
  const lastSync=LS.get("ft-last-sync");

  const exportData=()=>{
    const data={
      _ironlog:{version:CURRENT_VERSION,exported:new Date().toISOString(),platform:`IRONLOG v${APP_VERSION}`},
      workouts:s.workouts,nutrition:s.nutrition,body:s.body,exercises:s.exercises,
      goals:s.goals,schedule:s.schedule,units:s.units,photos:s.photos||[],profile:s.profile||{},checkins:s.checkins||[],milestones:s.milestones||[],phases:s.phases||[],injuries:s.injuries||[]
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`ironlog-backup-${today()}.json`;a.click();
    URL.revokeObjectURL(url);
    setMsg({type:"success",text:`Exported ${s.workouts.length} workouts, ${s.nutrition.length} nutrition logs, ${s.body.length} measurements`});
    setTimeout(()=>setMsg(null),4000);
  };

  const importData=(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const raw=JSON.parse(ev.target.result);
        const data={...raw};delete data._ironlog;
        const existingWIds=new Set(s.workouts.map(w=>w.id));
        const existingNIds=new Set(s.nutrition.map(n=>n.id));
        const existingBIds=new Set(s.body.map(b=>b.id));
        const newW=(data.workouts||[]).filter(w=>!existingWIds.has(w.id)).length;
        const newN=(data.nutrition||[]).filter(n=>!existingNIds.has(n.id)).length;
        const newB=(data.body||[]).filter(b=>!existingBIds.has(b.id)).length;
        const merged={
          ...data,
          workouts:[...s.workouts,...(data.workouts||[]).filter(w=>!existingWIds.has(w.id))],
          nutrition:[...s.nutrition,...(data.nutrition||[]).filter(n=>!existingNIds.has(n.id))],
          body:[...s.body,...(data.body||[]).filter(b=>!existingBIds.has(b.id))],
          exercises:[...s.exercises,...(data.exercises||[]).filter(e=>!s.exercises.some(x=>x.id===e.id))],
        };
        d({type:"IMPORT",data:merged});
        setMsg({type:"success",text:`Imported! +${newW} workouts, +${newN} nutrition, +${newB} measurements`});
        setTimeout(()=>setMsg(null),5000);
      }catch(err){
        setMsg({type:"error",text:"Invalid backup file. Make sure it's an IRONLOG JSON export."});
        setTimeout(()=>setMsg(null),4000);
      }
    };
    reader.readAsText(file);
    e.target.value="";
  };

  const [restorePin,setRestorePin]=useState("");
  const [showRestorePin,setShowRestorePin]=useState(false);

  const restoreFromCloud=async(pinOverride)=>{
    const email=s.profile?.email;
    if(!email){setMsg({type:"error",text:"No email found. Complete your profile first."});setTimeout(()=>setMsg(null),4000);return;}
    setRestoring(true);
    const pin=pinOverride||restorePin||LS.get("ft-account-pin")||null;
    const result=await CloudSync.pull(email,LS.get("ft-device-id"),pin);

    if(result?.pin_required){
      setRestoring(false);setShowRestorePin(true);
      setMsg({type:"info",text:"Enter your account PIN to restore data."});
      return;
    }
    if(result?.wrong_pin){
      setRestoring(false);setRestorePin("");
      setMsg({type:"error",text:`Wrong PIN. ${result.attempts_remaining} attempts remaining.${result.locked?" Account locked for 15 minutes.":""}`});
      setTimeout(()=>setMsg(null),5000);return;
    }
    if(result?.locked){
      setRestoring(false);
      setMsg({type:"error",text:`Account locked. Try again in ${result.retry_minutes} minutes.`});
      setTimeout(()=>setMsg(null),5000);return;
    }

    if(result&&result.success){
      setShowRestorePin(false);setRestorePin("");
      const cloud=result.data;
      // Smart merge cloud data into local
      const existingWIds=new Set(s.workouts.map(w=>w.id));
      const existingNIds=new Set(s.nutrition.map(n=>n.id));
      const existingBIds=new Set(s.body.map(b=>b.id));
      const newW=(cloud.workouts||[]).filter(w=>!existingWIds.has(w.id));
      const newN=(cloud.nutrition||[]).filter(n=>!existingNIds.has(n.id));
      const newB=(cloud.body||[]).filter(b=>!existingBIds.has(b.id));
      const newP=(cloud.photos||[]).filter(p=>!s.photos.some(x=>x.id===p.id));
      const existingCheckinDates=new Set((s.checkins||[]).map(c=>c.date));
      const newC=(cloud.checkins||[]).filter(c=>!existingCheckinDates.has(c.date));
      const existingMIds=new Set((s.milestones||[]).map(m=>m.id));
      const newM=(cloud.milestones||[]).filter(m=>!existingMIds.has(m.id));

      const merged={
        workouts:[...s.workouts,...newW].sort((a,b)=>b.date.localeCompare(a.date)),
        nutrition:[...s.nutrition,...newN].sort((a,b)=>b.date.localeCompare(a.date)),
        body:[...s.body,...newB].sort((a,b)=>b.date.localeCompare(a.date)),
        photos:[...s.photos,...newP],
        checkins:[...(s.checkins||[]),...newC],
        milestones:[...(s.milestones||[]),...newM],
        exercises:cloud.exercises||s.exercises,
        goals:cloud.goals||s.goals,
        schedule:cloud.schedule||s.schedule,
        units:cloud.units||s.units,
        profile:cloud.profile||s.profile,
      };
      d({type:"IMPORT",data:merged});
      // Restore vault PIN from cloud if it exists
      if(cloud.vault_pin&&!LS.get("ft-vault-pin")){LS.set("ft-vault-pin",cloud.vault_pin);}
      if(cloud.phases)d({type:"SET_PHASES",phases:cloud.phases});
      if(cloud.injuries)d({type:"SET_INJURIES",injuries:cloud.injuries});
      if(cloud.privacy)LS.set("ft-privacy",cloud.privacy);
      if(cloud.supplements)LS.set("ft-supplements",cloud.supplements);
      setMsg({type:"success",text:`Restored from cloud! +${newW.length} workouts, +${newN.length} nutrition, +${newB.length} measurements, +${newC.length} check-ins, +${newM.length} goals`});
    }else{
      setMsg({type:"error",text:"No cloud backup found for this account, or server is unreachable."});
    }
    setRestoring(false);
    setTimeout(()=>setMsg(null),5000);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {msg&&(
        <div style={{padding:"10px 14px",borderRadius:10,fontSize:12,fontWeight:600,
          background:msg.type==="success"?`${V.accent}12`:`${V.danger}12`,
          color:msg.type==="success"?V.accent:V.danger,
          border:`1px solid ${msg.type==="success"?V.accent:V.danger}20`}}>
          {msg.text}
        </div>
      )}

      {/* Sync status */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",
        background:"rgba(255,255,255,0.02)",borderRadius:8,border:`1px solid ${V.cardBorder}`}}>
        <div>
          <div style={{fontSize:11,color:V.text3}}>Cloud Sync</div>
          <div style={{fontSize:10,color:s.profile?.email?V.accent:V.text3,fontFamily:V.mono}}>
            {s.profile?.email?`Linked: ${s.profile.email}`:"Not linked — complete profile"}
          </div>
        </div>
        {lastSync&&(
          <div style={{fontSize:9,color:V.text3,textAlign:"right"}}>
            Last sync<br/><span style={{fontFamily:V.mono}}>{new Date(lastSync).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div style={{fontSize:11,color:V.text3,marginBottom:2}}>
        {s.workouts.length} workouts · {s.nutrition.length} nutrition logs · {s.body.length} measurements
      </div>

      {/* Cloud restore */}
      {showRestorePin&&(
        <div style={{padding:14,borderRadius:10,background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:4}}>🔒 Account PIN Required</div>
          <div style={{fontSize:10,color:V.text3,marginBottom:8}}>Enter your 6-digit PIN to access cloud data.</div>
          <div style={{display:"flex",gap:8}}>
            <input type="password" inputMode="numeric" value={restorePin} onChange={e=>setRestorePin(e.target.value.replace(/\D/g,"").slice(0,6))}
              placeholder="• • • • • •" maxLength={6} autoComplete="current-password"
              onKeyDown={e=>{if(e.key==="Enter"&&restorePin.length===6)restoreFromCloud(restorePin);}}
              style={{flex:1,padding:"12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:10,color:V.text,fontSize:20,textAlign:"center",fontFamily:V.mono,letterSpacing:10,outline:"none"}}/>
            <Btn onClick={()=>restoreFromCloud(restorePin)} disabled={restorePin.length!==6||restoring}>
              {restoring?"...":"Go"}
            </Btn>
          </div>
        </div>
      )}
      <Btn full onClick={()=>restoreFromCloud()} disabled={restoring}>
        {restoring?(
          <span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
            <div style={{width:14,height:14,borderRadius:7,border:"2px solid rgba(255,255,255,0.2)",
              borderTopColor:V.bg,animation:"spin 0.8s linear infinite"}}/>
            Restoring...
          </span>
        ):(
          <span>{Icons.download({size:16,color:V.bg})} Restore from Cloud</span>
        )}
      </Btn>
      <div style={{fontSize:10,color:V.text3}}>Pull your data from the server. Use this on a new device to get all your workouts, nutrition, and measurements back.</div>

      {/* Local export/import */}
      <div style={{borderTop:`1px solid ${V.cardBorder}`,paddingTop:10,marginTop:4}}>
        <div style={{fontSize:11,fontWeight:600,color:V.text3,marginBottom:8}}>Local Backup</div>
        <Btn v="secondary" full onClick={exportData}>{Icons.download({size:14,color:V.text2})} Export JSON</Btn>
        <input ref={fileRef} type="file" accept=".json" onChange={importData} style={{display:"none"}}/>
        <Btn v="secondary" full onClick={()=>fileRef.current?.click()} s={{marginTop:6}}>{Icons.upload({size:14,color:V.text2})} Import JSON</Btn>
        <div style={{fontSize:10,color:V.text3,marginTop:4}}>Import merges data — your existing entries won't be duplicated or lost.</div>
      </div>

      {/* #4 Cloud vs Local Parity Checker */}
      <div style={{borderTop:`1px solid ${V.cardBorder}`,paddingTop:10,marginTop:4}}>
        <div style={{fontSize:11,fontWeight:600,color:V.text3,marginBottom:8}}>Data Health Check</div>
        <Btn v="secondary" full onClick={async()=>{
          const email=s.profile?.email;
          if(!email){setMsg({type:"error",text:"No email — complete your profile first."});setTimeout(()=>setMsg(null),4000);return;}
          setMsg({type:"info",text:"Checking cloud parity..."});
          try{
            // Try with session token first, then with stored PIN
            const pin=LS.get("ft-account-pin")||null;
            const result=await CloudSync.pull(email,LS.get("ft-device-id"),pin);

            if(result?.pin_required){
              setMsg({type:"error",text:"PIN required for cloud access. Use Restore from Cloud below."});
              setTimeout(()=>setMsg(null),5000);return;
            }
            if(!result||!result.success){
              setMsg({type:"error",text:result?.error||"Could not reach cloud. Try again later."});
              setTimeout(()=>setMsg(null),4000);return;
            }
            const cloud=result.data;
            const report=[];
            const checks=[
              {name:"Workouts",local:s.workouts.length,cloud:(cloud.workouts||[]).length},
              {name:"Nutrition",local:s.nutrition.length,cloud:(cloud.nutrition||[]).length},
              {name:"Body",local:s.body.length,cloud:(cloud.body||[]).length},
              {name:"Photos",local:(s.photos||[]).length,cloud:(cloud.photos||[]).length},
              {name:"Check-ins",local:(s.checkins||[]).length,cloud:(cloud.checkins||[]).length},
              {name:"Goals",local:(s.milestones||[]).length,cloud:(cloud.milestones||[]).length},
            ];
            let allMatch=true;
            checks.forEach(c=>{
              if(c.local!==c.cloud){allMatch=false;report.push(`${c.name}: ${c.local} local / ${c.cloud} cloud`);}
            });
            const cloudWIds=new Set((cloud.workouts||[]).map(w=>w.id));
            const unsyncedW=s.workouts.filter(w=>!cloudWIds.has(w.id)).length;
            if(unsyncedW>0){allMatch=false;report.push(`${unsyncedW} workout(s) not yet in cloud`);}
            const cloudNIds=new Set((cloud.nutrition||[]).map(n=>n.id));
            const unsyncedN=s.nutrition.filter(n=>!cloudNIds.has(n.id)).length;
            if(unsyncedN>0){allMatch=false;report.push(`${unsyncedN} nutrition log(s) not yet in cloud`);}

            if(allMatch){
              setMsg({type:"success",text:`✅ All in sync — ${s.workouts.length} workouts, ${s.nutrition.length} nutrition, ${s.body.length} body`});
            }else{
              setMsg({type:"warn",text:`⚠️ Differences:\n${report.join("\n")}`});
            }
            setTimeout(()=>setMsg(null),10000);
          }catch(e){
            setMsg({type:"error",text:"Health check failed: "+e.message});
            setTimeout(()=>setMsg(null),4000);
          }
        }}>{Icons.activity({size:14,color:V.text2})} Run Health Check</Btn>
        <div style={{fontSize:10,color:V.text3,marginTop:4}}>Compare local data against cloud to find unsynced entries.</div>
        {msg&&msg.text?.includes("Differences")&&(
          <Btn v="secondary" full onClick={async()=>{
            setMsg({type:"info",text:"Pushing all local data to cloud..."});
            try{
              await CloudSync.push(s);
              setMsg({type:"success",text:"✅ Sync complete!"});
            }catch(e){
              setMsg({type:"error",text:"Sync failed — check connection"});
            }
            setTimeout(()=>setMsg(null),4000);
          }} s={{marginTop:6}}>
            {Icons.refresh({size:14,color:V.text2})} Force Sync Now
          </Btn>
        )}
      </div>
    </div>
  );
}

// ─── Exercise → Muscle Mapping ───// All muscle groups for heat map// ─── Progressive Overload Engine (Enhanced) ───
function getOverloadSuggestion(exerciseId, workouts, units){
  // Find last 3 sessions with this exercise
  const sessions=[];
  for(const w of workouts){
    const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
    if(ex&&ex.sets.some(s=>s.weight>0)){sessions.push({date:w.date,sets:ex.sets});if(sessions.length>=3)break;}
  }
  if(sessions.length===0)return null;

  const latest=sessions[0];
  const bestSet=latest.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
  const w=parseFloat(bestSet.weight)||0;
  const r=parseInt(bestSet.reps)||0;
  if(w===0)return null;

  const e1rm=Math.round(w*(1+r/30));
  const inc=units==="kg"?2.5:5;
  const targetReps=8;

  // Check if all sets hit target reps
  const allSetsHit=latest.sets.every(st=>parseInt(st.reps)>=targetReps);
  // Check for failure pattern (last 2-3 sessions struggling)
  const failCount=sessions.filter(sess=>{
    const bst=sess.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
    return parseInt(bst.reps)<targetReps-2;
  }).length;

  let type,sugWeight,sugReps,reason;
  if(failCount>=2){
    // Deload
    sugWeight=Math.round((w-inc*2)/inc)*inc;
    sugReps=targetReps;
    type="deload";
    reason="Struggling multiple sessions — deload to rebuild";
  }else if(allSetsHit){
    // Increase weight
    sugWeight=w+inc;
    sugReps=r;
    type="increase";
    reason="All sets completed — increase weight";
  }else if(r<targetReps-1){
    // Keep same, failed reps
    sugWeight=w;
    sugReps=targetReps;
    type="repeat";
    reason="Missed reps — repeat and aim higher";
  }else{
    // Keep same, almost there
    sugWeight=w;
    sugReps=r+1;
    type="reps";
    reason="Close to target — add a rep";
  }

  const zone80=Math.round(e1rm*0.80);
  const zone70=Math.round(e1rm*0.70);

  return{type,last:`${w}×${r}`,suggest:`${sugWeight}×${sugReps}`,e1rm,zone80,zone70,reason,
    allSets:latest.sets.map(st=>`${st.weight}×${st.reps}`).join("  "),date:sessions[0].date};
}

// ─── Muscle Heat Map Calculator ───
function calcMuscleHeat(workouts,exercises,days=10){
  const now=new Date();
  const scores={};
  ALL_MUSCLES.forEach(m=>{scores[m]=0;});

  workouts.forEach(w=>{
    const daysAgo=Math.max(0,(now-new Date(w.date))/(1000*60*60*24));
    if(daysAgo>days)return;
    const decay=Math.max(0,1-daysAgo/days);

    w.exercises.forEach(ex=>{
      const map=MUSCLE_MAP[ex.exerciseId];
      if(!map)return;
      const setCount=ex.sets.length;
      const volume=ex.sets.reduce((s,st)=>(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)+s,0);
      const intensity=Math.min(1,volume/5000)+setCount*0.3;

      map.primary.forEach(m=>{scores[m]+=(intensity*3)*decay;});
      map.secondary.forEach(m=>{scores[m]+=(intensity*1.5)*decay;});
    });
  });

  // Normalize 0-10
  const mx=Math.max(...Object.values(scores),1);
  const norm={};
  ALL_MUSCLES.forEach(m=>{norm[m]=Math.min(10,Math.round(scores[m]/mx*10*10)/10);});
  return norm;
}

function getMuscleColor(score){
  if(score<=0.5)return"rgba(255,255,255,0.06)";
  if(score<=3)return"rgba(250,204,21,0.4)";   // yellow
  if(score<=6)return"rgba(0,245,160,0.5)";     // green
  if(score<=8)return"rgba(0,245,160,0.8)";     // bright green
  return"rgba(255,107,107,0.7)";                // red (high fatigue)
}

function getMuscleLabel(score){
  if(score<=0.5)return"Untrained";
  if(score<=3)return"Light";
  if(score<=6)return"Moderate";
  if(score<=8)return"Well Trained";
  return"High Volume";
}

// ─── Muscle Heat Map SVG Component ───
function MuscleHeatMap({s}){
  const heat=useMemo(()=>calcMuscleHeat(s.workouts,s.exercises),[s.workouts,s.exercises]);
  const [sel,setSel]=useState(null);
  const [view,setView]=useState("front"); // front | back
  const [mode,setMode]=useState("activity"); // activity | recovery

  // Map muscle IDs to heat scores for SVG regions
  const getScore=(id)=>{
    const map={
      chest_left:"chest",chest_right:"chest",
      front_delt_left:"front_delts",front_delt_right:"front_delts",
      biceps_left:"biceps",biceps_right:"biceps",
      core:"core",obliques_left:"core",obliques_right:"core",
      quads_left:"quads",quads_right:"quads",
      calves_left:"calves",calves_right:"calves",
      traps_front:"traps",traps_back:"traps",
      rear_delt_left:"rear_delts",rear_delt_right:"rear_delts",
      lats_left:"back",lats_right:"back",upper_back:"back",
      triceps_left:"triceps",triceps_right:"triceps",
      glutes_left:"glutes",glutes_right:"glutes",
      hamstrings_left:"hamstrings",hamstrings_right:"hamstrings",
      calves_back_left:"calves",calves_back_right:"calves",
    };
    return heat[map[id]||id]||0;
  };

  const getMuscleId=(svgId)=>{
    const map={
      chest_left:"chest",chest_right:"chest",front_delt_left:"front_delts",front_delt_right:"front_delts",
      biceps_left:"biceps",biceps_right:"biceps",core:"core",obliques_left:"core",obliques_right:"core",
      quads_left:"quads",quads_right:"quads",calves_left:"calves",calves_right:"calves",
      traps_front:"traps",traps_back:"traps",rear_delt_left:"rear_delts",rear_delt_right:"rear_delts",
      lats_left:"back",lats_right:"back",upper_back:"back",
      triceps_left:"triceps",triceps_right:"triceps",
      glutes_left:"glutes",glutes_right:"glutes",
      hamstrings_left:"hamstrings",hamstrings_right:"hamstrings",
      calves_back_left:"calves",calves_back_right:"calves",
    };
    return map[svgId]||svgId;
  };

  // Heatmap color based on score 0-10
  const heatColor=(score)=>{
    if(mode==="recovery"){
      // Recovery: days since last trained
      if(score<=0)return"rgba(255,255,255,0.04)";
      if(score<=3)return"rgba(255,70,70,0.55)"; // fatigued (recently trained hard)
      if(score<=6)return"rgba(255,160,50,0.5)"; // recovering
      return"rgba(0,245,160,0.45)"; // recovered
    }
    if(score<=0)return"rgba(255,255,255,0.04)";
    if(score<=2)return"rgba(250,204,21,0.3)";
    if(score<=4)return"rgba(250,204,21,0.5)";
    if(score<=6)return"rgba(0,245,160,0.45)";
    if(score<=8)return"rgba(0,245,160,0.65)";
    return"rgba(255,70,70,0.6)";
  };

  const glowFilter=(score)=>{
    if(score<=1)return"none";
    return`drop-shadow(0 0 ${Math.min(score*1.5,12)}px ${score>7?"rgba(255,70,70,0.4)":score>4?"rgba(0,245,160,0.3)":"rgba(250,204,21,0.2)"})`;
  };

  // Muscle region SVG path component
  const M=({id,d})=>{
    const score=getScore(id);
    const muscleId=getMuscleId(id);
    const selected=sel===muscleId;
    return(
      <path d={d} fill={heatColor(score)}
        stroke={selected?"#00f5a0":"#1b232d"} strokeWidth={selected?2.5:1.5}
        style={{cursor:"pointer",transition:"fill .3s,stroke .2s",filter:glowFilter(score)}}
        onClick={()=>setSel(sel===muscleId?null:muscleId)}/>
    );
  };

  // Get detail info for selected muscle
  const selDetail=useMemo(()=>{
    if(!sel)return null;
    const score=(heat[sel]||0).toFixed(1);
    // Find exercises that hit this muscle
    const exIds=Object.entries(MUSCLE_MAP).filter(([eid,m])=>m.primary?.includes(sel)||m.secondary?.includes(sel)).map(([eid])=>eid);
    // Find recent workouts with those exercises
    const recentW=s.workouts.slice(0,14);
    const exercises=[];
    let lastDate=null;
    recentW.forEach(w=>{
      w.exercises.forEach(ex=>{
        if(exIds.includes(ex.exerciseId)){
          const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
          const existing=exercises.find(e=>e.name===name);
          if(existing)existing.sets+=ex.sets.length;
          else exercises.push({name,sets:ex.sets.length});
          if(!lastDate||w.date>lastDate)lastDate=w.date;
        }
      });
    });
    const daysSince=lastDate?Math.floor((new Date()-new Date(lastDate+"T12:00:00"))/86400000):null;
    return{score,exercises:exercises.sort((a,b)=>b.sets-a.sets).slice(0,5),lastDate,daysSince};
  },[sel,heat,s.workouts,s.exercises]);

  // Imbalance detection
  const imbalances=useMemo(()=>{
    const msgs=[];
    const pairs=[["quads","hamstrings","Quad-to-hamstring"],["chest","back","Chest-to-back"],["biceps","triceps","Bicep-to-tricep"],["front_delts","rear_delts","Front-to-rear delt"]];
    pairs.forEach(([a,b,label])=>{
      if(heat[a]>0&&heat[b]<=0.5)msgs.push({msg:`${MUSCLE_LABELS[a]} trained but ${MUSCLE_LABELS[b]} neglected`,fix:b});
      else if(heat[a]>heat[b]*2.5&&heat[b]>0)msgs.push({msg:`${label} imbalance`,fix:b});
    });
    if(heat.calves<=0.5&&heat.quads>3)msgs.push({msg:"Calves untrained — add calf raises",fix:"calves"});
    if(heat.core<=0.5&&s.workouts.length>3)msgs.push({msg:"Core neglected — add ab work",fix:"core"});
    return msgs;
  },[heat,s.workouts.length]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Header + toggles */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Muscle Map</div>
          <div style={{fontSize:10,color:V.text3}}>Last 10 days · Tap a muscle for details</div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {["activity","recovery"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{padding:"5px 10px",borderRadius:6,
              border:`1.5px solid ${mode===m?V.accent:V.cardBorder}`,
              background:mode===m?`${V.accent}10`:"transparent",
              cursor:"pointer",fontSize:9,fontWeight:700,color:mode===m?V.accent:V.text3,
              fontFamily:V.font,textTransform:"capitalize"}}>{m}</button>
          ))}
        </div>
      </div>

      {/* Anatomy SVG */}
      <Card style={{padding:16,background:"#07090c"}}>
        {/* Front/Back toggle */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:12}}>
          {["front","back"].map(v=>(
            <button key={v} onClick={()=>{setView(v);setSel(null);}} style={{padding:"6px 20px",borderRadius:8,
              border:`1.5px solid ${view===v?V.accent:V.cardBorder}`,
              background:view===v?`${V.accent}10`:"rgba(255,255,255,0.02)",
              cursor:"pointer",fontSize:11,fontWeight:700,color:view===v?V.accent:V.text3,
              fontFamily:V.font,textTransform:"uppercase"}}>{v}</button>
          ))}
        </div>

        {/* Self-contained anatomy SVG — no external files needed */}
        <svg viewBox="130 -10 160 540" style={{width:"100%",maxWidth:300,margin:"0 auto",display:"block"}}>
          {/* Body silhouette */}
          <path d="M210,8 C222,8 232,16 234,30 C236,44 230,56 224,64 L224,72 C236,78 254,90 264,104 C274,120 278,138 276,156 C274,170 270,184 270,198 C272,210 272,222 268,234 L264,252 C260,268 260,286 262,306 L260,326 C256,312 248,306 240,308 C236,312 234,324 234,340 C238,364 246,388 254,410 C260,428 264,448 260,468 C254,492 240,506 226,512 C218,514 214,514 210,514 C206,514 202,514 194,512 C180,506 166,492 160,468 C156,448 160,428 166,410 C174,388 182,364 186,340 C186,324 184,312 180,308 C172,306 164,312 160,326 L158,306 C160,286 160,268 156,252 L152,234 C148,222 148,210 150,198 C150,184 146,170 144,156 C142,138 146,120 156,104 C166,90 184,78 196,72 L196,64 C190,56 184,44 186,30 C188,16 198,8 210,8 Z"
            fill="#0b0f14" stroke="#1a2436" strokeWidth="1.2"/>
          <ellipse cx="210" cy="28" rx="22" ry="24" fill="#0b0f14" stroke="#1a2436" strokeWidth="1.2"/>
          {/* Detail lines */}
          <line x1="210" y1="96" x2="210" y2="256" stroke="#131a24" strokeWidth="0.4" opacity="0.4"/>
          <path d="M200,158 L220,158 M198,174 L222,174 M198,190 L222,190 M198,206 L222,206" fill="none" stroke="#131a24" strokeWidth="0.4" opacity="0.3"/>
          <ellipse cx="196" cy="340" rx="7" ry="5" fill="none" stroke="#1a2436" strokeWidth="0.5" opacity="0.3"/>
          <ellipse cx="224" cy="340" rx="7" ry="5" fill="none" stroke="#1a2436" strokeWidth="0.5" opacity="0.3"/>

          {view==="front"?(
            <g>
              <M id="traps_front" d="M182,78 C192,70 200,68 210,68 C220,68 228,70 238,78 C244,82 250,88 254,94 C248,98 240,100 232,98 C224,94 218,90 210,90 C202,90 196,94 188,98 C180,100 172,98 166,94 C170,88 176,82 182,78 Z"/>
              <M id="front_delt_left" d="M162,96 C156,102 150,114 148,126 C148,138 152,146 158,150 C164,152 170,148 176,140 C180,132 182,120 180,110 C178,102 172,96 166,96 Z"/>
              <M id="front_delt_right" d="M258,96 C264,102 270,114 272,126 C272,138 268,146 262,150 C256,152 250,148 244,140 C240,132 238,120 240,110 C242,102 248,96 254,96 Z"/>
              <M id="chest_left" d="M182,100 C190,94 200,92 210,94 C210,100 208,112 204,124 C200,134 194,142 186,148 C178,152 170,150 164,146 C160,140 160,130 164,120 C168,110 174,102 182,100 Z"/>
              <M id="chest_right" d="M238,100 C230,94 220,92 210,94 C210,100 212,112 216,124 C220,134 226,142 234,148 C242,152 250,150 256,146 C260,140 260,130 256,120 C252,110 246,102 238,100 Z"/>
              <M id="biceps_left" d="M148,152 C144,140 142,128 146,118 C150,112 156,114 160,122 C164,132 164,146 162,160 C160,172 156,182 150,186 C144,184 142,174 144,162 Z"/>
              <M id="biceps_right" d="M272,152 C276,140 278,128 274,118 C270,112 264,114 260,122 C256,132 256,146 258,160 C260,172 264,182 270,186 C276,184 278,174 276,162 Z"/>
              <M id="core" d="M196,150 C198,142 204,138 210,138 C216,138 222,142 224,150 C226,166 226,184 224,202 C222,220 218,236 214,248 C212,254 210,258 210,258 C210,258 208,254 206,248 C202,236 198,220 196,202 C194,184 194,166 196,150 Z"/>
              <M id="obliques_left" d="M172,156 C168,150 164,154 162,164 C160,178 162,196 166,214 C170,232 176,248 182,258 C186,262 188,256 186,244 C184,228 180,210 178,192 C176,176 174,162 172,156 Z"/>
              <M id="obliques_right" d="M248,156 C252,150 256,154 258,164 C260,178 258,196 254,214 C250,232 244,248 238,258 C234,262 232,256 234,244 C236,228 240,210 242,192 C244,176 246,162 248,156 Z"/>
              <M id="quads_left" d="M176,272 C174,258 178,244 184,236 C190,230 198,230 204,236 C208,244 210,258 210,274 C210,294 208,316 206,334 C204,346 198,352 192,350 C186,346 180,336 178,322 C176,308 176,288 176,272 Z"/>
              <M id="quads_right" d="M244,272 C246,258 242,244 236,236 C230,230 222,230 216,236 C212,244 210,258 210,274 C210,294 212,316 214,334 C216,346 222,352 228,350 C234,346 240,336 242,322 C244,308 244,288 244,272 Z"/>
              <M id="calves_left" d="M184,362 C182,352 186,344 192,342 C198,342 202,346 204,354 C206,366 206,382 204,396 C202,406 198,412 194,410 C190,408 186,398 184,386 C184,376 184,368 184,362 Z"/>
              <M id="calves_right" d="M236,362 C238,352 234,344 228,342 C222,342 218,346 216,354 C214,366 214,382 216,396 C218,406 222,412 226,410 C230,408 234,398 236,386 C236,376 236,368 236,362 Z"/>
            </g>
          ):(
            <g>
              <M id="traps_back" d="M182,78 C192,68 200,66 210,66 C220,66 228,68 238,78 C246,86 252,94 256,100 C250,110 240,118 230,120 C220,120 214,114 210,110 C206,114 200,120 190,120 C180,118 170,110 164,100 C168,94 174,86 182,78 Z"/>
              <M id="rear_delt_left" d="M162,102 C156,108 150,118 148,130 C150,140 156,146 162,148 C168,148 174,142 178,134 C180,124 178,114 172,106 C168,100 164,100 162,102 Z"/>
              <M id="rear_delt_right" d="M258,102 C264,108 270,118 272,130 C270,140 264,146 258,148 C252,148 246,142 242,134 C240,124 242,114 248,106 C252,100 256,100 258,102 Z"/>
              <M id="upper_back" d="M192,122 C198,114 204,110 210,110 C216,110 222,114 228,122 C234,134 238,152 238,172 C238,192 234,210 228,224 C222,234 216,240 210,244 C204,240 198,234 192,224 C186,210 182,192 182,172 C182,152 186,134 192,122 Z"/>
              <M id="lats_left" d="M178,128 C170,148 166,172 168,196 C170,218 178,238 188,252 C194,260 198,266 200,272 C196,276 190,274 184,268 C174,256 164,238 160,216 C158,194 160,172 166,152 C170,140 174,132 178,128 Z"/>
              <M id="lats_right" d="M242,128 C250,148 254,172 252,196 C250,218 242,238 232,252 C226,260 222,266 220,272 C224,276 230,274 236,268 C246,256 256,238 260,216 C262,194 260,172 254,152 C250,140 246,132 242,128 Z"/>
              <M id="triceps_left" d="M146,150 C142,138 140,126 144,116 C148,110 154,112 158,120 C162,132 164,146 162,162 C160,176 156,186 150,190 C144,188 142,178 144,164 Z"/>
              <M id="triceps_right" d="M274,150 C278,138 280,126 276,116 C272,110 266,112 262,120 C258,132 256,146 258,162 C260,176 264,186 270,190 C276,188 278,178 276,164 Z"/>
              <M id="glutes_left" d="M174,278 C172,264 176,252 186,244 C196,240 204,244 208,254 C210,266 210,282 208,296 C204,308 198,314 190,312 C182,310 176,300 174,288 Z"/>
              <M id="glutes_right" d="M246,278 C248,264 244,252 234,244 C224,240 216,244 212,254 C210,266 210,282 212,296 C216,308 222,314 230,312 C238,310 244,300 246,288 Z"/>
              <M id="hamstrings_left" d="M176,318 C174,306 178,296 186,292 C194,290 200,296 204,306 C206,320 206,338 204,356 C202,368 198,376 192,378 C186,376 180,368 178,354 C176,340 176,328 176,318 Z"/>
              <M id="hamstrings_right" d="M244,318 C246,306 242,296 234,292 C226,290 220,296 216,306 C214,320 214,338 216,356 C218,368 222,376 228,378 C234,376 240,368 242,354 C244,340 244,328 244,318 Z"/>
              <M id="calves_back_left" d="M184,388 C182,378 186,370 192,368 C198,368 202,374 204,382 C206,394 206,410 202,422 C198,428 194,426 190,418 C186,408 184,398 184,390 Z"/>
              <M id="calves_back_right" d="M236,388 C238,378 234,370 228,368 C222,368 218,374 216,382 C214,394 214,410 218,422 C222,428 226,426 230,418 C234,408 236,398 236,390 Z"/>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:10}}>
          {(mode==="activity"?
            [{l:"None",c:"rgba(255,255,255,0.06)"},{l:"Light",c:"rgba(250,204,21,0.4)"},{l:"Moderate",c:"rgba(0,245,160,0.5)"},{l:"High",c:"rgba(255,70,70,0.6)"}]
            :[{l:"Recovered",c:"rgba(0,245,160,0.45)"},{l:"Recovering",c:"rgba(255,160,50,0.5)"},{l:"Fatigued",c:"rgba(255,70,70,0.55)"}]
          ).map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:3,background:x.c}}/>
              <span style={{fontSize:9,color:V.text3}}>{x.l}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Selected muscle detail card */}
      {sel&&selDetail&&(
        <Card glow style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:15,fontWeight:800,color:V.text}}>{MUSCLE_LABELS[sel]}</div>
            <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",
              padding:4,fontSize:12,color:V.text3}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:18,fontWeight:800,color:parseFloat(selDetail.score)>7?V.danger:parseFloat(selDetail.score)>4?V.accent:V.warn,fontFamily:V.mono}}>{selDetail.score}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>WORKLOAD</div>
            </div>
            <div style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:14,fontWeight:800,color:V.accent2,fontFamily:V.mono}}>{selDetail.daysSince!==null?`${selDetail.daysSince}d`:"—"}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>LAST HIT</div>
            </div>
            <div style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:14,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{selDetail.exercises.length}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>EXERCISES</div>
            </div>
          </div>
          {selDetail.exercises.length>0?(
            <div>
              <div style={{fontSize:10,color:V.text3,fontWeight:600,marginBottom:4}}>Recent Exercises</div>
              {selDetail.exercises.map((ex,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",
                  borderBottom:i<selDetail.exercises.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                  <span style={{fontSize:12,color:V.text}}>{ex.name}</span>
                  <span style={{fontSize:11,color:V.accent,fontFamily:V.mono}}>{ex.sets} sets</span>
                </div>
              ))}
            </div>
          ):(
            <div style={{fontSize:11,color:V.text3,textAlign:"center",padding:8}}>No recent exercises for this muscle</div>
          )}
        </Card>
      )}

      {/* Ranked muscle list */}
      <Card style={{padding:12}}>
        <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Muscle Rankings</span>
        {ALL_MUSCLES.sort((a,b)=>(heat[b]||0)-(heat[a]||0)).map((m,i)=>{
          const score=heat[m]||0;
          return(
            <div key={m} onClick={()=>setSel(sel===m?null:m)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",
              background:sel===m?`${V.accent}08`:"transparent",borderRadius:6,cursor:"pointer",
              borderBottom:i<ALL_MUSCLES.length-1?`1px solid rgba(255,255,255,0.02)`:"none"}}>
              <div style={{width:24,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden",flexShrink:0}}>
                <div style={{width:`${Math.min(score/10*100,100)}%`,height:"100%",borderRadius:2,
                  background:score>7?V.danger:score>4?V.accent:score>1?V.warn:"transparent",transition:"width .3s"}}/>
              </div>
              <span style={{fontSize:11,color:V.text,flex:1,fontWeight:sel===m?700:400}}>{MUSCLE_LABELS[m]}</span>
              <span style={{fontSize:11,color:score>7?V.danger:score>4?V.accent:score>0?V.warn:V.text3,
                fontFamily:V.mono,fontWeight:700}}>{score.toFixed(1)}</span>
            </div>
          );
        })}
      </Card>

      {/* Imbalance Alerts */}
      {imbalances.length>0&&(
        <Card style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
            {Icons.zap({size:13,color:V.warn})}
            <span style={{fontSize:12,color:V.warn,fontWeight:700}}>Imbalance Alerts</span>
          </div>
          {imbalances.map((im,i)=>(
            <div key={i} style={{fontSize:11,color:V.text2,padding:"6px 0",borderBottom:i<imbalances.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
              {im.msg}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Strength Score System ───
function calcStrengthScore(workouts,bodyWeight){
  const bw=parseFloat(bodyWeight)||180;
  const lifts={bench:0,squat:0,deadlift:0};

  // Find best e1RM for each lift
  workouts.forEach(w=>{
    w.exercises.forEach(ex=>{
      if(lifts.hasOwnProperty(ex.exerciseId)){
        ex.sets.forEach(st=>{
          const wt=parseFloat(st.weight)||0;
          const rp=parseInt(st.reps)||0;
          if(wt>0&&rp>0){
            const e1rm=Math.round(wt*(1+rp/30));
            lifts[ex.exerciseId]=Math.max(lifts[ex.exerciseId],e1rm);
          }
        });
      }
    });
  });

  const benchRatio=lifts.bench/bw;
  const squatRatio=lifts.squat/bw;
  const deadRatio=lifts.deadlift/bw;
  const score=benchRatio*0.30+squatRatio*0.35+deadRatio*0.35;

  let rank,rankColor;
  if(score<0.5){rank="Novice";rankColor=V.text3;}
  else if(score<1.0){rank="Beginner";rankColor=V.warn;}
  else if(score<1.5){rank="Intermediate";rankColor=V.accent2;}
  else if(score<2.0){rank="Advanced";rankColor=V.accent;}
  else{rank="Elite";rankColor=V.purple;}

  // Badges
  const badges=[];
  if(benchRatio>=1.5)badges.push({label:"Bench 1.5x BW",icon:"🏋️"});
  if(benchRatio>=2.0)badges.push({label:"Bench 2x BW",icon:"💎"});
  if(squatRatio>=2.0)badges.push({label:"Squat 2x BW",icon:"🦵"});
  if(squatRatio>=2.5)badges.push({label:"Squat 2.5x BW",icon:"👑"});
  if(deadRatio>=2.5)badges.push({label:"Dead 2.5x BW",icon:"🔥"});
  if(deadRatio>=3.0)badges.push({label:"Dead 3x BW",icon:"⚡"});
  if(score>=1.0)badges.push({label:"1000lb Club",icon:"🏆",cond:lifts.bench+lifts.squat+lifts.deadlift>=1000});

  return{score:Math.round(score*100)/100,rank,rankColor,lifts,benchRatio:Math.round(benchRatio*100)/100,
    squatRatio:Math.round(squatRatio*100)/100,deadRatio:Math.round(deadRatio*100)/100,
    badges:badges.filter(b=>b.cond===undefined||b.cond),total:lifts.bench+lifts.squat+lifts.deadlift,bw};
}

function StrengthScoreCard({s}){
  const bw=s.body.find(b=>b.weight)?.weight||s.goals.goalWeight||180;
  const data=useMemo(()=>calcStrengthScore(s.workouts,bw),[s.workouts,bw]);
  const u=wUnit(s.units);

  // Monthly trend
  const trend=useMemo(()=>{
    const months={};
    s.workouts.forEach(w=>{
      const mo=w.date.slice(0,7);
      if(!months[mo])months[mo]=[];
      months[mo].push(w);
    });
    return Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([mo,wks])=>{
      const sc=calcStrengthScore(wks,bw);
      return{date:mo.slice(5),score:sc.score};
    });
  },[s.workouts,bw]);

  // Score ring
  const pct=Math.min(100,data.score/2.5*100);
  const r=44,circ=2*Math.PI*r,offset=circ*(1-pct/100);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Main Score */}
      <Card style={{padding:16,textAlign:"center"}}>
        <svg width={100} height={100} style={{display:"block",margin:"0 auto 8px"}}>
          <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6}/>
          <circle cx={50} cy={50} r={r} fill="none" stroke={data.rankColor} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 50 50)" style={{transition:"stroke-dashoffset 1s ease"}}/>
          <text x={50} y={44} textAnchor="middle" fill={V.text} fontSize={22} fontWeight={800} fontFamily={V.mono}>{data.score.toFixed(2)}</text>
          <text x={50} y={62} textAnchor="middle" fill={data.rankColor} fontSize={10} fontWeight={700}>{data.rank}</text>
        </svg>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:4}}>
          {[{l:"Bench",v:data.lifts.bench,r:data.benchRatio,c:V.accent},
            {l:"Squat",v:data.lifts.squat,r:data.squatRatio,c:V.accent2},
            {l:"Dead",v:data.lifts.deadlift,r:data.deadRatio,c:V.purple}].map(x=>(
            <div key={x.l} style={{padding:"8px 4px",background:`${x.c}08`,borderRadius:8}}>
              <div style={{fontSize:16,fontWeight:800,color:x.c,fontFamily:V.mono}}>{x.v||"--"}</div>
              <div style={{fontSize:8,color:V.text3,textTransform:"uppercase",marginTop:1}}>{x.l} E1RM</div>
              <div style={{fontSize:10,color:x.c,fontFamily:V.mono,marginTop:2}}>{x.r}x BW</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:10}}>
          <span style={{fontSize:11,color:V.text3}}>Total: <span style={{color:V.text,fontWeight:700,fontFamily:V.mono}}>{data.total} {u}</span></span>
          <span style={{fontSize:11,color:V.text3}}>BW: <span style={{color:V.text,fontWeight:700,fontFamily:V.mono}}>{bw} {u}</span></span>
        </div>
      </Card>

      {/* Rank Scale */}
      <Card style={{padding:12}}>
        <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Rank Scale</span>
        <div style={{display:"flex",gap:4,marginBottom:4}}>
          {[{l:"Novice",min:0,max:0.5,c:V.text3},{l:"Beginner",min:0.5,max:1.0,c:V.warn},
            {l:"Inter",min:1.0,max:1.5,c:V.accent2},{l:"Advanced",min:1.5,max:2.0,c:V.accent},
            {l:"Elite",min:2.0,max:2.5,c:V.purple}].map(tier=>(
            <div key={tier.l} style={{flex:1,textAlign:"center"}}>
              <div style={{height:6,borderRadius:3,marginBottom:4,
                background:data.score>=tier.min?tier.c:"rgba(255,255,255,0.04)"}}/>
              <span style={{fontSize:7,color:data.score>=tier.min?tier.c:V.text3,fontWeight:600}}>{tier.l}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Badges */}
      {data.badges.length>0&&(
        <Card style={{padding:12}}>
          <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Badges Earned</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {data.badges.map((b,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",
                background:`${V.accent}10`,borderRadius:8,border:`1px solid ${V.accent}20`}}>
                <span>{b.icon}</span>
                <span style={{fontSize:10,color:V.accent,fontWeight:600}}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trend */}
      {trend.length>1&&(
        <Card style={{padding:12}}>
          <span style={{fontSize:12,color:V.text3,fontWeight:600,display:"block",marginBottom:8}}>Score Trend</span>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={trend}>
              <defs><linearGradient id="ssGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={V.accent} stopOpacity={0.2}/>
                <stop offset="100%" stopColor={V.accent} stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="date" {...chartCfg.axis} interval="preserveStartEnd"/>
              <YAxis {...chartCfg.axis} width={26} domain={[0,'dataMax+0.3']}/>
              <Tooltip {...chartCfg.tip}/>
              <Area type="monotone" dataKey="score" stroke={V.accent} strokeWidth={2} fill="url(#ssGrad)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}


function WeeklySummary({s}){
  const canvasRef=useRef(null);
  const [generated,setGenerated]=useState(false);

  const stats=useMemo(()=>{
    const ws=s.workouts.filter(w=>w.date>=ago(7));
    const ns=s.nutrition.filter(n=>n.date>=ago(7));
    const r=calcReadiness(s);
    const totalVol=ws.reduce((v,w)=>v+w.exercises.reduce((e,ex)=>e+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const avgCal=ns.length?Math.round(ns.reduce((a,n)=>a+n.cal,0)/ns.length):0;
    const avgProt=ns.length?Math.round(ns.reduce((a,n)=>a+n.protein,0)/ns.length):0;
    const protHit=ns.filter(n=>n.protein>=s.goals.protein*0.8).length;
    const avgSleep=ns.filter(n=>parseFloat(n.sleep)>0).length?
      (ns.filter(n=>parseFloat(n.sleep)>0).reduce((a,n)=>a+(parseFloat(n.sleep)||0),0)/ns.filter(n=>parseFloat(n.sleep)>0).length).toFixed(1):0;
    const activePhase=(s.phases||[]).find(p=>p.active);
    return{workouts:ws.length,totalVol,avgCal,avgProt,protHit,avgSleep,readiness:r.score,readinessLevel:r.level,
      readinessColor:r.color,phase:activePhase?.type||null};
  },[s]);

  const gen=()=>{
    const c=canvasRef.current;if(!c)return;
    const ctx=c.getContext("2d");c.width=600;c.height=440;
    const grad=ctx.createLinearGradient(0,0,600,440);
    grad.addColorStop(0,"#0a0a14");grad.addColorStop(1,"#14142a");
    ctx.fillStyle=grad;ctx.fillRect(0,0,600,440);
    ctx.fillStyle="#22d3ee";ctx.fillRect(0,0,4,440);

    ctx.fillStyle="#fff";ctx.font="bold 24px -apple-system, sans-serif";
    ctx.fillText("WEEKLY REVIEW",24,40);
    ctx.fillStyle="#666";ctx.font="13px -apple-system, sans-serif";
    const end=new Date();const start=new Date();start.setDate(start.getDate()-7);
    ctx.fillText(`${start.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`,24,62);

    if(stats.phase){ctx.fillStyle="#a78bfa";ctx.font="bold 11px -apple-system, sans-serif";ctx.fillText(`PHASE: ${stats.phase.toUpperCase()}`,420,40);}

    const rows=[
      {l:"WORKOUTS",v:String(stats.workouts),sub:"/7 days"},
      {l:"VOLUME",v:stats.totalVol>1000?`${(stats.totalVol/1000).toFixed(1)}k`:""+stats.totalVol,sub:`total ${wUnit(s.units)}`},
      {l:"AVG CALORIES",v:String(stats.avgCal),sub:"kcal/day"},
      {l:"AVG PROTEIN",v:`${stats.avgProt}g`,sub:`hit ${stats.protHit}/7 days`},
      {l:"AVG SLEEP",v:`${stats.avgSleep}h`,sub:"per night"},
      {l:"READINESS",v:String(stats.readiness),sub:stats.readinessLevel},
    ];
    rows.forEach((r,i)=>{
      const y=100+i*52;
      ctx.fillStyle="#444";ctx.fillRect(24,y+35,552,1);
      ctx.fillStyle="#888";ctx.font="10px -apple-system, sans-serif";ctx.fillText(r.l,24,y+12);
      ctx.fillStyle="#22d3ee";ctx.font="bold 24px -apple-system, sans-serif";ctx.fillText(r.v,24,y+34);
      ctx.fillStyle="#555";ctx.font="12px -apple-system, sans-serif";ctx.fillText(r.sub,180,y+34);
    });

    ctx.fillStyle="#333";ctx.font="bold 11px -apple-system, sans-serif";ctx.fillText("IRONLOG",24,425);
    ctx.fillStyle="#555";ctx.font="10px -apple-system, sans-serif";ctx.fillText("ironlog.space",100,425);
    setGenerated(true);
  };

  const share=()=>{
    const c=canvasRef.current;if(!c)return;
    c.toBlob(blob=>{
      if(navigator.share&&blob){
        navigator.share({files:[new File([blob],"weekly-review.png",{type:"image/png"})],title:"Weekly Review"}).catch(()=>{});
      }else{
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`review-${today()}.png`;a.click();URL.revokeObjectURL(url);
      }
    },"image/png");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Weekly Summary</div>

      <Card style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{l:"Workouts",v:stats.workouts,c:V.accent},{l:"Avg Cal",v:stats.avgCal,c:V.warn},{l:"Readiness",v:stats.readiness,c:stats.readinessColor},
            {l:"Protein Hit",v:`${stats.protHit}/7`,c:V.accent2},{l:"Avg Sleep",v:`${stats.avgSleep}h`,c:V.purple},{l:"Volume",v:stats.totalVol>1000?`${(stats.totalVol/1000).toFixed(1)}k`:stats.totalVol,c:V.accent}
          ].map(m=>(
            <div key={m.l} style={{textAlign:"center",padding:"10px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:18,fontWeight:800,color:m.c,fontFamily:V.mono}}>{m.v}</div>
              <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{m.l}</div>
            </div>
          ))}
        </div>
      </Card>

      <canvas ref={canvasRef} style={{width:"100%",borderRadius:12,display:generated?"block":"none"}}/>
      {!generated?(
        <Btn full onClick={gen}>{Icons.chart({size:14,color:V.bg})} Generate Report Card</Btn>
      ):(
        <div style={{display:"flex",gap:8}}>
          <Btn full onClick={share}>{Icons.upload({size:14,color:V.bg})} Share</Btn>
          <Btn v="secondary" full onClick={()=>setGenerated(false)}>Close</Btn>
        </div>
      )}
    </div>
  );
}

export { OneRMCalc, ProgressPhotos, MuscleHeatMap, StrengthScoreCard, WeeklySummary };


// ─── Missing pieces added at end ───
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

export { ReadinessTrend, AnalyticsTab, CalendarTab };
