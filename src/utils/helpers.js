// ─── Helpers ───
export const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2,11));
export const today = () => new Date().toISOString().split("T")[0];
export const fmtShort = (d) => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
export const fmtFull = (d) => new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
export const ago = (n) => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; };
// Safely display a friend's name — never shows raw email
export const friendDisplayName=(f)=>{
  const n=f?.name||"";
  if(!n||n.includes("@")||n.trim()==="null null"||n.trim()==="undefined undefined"){
    const e=f?.email||"";
    if(!e)return"Unknown";
    const prefix=e.split("@")[0].replace(/[._\-+]/g," ");
    return prefix.replace(/\b\w/g,c=>c.toUpperCase()).trim()||"Unknown";
  }
  return n.trim()||"Unknown";
};
export const calc1RM = (w,r) => r===1?w:Math.round(w*(1+r/30));
export const fmtTimer = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
export const PLATES=[45,35,25,10,5,2.5];
export const calcPlates=(total)=>{let ps=(total-45)/2;if(ps<=0)return total<=45?[]:null;const r=[];for(const p of PLATES){while(ps>=p){r.push(p);ps-=p;}}return ps===0?r:null;};
export const toKg=(lbs)=>Math.round(lbs*0.4536*10)/10;
export const toLbs=(kg)=>Math.round(kg/0.4536*10)/10;
export const wUnit=(units)=>units==="kg"?"kg":"lbs";
export const dUnit=(units)=>units==="kg"?"km":"mi";
export const isCardio=(exerciseId,exercises)=>exercises.find(e=>e.id===exerciseId)?.cat==="Cardio";
export const convW=(v,units)=>units==="kg"?toKg(v):v;

// Shared recharts config
export const chartCfg={
  grid:{strokeDasharray:"3 3",stroke:"rgba(255,255,255,0.06)"},
  axis:{tick:{fill:"rgba(255,255,255,0.4)",fontSize:10},axisLine:false,tickLine:false},
  tip:{contentStyle:{background:"#1a1a2e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:12,color:"#fff"},itemStyle:{color:"#fff"}},
};
