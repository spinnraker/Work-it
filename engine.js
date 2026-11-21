/*
 * Work it engine.
 *
 * Pure logic, no DOM. A workout day is a warm-up, one or more timed-interval
 * blocks (circuits) and a cool-down. Starting a workout snapshots the day and
 * compiles it into a flat list of timed steps (intro → get ready → work → rest
 * → work …). The UI walks that list with a wall-clock timer, which keeps
 * pause/resume, "back" and resume-after-reload simple and accurate.
 *
 * Because sessions keep their own snapshot, editing a day only changes future
 * workouts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorkEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- dates (local calendar days as YYYY-MM-DD) ----------

  const pad = (n) => String(n).padStart(2, '0');

  function toKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  function diffDays(a, b) {
    const da = fromKey(a);
    const db = fromKey(b);
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
  }

  /** Monday = 0 … Sunday = 6 */
  function weekday(key) {
    return (fromKey(key).getDay() + 6) % 7;
  }

  function weekStart(key) {
    return addDays(key, -weekday(key));
  }

  // ---------- muscles ----------

  // `view`: which side of the body diagram shows it.
  const MUSCLES = {
    chest: { name: 'Chest', view: 'front' },
    shoulders: { name: 'Shoulders', view: 'front' },
    biceps: { name: 'Biceps', view: 'front' },
    abs: { name: 'Abs', view: 'front' },
    quads: { name: 'Quads', view: 'front' },
    abductors: { name: 'Abductors', view: 'front' },
    lats: { name: 'Lats', view: 'back' },
    triceps: { name: 'Triceps', view: 'back' },
    'lower-back': { name: 'Lower back', view: 'back' },
    glutes: { name: 'Glutes', view: 'back' },
    hamstrings: { name: 'Hamstrings', view: 'back' },
    calves: { name: 'Calves', view: 'back' },
  };
  const MUSCLE_IDS = Object.keys(MUSCLES);

  // ---------- seed data ----------

  // kind: 'static' (hold, sets × seconds), 'dynamic' (sets × reps, auto-paced),
  // 'interval' (seconds of work per round, inside a block).
  const S = (id, name, muscles, kind, extra) => ({
    id, name, muscles, kind,
    sets: 2, seconds: 15, reps: 8, weight: null, sides: 'none', cue: '', trend: null,
    ...extra,
  });
  const I = (id, name, muscles, weight, cue, extra) => S(id, name, muscles, 'interval', { seconds: 45, weight, cue, ...extra });

  const SEED_DAYS = {
    upper: {
      id: 'upper',
      name: 'Upper Body Day',
      warmupOn: true,
      cooldownOn: true,
      warmup: [
        S('chest-expansion', 'Chest Expansion', ['chest'], 'static', { cue: 'Clasp hands behind you, squeeze shoulder blades, lift the chest.' }),
        S('bench-t-spine', 'Bench T-Spine Stretch', ['lats'], 'static', { cue: 'Kneel, elbows on a bench, hands together. Sink the chest toward the floor.' }),
        S('backward-arm-circle', 'Backward Arm Circle', ['shoulders'], 'dynamic', { cue: 'Arms straight out to the sides. Slow circles backward, getting bigger.' }),
      ],
      blocks: [
        {
          id: 'u-b1', rounds: 3, rest: 15, roundRest: 30,
          items: [
            I('pull-up', 'Pull Up', ['lats'], null, 'Full hang to chin over the bar. Use a band or jump and lower slowly if needed.'),
            I('db-bicep-curl', 'Dumbbell Bicep Curl', ['biceps'], 15, 'Elbows pinned to your sides. Lower slowly.'),
            I('db-bench-press', 'Dumbbell Bench Press', ['chest'], 17.5, 'Feet planted, shoulder blades squeezed. Press up over the chest.'),
            I('side-lateral-front-raise', 'Side Laterals to Front Raise', ['shoulders'], 5, 'Raise to the sides to shoulder height, lower, then raise to the front.'),
          ],
        },
        {
          id: 'u-b2', rounds: 3, rest: 15, roundRest: 30,
          items: [
            I('db-kickback', 'Dumbbell Kickbacks', ['triceps'], 10, 'Hinge forward, upper arm still. Straighten the elbow all the way back.'),
          ],
        },
        {
          id: 'u-b3', rounds: 3, rest: 15, roundRest: 30,
          items: [
            I('plank', 'Plank', ['abs'], null, 'Forearms down, body in one line. Squeeze glutes, breathe.'),
            I('cat-cow', 'Cat Cow', ['lower-back'], null, 'On hands and knees. Round the back up, then let the belly drop. Move with your breath.'),
          ],
        },
      ],
      // After-workout stretches, chosen for the muscles this day works.
      cooldown: [
        S('doorway-chest', 'Doorway Chest Stretch', ['chest'], 'static', { sets: 1, seconds: 30, cue: 'Forearms on the door frame at shoulder height. Step through gently.' }),
        S('cross-body-shoulder', 'Cross-Body Shoulder Stretch', ['shoulders'], 'static', { sets: 1, seconds: 30, sides: 'each', cue: 'Pull one arm across the chest with the other hand. Shoulder down.' }),
        S('overhead-triceps', 'Overhead Triceps Stretch', ['triceps'], 'static', { sets: 1, seconds: 30, sides: 'each', cue: 'Hand down the middle of your back, other hand eases the elbow back.' }),
        S('childs-pose', 'Child’s Pose', ['lats', 'lower-back'], 'static', { sets: 1, seconds: 45, cue: 'Knees wide, hips to heels, arms long. Breathe into your back.' }),
      ],
    },
    lower: {
      id: 'lower',
      name: 'Lower Body Day',
      warmupOn: true,
      cooldownOn: true,
      warmup: [
        S('lunge-ankle-grab', 'Lunge with Ankle Grab', ['quads'], 'static', { sides: 'each', cue: 'Low lunge, back knee down. Reach back for the back ankle.' }),
        S('bird-dog', 'Bird Dog', ['abs'], 'dynamic', { cue: 'On hands and knees, reach opposite arm and leg long. Keep hips level.' }),
      ],
      blocks: [
        {
          id: 'l-b1', rounds: 3, rest: 15, roundRest: 30,
          items: [
            I('db-lunge', 'Dumbbell Lunge', ['quads'], 5, 'Step forward, both knees to 90°. Push back up through the front heel.'),
            I('single-leg-kickback', 'Single Leg Kickback', ['glutes'], null, 'On hands and knees, kick one heel up to the ceiling. Switch halfway.'),
            I('reverse-lunge', 'Reverse Lunge', ['quads'], null, 'Step back, lower the back knee, drive up through the front foot.'),
            I('standing-hip-abduction', 'Standing Hip Abduction', ['abductors'], null, 'Stand tall, lift one leg out to the side without leaning. Switch halfway.'),
          ],
        },
        {
          id: 'l-b2', rounds: 3, rest: 15, roundRest: 30,
          items: [
            I('trx-squat', 'TRX Squat', ['quads'], null, 'Hold the straps, sit back to a deep squat, stand tall.'),
            I('plank', 'Plank', ['abs'], null, 'Forearms down, body in one line. Squeeze glutes, breathe.'),
            I('cat-cow', 'Cat Cow', ['lower-back'], null, 'On hands and knees. Round the back up, then let the belly drop. Move with your breath.'),
          ],
        },
      ],
      cooldown: [
        S('standing-quad', 'Standing Quad Stretch', ['quads'], 'static', { sets: 1, seconds: 30, sides: 'each', cue: 'Heel to glute, knees together, hips forward. Hold a wall if needed.' }),
        S('figure-four', 'Figure-Four Stretch', ['glutes'], 'static', { sets: 1, seconds: 30, sides: 'each', cue: 'On your back, ankle over the opposite knee. Pull the thigh toward you.' }),
        S('seated-hip-crossover', 'Seated Hip Cross-Over', ['abductors'], 'static', { sets: 1, seconds: 30, sides: 'each', cue: 'Sit tall, cross one foot over the straight leg and hug the knee across.' }),
        S('knees-to-chest', 'Knees to Chest', ['lower-back'], 'static', { sets: 1, seconds: 45, cue: 'On your back, hug both knees in. Let the low back relax into the floor.' }),
      ],
    },
  };

  // ---------- library ----------
  //
  // Exercises to add or swap in. `equipment` drives the library filter:
  // 'trx', 'dumbbell', 'bodyweight' or 'stretch'. Weights are starting points.

  const T = (id, name, muscles, cue, extra) => I(id, name, muscles, null, cue, { equipment: 'trx', ...extra });
  const D = (id, name, muscles, weight, cue, extra) => I(id, name, muscles, weight, cue, { equipment: 'dumbbell', ...extra });
  const B = (id, name, muscles, cue, extra) => I(id, name, muscles, null, cue, { equipment: 'bodyweight', ...extra });
  const ST = (id, name, muscles, cue, extra) => S(id, name, muscles, 'static', { sets: 1, seconds: 30, cue, equipment: 'stretch', ...extra });
  const DY = (id, name, muscles, cue, extra) => S(id, name, muscles, 'dynamic', { sets: 2, reps: 8, cue, equipment: 'stretch', ...extra });

  const EXTRA = [
    // TRX
    T('trx-row', 'TRX Row', ['lats', 'biceps'], 'Lean back, body straight, pull your chest to the handles. Walk feet in to make it harder.'),
    T('trx-single-arm-row', 'TRX Single Arm Row', ['lats', 'biceps'], 'One handle, rotate open at the bottom, pull square at the top. Switch arms halfway.'),
    T('trx-chest-press', 'TRX Chest Press', ['chest', 'triceps'], 'Face away, lean into the straps, lower the chest between the hands and press back.'),
    T('trx-chest-fly', 'TRX Chest Fly', ['chest', 'shoulders'], 'Face away, arms wide with a soft bend, hug the arms back together.'),
    T('trx-atomic-push-up', 'TRX Atomic Push Up', ['chest', 'abs'], 'Feet in the straps, one push-up, then tuck knees to chest.'),
    T('trx-bicep-curl', 'TRX Bicep Curl', ['biceps'], 'Face the anchor, palms up, elbows high and still. Curl hands to your forehead.'),
    T('trx-triceps-press', 'TRX Triceps Press', ['triceps'], 'Face away, elbows high, bend to bring hands beside the head, press straight.'),
    T('trx-y-fly', 'TRX Y Fly', ['shoulders'], 'Face the anchor, arms straight, pull up and out into a Y.'),
    T('trx-t-fly', 'TRX T Fly', ['shoulders', 'lats'], 'Face the anchor, arms straight, open wide into a T. Squeeze the shoulder blades.'),
    T('trx-face-pull', 'TRX Face Pull', ['shoulders'], 'Palms down, pull the handles to your forehead with elbows high and wide.'),
    T('trx-squat', 'TRX Squat', ['quads'], 'Hold the straps, sit back to a deep squat, stand tall.'),
    T('trx-jump-squat', 'TRX Jump Squat', ['quads', 'glutes'], 'Squat with the straps for balance, jump up, land soft.'),
    T('trx-pistol-squat', 'TRX Pistol Squat', ['quads', 'glutes'], 'One leg out front, squat low on the other using the straps. Switch halfway.'),
    T('trx-suspended-lunge', 'TRX Suspended Lunge', ['quads', 'glutes'], 'Back foot in a cradle, lower the back knee, drive up through the front heel. Switch halfway.'),
    T('trx-crossing-lunge', 'TRX Crossing Balance Lunge', ['glutes', 'abductors'], 'Hold the straps, step one leg back and across behind you, sink, return. Alternate.'),
    T('trx-side-lunge', 'TRX Side Lunge', ['quads', 'glutes'], 'Hold the straps, step wide and sit into one hip, push back to center. Alternate.'),
    T('trx-hamstring-curl', 'TRX Hamstring Curl', ['hamstrings', 'glutes'], 'Heels in the cradles, hips up, pull heels to your glutes.'),
    T('trx-hip-press', 'TRX Hip Press', ['glutes', 'hamstrings'], 'Heels in the cradles, press hips up high, lower slowly.'),
    T('trx-knee-tuck', 'TRX Knee Tuck', ['abs'], 'Feet in the straps, high plank, pull knees to chest.'),
    T('trx-pike', 'TRX Pike', ['abs', 'shoulders'], 'Feet in the straps, straight legs, lift hips to the ceiling.'),
    T('trx-mountain-climber', 'TRX Mountain Climber', ['abs'], 'Feet in the straps, high plank, drive knees in one at a time.'),
    T('trx-plank', 'TRX Plank', ['abs'], 'Feet in the straps, forearms down, body in one line.'),
    T('trx-side-plank', 'TRX Side Plank', ['abs'], 'Feet stacked in the straps, elbow under shoulder, hips high. Switch halfway.'),
    T('trx-calf-raise', 'TRX Calf Raise', ['calves'], 'Hold the straps for balance, rise high onto your toes, lower slowly.'),
    // Dumbbell: upper
    D('db-bench-press', 'Dumbbell Bench Press', ['chest'], 17.5, 'Feet planted, shoulder blades squeezed. Press up over the chest.'),
    D('db-incline-press', 'Incline Dumbbell Press', ['chest', 'shoulders'], 15, 'Bench at 30°. Press up and slightly back over the upper chest.'),
    D('db-floor-press', 'Dumbbell Floor Press', ['chest', 'triceps'], 17.5, 'On your back, elbows touch the floor, press up.'),
    D('db-fly', 'Dumbbell Fly', ['chest'], 10, 'Soft elbows, open wide until you feel the chest stretch, hug back up.'),
    D('db-pullover', 'Dumbbell Pullover', ['lats', 'chest'], 15, 'One dumbbell, arms long, lower behind your head and pull back over the chest.'),
    D('db-row', 'Dumbbell Row', ['lats'], 15, 'Hinge with a flat back, pull the elbow to your hip. Switch halfway.'),
    D('db-bent-over-row', 'Bent-Over Dumbbell Row', ['lats', 'biceps'], 15, 'Both arms, hinge to 45°, pull the dumbbells to your hips.'),
    D('db-renegade-row', 'Renegade Row', ['lats', 'abs'], 10, 'High plank on the dumbbells, row one, then the other. Hips stay level.'),
    D('db-reverse-fly', 'Dumbbell Reverse Fly', ['shoulders', 'lats'], 5, 'Hinge forward, arms out wide, squeeze the shoulder blades.'),
    D('db-shoulder-press', 'Dumbbell Shoulder Press', ['shoulders', 'triceps'], 10, 'Press overhead, ribs down. Lower to ear height.'),
    D('db-arnold-press', 'Arnold Press', ['shoulders'], 10, 'Start palms in at the chin, rotate out as you press overhead.'),
    D('side-lateral-front-raise', 'Side Laterals to Front Raise', ['shoulders'], 5, 'Raise to the sides to shoulder height, lower, then raise to the front.'),
    D('db-lateral-raise', 'Lateral Raise', ['shoulders'], 5, 'Slight bend in the elbows, raise to shoulder height, lower slowly.'),
    D('db-front-raise', 'Front Raise', ['shoulders'], 5, 'Arms straight, raise to eye level, lower slowly.'),
    D('db-upright-row', 'Dumbbell Upright Row', ['shoulders'], 10, 'Pull the dumbbells up the front of your body, elbows lead, stop at chest height.'),
    D('db-bicep-curl', 'Dumbbell Bicep Curl', ['biceps'], 15, 'Elbows pinned to your sides. Lower slowly.'),
    D('hammer-curl', 'Hammer Curl', ['biceps'], 15, 'Palms facing in, elbows still.'),
    D('db-concentration-curl', 'Concentration Curl', ['biceps'], 12.5, 'Seated, elbow on the inner thigh, curl up and squeeze. Switch halfway.'),
    D('db-kickback', 'Dumbbell Kickbacks', ['triceps'], 10, 'Hinge forward, upper arm still. Straighten the elbow all the way back.'),
    D('db-overhead-extension', 'Overhead Triceps Extension', ['triceps'], 12.5, 'One dumbbell in both hands overhead, lower behind your head, press up.'),
    D('db-skull-crusher', 'Dumbbell Skull Crusher', ['triceps'], 10, 'On your back, elbows point up, lower the weights beside your head.'),
    // Dumbbell: lower and core
    D('goblet-squat', 'Goblet Squat', ['quads', 'glutes'], 20, 'Dumbbell at the chest, sit between your heels, chest up.'),
    D('db-sumo-squat', 'Dumbbell Sumo Squat', ['quads', 'glutes'], 20, 'Wide stance, toes out, one dumbbell hanging. Sit straight down.'),
    D('db-lunge', 'Dumbbell Lunge', ['quads'], 5, 'Step forward, both knees to 90°. Push back up through the front heel.'),
    D('db-reverse-lunge', 'Dumbbell Reverse Lunge', ['quads', 'glutes'], 10, 'Step back, lower the back knee, drive up through the front foot.'),
    D('db-lateral-lunge', 'Dumbbell Lateral Lunge', ['quads', 'glutes'], 10, 'Step wide, sit into one hip, push back to center. Alternate.'),
    D('db-split-squat', 'Bulgarian Split Squat', ['quads', 'glutes'], 10, 'Back foot on a bench, lower straight down. Switch halfway.'),
    D('db-step-up', 'Dumbbell Step Up', ['quads', 'glutes'], 10, 'Step onto a bench, drive through the top foot, step down slowly. Alternate.'),
    D('db-rdl', 'Dumbbell Romanian Deadlift', ['hamstrings', 'glutes'], 20, 'Soft knees, hinge at the hips, weights slide down the thighs.'),
    D('db-single-leg-rdl', 'Single Leg Romanian Deadlift', ['hamstrings', 'glutes'], 15, 'Hinge on one leg, the other reaches back. Hips square. Switch halfway.'),
    D('db-hip-thrust', 'Dumbbell Hip Thrust', ['glutes'], 25, 'Upper back on a bench, dumbbell on the hips, drive up and squeeze.'),
    D('db-glute-bridge', 'Dumbbell Glute Bridge', ['glutes', 'hamstrings'], 20, 'On your back, dumbbell on the hips, press up and squeeze.'),
    D('db-calf-raise', 'Dumbbell Calf Raise', ['calves'], 15, 'Dumbbells at your sides, rise high, lower slowly.'),
    D('db-russian-twist', 'Russian Twist', ['abs'], 10, 'Lean back, feet up if you can, rotate the dumbbell side to side.'),
    D('db-woodchop', 'Dumbbell Woodchop', ['abs', 'shoulders'], 10, 'Swing the dumbbell from high on one side to low on the other, rotating. Switch halfway.'),
    D('db-suitcase-carry', 'Suitcase Carry', ['abs'], 25, 'One heavy dumbbell at your side, walk tall without leaning. Switch halfway.'),
    // Bodyweight
    B('pull-up', 'Pull Up', ['lats'], 'Full hang to chin over the bar. Use a band or jump and lower slowly if needed.'),
    B('push-up', 'Push Up', ['chest', 'triceps'], 'Hands under shoulders, body in one line. Knees down is fine.'),
    B('triceps-dip', 'Bench Dip', ['triceps'], 'Hands on a bench behind you, lower until elbows reach 90°, press up.'),
    B('plank', 'Plank', ['abs'], 'Forearms down, body in one line. Squeeze glutes, breathe.'),
    B('side-plank', 'Side Plank', ['abs'], 'Elbow under shoulder, hips high. Switch sides halfway.'),
    B('dead-bug', 'Dead Bug', ['abs'], 'Low back pressed down, lower opposite arm and leg slowly.'),
    B('bicycle-crunch', 'Bicycle Crunch', ['abs'], 'Elbow toward the opposite knee, other leg long. Slow and controlled.'),
    B('hollow-hold', 'Hollow Hold', ['abs'], 'Low back down, arms and legs long and just off the floor.'),
    B('mountain-climber', 'Mountain Climber', ['abs'], 'High plank, drive knees in one at a time.'),
    B('cat-cow', 'Cat Cow', ['lower-back'], 'On hands and knees. Round the back up, then let the belly drop. Move with your breath.'),
    B('superman', 'Superman', ['lower-back', 'glutes'], 'Face down, lift arms and legs, hold a beat, lower.'),
    B('bodyweight-squat', 'Bodyweight Squat', ['quads', 'glutes'], 'Feet shoulder width, sit back and down, stand tall.'),
    B('reverse-lunge', 'Reverse Lunge', ['quads'], 'Step back, lower the back knee, drive up through the front foot.'),
    B('glute-bridge', 'Glute Bridge', ['glutes', 'hamstrings'], 'Feet flat, drive hips up, squeeze at the top.'),
    B('single-leg-kickback', 'Single Leg Kickback', ['glutes'], 'On hands and knees, kick one heel up to the ceiling. Switch halfway.'),
    B('fire-hydrant', 'Fire Hydrant', ['glutes', 'abductors'], 'On hands and knees, lift one bent knee out to the side. Switch halfway.'),
    B('standing-hip-abduction', 'Standing Hip Abduction', ['abductors'], 'Stand tall, lift one leg out to the side without leaning. Switch halfway.'),
    B('side-lying-leg-raise', 'Side-Lying Leg Raise', ['abductors'], 'On your side, top leg straight, lift and lower slowly. Switch halfway.'),
    B('clamshell', 'Clamshell', ['abductors', 'glutes'], 'On your side, knees bent, open the top knee without rolling back. Switch halfway.'),
    B('calf-raise', 'Calf Raise', ['calves'], 'Rise onto the balls of your feet, lower slowly.'),
    // Stretches (warm-up and cool-down)
    DY('arm-circle-forward', 'Forward Arm Circle', ['shoulders'], 'Arms out to the sides, small forward circles getting bigger.'),
    DY('leg-swing', 'Leg Swing', ['hamstrings', 'glutes'], 'Hold a wall, swing one leg forward and back, relaxed.', { sides: 'each' }),
    DY('worlds-greatest', 'World’s Greatest Stretch', ['quads', 'hamstrings'], 'Lunge, elbow to the instep, rotate the arm up to the ceiling.', { sides: 'each', reps: 5 }),
    DY('torso-twist', 'Standing Torso Twist', ['abs', 'lower-back'], 'Feet planted, arms loose, rotate side to side.', { reps: 10 }),
    DY('inchworm', 'Inchworm', ['hamstrings', 'abs'], 'Fold forward, walk hands out to a plank, walk back up.', { reps: 5 }),
    ST('thread-the-needle', 'Thread the Needle', ['lats', 'shoulders'], 'On hands and knees, slide one arm under the other and rest the shoulder down.', { sides: 'each' }),
    ST('cobra', 'Cobra', ['abs'], 'Face down, press up through the hands, hips stay down.'),
    ST('standing-side-bend', 'Standing Side Bend', ['lats'], 'Reach one arm overhead and lean the other way.', { sides: 'each' }),
    ST('pigeon', 'Pigeon Pose', ['glutes'], 'Front shin across the mat, back leg long, fold forward.', { sides: 'each', seconds: 45 }),
    ST('hamstring-stretch', 'Seated Hamstring Stretch', ['hamstrings'], 'One leg straight, reach toward the toes with a long back.', { sides: 'each' }),
    ST('calf-stretch', 'Wall Calf Stretch', ['calves'], 'Hands on a wall, back heel down, lean in.', { sides: 'each' }),
  ];

  const STRETCH_KINDS = new Set(['static', 'dynamic']);

  /**
   * The exercise library: every built-in exercise once, by name, each with
   * its `equipment`. Exercises in the seed days that aren't listed above are
   * included too (as bodyweight or stretch).
   */
  function library() {
    const all = [];
    const seen = new Set();
    const add = (it) => {
      if (seen.has(it.name)) return;
      seen.add(it.name);
      all.push({ ...it, equipment: it.equipment || (STRETCH_KINDS.has(it.kind) ? 'stretch' : 'bodyweight') });
    };
    EXTRA.forEach(add);
    for (const d of Object.values(SEED_DAYS)) [...d.warmup, ...d.blocks.flatMap((b) => b.items), ...d.cooldown].forEach(add);
    return all.map((x) => JSON.parse(JSON.stringify(x)));
  }

  const EQUIPMENT = { trx: 'TRX', dumbbell: 'Dumbbell', bodyweight: 'Bodyweight', stretch: 'Stretch' };

  /**
   * Filter the library. kind: 'interval' (TRX, dumbbell, bodyweight) or 'stretch'.
   * equipment: '' for all. muscle: '' for all. q: words that must all appear in the name.
   * Exercises for `prefer` muscles come first, then alphabetical.
   */
  function filterLibrary(lib, { kind = 'interval', equipment = '', muscle = '', q = '', prefer = [] } = {}) {
    const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    const pref = new Set(prefer);
    const rank = (x) => (x.muscles.some((m) => pref.has(m)) ? 0 : 1);
    return lib
      .filter((x) => (kind === 'stretch' ? x.equipment === 'stretch' : x.equipment !== 'stretch'))
      .filter((x) => !equipment || x.equipment === equipment)
      .filter((x) => !muscle || x.muscles.includes(muscle))
      .filter((x) => words.every((w) => x.name.toLowerCase().includes(w) || (EQUIPMENT[x.equipment] || '').toLowerCase() === w))
      .sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
  }

  /**
   * A library exercise ready to drop into a day. Intervals keep `seconds` (so a
   * block stays even) and use the weight you last used for it, if any.
   */
  function fromLibrary(entry, { kind, seconds, last } = {}) {
    const it = cleanItem({ ...entry, id: `x-${rid()}`, trend: null }, kind === 'interval' ? 'interval' : 'static');
    if (kind === 'interval') {
      it.kind = 'interval';
      if (seconds) it.seconds = seconds;
      if (last && last.weight && entry.equipment === 'dumbbell') it.weight = last.weight;
    } else if (it.kind === 'interval') {
      it.kind = 'static';
    }
    return it;
  }

  function defaultSettings() {
    return {
      tones: true,
      repSeconds: 3, // pace for dynamic stretches
    };
  }

  function freshState() {
    return {
      days: JSON.parse(JSON.stringify(SEED_DAYS)),
      current: 'upper',
      settings: defaultSettings(),
      sessions: [],
      active: null,
    };
  }

  // ---------- validation ----------

  const KINDS = ['static', 'dynamic', 'interval'];
  const int = (v, min, max, d) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : d);
  const str = (v, d = '') => (typeof v === 'string' ? v : d);
  const isKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const rid = () => Math.random().toString(36).slice(2, 10);

  /** Weight in lb, rounded to 0.5; null for bodyweight. */
  function cleanWeight(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(1000, Math.round(n * 2) / 2);
  }

  function cleanItem(x, kindHint) {
    if (!x || typeof x !== 'object' || !str(x.name).trim()) return null;
    const kind = KINDS.includes(x.kind) ? x.kind : kindHint;
    return {
      id: str(x.id) || `x-${rid()}`,
      name: str(x.name).trim().slice(0, 80),
      muscles: Array.isArray(x.muscles) ? [...new Set(x.muscles.filter((m) => MUSCLES[m]))] : [],
      kind,
      sets: int(x.sets, 1, 10, 2),
      seconds: int(x.seconds, 5, 600, kind === 'interval' ? 45 : 15),
      reps: int(x.reps, 1, 100, 8),
      weight: cleanWeight(x.weight),
      sides: x.sides === 'each' ? 'each' : 'none',
      cue: str(x.cue).slice(0, 400),
      trend: x.trend === 'up' || x.trend === 'down' ? x.trend : null,
    };
  }

  function cleanStretches(list, counter) {
    if (!Array.isArray(list)) return [];
    return list.map((x) => {
      const it = cleanItem(x, 'static');
      if (!it) { counter.n++; return null; }
      if (it.kind === 'interval') it.kind = 'static';
      return it;
    }).filter(Boolean);
  }

  function cleanBlock(b, counter) {
    if (!b || typeof b !== 'object' || !Array.isArray(b.items)) { counter.n++; return null; }
    return {
      id: str(b.id) || `b-${rid()}`,
      rounds: int(b.rounds, 1, 10, 3),
      rest: int(b.rest, 0, 300, 15),
      roundRest: int(b.roundRest, 0, 600, 30),
      items: b.items.map((x) => {
        const it = cleanItem(x, 'interval');
        if (!it) { counter.n++; return null; }
        it.kind = 'interval';
        return it;
      }).filter(Boolean),
    };
  }

  function cleanDay(d, fallback, counter) {
    if (!d || typeof d !== 'object') { counter.n++; return JSON.parse(JSON.stringify(fallback)); }
    return {
      id: fallback.id,
      name: str(d.name).trim().slice(0, 60) || fallback.name,
      warmupOn: d.warmupOn !== false,
      cooldownOn: d.cooldownOn !== false,
      warmup: cleanStretches(d.warmup, counter),
      blocks: Array.isArray(d.blocks) ? d.blocks.map((b) => cleanBlock(b, counter)).filter(Boolean) : [],
      cooldown: cleanStretches(d.cooldown, counter),
    };
  }

  function cleanResult(r) {
    if (!r || typeof r !== 'object' || typeof r.name !== 'string') return null;
    return {
      id: str(r.id),
      name: r.name,
      section: ['warmup', 'block', 'cooldown'].includes(r.section) ? r.section : 'block',
      muscles: Array.isArray(r.muscles) ? r.muscles.filter((m) => MUSCLES[m]) : [],
      weight: cleanWeight(r.weight),
      done: int(r.done, 0, 1000, 0),
      target: int(r.target, 0, 1000, 0),
      status: ['done', 'partial', 'skipped', 'not reached'].includes(r.status) ? r.status : 'partial',
      rating: ['easy', 'right', 'hard'].includes(r.rating) ? r.rating : null,
    };
  }

  /** Validate loaded/imported data. Returns { state, dropped } where dropped counts unreadable records. */
  function normalize(raw) {
    const base = freshState();
    if (!raw || typeof raw !== 'object') return { state: base, dropped: 1 };
    const counter = { n: 0 };
    const rawDays = raw.days && typeof raw.days === 'object' ? raw.days : {};
    const days = {
      upper: rawDays.upper ? cleanDay(rawDays.upper, SEED_DAYS.upper, counter) : base.days.upper,
      lower: rawDays.lower ? cleanDay(rawDays.lower, SEED_DAYS.lower, counter) : base.days.lower,
    };
    const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const settings = {
      tones: s.tones !== false,
      repSeconds: int(s.repSeconds, 2, 6, 3),
    };
    const sessions = [];
    for (const x of Array.isArray(raw.sessions) ? raw.sessions : []) {
      if (!x || !isKey(x.date) || !Array.isArray(x.results)) { counter.n++; continue; }
      sessions.push({
        id: str(x.id) || `s-${rid()}`,
        date: x.date,
        dayId: x.dayId === 'lower' ? 'lower' : 'upper',
        dayName: str(x.dayName) || (x.dayId === 'lower' ? 'Lower Body Day' : 'Upper Body Day'),
        startedAt: Number(x.startedAt) || 0,
        endedAt: Number(x.endedAt) || 0,
        durationSec: int(x.durationSec, 0, 86400, 0),
        status: x.status === 'completed' ? 'completed' : 'ended',
        completionPct: Math.min(100, Math.max(0, Number(x.completionPct) || 0)),
        results: x.results.map(cleanResult).filter(Boolean),
        note: str(x.note).slice(0, 2000),
        reviewed: !!x.reviewed,
      });
    }
    let active = null;
    const a = raw.active;
    if (a && typeof a === 'object' && isKey(a.date) && a.snapshot && typeof a.snapshot === 'object') {
      const id = a.snapshot.id === 'lower' ? 'lower' : 'upper';
      const c2 = { n: 0 };
      active = {
        id: str(a.id) || `s-${rid()}`,
        date: a.date,
        startedAt: Number(a.startedAt) || Date.now(),
        snapshot: cleanDay(a.snapshot, SEED_DAYS[id], c2),
        repSeconds: int(a.repSeconds, 2, 6, 3),
        stepIndex: int(a.stepIndex, 0, 100000, 0),
        done: Array.isArray(a.done) ? a.done.filter(Number.isInteger) : [],
        activeMs: Math.max(0, Number(a.activeMs) || 0),
      };
    }
    return {
      state: { days, current: raw.current === 'lower' ? 'lower' : 'upper', settings, sessions, active },
      dropped: counter.n,
    };
  }

  // ---------- describing ----------

  /** 45 → "0:45", 90 → "1:30" */
  function clock(sec) {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }

  function lb(w) {
    return `${w % 1 ? w.toFixed(1) : w} lb`;
  }

  /** "3 intervals · 15 lb · 0:45 Each" / "Static Stretch · 2 sets · 0:15" */
  function describe(item, rounds) {
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (item.kind === 'interval') {
      return [plural(rounds, 'interval'), item.weight ? lb(item.weight) : '', `${clock(item.seconds)} each`].filter(Boolean).join(' · ');
    }
    const side = item.sides === 'each' ? ' per side' : '';
    if (item.kind === 'dynamic') return `Dynamic stretch · ${plural(item.sets, 'set')} · ${item.reps} reps${side}`;
    return `Static stretch · ${plural(item.sets, 'set')} · ${clock(item.seconds)}${side}`;
  }

  /** Every exercise in a day in workout order, tagged with where it sits. */
  function flatten(day, opts = {}) {
    const all = opts.all === true;
    const out = [];
    if (all || day.warmupOn) day.warmup.forEach((it) => out.push({ item: it, section: 'warmup', block: -1, rounds: it.sets }));
    day.blocks.forEach((b, bi) => b.items.forEach((it) => out.push({ item: it, section: 'block', block: bi, rounds: b.rounds })));
    if (all || day.cooldownOn) day.cooldown.forEach((it) => out.push({ item: it, section: 'cooldown', block: -1, rounds: it.sets }));
    return out;
  }

  /** Counts for the header: "14 Exercises • 7 Muscles" (everything in the day, on or off). */
  function dayStats(day) {
    const flat = flatten(day, { all: true });
    const muscles = new Set(flat.flatMap((f) => f.item.muscles));
    return { exercises: flat.length, muscles: muscles.size, muscleIds: [...muscles] };
  }

  // ---------- plan ----------

  const INTRO_SECONDS = 6;
  const READY_SECONDS = 5;
  const SET_REST = 10;
  const SIDE_REST = 5;

  function stretchSeconds(item, repSeconds) {
    return item.kind === 'dynamic' ? item.reps * repSeconds : item.seconds;
  }

  /**
   * Step: { kind: 'intro'|'ready'|'work'|'rest', ex (index into flatten()), duration (s),
   *         section, block, round, rounds, side, label, next (ex of the upcoming work, for rests) }
   */
  function buildPlan(day, opts = {}) {
    const repSeconds = opts.repSeconds || 3;
    const flat = flatten(day);
    const steps = [];
    const push = (s) => steps.push({ side: null, round: 0, rounds: 0, next: null, ...s });

    const stretch = (fi) => {
      const f = flat[fi];
      const it = f.item;
      const dur = stretchSeconds(it, repSeconds);
      const sides = it.sides === 'each' ? ['left', 'right'] : [null];
      push({ kind: 'intro', ex: fi, duration: INTRO_SECONDS, section: f.section, block: -1, label: f.section === 'warmup' ? 'Warm-up' : 'Cool-down' });
      push({ kind: 'ready', ex: fi, duration: 3, section: f.section, block: -1, label: 'Get ready', side: sides[0], round: 1, rounds: it.sets });
      for (let s = 1; s <= it.sets; s++) {
        sides.forEach((side, si) => {
          if (si > 0) push({ kind: 'rest', ex: fi, duration: SIDE_REST, section: f.section, block: -1, label: 'Switch sides', side, round: s, rounds: it.sets, next: fi });
          push({ kind: 'work', ex: fi, duration: dur, section: f.section, block: -1, label: it.kind === 'dynamic' ? 'Move' : 'Hold', side, round: s, rounds: it.sets });
        });
        if (s < it.sets) push({ kind: 'rest', ex: fi, duration: SET_REST, section: f.section, block: -1, label: 'Rest', side: sides[0], round: s + 1, rounds: it.sets, next: fi });
      }
    };

    flat.forEach((f, fi) => { if (f.section === 'warmup') stretch(fi); });

    day.blocks.forEach((b, bi) => {
      const idx = flat.map((f, fi) => (f.section === 'block' && f.block === bi ? fi : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      push({ kind: 'intro', ex: idx[0], duration: INTRO_SECONDS + 2, section: 'block', block: bi, label: 'Timed intervals', round: 1, rounds: b.rounds });
      push({ kind: 'ready', ex: idx[0], duration: READY_SECONDS, section: 'block', block: bi, label: 'Get ready', round: 1, rounds: b.rounds });
      for (let r = 1; r <= b.rounds; r++) {
        idx.forEach((fi, k) => {
          if (r > 1 || k > 0) {
            const between = k === 0;
            const dur = between ? b.roundRest : b.rest;
            if (dur > 0) push({ kind: 'rest', ex: fi, duration: dur, section: 'block', block: bi, label: between ? 'Round rest' : 'Rest', round: r, rounds: b.rounds, next: fi });
          }
          push({ kind: 'work', ex: fi, duration: flat[fi].item.seconds, section: 'block', block: bi, label: 'Work', round: r, rounds: b.rounds });
        });
      }
    });

    flat.forEach((f, fi) => { if (f.section === 'cooldown') stretch(fi); });
    return steps;
  }

  function workTargets(steps, n) {
    const t = new Array(n).fill(0);
    for (const s of steps) if (s.kind === 'work') t[s.ex]++;
    return t;
  }

  function workDone(steps, done, n) {
    const d = new Array(n).fill(0);
    for (const i of done) if (steps[i] && steps[i].kind === 'work') d[steps[i].ex]++;
    return d;
  }

  /** "Back": restart this work if well into it, else the previous work step, else stay. */
  function backTarget(steps, index, elapsedMs) {
    const cur = steps[index];
    if (!cur) return index;
    if (cur.kind === 'work' && elapsedMs > 2000) return index;
    for (let j = index - 1; j >= 0; j--) if (steps[j].kind === 'work') return j;
    return 0;
  }

  function estimateSeconds(steps) {
    return steps.reduce((sum, s) => sum + s.duration, 0);
  }

  function sectionSeconds(day, section, repSeconds = 3) {
    const d = { ...day, warmupOn: section === 'warmup', cooldownOn: section === 'cooldown', blocks: section === 'block' ? day.blocks : [] };
    return estimateSeconds(buildPlan(d, { repSeconds }));
  }

  /** Per-exercise results and completion % for a finished (or ended) session. */
  function summarize(day, steps, done, status, index) {
    const flat = flatten(day);
    const targets = workTargets(steps, flat.length);
    const got = workDone(steps, done, flat.length);
    const reachedStep = status === 'completed' ? steps.length : index;
    const results = flat.map((f, i) => {
      const reached = steps.some((s, si) => s.ex === i && si < reachedStep);
      const status2 = got[i] >= targets[i] ? 'done' : got[i] > 0 ? 'partial' : reached ? 'skipped' : 'not reached';
      return {
        id: f.item.id, name: f.item.name, section: f.section, muscles: f.item.muscles.slice(),
        weight: f.item.weight, done: got[i], target: targets[i], status: status2, rating: null,
      };
    });
    const total = targets.reduce((a, b) => a + b, 0);
    const sum = got.reduce((a, b) => a + b, 0);
    return { results, completionPct: total ? Math.round((sum / total) * 100) : 0 };
  }

  // ---------- progression ----------

  /** Smallest sensible dumbbell jump for this weight. */
  function weightStep(w) {
    return w < 25 ? 2.5 : 5;
  }

  /**
   * What tapping the ↑/↓ arrow does. Weighted: next dumbbell up or down.
   * Bodyweight: 5 seconds more or less per interval.
   */
  function progress(item, dir) {
    const up = dir === 'up';
    if (item.weight) {
      const step = up ? weightStep(item.weight) : weightStep(item.weight - 0.01);
      const w = Math.max(0, item.weight + (up ? step : -step));
      return { weight: w > 0 ? w : null, seconds: item.seconds };
    }
    return { weight: null, seconds: Math.min(120, Math.max(15, item.seconds + (up ? 5 : -5))) };
  }

  function trendFor(rating) {
    return rating === 'easy' ? 'up' : rating === 'hard' ? 'down' : null;
  }

  /** Which day to suggest next: the other one from the last completed workout. */
  function nextDay(sessions, fallback) {
    const last = sessions.filter((s) => s.status === 'completed').sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!last) return fallback;
    return last.dayId === 'upper' ? 'lower' : 'upper';
  }

  // ---------- history ----------

  function workoutDays(sessions) {
    return new Set(sessions.filter((s) => s.status === 'completed' || s.completionPct >= 50).map((s) => s.date));
  }

  /** Consecutive weeks (Mon–Sun) with at least `perWeek` workouts, ending this week (or last, if this one isn't there yet). */
  function weekStreak(sessions, today, perWeek = 2) {
    const days = workoutDays(sessions);
    const count = (ws) => { let n = 0; for (let i = 0; i < 7; i++) if (days.has(addDays(ws, i))) n++; return n; };
    let ws = weekStart(today);
    if (count(ws) < perWeek) ws = addDays(ws, -7);
    let n = 0;
    while (count(ws) >= perWeek) { n++; ws = addDays(ws, -7); }
    return n;
  }

  function weekCount(sessions, today) {
    const ws = weekStart(today);
    const days = workoutDays(sessions);
    let n = 0;
    for (let i = 0; i < 7; i++) if (days.has(addDays(ws, i))) n++;
    return n;
  }

  /**
   * For each muscle: when it was last worked and how many times in the last 7 days.
   * A muscle counts when at least one interval or stretch for it was done.
   */
  function muscleReport(sessions, today) {
    const from = addDays(today, -6);
    const out = {};
    for (const id of MUSCLE_IDS) out[id] = { id, name: MUSCLES[id].name, last: null, week: 0, sets: 0 };
    const seenDay = {};
    for (const s of sessions) {
      for (const r of s.results) {
        if (!r.done) continue;
        for (const m of r.muscles) {
          const o = out[m];
          if (!o) continue;
          if (!o.last || s.date > o.last) o.last = s.date;
          if (s.date >= from && s.date <= today) {
            o.sets += r.section === 'block' ? r.done : 0;
            const k = `${m}|${s.date}`;
            if (!seenDay[k]) { seenDay[k] = true; o.week++; }
          }
        }
      }
    }
    return out;
  }

  /** Last weight used for an exercise name, from history. */
  function lastWeight(sessions, name) {
    const s = sessions.slice().sort((a, b) => b.startedAt - a.startedAt);
    for (const x of s) {
      const r = x.results.find((y) => y.name === name && y.done > 0);
      if (r) return { weight: r.weight, date: x.date };
    }
    return null;
  }

  return {
    toKey, fromKey, addDays, diffDays, weekday, weekStart,
    MUSCLES, MUSCLE_IDS, SEED_DAYS, library, EQUIPMENT, filterLibrary, fromLibrary, defaultSettings, freshState, normalize, cleanItem, cleanWeight,
    clock, lb, describe, flatten, dayStats,
    INTRO_SECONDS, READY_SECONDS, buildPlan, workTargets, workDone, backTarget, estimateSeconds, sectionSeconds, summarize,
    weightStep, progress, trendFor, nextDay,
    workoutDays, weekStreak, weekCount, muscleReport, lastWeight,
  };
});
