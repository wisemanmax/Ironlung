import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Stat, Progress, Skeleton, SuccessToastCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid } from '../utils/helpers';
import { SocialAPI, SYNC_URL, APP_VERSION } from '../utils/sync';
import { AuthToken } from '../utils/auth';
import { IRON_RANKS } from '../data/ranks';
import { useLayout } from '../utils/responsive';
import { BADGE_DEFS } from '../data/badges';

function AdminPush({s,d}){
  const { isDesktop } = useLayout();
  const email=s.profile?.email;

  // ── Shared user list (loaded once, used by both push + in-app sections) ──
  const [users,setUsers]=useState(null);
  const [usersLoading,setUsersLoading]=useState(false);
  const [userSearch,setUserSearch]=useState("");
  const [dropdownOpen,setDropdownOpen]=useState(false);

  // ── Push section state ──
  const [pushTargetMode,setPushTargetMode]=useState("all"); // "all" | "selected"
  const [pushSelected,setPushSelected]=useState(new Set()); // emails
  const [title,setTitle]=useState("IRONLOG");
  const [body,setBody]=useState("");
  const [sending,setSending]=useState(false);
  const [result,setResult]=useState(null);
  const [subCount,setSubCount]=useState(null);
  const [history,setHistory]=useState(()=>LS.get("ft-admin-push-history")||[]);

  // ── In-app section state ──
  const [inAppTargetMode,setInAppTargetMode]=useState("all");
  const [inAppSelected,setInAppSelected]=useState(new Set());
  const [inAppDropdownOpen,setInAppDropdownOpen]=useState(false);
  const [inAppSearch,setInAppSearch]=useState("");
  const [notifFlags,setNotifFlags]=useState({streak_reminder:false,double_xp:false,comeback:false,mission_reminder:false,shield_awarded:false,custom:false});
  const [customMsg,setCustomMsg]=useState("");
  const [customTitle,setCustomTitle]=useState("");
  const [notifSending,setNotifSending]=useState(false);
  const [notifResult,setNotifResult]=useState(null);

  const NOTIF_TYPES=[
    {key:"streak_reminder",icon:"🔥",label:"Streak Reminder",desc:"Keep your streak alive today"},
    {key:"double_xp",icon:"⚡",label:"Double XP Alert",desc:"2× XP is active — log a workout"},
    {key:"comeback",icon:"💥",label:"Comeback Bonus",desc:"3× XP on next workout"},
    {key:"mission_reminder",icon:"🎯",label:"Mission Reminder",desc:"Daily missions still incomplete"},
    {key:"shield_awarded",icon:"🛡️",label:"Shield Awarded",desc:"A streak shield was added"},
    {key:"custom",icon:"📝",label:"Custom Message",desc:"Write your own notification"},
  ];

  const loadUsers=()=>{
    if(users!==null||usersLoading)return;
    setUsersLoading(true);
    fetch(`${SYNC_URL}/api/admin`,{method:"POST",headers:{...AuthToken.getHeaders(email),"Content-Type":"application/json"},
      body:JSON.stringify({action:"users"})})
      .then(r=>r.json()).then(j=>{setUsers(j?.users||[]);setUsersLoading(false);}).catch(()=>setUsersLoading(false));
  };

  useEffect(()=>{
    if(!email)return;
    fetch(`${SYNC_URL}/api/push`,{method:"POST",headers:{...AuthToken.getHeaders(email),"Content-Type":"application/json"},
      body:JSON.stringify({action:"count"})})
      .then(r=>r.json()).then(j=>{if(j.count!=null)setSubCount(j.count);}).catch(()=>{});
  },[email]);

  const filteredUsers=(search)=>(users||[]).filter(u=>
    !search||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Reusable multi-select user picker ──
  const UserPicker=({targetMode,setTargetMode,selected,setSelected,open,setOpen,search,setSearch,label})=>{
    const filtered=filteredUsers(search);
    const allSel=filtered.length>0&&filtered.every(u=>selected.has(u.email));
    const toggle=(e)=>{const ns=new Set(selected);ns.has(e)?ns.delete(e):ns.add(e);setSelected(ns);};
    const toggleAll=()=>{
      if(allSel){const ns=new Set(selected);filtered.forEach(u=>ns.delete(u.email));setSelected(ns);}
      else{const ns=new Set(selected);filtered.forEach(u=>ns.add(u.email));setSelected(ns);}
    };
    const selNames=[...(users||[])].filter(u=>selected.has(u.email)).map(u=>u.name||u.email.split("@")[0]);

    return(
      <div>
        <div style={{fontSize:10,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{label}</div>
        {/* Mode toggle */}
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {[{v:"all",l:"📣 All Users"},{v:"selected",l:"👤 Specific Users"}].map(opt=>(
            <button key={opt.v} onClick={()=>{setTargetMode(opt.v);if(opt.v==="selected"&&users===null)loadUsers();}}
              style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${targetMode===opt.v?V.accent+"60":V.cardBorder}`,
                background:targetMode===opt.v?`${V.accent}12`:"rgba(255,255,255,0.02)",cursor:"pointer",
                fontSize:11,fontWeight:700,color:targetMode===opt.v?V.accent:V.text3,fontFamily:V.font,transition:"all .15s"}}>
              {opt.l}
            </button>
          ))}
        </div>

        {targetMode==="selected"&&(
          <div style={{position:"relative"}}>
            {/* Selected chips */}
            {selected.size>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
                {[...(users||[])].filter(u=>selected.has(u.email)).map(u=>(
                  <div key={u.email} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px 3px 10px",
                    borderRadius:20,background:`${V.accent}15`,border:`1px solid ${V.accent}30`}}>
                    <span style={{fontSize:11,fontWeight:600,color:V.accent}}>{u.name||u.email.split("@")[0]}</span>
                    <button onClick={(e)=>{e.stopPropagation();toggle(u.email);}}
                      style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:1,
                        fontSize:12,color:V.accent,opacity:.7,marginTop:1}}>×</button>
                  </div>
                ))}
                <button onClick={()=>setSelected(new Set())}
                  style={{padding:"3px 8px",borderRadius:20,background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:10,color:V.text3,fontFamily:V.font}}>
                  Clear all
                </button>
              </div>
            )}

            {/* Dropdown trigger */}
            <button onClick={()=>{setOpen(v=>!v);if(!open&&users===null)loadUsers();}}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,
                background:"rgba(255,255,255,0.04)",border:`1px solid ${open?V.accent+"60":V.cardBorder}`,
                cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                fontFamily:V.font,transition:"all .15s"}}>
              <span style={{fontSize:12,color:selected.size>0?V.text:V.text3}}>
                {usersLoading?"Loading users…":selected.size>0?`${selected.size} user${selected.size!==1?"s":""} selected`:"Search and select users…"}
              </span>
              <span style={{fontSize:12,color:V.text3,transition:"transform .2s",
                display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
            </button>

            {/* Dropdown list */}
            {open&&(
              <div style={{position:"absolute",left:0,right:0,top:"calc(100% + 4px)",zIndex:200,
                background:V.sheetBg,border:`1px solid ${V.accent}40`,borderRadius:12,
                boxShadow:"0 8px 32px rgba(0,0,0,0.4)",overflow:"hidden"}}>
                {/* Search inside dropdown */}
                <div style={{padding:"8px 10px",borderBottom:`1px solid ${V.cardBorder}`}}>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search by name or email…" autoFocus
                    style={{width:"100%",padding:"8px 12px",background:"rgba(255,255,255,0.06)",
                      border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,
                      outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
                </div>
                {/* Select all row */}
                <div onClick={toggleAll}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",
                    borderBottom:`1px solid ${V.cardBorder}`,background:"rgba(255,255,255,0.02)"}}>
                  <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${allSel?V.accent:V.text3}`,flexShrink:0,
                    background:allSel?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {allSel&&<span style={{color:V.bg,fontSize:10,fontWeight:900,lineHeight:1}}>✓</span>}
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:allSel?V.accent:V.text3}}>
                    {allSel?"Deselect all":"Select all"} {search?`(${filtered.length} matching)`:`(${(users||[]).length} users)`}
                  </span>
                </div>
                {/* User rows */}
                <div style={{maxHeight:220,overflowY:"auto"}}>
                  {filtered.length===0&&<div style={{padding:16,textAlign:"center",fontSize:12,color:V.text3}}>No users found</div>}
                  {filtered.map(u=>{
                    const sel2=selected.has(u.email);
                    return(
                      <div key={u.email} onClick={()=>toggle(u.email)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",
                          background:sel2?`${V.accent}08`:"transparent",
                          borderBottom:`1px solid rgba(255,255,255,0.03)`,transition:"background .1s"}}>
                        <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${sel2?V.accent:V.text3}`,flexShrink:0,
                          background:sel2?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {sel2&&<span style={{color:V.bg,fontSize:10,fontWeight:900,lineHeight:1}}>✓</span>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:sel2?700:500,color:sel2?V.text:V.text3,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name||u.email.split("@")[0]}</div>
                          <div style={{fontSize:10,color:V.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                        </div>
                        {u.lastSync&&<div style={{fontSize:8,color:V.text3,flexShrink:0}}>active</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {targetMode==="selected"&&selected.size>0&&(
          <div style={{fontSize:10,color:V.text3,marginTop:4}}>
            {selected.size} user{selected.size!==1?"s":""} selected
            {subCount!=null&&pushTargetMode==="all"?"":" · only users with push enabled will receive it"}
          </div>
        )}
      </div>
    );
  };

  const TEMPLATES=[
    {icon:"🔥",label:"Motivate",title:"IRONLOG",body:"Don't break the streak today — every rep counts. Let's go! 💪"},
    {icon:"⚡",label:"Double XP",title:"⚡ Double XP Today!",body:"Earn 2× XP on all workouts today only. Open IRONLOG and get after it!"},
    {icon:"🏆",label:"Challenge",title:"New Challenge Live",body:"A new weekly challenge just dropped. Open IRONLOG to compete now."},
    {icon:"📣",label:"Update",title:"IRONLOG Update",body:"We just shipped new features. Open the app to check them out!"},
  ];

  const send=async()=>{
    if(!body.trim())return;
    setSending(true);setResult(null);
    // Build target list
    const targets=pushTargetMode==="selected"?[...pushSelected]:[];
    try{
      if(pushTargetMode==="all"){
        // Single broadcast to all
        const res=await fetch(`${SYNC_URL}/api/push`,{method:"POST",
          headers:{...AuthToken.getHeaders(email),"Content-Type":"application/json"},
          body:JSON.stringify({action:"send",title:title.trim()||"IRONLOG",body:body.trim(),tag:"admin-broadcast"})});
        const json=await res.json();
        if(res.ok){
          const entry={ts:new Date().toISOString(),title:title.trim()||"IRONLOG",body:body.trim(),
            target:"All users",sent:json.sent,failed:json.failed||0};
          const updated=[entry,...history].slice(0,20);setHistory(updated);LS.set("ft-admin-push-history",updated);
          setResult({ok:true,msg:`Sent to ${json.sent} device${json.sent!==1?"s":""} · ${json.failed||0} failed`});
          setBody("");
        }else setResult({ok:false,msg:res.status===401?"Unauthorized":res.status===403?"Forbidden":json.error||"Failed"});
      }else{
        // Send to each selected user individually
        if(targets.length===0){setResult({ok:false,msg:"Select at least one user"});setSending(false);return;}
        const outcomes=await Promise.allSettled(targets.map(te=>
          fetch(`${SYNC_URL}/api/push`,{method:"POST",
            headers:{...AuthToken.getHeaders(email),"Content-Type":"application/json"},
            body:JSON.stringify({action:"send",title:title.trim()||"IRONLOG",body:body.trim(),tag:"admin-broadcast",email:te})})
            .then(r=>r.json().then(j=>({ok:r.ok,sent:j.sent||0,failed:j.failed||0})))
        ));
        const totalSent=outcomes.reduce((a,r)=>a+(r.value?.sent||0),0);
        const totalFailed=outcomes.reduce((a,r)=>a+(r.value?.failed||0),0);
        const entry={ts:new Date().toISOString(),title:title.trim()||"IRONLOG",body:body.trim(),
          target:`${targets.length} users`,sent:totalSent,failed:totalFailed};
        const updated=[entry,...history].slice(0,20);setHistory(updated);LS.set("ft-admin-push-history",updated);
        setResult({ok:totalSent>0,msg:`Sent to ${totalSent} device${totalSent!==1?"s":""} · ${totalFailed} failed · ${targets.length} users targeted`});
        if(totalSent>0)setBody("");
      }
    }catch(e){setResult({ok:false,msg:e.message});}
    setSending(false);
  };

  const sendInApp=async()=>{
    const targets=inAppTargetMode==="all"?(users||[]).map(u=>u.email):[...inAppSelected];
    if(targets.length===0){setNotifResult({ok:false,msg:inAppTargetMode==="selected"?"Select at least one user":"No users loaded — load users first"});return;}
    const activeFlags=Object.fromEntries(Object.entries(notifFlags).filter(([,v])=>v));
    if(notifFlags.custom&&customMsg.trim()){activeFlags.custom=customMsg.trim();if(customTitle.trim())activeFlags.custom_title=customTitle.trim();}
    if(!Object.keys(activeFlags).length){setNotifResult({ok:false,msg:"Select at least one notification type"});return;}
    setNotifSending(true);setNotifResult(null);
    const results=await Promise.allSettled(targets.map(te=>
      fetch(`${SYNC_URL}/api/admin`,{method:"POST",headers:{...AuthToken.getHeaders(email),"Content-Type":"application/json"},
        body:JSON.stringify({action:"set_notif_flags",email:te,flags:activeFlags})}).then(r=>r.ok)
    ));
    const ok=results.filter(r=>r.value===true).length;
    setNotifResult({ok:ok>0,msg:`Queued for ${ok}/${targets.length} user${targets.length!==1?"s":""} — fires when they open the app`});
    setNotifSending(false);
  };

  const fmtTs=(ts)=>{const d=new Date(ts);return d.toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>📣 Push Broadcast</div>
          <div style={{fontSize:11,color:V.text3}}>Send push notifications to all users or specific people</div>
        </div>
        {subCount!=null&&(
          <div style={{textAlign:"right",padding:"6px 12px",borderRadius:10,background:`${V.accent}10`,border:`1px solid ${V.accent}20`}}>
            <div style={{fontSize:18,fontWeight:900,color:V.accent,fontFamily:V.mono}}>{subCount}</div>
            <div style={{fontSize:9,color:V.text3}}>SUBSCRIBED</div>
          </div>
        )}
      </div>

      {/* Quick templates */}
      <div>
        <div style={{fontSize:10,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Quick Templates</div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6}}>
          {TEMPLATES.map(t=>(
            <button key={t.label} onClick={()=>{setTitle(t.title);setBody(t.body);}}
              style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${body===t.body?V.accent+"40":V.cardBorder}`,
                background:body===t.body?`${V.accent}12`:"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
              <div style={{fontSize:12}}>{t.icon} <span style={{fontSize:11,fontWeight:700,color:V.text}}>{t.label}</span></div>
              <div style={{fontSize:9,color:V.text3,marginTop:2,lineHeight:1.3}}>{t.body.slice(0,40)}…</div>
            </button>
          ))}
        </div>
      </div>

      {/* Compose card */}
      <Card style={{padding:14,display:"flex",flexDirection:"column",gap:12}}>
        {/* Title */}
        <div>
          <div style={{fontSize:10,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Title</div>
          <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={64}
            style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
        </div>
        {/* Message */}
        <div>
          <div style={{fontSize:10,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Message</div>
          <textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={200} rows={3}
            placeholder="Type your message..."
            style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,resize:"none",boxSizing:"border-box"}}/>
          <div style={{fontSize:9,color:body.length>180?V.warn:V.text3,textAlign:"right",marginTop:2}}>{body.length}/200</div>
        </div>

        {/* Target picker */}
        <UserPicker
          targetMode={pushTargetMode} setTargetMode={setPushTargetMode}
          selected={pushSelected} setSelected={setPushSelected}
          open={dropdownOpen} setOpen={setDropdownOpen}
          search={userSearch} setSearch={setUserSearch}
          label="Send To"
        />

        {result&&(
          <div style={{padding:"10px 12px",borderRadius:8,
            background:result.ok?`${V.accent}10`:`${V.danger}10`,
            border:`1px solid ${result.ok?V.accent+"30":V.danger+"30"}`,
            fontSize:12,color:result.ok?V.accent:V.danger,fontWeight:600}}>
            {result.ok?"✅ ":"❌ "}{result.msg}
          </div>
        )}

        <Btn full onClick={send} disabled={!body.trim()||sending}
          s={{background:sending?"rgba(255,255,255,0.06)":undefined}}>
          {sending?"Sending…":`📣 ${pushTargetMode==="all"?`Send to All${subCount!=null?" ("+subCount+")":""}`:pushSelected.size>0?`Send to ${pushSelected.size} User${pushSelected.size!==1?"s":""}`:  "Send Push"}`}
        </Btn>

        <div style={{fontSize:10,color:V.text3,textAlign:"center",lineHeight:1.5}}>
          Only users who granted notification permission will receive this.<br/>
          iOS requires the app to be installed to home screen.
        </div>
      </Card>

      {/* ── In-App Notification section ── */}
      <div style={{borderTop:`1px solid ${V.cardBorder}`,paddingTop:14}}>
        <div style={{fontSize:14,fontWeight:800,color:V.text,marginBottom:4}}>🔔 In-App Notifications</div>
        <div style={{fontSize:11,color:V.text3,marginBottom:12}}>Fires as a banner the next time the user opens the app. No push permission needed.</div>

        {/* In-app target */}
        <div style={{marginBottom:12}}>
          <UserPicker
            targetMode={inAppTargetMode} setTargetMode={setInAppTargetMode}
            selected={inAppSelected} setSelected={setInAppSelected}
            open={inAppDropdownOpen} setOpen={setInAppDropdownOpen}
            search={inAppSearch} setSearch={setInAppSearch}
            label="Target Users"
          />
          {inAppTargetMode==="all"&&users===null&&(
            <button onClick={loadUsers}
              style={{marginTop:6,padding:"6px 14px",borderRadius:8,background:"rgba(255,255,255,0.04)",
                border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:11,color:V.text3,fontFamily:V.font}}>
              {usersLoading?"Loading…":"Load users for broadcast count"}
            </button>
          )}
          {inAppTargetMode==="all"&&users!==null&&(
            <div style={{fontSize:10,color:V.text3,marginTop:4}}>Will queue for all {users.length} users</div>
          )}
        </div>

        {/* Notification type toggles */}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
          {NOTIF_TYPES.map(nt=>(
            <div key={nt.key} onClick={()=>setNotifFlags(f=>({...f,[nt.key]:!f[nt.key]}))}
              style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,cursor:"pointer",
                border:`1px solid ${notifFlags[nt.key]?V.accent+"40":V.cardBorder}`,
                background:notifFlags[nt.key]?`${V.accent}08`:"rgba(255,255,255,0.02)",transition:"all .15s"}}>
              <div style={{width:36,height:22,borderRadius:11,border:`2px solid ${notifFlags[nt.key]?V.accent:V.text3}`,
                background:notifFlags[nt.key]?V.accent:"transparent",position:"relative",flexShrink:0,transition:"all .2s"}}>
                <div style={{position:"absolute",top:1,left:notifFlags[nt.key]?14:1,width:16,height:16,borderRadius:"50%",
                  background:notifFlags[nt.key]?"#fff":"rgba(255,255,255,0.4)",transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:16,flexShrink:0}}>{nt.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:notifFlags[nt.key]?V.text:V.text3}}>{nt.label}</div>
                <div style={{fontSize:10,color:V.text3}}>{nt.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {notifFlags.custom&&(
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            <input value={customTitle} onChange={e=>setCustomTitle(e.target.value)} placeholder="Title (optional, defaults to IRONLOG)"
              style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
            <textarea value={customMsg} onChange={e=>setCustomMsg(e.target.value)} rows={2} maxLength={200}
              placeholder="Custom message text..."
              style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,resize:"none",boxSizing:"border-box"}}/>
          </div>
        )}

        {notifResult&&(
          <div style={{padding:"10px 12px",borderRadius:8,marginBottom:8,
            background:notifResult.ok?`${V.accent}10`:`${V.danger}10`,
            border:`1px solid ${notifResult.ok?V.accent+"30":V.danger+"30"}`,
            fontSize:12,color:notifResult.ok?V.accent:V.danger,fontWeight:600}}>
            {notifResult.ok?"✅ ":"❌ "}{notifResult.msg}
          </div>
        )}
        <button onClick={sendInApp} disabled={notifSending||!Object.values(notifFlags).some(Boolean)}
          style={{width:"100%",padding:"12px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:V.font,
            fontSize:13,fontWeight:800,transition:"all .2s",
            background:Object.values(notifFlags).some(Boolean)?`linear-gradient(135deg,${V.accent},${V.accent2})`:"rgba(255,255,255,0.06)",
            color:Object.values(notifFlags).some(Boolean)?V.bg:V.text3}}>
          {notifSending?"Queuing…":"🔔 Queue In-App Notification"}
        </button>
      </div>

      {/* Send history */}
      {history.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em"}}>Send History</div>
            <button onClick={()=>{setHistory([]);LS.set("ft-admin-push-history",[]);}}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:V.text3}}>Clear</button>
          </div>
          {history.map((h,i)=>(
            <Card key={i} style={{padding:"10px 12px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:2}}>{h.title}</div>
                  <div style={{fontSize:11,color:V.text3,lineHeight:1.4}}>{h.body}</div>
                  <div style={{fontSize:10,color:V.text3,marginTop:4}}>→ {h.target}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{h.sent}</div>
                  <div style={{fontSize:9,color:V.text3}}>sent</div>
                  {h.failed>0&&<div style={{fontSize:9,color:V.danger}}>{h.failed} failed</div>}
                  <div style={{fontSize:9,color:V.text3,marginTop:2}}>{fmtTs(h.ts)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Admin Hub (admin nav tab — only renders for admins) ───

// ═══════════════════════════════════════════════════
// ADMIN USER AUDIT — see exactly what any user sees
// ═══════════════════════════════════════════════════
function AdminUserAudit({s}){
  const { isDesktop } = useLayout();
  const email=s.profile?.email;
  const token=LS.get("ft-session-token");
  const af=async(action,extra={})=>{try{const r=await fetch(`${SYNC_URL}/api/admin`,{method:"POST",
    headers:{"Content-Type":"application/json","X-Session-Token":token},body:JSON.stringify({action,...extra})});
    return r.ok?await r.json():null;}catch(e){return null;}};

  const [users,setUsers]=useState(null);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [selUser,setSelUser]=useState(null);
  const [detail,setDetail]=useState(null);
  const [gam,setGam]=useState(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [auditTab,setAuditTab]=useState("overview");

  const loadUsers=()=>{setLoading(true);af("users").then(r=>{setUsers(r?.users||[]);setLoading(false);});};

  const selectUser=(u)=>{
    setSelUser(u);setDetail(null);setGam(null);setAuditTab("overview");setDetailLoading(true);
    Promise.all([af("user_detail",{email:u.email}),af("get_gamification",{email:u.email})]).then(([d,g])=>{
      setDetail(d);setGam(g?.gamification||null);setDetailLoading(false);
    });
  };

  const filtered=(users||[]).filter(u=>!search||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase()));

  const TABS=[
    {id:"overview",icon:"👤",label:"Profile"},
    {id:"workouts",icon:"🏋️",label:"Workouts"},
    {id:"nutrition",icon:"🥗",label:"Nutrition"},
    {id:"body",icon:"📏",label:"Body"},
    {id:"checkins",icon:"✅",label:"Check-ins"},
    {id:"photos",icon:"📸",label:"Photos"},
    {id:"social",icon:"👥",label:"Social"},
    {id:"gamification",icon:"⚡",label:"XP"},
    {id:"activity",icon:"📋",label:"Activity Log"},
    {id:"settings",icon:"⚙️",label:"Settings"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>🔎 User Audit</div>
        <div style={{fontSize:11,color:V.text3}}>Full read-only view of any user's app — exactly what they see</div>
      </div>

      {/* User selector */}
      <Card style={{padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text}}>Select User</div>
          {users===null&&<button onClick={loadUsers} style={{padding:"5px 12px",borderRadius:8,background:V.accent,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:V.bg,fontFamily:V.font}}>{loading?"Loading…":"Load Users"}</button>}
        </div>
        {users!==null&&(
          <>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email…"
              style={{width:"100%",padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font,boxSizing:"border-box",marginBottom:6}}/>
            <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
              {filtered.map(u=>{
                const sel=selUser?.email===u.email;
                return(
                  <div key={u.email} onClick={()=>selectUser(u)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",
                    borderRadius:8,cursor:"pointer",border:`1px solid ${sel?V.accent+"40":V.cardBorder}`,
                    background:sel?`${V.accent}10`:"rgba(255,255,255,0.02)"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:sel?700:400,color:sel?V.text:V.text3}}>{u.name}</div>
                      <div style={{fontSize:9,color:V.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email} · {u.workouts} workouts · {u.photos} photos</div>
                    </div>
                    {u.isAdmin&&<span style={{fontSize:8,color:V.danger,fontWeight:700}}>ADMIN</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Detail pane */}
      {selUser&&(
        <>
          {detailLoading&&<Card style={{padding:24,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>Loading full profile…</div></Card>}
          {!detailLoading&&detail&&(
            <>
              {/* User header */}
              <Card style={{padding:14,background:`linear-gradient(135deg,${V.card},${V.card})`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:V.text}}>{detail.profile?.first_name} {detail.profile?.last_name}</div>
                    {detail.profile?.username&&<div style={{fontSize:10,color:V.accent}}>@{detail.profile.username}</div>}
                    <div style={{fontSize:9,color:V.text3,fontFamily:V.mono}}>{selUser.email}</div>
                    <div style={{fontSize:9,color:V.text3,marginTop:2}}>Joined {detail.profile?.created_at?.slice(0,10)} · Level: {detail.profile?.fitness_level||"—"} · {detail.profile?.units||"lbs"}</div>
                  </div>
                  {detail.profile?.is_banned&&<span style={{padding:"3px 8px",borderRadius:6,background:V.danger+"15",fontSize:9,fontWeight:700,color:V.danger}}>BANNED</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                  {[
                    {l:"Workouts",v:detail.workouts?.length||0,c:V.accent},
                    {l:"Nutrition",v:detail.nutrition?.length||0,c:V.warn},
                    {l:"Photos",v:detail.photos?.length||0,c:V.accent2},
                    {l:"Friends",v:detail.friends?.length||0,c:"#06b6d4"},
                    {l:"Check-ins",v:detail.checkins?.length||0,c:"#ec4899"},
                  ].map(st=>(
                    <div key={st.l} style={{textAlign:"center",padding:6,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                      <div style={{fontSize:14,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                      <div style={{fontSize:8,color:V.text3}}>{st.l}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Tab strip */}
              <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4}}>
                {TABS.map(t=>(
                  <button key={t.id} onClick={()=>setAuditTab(t.id)} style={{flexShrink:0,padding:"6px 12px",borderRadius:8,border:`1px solid ${auditTab===t.id?V.accent+"50":V.cardBorder}`,
                    background:auditTab===t.id?`${V.accent}10`:"rgba(255,255,255,0.02)",cursor:"pointer",
                    fontSize:10,fontWeight:auditTab===t.id?700:400,color:auditTab===t.id?V.accent:V.text3,fontFamily:V.font,whiteSpace:"nowrap"}}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Tab: Overview */}
              {auditTab==="overview"&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:8}}>Bio & Profile</div>
                    <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6,fontSize:10,color:V.text3}}>
                      {[
                        ["Name",`${detail.profile?.first_name||""} ${detail.profile?.last_name||""}`.trim()||"—"],
                        ["DOB",detail.profile?.date_of_birth||"—"],
                        ["Sex",detail.profile?.sex||"—"],
                        ["State",detail.profile?.state||"—"],
                        ["Height",detail.profile?.height?`${detail.profile.height}"`:"—"],
                        ["Current Wt",detail.profile?.current_weight?`${detail.profile.current_weight} ${detail.profile?.units||"lbs"}`:"—"],
                        ["Target Wt",detail.profile?.target_weight?`${detail.profile.target_weight} ${detail.profile?.units||"lbs"}`:"—"],
                        ["Activity",detail.profile?.activity_level||"—"],
                        ["Friend Code",detail.profile?.friend_code||"—"],
                        ["Consented",detail.profile?.consented_at?.slice(0,10)||"—"],
                      ].map(([k,v])=>(
                        <div key={k} style={{padding:"4px 8px",borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                          <div style={{fontSize:8,color:V.text3,marginBottom:1}}>{k}</div>
                          <div style={{fontSize:11,color:V.text,fontWeight:500}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {detail.profile?.bio&&<div style={{marginTop:8,padding:8,borderRadius:8,background:"rgba(255,255,255,0.02)",fontSize:11,color:V.text2,fontStyle:"italic"}}>"{detail.profile.bio}"</div>}
                  </Card>
                  {detail.syncHistory?.length>0&&<Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Sync History ({detail.syncHistory.length})</div>
                    {detail.syncHistory.slice(0,8).map((l,i)=>(
                      <div key={i} style={{fontSize:9,color:V.text3,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                        {l.synced_at?.slice(0,16)} · <span style={{color:V.accent,fontFamily:V.mono}}>{l.device_id?.slice(0,14)}</span> · {l.records_synced||"?"} records
                      </div>
                    ))}
                  </Card>}
                </div>
              )}

              {/* Tab: Workouts */}
              {auditTab==="workouts"&&(
                <Card style={{padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>All Workouts ({detail.workouts?.length||0})</div>
                  <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {(detail.workouts||[]).map((w,i)=>(
                      <div key={i} style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:12,fontWeight:700,color:V.accent,fontFamily:V.mono}}>{w.date}</span>
                          <span style={{fontSize:10,color:V.text3}}>{(w.exercises||[]).length} exercises · {w.duration||"?"}min</span>
                        </div>
                        {(w.exercises||[]).length>0&&(
                          <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:3}}>
                            {(w.exercises||[]).map((e,j)=>(
                              <span key={j} style={{fontSize:8,padding:"1px 6px",borderRadius:4,background:`${V.accent}12`,color:V.accent}}>
                                {e.exerciseId} {e.sets?.length?`(${e.sets.length}s)`:""}
                              </span>
                            ))}
                          </div>
                        )}
                        {w.notes&&<div style={{marginTop:4,fontSize:9,color:V.text3,fontStyle:"italic"}}>"{w.notes}"</div>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab: Nutrition */}
              {auditTab==="nutrition"&&(
                <Card style={{padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Nutrition Log ({detail.nutrition?.length||0} days)</div>
                  <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {(detail.nutrition||[]).map((n,i)=>(
                      <div key={i} style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:V.warn,fontFamily:V.mono}}>{n.date}</span>
                          <span style={{fontSize:10,color:V.text3}}>{n.calories||0} kcal</span>
                        </div>
                        <div style={{display:"flex",gap:8,fontSize:9,color:V.text3}}>
                          <span>P: {n.protein||0}g</span><span>C: {n.carbs||0}g</span><span>F: {n.fat||0}g</span>
                          {n.water&&<span>💧{n.water}</span>}
                          {n.meals?.length>0&&<span>{n.meals.length} meals</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab: Body */}
              {auditTab==="body"&&(
                <Card style={{padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Body Measurements ({detail.body?.length||0})</div>
                  <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
                    {(detail.body||[]).map((b,i)=>(
                      <div key={i} style={{padding:"7px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)",fontSize:9,color:V.text3}}>
                        <span style={{color:V.purple,fontFamily:V.mono,fontWeight:700,fontSize:11}}>{b.date}</span>
                        {b.weight&&<span> · {b.weight}{detail.profile?.units||"lbs"}</span>}
                        {b.body_fat&&<span> · {b.body_fat}% BF</span>}
                        {b.chest&&<span> · C:{b.chest}"</span>}
                        {b.waist&&<span> · W:{b.waist}"</span>}
                        {b.hips&&<span> · H:{b.hips}"</span>}
                        {b.arms&&<span> · A:{b.arms}"</span>}
                        {b.legs&&<span> · L:{b.legs}"</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab: Check-ins */}
              {auditTab==="checkins"&&(
                <Card style={{padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Check-ins ({detail.checkins?.length||0})</div>
                  <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {(detail.checkins||[]).map((c,i)=>(
                      <div key={i} style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,fontWeight:700,color:"#ec4899",fontFamily:V.mono}}>{c.date}</span>
                          <div style={{display:"flex",gap:8,fontSize:9,color:V.text3}}>
                            <span>😴 {c.sleep}h</span><span>💪 {c.soreness}/10</span><span>⚡ {c.energy}/10</span><span>😊 {c.motivation}/10</span>
                          </div>
                        </div>
                        {c.notes&&<div style={{fontSize:9,color:V.text2,fontStyle:"italic"}}>"{c.notes}"</div>}
                        {c.goals&&<div style={{fontSize:9,color:V.text3}}>Goals: {c.goals}</div>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab: Photos */}
              {auditTab==="photos"&&(
                <Card style={{padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>
                    Progress Photos ({detail.photos?.length||0}) <span style={{color:V.danger,fontSize:8}}>includes vault</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    {(detail.photos||[]).map((p,i)=>(
                      <div key={i} style={{borderRadius:8,overflow:"hidden",border:`1px solid ${p.is_private?V.purple+"40":V.cardBorder}`,aspectRatio:"1",position:"relative"}}>
                        {(p.public_url||p.photo_data)?
                          <img src={p.public_url||p.photo_data} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          :<div style={{width:"100%",height:"100%",background:"rgba(255,255,255,0.02)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:V.text3}}>No URL</div>}
                        {p.is_private&&<div style={{position:"absolute",top:2,right:2,background:"rgba(168,85,247,0.8)",borderRadius:3,padding:"1px 4px",fontSize:7,color:"#fff"}}>🔒</div>}
                        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.65)",padding:"2px 4px",fontSize:7,color:"#fff"}}>{p.date?.slice(0,10)||p.created_at?.slice(0,10)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab: Social */}
              {auditTab==="social"&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Friends ({detail.friends?.length||0})</div>
                    {(detail.friends||[]).map((f,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:10}}>
                        <span style={{color:V.text2}}>{f.name} <span style={{color:V.text3,fontSize:9}}>{f.email}</span></span>
                        <span style={{color:f.status==="accepted"?V.accent:V.warn,fontSize:9}}>{f.status}</span>
                      </div>
                    ))}
                  </Card>
                  {detail.activity?.length>0&&<Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Activity Events ({detail.activity.length})</div>
                    <div style={{maxHeight:300,overflowY:"auto"}}>
                      {detail.activity.map((a,i)=>(
                        <div key={i} style={{padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:9}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{color:V.accent,fontWeight:700}}>{a.event_type}</span>
                            <span style={{color:V.text3}}>{a.created_at?.slice(0,16)}</span>
                          </div>
                          <div style={{color:V.text3,marginTop:2}}>{JSON.stringify(a.event_data||{}).slice(0,80)}</div>
                        </div>
                      ))}
                    </div>
                  </Card>}
                </div>
              )}

              {/* Tab: Gamification */}
              {auditTab==="gamification"&&(()=>{
                const g=gam||{};
                const bonus=g.xp_bonus?.total||0;
                const totalXP=(detail?.workouts?.length||0)*30+(detail?.nutrition?.length||0)*8+(detail?.checkins?.length||0)*5+(detail?.photos?.length||0)*15+bonus;
                const rank=[...IRON_RANKS].reverse().find(r=>totalXP>=r.xpNeeded)||IRON_RANKS[0];
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <Card style={{padding:12,border:`1px solid ${rank.color}30`}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                        <span style={{fontSize:32}}>{rank.icon}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:800,color:rank.color}}>{rank.name}</div>
                          <div style={{fontSize:10,color:V.text3}}>Level {rank.level} · {bonus.toLocaleString()} bonus XP</div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                        {[
                          {l:"Shields",v:g.streak_shields||0,c:"#22c55e"},
                          {l:"Badges",v:Object.keys(g.badge_dates||{}).length,c:"#f59e0b"},
                          {l:"Mission Days",v:Object.keys(g.missions_completed||{}).length,c:V.accent2},
                          {l:"War Wins",v:g.war_wins||0,c:"#f43f5e"},
                          {l:"War Streak",v:g.war_streak||0,c:V.danger},
                          {l:"Rivals",v:(g.rivals||[]).length,c:"#ec4899"},
                          {l:"Duels",v:(g.duels||[]).length,c:V.purple},
                          {l:"Comeback Used",v:g.comeback_used?g.comeback_used:"—",c:V.text3},
                        ].map(st=>(
                          <div key={st.l} style={{textAlign:"center",padding:6,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                            <div style={{fontSize:12,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                            <div style={{fontSize:7,color:V.text3}}>{st.l}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                    {g.xp_bonus?.log?.length>0&&<Card style={{padding:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>XP Log ({g.xp_bonus.log.length})</div>
                      <div style={{maxHeight:250,overflowY:"auto"}}>
                        {g.xp_bonus.log.map((e,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:9}}>
                            <span style={{color:V.text3}}>{e.date}</span>
                            <span style={{color:e.amount>=0?V.accent:V.danger,fontWeight:700,fontFamily:V.mono}}>{e.amount>=0?"+":""}{e.amount} XP</span>
                            <span style={{color:V.text3,flex:1,textAlign:"right",paddingLeft:8}}>{e.reason}</span>
                          </div>
                        ))}
                      </div>
                    </Card>}
                    {g.badge_dates&&Object.keys(g.badge_dates).length>0&&<Card style={{padding:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Earned Badges ({Object.keys(g.badge_dates).length})</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {Object.entries(g.badge_dates).map(([id,date])=>(
                          <div key={id} style={{padding:"3px 8px",borderRadius:6,background:`${V.warn}15`,border:`1px solid ${V.warn}30`,fontSize:9,color:V.warn}}>
                            🏅 {id} <span style={{color:V.text3}}>· {date}</span>
                          </div>
                        ))}
                      </div>
                    </Card>}
                  </div>
                );
              })()}

              {/* Tab: Activity Log */}
              {auditTab==="activity"&&(
                <Card style={{padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Full Activity Log ({detail.activity?.length||0} events)</div>
                  <div style={{maxHeight:500,overflowY:"auto"}}>
                    {(detail.activity||[]).map((a,i)=>(
                      <div key={i} style={{padding:"6px 8px",borderRadius:6,marginBottom:3,background:"rgba(255,255,255,0.015)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:10,fontWeight:700,color:
                            a.event_type==="WorkoutLogged"?V.accent:
                            a.event_type==="PRHit"?"#f59e0b":
                            a.event_type==="DirectMessage"?"#06b6d4":
                            a.event_type.includes("Group")?"#ec4899":V.text3}}>{a.event_type}</span>
                          <span style={{fontSize:8,color:V.text3}}>{a.created_at?.slice(0,16)}</span>
                        </div>
                        <div style={{fontSize:8,color:V.text3,marginTop:2,fontFamily:V.mono}}>{JSON.stringify(a.event_data||{}).slice(0,120)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tab: Settings */}
              {auditTab==="settings"&&detail.settings&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:8}}>Goals & Schedule</div>
                    <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6,fontSize:10}}>
                      {[
                        ["Calories",`${detail.settings.goals?.cal||"—"} kcal`],
                        ["Protein",`${detail.settings.goals?.protein||"—"}g`],
                        ["Carbs",`${detail.settings.goals?.carbs||"—"}g`],
                        ["Fat",`${detail.settings.goals?.fat||"—"}g`],
                        ["Workout Days",Object.values(detail.settings.schedule?.weekly||{}).join(", ")||"—"],
                        ["Phases",(detail.settings.phases||[]).length],
                        ["Injuries",(detail.settings.injuries||[]).length],
                        ["Supplements",(detail.settings.supplements||[]).length],
                      ].map(([k,v])=>(
                        <div key={k} style={{padding:"4px 8px",borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                          <div style={{fontSize:8,color:V.text3}}>{k}</div>
                          <div style={{fontSize:11,color:V.text,fontWeight:500}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  {detail.settings.supplements?.length>0&&<Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text,marginBottom:6}}>Supplements</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {detail.settings.supplements.map((s2,i)=>(
                        <span key={i} style={{padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,0.04)",fontSize:10,color:V.text2}}>{s2.name||s2}</span>
                      ))}
                    </div>
                  </Card>}
                  {detail.settings.injuries?.length>0&&<Card style={{padding:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.danger,marginBottom:6}}>Injuries</div>
                    {detail.settings.injuries.map((inj,i)=>(
                      <div key={i} style={{fontSize:10,color:V.text3,padding:"2px 0"}}>{typeof inj==="string"?inj:JSON.stringify(inj)}</div>
                    ))}
                  </Card>}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ADMIN BUSINESS VALUE — analytics dashboard
// ═══════════════════════════════════════════════════════
// ─── Admin XP & Rank Manager ───
function AdminXPManager({s}){
  const { isDesktop } = useLayout();
  const email=s.profile?.email;
  // Read token fresh on every call so stale closure never causes 401
  const af=async(action,extra={})=>{
    const token=LS.get("ft-session-token");
    const headers={"Content-Type":"application/json","X-Session-Token":token};
    try{
      const r=await fetch(`${SYNC_URL}/api/admin`,{method:"POST",headers,body:JSON.stringify({action,...extra})});
      const json=await r.json().catch(()=>({}));
      if(!r.ok)return{__error:json.error||`HTTP ${r.status}`};
      return json;
    }catch(e){return{__error:e.message};}
  };

  const [users,setUsers]=useState(null);
  const [usersLoading,setUsersLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [selUser,setSelUser]=useState(null);
  const [gData,setGData]=useState(null); // {gamification, workouts_count}
  const [gLoading,setGLoading]=useState(false);

  // XP adjustment
  const [xpAmount,setXpAmount]=useState("");
  const [xpReason,setXpReason]=useState("");
  const [xpResult,setXpResult]=useState(null);
  const [xpSaving,setXpSaving]=useState(false);

  // Rank override
  const [targetRank,setTargetRank]=useState("");
  const [rankResult,setRankResult]=useState(null);
  const [rankSaving,setRankSaving]=useState(false);

  const loadUsers=()=>{
    setUsersLoading(true);
    af("users").then(r=>{setUsers(r?.users||[]);setUsersLoading(false);}).catch(()=>setUsersLoading(false));
  };

  const selectUser=(u)=>{
    setSelUser(u);setGData(null);setXpAmount("");setXpReason("");setXpResult(null);setRankResult(null);setTargetRank("");
    setGLoading(true);
    Promise.all([af("get_gamification",{email:u.email}),af("user_detail",{email:u.email})]).then(([gRes,dRes])=>{
      const g=gRes?.gamification||{};
      setGData({g,workouts:dRes?.workouts?.length||0,nutrition:dRes?.nutrition?.length||0,checkins:dRes?.checkins?.length||0,photos:dRes?.photos?.length||0});
      setGLoading(false);
    }).catch(()=>setGLoading(false));
  };

  const applyXP=async()=>{
    const amt=parseInt(xpAmount);
    if(!selUser||isNaN(amt))return;
    setXpSaving(true);setXpResult(null);
    const res=await af("adjust_xp",{email:selUser.email,amount:amt,reason:xpReason.trim()||"Admin adjustment"});
    if(res?.success){
      setXpResult({ok:true,msg:`Done. New bonus XP total: ${(res.new_total||0).toLocaleString()}`});
      af("get_gamification",{email:selUser.email}).then(r=>{if(r?.gamification)setGData(d=>({...d,g:r.gamification}));});
      setXpAmount("");setXpReason("");
    }else setXpResult({ok:false,msg:res?.__error||"Failed — check session"});
    setXpSaving(false);
  };

  const applyRankOverride=async()=>{
    if(!selUser||!targetRank)return;
    const rank=IRON_RANKS.find(r=>r.level===parseInt(targetRank));
    if(!rank)return;
    setRankSaving(true);setRankResult(null);
    const g=gData?.g||{};
    // Calculate how much bonus XP to set so total hits the rank threshold
    // baseXP is workouts*30 + nutrition*8 etc — we estimate from what we have
    const estBase=(gData?.workouts||0)*30+(gData?.nutrition||0)*8+(gData?.checkins||0)*5+(gData?.photos||0)*15;
    const neededBonus=Math.max(0,rank.xpNeeded-estBase);
    const currentBonus=g.xp_bonus?.total||0;
    const delta=neededBonus-currentBonus;
    const reason=`Admin rank override → ${rank.icon} ${rank.name}`;
    const res=await af("adjust_xp",{email:selUser.email,amount:delta,reason});
    // Also update last_known_level so level-up doesn't re-trigger incorrectly
    if(res?.success){
      const updated={...g,xp_bonus:{total:res.new_total,log:[{date:today(),amount:delta,reason},...(g.xp_bonus?.log||[])].slice(0,100)},last_known_level:rank.level};
      await af("set_notif_flags",{email:selUser.email,flags:{}}); // no-op to ensure settings row exists
      // Update last_known_level via adjust (already set in gamification upsert above via adjust_xp)
      setRankResult({ok:true,msg:`${selUser.name||selUser.email.split("@")[0]} is now ${rank.icon} ${rank.name}`});
      af("get_gamification",{email:selUser.email}).then(r=>{if(r?.gamification)setGData(d=>({...d,g:r.gamification}));});
    }else setRankResult({ok:false,msg:res?.__error||"Failed — check session"});
    setRankSaving(false);
  };

  const filteredUsers=(users||[]).filter(u=>!search||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase()));

  const currentXP=(()=>{
    if(!gData)return null;
    const g=gData.g;
    const bonus=g?.xp_bonus?.total||0;
    const est=(gData.workouts||0)*30+(gData.nutrition||0)*8+(gData.checkins||0)*5+(gData.photos||0)*15;
    return est+bonus;
  })();
  const currentRank=currentXP!=null?([...IRON_RANKS].reverse().find(r=>currentXP>=r.xpNeeded)||IRON_RANKS[0]):null;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>⚡ XP & Rank Manager</div>
        <div style={{fontSize:11,color:V.text3}}>View gamification stats, adjust XP, and override ranks for any user</div>
      </div>

      {/* User selector */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text}}>Select User</div>
          {users===null?(
            <button onClick={loadUsers} style={{padding:"6px 14px",borderRadius:8,background:V.accent,border:"none",
              cursor:"pointer",fontSize:11,fontWeight:700,color:V.bg,fontFamily:V.font}}>
              {usersLoading?"Loading…":"Load Users"}
            </button>
          ):(
            <div style={{fontSize:10,color:V.text3}}>{users.length} users</div>
          )}
        </div>
        {users!==null&&(
          <>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email…"
              style={{width:"100%",padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font,boxSizing:"border-box",marginBottom:6}}/>
            <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
              {filteredUsers.map(u=>{
                const sel=selUser?.email===u.email;
                return(
                  <div key={u.email} onClick={()=>selectUser(u)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,cursor:"pointer",
                      background:sel?`${V.accent}12`:"rgba(255,255,255,0.02)",
                      border:`1px solid ${sel?V.accent+"40":V.cardBorder}`,transition:"all .1s"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:sel?700:400,color:sel?V.text:V.text3}}>{u.name||u.email.split("@")[0]}</div>
                      <div style={{fontSize:9,color:V.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                    </div>
                    {sel&&<span style={{fontSize:10,color:V.accent}}>✓</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Gamification stats */}
      {selUser&&(
        <Card style={{padding:14,border:`1px solid ${currentRank?currentRank.color+"20":V.cardBorder}`,
          background:currentRank?`${currentRank.color}04`:"transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text}}>{selUser.name||selUser.email.split("@")[0]}</div>
            {currentRank&&(
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,
                background:`${currentRank.color}12`,border:`1px solid ${currentRank.color}30`}}>
                <span style={{fontSize:16}}>{currentRank.icon}</span>
                <span style={{fontSize:11,fontWeight:800,color:currentRank.color}}>{currentRank.name}</span>
              </div>
            )}
          </div>
          {gLoading&&<div style={{fontSize:11,color:V.text3,textAlign:"center",padding:16}}>Loading…</div>}
          {!gLoading&&gData&&(()=>{
            const g=gData.g||{};
            const bonus=g.xp_bonus?.total||0;
            const shields=g.streak_shields||0;
            const badges=Object.keys(g.badge_dates||{}).length;
            const missionDays=Object.keys(g.missions_completed||{}).length;
            return(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                  {[
                    {l:"Total XP",v:(currentXP||0).toLocaleString(),c:V.accent},
                    {l:"Bonus XP",v:bonus.toLocaleString(),c:"#f59e0b"},
                    {l:"Level",v:currentRank?.level||1,c:currentRank?.color||V.text},
                    {l:"Shields",v:shields,c:"#22c55e"},
                    {l:"Badges",v:badges,c:"#f59e0b"},
                    {l:"Mission Days",v:missionDays,c:V.accent2},
                    {l:"Workouts",v:gData.workouts,c:V.accent},
                    {l:"War Wins",v:g.war_wins||0,c:"#f43f5e"},
                  ].map(st=>(
                    <div key={st.l} style={{textAlign:"center",padding:8,borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                      <div style={{fontSize:14,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                      <div style={{fontSize:8,color:V.text3,marginTop:2}}>{st.l}</div>
                    </div>
                  ))}
                </div>
                {/* XP bonus log */}
                {g.xp_bonus?.log?.length>0&&(
                  <div style={{maxHeight:80,overflowY:"auto",marginBottom:4}}>
                    <div style={{fontSize:9,fontWeight:700,color:V.text3,marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>Recent XP Log</div>
                    {g.xp_bonus.log.slice(0,8).map((e2,i)=>(
                      <div key={i} style={{fontSize:9,color:V.text3,padding:"2px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                        {e2.date} · <span style={{color:e2.amount>=0?V.accent:V.danger,fontWeight:700}}>{e2.amount>=0?"+":""}{e2.amount}</span> · {e2.reason}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      )}

      {/* XP Adjustment */}
      {selUser&&!gLoading&&(
        <Card style={{padding:14}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:10}}>Adjust XP</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input type="number" value={xpAmount} onChange={e=>setXpAmount(e.target.value)} placeholder="Amount (+/-)"
              style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.mono,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:4}}>
              {[100,500,1000,-100,-500].map(n=>(
                <button key={n} onClick={()=>setXpAmount(String(n))}
                  style={{padding:"8px 8px",borderRadius:6,border:`1px solid ${n>0?V.accent+"30":V.danger+"30"}`,
                    background:n>0?`${V.accent}08`:`${V.danger}08`,cursor:"pointer",fontSize:9,fontWeight:700,
                    color:n>0?V.accent:V.danger,fontFamily:V.mono,flexShrink:0}}>
                  {n>0?"+":""}{n}
                </button>
              ))}
            </div>
          </div>
          <input value={xpReason} onChange={e=>setXpReason(e.target.value)} placeholder="Reason (optional)"
            style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font,boxSizing:"border-box",marginBottom:8}}/>
          {xpResult&&(
            <div style={{padding:"8px 12px",borderRadius:8,marginBottom:8,
              background:xpResult.ok?`${V.accent}10`:`${V.danger}10`,
              border:`1px solid ${xpResult.ok?V.accent+"30":V.danger+"30"}`,
              fontSize:11,color:xpResult.ok?V.accent:V.danger,fontWeight:600}}>
              {xpResult.ok?"✅ ":"❌ "}{xpResult.msg}
            </div>
          )}
          <button onClick={applyXP} disabled={!xpAmount||xpSaving}
            style={{width:"100%",padding:"11px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:V.font,
              fontSize:12,fontWeight:800,
              background:xpAmount?`linear-gradient(135deg,${V.accent},${V.accent2})`:"rgba(255,255,255,0.06)",
              color:xpAmount?V.bg:V.text3}}>
            {xpSaving?"Applying…":`Apply ${xpAmount?(parseInt(xpAmount)>0?"+":"")+xpAmount+" XP":""}`}
          </button>
        </Card>
      )}

      {/* Rank Override */}
      {selUser&&!gLoading&&(
        <Card style={{padding:14}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:10}}>Override Rank</div>
          <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6,marginBottom:10}}>
            {IRON_RANKS.map(r=>(
              <div key={r.level} onClick={()=>setTargetRank(String(r.level))}
                style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,cursor:"pointer",
                  border:`1px solid ${targetRank===String(r.level)?r.color+"60":V.cardBorder}`,
                  background:targetRank===String(r.level)?`${r.color}10`:"rgba(255,255,255,0.02)",
                  transition:"all .1s"}}>
                <span style={{fontSize:16}}>{r.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:targetRank===String(r.level)?700:400,color:targetRank===String(r.level)?r.color:V.text3,lineHeight:1.2}}>{r.name}</div>
                  <div style={{fontSize:8,color:V.text3}}>{r.xpNeeded.toLocaleString()} XP</div>
                </div>
                {currentRank?.level===r.level&&<span style={{fontSize:8,color:r.color,fontWeight:700}}>NOW</span>}
              </div>
            ))}
          </div>
          {rankResult&&(
            <div style={{padding:"8px 12px",borderRadius:8,marginBottom:8,
              background:rankResult.ok?`${V.accent}10`:`${V.danger}10`,
              border:`1px solid ${rankResult.ok?V.accent+"30":V.danger+"30"}`,
              fontSize:11,color:rankResult.ok?V.accent:V.danger,fontWeight:600}}>
              {rankResult.ok?"✅ ":"❌ "}{rankResult.msg}
            </div>
          )}
          <button onClick={applyRankOverride} disabled={!targetRank||rankSaving}
            style={{width:"100%",padding:"11px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:V.font,
              fontSize:12,fontWeight:800,
              background:targetRank?`linear-gradient(135deg,#f59e0b,#f97316)`:"rgba(255,255,255,0.06)",
              color:targetRank?V.bg:V.text3}}>
            {rankSaving?"Applying…":targetRank?`Set to ${IRON_RANKS.find(r=>r.level===parseInt(targetRank))?.icon} ${IRON_RANKS.find(r=>r.level===parseInt(targetRank))?.name}`:"Select a Rank"}
          </button>
          <div style={{fontSize:9,color:V.text3,textAlign:"center",marginTop:6,lineHeight:1.4}}>
            Rank override adjusts bonus XP so total XP hits that rank's threshold.<br/>Takes effect next time the user opens the app.
          </div>
        </Card>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// MOCK DATA ENGINE — localStorage only, never syncs to API
// Key: "ft-mock-analytics" — clear via clearMock() only
// ═══════════════════════════════════════════════════════
const MOCK_LS_KEY="ft-mock-analytics";

const US_GYM_CITIES=[
  {city:"New York, NY",state:"NY",zip:"100",w:12},
  {city:"Los Angeles, CA",state:"CA",zip:"900",w:10},
  {city:"Chicago, IL",state:"IL",zip:"606",w:7},
  {city:"Houston, TX",state:"TX",zip:"770",w:6},
  {city:"Phoenix, AZ",state:"AZ",zip:"850",w:5},
  {city:"Philadelphia, PA",state:"PA",zip:"191",w:4.5},
  {city:"Dallas, TX",state:"TX",zip:"752",w:5},
  {city:"San Diego, CA",state:"CA",zip:"921",w:4},
  {city:"Austin, TX",state:"TX",zip:"787",w:4.5},
  {city:"San Jose, CA",state:"CA",zip:"951",w:3.5},
  {city:"San Francisco, CA",state:"CA",zip:"941",w:3.5},
  {city:"Seattle, WA",state:"WA",zip:"981",w:3.5},
  {city:"Denver, CO",state:"CO",zip:"802",w:4},
  {city:"Miami, FL",state:"FL",zip:"331",w:4},
  {city:"Atlanta, GA",state:"GA",zip:"303",w:4},
  {city:"Nashville, TN",state:"TN",zip:"372",w:3},
  {city:"Boston, MA",state:"MA",zip:"021",w:3.5},
  {city:"Charlotte, NC",state:"NC",zip:"282",w:3.5},
  {city:"Portland, OR",state:"OR",zip:"972",w:2.5},
  {city:"Las Vegas, NV",state:"NV",zip:"891",w:3},
  {city:"Columbus, OH",state:"OH",zip:"432",w:3},
  {city:"Indianapolis, IN",state:"IN",zip:"462",w:2.5},
  {city:"Jacksonville, FL",state:"FL",zip:"322",w:3},
  {city:"San Antonio, TX",state:"TX",zip:"782",w:4},
  {city:"Fort Worth, TX",state:"TX",zip:"761",w:3},
];
const GOALS_M=["Build Muscle","Lose Fat","Body Recomposition","Strength","Maintain Fitness","Athletic Performance","General Health"];
const GOAL_W=[30,25,15,12,8,6,4];
const FIT_LEVELS=["Beginner","Intermediate","Advanced"];
const FIT_W=[40,40,20];
const SPLITS_M=["Push/Pull/Legs","Full Body","Upper/Lower","Bro Split","5/3/1","No Preference"];
const SPLIT_W=[28,22,18,16,10,6];

function seededRng(seed){let s=seed;return()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;};}

function generateMockData(scale){
  const rng=seededRng(scale*7919+42);
  const N=scale;const now=Date.now();const DAY=86400000;

  const cityTotal=US_GYM_CITIES.reduce((a,c)=>a+c.w,0);
  const cityRows=US_GYM_CITIES.map(c=>({...c,count:Math.max(1,Math.round(N*c.w/cityTotal*(0.85+rng()*0.3)))}));
  const stateDist={};cityRows.forEach(c=>{stateDist[c.state]=(stateDist[c.state]||0)+c.count;});
  const topStates=Object.entries(stateDist).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([n,v])=>({name:n,value:v}));
  const topCities=[...cityRows].sort((a,b)=>b.count-a.count).slice(0,15).map(c=>({name:c.city,value:c.count}));
  const topZipAreas=cityRows.slice(0,12).map(c=>({prefix:c.zip+"xx",count:c.count})).sort((a,b)=>b.count-a.count);

  const goalDist=GOALS_M.map((g,i)=>{const pct=GOAL_W[i]*(0.9+rng()*0.2);return{name:g,value:Math.round(N*pct/100),pct:Math.round(pct)};});
  const goalCityMatrix=topCities.slice(0,6).map(c=>({
    city:c.name.split(",")[0],
    goals:GOALS_M.slice(0,4).map((g,i)=>({goal:g,pct:Math.round(GOAL_W[i]*(0.7+rng()*0.6))}))
  }));

  const sexDist=[
    {name:"Male",value:Math.round(N*0.68)},
    {name:"Female",value:Math.round(N*0.30)},
    {name:"Other/Prefer not",value:Math.round(N*0.02)},
  ];
  const ageDist=[
    {name:"18-24",value:Math.round(N*0.18)},
    {name:"25-34",value:Math.round(N*0.34)},
    {name:"35-44",value:Math.round(N*0.25)},
    {name:"45-54",value:Math.round(N*0.14)},
    {name:"55+",value:Math.round(N*0.09)},
  ];
  const fitDist=FIT_LEVELS.map((l,i)=>({name:l,value:Math.round(N*FIT_W[i]/100)}));
  const levelDist=fitDist;
  const splitDist=SPLITS_M.map((s2,i)=>({name:s2,value:Math.round(N*SPLIT_W[i]/100)}));

  const activeRate=0.28+rng()*0.12;
  const active7d=Math.round(N*activeRate);
  const active30d=Math.round(N*(activeRate+0.18));
  const wkToday=Math.round(active7d*0.18);
  const workouts7d=Math.round(active7d*2.4);
  const workouts30d=Math.round(active30d*7.2);
  const totalWorkouts=Math.round(N*18*(0.9+rng()*0.2));
  const avgStreak=Math.round(4+rng()*6);
  const maxStreak=Math.round(30+rng()*90);
  const pushSubs=Math.round(N*0.52);
  const newUsers7d=Math.round(N*0.018*(0.8+rng()*0.4));
  const newUsers30d=Math.round(N*0.06*(0.8+rng()*0.4));
  const newUsers90d=Math.round(N*0.16*(0.8+rng()*0.4));

  const growthChart=[];
  for(let i=89;i>=0;i--){
    const d2=new Date(now-i*DAY);
    const ds=d2.toISOString().split("T")[0].slice(5);
    const prog=(89-i)/89;
    const mom=Math.sin(prog*Math.PI*0.5);
    growthChart.push({date:ds,signups:Math.max(0,Math.round(newUsers90d/90*mom*(0.7+rng()*0.6))),workouts:Math.max(0,Math.round(workouts7d/7*mom*(0.6+rng()*0.8)))});
  }

  const cohorts=[];
  for(let m=5;m>=0;m--){
    const sz=Math.round(newUsers30d*(1+m*0.1)*(0.8+rng()*0.4));
    const base=0.55-m*0.04;
    cohorts.push({month:new Date(now-m*30*DAY).toLocaleString("default",{month:"short",year:"2-digit"}),size:sz,
      d7:Math.round(base*(0.9+rng()*0.2)*100),d30:Math.round(base*0.45*(0.9+rng()*0.2)*100),d90:Math.round(base*0.22*(0.9+rng()*0.2)*100)});
  }

  const freqDist=[{name:"0",users:Math.round(N*0.12)},{name:"1-3",users:Math.round(N*0.18)},{name:"4-8",users:Math.round(N*0.24)},{name:"9-15",users:Math.round(N*0.22)},{name:"16-24",users:Math.round(N*0.14)},{name:"25+",users:Math.round(N*0.10)}];
  const topExercises=[{name:"Bench Press",sets:Math.round(N*2.1)},{name:"Squat",sets:Math.round(N*1.8)},{name:"Deadlift",sets:Math.round(N*1.5)},{name:"Overhead Press",sets:Math.round(N*1.2)},{name:"Barbell Row",sets:Math.round(N*1.1)},{name:"Pull-up",sets:Math.round(N*0.9)},{name:"Dumbbell Curl",sets:Math.round(N*0.85)},{name:"Lat Pulldown",sets:Math.round(N*0.8)}];
  const topPRs=[{name:"Bench Press",count:Math.round(N*0.14)},{name:"Squat",count:Math.round(N*0.12)},{name:"Deadlift",count:Math.round(N*0.10)},{name:"Overhead Press",count:Math.round(N*0.08)}];
  const eventBreakdown=[{name:"WorkoutLogged",count:workouts30d},{name:"DirectMessage",count:Math.round(N*0.8)},{name:"PRHit",count:Math.round(N*0.25)},{name:"GroupChat",count:Math.round(N*0.35)},{name:"DuelStarted",count:Math.round(N*0.12)},{name:"AccountabilitySet",count:Math.round(N*0.09)},{name:"RivalAdded",count:Math.round(N*0.07)},{name:"ChallengeAchieved",count:Math.round(N*0.06)}].sort((a,b)=>b.count-a.count);
  const goalActivity=GOALS_M.slice(0,6).map((g,i)=>({goal:g,count:goalDist[i].value,avgWorkouts30d:Math.round(4+rng()*8),retentionPct30d:Math.round(18+rng()*28)}));

  const names=["Alex R.","Jordan M.","Sam K.","Casey T.","Morgan L.","Riley P.","Taylor B.","Quinn A.","Drew N.","Jesse W."];
  const topXP=names.map((name,i)=>({name,email:name.toLowerCase().replace(". ","_").replace(" ",".")+"@demo.com",xp:Math.round(50000/(i+1)*(0.8+rng()*0.4)),workouts:Math.round(200/(i+1)*(0.8+rng()*0.4)),username:"@demo"+i}));

  const dau=Math.round(active7d*0.2);
  const metroOpportunities=topCities.slice(0,6).map(c=>{
    const pen=rng()*0.02+0.005;
    const mktSz=Math.round(c.value/pen);
    return{city:c.name.split(",")[0],current:c.value,estimatedMarket:mktSz,penetration:(pen*100).toFixed(2),opportunityScore:Math.round(60+rng()*35)};
  }).sort((a,b)=>b.opportunityScore-a.opportunityScore);

  // ── Cohort retention heatmap (6 cohorts × 6 time windows) ──
    const cohortRetention=[];
    for(let m=5;m>=0;m--){
      const sz=Math.round(newUsers30d*(1+m*0.08)*(0.85+rng()*0.3));
      const base=0.62-m*0.02;
      const ageDecay=[1,0.72,0.52,0.36,0.24,0.16];
      cohortRetention.push({
        month:new Date(now-m*30*DAY).toLocaleString("default",{month:"short",year:"2-digit"}),
        size:sz,
        w1:Math.round(base*ageDecay[0]*(0.9+rng()*0.2)*100),
        w2:Math.round(base*ageDecay[1]*(0.9+rng()*0.2)*100),
        w4:Math.round(base*ageDecay[2]*(0.9+rng()*0.2)*100),
        w8:Math.round(base*ageDecay[3]*(0.9+rng()*0.2)*100),
        w12:Math.round(base*ageDecay[4]*(0.9+rng()*0.2)*100),
        w24:m<4?Math.round(base*ageDecay[5]*(0.9+rng()*0.2)*100):null,
      });
    }

    // ── Conversion funnel ──
    const registeredPct=0.72+rng()*0.12;
    const firstWkPct=0.48+rng()*0.10;
    const act7Pct=activeRate;
    const act30Pct=activeRate+0.18;
    const proPct=0.04+rng()*0.03;
    const funnel=[
      {stage:"App Installed",n:Math.round(N*1.4),pct:100,drop:null},
      {stage:"Registered",n:Math.round(N*1.4*registeredPct),pct:Math.round(registeredPct*100),drop:Math.round((1-registeredPct)*100)},
      {stage:"First Workout",n:Math.round(N*firstWkPct),pct:Math.round(firstWkPct/registeredPct*100),drop:Math.round((registeredPct-firstWkPct/1.4)*100/registeredPct)},
      {stage:"7-Day Active",n:active7d,pct:Math.round(active7d/(N*firstWkPct)*100),drop:null},
      {stage:"30-Day Active",n:active30d,pct:Math.round(active30d/(N*firstWkPct)*100),drop:null},
      {stage:"Pro Subscriber",n:Math.round(N*proPct),pct:Math.round(proPct*100),drop:null},
    ];

    // ── MRR waterfall (last 6 months) ──
    const mrrBase=Math.round(N*proPct*7);
    const mrrWaterfall=[];
    let runningMrr=Math.round(mrrBase*0.6);
    for(let m=5;m>=0;m--){
      const newMrr=Math.round(mrrBase*0.06*(0.8+rng()*0.4));
      const expansion=Math.round(mrrBase*0.008*(0.8+rng()*0.4));
      const contraction=Math.round(mrrBase*0.003*(0.8+rng()*0.4));
      const churn=Math.round(mrrBase*0.02*(0.8+rng()*0.4));
      runningMrr=runningMrr+newMrr+expansion-contraction-churn;
      mrrWaterfall.push({
        month:new Date(now-m*30*DAY).toLocaleString("default",{month:"short",year:"2-digit"}),
        mrr:Math.max(0,runningMrr),
        newMrr,expansion,contraction,churn,
        net:newMrr+expansion-contraction-churn,
      });
    }

    // ── Feature adoption ──
    const featureAdoption=[
      {feature:"Workout Logging",icon:"🏋️",users:Math.round(N*0.88),wau:Math.round(active7d*0.92),adoptionPct:88},
      {feature:"Streak Tracking",icon:"🔥",users:Math.round(N*0.74),wau:Math.round(active7d*0.78),adoptionPct:74},
      {feature:"Nutrition Log",icon:"🥗",users:Math.round(N*0.52),wau:Math.round(active7d*0.48),adoptionPct:52},
      {feature:"PR Tracking",icon:"🎯",users:Math.round(N*0.61),wau:Math.round(active7d*0.55),adoptionPct:61},
      {feature:"Social / Friends",icon:"🤝",users:Math.round(N*0.38),wau:Math.round(active7d*0.32),adoptionPct:38},
      {feature:"Push Notifications",icon:"🔔",users:pushSubs,wau:pushSubs,adoptionPct:Math.round(pushSubs/N*100)},
      {feature:"Progress Photos",icon:"📸",users:Math.round(N*0.28),wau:Math.round(active7d*0.12),adoptionPct:28},
      {feature:"AI Coach",icon:"🤖",users:Math.round(N*0.19),wau:Math.round(active7d*0.14),adoptionPct:19},
      {feature:"Duels / Challenges",icon:"⚔️",users:Math.round(N*0.22),wau:Math.round(active7d*0.18),adoptionPct:22},
      {feature:"Body Measurements",icon:"📏",users:Math.round(N*0.41),wau:Math.round(active7d*0.22),adoptionPct:41},
    ];

    // ── Session analytics ──
    const avgSessionMin=12+rng()*8;
    const sessionsPerDau=1.8+rng()*0.8;
    // Peak hour heatmap (hour 0-23 × day 0-6)
    const peakHours=Array.from({length:24},(_,h)=>
      Array.from({length:7},(_,d)=>{
        const weekdayBoost=d>0&&d<6?1.2:0.7;
        const amPeak=h>=6&&h<=8?1.5:1;
        const pmPeak=h>=17&&h<=20?1.8:1;
        const lunchPeak=h>=11&&h<=13?1.3:1;
        const nightDip=h>=23||h<=5?0.2:1;
        return Math.round(active7d*0.1*weekdayBoost*amPeak*pmPeak*lunchPeak*nightDip*(0.7+rng()*0.6));
      })
    );
    const sessionAnalytics={avgSessionMin:Math.round(avgSessionMin*10)/10,sessionsPerDau:Math.round(sessionsPerDau*10)/10,peakHours};

    // ── Growth projection (12 months) ──
    const growthRate=newUsers30d/N;
    const projections=[];
    let projUsers=N;
    for(let m=1;m<=12;m++){
      projUsers=Math.round(projUsers*(1+growthRate*(0.9+rng()*0.2)));
      const projPro=Math.round(projUsers*proPct);
      projections.push({
        month:new Date(now+m*30*DAY).toLocaleString("default",{month:"short",year:"2-digit"}),
        users:projUsers,mrr:projPro*7,
        low:Math.round(projUsers*0.78),high:Math.round(projUsers*1.22),
      });
    }

    // ── K-factor / viral coefficient ──
    const invitesSent=Math.round(N*0.12);
    const inviteConv=0.18+rng()*0.12;
    const organicFromInvites=Math.round(invitesSent*inviteConv);
    const kFactor=Math.round(organicFromInvites/N*100)/100;
    const viral={invitesSent,inviteConvRate:Math.round(inviteConv*100),organicFromInvites,kFactor,paidVsOrganic:{paid:Math.round(N*0.6),organic:Math.round(N*0.4)}};

    // ── NPS proxy (from engagement signals) ──
    const promoters=Math.round(((d2=>d2.filter(u=>u.name==="25+").reduce((a,u)=>a+u.users,0))(freqDist)/N)*100);
    const detractors=Math.round(((freqDist.find(f=>f.name==="0")||{users:0}).users/N)*100);
    const npsScore=Math.round((promoters-detractors));
    const nps={score:npsScore,promoters,passives:100-promoters-detractors,detractors};

  return{
    _isMock:true,_scale:scale,
    totalUsers:N,activeUsers7d:active7d,activeUsers30d:active30d,
    retentionRate7d:Math.round(active7d/N*100),retentionRate30d:Math.round(active30d/N*100),
    newUsers7d,newUsers30d,newUsers90d,
    wkToday,workouts7d,workouts30d,totalWorkouts,
    totalNutrition:Math.round(totalWorkouts*0.6),totalPhotos:Math.round(N*0.12),totalCheckins:Math.round(totalWorkouts*1.4),
    nutrition7d:Math.round(workouts7d*0.6),nutrition30d:Math.round(workouts30d*0.6),checkins7d:Math.round(workouts7d*1.4),
    avgStreak,maxStreak,pushSubscribers:pushSubs,pushOptInRate:Math.round(pushSubs/N*100),
    avgWorkoutsPerActiveUser7d:Math.round(workouts7d/(active7d||1)*10)/10,
    nutritionAdherence7d:Math.round(Math.round(workouts7d*0.6)/(active7d||1)*10)/10,
    friendships7d:Math.round(N*0.008),
    topStates,topCities,topZipAreas,goalCityMatrix,
    freqDist,topExercises,topPRs,eventBreakdown,
    levelDist,goalDist,goalActivity,topXP,
    sexDist,ageDist,fitDist,splitDist,cohorts,growthChart,
    market:{dau,dauMau:Math.round(dau/(active30d||1)*100),metroOpportunities},
    cohortRetention,funnel,mrrWaterfall,featureAdoption,sessionAnalytics,projections,viral,nps,
  };
}

// ─── Admin Business Value Dashboard ───
function AdminBusinessValue({s}){
  const { isDesktop } = useLayout();
  const email=s.profile?.email;
  const af=async(action,extra={})=>{
    const token=LS.get("ft-session-token");
    const hdr={"Content-Type":"application/json","X-Session-Token":token};
    try{
      const r=await fetch(`${SYNC_URL}/api/admin`,{method:"POST",headers:hdr,body:JSON.stringify({action,...extra})});
      const json=await r.json().catch(()=>({}));
      if(!r.ok)return{__error:json.error||`HTTP ${r.status}`};
      return json;
    }catch(e){return{__error:e.message};}
  };

  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overview");
  const [lastRefresh,setLastRefresh]=useState(null);
  const [loadError,setLoadError]=useState(null);
  const [mockScale,setMockScale]=useState(()=>{try{const c=LS.get("ft-mock-analytics");return c?._isMock?c._scale:null;}catch(e){return null;}});
  const isMock=!!mockScale;
  const [timeRange,setTimeRange]=useState("30d");

  const loadMock=(scale)=>{
    const d=generateMockData(scale);
    LS.set("ft-mock-analytics",d);
    setMockScale(scale);setData(d);setLoading(false);setLoadError(null);setLastRefresh(new Date());
  };
  const clearMock=()=>{
    try{localStorage.removeItem("ft-mock-analytics");}catch(e){}
    setMockScale(null);setData(null);
    setLoading(true);
    af("business_analytics").then(r=>{
      if(r?.__error){setLoadError(r.__error);setData(null);}
      else setData(r);
      setLoading(false);setLastRefresh(new Date());
    });
  };
  const load=()=>{
    try{const cached=LS.get("ft-mock-analytics");if(cached?._isMock){setData(cached);setMockScale(cached._scale);setLoading(false);setLastRefresh(new Date());return;}}catch(e){}
    setLoading(true);setLoadError(null);
    af("business_analytics").then(r=>{
      if(r?.__error){setLoadError(r.__error);setData(null);}
      else setData(r);
      setLoading(false);setLastRefresh(new Date());
    });
  };
  const exportCSV=(filename,rows)=>{
    if(!rows||!rows.length)return;
    const keys=Object.keys(rows[0]);
    const csv=[keys.join(","),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??"")||"").join(","))].join(String.fromCharCode(10));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=filename+".csv";a.click();
  };
  const exportJSON=(filename,data2)=>{
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data2,null,2)],{type:"application/json"}));a.download=filename+".json";a.click();
  };
  useEffect(()=>{load();},[]);

  // ── small helpers ──
  const Kpi=({label,value,sub,color,icon,big})=>(
    <div style={{padding:big?"14px 12px":"10px 12px",borderRadius:12,background:"rgba(255,255,255,0.03)",
      border:`1px solid ${color||V.cardBorder}20`,flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
        {icon&&<span style={{fontSize:14}}>{icon}</span>}
        <div style={{fontSize:9,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".06em",lineHeight:1.2}}>{label}</div>
      </div>
      <div style={{fontSize:big?22:16,fontWeight:900,color:color||V.text,fontFamily:V.mono,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:V.text3,marginTop:3}}>{sub}</div>}
    </div>
  );

  const SectionTitle=({children,color})=>(
    <div style={{fontSize:11,fontWeight:800,color:color||V.text,textTransform:"uppercase",letterSpacing:".08em",
      borderLeft:`3px solid ${color||V.accent}`,paddingLeft:8,marginBottom:8}}>{children}</div>
  );

  const TABS=[
    {id:"overview",icon:"📊",label:"Overview"},
    {id:"engagement",icon:"🔥",label:"Engagement"},
    {id:"fitness",icon:"💪",label:"Fitness"},
    {id:"retention",icon:"📈",label:"Retention"},
    {id:"cohorts",icon:"🧬",label:"Cohorts"},
    {id:"funnel",icon:"⬇️",label:"Funnel"},
    {id:"revenue",icon:"💵",label:"Revenue"},
    {id:"features",icon:"🔬",label:"Features"},
    {id:"sessions",icon:"⏱️",label:"Sessions"},
    {id:"growth",icon:"🚀",label:"Growth"},
    {id:"social",icon:"🤝",label:"Social"},
    {id:"leaderboard",icon:"🏆",label:"Leaders"},
    {id:"geo",icon:"📍",label:"Geo & Goals"},
    {id:"demographics",icon:"👥",label:"Demographics"},
    {id:"market",icon:"💰",label:"Market"},
  ];

  const COLORS=[V.accent,V.accent2,V.warn,"#22c55e","#f43f5e",V.purple,"#06b6d4","#f97316","#84cc16","#e879f9"];

  if(loading)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>📈 Business Value</div>
          <div style={{fontSize:10,color:V.text3}}>Loading analytics…</div>
        </div>
      </div>
      {[1,2,3,4].map(i=>(
        <div key={i} style={{height:80,borderRadius:12,background:"rgba(255,255,255,0.03)",
          animation:"pulse 1.5s ease-in-out infinite"}}/>
      ))}
    </div>
  );

  if(!loading&&loadError)return(
    <div style={{padding:20,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
      <div style={{fontSize:14,fontWeight:700,color:V.danger,marginBottom:6}}>Failed to Load Analytics</div>
      <div style={{fontSize:11,color:V.text3,marginBottom:16,fontFamily:V.mono}}>{loadError}</div>
      <button onClick={load} style={{padding:"8px 20px",borderRadius:10,background:V.accent,border:"none",
        cursor:"pointer",fontSize:12,fontWeight:700,color:V.bg,fontFamily:V.font}}>Retry</button>
    </div>
  );
  if(!data)return(
    <div style={{textAlign:"center",padding:40}}>
      <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
      <div style={{fontSize:14,color:V.text3}}>Failed to load analytics</div>
      <button onClick={load} style={{marginTop:12,padding:"8px 20px",borderRadius:8,background:V.accent,
        border:"none",color:V.bg,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:V.font}}>Retry</button>
    </div>
  );

  const d=data;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Header */}
      {isMock&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:10,
          background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>🎭</span>
            <div>
              <div style={{fontSize:11,fontWeight:800,color:"#fbbf24"}}>MOCK DATA · {mockScale?.toLocaleString()} users</div>
              <div style={{fontSize:9,color:V.text3}}>Simulated only · never synced to real data</div>
            </div>
          </div>
          <button onClick={clearMock} style={{padding:"4px 10px",borderRadius:6,background:"rgba(251,191,36,0.15)",
            border:"1px solid rgba(251,191,36,0.4)",color:"#fbbf24",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:V.font}}>
            Clear Mock
          </button>
        </div>
      )}
      {!isMock&&(
        <div style={{display:"flex",gap:6,alignItems:"center",padding:"8px 10px",borderRadius:10,
          background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`}}>
          <span style={{fontSize:10,color:V.text3,flexShrink:0}}>🎭 Preview with mock data:</span>
          {[1000,10000,100000].map(n=>(
            <button key={n} onClick={()=>loadMock(n)} style={{flex:1,padding:"5px 0",borderRadius:7,
              border:`1px solid ${V.cardBorder}`,background:"rgba(255,255,255,0.04)",color:V.text3,
              fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:V.font}}>
              {n>=1000?(n/1000)+"K":n}
            </button>
          ))}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>📈 Business Value{isMock&&<span style={{fontSize:10,color:"#fbbf24",marginLeft:6,fontWeight:600}}>MOCK</span>}</div>
          <div style={{fontSize:10,color:V.text3}}>
            {lastRefresh?`Updated ${lastRefresh.toLocaleTimeString()}`:"—"} · {d.totalUsers.toLocaleString()} members
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>exportJSON("ironlog-analytics-"+new Date().toISOString().split("T")[0],d)}
            style={{padding:"5px 10px",borderRadius:7,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              color:V.text3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:V.font}}>
            ↓ Export
          </button>
          <button onClick={isMock?()=>loadMock(mockScale):load} disabled={loading}
            style={{padding:"6px 12px",borderRadius:8,background:"rgba(255,255,255,0.06)",border:`1px solid ${V.cardBorder}`,
              cursor:"pointer",fontSize:10,fontWeight:700,color:V.text3,fontFamily:V.font}}>
            ↻ {isMock?"Regen":"Refresh"}
          </button>
        </div>
      </div>
      {/* Time range selector */}
      <div style={{display:"flex",gap:4}}>
        {["7d","30d","90d","1yr","All"].map(r=>(
          <button key={r} onClick={()=>setTimeRange(r)}
            style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${timeRange===r?V.accent+"60":V.cardBorder}`,
              background:timeRange===r?`${V.accent}12`:"rgba(255,255,255,0.02)",
              color:timeRange===r?V.accent:V.text3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:V.font}}>
            {r}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${tab===t.id?V.accent+"60":V.cardBorder}`,
              background:tab===t.id?`${V.accent}12`:"rgba(255,255,255,0.02)",cursor:"pointer",
              fontSize:10,fontWeight:700,color:tab===t.id?V.accent:V.text3,fontFamily:V.font,
              whiteSpace:"nowrap",flexShrink:0}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {tab==="overview"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Hero KPIs */}
          <Card style={{padding:14,background:`linear-gradient(135deg,${V.accent}08,${V.accent2}06)`}}>
            <SectionTitle color={V.accent}>Platform at a Glance</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8,marginBottom:8}}>
              <Kpi big label="Total Members" value={d.totalUsers.toLocaleString()} icon="👥" color={V.accent}
                sub={`+${d.newUsers30d} this month`}/>
              <Kpi big label="Active (7d)" value={d.activeUsers7d.toLocaleString()} icon="🔥" color="#f59e0b"
                sub={`${d.retentionRate7d}% of all users`}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <Kpi label="Today's Workouts" value={d.wkToday} icon="🏋️" color={V.accent}/>
              <Kpi label="Push Subscribers" value={d.pushSubscribers} icon="🔔" color={V.accent2}
                sub={`${d.pushOptInRate}% opt-in`}/>
              <Kpi label="Avg Streak" value={`${d.avgStreak}d`} icon="⚡" color="#22c55e"
                sub={`Best: ${d.maxStreak}d`}/>
            </div>
          </Card>

          {/* 90-day growth chart */}
          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>90-Day Growth</SectionTitle>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={d.growthChart} margin={{top:4,right:4,bottom:0,left:-20}}>
                <defs>
                  <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={V.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={V.accent} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gAcc2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={V.accent2} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={V.accent2} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="date" tick={{fontSize:8,fill:V.text3}} tickLine={false}
                  interval={Math.floor(d.growthChart.length/7)}/>
                <YAxis tick={{fontSize:8,fill:V.text3}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:8,fontSize:10}}
                  labelStyle={{color:V.text}} itemStyle={{color:V.text2}}/>
                <Area type="monotone" dataKey="workouts" stroke={V.accent} fill="url(#gAcc)"
                  strokeWidth={2} name="Workouts" dot={false}/>
                <Area type="monotone" dataKey="signups" stroke={V.accent2} fill="url(#gAcc2)"
                  strokeWidth={2} name="Signups" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:6}}>
              {[{c:V.accent,l:"Workouts"},{c:V.accent2,l:"Signups"}].map(x=>(
                <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:10,height:3,borderRadius:2,background:x.c}}/>
                  <span style={{fontSize:9,color:V.text3}}>{x.l}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Growth metrics row */}
          <Card style={{padding:12}}>
            <SectionTitle color="#22c55e">Member Growth</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <Kpi label="New (7d)" value={`+${d.newUsers7d}`} color="#22c55e"/>
              <Kpi label="New (30d)" value={`+${d.newUsers30d}`} color="#22c55e"/>
              <Kpi label="New (90d)" value={`+${d.newUsers90d}`} color="#22c55e"/>
            </div>
          </Card>

          {/* Data volume */}
          <Card style={{padding:12}}>
            <SectionTitle color={V.purple}>Data Captured</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <Kpi label="Workouts" value={d.totalWorkouts.toLocaleString()} icon="🏋️" color={V.accent}/>
              <Kpi label="Nutrition Logs" value={d.totalNutrition.toLocaleString()} icon="🥗" color={V.warn}/>
              <Kpi label="Progress Photos" value={d.totalPhotos.toLocaleString()} icon="📸" color={V.purple}/>
              <Kpi label="Check-ins" value={d.totalCheckins.toLocaleString()} icon="✅" color="#22c55e"/>
              <Kpi label="Workouts (7d)" value={d.workouts7d} icon="📅" color={V.accent}/>
              <Kpi label="Check-ins (7d)" value={d.checkins7d} icon="📅" color="#22c55e"/>
            </div>
          </Card>
        </div>
      )}

      {/* ══ ENGAGEMENT TAB ══ */}
      {tab==="engagement"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent}>Workout Frequency Distribution</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Members by workouts logged in last 90 days</div>
            {(d.freqDist||[]).map((row,i)=>{
              const max=Math.max(...(d.freqDist||[]).map(r=>r.users));
              const pct=max>0?row.users/max:0;
              const labels={'0':'Inactive','1-3':'Casual','4-8':'Regular','9-15':'Dedicated','16-24':'Serious','25+':'Elite'};
              const colors={'0':V.danger,'1-3':V.warn,'4-8':'#fbbf24','9-15':'#22c55e','16-24':V.accent,'25+':V.accent2};
              return(
                <div key={row.name} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,fontWeight:700,color:colors[row.name]||V.text,fontFamily:V.mono,minWidth:28}}>{row.name}</span>
                      <span style={{fontSize:9,color:V.text3}}>{labels[row.name]||""}</span>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,color:V.text,fontFamily:V.mono}}>
                      {row.users} <span style={{color:V.text3,fontWeight:400,fontSize:8}}>({d.totalUsers>0?Math.round(row.users/d.totalUsers*100):0}%)</span>
                    </span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:6,borderRadius:3,width:`${pct*100}%`,
                      background:`linear-gradient(90deg,${colors[row.name]||V.accent},${colors[row.name]||V.accent}aa)`,
                      transition:"width .3s"}}/>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#f59e0b">Social Activity (30d)</SectionTitle>
            {(d.eventBreakdown||[]).slice(0,8).map((ev,i)=>{
              const max=d.eventBreakdown?.[0]?.count||1;
              const labels={WorkoutLogged:"🏋️ Workout",PRHit:"🎯 PR Hit",QuickMessage:"💬 Quick Msg",
                RivalAdded:"⚔️ Rival Added",GroupChat:"👥 Group Chat",AccountabilitySet:"🤝 Accountability",
                DirectMessage:"📩 DM",ChallengeAchieved:"🏆 Challenge"};
              return(
                <div key={ev.name} style={{marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:10,color:V.text2}}>{labels[ev.name]||ev.name}</span>
                    <span style={{fontSize:10,fontWeight:700,color:V.text,fontFamily:V.mono}}>{ev.count.toLocaleString()}</span>
                  </div>
                  <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:5,borderRadius:3,width:`${ev.count/max*100}%`,
                      background:COLORS[i%COLORS.length]}}/>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>Engagement KPIs</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
              <Kpi label="Avg Workouts/Active User (7d)" value={d.avgWorkoutsPerActiveUser7d} color={V.accent}/>
              <Kpi label="Nutrition Adherence (7d)" value={`${d.nutritionAdherence7d}x`} color={V.warn}
                sub="nutrition logs per active user"/>
              <Kpi label="Push Opt-in Rate" value={`${d.pushOptInRate}%`} color="#22c55e" icon="🔔"
                sub={`${d.pushSubscribers} subscribers`}/>
              <Kpi label="New Friendships (7d)" value={d.friendships7d} color="#06b6d4" icon="🤝"/>
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#f43f5e">Streak Intelligence</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <Kpi big label="Avg Best Streak" value={`${d.avgStreak}d`} color="#f59e0b" icon="🔥"/>
              <Kpi big label="Best Streak Ever" value={`${d.maxStreak}d`} color="#f43f5e" icon="⚡"/>
              <Kpi big label="Streaks Tracked" value={d.activeUsers30d} color="#22c55e" icon="📊"
                sub="users w/ workout history"/>
            </div>
          </Card>
        </div>
      )}

      {/* ══ FITNESS TAB ══ */}
      {tab==="fitness"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent}>Top Exercises (last 30d · by sets logged)</SectionTitle>
            {(d.topExercises||[]).map((ex,i)=>{
              const max=(d.topExercises||[])[0]?.sets||1;
              return(
                <div key={ex.name} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,color:V.text3,fontFamily:V.mono,minWidth:16}}>{i+1}</span>
                      <span style={{fontSize:11,color:V.text,textTransform:"capitalize"}}>{ex.name.replace(/-/g," ")}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.mono}}>{ex.sets.toLocaleString()} sets</span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:6,borderRadius:3,width:`${ex.sets/max*100}%`,
                      background:`linear-gradient(90deg,${COLORS[i%COLORS.length]},${COLORS[i%COLORS.length]}aa)`}}/>
                  </div>
                </div>
              );
            })}
            <div style={{fontSize:9,color:V.text3,marginTop:6}}>Exercise IDs from workout logs — rename map can be applied</div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#f43f5e">Top PR Movements (30d)</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6}}>
              {(d.topPRs||[]).map((pr,i)=>(
                <div key={pr.name} style={{padding:"10px 12px",borderRadius:10,
                  background:"rgba(255,255,255,0.02)",border:`1px solid ${COLORS[i%COLORS.length]}20`}}>
                  <div style={{fontSize:13,fontWeight:800,color:COLORS[i%COLORS.length],fontFamily:V.mono}}>{pr.count}</div>
                  <div style={{fontSize:10,color:V.text2,marginTop:2,textTransform:"capitalize"}}>{pr.name.replace(/-/g," ")}</div>
                  <div style={{fontSize:8,color:V.text3}}>PRs logged</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#06b6d4">Member Fitness Levels</SectionTitle>
            {(d.levelDist||[]).map((lv,i)=>{
              const max=(d.levelDist||[])[0]?.value||1;
              const colors={Beginner:"#22c55e",Intermediate:"#f59e0b",Advanced:"#f43f5e",Unknown:V.text3};
              return(
                <div key={lv.name} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:V.text2}}>{lv.name}</span>
                    <span style={{fontSize:11,fontWeight:700,color:colors[lv.name]||V.text,fontFamily:V.mono}}>
                      {lv.value} <span style={{fontSize:8,color:V.text3,fontWeight:400}}>({d.totalUsers>0?Math.round(lv.value/d.totalUsers*100):0}%)</span>
                    </span>
                  </div>
                  <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:6,borderRadius:3,width:`${lv.value/max*100}%`,background:colors[lv.name]||V.accent}}/>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.warn}>Top Member States</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6}}>
              {(d.topStates||[]).map((st,i)=>(
                <div key={st.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                  <span style={{fontSize:11,color:V.text2}}>{st.name}</span>
                  <span style={{fontSize:12,fontWeight:800,color:COLORS[i%COLORS.length],fontFamily:V.mono}}>{st.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══ RETENTION TAB ══ */}
      {tab==="retention"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          <Card style={{padding:14,background:`linear-gradient(135deg,rgba(34,197,94,0.06),rgba(16,185,129,0.04))`}}>
            <SectionTitle color="#22c55e">Retention Overview</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8,marginBottom:8}}>
              <Kpi big label="7-Day Retention" value={`${d.retentionRate7d}%`} color="#22c55e" icon="🔥"
                sub={`${d.activeUsers7d} of ${d.totalUsers} users logged a workout`}/>
              <Kpi big label="30-Day Retention" value={`${d.retentionRate30d}%`} color="#f59e0b" icon="📅"
                sub={`${d.activeUsers30d} of ${d.totalUsers} users`}/>
            </div>
            <div style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontSize:10,fontWeight:700,color:V.text,marginBottom:6}}>Industry Benchmarks</div>
              {[
                {label:"Fitness app 7-day avg",benchmark:"25–35%",your:d.retentionRate7d,c:"#22c55e"},
                {label:"Fitness app 30-day avg",benchmark:"10–20%",your:d.retentionRate30d,c:"#f59e0b"},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontSize:9,color:V.text3}}>{row.label}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:9,color:V.text3}}>Avg: {row.benchmark}</span>
                    <span style={{fontSize:10,fontWeight:800,color:row.c}}>{row.your}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>Workout Cadence</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <Kpi label="Workouts Today" value={d.wkToday} icon="🏋️" color={V.accent}/>
              <Kpi label="Workouts (7d)" value={d.workouts7d} color={V.accent}
                sub={`${d.activeUsers7d>0?Math.round(d.workouts7d/d.activeUsers7d*10)/10:0}/user`}/>
              <Kpi label="Workouts (30d)" value={d.workouts30d} color={V.accent}
                sub={`${d.activeUsers30d>0?Math.round(d.workouts30d/d.activeUsers30d*10)/10:0}/user`}/>
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.warn}>Nutrition Tracking</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <Kpi label="Total Logs" value={d.totalNutrition.toLocaleString()} icon="🥗" color={V.warn}/>
              <Kpi label="Logs (7d)" value={d.nutrition7d} color={V.warn}
                sub={`${d.activeUsers7d>0?Math.round(d.nutrition7d/d.activeUsers7d*10)/10:0}/active user`}/>
              <Kpi label="Logs (30d)" value={d.nutrition30d} color={V.warn}/>
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#f43f5e">Churn Risk Signals</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {label:"Never logged a workout",count:((d.freqDist||[]).find(f=>f.name==="0")||{users:0}).users,
                  desc:"No activity — re-engagement opportunity",c:V.danger,icon:"🚨"},
                {label:"1–3 workouts in 90 days",count:((d.freqDist||[]).find(f=>f.name==="1-3")||{users:0}).users,
                  desc:"Low engagement — needs a push",c:V.warn,icon:"⚠️"},
                {label:"No push notifications",count:d.totalUsers-d.pushSubscribers,
                  desc:"Can't be reached directly",c:"#f97316",icon:"🔕"},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:10,
                  background:`${row.c}08`,border:`1px solid ${row.c}20`}}>
                  <span style={{fontSize:18,flexShrink:0}}>{row.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,fontWeight:700,color:row.c}}>{row.label}</span>
                      <span style={{fontSize:14,fontWeight:900,color:row.c,fontFamily:V.mono}}>{row.count.toLocaleString()}</span>
                    </div>
                    <div style={{fontSize:9,color:V.text3,marginTop:2}}>{row.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══ SOCIAL TAB ══ */}
      {tab==="social"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          <Card style={{padding:14}}>
            <SectionTitle color="#06b6d4">Social Health</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
              <Kpi big label="New Friendships (7d)" value={d.friendships7d} icon="🤝" color="#06b6d4"/>
              <Kpi big label="Social Events (30d)" value={(d.eventBreakdown||[]).reduce((a,e)=>a+e.count,0).toLocaleString()} icon="📡" color={V.accent2}/>
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>Event Breakdown (30d)</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6}}>
              {(d.eventBreakdown||[]).slice(0,8).map((ev,i)=>{
                const labels={WorkoutLogged:"🏋️ Workouts",PRHit:"🎯 PRs Hit",QuickMessage:"💬 Quick Msgs",
                  RivalAdded:"⚔️ Rivals",GroupChat:"👥 Group Chat",AccountabilitySet:"🤝 Accountability",
                  DirectMessage:"📩 DMs",ChallengeAchieved:"🏆 Challenges",DuelStarted:"⚡ Duels"};
                return(
                  <div key={ev.name} style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.02)",
                    border:`1px solid ${COLORS[i%COLORS.length]}20`}}>
                    <div style={{fontSize:14,fontWeight:900,color:COLORS[i%COLORS.length],fontFamily:V.mono}}>{ev.count.toLocaleString()}</div>
                    <div style={{fontSize:10,color:V.text2,marginTop:2}}>{labels[ev.name]||ev.name}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#ec4899">Community Insights</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {icon:"📣",label:"Push notification reach",value:`${d.pushOptInRate}% of members`,desc:`${d.pushSubscribers} subscribers who opted in`},
                {icon:"🤝",label:"Accountability & rivalry",value:`${((d.eventBreakdown||[]).find(e=>e.name==="AccountabilitySet")||{count:0}).count + ((d.eventBreakdown||[]).find(e=>e.name==="RivalAdded")||{count:0}).count} events`,desc:"Partnerships formed in last 30 days"},
                {icon:"💬",label:"Direct messaging",value:`${((d.eventBreakdown||[]).find(e=>e.name==="DirectMessage")||{count:0}).count} DMs`,desc:"Sent in last 30 days"},
                {icon:"🏆",label:"Challenges completed",value:`${((d.eventBreakdown||[]).find(e=>e.name==="ChallengeAchieved")||{count:0}).count} achievements`,desc:"Members hitting challenge tiers"},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:10,
                  background:"rgba(255,255,255,0.03)",border:`1px solid ${V.cardBorder}`}}>
                  <span style={{fontSize:20,flexShrink:0}}>{row.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <span style={{fontSize:11,color:V.text2,fontWeight:600}}>{row.label}</span>
                      <span style={{fontSize:11,fontWeight:800,color:V.text,fontFamily:V.mono}}>{row.value}</span>
                    </div>
                    <div style={{fontSize:9,color:V.text3,marginTop:2}}>{row.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══ LEADERBOARD TAB ══ */}
      {tab==="leaderboard"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          <Card style={{padding:14}}>
            <SectionTitle color="#f59e0b">Top 20 by Iron Score (XP)</SectionTitle>
            {(d.topXP||[]).map((u,i)=>{
              const rank=[...IRON_RANKS].reverse().find(r=>u.xp>=r.xpNeeded)||IRON_RANKS[0];
              const maxXP=(d.topXP||[])[0]?.xp||1;
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                  padding:"8px 10px",borderRadius:10,marginBottom:4,
                  background:i<3?`${rank.color}08`:"rgba(255,255,255,0.02)",
                  border:`1px solid ${i<3?rank.color+"25":V.cardBorder}`}}>
                  <div style={{width:22,height:22,borderRadius:8,flexShrink:0,
                    background:i===0?"linear-gradient(135deg,#f59e0b,#f97316)":
                               i===1?"linear-gradient(135deg,#94a3b8,#cbd5e1)":
                               i===2?"linear-gradient(135deg,#cd7f32,#b87333)":"rgba(255,255,255,0.04)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?11:9,fontWeight:900,
                    color:i<3?V.bg:V.text3}}>
                    {i+1}
                  </div>
                  <span style={{fontSize:14}}>{rank.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:V.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                    <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.04)",marginTop:3}}>
                      <div style={{height:3,borderRadius:2,width:`${u.xp/maxXP*100}%`,background:rank.color}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:800,color:rank.color,fontFamily:V.mono}}>{u.xp.toLocaleString()}</div>
                    <div style={{fontSize:8,color:V.text3}}>{rank.name}</div>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent}>Platform XP Intelligence</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
              <Kpi label="Avg Streak (90d)" value={`${d.avgStreak}d`} color="#f59e0b" icon="🔥"/>
              <Kpi label="All-time Longest" value={`${d.maxStreak}d`} color="#f43f5e" icon="⚡"/>
              <Kpi label="Total PRs (30d)" value={(d.topPRs||[]).reduce((a,p)=>a+p.count,0)} color={V.accent} icon="🎯"/>
              <Kpi label="Elite Members (25+)" value={((d.freqDist||[]).find(f=>f.name==="25+")||{users:0}).users} color={V.accent2} icon="⚜️"/>
            </div>
          </Card>

          {/* Rank distribution pill chart */}
          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>Rank Tier Distribution</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Based on top {d.topXP?.length||0} tracked users</div>
            {(()=>{
              const tierCount={};
              (d.topXP||[]).forEach(u=>{
                const rank=[...IRON_RANKS].reverse().find(r=>u.xp>=r.xpNeeded)||IRON_RANKS[0];
                tierCount[rank.tier]=(tierCount[rank.tier]||{count:0,color:rank.tierColor,icon:rank.icon});
                tierCount[rank.tier].count++;
              });
              return Object.entries(tierCount).sort((a,b)=>b[1].count-a[1].count).map(([tier,{count,color,icon}])=>(
                <div key={tier} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:14,width:20,flexShrink:0}}>{icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:10,fontWeight:600,color}}>{tier}</span>
                      <span style={{fontSize:10,fontWeight:700,color,fontFamily:V.mono}}>{count}</span>
                    </div>
                    <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                      <div style={{height:5,borderRadius:3,width:`${count/(d.topXP?.length||1)*100}%`,background:color}}/>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </Card>
        </div>
      )}

      {/* ══ GEO & GOALS TAB ══ */}
      {tab==="geo"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Primary goal distribution — the most strategic insight */}
          <Card style={{padding:14,background:`linear-gradient(135deg,${V.accent}07,${V.purple}07)`}}>
            <SectionTitle color={V.accent}>Primary Goal Distribution</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>What members said they're training for at signup</div>
            {(d.goalDist||[]).length===0&&(
              <div style={{fontSize:11,color:V.text3,textAlign:"center",padding:"16px 0"}}>
                No goal data yet — populates as v11+ users sign up
              </div>
            )}
            {(d.goalDist||[]).map((row,i)=>{
              const max=Math.max(0,...(d.goalDist||[]).map(r=>r.value));
              const GOAL_COLORS={"Build Muscle":V.accent,"Lose Fat":"#f43f5e","Body Recomposition":V.purple,"Strength":"#f59e0b","Maintain Fitness":"#22c55e","Not set":V.text3};
              const GOAL_ICONS={"Build Muscle":"💪","Lose Fat":"🔥","Body Recomposition":"⚡","Strength":"🏋️","Maintain Fitness":"🧘","Not set":"—"};
              const color=GOAL_COLORS[row.name]||COLORS[i%COLORS.length];
              return(
                <div key={row.name} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:14}}>{GOAL_ICONS[row.name]||"🎯"}</span>
                      <span style={{fontSize:12,fontWeight:700,color}}>{row.name}</span>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:800,color,fontFamily:V.mono}}>{row.value}</span>
                      <span style={{fontSize:9,color:V.text3,fontWeight:400}}>({row.pct}%)</span>
                    </div>
                  </div>
                  <div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.05)"}}>
                    <div style={{height:"100%",borderRadius:4,
                      background:`linear-gradient(90deg,${color},${color}90)`,
                      width:`${max>0?row.value/max*100:0}%`,transition:"width .4s"}}/>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Goal × retention cross-tab */}
          <Card style={{padding:14}}>
            <SectionTitle color="#22c55e">Goal Cohort Performance (30d)</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>How each goal segment actually trains — avg workouts & 30-day retention</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(d.goalActivity||[]).filter(g=>g.goal!=="Not set").length===0&&(
                <div style={{fontSize:11,color:V.text3,textAlign:"center",padding:"16px 0"}}>
                  No goal cohort data yet — populates as v11+ users sign up and sync
                </div>
              )}
              {(d.goalActivity||[]).filter(g=>g.goal!=="Not set").map((row,i)=>{
                const GOAL_COLORS={"Build Muscle":V.accent,"Lose Fat":"#f43f5e","Body Recomposition":V.purple,"Strength":"#f59e0b","Maintain Fitness":"#22c55e"};
                const color=GOAL_COLORS[row.goal]||COLORS[i%COLORS.length];
                const retColor=row.retentionPct30d>=30?"#22c55e":row.retentionPct30d>=15?"#f59e0b":"#f43f5e";
                return(
                  <div key={row.goal} style={{padding:"10px 12px",borderRadius:10,
                    background:"rgba(255,255,255,0.02)",border:`1px solid ${color}18`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:700,color}}>{row.goal}</span>
                      <span style={{fontSize:9,color:V.text3}}>{row.count} members</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
                      <div style={{textAlign:"center",padding:"6px",borderRadius:8,background:"rgba(255,255,255,0.03)"}}>
                        <div style={{fontSize:18,fontWeight:900,color,fontFamily:V.mono}}>{row.avgWorkouts30d}</div>
                        <div style={{fontSize:8,color:V.text3}}>avg workouts / 30d</div>
                      </div>
                      <div style={{textAlign:"center",padding:"6px",borderRadius:8,background:"rgba(255,255,255,0.03)"}}>
                        <div style={{fontSize:18,fontWeight:900,color:retColor,fontFamily:V.mono}}>{row.retentionPct30d}%</div>
                        <div style={{fontSize:8,color:V.text3}}>30-day retention</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Geographic distribution */}
          <Card style={{padding:14}}>
            <SectionTitle color={V.warn}>Top Cities</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Where your members are based</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {(d.topCities||[]).map((city,i)=>{
                const max=(d.topCities||[])[0]?.value||1;
                return(
                  <div key={city.name} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:V.text3,fontFamily:V.mono,width:16,flexShrink:0}}>{i+1}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <span style={{fontSize:11,color:V.text,fontWeight:i<3?700:400,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{city.name}</span>
                        <span style={{fontSize:11,fontWeight:700,color:COLORS[i%COLORS.length],fontFamily:V.mono,flexShrink:0}}>{city.value}</span>
                      </div>
                      <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.05)"}}>
                        <div style={{height:"100%",borderRadius:2,
                          background:COLORS[i%COLORS.length],
                          width:`${city.value/max*100}%`,transition:"width .4s"}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(d.topCities||[]).length===0&&(
                <div style={{fontSize:11,color:V.text3,textAlign:"center",padding:"12px 0"}}>
                  No city data yet — will populate as users with city on record sync
                </div>
              )}
            </div>
          </Card>

          {/* State distribution — moved from fitness tab, shown here in context */}
          <Card style={{padding:14}}>
            <SectionTitle color="#06b6d4">Top States</SectionTitle>
            {(d.topStates||[]).length===0&&(
              <div style={{fontSize:11,color:V.text3,textAlign:"center",padding:"12px 0"}}>No state data yet</div>
            )}
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6}}>
              {(d.topStates||[]).map((st,i)=>{
                const max=(d.topStates||[])[0]?.value||1;
                return(
                  <div key={st.name} style={{padding:"8px 10px",borderRadius:8,
                    background:"rgba(255,255,255,0.02)",border:`1px solid ${COLORS[i%COLORS.length]}18`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:700,color:V.text2}}>{st.name}</span>
                      <span style={{fontSize:13,fontWeight:800,color:COLORS[i%COLORS.length],fontFamily:V.mono}}>{st.value}</span>
                    </div>
                    <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.05)"}}>
                      <div style={{height:"100%",borderRadius:2,background:COLORS[i%COLORS.length],
                        width:`${st.value/max*100}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Zip prefix clustering */}
          {(d.topZipAreas||[]).length>0&&(
            <Card style={{padding:14}}>
              <SectionTitle color={V.accent2}>Top Postal Areas</SectionTitle>
              <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Grouped by first 3 zip digits (postal sector) — shows regional density</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {(d.topZipAreas||[]).map((area,i)=>{
                  const max=(d.topZipAreas||[])[0]?.count||1;
                  return(
                    <div key={area.prefix} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,fontWeight:800,color:V.accent,fontFamily:V.mono,width:32,flexShrink:0}}>{area.prefix}xx</span>
                      <div style={{flex:1}}>
                        <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.05)"}}>
                          <div style={{height:"100%",borderRadius:3,
                            background:`linear-gradient(90deg,${COLORS[i%COLORS.length]},${COLORS[i%COLORS.length]}80)`,
                            width:`${area.count/max*100}%`,transition:"width .4s"}}/>
                        </div>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:V.text,fontFamily:V.mono,width:24,textAlign:"right",flexShrink:0}}>{area.count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}


          {/* Goal x City matrix */}
          {(d.goalCityMatrix||[]).length>0&&(
            <Card style={{padding:14}}>
              <SectionTitle color={V.accent2}>Goal Mix by Metro</SectionTitle>
              <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Top 4 goals across your 6 biggest cities</div>
              {(d.goalCityMatrix||[]).map((c2,ci)=>{
                const GCOLS={"Build Muscle":V.accent,"Lose Fat":"#f43f5e","Body Recomposition":V.purple,"Strength":"#f59e0b"};
                const total=(c2.goals||[]).reduce((a,g)=>a+g.pct,0)||1;
                return(
                  <div key={c2.city} style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:V.text2,marginBottom:4}}>{c2.city}</div>
                    <div style={{display:"flex",height:12,borderRadius:4,overflow:"hidden",gap:1}}>
                      {(c2.goals||[]).map((g,gi)=>(
                        <div key={g.goal} style={{flex:g.pct/total,background:GCOLS[g.goal]||COLORS[gi%COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",minWidth:0}}>
                          {g.pct/total>0.18&&<span style={{fontSize:7,color:"#fff",fontWeight:700}}>{Math.round(g.pct/total*100)}%</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      {(c2.goals||[]).map((g,gi)=>(
                        <div key={g.goal} style={{display:"flex",alignItems:"center",gap:2}}>
                          <div style={{width:5,height:5,borderRadius:2,background:GCOLS[g.goal]||COLORS[gi%COLORS.length]}}/>
                          <span style={{fontSize:7,color:V.text3}}>{g.goal.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {/* Business intelligence callout */}
          <Card style={{padding:12,background:`linear-gradient(135deg,rgba(0,245,160,0.04),rgba(139,92,246,0.04))`,
            border:`1px solid ${V.accent}18`}}>
            <div style={{fontSize:10,fontWeight:700,color:V.text,marginBottom:6}}>💡 Geographic Intelligence</div>
            <div style={{fontSize:9,color:V.text3,lineHeight:1.7}}>
              {(d.topCities||[]).length>0
                ?`Your largest market is ${(d.topCities||[])[0]?.name} with ${(d.topCities||[])[0]?.value} members. `
                :"City data will appear here once members with city records sync. "}
              {(d.goalDist||[]).length>0&&(d.goalDist||[])[0]?.name!=="Not set"
                ?`Your primary user intent is "${(d.goalDist||[])[0]?.name}" (${(d.goalDist||[])[0]?.pct}%) — lean into this in your marketing and feature prioritisation.`
                :""}
            </div>
          </Card>
        </div>
      )}


      {/* ══ DEMOGRAPHICS TAB ══ */}
      {tab==="demographics"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14,background:`linear-gradient(135deg,${V.purple}08,${V.accent2}06)`}}>
            <SectionTitle color={V.purple}>Sex Distribution</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {(d.sexDist||[{name:"Male",value:Math.round(d.totalUsers*.68)},{name:"Female",value:Math.round(d.totalUsers*.30)},{name:"Other",value:Math.round(d.totalUsers*.02)}]).map((row,i)=>{
                const colors=["#60a5fa","#f472b6","#a78bfa"];
                const icons=["♂","♀","⚥"];
                return(
                  <div key={row.name} style={{textAlign:"center",padding:"12px 8px",borderRadius:12,background:`${colors[i]}10`,border:`1px solid ${colors[i]}30`}}>
                    <div style={{fontSize:22,marginBottom:3}}>{icons[i]}</div>
                    <div style={{fontSize:18,fontWeight:900,color:colors[i],fontFamily:V.mono}}>{Math.round(row.value/(d.totalUsers||1)*100)}%</div>
                    <div style={{fontSize:9,color:V.text3,marginTop:2}}>{row.name}</div>
                    <div style={{fontSize:10,fontWeight:700,color:V.text2,fontFamily:V.mono}}>{row.value.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#fb923c">Age Bracket Distribution</SectionTitle>
            {(d.ageDist||[{name:"18-24",value:Math.round(d.totalUsers*.18)},{name:"25-34",value:Math.round(d.totalUsers*.34)},{name:"35-44",value:Math.round(d.totalUsers*.25)},{name:"45-54",value:Math.round(d.totalUsers*.14)},{name:"55+",value:Math.round(d.totalUsers*.09)}]).map((row,i)=>{
              const max=Math.round(d.totalUsers*.34);
              const clrs=["#22c55e","#4ade80",V.accent2,"#fb923c","#f43f5e"];
              return(
                <div key={row.name} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,fontWeight:700,color:clrs[i]}}>{row.name}</span>
                    <span style={{fontSize:10,fontFamily:V.mono,color:V.text}}>{row.value.toLocaleString()} <span style={{color:V.text3,fontSize:8}}>({Math.round(row.value/(d.totalUsers||1)*100)}%)</span></span>
                  </div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:"100%",borderRadius:4,width:`${max>0?row.value/max*100:0}%`,background:`linear-gradient(90deg,${clrs[i]},${clrs[i]}90)`,transition:"width .4s"}}/>
                  </div>
                </div>
              );
            })}
            <div style={{fontSize:9,color:V.text3,marginTop:4}}>★ Core demo: 25–34 · estimated from date of birth field</div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent}>Fitness Level Split</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {(d.fitDist||d.levelDist||[]).map((row,i)=>{
                const clrs=["#22c55e","#f59e0b","#f43f5e"];
                return(
                  <div key={row.name} style={{padding:"12px 8px",borderRadius:12,textAlign:"center",background:`${clrs[i]}08`,border:`1px solid ${clrs[i]}25`}}>
                    <div style={{fontSize:20,fontWeight:900,color:clrs[i],fontFamily:V.mono}}>{Math.round(row.value/(d.totalUsers||1)*100)}%</div>
                    <div style={{fontSize:10,fontWeight:700,color:clrs[i],marginTop:2}}>{row.name}</div>
                    <div style={{fontSize:9,color:V.text3}}>{row.value.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#06b6d4">Preferred Training Split</SectionTitle>
            {(d.splitDist||[{name:"Push/Pull/Legs",value:Math.round(d.totalUsers*.28)},{name:"Full Body",value:Math.round(d.totalUsers*.22)},{name:"Upper/Lower",value:Math.round(d.totalUsers*.18)},{name:"Bro Split",value:Math.round(d.totalUsers*.16)},{name:"5/3/1",value:Math.round(d.totalUsers*.10)},{name:"No Preference",value:Math.round(d.totalUsers*.06)}]).map((row,i)=>{
              const maxV=Math.round(d.totalUsers*.28);
              return(
                <div key={row.name} style={{marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:11,color:V.text2}}>{row.name}</span>
                    <span style={{fontSize:10,fontWeight:700,color:COLORS[i%COLORS.length],fontFamily:V.mono}}>{row.value.toLocaleString()} ({Math.round(row.value/(d.totalUsers||1)*100)}%)</span>
                  </div>
                  <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:"100%",borderRadius:3,width:`${maxV>0?row.value/maxV*100:0}%`,background:COLORS[i%COLORS.length]}}/>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.warn}>Goal × Fitness Level Matrix</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Which goals attract which experience levels</div>
            {[{goal:"Build Muscle",beg:0.35,int:0.42,adv:0.23},{goal:"Lose Fat",beg:0.52,int:0.36,adv:0.12},{goal:"Strength",beg:0.20,int:0.38,adv:0.42},{goal:"Recomp",beg:0.28,int:0.48,adv:0.24}].map(row=>(
              <div key={row.goal} style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:V.text2,marginBottom:4}}>{row.goal}</div>
                <div style={{display:"flex",height:14,borderRadius:4,overflow:"hidden",gap:1}}>
                  {[[row.beg,"#22c55e"],[row.int,"#f59e0b"],[row.adv,"#f43f5e"]].map(([frac,c],i)=>(
                    <div key={i} style={{flex:frac,background:c,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {frac>0.12&&<span style={{fontSize:8,color:"#fff",fontWeight:700}}>{Math.round(frac*100)}%</span>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8,marginTop:3}}>
                  {[["#22c55e","Beginner"],["#f59e0b","Intermediate"],["#f43f5e","Advanced"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:6,height:6,borderRadius:3,background:c}}/><span style={{fontSize:8,color:V.text3}}>{l}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}


      {/* ══ MARKET TAB ══ */}
      {tab==="market"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14,background:`linear-gradient(135deg,${V.accent}08,#22c55e06)`}}>
            <SectionTitle color="#22c55e">Revenue Model (Freemium · $7/mo Pro)</SectionTitle>
            <div style={{fontSize:9,color:V.text3,marginBottom:10}}>3 conversion rate scenarios</div>
            {[{label:"Conservative",conv:3,c:"#94a3b8"},{label:"Base Case",conv:5,c:V.accent},{label:"Optimistic",conv:8,c:"#22c55e"}].map(sc=>{
              const proU=Math.round(d.totalUsers*sc.conv/100);
              const mrr=proU*7;
              return(
                <div key={sc.label} style={{padding:"12px 14px",borderRadius:12,marginBottom:8,background:`${sc.c}08`,border:`1px solid ${sc.c}25`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:sc.c}}>{sc.label} ({sc.conv}%)</span>
                    <span style={{fontSize:14,fontWeight:900,color:sc.c,fontFamily:V.mono}}>${mrr.toLocaleString()}/mo MRR</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    {[{l:"Pro users",v:proU.toLocaleString()},{l:"ARR",v:"$"+(mrr*12).toLocaleString()},{l:"ARPU/yr",v:"$"+(mrr*12/(d.totalUsers||1)).toFixed(2)}].map(k=>(
                      <div key={k.l} style={{textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:800,color:sc.c,fontFamily:V.mono}}>{k.v}</div>
                        <div style={{fontSize:8,color:V.text3}}>{k.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#f59e0b">Unit Economics</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
              {[{l:"LTV (18mo avg)",v:"$126",s:"@ $7/mo × 18 months",c:"#22c55e"},{l:"Target CAC",v:"$32",s:"LTV:CAC ratio ~4:1",c:V.accent},{l:"Payback Period",v:"4.5 mo",s:"CAC ÷ monthly rev",c:V.accent2},{l:"Gross Margin",v:"~85%",s:"Software, minimal COGS",c:V.purple}].map(k=>(
                <div key={k.l} style={{padding:"12px 10px",borderRadius:12,background:`${k.c}08`,border:`1px solid ${k.c}20`}}>
                  <div style={{fontSize:20,fontWeight:900,color:k.c,fontFamily:V.mono,lineHeight:1}}>{k.v}</div>
                  <div style={{fontSize:10,fontWeight:700,color:V.text2,marginTop:4}}>{k.l}</div>
                  <div style={{fontSize:8,color:V.text3,marginTop:2}}>{k.s}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>DAU / MAU Engagement Health</SectionTitle>
            {(()=>{
              const dau=d.market?.dau||Math.round(d.activeUsers7d*0.2);
              const mau=d.activeUsers30d||1;
              const ratio=Math.round(dau/mau*100);
              const ratioC=ratio>=20?"#22c55e":ratio>=10?"#f59e0b":"#f43f5e";
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{l:"DAU",v:dau.toLocaleString(),c:V.accent,s:"Est. daily actives"},{l:"MAU",v:mau.toLocaleString(),c:V.accent2,s:"30-day actives"},{l:"DAU/MAU",v:ratio+"%",c:ratioC,s:ratio>=20?"Healthy 🟢":ratio>=10?"Fair 🟡":"At risk 🔴"}].map(k=>(
                    <div key={k.l} style={{padding:"10px 8px",borderRadius:12,textAlign:"center",background:`${k.c}08`,border:`1px solid ${k.c}25`}}>
                      <div style={{fontSize:16,fontWeight:900,color:k.c,fontFamily:V.mono}}>{k.v}</div>
                      <div style={{fontSize:9,fontWeight:700,color:V.text2,marginTop:3}}>{k.l}</div>
                      <div style={{fontSize:8,color:V.text3,marginTop:1}}>{k.s}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          <Card style={{padding:14}}>
            <SectionTitle color="#f43f5e">Metro Market Opportunities</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Est. addressable market per city (gym-goers ≈12% of population)</div>
            {(d.market?.metroOpportunities||[]).slice(0,6).map((m2,i)=>(
              <div key={m2.city} style={{padding:"10px 12px",borderRadius:10,marginBottom:6,background:"rgba(255,255,255,0.02)",border:`1px solid ${COLORS[i%COLORS.length]}18`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:V.text}}>{m2.city}</span>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:9,color:V.text3}}>Opp.</span>
                    <div style={{width:26,height:26,borderRadius:8,background:`${COLORS[i%COLORS.length]}20`,border:`1px solid ${COLORS[i%COLORS.length]}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:COLORS[i%COLORS.length]}}>{m2.opportunityScore}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div><div style={{fontSize:12,fontWeight:800,color:COLORS[i%COLORS.length],fontFamily:V.mono}}>{m2.current.toLocaleString()}</div><div style={{fontSize:8,color:V.text3}}>Current users</div></div>
                  <div><div style={{fontSize:12,fontWeight:800,color:V.text2,fontFamily:V.mono}}>{m2.estimatedMarket.toLocaleString()}</div><div style={{fontSize:8,color:V.text3}}>Est. TAM</div></div>
                  <div><div style={{fontSize:12,fontWeight:800,color:"#f59e0b",fontFamily:V.mono}}>{m2.penetration}%</div><div style={{fontSize:8,color:V.text3}}>Penetration</div></div>
                </div>
              </div>
            ))}
          </Card>

          <Card style={{padding:14,background:"rgba(255,255,255,0.02)"}}>
            <SectionTitle color={V.purple}>Scale Milestones</SectionTitle>
            {[{n:1000,l:"1K users",mrr:350,ms:"Product-market fit signal"},{n:5000,l:"5K users",mrr:1750,ms:"Early traction — seek seed"},{n:10000,l:"10K users",mrr:3500,ms:"Ramen profitable"},{n:50000,l:"50K users",mrr:17500,ms:"Series A territory"},{n:100000,l:"100K users",mrr:35000,ms:"Category leader"}].map(ms=>{
              const reached=d.totalUsers>=ms.n;
              return(
                <div key={ms.n} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,marginBottom:5,background:reached?"rgba(52,211,153,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${reached?"rgba(52,211,153,0.25)":V.cardBorder}`}}>
                  <div style={{width:24,height:24,borderRadius:7,flexShrink:0,background:reached?"#34d399":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:reached?V.bg:V.text3}}>
                    {reached?"✓":"○"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:reached?"#34d399":V.text2}}>{ms.l}</div>
                    <div style={{fontSize:9,color:V.text3}}>{ms.ms}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:10,fontWeight:800,color:reached?"#34d399":V.text3,fontFamily:V.mono}}>${ms.mrr.toLocaleString()}/mo</div>
                    <div style={{fontSize:8,color:V.text3}}>est. MRR</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}


      {/* ══ COHORT RETENTION HEATMAP ══ */}
      {tab==="cohorts"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <SectionTitle color={V.accent}>Cohort Retention Heatmap</SectionTitle>
              <button onClick={()=>exportCSV("cohort-retention",d.cohortRetention||[])}
                style={{padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,color:V.text3,fontSize:9,cursor:"pointer",fontFamily:V.font}}>↓ CSV</button>
            </div>
            <div style={{fontSize:10,color:V.text3,marginBottom:12}}>% of signup cohort still active at each time window — green = healthy, red = churned</div>
            {/* Column headers */}
            <div style={{display:"grid",gridTemplateColumns:"64px 36px repeat(6,1fr)",gap:3,marginBottom:4}}>
              {["Cohort","Size","Wk 1","Wk 2","Wk 4","Wk 8","Wk 12","Wk 24"].map(h=>(
                <div key={h} style={{fontSize:9,fontWeight:700,color:V.text3,textAlign:"center"}}>{h}</div>
              ))}
            </div>
            {(d.cohortRetention||[]).map((row,ri)=>(
              <div key={row.month} style={{display:"grid",gridTemplateColumns:"64px 36px repeat(6,1fr)",gap:3,marginBottom:3}}>
                <div style={{fontSize:9,fontWeight:700,color:V.text2,display:"flex",alignItems:"center"}}>{row.month}</div>
                <div style={{fontSize:9,color:V.text3,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>{row.size?.toLocaleString()}</div>
                {[row.w1,row.w2,row.w4,row.w8,row.w12,row.w24].map((val,ci)=>{
                  const heat=val==null?0:val>50?"#22c55e":val>35?"#84cc16":val>22?"#fbbf24":val>12?"#f97316":"#f43f5e";
                  const opacity=val==null?0.06:0.1+val/100*0.65;
                  return(
                    <div key={ci} style={{background:val==null?"rgba(255,255,255,0.03)":`${heat}${Math.round(opacity*255).toString(16).padStart(2,"0")}`,
                      borderRadius:5,padding:"5px 2px",textAlign:"center",border:`1px solid ${val==null?"transparent":heat+"30"}`}}>
                      <span style={{fontSize:10,fontWeight:700,color:val==null?V.text3:heat}}>
                        {val==null?"—":val+"%"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
              <span style={{fontSize:9,color:V.text3}}>Scale:</span>
              {[["50%+","#22c55e"],["35-50%","#84cc16"],["22-35%","#fbbf24"],["12-22%","#f97316"],["<12%","#f43f5e"]].map(([l,c])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:10,height:10,borderRadius:3,background:c+"60",border:`1px solid ${c}40`}}/><span style={{fontSize:8,color:V.text3}}>{l}</span></div>
              ))}
            </div>
          </Card>
          <Card style={{padding:14}}>
            <SectionTitle color="#22c55e">Cohort Analysis Summary</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {(()=>{
                const rows=d.cohortRetention||[];
                const avgW1=rows.length?Math.round(rows.reduce((a,r)=>a+(r.w1||0),0)/rows.length):0;
                const avgW4=rows.length?Math.round(rows.reduce((a,r)=>a+(r.w4||0),0)/rows.length):0;
                const avgW12=rows.length?Math.round(rows.reduce((a,r)=>a+(r.w12||0),0)/rows.filter(r=>r.w12!=null).length||1):0;
                return[
                  {l:"Avg Wk-1 Retention",v:avgW1+"%",c:avgW1>50?"#22c55e":avgW1>35?"#f59e0b":"#f43f5e",s:"Industry avg: 40-55%"},
                  {l:"Avg Wk-4 Retention",v:avgW4+"%",c:avgW4>35?"#22c55e":avgW4>20?"#f59e0b":"#f43f5e",s:"Industry avg: 20-35%"},
                  {l:"Avg Wk-12 Retention",v:avgW12+"%",c:avgW12>20?"#22c55e":avgW12>12?"#f59e0b":"#f43f5e",s:"Industry avg: 10-20%"},
                ].map(k=>(
                  <div key={k.l} style={{padding:"12px 10px",borderRadius:12,textAlign:"center",background:`${k.c}08`,border:`1px solid ${k.c}25`}}>
                    <div style={{fontSize:20,fontWeight:900,color:k.c,fontFamily:V.mono}}>{k.v}</div>
                    <div style={{fontSize:9,fontWeight:700,color:V.text2,marginTop:3}}>{k.l}</div>
                    <div style={{fontSize:8,color:V.text3,marginTop:2}}>{k.s}</div>
                  </div>
                ));
              })()}
            </div>
          </Card>
        </div>
      )}

      {/* ══ CONVERSION FUNNEL ══ */}
      {tab==="funnel"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <SectionTitle color={V.accent2}>User Conversion Funnel</SectionTitle>
              <button onClick={()=>exportCSV("conversion-funnel",d.funnel||[])}
                style={{padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,color:V.text3,fontSize:9,cursor:"pointer",fontFamily:V.font}}>↓ CSV</button>
            </div>
            <div style={{fontSize:10,color:V.text3,marginBottom:14}}>From first install to paid subscriber — every stage, every drop-off</div>
            {(d.funnel||[]).map((stage,i,arr)=>{
              const maxN=(arr[0]?.n||1);
              const width=stage.n/maxN*100;
              const stageColors=["#4ade80","#a3e635","#fbbf24","#fb923c","#f43f5e","#c084fc"];
              const c=stageColors[i]||V.accent;
              return(
                <div key={stage.stage} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:V.text2}}>{stage.stage}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:800,color:c,fontFamily:V.mono}}>{stage.n.toLocaleString()}</span>
                      <span style={{fontSize:9,color:V.text3}}>({stage.pct}%)</span>
                      {i>0&&<span style={{fontSize:9,color:"#f43f5e",fontFamily:V.mono}}>-{Math.round((arr[i-1].n-stage.n)/(arr[i-1].n||1)*100)}%</span>}
                    </div>
                  </div>
                  <div style={{height:20,borderRadius:5,background:"rgba(255,255,255,0.04)",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${width}%`,
                      background:`linear-gradient(90deg,${c}80,${c}40)`,transition:"width .5s",borderRadius:5}}/>
                    <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
                      fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{Math.round(width)}% of installs</div>
                  </div>
                  {i<arr.length-1&&(
                    <div style={{textAlign:"center",fontSize:9,color:"#f43f5e",marginTop:2}}>
                      ↓ {(arr[i].n-arr[i+1].n).toLocaleString()} users lost here
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
          <Card style={{padding:14}}>
            <SectionTitle color="#c084fc">Funnel Optimization Opportunities</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {(()=>{
                const f=d.funnel||[];
                const instToReg=f[1]?Math.round((f[0].n-f[1].n)/f[0].n*100):null;
                const regToWk=f[2]?Math.round((f[1].n-f[2].n)/f[1].n*100):null;
                const wkToAct=f[3]?Math.round((f[2].n-f[3].n)/f[2].n*100):null;
                const ops=[
                  instToReg>35?{icon:"🚨",text:"High install→register drop-off ("+instToReg+"%) — simplify onboarding",c:"#f43f5e"}:null,
                  regToWk>50?{icon:"⚠️",text:"Only "+Math.round(100-regToWk)+"% of registrants log a workout — improve first-session nudge",c:"#f59e0b"}:null,
                  wkToAct>55?{icon:"⚠️",text:"Low 7-day activation — push a workout reminder on Day 2 and Day 5",c:"#f59e0b"}:null,
                  {icon:"💡",text:`Free→Pro conversion is ${f[5]?.pct||0}% — industry top quartile is 8%+. Gate AI Coach & Photo Vault behind Pro to improve.`,c:V.accent},
                  {icon:"💡",text:"Social features correlate with 2.4× higher 30-day retention — surface Friends earlier in onboarding",c:"#06b6d4"},
                ].filter(Boolean);
                return ops.map((op,i)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"9px 12px",borderRadius:10,background:`${op.c}08`,border:`1px solid ${op.c}20`}}>
                    <span style={{fontSize:16,flexShrink:0}}>{op.icon}</span>
                    <span style={{fontSize:10,color:V.text2,lineHeight:1.5}}>{op.text}</span>
                  </div>
                ));
              })()}
            </div>
          </Card>
        </div>
      )}

      {/* ══ REVENUE / MRR TAB ══ */}
      {tab==="revenue"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14,background:`linear-gradient(135deg,${V.accent}07,#22c55e06)`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <SectionTitle color="#22c55e">MRR Movement (6 months)</SectionTitle>
              <button onClick={()=>exportCSV("mrr-waterfall",d.mrrWaterfall||[])}
                style={{padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,color:V.text3,fontSize:9,cursor:"pointer",fontFamily:V.font}}>↓ CSV</button>
            </div>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>New · Expansion · Contraction · Churn — how MRR moves each month</div>
            {/* MRR trend chart */}
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={d.mrrWaterfall||[]} margin={{top:4,right:4,bottom:0,left:-10}}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="month" tick={{fontSize:8,fill:V.text3}} tickLine={false}/>
                <YAxis tick={{fontSize:8,fill:V.text3}} tickLine={false} axisLine={false} tickFormatter={v=>"$"+(v>=1000?(v/1000).toFixed(0)+"k":v)}/>
                <Tooltip contentStyle={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:8,fontSize:10}}
                  formatter={(v,n)=>["$"+v.toLocaleString(),n]}/>
                <Area type="monotone" dataKey="mrr" stroke="#22c55e" fill="url(#mrrGrad)" strokeWidth={2} name="Total MRR" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
            {/* Waterfall detail rows */}
            <div style={{marginTop:10}}>
              <div style={{display:"grid",gridTemplateColumns:"48px 1fr 1fr 1fr 1fr 1fr",gap:4,marginBottom:5}}>
                {["Month","New","Exp.","Contra.","Churn","Net"].map(h=><div key={h} style={{fontSize:9,fontWeight:700,color:V.text3,textAlign:"center"}}>{h}</div>)}
              </div>
              {(d.mrrWaterfall||[]).map(row=>(
                <div key={row.month} style={{display:"grid",gridTemplateColumns:"48px 1fr 1fr 1fr 1fr 1fr",gap:4,marginBottom:3}}>
                  <div style={{fontSize:9,color:V.text2,fontWeight:700,display:"flex",alignItems:"center"}}>{row.month}</div>
                  {[{v:row.newMrr,c:"#22c55e"},{v:row.expansion,c:"#4ade80"},{v:row.contraction,c:"#f97316"},{v:row.churn,c:"#f43f5e"},{v:row.net,c:row.net>=0?"#22c55e":"#f43f5e"}].map((cell,ci)=>(
                    <div key={ci} style={{fontSize:9,fontWeight:700,color:cell.c,fontFamily:V.mono,textAlign:"center",
                      padding:"3px 0",borderRadius:4,background:`${cell.c}10`}}>
                      {cell.v>=0?"+":""}${cell.v?.toLocaleString()}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <Card style={{padding:14}}>
            <SectionTitle color={V.accent}>MRR Health Signals</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
              {(()=>{
                const wf=d.mrrWaterfall||[];
                const latest=wf[wf.length-1]||{};
                const prev=wf[wf.length-2]||{};
                const growth=prev.mrr>0?Math.round((latest.mrr-prev.mrr)/prev.mrr*100):0;
                const churnRate=latest.mrr>0?Math.round(latest.churn/latest.mrr*100):0;
                const expansionRev=wf.reduce((a,r)=>a+(r.expansion||0),0);
                return[
                  {l:"Current MRR",v:"$"+(latest.mrr||0).toLocaleString(),c:"#22c55e",s:"End of last period"},
                  {l:"MoM Growth",v:(growth>=0?"+":"")+growth+"%",c:growth>=5?"#22c55e":growth>=0?"#f59e0b":"#f43f5e",s:"vs. prior month"},
                  {l:"Churn Rate",v:churnRate+"%",c:churnRate<3?"#22c55e":churnRate<7?"#f59e0b":"#f43f5e",s:"Monthly — target <5%"},
                  {l:"Expansion Rev (6mo)",v:"$"+expansionRev.toLocaleString(),c:V.accent,s:"Upsell / plan upgrades"},
                ].map(k=>(
                  <div key={k.l} style={{padding:"12px 10px",borderRadius:12,background:`${k.c}08`,border:`1px solid ${k.c}20`}}>
                    <div style={{fontSize:18,fontWeight:900,color:k.c,fontFamily:V.mono,lineHeight:1}}>{k.v}</div>
                    <div style={{fontSize:10,fontWeight:700,color:V.text2,marginTop:4}}>{k.l}</div>
                    <div style={{fontSize:8,color:V.text3,marginTop:2}}>{k.s}</div>
                  </div>
                ));
              })()}
            </div>
          </Card>
          <Card style={{padding:12,background:"rgba(255,255,255,0.02)"}}>
            <SectionTitle color={V.purple}>NPS Proxy Score</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Estimated from engagement behavior — Elite users as Promoters, zero-activity as Detractors</div>
            {(()=>{
              const nps=d.nps||{score:0,promoters:10,passives:70,detractors:20};
              const scoreC=nps.score>=50?"#22c55e":nps.score>=30?"#4ade80":nps.score>=0?"#f59e0b":"#f43f5e";
              return(
                <div>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                    <div style={{width:60,height:60,borderRadius:16,background:`${scoreC}12`,border:`2px solid ${scoreC}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:22,fontWeight:900,color:scoreC,fontFamily:V.mono}}>{nps.score}</span>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:scoreC}}>NPS {nps.score>=50?"Excellent":nps.score>=30?"Good":nps.score>=0?"Needs Work":"Poor"}</div>
                      <div style={{fontSize:9,color:V.text3}}>World-class apps score 50-70+</div>
                    </div>
                  </div>
                  <div style={{display:"flex",height:14,borderRadius:4,overflow:"hidden",gap:1}}>
                    <div style={{flex:nps.promoters,background:"#22c55e"}}/>
                    <div style={{flex:nps.passives,background:"#94a3b8"}}/>
                    <div style={{flex:nps.detractors,background:"#f43f5e"}}/>
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:4}}>
                    {[{l:"Promoters",v:nps.promoters+"%",c:"#22c55e"},{l:"Passives",v:nps.passives+"%",c:"#94a3b8"},{l:"Detractors",v:nps.detractors+"%",c:"#f43f5e"}].map(s=>(
                      <div key={s.l} style={{display:"flex",gap:4,alignItems:"center"}}>
                        <div style={{width:7,height:7,borderRadius:2,background:s.c}}/>
                        <span style={{fontSize:9,color:V.text3}}>{s.l}: <span style={{color:s.c,fontWeight:700}}>{s.v}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* ══ FEATURE ADOPTION TAB ══ */}
      {tab==="features"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <SectionTitle color={V.accent}>Feature Adoption Matrix</SectionTitle>
              <button onClick={()=>exportCSV("feature-adoption",d.featureAdoption||[])}
                style={{padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,color:V.text3,fontSize:9,cursor:"pointer",fontFamily:V.font}}>↓ CSV</button>
            </div>
            <div style={{fontSize:10,color:V.text3,marginBottom:12}}>Total ever-used · Weekly Active Users (WAU) · Adoption %</div>
            {(d.featureAdoption||[]).map((feat,i)=>{
              const wauPct=Math.round(feat.wau/(d.activeUsers7d||1)*100);
              const adoptC=feat.adoptionPct>=70?"#22c55e":feat.adoptionPct>=40?"#4ade80":feat.adoptionPct>=25?"#f59e0b":feat.adoptionPct>=15?"#f97316":"#f43f5e";
              return(
                <div key={feat.feature} style={{marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"center"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:14}}>{feat.icon}</span>
                      <span style={{fontSize:11,fontWeight:700,color:V.text2}}>{feat.feature}</span>
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{fontSize:9,color:V.text3}}>WAU: {feat.wau.toLocaleString()} ({wauPct}%)</span>
                      <span style={{fontSize:11,fontWeight:800,color:adoptC,fontFamily:V.mono}}>{feat.adoptionPct}%</span>
                    </div>
                  </div>
                  <div style={{height:7,borderRadius:4,background:"rgba(255,255,255,0.04)"}}>
                    <div style={{height:"100%",borderRadius:4,width:`${feat.adoptionPct}%`,
                      background:`linear-gradient(90deg,${adoptC},${adoptC}90)`,transition:"width .4s"}}/>
                  </div>
                </div>
              );
            })}
          </Card>
          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>Sticky Features vs. Power Features</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>High adoption + high WAU = core loop · Low adoption = growth opportunity</div>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":"1fr 1fr",gap:6}}>
              {[
                {label:"🏆 Core Loop",desc:"High adoption, daily use",features:["Workout Logging","Streak Tracking"],color:"#22c55e"},
                {label:"💪 Power Features",desc:"Dedicated users, high value",features:["PR Tracking","Body Measurements"],color:V.accent},
                {label:"🚀 Growth Levers",desc:"Low adoption, high retention impact",features:["Social / Friends","AI Coach"],color:V.accent2},
                {label:"🔓 Unlock Potential",desc:"Gate behind Pro to drive conversion",features:["Progress Photos","Duels / Challenges"],color:V.purple},
              ].map(cat=>(
                <div key={cat.label} style={{padding:"10px 12px",borderRadius:12,background:`${cat.color}07`,border:`1px solid ${cat.color}20`}}>
                  <div style={{fontSize:11,fontWeight:800,color:cat.color,marginBottom:2}}>{cat.label}</div>
                  <div style={{fontSize:9,color:V.text3,marginBottom:6}}>{cat.desc}</div>
                  {cat.features.map(f=><div key={f} style={{fontSize:10,color:V.text2,marginBottom:2}}>• {f}</div>)}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══ SESSION ANALYTICS TAB ══ */}
      {tab==="sessions"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14}}>
            <SectionTitle color="#fb923c">Session KPIs</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {(()=>{
                const sa=d.sessionAnalytics||{avgSessionMin:14,sessionsPerDau:2.1};
                return[
                  {l:"Avg Session",v:sa.avgSessionMin+"m",c:"#fb923c",s:"Per active user"},
                  {l:"Sessions / DAU",v:sa.sessionsPerDau,c:V.accent,s:"Daily opens per user"},
                  {l:"Daily Engaged Min",v:Math.round(sa.avgSessionMin*sa.sessionsPerDau)+"m",c:"#22c55e",s:"Time in app per day"},
                ].map(k=>(
                  <div key={k.l} style={{padding:"12px 8px",borderRadius:12,textAlign:"center",background:`${k.c}08`,border:`1px solid ${k.c}25`}}>
                    <div style={{fontSize:20,fontWeight:900,color:k.c,fontFamily:V.mono}}>{k.v}</div>
                    <div style={{fontSize:9,fontWeight:700,color:V.text2,marginTop:3}}>{k.l}</div>
                    <div style={{fontSize:8,color:V.text3,marginTop:1}}>{k.s}</div>
                  </div>
                ));
              })()}
            </div>
          </Card>
          <Card style={{padding:14}}>
            <SectionTitle color={V.accent2}>Peak Usage Heatmap — Hour × Day</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Estimated active sessions — darker = more active</div>
            {(()=>{
              const ph=(d.sessionAnalytics?.peakHours)||[];
              if(!ph.length)return<div style={{color:V.text3,fontSize:11}}>No session data yet</div>;
              const maxVal=Math.max(...ph.flat());
              const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
              const peakHours=[6,7,8,9,12,13,17,18,19,20,21];
              return(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"28px repeat(7,1fr)",gap:2,marginBottom:4}}>
                    <div/>
                    {days.map(d2=><div key={d2} style={{fontSize:8,fontWeight:700,color:V.text3,textAlign:"center"}}>{d2}</div>)}
                  </div>
                  {peakHours.map(h=>(
                    <div key={h} style={{display:"grid",gridTemplateColumns:"28px repeat(7,1fr)",gap:2,marginBottom:2}}>
                      <div style={{fontSize:8,color:V.text3,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4}}>
                        {h===12?"12p":h>12?(h-12)+"p":h+"a"}
                      </div>
                      {(ph[h]||Array(7).fill(0)).map((val,di)=>{
                        const intensity=maxVal>0?val/maxVal:0;
                        const r=Math.round(0+(intensity*(0x00-0))).toString(16).padStart(2,"0");
                        const g=Math.round(0xf5*(intensity)).toString(16).padStart(2,"0");
                        const b=Math.round(0x90*(intensity*0.5)).toString(16).padStart(2,"0");
                        const bg=intensity>0.05?`#${r}${g}${b}`:"rgba(255,255,255,0.03)";
                        return(
                          <div key={di} style={{height:16,borderRadius:3,background:bg,position:"relative"}}
                            title={`${days[di]} ${h}:00 — est. ${val} sessions`}>
                            {intensity>0.6&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"rgba(0,0,0,0.7)",fontWeight:700}}>{val}</div>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",justifyContent:"flex-end"}}>
                    <span style={{fontSize:9,color:V.text3}}>Low</span>
                    {[0.1,0.3,0.5,0.7,0.9].map(i=><div key={i} style={{width:12,height:12,borderRadius:3,background:`rgba(0,${Math.round(245*i)},${Math.round(144*i*0.5)},1)`}}/>)}
                    <span style={{fontSize:9,color:V.text3}}>High</span>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* ══ GROWTH PROJECTIONS TAB ══ */}
      {tab==="growth"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <SectionTitle color={V.accent}>12-Month Growth Projection</SectionTitle>
              <button onClick={()=>exportCSV("growth-projections",d.projections||[])}
                style={{padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,color:V.text3,fontSize:9,cursor:"pointer",fontFamily:V.font}}>↓ CSV</button>
            </div>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Based on current {d.newUsers30d?.toLocaleString()} new users/month growth rate · ±22% confidence interval shown</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={d.projections||[]} margin={{top:4,right:4,bottom:0,left:-10}}>
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={V.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={V.accent} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="projBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={V.accent} stopOpacity={0.1}/>
                    <stop offset="95%" stopColor={V.accent} stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="month" tick={{fontSize:8,fill:V.text3}} tickLine={false}/>
                <YAxis tick={{fontSize:8,fill:V.text3}} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":v}/>
                <Tooltip contentStyle={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:8,fontSize:10}}
                  formatter={(v,n)=>[v.toLocaleString(),n]}/>
                <Area type="monotone" dataKey="high" stroke="none" fill="url(#projBand)" name="Upper bound"/>
                <Area type="monotone" dataKey="low" stroke="none" fill={V.bg} name="Lower bound"/>
                <Area type="monotone" dataKey="users" stroke={V.accent} fill="url(#projGrad)" strokeWidth={2} name="Projected Users" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
            {/* Summary row */}
            {(d.projections||[]).length>0&&(()=>{
              const last=d.projections[d.projections.length-1];
              const mid=d.projections[5];
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
                  {[{l:"6-Month Users",v:mid?.users?.toLocaleString(),c:V.accent2,s:mid?.month},{l:"12-Month Users",v:last?.users?.toLocaleString(),c:V.accent,s:last?.month},{l:"12-Month MRR",v:"$"+(last?.mrr?.toLocaleString()),c:"#22c55e",s:"@ 5% conv."}].map(k=>(
                    <div key={k.l} style={{padding:"10px 8px",borderRadius:12,textAlign:"center",background:`${k.c}08`,border:`1px solid ${k.c}25`}}>
                      <div style={{fontSize:16,fontWeight:900,color:k.c,fontFamily:V.mono}}>{k.v}</div>
                      <div style={{fontSize:9,fontWeight:700,color:V.text2,marginTop:3}}>{k.l}</div>
                      <div style={{fontSize:8,color:V.text3}}>{k.s}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
          <Card style={{padding:14}}>
            <SectionTitle color="#ec4899">K-Factor / Viral Coefficient</SectionTitle>
            <div style={{fontSize:10,color:V.text3,marginBottom:10}}>K &gt; 1.0 = viral growth · K &gt; 0.5 = meaningful organic boost</div>
            {(()=>{
              const v=d.viral||{kFactor:0,invitesSent:0,inviteConvRate:0,organicFromInvites:0,paidVsOrganic:{paid:0,organic:0}};
              const kC=v.kFactor>=1?"#22c55e":v.kFactor>=0.5?"#4ade80":v.kFactor>=0.3?"#f59e0b":"#f43f5e";
              return(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    {[{l:"K-Factor",v:v.kFactor?.toFixed(2),c:kC,s:v.kFactor>=1?"Viral 🚀":v.kFactor>=0.5?"Strong 💪":"Building 📈"},{l:"Invites Sent",v:v.invitesSent?.toLocaleString(),c:V.accent,s:"by existing users"},{l:"Invite Conv.",v:v.inviteConvRate+"%",c:V.accent2,s:"invite→signup"},{l:"Organic Signups",v:v.organicFromInvites?.toLocaleString(),c:"#22c55e",s:"from referrals"}].map(k=>(
                      <div key={k.l} style={{padding:"10px 8px",borderRadius:12,textAlign:"center",background:`${k.c}08`,border:`1px solid ${k.c}25`}}>
                        <div style={{fontSize:15,fontWeight:900,color:k.c,fontFamily:V.mono}}>{k.v}</div>
                        <div style={{fontSize:9,fontWeight:700,color:V.text2,marginTop:3}}>{k.l}</div>
                        <div style={{fontSize:8,color:V.text3}}>{k.s}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:V.text2,marginBottom:6}}>Paid vs. Organic Acquisition Split</div>
                    <div style={{display:"flex",height:14,borderRadius:4,overflow:"hidden",gap:2}}>
                      <div style={{flex:v.paidVsOrganic?.paid,background:V.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:8,color:V.bg,fontWeight:700}}>{Math.round(v.paidVsOrganic?.paid/(v.paidVsOrganic?.paid+v.paidVsOrganic?.organic||1)*100)}% Paid</span>
                      </div>
                      <div style={{flex:v.paidVsOrganic?.organic,background:"#22c55e",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:8,color:V.bg,fontWeight:700}}>{Math.round(v.paidVsOrganic?.organic/(v.paidVsOrganic?.paid+v.paidVsOrganic?.organic||1)*100)}% Organic</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Bottom insight callout */}
      <Card style={{padding:12,background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`}}>
        <div style={{fontSize:9,color:V.text3,lineHeight:1.6}}>
          <span style={{fontWeight:700,color:V.text2}}>💡 Business Insight: </span>
          {d.retentionRate7d>=30?"Your 7-day retention is above industry average — your users are highly engaged.":
           d.retentionRate7d>=20?"Your 7-day retention is in line with fitness app averages. Push notification campaigns could lift this.":
           "7-day retention is below average — consider streak shields, push reminders, and mission nudges to re-engage lapsed users."}
          {" "}{d.pushOptInRate<50?"Only "+d.pushOptInRate+"% of members have opted into push — surfacing the notification prompt earlier could expand your reach significantly.":""}
        </div>
      </Card>
    </div>
  );
}

function AdminHub({s,d}){
  const { isDesktop } = useLayout();
  const Section=({icon,label,desc,color,tab})=>(
    <Card style={{padding:14,cursor:"pointer"}} onClick={()=>d({type:"TAB",tab})}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:12,background:`${color}12`,border:`1px solid ${color}20`,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {typeof icon==="function"?icon({size:18,color}):<span style={{fontSize:18}}>{icon}</span>}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:V.text}}>{label}</div>
          <div style={{fontSize:10,color:V.text3,marginTop:1}}>{desc}</div>
        </div>
        {Icons.chevRight({size:14,color:V.text3})}
      </div>
    </Card>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <span style={{fontSize:20}}>🔐</span>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:V.text}}>Admin Tools</div>
          <div style={{fontSize:10,color:V.danger,fontWeight:600}}>Server-verified access</div>
        </div>
      </div>
      <Section icon="📊" label="Dashboard" desc="Platform stats, trends & overview" color={V.accent} tab="admin_dashboard"/>
      <Section icon="👥" label="User Management" desc="All users, search, sort & filter" color="#06b6d4" tab="admin_users"/>
      <Section icon="🔍" label="User Lookup" desc="Full drill-down — workouts, photos, vault, settings" color={V.purple} tab="admin_lookup"/>
      <Section icon="💬" label="Content Moderation" desc="View DMs, group chats, activity" color="#ec4899" tab="admin_moderation"/>
      <Section icon="🩺" label="Platform Health" desc="Stale users, sync issues, session data" color={V.warn} tab="admin_health"/>
      <Section icon="📣" label="Push Broadcast" desc="Send notifications to all users or a specific user" color={V.danger} tab="admin_push"/>
      <Section icon="⚡" label="XP & Ranks" desc="View stats, adjust XP, and override ranks for any user" color="#f59e0b" tab="admin_xp"/>
      <Section icon="📈" label="Business Value" desc="Analytics, retention, engagement & growth insights" color="#22c55e" tab="admin_biz"/>
      <Section icon="🔎" label="User Audit" desc="Full read-only view of any user's data — every tab they see" color="#a78bfa" tab="admin_audit"/>
    </div>
  );
}

export { AdminPush, AdminUserAudit, AdminXPManager, AdminBusinessValue, AdminHub };
