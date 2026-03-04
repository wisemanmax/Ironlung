// IRONLOG Data Constants
// Extracted from index.html for modularity

const defaultExercises = [
  // ─── CHEST ───
  {id:"bench",name:"Bench Press",cat:"Chest",yt:"rT7DgCr-3pg"},
  {id:"incbench",name:"Incline Bench Press",cat:"Chest",yt:"SrqOu55lrYU"},
  {id:"decbench",name:"Decline Bench Press",cat:"Chest",yt:"LfyQBUKR8SE"},
  {id:"dbbench",name:"Dumbbell Bench Press",cat:"Chest",yt:"VmB1G1K7v94"},
  {id:"dbincbench",name:"Incline DB Press",cat:"Chest",yt:"8iPEnn-ltC8"},
  {id:"flye",name:"Cable Flye",cat:"Chest",yt:"Iwe6AmxVf7o"},
  {id:"dbflye",name:"Dumbbell Flye",cat:"Chest",yt:"eozdVDA78K0"},
  {id:"dip",name:"Dips",cat:"Chest",yt:"2z8JmcrW-As"},
  {id:"pushup",name:"Push-ups",cat:"Chest",yt:"IODxDxX7oi4"},
  {id:"machpress",name:"Machine Chest Press",cat:"Chest",yt:"xUm0BiZCWlQ"},
  {id:"pecfly",name:"Pec Deck Fly",cat:"Chest",yt:"eGjt4lk6g34"},
  {id:"svbench",name:"Smith Machine Bench",cat:"Chest",yt:"MlynOMecraM"},

  // ─── BACK ───
  {id:"deadlift",name:"Deadlift",cat:"Back",yt:"XxWcirHIwVo"},
  {id:"row",name:"Barbell Row",cat:"Back",yt:"FWJR5Ve8bnQ"},
  {id:"pullup",name:"Pull-ups",cat:"Back",yt:"eGo4IYlbE5g"},
  {id:"latpull",name:"Lat Pulldown",cat:"Back",yt:"CAwf7n6Luuc"},
  {id:"chinup",name:"Chin-ups",cat:"Back",yt:"brhRXlOhWI8"},
  {id:"cablerow",name:"Seated Cable Row",cat:"Back",yt:"GZbfZ033f74"},
  {id:"dbrow",name:"Dumbbell Row",cat:"Back",yt:"roCP6wCXPqo"},
  {id:"tbarrow",name:"T-Bar Row",cat:"Back",yt:"j3Igk5nyZE4"},
  {id:"pendlay",name:"Pendlay Row",cat:"Back",yt:"V8dZ3pyiCBo"},
  {id:"sumo",name:"Sumo Deadlift",cat:"Back",yt:"widGEAcQuGI"},
  {id:"rdl",name:"Romanian Deadlift",cat:"Back",yt:"7AaaYBqMFJg"},
  {id:"hyperext",name:"Hyperextension",cat:"Back",yt:"ph3pddpKzzw"},
  {id:"straightarm",name:"Straight Arm Pulldown",cat:"Back",yt:"AjCCGN2kE_A"},
  {id:"meadows",name:"Meadows Row",cat:"Back",yt:"vSPHMcJxMOs"},

  // ─── LEGS ───
  {id:"squat",name:"Barbell Squat",cat:"Legs",yt:"bEv6CCg2BC8"},
  {id:"legpress",name:"Leg Press",cat:"Legs",yt:"IZxyjW7MPJQ"},
  {id:"lunge",name:"Lunges",cat:"Legs",yt:"QOVaHwm-Q6U"},
  {id:"frontsquat",name:"Front Squat",cat:"Legs",yt:"m4ytaCJZpl0"},
  {id:"bss",name:"Bulgarian Split Squat",cat:"Legs",yt:"2C-uNgKwPLE"},
  {id:"goblet",name:"Goblet Squat",cat:"Legs",yt:"MeIiIdhvXT4"},
  {id:"legext",name:"Leg Extension",cat:"Legs",yt:"YyvSfVjQeL0"},
  {id:"hamcurl",name:"Hamstring Curl",cat:"Legs",yt:"1Tq3QdYUuHs"},
  {id:"calfraise",name:"Calf Raise",cat:"Legs",yt:"-M4-G8p8fmc"},
  {id:"hacksquat",name:"Hack Squat",cat:"Legs",yt:"EdtaJRBqwes"},
  {id:"stepup",name:"Step Ups",cat:"Legs",yt:"dQqApCGd5Ag"},
  {id:"hipthrust",name:"Hip Thrust",cat:"Legs",yt:"SEdqd1n0icg"},
  {id:"legcurl",name:"Seated Leg Curl",cat:"Legs",yt:"Orxowest56U"},
  {id:"sldl",name:"Stiff-Leg Deadlift",cat:"Legs",yt:"CN_7cz3P-1U"},
  {id:"sissy",name:"Sissy Squat",cat:"Legs",yt:"q_Q5s5HkJho"},

  // ─── SHOULDERS ───
  {id:"ohp",name:"Overhead Press",cat:"Shoulders",yt:"2yjwXTZQDDI"},
  {id:"dbohp",name:"DB Shoulder Press",cat:"Shoulders",yt:"qEwKCR5JCog"},
  {id:"lateralraise",name:"Lateral Raise",cat:"Shoulders",yt:"3VcKaXpzqRo"},
  {id:"facepull",name:"Face Pull",cat:"Shoulders",yt:"rep-qVOkqgk"},
  {id:"shrug",name:"Barbell Shrug",cat:"Shoulders",yt:"cJRVVxmytaM"},
  {id:"reardelt",name:"Rear Delt Fly",cat:"Shoulders",yt:"EA7u4Q_8HQ0"},
  {id:"arnoldpress",name:"Arnold Press",cat:"Shoulders",yt:"6Z15_WdXmVw"},
  {id:"uprow",name:"Upright Row",cat:"Shoulders",yt:"amCU-ziHITM"},
  {id:"cablateral",name:"Cable Lateral Raise",cat:"Shoulders",yt:"PPrzBWZDOhA"},
  {id:"landmine",name:"Landmine Press",cat:"Shoulders",yt:"Oy8n_RKOhMc"},
  {id:"dbshrug",name:"Dumbbell Shrug",cat:"Shoulders",yt:"g6qbq4Lf1FI"},
  {id:"frontraise",name:"Front Raise",cat:"Shoulders",yt:"-t7fuZ0KhDA"},

  // ─── ARMS ───
  {id:"curl",name:"Bicep Curl",cat:"Arms",yt:"ykJmrZ5v0Oo"},
  {id:"tricep",name:"Tricep Pushdown",cat:"Arms",yt:"2-LAMcpzODU"},
  {id:"hammercurl",name:"Hammer Curl",cat:"Arms",yt:"zC3nLlEvin4"},
  {id:"preacher",name:"Preacher Curl",cat:"Arms",yt:"fIWP-FRFNU0"},
  {id:"skullcrusher",name:"Skull Crushers",cat:"Arms",yt:"d_KZxkY_0cM"},
  {id:"ohtriext",name:"Overhead Tricep Extension",cat:"Arms",yt:"_gsUck-7M74"},
  {id:"concurl",name:"Concentration Curl",cat:"Arms",yt:"0AUGkch3tzc"},
  {id:"cablecurl",name:"Cable Curl",cat:"Arms",yt:"NFzpMJ4kcSI"},
  {id:"tridip",name:"Tricep Dip (Bench)",cat:"Arms",yt:"6kALZikXxLc"},
  {id:"revbarbell",name:"Reverse Barbell Curl",cat:"Arms",yt:"nRgxYX2Ve9w"},
  {id:"bayesian",name:"Bayesian Curl",cat:"Arms",yt:"3uFI7IOwrqQ"},
  {id:"closegrip",name:"Close-Grip Bench Press",cat:"Arms",yt:"nEF0bv2FW94"},
  {id:"kickback",name:"Tricep Kickback",cat:"Arms",yt:"6SS6K3lAwZ8"},
  {id:"spidercurl",name:"Spider Curl",cat:"Arms",yt:"iowFPuJYiOA"},

  // ─── CORE ───
  {id:"plank",name:"Plank",cat:"Core",yt:"pvIjsG5Svck"},
  {id:"crunch",name:"Crunches",cat:"Core",yt:"Xyd_fa5zoEU"},
  {id:"hangleg",name:"Hanging Leg Raise",cat:"Core",yt:"Pr1ieGZ5u4E"},
  {id:"cablecrunch",name:"Cable Crunch",cat:"Core",yt:"AV5PmrIVgDI"},
  {id:"russiantwist",name:"Russian Twist",cat:"Core",yt:"wkD8rjkodUI"},
  {id:"abwheel",name:"Ab Wheel Rollout",cat:"Core",yt:"rqiTPmI85nM"},
  {id:"woodchop",name:"Cable Woodchop",cat:"Core",yt:"pAplQXk3dkU"},
  {id:"deadbug",name:"Dead Bug",cat:"Core",yt:"4XLEnwUr1d8"},
  {id:"pallof",name:"Pallof Press",cat:"Core",yt:"AH_QZLm_0-s"},
  {id:"decline_sit",name:"Decline Sit-up",cat:"Core",yt:"hhj5_Uy3GfU"},

  // ─── CARDIO ───
  {id:"treadmill",name:"Treadmill Run",cat:"Cardio",yt:"8_zHaUL_kSE"},
  {id:"rowing",name:"Rowing Machine",cat:"Cardio",yt:"EYngSUMYfKQ"},
  {id:"stairmaster",name:"Stairmaster",cat:"Cardio",yt:"O4Fkflfvyac"},
  {id:"biking",name:"Stationary Bike",cat:"Cardio",yt:"0TM8HOIA7_Q"},
  {id:"jumprope",name:"Jump Rope",cat:"Cardio",yt:"FJmRQ5iTXKE"},
  {id:"elliptical",name:"Elliptical",cat:"Cardio",yt:"oMzNoRldjEM"},
  {id:"battlerop",name:"Battle Ropes",cat:"Cardio",yt:"4nW4MYnGfyY"},
  {id:"burpee",name:"Burpees",cat:"Cardio",yt:"dZgVxmf6jkA"},
];

// ─── Food Database (500+ items with macros) ───
const FOODS=[
  // Proteins
  {n:"Chicken Breast (4oz)",cal:187,p:35,c:0,f:4,cat:"Protein"},{n:"Chicken Thigh (4oz)",cal:232,p:28,c:0,f:13,cat:"Protein"},
  {n:"Ground Turkey (4oz)",cal:170,p:21,c:0,f:9,cat:"Protein"},{n:"Ground Beef 90/10 (4oz)",cal:200,p:22,c:0,f:11,cat:"Protein"},
  {n:"Ground Beef 80/20 (4oz)",cal:280,p:20,c:0,f:23,cat:"Protein"},{n:"Steak Sirloin (6oz)",cal:276,p:46,c:0,f:9,cat:"Protein"},
  {n:"Steak Ribeye (6oz)",cal:390,p:39,c:0,f:25,cat:"Protein"},{n:"Salmon Fillet (4oz)",cal:233,p:25,c:0,f:14,cat:"Protein"},
  {n:"Tuna Canned (1 can)",cal:120,p:27,c:0,f:1,cat:"Protein"},{n:"Shrimp (4oz)",cal:120,p:23,c:1,f:2,cat:"Protein"},
  {n:"Tilapia (4oz)",cal:110,p:23,c:0,f:2,cat:"Protein"},{n:"Cod (4oz)",cal:93,p:20,c:0,f:1,cat:"Protein"},
  {n:"Pork Chop (4oz)",cal:187,p:30,c:0,f:7,cat:"Protein"},{n:"Pork Tenderloin (4oz)",cal:136,p:23,c:0,f:4,cat:"Protein"},
  {n:"Bacon (3 slices)",cal:129,p:9,c:0,f:10,cat:"Protein"},{n:"Turkey Bacon (3 slices)",cal:90,p:10,c:0,f:5,cat:"Protein"},
  {n:"Egg (1 large)",cal:72,p:6,c:0,f:5,cat:"Protein"},{n:"Egg Whites (3 large)",cal:51,p:11,c:0,f:0,cat:"Protein"},
  {n:"Tofu Firm (4oz)",cal:88,p:10,c:2,f:5,cat:"Protein"},{n:"Tempeh (4oz)",cal:222,p:21,c:8,f:13,cat:"Protein"},
  {n:"Turkey Breast Deli (3oz)",cal:90,p:18,c:1,f:1,cat:"Protein"},{n:"Ham Deli (3oz)",cal:90,p:14,c:2,f:3,cat:"Protein"},
  {n:"Beef Jerky (1oz)",cal:116,p:9,c:3,f:7,cat:"Protein"},{n:"Bison (4oz)",cal:166,p:24,c:0,f:7,cat:"Protein"},
  {n:"Lamb (4oz)",cal:250,p:26,c:0,f:16,cat:"Protein"},{n:"Duck Breast (4oz)",cal:180,p:23,c:0,f:9,cat:"Protein"},
  // Dairy
  {n:"Whole Milk (1 cup)",cal:149,p:8,c:12,f:8,cat:"Dairy"},{n:"2% Milk (1 cup)",cal:122,p:8,c:12,f:5,cat:"Dairy"},
  {n:"Skim Milk (1 cup)",cal:83,p:8,c:12,f:0,cat:"Dairy"},{n:"Greek Yogurt Plain (1 cup)",cal:130,p:22,c:8,f:0,cat:"Dairy"},
  {n:"Greek Yogurt Honey (1 cup)",cal:190,p:18,c:25,f:3,cat:"Dairy"},{n:"Cottage Cheese (1 cup)",cal:206,p:28,c:8,f:9,cat:"Dairy"},
  {n:"Cottage Cheese Low-Fat (1 cup)",cal:163,p:28,c:6,f:2,cat:"Dairy"},{n:"Cheddar Cheese (1oz)",cal:113,p:7,c:0,f:9,cat:"Dairy"},
  {n:"Mozzarella (1oz)",cal:85,p:6,c:1,f:6,cat:"Dairy"},{n:"Cream Cheese (2 tbsp)",cal:99,p:2,c:1,f:10,cat:"Dairy"},
  {n:"String Cheese (1 stick)",cal:80,p:7,c:1,f:6,cat:"Dairy"},{n:"Butter (1 tbsp)",cal:102,p:0,c:0,f:12,cat:"Dairy"},
  {n:"Heavy Cream (2 tbsp)",cal:100,p:1,c:1,f:11,cat:"Dairy"},{n:"Whey Protein Scoop",cal:120,p:24,c:3,f:1,cat:"Dairy"},
  {n:"Casein Protein Scoop",cal:120,p:24,c:4,f:1,cat:"Dairy"},
  // Grains
  {n:"White Rice (1 cup cooked)",cal:206,p:4,c:45,f:0,cat:"Grains"},{n:"Brown Rice (1 cup cooked)",cal:216,p:5,c:45,f:2,cat:"Grains"},
  {n:"Quinoa (1 cup cooked)",cal:222,p:8,c:39,f:4,cat:"Grains"},{n:"Oatmeal (1/2 cup dry)",cal:150,p:5,c:27,f:3,cat:"Grains"},
  {n:"Oatmeal Instant (1 packet)",cal:130,p:4,c:23,f:3,cat:"Grains"},{n:"Pasta (2oz dry)",cal:200,p:7,c:42,f:1,cat:"Grains"},
  {n:"Whole Wheat Pasta (2oz dry)",cal:180,p:8,c:39,f:1,cat:"Grains"},{n:"Bread White (1 slice)",cal:67,p:2,c:13,f:1,cat:"Grains"},
  {n:"Bread Whole Wheat (1 slice)",cal:81,p:4,c:14,f:1,cat:"Grains"},{n:"Bagel (1 medium)",cal:245,p:9,c:48,f:1,cat:"Grains"},
  {n:"English Muffin",cal:132,p:5,c:26,f:1,cat:"Grains"},{n:"Tortilla Flour (10in)",cal:218,p:6,c:36,f:5,cat:"Grains"},
  {n:"Tortilla Corn (6in)",cal:52,p:1,c:11,f:1,cat:"Grains"},{n:"Sweet Potato (1 medium)",cal:103,p:2,c:24,f:0,cat:"Grains"},
  {n:"Potato (1 medium)",cal:161,p:4,c:37,f:0,cat:"Grains"},{n:"Granola (1/2 cup)",cal:210,p:5,c:30,f:8,cat:"Grains"},
  // Fruits
  {n:"Banana (1 medium)",cal:105,p:1,c:27,f:0,cat:"Fruits"},{n:"Apple (1 medium)",cal:95,p:0,c:25,f:0,cat:"Fruits"},
  {n:"Orange (1 medium)",cal:62,p:1,c:15,f:0,cat:"Fruits"},{n:"Strawberries (1 cup)",cal:49,p:1,c:12,f:0,cat:"Fruits"},
  {n:"Blueberries (1 cup)",cal:84,p:1,c:21,f:0,cat:"Fruits"},{n:"Grapes (1 cup)",cal:104,p:1,c:27,f:0,cat:"Fruits"},
  {n:"Watermelon (1 cup)",cal:46,p:1,c:12,f:0,cat:"Fruits"},{n:"Mango (1 cup)",cal:99,p:1,c:25,f:1,cat:"Fruits"},
  {n:"Pineapple (1 cup)",cal:82,p:1,c:22,f:0,cat:"Fruits"},{n:"Avocado (1/2)",cal:120,p:1,c:6,f:11,cat:"Fruits"},
  {n:"Raspberries (1 cup)",cal:64,p:1,c:15,f:1,cat:"Fruits"},{n:"Peach (1 medium)",cal:59,p:1,c:14,f:0,cat:"Fruits"},
  // Veggies
  {n:"Broccoli (1 cup)",cal:55,p:4,c:11,f:1,cat:"Veggies"},{n:"Spinach (2 cups raw)",cal:14,p:2,c:2,f:0,cat:"Veggies"},
  {n:"Carrots (1 cup)",cal:52,p:1,c:12,f:0,cat:"Veggies"},{n:"Bell Pepper (1 medium)",cal:31,p:1,c:6,f:0,cat:"Veggies"},
  {n:"Asparagus (6 spears)",cal:20,p:2,c:4,f:0,cat:"Veggies"},{n:"Green Beans (1 cup)",cal:31,p:2,c:7,f:0,cat:"Veggies"},
  {n:"Zucchini (1 medium)",cal:33,p:2,c:6,f:1,cat:"Veggies"},{n:"Cauliflower (1 cup)",cal:27,p:2,c:5,f:0,cat:"Veggies"},
  {n:"Corn (1 ear)",cal:88,p:3,c:19,f:1,cat:"Veggies"},{n:"Mushrooms (1 cup)",cal:15,p:2,c:2,f:0,cat:"Veggies"},
  // Nuts
  {n:"Almonds (1oz)",cal:164,p:6,c:6,f:14,cat:"Nuts"},{n:"Peanuts (1oz)",cal:161,p:7,c:5,f:14,cat:"Nuts"},
  {n:"Cashews (1oz)",cal:157,p:5,c:9,f:12,cat:"Nuts"},{n:"Walnuts (1oz)",cal:185,p:4,c:4,f:18,cat:"Nuts"},
  {n:"Peanut Butter (2 tbsp)",cal:188,p:8,c:6,f:16,cat:"Nuts"},{n:"Almond Butter (2 tbsp)",cal:196,p:7,c:6,f:18,cat:"Nuts"},
  {n:"Trail Mix (1/4 cup)",cal:173,p:5,c:16,f:11,cat:"Nuts"},{n:"Chia Seeds (2 tbsp)",cal:140,p:5,c:12,f:9,cat:"Nuts"},
  // Snacks
  {n:"Protein Bar (avg)",cal:230,p:20,c:25,f:8,cat:"Snacks"},{n:"Granola Bar",cal:140,p:3,c:23,f:5,cat:"Snacks"},
  {n:"Rice Cakes (2)",cal:70,p:2,c:15,f:0,cat:"Snacks"},{n:"Chips (1oz)",cal:152,p:2,c:15,f:10,cat:"Snacks"},
  {n:"Popcorn (3 cups air)",cal:93,p:3,c:19,f:1,cat:"Snacks"},{n:"Dark Chocolate (1oz)",cal:170,p:2,c:13,f:12,cat:"Snacks"},
  {n:"Hummus (2 tbsp)",cal:50,p:2,c:4,f:3,cat:"Snacks"},{n:"Pretzels (1oz)",cal:108,p:3,c:23,f:1,cat:"Snacks"},
  // Drinks
  {n:"Black Coffee",cal:2,p:0,c:0,f:0,cat:"Drinks"},{n:"Coffee w/ Cream & Sugar",cal:80,p:1,c:10,f:4,cat:"Drinks"},
  {n:"Latte (16oz)",cal:190,p:10,c:18,f:7,cat:"Drinks"},{n:"Orange Juice (8oz)",cal:112,p:2,c:26,f:0,cat:"Drinks"},
  {n:"Protein Shake",cal:200,p:30,c:12,f:4,cat:"Drinks"},{n:"Smoothie Fruit (16oz)",cal:260,p:4,c:60,f:2,cat:"Drinks"},
  {n:"Gatorade (20oz)",cal:140,p:0,c:36,f:0,cat:"Drinks"},{n:"Soda (12oz)",cal:140,p:0,c:39,f:0,cat:"Drinks"},
  {n:"Diet Soda (12oz)",cal:0,p:0,c:0,f:0,cat:"Drinks"},{n:"Beer (12oz)",cal:153,p:2,c:13,f:0,cat:"Drinks"},
  {n:"Wine Red (5oz)",cal:125,p:0,c:4,f:0,cat:"Drinks"},
  // Meals / Fast Food
  {n:"Chipotle Chicken Bowl",cal:665,p:49,c:41,f:24,cat:"Meals"},{n:"Chipotle Burrito",cal:1010,p:56,c:108,f:37,cat:"Meals"},
  {n:"Chick-fil-A Sandwich",cal:440,p:28,c:40,f:19,cat:"Meals"},{n:"Chick-fil-A Nuggets (12)",cal:380,p:40,c:14,f:18,cat:"Meals"},
  {n:"Big Mac",cal:550,p:25,c:45,f:30,cat:"Meals"},{n:"McChicken",cal:400,p:14,c:40,f:21,cat:"Meals"},
  {n:"Subway 6\" Turkey",cal:280,p:18,c:40,f:4,cat:"Meals"},{n:"Pizza Slice (cheese)",cal:285,p:12,c:36,f:10,cat:"Meals"},
  {n:"Pizza Slice (pepperoni)",cal:313,p:13,c:35,f:13,cat:"Meals"},{n:"Burger (homemade)",cal:450,p:28,c:30,f:24,cat:"Meals"},
  {n:"Grilled Chicken Salad",cal:350,p:35,c:12,f:18,cat:"Meals"},{n:"Spaghetti & Meatballs",cal:520,p:25,c:55,f:21,cat:"Meals"},
  {n:"Stir Fry Chicken & Rice",cal:480,p:32,c:52,f:14,cat:"Meals"},{n:"Tacos (3 beef)",cal:510,p:24,c:42,f:27,cat:"Meals"},
  {n:"Pad Thai",cal:540,p:20,c:62,f:22,cat:"Meals"},{n:"Fried Rice Chicken",cal:450,p:18,c:58,f:16,cat:"Meals"},
  {n:"Caesar Salad w/ Chicken",cal:390,p:32,c:14,f:24,cat:"Meals"},{n:"Poke Bowl Salmon",cal:520,p:35,c:48,f:18,cat:"Meals"},
  // Sauces
  {n:"Olive Oil (1 tbsp)",cal:119,p:0,c:0,f:14,cat:"Sauces"},{n:"Ketchup (1 tbsp)",cal:20,p:0,c:5,f:0,cat:"Sauces"},
  {n:"Mayo (1 tbsp)",cal:94,p:0,c:0,f:10,cat:"Sauces"},{n:"Ranch (2 tbsp)",cal:129,p:0,c:2,f:13,cat:"Sauces"},
  {n:"BBQ Sauce (2 tbsp)",cal:70,p:0,c:17,f:0,cat:"Sauces"},{n:"Honey (1 tbsp)",cal:64,p:0,c:17,f:0,cat:"Sauces"},
  {n:"Hot Sauce (1 tsp)",cal:1,p:0,c:0,f:0,cat:"Sauces"},{n:"Soy Sauce (1 tbsp)",cal:9,p:1,c:1,f:0,cat:"Sauces"},
  // Legumes
  {n:"Black Beans (1/2 cup)",cal:114,p:8,c:20,f:0,cat:"Legumes"},{n:"Chickpeas (1/2 cup)",cal:134,p:7,c:22,f:2,cat:"Legumes"},
  {n:"Lentils (1/2 cup)",cal:115,p:9,c:20,f:0,cat:"Legumes"},{n:"Edamame (1/2 cup)",cal:95,p:9,c:7,f:4,cat:"Legumes"},
];
const FOOD_CATS=["All",...new Set(FOODS.map(f=>f.cat))];

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


const defaultSchedule = {
  weekly:{0:"Rest",1:"Chest",2:"Back",3:"Legs",4:"Shoulders",5:"Arms",6:"Cardio"},
  overrides:{}
};

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
