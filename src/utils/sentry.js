// ─── Sentry helpers (no-op gracefully if SDK unavailable) ───
export const SentryUtil={
  // Call once user signs in — attaches email/name to all future errors
  identify:(email,name)=>{
    if(typeof Sentry==="undefined")return;
    Sentry.setUser({email,username:name||email.split("@")[0]});
  },
  // Clear on sign-out
  reset:()=>{if(typeof Sentry!=="undefined")Sentry.setUser(null);},
  // Wrap an async fn so thrown errors are captured with context
  capture:(err,context)=>{
    if(typeof Sentry==="undefined"){console.error(err);return;}
    Sentry.withScope(scope=>{
      if(context)Object.entries(context).forEach(([k,v])=>scope.setExtra(k,v));
      Sentry.captureException(err);
    });
  },
  // Track a named breadcrumb (e.g. "user saved workout")
  breadcrumb:(msg,category,data)=>{
    if(typeof Sentry==="undefined")return;
    Sentry.addBreadcrumb({message:msg,category:category||"app",data,level:"info"});
  },
};

// Global unhandled promise rejection → Sentry (covers fetch failures, etc.)
window.addEventListener("unhandledrejection",e=>{
  if(typeof Sentry!=="undefined")Sentry.captureException(e.reason||new Error("Unhandled rejection"));
});
