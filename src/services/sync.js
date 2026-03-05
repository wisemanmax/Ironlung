import { LS, ago, APP_VERSION, SYNC_URL } from '../utils.js';
import { AuthToken } from './auth.js';
import { SocialAPI } from './social.js';

// ─── Cloud Sync Engine ───
let syncTimer=null;
let syncInFlight=false;

// ─── Offline Sync Queue (IndexedDB) ───
const SyncQueue={
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
        const items=getAll.result||[];let synced=0;
        for(const item of items){
          try{const res=await fetch(item.url,{method:"POST",headers:{"Content-Type":"application/json"},body:item.body});
          if(res.ok){const delTx=db.transaction("queue","readwrite");delTx.objectStore("queue").delete(item.id);synced++;}}catch(e){console.warn("Error:",e);}
        }
        LS.set("ft-pending-sync",Math.max(0,items.length-synced));
        resolve({synced,remaining:items.length-synced});
      };
      getAll.onerror=()=>resolve({synced:0,remaining:0});
    });}catch(e){return{synced:0,remaining:0};}
  }
};


// ─── Social API Client ───
const CloudSync={
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
        vault_pin:LS.get("ft-vault-pin")||null,phases:state.phases||[],injuries:state.injuries||[],
        privacy:LS.get("ft-privacy")||{},supplements:LS.get("ft-supplements")||[]},
    });
    try{
      const res=await fetch(`${SYNC_URL}/api/sync/push`,{method:"POST",headers:AuthToken.getHeaders(email),body:payload});
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
      const badges2=[];
      if(streak2>=7)badges2.push("🔥 7-Day Streak");if(streak2>=30)badges2.push("💎 30-Day Streak");
      if(big3>=1000)badges2.push("🏆 1000lb Club");if(state.workouts.length>=100)badges2.push("💪 Century Club");
      if(protDays2>=7)badges2.push("⭐ Macro Master");
      SocialAPI.snapshotChallenges(email,[
        {id:"streak",value:streak2,tier:tierCalc(streak2,[[7,"bronze"],[14,"silver"],[21,"gold"],[30,"diamond"]])},
        {id:"big3",value:big3,tier:tierCalc(big3,[[600,"bronze"],[800,"silver"],[1000,"gold"],[1200,"diamond"]]),metadata:{bench:getBest("bench"),squat:getBest("squat"),deadlift:getBest("deadlift")}},
        {id:"macro",value:protDays2,tier:tierCalc(protDays2,[[3,"bronze"],[5,"silver"],[7,"gold"]])},
      ],badges2).catch(()=>{});
      // Flush queued items
      SyncQueue.processAll();
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
      const res=await fetch(`${SYNC_URL}/api/sync/pull`,{
        method:"POST",
        headers:AuthToken.getHeaders(email),
        body:JSON.stringify({email,deviceId,pin:pin||null}),
      });
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
      return{error:"Connection failed"};
    }
  },
};

// Generate and persist a device ID
if(!LS.get("ft-device-id")){
  LS.set("ft-device-id","dev_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36));
}



export { SyncQueue, CloudSync };;
