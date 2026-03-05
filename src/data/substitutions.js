const EXERCISE_SUBS={
  // Chest
  bench:["dbbench","machpress","svbench","pushup"],
  incbench:["dbincbench","svbench","pushup"],
  dbbench:["bench","machpress","pushup"],
  flye:["dbflye","pecfly","pushup"],
  dip:["pushup","machpress","bench"],
  // Back
  deadlift:["rdl","sumo","hyperext","sldl"],
  row:["dbrow","cablerow","tbarrow","pendlay"],
  pullup:["latpull","chinup","straightarm"],
  latpull:["pullup","chinup","straightarm"],
  // Legs
  squat:["legpress","goblet","frontsquat","hacksquat"],
  legpress:["squat","hacksquat","goblet","bss"],
  lunge:["bss","stepup","goblet"],
  // Shoulders
  ohp:["dbohp","arnoldpress","machpress"],
  lateralraise:["cablelt","machlt","reardelt"],
  // Arms
  curl:["hammercurl","preacher","spidercurl"],
  tricep:["skullcrusher","ohtriext","kickback","dip"],
};


const JOINT_MAP={
  shoulder:["ohp","dbohp","lateralraise","arnoldpress","bench","incbench","dip","pushup","facepull","reardelt","cablelt"],
  knee:["squat","frontsquat","hacksquat","legpress","lunge","bss","legext","stepup","goblet"],
  lower_back:["deadlift","sumo","rdl","sldl","row","pendlay","hyperext","squat"],
  elbow:["curl","hammercurl","preacher","tricep","skullcrusher","ohtriext","kickback","bench","ohp"],
  wrist:["bench","ohp","curl","deadlift","row","pushup"],
  hip:["squat","deadlift","hipthrust","lunge","bss","sumo","rdl"],
};


export { EXERCISE_SUBS, JOINT_MAP };
