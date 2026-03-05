import React, { useState, useEffect, useReducer, useRef } from 'react';
import { V } from './theme.js';
import Icons from './icons.jsx';
import { LS, today, ago, fmtShort, uid, SYNC_URL, APP_VERSION } from './utils.js';
import { CloudSync } from './services/sync.js';
import { AuthToken } from './services/auth.js';
import { SocialAPI } from './services/social.js';
import { defaultExercises } from './data/exercises.js';
import { reducer, init, defaultSchedule } from './reducer.js';
import {
  ErrorBoundary, UndoToast, SuccessToast, SuccessToastCtrl, Footer, Card, Btn
} from './components/shared/index.jsx';
import { Onboarding } from './components/settings/Onboarding.jsx';
import { HomeTab } from './components/home/HomeTab.jsx';
import { WorkoutTab } from './components/log/WorkoutTab.jsx';
import { NutritionTab } from './components/log/NutritionTab.jsx';
import { BodyTab } from './components/log/BodyTab.jsx';
import {
  OneRMCalc, ProgressPhotos, MuscleHeatMap, StrengthScoreCard,
  ReadinessTrend, AnalyticsTab, CalendarTab
} from './components/track/index.jsx';
import {
  GoalEngine, AdaptiveCoach, SyncStatus, FormCheckTab,
  DataGuardTab, PhaseTracker, SubstitutionFinder, InjuryManager,
  FastFoodHacks, MealPlanGenerator, ProgramMarketplace,
  SupplementTracker, PhotoCompare, AICoachChat
} from './components/plan/index.jsx';
import {
  WeeklySummary
} from './components/track/index.jsx';
import {
  SocialTab, SocialFeed, SocialFriends, SocialGroups,
  SocialProfile, SocialBadges, SocialNotifications, SocialCompare,
  SocialLeaderboard, SocialChallenges
} from './components/social/index.jsx';
import { SettingsTab } from './components/settings/index.jsx';

// ─── Log Hub ───
function LogHub({s,d}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:20,fontWeight:800,color:V.text,marginBottom:4}}>What are you logging?</div>
      {[
        {id:"log_workout",icon:Icons.dumbbell,label:"Workout",desc:"Log sets, reps, weight & RPE",color:V.accent,
          sub:"Templates · Rest Timer · PR Tracking"},
        {id:"log_nutrition",icon:Icons.fork,label:"Nutrition",desc:"Log meals with 500+ food database",color:V.warn,
          sub:"Auto-calc macros · Water · Sleep"},
        {id:"log_body",icon:Icons.scale,label:"Body Metrics",desc:"Track weight, body fat & measurements",color:V.accent2,
          sub:"Weight · Body Fat · Chest · Waist · Arms"},
      ].map(item=>(
        <button key={item.id} onClick={()=>d({type:"TAB",tab:item.id})} style={{
          display:"flex",alignItems:"center",gap:16,padding:18,
          background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,borderRadius:16,
          cursor:"pointer",WebkitTapHighlightColor:"transparent",textAlign:"left",width:"100%",
        }}>
          <div style={{width:52,height:52,borderRadius:14,background:`${item.color}12`,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {item.icon({size:24,color:item.color})}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:700,color:V.text}}>{item.label}</div>
            <div style={{fontSize:12,color:V.text3,marginTop:2}}>{item.desc}</div>
            <div style={{fontSize:10,color:V.text3,marginTop:4,opacity:0.6}}>{item.sub}</div>
          </div>
          {Icons.chevRight({size:18,color:V.text3})}
        </button>
      ))}
    </div>
  );
}

// ─── Shared Section Grid ───
function SectionGrid({title,items,d}){
  return(
    <div>
      <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",
        marginBottom:8,paddingLeft:2}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {items.map(item=>(
          <button key={item.id} onClick={()=>d({type:"TAB",tab:item.id})} style={{
            display:"flex",flexDirection:"column",alignItems:"flex-start",gap:8,padding:14,
            background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,borderRadius:14,
            cursor:"pointer",WebkitTapHighlightColor:"transparent",textAlign:"left",
          }}>
            <div style={{width:36,height:36,borderRadius:10,background:`${item.color}12`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {item.icon({size:17,color:item.color})}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:V.text,lineHeight:1.2}}>{item.label}</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2,lineHeight:1.3}}>{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Track Hub ───
function TrackHub({s,d}){
  const Section=({title,items})=><SectionGrid title={title} items={items} d={d}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{fontSize:20,fontWeight:800,color:V.text}}>Your Data</div>
      <Section title="History & Logs" items={[
        {id:"track_workouts",icon:Icons.dumbbell,label:"Workouts",desc:"History, PRs & volume",color:V.accent},
        {id:"track_nutrition",icon:Icons.fork,label:"Nutrition",desc:"Macros & calories",color:V.warn},
        {id:"track_body",icon:Icons.scale,label:"Body",desc:"Weight & measurements",color:V.accent2},
        {id:"track_photos",icon:Icons.target,label:"Photos",desc:"Progress photos",color:"#e879f9"},
      ]}/>
      <Section title="Analytics" items={[
        {id:"track_readiness",icon:Icons.activity,label:"Readiness",desc:"Recovery & load",color:V.accent},
        {id:"track_analytics",icon:Icons.chart,label:"Analytics",desc:"Trends & charts",color:V.purple},
        {id:"track_muscles",icon:Icons.activity,label:"Heat Map",desc:"Muscle balance",color:"#f97316"},
        {id:"track_strength",icon:Icons.trophy,label:"Strength",desc:"Score & rank",color:"#a855f7"},
      ]}/>
      <Section title="Reports" items={[
        {id:"track_summary",icon:Icons.chart,label:"Weekly Report",desc:"Summary card",color:"#22d3ee"},
        {id:"track_compare",icon:Icons.target,label:"Compare",desc:"Before & after",color:"#e879f9"},
      ]}/>
    </div>
  );
}

// ─── Plan Hub ───
function PlanHub({s,d}){
  const Section=({title,items})=><SectionGrid title={title} items={items} d={d}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{fontSize:20,fontWeight:800,color:V.text}}>Plan Ahead</div>
      <Section title="Training" items={[
        {id:"plan_coach",icon:Icons.zap,label:"AI Coach",desc:"Today's program",color:"#22d3ee"},
        {id:"plan_programs",icon:Icons.calendar,label:"Programs",desc:"4-8 week plans",color:"#06b6d4"},
        {id:"plan_schedule",icon:Icons.calendar,label:"Schedule",desc:"Weekly plan & calendar",color:"#34d399"},
        {id:"plan_phases",icon:Icons.calendar,label:"Phases",desc:"Cut / bulk / strength",color:"#a78bfa"},
      ]}/>
      <Section title="Nutrition" items={[
        {id:"plan_mealplan",icon:Icons.fork,label:"Meal Plan",desc:"Auto-generated meals",color:"#f59e0b"},
        {id:"plan_fastfood",icon:Icons.fork,label:"Fast Food Hacks",desc:"57 macro-friendly meals",color:"#f97316"},
        {id:"plan_supplements",icon:Icons.plus,label:"Supplements",desc:"Daily checklist",color:"#10b981"},
      ]}/>
      <Section title="Tools" items={[
        {id:"plan_goals",icon:Icons.target,label:"Goals",desc:"Milestones & targets",color:"#f43f5e"},
        {id:"plan_onerm",icon:Icons.zap,label:"1RM Calc",desc:"Estimate max",color:V.warn},
        {id:"plan_injuries",icon:Icons.activity,label:"Injuries",desc:"Pain flags & subs",color:V.danger},
        {id:"plan_subs",icon:Icons.refresh,label:"Substitutions",desc:"Alt exercises",color:"#34d399"},
        {id:"plan_formcheck",icon:Icons.target,label:"Form Check",desc:"Record & review",color:"#f472b6"},
        {id:"plan_dataguard",icon:Icons.target,label:"Data Guard",desc:"Integrity check",color:V.warn},
      ]}/>
    </div>
  );
}

// ─── App Shell ───
function App(){
  const [s,d]=useReducer(reducer,init);
  const contentRef=useRef(null);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [showInstallBanner,setShowInstallBanner]=useState(false);
  const [showUpdateBanner,setShowUpdateBanner]=useState(false);
  const [socialNotifCount,setSocialNotifCount]=useState(0);
  const [showUpdateGuide,setShowUpdateGuide]=useState(false);
  const [updateVersion,setUpdateVersion]=useState(null);
  const [updateNotes,setUpdateNotes]=useState("");

  useEffect(()=>{
    const avail=LS.get("ft-update-available");
    if(avail&&avail!==APP_VERSION){
      setUpdateVersion(avail);
      setUpdateNotes(LS.get("ft-update-notes")||"");
      const dismissed=LS.get("ft-update-dismissed");
      if(dismissed!==avail)setShowUpdateBanner(true);
    }
  },[]);

  useEffect(()=>{
    if(contentRef.current)contentRef.current.scrollTop=0;
  },[s.tab]);

  useEffect(()=>{
    const v=parseInt(LS.get("ft-visits")||"0")+1;
    LS.set("ft-visits",v);
    LS.set("ft-platform",/iPhone|iPad/.test(navigator.userAgent)?"ios":/Android/.test(navigator.userAgent)?"android":"desktop");
  },[]);

  useEffect(()=>{
    if(s.onboarded&&s.profile?.email){
      SocialAPI.getNotifications(s.profile.email).then(r=>{if(r)setSocialNotifCount(r.unread||0);});
    }
  },[s.onboarded,s.profile?.email]);

  useEffect(()=>{
    const handler=(e)=>{e.preventDefault();setInstallPrompt(e);
      LS.set("ft-install-shown",true);
      if(parseInt(LS.get("ft-visits")||"0")>=3&&!LS.get("ft-install-dismissed"))setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  useEffect(()=>{
    const hash=window.location.hash.replace("#","");
    if(hash&&["log_workout","log_nutrition","log_body","plan_coach","track_readiness","plan_goals"].includes(hash)){
      d({type:"TAB",tab:hash});
      window.location.hash="";
    }
  },[]);

  const [publicProfile,setPublicProfile]=useState(null);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const route=params.get("route");
    if(route){
      window.history.replaceState(null,"",window.location.origin+window.location.pathname);
      const match=route.match(/^\/u\/([a-zA-Z0-9_]+)/);
      if(match){
        const username=match[1].toLowerCase();
        setPublicProfile({username,loading:true});
        SocialAPI.getProfile(username).then(data=>{
          if(data?.found)setPublicProfile({...data.profile,username,loading:false});
          else setPublicProfile({username,loading:false,notFound:true});
        }).catch(()=>setPublicProfile({username,loading:false,notFound:true}));
      }
    }
  },[]);

  useEffect(()=>{
    const handler=(e)=>{
      if(e.data?.type==="NAVIGATE"&&e.data.tab){d({type:"TAB",tab:e.data.tab});}
    };
    navigator.serviceWorker?.addEventListener("message",handler);
    return()=>navigator.serviceWorker?.removeEventListener("message",handler);
  },[]);

  // Load persisted data
  useEffect(()=>{
    (async()=>{
      try{
        const data={};
        ["ft-w","ft-n","ft-b","ft-ex","ft-g","ft-sched","ft-units","ft-onb","ft-photos","ft-profile","ft-checkins","ft-milestones","ft-phases","ft-injuries","ft-syncprefs","ft-a11y"].forEach(k=>{const v=LS.get(k);if(v!==null)data[k]=v;});
        d({type:"INIT",p:{
          workouts:data["ft-w"]||[],nutrition:data["ft-n"]||[],body:data["ft-b"]||[],
          exercises:data["ft-ex"]||defaultExercises,goals:data["ft-g"]||init.goals,
          schedule:data["ft-sched"]||defaultSchedule,units:data["ft-units"]||"lbs",
          onboarded:data["ft-onb"]||false,photos:data["ft-photos"]||[],
          profile:data["ft-profile"]||init.profile,checkins:data["ft-checkins"]||[],
          milestones:data["ft-milestones"]||[],phases:data["ft-phases"]||[],
          injuries:data["ft-injuries"]||[],syncPrefs:data["ft-syncprefs"]||init.syncPrefs,
          a11y:data["ft-a11y"]||init.a11y,
        }});
      }catch(e){
        d({type:"INIT",p:{exercises:defaultExercises,goals:init.goals,schedule:defaultSchedule}});
      }
    })();
  },[]);

  // Persist state
  useEffect(()=>{
    if(!s.loaded)return;
    (async()=>{try{
      LS.set("ft-w",s.workouts);LS.set("ft-n",s.nutrition);LS.set("ft-b",s.body);
      LS.set("ft-ex",s.exercises);LS.set("ft-g",s.goals);LS.set("ft-sched",s.schedule);
      LS.set("ft-units",s.units);LS.set("ft-onb",s.onboarded);LS.set("ft-photos",s.photos);
      LS.set("ft-profile",s.profile);LS.set("ft-checkins",s.checkins||[]);
      LS.set("ft-milestones",s.milestones||[]);LS.set("ft-phases",s.phases||[]);
      LS.set("ft-injuries",s.injuries||[]);LS.set("ft-syncprefs",s.syncPrefs||init.syncPrefs);
      LS.set("ft-a11y",s.a11y||init.a11y);
      if(s.onboarded&&s.profile?.email){CloudSync.debouncedPush(s);}
    }catch(e){console.warn("Persist error:",e);}})();
  },[s.workouts,s.nutrition,s.body,s.exercises,s.goals,s.schedule,s.units,s.onboarded,s.photos,s.profile,s.checkins,s.milestones,s.phases,s.injuries,s.syncPrefs,s.a11y,s.loaded]);

  useEffect(()=>{
    if(s.loaded&&s.onboarded&&s.profile?.email){CloudSync.push(s);}
  },[s.loaded,s.onboarded]);

  const [updateAvailable,setUpdateAvailable]=useState(false);
  useEffect(()=>{
    const handler=(e)=>{if(e.data?.type==="UPDATE_AVAILABLE")setUpdateAvailable(true);};
    navigator.serviceWorker?.addEventListener("message",handler);
    return()=>navigator.serviceWorker?.removeEventListener("message",handler);
  },[]);

  const [showNotifPrompt,setShowNotifPrompt]=useState(false);
  const [guideStep,setGuideStep]=useState(LS.get("ft-guide-done")?-1:0);
  const [guideActive,setGuideActive]=useState(false);
  const [showFeatureHelp,setShowFeatureHelp]=useState(null);

  useEffect(()=>{
    if(s.onboarded&&!LS.get("ft-guide-done")&&guideStep>=0&&!guideActive)setGuideActive(true);
  },[s.onboarded]);

  const completeGuide=()=>{
    setGuideStep(-1);setGuideActive(false);LS.set("ft-guide-done",true);
    SuccessToastCtrl.show("You're all set! 💪");
    if(!LS.get("ft-notif-prompted"))setTimeout(()=>setShowNotifPrompt(true),600);
  };

  const guideSteps=[
    {id:"welcome",title:"Welcome to IRONLOG!",msg:"Let's walk through the app together. You'll log your first workout, meal, and measurements right now — by the end you'll have real data in the app.",icon:"🎉"},
    {id:"workout",title:"Log Your First Workout",msg:"Try adding an exercise — search for Bench Press, add a few sets with weight and reps. The rest timer and PR tracking will kick in automatically.",icon:"💪",
      action:()=>d({type:"TAB",tab:"log_workout"}),hint:"Search for an exercise and add some sets"},
    {id:"nutrition",title:"Track What You Ate",msg:"Search for a food you had today, or scan a barcode. You can also copy yesterday's meals later in one tap.",icon:"🥗",
      action:()=>d({type:"TAB",tab:"log_nutrition"}),hint:"Search or scan to log your first meal"},
    {id:"body",title:"Record Your Starting Point",msg:"Enter your current weight and any measurements. These become your baseline — track weekly to see progress.",icon:"📏",
      action:()=>d({type:"TAB",tab:"log_body"}),hint:"Enter your weight to set your starting point"},
    {id:"done",title:"You're Ready to Train!",msg:"You've set up everything. The app gets smarter as you use it — check in daily, log consistently, and watch the data build. Let's go!",icon:"🚀"},
  ];

  useEffect(()=>{
    if(!guideActive||guideStep<=0||guideStep>=guideSteps.length)return;
    const step=guideSteps[guideStep];
    if(step.action)step.action();
  },[guideStep,guideActive]);

  if(!s.loaded)return(
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:V.bg}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,borderRadius:18,border:`3px solid ${V.accent}30`,borderTopColor:V.accent,
          animation:"spin .8s linear infinite",margin:"0 auto 12px"}}/>
        <div style={{fontSize:12,color:V.text3}}>Loading IRONLOG...</div>
      </div>
    </div>
  );

  if(s.loaded&&!s.onboarded)return <Onboarding d={d}/>;

  const SubBack=({to,label})=>(
    <button onClick={()=>d({type:"TAB",tab:to})} style={{background:"none",border:"none",display:"flex",alignItems:"center",
      gap:5,padding:"8px 0 12px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
      {Icons.chevLeft({size:18,color:V.accent})}
      <span style={{fontSize:14,color:V.accent,fontWeight:600}}>{label||"Back"}</span>
    </button>
  );

  const tabParent=(t)=>{
    if(t.startsWith("log_"))return"log";
    if(t.startsWith("track_"))return"track";
    if(t.startsWith("plan_"))return"plan";
    if(t.startsWith("social_"))return"social";
    return t;
  };
  const activeParent=tabParent(s.tab);

  const tabs=[
    {id:"home",icon:Icons.activity,label:"Home"},
    {id:"log",icon:Icons.plus,label:"Log"},
    {id:"track",icon:Icons.chart,label:"Track"},
    {id:"plan",icon:Icons.calendar,label:"Plan"},
    {id:"social",icon:Icons.target,label:"Social"},
    {id:"settings",icon:Icons.target,label:"Settings"},
  ];

  const a11y=s.a11y||{};

  return(
    <div style={{
      height:"100%",maxWidth:430,margin:"0 auto",background:a11y.highContrast?"#000":V.bg,
      color:a11y.highContrast?"#fff":V.text,fontFamily:V.font,
      display:"flex",flexDirection:"column",position:"relative",
      fontSize:a11y.largeText?"17px":"16px",
    }}>
      <div style={{height:"env(safe-area-inset-top, 0px)",background:V.bg,flexShrink:0}}/>

      {/* Header */}
      <div style={{padding:"12px 20px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={()=>d({type:"TAB",tab:"home"})} style={{display:"flex",alignItems:"center",gap:8,
          background:"none",border:"none",cursor:"pointer",padding:0,WebkitTapHighlightColor:"transparent"}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {Icons.activity({size:15,color:V.bg,strokeWidth:2.5})}
          </div>
          <span style={{fontSize:17,fontWeight:800,letterSpacing:"-0.03em",color:V.text}}>
            IRON<span style={{color:V.accent}}>LOG</span>
          </span>
        </button>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>setShowFeatureHelp(activeParent)} aria-label="Show help"
            style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.04)",
              border:`1px solid ${V.cardBorder}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:V.text3}}>?</span>
          </button>
          <div style={{display:"flex",gap:3}}>
          {[7,14,30].map(n=>(
            <button key={n} onClick={()=>d({type:"RANGE",d:n})} style={{
              padding:"5px 10px",borderRadius:8,border:"none",fontSize:10,fontWeight:700,fontFamily:V.font,
              background:s.range===n?`${V.accent}15`:"transparent",color:s.range===n?V.accent:V.text3,cursor:"pointer",
              WebkitTapHighlightColor:"transparent",
            }}>{n}d</button>
          ))}
          </div>
        </div>
      </div>

      {/* Banners */}
      {updateAvailable&&(
        <div style={{padding:"8px 20px",background:`${V.accent}12`,borderBottom:`1px solid ${V.accent}25`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <span style={{fontSize:11,color:V.accent,fontWeight:600}}>New version available</span>
          <button onClick={()=>{navigator.serviceWorker?.controller?.postMessage({type:"SKIP_WAITING"});window.location.reload();}}
            style={{padding:"4px 12px",borderRadius:6,background:V.accent,border:"none",cursor:"pointer",
              fontSize:10,fontWeight:700,color:V.bg,fontFamily:V.font}}>Update</button>
        </div>
      )}
      {showInstallBanner&&installPrompt&&(
        <div style={{padding:"10px 20px",background:`${V.accent}08`,borderBottom:`1px solid ${V.accent}15`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text}}>Install IRONLOG</div>
            <div style={{fontSize:9,color:V.text3}}>Add to home screen for the full app experience</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={async()=>{
              installPrompt.prompt();
              const result=await installPrompt.userChoice;
              if(result.outcome==="accepted")LS.set("ft-installed",true);
              setShowInstallBanner(false);setInstallPrompt(null);
            }} style={{padding:"6px 14px",borderRadius:8,background:V.accent,border:"none",cursor:"pointer",
              fontSize:11,fontWeight:700,color:V.bg,fontFamily:V.font}}>Install</button>
            <button onClick={()=>{setShowInstallBanner(false);LS.set("ft-install-dismissed",true);}}
              style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"none",
                cursor:"pointer",fontSize:11,color:V.text3}}>✕</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} role="main" style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden",
        WebkitOverflowScrolling:"touch",padding:"0 16px 24px",overscrollBehavior:"contain"}}>

        {s.tab==="home"&&<HomeTab s={s} d={d}/>}
        {s.tab==="log"&&<LogHub s={s} d={d}/>}
        {s.tab==="track"&&<TrackHub s={s} d={d}/>}
        {s.tab==="plan"&&<PlanHub s={s} d={d}/>}
        {s.tab==="settings"&&<SettingsTab s={s} d={d}/>}

        {/* Log sub-pages */}
        {s.tab==="log_workout"&&<div><SubBack to="log" label="Log"/><WorkoutTab s={s} d={d}/></div>}
        {s.tab==="log_nutrition"&&<div><SubBack to="log" label="Log"/><NutritionTab s={s} d={d}/></div>}
        {s.tab==="log_body"&&<div><SubBack to="log" label="Log"/><BodyTab s={s} d={d}/></div>}

        {/* Track sub-pages */}
        {s.tab==="track_workouts"&&<div><SubBack to="track" label="Track"/><WorkoutTab s={s} d={d}/></div>}
        {s.tab==="track_nutrition"&&<div><SubBack to="track" label="Track"/><NutritionTab s={s} d={d}/></div>}
        {s.tab==="track_body"&&<div><SubBack to="track" label="Track"/><BodyTab s={s} d={d}/></div>}
        {s.tab==="track_photos"&&<div><SubBack to="track" label="Track"/><ProgressPhotos s={s} d={d}/></div>}
        {s.tab==="track_analytics"&&<div><SubBack to="track" label="Track"/><AnalyticsTab s={s} d={d}/></div>}
        {s.tab==="track_calendar"&&<div><SubBack to="track" label="Track"/><CalendarTab s={s} d={d}/></div>}
        {s.tab==="track_readiness"&&<div><SubBack to="track" label="Track"/><ReadinessTrend s={s}/></div>}
        {s.tab==="track_muscles"&&<div><SubBack to="track" label="Track"/><MuscleHeatMap s={s}/></div>}
        {s.tab==="track_strength"&&<div><SubBack to="track" label="Track"/><StrengthScoreCard s={s}/></div>}
        {s.tab==="track_summary"&&<div><SubBack to="track" label="Track"/><WeeklySummary s={s}/></div>}
        {s.tab==="track_compare"&&<div><SubBack to="track" label="Track"/><PhotoCompare s={s}/></div>}
        {s.tab==="track_onerm"&&<div><SubBack to="track" label="Track"/><OneRMCalc units={s.units}/></div>}

        {/* Plan sub-pages */}
        {s.tab==="plan_coach"&&<div><SubBack to="plan" label="Plan"/><AdaptiveCoach s={s}/></div>}
        {s.tab==="plan_programs"&&<div><SubBack to="plan" label="Plan"/><ProgramMarketplace s={s} d={d}/></div>}
        {s.tab==="plan_schedule"&&<div><SubBack to="plan" label="Plan"/><CalendarTab s={s} d={d}/></div>}
        {s.tab==="plan_phases"&&<div><SubBack to="plan" label="Plan"/><PhaseTracker s={s} d={d}/></div>}
        {s.tab==="plan_mealplan"&&<div><SubBack to="plan" label="Plan"/><MealPlanGenerator s={s}/></div>}
        {s.tab==="plan_fastfood"&&<div><SubBack to="plan" label="Plan"/><FastFoodHacks s={s} d={d}/></div>}
        {s.tab==="plan_supplements"&&<div><SubBack to="plan" label="Plan"/><SupplementTracker s={s} d={d}/></div>}
        {s.tab==="plan_goals"&&<div><SubBack to="plan" label="Plan"/><GoalEngine s={s} d={d}/></div>}
        {s.tab==="plan_onerm"&&<div><SubBack to="plan" label="Plan"/><OneRMCalc units={s.units}/></div>}
        {s.tab==="plan_injuries"&&<div><SubBack to="plan" label="Plan"/><InjuryManager s={s} d={d}/></div>}
        {s.tab==="plan_subs"&&<div><SubBack to="plan" label="Plan"/><SubstitutionFinder s={s}/></div>}
        {s.tab==="plan_formcheck"&&<div><SubBack to="plan" label="Plan"/><FormCheckTab s={s} d={d}/></div>}
        {s.tab==="plan_dataguard"&&<div><SubBack to="plan" label="Plan"/><DataGuardTab s={s} d={d}/></div>}
        {s.tab==="plan_aichat"&&<div><SubBack to="plan" label="Plan"/><AICoachChat s={s}/></div>}

        {/* Social sub-pages */}
        {s.tab==="social"&&<SocialTab s={s} d={d}/>}
        {s.tab==="social_feed"&&<div><SubBack to="social" label="Social"/><SocialFeed s={s} d={d}/></div>}
        {s.tab==="social_friends"&&<div><SubBack to="social" label="Social"/><SocialFriends s={s} d={d}/></div>}
        {s.tab==="social_groups"&&<div><SubBack to="social" label="Social"/><SocialGroups s={s} d={d}/></div>}
        {s.tab==="social_challenges"&&<div><SubBack to="social" label="Social"/><SocialChallenges s={s} d={d}/></div>}
        {s.tab==="social_profile"&&<div><SubBack to="social" label="Social"/><SocialProfile s={s} d={d}/></div>}
        {s.tab==="social_badges"&&<div><SubBack to="social" label="Social"/><SocialBadges s={s}/></div>}
        {s.tab==="social_notifications"&&<div><SubBack to="social" label="Social"/><SocialNotifications s={s}/></div>}
        {s.tab==="social_compare"&&<div><SubBack to="social" label="Social"/><SocialCompare s={s}/></div>}
        {s.tab==="social_leaderboard"&&<div><SubBack to="social" label="Social"/><SocialLeaderboard s={s} d={d}/></div>}

        <Footer/>
      </div>

      {/* Bottom Nav */}
      <nav role="navigation" aria-label="Main navigation" style={{
        flexShrink:0,background:"rgba(8,8,13,0.95)",backdropFilter:"blur(24px) saturate(180%)",
        borderTop:"1px solid rgba(255,255,255,0.06)",
        paddingBottom:"env(safe-area-inset-bottom, 8px)",
        display:"flex",justifyContent:"space-around",alignItems:"center",paddingTop:8,
        position:"relative",zIndex:50,
      }}>
        {tabs.map(t=>{
          const active=activeParent===t.id;
          return(
            <button key={t.id} onClick={()=>d({type:"TAB",tab:t.id})} aria-label={t.label} aria-current={active?"page":undefined} style={{
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              background:"none",border:"none",cursor:"pointer",
              padding:"6px 16px",minWidth:64,WebkitTapHighlightColor:"transparent",
            }}>
              <div style={{
                width:active?42:36,height:active?42:36,borderRadius:active?14:12,
                background:active?`${V.accent}18`:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s ease",
              }}>
                {t.id==="log"?(
                  <div style={{width:active?26:22,height:active?26:22,borderRadius:"50%",
                    background:active?V.accent:"rgba(255,255,255,0.12)",
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {Icons.plus({size:active?14:12,color:active?V.bg:V.text3,strokeWidth:3})}
                  </div>
                ):(
                  t.icon({size:active?22:20,color:active?V.accent:V.text3,strokeWidth:active?2.2:1.6})
                )}
                {t.id==="social"&&socialNotifCount>0&&(
                  <div style={{position:"absolute",top:2,right:active?6:8,width:8,height:8,borderRadius:4,
                    background:V.danger,border:"2px solid rgba(8,8,13,0.95)"}}/>
                )}
              </div>
              <span style={{fontSize:10,fontWeight:active?700:500,color:active?V.accent:V.text3,
                fontFamily:V.font,letterSpacing:".02em"}}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <UndoToast d={d}/>
      <SuccessToast/>

      {/* Guided Walkthrough */}
      {guideActive&&guideStep>=0&&guideStep<guideSteps.length&&(()=>{
        const step=guideSteps[guideStep];
        const isFirst=guideStep===0;
        const isLast=guideStep===guideSteps.length-1;
        return(
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:1800,
            background:"linear-gradient(transparent 0%,rgba(0,0,0,0.92) 25%)",
            padding:"50px 20px 20px",paddingBottom:"max(20px, env(safe-area-inset-bottom))"}}>
            <div style={{display:"flex",gap:3,marginBottom:12}}>
              {guideSteps.map((_,i)=>(
                <div key={i} style={{flex:1,height:3,borderRadius:2,
                  background:i<guideStep?V.accent:i===guideStep?"rgba(0,245,160,0.6)":"rgba(255,255,255,0.08)",
                  transition:"all .3s"}}/>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{fontSize:28,flexShrink:0}}>{step.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:V.text,marginBottom:2}}>{step.title}</div>
                <div style={{fontSize:12,color:V.text3,lineHeight:1.5}}>{step.msg}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              {!isFirst&&!isLast&&(
                <button onClick={()=>setGuideStep(g=>g+1)} style={{padding:"8px 14px",borderRadius:8,
                  background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                  cursor:"pointer",fontSize:11,color:V.text3,fontFamily:V.font}}>Skip</button>
              )}
              <button onClick={()=>{if(isLast)completeGuide();else setGuideStep(g=>g+1);}}
                style={{flex:1,padding:"10px",borderRadius:10,background:V.accent,border:"none",
                  cursor:"pointer",fontSize:12,fontWeight:700,color:V.bg,fontFamily:V.font}}>
                {isFirst?"Let's Go":isLast?"Start Training":"Next Step →"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Push Notification Prompt */}
      {showNotifPrompt&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)"}}/>
          <div role="dialog" aria-modal="true" style={{position:"relative",
            background:"linear-gradient(180deg,#1a1a28,#0e0e16)",borderRadius:20,padding:28,maxWidth:340,width:"100%",
            border:`1px solid ${V.accent}25`,textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:18,background:`${V.accent}20`,
              display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
              <span style={{fontSize:32}}>🔔</span>
            </div>
            <div style={{fontSize:19,fontWeight:800,color:V.text,marginBottom:8}}>Stay on Track</div>
            <div style={{fontSize:13,color:V.text2,lineHeight:1.6,marginBottom:16}}>
              Get smart reminders for workouts, meals, check-ins, and hydration.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={async()=>{
                LS.set("ft-notif-prompted",true);
                if("Notification" in window){
                  const perm=await Notification.requestPermission();
                  if(perm==="granted"){LS.set("ft-reminders",true);SuccessToastCtrl.show("Notifications enabled");}
                }
                setShowNotifPrompt(false);
              }} style={{width:"100%",padding:"14px",borderRadius:12,
                background:`linear-gradient(135deg,${V.accent},${V.accent2})`,border:"none",cursor:"pointer",
                fontSize:14,fontWeight:700,color:V.bg,fontFamily:V.font}}>
                Enable Notifications
              </button>
              <button onClick={()=>{LS.set("ft-notif-prompted",true);setShowNotifPrompt(false);}}
                style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",
                  border:"none",cursor:"pointer",fontSize:12,color:V.text3,fontFamily:V.font}}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
