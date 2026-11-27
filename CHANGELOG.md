# Changelog

Your version is at the bottom of ⋯ → Settings.

| Version | Date | What changed |
|---|---|---|
| **1.17.0** | Nov 27, 2026 | A voice announces the next exercise by name, using the best voice on your phone. Pick the voice and speed in Settings. |
| 1.16.0 | Nov 26, 2026 | New Mobility Flow: 10 moves × 0:30 (Body Waves, Zen Swings, Arm Swings, Lymphatic Steps, Full Twists, March Claps, Squat Reaches, Down Up Dogs, Cossack Side Lunge, 90/90), in every routine. |
| 1.15.0 | Nov 26, 2026 | Mobility Flow (12 moves × 0:30) is the first block of every routine and replaces the old warm-ups, which are turned off but kept. Blocks can be turned on and off. Halfway blip only on intervals of 40 s or more. |
| 1.14.0 | Nov 26, 2026 | Rotation is its own cycle, so a routine can repeat: Upper → Lower → Conditioning → Mobility → Upper B → Lower B → Conditioning → Mobility. Edit it under Routines. |
| 1.13.0 | Nov 26, 2026 | Upper Body Day B and Lower Body Day B. Rowing instead of running: Conditioning’s jog and run are now Easy Row and Row, in saved routines too. Rower filter in the library. |
| 1.12.0 | Nov 25, 2026 | Every 4 weeks at the same weight, the ↑ arrow suggests the next dumbbell up. Not yet asks again in 4 weeks. |
| 1.11.0 | Nov 25, 2026 | Mobility routine (30 min): Movement Prep and Mobility 1–4, timed from reps and breaths. |
| 1.10.0 | Nov 23, 2026 | Version number in Settings, Check for updates, and a banner to reload when a new version is ready. |
| 1.9.0 | Nov 23, 2026 | Sounds play over your music (ringer on), or on silent with music paused: your choice. Cues are scheduled on the audio clock so they land on time; no more overlapping tones between back-to-back intervals. |
| 1.8.0 | Nov 21, 2026 | Conditioning routine (30 min). Blocks can be named. Intervals up to 10 minutes. Kettlebell filter in the library. |
| 1.7.0 | Nov 21, 2026 | Drag ≡ to reorder exercises within a block, warm-up or cool-down. |
| 1.6.0 | Nov 21, 2026 | Your own routines: create, copy, rename, reorder, delete. Rotation through all of them. |
| 1.5.0 | Nov 21, 2026 | Exercise library (TRX, dumbbell, bodyweight, stretches) and Swap for another exercise. |
| 1.4.0 | Nov 20, 2026 | Louder tones; sounds with the silent switch on; Test sound. |
| 1.3.0 | Nov 20, 2026 | Sounds only, no voice. |
| 1.2.0 | Nov 20, 2026 | Exercise thumbnails removed. |
| 1.1.0 | Nov 20, 2026 | Muscle map drawings. |
| 1.0.0 | Nov 20, 2026 | First version: Upper and Lower Body days, timed circuits, warm-up and cool-down, ratings with ↑/↓, Body and Log. |

## Releasing a new version

1. Bump `VERSION` and `RELEASED` in `engine.js`.
2. Set the same version in `package.json` and in the `CACHE` name in `sw.js`.
3. Add a row above.
4. `npm test` checks that all four agree.
