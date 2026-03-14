// IRONLOG Pure Logic Functions
// Extracted from index.html — no DOM/React dependencies

// ─── Helpers ───
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().split("T")[0];
const fmtShort = (d) => new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull = (d) => new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const ago = (n) => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; };
const calc1RM = (w,r) => r===1?w:Math.round(w*(1+r/30));
const fmtTimer = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const PLATES=[45,35,25,10,5,2.5];
const calcPlates=(total)=>{let ps=(total-45)/2;if(ps<=0)return total<=45?[]:null;const r=[];for(const p of PLATES){while(ps>=p){r.push(p);ps-=p;}}return ps===0?r:null;};
const toKg=(lbs)=>Math.round(lbs*0.4536*10)/10;
const toLbs=(kg)=>Math.round(kg/0.4536*10)/10;
const wUnit=(units)=>units==="kg"?"kg":"lbs";
const dUnit=(units)=>units==="kg"?"km":"mi";
const isCardio=(exerciseId,exercises)=>exercises.find(e=>e.id===exerciseId)?.cat==="Cardio";
const convW=(v,units)=>units==="kg"?toKg(v):v;


// ─── Demo data ───
function genDemo(){
  const w=[],n=[],b=[];
  const pool=["bench","squat","deadlift","ohp","row","pullup","curl","tricep","legpress","latpull"];
  for(let i=30;i>=0;i--){
    const d=ago(i);
    if(i%7!==0&&i%7!==3){
      const ne=3+Math.floor(Math.random()*3);
      const sh=[...pool].sort(()=>Math.random()-0.5).slice(0,ne);
      const exs=sh.map(eid=>{
        const bw={bench:185,squat:275,deadlift:315,ohp:135,row:185,pullup:0,curl:35,tricep:50,legpress:400,latpull:150}[eid]||100;
        const p=(30-i)*0.5;
        return{exerciseId:eid,sets:Array.from({length:3+Math.floor(Math.random()*2)},()=>({
          weight:Math.round(bw+p+(Math.random()*10-5)),reps:6+Math.floor(Math.random()*7),rpe:7+Math.floor(Math.random()*3),done:true
        }))};
      });
      w.push({id:uid(),date:d,dur:45+Math.floor(Math.random()*30),exercises:exs,notes:"",rating:3+Math.floor(Math.random()*3)});
    }
    const pr=140+Math.floor(Math.random()*60),ca=180+Math.floor(Math.random()*80),fa=55+Math.floor(Math.random()*30);
    const cal=pr*4+ca*4+fa*9;
    n.push({id:uid(),date:d,cal,protein:pr,carbs:ca,fat:fa,fiber:20+Math.floor(Math.random()*15),water:6+Math.floor(Math.random()*6),
      sleep:6+Math.random()*2.5,
      meals:[{name:"Breakfast",cal:Math.round(cal*.25),protein:Math.round(pr*.25),items:[]},{name:"Lunch",cal:Math.round(cal*.35),protein:Math.round(pr*.35),items:[]},
        {name:"Dinner",cal:Math.round(cal*.3),protein:Math.round(pr*.3),items:[]},{name:"Snacks",cal:Math.round(cal*.1),protein:Math.round(pr*.1),items:[]}]});
    if(i%3===0||i%7===0){
      b.push({id:uid(),date:d,weight:182-(30-i)*.15+Math.random()*2-1,bf:18-(30-i)*.05+Math.random()*.5,
        chest:42+(30-i)*.02,waist:34-(30-i)*.03,arms:15.5+(30-i)*.015,thighs:24+(30-i)*.01});
    }
  }
  return{workouts:w,nutrition:n,body:b};
}


function validateWorkout(w,s){
  const warnings=[];
  w.exercises.forEach(ex=>{
    const name=s.exercises.find(e=>e.id===ex.exerciseId)?.name||ex.exerciseId;
    const cardio=isCardio(ex.exerciseId,s.exercises);
    ex.sets.forEach(st=>{
      if(cardio){
        if(st.duration>300)warnings.push(`${name}: ${st.duration} min seems extremely long`);
      }else{
        if(st.weight>800)warnings.push(`${name}: ${st.weight} ${wUnit(s.units)} seems extremely high`);
        if(st.reps>100)warnings.push(`${name}: ${st.reps} reps seems high`);
      }
    });
  });
  // Duplicate check
  const dupes=s.workouts.filter(wk=>wk.date===w.date&&wk.exercises.map(e=>e.exerciseId).sort().join(",")===w.exercises.map(e=>e.exerciseId).sort().join(","));
  if(dupes.length>0)warnings.push("You already logged a similar workout today");
  return warnings;
}
function validateNutrition(n){
  const w=[];
  if(n.cal>8000)w.push(`${n.cal} calories seems extremely high`);
  if(n.protein>500)w.push(`${n.protein}g protein seems very high`);
  return w;
}
function validateBody(b,s){
  const w=[];
  const last=s.body[0];
  if(last&&b.weight>0&&Math.abs(b.weight-last.weight)>20)
    w.push(`Weight change of ${Math.abs(b.weight-last.weight).toFixed(1)} ${wUnit(s.units)} from last entry`);
  return w;
}

// ─── #3 Validation Confirm Dialog ───

// ─── Readiness Score Engine ───
function calcReadiness(s){
  const td=today();
  const checkin=(s.checkins||[]).find(c=>c.date===td);
  const tn=s.nutrition.find(n=>n.date===td)||s.nutrition.find(n=>n.date===ago(1));
  const lastW=s.workouts[0]; // most recent workout
  const recentW=s.workouts.filter(w=>w.date>=ago(7));
  const prevWeekW=s.workouts.filter(w=>w.date>=ago(14)&&w.date<ago(7));

  let score=50; // baseline
  const factors=[];

  // 1. Sleep quality (0-25 pts) — from nutrition log or check-in
  const sleep=checkin?.sleep||tn?.sleep||0;
  if(sleep>0){
    if(sleep>=7.5){score+=25;factors.push({label:"Great sleep",val:`${sleep.toFixed(1)}h`,color:V.accent,pts:25});}
    else if(sleep>=6.5){score+=18;factors.push({label:"Decent sleep",val:`${sleep.toFixed(1)}h`,color:V.warn,pts:18});}
    else if(sleep>=5){score+=8;factors.push({label:"Low sleep",val:`${sleep.toFixed(1)}h`,color:V.danger,pts:8});}
    else{score+=0;factors.push({label:"Poor sleep",val:`${sleep.toFixed(1)}h`,color:V.danger,pts:0});}
  }

  // 2. Recovery time (0-15 pts) — days since last workout
  if(lastW){
    const daysSince=Math.floor((new Date(td)-new Date(lastW.date))/(86400000));
    if(daysSince===0){score+=5;factors.push({label:"Trained today",val:"0d rest",color:V.text3,pts:5});}
    else if(daysSince===1){score+=12;factors.push({label:"1 day rest",val:"Fresh",color:V.accent,pts:12});}
    else if(daysSince===2){score+=15;factors.push({label:"2 days rest",val:"Recovered",color:V.accent,pts:15});}
    else if(daysSince<=4){score+=10;factors.push({label:`${daysSince}d rest`,val:"Rested",color:V.accent2,pts:10});}
    else{score+=5;factors.push({label:`${daysSince}d rest`,val:"Detraining",color:V.warn,pts:5});}
  }

  // 3. Last workout intensity (0-10 pts) — lower intensity = more recovery
  if(lastW){
    const avgRPE=lastW.exercises.reduce((sum,ex)=>{
      const rpes=ex.sets.filter(st=>st.rpe).map(st=>st.rpe);
      return sum+(rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:7);
    },0)/(lastW.exercises.length||1);
    if(avgRPE<=7){score+=10;factors.push({label:"Low last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.accent,pts:10});}
    else if(avgRPE<=8.5){score+=6;factors.push({label:"Moderate intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.warn,pts:6});}
    else{score+=2;factors.push({label:"High last intensity",val:`RPE ${avgRPE.toFixed(1)}`,color:V.danger,pts:2});}
  }

  // 4. Training volume trend (-10 to +10) — overreaching detection
  if(recentW.length>0&&prevWeekW.length>0){
    const thisVol=recentW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const lastVol=prevWeekW.reduce((s2,w)=>s2+w.exercises.reduce((es,ex)=>es+ex.sets.reduce((ss,st)=>ss+st.weight*st.reps,0),0),0);
    const ratio=lastVol>0?thisVol/lastVol:1;
    if(ratio>1.3){score-=10;factors.push({label:"Volume spike",val:`+${Math.round((ratio-1)*100)}%`,color:V.danger,pts:-10});}
    else if(ratio>1.1){score-=3;factors.push({label:"Volume up",val:`+${Math.round((ratio-1)*100)}%`,color:V.warn,pts:-3});}
    else if(ratio>=0.8){score+=5;factors.push({label:"Steady volume",val:"Balanced",color:V.accent,pts:5});}
    else{score+=0;factors.push({label:"Low volume",val:`${Math.round((ratio-1)*100)}%`,color:V.text3,pts:0});}
  }

  // 5. Self-report from check-in (0-20 pts)
  if(checkin){
    const avg=(checkin.soreness+checkin.energy+checkin.motivation)/3;
    const pts=Math.round(avg*4); // 1-5 scale → 4-20 pts
    score+=pts;
    const labels=["","Rough","Fair","Okay","Good","Excellent"];
    factors.push({label:"Self-report",val:labels[Math.round(avg)]||"--",color:avg>=4?V.accent:avg>=3?V.warn:V.danger,pts});
  }

  // 6. Nutrition adherence (+5 bonus)
  if(tn&&s.goals){
    const protPct=tn.protein/s.goals.protein;
    if(protPct>=0.8){score+=5;factors.push({label:"Protein on track",val:`${Math.round(protPct*100)}%`,color:V.accent,pts:5});}
  }

  score=Math.max(0,Math.min(100,score));

  // Determine readiness level + recommendation
  let level,color,rec;
  if(score>=80){level="Peak";color=V.accent;rec="Full intensity. Push for PRs.";}
  else if(score>=60){level="Ready";color=V.accent2;rec="Normal training. Follow your program.";}
  else if(score>=40){level="Moderate";color=V.warn;rec="Reduce volume 15-20%. Focus on technique.";}
  else if(score>=25){level="Fatigued";color="#f97316";rec="Light session or active recovery.";}
  else{level="Rest";color=V.danger;rec="Take a rest day. Recovery is gains.";}

  return{score:Math.round(score),level,color,rec,factors,hasCheckin:!!checkin};
}


// ─── Exercise → Muscle Mapping ───
const MUSCLE_MAP={
  // Chest
  bench:{primary:["chest"],secondary:["triceps","front_delts"]},
  incbench:{primary:["chest"],secondary:["triceps","front_delts"]},
  decbench:{primary:["chest"],secondary:["triceps"]},
  dbbench:{primary:["chest"],secondary:["triceps","front_delts"]},
  dbincbench:{primary:["chest"],secondary:["triceps","front_delts"]},
  flye:{primary:["chest"],secondary:[]},
  dbflye:{primary:["chest"],secondary:[]},
  dip:{primary:["chest"],secondary:["triceps","front_delts"]},
  pushup:{primary:["chest"],secondary:["triceps","front_delts"]},
  machpress:{primary:["chest"],secondary:["triceps"]},
  pecfly:{primary:["chest"],secondary:[]},
  svbench:{primary:["chest"],secondary:["triceps"]},
  closegrip:{primary:["triceps"],secondary:["chest"]},
  // Back
  deadlift:{primary:["back","hamstrings"],secondary:["glutes","core"]},
  row:{primary:["back"],secondary:["biceps"]},
  pullup:{primary:["back"],secondary:["biceps"]},
  latpull:{primary:["back"],secondary:["biceps"]},
  chinup:{primary:["back","biceps"],secondary:[]},
  cablerow:{primary:["back"],secondary:["biceps"]},
  dbrow:{primary:["back"],secondary:["biceps"]},
  tbarrow:{primary:["back"],secondary:["biceps"]},
  pendlay:{primary:["back"],secondary:["biceps"]},
  sumo:{primary:["back","glutes"],secondary:["hamstrings","quads"]},
  rdl:{primary:["hamstrings"],secondary:["back","glutes"]},
  hyperext:{primary:["back"],secondary:["hamstrings","glutes"]},
  straightarm:{primary:["back"],secondary:[]},
  meadows:{primary:["back"],secondary:["biceps"]},
  // Legs
  squat:{primary:["quads"],secondary:["glutes","hamstrings","core"]},
  legpress:{primary:["quads"],secondary:["glutes"]},
  lunge:{primary:["quads"],secondary:["glutes","hamstrings"]},
  frontsquat:{primary:["quads"],secondary:["core","glutes"]},
  bss:{primary:["quads"],secondary:["glutes"]},
  goblet:{primary:["quads"],secondary:["glutes","core"]},
  legext:{primary:["quads"],secondary:[]},
  hamcurl:{primary:["hamstrings"],secondary:[]},
  calfraise:{primary:["calves"],secondary:[]},
  hacksquat:{primary:["quads"],secondary:["glutes"]},
  stepup:{primary:["quads"],secondary:["glutes"]},
  hipthrust:{primary:["glutes"],secondary:["hamstrings"]},
  legcurl:{primary:["hamstrings"],secondary:[]},
  sldl:{primary:["hamstrings"],secondary:["back","glutes"]},
  sissy:{primary:["quads"],secondary:[]},
  // Shoulders
  ohp:{primary:["front_delts"],secondary:["triceps"]},
  dbohp:{primary:["front_delts"],secondary:["triceps"]},
  lateralraise:{primary:["side_delts"],secondary:[]},
  facepull:{primary:["rear_delts"],secondary:["back"]},
  shrug:{primary:["traps"],secondary:[]},
  reardelt:{primary:["rear_delts"],secondary:[]},
  arnoldpress:{primary:["front_delts","side_delts"],secondary:["triceps"]},
  uprow:{primary:["side_delts","traps"],secondary:[]},
  cablateral:{primary:["side_delts"],secondary:[]},
  landmine:{primary:["front_delts"],secondary:["triceps","core"]},
  dbshrug:{primary:["traps"],secondary:[]},
  frontraise:{primary:["front_delts"],secondary:[]},
  // Arms
  curl:{primary:["biceps"],secondary:[]},
  tricep:{primary:["triceps"],secondary:[]},
  hammercurl:{primary:["biceps"],secondary:[]},
  preacher:{primary:["biceps"],secondary:[]},
  skullcrusher:{primary:["triceps"],secondary:[]},
  ohtriext:{primary:["triceps"],secondary:[]},
  concurl:{primary:["biceps"],secondary:[]},
  cablecurl:{primary:["biceps"],secondary:[]},
  tridip:{primary:["triceps"],secondary:[]},
  revbarbell:{primary:["biceps"],secondary:[]},
  bayesian:{primary:["biceps"],secondary:[]},
  kickback:{primary:["triceps"],secondary:[]},
  spidercurl:{primary:["biceps"],secondary:[]},
  // Core
  plank:{primary:["core"],secondary:[]},
  crunch:{primary:["core"],secondary:[]},
  hangleg:{primary:["core"],secondary:[]},
  cablecrunch:{primary:["core"],secondary:[]},
  russiantwist:{primary:["core"],secondary:[]},
  abwheel:{primary:["core"],secondary:[]},
  woodchop:{primary:["core"],secondary:[]},
  deadbug:{primary:["core"],secondary:[]},
  pallof:{primary:["core"],secondary:[]},
  decline_sit:{primary:["core"],secondary:[]},
};

// All muscle groups for heat map
const ALL_MUSCLES=["chest","back","front_delts","side_delts","rear_delts","traps","biceps","triceps","quads","hamstrings","glutes","calves","core"];
const MUSCLE_LABELS={chest:"Chest",back:"Back",front_delts:"Front Delts",side_delts:"Side Delts",rear_delts:"Rear Delts",traps:"Traps",biceps:"Biceps",triceps:"Triceps",quads:"Quads",hamstrings:"Hamstrings",glutes:"Glutes",calves:"Calves",core:"Core"};


// ─── Progressive Overload Engine (Enhanced) ───
function getOverloadSuggestion(exerciseId, workouts, units){
  // Find last 3 sessions with this exercise
  const sessions=[];
  for(const w of workouts){
    const ex=w.exercises.find(e=>e.exerciseId===exerciseId);
    if(ex&&ex.sets.some(s=>s.weight>0)){sessions.push({date:w.date,sets:ex.sets});if(sessions.length>=3)break;}
  }
  if(sessions.length===0)return null;

  const latest=sessions[0];
  const bestSet=latest.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
  const w=parseFloat(bestSet.weight)||0;
  const r=parseInt(bestSet.reps)||0;
  if(w===0)return null;

  const e1rm=Math.round(w*(1+r/30));
  const inc=units==="kg"?2.5:5;
  const targetReps=8;

  // Check if all sets hit target reps
  const allSetsHit=latest.sets.every(st=>parseInt(st.reps)>=targetReps);
  // Check for failure pattern (last 2-3 sessions struggling)
  const failCount=sessions.filter(sess=>{
    const bst=sess.sets.reduce((m,st)=>parseFloat(st.weight)>parseFloat(m.weight)?st:m,{weight:0,reps:0});
    return parseInt(bst.reps)<targetReps-2;
  }).length;

  let type,sugWeight,sugReps,reason;
  if(failCount>=2){
    // Deload
    sugWeight=Math.round((w-inc*2)/inc)*inc;
    sugReps=targetReps;
    type="deload";
    reason="Struggling multiple sessions — deload to rebuild";
  }else if(allSetsHit){
    // Increase weight
    sugWeight=w+inc;
    sugReps=r;
    type="increase";
    reason="All sets completed — increase weight";
  }else if(r<targetReps-1){
    // Keep same, failed reps
    sugWeight=w;
    sugReps=targetReps;
    type="repeat";
    reason="Missed reps — repeat and aim higher";
  }else{
    // Keep same, almost there
    sugWeight=w;
    sugReps=r+1;
    type="reps";
    reason="Close to target — add a rep";
  }

  const zone80=Math.round(e1rm*0.80);
  const zone70=Math.round(e1rm*0.70);

  return{type,last:`${w}×${r}`,suggest:`${sugWeight}×${sugReps}`,e1rm,zone80,zone70,reason,
    allSets:latest.sets.map(st=>`${st.weight}×${st.reps}`).join("  "),date:sessions[0].date};
}


// ─── Muscle Heat Map Calculator ───
function calcMuscleHeat(workouts,exercises,days=10){
  const now=new Date();
  const scores={};
  ALL_MUSCLES.forEach(m=>{scores[m]=0;});

  workouts.forEach(w=>{
    const daysAgo=Math.max(0,(now-new Date(w.date))/(1000*60*60*24));
    if(daysAgo>days)return;
    const decay=Math.max(0,1-daysAgo/days);

    w.exercises.forEach(ex=>{
      const map=MUSCLE_MAP[ex.exerciseId];
      if(!map)return;
      const setCount=ex.sets.length;
      const volume=ex.sets.reduce((s,st)=>(parseFloat(st.weight)||0)*(parseInt(st.reps)||0)+s,0);
      const intensity=Math.min(1,volume/5000)+setCount*0.3;

      map.primary.forEach(m=>{scores[m]+=(intensity*3)*decay;});
      map.secondary.forEach(m=>{scores[m]+=(intensity*1.5)*decay;});
    });
  });

  // Normalize 0-10
  const mx=Math.max(...Object.values(scores),1);
  const norm={};
  ALL_MUSCLES.forEach(m=>{norm[m]=Math.min(10,Math.round(scores[m]/mx*10*10)/10);});
  return norm;
}

function getMuscleColor(score){
  if(score<=0.5)return"rgba(255,255,255,0.06)";
  if(score<=3)return"rgba(250,204,21,0.4)";   // yellow
  if(score<=6)return"rgba(0,245,160,0.5)";     // green
  if(score<=8)return"rgba(0,245,160,0.8)";     // bright green
  return"rgba(255,107,107,0.7)";                // red (high fatigue)
}

function getMuscleLabel(score){
  if(score<=0.5)return"Untrained";
  if(score<=3)return"Light";
  if(score<=6)return"Moderate";
  if(score<=8)return"Well Trained";
  return"High Volume";
}


// ─── Strength Score System ───
function calcStrengthScore(workouts,bodyWeight){
  const bw=parseFloat(bodyWeight)||180;
  const lifts={bench:0,squat:0,deadlift:0};

  // Find best e1RM for each lift
  workouts.forEach(w=>{
    w.exercises.forEach(ex=>{
      if(lifts.hasOwnProperty(ex.exerciseId)){
        ex.sets.forEach(st=>{
          const wt=parseFloat(st.weight)||0;
          const rp=parseInt(st.reps)||0;
          if(wt>0&&rp>0){
            const e1rm=Math.round(wt*(1+rp/30));
            lifts[ex.exerciseId]=Math.max(lifts[ex.exerciseId],e1rm);
          }
        });
      }
    });
  });

  const benchRatio=lifts.bench/bw;
  const squatRatio=lifts.squat/bw;
  const deadRatio=lifts.deadlift/bw;
  const score=benchRatio*0.30+squatRatio*0.35+deadRatio*0.35;

  let rank,rankColor;
  if(score<0.5){rank="Novice";rankColor=V.text3;}
  else if(score<1.0){rank="Beginner";rankColor=V.warn;}
  else if(score<1.5){rank="Intermediate";rankColor=V.accent2;}
  else if(score<2.0){rank="Advanced";rankColor=V.accent;}
  else{rank="Elite";rankColor=V.purple;}

  // Badges
  const badges=[];
  if(benchRatio>=1.5)badges.push({label:"Bench 1.5x BW",icon:"🏋️"});
  if(benchRatio>=2.0)badges.push({label:"Bench 2x BW",icon:"💎"});
  if(squatRatio>=2.0)badges.push({label:"Squat 2x BW",icon:"🦵"});
  if(squatRatio>=2.5)badges.push({label:"Squat 2.5x BW",icon:"👑"});
  if(deadRatio>=2.5)badges.push({label:"Dead 2.5x BW",icon:"🔥"});
  if(deadRatio>=3.0)badges.push({label:"Dead 3x BW",icon:"⚡"});
  if(score>=1.0)badges.push({label:"1000lb Club",icon:"🏆",cond:lifts.bench+lifts.squat+lifts.deadlift>=1000});

  return{score:Math.round(score*100)/100,rank,rankColor,lifts,benchRatio:Math.round(benchRatio*100)/100,
    squatRatio:Math.round(squatRatio*100)/100,deadRatio:Math.round(deadRatio*100)/100,
    badges:badges.filter(b=>b.cond===undefined||b.cond),total:lifts.bench+lifts.squat+lifts.deadlift,bw};
}


// ─── #1 Data Integrity Safeguards ───
function useDataGuard(s){
  return useMemo(()=>{
    const warnings=[];
    // Body weight outliers
    const bw=s.body.filter(b=>b.weight>0).sort((a,b)=>a.date.localeCompare(b.date));
    for(let i=1;i<bw.length;i++){
      const diff=Math.abs(bw[i].weight-bw[i-1].weight);
      if(diff>15){warnings.push({type:"body",severity:"high",msg:`Weight jump: ${bw[i-1].weight}→${bw[i].weight} (${diff>0?"+":""}${(bw[i].weight-bw[i-1].weight).toFixed(1)} ${s.units}) on ${bw[i].date}`,date:bw[i].date,id:bw[i].id});}
      else if(diff>8){warnings.push({type:"body",severity:"med",msg:`Unusual weight change: ${diff.toFixed(1)} ${s.units} on ${bw[i].date}`,date:bw[i].date,id:bw[i].id});}
    }
    // Workout weight outliers per exercise
    const exMap={};
    s.workouts.forEach(w=>w.exercises.forEach(ex=>{
      ex.sets.forEach(st=>{if(st.weight>0){if(!exMap[ex.exerciseId])exMap[ex.exerciseId]=[];exMap[ex.exerciseId].push({w:st.weight,date:w.date,id:w.id});}});
    }));
    Object.entries(exMap).forEach(([eid,entries])=>{
      if(entries.length<3)return;
      const avg=entries.reduce((s2,e)=>s2+e.w,0)/entries.length;
      const std=Math.sqrt(entries.reduce((s2,e)=>s2+Math.pow(e.w-avg,2),0)/entries.length);
      entries.forEach(e=>{
        if(Math.abs(e.w-avg)>std*2.5&&std>10){
          const name=s.exercises.find(x=>x.id===eid)?.name||eid;
          warnings.push({type:"workout",severity:"med",msg:`${name}: ${e.w} ${s.units} is unusual (avg: ${Math.round(avg)}) on ${e.date}`,date:e.date,id:e.id});
        }
      });
    });
    // Duplicate workout detection (same date, very similar exercises)
    const dateMap={};
    s.workouts.forEach(w=>{if(!dateMap[w.date])dateMap[w.date]=[];dateMap[w.date].push(w);});
    Object.entries(dateMap).forEach(([date,ws])=>{
      if(ws.length>1){
        for(let i=1;i<ws.length;i++){
          const exA=ws[0].exercises.map(e=>e.exerciseId).sort().join(",");
          const exB=ws[i].exercises.map(e=>e.exerciseId).sort().join(",");
          if(exA===exB)warnings.push({type:"duplicate",severity:"high",msg:`Duplicate workout on ${date} (same exercises)`,date,id:ws[i].id});
          else warnings.push({type:"duplicate",severity:"low",msg:`Multiple workouts on ${date}`,date,id:ws[i].id});
        }
      }
    });
    // Calorie sanity
    s.nutrition.forEach(n=>{
      if(n.cal>6000)warnings.push({type:"nutrition",severity:"med",msg:`${n.cal} cal on ${n.date} seems high`,date:n.date,id:n.id});
      if(n.cal>0&&n.cal<500)warnings.push({type:"nutrition",severity:"low",msg:`Only ${n.cal} cal on ${n.date}`,date:n.date,id:n.id});
      if(n.protein>400)warnings.push({type:"nutrition",severity:"med",msg:`${n.protein}g protein on ${n.date} seems high`,date:n.date,id:n.id});
    });
    return warnings.sort((a,b)=>{const sev={high:0,med:1,low:2};return(sev[a.severity]||2)-(sev[b.severity]||2);});
  },[s.workouts,s.body,s.nutrition,s.exercises,s.units]);
}
