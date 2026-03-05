import { defaultExercises } from './data/exercises.js';
import { today } from './utils.js';

// ─── State ───
// schedule.weekly = {0:"Rest",1:"Chest",2:"Back",...} (day-of-week 0=Sun)
// schedule.overrides = {"2026-03-05":"Legs",...} (specific date overrides)
const defaultSchedule = {
  weekly:{0:"Rest",1:"Chest",2:"Back",3:"Legs",4:"Shoulders",5:"Arms",6:"Cardio"},
  overrides:{}
};
const init={tab:"home",workouts:[],nutrition:[],body:[],exercises:defaultExercises,
  goals:{cal:2400,protein:180,carbs:250,fat:70,goalWeight:175},schedule:defaultSchedule,
  range:30,loaded:false,modal:null,units:"lbs",onboarded:false,photos:[],checkins:[],milestones:[],
  phases:[],injuries:[],
  syncPrefs:{workouts:true,nutrition:true,body:true,photos:true,checkins:true,milestones:true},
  a11y:{largeText:false,highContrast:false,reduceMotion:false},
  profile:{firstName:"",lastName:"",nickname:"",email:"",dob:"",sex:"",state:"",
    height:"",fitnessLevel:"",activityLevel:"",weeklyAvailability:""}};

function reducer(s,a){
  switch(a.type){
    case "INIT": return{...s,...a.p,loaded:true};
    case "TAB": return{...s,tab:a.tab};
    case "RANGE": return{...s,range:a.d};
    case "MODAL": return{...s,modal:a.modal};
    case "ADD_W": return{...s,workouts:[a.w,...s.workouts].sort((a,b)=>b.date.localeCompare(a.date))};
    case "EDIT_W": return{...s,workouts:s.workouts.map(w=>w.id===a.w.id?{...a.w}:w)};
    case "DEL_W": return{...s,workouts:s.workouts.filter(w=>w.id!==a.id)};
    case "ADD_N": return{...s,nutrition:[...s.nutrition.filter(n=>n.date!==a.n.date),a.n].sort((a,b)=>b.date.localeCompare(a.date))};
    case "EDIT_N": return{...s,nutrition:s.nutrition.map(n=>n.id===a.n.id?{...a.n}:n)};
    case "DEL_N": return{...s,nutrition:s.nutrition.filter(n=>n.id!==a.id)};
    case "ADD_B": return{...s,body:[a.b,...s.body].sort((a,b)=>b.date.localeCompare(a.date))};
    case "EDIT_B": return{...s,body:s.body.map(b=>b.id===a.b.id?{...a.b}:b)};
    case "DEL_B": return{...s,body:s.body.filter(b=>b.id!==a.id)};
    case "GOALS": return{...s,goals:{...s.goals,...a.g}};
    case "ADD_EX": return{...s,exercises:[...s.exercises,a.ex]};
    case "SET_WEEKLY": return{...s,schedule:{...s.schedule,weekly:{...s.schedule.weekly,[a.day]:a.label}}};
    case "SET_OVERRIDE": {
      const ov={...s.schedule.overrides};
      if(a.label)ov[a.date]=a.label; else delete ov[a.date];
      return{...s,schedule:{...s.schedule,overrides:ov}};
    }
    case "SET_SCHEDULE": return{...s,schedule:a.schedule};
    case "UNITS": return{...s,units:a.u};
    case "ONBOARDED": return{...s,onboarded:true};
    case "SET_PROFILE": return{...s,profile:{...(s.profile||{}),...a.profile}};
    case "ADD_CHECKIN": return{...s,checkins:[a.c,...(s.checkins||[]).filter(c=>c.date!==a.c.date)]};
    case "SET_MILESTONES": return{...s,milestones:a.milestones||[]};
    case "SET_PHASES": return{...s,phases:a.phases||[]};
    case "SET_INJURIES": return{...s,injuries:a.injuries||[]};
    case "SET_SYNC_PREFS": return{...s,syncPrefs:{...(s.syncPrefs||{}),...a.prefs}};
    case "SET_A11Y": return{...s,a11y:{...(s.a11y||{}),...a.a11y}};
    case "ADD_PHOTO": return{...s,photos:[a.photo,...s.photos]};
    case "DEL_PHOTO": return{...s,photos:s.photos.filter(p=>p.id!==a.id)};
    case "CLEAR_ALL": return{...init,exercises:defaultExercises,loaded:true,onboarded:true,units:s.units,profile:s.profile};
    case "IMPORT": return{...s,...a.data,loaded:true};
    default: return s;
  }
}


export { defaultSchedule, init, reducer };
export default reducer;
