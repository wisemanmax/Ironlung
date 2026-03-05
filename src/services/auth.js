import { LS } from '../utils.js';
import { SYNC_URL } from '../utils.js';

// ─── #1 Auth Token (signed sync requests) ───
const AuthToken={
  // Legacy — kept for backward compat during migration
  init:(email)=>{},
  generate:(email)=>"",
  getHeaders:(email)=>{
    const sessionToken=LS.get("ft-session-token");
    return{
      "Content-Type":"application/json",
      ...(sessionToken?{"X-Session-Token":sessionToken}:{}),
      "X-Auth-Token":"legacy", // kept for old endpoints during migration
    };
  },
};

// Session management
const SessionManager={
  // Create session after signup (called with email + PIN)
  create:async(email,pin,deviceId)=>{
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"create",email:email.toLowerCase(),pin,deviceId:deviceId||LS.get("ft-device-id")})
      });
      const json=await res.json();
      if(json.success&&json.token){
        LS.set("ft-session-token",json.token);
        LS.set("ft-session-email",email.toLowerCase());
        LS.set("ft-session-expires",json.expires_at);
        return{success:true,token:json.token};
      }
      return{success:false,error:json.error,attempts_remaining:json.attempts_remaining};
    }catch(e){return{success:false,error:"Connection failed"};}
  },
  // Check if we have a valid session
  hasSession:()=>{
    const token=LS.get("ft-session-token");
    const expires=LS.get("ft-session-expires");
    if(!token)return false;
    if(expires&&new Date(expires)<new Date()){LS.set("ft-session-token",null);return false;}
    return true;
  },
  // Revoke (logout)
  revoke:async()=>{
    const token=LS.get("ft-session-token");
    if(token){try{await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json","X-Session-Token":token},body:JSON.stringify({action:"revoke",token})});}catch(e){}}
    LS.set("ft-session-token",null);LS.set("ft-session-email",null);LS.set("ft-session-expires",null);
  },
};


export { AuthToken, SessionManager };
