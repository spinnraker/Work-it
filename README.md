# Work it

Upper body and lower body interval workouts that run themselves: warm-up, timed circuits, then cool-down stretches. It calls out each exercise and the weight to grab, times every interval and rest, and keeps your log. Same look and setup as Habito, DTF and Pomo: black and white, no account, works offline.

## Use it

```sh
npm start          # http://localhost:8080
npm test           # engine tests
```

No dependencies and no build step. To put it on your iPhone, host the folder on any static host (GitHub Pages works: Settings → Pages → deploy from this branch), open it in Safari, then Share → Add to Home Screen. It runs full-screen and offline. Data stays on the device; use ⋯ → Export backup to keep a copy.

## The two days

**Upper Body Day**: 14 exercises · 7 muscles

| Section | Exercises |
|---|---|
| Warm-up | Chest Expansion (static, 2 × 0:15) · Bench T-Spine Stretch (static, 2 × 0:15) · Backward Arm Circle (dynamic, 2 × 8 reps) |
| Timed intervals · 3 rounds | Pull Up · Dumbbell Bicep Curl 15 lb · Dumbbell Bench Press 17.5 lb · Side Laterals to Front Raise 5 lb (0:45 each) |
| Timed intervals · 3 rounds | Dumbbell Kickbacks 10 lb (0:45) |
| Timed intervals · 3 rounds | Plank · Cat Cow (0:45 each) |
| Cool-down | Doorway Chest Stretch · Cross-Body Shoulder Stretch · Overhead Triceps Stretch · Child’s Pose |

**Lower Body Day**: 13 exercises · 5 muscles

| Section | Exercises |
|---|---|
| Warm-up | Lunge with Ankle Grab (static, 2 × 0:15 per side) · Bird Dog (dynamic, 2 × 8 reps) |
| Timed intervals · 3 rounds | Dumbbell Lunge 5 lb · Single Leg Kickback · Reverse Lunge · Standing Hip Abduction (0:45 each) |
| Timed intervals · 3 rounds | TRX Squat · Plank · Cat Cow (0:45 each) |
| Cool-down | Standing Quad Stretch · Figure-Four Stretch · Seated Hip Cross-Over · Knees to Chest |

The cool-down stretches target the muscles that day works, so they don't add to the muscle count. **Switch** flips between the days. Finishing a workout sets up the other day for next time.

## The workout

Tap **Start workout** and put the phone where you can see it.

- **Warm-up and cool-down**: each stretch gets a "Next up" card (6 s, the voice names it), a short get-ready, then the hold or the reps. Dynamic stretches are paced at 3 s a rep (change it in ⋯). "Each side" stretches do left, then right.
- **Timed intervals** run as a circuit: every exercise in the block once, then the next round. 15 s rest between exercises, 30 s between rounds. During each rest the voice calls the next exercise and its weight ("Rest. Next: Dumbbell bench press, 17.5 pounds"), and the screen says which dumbbells to grab.
- A high tone starts each interval, ticks count down the last 3 seconds, a falling pair ends it. "Halfway" is called on intervals of 30 s or more.
- Controls: **Back** restarts the interval (or goes to the previous one), **Pause**, **Skip** (skips a rest, or moves on without counting the interval), **End**.
- The screen stays awake. Switching away pauses. Closing or reloading keeps your place; tap **Resume workout**.

## Getting stronger: the ↑ / ↓ arrows

After a workout, rate each interval exercise **Too easy**, **Just right** or **Too hard**. Next time, too easy shows ↑ next to it and too hard shows ↓. Tap the arrow to apply it:

- With dumbbells: the next dumbbell up or down (2.5 lb steps under 25 lb, 5 lb above).
- Bodyweight: 5 seconds more or less per interval.

Editing an exercise shows the weight you used last time.

## Editing

- **⋯ on an exercise**: name, muscles, interval length, weight (or sets, hold, reps and sides for stretches), a one-line form cue, move up/down, remove.
- **⋯ on a block**: rounds, rest between exercises, rest between rounds, set every interval in the block at once, move or delete the block.
- **⋯ on Warm-up / Cool-down**: turn it off for the workout, add a stretch.
- **Add exercise**: pick from the built-in list (exercises for this day's muscles come first) or type your own, and choose where it goes: warm-up, a block, a new block, or cool-down.

## Body and Log

- **Body**: front and back diagrams with the muscles you worked in the last 7 days, and for each muscle how many workouts hit it this week and when you last worked it.
- **Log**: workouts this week, a week streak (weeks with 2+ workouts), a month calendar (filled = finished, ring = ended early), and every workout with what you did, the weights, your ratings and your note.

## How it works

- `engine.js` is pure logic: seed days, validation, the step plan, results, progression and history stats. `test/engine.test.js` covers it.
- Starting a workout snapshots the day and compiles it into a flat list of timed steps (intro → get ready → work → rest …). `app.js` walks that list with a wall-clock timer, so pause, back and resume-after-reload stay accurate. Editing a day only changes future workouts.
- State is saved to `localStorage` (`workit:v1`). Saved and imported data is validated on load. Anything that can't be read is set aside under a `workit:v1:unreadable:*` key instead of being overwritten.
- `sw.js` caches the app for offline use. Bump `CACHE` when you ship changes.
- Exercise thumbnails are simple muscle diagrams drawn in SVG; there are no photos.
