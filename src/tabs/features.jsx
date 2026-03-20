import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Stat, Progress, Skeleton, SkeletonCard, SuccessToastCtrl, ConfirmCtrl, MsgBannerCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, calc1RM, calcPlates, PLATES, convW, wUnit, dUnit, isCardio, toKg, toLbs, friendDisplayName, chartCfg } from '../utils/helpers';
import { CloudSync, SocialAPI, SYNC_URL, APP_VERSION } from '../utils/sync';
import { Undo } from '../utils/undo';
import { ShareCard } from '../utils/share';
import { BADGE_DEFS, calcEarnedBadges } from '../data/badges';
import { TEMPLATES } from '../data/templates';
import { IRON_RANKS } from '../data/ranks';
import { FOODS } from '../data/foods';
import { AuthToken } from '../utils/auth';
import { calcReadiness, useStreak, usePRs, useNutritionStreak } from '../components/dialogs';

export function OneRMCalc({units}){
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
export function compressImage(file,maxDim=800,quality=0.7){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      // #B6: Revoke the blob URL immediately after the image loads — it was previously
      // left pinned in memory until page unload, accumulating on every photo logged.
      URL.revokeObjectURL(img.src);
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
    img.onerror=()=>{URL.revokeObjectURL(img.src);resolve(null);};
    img.src=URL.createObjectURL(file);
  });
}

export function ProgressPhotos({s,d}){
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
      // Upload video to R2 via API (supports mp4/mov up to 50MB)
      if(file.size>50*1024*1024){SuccessToastCtrl.show("Video too large (max 50MB)");setCompressing(false);e.target.value="";return;}
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        const base64=ev.target.result;
        const blobUrl=URL.createObjectURL(file);
        const entry={id:uid(),date:today(),data:blobUrl,note:"",
          size:file.size,original:file.name,private:!!isPrivate,type:"video",mime:file.type};
        d({type:"ADD_PHOTO",photo:entry});
        if(s.profile?.email){
          try{
            const res=await fetch(`${SYNC_URL}/api/photos/upload`,{
              method:"POST",headers:AuthToken.getHeaders(s.profile.email),
              body:JSON.stringify({email:s.profile.email,photoId:entry.id,date:entry.date,
                data:base64,private:!!isPrivate,type:"video"})
            });
            const json=await res.json();
            if(json.url){d({type:"UPDATE_PHOTO",id:entry.id,url:json.url});}
            SuccessToastCtrl.show(isPrivate?"Video saved to vault":"Video saved & synced ✓");
          }catch(e2){
            console.warn("Video upload failed:",e2);
            SuccessToastCtrl.show("Video saved locally");
          }
        }else{
          SuccessToastCtrl.show("Video saved locally");
        }
        setCompressing(false);
      };
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
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",
        touchAction:"none"}} onClick={()=>setViewPhoto(null)}>
        {/* Top bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",flexShrink:0}}
          onClick={e=>e.stopPropagation()}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{fmtFull(p.date)}</div>
            {p.private&&<div style={{fontSize:9,color:V.purple}}>🔒 Private</div>}
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
          <button onClick={()=>{ConfirmCtrl.show("Delete this photo?","This cannot be undone.",()=>{Undo.set("Photo deleted",p,"photo");d({type:"DEL_PHOTO",id:p.id});setViewPhoto(null);SuccessToastCtrl.show("Photo deleted");});}}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:V.danger,fontFamily:V.font}}>
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
            <img loading="lazy" src={p.data} alt={`Progress photo from ${fmtShort(p.date)}`} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
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
              {p.type==="video"&&<span style={{fontSize:8,color:V.accent2}}>🎥 Video</span>}
              {isVault&&<span style={{fontSize:8,color:V.purple}}>🔒 Private</span>}
            </div>
          </div>
          <button onClick={e=>{e.stopPropagation();ConfirmCtrl.show(`Delete this ${p.type==="video"?"video":"photo"}?`,"This cannot be undone.",()=>{Undo.set("Deleted",p,"photo");d({type:"DEL_PHOTO",id:p.id});SuccessToastCtrl.show("Deleted");});}} style={{position:"absolute",top:6,right:6,
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
          <input ref={fileRef} type="file" accept={"image/" + "*,video/" + "*"} capture="environment" onChange={e=>handlePhoto(e,false)}
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
                <input ref={fileRef} type="file" accept={"image/" + "*,video/" + "*"} capture="environment" onChange={e=>handlePhoto(e,true)}
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
              <button onClick={()=>{ConfirmCtrl.show("Reset vault PIN?","This won't delete photos.",()=>{LS.set("ft-vault-pin",null);setVaultLocked(true);SuccessToastCtrl.show("Vault PIN reset");});}}
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
export function ProfileEditor({s,d}){
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

// ─── Admin Panel (only accessible with is_admin=true on server) ───
export function AdminPanel({s,initialView}){
  const [view,setView]=useState(initialView||"dashboard");
  const [dash,setDash]=useState(null);
  const [users,setUsers]=useState([]);
  const [selUser,setSelUser]=useState(null);
  const [userData,setUserData]=useState(null);
  const [health,setHealth]=useState(null);
  const [groups,setGroups]=useState([]);
  const [dmData,setDmData]=useState(null);
  const [gcData,setGcData]=useState(null);
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState({key:"created",dir:"desc"});
  const [filter,setFilter]=useState("all");
  const [loading,setLoading]=useState(false);
  const [dmUserA,setDmUserA]=useState("");
  const [dmUserB,setDmUserB]=useState("");
  const [selGroupCode,setSelGroupCode]=useState("");
  const [enlargedPhoto,setEnlargedPhoto]=useState(null);
  const [banResult,setBanResult]=useState(null);
  const [banWorking,setBanWorking]=useState(false);
  const token=LS.get("ft-session-token");
  const headers={"Content-Type":"application/json","X-Session-Token":token};
  const af=async(action,extra={})=>{
    try{const r=await fetch(`${SYNC_URL}/api/admin`,{method:"POST",headers,body:JSON.stringify({action,...extra})});
      return r.ok?await r.json():null;}catch(e){return null;}
  };
  useEffect(()=>{
    af("dashboard").then(setDash);
    if(initialView==="users"||initialView==="lookup"||initialView==="moderation")loadUsers();
    if(initialView==="health")loadHealth();
    if(initialView==="moderation")loadGroups();
  },[]);

  const loadUsers=()=>{setLoading(true);af("users").then(r=>{setUsers(r?.users||[]);setLoading(false);});};
  const loadDetail=(email)=>{setLoading(true);setSelUser(email);setBanResult(null);af("user_detail",{email}).then(r=>{setUserData(r);setLoading(false);setView("detail");});};
  const banUser=async(email,ban)=>{
    setBanWorking(true);setBanResult(null);
    const r=await af("ban_user",{email,ban});
    if(r?.success){
      setBanResult({ok:true,msg:ban?"User banned — all sessions revoked":"User unbanned successfully"});
      setUserData(d=>({...d,profile:{...d.profile,is_banned:ban}}));
    }else setBanResult({ok:false,msg:"Failed — check admin session"});
    setBanWorking(false);
  };
  const loadHealth=()=>{af("health").then(setHealth);};
  const loadGroups=()=>{af("groups").then(r=>setGroups(r?.groups||[]));};
  const loadDMs=()=>{if(!dmUserA||!dmUserB)return;af("view_dms",{user_a:dmUserA,user_b:dmUserB}).then(setDmData);};
  const loadGroupChat=(code)=>{setSelGroupCode(code);af("view_group_chat",{group_code:code}).then(setGcData);};

  const sorted=useMemo(()=>{
    let f=[...users];
    if(filter==="active")f=f.filter(u=>u.lastSync&&new Date(u.lastSync)>new Date(Date.now()-7*86400000));
    if(filter==="inactive")f=f.filter(u=>!u.lastSync||new Date(u.lastSync)<new Date(Date.now()-30*86400000));
    if(filter==="photos")f=f.filter(u=>u.photos>0);
    if(filter==="vault")f=f.filter(u=>u.vaultPhotos>0);
    if(filter==="admin")f=f.filter(u=>u.isAdmin);
    if(search){const q=search.toLowerCase();f=f.filter(u=>u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.username||"").toLowerCase().includes(q));}
    f.sort((a,b)=>{let va=a[sort.key],vb=b[sort.key];
      if(typeof va==="string")return sort.dir==="asc"?(va||"").localeCompare(vb||""):(vb||"").localeCompare(va||"");
      return sort.dir==="asc"?(va||0)-(vb||0):(vb||0)-(va||0);});
    return f;
  },[users,sort,filter,search]);

  const toggleSort=(key)=>setSort(s2=>s2.key===key?{key,dir:s2.dir==="asc"?"desc":"asc"}:{key,dir:"desc"});
  const SortH=({k,l})=><button onClick={()=>toggleSort(k)} style={{background:"none",border:"none",padding:"4px 0",cursor:"pointer",
    fontSize:9,fontWeight:700,color:sort.key===k?V.accent:V.text3,fontFamily:V.font,textAlign:"left"}}>
    {l}{sort.key===k?(sort.dir==="asc"?" ↑":" ↓"):""}</button>;

  const ago2=(d)=>{if(!d)return"Never";const ms=Date.now()-new Date(d).getTime();const h=Math.floor(ms/3600000);
    if(h<1)return"Just now";if(h<24)return`${h}h ago`;const days=Math.floor(h/24);return days<7?`${days}d ago`:`${Math.floor(days/7)}w ago`;};

  // ═══ USER DETAIL ═══
  if(view==="detail"&&userData)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Fullscreen photo viewer */}
      {enlargedPhoto&&(
        <div onClick={()=>setEnlargedPhoto(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,
          background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16,cursor:"pointer"}}>
          <button onClick={()=>setEnlargedPhoto(null)} style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.1)",
            border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}>
            {Icons.x({size:18,color:"#fff"})}</button>
          <img src={enlargedPhoto.public_url||enlargedPhoto.photo_data} alt="" style={{maxWidth:"100%",maxHeight:"80vh",objectFit:"contain",borderRadius:8}}/>
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"#fff"}}>{(enlargedPhoto.date||enlargedPhoto.created_at||"").slice(0,10)}</span>
            {enlargedPhoto.is_private&&<span style={{padding:"2px 8px",borderRadius:4,background:"rgba(168,85,247,0.3)",fontSize:10,color:"#fff"}}>🔒 Vault</span>}
          </div>
          {/* Prev/Next navigation */}
          {userData.photos?.length>1&&(()=>{
            const idx=userData.photos.findIndex(p=>(p.photo_id||p.id)===(enlargedPhoto.photo_id||enlargedPhoto.id));
            return(
              <div style={{display:"flex",gap:20,marginTop:12}}>
                {idx>0&&<button onClick={e=>{e.stopPropagation();setEnlargedPhoto(userData.photos[idx-1]);}} style={{padding:"8px 16px",borderRadius:8,
                  background:"rgba(255,255,255,0.1)",border:"none",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600}}>← Prev</button>}
                <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",alignSelf:"center"}}>{idx+1} / {userData.photos.length}</span>
                {idx<userData.photos.length-1&&<button onClick={e=>{e.stopPropagation();setEnlargedPhoto(userData.photos[idx+1]);}} style={{padding:"8px 16px",borderRadius:8,
                  background:"rgba(255,255,255,0.1)",border:"none",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600}}>Next →</button>}
              </div>
            );
          })()}
        </div>
      )}
      <button onClick={()=>{setView("users");setUserData(null);setEnlargedPhoto(null);}} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span></button>

      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:V.text}}>{userData.profile?.first_name} {userData.profile?.last_name}</div>
            <div style={{fontSize:10,color:V.text3,fontFamily:V.mono}}>{selUser}</div>
            {userData.profile?.username&&<div style={{fontSize:10,color:V.accent}}>@{userData.profile.username}</div>}
          </div>
          {userData.profile?.is_admin&&<span style={{padding:"2px 8px",borderRadius:4,background:V.danger+"15",fontSize:9,fontWeight:700,color:V.danger}}>ADMIN</span>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:10}}>
          {[{l:"Workouts",v:userData.workouts?.length,c:V.accent},{l:"Nutrition",v:userData.nutrition?.length,c:V.warn},
            {l:"Photos",v:userData.photos?.length,c:V.accent2},{l:"Body",v:userData.body?.length,c:V.purple},
            {l:"Check-ins",v:userData.checkins?.length,c:"#ec4899"},{l:"Friends",v:userData.friends?.length,c:"#06b6d4"},
            {l:"Activity",v:userData.activity?.length,c:"#f97316"},{l:"Syncs",v:userData.syncHistory?.length,c:V.text3}
          ].map(st=><div key={st.l} style={{textAlign:"center",padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
            <div style={{fontSize:14,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v||0}</div><div style={{fontSize:7,color:V.text3}}>{st.l}</div></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:8,fontSize:9,color:V.text3}}>
          <div>Level: {userData.profile?.fitness_level||"—"}</div><div>Units: {userData.profile?.units||"lbs"}</div>
          <div>PIN: {userData.profile?.account_pin?"Set":"None"}</div><div>Created: {userData.profile?.created_at?.slice(0,10)}</div>
        </div>
        <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {userData.profile?.is_banned?(
            <button onClick={()=>banUser(selUser,false)} disabled={banWorking}
              style={{padding:"7px 16px",borderRadius:8,background:V.accent+"15",border:`1px solid ${V.accent}40`,
                cursor:"pointer",fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>
              {banWorking?"Working…":"✓ Unban User"}
            </button>
          ):(
            <button onClick={()=>{if(window.confirm(`Ban ${selUser}?\nThis revokes all active sessions.`))banUser(selUser,true);}} disabled={banWorking}
              style={{padding:"7px 16px",borderRadius:8,background:V.danger+"15",border:`1px solid ${V.danger}40`,
                cursor:"pointer",fontSize:11,fontWeight:700,color:V.danger,fontFamily:V.font}}>
              {banWorking?"Working…":"🚫 Ban User"}
            </button>
          )}
          {banResult&&<span style={{fontSize:10,fontWeight:600,color:banResult.ok?V.accent:V.danger}}>{banResult.msg}</span>}
        </div>
      </Card>

      {/* Gamification */}
      {userData.settings?.gamification&&(()=>{
        const g=userData.settings.gamification;
        const bonusXP=g.xp_bonus?.total||0;
        const lastKnownLevel=g.last_known_level||1;
        const rank=IRON_RANKS.find(r=>r.level===lastKnownLevel)||IRON_RANKS[0];
        const shields=g.streak_shields||0;
        const badgeDates=g.badge_dates||{};
        const badgeCount=Object.keys(badgeDates).length;
        const missionDays=Object.keys(g.missions_completed||{}).length;
        return(
          <Card style={{padding:12,border:`1px solid ${rank.color}20`,background:`${rank.color}04`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:V.text}}>⚡ Gamification</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14}}>{rank.icon}</span>
                <span style={{fontSize:11,fontWeight:800,color:rank.color}}>{rank.name}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {[
                {l:"Bonus XP",v:bonusXP.toLocaleString(),c:V.accent},
                {l:"Level",v:lastKnownLevel,c:rank.color},
                {l:"Shields",v:shields,c:"#22c55e"},
                {l:"Badges",v:badgeCount,c:"#f59e0b"},
                {l:"Mission Days",v:missionDays,c:V.accent2},
                {l:"Duels",v:(g.duels||[]).length,c:V.purple},
                {l:"War Wins",v:g.war_wins||0,c:"#f43f5e"},
                {l:"Rivals",v:(g.rivals||[]).length,c:"#ec4899"},
              ].map(st=>(
                <div key={st.l} style={{textAlign:"center",padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                  <div style={{fontSize:13,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                  <div style={{fontSize:7,color:V.text3}}>{st.l}</div>
                </div>
              ))}
            </div>
            {g.xp_bonus?.log?.length>0&&(
              <div style={{marginTop:8,maxHeight:80,overflowY:"auto"}}>
                {g.xp_bonus.log.slice(0,5).map((e2,i)=>(
                  <div key={i} style={{fontSize:8,color:V.text3,padding:"2px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                    {e2.date} · <span style={{color:e2.amount>0?V.accent:V.danger}}>{e2.amount>0?"+":""}{e2.amount} XP</span> · {e2.reason}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Settings */}
      {userData.settings&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:4}}>Settings</div>
        <div style={{fontSize:9,color:V.text3,lineHeight:1.8}}>
          Goals: {userData.settings.goals?.cal||"—"}cal · {userData.settings.goals?.protein||"—"}P<br/>
          Schedule: {Object.values(userData.settings.schedule?.weekly||{}).join(", ")||"—"}<br/>
          Phases: {(userData.settings.phases||[]).length} · Injuries: {(userData.settings.injuries||[]).length} · Supps: {(userData.settings.supplements||[]).length}
        </div>
      </Card>}

      {/* Workouts */}
      <Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Workouts ({userData.workouts?.length})</div>
        <div style={{maxHeight:200,overflowY:"auto"}}>
          {(userData.workouts||[]).map((w,i)=><div key={i} style={{padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:10,color:V.text2}}>
            <span style={{fontFamily:V.mono,color:V.accent}}>{w.date}</span> — {(w.exercises||[]).length} ex · {w.duration||"?"}min
            {(w.exercises||[]).length>0&&<span style={{color:V.text3}}> ({(w.exercises||[]).map(e=>e.exerciseId).join(", ")})</span>}
          </div>)}
        </div>
      </Card>

      {/* Body */}
      {userData.body?.length>0&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Body ({userData.body.length})</div>
        {userData.body.slice(0,10).map((b,i)=><div key={i} style={{padding:"3px 0",fontSize:9,color:V.text3}}>
          {b.date} — {b.weight}{userData.profile?.units==="kg"?"kg":"lbs"} {b.body_fat?`· ${b.body_fat}%`:""} {b.chest?`· C:${b.chest}`:""} {b.waist?`W:${b.waist}`:""}
        </div>)}
      </Card>}

      {/* ALL Photos */}
      {userData.photos?.length>0&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Photos ({userData.photos.length}) <span style={{color:V.danger,fontSize:8}}>all including vault</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4}}>
          {userData.photos.map((p,i)=><div key={i} onClick={()=>{if(p.public_url||p.photo_data)setEnlargedPhoto(p);}} style={{position:"relative",borderRadius:6,overflow:"hidden",aspectRatio:"1",
            border:`1px solid ${p.is_private?V.purple+"40":V.cardBorder}`,cursor:(p.public_url||p.photo_data)?"pointer":"default"}}>
            {(p.public_url||p.photo_data)?<img loading="lazy" src={p.public_url||p.photo_data} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{width:"100%",height:"100%",background:"rgba(255,255,255,0.02)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:V.text3}}>No URL</div>}
            {p.is_private&&<div style={{position:"absolute",top:1,right:1,padding:"0 3px",borderRadius:2,background:"rgba(168,85,247,0.8)",fontSize:6,color:"#fff"}}>🔒</div>}
            <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"1px 2px",background:"rgba(0,0,0,0.7)",fontSize:6,color:"#fff"}}>{(p.date||p.created_at||"").slice(0,10)}</div>
          </div>)}
        </div>
      </Card>}

      {/* Check-ins */}
      {userData.checkins?.length>0&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Check-ins ({userData.checkins.length})</div>
        {userData.checkins.slice(0,10).map((c,i)=><div key={i} style={{padding:"3px 0",fontSize:9,color:V.text3}}>
          {c.date} — Sleep:{c.sleep}h · Soreness:{c.soreness}/10 · Energy:{c.energy}/10 · Mood:{c.motivation}/10
        </div>)}
      </Card>}

      {/* Friends */}
      {userData.friends?.length>0&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Friends ({userData.friends.length})</div>
        {userData.friends.map((f,i)=><div key={i} style={{padding:"3px 0",fontSize:9,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:V.text2}}>{f.name}</span>
          <span style={{color:f.status==="accepted"?V.accent:V.warn}}>{f.status}</span>
        </div>)}
      </Card>}

      {/* Activity log */}
      {userData.activity?.length>0&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Activity ({userData.activity.length})</div>
        <div style={{maxHeight:150,overflowY:"auto"}}>
          {userData.activity.map((a,i)=><div key={i} style={{padding:"3px 0",fontSize:8,color:V.text3,borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
            {a.created_at?.slice(0,16)} · <span style={{color:V.accent}}>{a.event_type}</span> · {JSON.stringify(a.event_data||{}).slice(0,60)}
          </div>)}
        </div>
      </Card>}

      {/* Sync history */}
      {userData.syncHistory?.length>0&&<Card style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Sync Log</div>
        {userData.syncHistory.map((l,i)=><div key={i} style={{padding:"2px 0",fontSize:8,color:V.text3}}>
          {l.synced_at?.slice(0,16)} · {l.device_id?.slice(0,12)} · {l.records_synced||"?"} records
        </div>)}
      </Card>}
    </div>
  );

  // ═══ MODERATION VIEW ═══
  if(view==="moderation")return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <button onClick={()=>setView("dashboard")} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span></button>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Content Moderation</div>

      {/* DM Viewer */}
      <Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>View DMs Between Users</div>
        {users.length===0&&<Btn v="secondary" full onClick={loadUsers} s={{marginBottom:8}}>Load Users</Btn>}
        {users.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
            <select value={dmUserA} onChange={e=>setDmUserA(e.target.value)}
              style={{padding:"10px 12px",background:V.bg,border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}>
              <option value="">Select User A...</option>
              {users.map((u,i)=><option key={i} value={u.email}>{u.name} (@{u.username||u.email.split("@")[0]})</option>)}
            </select>
            <select value={dmUserB} onChange={e=>setDmUserB(e.target.value)}
              style={{padding:"10px 12px",background:V.bg,border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}>
              <option value="">Select User B...</option>
              {users.filter(u=>u.email!==dmUserA).map((u,i)=><option key={i} value={u.email}>{u.name} (@{u.username||u.email.split("@")[0]})</option>)}
            </select>
          </div>
        )}
        <Btn v="secondary" full onClick={loadDMs} disabled={!dmUserA||!dmUserB}>Load DMs</Btn>
        {dmData&&(
          <div style={{marginTop:8,maxHeight:300,overflowY:"auto"}}>
            {dmData.messages?.length===0&&<div style={{fontSize:10,color:V.text3,padding:8}}>No messages found</div>}
            {(dmData.messages||[]).map((m,i)=><div key={i} style={{padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:10}}>
              <span style={{color:V.accent,fontWeight:700}}>{m.name}</span>
              <span style={{color:V.text3}}> · {m.ts?.slice(0,16)}</span>
              <div style={{color:V.text2,marginTop:2}}>{m.text}</div>
            </div>)}
          </div>
        )}
      </Card>

      {/* Group Chat Viewer */}
      <Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>View Group Chat</div>
        {groups.length===0&&<Btn v="secondary" full onClick={loadGroups} s={{marginBottom:8}}>Load Groups</Btn>}
        {groups.length>0&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
            {groups.map((g,i)=><button key={i} onClick={()=>loadGroupChat(g.code)} style={{padding:"4px 10px",borderRadius:6,
              background:selGroupCode===g.code?V.accent+"10":"rgba(255,255,255,0.03)",border:`1px solid ${selGroupCode===g.code?V.accent+"30":V.cardBorder}`,
              cursor:"pointer",fontSize:10,color:selGroupCode===g.code?V.accent:V.text3,fontFamily:V.font}}>{g.name} ({g.memberCount})</button>)}
          </div>
        )}
        {gcData&&(
          <div style={{maxHeight:300,overflowY:"auto"}}>
            {gcData.messages?.length===0&&<div style={{fontSize:10,color:V.text3,padding:8}}>No messages</div>}
            {(gcData.messages||[]).map((m,i)=><div key={i} style={{padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:10}}>
              <span style={{color:V.purple,fontWeight:700}}>{m.name}</span>
              <span style={{color:V.text3}}> · {m.ts?.slice(0,16)}</span>
              <div style={{color:V.text2,marginTop:2}}>{m.text}</div>
            </div>)}
          </div>
        )}
      </Card>
    </div>
  );

  // ═══ USERS TABLE ═══
  if(view==="users")return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <button onClick={()=>setView("dashboard")} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span></button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Users ({sorted.length})</div>
        <Btn v="secondary" onClick={loadUsers} s={{fontSize:10}}>Refresh</Btn>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, username..."
        style={{padding:"10px 14px",background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:10,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[{id:"all",l:"All"},{id:"active",l:"Active 7d"},{id:"inactive",l:"Inactive 30d"},{id:"photos",l:"Has Photos"},{id:"vault",l:"Has Vault"},{id:"admin",l:"Admins"}].map(f2=>(
          <button key={f2.id} onClick={()=>setFilter(f2.id)} style={{padding:"4px 10px",borderRadius:6,
            background:filter===f2.id?V.accent+"10":"rgba(255,255,255,0.03)",border:`1px solid ${filter===f2.id?V.accent+"30":V.cardBorder}`,
            cursor:"pointer",fontSize:9,fontWeight:600,color:filter===f2.id?V.accent:V.text3,fontFamily:V.font}}>{f2.l}</button>
        ))}
      </div>
      {/* Sort headers */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,padding:"0 4px"}}>
        <SortH k="name" l="NAME"/><SortH k="workouts" l="WORK"/><SortH k="photos" l="PHOTOS"/><SortH k="created" l="JOINED"/>
      </div>
      {loading&&<div><SkeletonCard lines={2}/><div style={{height:8}}/><SkeletonCard lines={2}/><div style={{height:8}}/><SkeletonCard lines={2}/></div>}
      {sorted.map((u,i)=>(
        <Card key={i} style={{padding:10,cursor:"pointer"}} onClick={()=>loadDetail(u.email)}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:4,alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:V.text}}>{u.name} {u.isAdmin&&<span style={{fontSize:7,color:V.danger}}>⭐</span>}</div>
              <div style={{fontSize:8,color:V.text3}}>@{u.username||"—"} · {ago2(u.lastSync)}</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:V.accent,fontFamily:V.mono,textAlign:"center"}}>{u.workouts}</div>
            <div style={{textAlign:"center"}}>
              <span style={{fontSize:12,fontWeight:700,color:V.accent2,fontFamily:V.mono}}>{u.photos}</span>
              {u.vaultPhotos>0&&<span style={{fontSize:8,color:V.purple}}> +{u.vaultPhotos}🔒</span>}
            </div>
            <div style={{fontSize:9,color:V.text3,textAlign:"right"}}>{u.created?.slice(0,10)}</div>
          </div>
        </Card>
      ))}
    </div>
  );

  // ═══ USER LOOKUP ═══
  if(view==="lookup")return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>🔍 User Lookup</div>
      <div style={{fontSize:10,color:V.text3}}>Search by name, email, or username — tap to view full profile</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." autoFocus
        style={{padding:"12px 14px",background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:12,color:V.text,fontSize:14,outline:"none",fontFamily:V.font}}/>
      {loading&&<div><SkeletonCard lines={2}/><div style={{height:8}}/><SkeletonCard lines={2}/></div>}
      {search&&sorted.slice(0,15).map((u,i)=>(
        <Card key={i} style={{padding:12,cursor:"pointer"}} onClick={()=>loadDetail(u.email)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:V.text}}>{u.name} {u.isAdmin&&<span style={{fontSize:7,color:V.danger}}>ADMIN</span>}</div>
              <div style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>{u.email}</div>
              {u.username&&<div style={{fontSize:9,color:V.accent}}>@{u.username}</div>}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{u.workouts}</div>
              <div style={{fontSize:8,color:V.text3}}>workouts</div>
              {u.photos>0&&<div style={{fontSize:8,color:V.accent2}}>{u.photos} 📸{u.vaultPhotos>0?` +${u.vaultPhotos}🔒`:""}</div>}
            </div>
          </div>
        </Card>
      ))}
      {search&&sorted.length===0&&!loading&&<div style={{textAlign:"center",padding:20,fontSize:12,color:V.text3}}>No users found</div>}
      {!search&&<div style={{textAlign:"center",padding:30,fontSize:12,color:V.text3}}>Type to search...</div>}
    </div>
  );

  // ═══ PLATFORM HEALTH ═══
  if(view==="health")return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>🩺 Platform Health</div>
      {!health&&<Btn full onClick={loadHealth}>Load Health Data</Btn>}
      {health&&(<>
        <Card style={{padding:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div style={{textAlign:"center",padding:8,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:20,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{health.totalActive}</div>
              <div style={{fontSize:8,color:V.text3}}>ACTIVE SESSIONS</div>
            </div>
            <div style={{textAlign:"center",padding:8,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:20,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{health.staleUsers}</div>
              <div style={{fontSize:8,color:V.text3}}>STALE (30d+)</div>
            </div>
            <div style={{textAlign:"center",padding:8,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:20,fontWeight:800,color:V.danger,fontFamily:V.mono}}>{health.activeNotSyncing}</div>
              <div style={{fontSize:8,color:V.text3}}>NOT SYNCING</div>
            </div>
          </div>
        </Card>
        {health.staleList?.length>0&&(
          <Card style={{padding:12}}>
            <div style={{fontSize:11,fontWeight:700,color:V.warn,marginBottom:6}}>Stale Users (no sync in 30+ days)</div>
            {health.staleList.map((e,i)=><div key={i} style={{padding:"3px 0",fontSize:9,color:V.text3,fontFamily:V.mono,
              borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer"}} onClick={()=>loadDetail(e)}>{e}</div>)}
          </Card>
        )}
        {health.notSyncingList?.length>0&&(
          <Card style={{padding:12}}>
            <div style={{fontSize:11,fontWeight:700,color:V.danger,marginBottom:6}}>Active but Not Syncing (session active, no sync 7d)</div>
            {health.notSyncingList.map((e,i)=><div key={i} style={{padding:"3px 0",fontSize:9,color:V.text3,fontFamily:V.mono,
              borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer"}} onClick={()=>loadDetail(e)}>{e}</div>)}
          </Card>
        )}
        <Btn v="secondary" full onClick={loadHealth}>Refresh</Btn>
      </>)}
    </div>
  );

  // ═══ DASHBOARD ═══
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>🔐</span>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Admin Panel</div>
          <div style={{fontSize:10,color:V.danger}}>Server-verified · {s.profile?.email}</div>
        </div>
      </div>

      {dash&&(<>
        <Card style={{padding:14}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Platform Overview</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {[{l:"TOTAL USERS",v:dash.totalUsers,c:V.accent},{l:"ACTIVE (7d)",v:dash.activeUsers7d,c:"#22d3ee"},
              {l:"NEW (7d)",v:dash.newUsers7d,c:"#ec4899"},
              {l:"WORKOUTS",v:dash.totalWorkouts,c:V.warn},{l:"TODAY",v:dash.workoutsToday,c:V.accent},
              {l:"THIS WEEK",v:dash.workouts7d,c:V.accent2},
              {l:"NUTRITION",v:dash.totalNutrition,c:"#f97316"},{l:"PHOTOS",v:dash.totalPhotos,c:V.purple},
              {l:"SESSIONS",v:dash.activeSessions,c:V.text3}
            ].map(st=><div key={st.l} style={{textAlign:"center",padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:16,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
              <div style={{fontSize:7,color:V.text3}}>{st.l}</div>
            </div>)}
          </div>
        </Card>

        {dash.chartData&&<Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:8}}>14-Day Trend</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={dash.chartData} barSize={6}>
              <CartesianGrid {...chartCfg.grid} vertical={false}/>
              <XAxis dataKey="date" {...chartCfg.axis} interval={2}/>
              <YAxis {...chartCfg.axis} width={20}/>
              <Tooltip {...chartCfg.tip}/>
              <Bar dataKey="workouts" fill={V.accent} radius={[2,2,0,0]}/>
              <Bar dataKey="signups" fill="#ec4899" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:4}}>
            <span style={{fontSize:9,color:V.accent}}>■ Workouts</span>
            <span style={{fontSize:9,color:"#ec4899"}}>■ Signups</span>
          </div>
        </Card>}
      </>)}

      {/* Health */}
      {health&&<Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:6}}>Platform Health</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{health.totalActive}</div><div style={{fontSize:8,color:V.text3}}>Active Sessions</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{health.staleUsers}</div><div style={{fontSize:8,color:V.text3}}>Stale (30d+)</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:V.danger,fontFamily:V.mono}}>{health.activeNotSyncing}</div><div style={{fontSize:8,color:V.text3}}>Not Syncing</div></div>
        </div>
        {health.notSyncingList?.length>0&&<div style={{fontSize:8,color:V.text3,marginTop:6}}>Not syncing: {health.notSyncingList.slice(0,5).join(", ")}</div>}
      </Card>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn full onClick={()=>{loadUsers();setView("users");}}>{Icons.target({size:14,color:V.bg})} Users</Btn>
        <Btn full onClick={()=>{loadGroups();setView("moderation");}} s={{background:V.purple}}>{Icons.activity({size:14,color:V.bg})} Moderation</Btn>
      </div>
      <Btn v="secondary" full onClick={()=>{loadHealth();af("dashboard").then(setDash);}}>Refresh All</Btn>
    </div>
  );
}


export function DataManager({s,d}){
  const fileRef=useRef(null);
  const [msg,setMsg]=useState(null);
  const [restoring,setRestoring]=useState(false);
  const lastSync=LS.get("ft-last-sync");

  const exportData=()=>{
    const data={
      _ironlog:{version:APP_VERSION,exported:new Date().toISOString(),platform:`IRONLOG v${APP_VERSION}`},
      workouts:s.workouts,nutrition:s.nutrition,body:s.body,exercises:s.exercises,
      goals:s.goals,schedule:s.schedule,units:s.units,photos:s.photos||[],profile:s.profile||{},checkins:s.checkins||[],milestones:s.milestones||[],phases:s.phases||[],injuries:s.injuries||[],
      // Gamification state
      xp_bonus:LS.get("ft-xp-bonus"),missions_completed:LS.get("ft-missions-completed"),
      streak_shields:LS.get("ft-streak-shields"),shield_used_date:LS.get("ft-shield-used-date"),
      shield_awarded_streak:LS.get("ft-shield-awarded-streak"),comeback_used:LS.get("ft-comeback-used"),
      last_known_level:LS.get("ft-last-known-level"),duels:LS.get("ft-duels"),rivals:LS.get("ft-rivals"),
      war_wins:LS.get("ft-war-wins"),war_streak:LS.get("ft-war-streak")
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
        // Restore gamification LS keys if present in backup
        const gKeys={xp_bonus:"ft-xp-bonus",missions_completed:"ft-missions-completed",streak_shields:"ft-streak-shields",
          shield_used_date:"ft-shield-used-date",shield_awarded_streak:"ft-shield-awarded-streak",comeback_used:"ft-comeback-used",
          last_known_level:"ft-last-known-level",duels:"ft-duels",rivals:"ft-rivals",war_wins:"ft-war-wins",war_streak:"ft-war-streak"};
        Object.entries(gKeys).forEach(([bKey,lsKey])=>{if(data[bKey]!=null)LS.set(lsKey,data[bKey]);});
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
      const newC=(cloud.checkins||[]).filter(c=>!c.deleted&&!existingCheckinDates.has(c.date));
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
      // vault_pin no longer restored from server (kept local-only)
      if(cloud.phases)d({type:"SET_PHASES",phases:cloud.phases});
      if(cloud.injuries)d({type:"SET_INJURIES",injuries:cloud.injuries});
      if(cloud.privacy)LS.set("ft-privacy",cloud.privacy);
      if(cloud.supplements)LS.set("ft-supplements",cloud.supplements);
    if(cloud.accountability)LS.set("ft-accountability",cloud.accountability);
      // Restore gamification
      if(cloud.gamification){
        const g=cloud.gamification;
        const localBonus=LS.get("ft-xp-bonus")||{total:0,log:[]};
        if((g.xp_bonus?.total||0)>(localBonus.total||0))LS.set("ft-xp-bonus",g.xp_bonus);
        const localMissions=LS.get("ft-missions-completed")||{};
        LS.set("ft-missions-completed",{...g.missions_completed,...localMissions});
        const localShields=LS.get("ft-streak-shields")||0;
        if((g.streak_shields||0)>localShields)LS.set("ft-streak-shields",g.streak_shields);
        if(g.shield_awarded_streak)LS.set("ft-shield-awarded-streak",g.shield_awarded_streak);
        const localLevel=LS.get("ft-last-known-level")||1;
        if((g.last_known_level||1)>localLevel)LS.set("ft-last-known-level",g.last_known_level);
        const localBadgeDates=LS.get("ft-badge-dates")||{};
        const mergedBD={...g.badge_dates};
        for(const[k,v]of Object.entries(localBadgeDates)){if(!mergedBD[k]||v<mergedBD[k])mergedBD[k]=v;}
        LS.set("ft-badge-dates",mergedBD);
        if(g.duels?.length>0&&!(LS.get("ft-duels")?.length>0))LS.set("ft-duels",g.duels);
        if(g.rivals?.length>0&&!(LS.get("ft-rivals")?.length>0))LS.set("ft-rivals",g.rivals);
        if(g.war_wins>0&&!LS.get("ft-war-wins"))LS.set("ft-war-wins",g.war_wins);
        if(g.war_streak>0&&!LS.get("ft-war-streak"))LS.set("ft-war-streak",g.war_streak);
        if(g.shield_used_date&&!LS.get("ft-shield-used-date"))LS.set("ft-shield-used-date",g.shield_used_date);
        if(g.comeback_used&&!LS.get("ft-comeback-used"))LS.set("ft-comeback-used",g.comeback_used);
        if(g.duel_record){const local=LS.get("ft-duel-record")||{wins:0,losses:0,ties:0};
          if((g.duel_record.wins||0)>(local.wins||0))LS.set("ft-duel-record",g.duel_record);}
      }
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

// ─── Exercise → Muscle Mapping ───
export const MUSCLE_MAP={
  // Chest
  bench:{primary:["chest"],secondary:["triceps","front_delts"]},
  incbench:{primary:["chest"],secondary:["triceps","front_delts"]},
  decbench:{primary:["chest"],secondary:["triceps"]},
  dbbench:{primary:["chest"],secondary:["triceps","front_delts"]},
  dbincbench:{primary:["chest"],secondary:["triceps","front_delts"]},
  flye:{primary:["chest"],secondary:[]},
  dbflye:{primary:["chest"],secondary:[]},
  dip:{primary:["chest"],secondary:["triceps","front_delts"]},
  pushup:{primary:["chest"],secondary:["triceps","front_delts"]},
  machpress:{primary:["chest"],secondary:["triceps"]},
  pecfly:{primary:["chest"],secondary:[]},
  svbench:{primary:["chest"],secondary:["triceps"]},
  closegrip:{primary:["triceps"],secondary:["chest"]},
  // Back
  deadlift:{primary:["back","hamstrings"],secondary:["glutes","core"]},
  row:{primary:["back"],secondary:["biceps"]},
  pullup:{primary:["back"],secondary:["biceps"]},
  latpull:{primary:["back"],secondary:["biceps"]},
  chinup:{primary:["back","biceps"],secondary:[]},
  cablerow:{primary:["back"],secondary:["biceps"]},
  dbrow:{primary:["back"],secondary:["biceps"]},
  tbarrow:{primary:["back"],secondary:["biceps"]},
  pendlay:{primary:["back"],secondary:["biceps"]},
  sumo:{primary:["back","glutes"],secondary:["hamstrings","quads"]},
  rdl:{primary:["hamstrings"],secondary:["back","glutes"]},
  hyperext:{primary:["back"],secondary:["hamstrings","glutes"]},
  straightarm:{primary:["back"],secondary:[]},
  meadows:{primary:["back"],secondary:["biceps"]},
  // Legs
  squat:{primary:["quads"],secondary:["glutes","hamstrings","core"]},
  legpress:{primary:["quads"],secondary:["glutes"]},
  lunge:{primary:["quads"],secondary:["glutes","hamstrings"]},
  frontsquat:{primary:["quads"],secondary:["core","glutes"]},
  bss:{primary:["quads"],secondary:["glutes"]},
  goblet:{primary:["quads"],secondary:["glutes","core"]},
  legext:{primary:["quads"],secondary:[]},
  hamcurl:{primary:["hamstrings"],secondary:[]},
  calfraise:{primary:["calves"],secondary:[]},
  hacksquat:{primary:["quads"],secondary:["glutes"]},
  stepup:{primary:["quads"],secondary:["glutes"]},
  hipthrust:{primary:["glutes"],secondary:["hamstrings"]},
  legcurl:{primary:["hamstrings"],secondary:[]},
  sldl:{primary:["hamstrings"],secondary:["back","glutes"]},
  sissy:{primary:["quads"],secondary:[]},
  // Shoulders
  ohp:{primary:["front_delts"],secondary:["triceps"]},
  dbohp:{primary:["front_delts"],secondary:["triceps"]},
  lateralraise:{primary:["side_delts"],secondary:[]},
  facepull:{primary:["rear_delts"],secondary:["back"]},
  shrug:{primary:["traps"],secondary:[]},
  reardelt:{primary:["rear_delts"],secondary:[]},
  arnoldpress:{primary:["front_delts","side_delts"],secondary:["triceps"]},
  uprow:{primary:["side_delts","traps"],secondary:[]},
  cablateral:{primary:["side_delts"],secondary:[]},
  landmine:{primary:["front_delts"],secondary:["triceps","core"]},
  dbshrug:{primary:["traps"],secondary:[]},
  frontraise:{primary:["front_delts"],secondary:[]},
  // Arms
  curl:{primary:["biceps"],secondary:[]},
  tricep:{primary:["triceps"],secondary:[]},
  hammercurl:{primary:["biceps"],secondary:[]},
  preacher:{primary:["biceps"],secondary:[]},
  skullcrusher:{primary:["triceps"],secondary:[]},
  ohtriext:{primary:["triceps"],secondary:[]},
  concurl:{primary:["biceps"],secondary:[]},
  cablecurl:{primary:["biceps"],secondary:[]},
  tridip:{primary:["triceps"],secondary:[]},
  revbarbell:{primary:["biceps"],secondary:[]},
  bayesian:{primary:["biceps"],secondary:[]},
  kickback:{primary:["triceps"],secondary:[]},
  spidercurl:{primary:["biceps"],secondary:[]},
  // Core
  plank:{primary:["core"],secondary:[]},
  crunch:{primary:["core"],secondary:[]},
  hangleg:{primary:["core"],secondary:[]},
  cablecrunch:{primary:["core"],secondary:[]},
  russiantwist:{primary:["core"],secondary:[]},
  abwheel:{primary:["core"],secondary:[]},
  woodchop:{primary:["core"],secondary:[]},
  deadbug:{primary:["core"],secondary:[]},
  pallof:{primary:["core"],secondary:[]},
  decline_sit:{primary:["core"],secondary:[]},
  // New Chest
  cablecross:{primary:["chest"],secondary:[]},lowcableflye:{primary:["chest"],secondary:[]},
  svincbench:{primary:["chest"],secondary:["triceps","front_delts"]},dbpullover:{primary:["chest"],secondary:["back"]},
  diamondpush:{primary:["triceps"],secondary:["chest"]},widepush:{primary:["chest"],secondary:["triceps"]},
  floordbbench:{primary:["chest"],secondary:["triceps"]},machincpress:{primary:["chest"],secondary:["triceps"]},
  // New Back
  closegriplat:{primary:["back"],secondary:["biceps"]},widegriplat:{primary:["back"],secondary:["biceps"]},
  machrow:{primary:["back"],secondary:["biceps"]},chestrow:{primary:["back"],secondary:["biceps"]},
  sealrow:{primary:["back"],secondary:["biceps"]},singlearmcablerow:{primary:["back"],secondary:["biceps"]},
  reversegriprow:{primary:["back"],secondary:["biceps"]},invertedrow:{primary:["back"],secondary:["biceps"]},
  latprayer:{primary:["back"],secondary:[]},shrugs:{primary:["traps"],secondary:[]},rackpull:{primary:["back"],secondary:["hamstrings","glutes"]},
  // New Legs
  pendulumsguat:{primary:["quads"],secondary:["glutes"]},smithsquat:{primary:["quads"],secondary:["glutes"]},
  walkinglunge:{primary:["quads"],secondary:["glutes","hamstrings"]},reverselunge:{primary:["quads"],secondary:["glutes"]},
  seatcalf:{primary:["calves"],secondary:[]},legpresscalf:{primary:["calves"],secondary:[]},
  goodmorning:{primary:["hamstrings"],secondary:["back","glutes"]},nordiccurl:{primary:["hamstrings"],secondary:[]},
  glutebridge:{primary:["glutes"],secondary:["hamstrings"]},cablepullthrough:{primary:["glutes"],secondary:["hamstrings"]},
  lyinglegcurl:{primary:["hamstrings"],secondary:[]},boxsquat:{primary:["quads"],secondary:["glutes"]},
  singlelegpress:{primary:["quads"],secondary:["glutes"]},singlelegrdl:{primary:["hamstrings"],secondary:["glutes"]},
  hipabductor:{primary:["glutes"],secondary:[]},hipadductor:{primary:["quads"],secondary:[]},
  dbrdl:{primary:["hamstrings"],secondary:["glutes"]},pistolsquat:{primary:["quads"],secondary:["glutes","core"]},
  beltquat:{primary:["quads"],secondary:["glutes"]},
  // New Shoulders
  machlateral:{primary:["side_delts"],secondary:[]},machshoulder:{primary:["front_delts"],secondary:["triceps"]},
  svohp:{primary:["front_delts"],secondary:["triceps"]},cablereardelt:{primary:["rear_delts"],secondary:[]},
  reversefly:{primary:["rear_delts"],secondary:[]},behindneckpress:{primary:["front_delts","side_delts"],secondary:["triceps"]},
  dblateralraise:{primary:["side_delts"],secondary:[]},luyang:{primary:["front_delts","side_delts"],secondary:[]},
  zspress:{primary:["front_delts"],secondary:["triceps","core"]},handstandpush:{primary:["front_delts"],secondary:["triceps","core"]},
  // New Arms
  dbtricext:{primary:["triceps"],secondary:[]},inclinecurl:{primary:["biceps"],secondary:[]},
  ropeoverhead:{primary:["triceps"],secondary:[]},ropepush:{primary:["triceps"],secondary:[]},
  ezbar:{primary:["biceps"],secondary:[]},crossbodycurl:{primary:["biceps"],secondary:[]},
  machbicep:{primary:["biceps"],secondary:[]},machtricep:{primary:["triceps"],secondary:[]},
  wristcurl:{primary:["biceps"],secondary:[]},reversewrist:{primary:["biceps"],secondary:[]},
  "21s":{primary:["biceps"],secondary:[]},jmpress:{primary:["triceps"],secondary:["chest"]},
  dipbw:{primary:["triceps"],secondary:["chest","front_delts"]},waiter:{primary:["biceps"],secondary:[]},
  // New Core
  sideplank:{primary:["core"],secondary:[]},toetouches:{primary:["core"],secondary:[]},
  leglifts:{primary:["core"],secondary:[]},bicycle:{primary:["core"],secondary:[]},
  dragonfl:{primary:["core"],secondary:[]},reversecrunch:{primary:["core"],secondary:[]},
  // Olympic
  clean:{primary:["back","quads"],secondary:["glutes","hamstrings","traps","core"]},
  cleanjerk:{primary:["back","quads","front_delts"],secondary:["glutes","hamstrings","triceps","core"]},
  snatch:{primary:["back","quads"],secondary:["front_delts","core","glutes"]},
  hangclean:{primary:["back","traps"],secondary:["quads","glutes","core"]},
  powersnatch:{primary:["back","quads"],secondary:["front_delts","core"]},
  thruster:{primary:["quads","front_delts"],secondary:["glutes","triceps","core"]},
  cleanpull:{primary:["back","traps"],secondary:["hamstrings","glutes"]},
  pushjerk:{primary:["front_delts"],secondary:["triceps","quads","core"]},
  // Full Body
  farmwalk:{primary:["traps","core"],secondary:["glutes","quads"]},
  turkgetup:{primary:["core","front_delts"],secondary:["glutes","quads"]},
  sledpush:{primary:["quads","glutes"],secondary:["core","calves"]},
  sledpull:{primary:["back","hamstrings"],secondary:["glutes","core"]},
  sandbag:{primary:["core","traps"],secondary:["glutes","quads"]},
  wallball:{primary:["quads","front_delts"],secondary:["core","glutes"]},
  kettleswing:{primary:["glutes","hamstrings"],secondary:["core","back"]},
  kettleclean:{primary:["front_delts","back"],secondary:["core","glutes"]},
  manmaker:{primary:["chest","front_delts","quads"],secondary:["triceps","core","back"]},
  mtclimber:{primary:["core"],secondary:["quads","front_delts"]},
  // Machines
  smithsq:{primary:["quads"],secondary:["glutes"]},
  cableflylow:{primary:["chest"],secondary:[]},cableflyhigh:{primary:["chest"],secondary:[]},
  legsled:{primary:["quads"],secondary:["glutes"]},machshrug:{primary:["traps"],secondary:[]},
  machcalf:{primary:["calves"],secondary:[]},reversehy:{primary:["back","glutes"],secondary:["hamstrings"]},
  glute_ham:{primary:["hamstrings","glutes"],secondary:["back"]},
  machlegpress45:{primary:["quads"],secondary:["glutes"]},smithrdl:{primary:["hamstrings"],secondary:["back","glutes"]},
  cablelateral2:{primary:["side_delts"],secondary:[]},pecdeck:{primary:["chest"],secondary:[]},
  machrear:{primary:["rear_delts"],secondary:[]},assistpullup:{primary:["back"],secondary:["biceps"]},
  legabduction:{primary:["glutes"],secondary:[]},
};

// All muscle groups for heat map
export const ALL_MUSCLES=["chest","back","front_delts","side_delts","rear_delts","traps","biceps","triceps","quads","hamstrings","glutes","calves","core"];
export const MUSCLE_LABELS={chest:"Chest",back:"Back",front_delts:"Front Delts",side_delts:"Side Delts",rear_delts:"Rear Delts",traps:"Traps",biceps:"Biceps",triceps:"Triceps",quads:"Quads",hamstrings:"Hamstrings",glutes:"Glutes",calves:"Calves",core:"Core"};

// ─── Progressive Overload Engine (Enhanced) ───

export function GoalEngine({s,d}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({type:"weight",target:"",deadline:"",label:""});

  // B3 fix: s.milestones mixes structured goals (type/target/deadline) with freeform
  // log entries (text/date from demo or auto-milestones). Only render structured goals here.
  // Structured goals (type/target/deadline) — safe to modify
  const goals=(s.milestones||[]).filter(g=>g.target!=null&&g.deadline);
  // Freeform entries (auto-milestones, log entries) — must be preserved on every write
  const freeformMilestones=(s.milestones||[]).filter(g=>g.target==null||!g.deadline);

  const addGoal=()=>{
    if(!form.target||!form.deadline)return;
    const g={id:uid(),type:form.type,target:parseFloat(form.target),deadline:form.deadline,
      label:form.label||`${form.type==="weight"?"Reach":"Hit"} ${form.target}`,
      created:today(),completed:false};
    d({type:"SET_MILESTONES",milestones:[...freeformMilestones,...goals,g]});
    SuccessToastCtrl.show("Goal created");
    setForm({type:"weight",target:"",deadline:"",label:""});
    setShowAdd(false);
  };

  const deleteGoal=(id)=>{d({type:"SET_MILESTONES",milestones:[...freeformMilestones,...goals.filter(g=>g.id!==id)]});SuccessToastCtrl.show("Goal deleted");};
  const completeGoal=(id)=>{d({type:"SET_MILESTONES",milestones:[...freeformMilestones,...goals.map(g=>g.id===id?{...g,completed:true,completedDate:today()}:g)]});SuccessToastCtrl.show("Goal completed! 🎉");};

  const calcProgress=(g)=>{
    if(g.type==="weight"){
      // B6 fix: sort desc to get most recent entry with a weight reading
      const sortedBody=[...s.body].sort((a,b)=>b.date.localeCompare(a.date));
      const bw=sortedBody.find(b=>b.weight)?.weight||0;
      const startBW=sortedBody[sortedBody.length-1]?.weight||bw;
      if(!startBW||!bw)return 0;
      const total=Math.abs(g.target-startBW);
      const done=Math.abs(bw-startBW);
      return total>0?Math.min(100,Math.round((done/total)*100)):0;
    }
    if(g.type==="strength"){
      // B7 fix: find max weight only for matching lift, not all exercises
      const labelLower=(g.label||"").toLowerCase();
      const liftKeys=["bench","squat","deadlift","ohp","press","row","curl","pull"];
      const matchKey=liftKeys.find(k=>labelLower.includes(k));
      let maxW=0;
      s.workouts.forEach(w=>w.exercises.forEach(ex=>{
        const exId=(ex.exerciseId||"").toLowerCase();
        const exName=(s.exercises?.find(e=>e.id===ex.exerciseId)?.name||"").toLowerCase();
        // If label mentions a specific lift, only count that lift; otherwise any lift
        const matches=!matchKey||(exId.includes(matchKey)||exName.includes(matchKey));
        if(matches)ex.sets.forEach(st=>{const w2=parseFloat(st.weight)||0;if(w2>maxW)maxW=w2;});
      }));
      return maxW>=g.target?100:Math.min(99,Math.round((maxW/g.target)*100));
    }
    if(g.type==="nutrition"){
      const last30=s.nutrition.filter(n=>n.date>=ago(30));
      const hits=last30.filter(n=>n.protein>=s.goals.protein*.8).length;
      const target=parseInt(g.target)||25;
      return Math.min(100,Math.round((hits/target)*100));
    }
    if(g.type==="consistency"){
      const last30=s.workouts.filter(w=>w.date>=ago(30)).length;
      return Math.min(100,Math.round((last30/parseInt(g.target||16))*100));
    }
    return 0;
  };

  const daysLeft=(deadline)=>{
    if(!deadline)return null;
    const d2=Math.ceil((new Date(deadline)-new Date(today()))/(86400000));
    return d2;
  };

  const types=[
    {id:"weight",label:"Weight Goal",icon:"⚖️",ex:"Lose 10 lbs by summer"},
    {id:"strength",label:"Strength PR",icon:"💪",ex:"Bench 225 lbs"},
    {id:"nutrition",label:"Nutrition Streak",icon:"🥩",ex:"Hit protein 25/30 days"},
    {id:"consistency",label:"Consistency",icon:"🔥",ex:"Train 16x this month"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Goals & Milestones</div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",borderRadius:8,
          background:`${V.accent}12`,border:`1px solid ${V.accent}25`,cursor:"pointer",
          WebkitTapHighlightColor:"transparent",fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>
          + New Goal
        </button>
      </div>

      {goals.filter(g=>!g.completed).length===0&&!showAdd&&(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🎯</div>
          <div style={{fontSize:13,fontWeight:600,color:V.text,marginBottom:4}}>No active goals</div>
          <div style={{fontSize:11,color:V.text3}}>Set a target to stay focused and track progress</div>
        </Card>
      )}

      {goals.filter(g=>!g.completed).map(g=>{
        const pct=calcProgress(g);
        const dl=daysLeft(g.deadline);
        const c=pct>=100?V.accent:dl===null?V.accent2:dl<0?V.danger:dl<7?V.warn:V.accent2;
        return(
          <Card key={g.id} style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:V.text}}>{g.label}</div>
                <div style={{fontSize:10,color:V.text3,marginTop:2}}>
                  {dl===null?null:dl>0?`${dl} days left`:<span style={{color:V.danger}}>Overdue</span>}
                  {" · "}Target: {g.target}{g.type==="weight"?` ${s.units}`:g.type==="nutrition"?" days":""}
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {pct>=100&&<button onClick={()=>completeGoal(g.id)} style={{padding:"4px 8px",borderRadius:6,
                  background:`${V.accent}15`,border:"none",cursor:"pointer",fontSize:10,color:V.accent,fontWeight:700}}>✓ Done</button>}
                <button onClick={()=>deleteGoal(g.id)} style={{padding:"4px 8px",borderRadius:6,
                  background:"rgba(255,107,107,0.08)",border:"none",cursor:"pointer",fontSize:10,color:V.danger}}>✕</button>
              </div>
            </div>
            <Progress val={pct} max={100} color={c} h={8}/>
            <div style={{fontSize:10,color:c,fontWeight:700,marginTop:4,fontFamily:V.mono}}>{pct}%</div>
          </Card>
        );
      })}

      {/* Completed goals */}
      {goals.filter(g=>g.completed).length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:V.text3,marginBottom:6}}>Completed</div>
          {goals.filter(g=>g.completed).map(g=>(
            <Card key={g.id} style={{padding:10,marginBottom:6,opacity:0.6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:V.accent}}>✓</span>
                <span style={{fontSize:12,color:V.text,fontWeight:600}}>{g.label}</span>
                <span style={{flex:1}}/>
                <span style={{fontSize:9,color:V.text3}}>{g.completedDate}</span>
                <button onClick={()=>deleteGoal(g.id)} style={{background:"none",border:"none",cursor:"pointer",
                  fontSize:10,color:V.text3,padding:"2px 6px"}}>✕</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd&&(
        <Sheet title="New Goal" onClose={()=>setShowAdd(false)}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {types.map(t=>(
              <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))} style={{
                padding:"10px 14px",borderRadius:10,border:`1.5px solid ${form.type===t.id?V.accent:V.cardBorder}`,
                background:form.type===t.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",WebkitTapHighlightColor:"transparent",textAlign:"left"
              }}>
                <div style={{fontSize:14}}>{t.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:form.type===t.id?V.accent:V.text,marginTop:2}}>{t.label}</div>
                <div style={{fontSize:9,color:V.text3}}>{t.ex}</div>
              </button>
            ))}
          </div>
          <Field label="Label" value={form.label} onChange={v=>setForm(f=>({...f,label:v}))} placeholder="e.g. Bench 225 by August"/>
          <Field label="Target Number" type="number" value={form.target} onChange={v=>setForm(f=>({...f,target:v}))}
            placeholder={form.type==="weight"?"Target weight":form.type==="strength"?"Weight to hit":form.type==="nutrition"?"Days to hit":"Sessions per month"}/>
          <Field label="Deadline" type="date" value={form.deadline} onChange={v=>setForm(f=>({...f,deadline:v}))}/>
          <Btn full onClick={addGoal} s={{marginTop:8}}>{Icons.check({size:16,color:V.bg})} Set Goal</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── #1 Adaptive Program Builder ───
export function AdaptiveCoach({s}){
  const r=useMemo(()=>calcReadiness(s),[s.workouts,s.nutrition,s.checkins,s.goals]);
  const dow=new Date().getDay();
  const todayType=s.schedule?.overrides?.[today()]||s.schedule?.weekly?.[dow]||"Rest";
  const u=wUnit(s.units);

  // Generate today's recommended workout based on schedule + readiness
  const program=useMemo(()=>{
    if(todayType==="Rest")return{type:"rest",message:"Recovery day. Focus on stretching, mobility, or light cardio.",exercises:[]};

    // Map muscle groups to exercises
    const muscleMap={
      "Push":["bench","incbench","ohp","lateralraise","tricep","dip"],
      "Pull":["deadlift","row","pullup","latpull","curl","facepull"],
      "Legs":["squat","legpress","rdl","hamcurl","hipthrust","calfraise"],
      "Chest":["bench","incbench","dbbench","flye","pecfly","dip"],
      "Back":["deadlift","row","pullup","latpull","cablerow","dbrow"],
      "Shoulders":["ohp","dbohp","lateralraise","facepull","reardelt","shrug"],
      "Arms":["curl","hammercurl","preacher","tricep","skullcrusher","ohtriext"],
      "Upper Body":["bench","row","ohp","latpull","curl","tricep"],
      "Lower Body":["squat","rdl","legpress","hamcurl","hipthrust","calfraise"],
      "Full Body":["squat","bench","row","ohp","deadlift","curl"],
      "Cardio":[]
    };

    const exIds=muscleMap[todayType]||muscleMap["Full Body"];
    if(exIds.length===0)return{type:"cardio",message:"Cardio day. 20-40 min steady state or HIIT.",exercises:[]};

    // Look up last performance for each exercise
    const recs=exIds.slice(0,r.score>=60?6:r.score>=40?5:4).map(eid=>{
      const ex=s.exercises.find(e=>e.id===eid);
      if(!ex)return null;

      // Find last time this exercise was done
      let lastSets=null;
      for(const w of s.workouts){
        const found=w.exercises.find(e=>e.exerciseId===eid);
        if(found){lastSets=found.sets;break;}
      }

      // Volume adjustment based on readiness
      let setCount=lastSets?lastSets.length:3;
      let weightMult=1.0;
      if(r.score>=80){weightMult=1.025;} // Push for progression
      else if(r.score>=60){weightMult=1.0;} // Maintain
      else if(r.score>=40){weightMult=0.9;setCount=Math.max(2,setCount-1);} // Reduce
      else{weightMult=0.8;setCount=Math.max(2,setCount-1);} // Deload

      const targetWeight=lastSets?Math.round(Math.max(...lastSets.map(st=>st.weight))*weightMult/5)*5:0;
      const targetReps=lastSets?Math.round(lastSets.reduce((s2,st)=>s2+st.reps,0)/lastSets.length):8;

      return{id:eid,name:ex.name,sets:setCount,reps:targetReps,weight:targetWeight,
        note:weightMult>1?"↑ Push weight":weightMult<0.95?"↓ Deload":"→ Maintain"};
    }).filter(Boolean);

    return{type:"workout",message:r.rec,exercises:recs};
  },[s.workouts,s.exercises,s.schedule,todayType,r.score,r.rec]);

  if(program.type==="rest"){
    const RECOVERY=[
      {name:"Hip Flexor Stretch",sets:"2×45s each side",note:"Lunge, rear knee down, lean forward",icon:"🦵"},
      {name:"Thoracic Rotation",sets:"2×10 each side",note:"Rotate upper back slowly",icon:"🔄"},
      {name:"Foam Roll — Quads & IT Band",sets:"2min each leg",note:"Slow passes, pause on tight spots",icon:"🧘"},
      {name:"Cat-Cow Stretch",sets:"2×10 reps",note:"All fours, full spinal flexion and extension",icon:"🐈"},
      {name:"90/90 Hip Stretch",sets:"2×60s each side",note:"Front and rear hip flexors simultaneously",icon:"💺"},
      {name:"Dead Hang",sets:"3×30s",note:"Full spinal decompression — shoulders packed",icon:"🏋️"},
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Today's Program</div>
          <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:6,background:"rgba(139,92,246,0.1)",color:V.purple}}>🧘 Recovery</span>
        </div>
        <Card style={{padding:14,background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.15)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:24}}>🧘</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:V.text}}>Recovery Day</div>
              <div style={{fontSize:11,color:V.text3}}>Active recovery keeps you loose and speeds adaptation</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[{l:"Mobility",v:"~20 min",c:V.purple},{l:"Intensity",v:"Low",c:V.accent2},{l:"Workout XP",v:"+0",c:V.text3}].map(st=>(
              <div key={st.l} style={{textAlign:"center",padding:"6px 4px",borderRadius:6,background:"rgba(255,255,255,0.03)"}}>
                <div style={{fontSize:13,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                <div style={{fontSize:8,color:V.text3}}>{st.l}</div>
              </div>
            ))}
          </div>
        </Card>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",paddingLeft:2}}>Recovery Circuit</div>
        {RECOVERY.map((ex,i)=>(
          <Card key={i} style={{padding:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:10,background:"rgba(139,92,246,0.1)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ex.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:V.text}}>{ex.name}</div>
                <div style={{fontSize:11,color:V.purple,fontWeight:600}}>{ex.sets}</div>
                <div style={{fontSize:10,color:V.text3,marginTop:2}}>{ex.note}</div>
              </div>
            </div>
          </Card>
        ))}
        <div style={{padding:"10px 14px",borderRadius:10,background:"rgba(0,245,160,0.04)",border:"1px solid rgba(0,245,160,0.1)",fontSize:11,color:V.text3,lineHeight:1.6}}>
          💡 <strong style={{color:V.accent}}>Tomorrow:</strong> {program.message} Prioritize sleep and hydration today.
        </div>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Today's Program</div>
          <div style={{fontSize:11,color:V.text3}}>{todayType} · Readiness {r.score}/100</div>
        </div>
        <div style={{padding:"4px 10px",borderRadius:8,background:`${r.color}15`,border:`1px solid ${r.color}25`}}>
          <span style={{fontSize:10,fontWeight:700,color:r.color}}>{r.level}</span>
        </div>
      </div>

      {/* Readiness-based note */}
      {r.score<60&&(
        <div style={{padding:"8px 12px",borderRadius:8,background:`${V.warn}08`,border:`1px solid ${V.warn}15`}}>
          <span style={{fontSize:11,color:V.warn}}>{program.message}</span>
        </div>
      )}

      {/* Start This Workout button — pre-loads suggested exercises into the logger */}
      {program.exercises.length>0&&(
        <Btn full onClick={()=>{
          const draft={date:today(),dur:"",exercises:program.exercises.map(ex=>({
            exerciseId:ex.id,
            sets:Array.from({length:ex.sets}).map(()=>({weight:ex.weight.toString(),reps:ex.reps.toString(),rpe:"",done:false}))
          })),notes:"Coach-suggested session",rating:3};
          LS.set("ft-coach-draft",draft);
          SuccessToastCtrl.show("Workout loaded — tap Log to start");
          d({type:"TAB",tab:"log_workout"});
        }} s={{background:"linear-gradient(135deg,#7c3aed,#4f46e5)",fontWeight:800}}>
          {Icons.dumbbell({size:15,color:"#fff"})} Start This Workout
        </Btn>
      )}
      {program.exercises.map((ex,i)=>(
        <Card key={ex.id} style={{padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}12`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:12,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{i+1}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:V.text}}>{ex.name}</div>
              <div style={{fontSize:11,color:V.text3}}>
                {ex.sets}×{ex.reps} @ {ex.weight>0?`${ex.weight} ${u}`:"bodyweight"}
                <span style={{marginLeft:6,fontSize:9,color:ex.note.includes("↑")?V.accent:ex.note.includes("↓")?V.warn:V.text3,
                  fontWeight:600}}>{ex.note}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── #3 Cloud Sync Status Bar ───
export function SyncStatus({s}){
  const lastSync=LS.get("ft-last-sync");
  const email=s.profile?.email;
  const [pending,setPending]=useState(parseInt(LS.get("ft-pending-sync"))||0);
  const [retrying,setRetrying]=useState(false);

  // Listen for sync completion from SW
  useEffect(()=>{
    const handler=(e)=>{
      if(e.data?.type==="SYNC_COMPLETE"){setPending(e.data.remaining||0);LS.set("ft-pending-sync",e.data.remaining||0);}
      if(e.data?.type==="QUEUE_COUNT"){setPending(e.data.count||0);}
    };
    navigator.serviceWorker?.addEventListener("message",handler);
    // Ask SW for current queue count
    navigator.serviceWorker?.controller?.postMessage({type:"GET_QUEUE_COUNT"});
    return()=>navigator.serviceWorker?.removeEventListener("message",handler);
  },[]);

  // Also update from localStorage on interval
  useEffect(()=>{
    const iv=setInterval(()=>setPending(parseInt(LS.get("ft-pending-sync"))||0),5000);
    return()=>clearInterval(iv);
  },[]);

  const retry=async()=>{
    setRetrying(true);
    const result=await SyncQueue.processAll();
    setPending(result.remaining);
    setRetrying(false);
  };

  const fmtAgo=(iso)=>{
    if(!iso)return"Never";
    const sec=Math.floor((Date.now()-new Date(iso).getTime())/1000);
    if(sec<60)return"Just now";
    if(sec<3600)return`${Math.floor(sec/60)}m ago`;
    if(sec<86400)return`${Math.floor(sec/3600)}h ago`;
    return`${Math.floor(sec/86400)}d ago`;
  };

  if(!email)return null;

  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",
        background:pending>0?"rgba(255,159,67,0.06)":"rgba(255,255,255,0.02)",
        borderRadius:6,border:`1px solid ${pending>0?"rgba(255,159,67,0.15)":V.cardBorder}`}}>
        <div style={{width:5,height:5,borderRadius:3,background:pending>0?V.warn:lastSync?V.accent:"rgba(255,255,255,0.15)"}}/>
        <span style={{fontSize:8,color:pending>0?V.warn:V.text3,fontWeight:600}}>
          {pending>0?`${pending} pending`:lastSync?`${fmtAgo(lastSync)}`:"No sync"}
        </span>
      </div>
      {pending>0&&(
        <button onClick={retry} disabled={retrying} style={{padding:"3px 6px",borderRadius:4,background:`${V.warn}12`,
          border:"none",cursor:"pointer",fontSize:7,color:V.warn,fontWeight:700}}>
          {retrying?"…":"Retry"}
        </button>
      )}
    </div>
  );
}

// ─── #8 Social: Workout Proof Card Generator ───
export function WorkoutCard({workout,s}){
  const canvasRef=useRef(null);
  const [generated,setGenerated]=useState(false);

  const generateCard=useCallback(()=>{
    const c=canvasRef.current;if(!c)return;
    const ctx=c.getContext("2d");
    c.width=600;c.height=400;
    const grad=ctx.createLinearGradient(0,0,600,400);
    grad.addColorStop(0,"#0a0a14");grad.addColorStop(1,"#14142a");
    ctx.fillStyle=grad;ctx.fillRect(0,0,600,400);
    ctx.fillStyle="#22d3ee";ctx.fillRect(0,0,4,400);
    ctx.fillStyle="#ffffff";ctx.font="bold 28px -apple-system, sans-serif";
    ctx.fillText("WORKOUT COMPLETE",24,48);
    ctx.fillStyle="#888";ctx.font="14px -apple-system, sans-serif";
    ctx.fillText(new Date(workout.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}),24,72);
    const totalSets=workout.exercises.reduce((n,e)=>n+e.sets.length,0);
    const totalVol=workout.exercises.reduce((v,e)=>v+e.sets.reduce((s2,st)=>s2+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0);
    [{l:"Duration",v:`${workout.dur||0}min`},{l:"Exercises",v:workout.exercises.length},
      {l:"Sets",v:totalSets},{l:"Volume",v:totalVol>1000?`${(totalVol/1000).toFixed(1)}k`:totalVol}
    ].forEach((st,i)=>{
      const x=24+i*145;
      ctx.fillStyle="#22d3ee";ctx.font="bold 32px -apple-system, sans-serif";
      ctx.fillText(String(st.v),x,130);
      ctx.fillStyle="#666";ctx.font="11px -apple-system, sans-serif";
      ctx.fillText(st.l.toUpperCase(),x,148);
    });
    ctx.fillStyle="#444";ctx.fillRect(24,170,552,1);
    workout.exercises.slice(0,5).forEach((ex,i)=>{
      const y=198+i*36;
      const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      const best=Math.max(...ex.sets.map(st=>st.weight));
      ctx.fillStyle="#ddd";ctx.font="14px -apple-system, sans-serif";
      ctx.fillText(name,24,y);
      ctx.fillStyle="#22d3ee";ctx.font="bold 14px -apple-system, sans-serif";
      ctx.fillText(`${ex.sets.length}×${ex.sets[0]?.reps||0} @ ${best} ${wUnit(s.units)}`,400,y);
    });
    if(workout.exercises.length>5){ctx.fillStyle="#555";ctx.font="12px -apple-system, sans-serif";ctx.fillText(`+${workout.exercises.length-5} more exercises`,24,198+5*36);}
    ctx.fillStyle="#333";ctx.font="bold 12px -apple-system, sans-serif";ctx.fillText("IRONLOG",24,380);
    ctx.fillStyle="#555";ctx.font="11px -apple-system, sans-serif";ctx.fillText("ironlog.space",110,380);
    if(workout.rating){ctx.fillStyle="#f59e0b";ctx.font="16px sans-serif";ctx.fillText("★".repeat(workout.rating),500,380);}
    setGenerated(true);
  },[workout]);

  // Auto-generate on mount
  useEffect(()=>{setTimeout(generateCard,50);},[generateCard]);

  const share=()=>{
    const c=canvasRef.current;if(!c)return;
    Haptic.light();
    c.toBlob(blob=>{
      if(navigator.share&&blob){
        navigator.share({files:[new File([blob],`workout-${workout.date}.png`,{type:"image/png"})],
          title:"Workout Complete",text:"Another one in the books 💪"}).catch(()=>{
          // Fallback to download
          const url=URL.createObjectURL(blob);const a=document.createElement("a");
          a.href=url;a.download=`workout-${workout.date}.png`;a.click();URL.revokeObjectURL(url);
          SuccessToastCtrl.show("Image saved");
        });
      }else{
        const url=URL.createObjectURL(blob);const a=document.createElement("a");
        a.href=url;a.download=`workout-${workout.date}.png`;a.click();URL.revokeObjectURL(url);
        SuccessToastCtrl.show("Image saved");
      }
    },"image/png");
  };

  const copyToClipboard=()=>{
    const c=canvasRef.current;if(!c)return;
    c.toBlob(async blob=>{
      try{await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);SuccessToastCtrl.show("Copied to clipboard");}
      catch(e){share();}
    },"image/png");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <canvas ref={canvasRef} style={{width:"100%",borderRadius:12,display:generated?"block":"none"}}/>
      {generated&&(
        <div style={{display:"flex",gap:6}}>
          <Btn full onClick={share}>{Icons.upload({size:14,color:V.bg})} Share</Btn>
          <Btn v="secondary" onClick={copyToClipboard} s={{flexShrink:0}}>{Icons.copy({size:14,color:V.text2})} Copy</Btn>
        </div>
      )}
    </div>
  );
}

// ─── #6 Form Check Workflow ───
export function FormCheckTab({s,d}){
  const [selEx,setSelEx]=useState(null);
  const [recording,setRecording]=useState(false);
  const [videoUrl,setVideoUrl]=useState(null);
  const [checkedCues,setCheckedCues]=useState({});
  const toggleCue=(key)=>setCheckedCues(c=>({...c,[key]:!c[key]}));
  const mediaRef=useRef(null);
  const videoRef=useRef(null);
  const chunks=useRef([]);
  // Cleanup: stop camera stream when component unmounts
  useEffect(()=>{
    return()=>{
      if(mediaRef.current&&mediaRef.current.state==="recording")mediaRef.current.stop();
      if(videoRef.current?.srcObject)videoRef.current.srcObject.getTracks().forEach(t=>t.stop());
    };
  },[]);
  // #B7: Revoke blob URL whenever videoUrl changes (new recording replaces old) or on unmount.
  // Previously every recording created an unpinned blob URL that was never freed.
  useEffect(()=>{
    return()=>{if(videoUrl)URL.revokeObjectURL(videoUrl);};
  },[videoUrl]);

  const formCues={
    bench:["Bar path: straight up, slight arc back","Scapulae retracted and depressed","Feet flat, arch in lower back","Full ROM: bar to chest","Elbows ~45° angle"],
    squat:["Feet shoulder width, toes slightly out","Hit parallel or below — hip crease below knee","Knees track over toes","Chest up, neutral spine","Drive through full foot"],
    deadlift:["Bar over mid-foot","Hips hinge, not squat","Lats engaged, no rounding","Lockout: hips fully extended","Bar close to body throughout"],
    ohp:["Core braced, glutes tight","Bar starts at collarbone","Press straight up, head through","Full lockout overhead","No excessive back lean"],
    row:["Torso ~45° angle","Pull to lower chest/stomach","Squeeze shoulder blades","Control the eccentric","No excessive body English"],
    pullup:["Full hang at bottom","Pull chest to bar","Scapulae retract at top","Control descent","No kipping unless intended"],
    curl:["Elbows pinned to sides","Full ROM: extend and contract","No swinging body","Squeeze at top","Control negative"],
  };

  const defaultCues=["Full range of motion","Control the eccentric (lowering)","Maintain neutral spine","Breathe: exhale on exertion","Focus on mind-muscle connection"];

  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
      videoRef.current.srcObject=stream;
      videoRef.current.play();
      const mr=new MediaRecorder(stream);
      chunks.current=[];
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data);};
      mr.onstop=()=>{
        const blob=new Blob(chunks.current,{type:"video/webm"});
        setVideoUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t=>t.stop());
      };
      mediaRef.current=mr;
      mr.start();
      setRecording(true);
    }catch(e){
      SuccessToastCtrl.show("Camera access needed for form check");
    }
  };

  const stopRec=()=>{
    if(mediaRef.current&&mediaRef.current.state==="recording"){
      mediaRef.current.stop();
      setRecording(false);
    }
  };

  const exercises=s.exercises.filter(e=>["Chest","Back","Legs","Shoulders","Arms"].includes(e.cat));
  const cues=formCues[selEx]||defaultCues;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Form Check</div>
      <div style={{fontSize:12,color:V.text3}}>Record a set and review against form cues</div>

      {/* Exercise selector */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        {exercises.map(ex=>(
          <button key={ex.id} onClick={()=>setSelEx(ex.id)} style={{
            padding:"6px 12px",borderRadius:8,border:`1.5px solid ${selEx===ex.id?V.accent:V.cardBorder}`,
            background:selEx===ex.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",WebkitTapHighlightColor:"transparent",
            fontSize:11,fontWeight:600,color:selEx===ex.id?V.accent:V.text3,fontFamily:V.font
          }}>{ex.name.length>15?ex.name.slice(0,15)+"…":ex.name}</button>
        ))}
      </div>

      {selEx&&(
        <div>
          {/* Form cues checklist */}
          <Card style={{padding:12,marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Form Cues: {s.exercises.find(e=>e.id===selEx)?.name}</div>
            {cues.map((cue,i)=>{
              const key=`${selEx}-${i}`;
              const checked=!!checkedCues[key];
              return(
              <button key={i} onClick={()=>toggleCue(key)} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6,
                background:"none",border:"none",padding:"4px 0",cursor:"pointer",width:"100%",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
                <div style={{width:20,height:20,borderRadius:5,flexShrink:0,marginTop:1,transition:"all .15s",
                  background:checked?V.accent:"transparent",
                  border:`1.5px solid ${checked?V.accent:V.accent+"40"}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {checked&&<span style={{fontSize:11,color:V.bg,fontWeight:900,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:11,color:checked?V.text3:V.text2,lineHeight:1.5,textDecoration:checked?"line-through":"none",
                  transition:"color .15s"}}>{cue}</span>
              </button>
              );
            })}
          </Card>

          {/* Video area */}
          <Card style={{padding:12}}>
            <video ref={videoRef} style={{width:"100%",borderRadius:8,background:"#000",display:recording?"block":"none"}} playsInline muted/>
            {videoUrl&&!recording&&(
              <video src={videoUrl} style={{width:"100%",borderRadius:8}} controls playsInline/>
            )}
            <div style={{display:"flex",gap:8,marginTop:10}}>
              {!recording&&!videoUrl&&(
                <Btn full onClick={startRec}>{Icons.target({size:14,color:V.bg})} Record Set</Btn>
              )}
              {recording&&(
                <Btn full onClick={stopRec} s={{background:V.danger}}>{Icons.x({size:14,color:"#fff"})} Stop</Btn>
              )}
              {videoUrl&&!recording&&(
                <div style={{display:"flex",gap:8,width:"100%"}}>
                  <Btn v="secondary" full onClick={()=>{setVideoUrl(null);}}>Retake</Btn>
                  <Btn full onClick={()=>{
                    const a=document.createElement("a");a.href=videoUrl;a.download=`formcheck-${selEx}-${today()}.webm`;a.click();
                  }}>{Icons.download({size:14,color:V.bg})} Save</Btn>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {!selEx&&(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:12,color:V.text3}}>Select an exercise above to see form cues and record a set</div>
        </Card>
      )}
    </div>
  );
}

// ─── #1 Data Integrity Safeguards ───
export function useDataGuard(s){
  return useMemo(()=>{
    const warnings=[];
    // Body weight outliers
    const bw=s.body.filter(b=>parseFloat(b.weight)>0).sort((a,b)=>a.date.localeCompare(b.date));
    for(let i=1;i<bw.length;i++){
      const w1=parseFloat(bw[i].weight)||0,w0=parseFloat(bw[i-1].weight)||0;
      const diff=Math.abs(w1-w0);
      if(diff>15){warnings.push({type:"body",severity:"high",msg:`Weight jump: ${w0}→${w1} (${w1-w0>0?"+":""}${(w1-w0).toFixed(1)} ${s.units}) on ${bw[i].date}`,date:bw[i].date,id:bw[i].id});}
      else if(diff>8){warnings.push({type:"body",severity:"med",msg:`Unusual weight change: ${diff.toFixed(1)} ${s.units} on ${bw[i].date}`,date:bw[i].date,id:bw[i].id});}
    }
    // Workout weight outliers per exercise
    const exMap={};
    s.workouts.forEach(w=>w.exercises.forEach(ex=>{
      ex.sets.forEach(st=>{if(st.weight>0){if(!exMap[ex.exerciseId])exMap[ex.exerciseId]=[];exMap[ex.exerciseId].push({w:st.weight,date:w.date,id:w.id});}});
    }));
    Object.entries(exMap).forEach(([eid,entries])=>{
      if(entries.length<3)return;
      const avg=entries.reduce((s2,e)=>s2+e.w,0)/entries.length;
      const std=Math.sqrt(entries.reduce((s2,e)=>s2+Math.pow(e.w-avg,2),0)/entries.length);
      entries.forEach(e=>{
        if(Math.abs(e.w-avg)>std*2.5&&std>10){
          const name=s.exercises.find(x=>x.id===eid)?.name||eid;
          warnings.push({type:"workout",severity:"med",msg:`${name}: ${e.w} ${s.units} is unusual (avg: ${Math.round(avg)}) on ${e.date}`,date:e.date,id:e.id});
        }
      });
    });
    // Duplicate workout detection (same date, very similar exercises)
    const dateMap={};
    s.workouts.forEach(w=>{if(!dateMap[w.date])dateMap[w.date]=[];dateMap[w.date].push(w);});
    Object.entries(dateMap).forEach(([date,ws])=>{
      if(ws.length>1){
        for(let i=1;i<ws.length;i++){
          const exA=ws[0].exercises.map(e=>e.exerciseId).sort().join(",");
          const exB=ws[i].exercises.map(e=>e.exerciseId).sort().join(",");
          if(exA===exB)warnings.push({type:"duplicate",severity:"high",msg:`Duplicate workout on ${date} (same exercises)`,date,id:ws[i].id});
          else warnings.push({type:"duplicate",severity:"low",msg:`Multiple workouts on ${date}`,date,id:ws[i].id});
        }
      }
    });
    // Calorie sanity
    s.nutrition.forEach(n=>{
      if(n.cal>6000)warnings.push({type:"nutrition",severity:"med",msg:`${n.cal} cal on ${n.date} seems high`,date:n.date,id:n.id});
      if(n.cal>0&&n.cal<500)warnings.push({type:"nutrition",severity:"low",msg:`Only ${n.cal} cal on ${n.date}`,date:n.date,id:n.id});
      if(n.protein>400)warnings.push({type:"nutrition",severity:"med",msg:`${n.protein}g protein on ${n.date} seems high`,date:n.date,id:n.id});
    });
    return warnings.sort((a,b)=>{const sev={high:0,med:1,low:2};return(sev[a.severity]||2)-(sev[b.severity]||2);});
  },[s.workouts,s.body,s.nutrition,s.exercises,s.units]);
}

export function DataGuardTab({s,d}){
  const warnings=useDataGuard(s);
  const sevColor={high:V.danger,med:V.warn,low:V.text3};
  const sevLabel={high:"Critical",med:"Warning",low:"Info"};

  const deleteItem=(w)=>{
    if(w.type==="workout"||w.type==="duplicate")d({type:"DEL_W",id:w.id});
    else if(w.type==="body")d({type:"DEL_B",id:w.id});
    else if(w.type==="nutrition")d({type:"DEL_N",id:w.id});
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Data Integrity</div>
      <div style={{fontSize:12,color:V.text3}}>Auto-scanned for outliers, duplicates, and suspicious values</div>

      {warnings.length===0?(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>✅</div>
          <div style={{fontSize:14,fontWeight:700,color:V.accent}}>All clear</div>
          <div style={{fontSize:11,color:V.text3,marginTop:4}}>No data issues detected across {s.workouts.length} workouts, {s.nutrition.length} nutrition logs, and {s.body.length} measurements</div>
        </Card>
      ):(
        <div>
          <div style={{fontSize:11,color:V.text3,marginBottom:8}}>{warnings.length} issue{warnings.length>1?"s":""} found</div>
          {warnings.map((w,i)=>(
            <Card key={i} style={{padding:12,marginBottom:6}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{width:8,height:8,borderRadius:4,background:sevColor[w.severity],marginTop:4,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:sevColor[w.severity],textTransform:"uppercase",marginBottom:2}}>{sevLabel[w.severity]}</div>
                  <div style={{fontSize:12,color:V.text,lineHeight:1.4}}>{w.msg}</div>
                </div>
                <button onClick={()=>ConfirmCtrl.show("Delete flagged entry?",w.msg,()=>deleteItem(w))} style={{padding:"5px 10px",borderRadius:6,
                  background:"rgba(255,107,107,0.08)",border:`1px solid rgba(255,107,107,0.15)`,cursor:"pointer",fontSize:10,color:V.danger,fontWeight:700,
                  flexShrink:0,whiteSpace:"nowrap"}}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── #2 Phase/Cycle Tracking ───
export function PhaseTracker({s,d}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({type:"cut",start:today(),end:"",notes:""});
  const phases=s.phases||[];

  const phaseTypes=[
    {id:"cut",label:"Cut",color:V.danger,icon:"🔥"},
    {id:"bulk",label:"Bulk",color:V.accent,icon:"💪"},
    {id:"maintain",label:"Maintain",color:V.accent2,icon:"⚖️"},
    {id:"strength",label:"Strength",color:V.purple,icon:"🏋️"},
    {id:"deload",label:"Deload",color:V.warn,icon:"🧘"},
  ];

  const addPhase=()=>{
    if(!form.start)return;
    const p={id:uid(),type:form.type,start:form.start,end:form.end||null,notes:form.notes,active:!form.end};
    d({type:"SET_PHASES",phases:[...phases,p]});
    SuccessToastCtrl.show("Phase started");
    setForm({type:"cut",start:today(),end:"",notes:""});setShowAdd(false);
  };

  const endPhase=(id)=>{d({type:"SET_PHASES",phases:phases.map(p=>p.id===id?{...p,end:today(),active:false}:p)});SuccessToastCtrl.show("Phase ended");};
  const deletePhase=(id)=>{d({type:"SET_PHASES",phases:phases.filter(p=>p.id!==id)});SuccessToastCtrl.show("Phase deleted");};

  const phaseStats=(phase)=>{
    const ws=s.workouts.filter(w=>w.date>=phase.start&&(!phase.end||w.date<=phase.end));
    const bs=s.body.filter(b=>b.date>=phase.start&&(!phase.end||b.date<=phase.end));
    const ns=s.nutrition.filter(n=>n.date>=phase.start&&(!phase.end||n.date<=phase.end));
    const startBW=bs.length?bs[bs.length-1].weight:null;
    const endBW=bs.length?bs[0].weight:null;
    const avgCal=ns.length?Math.round(ns.reduce((a,n)=>a+n.cal,0)/ns.length):0;
    const totalVol=ws.reduce((v,w)=>v+w.exercises.reduce((e,ex)=>e+ex.sets.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0);
    const days=phase.end?Math.ceil((new Date(phase.end)-new Date(phase.start))/86400000):Math.ceil((new Date()-new Date(phase.start))/86400000);
    return{workouts:ws.length,days,startBW,endBW,bwChange:startBW&&endBW?(endBW-startBW).toFixed(1):null,avgCal,totalVol};
  };

  const active=phases.find(p=>p.active);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Training Phases</div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",borderRadius:8,
          background:`${V.accent}12`,border:`1px solid ${V.accent}25`,cursor:"pointer",
          fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>+ New Phase</button>
      </div>

      {active&&(()=>{
        const pt=phaseTypes.find(t=>t.id===active.type)||phaseTypes[2];
        const stats=phaseStats(active);
        return(
          <Card glow style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{pt.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:V.text}}>Active: {pt.label}</div>
                  <div style={{fontSize:10,color:V.text3}}>Day {stats.days} · Started {active.start}</div>
                </div>
              </div>
              <button onClick={()=>endPhase(active.id)} style={{padding:"5px 10px",borderRadius:6,
                background:`${V.warn}12`,border:`1px solid ${V.warn}25`,cursor:"pointer",fontSize:10,fontWeight:700,color:V.warn}}>End Phase</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Workouts",v:stats.workouts,c:V.accent},{l:"Avg Cal",v:stats.avgCal,c:V.warn},
                {l:"BW Change",v:stats.bwChange?`${stats.bwChange>0?"+":""}${stats.bwChange}`:"--",c:V.accent2}
              ].map(m=>(
                <div key={m.l} style={{textAlign:"center",padding:"8px 0",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                  <div style={{fontSize:16,fontWeight:800,color:m.c,fontFamily:V.mono}}>{m.v}</div>
                  <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{m.l}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {!active&&phases.length===0&&!showAdd&&(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>📊</div>
          <div style={{fontSize:13,fontWeight:600,color:V.text}}>No phases tracked yet</div>
          <div style={{fontSize:11,color:V.text3}}>Tag your training blocks to compare outcomes</div>
        </Card>
      )}

      {/* Past phases */}
      {phases.filter(p=>!p.active).length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:V.text3,marginBottom:6}}>Past Phases</div>
          {phases.filter(p=>!p.active).sort((a,b)=>b.start.localeCompare(a.start)).map(p=>{
            const pt=phaseTypes.find(t=>t.id===p.type)||phaseTypes[2];
            const stats=phaseStats(p);
            return(
              <Card key={p.id} style={{padding:12,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span>{pt.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:V.text}}>{pt.label} · {stats.days}d</div>
                      <div style={{fontSize:9,color:V.text3}}>{p.start} → {p.end}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.mono}}>{stats.workouts} workouts</div>
                      {stats.bwChange&&<div style={{fontSize:9,color:parseFloat(stats.bwChange)>0?V.accent:V.danger}}>{stats.bwChange>0?"+":""}{stats.bwChange} {s.units}</div>}
                    </div>
                    <button onClick={()=>deletePhase(p.id)} style={{background:"none",border:"none",cursor:"pointer",
                      fontSize:10,color:V.text3,padding:"2px 6px"}}>✕</button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd&&(
        <Sheet title="New Training Phase" onClose={()=>setShowAdd(false)}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {phaseTypes.map(t=>(
              <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))} style={{
                padding:"8px 14px",borderRadius:8,border:`1.5px solid ${form.type===t.id?t.color:V.cardBorder}`,
                background:form.type===t.id?`${t.color}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                <span>{t.icon}</span>
                <span style={{fontSize:12,fontWeight:600,color:form.type===t.id?t.color:V.text3}}>{t.label}</span>
              </button>
            ))}
          </div>
          <Field label="Start Date" type="date" value={form.start} onChange={v=>setForm(f=>({...f,start:v}))}/>
          <Field label="End Date (optional)" type="date" value={form.end} onChange={v=>setForm(f=>({...f,end:v}))}/>
          <Field label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="e.g. 500cal deficit, 4x/week"/>
          <Btn full onClick={addPhase} s={{marginTop:8}}>{Icons.check({size:16,color:V.bg})} Start Phase</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── #3 Exercise Substitution Intelligence ───
export const EXERCISE_SUBS={
  // Chest
  bench:["dbbench","machpress","svbench","pushup"],
  incbench:["dbincbench","svbench","pushup"],
  dbbench:["bench","machpress","pushup"],
  flye:["dbflye","pecfly","pushup"],
  dip:["pushup","machpress","bench"],
  // Back
  deadlift:["rdl","sumo","hyperext","sldl"],
  row:["dbrow","cablerow","tbarrow","pendlay"],
  pullup:["latpull","chinup","straightarm"],
  latpull:["pullup","chinup","straightarm"],
  // Legs
  squat:["legpress","goblet","frontsquat","hacksquat"],
  legpress:["squat","hacksquat","goblet","bss"],
  lunge:["bss","stepup","goblet"],
  // Shoulders
  ohp:["dbohp","arnoldpress","machpress"],
  lateralraise:["cablelt","machlt","reardelt"],
  // Arms
  curl:["hammercurl","preacher","spidercurl"],
  tricep:["skullcrusher","ohtriext","kickback","dip"],
};

export function SubstitutionFinder({s}){
  const [selEx,setSelEx]=useState(null);
  const subs=selEx?EXERCISE_SUBS[selEx]||[]:[];
  // Also suggest same-category exercises
  const selCat=s.exercises.find(e=>e.id===selEx)?.cat;
  const catSubs=selEx?s.exercises.filter(e=>e.cat===selCat&&e.id!==selEx&&!subs.includes(e.id)).slice(0,4):[];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Exercise Substitutions</div>
      <div style={{fontSize:12,color:V.text3}}>Find alternatives when equipment is unavailable</div>

      <Field label="Search exercise" value="" onChange={()=>{}} placeholder="Tap an exercise below"/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {s.exercises.filter(e=>!["Core","Cardio"].includes(e.cat)).slice(0,16).map(ex=>(
          <button key={ex.id} onClick={()=>setSelEx(ex.id)} style={{
            padding:"5px 10px",borderRadius:6,border:`1.5px solid ${selEx===ex.id?V.accent:V.cardBorder}`,
            background:selEx===ex.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",fontSize:10,fontWeight:600,color:selEx===ex.id?V.accent:V.text3,fontFamily:V.font
          }}>{ex.name.length>18?ex.name.slice(0,18)+"…":ex.name}</button>
        ))}
      </div>

      {selEx&&(
        <div>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:6}}>Best alternatives for {s.exercises.find(e=>e.id===selEx)?.name}</div>
          {subs.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {subs.map((sid,i)=>{
                const ex=s.exercises.find(e=>e.id===sid);
                if(!ex)return null;
                return(
                  <Card key={sid} style={{padding:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:24,height:24,borderRadius:6,background:`${V.accent}12`,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:11,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{i+1}</span>
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:V.text}}>{ex.name}</div>
                        <div style={{fontSize:10,color:V.text3}}>{ex.cat} · {i===0?"Best match":"Similar pattern"}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ):(
            <div style={{fontSize:11,color:V.text3}}>No preset substitutions. Try these from the same muscle group:</div>
          )}
          {catSubs.length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:V.text3,fontWeight:600,marginBottom:4}}>Same muscle group</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {catSubs.map(ex=>(
                  <span key={ex.id} style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.03)",
                    border:`1px solid ${V.cardBorder}`,fontSize:10,color:V.text2}}>{ex.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── #4 Injury-Aware Training ───
export const JOINT_MAP={
  shoulder:["ohp","dbohp","lateralraise","arnoldpress","bench","incbench","dip","pushup","facepull","reardelt","cablateral","machlateral","machshoulder","svohp","landmine","zspress","handstandpush","behindneckpress","luyang","cleanjerk","snatch","pushjerk","thruster"],
  knee:["squat","frontsquat","hacksquat","legpress","lunge","bss","legext","stepup","goblet","walkinglunge","reverselunge","boxsquat","smithsquat","pendulumsguat","pistolsquat","beltquat","clean","thruster","singlelegpress"],
  lower_back:["deadlift","sumo","rdl","sldl","row","pendlay","hyperext","squat","goodmorning","rackpull","clean","snatch","hangclean","dbrdl","smithrdl","reversehy"],
  elbow:["curl","hammercurl","preacher","tricep","skullcrusher","ohtriext","kickback","bench","ohp","ezbar","inclinecurl","bayesian","spidercurl","closegrip","jmpress","21s"],
  wrist:["bench","ohp","curl","deadlift","row","pushup","clean","snatch","farmwalk","wristcurl","reversewrist"],
  hip:["squat","deadlift","hipthrust","lunge","bss","sumo","rdl","cablepullthrough","glutebridge","singlelegrdl","nordiccurl","goodmorning","hipabductor","hipadductor","pistolsquat"],
};

export function InjuryManager({s,d}){
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({joint:"",severity:"moderate",notes:""});
  const injuries=s.injuries||[];

  const joints=[
    {id:"shoulder",label:"Shoulder",icon:"🦾"},{id:"knee",label:"Knee",icon:"🦵"},
    {id:"lower_back",label:"Lower Back",icon:"🔙"},{id:"elbow",label:"Elbow",icon:"💪"},
    {id:"wrist",label:"Wrist",icon:"✋"},{id:"hip",label:"Hip",icon:"🦴"},
  ];

  const addInjury=()=>{
    if(!form.joint)return;
    d({type:"SET_INJURIES",injuries:[...injuries,{id:uid(),joint:form.joint,severity:form.severity,notes:form.notes,date:today(),active:true}]});
    SuccessToastCtrl.show("Injury flagged");
    setForm({joint:"",severity:"moderate",notes:""});setShowAdd(false);
  };

  const resolveInjury=(id)=>{d({type:"SET_INJURIES",injuries:injuries.map(inj=>inj.id===id?{...inj,active:false,resolved:today()}:inj)});SuccessToastCtrl.show("Injury resolved");};
  const deleteInjury=(id)=>{d({type:"SET_INJURIES",injuries:injuries.filter(inj=>inj.id!==id)});SuccessToastCtrl.show("Injury removed");};

  const activeInjuries=injuries.filter(inj=>inj.active);
  const flaggedExercises=useMemo(()=>{
    const flagged=new Set();
    activeInjuries.forEach(inj=>{(JOINT_MAP[inj.joint]||[]).forEach(eid=>flagged.add(eid));});
    return flagged;
  },[activeInjuries]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Injury Awareness</div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"6px 12px",borderRadius:8,
          background:`${V.warn}12`,border:`1px solid ${V.warn}25`,cursor:"pointer",
          fontSize:11,fontWeight:700,color:V.warn,fontFamily:V.font}}>+ Flag Pain</button>
      </div>

      {activeInjuries.length>0?(
        <div>
          <div style={{padding:"8px 12px",borderRadius:8,background:`${V.danger}08`,border:`1px solid ${V.danger}15`,marginBottom:8}}>
            <span style={{fontSize:11,color:V.danger,fontWeight:600}}>{flaggedExercises.size} exercises flagged — consider substitutions or reduced load</span>
          </div>
          {activeInjuries.map(inj=>{
            const j=joints.find(j2=>j2.id===inj.joint);
            const affected=(JOINT_MAP[inj.joint]||[]).map(eid=>s.exercises.find(e=>e.id===eid)?.name).filter(Boolean);
            return(
              <Card key={inj.id} style={{padding:12,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>{j?.icon||"⚠️"}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>{j?.label||inj.joint}</div>
                      <div style={{fontSize:9,color:V.text3}}>Since {inj.date} · {inj.severity}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>resolveInjury(inj.id)} style={{padding:"4px 8px",borderRadius:6,
                      background:`${V.accent}12`,border:"none",cursor:"pointer",fontSize:9,color:V.accent,fontWeight:700}}>Resolved</button>
                    <button onClick={()=>deleteInjury(inj.id)} style={{padding:"4px 8px",borderRadius:6,
                      background:"rgba(255,107,107,0.08)",border:"none",cursor:"pointer",fontSize:9,color:V.danger}}>✕</button>
                  </div>
                </div>
                {inj.notes&&<div style={{fontSize:10,color:V.text3,fontStyle:"italic",marginBottom:6}}>{inj.notes}</div>}
                <div style={{fontSize:9,color:V.warn,fontWeight:600,marginBottom:4}}>Affected exercises:</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {affected.slice(0,8).map(n=>(
                    <span key={n} style={{padding:"2px 6px",borderRadius:4,background:`${V.warn}08`,fontSize:8,color:V.warn}}>{n}</span>
                  ))}

                </div>
              </Card>
            );
          })}
        </div>
      ):(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>💚</div>
          <div style={{fontSize:13,fontWeight:600,color:V.accent}}>No active injuries</div>
          <div style={{fontSize:11,color:V.text3}}>Flag pain points to get safer exercise suggestions</div>
        </Card>
      )}

      {injuries.filter(inj=>!inj.active).length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:V.text3,marginBottom:4}}>Resolved</div>
          {injuries.filter(inj=>!inj.active).map(inj=>(
            <div key={inj.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",opacity:0.5}}>
              <span style={{fontSize:10}}>{joints.find(j=>j.id===inj.joint)?.icon||"✓"}</span>
              <span style={{fontSize:11,color:V.text3}}>{joints.find(j=>j.id===inj.joint)?.label} · {inj.date} → {inj.resolved}</span>
              <span style={{flex:1}}/>
              <button onClick={()=>deleteInjury(inj.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:V.text3}}>✕</button>
            </div>
          ))}
        </div>
      )}

      {showAdd&&(
        <Sheet title="Flag Pain / Injury" onClose={()=>setShowAdd(false)}
          footer={<Btn full onClick={addInjury} disabled={!form.joint}>{Icons.check({size:16,color:V.bg})} Flag Injury</Btn>}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {joints.map(j=>(
              <button key={j.id} onClick={()=>setForm(f=>({...f,joint:j.id}))} style={{
                padding:"10px 14px",borderRadius:10,border:`1.5px solid ${form.joint===j.id?V.warn:V.cardBorder}`,
                background:form.joint===j.id?`${V.warn}10`:"rgba(255,255,255,0.02)",cursor:"pointer",
                display:"flex",alignItems:"center",gap:6}}>
                <span>{j.icon}</span>
                <span style={{fontSize:12,fontWeight:600,color:form.joint===j.id?V.warn:V.text3}}>{j.label}</span>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {["mild","moderate","severe"].map(sev=>(
              <button key={sev} onClick={()=>setForm(f=>({...f,severity:sev}))} style={{
                flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${form.severity===sev?(sev==="severe"?V.danger:sev==="moderate"?V.warn:V.accent2):V.cardBorder}`,
                background:form.severity===sev?`${sev==="severe"?V.danger:sev==="moderate"?V.warn:V.accent2}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",fontSize:11,fontWeight:600,color:form.severity===sev?V.text:V.text3,textTransform:"capitalize"}}>
                {sev}
              </button>
            ))}
          </div>
          <Field label="Notes (optional)" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="e.g. Sharp pain on overhead press"/>
        </Sheet>
      )}
    </div>
  );
}

// ─── #6 Coach Summary Report ───
export function WeeklySummary({s}){
  const canvasRef=useRef(null);
  const [generated,setGenerated]=useState(false);

  const stats=useMemo(()=>{
    const ws=s.workouts.filter(w=>w.date>=ago(7));
    const ns=s.nutrition.filter(n=>n.date>=ago(7));
    const r=calcReadiness(s);
    const totalVol=ws.reduce((v,w)=>v+w.exercises.reduce((e,ex)=>e+ex.sets.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0);
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

// ─── Fast Food Hacks Database ───
export const FF_HACKS=[
{r:"Arby's",cal:505,p:24,d:"Classic Beef and Cheddar Sandwich in a bowl\nNO BUN (240cals)\nSNACK SIZE Curly Fry (250cals)\n1 Arby's Sauce (15cals)"},
{r:"Buc-ee's",cal:500,p:26,d:"Wilde Protein Chips (170cals)\nJalapeño Cheddar Meat Stick (190 cals)\nOh Snap Sassy Bites (60 cals)\nAlani Gummy Bears (80 cals)"},
{r:"Cava",cal:540,p:40,d:"Half Greens/Half Grains Bowl: Super greens, Black Lentils, Harissa Honey Chicken, Fire Roasted Corn, Pickles, Pickled Onions, Tomato & Onions, Shredded Romaine, Yogurt Dill"},
{r:"Chicken Salad Chick",cal:460,p:20,d:"1 Scoop Jalapeno Holly Chicken Salad with lettuce leaves, tomato, bacon, pickle. Split into 2 lettuce wraps."},
{r:"Chick-fil-A",cal:390,p:30,d:"Egg White Griller Muffin (sub pepper jack), fruit cup instead of hash browns, Texas Pete, large half unsweet tea/lemonade"},
{r:"Chick-fil-A",cal:495,p:50,d:"12ct Grilled Nugget Meal, sub SMALL Mac & Cheese for fries. 1 Zesty Buffalo, 2 Texas Pete. Dip buffalo nuggets into mac & cheese."},
{r:"Chick-fil-A",cal:325,p:42,d:"BBQ Chicken Salad: 12ct Grilled Nuggets, sub side salad for fries, 1 BBQ Sauce, 2 Texas Pete, pickles. Shake into salad!"},
{r:"Chick-fil-A",cal:535,p:35,d:"Small Fry (320cal), 8ct Grilled Nuggets (130cal), side bacon crumbles (35cal), side cheese (50cal), Texas Pete"},
{r:"Chick-fil-A",cal:530,p:59,d:"Spicy Southwest Salad with EXTRA SPICY CHICKEN, NO DRESSING. Add ½ individual 0% Greek yogurt and Cholula hot sauce."},
{r:"Chick-fil-A",cal:460,p:60,d:"Grilled Pimento Cheese Sandwich lettuce wrapped, EXTRA jalapeños, 8ct grilled nuggets, 2 sides pickles, 1 honey BBQ, 1 Texas Pete"},
{r:"Chick-fil-A",cal:395,p:44,d:"12ct grilled nuggets with kale crunch salad as a side. 1 honey, 3 Texas Pete hot sauces, Diet Coke."},
{r:"Chick-fil-A",cal:580,p:44,d:"Chicken Tortilla Soup w/ tortilla strips, add Texas Pete"},
{r:"Chick-fil-A",cal:280,p:27,d:"Grilled Chicken Sandwich minus the bun, side of mac and cheese, Texas Pete"},
{r:"Chili's",cal:590,p:35,d:"Kids Grilled Chicken Dippers with steamed broccoli (320cal), side white cheddar mac & cheese (270cal)"},
{r:"Chipotle",cal:540,p:54,d:"Bowl: Steak x2, no rice, light black beans, fresh tomato salsa, fajita veggies, light cheese, EXTRA romaine. Side red salsa + sour cream crema."},
{r:"Chipotle",cal:545,p:70,d:"Bowl: EXTRA chicken, no rice, no beans, EXTRA fajita veggies, light cheese. Side red salsa + sour cream crema."},
{r:"Chipotle",cal:520,p:30,d:"3 Tacos: Steak, fajita veggies, fresh tomato salsa, romaine. NO rice/beans. Side red salsa + sour cream crema."},
{r:"Chipotle",cal:440,p:33,d:"Bowl: Brisket, no beans/rice, fajita veggies, corn pico, red chili habanero salsa, sour cream, lettuce. Split with Quest chips like nachos!"},
{r:"Chipotle",cal:460,p:47,d:"Bowl: Double steak, fajita veggies, light cheese, light romaine. Side red chili tomatillo + half sour cream for sauce."},
{r:"Culver's",cal:500,p:24,d:"Kids 2pc Chicken Tender Meal, Kids Fry, Medium Diet Coke, Frank's Buffalo Sauce for dipping"},
{r:"Dairy Queen",cal:200,p:4,d:"Kids Chocolate Dipped Cone — 200 cals!"},
{r:"Del Taco",cal:560,p:28,d:"2 Shredded Beef Birria Street Tacos and Consomé Dip Combo with small fry, medium hot sauce, Diet Coke"},
{r:"Dunkin'",cal:395,p:15,d:"\"Almond Joy\" Iced Coffee (135cal): Medium w/ almond milk, 3SF Coconut, 3SF Toasted Almond. Green Goddess Wrap (260cal)."},
{r:"Freddy's",cal:535,p:48,d:"Double Steak Burger LETTUCE WRAPPED: 1 American cheese, extra jalapeños, pickles, onions. 1 Fry Sauce. Diet Coke."},
{r:"Jimmy John's",cal:460,p:30,d:"Turkey Tom Unwich Combo: No mayo, extra turkey. ADD pickles, hot peppers, salt, oregano. Jalapeño chips."},
{r:"Jersey Mike's",cal:440,p:42,d:"#13 Original Italian in a Bowl: Onion, tomato, red wine vinegar, oregano, hot pepper relish, extra meat. NO OLIVE OIL BLEND."},
{r:"Jersey Mike's",cal:510,p:45,d:"#7 Turkey & Provolone Bowl: Extra turkey, NO olive oil blend. Onions, lettuce, tomatoes, red wine vinegar, oregano, pickles, banana peppers, jalapeño."},
{r:"Jersey Mike's",cal:400,p:49,d:"#8 Club Sub in a Bowl: Extra meat, NO mayo, NO vinegar, NO olive oil blend. Full toppings + provolone, bacon, jalapeño."},
{r:"McDonald's",cal:470,p:null,d:"McDouble NO BUN: No ketchup/mustard, extra lettuce, extra pickles. Small Fry. ½ Tangy BBQ sauce."},
{r:"McDonald's",cal:385,p:26,d:"Breakfast Taco: McChicken Biscuit NO BISCUIT, add folded egg, American cheese, bacon. Bring a Mission Carb Balance tortilla!"},
{r:"Mod Pizza",cal:420,p:25,d:"Mini 6\" pizza: Red sauce, mozzarella, plant-based Italian sausage, mushrooms, roasted garlic, red peppers, oregano, red onions, pesto drizzle."},
{r:"Moe's",cal:479,p:51,d:"10\" Junior Burrito: Double steak, seasoned rice, grilled peppers & onions, corn pico, tomatoes, pico, fresh jalapeño. Side sour cream + habanero."},
{r:"Olive Garden",cal:540,p:42,d:"Create Your Own: Sautéed shrimp, SUB BROCCOLI FOR PASTA, alfredo on side (use half). Comes with salad + breadsticks."},
{r:"Panda Express",cal:535,p:39,d:"Bowl: Teriyaki Chicken, half white rice, half super greens. Chili sauce + soy sauce."},
{r:"Panda Express",cal:460,p:30,d:"Bowl: Black Pepper Angus Steak + super greens (270cal). Chili sauce. 1 order Cream Cheese Rangoon (180cal)."},
{r:"Panera",cal:520,p:34,d:"Whole Mediterranean Veggie Sandwich: No feta, no hummus, no mayo. ADD Black Forest Ham. Side Green Goddess Dressing."},
{r:"Popeyes",cal:500,p:50,d:"5pc Blackened Tender Combo: Mac & cheese, no biscuit. Louisiana hot sauce + pickles. Coat tenders, dip in mac & cheese!"},
{r:"Popeyes",cal:390,p:45,d:"5pc Blackened Tender Combo: Mashed potatoes w/ Cajun Gravy, no biscuit. DIP DIP!"},
{r:"Popeyes",cal:530,p:51,d:"5pc Blackened Tender Combo: Red Beans & Rice, no biscuit. Louisiana Hot Sauce, Diet Coke."},
{r:"Qdoba",cal:500,p:36,d:"Extra grilled steak, cilantro lime rice, no beans, street corn, pickled red onions, fajita veggies, romaine, cojita, fiery habanero salsa."},
{r:"Raising Cane's",cal:500,p:31,d:"2 Tenders, 1 Texas Toast (split longways as wraps), coleslaw, Louisiana Hot Sauce. Build wraps!"},
{r:"Raising Cane's",cal:530,p:57,d:"4pc Box Combo \"NAKED\" tenders, no fries, extra coleslaw (save for later). Split toast as sandwich bread."},
{r:"Shake Shack",cal:456,p:38,d:"Double hamburger lettuce wrapped with tomatoes, onions, pickles. 1 side Shack Sauce."},
{r:"Smoothie King",cal:350,p:30,d:"Lean1 Pineapple Mango 20oz: Add Blue Spirulina + 2 scoops Strawberry Gladiator Protein."},
{r:"Sonic",cal:430,p:null,d:"Hickory BBQ Chicken Tender Wrap NO BBQ sauce: Lettuce, pickle, tomato, onion. Large Diet Limeade w/ SF blackberry, SF raspberry, fresh lime."},
{r:"Subway",cal:460,p:27,d:"Black Forest Ham Wrap: MORE lettuce, spinach, MORE tomatoes, cucumbers, green peppers, red onions, pickles, olives, jalapeños, banana peppers, sweet onion teriyaki."},
{r:"Subway",cal:510,p:42,d:"Oven Roasted Turkey & Ham Wrap: DOUBLE turkey, all the veggies, jalapeños, banana peppers, sweet onion teriyaki."},
{r:"Taco Bell",cal:530,p:43,d:"Chicken Enchilada Burrito: Double Chicken, NO sour cream, NO cheese blend. Side cheese sauce (use ½), ALL fire sauce, Quest hot & spicy chips."},
{r:"Taco Bell",cal:336,p:36,d:"5pc Crispy Chicken Nuggets (336cal/36g protein). Diet Baja Blast. Each dipping sauce adds 210cal — favorites: Jalapeño Honey Mustard, Fire Ranch."},
{r:"Taco Bell",cal:510,p:45,d:"5pc Crispy Chicken Nuggets (no signature sauce) + Beef Supreme Soft Taco (no sour cream). Side cheese sauce + fire sauce for dipping. Add nuggets to taco!"},
{r:"Wendy's",cal:510,p:null,d:"Small Chili + cheese + onion (290cal). Junior Fry (210cal). Chili Sauce. DIP DIP!"},
{r:"Wendy's",cal:470,p:31,d:"Grilled Chicken Ranch Wrap: Add pickle, onion, and bacon."},
{r:"Wendy's",cal:530,p:34,d:"Double Stack on LETTUCE: Tomatoes, onion, bacon. 4ct Spicy Chicken Nuggets. Add nuggets to burger or dip in Sweet & Sour/BBQ."},
{r:"Wendy's",cal:340,p:24,d:"Breakfast: Egg bacon cheese croissant NO CROISSANT, no Swiss, ADD American, extra bacon, 1 extra egg. Cholula."},
{r:"Wendy's",cal:510,p:45,d:"Parmesan Chicken Caesar Salad: EXTRA Chicken, ½ Caesar dressing packet."},
{r:"Zaxby's",cal:530,p:40,d:"4 Finger Plate: Sub extra coleslaw for fries, no toast. Tongue Torch sauce, pickles. Dip tenders → sauce → coleslaw."},
{r:"Zaxby's",cal:490,p:38,d:"Grilled Chicken Sandwich: Lettuce, tomatoes, pickles. 1 Tongue Torch Sauce."},
];

export const FF_BRANDS={
"Arby's":{color:"#d4302f",emoji:"🥩"},"Buc-ee's":{color:"#fbbf24",emoji:"⛽"},"Cava":{color:"#2d6a4f",emoji:"🥙"},
"Chicken Salad Chick":{color:"#c2185b",emoji:"🐔"},"Chick-fil-A":{color:"#e51636",emoji:"🐄"},"Chili's":{color:"#00833e",emoji:"🌶️"},
"Chipotle":{color:"#441500",emoji:"🌯"},"Culver's":{color:"#004b87",emoji:"🍔"},"Dairy Queen":{color:"#ee1c2e",emoji:"🍦"},
"Del Taco":{color:"#e31837",emoji:"🌮"},"Dunkin'":{color:"#ff6600",emoji:"☕"},"Freddy's":{color:"#b71c1c",emoji:"🍔"},
"Jimmy John's":{color:"#1a1a1a",emoji:"🥖"},"Jersey Mike's":{color:"#0054a4",emoji:"🥪"},"McDonald's":{color:"#ffc72c",emoji:"🍟"},
"Mod Pizza":{color:"#c62828",emoji:"🍕"},"Moe's":{color:"#ffd600",emoji:"🌯"},"Olive Garden":{color:"#5c6b29",emoji:"🍝"},
"Panda Express":{color:"#d32f2f",emoji:"🐼"},"Panera":{color:"#4a7c59",emoji:"🥖"},"Popeyes":{color:"#f26522",emoji:"🍗"},
"Qdoba":{color:"#8b4513",emoji:"🌯"},"Raising Cane's":{color:"#fdd835",emoji:"🍗"},"Shake Shack":{color:"#1a1a1a",emoji:"🍔"},
"Smoothie King":{color:"#e91e63",emoji:"🥤"},"Sonic":{color:"#0071ce",emoji:"🥤"},"Subway":{color:"#008c15",emoji:"🥖"},
"Taco Bell":{color:"#702082",emoji:"🔔"},"Wendy's":{color:"#e2203d",emoji:"🍔"},"Zaxby's":{color:"#0033a0",emoji:"🍗"},
};

export function FastFoodHacks({s,d}){
  const [search,setSearch]=useState("");
  const [brand,setBrand]=useState("All");
  const [sort,setSort]=useState("cal"); // cal, protein, name
  const [expanded,setExpanded]=useState(null);

  const brands=["All",...[...new Set(FF_HACKS.map(h=>h.r))].sort()];

  const filtered=useMemo(()=>{
    let list=FF_HACKS;
    if(brand!=="All")list=list.filter(h=>h.r===brand);
    if(search)list=list.filter(h=>h.r.toLowerCase().includes(search.toLowerCase())||h.d.toLowerCase().includes(search.toLowerCase()));
    if(sort==="cal")list=[...list].sort((a,b)=>a.cal-b.cal);
    else if(sort==="protein")list=[...list].sort((a,b)=>(b.p||0)-(a.p||0));
    else list=[...list].sort((a,b)=>a.r.localeCompare(b.r));
    return list;
  },[search,brand,sort]);

  const addToNutrition=(hack)=>{
    const n={id:uid(),date:today(),cal:hack.cal||0,protein:hack.p||0,carbs:0,fat:0,fiber:0,water:0,sleep:0,
      meals:[{name:"Fast Food",items:[{name:`${hack.r} Hack`,cal:hack.cal||0,protein:hack.p||0,carbs:0,fat:0}]}]};
    d({type:"ADD_N",n});
    SuccessToastCtrl.show(`${hack.r} hack logged`);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:V.text}}>Fast Food Hacks</div>
          <div style={{fontSize:11,color:V.text3}}>{filtered.length} macro-friendly meals under 600 cal</div>
        </div>
      </div>

      {/* Search */}
      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}>{Icons.search({size:14,color:V.text3})}</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search restaurants or ingredients..."
          aria-label="Search fast food hacks"
          style={{width:"100%",padding:"10px 14px 10px 34px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:V.font}}/>
      </div>

      {/* Sort */}
      <div style={{display:"flex",gap:6}}>
        {[{k:"cal",l:"Lowest Cal"},{k:"protein",l:"Most Protein"},{k:"name",l:"A→Z"}].map(s2=>(
          <button key={s2.k} onClick={()=>setSort(s2.k)} style={{padding:"6px 12px",borderRadius:8,
            border:`1.5px solid ${sort===s2.k?V.accent:V.cardBorder}`,
            background:sort===s2.k?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",fontSize:10,fontWeight:600,color:sort===s2.k?V.accent:V.text3,fontFamily:V.font}}>{s2.l}</button>
        ))}
      </div>

      {/* Brand filter — horizontal scroll */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
        {brands.map(b=>{
          const info=FF_BRANDS[b];
          return(
            <button key={b} onClick={()=>setBrand(b)} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,
              border:`1.5px solid ${brand===b?(info?.color||V.accent):V.cardBorder}`,
              background:brand===b?`${info?.color||V.accent}15`:"rgba(255,255,255,0.02)",
              cursor:"pointer",fontSize:10,fontWeight:600,color:brand===b?(info?.color||V.accent):V.text3,
              fontFamily:V.font,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              {info?.emoji&&<span style={{fontSize:12}}>{info.emoji}</span>}
              {b}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.map((hack,i)=>{
        const info=FF_BRANDS[hack.r]||{color:V.accent,emoji:"🍽️"};
        const isExpanded=expanded===i;
        return(
          <div key={i} onClick={()=>setExpanded(isExpanded?null:i)} style={{
            background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,borderRadius:14,
            overflow:"hidden",cursor:"pointer",transition:"all .15s"}}>
            {/* Header */}
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${info.color}15`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {info.emoji}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:V.text,display:"flex",alignItems:"center",gap:6}}>
                  {hack.r}
                </div>
                <div style={{fontSize:10,color:V.text3,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {hack.d.split("\n")[0]}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:16,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{hack.cal}</div>
                <div style={{fontSize:8,color:V.text3,fontWeight:600}}>CAL</div>
              </div>
              {hack.p&&(
                <div style={{textAlign:"right",flexShrink:0,marginLeft:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{hack.p}g</div>
                  <div style={{fontSize:8,color:V.text3,fontWeight:600}}>PROT</div>
                </div>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded&&(
              <div style={{padding:"0 14px 14px",borderTop:`1px solid ${V.cardBorder}`}}>
                <div style={{padding:"10px 0",fontSize:12,color:V.text2,lineHeight:1.6,whiteSpace:"pre-line"}}>{hack.d}</div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={e=>{e.stopPropagation();addToNutrition(hack);}} style={{flex:1,padding:"10px",borderRadius:10,
                    background:`${V.accent}12`,border:`1px solid ${V.accent}25`,cursor:"pointer",
                    fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    {Icons.plus({size:14,color:V.accent})} Log This Meal
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:30,color:V.text3}}>
          <div style={{fontSize:28,marginBottom:8}}>🔍</div>
          <div style={{fontSize:13}}>No hacks found for "{search||brand}"</div>
        </div>
      )}
    </div>
  );
}

// ─── Meal Plan Generator ───
export function MealPlanGenerator({s}){
  const [plan,setPlan]=useState(null);
  const goals=s.goals||{cal:2400,protein:180,carbs:250,fat:70};
  // Categorize foods by meal type
  const mealFoods={
    Breakfast:FOODS.filter(f=>["Dairy","Grains","Fruit"].includes(f.cat)||["Eggs (2 large)","Oatmeal (1 cup)","Greek Yogurt","Banana","Protein Shake","Peanut Butter (2 tbsp)","Whole Wheat Bread (2 slices)","Cottage Cheese (1 cup)"].includes(f.n)),
    Lunch:FOODS.filter(f=>["Protein","Grains","Vegetables"].includes(f.cat)||f.p>=15),
    Dinner:FOODS.filter(f=>["Protein","Vegetables","Grains"].includes(f.cat)||f.p>=20),
    Snacks:FOODS.filter(f=>f.cal<=250&&f.cal>=50),
  };
  const generate=()=>{
    const meals=["Breakfast","Lunch","Dinner","Snacks"];
    const splits=[0.28,0.32,0.3,0.1];
    const result=meals.map((name,i)=>{
      const calTarget=Math.round(goals.cal*splits[i]);
      const pool=(mealFoods[name]||FOODS).filter(f=>f.cal<=calTarget*0.6).sort(()=>Math.random()-0.5);
      const items=[];let cal=0,prot=0;
      for(const f of pool){
        if(cal+f.cal<=calTarget*1.1&&items.length<(name==="Snacks"?2:3)&&!items.some(x=>x.n===f.n)){
          items.push(f);cal+=f.cal;prot+=f.p;
        }
        if(items.length>=(name==="Snacks"?2:3))break;
      }
      return{name,items,cal,prot,target:{cal:calTarget,prot:Math.round(goals.protein*splits[i])}};
    });
    setPlan(result);SuccessToastCtrl.show("Meal plan generated");
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Daily Meal Plan</div>
      <div style={{fontSize:11,color:V.text3}}>Auto-generated to hit your macro targets: {goals.cal}cal / {goals.protein}g protein</div>
      <Btn full onClick={generate}>{Icons.refresh({size:14,color:V.bg})} Generate Plan</Btn>
      {plan&&plan.map((meal,i)=>(
        <Card key={i} style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:700,color:V.text}}>{meal.name}</span>
            <span style={{fontSize:10,color:V.accent,fontFamily:V.mono}}>{meal.cal}cal / {meal.prot}g</span>
          </div>
          {meal.items.map((f,j)=>(
            <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:11,
              borderBottom:j<meal.items.length-1?`1px solid rgba(255,255,255,0.03)`:"none"}}>
              <span style={{color:V.text2}}>{f.n}</span>
              <span style={{color:V.text3,fontFamily:V.mono}}>{f.cal}cal · {f.p}g</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

// ─── Workout Programs Marketplace ───
export const PROGRAMS=[
  {id:"ppl6",name:"Push Pull Legs",weeks:8,days:6,level:"Intermediate",
    desc:"Classic 6-day split. Push muscles, pull muscles, legs. Repeat.",
    schedule:["Push","Pull","Legs","Push","Pull","Legs","Rest"],
    exercises:{Push:["Bench Press","OHP","Incline DB Press","Lateral Raise","Tricep Pushdown","Overhead Ext"],
      Pull:["Barbell Row","Pull-ups","Face Pull","DB Curl","Hammer Curl","Lat Pulldown"],
      Legs:["Squat","Romanian Deadlift","Leg Press","Leg Curl","Calf Raise","Lunges"]}},
  {id:"531",name:"5/3/1 Wendler",weeks:4,days:4,level:"Intermediate-Advanced",
    desc:"Proven strength program. Four main lifts, progressive overload built in.",
    schedule:["Squat","Bench","Rest","Deadlift","OHP","Rest","Rest"],
    exercises:{Squat:["Squat 5/3/1","Leg Press","Leg Curl","Ab Wheel"],
      Bench:["Bench 5/3/1","DB Row","Incline DB Press","Tricep Pushdown"],
      Deadlift:["Deadlift 5/3/1","Good Morning","Hanging Leg Raise","DB Curl"],
      OHP:["OHP 5/3/1","Chin-ups","Lateral Raise","Face Pull"]}},
  {id:"phul",name:"PHUL",weeks:8,days:4,level:"Intermediate",
    desc:"Power Hypertrophy Upper Lower. Strength + size in 4 days.",
    schedule:["Upper Power","Lower Power","Rest","Upper Hyper","Lower Hyper","Rest","Rest"],
    exercises:{"Upper Power":["Bench Press","Barbell Row","OHP","Barbell Curl","Skull Crusher"],
      "Lower Power":["Squat","Deadlift","Leg Press","Calf Raise"],
      "Upper Hyper":["Incline DB Press","Cable Row","Lateral Raise","DB Curl","Tricep Pushdown"],
      "Lower Hyper":["Front Squat","Romanian Deadlift","Leg Curl","Leg Extension","Calf Raise"]}},
  {id:"fb3",name:"Full Body 3x",weeks:12,days:3,level:"Beginner",
    desc:"Three full body sessions per week. Perfect for beginners building a base.",
    schedule:["Full Body","Rest","Full Body","Rest","Full Body","Rest","Rest"],
    exercises:{"Full Body":["Squat","Bench Press","Barbell Row","OHP","DB Curl","Plank"]}},
  {id:"bro5",name:"Bro Split",weeks:8,days:5,level:"Any",
    desc:"One muscle group per day. Chest, Back, Shoulders, Arms, Legs.",
    schedule:["Chest","Back","Shoulders","Arms","Legs","Rest","Rest"],
    exercises:{Chest:["Bench Press","Incline DB Press","Cable Fly","Dips"],
      Back:["Deadlift","Pull-ups","Barbell Row","Lat Pulldown","Face Pull"],
      Shoulders:["OHP","Lateral Raise","Rear Delt Fly","Shrugs"],
      Arms:["Barbell Curl","Hammer Curl","Skull Crusher","Tricep Pushdown"],
      Legs:["Squat","Leg Press","Romanian Deadlift","Leg Curl","Calf Raise"]}},
  {id:"nsuns",name:"nSuns 5/3/1 LP",weeks:6,days:5,level:"Intermediate",
    desc:"High volume linear progression. 9 sets of main lift + accessories.",
    schedule:["Bench/OHP","Squat/Sumo","Rest","OHP/Incline","Deadlift/Front Squat","Rest","Rest"],
    exercises:{"Bench/OHP":["Bench 9 sets","OHP 8 sets","DB Row","Lateral Raise","Tricep Pushdown"],
      "Squat/Sumo":["Squat 9 sets","Sumo Deadlift 8 sets","Leg Press","Leg Curl"],
      "OHP/Incline":["OHP 9 sets","Incline Bench 8 sets","Pull-ups","Face Pull","DB Curl"],
      "Deadlift/Front Squat":["Deadlift 9 sets","Front Squat 8 sets","Barbell Row","Ab Wheel"]}},
];

export function ProgramMarketplace({s,d}){
  const [sel,setSel]=useState(null);
  const apply=(prog)=>{
    const weekly={};
    prog.schedule.forEach((label,i)=>{weekly[i]=label;});
    d({type:"SET_SCHEDULE",schedule:{weekly,overrides:{}}});
    SuccessToastCtrl.show(`${prog.name} applied to schedule`);
    setSel(null);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Training Programs</div>
      <div style={{fontSize:11,color:V.text3}}>Pick a program and it auto-populates your weekly schedule.</div>
      {PROGRAMS.map(p=>(
        <Card key={p.id} onClick={()=>setSel(sel===p.id?null:p.id)} style={{padding:14,cursor:"pointer",
          border:sel===p.id?`1.5px solid ${V.accent}`:`1px solid ${V.cardBorder}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:V.text}}>{p.name}</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2}}>{p.weeks} weeks · {p.days} days/week · {p.level}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:V.text2,marginTop:6,lineHeight:1.5}}>{p.desc}</div>
          {sel===p.id&&(
            <div style={{marginTop:10}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,i)=>(
                  <div key={i} style={{padding:"4px 8px",borderRadius:6,fontSize:9,fontWeight:600,
                    background:p.schedule[i]==="Rest"?"rgba(255,255,255,0.03)":`${V.accent}10`,
                    color:p.schedule[i]==="Rest"?V.text3:V.accent,border:`1px solid ${p.schedule[i]==="Rest"?V.cardBorder:V.accent+"25"}`}}>
                    <div>{day}</div><div style={{fontWeight:700}}>{p.schedule[i]}</div>
                  </div>
                ))}
              </div>
              {/* Exercise details per day */}
              {p.exercises&&(
                <div style={{marginBottom:10}}>
                  {[...new Set(p.schedule.filter(d2=>d2!=="Rest"))].map(day=>(
                    p.exercises[day]&&<div key={day} style={{marginBottom:6}}>
                      <div style={{fontSize:10,fontWeight:700,color:V.accent,marginBottom:2}}>{day}</div>
                      <div style={{fontSize:10,color:V.text3,lineHeight:1.6,paddingLeft:8}}>{p.exercises[day].join(" · ")}</div>
                    </div>
                  ))}
                </div>
              )}
              <Btn full onClick={()=>apply(p)}>{Icons.check({size:14,color:V.bg})} Start This Program</Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Supplement Tracker ───
export const DEFAULT_SUPPS=["Creatine (5g)","Protein Shake","Multivitamin","Fish Oil","Vitamin D","Pre-Workout","Magnesium","Zinc"];

export function SupplementTracker({s,d}){
  const [supps,setSupps]=useState(()=>{ const raw=LS.get("ft-supplements"); return Array.isArray(raw)?raw:DEFAULT_SUPPS.slice(0,4); });
  const [checked,setChecked]=useState(LS.get(`ft-supps-${today()}`)||{});
  const [newSupp,setNewSupp]=useState("");

  const toggle=(name)=>{
    const next={...checked,[name]:!checked[name]};
    setChecked(next);LS.set(`ft-supps-${today()}`,next);
    // Mark supplement mission flag if at least one is checked
    if(Object.values(next).some(Boolean))LS.set("ft-supps-logged",today());
  };
  const addSupp=()=>{
    if(!newSupp.trim())return;
    const next=[...supps,newSupp.trim()];
    setSupps(next);LS.set("ft-supplements",next);setNewSupp("");
    SuccessToastCtrl.show("Supplement added");
  };
  const rmSupp=(name)=>{
    const next=supps.filter(s2=>s2!==name);
    setSupps(next);LS.set("ft-supplements",next);
  };
  const doneCount=Object.values(checked).filter(Boolean).length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Supplements</div>
          <div style={{fontSize:11,color:V.text3}}>Daily checklist · {doneCount}/{supps.length} taken today</div>
        </div>
        <div style={{fontSize:20,fontWeight:800,color:doneCount===supps.length?V.accent:V.text3,fontFamily:V.mono}}>
          {supps.length>0?Math.round(doneCount/supps.length*100):0}%
        </div>
      </div>
      {/* Progress bar */}
      <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
        <div style={{height:"100%",borderRadius:2,background:V.accent,width:`${supps.length>0?doneCount/supps.length*100:0}%`,transition:"width .3s"}}/>
      </div>
      {supps.map(name=>(
        <div key={name} onClick={()=>toggle(name)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
          background:checked[name]?`${V.accent}06`:"rgba(255,255,255,0.02)",border:`1px solid ${checked[name]?V.accent+"20":V.cardBorder}`,
          borderRadius:10,cursor:"pointer"}}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${checked[name]?V.accent:V.text3}`,
            background:checked[name]?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {checked[name]&&<span style={{color:V.bg,fontSize:12,fontWeight:900}}>✓</span>}
          </div>
          <span style={{flex:1,fontSize:13,color:checked[name]?V.accent:V.text,fontWeight:checked[name]?600:400,
            textDecoration:checked[name]?"line-through":"none"}}>{name}</span>
          <button onClick={e=>{e.stopPropagation();rmSupp(name);}} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>
            {Icons.x({size:12,color:V.text3})}
          </button>
        </div>
      ))}
      <div style={{display:"flex",gap:8}}>
        <input value={newSupp} onChange={e=>setNewSupp(e.target.value)} placeholder="Add supplement..."
          onKeyDown={e=>{if(e.key==="Enter")addSupp();}}
          style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",fontFamily:V.font}}/>
        <Btn onClick={addSupp} disabled={!newSupp.trim()}>{Icons.plus({size:14,color:V.bg})}</Btn>
      </div>
      <div style={{fontSize:9,color:V.text3}}>Suggestions: {DEFAULT_SUPPS.filter(s2=>!supps.includes(s2)).slice(0,3).join(", ")}</div>
    </div>
  );
}

// ─── Photo Comparison Slider ───
// ─── Personal Records Page ───
export function PersonalRecords({s}){
  const prs=useMemo(()=>{
    const map={};
    s.workouts.forEach(w=>w.exercises.forEach(ex=>{
      const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
      const cat=s.exercises.find(e=>e.id===ex.exerciseId)?.cat||"Other";
      ex.sets.forEach(st=>{
        const wt=parseFloat(st.weight)||0;const reps=parseInt(st.reps)||0;
        if(wt<=0)return;
        const e1rm=calc1RM(wt,reps);
        if(!map[ex.exerciseId]||e1rm>map[ex.exerciseId].e1rm){
          map[ex.exerciseId]={name,cat,weight:wt,reps,e1rm,date:w.date,exerciseId:ex.exerciseId};
        }
      });
    }));
    return Object.values(map).sort((a,b)=>b.e1rm-a.e1rm);
  },[s.workouts,s.exercises]);

  // Find how close recent lifts are to PR
  const recentPct=(exerciseId)=>{
    const pr=prs.find(p=>p.exerciseId===exerciseId);if(!pr)return null;
    for(const w of s.workouts.slice(0,10)){
      const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
      if(ex){const best=Math.max(...ex.sets.map(st=>calc1RM(parseFloat(st.weight)||0,parseInt(st.reps)||0)));
        if(best>0)return Math.round(best/pr.e1rm*100);}
    }return null;
  };

  const [catFilter,setCatFilter]=useState("All");
  const cats=["All",...new Set(prs.map(p=>p.cat))];
  const filtered=catFilter==="All"?prs:prs.filter(p=>p.cat===catFilter);
  const big3=["bench","squat","deadlift"].map(id=>prs.find(p=>p.exerciseId===id)).filter(Boolean);
  const big3Total=big3.reduce((a,p)=>a+p.weight,0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Personal Records</div>
      {big3.length>0&&(
        <Card style={{padding:14,border:`1px solid ${V.warn}20`,background:`${V.warn}04`}}>
          <div style={{fontSize:12,fontWeight:700,color:V.warn,marginBottom:8}}>🏆 Big 3 Total: {big3Total} {wUnit(s.units)}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {big3.map(p=>(
              <div key={p.exerciseId} style={{textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:V.text,fontFamily:V.mono}}>{p.weight}</div>
                <div style={{fontSize:9,color:V.text3}}>{p.name.split(" ")[0]}</div>
                <div style={{fontSize:8,color:V.text3}}>{fmtShort(p.date)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {cats.map(c=><Chip key={c} label={c} active={catFilter===c} onClick={()=>setCatFilter(c)}/>)}
      </div>
      <div style={{fontSize:10,color:V.text3}}>{filtered.length} exercises with PRs</div>
      {filtered.map((pr,i)=>{
        const pct=recentPct(pr.exerciseId);
        return(
          <Card key={i} style={{padding:12,cursor:"pointer"}} onClick={()=>{
              // Navigate to strength analysis pre-selecting this exercise
              LS.set("ft-sel-exercise",pr.exerciseId);
              s.dispatch&&s.dispatch({type:"TAB",tab:"track_strength"});
            }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:V.text}}>{pr.name}</div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
                  <div style={{fontSize:10,color:V.text3}}>{pr.cat} · {fmtShort(pr.date)}</div>
                  {(()=>{const days=Math.round((Date.now()-new Date(pr.date+"T12:00:00"))/86400000);
                    const hot=days<=14;const cold=days>=180;
                    return <span style={{fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:4,
                      background:hot?"rgba(34,197,94,0.12)":cold?"rgba(56,189,248,0.1)":"rgba(255,255,255,0.04)",
                      color:hot?"#22c55e":cold?"#38bdf8":V.text3}}>
                      {hot?"🔥 Recent":cold?"🧊 Cold":days<90?`${days}d ago`:`${Math.floor(days/30)}mo ago`}
                    </span>;
                  })()}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{pr.weight}×{pr.reps}</div>
                <div style={{fontSize:9,color:V.text3}}>E1RM: {pr.e1rm} {wUnit(s.units)}</div>
              </div>
            </div>
            {pct!==null&&pct<100&&(
              <div style={{marginTop:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:V.text3,marginBottom:2}}>
                  <span>Recent: {pct}% of PR</span>
                  <span>{100-pct}% to match</span>
                </div>
                <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
                  <div style={{height:"100%",borderRadius:2,background:pct>=90?V.accent:pct>=75?V.warn:V.danger,width:`${pct}%`}}/>
                </div>
              </div>
            )}
            {pct===100&&<div style={{fontSize:9,color:V.accent,fontWeight:600,marginTop:4}}>💪 Matched this session!</div>}
          </Card>
        );
      })}
      {prs.length===0&&<Card style={{padding:20,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>Log some workouts to see your PRs here</div></Card>}
    </div>
  );
}

export function PhotoCompare({s}){
  const photos=(s.photos||[]).filter(p=>!p.private&&p.data).sort((a,b)=>a.date.localeCompare(b.date));
  const [leftIdx,setLeftIdx]=useState(0);
  const [rightIdx,setRightIdx]=useState(Math.max(0,photos.length-1));
  const [sliderPos,setSliderPos]=useState(50);
  const containerRef=useRef(null);

  if(photos.length<2)return(
    <div style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:32,marginBottom:8}}>📸</div>
      <div style={{fontSize:14,fontWeight:700,color:V.text}}>Need at least 2 photos</div>
      <div style={{fontSize:11,color:V.text3,marginTop:4}}>Take progress photos over time to compare your transformation.</div>
    </div>
  );

  const handleSlide=(e)=>{
    const rect=containerRef.current?.getBoundingClientRect();
    if(!rect)return;
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const pct=Math.max(5,Math.min(95,((clientX-rect.left)/rect.width)*100));
    setSliderPos(pct);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Progress Compare</div>
      {/* Date selectors */}
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:V.text3,marginBottom:4,fontWeight:600}}>BEFORE</div>
          <select value={leftIdx} onChange={e=>setLeftIdx(parseInt(e.target.value))}
            style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}>
            {photos.map((p,i)=><option key={i} value={i} style={{background:V.bg}}>{fmtShort(p.date)}</option>)}
          </select>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:V.text3,marginBottom:4,fontWeight:600}}>AFTER</div>
          <select value={rightIdx} onChange={e=>setRightIdx(parseInt(e.target.value))}
            style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font}}>
            {photos.map((p,i)=><option key={i} value={i} style={{background:V.bg}}>{fmtShort(p.date)}</option>)}
          </select>
        </div>
      </div>
      {/* Time span */}
      {photos[leftIdx]&&photos[rightIdx]&&(()=>{
        const d1=new Date(photos[leftIdx].date),d2=new Date(photos[rightIdx].date);
        const days=Math.abs(Math.round((d2-d1)/(86400000)));
        const span=days<7?`${days} days`:days<60?`${Math.round(days/7)} weeks`:`${Math.round(days/30)} months`;
        return days>0?<div style={{textAlign:"center",fontSize:11,color:V.accent,fontWeight:600,padding:"4px 0"}}>{span} apart</div>:null;
      })()}
      {/* Slider comparison */}
      <div ref={containerRef} onMouseMove={e=>{if(e.buttons===1)handleSlide(e);}} onTouchMove={handleSlide}
        style={{position:"relative",borderRadius:14,overflow:"hidden",aspectRatio:"3/4",border:`1px solid ${V.cardBorder}`,cursor:"col-resize",touchAction:"none"}}>
        {/* Right (after) image — full */}
        <img src={photos[rightIdx]?.data} alt="After photo" style={{position:"absolute",top:0,left:0,right:0,bottom:0,width:"100%",height:"100%",objectFit:"cover"}}/>
        {/* Left (before) image — clipped */}
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,width:`${sliderPos}%`,overflow:"hidden"}}>
          <img src={photos[leftIdx]?.data} alt="Before photo" style={{position:"absolute",top:0,left:0,width:containerRef.current?containerRef.current.offsetWidth+"px":"100%",height:"100%",objectFit:"cover"}}/>
        </div>
        {/* Slider line */}
        <div style={{position:"absolute",top:0,bottom:0,left:`${sliderPos}%`,width:3,background:V.accent,transform:"translateX(-50%)",zIndex:10}}>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:32,height:32,borderRadius:16,
            background:V.accent,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>
            <span style={{color:V.bg,fontSize:12,fontWeight:900}}>⟷</span>
          </div>
        </div>
        {/* Labels */}
        <div style={{position:"absolute",bottom:8,left:8,padding:"4px 8px",borderRadius:6,background:"rgba(0,0,0,0.7)",fontSize:10,color:"#fff",fontWeight:600,zIndex:5}}>
          {fmtShort(photos[leftIdx]?.date)}
        </div>
        <div style={{position:"absolute",bottom:8,right:8,padding:"4px 8px",borderRadius:6,background:"rgba(0,0,0,0.7)",fontSize:10,color:"#fff",fontWeight:600,zIndex:5}}>
          {fmtShort(photos[rightIdx]?.date)}
        </div>
      </div>
    </div>
  );
}

// ─── AI Coach Chat (Claude API — BYOK + Free Tier) ───
export function AICoachChat({s}){
  const [userKey,setUserKey]=useState(null);
  const [keyLoaded,setKeyLoaded]=useState(false);
  // Load API key from encrypted storage on mount
  useEffect(()=>{
    LS.getSecure("ft-anthropic-key").then(k=>{setUserKey(k||null);setKeyLoaded(true);});
  },[]);
  const defaultMsg=[{role:"assistant",content:userKey
    ?"Hey! I'm your AI coach. Ask me anything about your training, nutrition, or recovery. I have access to all your workout data."
    :"Welcome to AI Coach! To get started, you'll need your own Anthropic API key. Paste it in the field above — it stays on your device and never touches our servers. Get a key at console.anthropic.com."}];
  const [msgs,setMsgs]=useState(LS.get("ft-ai-chat")||defaultMsg);
  const aiStreak=useStreak(s.workouts);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const scrollRef=useRef(null);
  const [apiKeyInput,setApiKeyInput]=useState("");
  // Reset chat when API key is first added (so welcome message updates)
  useEffect(()=>{
    if(userKey&&msgs.length===1&&msgs[0].role==="assistant"&&msgs[0].content.includes("API key")){
      setMsgs([{role:"assistant",content:"Hey! I'm your AI coach. Ask me anything about your training, nutrition, or recovery. I have full access to your workout data."}]);
    }
  },[userKey]);
  // Persist messages
  useEffect(()=>{if(msgs.length>1)LS.set("ft-ai-chat",msgs.slice(-20));},[msgs]);

  const buildContext=()=>{
    const rw=s.workouts.slice(0,5).map(w=>`${w.date}: ${w.exercises.map(e=>`${s.exercises.find(x=>x.id===e.exerciseId)?.name||e.exerciseId} (${e.sets.length} sets)`).join(", ")}`).join("\n");
    const bw=s.body[0]?`Current weight: ${s.body[0].weight} ${wUnit(s.units)}`:"";
    const goals=s.goals?`Goals: ${s.goals.cal}cal, ${s.goals.protein}g protein`:"";
    const activePhase=(s.phases||[]).find(p=>p.active);
    const phase=activePhase?`Current phase: ${activePhase.type} (${activePhase.label||activePhase.type})`:"";
    const sched=s.schedule?.weekly||{};
    const todayType=s.schedule?.overrides?.[today()]||sched[new Date().getDay()]||"Rest";
    const schedule=`Today is ${todayType} day. Weekly: ${Object.values(sched).join(", ")}`;
    
    const injuries=(s.injuries||[]).filter(inj=>inj.active).map(inj=>inj.name||inj.area).join(", ");
    return`You are IRONLOG AI Coach. Be concise, actionable, encouraging. Max 3 paragraphs.\n\nUser data:\n${bw}\n${goals}\n${phase}\n${schedule}\nStreak: ${aiStreak} days\n${injuries?`Active injuries: ${injuries}`:""}\n\nRecent workouts:\n${rw}`;
  };

  const send=async()=>{
    if(!input.trim()||!userKey)return;
    const userMsg={role:"user",content:input.trim()};
    setMsgs(m=>[...m,userMsg]);setInput("");setLoading(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":userKey,"anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,
          system:buildContext(),
          messages:[...msgs.filter(m=>m.role!=="system"),userMsg].map(m=>({role:m.role,content:m.content}))
        })
      });
      const data=await res.json();
      if(data.error){
        setMsgs(m=>[...m,{role:"assistant",content:`Error: ${data.error.message||"Invalid API key or request failed."}. Check your key in your Anthropic dashboard.`}]);
      }else{
        const reply=data.content?.[0]?.text||"Sorry, I couldn't process that. Try again.";
        setMsgs(m=>[...m,{role:"assistant",content:reply}]);
      }
    }catch(e){
      setMsgs(m=>[...m,{role:"assistant",content:"Connection failed. Check your internet connection."}]);
    }
    setLoading(false);
    setTimeout(()=>scrollRef.current?.scrollTo(0,scrollRef.current.scrollHeight),100);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 180px)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>AI Coach</div>
          <div style={{fontSize:10,color:userKey?V.accent:V.warn}}>{userKey?"Using your API key":"API key required"}</div>
        </div>
        {msgs.length>1&&<button onClick={()=>{setMsgs(defaultMsg);LS.set("ft-ai-chat",null);SuccessToastCtrl.show("Conversation cleared");}}
          style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            cursor:"pointer",fontSize:10,color:V.text3,fontFamily:V.font}}>Clear</button>}
      </div>
      {!userKey&&(
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input value={apiKeyInput||""} onChange={e=>setApiKeyInput(e.target.value)} placeholder="Paste Anthropic API key for unlimited"
            type="password" style={{flex:1,padding:"8px 10px",background:V.card,border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:10,outline:"none",fontFamily:V.mono}}/>
          <button onClick={async ()=>{if(apiKeyInput?.trim()){await LS.setSecure("ft-anthropic-key",apiKeyInput.trim());setUserKey(apiKeyInput.trim());SuccessToastCtrl.show("API key saved");}}}
            style={{padding:"6px 10px",borderRadius:6,background:`${V.accent}15`,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:V.accent}}>Save</button>
        </div>
      )}
      {userKey&&(
        <button onClick={async ()=>{await LS.setSecure("ft-anthropic-key",null);setUserKey(null);SuccessToastCtrl.show("API key removed");}}
          style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            cursor:"pointer",fontSize:9,color:V.text3,fontFamily:V.font,marginBottom:8,alignSelf:"flex-start"}}>Remove API Key</button>
      )}
      {/* Messages */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingBottom:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{padding:"10px 12px",borderRadius:12,maxWidth:"85%",lineHeight:1.5,fontSize:12,
            ...(m.role==="user"?{alignSelf:"flex-end",background:`${V.accent}15`,color:V.text}
              :{alignSelf:"flex-start",background:"rgba(255,255,255,0.04)",color:V.text2})}}>
            {m.content}
          </div>
        ))}
        {loading&&<div style={{alignSelf:"flex-start",padding:"10px 12px",borderRadius:12,background:"rgba(255,255,255,0.04)",fontSize:12,color:V.text3}}>Thinking...</div>}
      </div>
      {/* Input */}
      <div style={{display:"flex",gap:8,paddingTop:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder={userKey?"Ask your coach...":"Add your API key above to start"}
          disabled={!userKey} onKeyDown={e=>{if(e.key==="Enter")send();}}
          style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            borderRadius:10,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,opacity:userKey?1:0.5}}/>
        <Btn onClick={send} disabled={!input.trim()||loading||!userKey}>{Icons.check({size:14,color:V.bg})}</Btn>
      </div>
    </div>
  );
}

export const HELP_TOPICS={
  shields:{
    title:"🛡️ Streak Shields",
    color:"#38bdf8",
    summary:"Shields protect your streak when life gets in the way — completely automatically.",
    sections:[
      {icon:"🏆",title:"How you earn them",body:"You earn 1 shield every time your streak hits a multiple of 7 — at day 7, 14, 21, 28, and so on. The shield appears automatically, no action needed. You can hold a maximum of 3 at once, so earning more doesn't add a 4th."},
      {icon:"⚡",title:"How they activate",body:"100% automatic. If you miss a day and your last workout was exactly 1 day ago, a shield activates the moment you open the app — you don't tap anything. You'll see a blue banner saying your streak is protected. The shield is then consumed."},
      {icon:"📋",title:"The critical rule — 1-day gaps only",body:"Shields only cover a gap of exactly 1 missed day. Miss Monday → shield fires, Tuesday's gap is covered. But if you also miss Tuesday, the gap is now 2 days and your streak breaks — no shield can fix that. One miss = covered. Two in a row = gone."},
      {icon:"🛡️",title:"Where to see your shields",body:"Your shield count shows as 🛡️ next to your streak flame on the home screen and inside your Iron Score card. Tap ? next to your streak to open this guide. The '3d to 🛡️' countdown shows days until your next shield is earned."},
      {icon:"💡",title:"Strategy",body:"Hit a 7-day streak as fast as possible to bank your first shield before life interrupts. At 21 days you'll have a full 3-shield buffer — enough to cover a long weekend without losing everything you've built."},
    ]
  },
  xp:{
    title:"⚡ XP & Iron Ranks",
    color:"#f59e0b",
    summary:"Every action earns XP. XP determines your rank. Ranks are permanent.",
    sections:[
      {icon:"💪",title:"Daily XP sources",body:"Workout logged: +30 XP. Each PR hit: +20 XP. Consistency bonus (3+ sessions on the same lift in 14 days): +10 XP per lift. Nutrition log: +8 XP. Progress photo: +15 XP. Check-in: +5 XP. Daily missions: +20–50 XP each."},
      {icon:"🏆",title:"Milestone XP — the big jumps",body:"These bonus XP awards fire once when you hit each threshold and are included in your Iron Score permanently. Streak milestones: 7d +150, 14d +300, 30d +750, 60d +1500, 100d +3000. Big 3 strength: 500lb +200, 800lb +400, 1000lb +600, 1200lb +1000, 1500lb +2000. Monthly consistency: 16 workouts/month +500, 20+ workouts +1000."},
      {icon:"🏅",title:"The 30 ranks",body:"There are 30 ranks across 4 tiers — Iron, Steel, Titanium, and Diamond. Each has a unique name, icon, and XP threshold. You level up the moment your score crosses the line — no tests, no waiting. You can never lose a rank once earned."},
      {icon:"🔥",title:"XP multipliers",body:"Only one multiplier applies per session — the highest one available. Priority order: 3× Comeback (5+ days off, one-time) → 2× Double XP day (every Tue/Thu) → 1.5× 3-Day Combo (3 consecutive training days). Tap the Multipliers ? for details."},
      {icon:"🛡️",title:"Shields don't affect XP",body:"A shield covering a missed day protects your streak counter but not your XP. You earned 0 XP that day — the shield just keeps your flame alive. The only way to earn XP is to train."},
    ]
  },
  multipliers:{
    title:"🔥 XP Multipliers",
    color:"#f97316",
    summary:"One multiplier applies per session — the highest one wins.",
    sections:[
      {icon:"📋",title:"How multipliers work",body:"Only one multiplier can be active at a time. They don't stack. The app checks them in priority order — Comeback first, then Double XP day, then 3-Day Combo — and applies whichever one qualifies first. The active multiplier shows as a banner at the top of your Iron Score card."},
      {icon:"💥",title:"3× Comeback Bonus — highest priority",body:"If you haven't trained in 5 or more days, your very next workout earns 3× XP. It fires once and then expires — the banner disappears after you log. Perfect after travel, illness, or a rough week. Because it's highest priority, it beats Double XP day even if today is Tuesday or Thursday."},
      {icon:"⚡",title:"2× Double XP — Tuesdays & Thursdays",body:"Every Tuesday and Thursday your workout XP is doubled automatically. Base XP, PR bonuses, and consistency bonuses all double. No setup needed — just train. This is the most reliable multiplier to plan around; use these days for your hardest sessions."},
      {icon:"🔄",title:"1.5× 3-Day Combo — lowest priority",body:"Train 3 calendar days in a row (today, yesterday, and the day before) and a 1.5× combo bonus activates. It only applies if Comeback and Double XP day are both inactive. A solid reward for consistent mid-week training."},
      {icon:"💡",title:"Best strategy",body:"The highest single-session XP is a 3× Comeback return — so if you've been away 5+ days, come back on any day and you'll get 3× regardless. For ongoing max XP, Tuesday and Thursday double XP days are your most reliable tool."},
    ]
  },
  missions:{
    title:"🎯 Daily Missions",
    color:"#22c55e",
    summary:"Three daily challenges that reset at midnight. Complete them for bonus XP.",
    sections:[
      {icon:"📅",title:"How they work",body:"Every day at midnight, 3 missions are assigned. Complete them for bonus XP on top of whatever you earn from the activity itself. Missions don't carry over — anything incomplete disappears at midnight and a new set loads."},
      {icon:"🏅",title:"Mission types",body:"Workout: log any session (+25 XP), hit a PR (+50 XP), train before 8am — Early Bird (+45 XP). Nutrition: log a full day (+25 XP), hit your daily protein target (+30 XP). Social: send a DM to a friend (+20 XP). Habit: complete a check-in (+20 XP), log a rest day (+20 XP)."},
      {icon:"⚡",title:"XP and completion",body:"Each mission awards its XP when you complete the action — you don't need to tap anything inside the missions card itself. Completed missions show a green checkmark. Finishing all 3 in a day maximises your bonus XP for that day."},
      {icon:"🎯",title:"Finding and navigating",body:"Missions appear on the Home tab and the Social Feed. Tap any mission card to jump directly to the relevant section — so tapping the workout mission takes you straight to the log screen. Completed missions stay visible until midnight so you can track your daily sweep."},
    ]
  },
  duels:{
    title:"⚔️ 1v1 Duels",
    color:"#f43f5e",
    summary:"Challenge a friend to a head-to-head competition over a set timeframe.",
    sections:[
      {icon:"⚡",title:"Starting a duel",body:"Social → 1v1 Duels → + New Challenge. Pick a friend from your friend list, choose your metric (workouts, volume, streak, protein days, or Big 3 total), and choose a duration (3, 7, or 14 days). The duel starts the moment you confirm."},
      {icon:"📊",title:"How scoring works",body:"Progress metrics (workouts logged, volume lifted, protein days hit) count only activities after the duel started — your history before the challenge doesn't count. Standing metrics (current streak, Big 3 max) compare your current values at the end of the period."},
      {icon:"🏆",title:"Claiming results",body:"When the time runs out, the duel moves to Pending Results. Tap Claim to lock in the final scores — the winner is determined at that moment. After claiming, results are permanent and your W/L/T record updates immediately."},
      {icon:"🔄",title:"Rematch and history",body:"After any settled duel you can tap Rematch to instantly start a new duel with the same friend and metric. Tap the History tab to see all past results. Your W/L/T record is shown at the top of the Duels screen."},
      {icon:"👑",title:"Duel King badge",body:"Earn the 👑 Duel King badge at 5 wins. Your W/L/T record and Duel Wins count appear on the Social Leaderboard under the Duels tab, so your friends can see where you rank across the community."},
    ]
  },
  war:{
    title:"⚔️ Weekly Wars",
    color:"#fbbf24",
    summary:"A fresh set of challenges every Monday. Hit the target before Sunday to win.",
    sections:[
      {icon:"📅",title:"How wars work",body:"Every Monday morning, the current week's war activates. There are always 3 active challenges rotating each week — hitting the primary goal (the first one shown) is what counts as a War Win. The others are bonus objectives. Everything resets Monday."},
      {icon:"🏆",title:"Claiming your win",body:"When you hit the weekly target, a Claim Victory button appears. Tap it to lock in your win — it's not automatic. Claiming awards +100 XP and adds to your War Win streak. You can only claim once per week."},
      {icon:"🔥",title:"War Win streak",body:"Win the war in consecutive weeks to build a streak. Win this week and last week = a 2-week war streak. Miss a week and it resets to 0. Your all-time war wins and current streak are shown on your profile and tracked permanently."},
      {icon:"⚡",title:"Challenge types",body:"Wars rotate through: Most Workouts (e.g. 4 in a week), Volume Target (e.g. 10,000 lbs lifted), Protein Consistency (e.g. 4 protein days), Streak Hold (maintain your streak all week), and The Gauntlet — see below."},
      {icon:"💡",title:"The Gauntlet",body:"The hardest weekly challenge: complete 3 workouts + 4 protein days + hit at least 1 new PR, all within the same week. Each component is tracked independently on the wars screen. All 3 must be done to claim the Gauntlet win."},
    ]
  },
  challenges:{
    title:"🏆 Challenges & Badges",
    color:"#a78bfa",
    summary:"Permanent milestones that show up on your profile and sync to friends.",
    sections:[
      {icon:"🔥",title:"Streak challenge",body:"Consecutive days with a logged workout. Tiers: 🥉 Bronze = 7 days, 🥈 Silver = 14 days, 🥇 Gold = 21 days, 💎 Diamond = 30 days. Your current streak is compared live — hit the next tier and it updates immediately."},
      {icon:"🏋️",title:"Big 3 Total challenge",body:"Your best Bench + Squat + Deadlift single-rep maxes combined. Tiers: 🥉 Bronze = 600 lbs, 🥈 Silver = 800 lbs, 🥇 Gold = 1,000 lbs, 💎 Diamond = 1,200 lbs. Your all-time bests are used, not a single session."},
      {icon:"🥗",title:"Macro Master challenge",body:"Days in the last 7 where you hit your protein goal. Tiers: 🥉 Bronze = 3 days, 🥈 Silver = 5 days, 🥇 Gold = 7 days (a perfect protein week). Note: this challenge has 3 tiers, not 4 — there is no Diamond tier."},
      {icon:"🏅",title:"Badges",body:"Badges are one-time achievements displayed on your profile: 💯 Century Club (100 workouts logged), 🏋️ 1000lb Club (Big 3 ≥ 1000 lbs), 💎 Diamond Streak (30-day streak), 🔥 On Fire (7-day streak), 🥗 Macro Master (7 protein days in a week)."},
      {icon:"👥",title:"Friends can see everything",body:"Your challenge tiers and badges sync to the server each time you log a workout. Friends see your tiers on the Social Leaderboard and your full badge collection on your profile. Tiers are permanent — they never go backwards."},
    ]
  },
  ironscore:{
    title:"🏋️ Iron Score Explained",
    color:"#00f5a0",
    summary:"Your all-time XP total. It only goes up. It determines your rank.",
    sections:[
      {icon:"📊",title:"What Iron Score is",body:"Every XP point you've ever earned — from workouts, nutrition logs, PRs, check-ins, photos, missions, milestones, and multiplier bonuses — adds to your Iron Score permanently. Deleting a workout doesn't reduce it. It's a one-way counter of your effort."},
      {icon:"🏆",title:"How ranks work",body:"Your rank updates the instant your Iron Score crosses a threshold. 30 ranks across 4 tiers (Iron → Steel → Titanium → Diamond). You can never lose a rank. The rank icon next to your name on the leaderboard reflects where you are right now."},
      {icon:"🔢",title:"XP breakdown — daily activities",body:"Workout: +30 XP. Each PR: +20 XP. Consistency bonus per lift (3+ times in 14 days): +10 XP. Nutrition log: +8 XP. Progress photo: +15 XP. Check-in: +5 XP. Missions: +20–50 XP each. Weekly War win: +100 XP."},
      {icon:"⭐",title:"XP breakdown — milestones (the big ones)",body:"These fire once when you hit each threshold. Streak: 7d +150, 14d +300, 30d +750, 60d +1500, 100d +3000. Big 3 strength: 500lb +200, 800lb +400, 1000lb +600, 1200lb +1000, 1500lb +2000. Monthly consistency: 16 workouts +500, 20 workouts +1000. Badges earned: +75 XP each."},
      {icon:"📱",title:"Syncs across devices",body:"Your Iron Score lives on the server. Every time you log anything, it syncs. Sign into a new phone using your account PIN and your full score history is restored. The leaderboard in Social → Leaderboard ranks you against friends and group members in real time."},
    ]
  },
};

// ─── HelpBtn — small ? button for section headers ───
export function HelpBtn({topic,color}){
  const [open,setOpen]=useState(false);
  return(
    <>
      <button onClick={e=>{e.stopPropagation();setOpen(true);}}
        style={{width:18,height:18,borderRadius:"50%",border:`1px solid ${color||V.text3}40`,
          background:`${color||V.text3}10`,cursor:"pointer",display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:9,fontWeight:800,color:color||V.text3,
          fontFamily:V.font,padding:0,flexShrink:0,WebkitTapHighlightColor:"transparent",
          lineHeight:1}}>?</button>
      {open&&<HelpModal topic={topic} onClose={()=>setOpen(false)}/>}
    </>
  );
}

// ─── HelpModal — slide-up sheet with full tutorial ───
export function HelpModal({topic,onClose}){
  const t=HELP_TOPICS[topic];
  if(!t)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}/>
      <div onClick={e=>e.stopPropagation()}
        style={{position:"relative",zIndex:1,background:V.card,
          borderRadius:"20px 20px 0 0",border:`1px solid ${V.cardBorder}`,
          borderBottom:"none",maxHeight:"88vh",display:"flex",flexDirection:"column",
          animation:"slideUpSheet .25s ease-out"}}>
        {/* Header */}
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${V.cardBorder}`,flexShrink:0}}>
          <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",
            margin:"0 auto 14px"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:900,color:t.color,lineHeight:1.1,marginBottom:4}}>
                {t.title}
              </div>
              <div style={{fontSize:12,color:V.text3,lineHeight:1.5}}>{t.summary}</div>
            </div>
            <button onClick={onClose}
              style={{width:28,height:28,borderRadius:8,border:`1px solid ${V.cardBorder}`,
                background:"rgba(255,255,255,0.06)",cursor:"pointer",flexShrink:0,marginLeft:12,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,color:V.text3,fontFamily:V.font}}>✕</button>
          </div>
        </div>
        {/* Scrollable content */}
        <div style={{overflowY:"auto",flex:1,minHeight:0,padding:"14px 20px 0",WebkitOverflowScrolling:"touch"}}>
          {t.sections.map((sec,i)=>(
            <div key={i} style={{marginBottom:i<t.sections.length-1?14:0}}>
              <div style={{display:"flex",gap:12,padding:"12px 14px",borderRadius:12,
                background:`${t.color}08`,border:`1px solid ${t.color}18`}}>
                <span style={{fontSize:22,flexShrink:0,lineHeight:1.3}}>{sec.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:800,color:t.color,marginBottom:5,lineHeight:1.2}}>
                    {sec.title}
                  </div>
                  <div style={{fontSize:12,color:V.text2,lineHeight:1.6}}>{sec.body}</div>
                </div>
              </div>
            </div>
          ))}
          {/* Bottom padding so last section clears the button */}
          <div style={{height:14}}/>
        </div>
        {/* Sticky "Got it" footer — always visible, closes modal */}
        <div style={{flexShrink:0,padding:"12px 20px",
          paddingBottom:`max(20px, calc(env(safe-area-inset-bottom) + 12px))`,
          borderTop:`1px solid ${V.cardBorder}`,
          background:V.card}}>
          <button onClick={onClose}
            style={{width:"100%",padding:"13px",borderRadius:12,
              background:`linear-gradient(135deg,${t.color},${t.color}cc)`,
              border:"none",cursor:"pointer",
              fontSize:14,fontWeight:800,color:V.bg,fontFamily:V.font,
              letterSpacing:".02em"}}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ── IronScoreCard (replaces old version) ──
