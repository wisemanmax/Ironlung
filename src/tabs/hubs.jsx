import React from 'react';
import { V } from '../utils/theme';
import { Icons } from '../components/Icons';

export function LogHub({s,d}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:20,fontWeight:800,color:V.text,marginBottom:4}}>What are you logging?</div>

      {[
        {id:"log_workout",icon:Icons.dumbbell,label:"Workout",desc:"Log sets, reps, weight & RPE",color:V.accent,
          sub:"Templates · Rest Timer · PR Tracking"},
        {id:"log_nutrition",icon:Icons.fork,label:"Nutrition",desc:"Log meals with 500+ food database",color:V.warn,
          sub:"Auto-calc macros · Water · Sleep"},
        {id:"log_body",icon:Icons.scale,label:"Body Metrics",desc:"Track weight, body fat & measurements",color:V.accent2,
          sub:"Weight · Body Fat · Chest · Waist · Arms"},
      ].map(item=>(
        <button key={item.id} onClick={()=>d({type:"TAB",tab:item.id})} style={{
          display:"flex",alignItems:"center",gap:16,padding:18,
          background:"rgba(255,255,255,0.02)",border:`1px solid ${V.cardBorder}`,borderRadius:16,
          cursor:"pointer",WebkitTapHighlightColor:"transparent",textAlign:"left",width:"100%",
        }}>
          <div style={{width:52,height:52,borderRadius:14,background:`${item.color}12`,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {item.icon({size:24,color:item.color})}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:700,color:V.text}}>{item.label}</div>
            <div style={{fontSize:12,color:V.text3,marginTop:2}}>{item.desc}</div>
            <div style={{fontSize:10,color:V.text3,marginTop:4,opacity:0.6}}>{item.sub}</div>
          </div>
          {Icons.chevRight({size:18,color:V.text3})}
        </button>
      ))}
    </div>
  );
}

export function SectionGrid({title,items,d}){
  return(
    <div>
      <div style={{fontSize:11,fontWeight:700,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",
        marginBottom:8,paddingLeft:2}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {items.map(item=>(
          <button key={item.id} onClick={()=>d({type:"TAB",tab:item.id})} style={{
            display:"flex",flexDirection:"column",alignItems:"flex-start",gap:8,padding:14,
            background:"rgba(255,255,255,0.02)",border:`1px solid ${item.badge>0?item.color+"40":V.cardBorder}`,borderRadius:14,
            cursor:"pointer",WebkitTapHighlightColor:"transparent",textAlign:"left",position:"relative",
          }}>
            {item.badge>0&&(
              <div style={{position:"absolute",top:10,right:10,minWidth:18,height:18,borderRadius:9,
                background:V.danger,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:9,fontWeight:800,color:"#fff",padding:"0 4px"}}>
                {item.badge>99?"99+":item.badge}
              </div>
            )}
            <div style={{width:36,height:36,borderRadius:10,background:`${item.color}12`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {item.icon({size:17,color:item.color})}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:V.text,lineHeight:1.2}}>{item.label}</div>
              <div style={{fontSize:10,color:V.text3,marginTop:2,lineHeight:1.3}}>{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrackHub({s,d}){
  const Section=({title,items})=><SectionGrid title={title} items={items} d={d}/>;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{fontSize:20,fontWeight:800,color:V.text}}>Your Data</div>

      <Section title="History & Logs" items={[
        {id:"track_workouts",icon:Icons.dumbbell,label:"Workouts",desc:"History, PRs & volume",color:V.accent},
        {id:"track_nutrition",icon:Icons.fork,label:"Nutrition",desc:"Macros & calories",color:V.warn},
        {id:"track_body",icon:Icons.scale,label:"Body",desc:"Weight & measurements",color:V.accent2},
        {id:"track_photos",icon:Icons.target,label:"Photos",desc:"Photos & videos",color:V.purple},
      ]}/>

      <Section title="Analytics" items={[
        {id:"track_readiness",icon:Icons.activity,label:"Readiness",desc:"Recovery & load",color:V.accent},
        {id:"track_analytics",icon:Icons.chart,label:"Analytics",desc:"Trends & charts",color:V.purple},
        {id:"track_exercise_chart",icon:Icons.activity,label:"Exercise Chart",desc:"Weight over time per exercise",color:V.accent},
        {id:"track_duration",icon:Icons.clock,label:"Duration",desc:"Workout length trends",color:"#f472b6"},
        {id:"track_volume",icon:Icons.dumbbell,label:"Volume",desc:"Sets per muscle group",color:"#06b6d4"},
        {id:"track_muscles",icon:Icons.activity,label:"Heat Map",desc:"Muscle balance",color:"#f97316"},
        {id:"track_strength",icon:Icons.trophy,label:"Strength",desc:"Score & rank",color:V.purple},
      ]}/>

      <Section title="Reports" items={[
        {id:"track_summary",icon:Icons.chart,label:"Weekly Report",desc:"Summary card",color:V.accent2},
        {id:"track_prs",icon:Icons.trophy,label:"PRs",desc:"All-time personal records",color:"#f59e0b"},
        {id:"track_compare",icon:Icons.target,label:"Compare",desc:"Before & after",color:V.purple},
      ]}/>
    </div>
  );
}

export function PlanHub({s,d}){
  const Section=({title,items})=><SectionGrid title={title} items={items} d={d}/>;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{fontSize:20,fontWeight:800,color:V.text}}>Plan Ahead</div>

      <Section title="Training" items={[
        {id:"plan_coach",icon:Icons.zap,label:"AI Coach",desc:"Today's program",color:V.accent2},
        {id:"plan_aichat",icon:Icons.activity,label:"AI Chat",desc:"Ask your coach anything",color:"#8b5cf6"},
        {id:"plan_programs",icon:Icons.calendar,label:"Programs",desc:"4-8 week plans",color:"#06b6d4"},
        {id:"plan_schedule",icon:Icons.calendar,label:"Schedule",desc:"Weekly plan & calendar",color:V.accent},
        {id:"plan_phases",icon:Icons.calendar,label:"Phases",desc:"Cut / bulk / strength",color:"#a78bfa"},
      ]}/>

      <Section title="Nutrition" items={[
        {id:"plan_mealplan",icon:Icons.fork,label:"Meal Plan",desc:"Auto-generated meals",color:"#f59e0b"},
        {id:"plan_fastfood",icon:Icons.fork,label:"Fast Food Hacks",desc:"57 macro-friendly meals",color:"#f97316"},
        {id:"plan_supplements",icon:Icons.plus,label:"Supplements",desc:"Daily checklist",color:"#10b981"},
      ]}/>

      <Section title="Tools" items={[
        {id:"plan_goals",icon:Icons.target,label:"Goals",desc:"Milestones & targets",color:"#f43f5e"},
        {id:"plan_onerm",icon:Icons.zap,label:"1RM Calc",desc:"Estimate max",color:V.warn},
        {id:"plan_injuries",icon:Icons.activity,label:"Injuries",desc:"Pain flags & subs",color:V.danger},
        {id:"plan_subs",icon:Icons.refresh,label:"Substitutions",desc:"Alt exercises",color:V.accent},
        {id:"plan_formcheck",icon:Icons.target,label:"Form Check",desc:"Record & review",color:"#f472b6"},
        {id:"plan_dataguard",icon:Icons.target,label:"Data Guard",desc:"Integrity check",color:V.warn},
      ]}/>
    </div>
  );
}
