// ===================== SHOT LAB v3: PREDICT =====================
// O'Sullivan's safety (Champion of Champions, ~79:07 of the match video). 120 BPM, 1 bar = 2 s, 46 s.
// 0-4 title | 4-8 balls drop "Where will it stop?" | 8-16 REAL CLIP: strike on 8.5, prediction locks on 10.0,
// ball arrives at the predicted ring | 16-18 verdict: 7.5 cm | 18-26 3D chase replay 1x (contact on 19.0, stop on 26.0)
// 26-30 Murphy's next pot 18% | 30-36 risk landscape | 36-40 "called 6 s early" | 40-46 end card.
// Numbers are estimates: tracking from broadcast frames, homography to a 3569x1778 mm table, rolling physics, pot model.

const SRC_STRIKE = 4738.70, SRC_CONTACT = 4739.37, SRC_LOCK = D3.pred.lockT, SRC_STOP = 4746.40;
const SCN = { title: 0, drop: 4, clip: 8, verdict: 16, replay: 18, result: 26, heat: 30, stat: 36, end: 40, D: 46 };
const CLIP_S0 = 4738.2;                              // clip starts here (strike lands on 8.5)
const clipS = (t) => CLIP_S0 + (t - SCN.clip);
const REP0 = 19.0 - (SRC_CONTACT - SRC_STRIKE);       // replay strike time, contact on the bar
const repS = (t) => SRC_STRIKE + (t - REP0);
const PRED = D3.pred, A_ROLL = PRED.a;
const ROLL_M = (Math.hypot(D3.cueA[0] - PRED.lock[0], D3.cueA[1] - PRED.lock[1]) / 1000).toFixed(1);

// ---------- motion ----------
function cueAt(s) {
  const T = D3.cueTrack; if (s <= T[0][0]) return D3.cue0;
  for (let i = 0; i < T.length - 1; i++) { const a = T[i], b = T[i + 1]; if (s <= b[0]) { const u = (s - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; } }
  return D3.cueA;
}
function cueV(s) {                                   // speed model: measured before the cushion, rolling physics after
  if (s < SRC_STRIKE) return 0;
  if (s < SRC_CONTACT) return lerp(1.22, 1.02, (s - SRC_STRIKE) / (SRC_CONTACT - SRC_STRIKE));
  if (s < 4739.65) return lerp(0.82, 0.72, (s - SRC_CONTACT) / (4739.65 - SRC_CONTACT));
  return Math.max(0, PRED.v0 - A_ROLL * (s - 4739.65));
}
function redAt(s) {
  const P = D3.redPath, T = D3.redT; if (s <= T[0]) return P[0];
  for (let i = 0; i < 2; i++) if (s <= T[i + 1]) { const u = (s - T[i]) / (T[i + 1] - T[i]), e = i === 1 ? 1 - Math.pow(1 - u, 2) : u; return [lerp(P[i][0], P[i + 1][0], e), lerp(P[i][1], P[i + 1][1], e)]; }
  return P[2];
}
const redV = (s) => (s < SRC_CONTACT ? 0 : s < D3.redT[1] ? 0.55 : Math.max(0, 0.45 * (1 - (s - D3.redT[1]) / (D3.redT[2] - D3.redT[1]))));
// predicted path: from the lock point, straight, decelerating at A_ROLL
function predAt(s) { const dt = Math.max(0, s - SRC_LOCK), v = Math.max(0, PRED.v - A_ROLL * dt), d = (PRED.v * PRED.v - v * v) / (2 * A_ROLL) * 1000, D = Math.hypot(PRED.stop[0] - PRED.lock[0], PRED.stop[1] - PRED.lock[1]), u = clamp(d / D); return [lerp(PRED.lock[0], PRED.stop[0], u), lerp(PRED.lock[1], PRED.stop[1], u)]; }

function ballsAt(t) {
  let s = null;
  if (t >= SCN.replay && t < SCN.result) s = repS(t);
  const after = s == null ? t >= SCN.verdict : false;
  const cue = s != null ? cueAt(s) : after ? D3.cueA : D3.cue0;
  const red2 = s != null ? redAt(s) : after ? D3.RA[2] : D3.RB[2];
  const out = [];
  D3.RB.forEach((r, i) => { const p = i === 2 ? red2 : r; out.push({ x: p[0], y: p[1], col: BALLC.red }); });
  Object.entries(D3.cols).forEach(([k, p]) => out.push({ x: p[0], y: p[1], col: BALLC[k] }));
  out.push({ x: cue[0], y: cue[1], col: BALLC.cue, id: 'cue' });
  if (t < SCN.clip) out.forEach((b, i) => { const t0 = SCN.drop + 0.1 + i * 0.25, u = span(t, t0, t0 + 0.45); b.z = BR + 1600 * Math.pow(1 - u, 2) * (u < 1 ? 1 : 0); b.a = span(t, t0 - 0.05, t0 + 0.05); });
  return { balls: out, cue, s };
}

// ---------- cameras ----------
const K = (t, tx, ty, d, az, el, cx = 640, tz = 0) => [t, tx, ty, tz, d, az, el, 1000, cx];
const camKey = (a) => ({ tx: a[0], ty: a[1], tz: a[2], d: a[3], az: a[4], el: a[5], f: a[6], cx: a[7] });
function camAt(t, st) {
  if (t < SCN.clip) return camKey(track([K(0, 889, 1785, 9800, 115, 18), K(3.8, 889, 1785, 6800, 160, 44), K(4.4, 889, 1785, 6400, 172, 52, 700), K(7.6, 889, 1785, 6100, 180, 64, 700), K(8, 889, 1785, 6100, 180, 66, 640)], t));
  if (t < SCN.replay) return camKey(track([K(16, 520, 380, 2300, 180, 70, 760), K(17.6, 540, 420, 2100, 170, 66, 760), K(18.0, 700, 1400, 2600, 150, 40, 760)], t));
  if (t < SCN.result) {
    const s = st.s, b = st.cue;
    if (t < REP0) return camKey(track([K(18.0, 700, 1400, 2600, 150, 40, 760), K(REP0, D3.cue0[0] + 330, D3.cue0[1] - 180, 1300, 118, 22, 760)], t));
    if (s < SRC_CONTACT) { const k = span(s, SRC_STRIKE, SRC_CONTACT); return camKey([lerp(D3.cue0[0] + 330, 1630, k), lerp(D3.cue0[1] - 180, 2470, k), 0, 1300 - 150 * k, 118, 22, 1000, 760]); }
    if (t < 20.2) { const k = ez.inout3(span(t, 19.0, 20.2)); return camKey([lerp(1630, b[0] - 240, k), lerp(2470, b[1] - 430, k), 0, lerp(1150, 1500, k), lerp(118, 209, k), lerp(22, 20, k), 1000, 760]); }
    if (t < 24.0) return camKey([b[0] - 240, b[1] - 430, 0, 1500 + 250 * span(t, 20.2, 24), 209, 20 + 8 * span(t, 20.2, 24), 1000, 760]);
    const A = [b[0] - 240, b[1] - 430, 0, 1750, 209, 28, 1000, 760], B = [520, 380, 0, 2300, 180, 70, 1000, 760], k = ez.inout3(span(t, 24.0, 25.8)); return camKey(A.map((v, i) => lerp(v, B[i], k)));
  }
  if (t < SCN.heat) return camKey(track([K(26, 520, 380, 2300, 180, 70, 760), K(27.0, 900, 1500, 5200, 180, 62, 760), K(30, 900, 1600, 5400, 184, 64, 760)], t));
  if (t < SCN.stat) return camKey(track([K(30, 900, 1600, 5400, 184, 64, 760), K(31.2, 1100, 1900, 5600, 205, 40, 760, 250), K(36, 1050, 1900, 5400, 238, 34, 760, 250)], t));
  return camKey(track([K(36, 1050, 1900, 5400, 238, 34, 760, 250), K(40, 889, 1850, 6300, 212, 48, 760, 200), K(46, 889, 1800, 7400, 196, 58, 640, 200)], t));
}

// ---------- 3D scene ----------
function predRing(c, t, a = 1) { if (a <= 0) return; const p = PRED.stop; ring3(c, p[0], p[1], 60 + 8 * Math.sin(t * 5), C.sand, 3, a); ring3(c, p[0], p[1], 110, 'rgba(242,193,78,0.5)', 1.5, a * 0.7); }
function scene3D(c, t) {
  const st = ballsAt(t); setCam(camAt(t, st)); bgVoid(c, t);
  floorGrid(c, span(t, 0, 1.2) * (t < SCN.heat ? 0.6 : 1));
  drawTable(c, span(t, 0.0, 2.0), span(t, 1.6, 3.0));
  if (t >= SCN.verdict && t < SCN.replay) {
    line3(c, [PRED.lock, PRED.stop], C.sand, 3, { dash: [12, 10], glow: 8 }); predRing(c, t);
    const tr = D3.cueTrack.filter((p) => p[0] >= 4739.6).map((p) => [p[1], p[2]]); line3(c, tr, C.coral, 5);
    // error bracket between predicted and actual
    const k = span(t, 16.4, 16.9); if (k > 0) line3(c, [PRED.stop, [lerp(PRED.stop[0], D3.cueA[0], k), lerp(PRED.stop[1], D3.cueA[1], k)]], C.ink, 2.5, { glow: 0 });
  }
  if (st.s != null) {
    const s = st.s, tr = D3.cueTrack.filter((p) => p[0] <= s).map((p) => [p[1], p[2]]);
    if (s > SRC_STRIKE) { tr.push(st.cue); line3(c, tr, C.coral, 6); }
    if (s > SRC_CONTACT) { const rp = [D3.redPath[0]]; if (s > D3.redT[1]) rp.push(D3.redPath[1]); rp.push(redAt(s)); line3(c, rp, C.teal, 5); }
    if (s > SRC_LOCK) { const a = span(s, SRC_LOCK, SRC_LOCK + 0.3); line3(c, [PRED.lock, PRED.stop], C.sand, 3, { dash: [12, 10], glow: 8, a }); predRing(c, t, a); const g = predAt(s); ring3(c, g[0], g[1], BR + 6, C.sand, 2, a * (s < SRC_STOP ? 1 : 0)); }
    if (s > SRC_CONTACT && s < SRC_CONTACT + 0.6) { const f = span(s, SRC_CONTACT, SRC_CONTACT + 0.4); ring3(c, D3.contact[0], D3.contact[1], 40 + 220 * f, C.sand, 3, 1 - f); }
  }
  if (t >= SCN.result && t < SCN.heat) potLine3(c, D3.murphy, 27.0, t, C.coral);
  if (t >= SCN.result && t < SCN.heat + 0.6) { const a = 0.45 * (1 - span(t, SCN.heat, SCN.heat + 0.6)); line3(c, D3.cueTrack.map((p) => [p[1], p[2]]), C.coral, 4, { a }); }
  drawBalls(c, st.balls);
  if (st.s != null && st.s > SRC_STRIKE) ring3(c, st.cue[0], st.cue[1], 48, C.coral, 3);
  if (t >= SCN.result) ring3(c, D3.cueA[0], D3.cueA[1], 48, C.coral, 3, 1 - span(t, SCN.heat + 4, SCN.heat + 5));
  if (t >= SCN.heat) heatScene(c, t);
  return st;
}
function heatScene(c, t) {
  const boxes = [], hk = span(t, SCN.heat + 0.8, SCN.heat + 2.6), H = (v) => v / 100 * 1400;
  const [nx, ny] = D3.heatN, cw = TW / nx, ch = TL3 / ny, ex = D3.cueA;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = D3.heat[j][i]; if (v < 0) continue; const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
    const u = ez.out3(clamp(hk * 1.6 - Math.hypot(cx - ex[0], cy - ex[1]) / 4000)); if (u <= 0) continue;
    boxes.push({ x0: i * cw + 10, y0: j * ch + 10, x1: (i + 1) * cw - 10, y1: (j + 1) * ch - 10, h: H(v) * 0.55 * u, col: ramp(v / 100), a: 0.92 * (1 - 0.6 * span(t, SCN.end, SCN.end + 0.6)) });
  }
  drawBoxes(c, boxes);
  const a = span(t, SCN.heat + 2.4, SCN.heat + 2.8) * (1 - span(t, SCN.end - 0.4, SCN.end));
  chip3(c, `left here: ${Math.round(D3.murphyP)}%`, ex[0], ex[1], 300, C.coral, a, -40, -14);
}

// ---------- real clip with live overlays ----------
const IMX = (p) => [(p[0] - 110) * 1280 / 420, (p[1] - 68) * 720 / 236];
function imgTrackAt(s) { const T = D3.imgTrack; if (s <= T[0][0]) return [T[0][1], T[0][2]]; for (let i = 0; i < T.length - 1; i++) { const a = T[i], b = T[i + 1]; if (s <= b[0]) { const u = (s - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; } } const z = T[T.length - 1]; return [z[1], z[2]]; }
function sceneClip(c, t) {
  FOOTAGE.full(c); const s = clipS(t);
  c.fillStyle = 'rgba(8,11,16,0.18)'; c.fillRect(0, 0, 1280, 720);
  if (s > SRC_STRIKE) {
    const tr = D3.imgTrack.filter((p) => p[0] <= s && p[0] >= SRC_STRIKE - 0.05).map((p) => IMX([p[1], p[2]])); const h = IMX(imgTrackAt(s)); tr.push(h);
    c.save(); c.strokeStyle = C.coral; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; c.shadowColor = C.coral; c.shadowBlur = 16; c.beginPath(); tr.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.restore();
    c.save(); c.strokeStyle = C.coral; c.lineWidth = 3; c.shadowColor = C.coral; c.shadowBlur = 12; c.beginPath(); c.arc(h[0], h[1], 20, 0, 7); c.stroke(); c.restore();
    if (s < SRC_STOP - 0.2) chip(c, cueV(s).toFixed(2) + ' m/s', h[0] + 26, h[1] - 18, C.ink, 1);
  }
  // prediction on the real picture
  if (s > SRC_LOCK) {
    const a = span(s, SRC_LOCK, SRC_LOCK + 0.25), L = IMX(D3.img.lock), P = IMX(D3.img.predStop);
    const k = ez.out3(span(s, SRC_LOCK, SRC_LOCK + 0.5));
    c.save(); c.globalAlpha = a; c.setLineDash([12, 10]); c.strokeStyle = C.sand; c.lineWidth = 3; c.shadowColor = C.sand; c.shadowBlur = 10; c.beginPath(); c.moveTo(L[0], L[1]); c.lineTo(lerp(L[0], P[0], k), lerp(L[1], P[1], k)); c.stroke(); c.restore();
    if (k >= 1) { const pulse = 1 + 0.12 * Math.sin(t * 7); c.save(); c.globalAlpha = a; c.strokeStyle = C.sand; c.lineWidth = 3; c.shadowColor = C.sand; c.shadowBlur = 16; c.beginPath(); c.ellipse(P[0], P[1], 34 * pulse, 20 * pulse, 0, 0, 7); c.stroke(); c.beginPath(); c.ellipse(P[0], P[1], 58, 34, 0, 0, 7); c.globalAlpha = a * 0.5; c.stroke(); c.restore(); }
    const left = Math.max(0, SRC_STOP - s);
    chip(c, left > 0.05 ? `PREDICTED STOP · ${left.toFixed(1)} s` : 'PREDICTED STOP', P[0] + 60, P[1] + 8, C.sand, span(s, SRC_LOCK + 0.3, SRC_LOCK + 0.5));
  }
  chip(c, '● BROADCAST FEED · REAL TIME', 40, 62, C.coral, span(t, 8.05, 8.25));
  if (s > SRC_LOCK) { const a = span(s, SRC_LOCK, SRC_LOCK + 0.2); chip(c, 'PREDICTION LOCKED · 0.5 s OF MOTION + PHYSICS', 40, 102, C.sand, a); }
}

// ---------- HUD ----------
function hudPanel(c, a) { if (a <= 0) return; c.save(); c.globalAlpha *= a; const g = c.createLinearGradient(0, 0, 520, 0); g.addColorStop(0, 'rgba(8,11,16,0.9)'); g.addColorStop(0.7, 'rgba(8,11,16,0.6)'); g.addColorStop(1, 'rgba(8,11,16,0)'); c.fillStyle = g; c.fillRect(0, 0, 520, 720); c.restore(); }
function bigStat(c, txt, unit, y, t0, t, col, cap, sub, size = 132) {
  const pop = 1 + 0.1 * Math.sin(Math.PI * span(t, t0 + 0.1, t0 + 0.4));
  c.save(); c.globalAlpha *= span(t, t0 - 0.05, t0 + 0.08);
  if (cap) { c.font = MONO(17, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText(cap, HX, y - size * 1.0); c.letterSpacing = '0px'; }
  c.save(); c.translate(HX, y); c.scale(pop, pop); c.font = HEAD(size); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 30 * (1 - span(t, t0 + 0.4, t0 + 1.4)); const w = textW(c, txt, HEAD(size)); c.fillText(txt, -4, 0); c.shadowBlur = 0; c.font = HEAD(Math.round(size * 0.42), 700); c.fillText(unit, w + 6, 0); c.restore();
  if (sub) { c.globalAlpha *= span(t, t0 + 0.4, t0 + 0.8); c.font = MONO(18); c.fillStyle = C.ink; c.fillText(sub, HX, y + 50); }
  c.restore();
}
function speedChart(c, t, s) {
  const S = { x: HX, y: 470, w: 360, h: 120, s0: SRC_STRIKE, s1: SRC_STOP, vmax: 1.4 };
  c.save(); c.globalAlpha *= span(t, REP0, REP0 + 0.4);
  c.font = MONO(15, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText('SPEED · MEASURED vs PHYSICS', S.x, S.y - 16); c.letterSpacing = '0px';
  c.strokeStyle = C.grid; c.lineWidth = 1; [0, 0.5, 1].forEach((g) => { const y = S.y + S.h - (g / S.vmax) * S.h; c.beginPath(); c.moveTo(S.x, y); c.lineTo(S.x + S.w, y); c.stroke(); c.font = MONO(13); c.fillStyle = C.faint; c.fillText(g.toFixed(1), S.x + S.w + 8, y + 4); });
  const sx = (q) => S.x + (q - S.s0) / (S.s1 - S.s0) * S.w, sy = (v) => S.y + S.h - (v / S.vmax) * S.h, now = clamp(s, S.s0, S.s1);
  // physics curve (from the lock), always fully drawn once locked
  if (s > SRC_LOCK) { c.save(); c.globalAlpha *= span(s, SRC_LOCK, SRC_LOCK + 0.3); c.setLineDash([6, 6]); c.strokeStyle = C.sand; c.lineWidth = 2.5; c.beginPath(); for (let q = SRC_LOCK; q <= S.s1; q += 0.05) { const v = Math.max(0, PRED.v - A_ROLL * (q - SRC_LOCK)); q === SRC_LOCK ? c.moveTo(sx(q), sy(v)) : c.lineTo(sx(q), sy(v)); } c.stroke(); c.restore(); }
  // measured speed so far
  c.strokeStyle = C.coral; c.lineWidth = 3; c.shadowColor = C.coral; c.shadowBlur = 8; c.beginPath(); let first = true;
  for (let q = S.s0; q <= now; q += 0.04) { const v = cueV(q) * (1 + 0.04 * Math.sin(q * 23)); if (first) { c.moveTo(sx(q), sy(v)); first = false; } else c.lineTo(sx(q), sy(v)); } c.stroke();
  c.restore();
}
function hud(c, t, st) {
  if (t >= SCN.drop && t < SCN.end) hudPanel(c, t < SCN.clip ? span(t, 4.0, 4.4) : 1);
  if (t < SCN.drop) {
    const a = span(t, 1.95, 2.05) * (1 - span(t, 3.55, 3.9)), s = lerp(1.25, 1, ez.outExpo(span(t, 2.0, 2.5)));
    if (a > 0) { c.save(); c.globalAlpha = a; c.translate(640, 380); c.scale(s, s); c.font = HEAD(150); c.textAlign = 'center'; c.fillStyle = C.ink; c.shadowColor = 'rgba(242,193,78,0.6)'; c.shadowBlur = 40; c.fillText('SHOT LAB', 0, 0); c.shadowBlur = 0; c.font = MONO(22, 600); c.fillStyle = C.sand; c.letterSpacing = '8px'; c.fillText('PREDICT · TRACK · MEASURE', 0, 60); c.restore(); }
    return;
  }
  if (t < SCN.clip) {
    hudTag(c, "SHOT LAB · O'SULLIVAN TO PLAY", 4.1, t); hudHead(c, ['Where will', 'it stop?'], 4.5, t);
    c.save(); c.globalAlpha *= span(t, 6.0, 6.3); c.font = MONO(18); c.fillStyle = C.mute; c.fillText('We call it while the ball is still rolling.', HX, 290); c.restore();
    footer(c, span(t, 4.2, 4.8)); return;
  }
  if (t < SCN.replay) {
    hudTag(c, 'PREDICTED vs ACTUAL', 16.05, t, C.sand);
    bigStat(c, (PRED.err / 10).toFixed(1), 'cm', 270, 16.0, t, C.sand, 'MISS DISTANCE', `called ${(SRC_STOP - SRC_LOCK).toFixed(1)} s before it stopped`);
    c.save(); c.globalAlpha *= span(t, 16.6, 17.0); c.font = MONO(17); c.fillStyle = C.mute; c.fillText(`ball rolled ${ROLL_M} m after the call`, HX, 360); c.restore();
    const ap = P(D3.cueA[0], D3.cueA[1], BR); if (ap) chip(c, 'actual', ap[0] - 110, ap[1] + 40, C.coral, span(t, 16.3, 16.5));
    const pp = P(PRED.stop[0], PRED.stop[1], BR); if (pp) chip(c, 'predicted', pp[0] + 40, pp[1] + 40, C.sand, span(t, 16.3, 16.5));
    footer(c); return;
  }
  if (t < SCN.result) {
    const s = st.s, v = cueV(s);
    hudTag(c, 'REPLAY · 1× · 3D', SCN.replay + 0.1, t);
    hudNum(c, v, 2, 'm/s', 200, t, C.ink, 104, 'CUE BALL SPEED');
    if (s > SRC_CONTACT) { c.save(); c.globalAlpha *= span(s, SRC_CONTACT, SRC_CONTACT + 0.2); c.font = MONO(17, 600); c.fillStyle = C.mute; c.letterSpacing = '2px'; c.fillText('RED SPEED', HX, 276); c.fillText('DISTANCE', HX + 200, 276); c.letterSpacing = '0px';
      c.font = HEAD(52); c.fillStyle = C.teal; c.fillText(redV(s).toFixed(2), HX, 332); c.fillStyle = C.ink; const tr = D3.cueTrack.filter((p) => p[0] <= s); let d = 0; for (let i = 1; i < tr.length; i++) d += Math.hypot(tr[i][1] - tr[i - 1][1], tr[i][2] - tr[i - 1][2]); c.fillText((d / 1000).toFixed(1) + ' m', HX + 200, 332); c.restore(); }
    speedChart(c, t, s);
    if (s > SRC_LOCK) chip(c, `PREDICTED STOP · ${Math.max(0, SRC_STOP - s).toFixed(1)} s`, HX, 660, C.sand, span(s, SRC_LOCK, SRC_LOCK + 0.2) * (1 - span(t, 25.9, 26.2)));
    chip3(c, v.toFixed(2) + ' m/s', st.cue[0], st.cue[1], BR, C.ink, s > SRC_STRIKE && s < SRC_STOP - 0.3 ? 1 : 0);
    footer(c); return;
  }
  if (t < SCN.heat) {
    hudTag(c, 'THE RESULT', 26.05, t); hudHead(c, ['Frozen to the', 'baulk cushion.'], 26.1, t, 136, 50, 58);
    bigStat(c, String(Math.round(D3.murphyP)), '%', 470, 27.5, t, C.coral, "MURPHY'S BEST POT", `long red · ${(D3.murphyInfo.d1 / 1000).toFixed(1)} m · off the cushion`);
    footer(c); return;
  }
  if (t < SCN.stat) {
    hudTag(c, 'EVERY SPOT, SCORED', 30.05, t); hudHead(c, ['Anywhere else,', 'Murphy', 'scores.'], 30.1, t, 136, 50, 58);
    c.save(); c.globalAlpha *= span(t, 32.6, 33.0); c.font = MONO(18); c.fillStyle = C.ink; const avg = Math.round(D3.heat.flat().filter((v) => v >= 0).reduce((a, b) => a + b, 0) / D3.heat.flat().filter((v) => v >= 0).length);
    c.fillText(`average spot on the table: ${avg}%`, HX, 330); c.fillStyle = C.coral; c.fillText(`where O'Sullivan left it: ${Math.round(D3.murphyP)}%`, HX, 360); c.restore();
    c.save(); c.globalAlpha *= span(t, 31.4, 31.8); const gx = HX, gy = 560, gw = 300, g = c.createLinearGradient(gx, 0, gx + gw, 0); g.addColorStop(0, '#3cc6b8'); g.addColorStop(0.5, '#f2c14e'); g.addColorStop(1, '#ff6b5b'); c.fillStyle = g; rr(c, gx, gy, gw, 12, 6); c.fill();
    c.font = MONO(16); c.fillStyle = C.mute; c.fillText('0%', gx, gy + 36); c.textAlign = 'right'; c.fillText('100%', gx + gw, gy + 36); c.textAlign = 'left'; c.fillText("Murphy's best pot from each spot", gx, gy - 16); c.restore();
    footer(c); return;
  }
  if (t < SCN.end) {
    hudTag(c, 'THE CALL', 36.05, t, C.sand);
    bigStat(c, (SRC_STOP - SRC_LOCK).toFixed(1), 's', 250, 36.0, t, C.sand, 'CALLED EARLY', 'from half a second of motion', 140);
    bigStat(c, (PRED.err / 10).toFixed(1), 'cm', 470, 37.0, t, C.ink, 'OFF', `after a ${ROLL_M} m roll`, 110);
    footer(c); return;
  }
  const a = span(t, 40.0, 40.15), sc = lerp(1.15, 1, ez.outExpo(span(t, 40.0, 40.6)));
  c.save(); c.fillStyle = `rgba(8,11,16,${0.72 * span(t, 40.0, 40.4)})`; c.fillRect(0, 0, 1280, 720); c.restore();
  c.save(); c.globalAlpha = a; c.translate(640, 350); c.scale(sc, sc); c.font = HEAD(150); c.textAlign = 'center'; c.fillStyle = C.ink; c.shadowColor = 'rgba(242,193,78,0.55)'; c.shadowBlur = 40; c.fillText('SHOT LAB', 0, 0); c.shadowBlur = 0; c.restore();
  c.save(); c.globalAlpha = span(t, 40.6, 41.0); c.font = HEAD(40, 700); c.textAlign = 'center'; c.fillStyle = C.sand; c.fillText('See the shot before it ends.', 640, 430); c.font = MONO(18); c.fillStyle = C.mute; c.fillText('Prediction · speed · pot chance · risk · from the broadcast feed', 640, 476); c.restore();
  c.save(); c.globalAlpha = span(t, 41.0, 41.4); c.font = MONO(14); c.fillStyle = '#5f6a7a'; c.textAlign = 'center'; c.fillText('Concept demo. Figures are estimates from broadcast tracking, rolling physics and a pot-probability model.', 640, 690); c.restore();
}

function vignette(c) { const v = c.createRadialGradient(640, 360, 380, 640, 360, 860); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = v; c.fillRect(0, 0, 1280, 720); }
function letterbox(c, t) { const h = 34 * (t < 1 ? 1 : 1 - span(t, 3.6, 4.0)) + 34 * span(t, 40, 40.6); if (h > 0.5) { c.fillStyle = '#000'; c.fillRect(0, 0, 1280, h); c.fillRect(0, 720 - h, 1280, h); } }
var EDIT = {
  D: SCN.D, SPANS: [[0, SCN.D]],
  draw(c, t) {
    if (t >= SCN.clip && t < SCN.verdict) sceneClip(c, t); else { const st = scene3D(c, t); hud(c, t, st); }
    vignette(c); letterbox(c, t);
    flash(c, t, SCN.clip); flash(c, t, SCN.verdict); flash(c, t, 19.0, 0.12); flash(c, t, SCN.end, 0.25);
    if (t < 0.6) { c.fillStyle = `rgba(0,0,0,${1 - span(t, 0, 0.6)})`; c.fillRect(0, 0, 1280, 720); }
    if (t > 45.3) { c.fillStyle = `rgba(0,0,0,${span(t, 45.3, 46)})`; c.fillRect(0, 0, 1280, 720); }
  },
  score(k) { scoreV3(k); },
};

// ================= MUSIC: cinematic sports pulse, A minor, 120 BPM =================
function scoreV3(k) {
  const CH = [['A2', 'E3', 'A3', 'C4', 'E4'], ['F2', 'C3', 'F3', 'A3', 'C4'], ['C3', 'G3', 'C4', 'E4', 'G4'], ['G2', 'D3', 'G3', 'B3', 'D4']];
  const ROOT = ['A1', 'F1', 'C2', 'G1'], chordAt = (t) => Math.floor(t / BARLEN) % 4;
  const kick = (t, g = 1) => { k.voice(t, { f: [[0, 160], [0.09, 46]], dur: 0.34, gain: 0.62 * g, a: 0.002 }); k.hiss(t, { dur: 0.012, filter: 'highpass', ff: 3000, gain: 0.05 * g }); };
  const clap = (t, g = 1) => { [0, 0.011, 0.022].forEach((d) => k.hiss(t + d, { dur: 0.05, filter: 'bandpass', ff: 1500, q: 1.3, gain: 0.16 * g })); k.hiss(t + 0.03, { dur: 0.22, filter: 'bandpass', ff: 1300, q: 0.9, gain: 0.1 * g, verb: 0.3 }); };
  const hat = (t, g = 1, open = false) => k.hiss(t, { dur: open ? 0.16 : 0.035, filter: 'highpass', ff: 8500, gain: (open ? 0.05 : 0.045) * g });
  const bass = (t, n, d = 0.22, g = 1) => { k.voice(t, { type: 'sawtooth', f: n, dur: d, gain: 0.085 * g, a: 0.004, hold: d * 0.5, filter: 'lowpass', ff: [[0, 900], [d, 260]], q: 4 }); k.voice(t, { f: n, dur: d, gain: 0.12 * g, a: 0.004, hold: d * 0.5 }); };
  const pad = (t, ch, d, g = 1, ff = 1600) => ch.forEach((n, j) => k.voice(t, { type: 'sawtooth', f: n, dur: d + 0.5, gain: 0.014 * g, a: 0.35, hold: Math.max(0, d - 0.5), filter: 'lowpass', ff, pan: (j - 2) * 0.25, verb: 0.35 }));
  const stab = (t, ch, g = 1) => ch.slice(1).forEach((n, j) => k.voice(t, { type: 'sawtooth', f: n, dur: 0.32, gain: 0.03 * g, a: 0.003, filter: 'lowpass', ff: [[0, 3800], [0.3, 700]], pan: (j - 2) * 0.3, verb: 0.3 }));
  const crash = (t, g = 1) => k.hiss(t, { dur: 2.2, filter: 'highpass', ff: 4500, gain: 0.11 * g, a: 0.003, verb: 0.4 });
  const sub = (t, n, d, g = 1) => k.voice(t, { f: n, dur: d, gain: 0.16 * g, a: 0.2, hold: d - 0.5 });
  const pluck = (t, f, g = 1, pan = 0) => k.voice(t, { type: 'triangle', f, dur: 0.6, gain: 0.08 * g, a: 0.003, verb: 0.35, pan });
  const arpN = ['A4', 'C5', 'E5', 'G5', 'E5', 'C5', 'D5', 'E5'];
  const groove = (t0, t1, o = {}) => { for (let t = t0; t < t1 - 1e-6; t += BEAT) { const beat = Math.round(t / BEAT) % 4, ci = chordAt(t);
    if (o.kick !== false && (o.half ? beat === 0 || (beat === 2 && o.half === 'two') : true)) kick(t, o.kg || 1);
    if (o.clap && ((!o.half && (beat === 1 || beat === 3)) || (o.half && beat === 2))) clap(t);
    if (o.hats) { hat(t + BEAT / 2, 1, beat === 3); hat(t + BEAT / 4, 0.5); hat(t + 3 * BEAT / 4, 0.5); }
    if (o.bass) { bass(t + BEAT / 2, ROOT[ci], 0.2, o.bg || 1); if (beat === 0) bass(t, ROOT[ci], 0.3, (o.bg || 1) * 1.1); }
    if (o.arp) for (let q = 0; q < 2; q++) pluck(t + q * BEAT / 2, arpN[(Math.round(t / (BEAT / 2)) + q) % 8], 0.55 * (o.ag || 1), (q ? 1 : -1) * 0.4); } };
  for (let bar = 0; bar < 23; bar++) { const t = bar * BARLEN; pad(t, CH[bar % 4], BARLEN, bar < 2 ? 0.8 : bar >= 20 ? 1.2 : 0.9, bar < 2 || (bar >= 4 && bar < 8) ? 1000 : 1800); }
  // 0-4 title
  sub(0, 'A1', 4, 0.8); k.play('riser', 0.4, { dur: 1.6, gain: 0.7 }); k.play('slam', 2.0); k.play('boom', 2.0, { gain: 0.8 }); crash(2.0, 0.8); stab(2.0, CH[0], 1.4);
  k.play('whoosh', 3.55, { dur: 0.45, gain: 0.45, dir: -1, top: 2600 });
  // 4-8 drop-in, build
  groove(4, 8, { half: 'two', hats: true, bass: true, bg: 0.8 });
  for (let i = 0; i < 15; i++) k.play('tick', SCN.drop + 0.1 + i * 0.25 + 0.42, { f: 1400 + i * 60, gain: 0.22 });
  k.play('riser', 6.0, { dur: 2.0, gain: 0.8 }); for (let i = 0; i < 8; i++) clap(6.5 + i * (i < 4 ? 0.25 : 0.125) + (i >= 4 ? 0.5 : 0) - (i >= 4 ? 0.5 : 0), 0.35 + i * 0.07);
  // 8-16 real clip: drop, then tension under the countdown
  k.play('boom', 8.0); crash(8.0); stab(8.0, CH[0], 1.5); k.play('strike', 8.5, { gain: 0.7 });
  groove(8, 10, { clap: true, hats: true, bass: true });
  k.play('stamp', 10.0, { gain: 0.7 }); stab(10.0, CH[2], 1.3); k.play('send', 10.0, { gain: 0.6 });       // prediction locks
  groove(10, 15.5, { half: 'one', hats: true, bass: true, bg: 0.7 });
  for (let t = 10.5; t < 16; t += BEAT) k.play('tick', t, { f: 2000 + (t - 10.5) * 120, gain: 0.16 + (t - 10.5) * 0.02 });
  k.play('riser', 13.5, { dur: 2.45, gain: 1.0 });
  // 16 verdict
  k.play('boom', 16.0); k.play('slam', 16.0, { gain: 0.9 }); crash(16.0); stab(16.0, CH[0], 1.6); groove(16, 18, { half: 'two', clap: true, hats: true, bass: true });
  k.play('whoosh', 17.7, { dur: 0.5, gain: 0.5, dir: 1, top: 3000 });
  // 18-26 replay: contact on 19.0, long run with arpeggio, stop on 26.0
  k.play('strike', REP0, { gain: 0.6 }); k.play('slam', 19.0, { gain: 0.6 }); pluck(19.0, 587, 1.1); crash(19.0, 0.6);
  groove(19, 26, { clap: true, hats: true, bass: true, arp: true, ag: 0.8 }); pluck(19.0 + (SRC_LOCK - SRC_CONTACT), 880, 0.8, 0.3);
  k.play('riser', 24.5, { dur: 1.5, gain: 0.8 });
  // 26-30 result
  k.play('boom', 26.0, { gain: 0.9 }); crash(26.0); stab(26.0, CH[1], 1.3); groove(26, 30, { clap: true, hats: true, bass: true });
  for (let i = 0; i < 10; i++) k.play('tick', 27.5 + i * 0.04, { f: 1800 + i * 90, gain: 0.25 }); k.play('pop', 27.95, { f: 640, gain: 0.5 });
  // 30-36 landscape
  k.play('whoosh', 30.0, { dur: 0.5, gain: 0.45, dir: -1, top: 2600 }); groove(30, 36, { half: 'two', hats: true, bass: true, arp: true, ag: 0.7, bg: 0.8 });
  for (let i = 0; i < 18; i++) k.play('tick', 30.8 + i * 0.1, { f: 1500 + i * 60, gain: 0.12 }); k.play('riser', 34.5, { dur: 1.5, gain: 0.9 });
  // 36-40 the call
  k.play('boom', 36.0); k.play('slam', 36.0, { gain: 0.8 }); crash(36.0); stab(36.0, CH[2], 1.5); k.play('stamp', 37.0, { gain: 0.6 }); groove(36, 40, { clap: true, hats: true, bass: true });
  k.play('riser', 38.5, { dur: 1.5, gain: 0.9 });
  // 40-46 end card
  k.play('boom', 40.0); k.play('slam', 40.0); crash(40.0, 1.1); stab(40.0, CH[0], 1.6); sub(40.0, 'A1', 5.5, 1.0);
  ['A3', 'E4', 'A4', 'C5', 'E5'].forEach((n, i) => k.voice(40.6 + i * 0.08, { type: 'triangle', f: n, dur: 4.5, gain: 0.04, a: 0.02, verb: 0.5, pan: (i - 2) * 0.22 }));
}
