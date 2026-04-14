import { LS } from '../utils/storage';
import { today, ago, calcStreak } from '../utils/helpers';

export const BADGE_DEFS=[
  {id:"streak_7",icon:"🔥",name:"On Fire",desc:"7-day workout streak",cat:"Consistency"},
  {id:"streak_14",icon:"💥",name:"Two Weeks Strong",desc:"14-day workout streak",cat:"Consistency"},
  {id:"streak_30",icon:"💎",name:"Diamond Streak",desc:"30-day workout streak",cat:"Consistency"},
  {id:"streak_60",icon:"👑",name:"60-Day Legend",desc:"60-day workout streak",cat:"Consistency"},
  {id:"workouts_10",icon:"🥉",name:"Getting Started",desc:"Log 10 workouts",cat:"Volume"},
  {id:"workouts_25",icon:"🥈",name:"Quarter Century",desc:"Log 25 workouts",cat:"Volume"},
  {id:"workouts_50",icon:"🥇",name:"Half Century",desc:"Log 50 workouts",cat:"Volume"},
  {id:"workouts_100",icon:"💪",name:"Century Club",desc:"Log 100 workouts",cat:"Volume"},
  {id:"workouts_250",icon:"🏆",name:"Iron Veteran",desc:"Log 250 workouts",cat:"Volume"},
  {id:"big3_500",icon:"⚡",name:"Power Starter",desc:"Big 3 total ≥ 500 lbs",cat:"Strength"},
  {id:"big3_800",icon:"🔩",name:"Iron Lifter",desc:"Big 3 total ≥ 800 lbs",cat:"Strength"},
  {id:"big3_1000",icon:"🏆",name:"1000lb Club",desc:"Big 3 total ≥ 1000 lbs",cat:"Strength"},
  {id:"big3_1200",icon:"🦾",name:"1200lb Club",desc:"Big 3 total ≥ 1200 lbs",cat:"Strength"},
  {id:"big3_1500",icon:"⚜️",name:"Elite Lifter",desc:"Big 3 total ≥ 1500 lbs",cat:"Strength"},
  {id:"bench_bw",icon:"🏋️",name:"Bench Body Weight",desc:"Bench press your body weight",cat:"Strength"},
  {id:"bench_15x",icon:"🔱",name:"Bench 1.5x BW",desc:"Bench 1.5× body weight",cat:"Strength"},
  {id:"bench_2x",icon:"👑",name:"Bench 2x BW",desc:"Bench 2× body weight",cat:"Strength"},
  {id:"squat_bw",icon:"🦵",name:"Squat Body Weight",desc:"Squat your body weight",cat:"Strength"},
  {id:"squat_2x",icon:"🦵",name:"Squat 2x BW",desc:"Squat 2× body weight",cat:"Strength"},
  {id:"deadlift_bw",icon:"💀",name:"Deadlift BW",desc:"Deadlift your body weight",cat:"Strength"},
  {id:"deadlift_2x",icon:"💀",name:"Deadlift 2x BW",desc:"Deadlift 2× body weight",cat:"Strength"},
  {id:"deadlift_25x",icon:"⚰️",name:"Deadlift 2.5x BW",desc:"Deadlift 2.5× body weight",cat:"Strength"},
  {id:"macro_7",icon:"⭐",name:"Macro Master",desc:"Hit protein target 7 days in a row",cat:"Nutrition"},
  {id:"macro_30",icon:"🌟",name:"Macro Legend",desc:"Hit protein target 30 days total",cat:"Nutrition"},
  {id:"photos_5",icon:"📸",name:"Photo Logger",desc:"Log 5 progress photos",cat:"Tracking"},
  {id:"photos_25",icon:"🎞️",name:"Visual Journey",desc:"Log 25 progress photos",cat:"Tracking"},
  {id:"social_3friends",icon:"👥",name:"Social Butterfly",desc:"Add 3 friends",cat:"Social"},
  {id:"social_group",icon:"🏅",name:"Group Leader",desc:"Create a group",cat:"Social"},
  {id:"checkin_7",icon:"✅",name:"Check-In Habit",desc:"Check in 7 days straight",cat:"Consistency"},
  {id:"early_adopter",icon:"🚀",name:"Early Adopter",desc:"One of the first IRONLOG users",cat:"Special"},
];
// Check which badges are earned given current state
export function calcEarnedBadges(s){
  const streak=calcStreak(s.workouts);
  // B12 fix: use most recent body entry (index 0, sorted desc) not oldest (last)
  const bw=parseFloat(s.profile?.currentWeight||s.body?.[0]?.weight)||180;
  const getBest=(id)=>{let b=0;(s.workouts||[]).forEach(w=>w.exercises.forEach(e=>{if(e.exerciseId===id)e.sets.forEach(st=>{const wt=parseFloat(st.weight)||0;if(wt>b)b=wt;});}));return b;};
  const bench=getBest("bench"),squat=getBest("squat"),dead=getBest("deadlift");
  const big3=bench+squat+dead;
  const protDaysTotal=(s.nutrition||[]).filter(n=>(n.protein||0)>=(s.goals?.protein||150)).length;
  const protStreak=(()=>{let c=0,i=0;while((s.nutrition||[]).some(n=>n.date===ago(i)&&(n.protein||0)>=(s.goals?.protein||150))){c++;i++;}return c;})();
  const photos=(s.photos||[]).length;
  const wCount=(s.workouts||[]).length;
  const friendCount=(LS.get("ft-friend-count")||0);
  const isGroupCreator=!!(LS.get("ft-created-group"));
  const checkinStreak=(()=>{let c=0,i=0;while((s.checkins||[]).some(ch=>ch.date===ago(i))){c++;i++;}return c;})();

  const checks={
    streak_7:streak>=7,streak_14:streak>=14,streak_30:streak>=30,streak_60:streak>=60,
    workouts_10:wCount>=10,workouts_25:wCount>=25,workouts_50:wCount>=50,workouts_100:wCount>=100,workouts_250:wCount>=250,
    big3_500:big3>=500,big3_800:big3>=800,big3_1000:big3>=1000,big3_1200:big3>=1200,big3_1500:big3>=1500,
    bench_bw:bw>0&&bench>=bw,bench_15x:bw>0&&bench>=bw*1.5,bench_2x:bw>0&&bench>=bw*2,
    squat_bw:bw>0&&squat>=bw,squat_2x:bw>0&&squat>=bw*2,
    deadlift_bw:bw>0&&dead>=bw,deadlift_2x:bw>0&&dead>=bw*2,deadlift_25x:bw>0&&dead>=bw*2.5,
    macro_7:protStreak>=7,macro_30:protDaysTotal>=30,
    photos_5:photos>=5,photos_25:photos>=25,
    social_3friends:friendCount>=3,social_group:isGroupCreator,
    checkin_7:checkinStreak>=7,
    early_adopter:wCount>=1, // everyone who has used the app gets this
  };
  // Persist earned dates
  const stored=LS.get("ft-badge-dates")||{};
  const todayStr=today();
  let changed=false;
  Object.entries(checks).forEach(([id,earned])=>{if(earned&&!stored[id]){stored[id]=todayStr;changed=true;}});
  if(changed)LS.set("ft-badge-dates",stored);
  return{checks,dates:stored};
}
