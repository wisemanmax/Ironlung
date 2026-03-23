import React, { useState, useEffect, useRef } from 'react';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Card, Btn, Field, Chip } from '../components/ui';
import { uid } from '../utils/helpers';
import { CloudSync, SYNC_URL } from '../utils/sync';
import { SessionManager } from '../utils/auth';
import { SentryUtil } from '../utils/sentry';
import { defaultExercises } from '../data/exercises';
import { genDemo } from '../data/demo';

export function Onboarding({d}){
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
  const [primaryGoal,setPrimaryGoal]=useState("");
  const [profile,setProfile]=useState({
    firstName:"",lastName:"",nickname:"",email:"",dob:"",sex:"",state:"",city:"",zipCode:"",
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
      // sync deferred;
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
      units,split,primaryGoal,
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
    if(bw){d({type:"ADD_B",b:{id:uid(),date:today(),weight:parseFloat(bw)||0,bf:0,waist:0,hips:0,chest:0,neck:0,arms:0,thighs:0,calves:0}});}
    // Init auth key for this device
    AuthToken.init(profile.email);
    LS.set("ft-device-id",payload.deviceId);
    // Create server-issued session token
    await SessionManager.create(profile.email,accountPin,payload.deviceId);
    // Send email verification code then show verify screen
    try{
      await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"send_verify_code",email:profile.email})});
    }catch(e){}
    setVerifyStep("pending");
    setSending(false);
    // Note: ONBOARDED is dispatched after email verified (or skipped via skip)
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
  const [signInStep,setSignInStep]=useState("email"); // email | pin | forgot | forgot_code | forgot_newpin

  // ─── Forgot PIN state ───
  const [forgotEmail,setForgotEmail]=useState("");
  const [forgotCode,setForgotCode]=useState("");
  const [forgotNewPin,setForgotNewPin]=useState("");
  const [forgotConfirmPin,setForgotConfirmPin]=useState("");
  const [forgotResetToken,setForgotResetToken]=useState("");
  const [forgotLoading,setForgotLoading]=useState(false);
  const [forgotError,setForgotError]=useState("");
  const [forgotSuccess,setForgotSuccess]=useState("");

  const forgotSendCode=async()=>{
    if(!forgotEmail.trim()||!forgotEmail.includes("@")){setForgotError("Enter a valid email");return;}
    setForgotLoading(true);setForgotError("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"send_reset_code",email:forgotEmail.trim().toLowerCase()})});
      // Always advance — we don't reveal if email exists
      setSignInStep("forgot_code");
      setForgotSuccess("If that email exists, a code was sent. Check your inbox.");
    }catch(e){setForgotError("Connection failed. Try again.");setForgotLoading(false);return;}
    setForgotLoading(false);
  };

  const forgotVerifyCode=async()=>{
    if(forgotCode.length!==6){setForgotError("Enter the 6-digit code from your email");return;}
    setForgotLoading(true);setForgotError("");setForgotSuccess("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"verify_reset_code",email:forgotEmail.trim().toLowerCase(),code:forgotCode})});
      const json=await res.json();
      if(json.reset_token){
        setForgotResetToken(json.reset_token);
        setSignInStep("forgot_newpin");
        setForgotError("");
      }else{
        setForgotError(json.error||(json.attempts_remaining!==undefined?`Wrong code. ${json.attempts_remaining} attempts left`:"Invalid code"));
      }
    }catch(e){setForgotError("Connection failed. Try again.");}
    setForgotLoading(false);
  };

  const forgotSetPin=async()=>{
    if(forgotNewPin.length!==6){setForgotError("PIN must be 6 digits");return;}
    if(forgotNewPin!==forgotConfirmPin){setForgotError("PINs don't match");return;}
    setForgotLoading(true);setForgotError("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"set_new_pin",email:forgotEmail.trim().toLowerCase(),resetToken:forgotResetToken,newPin:forgotNewPin})});
      const json=await res.json();
      if(json.success){
        setForgotSuccess("PIN updated! Sign in with your new PIN.");
        setSignInStep("pin");
        setSignInEmail(forgotEmail);
        setSignInPin("");
        setForgotNewPin("");setForgotConfirmPin("");setForgotResetToken("");
      }else{
        setForgotError(json.error||"Failed to update PIN");
      }
    }catch(e){setForgotError("Connection failed. Try again.");}
    setForgotLoading(false);
  };

  // ─── Email verification state (post-signup) ───
  const [verifyStep,setVerifyStep]=useState(null); // null | "pending" | "done"
  const [verifyCode,setVerifyCode]=useState("");
  const [verifyLoading,setVerifyLoading]=useState(false);
  const [verifyError,setVerifyError]=useState("");
  const [verifyCooldown,setVerifyCooldown]=useState(0);

  const verifySendCode=async(emailAddr)=>{
    try{
      await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"send_verify_code",email:emailAddr||profile.email})});
    }catch(e){}
  };

  const verifyConfirmCode=async()=>{
    if(verifyCode.length!==6){setVerifyError("Enter the 6-digit code");return;}
    setVerifyLoading(true);setVerifyError("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"confirm_verify_code",email:profile.email,code:verifyCode})});
      const json=await res.json();
      if(json.verified||json.already_verified){
        setVerifyStep("done");
        LS.set("ft-email-verified","true");
        setTimeout(()=>{d({type:"ONBOARDED"});},1200);
      }else{
        setVerifyError(json.error||"Incorrect code");
      }
    }catch(e){setVerifyError("Connection failed.");}
    setVerifyLoading(false);
  };

  const verifyResend=async()=>{
    if(verifyCooldown>0)return;
    await verifySendCode(profile.email);
    setVerifyCooldown(60);
    const t=setInterval(()=>setVerifyCooldown(c=>{if(c<=1){clearInterval(t);return 0;}return c-1;}),1000);
  };

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
      photos:cloud.photos||[],checkins:(cloud.checkins||[]).filter(c=>!c.deleted),milestones:cloud.milestones||[],
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
    // Identify user in Sentry
    const pEmail=merged.profile?.email||signInEmail.trim().toLowerCase();
    const pName=`${merged.profile?.firstName||merged.profile?.first_name||""} ${merged.profile?.lastName||merged.profile?.last_name||""}`.trim()||merged.profile?.username||"";
    SentryUtil.identify(pEmail,pName);
    SentryUtil.breadcrumb("User signed in","auth",{method:pinUsed?"pin":"no-pin"});
    // vault_pin no longer restored from server (kept local-only)
    if(cloud.phases)d({type:"SET_PHASES",phases:cloud.phases});
    if(cloud.injuries)d({type:"SET_INJURIES",injuries:cloud.injuries});
    if(cloud.privacy)LS.set("ft-privacy",cloud.privacy);
    if(cloud.supplements)LS.set("ft-supplements",cloud.supplements);
    if(cloud.accountability)LS.set("ft-accountability",cloud.accountability);
    // Restore gamification — only write keys that aren't already more up-to-date locally
    if(cloud.gamification){
      const g=cloud.gamification;
      // XP bonus: merge — take whichever total is higher (local may have earned more since last sync)
      const localBonus=LS.get("ft-xp-bonus")||{total:0,log:[]};
      if((g.xp_bonus?.total||0)>(localBonus.total||0))LS.set("ft-xp-bonus",g.xp_bonus);
      // Missions: merge by day — server wins for past days, local wins for today
      const localMissions=LS.get("ft-missions-completed")||{};
      const mergedMissions={...g.missions_completed,...localMissions};
      LS.set("ft-missions-completed",mergedMissions);
      // Shields: take max
      const localShields=LS.get("ft-streak-shields")||0;
      if((g.streak_shields||0)>localShields)LS.set("ft-streak-shields",g.streak_shields);
      if(g.shield_awarded_streak)LS.set("ft-shield-awarded-streak",g.shield_awarded_streak);
      if(g.shield_used_date&&!LS.get("ft-shield-used-date"))LS.set("ft-shield-used-date",g.shield_used_date);
      // Level: take max (don't regress celebration trigger)
      const localLevel=LS.get("ft-last-known-level")||1;
      if((g.last_known_level||1)>localLevel)LS.set("ft-last-known-level",g.last_known_level);
      // Badge dates: merge — keep earliest earned date per badge
      const localBadgeDates=LS.get("ft-badge-dates")||{};
      const mergedBadgeDates={...g.badge_dates};
      for(const[k,v]of Object.entries(localBadgeDates)){if(!mergedBadgeDates[k]||v<mergedBadgeDates[k])mergedBadgeDates[k]=v;}
      LS.set("ft-badge-dates",mergedBadgeDates);
      // Duels + rivals + wars: server wins (most recent sync is source of truth)
      if(g.duels?.length>0&&!(LS.get("ft-duels")?.length>0))LS.set("ft-duels",g.duels);
      if(g.rivals?.length>0&&!(LS.get("ft-rivals")?.length>0))LS.set("ft-rivals",g.rivals);
      if(g.war_wins>0&&!LS.get("ft-war-wins"))LS.set("ft-war-wins",g.war_wins);
      if(g.war_streak>0&&!LS.get("ft-war-streak"))LS.set("ft-war-streak",g.war_streak);
      if(g.comeback_used&&!LS.get("ft-comeback-used"))LS.set("ft-comeback-used",g.comeback_used);
      if(g.duel_record){const local=LS.get("ft-duel-record")||{wins:0,losses:0,ties:0};
        if((g.duel_record.wins||0)>(local.wins||0))LS.set("ft-duel-record",g.duel_record);}
    }
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

  // ─── Email Verification Screen (shown after signup completes) ───
  if(verifyStep==="pending"||verifyStep==="done"){
    return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
        background:V.bg,padding:24}}>
        <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,
            display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
            <span style={{fontSize:32}}>{verifyStep==="done"?"✓":"📧"}</span>
          </div>
          {verifyStep==="done"?(
            <>
              <div style={{fontSize:22,fontWeight:800,color:V.text,marginBottom:8}}>Email Verified!</div>
              <div style={{fontSize:13,color:V.text3}}>Taking you to IronLog...</div>
            </>
          ):(
            <>
              <div style={{fontSize:22,fontWeight:800,color:V.text,marginBottom:8}}>Check your email</div>
              <div style={{fontSize:13,color:V.text3,marginBottom:24,lineHeight:1.6}}>
                We sent a 6-digit code to<br/>
                <span style={{color:V.accent,fontWeight:600}}>{profile.email}</span>
              </div>
              <input type="text" inputMode="numeric" value={verifyCode}
                onChange={e=>setVerifyCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                placeholder="000000" maxLength={6} autoComplete="one-time-code"
                autoFocus
                onKeyDown={e=>{if(e.key==="Enter"&&verifyCode.length===6)verifyConfirmCode();}}
                style={{width:"100%",padding:"16px",background:"rgba(255,255,255,0.04)",
                  border:`2px solid ${verifyCode.length===6?V.accent:V.cardBorder}`,
                  borderRadius:12,color:V.text,fontSize:28,textAlign:"center",fontFamily:V.mono,
                  letterSpacing:14,outline:"none",boxSizing:"border-box",marginBottom:8,
                  transition:"border-color .2s"}}/>
              {verifyError&&<div style={{fontSize:11,color:V.danger,marginBottom:8}}>{verifyError}</div>}
              <Btn full onClick={verifyConfirmCode} disabled={verifyLoading||verifyCode.length!==6} s={{marginBottom:12}}>
                {verifyLoading?"Verifying...":"Verify Email"}
              </Btn>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
                <button onClick={verifyResend} disabled={verifyCooldown>0}
                  style={{background:"none",border:"none",cursor:verifyCooldown>0?"default":"pointer",
                    fontFamily:V.font,fontSize:12,color:verifyCooldown>0?V.text3:V.accent,padding:0}}>
                  {verifyCooldown>0?`Resend in ${verifyCooldown}s`:"Resend code"}
                </button>
                <span style={{color:V.text3,fontSize:12}}>·</span>
                <button onClick={()=>{LS.set("ft-email-verified","skipped");d({type:"ONBOARDED"});}}
                  style={{background:"none",border:"none",cursor:"pointer",fontFamily:V.font,fontSize:12,color:V.text3,padding:0}}>
                  Skip for now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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
              ):signInStep==="pin"?(
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
                  <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:8}}>{
                    [0,1,2,3,4,5].map(i=>(
                      <div key={i} style={{width:8,height:8,borderRadius:4,
                        background:i<signInPin.length?V.accent:"rgba(255,255,255,0.1)",transition:"all .15s"}}/>
                    ))
                  }</div>
                  <button onClick={()=>{setSignInStep("forgot");setForgotEmail(signInEmail);setForgotError("");setForgotSuccess("");}}
                    style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"block",margin:"0 auto 8px",fontFamily:V.font}}>
                    <span style={{fontSize:11,color:V.accent}}>Forgot PIN?</span>
                  </button>
                </div>
              ):signInStep==="forgot"?(
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:4}}>Reset your PIN</div>
                  <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Enter your email and we will send a reset code.</div>
                  <input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)}
                    placeholder="you@email.com" autoComplete="email"
                    onKeyDown={e=>{if(e.key==="Enter")forgotSendCode();}}
                    style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:V.font,marginBottom:8}}/>
                </div>
              ):signInStep==="forgot_code"?(
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:4}}>Enter reset code</div>
                  <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Check your email for a 6-digit code.</div>
                  {forgotSuccess&&<div style={{fontSize:11,color:V.accent2,marginBottom:8}}>{forgotSuccess}</div>}
                  <input type="text" inputMode="numeric" value={forgotCode}
                    onChange={e=>setForgotCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                    placeholder="000000" maxLength={6} autoComplete="one-time-code"
                    onKeyDown={e=>{if(e.key==="Enter"&&forgotCode.length===6)forgotVerifyCode();}}
                    style={{width:"100%",padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:24,textAlign:"center",fontFamily:V.mono,letterSpacing:12,
                      outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                </div>
              ):signInStep==="forgot_newpin"?(
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:V.text,marginBottom:4}}>Set new PIN</div>
                  <div style={{fontSize:10,color:V.text3,marginBottom:10}}>Choose a new 6-digit PIN.</div>
                  <input type="password" inputMode="numeric" value={forgotNewPin}
                    onChange={e=>setForgotNewPin(e.target.value.replace(/\D/g,"").slice(0,6))}
                    placeholder="New PIN" maxLength={6}
                    style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:20,textAlign:"center",fontFamily:V.mono,letterSpacing:8,
                      outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                  <input type="password" inputMode="numeric" value={forgotConfirmPin}
                    onChange={e=>setForgotConfirmPin(e.target.value.replace(/\D/g,"").slice(0,6))}
                    placeholder="Confirm PIN" maxLength={6}
                    onKeyDown={e=>{if(e.key==="Enter")forgotSetPin();}}
                    style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                      borderRadius:10,color:V.text,fontSize:20,textAlign:"center",fontFamily:V.mono,letterSpacing:8,
                      outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                </div>
              ):null}
              {(signInError||forgotError)&&<div style={{fontSize:11,color:V.danger,marginBottom:8}}>{signInError||forgotError}</div>}
              <div style={{display:"flex",gap:8}}>
                <Btn v="secondary" onClick={()=>{setShowSignIn(false);setSignInError("");setSignInStep("email");setSignInPin("");setForgotError("");setForgotCode("");setForgotNewPin("");setForgotConfirmPin("");}}>Cancel</Btn>
                <Btn full
                  onClick={signInStep==="forgot"?forgotSendCode:signInStep==="forgot_code"?forgotVerifyCode:signInStep==="forgot_newpin"?forgotSetPin:signIn}
                  disabled={signInLoading||forgotLoading}>
                  {(signInLoading||forgotLoading)?"...":
                    signInStep==="email"?"Continue":
                    signInStep==="pin"?"Sign In":
                    signInStep==="forgot"?"Send Code":
                    signInStep==="forgot_code"?"Verify Code":
                    signInStep==="forgot_newpin"?"Save PIN":"Continue"}
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
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)"}} onClick={()=>setShowInstallGuide(false)}/>
            <div style={{position:"relative",background:V.sheetBg,borderRadius:20,
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
    // Step 3: Primary Goal
    ()=>(
      <div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Primary Goal</div>
        <div style={{fontSize:13,color:V.text3,marginBottom:16}}>What are you training for?</div>
        {[
          {id:"Build Muscle",icon:"💪",desc:"Add size and strength"},
          {id:"Lose Fat",icon:"🔥",desc:"Cut body fat, stay lean"},
          {id:"Body Recomposition",icon:"⚖️",desc:"Lose fat and gain muscle simultaneously"},
          {id:"Strength",icon:"🏋️",desc:"Maximize raw strength and PRs"},
          {id:"Maintain Fitness",icon:"🎯",desc:"Stay consistent and healthy"},
        ].map(g=>(
          <button key={g.id} onClick={()=>setPrimaryGoal(g.id)} style={{
            display:"flex",alignItems:"center",gap:14,width:"100%",padding:"14px 16px",marginBottom:8,
            borderRadius:14,textAlign:"left",
            border:`2px solid ${primaryGoal===g.id?V.accent:V.cardBorder}`,
            background:primaryGoal===g.id?`${V.accent}10`:"rgba(255,255,255,0.02)",
            cursor:"pointer",WebkitTapHighlightColor:"transparent",
            transition:"all .15s"
          }}>
            <span style={{fontSize:24,flexShrink:0}}>{g.icon}</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:primaryGoal===g.id?V.accent:V.text}}>{g.id}</div>
              <div style={{fontSize:11,color:V.text3,marginTop:2}}>{g.desc}</div>
            </div>
            {primaryGoal===g.id&&<span style={{marginLeft:"auto",color:V.accent,fontSize:16}}>✓</span>}
          </button>
        ))}
        <Btn full onClick={()=>setStep(4)} disabled={!primaryGoal} s={{marginTop:8}}>Next</Btn>
      </div>
    ),
    // Step 4: Goals + Body Weight
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
        <Btn full onClick={()=>setStep(5)} s={{marginTop:16}}>Next</Btn>
      </div>
    ),
    // Step 5: Profile Setup
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
            <option value="" style={{background:V.bg}}>Select state...</option>
            {US_STATES.map(st=><option key={st} value={st} style={{background:V.bg}}>{st}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
          <Field label="City" value={profile.city} onChange={v=>setProfile(p=>({...p,city:v}))} placeholder="e.g. Austin"/>
          <Field label="Zip Code" type="text" value={profile.zipCode} onChange={v=>setProfile(p=>({...p,zipCode:v.replace(/\D/g,"").slice(0,5)}))} placeholder="e.g. 78701"/>
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
              <option value="" style={{background:V.bg}}>Select...</option>
              {["Beginner","Intermediate","Advanced","Elite"].map(lv=>(
                <option key={lv} value={lv} style={{background:V.bg}}>{lv}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Activity</div>
            <select value={profile.activityLevel} onChange={e=>setProfile(p=>({...p,activityLevel:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                borderRadius:12,color:profile.activityLevel?V.text:V.text3,fontSize:14,outline:"none",minHeight:44,
                WebkitAppearance:"none",fontFamily:V.font}}>
              <option value="" style={{background:V.bg}}>Select...</option>
              {["Sedentary","Lightly Active","Moderate","Very Active","Extremely Active"].map(lv=>(
                <option key={lv} value={lv} style={{background:V.bg}}>{lv}</option>
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

        <Btn full onClick={()=>setStep(6)} disabled={!profileValid} s={{marginTop:16}}>
          Next
        </Btn>

        {!profileValid&&(
          <div style={{fontSize:11,color:!nameClean||!ageValid?V.danger:V.text3,textAlign:"center",marginTop:8}}>
            {getValidationMsg()}
          </div>
        )}
      </div>
    ),
    // Step 6: Account PIN
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
      {/* Back button + Step counter */}
      {step>0&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"none",display:"flex",alignItems:"center",
            gap:5,padding:"8px 0",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
            {Icons.chevLeft({size:18,color:V.accent})}
            <span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
          </button>
          <span style={{fontSize:12,color:V.text3,fontWeight:600}}>Step {step} of {steps.length-1}</span>
          <div style={{width:40}}/>
        </div>
      )}
      {step>0&&(
        <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",marginBottom:24}}>
          <div style={{height:3,borderRadius:2,width:`${(step/(steps.length-1))*100}%`,
            background:`linear-gradient(90deg,${V.accent},${V.accent2})`,transition:"width .3s"}}/>
        </div>
      )}
      {steps[step]()}
      </div>
    </div>
  );
}

// ─── 1RM Calculator Standalone ───
