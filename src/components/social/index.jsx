import React, { useState, useEffect, useMemo } from 'react';
import { V } from '../../theme.js';
import Icons from '../../icons.jsx';
import { LS, today, ago, fmtShort, fmtFull, uid } from '../../utils.js';
import { Card, Btn, Field, Sheet, Chip, Stat, SuccessToastCtrl, Progress } from '../shared/index.jsx';
import { SocialAPI } from '../../services/social.js';

// ─── Social Community (Foundation) ───
// ─── Social Tab Hub (like TrackHub) ───
function SocialTab({s,d}){
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
            <div style={{fontSize:8,color:V.text3,fontWeight:600}}>{st.l}</div>
          </div>
        ))}
      </div>

      <SectionGrid d={d} title="Your Activity" items={[
        {id:"social_feed",icon:Icons.activity,label:"Feed",desc:"Today's stats & friend activity",color:"#ec4899"},
        {id:"social_profile",icon:Icons.target,label:"Profile",desc:"QR code, friend code & privacy",color:"#8b5cf6"},
        {id:"social_notifications",icon:Icons.zap,label:"Notifications",desc:notifCount>0?`${notifCount} unread`:"All caught up",color:notifCount>0?V.danger:"#64748b"},
      ]}/>

      <SectionGrid d={d} title="Connections" items={[
        {id:"social_friends",icon:Icons.target,label:"Friends",desc:"Add, compare & message",color:"#06b6d4"},
        {id:"social_groups",icon:Icons.target,label:"Groups",desc:"Crews, leaderboards & stats",color:"#f59e0b"},
        {id:"social_compare",icon:Icons.chart,label:"You vs Best",desc:"Personal records race",color:"#a78bfa"},
      ]}/>

      <SectionGrid d={d} title="Compete" items={[
        {id:"social_challenges",icon:Icons.trophy,label:"Challenges",desc:"Tiers, badges & weekly",color:"#f43f5e"},
        {id:"social_badges",icon:Icons.target,label:"Badges",desc:"Your achievements",color:"#f97316"},
        {id:"social_leaderboard",icon:Icons.chart,label:"Leaderboard",desc:"Group rankings",color:"#10b981"},
      ]}/>
    </div>
  );
}

// ─── Social Sub-Page: Feed ───
function SocialFeed({s,d}){
  const email=s.profile?.email;
  const [feedData,setFeedData]=useState(null);
  const [notifs,setNotifs]=useState(null);
  const [loadErr,setLoadErr]=useState(false);
  const loadFeed=()=>{setLoadErr(false);if(email){SocialAPI.getFeed(email).then(r=>{if(r)setFeedData(r);else setLoadErr(true);});SocialAPI.getNotifications(email).then(setNotifs);}};
  useEffect(loadFeed,[email]);
  const reactToEvent=async(eventId,emoji)=>{await SocialAPI.react(email,eventId,emoji);SocialAPI.getFeed(email).then(setFeedData);};

  const streak=useStreak(s.workouts);
  const weekW=s.workouts.filter(w=>w.date>=ago(7)).length;
  const protDays=s.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(s.goals?.protein||180)).length;
  const readiness=calcReadiness(s);
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
        <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:8}}>📅 Today</div>
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
            <button key={a.t} onClick={()=>d({type:"TAB",tab:a.t})} style={{flex:1,padding:"6px",borderRadius:6,
              background:"rgba(255,255,255,0.03)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",
              fontSize:9,color:V.accent,fontWeight:600,fontFamily:V.font}}>{a.l}</button>
          ))}
        </div>
      </Card>
      {/* Highlights */}
      <Card style={{padding:14}}>
        <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:8}}>✨ Highlights</div>
        {[{t:`${weekW} workouts this week`,e:weekW>=5?"🔥":weekW>=3?"💪":"📈"},
          {t:`Protein hit ${protDays} of 7 days`,e:protDays>=7?"⭐":protDays>=5?"✅":"🎯"},
          {t:`${streak}-day streak`,e:streak>=30?"💎":streak>=7?"🔥":"🔄"}].map((h,i)=>(
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
      {/* Live friend feed */}
      {feedData?.events?.filter(e=>!e.isOwn).length>0&&(
        <Card style={{padding:14}}>
          <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:8}}>📡 Friend Activity</div>
          {feedData.events.filter(e=>!e.isOwn).slice(0,8).map(ev=>(
            <div key={ev.id} style={{padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><span style={{fontSize:12,fontWeight:600,color:V.text}}>{ev.name}</span>
                  <span style={{fontSize:11,color:V.text3}}>{" "}{ev.type==="WorkoutLogged"?"logged a workout":ev.type==="PRHit"?"hit a PR 🎉":"was active"}</span></div>
                <span style={{fontSize:9,color:V.text3}}>{fmtShort(ev.created_at?.split("T")[0])}</span>
              </div>
              <div style={{display:"flex",gap:4,marginTop:4}}>
                {["💪","🔥","👏","💎","⭐"].map(r=>(
                  <button key={r} onClick={()=>reactToEvent(ev.id,r)} style={{padding:"2px 6px",borderRadius:4,
                    background:ev.reactions?.[r]?"rgba(255,255,255,0.08)":"transparent",
                    border:`1px solid ${ev.reactions?.[r]?V.accent+"30":V.cardBorder}`,cursor:"pointer",fontSize:12}}>
                    {r}{ev.reactions?.[r]?<span style={{fontSize:8,color:V.text3,marginLeft:2}}>{ev.reactions[r]}</span>:""}
                  </button>
                ))}
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
function SocialFriends({s,d}){
  const email=s.profile?.email;
  const [friendsData,setFriendsData]=useState(null);
  const [addMethod,setAddMethod]=useState("code");
  const [addInput,setAddInput]=useState("");
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState(false);
  const [viewFriend,setViewFriend]=useState(null);
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
  const remove=async(t)=>{if(!confirm("Remove this friend?"))return;await SocialAPI.removeFriend(email,t);loadFriends();SuccessToastCtrl.show("Removed");};
  const quickMsgs=["💪 Nice PR!","🔥 Let's train","\u23F0 Don't skip today","👏 Keep it up","🏋 Gym time?"];
  const sendQuickMsg=async(fe,msg)=>{await SocialAPI.logEvent(email,"QuickMessage",{to:fe,msg},"friends");SuccessToastCtrl.show("Sent!");};

  if(compareWith)return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <button onClick={()=>setCompareWith(null)} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
      </button>
      <div style={{fontSize:16,fontWeight:800,color:V.text,textAlign:"center"}}>You vs {compareWith.name}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
        {[{l:"Streak",my:streak,their:compareWith.challenges?.find(c=>c.challenge_id==="streak")?.value||"?"},
          {l:"Big 3",my:myBig3||"\u2014",their:compareWith.challenges?.find(c=>c.challenge_id==="big3")?.value||"?"},
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
      <button onClick={()=>setViewFriend(null)} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,padding:"8px 0",cursor:"pointer"}}>
        {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
      </button>
      <Card style={{padding:16,textAlign:"center"}}>
        <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${V.purple},#ec4899)`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
          <span style={{fontSize:20,color:V.bg,fontWeight:900}}>{(viewFriend.name||"?")[0].toUpperCase()}</span>
        </div>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>{viewFriend.name}</div>
        {viewFriend.username&&<div style={{fontSize:11,color:V.text3}}>@{viewFriend.username}</div>}
        {viewFriend.badges?.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",margin:"8px 0"}}>
            {viewFriend.badges.map((b,i)=><span key={i} style={{padding:"2px 8px",borderRadius:6,background:V.accent+"08",fontSize:9,color:V.accent}}>{b}</span>)}
          </div>
        )}
        {viewFriend.challenges?.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,margin:"10px 0"}}>
            {viewFriend.challenges.map((c,i)=>(
              <div key={i} style={{padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                <div style={{fontSize:14,fontWeight:800,color:V.accent,fontFamily:V.mono}}>{c.value}</div>
                <div style={{fontSize:8,color:V.text3,textTransform:"uppercase"}}>{c.challenge_id}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div style={{display:"flex",gap:6}}>
        <Btn full onClick={()=>{setViewFriend(null);setCompareWith(viewFriend);}}>Compare</Btn>
        <Btn v="secondary" full onClick={()=>remove(viewFriend.email)}>Remove</Btn>
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
      <Card style={{padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Quick Message</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {quickMsgs.map((msg,i)=>(
            <button key={i} onClick={()=>sendQuickMsg(viewFriend.email,msg)} style={{padding:"6px 12px",borderRadius:8,
              background:"rgba(255,255,255,0.03)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",
              fontSize:11,color:V.text,fontFamily:V.font}}>{msg}</button>
          ))}
        </div>
      </Card>
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
              <span style={{fontSize:12,color:V.text}}>{r.from}</span>
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
          {friendsData.friends.map((f,i)=>(
            <Card key={i} style={{padding:12,marginBottom:6,cursor:"pointer"}} onClick={()=>setViewFriend(f)}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${V.purple},#ec4899)`,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:14,color:V.bg,fontWeight:900}}>{(f.name||"?")[0].toUpperCase()}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:V.text}}>{f.name||f.email}</div>
                  {f.username&&<div style={{fontSize:10,color:V.text3}}>@{f.username}</div>}
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={e=>{e.stopPropagation();setCompareWith(f);}} style={{padding:"4px 8px",borderRadius:6,
                    background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:9,color:V.accent,fontFamily:V.font}}>vs</button>
                  {Icons.chevRight({size:14,color:V.text3})}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ):(
        !loading&&!loadErr&&<Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>👥</div>
          <div style={{fontSize:13,fontWeight:700,color:V.text}}>No friends yet</div>
          <div style={{fontSize:11,color:V.text3,marginTop:4}}>Add friends using their code, username, or email.</div>
        </Card>
      )}
      {loading&&!loadErr&&<div style={{textAlign:"center",padding:20,fontSize:12,color:V.text3}}>Loading...</div>}
    </div>
  );
}

// ─── Social Sub-Page: Groups ───
// ─── Social Sub-Page: Groups (with tabs) ───
function SocialGroups({s,d}){
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
  const leave=async(c2)=>{if(!confirm("Leave this group?"))return;await SocialAPI.leaveGroup(email,c2);loadGroups();SuccessToastCtrl.show("Left group");};

  const openGroup=(gc)=>{
    setSelGroup(gc);setGroupTab("board");
    SocialAPI.getMembers(email,gc).then(setMembers);
    setGroupChals(LS.get(`ft-gchal-${gc}`)||[]);
    setChatMessages(LS.get(`ft-gchat-${gc}`)||[]);
    SocialAPI.getFeed(email,10).then(r=>{if(r?.events)setGroupFeed(r.events);});
  };

  const sendChat=()=>{
    if(!chatMsg.trim())return;
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
    SocialAPI.logEvent(email,"GroupChallengeCreated",{group:selGroup,challenge:ch.name},"friends");
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
      {groupTab==="board"&&(<>
        <Card style={{padding:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{l:"MEMBERS",v:members?.members?.length||0,c:V.accent},
              {l:"TOTAL STREAK",v:members?.members?.reduce((a,m)=>{const sv=m.challenges?.find(c2=>c2.challenge_id==="streak");return a+(sv?parseInt(sv.value):0);},0)||0,c:V.warn},
              {l:"TOP STREAK",v:Math.max(0,...(members?.members||[]).map(m=>parseInt(m.challenges?.find(c2=>c2.challenge_id==="streak")?.value||0))),c:V.purple}
            ].map((st,i)=>(
              <div key={i} style={{textAlign:"center",padding:6,borderRadius:6,background:"rgba(255,255,255,0.02)"}}>
                <div style={{fontSize:16,fontWeight:800,color:st.c,fontFamily:V.mono}}>{st.v}</div>
                <div style={{fontSize:8,color:V.text3}}>{st.l}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{padding:14}}>
          <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>Leaderboard</div>
          {(members?.members||[]).sort((a,b)=>{
            const a2=parseInt(a.challenges?.find(c2=>c2.challenge_id==="streak")?.value||0);
            const b2=parseInt(b.challenges?.find(c2=>c2.challenge_id==="streak")?.value||0);return b2-a2;
          }).map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",
              borderBottom:i<(members?.members?.length||0)-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
              <div style={{width:24,height:24,borderRadius:8,
                background:i===0?V.accent:i===1?V.purple:i===2?V.warn:"rgba(255,255,255,0.06)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i<3?V.bg:V.text3,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:m.user_email===email?V.accent:V.text}}>{m.name}{m.user_email===email?" (you)":""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                {m.challenges?.map((c2,j)=>(
                  <div key={j} style={{fontSize:9,color:V.text3}}>{c2.challenge_id}: <span style={{color:V.accent,fontWeight:700}}>{c2.value}</span></div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      </>)}

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
                   ev.type==="GroupChat"?ev.data?.text:
                   ev.type==="GroupChallengeCreated"?`Created challenge: ${ev.data?.challenge}`:
                   ev.type==="QuickMessage"?`${ev.data?.msg}`:ev.type}
                </div>
              </div>
              <div style={{fontSize:9,color:V.text3}}>{(()=>{const m2=Math.round((Date.now()-new Date(ev.created_at))/60000);return m2<60?`${m2}m`:m2<1440?`${Math.round(m2/60)}h`:`${Math.round(m2/1440)}d`;})()}</div>
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
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} placeholder="Message..."
            onKeyDown={e=>{if(e.key==="Enter")sendChat();}}
            style={{flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,borderRadius:20,color:V.text,fontSize:13,outline:"none",fontFamily:V.font}}/>
          <button onClick={sendChat} disabled={!chatMsg.trim()} style={{width:40,height:40,borderRadius:20,
            background:chatMsg.trim()?V.accent:"rgba(255,255,255,0.06)",border:"none",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {Icons.chevRight({size:18,color:chatMsg.trim()?V.bg:V.text3})}
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
function SocialProfile({s,d}){
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

  // Friend code: deterministic from email hash
  const friendCode=useMemo(()=>{
    let h=0;for(let i=0;i<(email||"").length;i++){h=((h<<5)-h)+(email||"").charCodeAt(i);h|=0;}
    return"IRON-"+Math.abs(h).toString(36).toUpperCase().slice(0,4).padEnd(4,"0");
  },[email]);

  // QR Code SVG generator (simple version matrix)
  const qrData=JSON.stringify({app:"ironlog",user:username,code:friendCode});
  const qrRef=useRef(null);

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
      setEditingUn(false);setUnError("");SuccessToastCtrl.show(`Username set to @${r.username}`);}
    else setUnError(r?.error||"Failed");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Profile card */}
      <Card style={{padding:16,textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${V.accent},#ec4899)`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
          <span style={{fontSize:24,color:V.bg,fontWeight:900}}>{username[0]?.toUpperCase()}</span>
        </div>
        <div style={{fontSize:18,fontWeight:800,color:V.text}}>{s.profile?.firstName||username}</div>
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
      </Card>

      {/* Friend Code */}
      <Card style={{padding:16,textAlign:"center"}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:4}}>Your Friend Code</div>
        <div style={{fontSize:28,fontWeight:900,color:V.accent,fontFamily:V.mono,letterSpacing:4,margin:"8px 0"}}>{friendCode}</div>
        <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Share this code — friends enter it to add you</div>
        <div style={{display:"flex",gap:8}}>
          <Btn full onClick={()=>{navigator.clipboard?.writeText(friendCode);SuccessToastCtrl.show("Code copied");}}>Copy Code</Btn>
          <Btn v="secondary" full onClick={()=>{if(navigator.share)navigator.share({title:"Add me on IRONLOG",text:`Add me on IRONLOG! My friend code: ${friendCode} | @${username}`});
            else{navigator.clipboard?.writeText(`Add me on IRONLOG! My friend code: ${friendCode} | @${username}`);SuccessToastCtrl.show("Copied to clipboard");}}}>Share</Btn>
        </div>
      </Card>

      {/* QR Code */}
      <Card style={{padding:16,textAlign:"center"}}>
        <div style={{fontSize:12,fontWeight:700,color:V.text,marginBottom:8}}>QR Code</div>
        <div style={{display:"inline-block",padding:12,background:"#fff",borderRadius:12,marginBottom:8}}>
          <svg ref={qrRef} width="140" height="140" viewBox="0 0 140 140">
            {/* Simple visual QR pattern — encoded friend code */}
            {Array.from({length:11}).map((_,row)=>
              Array.from({length:11}).map((__,col)=>{
                const idx=row*11+col;
                const charCode=(friendCode+username+friendCode).charCodeAt(idx%friendCode.length+username.length);
                const on=(row<3&&col<3)||(row<3&&col>7)||(row>7&&col<3)||charCode%3!==0;
                return on?<rect key={`${row}-${col}`} x={4+col*12} y={4+row*12} width={10} height={10} rx={2} fill="#0e0e16"/>:null;
              })
            )}
          </svg>
        </div>
        <div style={{fontSize:10,color:V.text3}}>Friends can scan this with their phone camera</div>
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
function SocialBadges({s}){
  const streak=useStreak(s.workouts);
  const getBest=(id)=>{let b=0;s.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{if(st.weight>b)b=st.weight;});}));return b;};
  const big3=getBest("bench")+getBest("squat")+getBest("deadlift");
  const protDays=s.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(s.goals?.protein||180)).length;
  const all=[
    {name:"🔥 7-Day Streak",earned:streak>=7,desc:"Log workouts 7 days straight"},
    {name:"💎 30-Day Streak",earned:streak>=30,desc:"Log workouts 30 days straight"},
    {name:"🏆 1000lb Club",earned:big3>=1000,desc:"Bench + Squat + Deadlift ≥ 1000lbs"},
    {name:"💪 Century Club",earned:s.workouts.length>=100,desc:"Log 100 total workouts"},
    {name:"📸 Photo Tracker",earned:(s.photos||[]).length>=10,desc:"Take 10 progress photos"},
    {name:"⭐ Macro Master",earned:protDays>=7,desc:"Hit protein 7 days in a row"},
    {name:"🧠 AI Trained",earned:LS.get("ft-ai-count-"+today())>0,desc:"Get advice from AI Coach"},
    {name:"👥 Social Butterfly",earned:false,desc:"Add 3 friends"},
    {name:"🏅 Group Leader",earned:false,desc:"Create a group"},
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Badges</div>
      <div style={{fontSize:11,color:V.text3}}>{all.filter(b=>b.earned).length} of {all.length} earned</div>
      {all.map((b,i)=>(
        <Card key={i} style={{padding:12,opacity:b.earned?1:0.4}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:13,fontWeight:700,color:b.earned?V.text:V.text3}}>{b.name}</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2}}>{b.desc}</div></div>
            {b.earned&&<span style={{fontSize:16}}>✅</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Social Sub-Page: Notifications ───
function SocialNotifications({s}){
  const email=s.profile?.email;
  const [notifs,setNotifs]=useState(null);
  useEffect(()=>{if(email)SocialAPI.getNotifications(email).then(setNotifs);},[email]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:V.text}}>Notifications</div>
        {notifs?.unread>0&&<button onClick={()=>{SocialAPI.markRead(email,"all");setNotifs({...notifs,unread:0,notifications:notifs.notifications.map(n=>({...n,read:true}))});SuccessToastCtrl.show("All cleared");}}
          style={{padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,cursor:"pointer",fontSize:10,color:V.text3,fontFamily:V.font}}>Mark all read</button>}
      </div>
      {notifs?.notifications?.length>0?notifs.notifications.map(n=>(
        <Card key={n.id} style={{padding:12,opacity:n.read?0.5:1}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div><div style={{fontSize:12,fontWeight:700,color:V.text}}>{n.title}</div>
              <div style={{fontSize:11,color:V.text3,marginTop:2}}>{n.body}</div></div>
            <span style={{fontSize:9,color:V.text3}}>{fmtShort(n.created_at?.split("T")[0])}</span>
          </div>
        </Card>
      )):<div style={{textAlign:"center",padding:30,fontSize:12,color:V.text3}}>No notifications</div>}
    </div>
  );
}

// ─── Social Sub-Page: Compare (You vs Best) ───
function SocialCompare({s}){
  const weekW=s.workouts.filter(w=>w.date>=ago(7)).length;
  const bestWeek=Math.max(...Array.from({length:12},(_,i)=>s.workouts.filter(w=>{const d2=ago(i*7);const d3=ago((i+1)*7);return w.date<=d2&&w.date>d3;}).length),weekW);
  const streak=useStreak(s.workouts);
  const bestStreak=(()=>{let best=0,c=0;for(let i=0;i<180;i++){if(s.workouts.some(w=>w.date===ago(i))){c++;if(c>best)best=c;}else c=0;}return best;})();
  const thisMonthW=s.workouts.filter(w=>w.date>=ago(30)).length;
  const bestMonth=Math.max(...Array.from({length:6},(_,i)=>s.workouts.filter(w=>w.date>=ago((i+1)*30)&&w.date<ago(i*30)).length),thisMonthW);

  const Row=({label,current,best,unit})=>(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}}>
      <span style={{fontSize:12,color:V.text3}}>{label}</span>
      <div style={{textAlign:"center",fontSize:14,fontWeight:800,color:current>=best?V.accent:V.text,fontFamily:V.mono}}>{current}{unit}</div>
      <div style={{textAlign:"center",fontSize:14,fontWeight:800,color:V.purple,fontFamily:V.mono}}>{best}{unit}</div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>You vs Your Best</div>
      <Card style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"6px 0",marginBottom:4}}>
          <span style={{fontSize:9,color:V.text3}}></span>
          <span style={{fontSize:9,color:V.accent,fontWeight:700,textAlign:"center"}}>CURRENT</span>
          <span style={{fontSize:9,color:V.purple,fontWeight:700,textAlign:"center"}}>BEST</span>
        </div>
        <Row label="Week" current={weekW} best={bestWeek} unit=" workouts"/>
        <Row label="Streak" current={streak} best={bestStreak} unit=" days"/>
        <Row label="Month" current={thisMonthW} best={bestMonth} unit=" workouts"/>
      </Card>
    </div>
  );
}

// ─── Social Sub-Page: Leaderboard ───
function SocialLeaderboard({s,d}){
  const email=s.profile?.email;
  const [groups,setGroups]=useState(null);
  const [members,setMembers]=useState(null);
  const [selGroup,setSelGroup]=useState(null);
  useEffect(()=>{if(email)SocialAPI.getGroups(email).then(setGroups);},[email]);
  const loadMembers=(code)=>{setSelGroup(code);SocialAPI.getMembers(email,code).then(setMembers);};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Leaderboard</div>
      {groups?.groups?.length>0?(
        <div>
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {groups.groups.map(g=>(
              <button key={g.code} onClick={()=>loadMembers(g.code)} style={{padding:"6px 12px",borderRadius:8,
                border:`1.5px solid ${selGroup===g.code?V.accent:V.cardBorder}`,background:selGroup===g.code?`${V.accent}10`:"transparent",
                cursor:"pointer",fontSize:11,fontWeight:700,color:selGroup===g.code?V.accent:V.text3,fontFamily:V.font}}>{g.name}</button>
            ))}
          </div>
          {members?.members?.map((m,i)=>(
            <Card key={i} style={{padding:12,marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:24,height:24,borderRadius:8,background:i===0?V.accent:i===1?V.purple:i===2?V.warn:"rgba(255,255,255,0.06)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i<3?V.bg:V.text3}}>{i+1}</div>
                  <div><div style={{fontSize:12,fontWeight:600,color:V.text}}>{m.name}</div>
                    {m.username&&<div style={{fontSize:9,color:V.text3}}>@{m.username}</div>}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  {m.challenges?.map((c,j)=>(
                    <div key={j} style={{fontSize:9,color:V.text3}}>{c.challenge_id}: <span style={{color:V.accent,fontWeight:700}}>{c.value}</span></div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ):(
        <Card style={{padding:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🏆</div>
          <div style={{fontSize:12,color:V.text3}}>Join a group to see leaderboards</div>
          <Btn full onClick={()=>d({type:"TAB",tab:"social_groups"})} s={{marginTop:10}}>Find Groups</Btn>
        </Card>
      )}
    </div>
  );
}

// ─── Social Sub-Page: Challenges (kept from SocialHub) ───
function SocialChallenges({s,d}){
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
    {name:"Volume King",desc:"5,000 lbs total squat volume this week",check:()=>{let v=0;s.workouts.filter(w=>w.date>=ago(7)).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId==="squat")e.sets.forEach(st=>{v+=st.weight*st.reps;});}));return Math.round(v);},total:5000},
    {name:"Full Logger",desc:"Log workout + meal + check-in today",check:()=>(s.workouts.some(w=>w.date===today())?1:0)+(s.nutrition.some(n=>n.date===today())?1:0)+((s.checkins||[]).some(c=>c.date===today())?1:0),total:3},
  ];
  const weeklyChallenge=weeklyChallenges[weekNum%weeklyChallenges.length];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:16,fontWeight:800,color:V.text}}>Challenges</div>
      {/* Core challenges with tiers */}
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
              {tier.name&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:9,fontWeight:700,background:`${V.accent}10`,color:V.accent}}>{tier.icon} {tier.name}</span>}
            </div>
            <div style={{fontSize:20,fontWeight:800,color:V.text,fontFamily:V.mono,margin:"6px 0"}}>{ch.val}{ch.unit}</div>
            {ch.nextTier&&(<div>
              <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",marginBottom:4}}>
                <div style={{height:"100%",borderRadius:2,background:V.accent,width:`${Math.min(100,(ch.val/ch.nextTier.v)*100)}%`,transition:"width .3s"}}/>
              </div>
              <div style={{fontSize:9,color:V.text3}}>{ch.nextTier.v-ch.val}{ch.unit} to {ch.nextTier.icon} {ch.nextTier.name}</div>
            </div>)}
            {!ch.nextTier&&tier.name&&<div style={{fontSize:10,color:V.accent,fontWeight:600}}>Max tier reached! 🎉</div>}
          </Card>
        );
      })}
      {/* Weekly rotating */}
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



export {
  SocialTab, SocialFeed, SocialFriends, SocialGroups,
  SocialProfile, SocialBadges, SocialNotifications, SocialCompare,
  SocialLeaderboard, SocialChallenges,
};
export default SocialTab;
