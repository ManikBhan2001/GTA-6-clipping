# Shot Lab v2: client demo (46 s, 1080p)

Output: `output/shot-lab-v2-client-demo.mp4`. A 3D recreation of the shot built from the tracked ball
positions, cut to an original 120 BPM score (one bar = 2 s; every cut and number lands on a beat).

| Bars | Time | Scene |
|---|---|---|
| 0-1 | 0-4 | 3D table builds from wireframe, title hit on 2.0 |
| 2-3 | 4-8 | balls drop in, one per eighth note |
| 4-5 | 8-12 | drop: real broadcast clip with our live trail |
| 6-9 | 12-20 | 3D chase-cam replay at 0.5x, contact on 16.0, 59° cut arc, live speeds |
| 10-11 | 20-24 | result, opponent's pot 96% |
| 12-15 | 24-32 | rewind, safer option run, 23% |
| 16-18 | 32-38 | risk towers, 4× on 36.0 |
| 19-20 | 38-42 | risk landscape: opponent's best pot from every cue-ball spot (pot model over a 12x24 grid) |
| 21-22 | 42-46 | end card |

Re-render (needs the source clip):
```bash
shot-lab/v2/build_base.sh path/to/videoplayback_1.mp4
cat shot-lab/v2/data3d.js shot-lab/project/data.js shot-lab/v2/story_main.js > shot-lab/v2/story.js
python3 .claude/skills/ai-video-editor/scripts/render.py shot-lab/v2 --preset slow
ffmpeg -i shot-lab/v2/final.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k out.mp4
```
The render script skips loudness normalisation when the base footage has no audio, hence the last step.
