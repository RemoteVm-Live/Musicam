export function createVisualModule(ctx) {
const { W, H, $, $$, clamp, lerp, dist, nowS, NOTE_NAMES, SHARP_NAMES, FLAT_NAMES, spell, SCALES, SCALE_ORDER, DRUM_ZONES, HAND_ZONES, INSTRUMENTS, INSTRUMENT_ORDER, own, MAX_STRINGS, MAX_LAYERS, state, hexA, toast, strRoot, strScale, strLen, strMid, orient, zoneCount, zoneInfo, stringLabel, addString, removeString, clearStrings, pluck, notePop, keepVoices, bendString, ROLLS, HOLD_IN, HOLD_OUT, HOLD_AFTER, holdNote, rollGap, startHold, endHold, updateHolds, sweep, forgetPointer, nearestBody, PULL_MAX, BEND_CENTS, pullString, releasePull, burst, nearestEndpoint, nearestDot, distToString, menuItems, MENU_TITLES, openMenu, menuContains, closeMenu, menuIdle, chooseMenu, pluckQuiet, updateMenu, film, enterClean, leaveClean, startFilm, stopFilm, toggleClean, setShape, SETUP_STORE, STARTERS, starterSetup, snapshot, applySetup, storedSetups, storeSetups, saveSetup, refreshSetups, setupToFile, setupFromFile, openModal, closeModal, buildChips, refreshUI, mixRowsHTML, nudgeVolume, currentHint, layoutStage, initUI, lastT, fpsN, fpsT, hintShown, ledShown, chordShown, frame, demo, demoHandPoints, demoHands, sleep, tween, both, canvasPosOf, demoStretch, demoChoose, demoPress, demoPluck, runDemo, boot, audio, midiHz, buildGraph, initAudio, setFx, instBus, ksBuffer, env, VC, noiseSrc, oscAt, playNote, releaseVoice, bendVoice, SUSTAINS, buildVoice, playDrum, playEvent, BEATS, BEAT_ORDER, PARTS, PROGS, transport, stepDur, scaleDegree, scheduleStep, tick, startTransport, stopTransport, togglePlay, setBeat, stepAt, armLayer, captureEvent, makeLayer, layerOut, finishLayer, removeLayer, undoLayer, chordDegNow, chordLabel, rec, TAP_SRC, pushPcm, ensureTap, pickMime, startRecording, stopRecording, wavBlob, pcmFromVideo, mp3Blob, mp3Possible, finishRecording, saveMp3, download, renderOffline, wavBytes, CRC_TABLE, crc32, zipBlob, exportStems, TRACKER, cam, modalOpen, loadTracker, startCamera, videoFit, readHands, newHand, processHands, moveFx, endFx, updateHand, pinchDown, pinchUp, dropHand, toClient, buttonAt, setHover, handClick, updateHandHover, initPointer, gatherPointers } = ctx;
const GUITAR_BODY = [[8.6, 15.9, 5.6], [12.7, 10.9, 3.9]];
const ICONS = {
  guitar(k) { k.B(GUITAR_BODY); k.cut(() => k.D(10.3, 13.9, 1.5)); k.S('M15 8.6 L20.3 3.3 M18.7 1.8 L21.8 4.9', 2); },
  egtr(k) { ICONS.guitar(k); k.F('M6.6 1.2 L2.6 7.2 H5.4 L4.2 11.4 L8.8 5.2 H6 Z'); },
  harp(k) { k.S('M6.5 3 V21 M6.5 3 C12 2.5 13.5 8.5 19 7 M6.5 21 L19 7'); k.S('M10 3.9 V17.1 M12.75 5.5 V14 M15.4 6.9 V11', 1.2); },
  oud(k) { k.F('M12 21.8 C6.2 21.8 5 16.2 7.9 12.3 C9.7 9.9 10.8 8.6 10.8 6.2 H13.2 C13.2 8.6 14.3 9.9 16.1 12.3 C19 16.2 17.8 21.8 12 21.8 Z'); k.cut(() => k.D(12, 15.9, 2)); k.S('M12 6.4 V3.6 L15.9 1.9', 2); },
  qanun(k) { k.S('M3.2 6.5 H20.8 L13.8 18.5 H3.2 Z'); k.S('M3.2 9.5 H19 M3.2 12.5 H17.3 M3.2 15.5 H15.5', 1.2); },
  sitar(k) { k.D(12, 17.3, 4.7); k.cut(() => k.D(12, 17.3, 1.4)); k.S('M12 13 V2.2 M12 4.6 H15.6 M12 7.2 H8.4 M12 9.8 H15.6'); },

  piano(k) { k.S('M3.5 6 H20.5 V18.5 H3.5 Z M9.2 13 V18.5 M14.8 13 V18.5'); k.F('M7.6 6 H10.8 V13 H7.6 Z M13.2 6 H16.4 V13 H13.2 Z'); },
  epiano(k) { k.S('M2.8 7.5 H21.2 V13.5 H2.8 Z M8.2 13.5 L15.8 21 M15.8 13.5 L8.2 21'); k.S('M7 7.5 V10.4 M10.3 7.5 V10.4 M13.7 7.5 V10.4 M17 7.5 V10.4', 1.3); },
  organ(k) { k.S('M3 19 V12 L4.5 10.4 L6 12 V19 Z M7.2 19 V8 L8.7 6.4 L10.2 8 V19 Z M11.4 19 V4 L12.9 2.4 L14.4 4 V19 Z M15.6 19 V8 L17.1 6.4 L18.6 8 V19 Z M19.8 19 V12 L21.3 10.4 L22.8 12 V19 Z', 1.3); k.S('M3.6 16 H5.4 M7.8 16 H9.6 M12 16 H13.8 M16.2 16 H18 M20.4 16 H22.2', 1.2); k.S('M2 21.6 H23.6'); },
  marimba(k) { k.S('M4 9 V21.5 M8.2 10.2 V20.3 M12.4 11.4 V19.1 M16.6 12.6 V17.9', 2.6); k.S('M13.4 1.8 L9.2 5.4 M21.8 2.6 L17.4 6.6', 1.3); k.D(8.6, 5.9, 1.7); k.D(16.8, 7.1, 1.7); },
  kalimba(k) { k.S('M6.5 4 H17.5 A2.5 2.5 0 0 1 20 6.5 V17.5 A4 4 0 0 1 16 21.5 H8 A4 4 0 0 1 4 17.5 V6.5 A2.5 2.5 0 0 1 6.5 4 Z'); k.S('M8.4 4 V10.5 M12 4 V14 M15.6 4 V10.5 M10.2 4 V12.4 M13.8 4 V12.4', 1.25); k.D(12, 17.8, 1.2); },
  steelpan(k) { k.S('M3.5 8.5 A8.5 3.7 0 1 0 20.5 8.5 A8.5 3.7 0 1 0 3.5 8.5 M3.5 8.5 V11.5 C3.5 16.8 8 19.8 12 19.8 C16 19.8 20.5 16.8 20.5 11.5 V8.5'); k.D(8.6, 8.4, 1.1); k.D(12.6, 7.3, 1.1); k.D(15, 9.6, 1.1); },

  violin(k) { k.B([[10.4, 16.2, 5], [10.4, 10, 3.8]]); k.S('M10.4 6.6 V2.2 M8.8 2.2 H12', 1.9);
    k.cut(() => { k.S('M8.5 12.2 V15.4 M12.3 12.2 V15.4', 1.1); k.S('M2.6 22.6 L22 7.8', 3.6); }); k.S('M2.6 22.6 L22 7.8', 1.4); },
  cello(k) { k.B([[12, 15.3, 5.4], [12, 8.5, 4]]); k.S('M12 4.8 V1.4 M12 20.4 V23.2', 1.9); k.cut(() => k.S('M9.7 12 V15.6 M14.3 12 V15.6', 1.2)); },
  strings(k) { for (const x of [7, 17]) { k.B([[x, 16.4, 4.1], [x, 11.2, 3.1]]); k.S(`M${x} 8.4 V3.8`, 1.8); } k.cut(() => k.S('M5.6 13.6 V16 M8.4 13.6 V16 M15.6 13.6 V16 M18.4 13.6 V16', 0.9)); },
  flute(k) { k.S('M3.6 17.6 L18.8 5 L20.7 7.3 L5.5 19.9 Z'); k.D(9.2, 14.6, 0.95); k.D(12.2, 12.1, 0.95); k.D(15.2, 9.6, 0.95); },
  trumpet(k) { k.S('M2.8 11 H14.6 C17.4 11 18.8 9.2 21.2 7.4 V16.6 C18.8 14.8 17.4 13 14.6 13 H2.8 Z'); k.S('M7.6 11 V7.6 M10.3 11 V7.6 M13 11 V7.6 M6.8 13 V15.3 A1.6 1.6 0 0 0 8.4 16.9 H12.4 A1.6 1.6 0 0 0 14 15.3 V13', 1.4); },
  voices(k) { k.C(8.2, 8.4, 3.3); k.S('M2.6 20.4 C2.6 15.4 13.8 15.4 13.8 20.4'); k.S('M16.4 6 C18 7.6 18 10.4 16.4 12 M19 3.8 C21.8 6.6 21.8 11.4 19 14.2', 1.5); },

  bells(k) { k.S('M12 3.6 C8 3.6 6.8 7 6.8 10.5 C6.8 14 5.5 15.8 4.2 17.2 H19.8 C18.5 15.8 17.2 14 17.2 10.5 C17.2 7 16 3.6 12 3.6 Z M12 1.8 V3.6'); k.D(12, 19.8, 1.6); },
  synth(k) { k.S('M2.5 15.5 V8.5 H7.5 V15.5 H12.5 V8.5 H17.5 V15.5 H21.5'); },
  bass(k) { k.S('M6.4 8.6 C6.4 4.4 16.8 3.2 16.8 10 C16.8 15 11.6 18.6 5.8 20.8'); k.D(7.7, 9.5, 1.8); k.D(20.2, 7.2, 1.3); k.D(20.2, 12.4, 1.3); },
  sub(k) { k.C(12, 12, 8.6); k.C(12, 12, 4, 1.4); k.D(12, 12, 1.4); },
  drums(k) { k.S('M4.5 11 A7.5 2.8 0 1 0 19.5 11 A7.5 2.8 0 1 0 4.5 11 M4.5 11 V17 A7.5 2.8 0 0 0 19.5 17 V11'); k.S('M6.6 2.6 L11.4 10.2 M17.4 2.6 L12.6 10.2', 1.5); },
  handdrums(k) { k.S('M5.8 4 A6.2 1.8 0 1 0 18.2 4 A6.2 1.8 0 1 0 5.8 4 M5.8 4 C5.8 9.4 10 10.4 10 13.4 C10 16.8 8 18.6 7.4 21 H16.6 C16 18.6 14 16.8 14 13.4 C14 10.4 18.2 9.4 18.2 4'); },
};

const iconCache = new Map();
function iconImg(id, color, px) {
  const key = id + color + px;
  let cv = iconCache.get(key);
  if (cv) return cv;
  const R = 2, n = Math.ceil(px * R);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = n;
  const c = canvas.getContext('2d');
  c.scale(n / 24, n / 24); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = '#fff';
  const k = {
    S(d, w = 1.7) { c.lineWidth = w; c.stroke(new Path2D(d)); },
    F(d) { c.fill(new Path2D(d)); },
    C(x, y, r, w = 1.7) { c.lineWidth = w; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); },
    D(x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); },
    B(list) { for (const [x, y, r] of list) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } },   // solid body
    cut(fn) { c.globalCompositeOperation = 'destination-out'; fn(); c.globalCompositeOperation = 'source-over'; },
  };
  (ICONS[id] || ICONS.synth)(k);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color; c.fillRect(0, 0, n, n);
  iconCache.set(key, canvas);
  return canvas;
}
function drawIcon(id, color, x, y, px) {
  g.drawImage(iconImg(id, color, px), x - px / 2, y - px / 2, px, px);
}

// ───────────────────────── drawing ─────────────────────────
const HAND_BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const IVORY = '#fbf6e9';
const FONT = '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';
let g = null;

function label(text, x, y, size, color, align = 'center', weight = 600, outline = true) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  if (outline) { g.lineWidth = 3.5; g.strokeStyle = 'rgba(6,8,12,0.78)'; g.lineJoin = 'round'; g.strokeText(text, x, y); }
  g.fillStyle = color; g.fillText(text, x, y);
}

function drawBackdrop() {
  const v = cam.video;
  if (state.mode === 'camera' && v && v.readyState >= 2) {
    const f = videoFit();
    g.save();
    g.translate(W, 0); g.scale(-1, 1);
    g.drawImage(v, f.ox, f.oy, f.vw * f.sc, f.vh * f.sc);
    g.restore();
    g.fillStyle = `rgba(8,10,14,${state.settings.dim})`;
    g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0b0e13'); gr.addColorStop(1, '#161b22');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 1;
    g.beginPath();
    for (let y = 60; y < H; y += 60) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
  }
}

function drawString(s, t) {
  const col = INSTRUMENTS[s.inst].color;
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  let nx = -uy, ny = ux;
  if (ny > 0) { nx = -nx; ny = -ny; }                    // normal that points up the screen
  const age = t - s.vib.t0, amp = s.vib.amp * Math.exp(-age * 3.0);
  const live = amp > 0.35;
  const n = zoneCount(s);

  // a pulled string runs taut through the point it is held at
  const pl = s.pull, px = pl ? s.a.x + dx * pl.u + (dy / L) * pl.d : 0, py = pl ? s.a.y + dy * pl.u - (dx / L) * pl.d : 0;
  const trace = k => {                                   // k scales the displacement (ghost copies)
    g.beginPath();
    if (pl) { g.moveTo(s.a.x, s.a.y); g.lineTo(px, py); g.lineTo(s.b.x, s.b.y); return; }
    if (!live) { g.moveTo(s.a.x, s.a.y); g.lineTo(s.b.x, s.b.y); return; }
    const N = 44, p = s.vib.pos;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      let d = 0;
      for (let h = 1; h <= 4; h++) d += Math.sin(h * Math.PI * p) / (h * h) * Math.sin(h * Math.PI * u) * Math.cos(h * age * 36);
      d *= amp * 1.25 * k;
      const x = s.a.x + dx * u + nx * d, y = s.a.y + dy * u + ny * d;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
  };

  g.lineCap = 'round';
  g.save();
  g.globalCompositeOperation = 'lighter';
  const glow = live ? clamp(amp / 14, 0.25, 1) : 0;
  trace(1); g.strokeStyle = hexA(col, 0.10 + 0.16 * glow); g.lineWidth = 7 + 9 * glow; g.stroke();
  trace(1); g.strokeStyle = hexA(col, 0.22 + 0.3 * glow); g.lineWidth = 3.5 + 2.5 * glow; g.stroke();
  if (live) {
    g.strokeStyle = hexA(col, 0.22); g.lineWidth = 1.2;
    trace(-1); g.stroke(); trace(0.55); g.stroke(); trace(-0.55); g.stroke();
  }
  g.restore();
  trace(1); g.strokeStyle = IVORY; g.lineWidth = 1.8; g.stroke();

  if (pl) {
    g.fillStyle = col; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill();
    if (s.bend) label((s.bend > 0 ? '+' : '−') + (Math.abs(s.bend) / 100).toFixed(1) + ' st', px + nx * 24, py + ny * 24, 13, col, 'center', 700);
  }
  // the note just played lights up its stretch of string
  const fa = t - s.flash.t;
  if (s.flash.z >= 0 && fa < 0.35) {
    const u0 = s.flash.z / n, u1 = (s.flash.z + 1) / n;
    g.strokeStyle = hexA(col, 0.8 * (1 - fa / 0.35)); g.lineWidth = 5;
    g.beginPath(); g.moveTo(s.a.x + dx * u0, s.a.y + dy * u0); g.lineTo(s.a.x + dx * u1, s.a.y + dy * u1); g.stroke();
  }

  // note ticks and end caps
  g.strokeStyle = 'rgba(251,246,233,0.6)'; g.lineWidth = 1.2;
  g.beginPath();
  for (let z = 1; z < n; z++) {
    const x = s.a.x + dx * z / n, y = s.a.y + dy * z / n;
    g.moveTo(x - nx * 5, y - ny * 5); g.lineTo(x + nx * 5, y + ny * 5);
  }
  g.stroke();
  g.strokeStyle = IVORY; g.lineWidth = 2.2;
  g.beginPath();
  for (const e of [s.a, s.b]) { g.moveTo(e.x - nx * 10, e.y - ny * 10); g.lineTo(e.x + nx * 10, e.y + ny * 10); }
  g.stroke();
  g.fillStyle = IVORY;
  g.beginPath(); g.arc(s.a.x, s.a.y, 3.6, 0, 7); g.fill();

  // the dot: a badge carrying the instrument's icon
  const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
  const fresh = clamp(1 - (t - s.born) / 0.6, 0, 1);
  const dr = 14 + fresh * 9 + (s.near ? 1.5 + Math.sin(t * 6) * 1.2 : 0);
  g.fillStyle = 'rgba(8,10,14,0.9)';
  g.beginPath(); g.arc(mx, my, dr, 0, 7); g.fill();
  g.strokeStyle = hexA(col, s.near ? 1 : 0.75); g.lineWidth = 1.8;
  g.beginPath(); g.arc(mx, my, dr, 0, 7); g.stroke();
  drawIcon(s.inst, col, mx, my, 19);

  if (state.settings.labels && (s.near || t - s.touched < 2.6) && !state.menu) {
    label(stringLabel(s), mx + nx * 31, my + ny * 31, 13, col);
    const names = [];
    for (let z = 0; z < n; z++) names.push(zoneInfo(s, z).label);
    const size = n > 11 ? 9.5 : 11;
    for (let z = 0; z < n; z++) {
      const u = (z + 0.5) / n;
      label(names[z], s.a.x + dx * u - nx * 15, s.a.y + dy * u - ny * 15, size, 'rgba(251,246,233,0.9)', 'center', 500);
    }
  }
}

function drawFx() {
  const F = state.fx;
  if (!F) return;
  const { from: o, to: p } = F, R = 240;
  g.save();
  g.strokeStyle = 'rgba(251,246,233,0.35)'; g.lineWidth = 1.2; g.setLineDash([4, 6]);
  g.beginPath(); g.moveTo(o.x, o.y - R); g.lineTo(o.x, o.y + R); g.moveTo(o.x - R, o.y); g.lineTo(o.x + R, o.y); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = '#ffc24a'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(p.x, p.y); g.stroke();
  g.beginPath(); g.arc(o.x, o.y, 6, 0, 7); g.stroke();
  g.restore();
  const on = v => (v > 0.02 ? '#ffc24a' : 'rgba(251,246,233,0.75)');
  label('THIN' + (F.thin > 0.02 ? ' ' + Math.round(F.thin * 100) + '%' : ''), o.x, clamp(o.y - R - 14, state.safeTop + 14, H), 12, on(F.thin), 'center', 700);
  label('DARK' + (F.dark > 0.02 ? ' ' + Math.round(F.dark * 100) + '%' : ''), o.x, clamp(o.y + R + 14, 0, state.safeBottom - 14), 12, on(F.dark), 'center', 700);
  label('ECHO' + (F.echo > 0.02 ? ' ' + Math.round(F.echo * 100) + '%' : ''), clamp(o.x + (p.x >= o.x ? R : -R), 46, W - 46), o.y - 14, 12, on(F.echo), 'center', 700);
}

function drawPreview() {
  const p = state.preview;
  if (!p) return;
  const len = dist(p.a, p.b), ok = len >= 90;
  g.save();
  g.setLineDash([7, 7]); g.lineWidth = 2;
  g.strokeStyle = ok ? IVORY : 'rgba(251,246,233,0.4)';
  g.beginPath(); g.moveTo(p.a.x, p.a.y); g.lineTo(p.b.x, p.b.y); g.stroke();
  g.restore();
  for (const e of [p.a, p.b]) { g.fillStyle = IVORY; g.beginPath(); g.arc(e.x, e.y, 5, 0, 7); g.fill(); }
}

function drawParticles(dt) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const P = state.particles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.age += dt;
    if (p.age >= p.life) { P.splice(i, 1); continue; }
    p.vy += 260 * dt; p.vx *= 0.985;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const k = 1 - p.age / p.life;
    g.strokeStyle = hexA(p.color, 0.9 * k); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); g.stroke();
  }
  g.restore();
}

function drawPops(t) {
  state.pops = state.pops.filter(p => t - p.t < 0.9);
  for (const p of state.pops) {
    const k = (t - p.t) / 0.9;
    g.globalAlpha = 1 - k * k;
    label(p.text, p.x, p.y - 34 * k, 17, p.color, 'center', 700);
  }
  g.globalAlpha = 1;
}

function rrect(x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}
// The instrument palette: every instrument as an icon tile; the header shows the one being pointed at.
function drawPalette(M, t) {
  const INK = '#10141a';
  const open = clamp((t - M.opened) / 0.18, 0, 1), e = 1 - Math.pow(1 - open, 3);
  g.save();
  g.globalAlpha = e;
  g.translate(M.cx, M.cy); g.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e); g.translate(-M.cx, -M.cy);
  rrect(M.x0, M.y0, M.pw, M.ph, 18);
  g.fillStyle = 'rgba(9,11,15,0.93)'; g.fill();
  g.strokeStyle = 'rgba(251,246,233,0.2)'; g.lineWidth = 1.2; g.stroke();

  const focus = M.items.find(it => it.hover) || M.items.find(it => it.on);
  const hx = M.x0 + 20, hy = M.y0 + 27;
  if (focus) {
    drawIcon(focus.id, focus.color, hx + 12, hy, 28);
    label(focus.label, hx + 34, hy + 1, 17, focus.color, 'left', 700, false);
  }
  label('CHOOSE AN INSTRUMENT', M.x0 + M.pw - 52, hy + 1, 11, 'rgba(243,239,230,0.6)', 'right', 600, false);
  const left = clamp(1 - (t - M.active) / menuIdle(M), 0, 1);       // time left before it closes by itself
  g.strokeStyle = 'rgba(251,246,233,0.18)'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(M.x0 + M.pw - 28, hy, 9, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(251,246,233,0.75)';
  g.beginPath(); g.arc(M.x0 + M.pw - 28, hy, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); g.stroke();

  for (const it of M.items) {
    const x = it.x - it.w / 2, y = it.y - it.h / 2;
    rrect(x, y, it.w, it.h, 11);
    g.fillStyle = it.hover ? it.color : it.on ? hexA(it.color, 0.16) : 'rgba(255,255,255,0.045)';
    g.fill();
    g.strokeStyle = it.on && !it.hover ? it.color : 'rgba(251,246,233,0.1)'; g.lineWidth = it.on ? 2 : 1;
    g.stroke();
    drawIcon(it.id, it.hover ? INK : it.color, it.x, it.y - 9, 36);
    label(it.label, it.x, it.y + 26, 11.5, it.hover ? INK : 'rgba(243,239,230,0.92)', 'center', it.hover || it.on ? 700 : 500, false);
    if (it.dwell > 0) {                                              // hold-to-choose progress
      g.save(); rrect(x, y, it.w, it.h, 11); g.clip();
      g.fillStyle = INK; g.fillRect(x, y + it.h - 6, it.w * clamp(it.dwell / 0.8, 0, 1), 6);
      g.restore();
    }
  }
  g.restore();
}

function drawMenu(t) {
  const M = state.menu;
  if (!M) return;
  if (M.grid) { drawPalette(M, t); return; }
  const open = clamp((t - M.opened) / 0.22, 0, 1), e = 1 - Math.pow(1 - open, 3);
  const col = INSTRUMENTS[M.s.inst].color;
  const bg = g.createRadialGradient(M.cx, M.cy, 10, M.cx, M.cy, M.R + 80);
  bg.addColorStop(0, 'rgba(6,8,12,0.86)'); bg.addColorStop(0.7, 'rgba(6,8,12,0.7)'); bg.addColorStop(1, 'rgba(6,8,12,0)');
  g.fillStyle = bg;
  g.beginPath(); g.arc(M.cx, M.cy, M.R + 80, 0, 7); g.fill();

  // time left before it closes by itself
  const left = clamp(1 - (t - M.active) / menuIdle(M), 0, 1);
  g.strokeStyle = 'rgba(251,246,233,0.25)'; g.lineWidth = 2;
  g.beginPath(); g.arc(M.cx, M.cy, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); g.stroke();
  g.fillStyle = col;
  g.beginPath(); g.arc(M.cx, M.cy - 14, 5, 0, 7); g.fill();
  label(M.title, M.cx, M.cy + 6, 15, IVORY, 'center', 700);

  for (const it of M.items) {
    const x = lerp(M.cx, it.x, e), y = lerp(M.cy, it.y, e);
    const r = (it.hover ? 23 : 18) * e;
    g.strokeStyle = 'rgba(251,246,233,0.12)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(M.cx + Math.cos(it.a) * 44, M.cy + Math.sin(it.a) * 44); g.lineTo(x - Math.cos(it.a) * r, y - Math.sin(it.a) * r); g.stroke();
    g.fillStyle = it.hover ? it.color : 'rgba(10,13,18,0.92)';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = it.color; g.lineWidth = it.on ? 3 : 1.8;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    if (it.on && !it.hover && M.kind !== 'key') { g.fillStyle = it.color; g.beginPath(); g.arc(x, y, 6 * e, 0, 7); g.fill(); }   // current choice
    if (it.dwell > 0) {
      g.strokeStyle = IVORY; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(it.dwell / 0.8, 0, 1)); g.stroke();
    }
    if (it.icon) drawIcon(it.icon, it.hover ? '#10141a' : it.color, x, y, r * 1.25);
    // name sits outside the ring; short names (keys) sit inside the dot
    if (M.kind === 'key') {
      label(it.label, x, y + 1, 13, it.hover ? '#10141a' : it.on ? '#ffc24a' : IVORY, 'center', 700, !it.hover);
    } else {
      const lx = x + Math.cos(it.a) * (r + 12), ly = y + Math.sin(it.a) * (r + 14);
      const c = Math.cos(it.a);
      label(it.label, lx, ly, 13.5, it.hover ? '#ffffff' : IVORY, c > 0.3 ? 'left' : c < -0.3 ? 'right' : 'center', it.on ? 700 : 600);
    }
  }
}

function drawHands(t) {
  for (const h of state.hands) {
    if (!h || !h.present || !h.lm) continue;
    const lm = h.lm;
    if (state.settings.skeleton) {
      g.strokeStyle = 'rgba(251,246,233,0.34)'; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath();
      for (const [a, b] of HAND_BONES) { g.moveTo(lm[a].x, lm[a].y); g.lineTo(lm[b].x, lm[b].y); }
      g.stroke();
      g.fillStyle = 'rgba(251,246,233,0.75)';
      for (let k = 0; k < 21; k++) { g.beginPath(); g.arc(lm[k].x, lm[k].y, 2.1, 0, 7); g.fill(); }
    }
    // playing fingertip
    const tips = state.settings.allFingers ? [8, 12, 16, 20] : [8];
    g.strokeStyle = IVORY; g.lineWidth = 2;
    for (const k of tips) { g.beginPath(); g.arc(lm[k].x, lm[k].y, 8, 0, 7); g.stroke(); }
    // pinch pointer: closes and fills as thumb and finger meet
    const sens = state.settings.pinchSens;
    const k = clamp(1 - (h.ratio - 0.3 * sens) / (0.7 * sens), 0, 1);
    const r = lerp(17, 7, k);
    g.strokeStyle = h.pinch ? '#ffc24a' : 'rgba(255,194,74,0.75)'; g.lineWidth = h.pinch ? 3 : 1.6;
    g.beginPath(); g.arc(h.cursor.x, h.cursor.y, r, 0, 7); g.stroke();
    if (h.pinch) { g.fillStyle = '#ffc24a'; g.beginPath(); g.arc(h.cursor.x, h.cursor.y, 5, 0, 7); g.fill(); }
  }
  // ripples where a pinch pressed a button
  state.ripples = state.ripples.filter(r => t - r.t < 0.45);
  for (const r of state.ripples) {
    const k = (t - r.t) / 0.45;
    g.strokeStyle = `rgba(255,194,74,${1 - k})`; g.lineWidth = 2.5;
    g.beginPath(); g.arc(r.x, r.y, 10 + 34 * k, 0, 7); g.stroke();
  }
}

function drawDebug() {
  if (!state.settings.debug) return;
  const lines = [`draw ${state.fps} fps · tracker ${cam.trackFps} fps ${cam.delegate}`];
  state.hands.forEach((h, i) => {
    if (h && h.present) lines.push(`hand ${i + 1}: fingers ${h.ratio.toFixed(2)} · closes below ${(0.3 * state.settings.pinchSens).toFixed(2)} · ${h.pinch ? 'PINCHED' : 'open'} ${h.intent || ''}`);
  });
  lines.forEach((s, i) => label(s, 16, state.safeTop + 18 + i * 18, 12, '#8ff0c0', 'left', 500));
}

function render(t, dt) {
  drawBackdrop();
  const pts = gatherPointers();
  for (const s of state.strings) {
    s.near = pts.some(p => distToString(p, s) < 90);
    drawString(s, t);
  }
  drawPreview();
  drawFx();
  drawParticles(dt);
  drawPops(t);
  drawMenu(t);
  drawHands(t);
  drawDebug();
}

// ───────────────────────── recording the performance ─────────────────────────
function setCanvasContext(value) { g = value; }
return { GUITAR_BODY, ICONS, iconCache, iconImg, drawIcon, HAND_BONES, IVORY, FONT, g, label, drawBackdrop, drawString, drawFx, drawPreview, drawParticles, drawPops, rrect, drawPalette, drawMenu, drawHands, drawDebug, render, setCanvasContext };
}

export function installVisualExperience(r){const wrap=document.querySelector('#stageWrap'),a=r.audio;if(!wrap||!a)return;const c=document.createElement('canvas');c.id='v2Visualizer';c.setAttribute('aria-hidden','true');wrap.appendChild(c);const x=c.getContext('2d',{alpha:true});let an=null,f=null,wv=null,mode='matrix',last=0,phase=0;const resize=()=>{const b=wrap.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);c.width=Math.max(1,b.width*d);c.height=Math.max(1,b.height*d);x.setTransform(d,0,0,d,0,0)},attach=()=>{if(an||!a.ctx||!a.out)return;try{an=a.ctx.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.82;a.out.connect(an);f=new Uint8Array(an.frequencyBinCount);wv=new Uint8Array(an.fftSize)}catch(_){}},draw=t=>{requestAnimationFrame(draw);if(t-last<32)return;last=t;const W=c.clientWidth,H=c.clientHeight;if(!W||!H||mode==='off'){x.clearRect(0,0,W,H);return}attach();if(!an)return;an.getByteFrequencyData(f);an.getByteTimeDomainData(wv);let energy=0;for(let i=0;i<f.length;i++)energy+=f[i];energy/=f.length*255;phase+=.006+energy*.05;x.clearRect(0,0,W,H);x.save();x.globalCompositeOperation='lighter';if(mode==='matrix'||mode==='spectrum'){const n=mode==='matrix'?Math.max(8,Math.floor(W/24)):64,step=W/n;for(let i=0;i<n;i++){const val=f[Math.floor(i/n*f.length)]/255,h=val*H*(mode==='matrix'?.72:.7);x.fillStyle=mode==='matrix'?(i%3?'rgba(0,255,156,.38)':'rgba(160,0,255,.48)'):'rgba(0,217,255,.58)';x.fillRect(i*step,H-h,step*.68,h)}}else if(mode==='oscilloscope'){x.beginPath();for(let i=0;i<wv.length;i++){const px=i/(wv.length-1)*W,py=H/2+(wv[i]-128)/128*H*.32;if(!i)x.moveTo(px,py);else x.lineTo(px,py)}x.strokeStyle='#00D9FF';x.lineWidth=2;x.stroke()}else if(mode==='fractal'){for(let arm=0;arm<8;arm++){x.beginPath();for(let i=0;i<150;i++){const q=i/149*Math.PI*5+phase*(arm%2?1:-1),rad=i/149*Math.min(W,H)*.36*(.55+energy*1.6),px=W/2+Math.cos(q+arm*Math.PI/4)*rad,py=H/2+Math.sin(q+arm*Math.PI/4)*rad;if(!i)x.moveTo(px,py);else x.lineTo(px,py)}x.strokeStyle=arm%2?'rgba(160,0,255,.5)':'rgba(0,217,255,.48)';x.stroke()}}x.restore()};document.querySelectorAll('[data-visual]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.visual;document.querySelectorAll('[data-visual]').forEach(z=>z.classList.toggle('active',z===b));c.style.opacity=mode==='off'?'0':'.48'}));addEventListener('resize',resize);resize();requestAnimationFrame(draw)}