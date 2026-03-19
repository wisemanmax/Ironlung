import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Sheet, Chip, Stat, Progress, Skeleton, SkeletonCard, MsgBannerCtrl, SuccessToastCtrl, ConfirmCtrl } from '../components/ui';
import { today, ago, fmtShort, fmtFull, uid, friendDisplayName, convW, wUnit, calc1RM } from '../utils/helpers';
import { SocialAPI, SYNC_URL } from '../utils/sync';
import { ShareCard } from '../utils/share';
import { BADGE_DEFS, calcEarnedBadges } from '../data/badges';
import { IRON_RANKS } from '../data/ranks';
import { HelpBtn } from './features';
import { IronScoreCard, RankBadge, DailyMissionsCard } from './gamification';
import { SectionGrid } from './hubs';

export function SocialTab({s,d,unreadMsgCount=0}){
  // Quick stats for display
  const email=s.profile?.email;
  const streak=useStreak(s.workouts);
  const weekW=s.workouts.filter(w=>w.date>=ago(7)).length;
  const [notifCount,setNotifCount]=useState(0);
  useEffect(()=>{if(email)SocialAPI.getNotifications(email).then(r=>{if(r)setNotifCount(r.unread||0);});},[email]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:V.text}}>Community</div>
          <div style={{fontSize:12,color:V.text3}}>Connect, compete, stay accountable</div>
        </div>
        {notifCount>0&&(
          <button onClick={()=>d({type:"TAB",tab:"social_notifications"})} style={{padding:"6px 12px",borderRadius:8,
            background:`${V.danger}15`,border:`1px solid ${V.danger}30`,cursor:"pointer",
            fontSize:11,fontWeight:700,color:V.danger,fontFamily:V.font}}>
            🔔 {notifCount}
          </button>
        )}
      </div>

      {/* Quick stats bar */}
      <div style={{display:"flex",gap:8}}>
        {[{l:"Streak",v:`${streak}d`,c:streak>=7?V.accent:V.text3},{l:"This Week",v:`${weekW}`,c:weekW>=3?V.accent:V.text3},
          {l:"Workouts",v:`${s.workouts.length}`,c:V.purple}].map(st=>(
          <div key={st.l} style={{flex:1,padding:"8px",borderRadius:8,background:"rgba(255,255,255,0.02)",
            border:`1px solid ${V.cardBorder}`,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
            <div style={{fontSize:10,color:V.text3,fontWeight:600}}>{st.l}</div>
          </div>
        ))}
      </div>

      {/* Iron Score compact rank */}
      <button onClick={()=>d({type:"TAB",tab:"social_ironscore"})} style={{display:"block",width:"100%",
        background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
        <IronScoreCard s={s}/>
      </button>

      <SectionGrid d={d} title="Your Activity" items={[
        {id:"social_feed",icon:Icons.activity,label:"Feed",desc:"Today's stats & friend activity",color:"#ec4899"},
        {id:"social_profile",icon:Icons.target,label:"Profile",desc:"QR code, friend code & privacy",color:"#8b5cf6"},
        {id:"social_notifications",icon:Icons.zap,label:"Notifications",desc:notifCount>0?`${notifCount} unread`:"All caught up",color:notifCount>0?V.danger:"#64748b"},
      ]}/>

      <SectionGrid d={d} title="Connections" items={[
        {id:"social_messages",icon:Icons.activity,label:"Messages",desc:unreadMsgCount>0?`${unreadMsgCount} unread`:"iMessage-style DMs",color:"#22c55e",badge:unreadMsgCount},
        {id:"social_friends",icon:Icons.target,label:"Friends",desc:"Add, compare & manage",color:"#06b6d4"},
        {id:"social_groups",icon:Icons.target,label:"Groups",desc:"Crews, leaderboards & stats",color:"#f59e0b"},
        {id:"social_compare",icon:Icons.chart,label:"You vs Best",desc:"Personal records race",color:"#a78bfa"},
      ]}/>

      <SectionGrid d={d} title="Compete" items={[
        {id:"social_ironscore",icon:Icons.trophy,label:"Iron Score",desc:`${(()=>{const xp2=LS.get("ft-ironscore")||0;const l=[...IRON_RANKS].reverse().find(lv=>xp2>=lv.xpNeeded)||IRON_RANKS[0];return l.icon+" "+l.name+" · "+xp2.toLocaleString()+" XP";})()}`,color:"#f59e0b"},
        {id:"social_duels",icon:Icons.zap,label:"1v1 Duels",desc:`${(LS.get("ft-duels")||[]).filter(d=>d.status==="active").length} active`,color:"#f43f5e"},
        {id:"social_wars",icon:Icons.trophy,label:"Weekly Wars",desc:"New battle every Monday",color:"#ec4899"},
        {id:"social_rivals",icon:Icons.target,label:"Rivals",desc:`${(LS.get("ft-rivals")||[]).length} tracked`,color:"#f97316"},
        {id:"social_challenges",icon:Icons.trophy,label:"Challenges",desc:"Tiers, badges & weekly",color:"#f43f5e"},
        {id:"social_badges",icon:Icons.target,label:"Badges",desc:"Your achievements",color:"#f97316"},
        {id:"social_leaderboard",icon:Icons.chart,label:"Leaderboard",desc:"Group rankings",color:"#10b981"},
      ]}/>
    </div>
  );
}

// ─── Social Sub-Page: Feed ───
export function SocialFeed({s,d}){
  const email=s.profile?.email;
  const emailRef=useRef(email);
  useEffect(()=>{emailRef.current=email;},[email]);
  const [feedData,setFeedData]=useState(null);
  const [notifs,setNotifs]=useState(null);
  const [loadErr,setLoadErr]=useState(false);
  const [newPostCount,setNewPostCount]=useState(0);
  const lastSeenIdRef=useRef(null);
  const loadFeed=(silent)=>{const em=emailRef.current;if(!silent)setLoadErr(false);if(em){
    SocialAPI.getFeed(em).then(r=>{
      if(r){
        // ── T3 #11: detect new posts since last seen ──
        if(lastSeenIdRef.current&&r.events){
          const newOnes=r.events.filter(ev=>!ev.isOwn&&ev.id!==lastSeenIdRef.current&&
            r.events.indexOf(ev)<r.events.findIndex(ev2=>ev2.id===lastSeenIdRef.current));
          if(newOnes.length>0)setNewPostCount(n=>n+newOnes.length);
        }
        setFeedData(r);
        // Cache latest feed for Home friend nudge
        LS.set("ft-feed-cache",{events:(r.events||[]).slice(0,20),ts:Date.now()});
      } else if(!silent){setLoadErr(true);}
    });
    SocialAPI.getNotifications(em).then(setNotifs);
  }};
  useEffect(()=>{loadFeed();},[email]);
  // ── Auto-refresh every 60s when feed is visible ──
  useEffect(()=>{
    const id=setInterval(()=>loadFeed(true),60000);
    return()=>clearInterval(id);
  },[]);
  const reactToEvent=async(eventId,emoji)=>{
    await SocialAPI.react(email,eventId,emoji);
    LS.set("ft-reacted-today",today()); // marks m_react mission as completable
    SocialAPI.getFeed(email).then(setFeedData);
  };

  const streak=useStreak(s.workouts);
  const weekW=s.workouts.filter(w=>w.date>=ago(7)).length;
  const protDays=s.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(s.goals?.protein||180)).length;
  const readiness=calcReadiness(s);
  const {xp,rank}=useMemo(()=>calcIronScore(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);
  const todayN=s.nutrition.filter(n=>n.date===today());
  const todayCal=todayN.reduce((a,n)=>a+(n.cal||0),0);
  const todayProt=todayN.reduce((a,n)=>a+(n.protein||0),0);
  const nextWorkout=(()=>{const sched=s.schedule?.weekly||{};const dow=new Date().getDay();for(let i=0;i<7;i++){const d2=(dow+i)%7;const label=s.schedule?.overrides?.[ago(-i)]||sched[d2];if(label&&label!=="Rest"&&label!=="Off")return{day:i===0?"Today":i===1?"Tomorrow":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][(dow+i)%7],label};}return null;})();

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Activity Feed</div>
      {loadErr&&<Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:11,color:V.danger,marginBottom:6}}>Could not load feed</div>
        <Btn v="secondary" full onClick={loadFeed}>Tap to retry</Btn></Card>}
      {/* Today card */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:V.text}}>📅 Today</div>
          <DailyMissionsCard s={s} d={d} compact/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
            <div style={{fontSize:10,color:V.text3}}>Readiness</div>
            <div style={{fontSize:16,fontWeight:800,color:readiness.color,fontFamily:V.mono}}>{readiness.score}</div>
          </div>
          <div style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
            <div style={{fontSize:10,color:V.text3}}>Protein</div>
            <div style={{fontSize:16,fontWeight:800,color:todayProt>=(s.goals?.protein||180)?V.accent:V.warn,fontFamily:V.mono}}>{todayProt}g</div>
          </div>
          <div style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
            <div style={{fontSize:10,color:V.text3}}>Calories</div>
            <div style={{fontSize:16,fontWeight:800,color:V.text,fontFamily:V.mono}}>{todayCal}</div>
          </div>
          <div style={{padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)"}}>
            <div style={{fontSize:10,color:V.text3}}>Next</div>
            <div style={{fontSize:12,fontWeight:700,color:V.accent}}>{nextWorkout?`${nextWorkout.day}: ${nextWorkout.label}`:"Rest"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{l:"Workout",t:"log_workout"},{l:"Meal",t:"log_nutrition"},{l:"Check-in",t:"home"},{l:"Photo",t:"track_photos"}].map(a=>(
            <button key={a.t} onClick={()=>d({type:"TAB",tab:a.t})} style={{flex:1,padding:"8px 4px",borderRadius:8,
              background:`${V.accent}08`,border:`1px solid ${V.accent}20`,cursor:"pointer",
              fontSize:11,color:V.accent,fontWeight:700,fontFamily:V.font,WebkitTapHighlightColor:"transparent"}}>{a.l}</button>
          ))}
        </div>
      </Card>
      {/* Highlights */}
      <Card style={{padding:14}}>
        <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:8}}>✨ Highlights</div>
        {[{t:`${weekW} workouts this week`,e:weekW>=5?"🔥":weekW>=3?"💪":"📈",show:true},
          {t:`Protein hit ${protDays} of 7 days`,e:protDays>=7?"⭐":protDays>=5?"✅":"🎯",show:true},
          {t:`${streak}-day streak`,e:streak>=30?"💎":streak>=7?"🔥":"🔄",show:streak>0}].filter(h=>h.show).map((h,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0"}}>
            <span style={{color:V.text2}}>{h.t}</span><span>{h.e}</span>
          </div>
        ))}
      </Card>
      {/* Accountability */}
      {!s.workouts.some(w=>w.date===today())&&!s.workouts.some(w=>w.date===ago(1))&&(
        <Card style={{padding:14,border:`1px solid ${V.warn}20`}}>
          <div style={{fontSize:12,fontWeight:700,color:V.warn}}>💬 Get After It</div>
          <div style={{fontSize:11,color:V.text3,marginTop:4}}>2 days without a workout. Even 1 set counts.</div>
          <Btn full onClick={()=>d({type:"TAB",tab:"log_workout"})} s={{marginTop:8,background:V.warn}}>Log 1 Set →</Btn>
        </Card>
      )}
      {/* Competitive status */}
      {(()=>{
        const rivals=LS.get("ft-rivals")||[];
        const duels=LS.get("ft-duels")||[];
        const activeWar=(()=>{
          const dow=new Date().getDay();const mondayOffset=dow===0?6:dow-1;
          const weekStart=ago(mondayOffset);
          const weekW2=s.workouts.filter(w=>w.date>=weekStart).length;
          return weekW2;
        })();
        if(rivals.length===0&&duels.length===0)return null;
        return(
          <Card style={{padding:14,background:`linear-gradient(135deg,${V.danger}06,${V.accent}04)`,
            border:`1px solid ${V.danger}20`}}>
            <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:8}}>⚔️ Competition Status</div>
            {duels.length>0&&(
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:V.text3,marginBottom:4}}>ACTIVE DUELS</div>
                {duels.slice(0,2).map((duel,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"4px 0",borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                    <span style={{fontSize:11,color:V.text2}}>{duel.friendName}</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,
                      background:"rgba(255,255,255,0.04)",color:V.text3}}>
                      {duel.metric} · {Math.max(0,Math.round((new Date(duel.endDate)-new Date())/86400000))}d left
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={()=>d({type:"TAB",tab:"social_duels"})} style={{
              width:"100%",padding:"7px",borderRadius:8,background:"transparent",
              border:`1px solid ${V.cardBorder}`,cursor:"pointer",
              fontSize:10,fontWeight:700,color:V.accent,fontFamily:V.font}}>
              View All Competition →
            </button>
          </Card>
        );
      })()}
      
      {/* ── T3 #11: New-post pill + Friend Activity card ── */}
      {newPostCount>0&&(
        <button onClick={()=>{setNewPostCount(0);lastSeenIdRef.current=feedData?.events?.[0]?.id||null;}}
          style={{width:"100%",padding:"8px",borderRadius:10,
            background:`${V.accent}10`,border:`1px solid ${V.accent}30`,cursor:"pointer",
            fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font,
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            animation:"newPostPulse 1.5s ease-in-out infinite"}}>
          <span style={{fontSize:14}}>✨</span>
          {newPostCount} new post{newPostCount>1?"s":""} — tap to see
        </button>
      )}
      <style>{`@keyframes newPostPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,245,160,0.3)}50%{box-shadow:0 0 0 6px rgba(0,245,160,0)}}`}</style>
      {feedData?.events?.filter(e=>!e.isOwn).length>0&&(
        <Card style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:V.text}}>📡 Friend Activity</div>
            <button onClick={()=>loadFeed(false)}
              style={{background:"none",border:"none",cursor:"pointer",
                fontSize:9,color:V.text3,padding:"2px 6px",fontFamily:V.font}}>↻ refresh</button>
          </div>
          {feedData.events.filter(e=>!e.isOwn).slice(0,8).map(ev=>(
            <div key={ev.id} style={{padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><span style={{fontSize:12,fontWeight:600,color:V.text}}>{ev.name}</span>
                  <span style={{fontSize:11,color:V.text3}}>{" "}{ev.type==="WorkoutLogged"?"logged a workout":ev.type==="PRHit"?"hit a PR 🎉":ev.type==="QuickMessage"?`sent: ${ev.data?.msg||"a message"}`:ev.type==="AccountabilitySet"?"set an accountability partner":ev.type==="GroupChat"?"sent a group message":ev.type==="ChallengeAchieved"?`reached ${ev.data?.tier||"a new tier"} 🏆`:"was active"}</span></div>
                <span style={{fontSize:9,color:V.text3}}>{fmtShort(ev.created_at?.split("T")[0])}</span>
              </div>
              {/* Event detail */}
              {ev.type==="WorkoutLogged"&&ev.data?.exercises&&(
                <div style={{fontSize:10,color:V.text3,marginTop:2}}>{Array.isArray(ev.data.exercises)?ev.data.exercises.slice(0,3).join(", "):""}{ev.data.sets?` · ${ev.data.sets} sets`:""}</div>
              )}
              {ev.type==="PRHit"&&ev.data&&(
                <div style={{fontSize:10,color:V.warn,marginTop:2,fontFamily:V.mono}}>{ev.data.exercise}: {ev.data.weight}×{ev.data.reps} (E1RM: {ev.data.e1rm})</div>
              )}
              {/* Reactions */}
              <div style={{display:"flex",gap:4,marginTop:6}}>
                {["🔥","💪","👏","💎","😤"].map(r=>{
                  const count=ev.reactions?.[r]||0;
                  const reacted=ev.myReactions?.includes(r);
                  return(
                    <button key={r} onClick={()=>reactToEvent(ev.id,r)} style={{padding:"4px 8px",borderRadius:8,
                      background:reacted?`${V.accent}15`:(count>0?"rgba(255,255,255,0.04)":"transparent"),
                      border:`1px solid ${reacted?V.accent+"30":(count>0?V.cardBorder:"transparent")}`,
                      cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:3,transition:"all .15s",
                      transform:reacted?"scale(1.1)":"scale(1)"}}>
                      {r}{count>0&&<span style={{fontSize:9,fontWeight:700,color:reacted?V.accent:V.text3}}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
      {/* Notifications */}
      {notifs?.unread>0&&(
        <Card style={{padding:14,border:`1px solid ${V.accent}20`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:V.accent}}>🔔 {notifs.unread} notification{notifs.unread>1?"s":""}</span>
            <button onClick={()=>{SocialAPI.markRead(email,"all");setNotifs({...notifs,unread:0});}}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:V.text3}}>Clear</button>
          </div>
          {notifs.notifications.filter(n=>!n.read).slice(0,3).map(n=>(
            <div key={n.id} style={{padding:"4px 0",fontSize:11,color:V.text2}}><b>{n.title}</b> — {n.body}</div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Social Sub-Page: Friends ───
export function SocialFriends({s,d}){
  const email=s.profile?.email;
  const displayName=s.profile?.firstName||email?.split("@")[0]||"You";
  const [friendsData,setFriendsData]=useState(null);
  const [addMethod,setAddMethod]=useState("code");
  const [addInput,setAddInput]=useState("");
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState(false);
  const [viewFriend,setViewFriend]=useState(null);
  const [friendTab,setFriendTab]=useState("profile"); // profile | chat
  const [dmMessages,setDmMessages]=useState([]);
  const [dmInput,setDmInput]=useState("");
  const [dmLoading,setDmLoading]=useState(false);
  const [dmHasMore,setDmHasMore]=useState(false);
  const [dmOldestCursor,setDmOldestCursor]=useState(null);
  const [dmLoadingOlder,setDmLoadingOlder]=useState(false);
  const dmEndRef=useRef(null);
  const [compareWith,setCompareWith]=useState(null);
  const streak=useStreak(s.workouts);
  const getBest=(id)=>{let b=0;s.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{if(st.weight>b)b=st.weight;});}));return b;};
  const myBig3=getBest("bench")+getBest("squat")+getBest("deadlift");

  const loadFriends=()=>{setLoadErr(false);setLoading(true);if(email)SocialAPI.getFriends(email).then(d2=>{if(d2)setFriendsData(d2);else setLoadErr(true);setLoading(false);});};
  useEffect(loadFriends,[email]);

  const sendAdd=async()=>{
    if(!addInput.trim())return;
    let target=addInput.trim();
    if(!target.includes("@"))target=target.replace(/^@/,"");
    const r=await SocialAPI.sendRequest(email,target);
    if(r?.success){SuccessToastCtrl.show("Request sent!");setAddInput("");loadFriends();}
    else SuccessToastCtrl.show(r?.error||"Not found");
  };
  const accept=async(from)=>{await SocialAPI.acceptRequest(email,from);SuccessToastCtrl.show("Friend added!");loadFriends();};
  const remove=async(t)=>{ConfirmCtrl.show("Remove this friend?","You can re-add them later.",async()=>{await SocialAPI.removeFriend(email,t);loadFriends();SuccessToastCtrl.show("Removed");});};
  const quickMsgs=["💪 Nice PR!","🔥 Let's train","⏰ Don't skip today","👏 Keep it up","🏋️ Gym time?"];
  const loadDMs=(friendEmail)=>{
    setDmLoading(true);setDmHasMore(false);setDmOldestCursor(null);
    setDmMessages(LS.get(`ft-dm-${friendEmail}`)||[]);
    SocialAPI.getDMs(email,friendEmail).then(r=>{
      if(r?.messages){
        // #B1: Use API-provided friendLastRead timestamp for read receipts.
        // Previously scanned messages for a "__read" sentinel that could never exist —
        // DMRead events are stored as event_type:DMRead, not DirectMessage, so they
        // never appear in the getDMs results. The API now returns friendLastRead directly.
        const lastFriendRead=r.friendLastRead||null;
        const msgs=(r.messages||[]).map(m=>({
          ...m,
          imageData:m.data?.imageData||m.imageData||null,
          text:(m.data?.imageData)?"📷 Photo":(m.text||""),
          read:m.isOwn&&lastFriendRead&&new Date(m.ts)<=new Date(lastFriendRead)
        }));
        setDmMessages(msgs);LS.set(`ft-dm-${friendEmail}`,msgs);
        setDmHasMore(!!r.hasMore);
        // nextCursor is the oldest message's timestamp — used as 'before' for loading older pages
        if(r.hasMore&&r.nextCursor)setDmOldestCursor(r.nextCursor);
      }
      setDmLoading(false);
    });
    // Mark their messages as read by us
    SocialAPI.markDMsRead(email,friendEmail);
  };
  const loadOlderDMs=(friendEmail)=>{
    if(!dmOldestCursor||dmLoadingOlder)return;
    setDmLoadingOlder(true);
    SocialAPI.getDMs(email,friendEmail,dmOldestCursor).then(r=>{
      if(r?.messages){
        const lastFriendRead=r.friendLastRead||null;
        const older=(r.messages||[]).map(m=>({
          ...m,read:m.isOwn&&lastFriendRead&&new Date(m.ts)<=new Date(lastFriendRead)
        }));
        // Prepend older messages to the top
        setDmMessages(prev=>[...older,...prev]);
        setDmHasMore(!!r.hasMore);
        if(r.hasMore&&r.nextCursor)setDmOldestCursor(r.nextCursor);
        else setDmOldestCursor(null);
      }
      setDmLoadingOlder(false);
    });
  };
  const [dmImagePreview,setDmImagePreview]=useState(null); // base64 of pending image
  const dmImgRef=useRef(null);

  const handleDmImage=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const compressed=await compressImage(file,600,0.72);
    if(compressed)setDmImagePreview(compressed);
    e.target.value="";
  };

  const sendDM=(friendEmail)=>{
    if(!dmInput.trim()&&!dmImagePreview)return;
    if(dmInput.length>200)return;
    Haptic.light();
    if(dmImagePreview){
      const msg={id:Date.now(),from:email,name:displayName,text:"📷 Photo",imageData:dmImagePreview,ts:new Date().toISOString(),isOwn:true};
      const updated=[...dmMessages,msg].slice(-100);
      setDmMessages(updated);LS.set(`ft-dm-${friendEmail}`,updated);
      SocialAPI.sendDMImage(email,friendEmail,dmImagePreview,displayName);
      SocialAPI.notifyDM(email,friendEmail,displayName,"",true);
      setDmImagePreview(null);
    }
    if(dmInput.trim()){
      const msg={id:Date.now(),from:email,name:displayName,text:dmInput.trim(),ts:new Date().toISOString(),isOwn:true};
      const updated=[...dmMessages,msg].slice(-100);
      setDmMessages(updated);LS.set(`ft-dm-${friendEmail}`,updated);
      SocialAPI.sendDM(email,friendEmail,dmInput.trim(),displayName);
      SocialAPI.notifyDM(email,friendEmail,displayName,dmInput.trim(),false);
      LS.set("ft-dm-sent-today",today());
      setDmInput("");
    }
    setTimeout(()=>dmEndRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };
  const openFriendChat=(f)=>{setViewFriend(f);setFriendTab("chat");loadDMs(f.email);LS.set(`ft-unread-${f.email}`,0);LS.set(`ft-last-read-${f.email}`,new Date().toISOString());};
  const openFriendProfile=(f)=>{setViewFriend(f);setFriendTab("profile");};

  // Auto-open DM chat if navigated here from a push notification
  useEffect(()=>{
    const fromEmail=LS.get("ft-open-dm-from");
    if(fromEmail&&friendsData?.friends){
      const f=friendsData.friends.find(fr=>fr.email===fromEmail);
      if(f){openFriendChat(f);LS.remove?.("ft-open-dm-from")||LS.set("ft-open-dm-from",null);}
    }
  },[friendsData]);

  // Deep-link: consume ft-pending-add (set by QR scan / shared link)
  // Pre-fills the add-friend input; auto-sends only if not already friends
  useEffect(()=>{
    const pendingCode=LS.get("ft-pending-add");
    if(!pendingCode||!email)return;
    LS.set("ft-pending-add",null); // clear immediately — don't fire twice
    setAddMethod("code");
    setAddInput(pendingCode);
    setTimeout(async()=>{
      // B4 fix: check if already friends before sending — sendRequest returns
      // {success:false, error:"Request already exists"} for dupes which is confusing
      const alreadyFriend=friendsData?.friends?.some(f=>
        f.friend_code===pendingCode||f.code===pendingCode
      );
      if(alreadyFriend){
        const f=friendsData.friends.find(fr=>fr.friend_code===pendingCode||fr.code===pendingCode);
        if(f)openFriendChat(f);
        SuccessToastCtrl.show("Already friends! 👋");
        setAddInput("");
        return;
      }
      const r=await SocialAPI.sendRequest(email,pendingCode);
      if(r?.success){
        SuccessToastCtrl.show("Friend request sent! 🎉");
        setAddInput("");
        loadFriends();
      } else if(r?.error==="Request already exists"){
        SuccessToastCtrl.show("Request already sent — check your pending requests");
      } else {
        // Keep input pre-filled so user can see the code
        SuccessToastCtrl.show(r?.error||"Code not found — double-check and try again");
      }
    },600);
  },[email]);
  const sendQuickMsg=async(fe,msg)=>{await SocialAPI.logEvent(email,"QuickMessage",{to:fe,msg},"friends");SuccessToastCtrl.show("Sent!");};

  if(compareWith)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <button onClick={()=>setCompareWith(null)} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
      </button>
      <div style={{fontSize:16,fontWeight:800,color:V.text,textAlign:"center"}}>You vs {compareWith.name}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
        {[{l:"Streak",my:streak,their:compareWith.challenges?.find(c=>c.challenge_id==="streak")?.value||"?"},
          {l:"Big 3",my:myBig3||"—",their:compareWith.challenges?.find(c=>c.challenge_id==="big3")?.value||"?"},
          {l:"Workouts",my:s.workouts.length,their:"?"}].map((r,i)=>(
          <React.Fragment key={i}>
            <div style={{textAlign:"center",padding:10,borderRadius:10,background:parseFloat(r.my)>=parseFloat(r.their)?V.accent+"08":"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:20,fontWeight:800,color:parseFloat(r.my)>=parseFloat(r.their)?V.accent:V.text,fontFamily:V.mono}}>{r.my}</div>
            </div>
            <div style={{fontSize:10,color:V.text3,fontWeight:600,textAlign:"center"}}>{r.l}</div>
            <div style={{textAlign:"center",padding:10,borderRadius:10,background:parseFloat(r.their)>parseFloat(r.my)?V.purple+"08":"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:20,fontWeight:800,color:parseFloat(r.their)>parseFloat(r.my)?V.purple:V.text,fontFamily:V.mono}}>{r.their}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:4}}>
        <div style={{textAlign:"center",fontSize:10,color:V.accent,fontWeight:600}}>You</div>
        <div style={{textAlign:"center",fontSize:10,color:V.purple,fontWeight:600}}>{compareWith.name}</div>
      </div>
    </div>
  );

  if(viewFriend)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <button onClick={()=>{setViewFriend(null);setDmMessages([]);setDmInput("");}} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
      </button>
      {/* Tab switcher */}
      <div style={{display:"flex",gap:4}}>
        {[{id:"profile",l:"Profile"},{id:"chat",l:"Chat"}].map(t=>(
          <button key={t.id} onClick={()=>{setFriendTab(t.id);if(t.id==="chat")loadDMs(viewFriend.email);}} style={{flex:1,padding:"8px",borderRadius:8,
            border:`1.5px solid ${friendTab===t.id?V.accent:V.cardBorder}`,background:friendTab===t.id?V.accent+"08":"transparent",
            cursor:"pointer",fontSize:12,fontWeight:700,color:friendTab===t.id?V.accent:V.text3,fontFamily:V.font}}>{t.l}</button>
        ))}
      </div>

      {/* Profile tab */}
      {friendTab==="profile"&&(<>
        <Card style={{padding:0,overflow:"hidden",textAlign:"center"}}>
          {/* Banner */}
          <div style={{width:"100%",height:90,
            background:viewFriend.banner?"none":`linear-gradient(135deg,${V.purple}40,#ec489940)`,overflow:"hidden",flexShrink:0}}>
            {viewFriend.banner&&<img src={viewFriend.banner} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
          </div>
          {/* Avatar overlapping banner */}
          <div style={{padding:"0 16px 16px",marginTop:-30}}>
            <div style={{width:60,height:60,borderRadius:16,
              background:viewFriend.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
              display:"inline-flex",alignItems:"center",justifyContent:"center",
              overflow:"hidden",border:`3px solid ${V.bg}`,boxShadow:"0 4px 12px rgba(0,0,0,0.4)",marginBottom:8}}>
              {viewFriend.avatar
                ?<img src={viewFriend.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<span style={{fontSize:22,color:V.bg,fontWeight:900}}>{(viewFriend.name||"?")[0].toUpperCase()}</span>}
            </div>
            <div style={{fontSize:16,fontWeight:800,color:V.text}}>{friendDisplayName(viewFriend)}</div>
            {/* Show their Iron Score rank if available */}
            {(()=>{
              const theirXP=parseInt(viewFriend.challenges?.find?.(c=>c.challenge_id==="ironscore")?.value)||0;
              if(theirXP>0){
                const theirRank=[...IRON_RANKS].reverse().find(r=>theirXP>=r.xpNeeded)||IRON_RANKS[0];
                return <div style={{marginBottom:4}}><RankBadge rank={theirRank} size="sm"/></div>;
              }
              return null;
            })()}
            {viewFriend.username&&<div style={{fontSize:11,color:V.text3}}>@{viewFriend.username}</div>}
            {viewFriend.bio&&<div style={{fontSize:11,color:V.text2,lineHeight:1.5,fontStyle:"italic",margin:"6px auto",maxWidth:260}}>{viewFriend.bio}</div>}
            {viewFriend.badges?.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",margin:"10px 0"}}>
                {viewFriend.badges.map((b,i)=>{
                  const def=BADGE_DEFS.find(bd=>bd.name===b||bd.id===b);
                  return(
                    <div key={i} title={def?.desc||b} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:38,height:38,borderRadius:10,
                        background:`linear-gradient(135deg,${V.accent}15,${V.purple}15)`,
                        border:`1px solid ${V.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                        {def?.icon||"🏅"}
                      </div>
                      <span style={{fontSize:7,color:V.accent,fontWeight:600,maxWidth:44,textAlign:"center",lineHeight:1.2}}>{def?.name||b}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {viewFriend.challenges?.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,margin:"10px 0"}}>
                {viewFriend.challenges.map((c,i)=>(
                  <div key={i} style={{padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                    <div style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{c.value}</div>
                    <div style={{fontSize:10,color:V.text3,textTransform:"uppercase"}}>{c.challenge_id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        {/* #2: Streak comparison */}
        {viewFriend.challenges?.find(c=>c.challenge_id==="streak")&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>🔥 Streak Battle</div>
            {(()=>{
              const theirStreak=parseInt(viewFriend.challenges.find(c=>c.challenge_id==="streak")?.value)||0;
              const diff=streak-theirStreak;
              const winning=diff>0,tied=diff===0;
              return(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{textAlign:"center",flex:1}}>
                      <div style={{fontSize:28,fontWeight:800,color:winning||tied?V.accent:V.text,fontFamily:V.mono}}>{streak}</div>
                      <div style={{fontSize:10,color:V.text3}}>You</div>
                    </div>
                    <div style={{fontSize:16,color:V.text3,padding:"0 12px"}}>{winning?">":(tied?"=":"<")}</div>
                    <div style={{textAlign:"center",flex:1}}>
                      <div style={{fontSize:28,fontWeight:800,color:!winning&&!tied?V.purple:V.text,fontFamily:V.mono}}>{theirStreak}</div>
                      <div style={{fontSize:10,color:V.text3}}>{viewFriend.name?.split(" ")[0]}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"center",fontSize:11,fontWeight:600,
                    color:winning?V.accent:(tied?V.warn:V.purple)}}>
                    {winning?`You're ahead by ${diff} day${diff>1?"s":""}! 💪`:tied?"Tied! Don't let them pass you 🤝":`They're ahead by ${Math.abs(diff)} day${Math.abs(diff)>1?"s":""}. Catch up! 🏃`}
                  </div>
                </div>
              );
            })()}
          </Card>
        )}
        <div style={{display:"flex",gap:6}}>
          <Btn full onClick={()=>{setViewFriend(null);setCompareWith(viewFriend);}}>Compare</Btn>
          <Btn v="secondary" full onClick={()=>remove(viewFriend.email)}>Remove</Btn>
        </div>
        {/* Quick competitive actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <button onClick={()=>{
            const rivals=LS.get("ft-rivals")||[];
            const already=rivals.find(r=>r.email===viewFriend.email);
            if(!already){
              LS.set("ft-rivals",[...rivals,{email:viewFriend.email,name:friendDisplayName(viewFriend),avatar:viewFriend.avatar,addedDate:today()}]);
              SuccessToastCtrl.show(`${friendDisplayName(viewFriend)} is now your rival! 🎯`);
              SocialAPI.logEvent(email,"RivalAdded",{rival:viewFriend.email},"friends");
            } else {
              SuccessToastCtrl.show("Already a rival");
            }
          }} style={{padding:"10px 8px",borderRadius:10,background:"rgba(244,63,94,0.08)",
            border:"1px solid rgba(244,63,94,0.25)",cursor:"pointer",
            fontSize:11,fontWeight:700,color:"#f43f5e",fontFamily:V.font}}>
            🎯 Add as Rival
          </button>
          <button onClick={()=>{d({type:"TAB",tab:"social_duels"});}} style={{padding:"10px 8px",borderRadius:10,
            background:`${V.accent}08`,border:`1px solid ${V.accent}25`,cursor:"pointer",
            fontSize:11,fontWeight:700,color:V.accent,fontFamily:V.font}}>
            ⚔️ Start Duel
          </button>
        </div>
        {/* Accountability Partner */}
        <Card style={{padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:V.text}}>🤝 Accountability Partner</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2}}>Get nudged if either of you misses 2 days</div>
            </div>
            {(()=>{
              const partners=LS.get("ft-accountability")||[];
              const isPartner=partners.includes(viewFriend.email);
              return(
                <div onClick={()=>{
                  const current=LS.get("ft-accountability")||[];
                  if(isPartner){LS.set("ft-accountability",current.filter(e=>e!==viewFriend.email));SuccessToastCtrl.show("Partner removed");}
                  else{LS.set("ft-accountability",[...current,viewFriend.email]);SuccessToastCtrl.show(`${viewFriend.name} is now your accountability partner!`);
                    SocialAPI.logEvent(email,"AccountabilitySet",{partner:viewFriend.email,name:viewFriend.name},"friends");}
                }} style={{width:40,height:22,borderRadius:11,background:isPartner?V.accent:"rgba(255,255,255,0.1)",padding:2,cursor:"pointer",transition:"all .2s"}}>
                  <div style={{width:18,height:18,borderRadius:9,background:"#fff",transform:isPartner?"translateX(18px)":"translateX(0)",transition:"transform .2s"}}/>
                </div>
              );
            })()}
          </div>
        </Card>
      </>)}

      {/* Chat tab — full DM interface */}
      {friendTab==="chat"&&(
        <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 260px)"}}>
          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,paddingBottom:8}}>
            {/* I11: Load older messages button — appears when server has more history */}
            {dmHasMore&&(
              <div style={{textAlign:"center",padding:"6px 0"}}>
                <button onClick={()=>loadOlderDMs(viewFriend.email)} disabled={dmLoadingOlder}
                  style={{background:"none",border:`1px solid ${V.cardBorder}`,borderRadius:8,padding:"5px 14px",
                    fontSize:11,color:V.text3,cursor:dmLoadingOlder?"default":"pointer",fontFamily:V.font}}>
                  {dmLoadingOlder?"Loading…":"⬆ Load older messages"}
                </button>
              </div>
            )}
            {dmLoading&&dmMessages.length===0&&<div style={{padding:10}}><Skeleton rows={4} h={30} gap={8}/></div>}
            {!dmLoading&&dmMessages.length===0&&(
              <div style={{textAlign:"center",padding:40}}>
                <div style={{fontSize:28,marginBottom:8}}>💬</div>
                <div style={{fontSize:13,fontWeight:700,color:V.text}}>Start a conversation</div>
                <div style={{fontSize:11,color:V.text3,marginTop:4}}>Messages are private between you and {viewFriend.name}</div>
              </div>
            )}
            {dmMessages.map((m,i)=>{
              const isOwn=m.isOwn||m.from===email;
              return(
              <div key={m.id||i} style={{maxWidth:"80%",
                padding:m.imageData?"4px":"10px 14px",borderRadius:16,fontSize:13,lineHeight:1.5,overflow:"hidden",
                ...(isOwn
                  ?{alignSelf:"flex-end",background:m.imageData?"transparent":`${V.accent}15`,color:V.text,borderBottomRightRadius:4}
                  :{alignSelf:"flex-start",background:m.imageData?"transparent":V.card,border:m.imageData?"none":`1px solid ${V.cardBorder}`,color:V.text2,borderBottomLeftRadius:4})}}>
                {!isOwn&&<div style={{fontSize:9,fontWeight:700,color:V.purple,marginBottom:2,paddingLeft:m.imageData?4:0}}>{m.name}</div>}
                {m.imageData?(
                  <div style={{position:"relative"}}>
                    <img src={m.imageData} alt="Photo" style={{display:"block",maxWidth:"100%",maxHeight:280,borderRadius:12,objectFit:"cover"}}/>
                    <div style={{position:"absolute",bottom:6,right:6,fontSize:8,color:"rgba(255,255,255,0.85)",
                      background:"rgba(0,0,0,0.45)",borderRadius:4,padding:"2px 5px",display:"flex",gap:3}}>
                      <span>{new Date(m.ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span>
                      {isOwn&&<span style={{color:m.read?"#6ee7b7":"rgba(255,255,255,0.6)"}}>{m.read?"✓✓":"✓"}</span>}
                    </div>
                  </div>
                ):(
                  <>
                    <div style={{wordBreak:"break-word"}}>{m.text}</div>
                    <div style={{fontSize:8,color:V.text3,marginTop:4,display:"flex",justifyContent:isOwn?"flex-end":"flex-start",alignItems:"center",gap:4}}>
                      <span>{new Date(m.ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span>
                      {isOwn&&<span style={{color:m.read?V.accent:V.text3,fontSize:9}}>{m.read?"✓✓":"✓"}</span>}
                    </div>
                  </>
                )}
              </div>
              );
            })}
            <div ref={dmEndRef}/>
          </div>
          {/* Quick reply chips */}
          <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch"}}>
            {quickMsgs.map((msg,i)=>(
              <button key={i} onClick={()=>{setDmInput(msg);}} style={{padding:"4px 10px",borderRadius:6,
                background:"rgba(255,255,255,0.03)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",
                fontSize:10,color:V.text3,fontFamily:V.font,whiteSpace:"nowrap",flexShrink:0}}>{msg}</button>
            ))}
          </div>
          {/* Image preview before send */}
          {dmImagePreview&&(
            <div style={{position:"relative",display:"inline-block",marginBottom:6}}>
              <img src={dmImagePreview} alt="Preview" style={{maxHeight:120,maxWidth:"60%",borderRadius:10,display:"block"}}/>
              <button onClick={()=>setDmImagePreview(null)}
                style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:10,background:"rgba(0,0,0,0.6)",
                  border:"none",cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          )}
          {/* Notification prompt — inline banner if push not enabled */}
          {Notification.permission==="default"&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,
              background:`${V.accent}08`,border:`1px solid ${V.accent}20`,marginBottom:4}}>
              <span style={{fontSize:11,color:V.text2,flex:1}}>🔔 Enable notifications to get message alerts</span>
              <button onClick={async()=>{
                const p=await Notification.requestPermission();
                if(p==="granted"&&"serviceWorker" in navigator){
                  const reg=await navigator.serviceWorker.ready;
                  const vapidKey="BMZyIUQO08nuR7afvqNIWBK_ZOcr7PHwT2YwIxTa_ONwAD1YCaJ8Qkb4q4TTYSx_sTN-7-5vCzR8ApNZuyg-Ttc";
                  const keyBytes=Uint8Array.from(atob(vapidKey.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
                  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes}).catch(()=>null);
                  if(sub){await fetch(`${SYNC_URL}/api/push`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({action:"subscribe",email,subscription:sub.toJSON()})});SuccessToastCtrl.show("Notifications enabled 🔔");}
                }
              }} style={{padding:"4px 10px",borderRadius:6,background:V.accent,border:"none",cursor:"pointer",
                fontSize:11,fontWeight:700,color:V.bg,flexShrink:0}}>Enable</button>
            </div>
          )}
          {/* Input */}
          <input ref={dmImgRef} type="file" accept={"image/" + "*"} onChange={handleDmImage} style={{display:"none"}}/>
          <div style={{display:"flex",gap:8,paddingTop:6,borderTop:`1px solid ${V.cardBorder}`}}>
            {/* Image attach button */}
            <button onClick={()=>dmImgRef.current?.click()} style={{width:44,height:44,borderRadius:12,flexShrink:0,
              background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:18}}>📷</span>
            </button>
            <div style={{flex:1,position:"relative"}}>
              <input value={dmInput} onChange={e=>{if(e.target.value.length<=200)setDmInput(e.target.value);}}
                placeholder="Message..." maxLength={200}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey)sendDM(viewFriend.email);}}
                style={{width:"100%",padding:"12px 14px",background:V.card,border:`1px solid ${V.cardBorder}`,
                  borderRadius:12,color:V.text,fontSize:14,outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
              {dmInput.length>0&&<span style={{position:"absolute",right:10,bottom:-14,fontSize:8,
                color:dmInput.length>180?V.danger:V.text3}}>{dmInput.length}/200</span>}
            </div>
            <button onClick={()=>sendDM(viewFriend.email)} disabled={!dmInput.trim()&&!dmImagePreview}
              style={{width:44,height:44,borderRadius:12,background:(dmInput.trim()||dmImagePreview)?V.accent:"rgba(255,255,255,0.04)",
                border:"none",cursor:(dmInput.trim()||dmImagePreview)?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",
                flexShrink:0,transition:"background .2s"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={(dmInput.trim()||dmImagePreview)?V.bg:V.text3} strokeWidth="2" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Friends</div>
      {loadErr&&<Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:11,color:V.danger,marginBottom:6}}>Could not load</div>
        <Btn v="secondary" full onClick={loadFriends}>Retry</Btn></Card>}
      <Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Add Friend</div>
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {[{id:"code",l:"Friend Code"},{id:"username",l:"Username"},{id:"email",l:"Email"}].map(m=>(
            <button key={m.id} onClick={()=>{setAddMethod(m.id);setAddInput("");}} style={{flex:1,padding:"6px",borderRadius:6,
              border:`1.5px solid ${addMethod===m.id?V.accent:V.cardBorder}`,background:addMethod===m.id?V.accent+"08":"transparent",
              cursor:"pointer",fontSize:10,fontWeight:600,color:addMethod===m.id?V.accent:V.text3,fontFamily:V.font}}>{m.l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={addInput} onChange={e=>setAddInput(addMethod==="code"?e.target.value.toUpperCase():e.target.value)}
            placeholder={addMethod==="code"?"IRON-XXXX":addMethod==="username"?"@username":"friend@email.com"}
            onKeyDown={e=>{if(e.key==="Enter")sendAdd();}}
            style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,
              color:V.text,fontSize:13,outline:"none",fontFamily:addMethod==="code"?V.mono:V.font,
              letterSpacing:addMethod==="code"?2:0}}/>
          <Btn onClick={sendAdd} disabled={!addInput.trim()}>Add</Btn>
        </div>
      </Card>
      {friendsData?.incoming?.length>0&&(
        <Card style={{padding:14,border:`1px solid ${V.accent}20`}}>
          <div style={{fontSize:12,fontWeight:700,color:V.accent,marginBottom:8}}>Requests ({friendsData.incoming.length})</div>
          {friendsData.incoming.map((r,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",
              borderBottom:i<friendsData.incoming.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
              <span style={{fontSize:12,color:V.text}}>{r.name||"Someone"}</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>accept(r.from)} style={{padding:"5px 12px",borderRadius:6,background:V.accent,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,color:V.bg,fontFamily:V.font}}>Accept</button>
                <button onClick={()=>remove(r.from)} style={{padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:10,color:V.text3}}>X</button>
              </div>
            </div>
          ))}
        </Card>
      )}
      {friendsData?.friends?.length>0?(
        <div>
          {friendsData.friends.map((f,i)=>{
            const unread=parseInt(LS.get(`ft-unread-${f.email}`))||0;
            return(
            <Card key={i} style={{padding:12,marginBottom:6,cursor:"pointer"}} onClick={()=>openFriendProfile(f)}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{position:"relative",width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${V.purple},#ec4899)`,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:14,color:V.bg,fontWeight:900}}>{(f.name||"?")[0].toUpperCase()}</span>
                  {unread>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:8,
                    background:V.danger,border:`2px solid ${V.card}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:8,fontWeight:800,color:"#fff"}}>{unread>9?"9+":unread}</span>
                  </div>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:V.text}}>{f.name||"Unknown"}</div>
                  {f.username&&<div style={{fontSize:10,color:V.text3}}>@{f.username}</div>}
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={e=>{e.stopPropagation();openFriendChat(f);}} style={{padding:"4px 8px",borderRadius:6,
                    background:unread>0?`${V.danger}15`:`${V.accent2}10`,border:`1px solid ${unread>0?V.danger+"30":V.accent2+"20"}`,
                    cursor:"pointer",fontSize:9,color:unread>0?V.danger:V.accent2,fontFamily:V.font,fontWeight:unread>0?700:400}}>
                    💬{unread>0?` ${unread}`:""}</button>
                  <button onClick={e=>{e.stopPropagation();setCompareWith(f);}} style={{padding:"4px 8px",borderRadius:6,
                    background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:9,color:V.accent,fontFamily:V.font}}>vs</button>
                  {Icons.chevRight({size:14,color:V.text3})}
                </div>
              </div>
            </Card>
            );}
          )}
        </div>
      ):(
        !loading&&!loadErr&&<Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>👥</div>
          <div style={{fontSize:13,fontWeight:700,color:V.text}}>No friends yet</div>
          <div style={{fontSize:11,color:V.text3,marginTop:4}}>Add friends using their code, username, or email.</div>
        </Card>
      )}
      {loading&&!loadErr&&<div><SkeletonCard lines={2}/><div style={{height:8}}/><SkeletonCard lines={3}/></div>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  MESSAGES TAB — iMessage-style DM inbox + full chat view
// ═══════════════════════════════════════════════════════════
export function MessagesTab({s,d}){
  const email=s.profile?.email;
  const displayName=s.profile?.firstName||email?.split("@")[0]||"You";
  const [friends,setFriends]=useState(null);
  const [activeChat,setActiveChat]=useState(null); // friend object or null (inbox)
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [tick,setTick]=useState(0); // forces re-render to pick up LS unread changes

  useEffect(()=>{
    if(!email)return;
    setLoading(true);
    SocialAPI.getFriends(email).then(r=>{
      if(r)setFriends(r);
      setLoading(false);
    });
  },[email]);

  // Re-render inbox every 30s so LS-backed unread counts + previews stay live
  useEffect(()=>{
    const iv=setInterval(()=>setTick(t=>t+1),30000);
    return()=>clearInterval(iv);
  },[]);

  // Auto-open from push notification
  useEffect(()=>{
    const fromEmail=LS.get("ft-open-dm-from");
    if(fromEmail&&friends?.friends){
      const f=friends.friends.find(fr=>fr.email===fromEmail);
      if(f){setActiveChat(f);}
      // Always clear after attempting — prevents stale auto-opens on next launch
      LS.set("ft-open-dm-from",null);
    }
  },[friends]);

  if(activeChat){
    return <IMConversation
      s={s} email={email} displayName={displayName}
      friend={activeChat}
      onBack={()=>{setActiveChat(null);if(email)SocialAPI.getFriends(email).then(r=>{if(r)setFriends(r);});}}
    />;
  }

  // Build inbox rows — sorted by last message time desc
  const friendList=(friends?.friends||[]).filter(f=>{
    if(!search)return true;
    const q=search.toLowerCase();
    return (f.name||"").toLowerCase().includes(q)||(f.username||"").toLowerCase().includes(q);
  });
  const getLastMsg=(f)=>{ const cached=LS.get(`ft-dm-${f.email}`)||[]; return cached[cached.length-1]||null; };
  const getUnread=(f)=>parseInt(LS.get(`ft-unread-${f.email}`))||0;
  const sorted=[...friendList].sort((a,b)=>{
    const at=getLastMsg(a)?.ts||"0"; const bt=getLastMsg(b)?.ts||"0";
    return bt.localeCompare(at);
  });
  const pending=friends?.incoming||[];

  // Format timestamp for inbox row (iMessage style)
  const fmtInboxTime=(ts)=>{
    if(!ts)return"";
    const d2=new Date(ts),now=new Date();
    const diff=(now-d2)/1000;
    if(diff<60)return"now";
    if(diff<3600)return`${Math.floor(diff/60)}m`;
    // Fix 9: use calendar day comparison, not 24h window
    const todayStr=now.toDateString();
    const yesterdayStr=new Date(now-86400000).toDateString();
    const msgDayStr=d2.toDateString();
    if(msgDayStr===todayStr)return d2.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    if(msgDayStr===yesterdayStr)return"Yesterday";
    if(diff<604800)return d2.toLocaleDateString([],{weekday:"short"});
    return d2.toLocaleDateString([],{month:"numeric",day:"numeric"});
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0 12px"}}>
        <button onClick={()=>d({type:"TAB",tab:"social"})} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:4,cursor:"pointer",padding:0}}>
          <svg width="9" height="16" viewBox="0 0 9 16" fill="none"><path d="M8 1L1 8L8 15" stroke={V.accent} strokeWidth="2.2" strokeLinecap="round"/></svg>
          <span style={{fontSize:14,color:V.accent,fontWeight:600}}>Social</span>
        </button>
        <div style={{fontSize:17,fontWeight:800,color:V.text}}>Messages</div>
        <button onClick={()=>d({type:"TAB",tab:"social_friends"})} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={V.accent} strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </button>
      </div>

      {/* Search bar */}
      <div style={{position:"relative",marginBottom:10}}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={V.text3} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search"
          style={{width:"100%",padding:"9px 12px 9px 34px",background:"rgba(255,255,255,0.06)",
            border:"none",borderRadius:12,color:V.text,fontSize:14,outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
        {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
          background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:18,height:18,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",color:V.text3,fontSize:10}}>✕</button>}
      </div>

      {/* Pending requests banner */}
      {pending.length>0&&(
        <button onClick={()=>d({type:"TAB",tab:"social_friends"})} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
          background:`${V.accent}08`,border:`1px solid ${V.accent}20`,borderRadius:12,cursor:"pointer",marginBottom:8,width:"100%",textAlign:"left"}}>
          <div style={{width:36,height:36,borderRadius:18,background:V.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:16}}>👥</span>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:V.accent}}>{pending.length} friend request{pending.length>1?"s":""}</div>
            <div style={{fontSize:11,color:V.text3}}>Tap to review</div>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke={V.text3} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      )}

      {/* Conversation list */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {loading&&[0,1,2,3].map(i=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${V.cardBorder}`}}>
            <div style={{width:52,height:52,borderRadius:26,background:"rgba(255,255,255,0.06)",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{height:13,width:"40%",borderRadius:6,background:"rgba(255,255,255,0.06)",marginBottom:6}}/>
              <div style={{height:11,width:"70%",borderRadius:6,background:"rgba(255,255,255,0.04)"}}/>
            </div>
          </div>
        ))}
        {!loading&&sorted.length===0&&(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}>💬</div>
            <div style={{fontSize:16,fontWeight:700,color:V.text,marginBottom:6}}>No Messages Yet</div>
            <div style={{fontSize:13,color:V.text3,lineHeight:1.6}}>Add friends to start chatting</div>
            <button onClick={()=>d({type:"TAB",tab:"social_friends"})} style={{marginTop:16,padding:"10px 24px",
              background:V.accent,border:"none",borderRadius:20,cursor:"pointer",fontSize:13,fontWeight:700,color:V.bg,fontFamily:V.font}}>
              Add Friends
            </button>
          </div>
        )}
        {sorted.map((f,i)=>{
          const last=getLastMsg(f);
          const unread=getUnread(f);
          const isOwn=last?.isOwn||last?.from===email;
          let preview=last?.text||"";
          if(last?.imageData)preview="📷 Photo";
          if(preview.length>32)preview=preview.slice(0,32)+"…";
          return(
          <button key={f.email} onClick={()=>{setActiveChat(f);LS.set(`ft-unread-${f.email}`,0);}}
            style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"10px 0",
              background:"none",border:"none",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent",
              borderBottom:`1px solid ${V.cardBorder}`}}>
            {/* Avatar */}
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:52,height:52,borderRadius:26,overflow:"hidden",
                background:f.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                {f.avatar
                  ?<img src={f.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                  :<span style={{fontSize:20,color:"#fff",fontWeight:800}}>{(f.name||"?")[0].toUpperCase()}</span>}
              </div>
              {unread>0&&<div style={{position:"absolute",bottom:0,right:0,width:18,height:18,borderRadius:9,
                background:V.accent,border:`2px solid ${V.bg}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:9,fontWeight:800,color:V.bg}}>{unread>9?"9+":unread}</span>
              </div>}
            </div>
            {/* Content */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:2}}>
                <span style={{fontSize:15,fontWeight:unread>0?700:500,color:V.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{friendDisplayName(f)}</span>
                <span style={{fontSize:11,color:unread>0?V.accent:V.text3,fontWeight:unread>0?600:400,flexShrink:0,marginLeft:4}}>{fmtInboxTime(last?.ts)}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:3,minWidth:0}}>
                {isOwn&&last&&<span style={{fontSize:13,color:V.text3,flexShrink:0}}>You: </span>}
                <span style={{fontSize:13,color:unread>0?V.text2:V.text3,fontWeight:unread>0?500:400,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{preview||"Tap to chat"}</span>
              </div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{flexShrink:0}}>
              <path d="M1 1l6 6-6 6" stroke={V.text3} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── iMessage-style conversation view ───
export function IMConversation({s,email,displayName,friend,onBack}){
  const [messages,setMessages]=useState(()=>LS.get(`ft-dm-${friend.email}`)||[]);
  const [input,setInput]=useState("");
  const [imgPreview,setImgPreview]=useState(null);
  const [loading,setLoading]=useState(true);
  const [hasMore,setHasMore]=useState(false);
  const [oldestCursor,setOldestCursor]=useState(null);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [reacting,setReacting]=useState(null); // message id being reacted to
  const [reactions,setReactions]=useState(()=>LS.get(`ft-reactions-${friend.email}`)||{});
  const [friendInfo,setFriendInfo]=useState(false); // friend info sheet open
  const [typing,setTyping]=useState(false);           // friend typing indicator
  const typingTimeoutRef=useRef(null);
  const endRef=useRef(null);
  const inputRef=useRef(null);
  const imgRef=useRef(null);
  const listRef=useRef(null);

  // Load from server on mount
  useEffect(()=>{
    setLoading(true);
    SocialAPI.getDMs(email,friend.email).then(r=>{
      if(r?.messages){
        const lastFriendRead=r.friendLastRead||null;
        const msgs=(r.messages||[]).map(m=>({
          ...m,imageData:m.data?.imageData||m.imageData||null,
          text:(m.data?.imageData)?"📷 Photo":(m.text||""),
          read:m.isOwn&&lastFriendRead&&new Date(m.ts)<=new Date(lastFriendRead)
        }));
        setMessages(msgs);LS.set(`ft-dm-${friend.email}`,msgs);
        // Seed lastMsgTsRef so the 8s poller doesn't fire on first tick
        lastMsgTsRef.current=msgs.slice(-1)[0]?.ts||null;
        setHasMore(!!r.hasMore);
        if(r.hasMore&&r.nextCursor)setOldestCursor(r.nextCursor);
      }
      setLoading(false);
    });
    SocialAPI.markDMsRead(email,friend.email);
    // Fix 3: set ft-last-read so the global poller doesn't re-count these as unread
    LS.set(`ft-last-read-${friend.email}`,new Date().toISOString());
    LS.set(`ft-unread-${friend.email}`,0);
  },[]);

  // Bug 10: scroll after messages render, not on a fixed timer
  const didInitScroll=useRef(false);
  useEffect(()=>{
    if(!loading&&!didInitScroll.current){
      didInitScroll.current=true;
      endRef.current?.scrollIntoView({behavior:"instant"});
    }
  },[loading,messages.length]);

  const scrollToBottom=(smooth)=>requestAnimationFrame(()=>endRef.current?.scrollIntoView({behavior:smooth?"smooth":"instant"}));

  const loadOlder=()=>{
    if(!oldestCursor||loadingOlder)return;
    setLoadingOlder(true);
    // Fix 6: save scroll anchor before prepending
    const list=listRef.current;
    const prevScrollHeight=list?list.scrollHeight:0;
    SocialAPI.getDMs(email,friend.email,oldestCursor).then(r=>{
      if(r?.messages){
        const lastFriendRead=r.friendLastRead||null;
        const older=(r.messages||[]).map(m=>({...m,
          imageData:m.data?.imageData||m.imageData||null,
          text:(m.data?.imageData)?"📷 Photo":(m.text||""),
          read:m.isOwn&&lastFriendRead&&new Date(m.ts)<=new Date(lastFriendRead)}));
        setMessages(prev=>[...older,...prev]);
        setHasMore(!!r.hasMore);
        setOldestCursor(r.hasMore&&r.nextCursor?r.nextCursor:null);
        // Restore scroll position so view doesn't jump
        requestAnimationFrame(()=>{
          if(list)list.scrollTop=list.scrollHeight-prevScrollHeight;
        });
      }
      setLoadingOlder(false);
    });
  };

  // Bug 8: Poll for new messages every 8s while in conversation
  const lastMsgTsRef=useRef(null);
  useEffect(()=>{
    const poll=setInterval(()=>{
      SocialAPI.getDMs(email,friend.email).then(r=>{
        if(!r?.messages)return;
        const lastFriendRead=r.friendLastRead||null;
        const incoming=(r.messages||[]).map(m=>({
          ...m,imageData:m.data?.imageData||m.imageData||null,
          text:(m.data?.imageData)?"📷 Photo":(m.text||""),
          read:m.isOwn&&lastFriendRead&&new Date(m.ts)<=new Date(lastFriendRead)
        }));
        // Only update if newest message is newer than what we have
        const serverNewest=incoming.slice(-1)[0]?.ts;
        const localNewest=lastMsgTsRef.current;
        const latestIsFriend=incoming.slice(-1)[0]&&!(incoming.slice(-1)[0].isOwn||incoming.slice(-1)[0].from===email);
        // Fix 10: show typing indicator briefly when friend just sent something new
        if(serverNewest&&serverNewest!==localNewest&&latestIsFriend){
          setTyping(true);
          if(typingTimeoutRef.current)clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current=setTimeout(()=>setTyping(false),1200);
        }
        if(serverNewest&&serverNewest!==localNewest){
          lastMsgTsRef.current=serverNewest;
          // Fix 4+5: merge — keep optimistic local messages & older loaded history
          setMessages(prev=>{
            // Keep any "older than server's window" messages already loaded
            const serverOldest=incoming[0]?.ts||"9999";
            const olderLocal=prev.filter(m=>m.ts<serverOldest);
            // Keep optimistic messages (own, no server id yet) newer than server newest
            const optimistic=prev.filter(m=>(m.isOwn||m.from===email)&&m.ts>serverNewest&&m.imageData);
            const merged=[...olderLocal,...incoming,...optimistic];
            // Deduplicate by id keeping latest
            const seen=new Map();
            merged.forEach(m=>{if(!seen.has(m.id)||m.ts>seen.get(m.id).ts)seen.set(m.id,m);});
            const final=[...seen.values()].sort((a,b)=>a.ts.localeCompare(b.ts)).slice(-200);
            LS.set(`ft-dm-${friend.email}`,final);
            return final;
          });
          // Auto-scroll only if we're near the bottom
          const list=listRef.current;
          if(list){const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<80;if(nearBottom)scrollToBottom(true);}
          SocialAPI.markDMsRead(email,friend.email);
          LS.set(`ft-last-read-${friend.email}`,new Date().toISOString());
          LS.set(`ft-unread-${friend.email}`,0);
        }
      });
    },document.visibilityState==="visible"?8000:90000);
    // Restart at correct rate on visibility change
    const dmVisHandler=()=>{
      clearInterval(poll);
      // poll immediately on return to foreground — handled by restart
    };
    document.addEventListener("visibilitychange",dmVisHandler);
    return()=>{clearInterval(poll);document.removeEventListener("visibilitychange",dmVisHandler);};
  },[email,friend.email]);

  const handleImg=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const c=await compressImage(file,600,0.72);
    if(c)setImgPreview(c);
    e.target.value="";
  };

  const send=()=>{
    if(!input.trim()&&!imgPreview)return;
    Haptic.light();
    const now=new Date().toISOString();
    if(imgPreview){
      const msg={id:uid(),from:email,name:displayName,text:"📷 Photo",imageData:imgPreview,ts:now,isOwn:true,read:false};
      setMessages(prev=>{const u=[...prev,msg].slice(-150);LS.set(`ft-dm-${friend.email}`,u);lastMsgTsRef.current=now;return u;});
      SocialAPI.sendDMImage(email,friend.email,imgPreview,displayName);
      SocialAPI.notifyDM(email,friend.email,displayName,"",true);
      setImgPreview(null);
    }
    if(input.trim()){
      const msg={id:uid(),from:email,name:displayName,text:input.trim(),ts:now,isOwn:true,read:false};
      setMessages(prev=>{const u=[...prev,msg].slice(-150);LS.set(`ft-dm-${friend.email}`,u);lastMsgTsRef.current=now;return u;});
      SocialAPI.sendDM(email,friend.email,input.trim(),displayName);
      SocialAPI.notifyDM(email,friend.email,displayName,input.trim(),false);
      LS.set("ft-dm-sent-today",today());
      setInput("");
    }
    scrollToBottom(true);
  };

  const handleInput=(v)=>setInput(v);

  const addReaction=(msgId,emoji)=>{
    const updated={...reactions,[msgId]:emoji};
    setReactions(updated);LS.set(`ft-reactions-${friend.email}`,updated);
    setReacting(null);
  };

  // Bug 11: dismiss reaction picker on outside tap
  useEffect(()=>{
    if(!reacting)return;
    const dismiss=(e)=>{
      if(!e.target.closest("[data-reaction-bubble]"))setReacting(null);
    };
    document.addEventListener("pointerdown",dismiss);
    return()=>document.removeEventListener("pointerdown",dismiss);
  },[reacting]);

  // Group messages: consecutive same-sender messages form a group
  // Insert date separators between groups on different days
  const buildGroups=()=>{
    const out=[];
    let lastDate="";
    let curGroup=null;
    messages.forEach((m,i)=>{
      const d2=new Date(m.ts);
      const dateKey=d2.toDateString();
      if(dateKey!==lastDate){
        if(curGroup)out.push(curGroup);
        curGroup=null;
        const now=new Date();
        const todayKey=now.toDateString();
        const yesterdayKey=new Date(now-86400000).toDateString();
        const diff=(now-d2)/86400000;
        let label=dateKey===todayKey?"Today":dateKey===yesterdayKey?"Yesterday":diff<7?d2.toLocaleDateString([],{weekday:"long"}):d2.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"});
        out.push({type:"date",label,key:"d-"+dateKey});
        lastDate=dateKey;
      }
      const isOwn=m.isOwn||m.from===email;
      if(!curGroup||curGroup.isOwn!==isOwn){
        if(curGroup)out.push(curGroup);
        curGroup={type:"group",isOwn,msgs:[m],key:"g-"+(m.id||i)};
      } else {
        curGroup.msgs.push(m);
      }
    });
    if(curGroup)out.push(curGroup);
    return out;
  };
  const groups=useMemo(()=>buildGroups(),[messages,email]);
  const lastOwnMsg=useMemo(()=>messages.filter(m=>m.isOwn||m.from===email).slice(-1)[0],[messages,email]);

  const quickMsgs=["💪 Nice PR!","🔥 Let's train","⏰ Don't skip today","👏 Keep it up","🏋️ Gym time?","🤝 You've got this"];
  const emojiReacts=["❤️","💪","🔥","😂","👍","😮"];

  // Bug 6: stabilize FriendAvatar with useMemo so React doesn't unmount on every render
  const FriendAvatar=useMemo(()=>({size=28})=>(
    <div style={{width:size,height:size,borderRadius:size/2,overflow:"hidden",flexShrink:0,
      background:friend.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
      display:"flex",alignItems:"center",justifyContent:"center",alignSelf:"flex-end"}}>
      {friend.avatar
        ?<img src={friend.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
        :<span style={{fontSize:size*0.4,color:"#fff",fontWeight:800}}>{(friend.name||"?")[0].toUpperCase()}</span>}
    </div>
  ),[friend.avatar,friend.name]);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)"}}>
      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,borderBottom:`1px solid ${V.cardBorder}`,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:2,cursor:"pointer",padding:"4px 0",flexShrink:0}}>
          <svg width="9" height="16" viewBox="0 0 9 16" fill="none"><path d="M8 1L1 8L8 15" stroke={V.accent} strokeWidth="2.2" strokeLinecap="round"/></svg>
          {/* Unread count badge on back arrow */}
        </button>
        {/* Tappable avatar/name — opens friend info sheet (Bug 3 fix: was calling onBack) */}
        <button onClick={()=>setFriendInfo(true)} style={{flex:1,display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>
          <div style={{width:36,height:36,borderRadius:18,overflow:"hidden",flexShrink:0,
            background:friend.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {friend.avatar
              ?<img src={friend.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
              :<span style={{fontSize:14,color:"#fff",fontWeight:800}}>{(friend.name||"?")[0].toUpperCase()}</span>}
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:V.text,lineHeight:1.2}}>{friendDisplayName(friend)}</div>
            {friend.username&&<div style={{fontSize:11,color:V.text3,marginTop:1}}>@{friend.username}</div>}
          </div>
        </button>
        {/* Video call placeholder — visual parity with iMessage */}
        <button style={{background:"none",border:"none",cursor:"default",padding:"4px 6px",opacity:0.35}}>
          <svg width="22" height="16" viewBox="0 0 24 18" fill="none" stroke={V.accent} strokeWidth="2" strokeLinecap="round"><rect x="1" y="2" width="15" height="14" rx="2"/><path d="M16 7l6-4v12l-6-4"/></svg>
        </button>
        <button style={{background:"none",border:"none",cursor:"default",padding:"4px 6px",opacity:0.35}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={V.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>

      {/* ── Message list ── */}
      <div ref={listRef} style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",display:"flex",flexDirection:"column",
        padding:"8px 0",gap:0}}>

        {/* Load older */}
        {hasMore&&(
          <div style={{textAlign:"center",padding:"6px 0 10px"}}>
            <button onClick={loadOlder} disabled={loadingOlder} style={{background:"none",border:"none",
              fontSize:12,color:V.accent,cursor:loadingOlder?"default":"pointer",padding:"4px 12px",fontFamily:V.font}}>
              {loadingOlder?"Loading…":"↑ Load older"}
            </button>
          </div>
        )}

        {loading&&messages.length===0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:8}}>💬</div>
              <div style={{fontSize:12,color:V.text3}}>Loading messages…</div>
            </div>
          </div>
        )}

        {!loading&&messages.length===0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{textAlign:"center",padding:"0 32px"}}>
              <div style={{width:72,height:72,borderRadius:36,overflow:"hidden",
                background:friend.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
                display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
                {friend.avatar
                  ?<img src={friend.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                  :<span style={{fontSize:28,color:"#fff",fontWeight:800}}>{(friend.name||"?")[0].toUpperCase()}</span>}
              </div>
              <div style={{fontSize:16,fontWeight:700,color:V.text,marginBottom:4}}>{friendDisplayName(friend)}</div>
              {friend.username&&<div style={{fontSize:12,color:V.text3,marginBottom:12}}>@{friend.username}</div>}
              <div style={{fontSize:12,color:V.text3}}>Say hi 👋</div>
            </div>
          </div>
        )}

        {groups.map(g=>{
          if(g.type==="date")return(
            <div key={g.key} style={{textAlign:"center",padding:"10px 0 6px"}}>
              <span style={{fontSize:11,color:V.text3,fontWeight:600,background:V.bg,padding:"2px 10px",borderRadius:8}}>{g.label}</span>
            </div>
          );

          const isOwn=g.isOwn;
          return(
            <div key={g.key} style={{display:"flex",flexDirection:"column",gap:2,
              alignItems:isOwn?"flex-end":"flex-start",padding:"2px 12px",marginBottom:4}}>
              {/* For friend messages: avatar only next to LAST message in group */}
              {g.msgs.map((m,mi)=>{
                const isLast=mi===g.msgs.length-1;
                const isFirst=mi===0;
                const reaction=reactions[m.id];
                // Bubble radius: iMessage groups: first/last have different corners
                const br=isOwn
                  ?{borderTopLeftRadius:18,borderTopRightRadius:isFirst?18:6,borderBottomRightRadius:isLast?4:6,borderBottomLeftRadius:18}
                  :{borderTopLeftRadius:isFirst?18:6,borderTopRightRadius:18,borderBottomRightRadius:18,borderBottomLeftRadius:isLast?4:6};
                const showAvatar=!isOwn&&isLast;
                const isLastOwn=lastOwnMsg&&m.id===lastOwnMsg.id;

                return(
                  <div key={m.id||mi} style={{display:"flex",alignItems:"flex-end",gap:6,
                    flexDirection:isOwn?"row-reverse":"row",maxWidth:"82%"}}>
                    {/* Avatar slot */}
                    {!isOwn&&(showAvatar?<FriendAvatar size={28}/>:<div style={{width:28,flexShrink:0}}/>)}

                    <div style={{display:"flex",flexDirection:"column",alignItems:isOwn?"flex-end":"flex-start"}}>
                      {/* Long-press → reaction picker (tap on mobile = onDoubleClick fallback) */}
                      <div onDoubleClick={()=>setReacting(reacting===m.id?null:m.id)}
                        data-reaction-bubble="1"
                        style={{position:"relative"}}>
                        {/* Bubble */}
                        {m.imageData?(
                          <div style={{...br,overflow:"hidden",position:"relative",cursor:"pointer"}}>
                            <img src={m.imageData} alt="Photo"
                              style={{display:"block",maxWidth:220,maxHeight:260,objectFit:"cover"}}/>
                            {/* Time overlay on image — no checkmarks, Read/Delivered shows below like text bubbles */}
                            <div style={{position:"absolute",bottom:6,right:8,fontSize:10,
                              color:"rgba(255,255,255,0.9)",background:"rgba(0,0,0,0.4)",
                              borderRadius:6,padding:"2px 6px"}}>
                              {new Date(m.ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
                            </div>
                          </div>
                        ):(
                          <div style={{
                            ...br,
                            padding:"8px 13px",
                            background:isOwn?V.accent:"rgba(255,255,255,0.08)",
                            border:isOwn?"none":`1px solid rgba(255,255,255,0.06)`,
                            cursor:"default",
                          }}>
                            <div style={{fontSize:15,color:isOwn?V.bg:V.text,lineHeight:1.4,wordBreak:"break-word"}}>{m.text}</div>
                          </div>
                        )}
                        {/* Reaction pill */}
                        {reaction&&(
                          <div style={{position:"absolute",bottom:-10,right:isOwn?4:"auto",left:isOwn?"auto":4,
                            background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:10,
                            padding:"1px 6px",fontSize:13,zIndex:2}}>{reaction}</div>
                        )}
                        {/* Reaction picker popover */}
                        {reacting===m.id&&(
                          <div style={{position:"absolute",bottom:"calc(100% + 8px)",
                            right:isOwn?0:"auto",left:isOwn?"auto":0,
                            background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:20,
                            padding:"6px 10px",display:"flex",gap:6,zIndex:10,
                            boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>
                            {emojiReacts.map(e=>(
                              <button key={e} onClick={()=>addReaction(m.id,e)} style={{background:"none",border:"none",
                                fontSize:20,cursor:"pointer",padding:"2px",borderRadius:8,
                                WebkitTapHighlightColor:"transparent"}}>{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Timestamp — only under last message in group (iMessage style) */}
                      {isLast&&(
                        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3,
                          justifyContent:isOwn?"flex-end":"flex-start",padding:"0 2px"}}>
                          <span style={{fontSize:10,color:V.text3}}>
                            {new Date(m.ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
                          </span>
                        </div>
                      )}
                      {/* Bug 5: iMessage shows "Read" text only under the last sent message, no checkmarks */}
                      {isOwn&&isLastOwn&&isLast&&(
                        <div style={{fontSize:10,color:m.read?V.accent:V.text3,marginTop:1,padding:"0 2px",transition:"color .3s"}}>
                          {m.read?"Read":"Delivered"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Typing indicator (three animated dots) */}
        {typing&&(
          <div style={{display:"flex",alignItems:"flex-end",gap:6,padding:"4px 12px"}}>
            <FriendAvatar size={28}/>
            <div style={{background:"rgba(255,255,255,0.08)",border:`1px solid rgba(255,255,255,0.06)`,
              borderRadius:"18px 18px 18px 4px",padding:"12px 14px",display:"flex",gap:4,alignItems:"center"}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:6,height:6,borderRadius:3,background:V.text3,
                  animation:`typingDot 1.2s ${i*0.2}s infinite ease-in-out`}}/>
              ))}
            </div>
          </div>
        )}

        <div ref={endRef}/>
      </div>

      {/* ── Quick replies ── */}
      <div style={{display:"flex",gap:6,overflowX:"auto",padding:"6px 12px 4px",
        WebkitOverflowScrolling:"touch",scrollbarWidth:"none",flexShrink:0}}>
        {quickMsgs.map((msg,i)=>(
          <button key={i} onClick={()=>{
            // Send immediately like iMessage quick replies
            const now=new Date().toISOString();
            const qmsg={id:uid(),from:email,name:displayName,text:msg,ts:now,isOwn:true,read:false};
            setMessages(prev=>{const u=[...prev,qmsg].slice(-150);LS.set(`ft-dm-${friend.email}`,u);lastMsgTsRef.current=now;return u;});
            SocialAPI.sendDM(email,friend.email,msg,displayName);
            SocialAPI.notifyDM(email,friend.email,displayName,msg,false);
            LS.set("ft-dm-sent-today",today());
            Haptic.light();
            scrollToBottom(true);
          }} style={{padding:"5px 11px",borderRadius:14,flexShrink:0,
            background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
            cursor:"pointer",fontSize:12,color:V.text3,fontFamily:V.font,whiteSpace:"nowrap"}}>
            {msg}
          </button>
        ))}
      </div>

      {/* ── Image preview ── */}
      {imgPreview&&(
        <div style={{padding:"0 12px 6px",flexShrink:0}}>
          <div style={{position:"relative",display:"inline-block"}}>
            <img src={imgPreview} alt="Preview" style={{maxHeight:90,maxWidth:160,borderRadius:10,display:"block",border:`2px solid ${V.accent}`}}/>
            <button onClick={()=>setImgPreview(null)} style={{position:"absolute",top:-6,right:-6,
              width:20,height:20,borderRadius:10,background:V.danger,border:`2px solid ${V.bg}`,
              cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:V.font}}>✕</button>
          </div>
        </div>
      )}

      {/* ── Push notification prompt ── */}
      {typeof Notification!=="undefined"&&Notification.permission==="default"&&(
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",flexShrink:0,
          borderTop:`1px solid ${V.cardBorder}`}}>
          <span style={{fontSize:11,color:V.text2,flex:1}}>🔔 Enable notifications for message alerts</span>
          <button onClick={async()=>{
            const p=await Notification.requestPermission();
            if(p==="granted"&&"serviceWorker" in navigator){
              const reg=await navigator.serviceWorker.ready;
              const vapidKey="BMZyIUQO08nuR7afvqNIWBK_ZOcr7PHwT2YwIxTa_ONwAD1YCaJ8Qkb4q4TTYSx_sTN-7-5vCzR8ApNZuyg-Ttc";
              const keyBytes=Uint8Array.from(atob(vapidKey.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
              const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes}).catch(()=>null);
              if(sub){await fetch(`${SYNC_URL}/api/push`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({action:"subscribe",email,subscription:sub.toJSON()})});SuccessToastCtrl.show("Notifications enabled 🔔");}
            }
          }} style={{padding:"5px 12px",borderRadius:12,background:V.accent,border:"none",cursor:"pointer",
            fontSize:11,fontWeight:700,color:V.bg,flexShrink:0,fontFamily:V.font}}>Enable</button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{display:"flex",alignItems:"flex-end",gap:8,padding:"8px 12px 12px",
        borderTop:`1px solid ${V.cardBorder}`,flexShrink:0,background:V.bg}}>
        {/* Camera / attach */}
        <input ref={imgRef} type="file" accept={"image/" + "*"} onChange={handleImg} style={{display:"none"}}/>
        <button onClick={()=>imgRef.current?.click()} style={{width:34,height:34,borderRadius:17,flexShrink:0,
          background:"rgba(255,255,255,0.06)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",marginBottom:2}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={V.text3} strokeWidth="2" strokeLinecap="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>

        {/* Text input — pill style */}
        <div style={{flex:1,position:"relative"}}>
          <textarea value={input} ref={inputRef}
            onChange={e=>{if(e.target.value.length<=1000)handleInput(e.target.value);}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="iMessage"
            rows={1}
            style={{width:"100%",padding:"9px 14px",background:"rgba(255,255,255,0.06)",
              border:`1px solid ${V.cardBorder}`,borderRadius:20,color:V.text,
              fontSize:15,outline:"none",fontFamily:V.font,boxSizing:"border-box",
              resize:"none",maxHeight:100,overflowY:"auto",lineHeight:1.4,
              WebkitOverflowScrolling:"touch",display:"block"}}/>
          {input.length>800&&(
            <span style={{position:"absolute",right:10,bottom:-14,fontSize:9,
              color:input.length>950?V.danger:V.text3}}>{input.length}/1000</span>
          )}
        </div>

        {/* Send / mic button */}
        <button onClick={send} disabled={!input.trim()&&!imgPreview}
          style={{width:34,height:34,borderRadius:17,flexShrink:0,marginBottom:2,
            background:(input.trim()||imgPreview)?V.accent:"rgba(255,255,255,0.06)",
            border:"none",cursor:(input.trim()||imgPreview)?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}}>
          {(input.trim()||imgPreview)
            ?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={V.bg} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={V.text3} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
        </button>
      </div>

      {/* Bug 3: Friend info sheet — slides up when header avatar/name tapped */}
      {friendInfo&&(
        <div style={{position:"fixed",inset:0,zIndex:80,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
          onClick={()=>setFriendInfo(false)}>
          <div style={{background:V.bg,border:`1px solid ${V.cardBorder}`,borderRadius:"20px 20px 0 0",
            padding:"12px 20px 32px",maxHeight:"80vh",overflowY:"auto"}}
            onClick={e=>e.stopPropagation()}>
            {/* Handle bar */}
            <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"0 auto 16px"}}/>
            {/* Avatar */}
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{width:80,height:80,borderRadius:40,overflow:"hidden",
                background:friend.avatar?"none":`linear-gradient(135deg,${V.purple},#ec4899)`,
                display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
                {friend.avatar
                  ?<img src={friend.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                  :<span style={{fontSize:32,color:"#fff",fontWeight:800}}>{(friend.name||"?")[0].toUpperCase()}</span>}
              </div>
              <div style={{fontSize:18,fontWeight:800,color:V.text}}>{friendDisplayName(friend)}</div>
              {friend.username&&<div style={{fontSize:13,color:V.text3,marginTop:2}}>@{friend.username}</div>}
              {friend.bio&&<div style={{fontSize:13,color:V.text2,marginTop:8,lineHeight:1.5,fontStyle:"italic"}}>{friend.bio}</div>}
            </div>
            {/* Quick actions */}
            <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:20}}>
              {[
                {icon:"📞",label:"Call",action:()=>{}},
                {icon:"📹",label:"Video",action:()=>{}},
                {icon:"🔔",label:"Mute",action:()=>{}},
                {icon:"🔍",label:"Search",action:()=>{}},
              ].map(btn=>(
                <button key={btn.label} onClick={btn.action} style={{display:"flex",flexDirection:"column",alignItems:"center",
                  gap:4,background:"rgba(255,255,255,0.06)",border:"none",borderRadius:12,
                  padding:"10px 16px",cursor:"pointer",minWidth:56}}>
                  <span style={{fontSize:20}}>{btn.icon}</span>
                  <span style={{fontSize:10,color:V.text3,fontWeight:600}}>{btn.label}</span>
                </button>
              ))}
            </div>
            {/* Info rows */}
            <div style={{display:"flex",flexDirection:"column",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:12,overflow:"hidden"}}>
              {friend.challenges?.map((c,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 16px",
                  borderBottom:`1px solid ${V.cardBorder}`}}>
                  <span style={{fontSize:13,color:V.text2,textTransform:"capitalize"}}>{c.challenge_id}</span>
                  <span style={{fontSize:13,fontWeight:700,color:V.accent,fontFamily:V.mono}}>{c.value}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setFriendInfo(false)} style={{width:"100%",marginTop:16,padding:"13px",
              background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:12,
              cursor:"pointer",fontSize:14,fontWeight:600,color:V.text3,fontFamily:V.font}}>Done</button>
          </div>
        </div>
      )}

      {/* CSS for typing animation */}
      <style>{`@keyframes typingDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  );
}

// ─── Social Sub-Page: Groups ───
// ─── Social Sub-Page: Groups (with tabs) ───
export function SocialGroups({s,d}){
  const email=s.profile?.email;
  const displayName=s.profile?.firstName||email?.split("@")[0]||"You";
  const [groups,setGroups]=useState(null);
  const [code,setCode]=useState("");
  const [newName,setNewName]=useState("");
  const [showCreate,setShowCreate]=useState(false);
  const [loadErr,setLoadErr]=useState(false);
  const [selGroup,setSelGroup]=useState(null);
  const [members,setMembers]=useState(null);
  const [groupTab,setGroupTab]=useState("board");
  const [chatMsg,setChatMsg]=useState("");
  const [chatMessages,setChatMessages]=useState([]);
  const [newChal,setNewChal]=useState({name:"",metric:"streak",target:"",endDate:""});
  const [showNewChal,setShowNewChal]=useState(false);
  const [groupChals,setGroupChals]=useState([]);
  const [groupFeed,setGroupFeed]=useState([]);
  const streak=useStreak(s.workouts);

  const loadGroups=()=>{setLoadErr(false);if(email)SocialAPI.getGroups(email).then(r=>{if(r)setGroups(r);else setLoadErr(true);});};
  useEffect(loadGroups,[email]);

  const join=async()=>{if(code.length<4)return;const r=await SocialAPI.joinGroup(email,code);
    if(r?.success){SuccessToastCtrl.show(`Joined ${r.group?.name||code}`);setCode("");loadGroups();}else SuccessToastCtrl.show(r?.error||"Failed");};
  const create=async()=>{if(!newName.trim())return;const r=await SocialAPI.createGroup(email,newName);
    if(r?.success){SuccessToastCtrl.show(`Created! Code: ${r.code}`);setNewName("");setShowCreate(false);loadGroups();}};
  const leave=async(c2)=>{ConfirmCtrl.show("Leave this group?","You can rejoin with the group code.",async()=>{await SocialAPI.leaveGroup(email,c2);loadGroups();SuccessToastCtrl.show("Left group");});};

  const openGroup=(gc)=>{
    setSelGroup(gc);setGroupTab("board");
    SocialAPI.getMembers(email,gc).then(setMembers);
    // Load from localStorage cache first, then refresh from API
    setGroupChals(LS.get(`ft-gchal-${gc}`)||[]);
    setChatMessages(LS.get(`ft-gchat-${gc}`)||[]);
    // Fetch group chat from API
    SocialAPI.getGroupEvents(email,gc,"GroupChat").then(r=>{
      if(r?.events?.length>0){
        const msgs=r.events.reverse().map(e=>({id:e.id,from:e.email,name:e.name,text:e.data?.text||e.data?.msg||"",ts:e.created_at}));
        setChatMessages(msgs);LS.set(`ft-gchat-${gc}`,msgs);
      }
    });
    // Fetch group challenges from API
    SocialAPI.getGroupEvents(email,gc,"GroupChallengeCreated").then(r=>{
      if(r?.events?.length>0){
        const chals=r.events.map(e=>({id:e.id,name:e.data?.challenge||"Challenge",metric:e.data?.metric||"streak",
          target:e.data?.target||null,created:e.created_at?.split("T")[0],createdBy:e.email}));
        const merged=[...chals,...(LS.get(`ft-gchal-${gc}`)||[]).filter(lc=>!chals.some(ac=>ac.name===lc.name))];
        setGroupChals(merged);LS.set(`ft-gchal-${gc}`,merged);
      }
    });
  };

  const sendChat=()=>{
    if(!chatMsg.trim()||chatMsg.length>200)return;
    Haptic.light();
    const msg={id:Date.now(),from:email,name:displayName,text:chatMsg.trim(),ts:new Date().toISOString()};
    const updated=[...chatMessages,msg].slice(-50);
    setChatMessages(updated);LS.set(`ft-gchat-${selGroup}`,updated);
    SocialAPI.logEvent(email,"GroupChat",{group:selGroup,text:chatMsg.trim(),name:displayName},"friends");
    setChatMsg("");
  };

  const createChal=()=>{
    if(!newChal.name||!newChal.target)return;
    const ch={id:uid(),name:newChal.name,metric:newChal.metric,target:parseInt(newChal.target),
      endDate:newChal.endDate||null,created:today(),createdBy:email};
    const updated=[...groupChals,ch];
    setGroupChals(updated);LS.set(`ft-gchal-${selGroup}`,updated);
    SocialAPI.logEvent(email,"GroupChallengeCreated",{group:selGroup,challenge:ch.name,metric:ch.metric,target:ch.target},"friends");
    SuccessToastCtrl.show("Challenge created!");
    setShowNewChal(false);setNewChal({name:"",metric:"streak",target:"",endDate:""});
  };

  const removeChal=(id)=>{const updated=groupChals.filter(c2=>c2.id!==id);setGroupChals(updated);LS.set(`ft-gchal-${selGroup}`,updated);};

  // ─── Group Detail View ───
  if(selGroup&&members)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <button onClick={()=>{setSelGroup(null);setMembers(null);}} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Groups</span>
      </button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>{groups?.groups?.find(g=>g.code===selGroup)?.name||selGroup}</div>
          <div style={{fontSize:10,color:V.text3}}>{selGroup} · {members?.members?.length||0} members</div>
        </div>
        <button onClick={()=>{navigator.clipboard?.writeText(selGroup);SuccessToastCtrl.show("Code copied");}} style={{padding:"4px 10px",borderRadius:6,background:`${V.accent}08`,border:`1px solid ${V.accent}30`,cursor:"pointer",fontSize:10,color:V.accent,fontWeight:600,fontFamily:V.font}}>Copy Code</button>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,background:V.card,borderRadius:10,padding:3,border:`1px solid ${V.cardBorder}`}}>
        {[{id:"board",l:"Board"},{id:"challenges",l:"Challenges"},{id:"feed",l:"Feed"},{id:"chat",l:"Chat"}].map(t=>(
          <button key={t.id} onClick={()=>setGroupTab(t.id)} style={{flex:1,padding:"8px 4px",borderRadius:8,
            background:groupTab===t.id?V.accent:"transparent",border:"none",cursor:"pointer",
            fontSize:10,fontWeight:groupTab===t.id?700:500,color:groupTab===t.id?V.bg:V.text3,fontFamily:V.font}}>{t.l}</button>
        ))}
      </div>

      {/* LEADERBOARD TAB */}
      {groupTab==="board"&&(()=>{
        const [lbMetric,setLbMetric]=useState("streak");
        const LB_METRICS=[{id:"streak",label:"Streak",icon:"🔥",cid:"streak",fmt:(v)=>`${v}d`},{id:"ironscore",label:"XP",icon:"⚡",cid:"ironscore",fmt:(v)=>v>=1000?`${(v/1000).toFixed(1)}k`:String(v)},{id:"big3",label:"Big 3",icon:"🏋️",cid:"big3",fmt:(v)=>`${v}lb`}];
        const getV=(m2,cid)=>parseInt(m2.challenges?.find(c3=>c3.challenge_id===cid)?.value||0);
        const curM=LB_METRICS.find(m2=>m2.id===lbMetric)||LB_METRICS[0];
        const sortedM=[...(members?.members||[])].sort((a,b)=>getV(b,curM.cid)-getV(a,curM.cid));
        const topV=Math.max(1,...sortedM.map(m2=>getV(m2,curM.cid)));
        return(<>
        <Card style={{padding:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[{l:"MEMBERS",v:members?.members?.length||0,c:V.accent},
              {l:"AVG STREAK",v:Math.round((members?.members||[]).reduce((a,m2)=>a+getV(m2,"streak"),0)/Math.max(1,(members?.members||[]).length))+"d",c:V.warn},
              {l:"TOP STREAK",v:Math.max(0,...(members?.members||[]).map(m2=>getV(m2,"streak")))+"d",c:V.purple}
            ].map((st,i)=>(
              <div key={i} style={{textAlign:"center",padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                <div style={{fontSize:16,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                <div style={{fontSize:8,color:V.text3}}>{st.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:4,marginBottom:12}}>
            {LB_METRICS.map(m2=>(
              <button key={m2.id} onClick={()=>setLbMetric(m2.id)} style={{flex:1,padding:"6px 4px",borderRadius:7,
                border:`1.5px solid ${lbMetric===m2.id?V.accent:V.cardBorder}`,
                background:lbMetric===m2.id?`${V.accent}10`:"transparent",cursor:"pointer",
                fontSize:9,fontWeight:700,color:lbMetric===m2.id?V.accent:V.text3,fontFamily:V.font}}>
                {m2.icon} {m2.label}
              </button>
            ))}
          </div>
          {sortedM.map((m,i)=>{
            const val=getV(m,curM.cid);
            const barPct=Math.round(val/topV*100);
            const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":String(i+1);
            return(
              <div key={i} style={{marginBottom:i<sortedM.length-1?8:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <div style={{width:22,height:22,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:i<3?14:9,fontWeight:800,color:V.text3}}>{medal}</div>
                  <div style={{flex:1,fontSize:12,fontWeight:600,color:m.user_email===email?V.accent:V.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {m.name}{m.user_email===email?" (you)":""}
                  </div>
                  <div style={{fontSize:12,fontWeight:800,color:i===0?"#f59e0b":V.text,fontFamily:V.mono,flexShrink:0}}>
                    {curM.fmt(val)}
                  </div>
                </div>
                <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.05)",marginLeft:30}}>
                  <div style={{height:"100%",borderRadius:2,background:i===0?"#f59e0b":V.accent,width:`${barPct}%`,transition:"width .4s"}}/>
                </div>
              </div>
            );
          })}
        </Card>
        </>);
      })()}

      {/* CHALLENGES TAB */}
      {groupTab==="challenges"&&(<>
        <Btn full onClick={()=>setShowNewChal(!showNewChal)}>{showNewChal?"Cancel":"+ New Challenge"}</Btn>
        {showNewChal&&(
          <Card style={{padding:14}}>
            <input value={newChal.name} onChange={e=>setNewChal(c2=>({...c2,name:e.target.value}))} placeholder="Challenge name"
              style={{width:"100%",padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.font,boxSizing:"border-box",marginBottom:8}}/>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              {["streak","volume","workouts","protein"].map(m2=>(
                <button key={m2} onClick={()=>setNewChal(c2=>({...c2,metric:m2}))} style={{flex:1,padding:"6px",borderRadius:6,
                  border:`1.5px solid ${newChal.metric===m2?V.accent:V.cardBorder}`,background:newChal.metric===m2?`${V.accent}08`:"transparent",
                  cursor:"pointer",fontSize:9,fontWeight:600,color:newChal.metric===m2?V.accent:V.text3,fontFamily:V.font,textTransform:"capitalize"}}>{m2}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={newChal.target} onChange={e=>setNewChal(c2=>({...c2,target:e.target.value}))} placeholder="Target" type="number"
                style={{flex:1,padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.mono}}/>
              <input value={newChal.endDate} onChange={e=>setNewChal(c2=>({...c2,endDate:e.target.value}))} type="date"
                style={{flex:1,padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",fontFamily:V.mono}}/>
            </div>
            <Btn full onClick={createChal} disabled={!newChal.name||!newChal.target}>Create Challenge</Btn>
          </Card>
        )}
        {groupChals.length>0?groupChals.map((ch,i)=>{
          const myVal=ch.metric==="streak"?streak:
            ch.metric==="workouts"?s.workouts.filter(w=>w.date>=ch.created).length:
            ch.metric==="volume"?s.workouts.filter(w=>w.date>=ch.created).reduce((a2,w)=>a2+w.exercises.reduce((b2,e)=>b2+e.sets.reduce((c2,st)=>c2+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0):
            ch.metric==="protein"?s.nutrition.filter(n=>n.date>=ch.created).reduce((a2,n)=>a2+(n.protein||0),0):0;
          const pct=Math.min(100,Math.round(myVal/ch.target*100));
          return(
            <Card key={i} style={{padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:13,fontWeight:700,color:V.text}}>{ch.name}</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:10,color:pct>=100?V.accent:V.text3,fontWeight:700}}>{pct}%</span>
                  {ch.createdBy===email&&<button onClick={()=>removeChal(ch.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,fontSize:10,color:V.text3}}>X</button>}
                </div>
              </div>
              <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)",marginBottom:6}}>
                <div style={{height:"100%",borderRadius:3,background:pct>=100?V.accent:V.warn,width:`${pct}%`,transition:"width .3s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:V.text3}}>
                <span>Your {ch.metric}: <span style={{color:V.accent,fontWeight:700}}>{myVal.toLocaleString()}</span> / {ch.target.toLocaleString()}</span>
                {ch.endDate&&<span>Ends {ch.endDate}</span>}
              </div>
            </Card>
          );
        }):(
          <Card style={{padding:20,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>No group challenges yet. Create one!</div></Card>
        )}
      </>)}

      {/* FEED TAB */}
      {groupTab==="feed"&&(<>
        {/* #3: Weekly recap */}
        {(()=>{
          const mems=members?.members||[];
          const totalWorkouts=groupFeed.filter(e=>e.type==="WorkoutLogged"&&new Date(e.created_at)>new Date(Date.now()-7*86400000)).length;
          const totalPRs=groupFeed.filter(e=>e.type==="PRHit"&&new Date(e.created_at)>new Date(Date.now()-7*86400000)).length;
          const topMember=(()=>{
            const counts={};groupFeed.filter(e=>e.type==="WorkoutLogged"&&new Date(e.created_at)>new Date(Date.now()-7*86400000))
              .forEach(e=>{counts[e.name]=(counts[e.name]||0)+1;});
            const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
            return sorted[0]?{name:sorted[0][0],count:sorted[0][1]}:null;
          })();
          const topStreak=mems.reduce((best,m)=>{
            const sv=parseInt(m.challenges?.find(c=>c.challenge_id==="streak")?.value||0);
            return sv>best.val?{name:m.name,val:sv}:best;
          },{name:"",val:0});
          if(totalWorkouts===0&&mems.length===0)return null;
          return(
            <Card style={{padding:14,border:`1px solid ${V.purple}20`,background:`${V.purple}04`,marginBottom:6}}>
              <div style={{fontSize:12,fontWeight:700,color:V.purple,marginBottom:8}}>📊 This Week</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{totalWorkouts}</div>
                  <div style={{fontSize:8,color:V.text3}}>WORKOUTS</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:V.warn,fontFamily:V.mono}}>{totalPRs}</div>
                  <div style={{fontSize:8,color:V.text3}}>PRs HIT</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{mems.length}</div>
                  <div style={{fontSize:8,color:V.text3}}>MEMBERS</div>
                </div>
              </div>
              {topMember&&<div style={{fontSize:10,color:V.text2}}>👑 <span style={{fontWeight:700,color:V.accent}}>{topMember.name}</span> led with {topMember.count} workout{topMember.count>1?"s":""}</div>}
              {topStreak.val>0&&<div style={{fontSize:10,color:V.text2,marginTop:2}}>🔥 Top streak: <span style={{fontWeight:700,color:V.warn}}>{topStreak.name}</span> ({topStreak.val} days)</div>}
            </Card>
          );
        })()}
        <div style={{fontSize:11,color:V.text3,marginBottom:4}}>Recent activity from group members</div>
        {groupFeed.length>0?groupFeed.slice(0,20).map((ev,i)=>(
          <Card key={i} style={{padding:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${V.accent},${V.purple})`,
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:11,color:V.bg,fontWeight:900}}>{(ev.name||"?")[0].toUpperCase()}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:ev.isOwn?V.accent:V.text}}>{ev.name||"Member"}</div>
                <div style={{fontSize:10,color:V.text3}}>
                  {ev.type==="WorkoutLogged"?`Logged workout (${ev.data?.exercises?.length||0} exercises)`:
                   ev.type==="PRHit"?`PR: ${ev.data?.exercise} ${ev.data?.weight}×${ev.data?.reps} 🎉`:
                   ev.type==="GroupChat"?ev.data?.text:
                   ev.type==="GroupChallengeCreated"?`Created challenge: ${ev.data?.challenge}`:
                   ev.type==="QuickMessage"?`${ev.data?.msg}`:ev.type}
                </div>
              </div>
              <div style={{fontSize:9,color:V.text3}}>{(()=>{const m2=Math.round((Date.now()-new Date(ev.created_at))/60000);return m2<60?`${m2}m`:m2<1440?`${Math.round(m2/60)}h`:`${Math.round(m2/1440)}d`;})()}</div>
            </div>
            {/* Reactions */}
            <div style={{display:"flex",gap:3,marginTop:6}}>
              {["🔥","💪","👏"].map(r=>(
                <button key={r} onClick={()=>{SocialAPI.react(email,ev.id,r);}} style={{padding:"3px 6px",borderRadius:6,
                  background:"transparent",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:12}}>
                  {r}
                </button>
              ))}
            </div>
          </Card>
        )):(
          <Card style={{padding:20,textAlign:"center"}}><div style={{fontSize:12,color:V.text3}}>No activity yet</div></Card>
        )}
      </>)}

      {/* CHAT TAB */}
      {groupTab==="chat"&&(<>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:4,maxHeight:400,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          {chatMessages.length===0&&<div style={{textAlign:"center",padding:30,fontSize:12,color:V.text3}}>No messages yet</div>}
          {chatMessages.map((msg,i)=>{
            const isMe=msg.from===email;
            return(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",marginBottom:4}}>
                {!isMe&&<div style={{fontSize:9,color:V.text3,marginBottom:2,marginLeft:4}}>{msg.name}</div>}
                <div style={{padding:"8px 12px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:isMe?V.accent:"rgba(255,255,255,0.06)",maxWidth:"80%"}}>
                  <div style={{fontSize:12,color:isMe?V.bg:V.text}}>{msg.text}</div>
                </div>
                <div style={{fontSize:8,color:V.text3,marginTop:1}}>{new Date(msg.ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:8,marginTop:8,alignItems:"flex-end"}}>
          <div style={{flex:1,position:"relative"}}>
            <input value={chatMsg} onChange={e=>{if(e.target.value.length<=200)setChatMsg(e.target.value);}} placeholder="Message..." maxLength={200}
              onKeyDown={e=>{if(e.key==="Enter")sendChat();}}
              style={{width:"100%",padding:"10px 14px",background:V.card,border:`1px solid ${V.cardBorder}`,borderRadius:20,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,boxSizing:"border-box"}}/>
            {chatMsg.length>0&&<span style={{position:"absolute",right:12,bottom:-14,fontSize:8,
              color:chatMsg.length>180?V.danger:V.text3}}>{chatMsg.length}/200</span>}
          </div>
          <button onClick={sendChat} disabled={!chatMsg.trim()||chatMsg.length>200} style={{width:40,height:40,borderRadius:20,
            background:chatMsg.trim()?V.accent:"rgba(255,255,255,0.06)",border:"none",cursor:chatMsg.trim()?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chatMsg.trim()?V.bg:V.text3} strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </>)}
    </div>
  );

  // ─── Groups List ───
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Groups</div>
      {loadErr&&<Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:11,color:V.danger,marginBottom:6}}>Could not load</div>
        <Btn v="secondary" full onClick={loadGroups}>Retry</Btn></Card>}
      <Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:6}}>Join a Group</div>
        <div style={{display:"flex",gap:8}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Enter code" maxLength={8}
            style={{flex:1,padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.mono,letterSpacing:3}}/>
          <Btn onClick={join} disabled={code.length<4}>Join</Btn>
        </div>
      </Card>
      {!showCreate?<Btn v="secondary" full onClick={()=>setShowCreate(true)}>Create a Group</Btn>:(
        <Card style={{padding:14}}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Group name"
            style={{width:"100%",padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:13,outline:"none",fontFamily:V.font,boxSizing:"border-box",marginBottom:8}}/>
          <div style={{display:"flex",gap:8}}><Btn v="secondary" onClick={()=>setShowCreate(false)}>Cancel</Btn><Btn full onClick={create}>Create</Btn></div>
        </Card>
      )}
      {groups?.groups?.map(g=>(
        <Card key={g.code} style={{padding:14,cursor:"pointer"}} onClick={()=>openGroup(g.code)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:V.text}}>{g.name}</div>
              <div style={{fontSize:10,color:V.text3}}>{g.code} · {g.member_count} member{g.member_count!==1?"s":""}</div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button onClick={e=>{e.stopPropagation();leave(g.code);}} style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:10,color:V.text3,fontFamily:V.font}}>Leave</button>
              {Icons.chevRight({size:14,color:V.text3})}
            </div>
          </div>
        </Card>
      ))}
      {(!groups?.groups||groups.groups.length===0)&&!loadErr&&<div style={{textAlign:"center",padding:20,fontSize:12,color:V.text3}}>No groups yet. Join or create one!</div>}
    </div>
  );
}


// ─── Social Sub-Page: Profile ───
export function SocialProfile({s,d}){
  const email=s.profile?.email;const defaultUn=email?.split("@")[0]||"athlete";
  const [username,setUsername]=useState(LS.get("ft-username")||defaultUn);
  const [editingUn,setEditingUn]=useState(false);
  const [newUn,setNewUn]=useState(username);
  const [unError,setUnError]=useState("");
  const streak=useStreak(s.workouts);
  const getBestLift=(id)=>{let b=0;s.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{if(st.weight>b)b=st.weight;});}));return b;};
  const big3=getBestLift("bench")+getBestLift("squat")+getBestLift("deadlift");
  const [privacy,setPrivacy]=useState(LS.get("ft-privacy")||{workouts:false,macros:false,photos:false,body:false});
  const toggleP=(k)=>{const n={...privacy,[k]:!privacy[k]};setPrivacy(n);LS.set("ft-privacy",n);};
  const [bio,setBio]=useState(s.profile?.bio||LS.get("ft-bio")||"");
  const [editBio,setEditBio]=useState(false);
  const profilePic=LS.get("ft-profile-pic");
  const bannerPic=LS.get("ft-profile-banner");
  const picRef=useRef(null);
  const bannerRef=useRef(null);

  const syncProfile=(extra)=>{
    if(!email)return;
    SocialAPI.updateProfile(email,{
      avatar:LS.get("ft-profile-pic"),
      banner:LS.get("ft-profile-banner"),
      bio:LS.get("ft-bio"),
      username:LS.get("ft-username"),
      ...extra
    });
  };

  const handleProfilePic=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const compressed=await compressImage(file,200,0.7);
    if(compressed){LS.set("ft-profile-pic",compressed);SuccessToastCtrl.show("Profile photo updated");
      d({type:"SET_PROFILE",profile:{...s.profile,avatar:compressed}});
      syncProfile({avatar:compressed});}
    e.target.value="";
  };

  const handleBanner=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    // Banner: wide crop, lower quality — 900×300 effective canvas
    const banner=await (()=>new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        URL.revokeObjectURL(img.src);
        const targetW=900,targetH=300;
        const srcRatio=img.width/img.height,tgtRatio=targetW/targetH;
        let sx=0,sy=0,sw=img.width,sh=img.height;
        if(srcRatio>tgtRatio){sw=img.height*tgtRatio;sx=(img.width-sw)/2;}
        else{sh=img.width/tgtRatio;sy=(img.height-sh)/2;}
        const c=document.createElement("canvas");c.width=targetW;c.height=targetH;
        c.getContext("2d").drawImage(img,sx,sy,sw,sh,0,0,targetW,targetH);
        resolve(c.toDataURL("image/jpeg",0.65));
      };
      img.onerror=()=>{URL.revokeObjectURL(img.src);resolve(null);};
      img.src=URL.createObjectURL(file);
    }))();
    if(banner){LS.set("ft-profile-banner",banner);SuccessToastCtrl.show("Banner updated");
      syncProfile({banner});}
    e.target.value="";
  };

  const saveBio=()=>{
    const trimmed=bio.trim().slice(0,120);
    LS.set("ft-bio",trimmed);
    d({type:"SET_PROFILE",profile:{...s.profile,bio:trimmed}});
    setEditBio(false);SuccessToastCtrl.show("Bio saved");
    syncProfile({bio:trimmed});
  };

  // Friend code: deterministic from email hash
  const friendCode=useMemo(()=>{
    let h=0;for(let i=0;i<(email||"").length;i++){h=((h<<5)-h)+(email||"").charCodeAt(i);h|=0;}
    return"IRON-"+Math.abs(h).toString(36).toUpperCase().slice(0,4).padEnd(4,"0");
  },[email]);

  // QR Code SVG generator (simple version matrix)

  useEffect(()=>{
    if(email&&!LS.get("ft-username-claimed")){
      SocialAPI.setUsername(email,defaultUn).then(r=>{
        if(r?.success){LS.set("ft-username",r.username);LS.set("ft-username-claimed",true);setUsername(r.username);}
      });
    }
  },[email]);

  const claimUsername=async()=>{
    const clean=newUn.toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3){setUnError("Min 3 characters");return;}
    const r=await SocialAPI.setUsername(email,clean);
    if(r?.success){setUsername(r.username);LS.set("ft-username",r.username);LS.set("ft-username-claimed",true);
      setEditingUn(false);setUnError("");SuccessToastCtrl.show(`Username set to @${r.username}`);
      syncProfile({username:r.username});}
    else setUnError(r?.error||"Failed");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Profile card with banner */}
      <Card style={{padding:0,overflow:"hidden",textAlign:"center"}}>
        <input ref={picRef} type="file" accept={"image/" + "*"} capture="user" onChange={handleProfilePic} style={{display:"none"}}/>
        <input ref={bannerRef} type="file" accept={"image/" + "*"} onChange={handleBanner} style={{display:"none"}}/>

        {/* Banner area */}
        <div onClick={()=>bannerRef.current?.click()} style={{width:"100%",height:110,position:"relative",cursor:"pointer",
          background:bannerPic?"none":`linear-gradient(135deg,${V.accent}40,${V.purple}40,#ec489940)`,overflow:"hidden"}}>
          {bannerPic&&<img src={bannerPic} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.18)",display:"flex",alignItems:"center",
            justifyContent:"center",opacity:0,transition:"opacity .2s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
            <span style={{fontSize:11,color:"#fff",fontWeight:700,background:"rgba(0,0,0,0.5)",padding:"4px 12px",borderRadius:20}}>Change Banner</span>
          </div>
          {/* Always-visible edit hint for mobile */}
          <div style={{position:"absolute",bottom:6,right:8,background:"rgba(0,0,0,0.5)",borderRadius:6,padding:"3px 8px",
            display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:10,color:"#fff"}}>📷</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.85)"}}>Edit banner</span>
          </div>
        </div>

        {/* Avatar — overlaps banner */}
        <div style={{padding:"0 16px 16px",marginTop:-36}}>
          <div style={{position:"relative",display:"inline-block",marginBottom:8}}>
            <div onClick={()=>picRef.current?.click()} style={{width:72,height:72,borderRadius:20,
              background:profilePic?"none":`linear-gradient(135deg,${V.accent},#ec4899)`,
              display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
              overflow:"hidden",border:`3px solid ${V.bg}`,position:"relative",boxShadow:"0 4px 12px rgba(0,0,0,0.4)"}}>
              {profilePic?<img src={profilePic} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :<span style={{fontSize:28,color:V.bg,fontWeight:900}}>{username[0]?.toUpperCase()}</span>}
            </div>
            <div style={{position:"absolute",bottom:0,right:0,width:22,height:22,borderRadius:11,
              background:V.accent,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${V.bg}`,
              pointerEvents:"none"}}>
              <span style={{fontSize:10,color:V.bg}}>📷</span>
            </div>
          </div>
        <div style={{fontSize:18,fontWeight:800,color:V.text}}>{s.profile?.firstName||username}</div>
        {/* Rank badge */}
        {(()=>{const {rank}=calcIronScore(s);return <div style={{marginBottom:4}}><RankBadge rank={rank} size="sm"/></div>;})()}
        {!editingUn?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:11,color:V.text3}}>@{username}</span>
            <button onClick={()=>{setEditingUn(true);setNewUn(username);}} style={{background:"none",border:"none",cursor:"pointer",padding:2}}>
              <span style={{fontSize:10,color:V.accent}}>edit</span>
            </button>
          </div>
        ):(
          <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:4}}>
            <input value={newUn} onChange={e=>setNewUn(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}
              maxLength={20} style={{padding:"6px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:6,color:V.text,fontSize:12,outline:"none",fontFamily:V.mono,width:140,textAlign:"center"}}/>
            <button onClick={claimUsername} style={{padding:"6px 10px",borderRadius:6,background:V.accent,border:"none",
              cursor:"pointer",fontSize:10,fontWeight:700,color:V.bg,fontFamily:V.font}}>Save</button>
            <button onClick={()=>{setEditingUn(false);setUnError("");}} style={{padding:"6px 8px",borderRadius:6,
              background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:10,color:V.text3}}>✕</button>
          </div>
        )}
        {unError&&<div style={{fontSize:10,color:V.danger,marginTop:4}}>{unError}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,margin:"12px 0"}}>
          {[{l:"STREAK",v:streak,c:V.accent},{l:"WORKOUTS",v:s.workouts.length,c:V.purple},{l:"BIG 3",v:big3||"—",c:V.warn}].map(st=>(
            <div key={st.l} style={{padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:16,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
              <div style={{fontSize:8,color:V.text3}}>{st.l}</div>
            </div>
          ))}
        </div>
        {big3>0&&<div style={{fontSize:10,color:V.text3}}>B: {getBestLift("bench")} · S: {getBestLift("squat")} · D: {getBestLift("deadlift")} {wUnit(s.units)}</div>}
        {/* Bio */}
        <div style={{marginTop:10,borderTop:`1px solid ${V.cardBorder}`,paddingTop:10}}>
          {!editBio?(
            <div>
              {bio?<div style={{fontSize:12,color:V.text2,lineHeight:1.5,fontStyle:"italic"}}>{bio}</div>
                :<div style={{fontSize:11,color:V.text3}}>No bio yet</div>}
              <button onClick={()=>setEditBio(true)} style={{background:"none",border:"none",cursor:"pointer",
                fontSize:10,color:V.accent,marginTop:4}}>{bio?"Edit bio":"Add bio"}</button>
            </div>
          ):(
            <div>
              <textarea value={bio} onChange={e=>{if(e.target.value.length<=120)setBio(e.target.value);}} placeholder="Tell people about yourself..."
                maxLength={120} rows={2} style={{width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.04)",
                  border:`1px solid ${V.cardBorder}`,borderRadius:8,color:V.text,fontSize:12,outline:"none",
                  fontFamily:V.font,resize:"none",boxSizing:"border-box"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                <span style={{fontSize:10,color:bio.length>100?V.warn:V.text3}}>{bio.length}/120</span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{setEditBio(false);setBio(s.profile?.bio||LS.get("ft-bio")||"");}} style={{padding:"4px 8px",borderRadius:4,
                    background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:10,color:V.text3}}>Cancel</button>
                  <button onClick={saveBio} style={{padding:"4px 10px",borderRadius:4,background:V.accent,border:"none",
                    cursor:"pointer",fontSize:10,fontWeight:700,color:V.bg}}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>{/* end padding wrapper */}
      </Card>

      {/* Badges on Profile */}
      {(()=>{
        const {checks,dates}=calcEarnedBadges(s);
        const earned=BADGE_DEFS.filter(b=>checks[b.id]);
        if(earned.length===0)return null;
        const fmtDate=(d)=>d?new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"";
        return(
          <Card style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:800,color:V.text}}>🏅 My Badges</div>
              <button onClick={()=>d({type:"TAB",tab:"social_badges"})} style={{background:"none",border:"none",
                cursor:"pointer",fontSize:10,color:V.accent,fontWeight:700}}>View All →</button>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {earned.map(b=>(
                <div key={b.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:56,maxWidth:70}}>
                  <div style={{width:46,height:46,borderRadius:12,
                    background:`linear-gradient(135deg,${V.accent}18,${V.purple}18)`,
                    border:`1.5px solid ${V.accent}35`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
                    {b.icon}
                  </div>
                  <span style={{fontSize:8,color:V.accent,fontWeight:700,textAlign:"center",lineHeight:1.2}}>{b.name}</span>
                  {dates[b.id]&&<span style={{fontSize:7,color:V.text3,textAlign:"center"}}>{fmtDate(dates[b.id])}</span>}
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Friend Code */}
      <Card style={{padding:16,textAlign:"center"}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:4}}>Your Friend Code</div>
        <div style={{fontSize:28,fontWeight:900,color:V.accent,fontFamily:V.mono,letterSpacing:4,margin:"8px 0"}}>{friendCode}</div>
        <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Share this code — friends enter it to add you</div>
        <div style={{display:"flex",gap:8}}>
          <Btn full onClick={()=>{navigator.clipboard?.writeText(friendCode);SuccessToastCtrl.show("Code copied");}}>Copy Code</Btn>
          <Btn v="secondary" full onClick={()=>{
            const addUrl=`https://ironlog.space/add?code=${friendCode}${username?`&u=${username}`:''}`;
            const shareText=`Add me on IRONLOG! Tap the link or enter my code: ${friendCode}`;
            if(navigator.share)navigator.share({title:"Add me on IRONLOG",text:shareText,url:addUrl});
            else{navigator.clipboard?.writeText(`${shareText}\n${addUrl}`);SuccessToastCtrl.show("Copied to clipboard");}
          }}>Share</Btn>
        </div>
      </Card>

      {/* QR Code — real scannable */}
      <Card style={{padding:16,textAlign:"center"}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>QR Code</div>
        <div style={{display:"inline-block",padding:12,background:"#fff",borderRadius:12,marginBottom:8}}>
          {/* QR encodes a real URL so any scanner opens ironlog.space/add?code=IRON-XXXX */}
          {/* When opened inside the app the deep-link handler auto-fills the add-friend sheet */}
          {(() => {
            const addUrl = `https://ironlog.space/add?code=${friendCode}${username?`&u=${username}`:''}`;
            return (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(addUrl)}&size=140x140&bgcolor=ffffff&color=0e0e16&margin=0`}
                alt="QR Code" width="140" height="140" style={{display:"block",borderRadius:4}}
                onError={e=>{e.target.style.display="none";e.target.parentNode.innerHTML='<div style="width:140px;height:140px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#666">QR unavailable offline</div>';}}
              />
            );
          })()}
        </div>
        <div style={{fontSize:10,color:V.text3,marginBottom:4}}>Scan to add — works from any camera app</div>
        <div style={{fontSize:9,color:V.text3,fontFamily:V.mono,opacity:0.5,wordBreak:"break-all",maxWidth:160,margin:"0 auto"}}>
          ironlog.space/add?code={friendCode}
        </div>
      </Card>

      {/* Privacy controls */}
      <Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>🔒 Privacy</div>
        <div style={{fontSize:10,color:V.text3,marginBottom:8}}>Private by default. Toggle what friends see.</div>
        {[{k:"workouts",l:"Workouts & PRs"},{k:"macros",l:"Macros"},{k:"photos",l:"Photos"},{k:"body",l:"Body Metrics"}].map(p=>(
          <div key={p.k} onClick={()=>toggleP(p.k)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`,cursor:"pointer"}}>
            <span style={{fontSize:12,color:V.text}}>{p.l}</span>
            <div style={{width:36,height:20,borderRadius:10,background:privacy[p.k]?V.accent:"rgba(255,255,255,0.1)",padding:2,transition:"all .2s"}}>
              <div style={{width:16,height:16,borderRadius:8,background:"#fff",transform:privacy[p.k]?"translateX(16px)":"translateX(0)",transition:"transform .2s"}}/>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Social Sub-Page: Badges ───
export function SocialBadges({s}){
  const {checks,dates}=useMemo(()=>calcEarnedBadges(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);
  const [catFilter,setCatFilter]=useState("All");
  const cats=["All",...new Set(BADGE_DEFS.map(b=>b.cat))];
  const earnedCount=BADGE_DEFS.filter(b=>checks[b.id]).length;
  const filtered=catFilter==="All"?BADGE_DEFS:BADGE_DEFS.filter(b=>b.cat===catFilter);
  const fmtDate=(d)=>d?new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"";

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Badges</div>
          <div style={{fontSize:11,color:V.text3}}>{earnedCount} of {BADGE_DEFS.length} earned</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:22,fontWeight:900,color:V.accent,fontFamily:V.mono}}>{earnedCount}</div>
          <div style={{fontSize:9,color:V.text3}}>TOTAL</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)"}}>
        <div style={{height:"100%",borderRadius:3,background:`linear-gradient(90deg,${V.accent},${V.purple})`,
          width:`${Math.round(earnedCount/BADGE_DEFS.length*100)}%`,transition:"width .5s"}}/>
      </div>

      {/* Earned badges showcase (top 5) */}
      {earnedCount>0&&(
        <Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:8}}>RECENTLY EARNED</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {BADGE_DEFS.filter(b=>checks[b.id]).slice(0,6).map(b=>(
              <div key={b.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:52}}>
                <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${V.accent}18,${V.purple}18)`,
                  border:`1.5px solid ${V.accent}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
                  {b.icon}
                </div>
                <span style={{fontSize:8,color:V.accent,fontWeight:700,textAlign:"center",maxWidth:52,lineHeight:1.2}}>{b.name}</span>
                {dates[b.id]&&<span style={{fontSize:7,color:V.text3}}>{fmtDate(dates[b.id])}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category filter */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {cats.map(c=><Chip key={c} label={c} active={catFilter===c} onClick={()=>setCatFilter(c)}/>)}
      </div>

      {/* Badge grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {filtered.map(b=>{
          const earned=checks[b.id];
          const earnDate=dates[b.id];
          return(
            <Card key={b.id} style={{padding:12,opacity:earned?1:0.38,
              border:earned?`1px solid ${V.accent}30`:`1px solid ${V.cardBorder}`,
              background:earned?`linear-gradient(135deg,${V.accent}06,${V.purple}06)`:undefined}}>
              <div style={{fontSize:26,marginBottom:4}}>{b.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:earned?V.text:V.text3,lineHeight:1.2,marginBottom:2}}>{b.name}</div>
              <div style={{fontSize:9,color:V.text3,lineHeight:1.3,marginBottom:6}}>{b.desc}</div>
              {earned?(
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:9,color:V.accent,fontWeight:700}}>✅ Earned</span>
                  {earnDate&&<span style={{fontSize:8,color:V.text3}}>{fmtDate(earnDate)}</span>}
                </div>
              ):(
                <div style={{fontSize:9,color:V.text3,fontStyle:"italic"}}>Locked</div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Social Sub-Page: Notifications ───
export function SocialNotifications({s,d}){
  const email=s.profile?.email;
  const [notifs,setNotifs]=useState(null);
  const [filter,setFilter]=useState("unread");
  const [loading,setLoading]=useState(true);

  const load=()=>{
    if(!email)return;
    setLoading(true);
    SocialAPI.getNotifications(email).then(r=>{
      if(r)setNotifs(r);
      setLoading(false);
    });
  };
  useEffect(load,[email]);

  const markAllRead=async()=>{
    await SocialAPI.markRead(email,"all");
    setNotifs(n=>({...n,unread:0,notifications:(n?.notifications||[]).map(x=>({...x,read:true}))}));
    SuccessToastCtrl.show("All marked as read");
  };

  const clearRead=async()=>{
    await SocialAPI.clearReadNotifs(email);
    setNotifs(n=>({...n,notifications:(n?.notifications||[]).filter(x=>!x.read)}));
    SuccessToastCtrl.show("Cleared read notifications");
  };

  const deleteOne=async(id)=>{
    await SocialAPI.deleteNotif(email,id);
    setNotifs(n=>({...n,notifications:(n?.notifications||[]).filter(x=>x.id!==id),
      unread:Math.max(0,(n?.unread||0)-(n?.notifications?.find(x=>x.id===id&&!x.read)?1:0))}));
  };

  const markOneRead=async(notif)=>{
    if(!notif.read){
      await SocialAPI.markRead(email,notif.id);
      setNotifs(n=>({...n,unread:Math.max(0,(n?.unread||0)-1),
        notifications:(n?.notifications||[]).map(x=>x.id===notif.id?{...x,read:true}:x)}));
    }
  };

  const tapNotif=(notif)=>{
    markOneRead(notif);
    if(notif.type==="dm"||notif.metadata?.from){
      d({type:"TAB",tab:"social_friends"});
    }else if(notif.type==="group_chat"||notif.metadata?.group){
      d({type:"TAB",tab:"social_groups"});
    }
  };

  // Clean email from notification body if present (old notifications before fix)
  const cleanBody=(body)=>{
    if(!body)return"";
    return body.replace(/[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/g,m=>{
      const prefix=m.split("@")[0].replace(/[._\-+]/g," ");
      return prefix.replace(/\b\w/g,c=>c.toUpperCase()).trim()||"Someone";
    });
  };

  const all=notifs?.notifications||[];
  const filtered=filter==="unread"?all.filter(n=>!n.read):
    filter==="messages"?all.filter(n=>n.type==="dm"||n.type==="group_chat"):all;
  const unreadCount=notifs?.unread||0;
  const readCount=all.filter(n=>n.read).length;

  const timeAgo=(ts)=>{
    if(!ts)return"";
    const m=Math.round((Date.now()-new Date(ts))/60000);
    if(m<1)return"now";if(m<60)return`${m}m`;if(m<1440)return`${Math.round(m/60)}h`;return`${Math.round(m/1440)}d`;
  };

  const typeIcon=(n)=>{
    if(n.type==="dm")return"💬";
    if(n.type==="group_chat")return"👥";
    if(n.type==="friend_request")return"🤝";
    if(n.type==="reaction")return"🔥";
    return"🔔";
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:V.text}}>Notifications</div>
          {unreadCount>0&&<div style={{fontSize:10,color:V.accent}}>{unreadCount} unread</div>}
        </div>
        <div style={{display:"flex",gap:4}}>
          {unreadCount>0&&<button onClick={markAllRead} style={{padding:"4px 10px",borderRadius:6,
            background:`${V.accent}10`,border:`1px solid ${V.accent}20`,cursor:"pointer",fontSize:9,fontWeight:700,color:V.accent,fontFamily:V.font}}>Read All</button>}
          {readCount>0&&<button onClick={clearRead} style={{padding:"4px 10px",borderRadius:6,
            background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:9,color:V.text3,fontFamily:V.font}}>Clear Read</button>}
        </div>
      </div>

      <div style={{display:"flex",gap:4}}>
        {[{id:"unread",l:`Unread${unreadCount>0?` (${unreadCount})`:""}`},{id:"messages",l:"Messages"},{id:"all",l:"All"}].map(f=>(
          <Chip key={f.id} label={f.l} active={filter===f.id} onClick={()=>setFilter(f.id)}/>
        ))}
      </div>

      {loading&&<div><SkeletonCard lines={2}/><div style={{height:8}}/><SkeletonCard lines={2}/></div>}

      {!loading&&filtered.length===0&&(
        <Card style={{padding:30,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>{filter==="unread"?"✅":"🔔"}</div>
          <div style={{fontSize:13,fontWeight:600,color:filter==="unread"?V.accent:V.text3}}>
            {filter==="unread"?"All caught up!":"No notifications yet"}
          </div>
        </Card>
      )}

      {filtered.map(n=>(
        <Card key={n.id} onClick={()=>tapNotif(n)} style={{padding:12,cursor:"pointer",
          borderLeft:n.read?"none":`3px solid ${n.type==="dm"?V.accent:n.type==="group_chat"?V.purple:V.warn}`}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{width:32,height:32,borderRadius:10,
              background:n.read?"rgba(255,255,255,0.03)":`${n.type==="dm"?V.accent:V.purple}15`,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}>
              {typeIcon(n)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:n.read?500:700,color:n.read?V.text3:V.text}}>{n.title}</span>
                <span style={{fontSize:9,color:V.text3,flexShrink:0}}>{timeAgo(n.created_at)}</span>
              </div>
              <div style={{fontSize:11,color:n.read?V.text3:V.text2,marginTop:2,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanBody(n.body)}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();deleteOne(n.id);}} style={{
              background:"none",border:"none",cursor:"pointer",padding:4,flexShrink:0,opacity:0.4}}>
              {Icons.x({size:12,color:V.text3})}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Social Sub-Page: Compare (You vs Best) ───
export function SocialCompare({s}){
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const wt=parseFloat(st.weight)||0;if(wt>b)b=wt;});}));return b;};
  const e1rmBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const e1rm=calc1RM(parseFloat(st.weight)||0,parseInt(st.reps)||0);if(e1rm>b)b=e1rm;});}));return b;};
  const weekW=s.workouts.filter(w=>w.date>=ago(7)).length;
  const bestWeek=Math.max(...Array.from({length:12},(_,i)=>s.workouts.filter(w=>{const d2=ago(i*7);const d3=ago((i+1)*7);return w.date<=d2&&w.date>d3;}).length),weekW);
  const streak=useStreak(s.workouts);
  const bestStreak=(()=>{let best=0,c=0;for(let i=0;i<365;i++){if(s.workouts.some(w=>w.date===ago(i))){c++;if(c>best)best=c;}else c=0;}return best;})();
  const thisMonthW=s.workouts.filter(w=>w.date>=ago(30)).length;
  const bestMonth=Math.max(...Array.from({length:6},(_,i)=>s.workouts.filter(w=>w.date>=ago((i+1)*30)&&w.date<ago(i*30)).length),thisMonthW);
  const totalVol=Math.round(s.workouts.filter(w=>w.date>=ago(7)).reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
  const bestWeekVol=Math.max(...Array.from({length:8},(_,i)=>Math.round(s.workouts.filter(w=>w.date>=ago((i+1)*7)&&w.date<ago(i*7)).reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0))),totalVol);
  const bench=getBest("bench"),squat=getBest("squat"),dead=getBest("deadlift");
  const benchE1=e1rmBest("bench"),squatE1=e1rmBest("squat"),deadE1=e1rmBest("deadlift");
  const bestBench=Math.max(...s.workouts.map(w=>w.exercises.filter(e=>e.exerciseId==="bench").reduce((b,e)=>Math.max(b,...e.sets.map(st=>parseFloat(st.weight)||0)),0)),bench);
  const bestSquat=Math.max(...s.workouts.map(w=>w.exercises.filter(e=>e.exerciseId==="squat").reduce((b,e)=>Math.max(b,...e.sets.map(st=>parseFloat(st.weight)||0)),0)),squat);
  const bestDead=Math.max(...s.workouts.map(w=>w.exercises.filter(e=>e.exerciseId==="deadlift").reduce((b,e)=>Math.max(b,...e.sets.map(st=>parseFloat(st.weight)||0)),0)),dead);

  const pct=(cur,best)=>best>0?Math.min(100,Math.round(cur/best*100)):100;

  const Row=({label,current,best,unit,fmt})=>{
    const c=typeof fmt==="function"?fmt(current):current;
    const b=typeof fmt==="function"?fmt(best):best;
    const p=pct(current,best);
    const isNew=current>0&&current>=best&&best>0;
    return(
      <div style={{padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <span style={{fontSize:12,color:V.text3}}>{label}</span>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:800,color:isNew?V.accent:V.text,fontFamily:V.mono}}>{c}{unit}</span>
            <span style={{fontSize:11,color:V.text3,fontFamily:V.mono}}>PB: {b}{unit}</span>
            {isNew&&<span style={{fontSize:9,color:V.accent,fontWeight:700,background:`${V.accent}15`,padding:"1px 5px",borderRadius:4}}>NEW PB</span>}
          </div>
        </div>
        <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.05)"}}>
          <div style={{height:"100%",borderRadius:2,background:isNew?V.accent:p>=80?V.accent:p>=50?V.warn:V.danger,
            width:`${p}%`,transition:"width .4s"}}/>
        </div>
        <div style={{fontSize:9,color:V.text3,marginTop:3,textAlign:"right"}}>{p}% of PB</div>
      </div>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>You vs Your Best</div>

      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>CONSISTENCY</div>
        <Row label="This Week" current={weekW} best={bestWeek} unit=" workouts"/>
        <Row label="Streak" current={streak} best={bestStreak} unit=" days"/>
        <Row label="This Month" current={thisMonthW} best={bestMonth} unit=" workouts"/>
      </Card>

      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>VOLUME</div>
        <Row label="Weekly Volume" current={totalVol} best={bestWeekVol}
          fmt={v=>v>=1000?`${(v/1000).toFixed(1)}k`:v} unit=" lbs"/>
      </Card>

      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>BIG 3 — TOP WEIGHT</div>
        <Row label="Bench Press" current={bench} best={bestBench} unit={` ${wUnit(s.units)}`}/>
        <Row label="Squat" current={squat} best={bestSquat} unit={` ${wUnit(s.units)}`}/>
        <Row label="Deadlift" current={dead} best={bestDead} unit={` ${wUnit(s.units)}`}/>
      </Card>

      <Card style={{padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:V.text3,marginBottom:10}}>ESTIMATED 1RM</div>
        {[{l:"Bench",v:benchE1},{l:"Squat",v:squatE1},{l:"Deadlift",v:deadE1}].map(r=>(
          <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",
            borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
            <span style={{fontSize:12,color:V.text3}}>{r.l}</span>
            <span style={{fontSize:14,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{r.v>0?`${r.v} ${wUnit(s.units)}`:"—"}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Social Sub-Page: Leaderboard ───
export function SocialLeaderboard({s,d}){
  const email=s.profile?.email;
  const [mode,setMode]=useState("group"); // group | friends
  const [metric,setMetric]=useState("streak"); // streak | volume | workouts | big3 | duels
  const [groups,setGroups]=useState(null);
  const [members,setMembers]=useState(null);
  const [selGroup,setSelGroup]=useState(null);
  const [friends,setFriends]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{if(email)SocialAPI.getGroups(email).then(setGroups);},[email]);
  useEffect(()=>{if(email&&mode==="friends")SocialAPI.getFriends(email).then(r=>{if(r)setFriends(r);});},[email,mode]);

  const loadMembers=(code)=>{
    setSelGroup(code);setLoading(true);
    SocialAPI.getMembers(email,code).then(m=>{setMembers(m);setLoading(false);});
  };

  const streak=useStreak(s.workouts);
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const wt=parseFloat(st.weight)||0;if(wt>b)b=wt;});}));return b;};
  const myBig3=getBest("bench")+getBest("squat")+getBest("deadlift");
  const myWeekVol=Math.round(s.workouts.filter(w=>w.date>=ago(7)).reduce((a,w)=>a+w.exercises.reduce((b2,e)=>b2+e.sets.reduce((c,st)=>c+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0),0),0));
  const myWeekWorkouts=s.workouts.filter(w=>w.date>=ago(7)).length;
  const myDuelRecord=LS.get("ft-duel-record")||{wins:0,losses:0,ties:0};
  const myDuelWins=myDuelRecord.wins||0;

  const myRow={email,name:s.profile?.firstName?`${s.profile.firstName} ${s.profile.lastName||""}`.trim():"You",
    isMe:true,streak,big3:myBig3,weekVol:myWeekVol,weekWorkouts:myWeekWorkouts,duelWins:myDuelWins};

  const METRICS=[
    {id:"streak",label:"🔥 Streak",unit:"days",key:"streak"},
    {id:"workouts",label:"💪 Workouts",unit:"this week",key:"weekWorkouts"},
    {id:"volume",label:"⚡ Volume",unit:"lbs/week",key:"weekVol"},
    {id:"big3",label:"🏋️ Big 3",unit:"lbs",key:"big3"},
    {id:"duels",label:"⚔️ Duels",unit:"wins",key:"duelWins"},
  ];
  const curMetric=METRICS.find(m=>m.id===metric)||METRICS[0];

  const getMemberVal=(m)=>{
    if(metric==="streak")return parseInt(m.challenges?.find(c=>c.challenge_id==="streak")?.value)||0;
    if(metric==="big3")return parseInt(m.challenges?.find(c=>c.challenge_id==="big3")?.value)||0;
    if(metric==="volume")return parseInt(m.challenges?.find(c=>c.challenge_id==="ironscore")?.value)||0;
    if(metric==="workouts")return parseInt(m.challenges?.find(c=>c.challenge_id==="streak")?.value)||0;
    if(metric==="duels")return parseInt(m.challenges?.find(c=>c.challenge_id==="duel_wins")?.value)||0;
    return 0;
  };

  const rankColor=(i)=>i===0?"#fbbf24":i===1?"#94a3b8":i===2?"#cd7f32":"rgba(255,255,255,0.12)";
  const rankLabel=(i)=>i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;

  const friendRows=useMemo(()=>{
    const rows=[myRow];
    (friends?.friends||[]).forEach(f=>{
      const fStreak=parseInt(f.challenges?.find?.(c=>c.challenge_id==="streak")?.value)||0;
      const fBig3=parseInt(f.challenges?.find?.(c=>c.challenge_id==="big3")?.value)||0;
      const fXP=parseInt(f.challenges?.find?.(c=>c.challenge_id==="ironscore")?.value)||0;
      const fDuelWins=parseInt(f.challenges?.find?.(c=>c.challenge_id==="duel_wins")?.value)||0;
      rows.push({...f,name:friendDisplayName(f),isMe:false,
        streak:fStreak,big3:fBig3,weekVol:fXP,weekWorkouts:fStreak,duelWins:fDuelWins});
    });
    return rows.sort((a,b)=>{
      if(metric==="streak")return b.streak-a.streak;
      if(metric==="big3")return b.big3-a.big3;
      if(metric==="volume")return b.weekVol-a.weekVol;
      if(metric==="workouts")return b.weekWorkouts-a.weekWorkouts;
      if(metric==="duels")return b.duelWins-a.duelWins;
      return 0;
    });
  },[friends,metric,myRow.streak,myRow.big3,myRow.weekVol,myRow.weekWorkouts,myRow.duelWins]);

  const groupRows=useMemo(()=>{
    const rows=(members?.members||[]).map(m=>({...m,_val:getMemberVal(m)}));
    rows.sort((a,b)=>b._val-a._val);
    return rows;
  },[members,metric]);

  const maxVal=(rows,getVal)=>Math.max(...rows.map(getVal),1);

  const getMyMetricVal=()=>{
    if(metric==="streak")return myRow.streak;
    if(metric==="big3")return myRow.big3;
    if(metric==="volume")return myRow.weekVol;
    if(metric==="workouts")return myRow.weekWorkouts;
    if(metric==="duels")return myRow.duelWins;
    return 0;
  };

  const fmtVal=(val)=>{
    if(metric==="volume"&&val>=1000)return`${(val/1000).toFixed(1)}k`;
    return val;
  };

  const renderRow=(r,i,rows,getVal)=>{
    const val=getVal(r);
    const mv=maxVal(rows,getVal);
    const isMe=r.isMe||r.email===email;
    return(
      <Card key={i} style={{padding:10,
        border:isMe?`1.5px solid ${V.accent}40`:undefined,
        background:isMe?`${V.accent}06`:undefined}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:26,height:26,borderRadius:8,background:rankColor(i),
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:i<3?14:11,fontWeight:800,color:i<3?"#000":V.text3,flexShrink:0}}>
            {rankLabel(i)}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <span style={{fontSize:12,fontWeight:isMe?700:500,color:isMe?V.accent:V.text,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>
                {r.name||friendDisplayName(r)}{isMe?" (You)":""}
              </span>
              <span style={{fontSize:13,fontWeight:800,color:isMe?V.accent:V.text,fontFamily:V.mono}}>
                {fmtVal(val)} <span style={{fontSize:9,color:V.text3,fontWeight:400}}>{curMetric.unit}</span>
              </span>
            </div>
            <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.05)"}}>
              <div style={{height:"100%",borderRadius:2,
                background:isMe?V.accent:i===0?"#fbbf24":V.purple,
                width:`${Math.round(val/mv*100)}%`,transition:"width .4s"}}/>
            </div>
          </div>
          {metric==="duels"&&i===0&&val>0&&(
            <span style={{fontSize:14,marginLeft:2}}>👑</span>
          )}
        </div>
      </Card>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Leaderboard</div>
        {metric==="duels"&&(
          <div style={{fontSize:9,padding:"3px 8px",borderRadius:6,
            background:`${V.accent}12`,border:`1px solid ${V.accent}25`,
            color:V.accent,fontWeight:700}}>⚔️ DUEL KINGS</div>
        )}
      </div>

      {/* Mode toggle */}
      <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:`1px solid ${V.cardBorder}`}}>
        {[{id:"group",label:"My Group"},{id:"friends",label:"Friends"}].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:"9px 0",
            background:mode===m.id?V.accent:"transparent",border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700,color:mode===m.id?V.bg:V.text3,fontFamily:V.font,transition:"all .2s"}}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Metric picker */}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {METRICS.map(m=>(
          <Chip key={m.id} label={m.label} active={metric===m.id} onClick={()=>setMetric(m.id)}/>
        ))}
      </div>

      {/* Duel wins context card */}
      {metric==="duels"&&(
        <Card style={{padding:12,background:`linear-gradient(135deg,rgba(0,245,160,0.06),rgba(139,92,246,0.06))`,
          border:`1px solid ${V.accent}20`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:V.text3,marginBottom:2}}>YOUR DUEL RECORD</div>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:V.accent,fontFamily:V.mono}}>{myDuelRecord.wins||0}</div>
                  <div style={{fontSize:8,color:V.text3}}>W</div>
                </div>
                <div style={{fontSize:12,color:V.text3}}>—</div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:V.danger,fontFamily:V.mono}}>{myDuelRecord.losses||0}</div>
                  <div style={{fontSize:8,color:V.text3}}>L</div>
                </div>
                {(myDuelRecord.ties||0)>0&&(
                  <>
                    <div style={{fontSize:12,color:V.text3}}>—</div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:900,color:V.warn,fontFamily:V.mono}}>{myDuelRecord.ties}</div>
                      <div style={{fontSize:8,color:V.text3}}>T</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              {(myDuelRecord.wins+myDuelRecord.losses)>0&&(
                <div>
                  <div style={{fontSize:18,fontWeight:900,color:V.text,fontFamily:V.mono}}>
                    {Math.round((myDuelRecord.wins/(myDuelRecord.wins+myDuelRecord.losses))*100)}%
                  </div>
                  <div style={{fontSize:9,color:V.text3}}>win rate</div>
                </div>
              )}
              <button onClick={()=>d({type:"TAB",tab:"social_duels"})}
                style={{marginTop:6,padding:"4px 10px",borderRadius:7,background:V.accent,border:"none",
                  cursor:"pointer",fontSize:10,fontWeight:800,color:V.bg,fontFamily:V.font}}>
                Duel Now →
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* GROUP MODE */}
      {mode==="group"&&(
        groups?.groups?.length>0?(
          <div>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
              {groups.groups.map(g=>(
                <button key={g.code} onClick={()=>loadMembers(g.code)} style={{padding:"6px 14px",borderRadius:8,
                  border:`1.5px solid ${selGroup===g.code?V.accent:V.cardBorder}`,
                  background:selGroup===g.code?`${V.accent}10`:"transparent",
                  cursor:"pointer",fontSize:11,fontWeight:700,
                  color:selGroup===g.code?V.accent:V.text3,fontFamily:V.font}}>
                  {g.name}
                </button>
              ))}
            </div>

            {!selGroup&&<Card style={{padding:20,textAlign:"center"}}>
              <div style={{fontSize:13,color:V.text3}}>Select a group to view leaderboard</div>
            </Card>}

            {loading&&selGroup&&<SkeletonCard lines={3}/>}

            {!loading&&groupRows.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {groupRows.length>=2&&(
                  <Card style={{padding:14,marginBottom:4}}>
                    <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:8,height:90}}>
                      {[1,0,2].filter(i=>i<groupRows.length).map(i=>{
                        const m=groupRows[i];
                        const val=m._val;
                        const h=i===0?70:i===1?55:45;
                        return(
                          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                            <span style={{fontSize:i===0?22:16}}>{rankLabel(i)}</span>
                            <div style={{fontSize:10,fontWeight:700,color:V.text,maxWidth:70,textAlign:"center",
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{friendDisplayName(m)}</div>
                            <div style={{width:60,height:h,borderRadius:"6px 6px 0 0",
                              background:rankColor(i),display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:4}}>
                              <span style={{fontSize:10,fontWeight:800,color:i<3?"#000":"#fff",fontFamily:V.mono}}>{fmtVal(val)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
                {groupRows.map((m,i)=>renderRow(m,i,groupRows,r=>r._val))}
              </div>
            )}
          </div>
        ):(
          <Card style={{padding:30,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🏆</div>
            <div style={{fontSize:13,fontWeight:600,color:V.text,marginBottom:4}}>Join a group to compete</div>
            <div style={{fontSize:11,color:V.text3,marginBottom:14}}>Groups let you track rankings with your crew</div>
            <Btn full onClick={()=>d({type:"TAB",tab:"social_groups"})}>Find or Create Group</Btn>
          </Card>
        )
      )}

      {/* FRIENDS MODE */}
      {mode==="friends"&&(
        friendRows.length>1?(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <Card style={{padding:12,background:`linear-gradient(135deg,${V.accent}08,${V.purple}08)`}}>
              <div style={{fontSize:10,fontWeight:700,color:V.text3,marginBottom:6}}>YOUR RANKING</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:24,fontWeight:900,color:V.accent,fontFamily:V.mono}}>
                    #{friendRows.findIndex(r=>r.isMe)+1}
                    <span style={{fontSize:12,color:V.text3,fontWeight:400}}> of {friendRows.length}</span>
                  </div>
                  <div style={{fontSize:10,color:V.text3}}>{curMetric.label}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:18,fontWeight:800,color:V.text,fontFamily:V.mono}}>{fmtVal(getMyMetricVal())}</div>
                  <div style={{fontSize:9,color:V.text3}}>{curMetric.unit}</div>
                </div>
              </div>
            </Card>
            {friendRows.map((r,i)=>renderRow(r,i,friendRows,row=>{
              if(metric==="streak")return row.streak;
              if(metric==="big3")return row.big3;
              if(metric==="volume")return row.weekVol;
              if(metric==="workouts")return row.weekWorkouts;
              if(metric==="duels")return row.duelWins;
              return 0;
            }))}
          </div>
        ):(
          <Card style={{padding:30,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>👥</div>
            <div style={{fontSize:13,fontWeight:600,color:V.text,marginBottom:4}}>Add friends to compete</div>
            <div style={{fontSize:11,color:V.text3,marginBottom:14}}>Your friends' stats will appear here once added</div>
            <Btn full onClick={()=>d({type:"TAB",tab:"social_friends"})}>Add Friends</Btn>
          </Card>
        )
      )}
    </div>
  );
}

// ─── Social Sub-Page: Challenges (kept from SocialHub) ───
export function SocialChallenges({s,d}){
  const streak=useStreak(s.workouts);
  const getBest=(id)=>{let b=0;s.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{if(st.weight>b)b=st.weight;});}));return b;};
  const big3=getBest("bench")+getBest("squat")+getBest("deadlift");
  const protDays=s.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(s.goals?.protein||180)).length;
  const tierOf=(val,tiers)=>{for(let i=tiers.length-1;i>=0;i--)if(val>=tiers[i].v)return tiers[i];return{name:"",icon:"",v:0};};
  const streakTiers=[{v:7,name:"Bronze",icon:"🥉"},{v:14,name:"Silver",icon:"🥈"},{v:21,name:"Gold",icon:"🥇"},{v:30,name:"Diamond",icon:"💎"}];
  const liftTiers=[{v:600,name:"Bronze",icon:"🥉"},{v:800,name:"Silver",icon:"🥈"},{v:1000,name:"Gold",icon:"🥇"},{v:1200,name:"Diamond",icon:"💎"}];
  const macroTiers=[{v:3,name:"Bronze",icon:"🥉"},{v:5,name:"Silver",icon:"🥈"},{v:7,name:"Gold",icon:"🥇"}];
  const weekNum=Math.floor((Date.now()-new Date("2026-01-01").getTime())/(7*86400000));
  const weeklyChallenges=[
    {name:"3 in 5",desc:"3 workouts in 5 days",check:()=>s.workouts.filter(w=>w.date>=ago(5)).length,total:3},
    {name:"Protein Week",desc:"Hit protein target 4 days",check:()=>protDays,total:4},
    {name:"Volume King",desc:"5,000 lbs total squat volume this week",check:()=>{let v=0;s.workouts.filter(w=>w.date>=ago(7)).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId==="squat")e.sets.forEach(st=>{v+=(parseFloat(st.weight)||0)*(parseInt(st.reps)||0);});}));return Math.round(v);},total:5000},
    {name:"Full Logger",desc:"Log workout + meal + check-in today",check:()=>(s.workouts.some(w=>w.date===today())?1:0)+(s.nutrition.some(n=>n.date===today())?1:0)+((s.checkins||[]).some(c=>c.date===today())?1:0),total:3},
  ];
  const weeklyChallenge=weeklyChallenges[weekNum%weeklyChallenges.length];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16,fontWeight:800,color:V.text}}>Challenges</span><HelpBtn topic="challenges" color="#a78bfa"/></div>
      {[
        {name:"Workout Streak",desc:"Consecutive days with a logged workout",emoji:"🔥",val:streak,tiers:streakTiers,nextTier:streakTiers.find(t=>t.v>streak),unit:" days"},
        {name:"Big 3 Total",desc:"Best Bench + Squat + Deadlift",emoji:"🏋️",val:big3,tiers:liftTiers,nextTier:liftTiers.find(t=>t.v>big3),unit:` ${wUnit(s.units)}`},
        {name:"Macro Master",desc:"Days hitting protein in last 7",emoji:"🥗",val:protDays,tiers:macroTiers,nextTier:macroTiers.find(t=>t.v>protDays),unit:"/7 days"},
      ].map((ch,i)=>{
        const tier=tierOf(ch.val,ch.tiers);
        return(
          <Card key={i} style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div><div style={{fontSize:14,fontWeight:700,color:V.text}}>{ch.emoji} {ch.name}</div>
                <div style={{fontSize:10,color:V.text3}}>{ch.desc}</div></div>
              {tier.name&&<div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{padding:"3px 8px",borderRadius:6,fontSize:9,fontWeight:700,background:`${V.accent}10`,color:V.accent}}>{tier.icon} {tier.name}</span>
              </div>}
            </div>
            <div style={{fontSize:20,fontWeight:800,color:V.text,fontFamily:V.mono,margin:"6px 0"}}>{ch.val}{ch.unit}</div>
            {ch.nextTier&&(<div>
              <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",marginBottom:4}}>
                <div style={{height:"100%",borderRadius:2,background:V.accent,width:`${Math.min(100,(ch.val/ch.nextTier.v)*100)}%`,transition:"width .3s"}}/>
              </div>
              <div style={{fontSize:9,color:V.text3}}>{ch.nextTier.v-ch.val}{ch.unit} to {ch.nextTier.icon} {ch.nextTier.name}</div>
            </div>)}
            {!ch.nextTier&&tier.name&&<span style={{fontSize:10,color:V.accent,fontWeight:600}}>Max tier reached! 🎉</span>}
          </Card>
        );
      })}
      <Card style={{padding:14,border:`1px solid rgba(236,72,153,0.2)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:13,fontWeight:700,color:"#ec4899"}}>🔄 Weekly Challenge</span>
          <span style={{fontSize:9,color:V.text3}}>Resets Monday</span>
        </div>
        <div style={{fontSize:14,fontWeight:700,color:V.text}}>{weeklyChallenge.name}</div>
        <div style={{fontSize:10,color:V.text3,marginBottom:6}}>{weeklyChallenge.desc}</div>
        <div style={{fontSize:18,fontWeight:800,color:weeklyChallenge.check()>=weeklyChallenge.total?"#ec4899":V.text,fontFamily:V.mono}}>
          {weeklyChallenge.check()} / {weeklyChallenge.total} {weeklyChallenge.check()>=weeklyChallenge.total?"✅":""}
        </div>
        <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",marginTop:4}}>
          <div style={{height:"100%",borderRadius:2,background:"#ec4899",width:`${Math.min(100,weeklyChallenge.check()/weeklyChallenge.total*100)}%`}}/>
        </div>
      </Card>
    </div>
  );
}



// ═══════════════════════════════════════════════════════
// IRONSCORE — XP + Level system (runs fully client-side)
// ═══════════════════════════════════════════════════════
// IRON_RANKS imported from ../data/ranks

// ── XP Bonus Pool (missions, multipliers, one-time events) ──
// Stored in LS as {total, log:[{date,amount,reason}]}
export function getXPBonus(){return LS.get("ft-xp-bonus")||{total:0,log:[]};}
export function addXPBonus(amount,reason){
  const b=getXPBonus();
  const entry={date:today(),amount,reason};
  const updated={total:(b.total||0)+amount,log:[entry,...(b.log||[])].slice(0,100)};
  LS.set("ft-xp-bonus",updated);
  return updated.total;
}

// ── Streak Shields ──
export function getShields(){return Math.min(3,LS.get("ft-streak-shields")||0);}
export function addShield(){
  const n=Math.min(3,getShields()+1);
  LS.set("ft-streak-shields",n);
  return n;
}
export function consumeShield(){
  const n=Math.max(0,getShields()-1);
  LS.set("ft-streak-shields",n);
  LS.set("ft-shield-used-date",today());
  return n;
}
// Check + award shield when 7-day milestone hit today
export function checkStreakShieldAward(streak){
  if(streak>0&&streak%7===0){
    const lastAward=LS.get("ft-shield-awarded-streak");
    if(lastAward!==streak){
      LS.set("ft-shield-awarded-streak",streak);
      const n=addShield();
      SuccessToastCtrl.show(`🛡️ Streak Shield earned! You have ${n} shield${n!==1?"s":""}`);
      return true;
    }
  }
  return false;
}
// On app load / tab change: check if streak should break but shield covers it
export function checkStreakShieldActivation(s){
  const shields=getShields();
  if(shields<=0)return false;
  const lastWorkout=s.workouts?.[0]?.date;
  if(!lastWorkout)return false;
  const gapDays=Math.floor((new Date()-new Date(lastWorkout+"T12:00:00"))/86400000);
  const shieldUsed=LS.get("ft-shield-used-date");
  // Gap of exactly 1 day — activate shield once per gap day
  if(gapDays===1&&shieldUsed!==today()){
    // Compute actual streak as of yesterday (the days before the gap)
    const preGapStreak=(()=>{let c=0,i=1;while((s.workouts||[]).some(w=>w.date===ago(i))){c++;i++;}return c;})();
    consumeShield();
    MsgBannerCtrl.push({name:"🛡️ Shield Activated",
      text:`Your ${preGapStreak}-day streak is protected! Train today to keep it.`,type:"system"});
    return true;
  }
  return false;
}

// ── XP Multipliers ──
export function getActiveMultiplier(s){
  const dow=new Date().getDay(); // 0=Sun,2=Tue,4=Thu
  const lastW=s.workouts?.[0]?.date;
  const daysSinceWorkout=lastW?Math.floor((new Date()-new Date(lastW+"T12:00:00"))/86400000):99;
  // Comeback bonus (5+ days off)
  if(daysSinceWorkout>=5){
    const usedDate=LS.get("ft-comeback-used");
    if(usedDate!==today())return{mult:3,label:"3× Comeback Bonus",color:"#22c55e",icon:"💥"};
  }
  // Double XP Tuesday & Thursday
  if(dow===2||dow===4){
    return{mult:2,label:"2× Double XP Day",color:"#f59e0b",icon:"⚡"};
  }
  // 3-day combo (3 workouts in last 3 calendar days) — only if no gap >= 2 days
  const last3=[today(),ago(1),ago(2)];
  const comboHit=last3.every(d=>(s.workouts||[]).some(w=>w.date===d));
  if(comboHit&&daysSinceWorkout<2)return{mult:1.5,label:"1.5× 3-Day Combo",color:"#a78bfa",icon:"🔥"};
  return{mult:1,label:null,color:null,icon:null};
}

// ── Core calcIronScore (base XP from history + bonus pool) ──
export function calcIronScore(s){
  let baseXP=0;
  // B19 fix: mirror useStreak logic — if no workout today, start counting from yesterday
  const streak=(()=>{let c=0;const d=new Date();if(!(s.workouts||[]).some(w=>w.date===today()))d.setDate(d.getDate()-1);for(let i=0;i<365;i++){const ds=new Date(d);ds.setDate(d.getDate()-i);const dstr=ds.toISOString().split("T")[0];if((s.workouts||[]).some(w=>w.date===dstr))c++;else break;}return c;})();
  baseXP += (s.workouts||[]).length * 30;
  baseXP += streak * 8;
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const w2=parseFloat(st.weight)||0;if(w2>b)b=w2;});}));return b;};
  const big3=getBest("bench")+getBest("squat")+getBest("deadlift");
  baseXP += Math.floor(big3/8);
  baseXP += (s.nutrition||[]).length*8;
  baseXP += (s.photos||[]).length*15;
  baseXP += (s.checkins||[]).length*5;
  const {checks}=calcEarnedBadges(s);
  baseXP += Object.values(checks).filter(Boolean).length*75;
  // Streak milestones
  if(streak>=7)baseXP+=150;if(streak>=14)baseXP+=300;if(streak>=30)baseXP+=750;if(streak>=60)baseXP+=1500;if(streak>=100)baseXP+=3000;
  const nutStreak2=(()=>{let c=0;const b2=(s.nutrition||[]).some(n=>n.date===today())?0:1;for(let i=b2;i<365;i++){if((s.nutrition||[]).some(n=>n.date===ago(i)))c++;else break;}return c;})();
  if(nutStreak2>=7)baseXP+=100;if(nutStreak2>=14)baseXP+=200;if(nutStreak2>=30)baseXP+=500;
  // Strength milestones
  if(big3>=500)baseXP+=200;if(big3>=800)baseXP+=400;if(big3>=1000)baseXP+=600;if(big3>=1200)baseXP+=1000;if(big3>=1500)baseXP+=2000;
  // Consistency bonuses
  const monthWorkouts=s.workouts.filter(w=>w.date>=ago(30)).length;
  if(monthWorkouts>=16)baseXP+=500;if(monthWorkouts>=20)baseXP+=1000;
  // Add bonus pool (missions, multipliers, events)
  const bonusXP=getXPBonus().total||0;
  const xp=baseXP+bonusXP;
  // Save for snapshot
  LS.set("ft-ironscore",xp);
  const rankData=[...IRON_RANKS].reverse().find(r=>xp>=r.xpNeeded)||IRON_RANKS[0];
  const nextRank=IRON_RANKS.find(r=>r.level===rankData.level+1);
  const xpIntoRank=xp-rankData.xpNeeded;
  const xpForNext=nextRank?(nextRank.xpNeeded-rankData.xpNeeded):null;
  const pct=xpForNext?Math.min(100,Math.round(xpIntoRank/xpForNext*100)):100;
  return{xp,baseXP,bonusXP,rank:rankData,nextRank,xpIntoRank,xpForNext,pct,streak,big3};
}

// ── Level-Up Detection ──

export function useLevelUp(s){
  const {rank}=useMemo(()=>calcIronScore(s),[s.workouts,s.nutrition,s.photos,s.checkins,s.body]);
  const [celebrating,setCelebrating]=useState(false);
  const [celebRank,setCelebRank]=useState(null);
  useEffect(()=>{
    const savedLevel=LS.get("ft-last-known-level")||1;
    if(rank.level>savedLevel){
      LS.set("ft-last-known-level",rank.level);
      setCelebRank(rank);
      setTimeout(()=>setCelebrating(true),400);
    } else {
      // Ensure level is always persisted on first render
      if(!LS.get("ft-last-known-level")) LS.set("ft-last-known-level",rank.level);
    }
  },[rank.level]);
  return{celebrating,celebRank,dismiss:()=>setCelebrating(false)};
}

// ── Level-Up Celebration Overlay ──
export function LevelUpCelebration({rank,onDismiss,s}){
  const [show,setShow]=useState(false);
  const [phase,setPhase]=useState(0); // 0=burst 1=card
  useEffect(()=>{setTimeout(()=>{setShow(true);setTimeout(()=>setPhase(1),600)},50);},[]);
  const dismiss=()=>{setShow(false);setTimeout(onDismiss,300);};
  const {xp,rank:newRank,streak}=calcIronScore(s);
  const prevRank=IRON_RANKS.find(r=>r.level===rank.level-1);
  // Stats to show in celebration
  const totalW=(s.workouts||[]).length;
  const shields=getShields();
  // Share card via canvas
  const shareRankCard=async()=>{
    try{
      const stats=[
        {value:rank.icon+" "+rank.name,label:"NEW RANK",color:rank.color},
        {value:xp.toLocaleString(),label:"IRON XP",color:"#e8e8ec"},
        {value:"Lv "+rank.level+"/30",label:"LEVEL",color:rank.tierColor},
        {value:totalW+" workouts",label:"ALL TIME",color:"#94a3b8"},
      ];
      const c2=await ShareCard.generate(rank.icon+" RANK UP!",stats,`${rank.name} · Level ${rank.level} · ${xp.toLocaleString()} XP`);
      ShareCard.share(c2,`ironlog-rankup-${today()}.png`);
    }catch(e){
      if(navigator.share)navigator.share({title:"IRONLOG Rank Up!",text:`Just hit ${rank.name} on IRONLOG 💪 ${xp.toLocaleString()} XP`}).catch(()=>{});
    }
  };
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",overflowY:"auto",
      background:`radial-gradient(ellipse at 50% 40%,${rank.color}22 0%,rgba(0,0,0,0.94) 65%)`,
      opacity:show?1:0,transition:"opacity .3s"}}>
      {/* ── T4 #7: Enhanced burst particles (40 vs 20) ── */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {Array.from({length:40}).map((_,i)=>{
          const x=5+Math.random()*90;
          const sz=4+Math.random()*8;
          const delay=Math.random()*2;
          const dur=1.2+Math.random()*1.5;
          const colors=[rank.color,rank.tierColor,"#fff","#fbbf24","#f43f5e",V.accent];
          return <div key={i} style={{position:"absolute",
            left:`${x}%`,top:"-12px",
            width:sz,height:sz,borderRadius:i%4===0?"2px":"50%",
            background:colors[i%colors.length],
            animation:`fall ${dur}s ${delay}s ease-in forwards`,
            opacity:0.9}}/>;
        })}
      </div>
      <style>{`
        @keyframes fall{0%{transform:translateY(0) rotate(0deg) scale(1);opacity:1}100%{transform:translateY(110vh) rotate(${720+Math.round(Math.random()*360)}deg) scale(0.3);opacity:0}}
        @keyframes rankPop{0%{transform:scale(0.5) rotate(-8deg);opacity:0}60%{transform:scale(1.08) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes rankShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes rankGlow{0%,100%{box-shadow:0 0 20px ${rank.color}40}50%{box-shadow:0 0 50px ${rank.color}80,0 0 80px ${rank.color}30}}
      `}</style>

      {/* ── Rank-up main card ── */}
      <div style={{position:"relative",zIndex:1,width:"min(340px,92vw)",margin:"auto",
        padding:"28px 24px 24px",textAlign:"center",
        background:`linear-gradient(160deg,${rank.color}20,rgba(10,10,15,0.95) 60%)`,
        border:`2px solid ${rank.color}70`,borderRadius:28,
        animation:phase>=1?"rankPop .5s cubic-bezier(.17,.67,.35,1.3) forwards":"none",
        opacity:phase>=1?undefined:0}}>

        {/* Tier badge */}
        <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",
          borderRadius:20,background:`${rank.tierColor}18`,border:`1px solid ${rank.tierColor}35`,
          marginBottom:14}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:2,color:rank.tierColor,textTransform:"uppercase"}}>
            {rank.tier} TIER
          </span>
        </div>

        {/* Big icon with glow ring */}
        <div style={{position:"relative",display:"inline-block",marginBottom:12}}>
          <div style={{width:110,height:110,borderRadius:"50%",margin:"0 auto",
            background:`radial-gradient(circle,${rank.color}25,${rank.color}08)`,
            border:`3px solid ${rank.color}60`,
            display:"flex",alignItems:"center",justifyContent:"center",
            animation:"rankGlow 2s ease-in-out infinite",
            fontSize:58,lineHeight:1}}>{rank.icon}</div>
          {prevRank&&(
            <div style={{position:"absolute",bottom:-6,right:-6,
              width:28,height:28,borderRadius:"50%",
              background:V.bg,border:`2px solid ${rank.color}50`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14}}>{prevRank.icon}</div>
          )}
        </div>

        <div style={{fontSize:9,fontWeight:700,letterSpacing:3,color:rank.color,
          textTransform:"uppercase",opacity:0.8,marginBottom:6}}>RANK UP!</div>
        <div style={{fontSize:30,fontWeight:900,color:rank.color,lineHeight:1.05,marginBottom:4}}>
          {rank.name}
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:16,fontFamily:"monospace"}}>
          Level {rank.level} of 30 · {xp.toLocaleString()} XP
        </div>

        {/* Shimmer bar */}
        <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.07)",marginBottom:16,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:3,
            background:`linear-gradient(90deg,${rank.color}00,${rank.color},${rank.tierColor},${rank.color}00)`,
            backgroundSize:"200% 100%",animation:"rankShimmer 1.8s ease-in-out infinite"}}/>
        </div>

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
          {[
            {icon:"💪",val:totalW,label:"workouts"},
            {icon:"🔥",val:streak+"d",label:"streak"},
            {icon:"🛡️",val:shields,label:"shields"},
          ].map(stat=>(
            <div key={stat.label} style={{padding:"8px 6px",borderRadius:10,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:9,marginBottom:2}}>{stat.icon}</div>
              <div style={{fontSize:15,fontWeight:800,color:V.text,fontFamily:V.mono,lineHeight:1}}>{stat.val}</div>
              <div style={{fontSize:8,color:V.text3,marginTop:2}}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={shareRankCard}
            style={{flex:1,padding:"11px",borderRadius:12,
              background:`${rank.color}15`,border:`1.5px solid ${rank.color}40`,
              cursor:"pointer",fontSize:11,fontWeight:700,color:rank.color,fontFamily:V.font,
              display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            📤 Share
          </button>
          <button onClick={dismiss}
            style={{flex:2,padding:"11px",borderRadius:12,
              background:`linear-gradient(135deg,${rank.color},${rank.tierColor})`,
              border:"none",cursor:"pointer",
              fontSize:13,fontWeight:900,color:V.bg,fontFamily:V.font,
              boxShadow:`0 4px 20px ${rank.color}50`}}>
            Let's Go! 💪
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// IRONLOG HELP SYSTEM
// HelpBtn — the ? button used throughout the app
// HelpModal — full-screen topic sheet
// HELP_TOPICS — all tutorial content in one place
// ═══════════════════════════════════════════════════════

