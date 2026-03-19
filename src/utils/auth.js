import { LS, Cookie } from './storage';
import { SYNC_URL } from './sync';
import { SentryUtil } from './sentry';

// ─── #1 Auth Token (signed sync requests) ───
export const AuthToken={
  // Legacy — kept for backward compat during migration
  init:(email)=>{},
  generate:(email)=>"",
  getHeaders:(email)=>{
    const sessionToken=LS.get("ft-session-token");
    return{
      "Content-Type":"application/json",
      ...(sessionToken?{"X-Session-Token":sessionToken}:{}),
      "X-Auth-Token":email||"legacy",
    };
  },
};

// Session management
export const SessionManager={
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
        Cookie.set("ironlog_session",json.token,30); // SSO across subdomains
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
    SentryUtil.breadcrumb("User signed out","auth");SentryUtil.reset();
    LS.set("ft-session-token",null);LS.set("ft-session-email",null);LS.set("ft-session-expires",null);LS.set("ft-is-admin",null);
    Cookie.clear("ironlog_session"); // Clear SSO cookie
  },
  // Check admin status (silent — never exposes admin to non-admins)
  checkAdmin:async()=>{
    const token=LS.get("ft-session-token");
    const email=LS.get("ft-session-email")||LS.get("ft-profile")?.email;
    if(!token&&!email)return false;
    try{
      const headers={"Content-Type":"application/json"};
      if(token)headers["X-Session-Token"]=token;
      if(email)headers["X-Auth-Token"]=email;
      const res=await fetch(`${SYNC_URL}/api/admin`,{method:"POST",headers,
        body:JSON.stringify({action:"check"})});
      if(res.ok){const json=await res.json();if(json.isAdmin){LS.set("ft-is-admin",true);return true;}}
      LS.set("ft-is-admin",null);return false;
    }catch(e){return false;}
  },
};
