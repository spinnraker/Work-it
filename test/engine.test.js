const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const clone = (x) => JSON.parse(JSON.stringify(x));

test('seed days match the plan: counts of exercises and muscles', () => {
  const up = E.dayStats(E.SEED_DAYS.upper);
  const low = E.dayStats(E.SEED_DAYS.lower);
  // 10 workout exercises + 4 cool-down stretches; cool-downs target muscles already worked.
  assert.equal(up.exercises, 14);
  assert.equal(up.muscles, 7);
  assert.equal(low.exercises, 13);
  assert.equal(low.muscles, 5);
  assert.equal(E.SEED_DAYS.upper.cooldown.length, 4);
  assert.equal(E.SEED_DAYS.lower.cooldown.length, 4);
});

test('describe matches the app’s wording', () => {
  const u = E.SEED_DAYS.upper;
  assert.equal(E.describe(u.blocks[0].items[1], 3), '3 intervals · 15 lb · 0:45 each');
  assert.equal(E.describe(u.blocks[0].items[2], 3), '3 intervals · 17.5 lb · 0:45 each');
  assert.equal(E.describe(u.blocks[0].items[0], 3), '3 intervals · 0:45 each');
  assert.equal(E.describe(u.warmup[0], 2), 'Static stretch · 2 sets · 0:15');
  assert.equal(E.describe(u.warmup[2], 2), 'Dynamic stretch · 2 sets · 8 reps');
});

test('a block runs as a circuit: every exercise once per round', () => {
  const day = clone(E.SEED_DAYS.upper);
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
  const day = clone(E.SEED_DAYS.lower);
  day.blocks = [];
  day.cooldownOn = false;
  const steps = E.buildPlan(day);
  const flat = E.flatten(day);
  const lunge = steps.filter((s) => s.kind === 'work' && flat[s.ex].item.id === 'lunge-ankle-grab');
  assert.deepEqual(lunge.map((s) => s.side), ['left', 'right', 'left', 'right']);
  assert.ok(steps.some((s) => s.label === 'Switch sides'));
});

test('dynamic stretches are paced by reps', () => {
  const day = clone(E.SEED_DAYS.upper);
  day.blocks = [];
  day.cooldownOn = false;
  const steps = E.buildPlan(day, { repSeconds: 3 });
  const flat = E.flatten(day);
  const circle = steps.find((s) => s.kind === 'work' && flat[s.ex].item.kind === 'dynamic');
  assert.equal(circle.duration, 24);
});

test('turning the warm-up or cool-down off removes it from the plan', () => {
  const day = clone(E.SEED_DAYS.upper);
  const full = E.buildPlan(day).length;
  day.warmupOn = false;
  day.cooldownOn = false;
  const plan = E.buildPlan(day);
  assert.ok(plan.length < full);
  assert.ok(plan.every((s) => s.section === 'block'));
});

test('a 30-minute day lands near 30 minutes', () => {
  for (const id of ['upper', 'lower', 'conditioning']) {
    const min = E.estimateSeconds(E.buildPlan(E.SEED_DAYS[id])) / 60;
    assert.ok(min > 20 && min < 40, `${id}: ${min}`);
  }
});

test('summarize counts done intervals and completion', () => {
  const day = clone(E.SEED_DAYS.upper);
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
  const steps = E.buildPlan(E.SEED_DAYS.upper);
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
  const src = clone(E.SEED_DAYS.upper);
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
  s.order = [full.id, 'upper', 'lower', 'conditioning'];
  s.current = full.id;
  const { state } = E.normalize(clone(s));
  assert.deepEqual(state.order, [full.id, 'upper', 'lower', 'conditioning']);
  assert.equal(state.days[full.id].name, 'Full Body');
  assert.equal(state.current, full.id);
  // Data saved before routines existed: no order, upper/lower only.
  const old = clone(E.freshState());
  delete old.order;
  delete old.seedVersion;
  delete old.days.conditioning;
  old.current = 'lower';
  const m = E.normalize(old).state;
  assert.deepEqual(m.order, ['upper', 'lower', 'conditioning']); // new built-in added once
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
  s.days.upper.blocks[0].items.push({ name: '' });
  const { state, dropped } = E.normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(dropped, 2);
  assert.equal(state.sessions.length, 1);
  assert.deepEqual(state.sessions[0].results[0].muscles, ['abs']);
  assert.equal(state.days.upper.blocks[0].items.length, 4);
  assert.equal(state.days.upper.blocks[0].items[2].weight, 17.5);
  assert.equal(E.normalize(null).dropped, 1);
});

test('library has every built-in exercise once, tagged by equipment', () => {
  const lib = E.library();
  const names = lib.map((x) => x.name);
  assert.equal(new Set(names).size, names.length);
  for (const d of Object.values(E.SEED_DAYS)) {
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
  const d = E.SEED_DAYS.conditioning;
  assert.deepEqual(d.blocks.map((b) => b.name), ['Warm-up', 'Run', 'Conditioning', 'Strength']);
  assert.ok(d.blocks.every((b) => b.rounds === 1));
  assert.equal(d.cooldown.length, 4);
  const min = E.estimateSeconds(E.buildPlan(d)) / 60;
  assert.ok(min > 28 && min < 32, String(min));
  const run = d.blocks[1].items[0];
  assert.equal(E.describe(run, 1), '7:00');
  // The AMRAP isn't offered in the library; the kettlebell moves are.
  const lib = E.library();
  assert.ok(!lib.some((x) => x.name.startsWith('AMRAP')));
  assert.equal(lib.find((x) => x.name === 'Russian KB Swing').equipment, 'kettlebell');
  // Deleting it sticks: data already at this seed version doesn't get it back.
  const s = clone(E.freshState());
  delete s.days.conditioning;
  s.order = ['upper', 'lower'];
  assert.deepEqual(E.normalize(s).state.order, ['upper', 'lower']);
  // Block names survive a save.
  assert.equal(E.normalize(clone(E.freshState())).state.days.conditioning.blocks[1].name, 'Run');
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
