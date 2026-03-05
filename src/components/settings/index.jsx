import React, { useState, useEffect, useMemo, useRef } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, ago, fmtShort, fmtFull, uid, SYNC_URL } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, chartCfg, Progress, ConfirmDialog, SuccessToastCtrl, Footer } from '../shared/index.jsx';
import { wUnit } from '../../data/plates.js';

function SettingsTab({s,d}){
  const [goals,setGoals]=useState(s.goals);
  const [saved,setSaved]=useState(false);
  const [newEx,setNewEx]=useState("");
  const [newCat,setNewCat]=useState("Chest");
  const [newYt,setNewYt]=useState("");
  const [exLibFilter,setExLibFilter]=useState(null);
  const [confirmClear,setConfirmClear]=useState(false);
  const [open,setOpen]=useState(null);
  const [legalView,setLegalView]=useState(null);

  const saveGoals=()=>{
    d({type:"GOALS",g:{cal:parseInt(goals.cal)||2400,protein:parseInt(goals.protein)||180,carbs:parseInt(goals.carbs)||250,
      fat:parseInt(goals.fat)||70,goalWeight:parseInt(goals.goalWeight)||175}});
    setSaved(true);setTimeout(()=>setSaved(false),2000);
    SuccessToastCtrl.show("Goals saved");
  };

  const addEx=()=>{
    if(!newEx.trim())return;
    let ytId=newYt.trim();
    if(!ytId.includes("youtu"))return; // YouTube required
    if(ytId.includes("youtube.com/watch")){try{ytId=new URL(ytId).searchParams.get("v")||"";}catch(e){console.warn("Error:",e);}}
    else if(ytId.includes("youtu.be/")){ytId=ytId.split("youtu.be/")[1]?.split(/[?&]/)[0]||"";}
    else if(ytId.includes("youtube.com/shorts/")){ytId=ytId.split("shorts/")[1]?.split(/[?&]/)[0]||"";}
    if(!ytId)return;
    d({type:"ADD_EX",ex:{id:uid(),name:newEx.trim(),cat:newCat,yt:ytId}});
    SuccessToastCtrl.show("Exercise added");
    setNewEx("");setNewYt("");
  };

  const toggle=(id)=>setOpen(o=>o===id?null:id);

  const Row=({id,icon,label,desc,right,children})=>(
    <div style={{background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:14,overflow:"hidden",marginBottom:8}}>
      <button onClick={()=>toggle(id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",
        width:"100%",background:"none",border:"none",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
        <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.04)",
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
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

  return(
    <div style={{display:"flex",flexDirection:"column",paddingBottom:16}}>
      <div style={{fontSize:18,fontWeight:800,color:V.text,marginBottom:12}}>Settings</div>

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
          <Btn full onClick={addEx} disabled={!newEx.trim()||!newYt.includes("youtu")}>
            {Icons.plus({size:14,color:V.bg})} Add Exercise
          </Btn>
          {!newEx&&!newYt&&(
            <div style={{fontSize:9,color:V.text3,marginTop:6,textAlign:"center"}}>All fields are required including a YouTube form video</div>
          )}
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
      <Row id="profile" icon={Icons.target({size:16,color:"#e879f9"})} label="Edit Profile"
        desc={s.profile?.firstName?`${s.profile.firstName} ${s.profile.lastName}`:"Not set"}>
        <ProfileEditor s={s} d={d}/>
      </Row>

      <Row id="backup" icon={Icons.refresh({size:16,color:V.accent2})} label="Backup & Restore"
        desc="Export or import your data">
        <DataManager s={s} d={d}/>
      </Row>

      {/* Data management — expandable */}
      <Row id="data" icon={Icons.trash({size:16,color:V.text3})} label="Data Management"
        desc="Demo data and reset">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="secondary" full onClick={()=>{const dm=genDemo();dm.workouts.forEach(w=>d({type:"ADD_W",w}));dm.nutrition.forEach(n=>d({type:"ADD_N",n}));dm.body.forEach(b=>d({type:"ADD_B",b}));setOpen(null);}}>{Icons.refresh({size:14,color:V.text2})} Load Demo Data</Btn>
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

      {/* Privacy Controls */}
      <Row id="privacy" icon={Icons.target({size:16,color:"#22d3ee"})} label="Privacy & Sync Controls"
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
      </Row>

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
      <Row id="reminders" icon={Icons.calendar({size:16,color:"#34d399"})} label="Reminders"
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
            }else{alert("Notifications not supported in this browser.");}
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
            style={{display:"block",padding:"12px 16px",background:"rgba(255,107,107,0.06)",borderRadius:10,
              border:"1px solid rgba(255,107,107,0.12)",textDecoration:"none",textAlign:"center"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#ff6b6b"}}>Do Not Sell My Personal Information</div>
            <div style={{fontSize:10,color:V.text3,marginTop:2}}>Opens email to support@ironlog.space</div>
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

function TOSContent(){
  return(
    <div>
      <LegalDate/>
      <LegalP>Welcome to IRONLOG. By creating an account and using this application, you agree to the following terms. If you do not agree, do not create an account.</LegalP>

      <LegalH>1. Acceptance of Terms</LegalH>
      <LegalP>By accessing or using IRONLOG ("the App"), you agree to be bound by these Terms of Service ("Terms"). These Terms apply to all users of the App. IRONLOG is developed and operated by Byheir Wise ("we," "us," "our").</LegalP>

      <LegalH>2. Account and Data</LegalH>
      <LegalP>When you create a profile, you provide personal information including your name, email address, date of birth, sex, location, and fitness data. You agree that all information you provide is accurate and current. You are responsible for maintaining the accuracy of your profile.</LegalP>

      <LegalH>3. Data Collection and Usage</LegalH>
      <LegalP>We collect personal and fitness-related data as described in our Privacy Policy. By using the App, you consent to the collection, storage, processing, and use of your data as outlined in the Privacy Policy, including the potential sharing of aggregated or anonymized data with third-party partners for analytics, research, and commercial purposes.</LegalP>

      <LegalH>4. Data Sharing and Sale</LegalH>
      <LegalP>You acknowledge and agree that we may share, license, or sell aggregated and/or de-identified data derived from user information to third parties for commercial purposes, including but not limited to market research, fitness industry analytics, advertising, and product development. We may also share personally identifiable information with third-party service providers who assist in operating the App. See our Privacy Policy for full details and your opt-out rights.</LegalP>

      <LegalH>5. User Rights</LegalH>
      <LegalP>You have the right to: (a) access your personal data, (b) request correction of inaccurate data, (c) request deletion of your account and associated data, (d) opt out of the sale of your personal information, and (e) export your data at any time through the App's settings. To exercise any of these rights, contact us at support@ironlog.space.</LegalP>

      <LegalH>6. Intellectual Property</LegalH>
      <LegalP>All content, design, code, and branding in IRONLOG are owned by Byheir Wise. You may not copy, modify, distribute, or reverse-engineer any part of the App without written permission.</LegalP>

      <LegalH>7. Disclaimer</LegalH>
      <LegalP>IRONLOG is a fitness tracking tool, not a medical device. The App does not provide medical advice. Consult a healthcare professional before starting any fitness or nutrition program. We are not liable for any injuries, health issues, or damages resulting from use of the App. The App is provided "as is" without warranties of any kind.</LegalP>

      <LegalH>8. Limitation of Liability</LegalH>
      <LegalP>To the maximum extent permitted by law, Byheir Wise shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of the App, including but not limited to loss of data, personal injury, or loss of profits.</LegalP>

      <LegalH>9. Modifications</LegalH>
      <LegalP>We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms. We will notify users of material changes through the App.</LegalP>

      <LegalH>10. Governing Law</LegalH>
      <LegalP>These Terms are governed by the laws of the State of Delaware. Any disputes shall be resolved in the courts of Delaware.</LegalP>

      <LegalH>11. Contact</LegalH>
      <LegalP>For questions about these Terms, contact us at support@ironlog.space or visit ironlog.space.</LegalP>
    </div>
  );
}

function PrivacyContent(){
  return(
    <div>
      <LegalDate/>
      <LegalP>IRONLOG ("the App") is developed and operated by Byheir Wise ("we," "us," "our"). This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data.</LegalP>

      <LegalH>1. Information We Collect</LegalH>
      <LegalP><strong style={{color:V.text}}>Personal Information (provided by you):</strong> First name, last name, nickname, email address, date of birth, sex, state/region of residence, height, weight, fitness experience level, activity level, and workout availability.</LegalP>
      <LegalP><strong style={{color:V.text}}>Fitness Data (generated through use):</strong> Workout logs, exercise history, nutrition entries, body measurements, progress photos, strength scores, and app usage patterns.</LegalP>
      <LegalP><strong style={{color:V.text}}>Device Information:</strong> A unique device identifier generated at signup, IP address, browser type, and platform. Your IP address is collected automatically when you create or update your account.</LegalP>

      <LegalH>2. How We Use Your Data</LegalH>
      <LegalP>We use your data to: (a) personalize your experience within the App, (b) provide workout recommendations and progressive overload suggestions, (c) calculate strength scores and body composition metrics, (d) generate aggregated analytics and demographic insights, (e) improve the App's features and functionality, and (f) communicate updates about the App.</LegalP>

      <LegalH>3. Data Sharing and Sale</LegalH>
      <LegalP><strong style={{color:V.text}}>Aggregated/De-identified Data:</strong> We may share, license, or sell aggregated or de-identified data (data that cannot reasonably identify you) to third parties for commercial purposes, including market research, fitness industry analytics, advertising partnerships, and product development.</LegalP>
      <LegalP><strong style={{color:V.text}}>Personal Data:</strong> We may share your personal information with: (a) service providers who help operate the App (e.g., hosting, database services), (b) third-party partners for direct marketing or targeted advertising, only if you have not opted out, and (c) law enforcement or regulatory authorities when required by law.</LegalP>
      <LegalP><strong style={{color:V.text}}>We will never share:</strong> Your progress photos, workout notes, or raw fitness logs with any third party without your explicit, separate consent.</LegalP>

      <LegalH>4. Your Rights</LegalH>
      <LegalP>Depending on your state of residence, you may have the following rights:</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Know:</strong> Request a copy of the personal data we hold about you.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Delete:</strong> Request deletion of your account and all associated personal data.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Opt Out of Sale:</strong> You may opt out of the sale of your personal information at any time by contacting support@ironlog.space or using the "Do Not Sell My Information" option in Settings.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Correct:</strong> Update or correct your personal information through the Edit Profile section in Settings.</LegalP>
      <LegalP><strong style={{color:V.text}}>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your privacy rights.</LegalP>

      <LegalH>5. Data Storage and Security</LegalH>
      <LegalP>Your data is stored locally on your device and on secure cloud servers (Supabase, hosted in the United States). We use encryption in transit (HTTPS/TLS) and implement reasonable security measures to protect your data. However, no method of electronic storage is 100% secure.</LegalP>

      <LegalH>6. Data Retention</LegalH>
      <LegalP>We retain your personal data for as long as your account is active or as needed to provide services. If you request deletion, we will remove your data within 30 days, except where retention is required by law. Aggregated/de-identified data may be retained indefinitely.</LegalP>

      <LegalH>7. Children's Privacy</LegalH>
      <LegalP>IRONLOG is not intended for users under 16 years of age. We do not knowingly collect data from children under 16. If we learn that we have collected data from a child under 16, we will delete it promptly.</LegalP>

      <LegalH>8. California Residents (CCPA)</LegalH>
      <LegalP>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete, and the right to opt out of the sale of personal information. To exercise these rights, contact support@ironlog.space.</LegalP>

      <LegalH>9. Changes to This Policy</LegalH>
      <LegalP>We may update this Privacy Policy from time to time. We will notify you of material changes through the App. Your continued use after changes constitutes acceptance.</LegalP>

      <LegalH>10. Contact Us</LegalH>
      <LegalP>For questions, data requests, or to exercise your rights, contact us at: support@ironlog.space or visit ironlog.space.</LegalP>

      <LegalP style={{marginTop:16,padding:"10px 12px",background:`${V.accent}06`,borderRadius:8,border:`1px solid ${V.accent}15`}}>
        <strong style={{color:V.accent}}>Summary:</strong> We collect your profile and fitness data to personalize the app. We may sell aggregated/anonymized data commercially. You can opt out of personal data sales anytime. You can delete your account anytime. We never share your photos or raw workout logs.
      </LegalP>
    </div>
  );
}

// ─── Onboarding Flow ───
function Onboarding({d}){
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [split,setSplit]=useState("PPL");
  const [units,setUnits]=useState("lbs");
  const [goals,setGoals]=useState({cal:"2400",protein:"180",carbs:"250",fat:"70",goalWeight:"175"});
  const [bw,setBw]=useState("");
  const [sending,setSending]=useState(false);
  const [agreed,setAgreed]=useState(false);
  const [showLegal,setShowLegal]=useState(null);
  const [accountPin,setAccountPin]=useState("");
  const [confirmPin,setConfirmPin]=useState("");
  const [pinError,setPinError]=useState("");
  const [profile,setProfile]=useState({
    firstName:"",lastName:"",nickname:"",email:"",dob:"",sex:"",state:"",
    height:"",fitnessLevel:"",activityLevel:"",weeklyAvailability:""
  });

  const splits={
    "PPL":{desc:"Push / Pull / Legs",days:{1:"Push",2:"Pull",3:"Legs",4:"Push",5:"Pull",6:"Legs",0:"Rest"}},
    "Bro":{desc:"Chest / Back / Shoulders / Arms / Legs",days:{1:"Chest",2:"Back",3:"Shoulders",4:"Arms",5:"Legs",6:"Cardio",0:"Rest"}},
    "Upper/Lower":{desc:"Upper / Lower / Rest / Repeat",days:{1:"Upper",2:"Lower",3:"Rest",4:"Upper",5:"Lower",6:"Cardio",0:"Rest"}},
    "Full Body":{desc:"3x per week full body",days:{1:"Full Body",2:"Rest",3:"Full Body",4:"Rest",5:"Full Body",6:"Cardio",0:"Rest"}},
    "Custom":{desc:"Set your own schedule later",days:{0:"Rest",1:"Rest",2:"Rest",3:"Rest",4:"Rest",5:"Rest",6:"Rest"}},
  };

  const US_STATES=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
    "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine",
    "Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
    "New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma",
    "Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
    "Virginia","Washington","West Virginia","Wisconsin","Wyoming","Other"];

  const sendToBackend=async(payload)=>{
    try{
      const res=await fetch(`${SYNC_URL}/api/users`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      });
      if(!res.ok)throw new Error("Server error");
      return true;
    }catch(e){
      // Silently fail — data is stored locally regardless
      console.log("Backend sync deferred — data saved locally",e.message);
      return false;
    }
  };

  const finish=async()=>{
    // Validate PIN
    if(accountPin.length!==6){setPinError("PIN must be exactly 6 digits");return;}
    if(accountPin!==confirmPin){setPinError("PINs don't match");return;}
    setPinError("");
    setSending(true);

    // Store account PIN locally
    LS.set("ft-account-pin",accountPin);

    // Build full payload
    const payload={
      ...profile,
      currentWeight:parseFloat(bw)||null,
      targetWeight:parseInt(goals.goalWeight)||null,
      units,split,
      goals:{cal:parseInt(goals.cal),protein:parseInt(goals.protein),carbs:parseInt(goals.carbs),fat:parseInt(goals.fat)},
      accountPin:accountPin,
      createdAt:new Date().toISOString(),
      consentedAt:new Date().toISOString(),
      consentVersion:"1.0",
      deviceId:uid(),
    };

    // Send to backend (non-blocking — app works regardless)
    await sendToBackend(payload);

    // Apply to local state
    d({type:"UNITS",u:units});
    d({type:"GOALS",g:{cal:parseInt(goals.cal)||2400,protein:parseInt(goals.protein)||180,
      carbs:parseInt(goals.carbs)||250,fat:parseInt(goals.fat)||70,goalWeight:parseInt(goals.goalWeight)||175}});
    d({type:"SET_SCHEDULE",schedule:{weekly:splits[split].days,overrides:{}}});
    d({type:"SET_PROFILE",profile});
    if(bw){d({type:"ADD_B",b:{id:uid(),date:today(),weight:parseFloat(bw)||0,bf:"",chest:"",waist:"",arms:"",thighs:""}});}
    // Init auth key for this device
    AuthToken.init(profile.email);
    LS.set("ft-device-id",payload.deviceId);
    // Create server-issued session token
    await SessionManager.create(profile.email,accountPin,payload.deviceId);
    d({type:"ONBOARDED"});
    setSending(false);
  };

  // ─── Onboarding Validation ───
  const BLOCKED_WORDS=["fuck","shit","ass","bitch","dick","pussy","cunt","damn","cock","porn",
    "nigger","nigga","faggot","retard","whore","slut","bastard","penis","vagina","nazi","kill","rape"];
  const containsProfanity=(text)=>{
    const lower=(text||"").toLowerCase().replace(/[^a-z]/g,"");
    return BLOCKED_WORDS.some(w=>lower.includes(w));
  };
  const isValidEmail=(email)=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const getAge=(dob)=>{
    if(!dob)return 0;
    const birth=new Date(dob+"T00:00:00");
    const now=new Date();
    let age=now.getFullYear()-birth.getFullYear();
    if(now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate()))age--;
    return age;
  };

  const nameClean=!containsProfanity(profile.firstName)&&!containsProfanity(profile.lastName)&&!containsProfanity(profile.nickname);
  const emailValid=isValidEmail(profile.email);
  const ageValid=getAge(profile.dob)>=13;
  const profileValid=profile.firstName.trim()&&profile.lastName.trim()&&profile.email.trim()&&profile.dob&&profile.sex&&profile.state&&agreed&&nameClean&&emailValid&&ageValid;

  const getValidationMsg=()=>{
    if(!agreed)return"Please agree to the Terms of Service and Privacy Policy";
    if(!profile.firstName.trim()||!profile.lastName.trim()||!profile.email.trim()||!profile.dob||!profile.sex||!profile.state)return"Please fill in all required fields (*)";
    if(!nameClean)return"Please use appropriate names";
    if(!emailValid)return"Please enter a valid email address";
    if(!ageValid)return"You must be at least 13 years old to use IRONLOG";
    return"";
  };

  const [showSignIn,setShowSignIn]=useState(false);
  const [signInEmail,setSignInEmail]=useState("");
  const [signInPin,setSignInPin]=useState("");
  const [signInLoading,setSignInLoading]=useState(false);
  const [signInError,setSignInError]=useState("");
  const [signInStep,setSignInStep]=useState("email"); // email | pin

  const signIn=async()=>{
    if(signInStep==="email"){
      if(!signInEmail.trim()||!signInEmail.includes("@")){setSignInError("Enter a valid email");return;}
      setSignInLoading(true);setSignInError("");
      try{
        AuthToken.init(signInEmail);
        const deviceId=uid();LS.set("ft-device-id",deviceId);
        // First pull without PIN to check if account exists and needs PIN
        const result=await CloudSync.pull(signInEmail.trim().toLowerCase(),deviceId,null);
        if(result?.pin_required){
          // Account has PIN — go to PIN step (server blocked data)
          setSignInStep("pin");
        }else if(result&&result.success&&result.data){
          // No PIN set (old account) — server returned data directly
          applyRestore(result.data,signInPin||null);
        }else{
          setSignInError(result?.error||"No account found with this email.");
        }
      }catch(e){
        setSignInError("Could not connect. Check your internet and try again.");
      }
      setSignInLoading(false);
      return;
    }

    // PIN step — validate server-side
    if(signInPin.length!==6){setSignInError("Enter your 6-digit PIN");return;}
    setSignInLoading(true);setSignInError("");
    try{
      const deviceId=LS.get("ft-device-id");
      const result=await CloudSync.pull(signInEmail.trim().toLowerCase(),deviceId,signInPin);
      if(result?.wrong_pin){
        setSignInError(`Wrong PIN. ${result.attempts_remaining} attempt${result.attempts_remaining!==1?"s":""} remaining.`);
        setSignInPin("");
        if(result.locked)setSignInError("Too many attempts. Account locked for 15 minutes.");
      }else if(result?.locked){
        setSignInError(`Account locked. Try again in ${result.retry_minutes} minutes.`);
      }else if(result&&result.success&&result.data){
        applyRestore(result.data,signInPin||null);
      }else{
        setSignInError("Could not restore. Try again.");
      }
    }catch(e){
      setSignInError("Connection failed.");
    }
    setSignInLoading(false);
  };

  const applyRestore=(cloud,pinUsed)=>{
    const merged={
      workouts:cloud.workouts||[],nutrition:cloud.nutrition||[],body:cloud.body||[],
      photos:cloud.photos||[],checkins:cloud.checkins||[],milestones:cloud.milestones||[],
      exercises:cloud.exercises||defaultExercises,
      goals:cloud.goals||{cal:2400,protein:180,carbs:250,fat:70,goalWeight:175},
      schedule:cloud.schedule||defaultSchedule,
      units:cloud.units||"lbs",
      profile:cloud.profile||{email:signInEmail.trim().toLowerCase()},
    };
    d({type:"IMPORT",data:merged});
    d({type:"SET_PROFILE",profile:merged.profile});
    d({type:"UNITS",u:merged.units});
    if(merged.goals)d({type:"GOALS",g:merged.goals});
    if(merged.schedule)d({type:"SET_SCHEDULE",schedule:merged.schedule});
    if(cloud.vault_pin)LS.set("ft-vault-pin",cloud.vault_pin);
    if(cloud.phases)d({type:"SET_PHASES",phases:cloud.phases});
    if(cloud.injuries)d({type:"SET_INJURIES",injuries:cloud.injuries});
    if(cloud.privacy)LS.set("ft-privacy",cloud.privacy);
    if(cloud.supplements)LS.set("ft-supplements",cloud.supplements);
    // Create server session for this device
    if(pinUsed)SessionManager.create(signInEmail.trim().toLowerCase(),pinUsed,LS.get("ft-device-id"));
    LS.set("ft-guide-done",true);
    d({type:"ONBOARDED"});
    SuccessToastCtrl.show(`Welcome back! Restored ${(cloud.workouts||[]).length} workouts`);
  };

  const [showInstallGuide,setShowInstallGuide]=useState(false);
  const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid=/Android/.test(navigator.userAgent);
  const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone;

  const steps=[
    // Step 0: Welcome
    ()=>(
      <div style={{textAlign:"center",padding:"20px 0"}}>
        <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,
          display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
          {Icons.activity({size:32,color:V.bg,strokeWidth:2.5})}
        </div>
        <div style={{fontSize:28,fontWeight:800,marginBottom:8}}>IRON<span style={{color:V.accent}}>LOG</span></div>
        <div style={{fontSize:14,color:V.text3,marginBottom:24,lineHeight:1.5}}>Your personal fitness tracker.<br/>Let's get you set up.</div>
        <Btn full onClick={()=>setStep(1)}>Get Started</Btn>

        {/* Welcome Back — returning users */}
        <div style={{marginTop:16}}>
          {!showSignIn?(
            <button onClick={()=>setShowSignIn(true)} style={{background:"none",border:"none",cursor:"pointer",
              padding:0,fontFamily:V.font,WebkitTapHighlightColor:"transparent"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,0.03)",border:`1px solid ${V.cardBorder}`}}>
                <span style={{fontSize:16}}>👋</span>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:12,fontWeight:600,color:V.accent}}>Welcome back?</div>
                  <div style={{fontSize:10,color:V.text3}}>Sign in to restore your data</div>
                </div>
              </div>
            </button>
          ):(
            <div style={{padding:"16px",borderRadius:14,background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,textAlign:"left"}}>
              {signInStep==="email"?(
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:4}}>Sign in with your email</div>
                  <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Enter the email you used when you created your account.</div>
                  <input type="email" value={signInEmail} onChange={e=>setSignInEmail(e.target.value)}
                    placeholder="you@email.com" autoComplete="email" onKeyDown={e=>{if(e.key==="Enter")signIn();}}
                    style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:V.font,marginBottom:8}}/>
                </div>
              ):(
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:4}}>Enter your 6-digit PIN</div>
                  <div style={{fontSize:10,color:V.text3,marginBottom:10}}>This is the PIN you created when you signed up.</div>
                  <input type="password" inputMode="numeric" value={signInPin}
                    onChange={e=>setSignInPin(e.target.value.replace(/\D/g,"").slice(0,6))}
                    placeholder="• • • • • •" maxLength={6} autoComplete="current-password"
                    onKeyDown={e=>{if(e.key==="Enter"&&signInPin.length===6)signIn();}}
                    style={{width:"100%",padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:24,textAlign:"center",fontFamily:V.mono,letterSpacing:12,
                      outline:"none",boxSizing:"border-box",marginBottom:4}}/>
                  <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:8}}>
                    {[0,1,2,3,4,5].map(i=>(
                      <div key={i} style={{width:8,height:8,borderRadius:4,
                        background:i<signInPin.length?V.accent:"rgba(255,255,255,0.1)",transition:"all .15s"}}/>
                    ))}
                  </div>
                </div>
              )}
              {signInError&&<div style={{fontSize:11,color:V.danger,marginBottom:8}}>{signInError}</div>}
              <div style={{display:"flex",gap:8}}>
                <Btn v="secondary" onClick={()=>{setShowSignIn(false);setSignInError("");setSignInStep("email");setSignInPin("");}}>Cancel</Btn>
                <Btn full onClick={signIn} disabled={signInLoading}>
                  {signInLoading?"Checking...":(signInStep==="email"?"Continue":"Sign In")}
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* Install prompt */}
        {!isStandalone&&(
          <div style={{marginTop:20}}>
            <button onClick={()=>setShowInstallGuide(true)} style={{background:"none",border:"none",cursor:"pointer",
              padding:0,fontFamily:V.font,WebkitTapHighlightColor:"transparent"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"12px 16px",borderRadius:12,background:"rgba(255,255,255,0.03)",border:`1px dashed ${V.cardBorder}`}}>
                <span style={{fontSize:16}}>{isIOS?"📱":"📲"}</span>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:12,fontWeight:600,color:V.accent}}>Install as an app</div>
                  <div style={{fontSize:10,color:V.text3}}>Add to home screen for the best experience</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Install guide popup */}
        {showInstallGuide&&(
          <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)"}} onClick={()=>setShowInstallGuide(false)}/>
            <div style={{position:"relative",background:"linear-gradient(180deg,#1a1a28,#0e0e16)",borderRadius:20,
              padding:24,maxWidth:340,width:"100%",border:`1px solid ${V.accent}25`,maxHeight:"80vh",overflowY:"auto"}}>
              <div style={{textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:32,marginBottom:8}}>📱</div>
                <div style={{fontSize:18,fontWeight:800,color:V.text}}>Install IRONLOG</div>
                <div style={{fontSize:12,color:V.text3,marginTop:4}}>Works offline, sends notifications, feels native</div>
              </div>

              {isIOS?(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>1</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Tap the Share button</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>It's the square icon with an arrow at the bottom of Safari</div>
                      <div style={{marginTop:6,padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:8,display:"inline-flex",alignItems:"center",gap:6}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00f5a0" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        <span style={{fontSize:11,color:V.text2}}>Share</span>
                      </div>
                    </div>
                  </div>

                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>2</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Scroll down and tap "Add to Home Screen"</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>You may need to scroll down in the share menu to find it</div>
                      <div style={{marginTop:6,padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:8,display:"inline-flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:14}}>➕</span>
                        <span style={{fontSize:11,color:V.text2}}>Add to Home Screen</span>
                      </div>
                    </div>
                  </div>

                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>3</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Tap "Add" in the top right</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>IRONLOG will appear on your home screen like a real app</div>
                    </div>
                  </div>

                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>4</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Open from Home Screen</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>Push notifications only work when opened from the home screen icon, not Safari</div>
                    </div>
                  </div>

                  <div style={{padding:"10px 12px",background:`${V.warn}08`,borderRadius:10,border:`1px solid ${V.warn}15`,marginTop:4}}>
                    <div style={{fontSize:10,color:V.warn,fontWeight:600}}>Important for iPhone</div>
                    <div style={{fontSize:10,color:V.text3,marginTop:2,lineHeight:1.5}}>You must use Safari (not Chrome) and open IRONLOG from the home screen icon for full features including push notifications.</div>
                  </div>
                </div>
              ):(isAndroid?(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>1</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Tap the menu (⋮) in Chrome</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>Three dots in the top right corner</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>2</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Tap "Add to Home screen"</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>Then tap "Add" to confirm</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:10,background:`${V.accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:14,fontWeight:800,color:V.accent}}>3</span>
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:V.text}}>Open from Home Screen</div>
                      <div style={{fontSize:11,color:V.text3,marginTop:2}}>Full app experience with notifications and offline support</div>
                    </div>
                  </div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:12,color:V.text2,lineHeight:1.6}}>
                    In Chrome or Edge, look for the install icon in the address bar, or click the menu and select "Install IRONLOG."
                  </div>
                  <div style={{fontSize:12,color:V.text2,lineHeight:1.6}}>
                    The app will open in its own window with full offline support.
                  </div>
                </div>
              ))}

              <Btn full onClick={()=>setShowInstallGuide(false)} s={{marginTop:16}}>Got it</Btn>
            </div>
          </div>
        )}
      </div>
    ),
    // Step 1: Units
    ()=>(
      <div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Units</div>
        <div style={{fontSize:13,color:V.text3,marginBottom:16}}>How do you measure weight?</div>
        <div style={{display:"flex",gap:10}}>
          {["lbs","kg"].map(u=>(
            <button key={u} onClick={()=>setUnits(u)} style={{
              flex:1,padding:20,borderRadius:14,border:`2px solid ${units===u?V.accent:V.cardBorder}`,
              background:units===u?`${V.accent}10`:"rgba(255,255,255,0.02)",
              cursor:"pointer",textAlign:"center",WebkitTapHighlightColor:"transparent"
            }}>
              <div style={{fontSize:24,fontWeight:800,color:units===u?V.accent:V.text}}>{u==="lbs"?"LBS":"KG"}</div>
              <div style={{fontSize:11,color:V.text3,marginTop:4}}>{u==="lbs"?"Pounds":"Kilograms"}</div>
            </button>
          ))}
        </div>
        <Btn full onClick={()=>setStep(2)} s={{marginTop:16}}>Next</Btn>
      </div>
    ),
    // Step 2: Training Split
    ()=>(
      <div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Training Split</div>
        <div style={{fontSize:13,color:V.text3,marginBottom:16}}>Pick your weekly routine</div>
        {Object.entries(splits).map(([k,v])=>(
          <button key={k} onClick={()=>setSplit(k)} style={{
            display:"block",width:"100%",padding:14,marginBottom:8,borderRadius:14,textAlign:"left",
            border:`2px solid ${split===k?V.accent:V.cardBorder}`,
            background:split===k?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",WebkitTapHighlightColor:"transparent"
          }}>
            <div style={{fontSize:15,fontWeight:700,color:split===k?V.accent:V.text}}>{k}</div>
            <div style={{fontSize:11,color:V.text3,marginTop:2}}>{v.desc}</div>
          </button>
        ))}
        <Btn full onClick={()=>setStep(3)} s={{marginTop:8}}>Next</Btn>
      </div>
    ),
    // Step 3: Goals + Body Weight
    ()=>(
      <div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Your Goals</div>
        <div style={{fontSize:13,color:V.text3,marginBottom:16}}>Set your daily targets</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="Calories" type="number" value={goals.cal} onChange={v=>setGoals(g=>({...g,cal:v}))} unit="kcal"/>
          <Field label="Protein" type="number" value={goals.protein} onChange={v=>setGoals(g=>({...g,protein:v}))} unit="g"/>
          <Field label="Carbs" type="number" value={goals.carbs} onChange={v=>setGoals(g=>({...g,carbs:v}))} unit="g"/>
          <Field label="Fat" type="number" value={goals.fat} onChange={v=>setGoals(g=>({...g,fat:v}))} unit="g"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
          <Field label="Current Weight" type="number" value={bw} onChange={setBw} unit={units}/>
          <Field label="Goal Weight" type="number" value={goals.goalWeight} onChange={v=>setGoals(g=>({...g,goalWeight:v}))} unit={units}/>
        </div>
        <Btn full onClick={()=>setStep(4)} s={{marginTop:16}}>Next</Btn>
      </div>
    ),
    // Step 4: Profile Setup
    ()=>(
      <div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Profile Setup</div>
        <div style={{fontSize:13,color:V.text3,marginBottom:16}}>Tell us about yourself to personalize your experience</div>

        {/* Required fields */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="First Name *" value={profile.firstName} onChange={v=>setProfile(p=>({...p,firstName:v}))} placeholder="John"/>
          <Field label="Last Name *" value={profile.lastName} onChange={v=>setProfile(p=>({...p,lastName:v}))} placeholder="Smith"/>
        </div>
        <Field label="Email *" type="email" value={profile.email} onChange={v=>setProfile(p=>({...p,email:v}))} placeholder="you@email.com"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="Date of Birth *" type="date" value={profile.dob} onChange={v=>setProfile(p=>({...p,dob:v}))}/>
          <div>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Sex *</div>
            <div style={{display:"flex",gap:6}}>
              {["Male","Female"].map(sx=>(
                <button key={sx} onClick={()=>setProfile(p=>({...p,sex:sx}))} style={{
                  flex:1,padding:"10px 0",borderRadius:10,border:`1.5px solid ${profile.sex===sx?V.accent:V.cardBorder}`,
                  background:profile.sex===sx?`${V.accent}10`:"rgba(255,255,255,0.02)",
                  cursor:"pointer",WebkitTapHighlightColor:"transparent",
                  fontSize:13,fontWeight:600,color:profile.sex===sx?V.accent:V.text,fontFamily:V.font,textAlign:"center"
                }}>{sx}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>State / Region *</div>
          <select value={profile.state} onChange={e=>setProfile(p=>({...p,state:e.target.value}))}
            style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
              borderRadius:12,color:profile.state?V.text:V.text3,fontSize:14,outline:"none",minHeight:44,
              WebkitAppearance:"none",fontFamily:V.font}}>
            <option value="" style={{background:"#14141f"}}>Select state...</option>
            {US_STATES.map(st=><option key={st} value={st} style={{background:"#14141f"}}>{st}</option>)}
          </select>
        </div>

        {/* Optional fields */}
        <div style={{marginTop:16,marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:2}}>Optional</div>
          <div style={{fontSize:11,color:V.text3}}>These help us personalize recommendations</div>
        </div>
        <Field label="Nickname" value={profile.nickname} onChange={v=>setProfile(p=>({...p,nickname:v}))} placeholder="What should we call you?"/>
        <Field label="Height" value={profile.height} onChange={v=>setProfile(p=>({...p,height:v}))} placeholder="e.g. 5'10 or 178cm"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Experience</div>
            <select value={profile.fitnessLevel} onChange={e=>setProfile(p=>({...p,fitnessLevel:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:12,color:profile.fitnessLevel?V.text:V.text3,fontSize:14,outline:"none",minHeight:44,
                WebkitAppearance:"none",fontFamily:V.font}}>
              <option value="" style={{background:"#14141f"}}>Select...</option>
              {["Beginner","Intermediate","Advanced","Elite"].map(lv=>(
                <option key={lv} value={lv} style={{background:"#14141f"}}>{lv}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Activity</div>
            <select value={profile.activityLevel} onChange={e=>setProfile(p=>({...p,activityLevel:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:12,color:profile.activityLevel?V.text:V.text3,fontSize:14,outline:"none",minHeight:44,
                WebkitAppearance:"none",fontFamily:V.font}}>
              <option value="" style={{background:"#14141f"}}>Select...</option>
              {["Sedentary","Lightly Active","Moderate","Very Active","Extremely Active"].map(lv=>(
                <option key={lv} value={lv} style={{background:"#14141f"}}>{lv}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Weekly Availability</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["2 days","3 days","4 days","5 days","6 days","7 days"].map(opt=>(
              <button key={opt} onClick={()=>setProfile(p=>({...p,weeklyAvailability:opt}))} style={{
                padding:"8px 14px",borderRadius:10,border:`1.5px solid ${profile.weeklyAvailability===opt?V.accent:V.cardBorder}`,
                background:profile.weeklyAvailability===opt?`${V.accent}10`:"rgba(255,255,255,0.02)",
                cursor:"pointer",WebkitTapHighlightColor:"transparent",
                fontSize:12,fontWeight:600,color:profile.weeklyAvailability===opt?V.accent:V.text3,fontFamily:V.font
              }}>{opt}</button>
            ))}
          </div>
        </div>

        {/* Consent checkbox + legal links */}
        <div style={{marginTop:14,padding:"12px 14px",background:"rgba(255,255,255,0.02)",borderRadius:12,
          border:`1px solid ${V.cardBorder}`}}>
          <button onClick={()=>setAgreed(a=>!a)} style={{display:"flex",alignItems:"flex-start",gap:10,
            background:"none",border:"none",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent",width:"100%",padding:0}}>
            <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${agreed?V.accent:V.text3}`,
              background:agreed?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,marginTop:1,transition:"all .2s"}}>
              {agreed&&<span style={{color:V.bg,fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>}
            </div>
            <div style={{fontSize:12,color:V.text2,lineHeight:1.6}}>
              I agree to the{" "}
              <span onClick={e=>{e.stopPropagation();setShowLegal("tos");}} style={{color:V.accent,textDecoration:"underline",fontWeight:600}}>Terms of Service</span>
              {" "}and{" "}
              <span onClick={e=>{e.stopPropagation();setShowLegal("privacy");}} style={{color:V.accent,textDecoration:"underline",fontWeight:600}}>Privacy Policy</span>
            </div>
          </button>
        </div>

        {/* Inline legal document viewer */}
        {showLegal&&(
          <Sheet title={showLegal==="tos"?"Terms of Service":"Privacy Policy"} onClose={()=>setShowLegal(null)}
            footer={<Btn full onClick={()=>setShowLegal(null)}>Close</Btn>}>
            {showLegal==="tos"?<TOSContent/>:<PrivacyContent/>}
          </Sheet>
        )}

        <Btn full onClick={()=>setStep(5)} disabled={!profileValid} s={{marginTop:16}}>
          Next
        </Btn>

        {!profileValid&&(
          <div style={{fontSize:11,color:!nameClean||!ageValid?V.danger:V.text3,textAlign:"center",marginTop:8}}>
            {getValidationMsg()}
          </div>
        )}
      </div>
    ),
    // Step 5: Account PIN
    ()=>(
      <div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Secure Your Account</div>
        <div style={{fontSize:13,color:V.text3,marginBottom:16,lineHeight:1.5}}>Create a 6-digit PIN to protect your account. You'll use this to sign back in if you reinstall or switch devices.</div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Create PIN</div>
          <input type="password" inputMode="numeric" value={accountPin}
            onChange={e=>{setAccountPin(e.target.value.replace(/\D/g,"").slice(0,6));setPinError("");}}
            placeholder="• • • • • •" maxLength={6} autoComplete="new-password"
            style={{width:"100%",padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${accountPin.length===6?V.accent:V.cardBorder}`,
              borderRadius:12,color:V.text,fontSize:24,textAlign:"center",fontFamily:V.mono,letterSpacing:12,
              outline:"none",boxSizing:"border-box"}}/>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:8}}>
            {[0,1,2,3,4,5].map(i=>(
              <div key={i} style={{width:10,height:10,borderRadius:5,
                background:i<accountPin.length?V.accent:"rgba(255,255,255,0.1)",transition:"all .15s"}}/>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Confirm PIN</div>
          <input type="password" inputMode="numeric" value={confirmPin}
            onChange={e=>{setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,6));setPinError("");}}
            placeholder="• • • • • •" maxLength={6} autoComplete="new-password"
            style={{width:"100%",padding:"14px",background:"rgba(255,255,255,0.04)",
              border:`1px solid ${confirmPin.length===6&&confirmPin===accountPin?V.accent:confirmPin.length===6&&confirmPin!==accountPin?V.danger:V.cardBorder}`,
              borderRadius:12,color:V.text,fontSize:24,textAlign:"center",fontFamily:V.mono,letterSpacing:12,
              outline:"none",boxSizing:"border-box"}}/>
        </div>

        {pinError&&<div style={{fontSize:11,color:V.danger,textAlign:"center",marginBottom:8}}>{pinError}</div>}

        {accountPin.length===6&&confirmPin.length===6&&accountPin===confirmPin&&(
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginBottom:10}}>
            {Icons.check({size:14,color:V.accent})}
            <span style={{fontSize:12,color:V.accent,fontWeight:600}}>PINs match</span>
          </div>
        )}

        <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:10,
          border:`1px solid ${V.cardBorder}`,marginBottom:14}}>
          <div style={{fontSize:10,color:V.text3,lineHeight:1.6}}>
            💡 <strong style={{color:V.text}}>Save to your keychain.</strong> When your browser asks to save this password, tap <strong style={{color:V.accent}}>Save</strong>. This lets you autofill your PIN when signing back in.
          </div>
        </div>

        <Btn full onClick={finish} disabled={accountPin.length!==6||sending} s={{marginTop:8}}>
          {sending?(
            <span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
              <div style={{width:16,height:16,borderRadius:8,border:"2px solid rgba(255,255,255,0.2)",
                borderTopColor:V.bg,animation:"spin 0.8s linear infinite"}}/>
              Setting up...
            </span>
          ):(
            <span>{Icons.check({size:16,color:V.bg})} Complete Setup</span>
          )}
        </Btn>
      </div>
    ),
  ];

  return(
    <div style={{height:"100%",maxWidth:430,margin:"0 auto",background:V.bg,color:V.text,fontFamily:V.font,
      display:"flex",flexDirection:"column",padding:"0 24px",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:step<=3?"center":"flex-start",
        paddingTop:step>3?20:0,paddingBottom:40}}>
      {/* Back button + Progress dots */}
      {step>0&&(
        <button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"none",display:"flex",alignItems:"center",
          gap:5,padding:"8px 0",marginBottom:12,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          {Icons.chevLeft({size:18,color:V.accent})}
          <span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
        </button>
      )}
      <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:30}}>
        {steps.map((_,i)=>(
          <div key={i} style={{width:i===step?24:8,height:8,borderRadius:4,
            background:i<=step?V.accent:"rgba(255,255,255,0.08)",transition:"all .3s"}}/>
        ))}
      </div>
      {steps[step]()}
      </div>
    </div>
  );
}


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

export { SettingsTab, TOSContent, PrivacyContent, ProfileEditor, DataManager };
export default SettingsTab;
