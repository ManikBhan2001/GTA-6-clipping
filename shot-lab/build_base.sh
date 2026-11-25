#!/usr/bin/env bash
# Rebuild project/cut.mp4 (the base footage) from the source clip.
# Usage: shot-lab/build_base.sh path/to/videoplayback_1.mp4
set -euo pipefail
V="$1"; D="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"
CLEAN="$D/analysis/clean.png"; END="$D/analysis/endf.png"
PATCH="[1:v]split=2[pa][pb];[pa]crop=100:22:26:19[l];[pb]crop=156:22:456:19[r];[v0][l]overlay=26:19[v1];[v1][r]overlay=456:19"
SC="scale=1920:1080:flags=lanczos,setsar=1,fps=25,format=yuv420p"
ffmpeg -v error -y -loop 1 -t 7.0 -i "$CLEAN" -vf "$SC" -c:v libx264 -crf 14 "$T/s1.mp4"
ffmpeg -v error -y -ss 32.30 -t 3.26 -i "$V" -i "$CLEAN" -filter_complex "[0:v]setpts=2*PTS,minterpolate=fps=25:mi_mode=mci:mc_mode=aobmc:vsbmc=1[v0];$PATCH,$SC" -c:v libx264 -crf 14 "$T/s2.mp4"
ffmpeg -v error -y -loop 1 -t 7.0 -i "$END" -i "$CLEAN" -filter_complex "[0:v]null[v0];$PATCH,$SC" -c:v libx264 -crf 14 "$T/s3.mp4"
ffmpeg -v error -y -loop 1 -t 16.0 -i "$CLEAN" -vf "$SC" -c:v libx264 -crf 14 "$T/s4.mp4"
printf "file '%s'\n" "$T/s1.mp4" "$T/s2.mp4" "$T/s3.mp4" "$T/s4.mp4" > "$T/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$T/list.txt" -c copy "$D/project/cut.mp4"
echo "wrote $D/project/cut.mp4"
