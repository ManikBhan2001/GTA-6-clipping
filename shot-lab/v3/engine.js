const BPM = 120, BEAT = 0.5, BARLEN = 2;
const TW = D3.W, TL3 = D3.L, BR = D3.R;
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

