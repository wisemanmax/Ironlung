// ─── Workout Templates ───
const TEMPLATES=[
  {name:"Push (PPL)",desc:"Chest, Shoulders, Triceps",exs:["bench","incbench","dbflye","ohp","lateralraise","tricep","skullcrusher"]},
  {name:"Pull (PPL)",desc:"Back, Biceps, Rear Delts",exs:["deadlift","pullup","cablerow","latpull","facepull","curl","hammercurl"]},
  {name:"Legs (PPL)",desc:"Quads, Hams, Glutes, Calves",exs:["squat","legpress","bss","hamcurl","hipthrust","calfraise"]},
  {name:"Chest Day",desc:"Full chest session",exs:["bench","incbench","dbbench","flye","pecfly","dip"]},
  {name:"Back Day",desc:"Full back session",exs:["deadlift","row","pullup","latpull","cablerow","dbrow"]},
  {name:"Shoulder Day",desc:"Delts & traps",exs:["ohp","dbohp","lateralraise","facepull","reardelt","shrug"]},
  {name:"Arm Day",desc:"Biceps & Triceps",exs:["curl","hammercurl","preacher","tricep","skullcrusher","ohtriext"]},
  {name:"Upper Body",desc:"Chest, back, shoulders, arms",exs:["bench","row","ohp","latpull","curl","tricep"]},
  {name:"Lower Body",desc:"Quads, hams, glutes",exs:["squat","rdl","legpress","hamcurl","hipthrust","calfraise"]},
  {name:"Full Body",desc:"Hit everything",exs:["squat","bench","row","ohp","curl","hangleg"]},
];

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


export { TEMPLATES };
export default TEMPLATES;
