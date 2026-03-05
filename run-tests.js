#!/usr/bin/env node
// IRONLOG CI Test Runner
// Run: node tests/run-tests.js
// Exit code 0 = all pass, 1 = failures

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load and execute modules in global context so const/function are accessible
const dataCode = fs.readFileSync(path.join(__dirname, 'ironlog-data.js'), 'utf8');
const logicCode = fs.readFileSync(path.join(__dirname, 'ironlog-logic.js'), 'utf8');

// Replace const/function with var so they land in global scope via vm
const toGlobal = (code) => code
  .replace(/^const /gm, 'var ')
  .replace(/^function /gm, 'global.$NEXT=function ').replace(/global\.\$NEXT=/g, '') // keep functions as-is
  .replace(/^const /gm, 'var ');

// Replace const/function with var for global scope, add stubs
vm.runInThisContext(dataCode.replace(/^const /gm, 'var '));
// Stub V (CSS variables) before logic module
vm.runInThisContext(`var V = {accent:"#00f5a0",accent2:"#00d9f5",warn:"#ff9f43",danger:"#ff6b6b",purple:"#a78bfa",text:"#e8e8ec",text2:"#8b8b9e",text3:"#4a4a5c"};`);
vm.runInThisContext(logicCode.replace(/^const /gm, 'var '));

// ─── Test Framework ───
let pass = 0, fail = 0, errors = [];

function assert(name, condition) {
  if (condition) { pass++; }
  else { fail++; errors.push(name); console.error(`  ❌ FAIL: ${name}`); }
}

function group(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

// ─── Tests ───

group('calc1RM', () => {
  assert('1 rep = weight', calc1RM(225, 1) === 225);
  assert('5 reps > weight', calc1RM(200, 5) > 200);
  assert('10 reps Epley', calc1RM(135, 10) === Math.round(135 * (1 + 10/30)));
  assert('0 weight = 0', calc1RM(0, 5) === 0);
});

group('calcPlates', () => {
  assert('225 = two 45s', JSON.stringify(calcPlates(225)) === '[45,45]');
  assert('135 = one 45', JSON.stringify(calcPlates(135)) === '[45]');
  assert('45 = empty bar', JSON.stringify(calcPlates(45)) === '[]');
  assert('315 = three 45s', JSON.stringify(calcPlates(315)) === '[45,45,45]');
  assert('50 = one 2.5', JSON.stringify(calcPlates(50)) === '[2.5]');
  assert('46 = impossible', calcPlates(46) === null);
});

group('Date helpers', () => {
  assert('today format', /^\d{4}-\d{2}-\d{2}$/.test(today()));
  assert('ago returns date string', /^\d{4}-\d{2}-\d{2}$/.test(ago(7)));
  assert('ago(0) = today', ago(0) === today());
  assert('fmtShort returns string', typeof fmtShort(today()) === 'string');
});

group('Unit conversion', () => {
  assert('toKg(100) ≈ 45.4', Math.abs(toKg(100) - 45.4) < 0.1);
  assert('toLbs(45) ≈ 99.2', Math.abs(toLbs(45) - 99.2) < 0.2);
  assert('wUnit lbs', wUnit('lbs') === 'lbs');
  assert('wUnit kg', wUnit('kg') === 'kg');
  assert('roundtrip 225', Math.abs(toLbs(toKg(225)) - 225) < 1);
});

group('uid uniqueness', () => {
  assert('returns string', typeof uid() === 'string');
  assert('unique', uid() !== uid());
  assert('length > 8', uid().length > 8);
});

group('Workout validation', () => {
  const mockState = { exercises: [{ id: 'bench', name: 'Bench Press', cat: 'Chest' }], workouts: [], units: 'lbs' };
  const normalW = { exercises: [{ exerciseId: 'bench', sets: [{ weight: 135, reps: 10 }] }], date: '2026-01-01' };
  const crazyW = { exercises: [{ exerciseId: 'bench', sets: [{ weight: 1200, reps: 10 }] }], date: '2026-01-01' };
  const highReps = { exercises: [{ exerciseId: 'bench', sets: [{ weight: 50, reps: 150 }] }], date: '2026-01-01' };
  const dupeState = { ...mockState, workouts: [{ date: '2026-01-01', exercises: [{ exerciseId: 'bench' }] }] };

  assert('normal: no warnings', validateWorkout(normalW, mockState).length === 0);
  assert('1200lb: warning', validateWorkout(crazyW, mockState).length > 0);
  assert('150 reps: warning', validateWorkout(highReps, mockState).length > 0);
  assert('duplicate: warning', validateWorkout(normalW, dupeState).length > 0);
});

group('Nutrition validation', () => {
  assert('normal: no warning', validateNutrition({ cal: 2000, protein: 150 }).length === 0);
  assert('10000 cal: warning', validateNutrition({ cal: 10000, protein: 150 }).length > 0);
  assert('600g protein: warning', validateNutrition({ cal: 2000, protein: 600 }).length > 0);
});

group('Body validation', () => {
  const s = { body: [{ weight: 180 }], units: 'lbs' };
  assert('normal: no warning', validateBody({ weight: 181 }, s).length === 0);
  assert('25lb jump: warning', validateBody({ weight: 205 }, s).length > 0);
});

group('Readiness score', () => {
  const mockS = {
    checkins: [{ date: today(), soreness: 2, energy: 4, motivation: 5, sleep: 8 }],
    nutrition: [{ date: today(), sleep: 8 }],
    workouts: [], body: []
  };
  const r = calcReadiness(mockS);
  assert('returns score', typeof r.score === 'number');
  assert('score 0-100', r.score >= 0 && r.score <= 100);
  assert('returns level', typeof r.level === 'string');
  assert('returns color', typeof r.color === 'string');
});

group('Strength score', () => {
  const ws = [{ exercises: [
    { exerciseId: 'bench', sets: [{ weight: 225, reps: 5 }] },
    { exerciseId: 'squat', sets: [{ weight: 315, reps: 5 }] },
    { exerciseId: 'deadlift', sets: [{ weight: 405, reps: 5 }] }
  ] }];
  const r = calcStrengthScore(ws, 180);
  assert('returns score', typeof r.score === 'number');
  assert('positive for decent lifts', r.score > 0);
  assert('empty = zero', calcStrengthScore([], 180).score === 0);
});

group('Muscle heat map', () => {
  const ws = [{ date: today(), exercises: [{ exerciseId: 'bench', sets: [{ weight: 135, reps: 10 }] }] }];
  const exs = [{ id: 'bench', name: 'Bench Press', cat: 'Chest' }];
  const heat = calcMuscleHeat(ws, exs, 30);
  assert('returns object', typeof heat === 'object');
  assert('chest > 0 for bench', (heat.chest || 0) > 0);
});

group('Data constants', () => {
  assert('85+ exercises', defaultExercises.length >= 85);
  assert('exercises have ids', defaultExercises.every(e => e.id));
  assert('exercises have names', defaultExercises.every(e => e.name));
  assert('exercises have categories', defaultExercises.every(e => e.cat));
  assert('50+ foods', FOODS.length >= 50);
  assert('foods have calories', FOODS.every(f => typeof f.cal === 'number'));
  assert('templates exist', TEMPLATES.length > 0);
  assert('schedule has weekly', !!defaultSchedule.weekly);
});

// ─── Summary ───
console.log(`\n${'═'.repeat(50)}`);
console.log(`Tests: ${pass} passed, ${fail} failed, ${pass + fail} total`);
console.log(`${'═'.repeat(50)}`);

if (fail > 0) {
  console.error(`\n⚠️  ${fail} test(s) failed:`);
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
}
