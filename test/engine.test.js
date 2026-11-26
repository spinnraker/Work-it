const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const clone = (x) => JSON.parse(JSON.stringify(x));

// The built-in routines as they were before the Mobility Flow (1.15): the flow
// block removed and old warm-ups back on. Tests of general mechanics use these.
const preFlow = (d) => {
  const c = clone(d);
  c.blocks = c.blocks.filter((b) => !/^flow-/.test(b.id));
  c.blocks.forEach((b) => { b.off = false; });
  c.warmupOn = true;
  return c;
};
const SEED = Object.fromEntries(Object.entries(E.SEED_DAYS).map(([k, v]) => [k, preFlow(v)]));

test('seed days match the plan: counts of exercises and muscles', () => {
  const up = E.dayStats(SEED.upper);
  const low = E.dayStats(SEED.lower);
  // 10 workout exercises + 4 cool-down stretches; cool-downs target muscles already worked.
  assert.equal(up.exercises, 14);
  assert.equal(up.muscles, 7);
  assert.equal(low.exercises, 13);
  assert.equal(low.muscles, 5);
  assert.equal(SEED.upper.cooldown.length, 4);
  assert.equal(SEED.lower.cooldown.length, 4);
});

test('describe matches the app’s wording', () => {
  const u = SEED.upper;
  assert.equal(E.describe(u.blocks[0].items[1], 3), '3 intervals · 15 lb · 0:45 each');
  assert.equal(E.describe(u.blocks[0].items[2], 3), '3 intervals · 17.5 lb · 0:45 each');
  assert.equal(E.describe(u.blocks[0].items[0], 3), '3 intervals · 0:45 each');
  assert.equal(E.describe(u.warmup[0], 2), 'Static stretch · 2 sets · 0:15');
  assert.equal(E.describe(u.warmup[2], 2), 'Dynamic stretch · 2 sets · 8 reps');
});

test('a block runs as a circuit: every exercise once per round', () => {
  const day = clone(SEED.upper);
  day.warmupOn = false;
  day.cooldownOn = false;
  day.blocks = [day.blocks[0]];
  const steps = E.buildPlan(day);
  const work = steps.filter((s) => s.kind === 'work');
  assert.equal(work.length, 12);
  const flat = E.flatten(day);
  assert.deepEqual(work.slice(0, 4).map((s) => flat[s.ex].item.name), ['Pull Up', 'Dumbbell Bicep Curl', 'Dumbbell Bench Press', 'Side Laterals to Front Raise']);
  assert.deepEqual(work.map((s) => s.round), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  // Between exercises: rest; between rounds: round rest.
  const rests = steps.filter((s) => s.kind === 'rest');
  assert.equal(rests.filter((s) => s.label === 'Round rest').length, 2);
  assert.equal(rests.filter((s) => s.label === 'Rest').length, 9);
  // Each rest points at the exercise that comes next.
  const i = steps.findIndex((s) => s.kind === 'rest');
  assert.equal(steps[i].next, steps[i + 1].ex);
});

test('stretches with sides run left then right', () => {
  const day = clone(SEED.lower);
  day.blocks = [];
  day.cooldownOn = false;
  const steps = E.buildPlan(day);
  const flat = E.flatten(day);
  const lunge = steps.filter((s) => s.kind === 'work' && flat[s.ex].item.id === 'lunge-ankle-grab');
  assert.deepEqual(lunge.map((s) => s.side), ['left', 'right', 'left', 'right']);
  assert.ok(steps.some((s) => s.label === 'Switch sides'));
});

test('dynamic stretches are paced by reps', () => {
  const day = clone(SEED.upper);
  day.blocks = [];
  day.cooldownOn = false;
  const steps = E.buildPlan(day, { repSeconds: 3 });
  const flat = E.flatten(day);
  const circle = steps.find((s) => s.kind === 'work' && flat[s.ex].item.kind === 'dynamic');
  assert.equal(circle.duration, 24);
});

test('turning the warm-up or cool-down off removes it from the plan', () => {
  const day = clone(SEED.upper);
  const full = E.buildPlan(day).length;
  day.warmupOn = false;
  day.cooldownOn = false;
  const plan = E.buildPlan(day);
  assert.ok(plan.length < full);
  assert.ok(plan.every((s) => s.section === 'block'));
});

test('a 30-minute day lands near 30 minutes', () => {
  for (const id of ['upper', 'lower', 'conditioning', 'mobility', 'lower-b']) {
    const min = E.estimateSeconds(E.buildPlan(SEED[id])) / 60;
    assert.ok(min > 20 && min < 40, `${id}: ${min}`);
  }
});

test('summarize counts done intervals and completion', () => {
  const day = clone(SEED.upper);
  const steps = E.buildPlan(day);
  const work = steps.map((s, i) => (s.kind === 'work' ? i : -1)).filter((i) => i >= 0);
  const all = E.summarize(day, steps, work, 'completed', steps.length);
  assert.equal(all.completionPct, 100);
  assert.ok(all.results.every((r) => r.status === 'done'));

  const half = work.slice(0, Math.floor(work.length / 2));
  const at = half[half.length - 1] + 1;
  const part = E.summarize(day, steps, half, 'ended', at);
  assert.ok(part.completionPct > 0 && part.completionPct < 100);
  assert.equal(part.results[part.results.length - 1].status, 'not reached');
});

test('back restarts the current interval, or goes to the previous one', () => {
  const steps = E.buildPlan(SEED.upper);
  const w = steps.map((s, i) => (s.kind === 'work' ? i : -1)).filter((i) => i >= 0);
  assert.equal(E.backTarget(steps, w[3], 10000), w[3]);
  assert.equal(E.backTarget(steps, w[3], 500), w[2]);
  assert.equal(E.backTarget(steps, w[3] - 1, 0), w[2]); // from a rest
});

test('progression: next dumbbell up or down, or more time for bodyweight', () => {
  assert.deepEqual(E.progress({ weight: 15, seconds: 45 }, 'up'), { weight: 17.5, seconds: 45 });
  assert.deepEqual(E.progress({ weight: 25, seconds: 45 }, 'up'), { weight: 30, seconds: 45 });
  assert.deepEqual(E.progress({ weight: 25, seconds: 45 }, 'down'), { weight: 22.5, seconds: 45 });
  assert.deepEqual(E.progress({ weight: 2.5, seconds: 45 }, 'down'), { weight: null, seconds: 45 });
  assert.deepEqual(E.progress({ weight: null, seconds: 45 }, 'up'), { weight: null, seconds: 50 });
  assert.deepEqual(E.progress({ weight: null, seconds: 15 }, 'down'), { weight: null, seconds: 15 });
  assert.equal(E.trendFor('easy'), 'up');
  assert.equal(E.trendFor('hard'), 'down');
  assert.equal(E.trendFor('right'), null);
});

test('the next routine follows the rotation after a completed workout', () => {
  const order = ['upper', 'lower', 'full'];
  assert.equal(E.nextDay([], order, 'upper'), 'upper');
  assert.equal(E.nextDay([{ status: 'completed', dayId: 'upper', startedAt: 1 }], order, 'upper'), 'lower');
  assert.equal(E.nextDay([{ status: 'completed', dayId: 'full', startedAt: 1 }], order, 'lower'), 'upper');
  assert.equal(E.nextDay([
    { status: 'completed', dayId: 'upper', startedAt: 1 },
    { status: 'completed', dayId: 'lower', startedAt: 2 },
    { status: 'ended', dayId: 'upper', startedAt: 3 },
  ], order, 'upper'), 'full');
  // A deleted routine falls back.
  assert.equal(E.nextDay([{ status: 'completed', dayId: 'gone', startedAt: 1 }], order, 'lower'), 'lower');
  assert.equal(E.nextInOrder(['a'], 'a'), 'a');
});

test('new routines: blank or a copy with fresh ids', () => {
  const blank = E.newRoutine('  Arms & Abs ', null, {});
  assert.equal(blank.name, 'Arms & Abs');
  assert.equal(blank.blocks.length, 1);
  assert.equal(E.buildPlan(blank).length, 0);
  assert.equal(E.newRoutine('', null).name, 'New routine');
  const src = clone(SEED.upper);
  src.blocks[0].items[1].trend = 'up';
  const copy = E.newRoutine('Upper 2', src, {});
  assert.notEqual(copy.id, src.id);
  assert.equal(E.flatten(copy).length, E.flatten(src).length);
  const ids = (d) => E.flatten(d, { all: true }).map((f) => f.item.id);
  assert.ok(ids(copy).every((id) => !ids(src).includes(id)));
  assert.equal(copy.blocks[0].items[1].trend, null);
  assert.equal(src.blocks[0].items[1].trend, 'up');
});

test('normalize keeps custom routines and their order, and migrates old data', () => {
  const s = E.freshState();
  const full = E.newRoutine('Full Body', null, s.days);
  s.days[full.id] = full;
  s.order = [full.id, 'upper', 'lower', 'conditioning', 'mobility', 'upper-b', 'lower-b'];
  s.current = full.id;
  const { state } = E.normalize(clone(s));
  assert.deepEqual(state.order, [full.id, 'upper', 'lower', 'conditioning', 'mobility', 'upper-b', 'lower-b']);
  assert.equal(state.days[full.id].name, 'Full Body');
  assert.equal(state.current, full.id);
  // Data saved before routines existed: no order, upper/lower only.
  const old = clone(E.freshState());
  delete old.order;
  delete old.seedVersion;
  delete old.days.conditioning;
  delete old.days.mobility;
  delete old.days['upper-b'];
  delete old.days['lower-b'];
  old.current = 'lower';
  const m = E.normalize(old).state;
  assert.deepEqual(m.order, ['upper', 'lower', 'conditioning', 'mobility', 'upper-b', 'lower-b']); // new built-ins added once
  assert.equal(m.seedVersion, E.SEED_VERSION);
  assert.equal(m.current, 'lower');
  // Bad ids are dropped; a missing current falls back to the first routine.
  const bad = clone(E.freshState());
  bad.days['no spaces!'] = full;
  bad.current = 'nope';
  const b = E.normalize(bad);
  assert.equal(b.dropped, 1);
  assert.equal(b.state.current, 'upper');
});

test('muscle report and week streak come from history', () => {
  const today = '2026-11-20'; // Friday
  const sess = (date, muscles, done = 3) => ({ date, status: 'completed', completionPct: 100, results: [{ section: 'block', muscles, done }] });
  const sessions = [
    sess('2026-11-17', ['chest']),
    sess('2026-11-19', ['quads']),
    sess('2026-11-10', ['chest']),
    sess('2026-11-12', ['quads']),
  ];
  const r = E.muscleReport(sessions, today);
  assert.equal(r.chest.week, 1);
  assert.equal(r.chest.last, '2026-11-17');
  assert.equal(r.chest.sets, 3);
  assert.equal(r.biceps.last, null);
  assert.equal(E.weekCount(sessions, today), 2);
  assert.equal(E.weekStreak(sessions, today), 2);
});

test('normalize keeps good data and sets aside bad records', () => {
  const s = E.freshState();
  s.sessions.push({ id: 'a', date: '2026-11-20', dayId: 'lower', status: 'completed', completionPct: 100, results: [{ name: 'Plank', muscles: ['abs', 'nope'], done: 3, target: 3 }] });
  s.sessions.push({ date: 'bad' });
  s.days.upper.blocks[1].items.push({ name: '' }); // [0] is the Mobility Flow
  const { state, dropped } = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(dropped, 2);
  assert.equal(state.sessions.length, 1);
  assert.deepEqual(state.sessions[0].results[0].muscles, ['abs']);
  assert.equal(state.days.upper.blocks[1].items.length, 4);
  assert.equal(state.days.upper.blocks[1].items[2].weight, 17.5);
  assert.equal(E.normalize(null).dropped, 1);
});

test('library has every built-in exercise once, tagged by equipment', () => {
  const lib = E.library();
  const names = lib.map((x) => x.name);
  assert.equal(new Set(names).size, names.length);
  for (const d of Object.values(SEED)) {
    for (const it of [...d.warmup, ...d.blocks.flatMap((b) => b.items), ...d.cooldown]) {
      if (it.library !== false) assert.ok(names.includes(it.name), it.name);
    }
  }
  const count = (eq) => lib.filter((x) => x.equipment === eq).length;
  assert.ok(count('trx') >= 20);
  assert.ok(count('dumbbell') >= 30);
  for (const x of lib) {
    assert.ok(E.EQUIPMENT[x.equipment], x.name);
    assert.ok(x.muscles.length && x.muscles.every((m) => E.MUSCLES[m]), x.name);
    assert.ok(x.cue, x.name);
    if (x.equipment === 'dumbbell') assert.ok(x.weight > 0, x.name);
    if (x.equipment === 'stretch') assert.notEqual(x.kind, 'interval', x.name);
    else assert.equal(x.kind, 'interval', x.name);
  }
});

test('library filters by kind, equipment, muscle and search words', () => {
  const lib = E.library();
  const trxBack = E.filterLibrary(lib, { equipment: 'trx', muscle: 'lats' });
  assert.ok(trxBack.length >= 2 && trxBack.every((x) => x.equipment === 'trx' && x.muscles.includes('lats')));
  assert.ok(E.filterLibrary(lib, { kind: 'stretch' }).every((x) => x.equipment === 'stretch'));
  assert.ok(E.filterLibrary(lib).every((x) => x.equipment !== 'stretch'));
  assert.deepEqual(E.filterLibrary(lib, { q: 'bulgarian' }).map((x) => x.name), ['Bulgarian Split Squat']);
  assert.ok(E.filterLibrary(lib, { q: 'trx row' }).some((x) => x.name === 'TRX Row'));
  const pref = E.filterLibrary(lib, { prefer: ['calves'] });
  assert.ok(pref[0].muscles.includes('calves'));
});

test('fromLibrary keeps the block’s interval length and your last weight', () => {
  const lib = E.library();
  const curl = lib.find((x) => x.name === 'Hammer Curl');
  const it = E.fromLibrary(curl, { kind: 'interval', seconds: 40, last: { weight: 20 } });
  assert.equal(it.seconds, 40);
  assert.equal(it.weight, 20);
  assert.equal(it.trend, null);
  assert.notEqual(it.id, curl.id);
  const fresh = E.fromLibrary(curl, { kind: 'interval' });
  assert.equal(fresh.weight, 15);
  const pigeon = E.fromLibrary(lib.find((x) => x.name === 'Pigeon Pose'), { kind: 'stretch' });
  assert.equal(pigeon.kind, 'static');
  assert.equal(pigeon.sides, 'each');
});

test('reordering: move an item, and where a dragged row lands', () => {
  assert.deepEqual(E.moveTo(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(E.moveTo(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(E.moveTo(['a', 'b'], 1, 1), ['a', 'b']);
  assert.deepEqual(E.moveTo(['a', 'b'], 0, 9), ['b', 'a']);
  const mids = [50, 150, 250, 350]; // four 100px rows
  assert.equal(E.dropIndex(mids, 0, 60), 0);   // barely moved
  assert.equal(E.dropIndex(mids, 0, 151), 1);  // past row 1's middle
  assert.equal(E.dropIndex(mids, 0, 999), 3);  // dragged to the bottom
  assert.equal(E.dropIndex(mids, 3, 249), 2);
  assert.equal(E.dropIndex(mids, 3, -50), 0);  // dragged to the top
  assert.equal(E.dropIndex(mids, 1, 150), 1);
});

test('the Conditioning routine: named one-round blocks, about 30 minutes', () => {
  const d = SEED.conditioning;
  assert.deepEqual(d.blocks.map((b) => b.name), ['Warm-up', 'Row', 'Conditioning', 'Strength']);
  assert.ok(d.blocks.every((b) => b.rounds === 1));
  assert.equal(d.cooldown.length, 4);
  const min = E.estimateSeconds(E.buildPlan(d)) / 60;
  assert.ok(min > 28 && min < 32, String(min));
  const row = d.blocks[1].items[0];
  assert.equal(row.name, 'Row');
  assert.equal(E.describe(row, 1), '7:00');
  // The AMRAP isn't offered in the library; the kettlebell moves are.
  const lib = E.library();
  assert.ok(!lib.some((x) => x.name.startsWith('AMRAP')));
  assert.equal(lib.find((x) => x.name === 'Russian KB Swing').equipment, 'kettlebell');
  // Deleting it sticks: data already at this seed version doesn't get it back.
  const s = clone(E.freshState());
  delete s.days.conditioning;
  s.order = ['upper', 'lower', 'mobility', 'upper-b', 'lower-b'];
  assert.deepEqual(E.normalize(s).state.order, ['upper', 'lower', 'mobility', 'upper-b', 'lower-b']);
  // Block names survive a save.
  assert.equal(E.normalize(clone(E.freshState())).state.days.conditioning.blocks[2].name, 'Row');
});

test('interval lengths step finer when short, coarser when long', () => {
  assert.equal(E.stepSeconds(45, 1), 50);
  assert.equal(E.stepSeconds(120, 1), 135);
  assert.equal(E.stepSeconds(120, -1), 115);
  assert.equal(E.stepSeconds(300, 1), 330);
  assert.equal(E.stepSeconds(300, -1), 285);
  assert.equal(E.stepSeconds(600, 1), 600);
  assert.equal(E.stepSeconds(15, -1), 15);
});

test('sound cues: countdown, halfway and the next step’s start, timed from now', () => {
  const steps = [
    { kind: 'ready', duration: 5, section: 'block' },
    { kind: 'work', duration: 40, section: 'block' },
    { kind: 'work', duration: 40, section: 'block' },
    { kind: 'rest', duration: 15, section: 'block', label: 'Round rest' },
    { kind: 'work', duration: 40, section: 'block' },
  ];
  // Get ready: 3-2-1 then go.
  assert.deepEqual(E.stepCues(steps, 0), [
    { at: 2, cue: 'tick' }, { at: 3, cue: 'tick' }, { at: 4, cue: 'tick' }, { at: 5, cue: 'go' },
  ]);
  // Work into work: halfway, countdown, then just "go" (no stop tone on top of it).
  assert.deepEqual(E.stepCues(steps, 1).map((c) => c.cue), ['half', 'tick', 'tick', 'tick', 'go']);
  // Work into a round rest: stop, then the round sound a beat later.
  const end = E.stepCues(steps, 2).slice(-2);
  assert.deepEqual(end, [{ at: 40, cue: 'stop' }, { at: 40.55, cue: 'round' }]);
  // Resuming 30 s in: only what's still ahead, timed from now.
  assert.deepEqual(E.stepCues(steps, 1, 30), [
    { at: 7, cue: 'tick' }, { at: 8, cue: 'tick' }, { at: 9, cue: 'tick' }, { at: 10, cue: 'go' },
  ]);
  // Last step: countdown, nothing after (the finish chime handles the end).
  assert.deepEqual(E.stepCues(steps, 4).map((c) => c.cue), ['half', 'tick', 'tick', 'tick']);
  // Intro cards don't tick.
  assert.deepEqual(E.stepCues([{ kind: 'intro', duration: 6 }, { kind: 'ready', duration: 5 }], 0), []);
  assert.equal(E.enterCue({ kind: 'rest', label: 'Switch sides' }), 'sides');
  assert.equal(E.enterCue({ kind: 'rest', label: 'Rest' }), null);
});

test('every step of a real workout gets its start sound exactly once', () => {
  const steps = E.buildPlan(SEED.conditioning);
  const starts = steps.map((s) => E.enterCue(s)).filter(Boolean).length - (E.enterCue(steps[0]) ? 1 : 0);
  const scheduled = steps.reduce((n, _, i) => n + E.stepCues(steps, i).filter((c) => c.cue !== 'tick' && c.cue !== 'half' && c.cue !== 'stop').length, 0);
  assert.equal(scheduled, starts);
});

test('audio mode defaults to mixing with music', () => {
  assert.equal(E.freshState().settings.audioMode, 'mix');
  assert.equal(E.normalize({ days: {}, settings: { audioMode: 'silent' } }).state.settings.audioMode, 'silent');
  assert.equal(E.normalize({ days: {}, settings: { audioMode: 'weird' } }).state.settings.audioMode, 'mix');
});

test('the version agrees everywhere it appears', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  assert.match(E.VERSION, /^\d+\.\d+\.\d+$/);
  assert.match(E.RELEASED, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, E.VERSION, 'package.json');
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes(`const CACHE = 'workit-${E.VERSION}'`), 'sw.js CACHE');
  assert.ok(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').includes(`**${E.VERSION}**`), 'CHANGELOG.md');
});

test('the Mobility routine: five named blocks, about 30 minutes, added once to existing data', () => {
  const d = SEED.mobility;
  assert.deepEqual(d.blocks.map((b) => b.name), ['Movement Prep', 'Mobility 1', 'Mobility 2', 'Mobility 3', 'Mobility 4']);
  assert.deepEqual(d.blocks.map((b) => b.rounds), [2, 2, 2, 2, 1]);
  assert.equal(d.warmup.length + d.cooldown.length, 0);
  const min = E.estimateSeconds(E.buildPlan(d)) / 60;
  assert.ok(min > 28 && min < 31, String(min));
  const ids = E.flatten(d, { all: true }).map((f) => f.item.id);
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique within the routine');
  // Data saved at 1.10 (seed version 2) gets Mobility, and keeps its own order and Conditioning as-is.
  const s = clone(E.freshState());
  delete s.days.mobility;
  delete s.days['upper-b'];
  delete s.days['lower-b'];
  s.seedVersion = 2;
  s.order = ['lower', 'conditioning', 'upper'];
  const n = E.normalize(s).state;
  assert.deepEqual(n.order, ['lower', 'conditioning', 'upper', 'mobility', 'upper-b', 'lower-b']);
  assert.equal(n.days.mobility.name, 'Mobility');
  // Every library entry is still valid with the new moves in it.
  const lib = E.library();
  assert.equal(new Set(lib.map((x) => x.name)).size, lib.length);
  assert.ok(lib.some((x) => x.name === '90/90 Supported Switches' && x.equipment === 'bodyweight'));
});

test('4-week weight suggestion', () => {
  const today = '2026-11-25';
  const item = { name: 'Dumbbell Bicep Curl', kind: 'interval', weight: 15, seconds: 45, trend: null, holdUntil: null };
  let n = 0;
  const sess = (date, weight, rating = null, name = item.name) => ({ date, startedAt: E.fromKey(date).getTime() + n++, results: [{ name, section: 'block', weight, done: 3, rating }] });
  const weekly = (from, count, weight) => Array.from({ length: count }, (_, k) => sess(E.addDays(from, k * 7), weight));

  // 5 weekly workouts at 15 lb, the first 28 days ago: suggest 17.5.
  let h = weekly('2026-10-28', 5, 15);
  let s = E.weightSuggestion(item, h, today);
  assert.deepEqual({ since: s.since, weeks: s.weeks, workouts: s.workouts, to: s.to }, { since: '2026-10-28', weeks: 4, workouts: 5, to: 17.5 });
  // Only 27 days: not yet.
  assert.equal(E.weightSuggestion(item, weekly('2026-10-29', 4, 15), today), null);
  // Fewer than 3 workouts at this weight, however long ago: not yet.
  assert.equal(E.weightSuggestion(item, [sess('2026-10-01', 15), sess('2026-11-20', 15)], today), null);
  // The clock restarts when the weight changes: 12.5 for weeks, 15 only since Nov 11.
  h = [...weekly('2026-09-01', 8, 12.5), ...weekly('2026-11-11', 3, 15)];
  assert.equal(E.weightSuggestion(item, h, today), null);
  // ...and 4 weeks after that change it asks again.
  assert.ok(E.weightSuggestion(item, h, '2026-12-09'));
  // Last one rated too hard, or already flagged to go down: no.
  h = [...weekly('2026-10-21', 5, 15), sess('2026-11-24', 15, 'hard')];
  assert.equal(E.weightSuggestion(item, h, today), null);
  h = weekly('2026-10-21', 5, 15);
  assert.equal(E.weightSuggestion({ ...item, trend: 'down' }, h, today), null);
  // "Not yet" holds it until the date passes.
  assert.equal(E.weightSuggestion({ ...item, holdUntil: '2026-12-23' }, h, today), null);
  assert.ok(E.weightSuggestion({ ...item, holdUntil: '2026-12-23' }, h, '2026-12-23'));
  // Bodyweight and stretches never get one; other exercises' history doesn't count.
  assert.equal(E.weightSuggestion({ ...item, weight: null }, h, today), null);
  assert.equal(E.weightSuggestion(item, weekly('2026-10-01', 6, 15).map((x) => ({ ...x, results: [{ ...x.results[0], name: 'Hammer Curl' }] })), today), null);
  // 25 lb steps by 5.
  assert.equal(E.weightSuggestion({ ...item, weight: 25 }, weekly('2026-10-21', 5, 25), today).to, 30);
  // holdUntil survives a save.
  assert.equal(E.cleanItem({ ...item, holdUntil: '2026-12-23' }, 'interval').holdUntil, '2026-12-23');
  assert.equal(E.cleanItem({ ...item, holdUntil: 'soon' }, 'interval').holdUntil, null);
});

test('Upper and Lower Body Day B: library moves, same muscles as their A days, no repeats from A', () => {
  const ub = SEED['upper-b'];
  const lb = SEED['lower-b'];
  assert.equal(ub.name, 'Upper Body Day B');
  assert.equal(lb.name, 'Lower Body Day B');
  const names = (d) => d.blocks.flatMap((b) => b.items).map((it) => it.name);
  assert.deepEqual(names(ub), ['TRX Row', 'Incline Dumbbell Press', 'Bent-Over Dumbbell Row', 'Arnold Press', 'Hammer Curl', 'Overhead Triceps Extension', 'Renegade Row', 'Dead Bug']);
  assert.deepEqual(names(lb), ['Goblet Squat', 'Dumbbell Romanian Deadlift', 'Dumbbell Step Up', 'Dumbbell Hip Thrust', 'TRX Hamstring Curl', 'TRX Crossing Balance Lunge', 'Side Plank']);
  for (const [b, a] of [[ub, SEED.upper], [lb, SEED.lower]]) {
    const all = (d) => E.flatten(d, { all: true }).map((f) => f.item);
    assert.deepEqual(new Set(all(b).map((x) => x.id)).size, all(b).length, 'unique ids');
    const aNames = new Set(names(a));
    assert.ok(names(b).every((n) => !aNames.has(n)), 'no interval repeats from day A');
    const aMuscles = new Set(E.dayStats(a).muscleIds.filter((m) => m !== 'lower-back'));
    assert.ok([...aMuscles].every((m) => E.dayStats(b).muscleIds.includes(m)), `${b.name} covers ${[...aMuscles]}`);
  }
  // Starting weights as agreed.
  const w = (d, n) => d.blocks.flatMap((b) => b.items).find((it) => it.name === n).weight;
  assert.equal(w(lb, 'Goblet Squat'), 15);
  assert.equal(w(lb, 'Dumbbell Step Up'), 5);
  assert.equal(w(lb, 'Dumbbell Hip Thrust'), 20);
  assert.equal(w(ub, 'Incline Dumbbell Press'), 15);
  assert.ok(!names(lb).includes('Bulgarian Split Squat'));
  // Both survive a save.
  const st = E.normalize(clone(E.freshState())).state;
  assert.equal(st.days['lower-b'].blocks[1].items[2].name, 'Dumbbell Step Up');
});

test('no running: saved routines switch Run and Jog to the rower, keeping their times', () => {
  // Conditioning as saved by 1.12, plus a custom routine with a run in it.
  const s = clone(E.freshState());
  s.seedVersion = 3;
  for (const k of Object.keys(s.days)) s.days[k] = preFlow(s.days[k]);
  delete s.days['upper-b'];
  delete s.days['lower-b'];
  const c = s.days.conditioning;
  c.blocks[0].items[5] = { id: 'jog', name: 'Jog', kind: 'interval', seconds: 120, muscles: ['quads', 'calves'] };
  c.blocks[1] = { id: 'c-run', name: 'Run', rounds: 1, rest: 0, roundRest: 0, items: [{ id: 'run', name: 'Run', kind: 'interval', seconds: 480, muscles: ['quads'] }] };
  s.days['r-mine'] = { name: 'Mine', warmup: [], cooldown: [], blocks: [{ rounds: 2, items: [{ id: 'x', name: 'run', kind: 'interval', seconds: 300, muscles: ['quads'] }, { id: 'y', name: 'Running Lunge', kind: 'interval', seconds: 45, muscles: ['quads'] }] }] };
  s.order.push('r-mine');
  const n = E.normalize(s).state;
  const cc = n.days.conditioning;
  assert.equal(cc.blocks[1].items[5].name, 'Easy Row');
  assert.equal(cc.blocks[1].items[5].seconds, 120, 'your time is kept');
  assert.equal(cc.blocks[2].name, 'Row');
  assert.equal(cc.blocks[2].items[0].name, 'Row');
  assert.equal(cc.blocks[2].items[0].seconds, 480);
  assert.equal(n.days['r-mine'].blocks[1].items[0].name, 'Row');
  assert.equal(n.days['r-mine'].blocks[1].items[1].name, 'Running Lunge', 'only exact Run/Jog');
  assert.ok(n.days['upper-b'] && n.days['lower-b']);
  // Already converted data isn't touched again (a later "Run" you add yourself stays).
  const later = clone(n);
  later.days['r-mine'].blocks[1].items[0].name = 'Run';
  assert.equal(E.normalize(later).state.days['r-mine'].blocks[1].items[0].name, 'Run');
  // Nothing in any built-in routine or the library runs.
  for (const d of Object.values(SEED)) assert.ok(E.flatten(d, { all: true }).every((f) => !/^(run|jog)$/i.test(f.item.name)), d.name);
  assert.ok(!E.library().some((x) => /^(run|jog)$/i.test(x.name)));
  assert.deepEqual(E.library().filter((x) => x.equipment === 'rower').map((x) => x.name), ['Easy Row', 'Row']);
});

test('rotation: its own cycle where routines repeat, alternating A and B days', () => {
  const st = E.freshState();
  assert.deepEqual(st.rotation, ['upper', 'lower', 'conditioning', 'mobility', 'upper-b', 'lower-b', 'conditioning', 'mobility']);
  // Walk two full cycles by finishing whatever is up next.
  let at = 0;
  const seq = [];
  for (let k = 0; k < 16; k++) { const id = st.rotation[at]; seq.push(id); at = E.advanceRotation(st.rotation, at, id); }
  assert.deepEqual(seq.slice(0, 8), st.rotation);
  assert.deepEqual(seq.slice(8), st.rotation);
  // After the second Mobility comes Upper A again, after the first comes Upper B.
  assert.equal(st.rotation[E.advanceRotation(st.rotation, 3, 'mobility')], 'upper-b');
  assert.equal(st.rotation[E.advanceRotation(st.rotation, 7, 'mobility')], 'upper');
  // Doing something else: jump past that routine's next slot.
  assert.equal(E.advanceRotation(st.rotation, 0, 'conditioning'), 3);
  assert.equal(E.advanceRotation(st.rotation, 4, 'lower'), 2, 'wraps around to the next Lower');
  // A routine that isn't in the rotation doesn't move it.
  assert.equal(E.advanceRotation(st.rotation, 5, 'r-hotel'), 5);
});

test('rotation from saved data: default cycle for older data, cleaned up otherwise', () => {
  const s = clone(E.freshState());
  delete s.rotation;
  delete s.rotationAt;
  s.current = 'mobility';
  const n = E.normalize(s).state;
  assert.equal(n.rotation.length, 8);
  assert.equal(n.rotation[n.rotationAt], 'mobility', 'picks up where you were');
  assert.equal(n.current, 'mobility');
  // Deleted routines drop out of the default; unknown ids are removed.
  const t = clone(E.freshState());
  delete t.days['upper-b'];
  delete t.rotation;
  assert.deepEqual(E.normalize(t).state.rotation, ['upper', 'lower', 'conditioning', 'mobility', 'lower-b', 'conditioning', 'mobility']);
  const u = clone(E.freshState());
  u.rotation = ['upper', 'gone', 'lower'];
  u.rotationAt = 9;
  const un = E.normalize(u).state;
  assert.deepEqual(un.rotation, ['upper', 'lower']);
  assert.equal(un.rotationAt, 1);
  // Custom rotations survive a save.
  const v = clone(E.freshState());
  v.rotation = ['lower', 'lower', 'mobility'];
  v.rotationAt = 2;
  assert.deepEqual(E.normalize(v).state.rotation, ['lower', 'lower', 'mobility']);
  assert.equal(E.normalize(v).state.rotationAt, 2);
});

test('removing a routine from the rotation keeps up-next on the same slot', () => {
  const r = ['upper', 'lower', 'conditioning', 'mobility', 'upper-b', 'lower-b', 'conditioning', 'mobility'];
  // Up next: Upper B (slot 4). Remove Conditioning (slots 2 and 6) → Upper B is now slot 3.
  let x = E.removeFromRotation(r, 4, 'conditioning');
  assert.deepEqual(x.rotation, ['upper', 'lower', 'mobility', 'upper-b', 'lower-b', 'mobility']);
  assert.equal(x.rotation[x.rotationAt], 'upper-b');
  // Up next is the removed one → the slot after it.
  x = E.removeFromRotation(r, 2, 'conditioning');
  assert.equal(x.rotation[x.rotationAt], 'mobility');
  // Removing the last slot wraps to the start.
  x = E.removeFromRotation(['upper', 'mobility'], 1, 'mobility');
  assert.deepEqual(x, { rotation: ['upper'], rotationAt: 0 });
});

test('Mobility Flow: first block of every routine, replacing the old warm-ups', () => {
  assert.equal(E.FLOW.length, 12);
  for (const d of Object.values(E.SEED_DAYS)) {
    const f = d.blocks[0];
    assert.equal(f.name, 'Mobility Flow', d.name);
    assert.equal(f.rounds, 1);
    assert.equal(f.rest, 0);
    assert.deepEqual(f.items.map((x) => x.seconds), new Array(12).fill(30));
    assert.equal(f.items[0].name, 'Body Bounces');
    assert.equal(f.items[11].name, 'Spinal Waves');
    assert.equal(d.warmupOn, false, `${d.name}: warm-up stretches off`);
    assert.ok(d.warmup.length === 0 || d.warmup.every((x) => x.name), 'old warm-up kept');
    const plan = E.buildPlan(d);
    const flat = E.flatten(d);
    assert.equal(flat[plan.find((x) => x.kind === 'work').ex].item.name, 'Body Bounces', 'the flow runs first');
    const min = E.estimateSeconds(plan) / 60;
    assert.ok(min > 30 && min < 37, `${d.name}: ${min}`);
  }
  // Old warm-up blocks are off (skipped) but still there.
  const c = E.SEED_DAYS.conditioning.blocks.find((b) => b.name === 'Warm-up');
  assert.equal(c.off, true);
  assert.equal(c.items.length, 6);
  assert.ok(!E.flatten(E.SEED_DAYS.conditioning).some((f) => f.item.name === 'Inchworm'));
  assert.ok(E.flatten(E.SEED_DAYS.conditioning, { all: true }).some((f) => f.item.name === 'Inchworm'));
  assert.equal(E.SEED_DAYS.mobility.blocks.find((b) => b.name === 'Movement Prep').off, true);
  // No halfway blip on the flow's 30 s moves; still there on 45 s intervals.
  const steps = E.buildPlan(E.SEED_DAYS.upper);
  const flat = E.flatten(E.SEED_DAYS.upper);
  const at = (name) => steps.findIndex((x) => x.kind === 'work' && flat[x.ex].item.name === name);
  assert.ok(!E.stepCues(steps, at('Trunk Twists')).some((x) => x.cue === 'half'));
  assert.ok(E.stepCues(steps, at('Pull Up')).some((x) => x.cue === 'half'));
});

test('Mobility Flow is added once to saved routines, custom ones included', () => {
  const s = clone(E.freshState());
  s.seedVersion = 4;
  for (const k of Object.keys(s.days)) s.days[k] = preFlow(s.days[k]);
  s.days['r-hotel'] = { id: 'r-hotel', name: 'Hotel TRX', warmupOn: true, cooldownOn: true, warmup: [], cooldown: [], blocks: [{ id: 'h', rounds: 2, items: [{ id: 'h1', name: 'TRX Row', kind: 'interval', seconds: 45, muscles: ['lats'] }] }] };
  s.order.push('r-hotel');
  const n = E.normalize(s).state;
  for (const d of Object.values(n.days)) {
    assert.equal(d.blocks[0].name, 'Mobility Flow', d.name);
    assert.equal(d.blocks.filter((b) => b.name === 'Mobility Flow').length, 1);
    assert.equal(d.warmupOn, false);
  }
  assert.equal(n.days['r-hotel'].blocks[1].items[0].name, 'TRX Row', 'your blocks stay, after the flow');
  assert.ok(n.days.upper.warmup.length === 3, 'warm-up stretches kept');
  assert.equal(n.days.conditioning.blocks.find((b) => b.id === 'c-warm').off, true);
  // Item ids are unique within each routine.
  for (const d of Object.values(n.days)) {
    const ids = E.flatten(d, { all: true }).map((f) => f.item.id);
    assert.equal(new Set(ids).size, ids.length, d.name);
  }
  // Loading again doesn't add a second flow; turning a block back on sticks.
  n.days.conditioning.blocks.find((b) => b.id === 'c-warm').off = false;
  const again = E.normalize(clone(n)).state;
  assert.equal(again.days.upper.blocks.filter((b) => b.name === 'Mobility Flow').length, 1);
  assert.equal(again.days.conditioning.blocks.find((b) => b.id === 'c-warm').off, false);
  // The flow's moves are in the library.
  assert.ok(E.library().some((x) => x.name === 'Down Up Dogs' && x.equipment === 'bodyweight'));
});
