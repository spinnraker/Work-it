# Work it

Upper body and lower body interval workouts that run themselves: warm-up, timed circuits, then cool-down stretches. It times every interval and rest with sounds (no voice), shows the next exercise and the weight to grab, and keeps your log. Same look and setup as Habito, DTF and Pomo: black and white, no account, works offline.

## Use it

```sh
npm start          # http://localhost:8080
npm test           # engine tests
```

No dependencies and no build step. To put it on your iPhone, host the folder on any static host (GitHub Pages works: Settings → Pages → deploy from this branch), open it in Safari, then Share → Add to Home Screen. It runs full-screen and offline. Data stays on the device; use ⋯ → Export backup to keep a copy.

## The starting routines

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

**Conditioning**: about 30 minutes, built as one-round named blocks

| Block | What |
|---|---|
| Warm-up | Inchworm · Push-Up to Downward Dog · Tabletop Cat Cow · Alt. World’s Greatest Stretch · Scapular Pull-Up (0:40 each) · Jog (1:30) |
| Run | 7:00 steady, about 0.7–0.9 miles |
| Conditioning | AMRAP 6:00: 8 Pull-Ups · 8 Burpees · 8 Squats (count your rounds) |
| Strength | Alt. KB Goblet Forward Lunge · KB High Pull · KB Goblet Squat · Russian KB Swing · KB High Plank Drag (1:00 each) |
| Cool-down | Child’s Pose · Tabletop Thread the Needle · Lizard · Half Split (0:45 per side) |

If you already had the app, Conditioning is added once to the end of your routines; delete it and it stays deleted. Set kettlebell weights with ⋯ on each move.

**Mobility**: about 30 minutes on a mat, no equipment. Reps and breaths are timed at roughly 8 seconds each, with 5 s to change position.

| Block | Rounds | What |
|---|---|---|
| Movement Prep | 2× | Full Breaths (5) · Child’s Pose (5 breaths) · Cat Cow (5) |
| Mobility 1 | 2× | Bird Dogs Each Side (5) · Thread the Needle Each Side (3) |
| Mobility 2 | 2× | Kneeling Hip Flexor into Half Splits (5) and Kneeling Quad Stretch (4–5 breaths), right leg then left |
| Mobility 3 | 2× | Seated Side Bends (6) · Seated Forward Fold (5 breaths) · 90/90 Supported Switches (12) |
| Mobility 4 | 1× | Hip Twisters (12) · Lying Knee Hug to Spinal Twist Each Side · Figure 4 Stretch Each Leg · Down Dog · Child’s Pose (5 breaths each) |

“Each side” moves are one interval: switch sides at the halfway blip.

The cool-down stretches target the muscles that day works, so they don't add to the muscle count.

## Your own routines

Upper and Lower are just the two routines you start with. Tap **Switch** (it reads **Routines** once you have more than two) to see them all:

- **Tap a routine** to do it now.
- **New routine**: name it ("Full Body", "Arms & Abs", "Hotel TRX") and start blank (one empty block, fill it from the library) or as a copy of any routine you have.
- **⋯ on a routine**: rename, move it earlier or later in the rotation, duplicate, reset (Upper and Lower only) or delete. You always keep at least one.
- **Rotation**: finishing a workout brings up the next routine in the list, wrapping around (Upper → Lower → Full Body → Upper …). Ending early doesn't move it on.

Each routine has its own warm-up, blocks, cool-down, weights and ↑/↓ arrows. The log, Body tab and streak count every routine. Deleting a routine keeps its past workouts in the log.

## The workout

Tap **Start workout** and put the phone where you can see it.

- **Warm-up and cool-down**: each stretch gets a "Next up" card (6 s), a short get-ready, then the hold or the reps. Dynamic stretches are paced at 3 s a rep (change it in ⋯). "Each side" stretches do left, then right.
- **Timed intervals** run as a circuit: every exercise in the block once, then the next round. 15 s rest between exercises, 30 s between rounds. During each rest the screen shows the next exercise and which dumbbells to grab.
- Sounds only, no voice: ticks count down the last 3 seconds of every timer, a long high tone starts each interval and a falling pair ends it. A quick double blip marks halfway (intervals of 30 s or more), a rising pair starts a new round, and two low taps mean switch sides. Back-to-back intervals get a single "go" instead of a stop and a start on top of each other. Each step's sounds are scheduled ahead on the audio clock, so they land on time; pause, skip and back cancel them cleanly.
- **Sounds and music** (⋯ → With music). iPhone lets a web app do one of two things:
  - **Play over music** (default): your music keeps playing and the cues play on top. The ringer switch has to be on ring, or iOS mutes the cues.
  - **Play on silent**: cues play with the switch on silent, but iOS pauses your music for the workout.
  
  ⋯ → Test sound checks them.
- Controls: **Back** restarts the interval (or goes to the previous one), **Pause**, **Skip** (skips a rest, or moves on without counting the interval), **End**.
- The screen stays awake. Switching away pauses. Closing or reloading keeps your place; tap **Resume workout**.

## Getting stronger: the ↑ / ↓ arrows

After a workout, rate each interval exercise **Too easy**, **Just right** or **Too hard**. Next time, too easy shows ↑ next to it and too hard shows ↓. Tap the arrow to apply it:

- With dumbbells: the next dumbbell up or down (2.5 lb steps under 25 lb, 5 lb above).
- Bodyweight: 5 seconds more or less per interval.

**Every 4 weeks** the app also suggests going heavier on its own. When you've done a weighted exercise at the same weight for 4 weeks (at least 3 workouts, and the last one wasn't rated too hard), it shows ↑ with "4 wks at 15 lb · ready for 17.5 lb", and the top of the routine says how many are ready. Tap ↑ to go up, or open the exercise (⋯) and tap **Not yet** to be asked again in 4 weeks. Any weight change restarts the 4-week count. It's worked out from your log, so nothing extra to track.

Editing an exercise shows the weight you used last time.

## Editing

- **⋯ on an exercise**: name, muscles, interval length, weight (or sets, hold, reps and sides for stretches), a one-line form cue, move up/down, remove, or **Swap for another exercise** (opens the library on the same muscle; the new one keeps the spot and interval length).
- **Drag ≡** on an exercise to reorder it within its block, warm-up or cool-down. The page scrolls when you drag near the top or bottom. With a keyboard, focus ≡ and use the arrow keys.
- **⋯ on a block**: a name ("Strength", "Run"), rounds, rest between exercises, rest between rounds, set every interval in the block at once, move or delete the block.
- **⋯ on Warm-up / Cool-down**: turn it off for the workout, add a stretch.
- **Add exercise** opens the exercise library. Choose where it goes (warm-up, a block, a new block, or cool-down), then tap as many as you want. Or **Make your own**.

## Exercise library

About 100 exercises to switch things up, each with muscles, a form cue and a starting weight:

| | Count | Examples |
|---|---|---|
| **TRX** | 24 | Row, Single Arm Row, Chest Press, Chest Fly, Atomic Push Up, Bicep Curl, Triceps Press, Y Fly, T Fly, Face Pull, Squat, Jump Squat, Pistol Squat, Suspended Lunge, Crossing Balance Lunge, Side Lunge, Hamstring Curl, Hip Press, Knee Tuck, Pike, Mountain Climber, Plank, Side Plank, Calf Raise |
| **Dumbbell** | 36 | Bench, Incline and Floor Press, Fly, Pullover, Rows (single, bent-over, renegade), Reverse Fly, Shoulder and Arnold Press, Lateral and Front Raise, Upright Row, Curls (bicep, hammer, concentration), Kickbacks, Overhead Extension, Skull Crusher, Goblet and Sumo Squat, Lunges (forward, reverse, lateral), Bulgarian Split Squat, Step Up, Romanian Deadlift (two-leg and single), Hip Thrust, Glute Bridge, Calf Raise, Russian Twist, Woodchop, Suitcase Carry |
| **Bodyweight** | 20 | Pull Up, Push Up, Bench Dip, Plank, Side Plank, Dead Bug, Bicycle Crunch, Hollow Hold, Mountain Climber, Superman, Squat, Glute Bridge, Fire Hydrant, Clamshell, Side-Lying Leg Raise, Calf Raise … |
| **Stretches** | 24 | For warm-up and cool-down: arm circles, leg swings, World’s Greatest Stretch, inchworm, Thread the Needle, Pigeon Pose, hamstring and calf stretches … |

Filter by equipment and muscle, or search by name. Exercises for the muscles you're working come first. Dumbbell exercises start at the weight you last used for them, if you've done them before.

## Body and Log

- **Body**: front and back diagrams with the muscles you worked in the last 7 days, and for each muscle how many workouts hit it this week and when you last worked it.
- **Log**: workouts this week, a week streak (weeks with 2+ workouts), a month calendar (filled = finished, ring = ended early), and every workout with what you did, the weights, your ratings and your note.

## How it works

- `engine.js` is pure logic: seed days, validation, the step plan, results, progression and history stats. `test/engine.test.js` covers it.
- Starting a workout snapshots the day and compiles it into a flat list of timed steps (intro → get ready → work → rest …). `app.js` walks that list with a wall-clock timer, so pause, back and resume-after-reload stay accurate. Editing a day only changes future workouts.
- State is saved to `localStorage` (`workit:v1`). Saved and imported data is validated on load. Anything that can't be read is set aside under a `workit:v1:unreadable:*` key instead of being overwritten.
- `sw.js` caches the app for offline use. Every release bumps the version (`engine.js`, `package.json`, the `CACHE` name in `sw.js`, `CHANGELOG.md`; `npm test` checks they agree). The app shows its version in ⋯ → Settings, and when a new one has downloaded a banner offers to reload into it.
- `figure.js` draws the Body tab's muscle map (front and back) in SVG: each muscle group is outlined and the ones you worked are filled.
