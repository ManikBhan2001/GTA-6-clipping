#!/usr/bin/env bash
# Base footage for v2: black, with the real broadcast clip at 8-12 s (bars 4-5).
# Usage: shot-lab/v2/build_base.sh path/to/videoplayback_1.mp4
set -euo pipefail
V="$1"; D="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"; CLEAN="$D/../analysis/clean.png"
PATCH="[1:v]split=2[pa][pb];[pa]crop=100:22:26:19[l];[pb]crop=156:22:456:19[r];[v0][l]overlay=26:19[v1];[v1][r]overlay=456:19"
SC="scale=1920:1080:flags=lanczos,setsar=1,fps=25,format=yuv420p"
ffmpeg -v error -y -f lavfi -i "color=c=black:s=1920x1080:r=25:d=8" -vf format=yuv420p -c:v libx264 -crf 14 "$T/b1.mp4"
ffmpeg -v error -y -ss 31.95 -t 4.0 -i "$V" -i "$CLEAN" -filter_complex "[0:v]null[v0];$PATCH,$SC,trim=duration=4" -c:v libx264 -crf 14 "$T/b2.mp4"
ffmpeg -v error -y -f lavfi -i "color=c=black:s=1920x1080:r=25:d=34" -vf format=yuv420p -c:v libx264 -crf 14 "$T/b3.mp4"
printf "file '%s'\n" "$T/b1.mp4" "$T/b2.mp4" "$T/b3.mp4" > "$T/l.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$T/l.txt" -c copy "$D/cut.mp4"; echo "wrote $D/cut.mp4"
