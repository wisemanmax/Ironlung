import { uid, today, ago } from '../utils/helpers';
import { LS } from '../utils/storage';
import { WAR_EPOCH } from './ranks';

export function genDemo(){
  const w=[],n=[],b=[],checkins=[],photos=[],phases=[],injuries=[],milestones=[];

  // ── Configuration ──────────────────────────────────────────────
  // 365 days of history so every badge can fire
  // BW 182lbs. Targets: bench 400, squat 460, deadlift 530 → big3 = 1390 (1200 club ✓)
  // bench_2x=364, squat_2x=364, deadlift_2.5x=455 — all cleared
  const DAYS = 365;
  const BW = 182; // bodyweight for badge checks
  // Peak weights (hit at day 365 i.e. today)
  const PEAKS = {bench:405,squat:465,deadlift:535,ohp:185,row:235,pullup:BW,
    curl:65,tricep:100,legpress:560,latpull:200,rdl:315,facepull:120,cgbp:275,lunge:185};
  // Protein goal 180g — demo will hit it most days for macro badges
  const P_GOAL = 180;

  // Seeded pseudo-random so demo is deterministic
  let _seed = 20260307;
  const rng = () => { _seed = (_seed * 1664525 + 1013904223) & 0xffffffff; return ((_seed >>> 0) / 4294967296); };
  const ri = (min,max) => Math.floor(rng()*(max-min+1))+min;
  const rf = (min,max) => rng()*(max-min)+min;

  // Split days into training blocks (progression)
  // Days 365→1: ago(365) is oldest, ago(0) is today
  // We want a 60+ day consecutive streak ending today → train ago(0)..ago(63)
  // Earlier: train 5 of 7 days so total workouts ≈ 5/7*302 + 64 = 280 → well above 250

  const WORKOUT_NOTES = [
    "Felt strong today 💪","Tough session but pushed through","PR attempt day!",
    "Volume day — pump was insane","Deload week, keeping it easy","Back to 100%, felt great",
    "New PR! Couldn't believe it","Heavy singles today","High rep day, lungs burning",
    "Focused on form today","Pre-competition prep","Bodybuilding day — all the pumps",
  ];

  for(let i=DAYS;i>=0;i--){
    const date=ago(i);
    const progress = (DAYS-i)/DAYS; // 0 = oldest, 1 = today

    // ── Workouts ─────────────────────────────────────────────────
    // Last 64 days: train every day (streak_60 badge + war streak)
    // Before that: 5 of 7 days (rest on "i%7===0" and "i%7===4" slots)
    const isTrainingDay = i<=63 ? true : (i%7!==0 && i%7!==4);

    if(isTrainingDay){
      // Rotate through push/pull/legs/upper/lower splits
      const split = i%5;
      let exList;
      if(split===0) exList=["bench","ohp","tricep","cgbp"];          // Push
      else if(split===1) exList=["deadlift","row","latpull","rdl"];   // Pull
      else if(split===2) exList=["squat","legpress","lunge"];          // Legs
      else if(split===3) exList=["bench","row","ohp","pullup","curl"]; // Upper
      else               exList=["squat","deadlift","rdl","legpress"]; // Lower

      // Add cardio to some workouts (every 3rd day)
      const CARDIO_IDS=["treadmill","rowing","biking","stairmaster","elliptical"];
      if(split%3===0) exList.push(CARDIO_IDS[i%CARDIO_IDS.length]);

      const exs = exList.map(eid=>{
        // Cardio exercises use duration/distance
        const cardioIds=["treadmill","rowing","biking","stairmaster","elliptical","jumprope","battlerop","burpee","assaultbike","swimming","hiking","sprintinterval"];
        if(cardioIds.includes(eid)){
          const baseDur=Math.round(20+progress*20);
          const baseDist=parseFloat((1.5+progress*2.5+rf(-0.3,0.3)).toFixed(1));
          const sets=[{duration:baseDur+ri(-5,5),distance:parseFloat(baseDist.toFixed(1)),rpe:ri(6,9),done:true}];
          return{exerciseId:eid,sets,note:""};
        }
        const peak = PEAKS[eid]||100;
        // Progressive weights: start 55% of peak, reach 100% by today
        const base = Math.round(peak*(0.55 + progress*0.45));
        // Occasional PR breakthrough (last 20 days)
        const isPRDay = i<=20 && rng()<0.25;
        const topW = isPRDay ? Math.round(peak*(1+rng()*0.02)) : base;
        const numSets = ri(3,5);
        const sets = Array.from({length:numSets},(_,si)=>({
          weight: Math.max(45, Math.round(topW*(1-si*0.04)+(rng()*6-3))),
          reps: si===0 ? ri(1,5) : ri(5,10),
          rpe: ri(7,10), done:true,
          ...(si===0&&numSets>3?{warmup:false}:{})
        }));
        // Warm-up set for compound lifts
        const heavy = ["bench","squat","deadlift","ohp"];
        if(heavy.includes(eid) && numSets>=3){
          sets.unshift({weight:Math.round(topW*0.6),reps:5,rpe:6,done:true,warmup:true});
        }
        return{exerciseId:eid,sets,note:""};
      });

      w.push({
        id:uid(),date,dur:ri(45,90),rating:ri(3,5),
        exercises:exs,
        notes: rng()<0.35 ? WORKOUT_NOTES[ri(0,WORKOUT_NOTES.length-1)] : ""
      });
    }

    // ── Nutrition ──────────────────────────────────────────────
    // Hit protein goal ~85% of days → 310 days → well above macro_30 (30 days)
    // Last 30 days: hit every day for macro_7 streak badge
    const hitProtein = i<=30 ? true : rng()<0.82;
    const pr = hitProtein ? ri(P_GOAL, P_GOAL+40) : ri(120,P_GOAL-5);
    const ca = ri(200,320);
    const fa = ri(55,85);
    const cal = pr*4+ca*4+fa*9;
    const waterFromLog = ri(6,11);
    n.push({
      id:uid(),date,cal,protein:pr,carbs:ca,fat:fa,
      fiber:ri(18,35),water:waterFromLog,sleep:parseFloat((rf(6.0,8.5)).toFixed(1)),
      meals:[
        {name:"Breakfast",cal:Math.round(cal*.22),protein:Math.round(pr*.22),items:[
          {name:"Eggs & oats",cal:Math.round(cal*.22),protein:Math.round(pr*.22),unit:"serving",qty:1}]},
        {name:"Lunch",cal:Math.round(cal*.32),protein:Math.round(pr*.32),items:[
          {name:"Chicken & rice",cal:Math.round(cal*.32),protein:Math.round(pr*.32),unit:"serving",qty:1}]},
        {name:"Dinner",cal:Math.round(cal*.30),protein:Math.round(pr*.30),items:[
          {name:"Steak & veg",cal:Math.round(cal*.30),protein:Math.round(pr*.30),unit:"serving",qty:1}]},
        {name:"Snacks",cal:Math.round(cal*.16),protein:Math.round(pr*.16),items:[
          {name:"Protein shake",cal:150,protein:Math.round(pr*.16),unit:"serving",qty:1}]},
      ]
    });

    // ── Body Measurements ──────────────────────────────────────
    // Every 3-5 days; weight drops slightly (cut phase 300→200 days ago, then bulk)
    if(i%4===0 || i%7===0 || i===0){
      const phase_idx = i>300?0 : i>200?1 : i>100?2 : 3; // cut→maintain→bulk→cut
      const baseW = [192,186,184,181][phase_idx];
      const trend = [-.04,.01,.06,-.05][phase_idx];
      b.push({
        id:uid(),date,
        weight: parseFloat((BW + (i/DAYS)*(baseW-BW) + trend*(DAYS-i)/30 + rf(-0.8,0.8)).toFixed(1)),
        bf: parseFloat((18 - progress*5 + rf(-0.3,0.3)).toFixed(1)),
        chest: parseFloat((43 + progress*1.5 + rf(-0.2,0.2)).toFixed(1)),
        waist: parseFloat((34 - progress*1.2 + rf(-0.2,0.2)).toFixed(1)),
        arms: parseFloat((15.5 + progress*1.2 + rf(-0.1,0.1)).toFixed(1)),
        thighs: parseFloat((24 + progress*1.0 + rf(-0.1,0.1)).toFixed(1)),
        hips: parseFloat((38 + rf(-0.2,0.2)).toFixed(1)),
        calves: parseFloat((15 + progress*0.4 + rf(-0.1,0.1)).toFixed(1)),
        neck: parseFloat((15.5 + progress*0.2 + rf(-0.1,0.1)).toFixed(1)),
      });
    }

    // ── Check-ins ──────────────────────────────────────────────
    // Every day for last 60 days (checkin_7 badge), every 2-3 days before
    const doCheckin = i<=60 ? true : (i%3===0||i%5===0);
    if(doCheckin){
      const energy = ri(4,10);
      const soreness = ri(2,8);
      const motivation = ri(5,10);
      const hasNote = i%4===0 || i<=7;
      const NOTES_POOL = [
        "Feeling strong. Ready to push today.",
        "Bit tired but will push through.",
        "Legs are sore from yesterday's session.",
        "Great sleep last night. Energized.",
        "Stressed from work but training helps.",
        "Hit a new PR today! Hard work paying off.",
        "Recovery going well. Body feels great.",
        "Staying consistent. Progress is real.",
        "Meal prep done. Nutrition on point.",
        "Focused on building the habit, not just the body.",
      ];
      checkins.push({
        id:uid(),date,soreness,energy,motivation,
        sleep: parseFloat((rf(6.0,8.5)).toFixed(1)),
        notes: hasNote ? NOTES_POOL[ri(0,NOTES_POOL.length-1)] : "",
      });
    }

    // ── Progress Photos ──────────────────────────────────────
    // Every ~2 weeks → 26 photos total (photos_25 badge ✓)
    if(i%14===0 || i===0){
      // Use SVG placeholder as "photo data" — no real image needed for demo
      const phaseLabel = i>300?"Cut start":i>200?"Maintenance":i>100?"Bulk":i>50?"Late bulk":"Peak";
      const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
          <rect width="400" height="500" fill="#1a1a2e"/>
          <rect x="160" y="60" width="80" height="80" rx="40" fill="#00f5a0" opacity=".8"/>
          <rect x="140" y="160" width="120" height="160" rx="20" fill="#00f5a0" opacity=".6"/>
          <rect x="140" y="330" width="50" height="140" rx="12" fill="#00f5a0" opacity=".5"/>
          <rect x="210" y="330" width="50" height="140" rx="12" fill="#00f5a0" opacity=".5"/>
          <text x="200" y="490" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle">${phaseLabel} · ${date}</text>
        </svg>`
      )}`;
      photos.push({
        id:uid(),date,data:svg,note:`Week ${Math.floor((DAYS-i)/7)+1} — ${phaseLabel}`,
        size:svg.length,type:"photo",private:false
      });
    }
  }

  // ── Phases ──────────────────────────────────────────────────
  phases.push(
    {id:uid(),type:"cut",  start:ago(365),end:ago(250),notes:"Starting cut — targeting 5% bf reduction",active:false},
    {id:uid(),type:"bulk", start:ago(249),end:ago(120),notes:"Clean bulk — aim for +0.5lb/week",active:false},
    {id:uid(),type:"strength",start:ago(119),end:ago(60),notes:"Powerlifting prep — big 3 focus",active:false},
    {id:uid(),type:"cut",  start:ago(59),end:null,notes:"Final cut — competition prep",active:true}
  );

  // ── Injuries (1 resolved, 1 active) ─────────────────────────
  injuries.push(
    {id:uid(),joint:"shoulder",severity:"mild",notes:"Slight impingement from overuse. Reduced OHP load.",date:ago(180),active:false,resolved:ago(150)},
    {id:uid(),joint:"knee",severity:"mild",notes:"Minor patellar discomfort on deep squats. Monitoring.",date:ago(14),active:true}
  );

  // ── Milestones ───────────────────────────────────────────────
  milestones.push(
    {id:uid(),date:ago(300),text:"First workout logged! 🎉",type:"workout"},
    {id:uid(),date:ago(250),text:"Hit 50 workouts! 🥇",type:"milestone"},
    {id:uid(),date:ago(180),text:"1000lb Club — Big 3 over 1000! ⚡",type:"pr"},
    {id:uid(),date:ago(90),text:"100 workouts logged — Century Club 💪",type:"milestone"},
    {id:uid(),date:ago(30),text:"Bench 405lbs — new all-time PR 🏆",type:"pr"},
    {id:uid(),date:ago(7),text:"60-day streak! Diamond Streak badge unlocked 💎",type:"streak"},
  );

  // ── LS keys: gamification + social ──────────────────────────
  // XP bonus pool from missions, war wins, multipliers
  const xpLog = [];
  // Generate 60 days of mission rewards
  for(let i=60;i>=1;i--){
    const d2=ago(i);
    xpLog.push({date:d2,amount:ri(35,65),reason:"Daily Mission"});
    if(ri(0,2)===0) xpLog.push({date:d2,amount:30,reason:"All Missions Bonus"});
    if(i%7===0) xpLog.push({date:d2,amount:ri(50,150),reason:"XP Multiplier"});
    if(i%14===0) xpLog.push({date:d2,amount:100,reason:"Weekly War Victory 🏆"});
  }
  // Recent PR bonuses
  xpLog.unshift({date:ago(1),amount:60,reason:"PR Bonus (3 PRs)"});
  xpLog.unshift({date:today(),amount:65,reason:"Daily Mission"});
  const xpTotal = xpLog.reduce((a,e)=>a+e.amount,0);

  // Missions completed — last 14 days fully done
  const missionsCompleted = {};
  for(let i=14;i>=0;i--){
    const d2=ago(i);
    missionsCompleted[d2] = {m_workout:true,m_protein:true,m_meal:true,
      m_checkin:true,m_3exercises:true,__all_bonus:true};
  }

  // Set all LS keys
  LS.set("ft-xp-bonus",{total:xpTotal,log:xpLog.slice(0,100)});
  LS.set("ft-missions-completed",missionsCompleted);
  LS.set("ft-streak-shields",3);              // Max shields earned
  LS.set("ft-shield-awarded-streak",63);      // Last milestone was 63-day streak
  LS.set("ft-last-known-level",8);            // Pre-set level so no immediate level-up spam
  LS.set("ft-war-wins",8);                    // 8 weekly war wins
  LS.set("ft-war-streak",4);                  // Current 4-war win streak
  LS.set("ft-last-war-win",ago(7));
  LS.set("ft-war-claimed-"+Math.floor((Date.now()-WAR_EPOCH)/(7*86400000)),null); // This week claimable
  LS.set("ft-friend-count",4);               // social_3friends badge
  LS.set("ft-created-group",true);           // social_group badge
  LS.set("ft-reacted-today",today());        // m_react mission completable
  LS.set("ft-supps-logged",today());         // m_supps mission completable
  LS.set("ft-water-"+today(),10);            // m_water mission completable (10 cups)
  LS.set("ft-badge-dates",{early_adopter:ago(365)}); // seed early adopter date
  LS.set("ft-mission-celebrated",ago(1));   // prevent mission toast spam
  LS.set("ft-ironscore",null);               // force recalc

  return{workouts:w,nutrition:n,body:b,checkins,photos,phases,injuries,milestones};
}
