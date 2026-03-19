// ─── localStorage persistence ───
export const LS={
  get:(k)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.warn("Error:",e);}},
};

// ─── Cookie helper (for SSO across ironlog.space subdomains) ───
export const Cookie={
  get:(name)=>{const m=document.cookie.match(new RegExp("(^| )"+name+"=([^;]+)"));return m?decodeURIComponent(m[2]):null;},
  set:(name,value,days=30)=>{const exp=new Date(Date.now()+days*864e5).toUTCString();document.cookie=`${name}=${encodeURIComponent(value)};expires=${exp};domain=.ironlog.space;path=/;secure;samesite=lax`;},
  clear:(name)=>{document.cookie=`${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=.ironlog.space;path=/;secure`;},
};
