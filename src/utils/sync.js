import { LS } from './storage';
import { AuthToken } from './auth';
import { today, ago, uid } from './helpers';
import { IRON_RANKS } from '../data/ranks';
import { BADGE_DEFS, calcEarnedBadges } from '../data/badges';

// ─── Cloud Sync Engine ───
// Allow localStorage override of API URL for dev/staging environments
export const SYNC_URL=LS.get("ft-api-url")||"https://api.ironlog.space";

export const APP_VERSION="9.0";
export const SW_VERSION="ironlog-v6.0"; // Keep in sync with sw.js

export let syncTimer=null;
export let syncInFlight=false;

// Global ref for MsgBannerCtrl (set from App)
export let MsgBannerCtrl_ref = { push: () => {} };
export function setMsgBannerCtrlRef(ctrl) { MsgBannerCtrl_ref = ctrl; }

// ─── Offline Sync Queue (IndexedDB) ───
export const SyncQueue={
  _open:()=>new Promise((resolve,reject)=>{
    const req=indexedDB.open("ironlog-sync-queue",1);
    req.onupgradeneeded=(e)=>{const db=e.target.result;if(!db.objectStoreNames.contains("queue"))db.createObjectStore("queue",{keyPath:"id",autoIncrement:true});};
    req.onsuccess=(e)=>resolve(e.target.result);
    req.onerror=(e)=>reject(e.target.error);
  }),
  add:async(url,body)=>{
    try{const db=await SyncQueue._open();const tx=db.transaction("queue","readwrite");
    tx.objectStore("queue").add({url,body,timestamp:new Date().toISOString()});
    LS.set("ft-pending-sync",(parseInt(LS.get("ft-pending-sync"))||0)+1);
    // Request background sync if available
    if("serviceWorker" in navigator&&"SyncManager" in window){
      const reg=await navigator.serviceWorker.ready;
      await reg.sync.register("ironlog-sync").catch(()=>{});
    }}catch(e){console.warn("Error:",e);}
  },
  count:async()=>{
    try{const db=await SyncQueue._open();return new Promise(r=>{
      const tx=db.transaction("queue","readonly");const c=tx.objectStore("queue").count();
      c.onsuccess=()=>r(c.result);c.onerror=()=>r(0);
    });}catch(e){return 0;}
  },
  clear:async()=>{
    try{const db=await SyncQueue._open();const tx=db.transaction("queue","readwrite");
    tx.objectStore("queue").clear();LS.set("ft-pending-sync",0);}catch(e){console.warn("Error:",e);}
  },
  processAll:async()=>{
    try{const db=await SyncQueue._open();const tx=db.transaction("queue","readonly");
    const getAll=tx.objectStore("queue").getAll();
    return new Promise(resolve=>{
      getAll.onsuccess=async()=>{
        const items=getAll.result||[];let synced=0;let discarded=0;
        // Read current session token at replay time so queued items pass auth
        const sessionToken=LS.get("ft-session-token");
        const headers={"Content-Type":"application/json"};
        if(sessionToken)headers["X-Session-Token"]=sessionToken;
        for(const item of items){
          try{const res=await fetch(item.url,{method:"POST",headers,body:item.body});
          if(res.ok){const delTx=db.transaction("queue","readwrite");delTx.objectStore("queue").delete(item.id);synced++;}
          else if(res.status===401){resolve({synced,remaining:items.length-synced-discarded,authError:true});return;}
          // #12: Drop permanently-invalid items (400/403/404/422) — previously left in queue causing infinite retry.
          // A 5xx or network error is transient so we leave those for next sync.
          else if(res.status===400||res.status===403||res.status===404||res.status===409||res.status===422){
            const delTx=db.transaction("queue","readwrite");delTx.objectStore("queue").delete(item.id);
            discarded++;
            console.warn("SyncQueue: discarding permanently-failed item",item.id,"status",res.status);
          }}catch(e){console.warn("Error:",e);}
        }
        const remaining=Math.max(0,items.length-synced-discarded);
        LS.set("ft-pending-sync",remaining);
        resolve({synced,remaining});
      };
      getAll.onerror=()=>resolve({synced:0,remaining:0});
    });}catch(e){return{synced:0,remaining:0};}
  }
};
export const ActiveWorkoutStore={
  _open:()=>new Promise((res,rej)=>{
    const r=indexedDB.open("ironlog-active-workout",1);
    r.onupgradeneeded=(e)=>{const db=e.target.result;if(!db.objectStoreNames.contains("active"))db.createObjectStore("active",{keyPath:"id"});};
    r.onsuccess=(e)=>res(e.target.result);r.onerror=(e)=>rej(e.target.error);
  }),
  save:async(workout)=>{
    try{const db=await ActiveWorkoutStore._open();const tx=db.transaction("active","readwrite");tx.objectStore("active").put({id:"current",...workout,savedAt:new Date().toISOString()});}catch(e){}
  },
  load:async()=>{
    try{const db=await ActiveWorkoutStore._open();return new Promise(r=>{const tx=db.transaction("active","readonly");const req=tx.objectStore("active").get("current");req.onsuccess=()=>r(req.result||null);req.onerror=()=>r(null);});}catch(e){return null;}
  },
  clear:async()=>{
    try{const db=await ActiveWorkoutStore._open();const tx=db.transaction("active","readwrite");tx.objectStore("active").delete("current");}catch(e){}
  },
};
export const ReconcileAPI = {
  _key: 'ft-reconcile-result',
  _tsKey: 'ft-reconcile-ts',
  // Minimum gap between auto-runs (4 hours)
  _intervalMs: 4 * 60 * 60 * 1000,

  async run(state) {
    const email = state?.profile?.email;
    if (!email) return null;
    const clientCounts = {
      workouts: state.workouts?.length ?? 0,
      nutrition: state.nutrition?.length ?? 0,
      body: state.body?.length ?? 0,
      photos: state.photos?.length ?? 0,
    };
    try {
      const res = await fetch(`${SYNC_URL}/api/sync/reconcile`, {
        method: 'POST',
        headers: AuthToken.getHeaders(email),
        body: JSON.stringify({
          email,
          deviceId: LS.get('ft-device-id') || 'unknown',
          clientCounts,
        }),
      });
      if (res.status === 401) return { status: 'auth_error', ran_at: new Date().toISOString() };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = { ...data, ran_at: new Date().toISOString() };
      LS.set(ReconcileAPI._key, result);
      LS.set(ReconcileAPI._tsKey, Date.now());
      return result;
    } catch(e) {
      const err = { status: 'error', error: e.message, ran_at: new Date().toISOString() };
      LS.set(ReconcileAPI._key, err);
      return err;
    }
  },

  // Returns the last stored result (no network call)
  last() { return LS.get(ReconcileAPI._key); },

  // Returns true if enough time has passed to warrant an auto-run
  shouldAutoRun() {
    const last = parseInt(LS.get(ReconcileAPI._tsKey) || '0');
    return Date.now() - last > ReconcileAPI._intervalMs;
  },
};
export const SocialAPI={
  _headers:(email)=>({...AuthToken.getHeaders(email)}),

  // Friends
  getFriends:async(email)=>{
    // #B5: email removed from GET query string — server reads identity from session token.
    // Sending email in the URL logged it to Vercel/CDN/proxy access logs unnecessarily.
    try{const r=await fetch(`${SYNC_URL}/api/social?route=friends`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  sendRequest:async(email,target)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=friends`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"friends",email,action:"send",target})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  acceptRequest:async(email,from)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=friends`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"friends",email,action:"accept",target:from})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  removeFriend:async(email,target)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=friends`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"friends",email,action:"remove",target})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Feed
  getFeed:async(email,limit)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed&limit=${limit||30}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  logEvent:async(email,type,data,visibility)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"log_event",type,data,visibility:visibility||"friends"})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  react:async(email,eventId,reaction)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"react",event_id:eventId,reaction})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Groups
  getGroups:async(email)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=groups`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  createGroup:async(email,name,desc)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=groups`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"groups",email,action:"create",name,description:desc})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  joinGroup:async(email,code)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=groups`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"groups",email,action:"join",code})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  leaveGroup:async(email,code)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=groups`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"groups",email,action:"leave",code})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  getMembers:async(email,code)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=groups`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"groups",email,action:"members",code})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  getGroupEvents:async(email,code,type)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=group_events&group=${code}&type=${type||""}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  // Direct Messages
  getDMs:async(email,friendEmail,before,limit)=>{
    try{
      const params=new URLSearchParams({route:"dms",friend:friendEmail});
      if(before)params.set("before",before);
      if(limit)params.set("limit",String(limit));
      const r=await fetch(`${SYNC_URL}/api/social?${params}`,{headers:SocialAPI._headers(email)});
      return r.ok?await r.json():null;
    }catch(e){return null;}
  },
  sendDM:async(email,friendEmail,text,name)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"log_event",type:"DirectMessage",data:{to:friendEmail,text,name},visibility:"private"})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  markDMsRead:async(email,friendEmail)=>{
    try{await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"log_event",type:"DMRead",data:{partner:friendEmail,readAt:new Date().toISOString()},visibility:"private"})});return true;}catch(e){return false;}
  },
  checkMessages:async(email,since)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=check_messages&since=${encodeURIComponent(since)}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Notifications
  getNotifications:async(email)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=notifications`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  markRead:async(email,id)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"notifications",action:"notifications",email,mark_read:id||"all"})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  deleteNotif:async(email,id)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"notifications",email,delete_id:id})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  clearReadNotifs:async(email)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"notifications",email,clear_all:true})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Challenge snapshots
  snapshotChallenges:async(email,challenges,badges)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"snapshot",email,challenges,badges})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Username
  setUsername:async(email,username)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"set_username",email,username})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Sync profile avatar + banner to server so friends can see them
  updateProfile:async(email,{avatar,banner,bio,username})=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"update_profile",email,avatar,banner,bio,username})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Trigger a push notification to a DM recipient (server sends web push if they have it enabled)
  notifyDM:async(email,friendEmail,name,text,imageMsg)=>{
    try{await fetch(`${SYNC_URL}/api/push`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({action:"notify_dm",from:email,to:friendEmail,name,text:imageMsg?"📷 Photo":text})});}catch(e){}
  },

  // Send a DM with optional image attachment
  sendDMImage:async(email,friendEmail,imageData,name)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"log_event",type:"DirectMessage",data:{to:friendEmail,text:"📷 Photo",name,imageData},visibility:"private"})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Profile lookup
  getProfile:async(username)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=profile&username=${username}`);return r.ok?await r.json():null;}catch(e){return null;}
  },
};
export const CloudSync={
  // Push all data to server (debounced, silent) — queues on failure
  push:async(state)=>{
    if(syncInFlight)return;
    const email=state.profile?.email;
    if(!email)return;
    syncInFlight=true;
    const payload=JSON.stringify({
      email,
      deviceId:LS.get("ft-device-id")||"unknown",
      appVersion:APP_VERSION,
      workouts:(state.syncPrefs||{}).workouts!==false?state.workouts||[]:[],
      nutrition:(state.syncPrefs||{}).nutrition!==false?state.nutrition||[]:[],
      body:(state.syncPrefs||{}).body!==false?state.body||[]:[],
      photos:(state.syncPrefs||{}).photos!==false?(state.photos||[]).filter(p=>!p.data||p.data.length<500000):[],
      checkins:(state.syncPrefs||{}).checkins!==false?state.checkins||[]:[],
      milestones:(state.syncPrefs||{}).milestones!==false?state.milestones||[]:[],
      settings:{goals:state.goals,schedule:state.schedule,exercises:state.exercises,units:state.units,
        // vault_pin omitted — kept local-only, never sent to server
        phases:state.phases||[],injuries:state.injuries||[],
        privacy:LS.get("ft-privacy")||{},supplements:LS.get("ft-supplements")||[],
        accountability:LS.get("ft-accountability")||[],
        // Gamification — all local-only keys bundled here so they survive device switches
        gamification:{
          xp_bonus:         LS.get("ft-xp-bonus")||{total:0,log:[]},
          missions_completed:LS.get("ft-missions-completed")||{},
          streak_shields:    LS.get("ft-streak-shields")||0,
          shield_awarded_streak: LS.get("ft-shield-awarded-streak")||0,
          shield_used_date:  LS.get("ft-shield-used-date")||null,
          last_known_level:  LS.get("ft-last-known-level")||1,
          badge_dates:       LS.get("ft-badge-dates")||{},
          duels:             LS.get("ft-duels")||[],
          rivals:            LS.get("ft-rivals")||[],
          war_wins:          LS.get("ft-war-wins")||0,
          war_streak:        LS.get("ft-war-streak")||0,
          comeback_used:     LS.get("ft-comeback-used")||null,
          duel_record:       LS.get("ft-duel-record")||{wins:0,losses:0,ties:0},
        }},
    });
    try{
      const res=await fetch(`${SYNC_URL}/api/sync/push`,{method:"POST",headers:AuthToken.getHeaders(email),body:payload});
      if(res.status===401){
        // I10: Session expired — show actionable banner instead of silently queueing
        LS.set("ft-session-token",null);
        MsgBannerCtrl_ref.push({name:"Session Expired",text:"Tap to sign in again — your data is saved locally.",type:"system"});
        syncInFlight=false;return;
      }
      if(!res.ok)throw new Error("Push failed");
      const json=await res.json();
      LS.set("ft-last-sync",new Date().toISOString());
      LS.set("ft-pending-sync",0);
      // Check for app update
      if(json.latest_version&&json.latest_version!==APP_VERSION){
        LS.set("ft-update-available",json.latest_version);
        LS.set("ft-update-notes",json.update_notes||"");
      }
      // Snapshot challenge progress on every sync (non-blocking)
      const streak2=(()=>{let c=0;for(let i=0;i<60;i++){if(state.workouts.some(w=>w.date===ago(i)))c++;else if(i>0)break;}return c;})();
      const getBest=(id)=>{let b=0;state.workouts.forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{if(st.weight>b)b=st.weight;});}));return b;};
      const big3=getBest("bench")+getBest("squat")+getBest("deadlift");
      const protDays2=state.nutrition.filter(n=>n.date>=ago(7)&&(n.protein||0)>=(state.goals?.protein||180)).length;
      const tierCalc=(v,tiers)=>{for(let i=tiers.length-1;i>=0;i--)if(v>=tiers[i][0])return tiers[i][1];return null;};
      // Build badges using BADGE_DEFS (if available) otherwise fallback
      const badges2=[];
      if(typeof BADGE_DEFS!=="undefined"&&typeof calcEarnedBadges!=="undefined"){
        const {checks}=calcEarnedBadges(state);
        BADGE_DEFS.filter(b=>checks[b.id]).forEach(b=>badges2.push(b.name));
      } else {
        if(streak2>=7)badges2.push("On Fire");if(streak2>=30)badges2.push("Diamond Streak");
        if(big3>=1000)badges2.push("1000lb Club");if(state.workouts.length>=100)badges2.push("Century Club");
        if(protDays2>=7)badges2.push("Macro Master");
      }
      SocialAPI.snapshotChallenges(email,[
        {id:"streak",value:streak2,tier:tierCalc(streak2,[[7,"bronze"],[14,"silver"],[21,"gold"],[30,"diamond"]])},
        {id:"big3",value:big3,tier:tierCalc(big3,[[600,"bronze"],[800,"silver"],[1000,"gold"],[1200,"diamond"]]),metadata:{bench:getBest("bench"),squat:getBest("squat"),deadlift:getBest("deadlift")}},
        {id:"macro",value:protDays2,tier:tierCalc(protDays2,[[3,"bronze"],[5,"silver"],[7,"gold"]])},
        {id:"ironscore",value:LS.get("ft-ironscore")||0,tier:(()=>{const xp2=LS.get("ft-ironscore")||0;return([...IRON_RANKS].reverse().find(r=>xp2>=r.xpNeeded)||IRON_RANKS[0]).name;})()},
      ],badges2).catch(()=>{});
      // Flush queued items
      SyncQueue.processAll();
      // Auto-reconcile every 4 hours — non-blocking, silent
      if(ReconcileAPI.shouldAutoRun()) ReconcileAPI.run(state).catch(()=>{});
    }catch(e){
      // Queue for background sync
      await SyncQueue.add(`${SYNC_URL}/api/sync/push`,payload);
    }
    syncInFlight=false;
  },

  debouncedPush:(state)=>{
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>CloudSync.push(state),3000);
  },

  // Pull all data from server (for restore) — requires PIN if account has one
  pull:async(email,deviceId,pin)=>{
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),15000);
      const res=await fetch(`${SYNC_URL}/api/sync/pull`,{
        method:"POST",
        headers:AuthToken.getHeaders(email),
        body:JSON.stringify({email,deviceId,pin:pin||null}),
        signal:ctrl.signal,
      });
      clearTimeout(timer);
      const json=await res.json();
      if(res.status===403&&json.pin_required)return{pin_required:true};
      if(res.status===403)return{wrong_pin:true,attempts_remaining:json.attempts_remaining,locked:json.locked};
      if(res.status===429)return{locked:true,retry_minutes:json.retry_minutes};
      // Handle 200 with success:false (account not found)
      if(json.success===false)return{error:json.error||"Account not found"};
      if(!res.ok)return{error:"Server error"};
      if(json.success)return json;
      return null;
    }catch(e){
      if(e.name==="AbortError")return{error:"Request timed out. Please try again."};
      return{error:"Could not reach the server. Please try again later."};
    }
  },
};

// Generate and persist a device ID
if(!LS.get("ft-device-id")){
  LS.set("ft-device-id","dev_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36));
}
