# Shot Lab v3: Predict (46 s, 1080p)

Output: `output/shot-lab-v3-predict.mp4`. O'Sullivan's safety vs Murphy (Champion of Champions match video,
~79:07): cue ball off a red near the side cushion and 2+ m back up to the baulk cushion.

**The prediction is real physics, not hindsight.** From 0.5 s of tracked motion after the cushion (v ≈ 0.70 m/s)
plus standard snooker-cloth rolling resistance (0.098 m/s², μ ≈ 0.01), the stop point is called 6.3 s early;
it lands 7.5 cm from where the ball actually stops.

Other figures (estimates): Murphy's best pot from where the cue ball finished 18% (long red, 2.9 m, off the
cushion); average over the table for that layout 56% (pot model on a 12x24 grid).

| Time | Scene |
|---|---|
| 0-4 | 3D table builds, title |
| 4-8 | balls drop in, "Where will it stop?" |
| 8-16 | real clip (cropped to the table): strike on 8.5, prediction locks on 10.0, countdown to the ring |
| 16-18 | predicted vs actual: 7.5 cm |
| 18-26 | 3D chase replay at 1x, speed vs physics chart, contact on 19.0, stop on 26.0 |
| 26-30 | result: Murphy's best pot 18% |
| 30-36 | risk landscape |
| 36-40 | the call: 6.3 s early, 7.5 cm off |
| 40-46 | end card |

Files: `data3.js` (all geometry/numbers), `engine.js` (3D renderer + HUD helpers, shared with v2),
`story_v3.js` (scenes + score). `story.js` = the three concatenated. `analysis/geo3.py` is the homography
for this camera; `cue_table.json` the cue track in table mm.
Base footage: black 0-8, source 4738.2-4746.2 s cropped `crop=420:236:110:68` and scaled to 1920x1080, black 16-46.
