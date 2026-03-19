import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { V, Haptic, setTheme, DARK_THEME, LIGHT_THEME } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Stat, Progress, ConfirmCtrl, SuccessToastCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, wUnit, toKg, toLbs } from '../utils/helpers';
import { CloudSync, SocialAPI, SYNC_URL, APP_VERSION, SW_VERSION, ReconcileAPI } from '../utils/sync';
import { SessionManager } from '../utils/auth';
import { SentryUtil } from '../utils/sentry';
import { defaultExercises } from '../data/exercises';
import { defaultSchedule } from '../state/reducer';
import { genDemo } from '../data/demo';
import { BADGE_DEFS, calcEarnedBadges } from '../data/badges';

export function SystemHealthPanel({s}) {
  const [reconcile, setReconcile] = useState(() => ReconcileAPI.last());
  const [running, setRunning]     = useState(false);
  const [pending, setPending]     = useState(() => parseInt(LS.get('ft-pending-sync')) || 0);
  const [pushOk, setPushOk]       = useState(null); // null = checking
  const [swVer, setSwVer]         = useState(null);
  const [storageInfo, setStorageInfo] = useState({ used: 0, quota: 0, pct: 0 });

  // Live pending-queue updates
  useEffect(() => {
    const iv = setInterval(() => setPending(parseInt(LS.get('ft-pending-sync')) || 0), 3000);
    return () => clearInterval(iv);
  }, []);

  // SW version + push subscription status on mount
  useEffect(() => {
    (async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations();
        const reg = regs?.[0];
        if (reg) {
          // SW version is embedded as a query param on the SW script URL
          const url = reg.active?.scriptURL || '';
          const match = url.match(/sw\.js/);
          setSwVer(match ? SW_VERSION : 'unknown');
          const sub = await reg.pushManager?.getSubscription();
          setPushOk(!!sub);
        } else {
          setSwVer('not registered');
          setPushOk(false);
        }
      } catch(e) {
        setSwVer('unavailable');
        setPushOk(null);
      }
    })();
  }, []);

  // Storage quota via StorageManager API with localStorage fallback
  useEffect(() => {
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const { usage, quota } = await navigator.storage.estimate();
          setStorageInfo({
            used: usage,
            quota,
            pct: quota > 0 ? Math.round((usage / quota) * 100) : 0,
            source: 'quota',
          });
        } else {
          // Fallback: measure ft- keys in localStorage
          let bytes = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith('ft-')) bytes += (localStorage.getItem(k)?.length || 0) * 2;
          }
          setStorageInfo({ used: bytes, quota: 5 * 1024 * 1024, pct: Math.min(100, Math.round((bytes / (5 * 1024 * 1024)) * 100)), source: 'ls' });
        }
      } catch(e) { /* ignore */ }
    })();
  }, []);

  const runCheck = async () => {
    if (running) return;
    setRunning(true);
    const result = await ReconcileAPI.run(s);
    setReconcile(result);
    setRunning(false);
  };

  const lastSync = LS.get('ft-last-sync');
  const email    = s.profile?.email;

  const fmtAgo = (iso) => {
    if (!iso) return 'Never';
    const sec = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (sec < 60)    return 'Just now';
    if (sec < 3600)  return `${Math.floor(sec/60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
    return `${Math.floor(sec/86400)}d ago`;
  };

  const fmtBytes = (n) => {
    if (!n) return '0 B';
    if (n < 1024)        return `${n} B`;
    if (n < 1024*1024)   return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1024/1024).toFixed(2)} MB`;
  };

  // ── sub-components ──
  const HealthRow = ({ label, value, status, sub }) => {
    const dot = status === 'ok' ? V.accent : status === 'warn' ? V.warn : status === 'error' ? V.danger : 'rgba(255,255,255,0.2)';
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 0', borderBottom:`1px solid rgba(255,255,255,0.03)` }}>
        <div>
          <div style={{ fontSize:12, color:V.text, fontWeight:600 }}>{label}</div>
          {sub && <div style={{ fontSize:10, color:V.text3, marginTop:1 }}>{sub}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:V.text2, fontFamily:V.mono, textAlign:'right' }}>{value}</span>
          <div style={{ width:7, height:7, borderRadius:4, background:dot, flexShrink:0 }}/>
        </div>
      </div>
    );
  };

  const DomainRow = ({ label, result }) => {
    if (!result) return null;
    const { client, server, match, delta, status } = result;
    const s_icon = status === 'ok' ? '✓' : status === 'mismatch' ? '!' : status === 'error' ? '✕' : '?';
    const s_color = status === 'ok' ? V.accent : status === 'mismatch' ? V.warn : status === 'error' ? V.danger : V.text3;
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.02)', marginBottom:4 }}>
        <span style={{ fontSize:11, color:V.text2 }}>{label}</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {server !== null && (
            <span style={{ fontSize:10, color:V.text3, fontFamily:V.mono }}>
              {client} local · {server} server
              {!match && delta !== 0 && (
                <span style={{ color:V.warn }}> ({delta > 0 ? '+' : ''}{delta})</span>
              )}
            </span>
          )}
          <span style={{ fontSize:11, fontWeight:700, color:s_color }}>{s_icon}</span>
        </div>
      </div>
    );
  };

  // Reconcile summary
  const recStatus = reconcile?.status;
  const recColor  = recStatus === 'ok' ? V.accent : recStatus === 'mismatch' ? V.warn : recStatus === 'error' ? V.danger : V.text3;
  const recLabel  = recStatus === 'ok' ? 'All domains in sync' : recStatus === 'mismatch' ? 'Count mismatch detected' : recStatus === 'error' ? 'Check failed' : 'Not run yet';

  return (
    <div>
      {/* Core metrics */}
      <div style={{ marginBottom:12 }}>
        <HealthRow
          label="Last sync"
          value={fmtAgo(lastSync)}
          status={!lastSync ? 'none' : (Date.now() - new Date(lastSync)) < 3600000 ? 'ok' : 'warn'}
          sub={lastSync ? new Date(lastSync).toLocaleString() : undefined}
        />
        <HealthRow
          label="Offline queue"
          value={pending === 0 ? 'Empty' : `${pending} item${pending !== 1 ? 's' : ''} pending`}
          status={pending === 0 ? 'ok' : 'warn'}
          sub={pending > 0 ? 'Will sync when connection restores' : undefined}
        />
        <HealthRow
          label="Service Worker"
          value={swVer || '…'}
          status={swVer && swVer !== 'not registered' && swVer !== 'unavailable' ? 'ok' : 'error'}
        />
        <HealthRow
          label="Push notifications"
          value={pushOk === null ? 'Checking…' : pushOk ? 'Active' : 'Not subscribed'}
          status={pushOk === null ? 'none' : pushOk ? 'ok' : 'warn'}
          sub={!pushOk && pushOk !== null ? 'Enable in Reminders settings' : undefined}
        />
        <HealthRow
          label="Storage used"
          value={`${fmtBytes(storageInfo.used)}${storageInfo.quota > 0 ? ` / ${fmtBytes(storageInfo.quota)}` : ''} (${storageInfo.pct}%)`}
          status={storageInfo.pct > 80 ? 'error' : storageInfo.pct > 50 ? 'warn' : 'ok'}
          sub={storageInfo.source === 'ls' ? 'Local storage estimate' : 'Origin storage (IndexedDB + cache + localStorage)'}
        />
        {email && (
          <HealthRow
            label="Account"
            value={email}
            status="ok"
          />
        )}
      </div>

      {/* Reconciliation section */}
      <div style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${V.cardBorder}`,
        borderRadius:12, padding:12, marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:V.text }}>Data Integrity Check</div>
            <div style={{ fontSize:10, color:V.text3 }}>Compares your local records against server</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {reconcile && (
              <div style={{ width:8, height:8, borderRadius:4, background:recColor }}/>
            )}
            <button onClick={runCheck} disabled={running || !email}
              style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:email ? 'pointer' : 'not-allowed',
                background: running ? 'rgba(255,255,255,0.04)' : `${V.accent}15`,
                color: running ? V.text3 : V.accent, fontSize:11, fontWeight:700, fontFamily:V.font,
                WebkitTapHighlightColor:'transparent' }}>
              {running ? '…Checking' : 'Run Check'}
            </button>
          </div>
        </div>

        {reconcile ? (
          <>
            <div style={{ fontSize:11, fontWeight:600, color:recColor, marginBottom:6 }}>{recLabel}</div>
            {reconcile.domains && Object.entries({
              workouts: 'Workouts',
              nutrition: 'Nutrition',
              body: 'Body Metrics',
              photos: 'Photos',
            }).map(([key, label]) => (
              <DomainRow key={key} label={label} result={reconcile.domains[key]} />
            ))}
            <div style={{ fontSize:9, color:V.text3, marginTop:6 }}>
              Last checked {fmtAgo(reconcile.ran_at)}
              {reconcile.status === 'mismatch' && (
                <span style={{ color:V.warn }}> · Push a sync to resolve differences</span>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize:11, color:V.text3 }}>
            {email ? 'Tap Run Check to compare your local data with the server.' : 'Sign in to run integrity checks.'}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        {[['ok', V.accent, 'Good'], ['warn', V.warn, 'Attention'], ['error', V.danger, 'Action needed']].map(([, color, label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:6, height:6, borderRadius:3, background:color }}/>
            <span style={{ fontSize:10, color:V.text3 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  SETTINGS TAB (More)
// ═══════════════════════════════════════
export function SettingsTab({s,d,isAdmin}){
  const [goals,setGoals]=useState(s.goals);
  const [saved,setSaved]=useState(false);
  const [newEx,setNewEx]=useState("");
  const [newCat,setNewCat]=useState("Chest");
  const [newYt,setNewYt]=useState("");
  const [exLibFilter,setExLibFilter]=useState(null);
  const [confirmClear,setConfirmClear]=useState(false);
  const [open,setOpen]=useState(null);
  const [legalView,setLegalView]=useState(null);
  const [advancedMode,setAdvancedMode]=useState(()=>LS.get("ft-settings-advanced")===true);
  const toggleAdvanced=()=>{const n=!advancedMode;setAdvancedMode(n);LS.set("ft-settings-advanced",n);if(!n&&["privacy","health"].includes(open))setOpen(null);};

  const saveGoals=()=>{
    d({type:"GOALS",g:{cal:parseInt(goals.cal)||2400,protein:parseInt(goals.protein)||180,carbs:parseInt(goals.carbs)||250,
      fat:parseInt(goals.fat)||70,goalWeight:parseInt(goals.goalWeight)||175,workoutsPerWeek:parseInt(goals.workoutsPerWeek)||5,
      tdee:parseInt(goals.tdee)||0}});
    setSaved(true);setTimeout(()=>setSaved(false),2000);
    SuccessToastCtrl.show("Goals saved");
  };

  const addEx=()=>{
    if(!newEx.trim())return;
    let ytId=newYt.trim();
    // YouTube is optional — parse if provided
    if(ytId&&ytId.includes("youtu")){
      if(ytId.includes("youtube.com/watch")){try{ytId=new URL(ytId).searchParams.get("v")||"";}catch(e){console.warn("Error:",e);}}
      else if(ytId.includes("youtu.be/")){ytId=ytId.split("youtu.be/")[1]?.split(/[?&]/)[0]||"";}
      else if(ytId.includes("youtube.com/shorts/")){ytId=ytId.split("shorts/")[1]?.split(/[?&]/)[0]||"";}
    } else {
      ytId=""; // no video — allowed
    }
    d({type:"ADD_EX",ex:{id:uid(),name:newEx.trim(),cat:newCat,yt:ytId}});
    SuccessToastCtrl.show("Exercise added");
    setNewEx("");setNewYt("");
  };

  const toggle=(id)=>setOpen(o=>o===id?null:id);

  const Row=({id,icon,label,desc,right,children})=>(
    <div style={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:14,overflow:"hidden",marginBottom:8}}>
      <button onClick={()=>toggle(id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",
        width:"100%",background:"none",border:"none",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
        <div style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:V.text}}>{label}</div>
          {desc&&<div style={{fontSize:11,color:V.text3,marginTop:1}}>{desc}</div>}
        </div>
        {right||null}
        <div style={{transition:"transform .2s",transform:open===id?"rotate(90deg)":"none"}}>
          {Icons.chevRight({size:16,color:V.text3})}
        </div>
      </button>
      {open===id&&(
        <div style={{padding:"0 16px 16px",borderTop:`1px solid ${V.cardBorder}`}}>
          <div style={{paddingTop:12}}>{children}</div>
        </div>
      )}
    </div>
  );

  const basicSections=[{id:"goals",l:"Goals"},{id:"profile",l:"Profile"},{id:"backup",l:"Backup"},{id:"data",l:"Data"},{id:"exercise",l:"Exercises"},{id:"reminders",l:"Reminders"},{id:"legal",l:"Legal"}];
  const advancedSections=[{id:"privacy",l:"Privacy & Sync"},{id:"health",l:"System Health"}];
  const visibleSections=advancedMode?[...basicSections,...advancedSections]:basicSections;

  return(
    <div style={{display:"flex",flexDirection:"column",paddingBottom:16}}>
      {/* Header + mode toggle */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontSize:18,fontWeight:800,color:V.text}}>Settings</div>
        <button onClick={toggleAdvanced} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,
          border:`1px solid ${advancedMode?V.accent:V.cardBorder}`,
          background:advancedMode?`${V.accent}10`:"rgba(255,255,255,0.03)",
          cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"all .2s"}}>
          <div style={{width:28,height:16,borderRadius:8,background:advancedMode?V.accent:"rgba(255,255,255,0.12)",
            position:"relative",transition:"background .2s",flexShrink:0}}>
            <div style={{width:12,height:12,borderRadius:6,background:"#fff",position:"absolute",top:2,
              left:advancedMode?14:2,transition:"left .2s"}}/>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:advancedMode?V.accent:V.text3,whiteSpace:"nowrap"}}>
            {advancedMode?"Advanced":"Basic"}
          </span>
        </button>
      </div>
      {advancedMode&&(
        <div style={{fontSize:10,color:V.text3,marginBottom:8,padding:"6px 10px",borderRadius:8,
          background:`${V.warn}08`,border:`1px solid ${V.warn}15`}}>
          ⚙️ Advanced mode — sync controls, system health, and developer tools visible
        </div>
      )}
      {/* Section jump pills */}
      <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:8,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        {visibleSections.map(s2=>(
          <button key={s2.id} onClick={()=>setOpen(o=>o===s2.id?null:s2.id)} style={{padding:"6px 14px",borderRadius:8,whiteSpace:"nowrap",
            border:`1px solid ${open===s2.id?V.accent:V.cardBorder}`,
            background:open===s2.id?V.accent:"rgba(255,255,255,0.03)",
            cursor:"pointer",fontSize:11,fontWeight:700,
            color:open===s2.id?V.bg:V.text2,fontFamily:V.font,flexShrink:0,
            transition:"all .15s",WebkitTapHighlightColor:"transparent"}}>{s2.l}</button>
        ))}
      </div>

      {/* Theme toggle */}
      <div style={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:14,padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.04)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:16}}>{V.mode==="dark"?"🌙":"☀️"}</span>
          </div>
          <div style={{fontSize:14,fontWeight:600,color:V.text}}>Theme</div>
        </div>
        <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,overflow:"hidden"}}>
          {["dark","light"].map(m=>(
            <button key={m} onClick={()=>{setTheme(m);d({type:"TAB",tab:"settings"});}} style={{
              padding:"7px 16px",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",
              background:V.mode===m?V.accent:"transparent",color:V.mode===m?V.bg:V.text3,
              WebkitTapHighlightColor:"transparent",transition:"all .2s"
            }}>{m==="dark"?"Dark":"Light"}</button>
          ))}
        </div>
      </div>

      {/* Units — inline toggle, no expand needed */}
      <div style={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:14,padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.04)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {Icons.scale({size:16,color:V.accent2})}
          </div>
          <div style={{fontSize:14,fontWeight:600,color:V.text}}>Units</div>
        </div>
        <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:10,overflow:"hidden"}}>
          {["lbs","kg"].map(u=>(
            <button key={u} onClick={()=>d({type:"UNITS",u})} style={{
              padding:"7px 16px",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",
              background:s.units===u?V.accent:"transparent",color:s.units===u?V.bg:V.text3,
              WebkitTapHighlightColor:"transparent",transition:"all .2s"
            }}>{u.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Date Range — inline chips, no expand needed */}
      <div style={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:14,padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.04)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {Icons.chart({size:16,color:V.purple})}
          </div>
          <div style={{fontSize:14,fontWeight:600,color:V.text}}>Range</div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {[7,14,30,90].map(n=>(
            <button key={n} onClick={()=>d({type:"RANGE",d:n})} style={{
              padding:"7px 12px",border:"none",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",
              background:s.range===n?`${V.accent}15`:"rgba(255,255,255,0.04)",
              color:s.range===n?V.accent:V.text3,WebkitTapHighlightColor:"transparent"
            }}>{n}d</button>
          ))}
        </div>
      </div>

      {/* Goals — expandable */}
      <Row id="goals" icon={Icons.target({size:16,color:V.warn})} label="Daily Goals"
        desc={`${s.goals.cal} cal · ${s.goals.protein}p · ${s.goals.carbs}c · ${s.goals.fat}f`}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Calories" type="number" value={goals.cal} onChange={v=>setGoals(g=>({...g,cal:v}))} unit="kcal"/>
          <Field label="Protein" type="number" value={goals.protein} onChange={v=>setGoals(g=>({...g,protein:v}))} unit="g"/>
          <Field label="Carbs" type="number" value={goals.carbs} onChange={v=>setGoals(g=>({...g,carbs:v}))} unit="g"/>
          <Field label="Fat" type="number" value={goals.fat} onChange={v=>setGoals(g=>({...g,fat:v}))} unit="g"/>
        </div>
        <Field label="Goal Weight" type="number" value={goals.goalWeight} onChange={v=>setGoals(g=>({...g,goalWeight:v}))} unit={s.units}/>
        <Field label="Workouts Per Week" type="number" value={goals.workoutsPerWeek||5} onChange={v=>setGoals(g=>({...g,workoutsPerWeek:v}))} unit="days" min={1} max={7}/>
        <Field label="TDEE (for deficit/surplus)" type="number" value={goals.tdee||""} onChange={v=>setGoals(g=>({...g,tdee:v}))} unit="kcal" placeholder="Optional"/>
        <Btn full onClick={saveGoals} s={{marginTop:0}}>{Icons.check({size:16,color:V.bg})} {saved?"Saved!":"Save Goals"}</Btn>
      </Row>

      {/* Custom Exercise — expandable */}
      <Row id="exercise" icon={Icons.plus({size:16,color:V.accent})} label="Exercise Library"
        desc={`${s.exercises.length} exercises`}>
        {/* Add new exercise form */}
        <div style={{padding:12,background:"rgba(255,255,255,0.02)",borderRadius:12,border:`1px solid ${V.cardBorder}`,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Add New Exercise</div>
          <Field label="Exercise Name *" value={newEx} onChange={setNewEx} placeholder="e.g. Bulgarian Split Squat"/>
          <div style={{fontSize:10,fontWeight:600,color:V.text3,marginBottom:4}}>Muscle Group *</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            {["Chest","Back","Legs","Shoulders","Arms","Core","Cardio"].map(c=>(
              <Chip key={c} label={c} active={newCat===c} onClick={()=>setNewCat(c)}/>
            ))}
          </div>
          <Field label="YouTube Video URL *" value={newYt} onChange={setNewYt} placeholder="https://youtube.com/watch?v=..."/>
          {newYt&&!newYt.includes("youtu")&&(
            <div style={{fontSize:9,color:V.danger,marginTop:-6,marginBottom:6}}>Please enter a valid YouTube URL</div>
          )}
          <Btn full onClick={addEx} disabled={!newEx.trim()}>
            {Icons.plus({size:14,color:V.bg})} Add Exercise
          </Btn>
          <div style={{fontSize:10,color:V.text3,marginTop:6,textAlign:"center"}}>YouTube video URL is optional but recommended</div>
        </div>
        {/* Exercise library table */}
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:6}}>Current Library</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          {["All","Chest","Back","Legs","Shoulders","Arms","Core","Cardio"].map(c=>(
            <Chip key={c} label={c} active={(exLibFilter||"All")===c} onClick={()=>setExLibFilter(c==="All"?null:c)}/>
          ))}
        </div>
        <div style={{maxHeight:300,overflowY:"auto",WebkitOverflowScrolling:"touch",borderRadius:10,border:`1px solid ${V.cardBorder}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.03)",position:"sticky",top:0}}>
                <th style={{padding:"8px 10px",textAlign:"left",color:V.text3,fontWeight:600,borderBottom:`1px solid ${V.cardBorder}`}}>Exercise</th>
                <th style={{padding:"8px 6px",textAlign:"left",color:V.text3,fontWeight:600,borderBottom:`1px solid ${V.cardBorder}`}}>Group</th>
                <th style={{padding:"8px 6px",textAlign:"center",color:V.text3,fontWeight:600,borderBottom:`1px solid ${V.cardBorder}`}}>Video</th>
              </tr>
            </thead>
            <tbody>
              {s.exercises.filter(e=>!exLibFilter||e.cat===exLibFilter).map(ex=>(
                <tr key={ex.id} style={{borderBottom:`1px solid rgba(255,255,255,0.02)`}}>
                  <td style={{padding:"6px 10px",color:V.text}}>{ex.name}</td>
                  <td style={{padding:"6px",color:V.text3}}>{ex.cat}</td>
                  <td style={{padding:"6px",textAlign:"center"}}>
                    {ex.yt?(
                      <a href={`https://youtube.com/watch?v=${ex.yt}`} target="_blank" rel="noopener"
                        style={{fontSize:10,color:V.accent,textDecoration:"none",fontWeight:600}}>Watch</a>
                    ):(
                      <span style={{fontSize:9,color:V.text3}}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Row>

      {/* Backup — expandable */}
      <Row id="profile" icon={Icons.target({size:16,color:V.purple})} label="Edit Profile"
        desc={s.profile?.firstName?`${s.profile.firstName} ${s.profile.lastName}`:"Not set"}>
        <ProfileEditor s={s} d={d}/>
      </Row>

      <Row id="backup" icon={Icons.refresh({size:16,color:V.accent2})} label="Backup & Restore"
        desc="Export or import your data">
        <DataManager s={s} d={d}/>
      </Row>

      {/* Data management — expandable */}
      <Row id="data" icon={Icons.trash({size:16,color:V.text3})} label="Data Management"
        desc="Storage, export, demo data, and reset">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {/* #35: Storage indicator */}
          {(()=>{
            let totalBytes=0;
            try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith("ft-")){totalBytes+=localStorage.getItem(k).length*2;}}}catch(e){}
            const mb=(totalBytes/1024/1024).toFixed(2);
            const maxMB=5;
            const pct=Math.min(100,Math.round((totalBytes/(maxMB*1024*1024))*100));
            return(
              <Card style={{padding:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:700,color:V.text}}>Local Storage</span>
                  <span style={{fontSize:11,color:pct>80?V.danger:V.text3,fontFamily:V.mono}}>{mb} / {maxMB} MB ({pct}%)</span>
                </div>
                <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)"}}>
                  <div style={{height:"100%",borderRadius:3,background:pct>80?V.danger:pct>50?V.warn:V.accent,width:`${pct}%`,transition:"width .3s"}}/>
                </div>
                {pct>80&&<div style={{fontSize:9,color:V.danger,marginTop:4}}>Storage is getting full. Export your data and consider clearing old photos.</div>}
              </Card>
            );
          })()}
          {/* Export JSON */}
          <Btn v="secondary" full onClick={()=>{
            try{
              const data={};
              ["ft-w","ft-n","ft-b","ft-photos","ft-profile","ft-checkins","ft-ex","ft-g","ft-sched","ft-phases","ft-injuries"].forEach(k=>{const v=LS.get(k);if(v)data[k]=v;});
              data._export={date:new Date().toISOString(),version:APP_VERSION,workouts:s.workouts.length,nutrition:s.nutrition.length,photos:s.photos.length};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
              const url=URL.createObjectURL(blob);
              const a=document.createElement("a");a.href=url;a.download=`ironlog-export-${today()}.json`;a.click();
              URL.revokeObjectURL(url);
              SuccessToastCtrl.show("Data exported");
            }catch(e){SuccessToastCtrl.show("Export failed: "+e.message);}
          }}>{Icons.copy({size:14,color:V.text2})} Export All Data (JSON)</Btn>
          {advancedMode&&(
            <Btn v="secondary" full onClick={()=>{
              const dm=genDemo();
              dm.workouts.forEach(w=>d({type:"ADD_W",w}));
              dm.nutrition.forEach(n=>d({type:"ADD_N",n}));
              dm.body.forEach(b=>d({type:"ADD_B",b}));
              (dm.checkins||[]).forEach(c=>d({type:"ADD_CHECKIN",c}));
              (dm.photos||[]).forEach(photo=>d({type:"ADD_PHOTO",photo}));
              if(dm.phases?.length)d({type:"SET_PHASES",phases:dm.phases});
              if(dm.injuries?.length)d({type:"SET_INJURIES",injuries:dm.injuries});
              if(dm.milestones?.length)d({type:"SET_MILESTONES",milestones:dm.milestones});
              d({type:"SET_PROFILE",profile:{
                firstName:"Alex",lastName:"Ironhart",nickname:"IronAlex",
                currentWeight:182,height:"5'11\"",dob:"1995-06-15",sex:"M",
                fitnessLevel:"advanced",activityLevel:"very_active",
                weeklyAvailability:"5-6",bio:"Powerlifting & aesthetics. 4 years in. 📈",
                username:"ironalex"
              }});
              d({type:"GOALS",g:{cal:2800,protein:180,carbs:300,fat:75,goalWeight:175}});
              LS.set("ft-guide-done",true); // B11 fix: prevent onboarding tour re-triggering after demo load
              SuccessToastCtrl.show("Demo loaded — 365 days of data! Check badges & Iron Score 🏆");
              setOpen(null);
            }}
              s={{borderColor:`${V.warn}30`,color:V.warn}}>
              {Icons.refresh({size:14,color:V.warn})} Load Demo Data
            </Btn>
          )}
          {!confirmClear?(
            <Btn v="secondary" full onClick={()=>setConfirmClear(true)} s={{borderColor:"rgba(255,107,107,0.2)"}}><span style={{color:V.danger}}>Clear All Data</span></Btn>
          ):(
            <div style={{display:"flex",gap:8}}>
              <Btn v="secondary" full onClick={()=>setConfirmClear(false)}>Cancel</Btn>
              <Btn v="secondary" full onClick={()=>{d({type:"CLEAR_ALL"});setConfirmClear(false);}} s={{borderColor:V.danger}}><span style={{color:V.danger}}>Confirm</span></Btn>
            </div>
          )}
        </div>
      </Row>

      {/* Privacy Controls — advanced only */}
      {advancedMode&&<Row id="privacy" icon={Icons.target({size:16,color:V.accent2})} label="Privacy & Sync Controls"
        desc="Choose what syncs to cloud">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{k:"workouts",l:"Workouts"},{k:"nutrition",l:"Nutrition"},{k:"body",l:"Body Metrics"},
            {k:"photos",l:"Photos"},{k:"checkins",l:"Check-ins"},{k:"milestones",l:"Goals"}
          ].map(item=>(
            <div key={item.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0"}}>
              <span style={{fontSize:12,color:V.text}}>{item.l}</span>
              <button onClick={()=>d({type:"SET_SYNC_PREFS",prefs:{[item.k]:!(s.syncPrefs||{})[item.k]}})} style={{
                width:42,height:24,borderRadius:12,border:"none",cursor:"pointer",
                background:(s.syncPrefs||{})[item.k]!==false?V.accent:"rgba(255,255,255,0.1)",
                position:"relative",transition:"background .2s"}}>
                <div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:3,
                  left:(s.syncPrefs||{})[item.k]!==false?21:3,transition:"left .2s"}}/>
              </button>
            </div>
          ))}
          <div style={{padding:"10px 12px",background:"rgba(255,107,107,0.04)",borderRadius:8,border:`1px solid rgba(255,107,107,0.1)`,marginTop:4}}>
            <div style={{fontSize:11,color:V.danger,fontWeight:600,marginBottom:4}}>Delete Cloud Data</div>
            <div style={{fontSize:10,color:V.text3,marginBottom:8}}>This removes all your data from our servers. Local data stays.</div>
            <a href={`mailto:support@ironlog.space?subject=Delete%20Cloud%20Data&body=Please%20delete%20all%20cloud%20data%20for%20${s.profile?.email||"my account"}`}
              style={{fontSize:10,color:V.danger,fontWeight:600,textDecoration:"underline"}}>Request Cloud Deletion</a>
          </div>
        </div>
      </Row>}

      {/* Accessibility */}
      <Row id="a11y" icon={Icons.activity({size:16,color:V.purple})} label="Accessibility"
        desc="Large text, high contrast, reduced motion">
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[{k:"largeText",l:"Large Text Mode",d:"Increases font sizes throughout the app"},
            {k:"highContrast",l:"High Contrast",d:"Stronger text/background contrast"},
            {k:"reduceMotion",l:"Reduce Motion",d:"Disables animations and transitions"}
          ].map(item=>(
            <div key={item.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0"}}>
              <div>
                <div style={{fontSize:12,color:V.text,fontWeight:600}}>{item.l}</div>
                <div style={{fontSize:10,color:V.text3}}>{item.d}</div>
              </div>
              <button onClick={()=>d({type:"SET_A11Y",a11y:{[item.k]:!(s.a11y||{})[item.k]}})} style={{
                width:42,height:24,borderRadius:12,border:"none",cursor:"pointer",
                background:(s.a11y||{})[item.k]?V.accent:"rgba(255,255,255,0.1)",
                position:"relative",transition:"background .2s"}}>
                <div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:3,
                  left:(s.a11y||{})[item.k]?21:3,transition:"left .2s"}}/>
              </button>
            </div>
          ))}
        </div>
      </Row>

      {/* Reminders */}
      <Row id="reminders" icon={Icons.calendar({size:16,color:V.accent})} label="Reminders"
        desc="Notifications for workouts, hydration, check-ins">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn full onClick={async()=>{
            if("Notification" in window){
              const perm=await Notification.requestPermission();
              if(perm==="granted"){
                LS.set("ft-reminders",true);
                LS.set("ft-push-subscribed",false);
                // Trigger Web Push subscription immediately
                if("serviceWorker" in navigator&&"PushManager" in window){
                  try{
                    const reg=await navigator.serviceWorker.ready;
                    let sub=await reg.pushManager.getSubscription();
                    if(!sub){
                      const vapidKey="BMZyIUQO08nuR7afvqNIWBK_ZOcr7PHwT2YwIxTa_ONwAD1YCaJ8Qkb4q4TTYSx_sTN-7-5vCzR8ApNZuyg-Ttc";
                      const padding='='.repeat((4-vapidKey.length%4)%4);
                      const b64=vapidKey.replace(/-/g,'+').replace(/_/g,'/')+padding;
                      const keyBytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
                      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});
                    }
                    const res=await fetch(`${SYNC_URL}/api/push`,{
                      method:"POST",headers:AuthToken.getHeaders(s.profile?.email||""),
                      body:JSON.stringify({action:"subscribe",email:s.profile?.email||"",subscription:sub.toJSON()})
                    });
                    const json=await res.json();
                    if(res.ok){LS.set("ft-push-subscribed",true);SuccessToastCtrl.show("Push notifications active");}
                    else{SuccessToastCtrl.show("Subscribe error: "+(json.error||res.status));}
                  }catch(e){SuccessToastCtrl.show("Push failed: "+e.message);console.error("Push subscribe error:",e);}
                }else{SuccessToastCtrl.show("Notifications enabled (local only)");}
              }else{SuccessToastCtrl.show("Permission denied");}
            }else{SuccessToastCtrl.show("Notifications not supported in this browser");}
          }}>{Icons.activity({size:14,color:V.bg})} Enable Notifications</Btn>
          <div style={{fontSize:10,color:V.text3,lineHeight:1.5}}>
            When enabled, IRONLOG will send reminders on scheduled workout days, daily check-in prompts, and hydration nudges. 
            Notifications work best on Android. iOS PWA notification support is limited.
          </div>
          {LS.get("ft-reminders")&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {Icons.check({size:12,color:V.accent})}
              <span style={{fontSize:11,color:V.accent,fontWeight:600}}>Notifications enabled</span>
            </div>
          )}
        </div>
      </Row>

      {/* System Health — advanced only */}
      {advancedMode&&(
        <Row id="health" icon={<span style={{fontSize:16}}>🛡️</span>} label="System Health"
          desc="Sync status, data integrity, push health, storage">
          <SystemHealthPanel s={s}/>
        </Row>
      )}

      {/* Legal — expandable */}
      <Row id="legal" icon={Icons.chevRight({size:16,color:V.text3})} label="Legal & Privacy"
        desc="Terms, Privacy Policy, Data Rights">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="secondary" full onClick={()=>setLegalView("tos")}>{Icons.chevRight({size:14,color:V.text2})} Terms of Service</Btn>
          <Btn v="secondary" full onClick={()=>setLegalView("privacy")}>{Icons.chevRight({size:14,color:V.text2})} Privacy Policy</Btn>
          <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:10,border:`1px solid ${V.cardBorder}`,marginTop:4}}>
            <div style={{fontSize:12,fontWeight:600,color:V.text,marginBottom:4}}>Your Data Rights</div>
            <div style={{fontSize:11,color:V.text3,lineHeight:1.6}}>
              To request a copy of your data, opt out of data sales, or delete your account, email support@ironlog.space. We will respond within 30 days.
            </div>
          </div>
          <a href="mailto:support@ironlog.space?subject=Do%20Not%20Sell%20My%20Personal%20Information&body=I%20would%20like%20to%20opt%20out%20of%20the%20sale%20of%20my%20personal%20information.%0A%0AEmail%20on%20account%3A%20" 
            style={{display:"block",padding:"14px 16px",background:"rgba(255,107,107,0.06)",borderRadius:10,
              border:"1px solid rgba(255,107,107,0.20)",textDecoration:"none",textAlign:"center",marginTop:4}}>
            <div style={{fontSize:13,fontWeight:700,color:V.danger}}>🚫 Do Not Sell My Personal Information</div>
            <div style={{fontSize:11,color:V.text3,marginTop:3}}>Sends opt-out request to support@ironlog.space</div>
          </a>
        </div>
      </Row>

      {/* Donate */}
      <div style={{marginTop:6,padding:"16px 18px",background:"linear-gradient(135deg,rgba(34,211,238,0.06),rgba(168,85,247,0.06))",
        borderRadius:14,border:`1px solid rgba(34,211,238,0.12)`,textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:700,color:V.text,marginBottom:4}}>IRONLOG is free forever</div>
        <div style={{fontSize:11,color:V.text3,lineHeight:1.5,marginBottom:12}}>
          If you find value in this app, consider donating to support development and keep it ad-free.
        </div>
        <a href="https://www.paypal.com/paypalme/wiseworldir" target="_blank" rel="noopener"
          style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 24px",borderRadius:10,
            background:"linear-gradient(135deg,#0070ba,#003087)",border:"none",textDecoration:"none",
            cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Donate via PayPal</span>
        </a>
        <div style={{fontSize:9,color:V.text3,marginTop:8}}>marketing@wiseworldir.com</div>
      </div>

      {legalView&&(
        <Sheet title={legalView==="tos"?"Terms of Service":"Privacy Policy"} onClose={()=>setLegalView(null)}
          footer={<Btn full onClick={()=>setLegalView(null)}>Close</Btn>}>
          {legalView==="tos"?<TOSContent/>:<PrivacyContent/>}
        </Sheet>
      )}

    </div>
  );
}

// ═══════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════

// ─── Legal Documents ───
const LegalH=({children})=><div style={{fontSize:15,fontWeight:700,color:V.text,marginTop:16,marginBottom:6}}>{children}</div>;
const LegalP=({children})=><div style={{fontSize:12,color:V.text2,lineHeight:1.7,marginBottom:10}}>{children}</div>;
const LegalDate=()=><div style={{fontSize:10,color:V.text3,marginBottom:12}}>Last updated: March 4, 2026 · Version 1.0</div>;

export function TOSContent(){
  return(
    <div>
      <LegalDate/>
      <LegalP>Welcome to IRONLOG. By creating an account and using this application, you agree to the following terms. If you do not agree, do not create an account.</LegalP>

      <LegalH>1. Acceptance of Terms</LegalH>
      <LegalP>By accessing or using IRONLOG ("the App"), you agree to be bound by these Terms of Service ("Terms"). These Terms apply to all users of the App. IRONLOG is developed and operated by Byheir Wise ("we," "us," "our").</LegalP>

      <LegalH>2. Account and Data</LegalH>
      <LegalP>When you create a profile, you provide personal information including your name, email address, date of birth, sex, location, fitness level, and fitness data. You may also provide a profile photo, bio, and social connections. You agree that all information you provide is accurate and current. You are responsible for maintaining the accuracy of your profile.</LegalP>

      <LegalH>3. Data Collection and Usage</LegalH>
      <LegalP>We collect personal and fitness-related data as described in our Privacy Policy. This includes workout logs, nutrition entries, body measurements, progress photos, check-in data (sleep, soreness, energy, mood), social interactions (messages, friend connections, group memberships), readiness scores, and app usage patterns. By using the App, you consent to the collection, storage, processing, and use of your data as outlined in the Privacy Policy.</LegalP>

      <LegalH>4. Social Features and Communications</LegalH>
      <LegalP>The App includes social features such as direct messaging, group chats, friend connections, activity feeds, and profile sharing. Messages you send are stored on our servers and may be visible to recipients, group members, and platform administrators. You agree not to use these features to send harassment, spam, illegal content, or content that violates the rights of others. We reserve the right to review messages for safety and compliance purposes.</LegalP>

      <LegalH>5. AI Coach and Third-Party Services</LegalH>
      <LegalP>The AI Coach feature requires your own API key from Anthropic. Your API key is stored locally on your device and is sent directly from your device to Anthropic's servers — it never passes through IRONLOG servers. Your use of the AI Coach is subject to Anthropic's terms of service. We are not responsible for AI-generated advice and it should not be considered medical or professional guidance.</LegalP>

      <LegalH>6. Progress Photos and Privacy</LegalH>
      <LegalP>Progress photos you upload are stored on our cloud servers (Supabase Storage). Photos marked as "private" or in the Vault are protected by a PIN you set. However, platform administrators may access all photos for safety and moderation purposes. Do not upload inappropriate, illegal, or non-consensual content.</LegalP>

      <LegalH>7. Data Sharing and Sale</LegalH>
      <LegalP>You acknowledge and agree that we may share, license, or sell aggregated and/or de-identified data derived from user information to third parties for commercial purposes. We may also share personally identifiable information with third-party service providers who assist in operating the App. See our Privacy Policy for full details and your opt-out rights.</LegalP>

      <LegalH>8. User Rights</LegalH>
      <LegalP>You have the right to: (a) access your personal data, (b) request correction of inaccurate data, (c) request deletion of your account and associated data, (d) opt out of the sale of your personal information, (e) export your data at any time through Settings, and (f) control what social data is visible to other users via privacy toggles. To exercise any of these rights, contact us at support@ironlog.space.</LegalP>

      <LegalH>9. Intellectual Property</LegalH>
      <LegalP>All content, design, code, and branding in IRONLOG are owned by Byheir Wise. You may not copy, modify, distribute, or reverse-engineer any part of the App without written permission.</LegalP>

      <LegalH>10. Disclaimer</LegalH>
      <LegalP>IRONLOG is a fitness tracking tool, not a medical device. The App does not provide medical advice, including AI-generated coaching suggestions. Consult a healthcare professional before starting any fitness or nutrition program. We are not liable for any injuries, health issues, or damages resulting from use of the App. The App is provided "as is" without warranties of any kind.</LegalP>

      <LegalH>11. Limitation of Liability</LegalH>
      <LegalP>To the maximum extent permitted by law, Byheir Wise shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of the App, including but not limited to loss of data, personal injury, or loss of profits.</LegalP>

      <LegalH>12. Modifications</LegalH>
      <LegalP>We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms. We will notify users of material changes through the App.</LegalP>

      <LegalH>13. Governing Law</LegalH>
      <LegalP>These Terms are governed by the laws of the State of Delaware. Any disputes shall be resolved in the courts of Delaware.</LegalP>

      <LegalH>14. Contact</LegalH>
      <LegalP>For questions about these Terms, contact us at support@ironlog.space or visit ironlog.space.</LegalP>
    </div>
  );
}

export function PrivacyContent(){
  return(
    <div>
      <LegalDate/>
      <LegalP>IRONLOG ("the App") is developed and operated by Byheir Wise ("we," "us," "our"). This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data.</LegalP>

      <LegalH>1. Information We Collect</LegalH>
      <LegalP><strong style={{color:V.text}}>Personal Information (provided by you):</strong> First name, last name, nickname, email address, date of birth, sex, state/region of residence, fitness experience level, profile photo, bio, and account PIN.</LegalP>
      <LegalP><strong style={{color:V.text}}>Fitness Data (generated through use):</strong> Workout logs (exercises, sets, reps, weight, RPE, duration, notes, ratings), nutrition entries (calories, macros, meals, food items, water intake, meal timing), body measurements (weight, body fat, chest, waist, arms, thighs), progress photos and videos, daily check-ins (sleep, soreness, energy, mood), training phases, injury records, supplement tracking, and goal progress.</LegalP>
      <LegalP><strong style={{color:V.text}}>Social Data:</strong> Friend connections, group memberships, direct messages, group chat messages, activity feed events, reactions, challenge progress, badges, friend codes, usernames, and accountability partnerships.</LegalP>
      <LegalP><strong style={{color:V.text}}>Device and Technical Data:</strong> A unique device identifier, IP address, browser type, platform, push notification subscription endpoint, sync timestamps, and app version.</LegalP>
      <LegalP><strong style={{color:V.text}}>Locally Stored Data (never sent to our servers):</strong> Your Anthropic API key (if provided for AI Coach), water tracking counts, meal favorites, recent food selections, and UI preferences (theme, accessibility settings).</LegalP>

      <LegalH>2. How We Use Your Data</LegalH>
      <LegalP>We use your data to: (a) personalize your fitness tracking experience, (b) provide workout recommendations, progressive overload suggestions, and AI coaching, (c) calculate strength scores, readiness scores, and body composition metrics, (d) enable social features including messaging, groups, and friend activity, (e) generate aggregated analytics and insights, (f) send push notifications and reminders, (g) provide admin tools for platform safety and moderation, and (h) improve the App's features and functionality.</LegalP>

      <LegalH>3. Admin Access</LegalH>
      <LegalP>Designated platform administrators may access user data including workout logs, nutrition entries, body measurements, all progress photos (including those in the private vault), direct messages, group chats, check-in data, and account settings. This access is used for platform safety, content moderation, and user support. Admin access is restricted to verified accounts and all actions are logged.</LegalP>

      <LegalH>4. Data Sharing and Sale</LegalH>
      <LegalP><strong style={{color:V.text}}>Aggregated/De-identified Data:</strong> We may share, license, or sell aggregated or de-identified data to third parties for commercial purposes, including market research, fitness industry analytics, and product development.</LegalP>
      <LegalP><strong style={{color:V.text}}>Personal Data:</strong> We may share your personal information with: (a) service providers who help operate the App (e.g., Supabase for database and storage, Vercel for hosting), (b) third-party partners for direct marketing or targeted advertising, only if you have not opted out, and (c) law enforcement or regulatory authorities when required by law.</LegalP>
      <LegalP><strong style={{color:V.text}}>We will never share:</strong> Your progress photos, private vault contents, workout notes, direct messages, or raw fitness logs with any third party without your explicit, separate consent.</LegalP>

      <LegalH>5. Your Rights</LegalH>
      <LegalP>Depending on your state of residence, you may have the following rights:</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Know:</strong> Request a copy of the personal data we hold about you.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Delete:</strong> Request deletion of your account and all associated personal data.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Opt Out of Sale:</strong> Opt out of the sale of your personal information at any time.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Correct:</strong> Update or correct your personal information through Settings.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Export:</strong> Download all your data as JSON through Settings at any time.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Control Visibility:</strong> Control what other users can see about you through privacy toggles (workouts, macros, photos, body).</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your privacy rights.</LegalP>

      <LegalH>6. Data Storage and Security</LegalH>
      <LegalP>Your data is stored locally on your device and on secure cloud servers (Supabase, hosted in the United States). Progress photos are stored in Supabase Storage. We use encryption in transit (HTTPS/TLS), server-issued session tokens with 30-day expiry, 6-digit account PINs with rate limiting, and reasonable security measures to protect your data. However, no method of electronic storage is 100% secure.</LegalP>

      <LegalH>7. Data Retention</LegalH>
      <LegalP>We retain your personal data for as long as your account is active or as needed to provide services. Messages (DMs and group chats) are retained for the lifetime of the account. If you request deletion, we will remove your data within 30 days, except where retention is required by law. Aggregated/de-identified data may be retained indefinitely.</LegalP>

      <LegalH>8. Children's Privacy</LegalH>
      <LegalP>IRONLOG is not intended for users under 16 years of age. We do not knowingly collect data from children under 16. If we learn that we have collected data from a child under 16, we will delete it promptly.</LegalP>

      <LegalH>9. California Residents (CCPA)</LegalH>
      <LegalP>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete, and the right to opt out of the sale of personal information. To exercise these rights, contact support@ironlog.space or use the "Do Not Sell My Information" option in Settings.</LegalP>

      <LegalH>10. Changes to This Policy</LegalH>
      <LegalP>We may update this Privacy Policy from time to time. We will notify you of material changes through the App. Your continued use after changes constitutes acceptance.</LegalP>

      <LegalH>11. Contact Us</LegalH>
      <LegalP>For questions, data requests, or to exercise your rights, contact us at: support@ironlog.space or visit ironlog.space.</LegalP>

      <LegalP style={{marginTop:16,padding:"10px 12px",background:`${V.accent}06`,borderRadius:8,border:`1px solid ${V.accent}15`}}>
        <strong style={{color:V.accent}}>Summary:</strong> We collect your profile, fitness, social, and device data to run the app. Your API key for AI Coach stays on your device. Admins can access all data including vault photos for moderation. We may sell aggregated/anonymized data commercially. You can opt out of personal data sales, export your data, and delete your account anytime. We never share your photos, messages, or raw workout logs with third parties.
      </LegalP>
    </div>
  );
}

// ─── Onboarding Flow ───
