# Shot Lab: Wilson's safety

A 36 s analytics breakdown of one snooker shot, made with the `ai-video-editor` skill
(`.claude/skills/ai-video-editor`, Data Story style). Output: `output/shot-lab-wilson-safety.mp4`.

## Re-render

```bash
python3 -m pip install faster-whisper playwright scipy
shot-lab/build_base.sh path/to/videoplayback_1.mp4
python3 .claude/skills/ai-video-editor/scripts/render.py shot-lab/project --preset slow
```

`project/story.js` is `data.js` + `story_main.js` concatenated; edit those two and rebuild it with
`cat shot-lab/project/data.js shot-lab/project/story_main.js > shot-lab/project/story.js`.

## Where the numbers come from (all estimates)

- `analysis/geo.py`: homography from the overhead frame's six pockets to a 3569 x 1778 mm table
  (middle pockets land within ~6 mm, so the mapping is sound).
- `analysis/tracks.json`, `cue_track.json`: cue ball and red tracked by frame differencing (source 32.45 to 35.52 s).
  Speeds: cue ~2.05 m/s at the strike, ~1.70 at contact, red ~0.9 m/s after a ~59° cut.
- `analysis/model.py`: pot chance = probability the object ball's direction error (from a pro's ~0.06° cue
  aim error, scaled by distance and cut angle) stays inside the pocket's acceptance angle; blocked lines score 0.
  - best pot on before the shot: long red to bottom-left, 32%
  - Moody's best pot after the shot as played: 96%
  - after the safer option (thin ~80° contact, ~2.45 m/s, cue ball to the baulk cushion): 23%
- `analysis/alt.json`: the safer option's path (reflections off the bottom and right cushions).

The source clip is broadcast footage; it is not stored here.

## Skill changes made for this environment

- `scripts/setup.py`, `scripts/render.py`: launch the preinstalled Chromium at `/opt/pw-browsers/chromium` when present.
- `engine/page.html`: empty favicon, so the renderer doesn't fail on a favicon 404.
- Note: the renderer overlays graphics on `cut.mp4` at its own size, so the base footage must match the
  output height (here 1920x1080).
