import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { V, Haptic } from './utils/theme';
import { LS, Cookie } from './utils/storage';
import { AuthToken, SessionManager } from './utils/auth';
import { uid, today, ago, fmtShort } from './utils/helpers';
import { SYNC_URL, APP_VERSION, CloudSync, SocialAPI, MsgBannerCtrl_ref, setMsgBannerCtrlRef } from './utils/sync';
import { Icons } from './components/Icons';
import { Btn, UndoToast, GlobalConfirm, SuccessToast, SuccessToastCtrl, MessageBanner, MsgBannerCtrl } from './components/ui';
import { CheckinModal } from './components/dialogs';
import { defaultExercises } from './data/exercises';
import { reducer, init, defaultSchedule } from './state/reducer';
import { HomeTab } from './tabs/HomeTab';
import { WorkoutTab } from './tabs/WorkoutTab';
import { NutritionTab } from './tabs/NutritionTab';
import { BodyTab } from './tabs/BodyTab';
import { CalendarTab } from './tabs/CalendarTab';
import { AnalyticsTab, ExerciseChart, DurationTrends, VolumeTracker, MuscleHeatMap, StrengthScoreCard } from './tabs/AnalyticsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { Onboarding } from './tabs/Onboarding';
import { LogHub, TrackHub, PlanHub } from './tabs/hubs';
import {
  OneRMCalc, ProgressPhotos, AdminPanel, GoalEngine, AdaptiveCoach,
  FormCheckTab, DataGuardTab, PhaseTracker, SubstitutionFinder, InjuryManager,
  WeeklySummary, FastFoodHacks, MealPlanGenerator, ProgramMarketplace,
  SupplementTracker, PersonalRecords, PhotoCompare, AICoachChat,
} from './tabs/features';
import { AdminPush, AdminUserAudit, AdminXPManager, AdminBusinessValue, AdminHub } from './tabs/admin';
import {
  SocialTab, SocialFeed, SocialFriends, MessagesTab, SocialGroups,
  SocialProfile, SocialBadges, SocialNotifications, SocialCompare,
  SocialLeaderboard, SocialChallenges, calcIronScore,
} from './tabs/social';
import { GamificationOverlay, SocialIronScore, SocialDuels, SocialWeeklyWar, SocialRivals } from './tabs/gamification';
import { ReadinessTrend } from './components/dialogs';
import { useLayout } from './utils/responsive';

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

function App(){
  const [s,d]=useReducer(reducer,init);
  const contentRef=useRef(null);
  const { isDesktop, isTablet, isMobile } = useLayout();

  // ─── Swipe Gestures — navigate between main tabs ───
  const mainTabs=["home","log","track","plan","social","settings","admin"];
  const swipeRef=useRef({startX:0,startY:0,startTime:0});
  const handleTouchStart=useCallback((e)=>{
    swipeRef.current={startX:e.touches[0].clientX,startY:e.touches[0].clientY,startTime:Date.now()};
  },[]);
  const handleTouchEnd=useCallback((e)=>{
    const {startX,startY,startTime}=swipeRef.current;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    const dt=Date.now()-startTime;
    // Only trigger on fast horizontal swipes (not scrolling)
    if(Math.abs(dx)>80&&Math.abs(dy)<80&&dt<400){
      // Find current parent tab
      const activeParent2=mainTabs.find(t=>s.tab===t||s.tab.startsWith(t+"_"))||"home";
      const idx=mainTabs.indexOf(activeParent2);
      if(dx<-80&&idx<mainTabs.length-1){Haptic.light();d({type:"TAB",tab:mainTabs[idx+1]});}
      else if(dx>80&&idx>0){Haptic.light();d({type:"TAB",tab:mainTabs[idx-1]});}
    }
  },[s.tab]);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [showInstallBanner,setShowInstallBanner]=useState(false);
  const [showUpdateBanner,setShowUpdateBanner]=useState(false);
  const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [pushHealth,setPushHealth]=useState(null);
  const [showInstallGuide,setShowInstallGuide]=useState(false);

  // #1: Online/offline detection
  useEffect(()=>{
    const on=()=>setIsOnline(true);
    const off=()=>setIsOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);

  // #2: Register periodic sync + #3: Push health — single listener with cleanup
  useEffect(()=>{
    if(!("serviceWorker" in navigator)||!s.onboarded)return;
    const handler=(e)=>{
      if(e.data?.type==="BACKGROUND_SYNC"&&s.profile?.email){
        const doSync=window.__ironlog_sync;if(doSync)doSync();
      }
      if(e.data?.type==="PUSH_HEALTH")setPushHealth(e.data);
      if(e.data?.type==="PUSH_RESUBSCRIBED")setPushHealth({active:true,endpoint:e.data.subscription?.endpoint});
      if(e.data?.type==="PUSH_SUBSCRIPTION_LOST"){
        // Push subscription expired and couldn't auto-renew — show actionable toast
        MsgBannerCtrl.push({name:"Notifications",text:"Push subscription lost. Re-enable in Settings → Notifications.",type:"system"});
        setPushHealth({active:false,endpoint:null});
      }
      if(e.data?.type==="OPEN_DM"&&e.data.from){
        d({type:"TAB",tab:"social_messages"});
        // Store the sender so MessagesTab can auto-open their chat
        LS.set("ft-open-dm-from",e.data.from);
      }
    };
    navigator.serviceWorker.addEventListener("message",handler);
    navigator.serviceWorker.ready.then(reg=>{
      if("periodicSync" in reg)reg.periodicSync.register("ironlog-periodic-sync",{minInterval:4*60*60*1000}).catch(()=>{});
      if(navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({type:"CHECK_PUSH_HEALTH"});
    }).catch(()=>{});
    return()=>navigator.serviceWorker.removeEventListener("message",handler);
  },[s.onboarded]);
  const [socialNotifCount,setSocialNotifCount]=useState(0);
  const [unreadMsgCount,setUnreadMsgCount]=useState(0);
  // tabRef: captures current tab without making poll interval depend on s.tab
  const tabRef=useRef(s.tab);
  useEffect(()=>{tabRef.current=s.tab;},[s.tab]);

  // On launch from push notification: read ?open-dm= URL param, store for SocialFriends
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const openDm=params.get("open-dm");
    if(openDm){
      LS.set("ft-open-dm-from",decodeURIComponent(openDm));
      // Clean the URL without a reload
      const clean=window.location.pathname+(window.location.hash||"");
      window.history.replaceState({},"",clean);
      d({type:"TAB",tab:"social_messages"});
    }
  },[]);

  // Deep-link: ?add-friend=IRON-XXXX — works from QR code scans and shared links
  // Step 1: [] effect — capture the code, clean URL immediately (before INIT fires)
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const addCode=params.get("add-friend")||params.get("code");
    if(!addCode)return;
    // Clean URL so refreshing doesn't re-trigger
    window.history.replaceState({},"",window.location.pathname+(window.location.hash||""));
    LS.set("ft-pending-add",addCode.toUpperCase());
  },[]);
  // Step 2: [s.onboarded] effect — once INIT fires and user is confirmed logged in, navigate
  // B1 fix: s.onboarded is always false in [] effect (INIT hasn't dispatched yet)
  useEffect(()=>{
    if(!s.onboarded)return;
    if(LS.get("ft-pending-add")){
      d({type:"TAB",tab:"social_friends"});
    }
  },[s.onboarded]);

  // Layer 2: Message polling (every 15s when visible)
  useEffect(()=>{
    if(!s.onboarded||!s.profile?.email)return;
    const email=s.profile.email;
    let pollTimer=null;
    const poll=async()=>{
      if(document.visibilityState!=="visible")return;
      // B9 fix: cap since to max 5 min ago to guard against clock skew or stale value
      const rawPoll=LS.get("ft-last-poll");
      const fiveMinAgo=new Date(Date.now()-300000).toISOString();
      const since=rawPoll&&rawPoll<new Date().toISOString()?rawPoll:fiveMinAgo;
      const result=await SocialAPI.checkMessages(email,since);
      if(!result)return;
      LS.set("ft-last-poll",new Date().toISOString());
      // Count unread
      let totalUnread=0;
      // DM unreads
      (result.dms||[]).forEach(dm=>{
        const lastRead=LS.get(`ft-last-read-${dm.from}`)||"1970-01-01";
        const lastSeen=LS.get(`ft-last-seen-${dm.from}`)||"1970-01-01";
        if(dm.ts>lastRead){
          totalUnread++;
          // Only increment per-friend counter if this is a new message (not seen this poll cycle)
          if(dm.ts>lastSeen){
            LS.set(`ft-last-seen-${dm.from}`,dm.ts);
            const key=`ft-unread-${dm.from}`;
            LS.set(key,(parseInt(LS.get(key))||0)+1);
          }
          // Layer 3: Show banner if not currently in that chat
          // Bug 9: also suppress banner when user is in the new MessagesTab viewing that chat
          const inMessagesTab=tabRef.current==="social_messages";
          const inFriendsTab=tabRef.current==="social_friends";
          if(!inFriendsTab&&!inMessagesTab){
            MsgBannerCtrl.push({name:dm.name,text:dm.text,from:dm.from,type:"dm"});
          }
        }
      });
      // Group unreads
      (result.groups||[]).forEach(gm=>{
        const lastRead=LS.get(`ft-last-read-group-${gm.group}`)||"1970-01-01";
        const lastSeenG=LS.get(`ft-last-seen-group-${gm.group}`)||"1970-01-01";
        if(gm.ts>lastRead){
          totalUnread++;
          if(gm.ts>lastSeenG){
            LS.set(`ft-last-seen-group-${gm.group}`,gm.ts);
            const key=`ft-unread-group-${gm.group}`;
            LS.set(key,(parseInt(LS.get(key))||0)+1);
          }
          if(tabRef.current!=="social_groups"){
            MsgBannerCtrl.push({name:gm.name,text:gm.text,group:gm.group,type:"group"});
          }
        }
      });
      setUnreadMsgCount(totalUnread);
      // Also refresh server notification count
      SocialAPI.getNotifications(email).then(r=>{if(r)setSocialNotifCount(r.unread||0);});
      // ── Gamification live-refresh: admin XP/rank changes propagate within 15s ──
      (async()=>{
        try{
          const localBonus=LS.get("ft-xp-bonus")||{total:0,log:[]};
          const token=LS.get("ft-session-token");
          if(!token)return;
          const r=await fetch(`${SYNC_URL}/api/sync/gamification`,{
            method:"POST",
            headers:{"Content-Type":"application/json","X-Session-Token":token},
            body:JSON.stringify({client_total:localBonus.total||0}),
          });
          if(!r.ok)return;
          const gj=await r.json();
          if(!gj.updated)return;
          // Server has a different xp_bonus — apply it
          const prev=localBonus.total||0;
          LS.set("ft-xp-bonus",gj.xp_bonus);
          if(gj.last_known_level!=null)LS.set("ft-last-known-level",gj.last_known_level);
          // Toast the user so they know XP changed
          const diff=(gj.xp_bonus?.total||0)-prev;
          if(diff!==0){
            const msg=diff>0?`⚡ +${diff.toLocaleString()} XP added to your account`:`⚡ XP updated by admin`;
            SuccessToastCtrl.show(msg);
          }
          // Force lightweight re-render so IronScore / rank badge update immediately
          d({type:"XP_REFRESH"});
        }catch(e){}
      })();
    };
    // Initial poll after 3s
    const initTimer=setTimeout(poll,3000);
    // Visibility-aware interval: 15s when visible, 60s when backgrounded
    const getInterval=()=>document.visibilityState==="visible"?15000:60000;
    pollTimer=setInterval(poll,getInterval());
    // On visibility change: re-poll immediately if returning to foreground, restart interval at correct rate
    const visHandler=()=>{
      clearInterval(pollTimer);
      if(document.visibilityState==="visible")poll();
      pollTimer=setInterval(poll,getInterval());
    };
    document.addEventListener("visibilitychange",visHandler);
    return()=>{clearTimeout(initTimer);clearInterval(pollTimer);document.removeEventListener("visibilitychange",visHandler);};
  },[s.onboarded,s.profile?.email]);  // s.tab removed — read via tabRef to avoid restarting interval on every nav
  const [showUpdateGuide,setShowUpdateGuide]=useState(false);
  const [updateVersion,setUpdateVersion]=useState(null);
  const [updateNotes,setUpdateNotes]=useState("");

  // Check for app updates on load
  useEffect(()=>{
    const avail=LS.get("ft-update-available");
    if(avail&&avail!==APP_VERSION){
      setUpdateVersion(avail);
      setUpdateNotes(LS.get("ft-update-notes")||"");
      // Don't show immediately if dismissed recently
      const dismissed=LS.get("ft-update-dismissed");
      if(dismissed!==avail)setShowUpdateBanner(true);
    }
  },[]);

  // Scroll to top when tab changes
  useEffect(()=>{
    if(contentRef.current)contentRef.current.scrollTop=0;
  },[s.tab]);

  // #10 Track visits on app launch (separate from install prompt)
  useEffect(()=>{
    const v=parseInt(LS.get("ft-visits")||"0")+1;
    LS.set("ft-visits",v);
    LS.set("ft-platform",/iPhone|iPad/.test(navigator.userAgent)?"ios":/Android/.test(navigator.userAgent)?"android":"desktop");
  },[]);

  // Fetch social notification count
  useEffect(()=>{
    if(s.onboarded&&s.profile?.email){
      SocialAPI.getNotifications(s.profile.email).then(r=>{if(r)setSocialNotifCount(r.unread||0);});
    }
  },[s.onboarded,s.profile?.email]);

  // Clear badge when visiting notifications
  useEffect(()=>{if(s.tab==="social_notifications")setSocialNotifCount(0);},[s.tab]);

  // Admin check (silent, no UI trace if not admin)
  const [isAdmin,setIsAdmin]=useState(LS.get("ft-is-admin")===true);
  useEffect(()=>{
    if(s.onboarded&&s.profile?.email){
      SessionManager.checkAdmin().then(a=>setIsAdmin(a));
    }
  },[s.onboarded,s.profile?.email]);

  // ─── Widget Data — expose key stats for iOS Shortcuts / Capacitor / home screen widgets ───
  useEffect(()=>{
    if(!s.onboarded)return;
    const streak2=(()=>{let c=0;for(let i=0;i<60;i++){if(s.workouts.some(w=>w.date===ago(i)))c++;else if(i>0)break;}return c;})();
    const todayW=s.workouts.find(w=>w.date===today());
    const todayN=s.nutrition.find(n=>n.date===today());
    const latestBW=s.body[0]?.weight;
    const getBest2=(id)=>{let b=0;s.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{if(st.weight>b)b=st.weight;});}));return b;};
    LS.set("ft-widget",{
      updated:new Date().toISOString(),
      name:s.profile?.firstName||s.profile?.nickname||"",
      streak:streak2,
      todayWorkedOut:!!todayW,
      todayCalories:todayN?.cal||0,
      todayProtein:todayN?.protein||0,
      calGoal:s.goals?.cal||2400,
      proteinGoal:s.goals?.protein||180,
      weight:latestBW||null,
      big3:getBest2("bench")+getBest2("squat")+getBest2("deadlift"),
      totalWorkouts:s.workouts.length,
      phase:(s.phases||[]).find(p=>p.active)?.type||null,
    });
  },[s.workouts.length,s.nutrition.length,s.body.length,s.onboarded,s.goals?.protein,s.goals?.cal,s.profile?.currentWeight,s.phases?.length]);

  // Capture beforeinstallprompt for smart install banner
  useEffect(()=>{
    const handler=(e)=>{e.preventDefault();setInstallPrompt(e);
      LS.set("ft-install-shown",true);
      if(parseInt(LS.get("ft-visits")||"0")>=3&&!LS.get("ft-install-dismissed"))setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  // Handle manifest shortcut deep links (hash routing)
  useEffect(()=>{
    const hash=window.location.hash.replace("#","");
    if(hash&&["log_workout","log_nutrition","log_body","plan_coach","track_readiness","plan_goals"].includes(hash)){
      d({type:"TAB",tab:hash});
      window.location.hash="";
    }
  },[]);

  // Handle /u/username routes (from 404.html SPA redirect)
  const [publicProfile,setPublicProfile]=useState(null);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const route=params.get("route");
    if(route){
      // Clean the URL without reloading
      window.history.replaceState(null,"",window.location.origin+window.location.pathname);
      // Parse /u/username
      const match=route.match(/^\/u\/([a-zA-Z0-9_]+)/);
      if(match){
        const username=match[1].toLowerCase();
        setPublicProfile({username,loading:true});
        SocialAPI.getProfile(username).then(data=>{
          if(data?.found)setPublicProfile({...data.profile,username,loading:false});
          else setPublicProfile({username,loading:false,notFound:true});
        }).catch(()=>setPublicProfile({username,loading:false,notFound:true}));
      }
      // Parse /add?code=IRON-XXXX (QR scan landing)
      const addMatch=route.match(/^\/add/);
      if(addMatch){
        // The ?code= param was preserved by 404.html redirect into the route param
        const codeFromRoute=new URLSearchParams(route.split("?")[1]||"").get("code");
        const codeFromSearch=params.get("code");
        // B3 fix: use "" fallback instead of "|" (was harmless but confusing)
        const finalCode=(codeFromRoute||codeFromSearch||"").toUpperCase();
        if(finalCode&&finalCode.startsWith("IRON-")){
          // B2 fix: don't navigate here — s.onboarded is always false in [] effect.
          // The [s.onboarded] Step 2 effect handles navigation once INIT fires.
          LS.set("ft-pending-add",finalCode);
        }
      }
    }
  },[]);

  // Listen for SW navigation messages (from notification action clicks)
  useEffect(()=>{
    const handler=(e)=>{
      if(e.data?.type==="NAVIGATE"&&e.data.tab){d({type:"TAB",tab:e.data.tab});}
    };
    navigator.serviceWorker?.addEventListener("message",handler);
    return()=>navigator.serviceWorker?.removeEventListener("message",handler);
  },[]);

  useEffect(()=>{
    (async()=>{
      try{
        const data={};
        ["ft-w","ft-n","ft-b","ft-ex","ft-g","ft-sched","ft-units","ft-onb","ft-photos","ft-profile","ft-checkins","ft-milestones","ft-phases","ft-injuries","ft-syncprefs","ft-a11y"].forEach(k=>{const v=LS.get(k);if(v!==null)data[k]=v;});
        const localOnboarded=data["ft-onb"]||false;
        // ── SSO: if not onboarded locally but SSO cookie exists, try silent login ──
        if(!localOnboarded&&!data["ft-session-token"]){
          const ssoToken=Cookie.get("ironlog_session");
          if(ssoToken){
            try{
              const vRes=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",
                headers:{"Content-Type":"application/json","X-Session-Token":ssoToken},
                body:JSON.stringify({action:"validate"})});
              const vJson=await vRes.json();
              if(vJson.valid&&vJson.email){
                // Valid SSO — pull data from cloud
                const deviceId=LS.get("ft-device-id")||uid();
                LS.set("ft-device-id",deviceId);
                LS.set("ft-session-token",ssoToken);
                LS.set("ft-session-email",vJson.email);
                const pull=await CloudSync.pull(vJson.email,deviceId,null);
                if(pull?.success&&pull?.data){
                  const cloud=pull.data;
                  d({type:"INIT",p:{
                    workouts:cloud.workouts||[],nutrition:cloud.nutrition||[],body:cloud.body||[],
                    exercises:cloud.exercises||defaultExercises,goals:cloud.goals||init.goals,
                    schedule:cloud.schedule||defaultSchedule,units:cloud.units||"lbs",
                    onboarded:true,photos:cloud.photos||[],profile:cloud.profile||init.profile,
                    checkins:cloud.checkins||[],milestones:cloud.milestones||[],
                    phases:cloud.phases||[],injuries:cloud.injuries||[],
                    syncPrefs:cloud.syncPrefs||init.syncPrefs,a11y:data["ft-a11y"]||init.a11y}});
                  return;
                }
              }
            }catch(e){/* SSO failed silently — fall through to normal boot */}
          }
        }
        d({type:"INIT",p:{workouts:data["ft-w"]||[],nutrition:data["ft-n"]||[],body:data["ft-b"]||[],
          exercises:data["ft-ex"]||defaultExercises,goals:data["ft-g"]||init.goals,schedule:data["ft-sched"]||defaultSchedule,
          units:data["ft-units"]||"lbs",onboarded:localOnboarded,photos:data["ft-photos"]||[],
          profile:data["ft-profile"]||init.profile,checkins:data["ft-checkins"]||[],milestones:data["ft-milestones"]||[],
          phases:data["ft-phases"]||[],injuries:data["ft-injuries"]||[],
          syncPrefs:data["ft-syncprefs"]||init.syncPrefs,a11y:data["ft-a11y"]||init.a11y}});
      }catch(e){
        d({type:"INIT",p:{exercises:defaultExercises,goals:init.goals,schedule:defaultSchedule}});
      }
    })();
  },[]);

  useEffect(()=>{
    if(!s.loaded)return;
    (async()=>{try{
      LS.set("ft-w",s.workouts);
      LS.set("ft-n",s.nutrition);
      LS.set("ft-b",s.body);
      LS.set("ft-ex",s.exercises);
      LS.set("ft-g",s.goals);
      LS.set("ft-sched",s.schedule);
      LS.set("ft-units",s.units);
      LS.set("ft-onb",s.onboarded);
      LS.set("ft-photos",s.photos);
      LS.set("ft-profile",s.profile);
      LS.set("ft-checkins",s.checkins||[]);
      LS.set("ft-milestones",s.milestones||[]);
      LS.set("ft-phases",s.phases||[]);
      LS.set("ft-injuries",s.injuries||[]);
      LS.set("ft-syncprefs",s.syncPrefs||init.syncPrefs);
      LS.set("ft-a11y",s.a11y||init.a11y);
      // Auto-sync to cloud (debounced)
      if(s.onboarded&&s.profile?.email){
        CloudSync.debouncedPush(s);
      }
    }catch(e){console.warn("Error:",e);}})();
  },[s.workouts,s.nutrition,s.body,s.exercises,s.goals,s.schedule,s.units,s.onboarded,s.photos,s.profile,s.checkins,s.milestones,s.phases,s.injuries,s.syncPrefs,s.a11y,s.loaded]);

  // Wire up MsgBannerCtrl ref so sync.js can show banners
  useEffect(()=>{setMsgBannerCtrlRef(MsgBannerCtrl);},[]);

  // Expose sync function for service worker background sync
  useEffect(()=>{
    if(s.loaded&&s.onboarded&&s.profile?.email){
      window.__ironlog_sync=()=>CloudSync.push(s);
    }
    return()=>{window.__ironlog_sync=null;};
  },[s.loaded,s.onboarded,s.profile?.email,s]);

  // Sync on app open — push local data to server
  useEffect(()=>{
    if(s.loaded&&s.onboarded&&s.profile?.email){
      CloudSync.push(s);
    }
  },[s.loaded,s.onboarded]);

  // Listen for service worker update
  const [updateAvailable,setUpdateAvailable]=useState(false);
  useEffect(()=>{
    const handler=(e)=>{if(e.data?.type==="UPDATE_AVAILABLE")setUpdateAvailable(true);};
    navigator.serviceWorker?.addEventListener("message",handler);
    return()=>navigator.serviceWorker?.removeEventListener("message",handler);
  },[]);

  // ─── Smart Notification Engine ───
  useEffect(()=>{
    if(!s.loaded||!s.onboarded||!LS.get("ft-reminders"))return;
    const hr=new Date().getHours();
    // Quiet hours
    if(hr>=22||hr<7)return;
    
    const td=today();
    const dow=new Date().getDay();
    const todayType=(s.schedule.overrides||{})[td]||(s.schedule.weekly||{})[dow]||"Rest";
    const hasWorkout=s.workouts.some(w=>w.date===td);
    const hasCheckin=(s.checkins||[]).some(c=>c.date===td);
    const todayNutrition=s.nutrition.find(n=>n.date===td);
    const hasMeals=todayNutrition?.meals?.some(m=>(m.items||[]).length>0);

    // Analyze user patterns for smart timing
    const recentWorkoutHours=s.workouts.slice(0,14).map(w=>{
      // Estimate workout time from date order (rough heuristic)
      return null; // Would need actual timestamps
    }).filter(Boolean);

    // Build notification queue based on time of day + what's missing
    const queue=[];
    const lastNotifKey=`ft-notif-${td}-${hr}`;
    if(LS.get(lastNotifKey))return; // Already notified this hour block

    if(hr>=6&&hr<=9&&!hasMeals){
      queue.push({tag:"meal-breakfast",body:"Good morning! Log your breakfast to stay on track.",
        actions:[{action:"log_nutrition",title:"Log Breakfast"},{action:"dismiss",title:"Later"}]});
    }
    if(hr>=11&&hr<=13&&todayNutrition&&!todayNutrition.meals?.find(m=>m.name==="Lunch"&&(m.items||[]).length>0)){
      queue.push({tag:"meal-lunch",body:"Lunchtime — log what you're eating to hit your macro goals.",
        actions:[{action:"log_nutrition",title:"Log Lunch"},{action:"dismiss",title:"Later"}]});
    }
    if(hr>=14&&hr<=17&&todayType!=="Rest"&&!hasWorkout){
      queue.push({tag:"workout-reminder",body:`${todayType} day — time to get after it!`,
        actions:[{action:"log_workout",title:"Log Workout"},{action:"dismiss",title:"Skip Today"}]});
    }
    if(hr>=17&&hr<=20&&todayNutrition&&!todayNutrition.meals?.find(m=>m.name==="Dinner"&&(m.items||[]).length>0)){
      queue.push({tag:"meal-dinner",body:"Don't forget to log dinner — you're close to your daily goals.",
        actions:[{action:"log_nutrition",title:"Log Dinner"},{action:"dismiss",title:"Later"}]});
    }
    if(hr>=19&&hr<=21&&!hasCheckin){
      queue.push({tag:"checkin-reminder",body:"Quick 30-sec check-in — how are you feeling today?",
        actions:[{action:"checkin",title:"Check In"},{action:"dismiss",title:"Later"}]});
    }
    if(hr>=13&&hr<=16){
      // B23 fix: also check quick-tap water widget for hydration notification
      const waterFromWidget=parseInt(LS.get("ft-water-"+today()))||0;
      const waterCups=Math.max(todayNutrition?.water||0,waterFromWidget);
      if(waterCups<4){
        queue.push({tag:"hydration",body:`You've logged ${waterCups} cups of water today. Stay hydrated!`,
          actions:[{action:"log_nutrition",title:"Log Water"},{action:"dismiss",title:"Done"}]});
      }
    }

    if(queue.length===0)return;
    LS.set(lastNotifKey,true);

    if("Notification" in window&&Notification.permission==="granted"&&navigator.serviceWorker?.controller){
      navigator.serviceWorker.ready.then(reg=>{
        // Send first queued notification (don't spam)
        const notif=queue[0];
        setTimeout(()=>reg.showNotification("IRONLOG",{
          body:notif.body,icon:"./icon.svg",badge:"./icon.svg",
          tag:notif.tag,vibrate:[100,50,100],
          actions:notif.actions
        }),2000);
      });
    }
  },[s.loaded,s.onboarded]);

  // ─── Web Push Subscription (for server-sent notifications) ───
  useEffect(()=>{
    if(!s.loaded||!s.onboarded||!s.profile?.email)return;
    if(!("serviceWorker" in navigator)||!("PushManager" in window))return;
    if(!LS.get("ft-reminders"))return; // Only subscribe if notifications enabled
    if(LS.get("ft-push-subscribed"))return;

    navigator.serviceWorker.ready.then(async(reg)=>{
      try{
        let sub=await reg.pushManager.getSubscription();
        if(!sub){
          const vapidKey="BMZyIUQO08nuR7afvqNIWBK_ZOcr7PHwT2YwIxTa_ONwAD1YCaJ8Qkb4q4TTYSx_sTN-7-5vCzR8ApNZuyg-Ttc";
          // Convert base64url to standard base64 for atob
          const keyBytes=Uint8Array.from(atob(vapidKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
          sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});
        }
        // Send subscription to backend
        const res=await fetch(`${SYNC_URL}/api/push`,{
          method:"POST",
          headers:AuthToken.getHeaders(s.profile.email),
          body:JSON.stringify({action:"subscribe",email:s.profile.email,subscription:sub.toJSON()}),
        });
        if(res.ok)LS.set("ft-push-subscribed",true);
        else console.warn("Push subscribe response:",await res.text());
      }catch(e){console.warn("Web Push subscription failed:",e.message||e);}
    });
  },[s.loaded,s.onboarded]);

  // ─── Interactive Guided Walkthrough ───
  const [guideStep,setGuideStep]=useState(LS.get("ft-guide-done")?-1:0);
  const [guideActive,setGuideActive]=useState(false);
  const [showFeatureHelp,setShowFeatureHelp]=useState(null);
  const [showGlobalCheckin,setShowGlobalCheckin]=useState(false);
  const [showNotifPrompt,setShowNotifPrompt]=useState(false);

  // Activate guide after onboarding completes (check each render)
  useEffect(()=>{
    if(s.onboarded&&!LS.get("ft-guide-done")&&guideStep>=0&&!guideActive)setGuideActive(true);
  },[s.onboarded]);

  const completeGuide=()=>{
    setGuideStep(-1);setGuideActive(false);LS.set("ft-guide-done",true);
    SuccessToastCtrl.show("You're all set! 💪");
    if(!LS.get("ft-notif-prompted"))setTimeout(()=>setShowNotifPrompt(true),600);
  };

  const guideSteps=[
    {id:"welcome",title:"Welcome to IRONLOG!",msg:"Let's walk through every section of the app. By the end you'll have real data logged and know where everything is.",icon:"🎉"},
    {id:"workout",title:"Log Your First Workout",msg:"Search for an exercise like Bench Press, add sets with weight and reps. The app auto-suggests progressive overload based on your history.",icon:"💪",
      action:()=>d({type:"TAB",tab:"log_workout"}),hint:"Search for an exercise and add some sets"},
    {id:"nutrition",title:"Track What You Ate",msg:"Search 200+ foods, scan a barcode, or add custom items. Your recent foods show as quick-add chips. Save favorite meals for one-tap logging.",icon:"🥗",
      action:()=>d({type:"TAB",tab:"log_nutrition"}),hint:"Search or scan to log your first meal"},
    {id:"body",title:"Record Your Starting Point",msg:"Enter your weight and measurements. These become your baseline — the app shows trend arrows and change over time.",icon:"📏",
      action:()=>d({type:"TAB",tab:"log_body"}),hint:"Enter your weight to set your starting point"},
    {id:"track",title:"Track Your Progress",msg:"Analytics, exercise progression charts, workout duration trends, muscle heat maps, strength scores, PRs page, volume tracking, and weekly summaries — all built from your logged data.",icon:"📊",
      action:()=>d({type:"TAB",tab:"track"}),hint:"Browse your charts and data — it grows as you log"},
    {id:"plan",title:"Your Training Toolkit",msg:"AI Coach gives daily programs. Schedule sets your weekly split. Programs offers PPL, 5/3/1, and more. Plus meal plans, fast food hacks, 1RM calculator, injury tracker, and goal engine.",icon:"📋",
      action:()=>d({type:"TAB",tab:"plan"}),hint:"Explore your training programs and tools"},
    {id:"social",title:"Connect With Friends",msg:"Add friends by code, username, or email. Compare stats, send messages, join groups with leaderboards and chat. Earn badges and climb challenge tiers.",icon:"👥",
      action:()=>d({type:"TAB",tab:"social"}),hint:"Set up your profile and add your first friend"},
    {id:"settings",title:"Customize Your Experience",msg:"Set daily goals, choose units, pick a theme, manage your schedule, edit exercises, and control privacy. Your data syncs automatically to the cloud.",icon:"⚙️",
      action:()=>d({type:"TAB",tab:"settings"}),hint:"Set your calorie and protein goals"},
    {id:"done",title:"You're Ready to Train!",msg:"You've seen everything. The app gets smarter as you use it — log consistently, check in daily, and watch your data build. Let's go!",icon:"🚀"},
  ];

  useEffect(()=>{
    if(!guideActive||guideStep<=0||guideStep>=guideSteps.length)return;
    const step=guideSteps[guideStep];
    if(step.action)step.action();
  },[guideStep,guideActive]);

  const handleNotifAccept=async()=>{
    LS.set("ft-notif-prompted",true);
    if("Notification" in window){
      const perm=await Notification.requestPermission();
      if(perm==="granted"){
        LS.set("ft-reminders",true);
        SuccessToastCtrl.show("Notifications enabled");
        if("serviceWorker" in navigator&&"PushManager" in window){
          navigator.serviceWorker.ready.then(async(reg)=>{
            try{
              const vk="BMZyIUQO08nuR7afvqNIWBK_ZOcr7PHwT2YwIxTa_ONwAD1YCaJ8Qkb4q4TTYSx_sTN-7-5vCzR8ApNZuyg-Ttc";
              const keyBytes=Uint8Array.from(atob(vk.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
              let sub=await reg.pushManager.getSubscription();
              if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});
              const res=await fetch(`${SYNC_URL}/api/push`,{method:"POST",
                headers:AuthToken.getHeaders(s.profile?.email||""),
                body:JSON.stringify({action:"subscribe",email:s.profile?.email,subscription:sub.toJSON()})});
              if(res.ok){LS.set("ft-push-subscribed",true);}
              // Welcome notification
              reg.showNotification("IRONLOG",{
                body:"You're all set — we'll send smart reminders for workouts, meals, and check-ins.",
                icon:"./icon.svg",badge:"./icon.svg",tag:"welcome"
              });
            }catch(e){console.warn("Push subscribe failed:",e.message||e);}
          });
        }
      }
    }
    setShowNotifPrompt(false);
  };

  const handleNotifDecline=()=>{
    LS.set("ft-notif-prompted",true);
    setShowNotifPrompt(false);
  };

  // Show onboarding if first launch
  if(s.loaded&&!s.onboarded) return <Onboarding d={d}/>;

  // Back button component for sub-pages
  const SubBack=({to,label})=>(
    <button onClick={()=>d({type:"TAB",tab:to})} style={{background:"none",border:"none",display:"flex",alignItems:"center",
      gap:5,padding:"8px 0 12px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
      {Icons.chevLeft({size:18,color:V.accent})}
      <span style={{fontSize:14,color:V.accent,fontWeight:600}}>{label||"Back"}</span>
    </button>
  );

  // Map tab to parent for bottom nav highlighting
  const tabParent=(t)=>{
    if(t.startsWith("log_"))return"log";
    if(t.startsWith("track_"))return"track";
    if(t.startsWith("plan_"))return"plan";
    if(t.startsWith("social_"))return"social";
    if(t.startsWith("admin_"))return"admin";
    return t;
  };
  const activeParent=tabParent(s.tab);

  const tabs=[
    {id:"home",icon:Icons.activity,label:"Home"},
    {id:"log",icon:Icons.plus,label:"Log"},
    {id:"track",icon:Icons.chart,label:"Track"},
    {id:"plan",icon:Icons.calendar,label:"Plan"},
    {id:"social",icon:Icons.target,label:"Social",badge:unreadMsgCount+socialNotifCount},
    {id:"settings",icon:Icons.sliders,label:"Settings"},
    ...(isAdmin?[{id:"admin",icon:Icons.zap,label:"Admin"}]:[]),
  ];

  const a11y=s.a11y||{};

  return(
    <div style={{
      height:"100%",maxWidth:isDesktop?"100%":430,margin:"0 auto",background:a11y.highContrast?"#000":V.bg,
      color:a11y.highContrast?"#fff":V.text,fontFamily:V.font,
      display:"flex",flexDirection:"column",position:"relative",
      fontSize:a11y.largeText?"17px":"16px",
      marginLeft:isDesktop?220:undefined,
      ...(a11y.reduceMotion?{transition:"none"}:{}),
    }}>

      {/* Desktop Sidebar Navigation */}
      {isDesktop&&(
        <nav style={{
          position:"fixed",left:0,top:0,bottom:0,width:220,background:V.navBg,
          backdropFilter:"blur(24px) saturate(180%)",borderRight:`1px solid rgba(255,255,255,0.06)`,
          display:"flex",flexDirection:"column",padding:"24px 0",zIndex:100,overflowY:"auto",
        }}>
          <button onClick={()=>d({type:"TAB",tab:"home"})} style={{display:"flex",alignItems:"center",gap:10,
            background:"none",border:"none",cursor:"pointer",padding:"12px 20px",marginBottom:20,WebkitTapHighlightColor:"transparent"}}>
            <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {Icons.activity({size:17,color:V.bg,strokeWidth:2.5})}
            </div>
            <span style={{fontSize:18,fontWeight:800,letterSpacing:"-0.03em",color:V.text}}>
              IRON<span style={{color:V.accent}}>LOG</span>
            </span>
          </button>
          {tabs.map(t=>{
            const active=activeParent===t.id;
            return(
              <button key={t.id} onClick={()=>{d({type:"TAB",tab:t.id});}} style={{
                display:"flex",alignItems:"center",gap:12,padding:"10px 20px",
                background:active?`${V.accent}12`:"transparent",
                border:"none",cursor:"pointer",width:"100%",
                borderLeft:active?`3px solid ${V.accent}`:"3px solid transparent",
                WebkitTapHighlightColor:"transparent",transition:"all .15s",
              }}>
                <div style={{width:22,display:"flex",justifyContent:"center"}}>
                  {t.id==="log"?(
                    <div style={{width:22,height:22,borderRadius:"50%",
                      background:active?V.accent:"rgba(255,255,255,0.12)",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {Icons.plus({size:12,color:active?V.bg:V.text3,strokeWidth:3})}
                    </div>
                  ):(
                    t.icon({size:20,color:active?V.accent:V.text3,strokeWidth:active?2.2:1.6})
                  )}
                </div>
                <span style={{fontSize:13,fontWeight:active?700:500,color:active?V.accent:V.text2,
                  fontFamily:V.font}}>{t.label}</span>
                {t.badge>0&&(
                  <div style={{marginLeft:"auto",minWidth:18,height:18,borderRadius:9,
                    background:V.danger,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px"}}>
                    <span style={{fontSize:9,fontWeight:800,color:"#fff",fontFamily:V.mono}}>{t.badge>9?"9+":t.badge}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Status Bar Area */}
      <div style={{height:"env(safe-area-inset-top, 0px)",background:V.bg,flexShrink:0}}/>

      {/* Header */}
      <div style={{padding:isDesktop?"12px 40px 10px":"12px 20px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        {!isDesktop&&<button onClick={()=>d({type:"TAB",tab:"home"})} style={{display:"flex",alignItems:"center",gap:8,
          background:"none",border:"none",cursor:"pointer",padding:0,WebkitTapHighlightColor:"transparent"}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {Icons.activity({size:15,color:V.bg,strokeWidth:2.5})}
          </div>
          <span style={{fontSize:17,fontWeight:800,letterSpacing:"-0.03em",color:V.text}}>
            IRON<span style={{color:V.accent}}>LOG</span>
          </span>
        </button>}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {/* Daily check-in chip */}
          {(()=>{const ciDone=(s.checkins||[]).some(c=>c.date===today());return(
            <button onClick={()=>setShowGlobalCheckin(true)} style={{
              display:"flex",alignItems:"center",gap:4,padding:"5px 9px",borderRadius:8,
              border:`1px solid ${ciDone?V.accent+"30":V.accent+"60"}`,
              background:ciDone?`${V.accent}08`:`${V.accent}14`,
              cursor:"pointer",WebkitTapHighlightColor:"transparent",
              animation:ciDone?"none":"checkinPulse 2.5s ease-in-out infinite",
            }}>
              <span style={{fontSize:11}}>{ciDone?"✅":"🫀"}</span>
              <span style={{fontSize:9,fontWeight:700,color:V.accent,letterSpacing:".03em"}}>{ciDone?"Done":"Check In"}</span>
            </button>
          );})()}
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

      {/* Update available banner */}
      {updateAvailable&&(
        <div style={{padding:"8px 20px",background:`${V.accent}12`,borderBottom:`1px solid ${V.accent}25`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <span style={{fontSize:11,color:V.accent,fontWeight:600}}>New version available</span>
          <button onClick={()=>{navigator.serviceWorker?.controller?.postMessage({type:"SKIP_WAITING"});window.location.reload();}}
            style={{padding:"4px 12px",borderRadius:6,background:V.accent,border:"none",cursor:"pointer",
              fontSize:10,fontWeight:700,color:V.bg,fontFamily:V.font}}>Update</button>
        </div>
      )}

      {/* Install app banner */}
      {showInstallBanner&&installPrompt&&(
        <div style={{padding:"10px 20px",background:"linear-gradient(135deg,rgba(0,245,160,0.08),rgba(0,217,245,0.08))",
          borderBottom:`1px solid rgba(0,245,160,0.15)`,
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
      {/* #4: iOS install guide (no install prompt on iOS) */}
      {!installPrompt&&!LS.get("ft-installed")&&!LS.get("ft-install-dismissed")&&/iPhone|iPad/.test(navigator.userAgent)&&!navigator.standalone&&s.onboarded&&s.workouts.length>=2&&(
        <div style={{padding:"10px 20px",background:"linear-gradient(135deg,rgba(0,245,160,0.08),rgba(0,217,245,0.08))",
          borderBottom:`1px solid rgba(0,245,160,0.15)`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text}}>Add to Home Screen</div>
            <div style={{fontSize:9,color:V.text3}}>Get the full app experience</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowInstallGuide(true)} style={{padding:"6px 14px",borderRadius:8,background:V.accent,border:"none",cursor:"pointer",
              fontSize:11,fontWeight:700,color:V.bg,fontFamily:V.font}}>How</button>
            <button onClick={()=>{LS.set("ft-install-dismissed",true);}}
              style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"none",
                cursor:"pointer",fontSize:11,color:V.text3}}>✕</button>
          </div>
        </div>
      )}

      {/* Update available banner */}
      {showUpdateBanner&&updateVersion&&(
        <div style={{padding:"10px 20px",background:"linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,107,107,0.08))",
          borderBottom:`1px solid rgba(250,204,21,0.15)`,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{flex:1}} onClick={()=>setShowUpdateGuide(true)}>
            <div style={{fontSize:12,fontWeight:700,color:V.warn}}>Update Available — v{updateVersion}</div>
            <div style={{fontSize:9,color:V.text3}}>Tap to update to the latest version</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowUpdateGuide(true)} style={{padding:"6px 14px",borderRadius:8,
              background:V.warn,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:V.bg,fontFamily:V.font}}>Update</button>
            <button onClick={()=>{setShowUpdateBanner(false);LS.set("ft-update-dismissed",updateVersion);}}
              style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"none",
                cursor:"pointer",fontSize:11,color:V.text3}}>✕</button>
          </div>
        </div>
      )}

      {/* Update walkthrough guide */}
      {showUpdateGuide&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(6px)"}} onClick={()=>setShowUpdateGuide(false)}/>
          <div style={{position:"relative",background:V.sheetBg,borderRadius:20,
            padding:24,maxWidth:360,width:"100%",border:`1px solid ${V.warn}25`,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:36,marginBottom:8}}>🚀</div>
              <div style={{fontSize:18,fontWeight:800,color:V.text}}>IRONLOG v{updateVersion}</div>
              <div style={{fontSize:12,color:V.text3,marginTop:4}}>A new version is ready</div>
              {updateNotes&&<div style={{fontSize:11,color:V.accent,marginTop:8,padding:"8px 12px",
                background:`${V.accent}08`,borderRadius:8,textAlign:"left",lineHeight:1.5}}>{updateNotes}</div>}
            </div>

            <div style={{fontSize:13,fontWeight:700,color:V.warn,marginBottom:12}}>Before updating:</div>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}12`,display:"flex",alignItems:"center",
                  justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:800,color:V.accent}}>1</span>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text}}>Back up your data</div>
                  <div style={{fontSize:11,color:V.text3,marginTop:2,lineHeight:1.5}}>Go to Settings → Backup & Restore → Export JSON. This saves all your workouts, nutrition, and measurements.</div>
                  <button onClick={()=>{d({type:"TAB",tab:"settings"});setShowUpdateGuide(false);}}
                    style={{marginTop:6,padding:"6px 12px",borderRadius:6,background:`${V.accent}10`,border:`1px solid ${V.accent}25`,
                      cursor:"pointer",fontSize:10,fontWeight:600,color:V.accent,fontFamily:V.font}}>Go to Settings →</button>
                </div>
              </div>

              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}12`,display:"flex",alignItems:"center",
                  justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:800,color:V.accent}}>2</span>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text}}>Cloud sync is automatic</div>
                  <div style={{fontSize:11,color:V.text3,marginTop:2,lineHeight:1.5}}>Your data is already synced to the cloud. After updating, it will restore automatically when you sign in with the same email.</div>
                </div>
              </div>

              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}12`,display:"flex",alignItems:"center",
                  justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:800,color:V.accent}}>3</span>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text}}>Refresh the app</div>
                  <div style={{fontSize:11,color:V.text3,marginTop:2,lineHeight:1.5}}>
                    {/iPhone|iPad/.test(navigator.userAgent)?
                      "Close IRONLOG completely (swipe up from app switcher), then reopen from your home screen. Safari may also need a force refresh: long-press the refresh button → Request Desktop Site → then back to Mobile."
                      :"Pull down to refresh, or close and reopen the app. In Chrome you can also go to Settings → Clear site data to force the update."}
                  </div>
                </div>
              </div>

              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}12`,display:"flex",alignItems:"center",
                  justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:800,color:V.accent}}>4</span>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text}}>Restore if needed</div>
                  <div style={{fontSize:11,color:V.text3,marginTop:2,lineHeight:1.5}}>After the update loads, go to Settings → Backup & Restore → Restore from Cloud to pull all your data back.</div>
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:8,marginTop:18}}>
              <Btn v="secondary" full onClick={()=>setShowUpdateGuide(false)}>Later</Btn>
              <Btn full onClick={()=>{
                LS.set("ft-update-dismissed",updateVersion);
                // Force reload to get new service worker
                if('serviceWorker' in navigator){
                  navigator.serviceWorker.getRegistration().then(reg=>{if(reg)reg.update();});
                }
                window.location.reload(true);
              }} s={{background:V.warn}}>Update Now</Btn>
            </div>

            <div style={{fontSize:9,color:V.text3,textAlign:"center",marginTop:10}}>
              Current: v{APP_VERSION} → New: v{updateVersion}
            </div>
          </div>
        </div>
      )}

      {/* #1: Offline indicator */}
      {!isOnline&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"6px 12px",
          background:`${V.danger}12`,borderBottom:`1px solid ${V.danger}25`}}>
          <div style={{width:6,height:6,borderRadius:3,background:V.danger,animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:10,fontWeight:600,color:V.danger}}>Offline — changes will sync when reconnected</span>
        </div>
      )}

      {/* Content — scrollable region */}
      <div ref={contentRef} role="main" aria-label="App content"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
        style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden",
        WebkitOverflowScrolling:"touch",padding:isDesktop?"0 40px 24px":"0 16px 24px",
        overscrollBehavior:"contain"}}>
        {s.tab==="home"&&<HomeTab s={s} d={d}/>}
        {s.tab==="log"&&<LogHub s={s} d={d}/>}
        {s.tab==="track"&&<TrackHub s={s} d={d}/>}
        {s.tab==="plan"&&<PlanHub s={s} d={d}/>}
        {s.tab==="settings"&&<SettingsTab s={s} d={d} isAdmin={isAdmin}/>}

        {/* Log sub-pages */}
        {s.tab==="log_workout"&&<div><SubBack to="log" label="Log"/><WorkoutTab s={s} d={d}/></div>}
        {s.tab==="log_nutrition"&&<div><SubBack to="log" label="Log"/><NutritionTab s={s} d={d}/></div>}
        {s.tab==="log_body"&&<div><SubBack to="log" label="Log"/><BodyTab s={s} d={d}/></div>}

        {/* Track sub-pages */}
        {s.tab==="track_calendar"&&<div><SubBack to="track" label="Track"/><CalendarTab s={s} d={d}/></div>}
        {s.tab==="track_workouts"&&<div><SubBack to="track" label="Track"/><WorkoutTab s={s} d={d}/></div>}
        {s.tab==="track_nutrition"&&<div><SubBack to="track" label="Track"/><NutritionTab s={s} d={d}/></div>}
        {s.tab==="track_body"&&<div><SubBack to="track" label="Track"/><BodyTab s={s} d={d}/></div>}
        {s.tab==="track_photos"&&<div><SubBack to="track" label="Track"/><ProgressPhotos s={s} d={d}/></div>}
        {s.tab==="track_analytics"&&<div><SubBack to="track" label="Track"/><AnalyticsTab s={s} d={d}/></div>}
        {s.tab==="track_goals"&&<div><SubBack to="track" label="Track"/><GoalEngine s={s} d={d}/></div>}
        {s.tab==="track_coach"&&<div><SubBack to="track" label="Track"/><AdaptiveCoach s={s}/></div>}
        {s.tab==="track_readiness"&&<div><SubBack to="track" label="Track"/><ReadinessTrend s={s}/></div>}
        {s.tab==="track_muscles"&&<div><SubBack to="track" label="Track"/><MuscleHeatMap s={s}/></div>}
        {s.tab==="track_volume"&&<div><SubBack to="track" label="Track"/><VolumeTracker s={s}/></div>}
        {s.tab==="track_exercise_chart"&&<div><SubBack to="track" label="Track"/><ExerciseChart s={s}/></div>}
        {s.tab==="track_duration"&&<div><SubBack to="track" label="Track"/><DurationTrends s={s}/></div>}
        {s.tab==="track_strength"&&<div><SubBack to="track" label="Track"/><StrengthScoreCard s={s}/></div>}
        {s.tab==="track_formcheck"&&<div><SubBack to="track" label="Track"/><FormCheckTab s={s} d={d}/></div>}
        {s.tab==="track_phases"&&<div><SubBack to="track" label="Track"/><PhaseTracker s={s} d={d}/></div>}
        {s.tab==="track_injuries"&&<div><SubBack to="track" label="Track"/><InjuryManager s={s} d={d}/></div>}
        {s.tab==="track_subs"&&<div><SubBack to="track" label="Track"/><SubstitutionFinder s={s}/></div>}
        {s.tab==="track_dataguard"&&<div><SubBack to="track" label="Track"/><DataGuardTab s={s} d={d}/></div>}
        {s.tab==="track_summary"&&<div><SubBack to="track" label="Track"/><WeeklySummary s={s}/></div>}
        {s.tab==="track_onerm"&&<div><SubBack to="track" label="Track"/><OneRMCalc units={s.units}/></div>}
        {s.tab==="track_fastfood"&&<div><SubBack to="track" label="Track"/><FastFoodHacks s={s} d={d}/></div>}
        {s.tab==="track_mealplan"&&<div><SubBack to="track" label="Track"/><MealPlanGenerator s={s}/></div>}
        {s.tab==="track_programs"&&<div><SubBack to="track" label="Track"/><ProgramMarketplace s={s} d={d}/></div>}
        {s.tab==="track_supplements"&&<div><SubBack to="track" label="Track"/><SupplementTracker s={s} d={d}/></div>}
        {s.tab==="track_compare"&&<div><SubBack to="track" label="Track"/><PhotoCompare s={s}/></div>}
        {s.tab==="track_prs"&&<div><SubBack to="track" label="Track"/><PersonalRecords s={s}/></div>}
        {s.tab==="track_aichat"&&<div><SubBack to="track" label="Track"/><AICoachChat s={s}/></div>}

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
        {s.tab==="admin_panel"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPanel s={s} initialView="dashboard"/></div>}
        {s.tab==="admin_dashboard"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPanel s={s} initialView="dashboard"/></div>}
        {s.tab==="admin_users"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPanel s={s} initialView="users"/></div>}
        {s.tab==="admin_lookup"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPanel s={s} initialView="lookup"/></div>}
        {s.tab==="admin_moderation"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPanel s={s} initialView="moderation"/></div>}
        {s.tab==="admin_health"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPanel s={s} initialView="health"/></div>}
        {s.tab==="admin_push"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminPush s={s} d={d}/></div>}
        {s.tab==="admin_xp"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminXPManager s={s}/></div>}
        {s.tab==="admin_biz"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminBusinessValue s={s}/></div>}
        {s.tab==="admin_audit"&&isAdmin&&<div><SubBack to="admin" label="Admin"/><AdminUserAudit s={s}/></div>}

        {s.tab==="admin"&&isAdmin&&<AdminHub s={s} d={d}/>}

        {/* Social tab + sub-pages */}
        {s.tab==="social"&&<SocialTab s={s} d={d} unreadMsgCount={unreadMsgCount}/>}
        {s.tab==="social_feed"&&<div><SubBack to="social" label="Social"/><SocialFeed s={s} d={d}/></div>}
        {s.tab==="social_messages"&&<div><MessagesTab s={s} d={d}/></div>}
        {s.tab==="social_friends"&&<div><SubBack to="social" label="Social"/><SocialFriends s={s} d={d}/></div>}
        {s.tab==="social_groups"&&<div><SubBack to="social" label="Social"/><SocialGroups s={s} d={d}/></div>}
        {s.tab==="social_challenges"&&<div><SubBack to="social" label="Social"/><SocialChallenges s={s} d={d}/></div>}
        {s.tab==="social_profile"&&<div><SubBack to="social" label="Social"/><SocialProfile s={s} d={d}/></div>}
        {s.tab==="social_badges"&&<div><SubBack to="social" label="Social"/><SocialBadges s={s}/></div>}
        {s.tab==="social_notifications"&&<div><SubBack to="social" label="Social"/><SocialNotifications s={s} d={d}/></div>}
        {s.tab==="social_compare"&&<div><SubBack to="social" label="Social"/><SocialCompare s={s}/></div>}
        {s.tab==="social_leaderboard"&&<div><SubBack to="social" label="Social"/><SocialLeaderboard s={s} d={d}/></div>}
        {s.tab==="social_ironscore"&&<div><SubBack to="social" label="Social"/><SocialIronScore s={s} d={d}/></div>}
        {s.tab==="social_duels"&&<div><SubBack to="social" label="Social"/><SocialDuels s={s} d={d}/></div>}
        {s.tab==="social_wars"&&<div><SubBack to="social" label="Social"/><SocialWeeklyWar s={s} d={d}/></div>}
        {s.tab==="social_rivals"&&<div><SubBack to="social" label="Social"/><SocialRivals s={s} d={d}/></div>}

        {/* Global footer on every page */}

      {/* Public Profile Overlay — shown when someone opens /u/username */}
      {publicProfile&&!publicProfile.loading&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.9)",backdropFilter:"blur(8px)"}} onClick={()=>setPublicProfile(null)}/>
          <div style={{position:"relative",background:V.sheetBg,borderRadius:20,
            padding:24,maxWidth:360,width:"100%",border:`1px solid ${V.accent}25`,maxHeight:"85vh",overflowY:"auto"}}>
            {publicProfile.notFound?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                <div style={{fontSize:16,fontWeight:800,color:V.text}}>User Not Found</div>
                <div style={{fontSize:12,color:V.text3,marginTop:4}}>@{publicProfile.username} doesn't exist or hasn't set up their profile.</div>
                <Btn full onClick={()=>setPublicProfile(null)} s={{marginTop:16}}>Close</Btn>
              </div>
            ):(
              <div style={{textAlign:"center"}}>
                {/* Avatar */}
                <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${V.accent},#ec4899)`,
                  display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
                  <span style={{fontSize:28,color:V.bg,fontWeight:900}}>{publicProfile.username?.[0]?.toUpperCase()}</span>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:V.text}}>{publicProfile.name||publicProfile.username}</div>
                <div style={{fontSize:12,color:V.text3}}>@{publicProfile.username}</div>
                {publicProfile.bio&&<div style={{fontSize:11,color:V.text2,marginTop:6,lineHeight:1.5}}>{publicProfile.bio}</div>}

                {/* Badges */}
                {publicProfile.badges?.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",margin:"12px 0"}}>
                    {publicProfile.badges.map((b,i)=><span key={i} style={{padding:"3px 8px",borderRadius:6,
                      background:`${V.accent}08`,border:`1px solid ${V.accent}20`,fontSize:10,color:V.accent,fontWeight:600}}>{b}</span>)}
                  </div>
                )}

                {/* Challenge stats */}
                {publicProfile.challenges?.length>0&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,margin:"12px 0"}}>
                    {publicProfile.challenges.map((c,i)=>(
                      <div key={i} style={{padding:"8px 4px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
                        <div style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{c.value}</div>
                        <div style={{fontSize:8,color:V.text3,textTransform:"uppercase"}}>{c.challenge_id}</div>
                        {c.tier&&<div style={{fontSize:8,color:V.warn}}>{c.tier}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Public stats */}
                {publicProfile.stats?.workoutCount&&(
                  <div style={{fontSize:11,color:V.text3,marginTop:4}}>{publicProfile.stats.workoutCount} workouts logged</div>
                )}

                <div style={{fontSize:10,color:V.text3,marginTop:8}}>Member since {fmtShort(publicProfile.joined?.split("T")[0])}</div>

                {/* Actions */}
                <div style={{display:"flex",gap:8,marginTop:16}}>
                  <Btn v="secondary" full onClick={()=>setPublicProfile(null)}>Close</Btn>
                  {s.profile?.email?(
                    <Btn full onClick={async()=>{
                      const r=await SocialAPI.sendRequest(s.profile.email,publicProfile.username+"@ironlog.space");
                      if(r?.success)SuccessToastCtrl.show("Friend request sent!");
                      else SuccessToastCtrl.show(r?.error||"Could not send request");
                    }}>Add Friend</Btn>
                  ):(
                    <Btn full onClick={()=>{setPublicProfile(null);/* They need to sign up first */}}>Join IRONLOG</Btn>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {publicProfile?.loading&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,.9)"}}>
          <div style={{textAlign:"center",color:V.text}}>
            <div style={{width:24,height:24,borderRadius:12,border:`2px solid ${V.accent}`,borderTopColor:"transparent",
              animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
            <div style={{fontSize:12}}>Loading @{publicProfile.username}...</div>
          </div>
        </div>
      )}
        <Footer/>
      </div>

      {/* Bottom Nav — visible on mobile/tablet only */}
      {!isDesktop&&<nav role="navigation" aria-label="Main navigation" style={{
        flexShrink:0,background:V.navBg,backdropFilter:"blur(24px) saturate(180%)",
        borderTop:`1px solid rgba(255,255,255,0.06)`,
        paddingBottom:"env(safe-area-inset-bottom, 8px)",
        display:"flex",justifyContent:"space-around",alignItems:"center",paddingTop:8,
        position:"relative",zIndex:50,
      }}>
        {tabs.map(t=>{
          const active=activeParent===t.id;
          return(
            <button key={t.id} onClick={()=>{Haptic.light();d({type:"TAB",tab:t.id});}} aria-label={t.label} aria-current={active?"page":undefined} style={{
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              background:"none",border:"none",cursor:"pointer",
              padding:"6px 16px",minWidth:64,
              WebkitTapHighlightColor:"transparent",transition:"all .15s",
            }}>
              <div style={{
                width:active?42:36,height:active?42:36,borderRadius:active?14:12,position:"relative",
                background:active?`${V.accent}18`:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",
                transition:"all .2s ease",
              }}>
                {t.id==="log"?(
                  <div style={{width:active?26:22,height:active?26:22,borderRadius:"50%",
                    background:active?V.accent:"rgba(255,255,255,0.12)",
                    display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                    {Icons.plus({size:active?14:12,color:active?V.bg:V.text3,strokeWidth:3})}
                  </div>
                ):(
                  t.icon({size:active?22:20,color:active?V.accent:V.text3,strokeWidth:active?2.2:1.6})
                )}
                {t.badge>0&&(
                  <div style={{position:"absolute",top:0,right:active?2:4,minWidth:16,height:16,borderRadius:8,
                    background:V.danger,border:`2px solid ${V.navBg}`,display:"flex",alignItems:"center",justifyContent:"center",
                    padding:"0 4px"}}>
                    <span style={{fontSize:8,fontWeight:800,color:"#fff",fontFamily:V.mono}}>{t.badge>9?"9+":t.badge}</span>
                  </div>
                )}
              </div>
              <span style={{fontSize:10,fontWeight:active?700:500,color:active?V.accent:V.text3,
                fontFamily:V.font,letterSpacing:".02em"}}>{t.label}</span>
            </button>
          );
        })}
      </nav>}
      <UndoToast d={d}/>
      <SuccessToast/>
      <GlobalConfirm/>
      <MessageBanner onTap={(msg)=>{
        if(msg.type==="dm"){d({type:"TAB",tab:"social_messages"});}
        else if(msg.type==="group"){d({type:"TAB",tab:"social_groups"});}
      }}/>
      {/* Iron Score: Level-Up Celebration + Notification Checks */}
      {s.onboarded&&<GamificationOverlay s={s}/>}
      {/* Interactive Guide Overlay */}
      {guideActive&&guideStep>=0&&guideStep<guideSteps.length&&(()=>{
        const step=guideSteps[guideStep];
        const isFirst=guideStep===0;
        const isLast=guideStep===guideSteps.length-1;
        return(
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:1800,
            background:"linear-gradient(transparent 0%,rgba(0,0,0,0.92) 25%)",
            padding:"50px 20px 20px",paddingBottom:"max(20px, env(safe-area-inset-bottom))"}}>
            {/* Progress bar */}
            <div style={{display:"flex",gap:3,marginBottom:12}}>
              {guideSteps.map((_,i)=>(
                <div key={i} style={{flex:1,height:3,borderRadius:2,
                  background:i<guideStep?V.accent:i===guideStep?"rgba(0,245,160,0.6)":"rgba(255,255,255,0.08)",
                  transition:"all .3s"}}/>
              ))}
            </div>
            {/* Action hint */}
            {step.hint&&!isFirst&&!isLast&&(
              <div style={{padding:"8px 12px",marginBottom:10,borderRadius:8,
                background:`${V.accent}08`,border:`1px solid ${V.accent}20`,
                display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:6,height:6,borderRadius:3,background:V.accent,flexShrink:0,animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:11,color:V.accent,fontWeight:600}}>{step.hint}</span>
              </div>
            )}
            {/* Content */}
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{fontSize:28,flexShrink:0}}>{step.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:V.text,marginBottom:2}}>{step.title}</div>
                <div style={{fontSize:12,color:V.text3,lineHeight:1.5}}>{step.msg}</div>
              </div>
            </div>
            {/* Buttons */}
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
            {!isFirst&&!isLast&&(
              <button onClick={completeGuide} style={{width:"100%",marginTop:8,padding:6,background:"none",
                border:"none",cursor:"pointer",fontSize:10,color:V.text3,fontFamily:V.font}}>
                I know my way around — skip guide
              </button>
            )}
          </div>
        );
      })()}

      {/* Global Check-in Modal */}
      {showGlobalCheckin&&<CheckinModal s={s} d={d} onClose={()=>setShowGlobalCheckin(false)}/>}

      {/* Feature Help — "Show me how" bottom sheet */}
      {showFeatureHelp&&(()=>{
        const helps={
          home:[{l:"Readiness Score",d:"Daily recovery score based on check-ins, sleep, soreness, and training load."},
            {l:"Streak",d:"Consecutive days with logged workouts. Shows your record and how close you are to beating it."},
            {l:"Today's Plan",d:"Shows your scheduled workout with exercise list. One tap to start."},
            {l:"Accountability",d:"Partner nudges if you miss 2+ days. Set a partner in Friends."},
            {l:"Quick Actions",d:"Jump to log workout, nutrition, or weigh-in."}],
          log:[{l:"Workout Logger",d:"Add exercises, sets, weight, reps, RPE. Auto-fills with progressive overload suggestion. Shows last session's sets before adding."},
            {l:"Nutrition",d:"200+ foods, barcode scanner, custom items. Recent foods as quick-add chips. Save favorite meals for one-tap logging."},
            {l:"Body Metrics",d:"Weight, body fat, measurements. Trend arrows show changes. Copy yesterday for daily tracking."}],
          track:[{l:"Workouts",d:"Full history with share cards. PR tracking per exercise."},
            {l:"PRs Page",d:"Every exercise PR with weight×reps, E1RM, date, and how close your recent lifts are."},
            {l:"Exercise Chart",d:"Select any exercise — see weight and E1RM over time as a line chart."},
            {l:"Duration Trends",d:"Average, longest, shortest workout times. Bar chart with trend line."},
            {l:"Volume Tracker",d:"Weekly sets per muscle group with recommended ranges (10-20 sets)."},
            {l:"Analytics",d:"Trends, readiness, strength score with per-lift standards (Beginner → Elite)."},
            {l:"Heat Map",d:"Visual muscle balance — see which muscles are overworked or neglected."},
            {l:"Compare",d:"Side-by-side before/after progress photos with time span."},
            {l:"Weekly Report",d:"Shareable summary card of your week's training, nutrition, and readiness."}],
          plan:[{l:"AI Coach",d:"Generates today's workout based on schedule, readiness, and progressive overload."},
            {l:"AI Chat",d:"Ask your coach anything. Has full context: phase, injuries, schedule, streak."},
            {l:"Programs",d:"PPL, 5/3/1, PHUL, nSuns, Bro Split, Full Body — with full exercise lists."},
            {l:"Schedule",d:"Set your weekly split. Supports overrides for individual days."},
            {l:"Phase Tracker",d:"Cut, bulk, maintenance tracking with date ranges."},
            {l:"Meal Plan",d:"Auto-generated daily meals hitting your macro targets."},
            {l:"Fast Food Hacks",d:"High-protein orders from 10+ chains with macro breakdowns."},
            {l:"Supplements",d:"Daily checklist for creatine, protein, vitamins, etc."},
            {l:"Goals",d:"Weight, strength, or custom targets with deadline tracking."},
            {l:"1RM Calculator",d:"Estimate max from any weight × reps."},
            {l:"Injury Manager",d:"Track injuries with affected areas. AI Coach adapts around them."},
            {l:"Substitutions",d:"Find alternative exercises for any movement."},
            {l:"Form Check",d:"Record and review exercise form with video."},
            {l:"Data Guard",d:"Catches suspicious data — weight jumps, duplicate entries, outliers."}],
          social:[{l:"Feed",d:"Your stats, friend activity, PR celebrations, and quick messages."},
            {l:"Friends",d:"Add by friend code, username, or email. Tap to see profile or chat."},
            {l:"DM Chat",d:"Private 1-on-1 messages with friends. 200 character limit. Quick reply chips."},
            {l:"Groups",d:"Create or join crews by code. Leaderboards, challenges, feed, and group chat."},
            {l:"Challenges",d:"Tiered badges: Streak, Big 3, Macro Master. Weekly rotating challenges."},
            {l:"Compare",d:"Side-by-side stat comparison with any friend."},
            {l:"Profile",d:"QR code, friend code, username, and privacy controls."},
            {l:"Badges",d:"Achievement collection from your training milestones."}],
          settings:[{l:"Theme",d:"Dark or light mode. Instant switch, no reload needed."},
            {l:"Units",d:"Switch between lbs and kg globally."},
            {l:"Goals",d:"Set daily calorie, protein, carbs, fat, TDEE, and workouts per week targets."},
            {l:"Schedule",d:"Configure your weekly training split."},
            {l:"Exercise Library",d:"Add custom exercises with category and YouTube links."},
            {l:"Profile",d:"Edit name, age, fitness level, and account details."},
            {l:"Backup & Restore",d:"Cloud sync with PIN protection. Restore on any device."},
            {l:"Privacy",d:"Control what friends can see: workouts, macros, photos, body."},
            {l:"Data Management",d:"Storage usage indicator, export all data as JSON, load demo data, clear data."},
            {l:"Cloud Sync",d:"Auto-syncs after every change. Manual sync available."}],
        };
        const items=helps[showFeatureHelp]||helps.home;
        return(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:1900,display:"flex",alignItems:"flex-end"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.7)"}} onClick={()=>setShowFeatureHelp(null)}/>
            <div style={{position:"relative",background:V.sheetBg,borderRadius:"20px 20px 0 0",
              padding:"20px 20px 32px",width:"100%",maxHeight:"70vh",overflowY:"auto",border:`1px solid ${V.cardBorder}`,borderBottom:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:800,color:V.text}}>How this page works</div>
                <button onClick={()=>setShowFeatureHelp(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4,fontSize:14,color:V.text3}}>✕</button>
              </div>
              {items.map((item,i)=>(
                <div key={i} style={{padding:"10px 0",borderBottom:i<items.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                  <div style={{fontSize:13,fontWeight:700,color:V.accent}}>{item.l}</div>
                  <div style={{fontSize:11,color:V.text3,marginTop:2,lineHeight:1.5}}>{item.d}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {/* #4: iOS Install Guide Modal */}
      {showInstallGuide&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)"}} onClick={()=>setShowInstallGuide(false)}/>
          <div style={{position:"relative",background:V.sheetBg,borderRadius:20,padding:24,maxWidth:340,width:"100%",
            border:`1px solid ${V.accent}20`,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <span style={{fontSize:40}}>📲</span>
              <div style={{fontSize:16,fontWeight:800,color:V.text,marginTop:8}}>Install IRONLOG</div>
              <div style={{fontSize:11,color:V.text3,marginTop:4}}>{/iPhone|iPad/.test(navigator.userAgent)?"iOS Safari":"Your browser"}</div>
            </div>
            {/iPhone|iPad/.test(navigator.userAgent)?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:12,fontWeight:800,color:V.accent}}>1</span></div>
                  <div><div style={{fontSize:12,fontWeight:600,color:V.text}}>Tap the Share button</div>
                    <div style={{fontSize:10,color:V.text3}}>The square with arrow icon at the bottom of Safari</div></div>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:12,fontWeight:800,color:V.accent}}>2</span></div>
                  <div><div style={{fontSize:12,fontWeight:600,color:V.text}}>Scroll down and tap "Add to Home Screen"</div>
                    <div style={{fontSize:10,color:V.text3}}>You may need to scroll the share sheet</div></div>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:8,background:`${V.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:12,fontWeight:800,color:V.accent}}>3</span></div>
                  <div><div style={{fontSize:12,fontWeight:600,color:V.text}}>Tap "Add" in the top right</div>
                    <div style={{fontSize:10,color:V.text3}}>IRONLOG will appear on your home screen like a real app</div></div>
                </div>
              </div>
            ):(
              <div style={{fontSize:12,color:V.text2,lineHeight:1.6,textAlign:"center"}}>
                Look for "Install App" or "Add to Home Screen" in your browser's menu (three dots).
              </div>
            )}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <Btn full onClick={()=>{setShowInstallGuide(false);LS.set("ft-install-dismissed",true);}}>Got it</Btn>
            </div>
          </div>
        </div>
      )}
      {/* Push Notification Prompt — shown after tour */}
      {showNotifPrompt&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)"}}/>
          <div role="alertdialog" aria-modal="true" aria-label="Enable notifications" style={{position:"relative",
            background:V.sheetBg,borderRadius:20,padding:28,maxWidth:340,width:"100%",
            border:`1px solid ${V.accent}25`,textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${V.accent}20,${V.accent2}20)`,
              display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
              <span style={{fontSize:32}}>🔔</span>
            </div>
            <div style={{fontSize:19,fontWeight:800,color:V.text,marginBottom:8}}>Stay on Track</div>
            <div style={{fontSize:13,color:V.text2,lineHeight:1.6,marginBottom:8}}>
              Enable smart notifications and IRONLOG will remind you to:
            </div>
            <div style={{textAlign:"left",padding:"12px 16px",background:"rgba(255,255,255,0.02)",borderRadius:12,
              border:`1px solid ${V.cardBorder}`,marginBottom:16}}>
              {[
                {icon:"💪",text:"Log your workouts on training days"},
                {icon:"🥗",text:"Track breakfast, lunch & dinner"},
                {icon:"💧",text:"Stay hydrated throughout the day"},
                {icon:"📊",text:"Complete your daily readiness check-in"},
                {icon:"🔥",text:"Keep your streak alive"},
              ].map((item,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",
                  borderBottom:i<4?`1px solid rgba(255,255,255,0.03)`:"none"}}>
                  <span style={{fontSize:16}}>{item.icon}</span>
                  <span style={{fontSize:12,color:V.text}}>{item.text}</span>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:V.accent,fontWeight:600,marginBottom:16,lineHeight:1.5}}>
              Users with notifications enabled are 3x more likely to hit their goals
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={handleNotifAccept} style={{width:"100%",padding:"14px",borderRadius:12,
                background:`linear-gradient(135deg,${V.accent},${V.accent2})`,border:"none",cursor:"pointer",
                fontSize:14,fontWeight:700,color:V.bg,fontFamily:V.font}}>
                Enable Notifications
              </button>
              <button onClick={handleNotifDecline} style={{width:"100%",padding:"10px",borderRadius:10,
                background:"transparent",border:"none",cursor:"pointer",
                fontSize:12,color:V.text3,fontFamily:V.font}}>
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
