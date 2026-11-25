// SHOT LAB v2: 3D recreation of one snooker shot, cut to a 120 BPM score (1 bar = 2 s).
// Bars: 0-1 title | 2-3 balls drop | 4-5 real broadcast clip | 6-9 3D replay (contact on bar 8 = 16.0 s)
// 10-11 result | 12-15 safer option | 16-18 risk towers | 19-20 risk landscape | 21-22 end card.
// All numbers are estimates (tracking from the broadcast frames + a pot-probability model).

const BPM = 120, BEAT = 0.5, BARLEN = 2;
const TW = D3.W, TL3 = D3.L, BR = D3.R;
D3.cuePath[2] = [1380, TL3 - BR]; D3.cuePath[3] = [TW - BR, 3010];   // snap cushion contacts to the cushion lines
const CENTER = [TW / 2, TL3 / 2, 0];
const DEG = Math.PI / 180;
const COLOR = { cloth: '#167a3a', clothDark: '#0b4a22', rail: '#3a1d12', railTop: '#5a2e1a', body: '#1d0f09' };
const BALLC = { red: '#c8141c', yellow: '#f2d22e', green: '#1f8f3c', brown: '#7a4a22', blue: '#1f5fd0', pink: '#f08aa0', black: '#121212', cue: '#f4efe0' };

// ---------------- 3D camera ----------------
let CAM = null;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// table coords are mirrored in x so the 3D view matches the broadcast picture (baulk at the top, x=0 on the left)
const FX = (x) => TW - x;
function setCam(k) {
  const T = [FX(k.tx), k.ty, k.tz || 0], az = k.az * DEG, el = k.el * DEG, ce = Math.cos(el);
  const E = [T[0] + k.d * Math.sin(az) * ce, T[1] - k.d * Math.cos(az) * ce, T[2] + k.d * Math.sin(el)];
  const fwd = norm3(sub3(T, E)), right = norm3(cross3(fwd, [0, 0, 1])), up = cross3(right, fwd);
  CAM = { E, fwd, right, up, f: k.f || 1000, cx: k.cx || 640, cy: k.cy || 360 };
}
function P(x, y, z = 0) {
  const d = sub3([FX(x), y, z], CAM.E), zc = dot3(d, CAM.fwd); if (zc < 20) return null;
  return [CAM.cx + CAM.f * dot3(d, CAM.right) / zc, CAM.cy - CAM.f * dot3(d, CAM.up) / zc, CAM.f / zc, zc];
}
const depth = (x, y, z = 0) => dot3(sub3([FX(x), y, z], CAM.E), CAM.fwd);
function poly3(c, pts, fill, stroke, lw = 1) {
  const q = pts.map((p) => P(p[0], p[1], p[2] || 0)); if (q.some((v) => !v)) return;
  c.beginPath(); q.forEach((v, i) => (i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1]))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function line3(c, pts, col, w, o = {}) {
  const q = pts.map((p) => P(p[0], p[1], p[2] == null ? 2 : p[2])); if (q.length < 2 || q.every((v) => !v)) return;
  c.save(); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; if (o.dash) c.setLineDash(o.dash);
  if (o.glow !== 0) { c.shadowColor = col; c.shadowBlur = o.glow || 14; } c.globalAlpha *= o.a == null ? 1 : o.a;
  c.beginPath(); let pen = false; q.forEach((v) => { if (!v) { pen = false; return; } if (pen) c.lineTo(v[0], v[1]); else { c.moveTo(v[0], v[1]); pen = true; } }); c.stroke(); c.restore();
}
function tiles(c, x0, y0, x1, y1, z, nx, ny, fill) {
  const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny; c.fillStyle = fill; c.strokeStyle = fill; c.lineWidth = 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = [P(x0 + i * dx, y0 + j * dy, z), P(x0 + (i + 1) * dx, y0 + j * dy, z), P(x0 + (i + 1) * dx, y0 + (j + 1) * dy, z), P(x0 + i * dx, y0 + (j + 1) * dy, z)];
    if (q.some((v) => !v)) continue; c.beginPath(); q.forEach((v, k) => (k ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1]))); c.closePath(); c.fill(); c.stroke();
  }
}
function circle3(x, y, z, r, n = 28) { const a = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; a.push([x + Math.cos(t) * r, y + Math.sin(t) * r, z]); } return a; }
function ring3(c, x, y, r, col, w = 3, a = 1) { if (a <= 0) return; c.save(); c.globalAlpha *= a; c.shadowColor = col; c.shadowBlur = 12; poly3(c, circle3(x, y, 1.5, r, 40), null, col, w); c.restore(); }

// ---------------- table ----------------
const RAIL = 170, CUSH = 42;
const POCK = [[0, 0], [TW, 0], [0, TL3], [TW, TL3], [-12, TL3 / 2], [TW + 12, TL3 / 2]];
function drawTable(c, build = 1, solid = 1) {
  const O = [-RAIL, -RAIL, TW + RAIL, TL3 + RAIL];
  if (solid > 0) {
    c.save(); c.globalAlpha *= solid;
    // apron sides, far first
    const sides = [
      [[O[0], O[1], CUSH], [O[2], O[1], CUSH], [O[2], O[1], -300], [O[0], O[1], -300]],
      [[O[2], O[1], CUSH], [O[2], O[3], CUSH], [O[2], O[3], -300], [O[2], O[1], -300]],
      [[O[2], O[3], CUSH], [O[0], O[3], CUSH], [O[0], O[3], -300], [O[2], O[3], -300]],
      [[O[0], O[3], CUSH], [O[0], O[1], CUSH], [O[0], O[1], -300], [O[0], O[3], -300]],
    ].map((f) => ({ f, d: depth((f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2, -100) })).sort((a, b) => b.d - a.d);
    sides.forEach((s, i) => poly3(c, s.f, i < 2 ? '#140905' : COLOR.body));
    // rail top
    tiles(c, O[0], O[1], O[2], O[3], CUSH, 6, 14, COLOR.railTop);
    // cloth with a soft light pool
    { const m = P(TW / 2, TL3 * 0.45); let g = COLOR.cloth;
      if (m) { g = c.createRadialGradient(m[0], m[1], 0, m[0], m[1], Math.min(4000, 900 * m[2] * 2.2)); g.addColorStop(0, '#1f9a49'); g.addColorStop(0.65, COLOR.cloth); g.addColorStop(1, COLOR.clothDark); }
      tiles(c, 0, 0, TW, TL3, 0, 6, 14, g); }
    // cushion inner faces
    [[[0, 0], [TW, 0]], [[TW, 0], [TW, TL3]], [[TW, TL3], [0, TL3]], [[0, TL3], [0, 0]]].forEach(([a, b]) => poly3(c, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], CUSH], [a[0], a[1], CUSH]], 'rgba(10,60,26,0.95)'));
    // markings
    c.save(); c.globalAlpha *= 0.55; line3(c, [[0, 737, 0.5], [TW, 737, 0.5]], 'rgba(255,255,255,0.7)', 1.4, { glow: 0 });
    const D = []; for (let i = 0; i <= 24; i++) { const t = Math.PI + (i / 24) * Math.PI; D.push([TW / 2 + Math.cos(t) * 292, 737 + Math.sin(t) * 292, 0.5]); } line3(c, D, 'rgba(255,255,255,0.7)', 1.4, { glow: 0 }); c.restore();
    // pockets
    POCK.forEach(([x, y]) => { poly3(c, circle3(x, y, CUSH + 1, 62), '#050505'); poly3(c, circle3(x, y, 0.5, 46), '#000'); });
    c.restore();
  }
  // wireframe build-up
  if (build < 1 || solid < 1) {
    c.save(); c.globalAlpha *= 1 - solid * 0.85; const e = ez.inout3(clamp(build));
    const edges = [[[0, 0], [TW, 0]], [[TW, 0], [TW, TL3]], [[TW, TL3], [0, TL3]], [[0, TL3], [0, 0]], [[O[0], O[1]], [O[2], O[1]]], [[O[2], O[1]], [O[2], O[3]]], [[O[2], O[3]], [O[0], O[3]]], [[O[0], O[3]], [O[0], O[1]]]];
    edges.forEach(([a, b], i) => { const u = clamp(e * 1.6 - i * 0.07); if (u <= 0) return; line3(c, [[a[0], a[1], i < 4 ? 0 : CUSH], [lerp(a[0], b[0], u), lerp(a[1], b[1], u), i < 4 ? 0 : CUSH]], C.teal, 2.6, { glow: 18 }); });
    for (let k = 1; k < 12; k++) { const u = clamp(e * 1.4 - 0.3 - k * 0.03); if (u > 0) line3(c, [[0, (k / 12) * TL3, 0], [TW * u, (k / 12) * TL3, 0]], 'rgba(60,198,184,0.5)', 1.4, { glow: 0 }); }
    c.restore();
  }
}
function floorGrid(c, a = 1) {
  c.save(); c.globalAlpha *= 0.5 * a; c.strokeStyle = 'rgba(60,198,184,0.16)'; c.lineWidth = 1;
  for (let i = -6; i <= 6; i++) { const x = TW / 2 + i * 600; const p = [P(x, -3500, -300), P(x, TL3 + 3500, -300)]; if (p[0] && p[1]) { c.beginPath(); c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.stroke(); } }
  for (let j = -6; j <= 18; j++) { const y = j * 600; const p = [P(TW / 2 - 3600, y, -300), P(TW / 2 + 3600, y, -300)]; if (p[0] && p[1]) { c.beginPath(); c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.stroke(); } }
  c.restore();
}
// ---------------- balls ----------------
function drawBalls(c, balls) {
  const list = balls.map((b) => ({ b, d: depth(b.x, b.y, b.z || BR) })).sort((a, b) => b.d - a.d);
  for (const { b } of list) {
    const z = b.z == null ? BR : b.z, a = b.a == null ? 1 : b.a; if (a <= 0) continue;
    const sh = P(b.x + 6, b.y + 10, 0.6); const p = P(b.x, b.y, z); if (!p || !sh) continue; const r = BR * p[2];
    c.save(); c.globalAlpha *= a * 0.55 * clamp(1 - (z - BR) / 1200); c.fillStyle = '#000'; c.beginPath(); c.ellipse(sh[0], sh[1], r * 1.05, r * 0.7, 0, 0, 7); c.fill(); c.restore();
    c.save(); c.globalAlpha *= a; const g = c.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.08, p[0], p[1], r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, b.col); g.addColorStop(1, shade(b.col, -0.6)); c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
    if (b.ghost) { c.strokeStyle = C.sand; c.lineWidth = 2; c.stroke(); }
    c.restore();
  }
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); return `rgb(${f(r)},${f(g)},${f(b)})`; }
// ---------------- boxes (risk columns) ----------------
function drawBoxes(c, boxes) {
  boxes.forEach((b) => (b.d = depth((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.h / 2)));
  boxes.sort((a, b) => b.d - a.d);
  for (const b of boxes) {
    if (b.h < 2) { poly3(c, [[b.x0, b.y0, 2], [b.x1, b.y0, 2], [b.x1, b.y1, 2], [b.x0, b.y1, 2]], b.col); continue; }
    const top = b.h, faces = [
      [[b.x0, b.y0, 0], [b.x1, b.y0, 0], [b.x1, b.y0, top], [b.x0, b.y0, top]],
      [[b.x1, b.y0, 0], [b.x1, b.y1, 0], [b.x1, b.y1, top], [b.x1, b.y0, top]],
      [[b.x1, b.y1, 0], [b.x0, b.y1, 0], [b.x0, b.y1, top], [b.x1, b.y1, top]],
      [[b.x0, b.y1, 0], [b.x0, b.y0, 0], [b.x0, b.y0, top], [b.x0, b.y1, top]],
    ].map((f, i) => ({ f, i, d: depth((f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2, top / 2) })).sort((a, b) => b.d - a.d);
    c.save(); c.globalAlpha *= b.a == null ? 1 : b.a;
    faces.forEach(({ f, i }) => poly3(c, f, shade(b.col, i % 2 ? -0.45 : -0.28)));
    poly3(c, [[b.x0, b.y0, top], [b.x1, b.y0, top], [b.x1, b.y1, top], [b.x0, b.y1, top]], b.glow ? shade(b.col, 0.15) : b.col, b.glow ? 'rgba(255,255,255,0.5)' : null, 1);
    c.restore();
  }
}
const ramp = (v) => { const s = [[0, [60, 198, 184]], [0.5, [242, 193, 78]], [1, [255, 107, 91]]]; v = clamp(v); const i = v < 0.5 ? 0 : 1, u = (v - s[i][0]) / 0.5; const a = s[i][1], b = s[i + 1][1]; return '#' + a.map((x, k) => Math.round(lerp(x, b[k], u)).toString(16).padStart(2, '0')).join(''); };

// ---------------- motion along paths with real speeds ----------------
function pathAt(pts, times, speeds, s) {
  if (s <= times[0]) return { p: pts[0], v: 0, seg: -1 };
  for (let i = 0; i < pts.length - 1; i++) {
    if (s <= times[i + 1]) {
      const u = (s - times[i]) / (times[i + 1] - times[i]), [v0, v1] = speeds[i], avg = (v0 + v1) / 2 || 1e-6;
      const f = (v0 * u + (v1 - v0) * u * u / 2) / avg;
      return { p: [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)], v: lerp(v0, v1, u), seg: i, u };
    }
  }
  return { p: pts[pts.length - 1], v: 0, seg: pts.length - 1 };
}
const CUE_SP = [[2.05, 1.70], [1.46, 1.22], [0.98, 0.78], [0.62, 0]];
const CUE_T = D3.cueT;                   // 32.45, 33.91 (contact), 34.35, 34.87, 35.52 (source seconds)
const RED_T = [33.91, 35.45], RED_SP = [[0.9, 0]];
// safer option: segment durations from length / average speed
const ALT_SP = [[2.45, 2.12], [2.09, 1.86], [1.49, 0.95], [0.76, 0]];
const ALT_T = (() => { const t = [0]; for (let i = 0; i < 4; i++) { const a = D3.alt[i], b = D3.alt[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000; t.push(t[i] + len / ((ALT_SP[i][0] + ALT_SP[i][1]) / 2)); } return t; })();
const ALT_RED_T = [ALT_T[1], ALT_T[1] + 0.6], ALT_RED_SP = [[0.36, 0]];

// timeline (edited seconds); the shot replay runs at 0.5x with contact on the downbeat of bar 8
const REP0 = 16.0 - (CUE_T[1] - CUE_T[0]) * 2;          // strike time in the replay
const repS = (t) => CUE_T[0] + (t - REP0) / 2;
const ALT0 = 24.8, ALT_SCALE = (30.2 - ALT0) / ALT_T[4]; // safer option run, compressed slightly
const altS = (t) => (t - ALT0) / ALT_SCALE;
const SCN = { title: 0, drop: 4, clip: 8, replay: 12, result: 20, alt: 24, towers: 32, heat: 38, end: 42, D: 45.96 };

function ballsAt(t) {
  const out = []; let cue = D3.cue0, red5 = D3.RB[5], ghost = null;
  const after = t >= SCN.result && t < SCN.alt || t >= SCN.towers;
  if (t >= SCN.replay && t < SCN.result) { const s = repS(t); cue = pathAt(D3.cuePath, CUE_T, CUE_SP, s).p; red5 = pathAt(D3.redPath, RED_T, RED_SP, s).p; }
  else if (after) { cue = D3.cueA; red5 = D3.RA[5]; }
  else if (t >= SCN.alt && t < SCN.towers) {
    const k = ez.inout3(span(t, SCN.alt, SCN.alt + 0.6));
    if (t < ALT0) { cue = [lerp(D3.cueA[0], D3.cue0[0], k), lerp(D3.cueA[1], D3.cue0[1], k)]; red5 = [lerp(D3.RA[5][0], D3.RB[5][0], k), lerp(D3.RA[5][1], D3.RB[5][1], k)]; }
    else { const s = altS(t); cue = pathAt(D3.alt, ALT_T, ALT_SP, s).p; red5 = pathAt(D3.altRed, ALT_RED_T, ALT_RED_SP, s).p; }
  }
  if (t >= SCN.towers) ghost = D3.alt[D3.alt.length - 1];
  const reds = (after ? D3.RA : D3.RB).map((r, i) => (i === 5 ? red5 : r));
  reds.forEach((r, i) => out.push({ x: r[0], y: r[1], col: BALLC.red, id: 'r' + i }));
  Object.entries(D3.cols).forEach(([k, p]) => out.push({ x: p[0], y: p[1], col: BALLC[k], id: k }));
  out.push({ x: cue[0], y: cue[1], col: BALLC.cue, id: 'cue' });
  if (ghost) out.push({ x: ghost[0], y: ghost[1], col: '#f6e7b8', id: 'ghost', ghost: true, a: 0.85 });
  // drop-in during bars 2-3: one ball per eighth note
  if (t < SCN.clip) out.forEach((b, i) => { const t0 = SCN.drop + 0.1 + i * 0.125, u = span(t, t0, t0 + 0.45); b.z = BR + 1600 * Math.pow(1 - u, 2) * (u < 1 ? 1 : 0); b.a = span(t, t0 - 0.05, t0 + 0.05); });
  return { balls: out, cue, red5 };
}

// ---------------- cameras ----------------
const K = (t, tx, ty, d, az, el, cx = 640, tz = 0, f = 1000) => [t, tx, ty, tz, d, az, el, f, cx];
const camKey = (a) => ({ tx: a[0], ty: a[1], tz: a[2], d: a[3], az: a[4], el: a[5], f: a[6], cx: a[7] });
const TOP = (cx = 640) => [CENTER[0], CENTER[1], 0, 6300, 180, 68, 1000, cx];
function camAt(t, st) {
  if (t < SCN.clip) return camKey(track([K(0, 889, 1785, 9800, 115, 18), K(3.8, 889, 1785, 6800, 160, 44), K(4.4, 889, 1785, 6400, 172, 52, 700), K(7.3, 889, 1785, 6000, 180, 62, 700), K(8.0, ...TOP().slice(0, 2), 6300, 180, 68, 640)], t));
  if (t < SCN.result) {
    const s = repS(t), ball = st.cue, dir = [0.222, 0.975], chase = [ball[0] + dir[0] * 380, ball[1] + dir[1] * 380];
    if (t < REP0) { const k = ez.inout3(span(t, SCN.replay, REP0)); const A = TOP(), B = [chase[0], chase[1], 0, 1400, 12.8, 21, 1000, 760]; return camKey(A.map((v, i) => lerp(v, B[i], k))); }
    if (t < 16.0) return camKey([chase[0], chase[1], 0, 1400 - 150 * span(t, REP0, 16), 12.8, 21, 1000, 760]);
    const cp = D3.cuePath[1];
    return camKey(track([K(16.0, cp[0] + dir[0] * 380, cp[1] + dir[1] * 380, 1250, 12.8, 21, 760), K(16.6, cp[0] + 60, cp[1] + 220, 1700, 40, 30, 760), K(17.6, cp[0] + 120, cp[1] + 250, 2300, 80, 40, 760), K(19.6, 1050, 2700, 3900, 180, 72, 760)], t));
  }
  if (t < SCN.alt) return camKey(track([K(20, 1050, 2700, 3900, 180, 72, 760), K(24, 1050, 2650, 3700, 176, 74, 760)], t));
  if (t < SCN.towers) {
    const p = st.cue, s = altS(t);
    if (t < ALT0) return camKey(track([K(24, 1050, 2650, 3700, 176, 74, 760), K(ALT0, D3.cue0[0] + 80, D3.cue0[1] + 500, 1700, 12.8, 22, 760)], t));
    if (t < 28.3) return camKey([p[0] + 80, p[1] + 380, 0, 1700 + 900 * span(t, ALT0, 28.3), 12.8 + 30 * span(t, 26.2, 28.3), 22 + 16 * span(t, 26.2, 28.3), 1000, 760]);
    return camKey(track([K(28.3, p[0] + 80, p[1] + 380, 2600, 42.8, 38, 760), K(30.4, 1150, 1100, 4100, 180, 68, 760), K(32, 1150, 1150, 4000, 178, 70, 760)], t));
  }
  if (t < SCN.heat) return camKey(track([K(32, 1350, 2000, 5600, 200, 40, 760, 300), K(38, 1300, 2000, 5300, 236, 33, 760, 300)], t));
  if (t < SCN.end) return camKey(track([K(38, 1300, 2000, 5300, 236, 33, 760, 300), K(42, 889, 1900, 6200, 208, 50, 760, 200)], t));
  return camKey(track([K(42, 889, 1900, 6200, 208, 50, 760, 200), K(45.96, 889, 1850, 7400, 196, 58, 760, 200)], t));
}

// ---------------- 2D HUD helpers ----------------
const HX = 60;
function hudTag(c, s, t0, t, col = C.coral, y = 70) { c.save(); c.globalAlpha *= span(t, t0, t0 + 0.25); c.font = MONO(19, 600); c.fillStyle = col; c.letterSpacing = '3px'; c.fillText(s, HX, y); c.restore(); }
function hudHead(c, lines, t0, t, y = 136, size = 54, gap = 62) { lines.forEach((ln, i) => riseLine(c, ln.split(' ').map((w, j) => [w, t0 + i * 0.12 + j * 0.05]), HX, y + i * gap, HEAD(size), C.ink, t)); }
function hudNum(c, val, dec, unit, y, t, col = C.ink, size = 104, cap) {
  c.save(); if (cap) { c.font = MONO(17, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText(cap, HX, y - size * 0.95); c.letterSpacing = '0px'; }
  const s = val.toFixed(dec); c.font = HEAD(size); c.fillStyle = col; c.fillText(s, HX - 3, y); c.font = MONO(Math.round(size * 0.26), 600); c.fillStyle = C.coral; c.fillText(unit, HX + textW(c, s, HEAD(size)) + 8, y); c.restore();
}
function hudPct(c, val, t0, t, col, cap, sub, y = 470) {
  const k = ez.outExpo(span(t, t0, t0 + 0.5)), n = Math.round(val * k), pop = 1 + 0.08 * Math.sin(Math.PI * span(t, t0 + 0.45, t0 + 0.7));
  c.save(); c.globalAlpha *= span(t, t0 - 0.1, t0 + 0.05);
  c.font = MONO(17, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText(cap, HX, y - 132); c.letterSpacing = '0px';
  c.save(); c.translate(HX, y); c.scale(pop, pop); c.font = HEAD(132); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 30 * (1 - span(t, t0 + 0.5, t0 + 1.5)); const w = textW(c, String(n), HEAD(132)); c.fillText(String(n), -4, 0); c.font = HEAD(58, 700); c.fillText('%', w, 0); c.restore();
  c.fillStyle = 'rgba(238,241,245,0.12)'; rr(c, HX, y + 22, 340, 9, 5); c.fill(); c.fillStyle = col; rr(c, HX, y + 22, 340 * val / 100 * k, 9, 5); c.fill();
  if (sub) { c.globalAlpha *= span(t, t0 + 0.4, t0 + 0.8); c.font = MONO(18); c.fillStyle = C.ink; c.fillText(sub, HX, y + 62); }
  c.restore();
}
function chip(c, s, x, y, col = C.ink, a = 1, size = 17) {
  if (a <= 0) return; c.save(); c.globalAlpha *= a; c.font = MONO(size, 600); const w = textW(c, s, MONO(size, 600));
  c.fillStyle = 'rgba(15,20,28,0.88)'; rr(c, x, y - size - 7, w + 18, size + 16, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; rr(c, x, y - size - 7, w + 18, size + 16, 7); c.stroke();
  c.fillStyle = col; c.fillText(s, x + 9, y + 1); c.restore();
}
function chip3(c, s, x, y, z, col, a, dx = 22, dy = -20) { const p = P(x, y, z); if (p) chip(c, s, p[0] + dx, p[1] + dy, col, a); }
function footer(c, a = 0.8) { c.save(); c.globalAlpha *= a; c.font = MONO(14); c.fillStyle = '#5f6a7a'; c.fillText('Concept demo · estimates from broadcast tracking + a pot-probability model', HX, 700); c.restore(); }
function bgVoid(c, t) {
  c.fillStyle = '#080b10'; c.fillRect(0, 0, 1280, 720);
  const g = c.createRadialGradient(760, 330, 0, 760, 330, 900); g.addColorStop(0, 'rgba(60,198,184,0.10)'); g.addColorStop(1, 'rgba(60,198,184,0)'); c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  const g2 = c.createRadialGradient(150, 80, 0, 150, 80, 700); g2.addColorStop(0, 'rgba(255,107,91,0.07)'); g2.addColorStop(1, 'rgba(255,107,91,0)'); c.fillStyle = g2; c.fillRect(0, 0, 1280, 720);
}
function potLine3(c, L, t0, t, col, a = 1) {
  if (t < t0 || a <= 0) return; c.save(); c.globalAlpha *= a;
  const u1 = ez.inout3(span(t, t0, t0 + 0.45)), u2 = ez.inout3(span(t, t0 + 0.35, t0 + 0.8));
  line3(c, [[L.cue[0], L.cue[1]], [lerp(L.cue[0], L.ghost[0], u1), lerp(L.cue[1], L.ghost[1], u1)]], 'rgba(238,241,245,0.9)', 2.5, { dash: [9, 8], glow: 0 });
  if (u1 >= 1) ring3(c, L.ghost[0], L.ghost[1], BR, C.ink, 2, 0.9);
  line3(c, [[L.obj[0], L.obj[1]], [lerp(L.obj[0], L.pocket[0], u2), lerp(L.obj[1], L.pocket[1], u2)]], col, 5);
  if (u2 >= 1) ring3(c, L.pocket[0], L.pocket[1], 70 + 10 * Math.sin(t * 6), col, 3);
  c.restore();
}
function trail3(c, pts, times, sp, s, col, w = 5) {
  if (s <= times[0]) return; const q = [pts[0]]; for (let i = 1; i < pts.length; i++) { if (times[i] <= s) q.push(pts[i]); else break; }
  q.push(pathAt(pts, times, sp, s).p); line3(c, q, col, w);
}
function flash(c, t, t0, d = 0.18) { const u = span(t, t0 - 0.02, t0 + d); if (u <= 0 || u >= 1) return; c.save(); c.globalAlpha = (1 - u) * 0.9; c.fillStyle = '#fff'; c.fillRect(0, 0, 1280, 720); c.restore(); }

// ---------------- scenes ----------------
function scene3D(c, t) {
  const st = ballsAt(t); setCam(camAt(t, st)); bgVoid(c, t);
  floorGrid(c, span(t, 0, 1.2) * (t < SCN.towers ? 0.6 : 1));
  const build = span(t, 0.0, 2.0), solid = span(t, 1.6, 3.0);
  drawTable(c, build, solid);
  // overlays under the balls
  if (t >= SCN.replay && t < SCN.result) {
    const s = repS(t); trail3(c, D3.cuePath, CUE_T, CUE_SP, s, C.coral, 6); if (s > RED_T[0]) trail3(c, D3.redPath, RED_T, RED_SP, s, C.teal, 5);
    if (s > CUE_T[1]) cutArc(c, t, 16.0);
  }
  if (t >= SCN.result && t < SCN.alt) { line3(c, D3.cuePath, C.coral, 4, { a: 0.45 }); line3(c, D3.redPath, C.teal, 4, { a: 0.5 }); potLine3(c, D3.moody, 20.4, t, C.coral); }
  if (t >= SCN.alt && t < SCN.towers) {
    if (t > ALT0 - 0.4) line3(c, D3.alt, C.sand, 2, { dash: [10, 12], glow: 0, a: 0.35 * span(t, ALT0 - 0.4, ALT0) });
    if (t >= ALT0) { const s = altS(t); trail3(c, D3.alt, ALT_T, ALT_SP, s, C.sand, 6); }
    potLine3(c, D3.altMoody, 30.5, t, C.coral);
  }
  if (t >= SCN.towers) { const a = 0.5 * (1 - span(t, SCN.heat, SCN.heat + 0.6)); line3(c, D3.cuePath, C.coral, 4, { a }); line3(c, D3.alt, C.sand, 4, { a }); }
  drawBalls(c, st.balls);
  // rings on the cue ball
  if (t >= SCN.replay && t < SCN.alt && t > REP0) ring3(c, st.cue[0], st.cue[1], 48, C.coral, 3);
  if (t >= ALT0 && t < SCN.towers) ring3(c, st.cue[0], st.cue[1], 48, C.sand, 3);
  if (t >= SCN.towers) towersAndHeat(c, t);
  return st;
}
function cutArc(c, t, t0) {
  const cp = D3.cuePath[1], r5 = D3.RB[5], inc = norm3([cp[0] - D3.cue0[0], cp[1] - D3.cue0[1], 0]), out = norm3([D3.RA[5][0] - r5[0], D3.RA[5][1] - r5[1], 0]);
  const a = span(t, t0, t0 + 0.3) * (1 - span(t, t0 + 2.6, t0 + 3.0)); if (a <= 0) return;
  const L = 520, A0 = Math.atan2(inc[1], inc[0]), A1 = Math.atan2(out[1], out[0]);
  c.save(); c.globalAlpha *= a;
  line3(c, [[cp[0], cp[1]], [cp[0] + inc[0] * L, cp[1] + inc[1] * L]], 'rgba(238,241,245,0.85)', 2, { dash: [8, 8], glow: 0 });
  line3(c, [[r5[0], r5[1]], [r5[0] + out[0] * L, r5[1] + out[1] * L]], C.teal, 2.5, { dash: [8, 8], glow: 0 });
  const arc = []; let d = A1 - A0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const k = ez.out3(span(t, t0 + 0.05, t0 + 0.5)); for (let i = 0; i <= 24; i++) { const ang = A0 + d * k * (i / 24); arc.push([cp[0] + Math.cos(ang) * 260, cp[1] + Math.sin(ang) * 260]); }
  line3(c, arc, C.sand, 4); c.restore();
  const mid = A0 + d * 0.5; chip3(c, '59° CUT', cp[0] + Math.cos(mid) * 330, cp[1] + Math.sin(mid) * 330, 2, C.sand, a, -40, 0);
}
function towersAndHeat(c, t) {
  const boxes = [], hk = span(t, SCN.heat - 0.2, SCN.heat + 1.6);
  const H = (v) => v / 100 * 1400;
  // heat landscape
  if (t >= SCN.heat - 0.2) {
    const [nx, ny] = D3.heatN, cw = TW / nx, ch = TL3 / ny, ex = D3.cueA;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = D3.heat[j][i]; if (v < 0) continue; const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
      const dist = Math.hypot(cx - ex[0], cy - ex[1]) / 4000, u = ez.out3(clamp(hk * 1.6 - dist));
      if (u <= 0) continue; boxes.push({ x0: i * cw + 10, y0: j * ch + 10, x1: (i + 1) * cw - 10, y1: (j + 1) * ch - 10, h: H(v) * 0.55 * u, col: ramp(v / 100), a: 0.92 });
    }
  }
  // the two towers
  const ta = 1 - span(t, SCN.heat, SCN.heat + 0.8);
  const k1 = ez.back(span(t, 32.5, 33.4), 1.2), k2 = ez.back(span(t, 34.0, 34.9), 1.2);
  const tw = (p, v, k, col) => ({ x0: p[0] - 70, y0: p[1] - 70, x1: p[0] + 70, y1: p[1] + 70, h: H(v) * k, col, a: ta, glow: true });
  if (ta > 0) { if (k1 > 0) boxes.push(tw(D3.cueA, 96, k1, C.coral)); if (k2 > 0) boxes.push(tw(D3.alt[D3.alt.length - 1], 23, k2, C.sand)); }
  drawBoxes(c, boxes);
  if (ta > 0) {
    if (k1 > 0) chip3(c, '96%  AS PLAYED', D3.cueA[0], D3.cueA[1], H(96) * k1 + 60, C.coral, span(t, 33.2, 33.5) * ta, -70, -10);
    if (k2 > 0) chip3(c, '23%  SAFER', D3.alt[4][0], D3.alt[4][1], H(23) * k2 + 60, C.sand, span(t, 34.7, 35.0) * ta, -50, -10);
  }
  if (t >= SCN.heat) {
    const a = span(t, SCN.heat + 1.2, SCN.heat + 1.6) * (1 - span(t, SCN.end + 0.2, SCN.end + 0.6));
    chip3(c, 'played: 96%', D3.cueA[0], D3.cueA[1], H(96) * 0.55 + 80, C.coral, a, -60, -10);
    chip3(c, 'safer: 23%', D3.alt[4][0], D3.alt[4][1], H(23) * 0.55 + 80, C.sand, a, -50, -10);
  }
}

// ---------------- HUD per scene ----------------
function hudPanel(c, a) { if (a <= 0) return; c.save(); c.globalAlpha *= a; const g = c.createLinearGradient(0, 0, 520, 0); g.addColorStop(0, 'rgba(8,11,16,0.9)'); g.addColorStop(0.7, 'rgba(8,11,16,0.6)'); g.addColorStop(1, 'rgba(8,11,16,0)'); c.fillStyle = g; c.fillRect(0, 0, 520, 720); c.restore(); }
function hud(c, t, st) {
  if (t >= SCN.drop && t < SCN.end) hudPanel(c, t < SCN.clip ? span(t, 4.0, 4.4) : 1);
  if (t < SCN.drop) {
    const a = span(t, 1.95, 2.05) * (1 - span(t, 3.55, 3.9)), s = lerp(1.25, 1, ez.outExpo(span(t, 2.0, 2.5)));
    if (a > 0) { c.save(); c.globalAlpha = a; c.translate(640, 380); c.scale(s, s); c.font = HEAD(150); c.textAlign = 'center'; c.fillStyle = C.ink; c.shadowColor = 'rgba(60,198,184,0.6)'; c.shadowBlur = 40; c.fillText('SHOT LAB', 0, 0); c.shadowBlur = 0; c.font = MONO(22, 600); c.fillStyle = C.teal; c.letterSpacing = '8px'; c.fillText('SNOOKER SHOT ANALYTICS', 0, 60); c.restore(); }
    return;
  }
  if (t < SCN.clip) {
    hudTag(c, 'SHOT LAB · WILSON TO PLAY', 4.1, t); hudHead(c, ['One shot.'], 4.5, t); hudHead(c, ['Every number.'], 5.5, t, 198);
    c.save(); c.globalAlpha *= span(t, 6.5, 6.8); c.font = MONO(18); c.fillStyle = C.mute; c.fillText('19 balls · tracked from the broadcast', HX, 260); c.restore();
    footer(c, span(t, 4.2, 4.8)); return;
  }
  if (t < SCN.result) {
    const s = repS(t), v = t < REP0 ? 0 : pathAt(D3.cuePath, CUE_T, CUE_SP, s).v;
    hudTag(c, 'REPLAY · 0.5× · 3D', SCN.replay + 0.2, t);
    hudNum(c, v, 2, 'm/s', 214, t, C.ink, 104, 'CUE BALL SPEED');
    if (s > RED_T[0]) { const vr = pathAt(D3.redPath, RED_T, RED_SP, s).v; c.save(); c.globalAlpha *= span(t, 16.0, 16.2);
      c.font = MONO(17, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText('RED SPEED', HX, 290); c.fillText('CONTACT', HX + 200, 290); c.letterSpacing = '0px';
      c.font = HEAD(56); c.fillStyle = C.teal; c.fillText(vr.toFixed(2), HX, 350); c.fillStyle = C.sand; c.fillText('59°', HX + 200, 350); c.restore(); }
    sparkline(c, t, s); chip3(c, v.toFixed(2) + ' m/s', st.cue[0], st.cue[1], BR, C.ink, t > REP0 && s < CUE_T[4] ? 1 : 0);
    footer(c); return;
  }
  if (t < SCN.alt) {
    hudTag(c, 'THE RESULT', 20.05, t); hudHead(c, ['Left in', 'the open.'], 20.1, t);
    hudPct(c, 96, 21.0, t, C.coral, "MOODY'S NEXT POT", 'easy red · 8° cut · 0.4 m');
    chip3(c, 'cue ball stops here', D3.cueA[0], D3.cueA[1], BR, C.coral, span(t, 20.2, 20.4) * (1 - span(t, 22.5, 22.8)));
    footer(c); return;
  }
  if (t < SCN.towers) {
    const s = altS(t), v = t < ALT0 ? 2.45 : pathAt(D3.alt, ALT_T, ALT_SP, s).v;
    hudTag(c, t < ALT0 ? 'REWIND' : 'THE SAFER OPTION', t < ALT0 ? 24.0 : ALT0, t, C.sand);
    hudHead(c, ['Thinner.', 'Firmer.'], ALT0 + 0.1, t);
    c.save(); c.globalAlpha *= span(t, ALT0 + 0.3, ALT0 + 0.6) * (1 - span(t, 30.6, 30.9)); hudNum(c, v, 2, 'm/s', 360, t, C.ink, 84, 'CUE BALL SPEED');
    c.font = MONO(17); c.fillStyle = C.mute; c.fillText('start pace ≈2.45 · played 2.05', HX, 398); c.fillText('contact ≈80°, thin · played 59°', HX, 424); c.restore();
    if (t >= ALT0) chip3(c, v.toFixed(2) + ' m/s', st.cue[0], st.cue[1], BR, C.ink, s < ALT_T[4] ? 1 : 0);
    if (t > 30.0) chip3(c, 'tight on the baulk cushion', D3.alt[4][0], D3.alt[4][1], BR, C.sand, span(t, 30.0, 30.3), -320, 44);
    hudPct(c, 23, 31.0, t, C.sand, "MOODY'S NEXT POT", 'long red · 2.8 m · off the cushion', 560);
    footer(c); return;
  }
  if (t < SCN.heat) {
    hudTag(c, 'RISK, IN 3D', 32.05, t); hudHead(c, ['Same shot.', 'Different', 'risk.'], 32.1, t, 136, 56, 64);
    if (t > 36.0) { const k = span(t, 36.0, 36.35), pop = 1 + 0.12 * Math.sin(Math.PI * span(t, 36.2, 36.5)); c.save(); c.translate(HX, 470); c.scale(pop, pop); c.globalAlpha = k; c.font = HEAD(140); c.fillStyle = C.sand; c.shadowColor = 'rgba(242,193,78,0.6)'; c.shadowBlur = 30; c.fillText('4×', -4, 0); c.shadowBlur = 0; c.font = MONO(24, 600); c.fillStyle = C.ink; c.fillText('less risk', 6, 48); c.restore(); }
    footer(c); return;
  }
  if (t < SCN.end) {
    hudTag(c, 'EVERY SPOT, SCORED', 38.05, t); hudHead(c, ['Where the cue', 'ball should', 'stop.'], 38.1, t, 136, 52, 60);
    c.save(); c.globalAlpha *= span(t, 39.2, 39.6); const gx = HX, gy = 560, gw = 300; const g = c.createLinearGradient(gx, 0, gx + gw, 0); g.addColorStop(0, '#3cc6b8'); g.addColorStop(0.5, '#f2c14e'); g.addColorStop(1, '#ff6b5b'); c.fillStyle = g; rr(c, gx, gy, gw, 12, 6); c.fill();
    c.font = MONO(16); c.fillStyle = C.mute; c.fillText('0%', gx, gy + 36); c.textAlign = 'right'; c.fillText('100%', gx + gw, gy + 36); c.textAlign = 'left'; c.fillText("Opponent's best pot from each spot", gx, gy - 16); c.restore();
    footer(c); return;
  }
  // end card
  const a = span(t, 42.0, 42.15), s = lerp(1.15, 1, ez.outExpo(span(t, 42.0, 42.6)));
  c.save(); c.fillStyle = `rgba(8,11,16,${0.72 * span(t, 42.0, 42.4)})`; c.fillRect(0, 0, 1280, 720); c.restore();
  c.save(); c.globalAlpha = a; c.translate(640, 350); c.scale(s, s); c.font = HEAD(150); c.textAlign = 'center'; c.fillStyle = C.ink; c.shadowColor = 'rgba(60,198,184,0.6)'; c.shadowBlur = 40; c.fillText('SHOT LAB', 0, 0); c.shadowBlur = 0; c.restore();
  c.save(); c.globalAlpha = span(t, 42.6, 43.0); c.font = HEAD(40, 700); c.textAlign = 'center'; c.fillStyle = C.sand; c.fillText('Every shot, measured.', 640, 430); c.font = MONO(18); c.fillStyle = C.mute; c.fillText('Speed · pot chance · risk · from the broadcast feed', 640, 476); c.restore();
  c.save(); c.globalAlpha = span(t, 43.0, 43.4); c.font = MONO(14); c.fillStyle = '#5f6a7a'; c.textAlign = 'center'; c.fillText('Concept demo. Figures are estimates from broadcast tracking and a pot-probability model.', 640, 690); c.restore();
}
function sparkline(c, t, s) {
  const S = { x: HX, y: 520, w: 340, h: 110, s0: CUE_T[0], s1: CUE_T[4], vmax: 2.2 };
  c.save(); c.globalAlpha *= span(t, SCN.replay + 0.4, SCN.replay + 0.8);
  c.font = MONO(15, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText('SPEED OVER THE SHOT', S.x, S.y - 16); c.letterSpacing = '0px';
  c.strokeStyle = C.grid; c.lineWidth = 1; [0, 1, 2].forEach((g) => { const y = S.y + S.h - (g / S.vmax) * S.h; c.beginPath(); c.moveTo(S.x, y); c.lineTo(S.x + S.w, y); c.stroke(); });
  const sx = (q) => S.x + (q - S.s0) / (S.s1 - S.s0) * S.w, sy = (v) => S.y + S.h - (v / S.vmax) * S.h, now = clamp(s, S.s0, S.s1), pts = [];
  for (let i = 0; i < 4; i++) { if (CUE_T[i] > now) break; pts.push([sx(CUE_T[i]), sy(CUE_SP[i][0])]); const e = Math.min(now, CUE_T[i + 1]); pts.push([sx(e), sy(pathAt(D3.cuePath, CUE_T, CUE_SP, Math.min(e, CUE_T[i + 1] - 1e-4)).v)]); }
  if (pts.length > 1) { c.strokeStyle = C.coral; c.lineWidth = 3; c.lineJoin = 'round'; c.shadowColor = C.coral; c.shadowBlur = 10; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
  c.restore();
}
// real broadcast clip (bars 4-5): footage + our live trail
const CLIP_S0 = 31.95;
function sceneClip(c, t) {
  FOOTAGE.full(c); const s = CLIP_S0 + (t - SCN.clip), M2 = (p) => [p[0] * 2, p[1] * 2];
  const tr = DATA.cueTrack.filter((p) => p[0] <= s).map((p) => M2([p[1], p[2]]));
  if (s > 32.45) { const h = M2(trackAt(DATA.cueTrack, s)); tr.push(h); c.save(); c.strokeStyle = C.coral; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; c.shadowColor = C.coral; c.shadowBlur = 16; c.beginPath(); tr.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.restore();
    c.save(); c.strokeStyle = C.coral; c.lineWidth = 3; c.shadowColor = C.coral; c.shadowBlur = 12; c.beginPath(); c.arc(h[0], h[1], 16, 0, 7); c.stroke(); c.restore(); }
  chip(c, '● BROADCAST FEED · REAL TIME', 40, 62, C.coral, span(t, 8.1, 8.3));
  chip(c, 'TRACKED LIVE · NO EXTRA HARDWARE', 40, 100, C.ink, span(t, 9.0, 9.3));
}
function trackAt(T, s) { if (s <= T[0][0]) return [T[0][1], T[0][2]]; for (let i = 0; i < T.length - 1; i++) { const a = T[i], b = T[i + 1]; if (s <= b[0]) { const u = (s - a[0]) / Math.max(1e-6, b[0] - a[0]); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; } } const z = T[T.length - 1]; return [z[1], z[2]]; }

function vignette(c) { const v = c.createRadialGradient(640, 360, 380, 640, 360, 860); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = v; c.fillRect(0, 0, 1280, 720); }
function letterbox(c, t) { const h = 34 * (t < 1 ? 1 : 1 - span(t, 3.6, 4.0)) + 34 * span(t, 42, 42.6); if (h > 0.5) { c.fillStyle = '#000'; c.fillRect(0, 0, 1280, h); c.fillRect(0, 720 - h, 1280, h); } }

var EDIT = {
  D: SCN.D,
  SPANS: [[0, SCN.D]],
  draw(c, t) {
    if (t >= SCN.clip && t < SCN.replay) sceneClip(c, t);
    else { const st = scene3D(c, t); hud(c, t, st); }
    vignette(c); letterbox(c, t);
    flash(c, t, SCN.clip); flash(c, t, SCN.replay); flash(c, t, 16.0, 0.12); flash(c, t, SCN.end, 0.25);
    if (t < 0.6) { c.fillStyle = `rgba(0,0,0,${1 - span(t, 0, 0.6)})`; c.fillRect(0, 0, 1280, 720); }
    if (t > 45.3) { c.fillStyle = `rgba(0,0,0,${span(t, 45.3, 45.96)})`; c.fillRect(0, 0, 1280, 720); }
  },
  score(k) { scoreV2(k); },
};

// ================= MUSIC: cinematic sports pulse, A minor, 120 BPM =================
function scoreV2(k) {
  const b = (n) => n * BEAT;                       // beat index -> seconds
  const CH = [['A2', 'E3', 'A3', 'C4', 'E4'], ['F2', 'C3', 'F3', 'A3', 'C4'], ['C3', 'G3', 'C4', 'E4', 'G4'], ['G2', 'D3', 'G3', 'B3', 'D4']];
  const ROOT = ['A1', 'F1', 'C2', 'G1'];
  const chordAt = (t) => Math.floor(t / BARLEN) % 4;
  const kick = (t, g = 1) => { k.voice(t, { f: [[0, 160], [0.09, 46]], dur: 0.34, gain: 0.62 * g, a: 0.002 }); k.hiss(t, { dur: 0.012, filter: 'highpass', ff: 3000, gain: 0.05 * g }); };
  const clap = (t, g = 1) => { [0, 0.011, 0.022].forEach((d) => k.hiss(t + d, { dur: 0.05, filter: 'bandpass', ff: 1500, q: 1.3, gain: 0.16 * g })); k.hiss(t + 0.03, { dur: 0.22, filter: 'bandpass', ff: 1300, q: 0.9, gain: 0.1 * g, verb: 0.3 }); };
  const hat = (t, g = 1, open = false) => k.hiss(t, { dur: open ? 0.16 : 0.035, filter: 'highpass', ff: 8500, gain: (open ? 0.05 : 0.045) * g });
  const bass = (t, n, d = 0.22, g = 1) => { k.voice(t, { type: 'sawtooth', f: n, dur: d, gain: 0.085 * g, a: 0.004, hold: d * 0.5, filter: 'lowpass', ff: [[0, 900], [d, 260]], q: 4 }); k.voice(t, { f: n, dur: d, gain: 0.12 * g, a: 0.004, hold: d * 0.5 }); };
  const pad = (t, ch, d, g = 1, ff = 1600) => ch.forEach((n, j) => k.voice(t, { type: 'sawtooth', f: n, dur: d + 0.5, gain: 0.014 * g, a: 0.35, hold: Math.max(0, d - 0.5), filter: 'lowpass', ff, pan: (j - 2) * 0.25, verb: 0.35 }));
  const stab = (t, ch, g = 1) => ch.slice(1).forEach((n, j) => k.voice(t, { type: 'sawtooth', f: n, dur: 0.32, gain: 0.03 * g, a: 0.003, filter: 'lowpass', ff: [[0, 3800], [0.3, 700]], pan: (j - 2) * 0.3, verb: 0.3 }));
  const crash = (t, g = 1) => k.hiss(t, { dur: 2.2, filter: 'highpass', ff: 4500, gain: 0.11 * g, a: 0.003, verb: 0.4 });
  const sub = (t, n, d, g = 1) => k.voice(t, { f: n, dur: d, gain: 0.16 * g, a: 0.2, hold: d - 0.5 });
  const pluck = (t, f, g = 1, pan = 0) => { k.voice(t, { type: 'triangle', f, dur: 0.6, gain: 0.08 * g, a: 0.003, verb: 0.35, pan }); };
  const arpN = ['A4', 'C5', 'E5', 'G5', 'E5', 'C5', 'D5', 'E5'];
  const groove = (t0, t1, o = {}) => {
    for (let t = t0; t < t1 - 1e-6; t += BEAT) {
      const beat = Math.round(t / BEAT) % 4, ci = chordAt(t);
      if (o.kick !== false && (o.half ? beat === 0 || beat === 2 && o.half === 'two' : true)) kick(t, o.kg || 1);
      if (o.clap && (beat === 1 || beat === 3) && !o.half) clap(t); if (o.clap && o.half && beat === 2) clap(t);
      if (o.hats) { hat(t + BEAT / 2, 1, beat === 3); hat(t + BEAT / 4, 0.5); hat(t + 3 * BEAT / 4, 0.5); }
      if (o.bass) { bass(t + BEAT / 2, ROOT[ci], 0.2, o.bg || 1); if (beat === 0) bass(t, ROOT[ci], 0.3, (o.bg || 1) * 1.1); }
      if (o.arp) for (let q = 0; q < 2; q++) pluck(t + q * BEAT / 2, arpN[(Math.round(t / (BEAT / 2)) + q) % 8], 0.55 * (o.ag || 1), ((q ? 1 : -1) * 0.4));
    }
  };
  // pads under everything, one chord per bar
  for (let bar = 0; bar < 23; bar++) { const t = bar * BARLEN; if (t >= SCN.D - 0.5) break; pad(t, CH[bar % 4], BARLEN, bar < 2 ? 0.8 : bar >= 21 ? 1.2 : 0.9, bar < 2 || (bar >= 6 && bar < 8) ? 900 : 1800); }
  sub(0, 'A1', 4.0, 0.8);
  // bars 0-1: build into the title
  k.play('riser', 0.4, { dur: 1.6, gain: 0.7 }); k.play('slam', 2.0, { gain: 1.0 }); k.play('boom', 2.0, { gain: 0.8 }); crash(2.0, 0.8); stab(2.0, CH[0], 1.4);
  k.play('whoosh', 3.55, { dur: 0.45, gain: 0.45, dir: -1, top: 2600 });
  // bars 2-3: half-time pulse, a tick for each ball that lands
  groove(4, 8, { half: 'two', hats: true, bass: true, bg: 0.8 });
  for (let i = 0; i < 20; i++) k.play('tick', SCN.drop + 0.1 + i * 0.125 + 0.42, { f: 1400 + i * 45, gain: 0.22 });
  k.play('riser', 6.0, { dur: 2.0, gain: 0.8 }); for (let i = 0; i < 8; i++) clap(7.0 + i * (i < 4 ? 0.25 : 0.125) - (i >= 4 ? 0.5 : 0), 0.35 + i * 0.07);
  // bars 4-5: THE DROP on the real clip
  k.play('boom', 8.0, { gain: 1.0 }); crash(8.0); stab(8.0, CH[0], 1.5); groove(8, 12, { clap: true, hats: true, bass: true });
  [9.0, 10.0, 11.0].forEach((t) => stab(t, CH[chordAt(t)], 0.6));
  k.play('strike', 8.5, { gain: 0.6 });
  // bars 6-7: breakdown, ticking tension into contact
  k.play('whoosh', 11.75, { dur: 0.5, gain: 0.55, dir: 1, top: 3000 });
  groove(12, 15.5, { half: 'one', kg: 0.8 }); for (let t = 12; t < 16; t += BEAT) k.play('tick', t, { f: t < 14 ? 2200 : 2600, gain: t < 14 ? 0.18 : 0.26 });
  k.play('riser', 14.0, { dur: 1.95, gain: 1.0 }); k.play('strike', REP0, { gain: 0.5 });
  // bar 8: contact impact
  k.play('boom', 16.0, { gain: 1.0 }); k.play('slam', 16.0, { gain: 0.9 }); crash(16.0); stab(16.0, CH[0], 1.6);
  groove(16, 20, { half: 'two', clap: true, hats: true, bass: true });
  const T = (s) => REP0 + (s - CUE_T[0]) * 2; pluck(T(CUE_T[2]), 330, 1.1, 0.4); pluck(T(CUE_T[3]), 294, 1.0, 0.6);
  k.play('riser', 19.0, { dur: 1.0, gain: 0.6 });
  // bars 10-11: result, full groove, 96 lands on beat
  crash(20.0, 0.8); groove(20, 24, { clap: true, hats: true, bass: true });
  for (let i = 0; i < 12; i++) k.play('tick', 21.0 + i * 0.04, { f: 1800 + i * 90, gain: 0.25 }); k.play('boom', 21.5, { gain: 0.7 }); stab(21.5, CH[0], 1.2);
  // bars 12-15: rewind + safer option, groove with arpeggio
  k.play('whoosh', 24.0, { dur: 0.6, gain: 0.6, dir: -1, top: 3400 }); k.play('glitch', 24.0, { gain: 0.5 });
  groove(24.5, 32, { clap: true, hats: true, bass: true, arp: true, ag: 0.9 });
  const TA = (s) => ALT0 + s * ALT_SCALE; k.play('strike', ALT0, { gain: 0.5 }); pluck(TA(ALT_T[1]), 587, 1.0, 0.1); pluck(TA(ALT_T[2]), 440, 0.9, 0.4); pluck(TA(ALT_T[3]), 392, 0.9, 0.6);
  for (let i = 0; i < 8; i++) k.play('tick', 31.0 + i * 0.04, { f: 1800 + i * 90, gain: 0.25 }); k.play('pop', 31.5, { f: 700, gain: 0.5 }); stab(31.0, CH[3], 1.0);
  // bars 16-18: towers rise on the beat, 4x on bar 18
  crash(32.0, 0.9); groove(32, 38, { clap: true, hats: true, bass: true });
  k.play('stamp', 32.5, { gain: 0.6 }); k.play('stamp', 34.0, { gain: 0.5 }); k.play('riser', 34.5, { dur: 1.5, gain: 0.9 });
  k.play('boom', 36.0, { gain: 1.0 }); k.play('slam', 36.0, { gain: 0.8 }); crash(36.0); stab(36.0, CH[2], 1.5);
  // bars 19-20: landscape, filtered groove + arpeggio shimmer
  groove(38, 42, { half: 'two', hats: true, bass: true, arp: true, ag: 0.7, bg: 0.7 });
  for (let i = 0; i < 16; i++) k.play('tick', 38.0 + i * 0.1, { f: 1500 + i * 60, gain: 0.12 });
  k.play('riser', 40.5, { dur: 1.5, gain: 0.9 });
  // bars 21-22: end card
  k.play('boom', 42.0, { gain: 1.0 }); k.play('slam', 42.0, { gain: 1.0 }); crash(42.0, 1.1); stab(42.0, CH[0], 1.6);
  sub(42.0, 'A1', 3.8, 1.0); ['A3', 'E4', 'A4', 'C5', 'E5'].forEach((n, i) => k.voice(42.6 + i * 0.08, { type: 'triangle', f: n, dur: 3.0, gain: 0.04, a: 0.02, verb: 0.5, pan: (i - 2) * 0.22 }));
}
