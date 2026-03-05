import { AuthToken } from './auth.js';
import { SYNC_URL } from '../utils.js';

// ─── Social API Client ───
const SocialAPI={
  _headers:(email)=>({...AuthToken.getHeaders(email)}),

  // Friends
  getFriends:async(email)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=friends&email=${email}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
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
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed&email=${email}&limit=${limit||30}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  logEvent:async(email,type,data,visibility)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"log_event",type,data,visibility:visibility||"friends"})});return r.ok?await r.json():null;}catch(e){return null;}
  },
  react:async(email,eventId,reaction)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=feed`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"feed",email,action:"react",event_id:eventId,reaction})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Groups
  getGroups:async(email)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=groups&email=${email}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
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

  // Notifications
  getNotifications:async(email)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=notifications&email=${email}`,{headers:SocialAPI._headers(email)});return r.ok?await r.json():null;}catch(e){return null;}
  },
  markRead:async(email,id)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"notifications",action:"notifications",email,mark_read:id||"all"})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Challenge snapshots
  snapshotChallenges:async(email,challenges,badges)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"snapshot",email,challenges,badges})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Username
  setUsername:async(email,username)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social`,{method:"POST",headers:SocialAPI._headers(email),body:JSON.stringify({route:"set_username",email,username})});return r.ok?await r.json():null;}catch(e){return null;}
  },

  // Profile lookup
  getProfile:async(username)=>{
    try{const r=await fetch(`${SYNC_URL}/api/social?route=profile&username=${username}`);return r.ok?await r.json():null;}catch(e){return null;}
  },
};


export { SocialAPI };
export default SocialAPI;
