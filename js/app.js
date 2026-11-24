
import { createAudioModule, installAudioExperience } from './audio.js';
import { createVisionModule, installVisionLifecycle } from './vision.js';
import { createVisualModule, installVisualExperience } from './visuals.js';
(() => {
'use strict';
// ───────────────────────── core: constants, state, helpers ─────────────────────────
let W = 1280, H = 720;          // the stage: 1280 × 720 landscape, or 720 × 1280 vertical
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const nowS = () => performance.now() / 1000;

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
// spell notes with sharps or flats to suit the key (A major has G♯, not A♭)
function spell(pc, root, parent) {
  const rel = (root + { major: 0, minor: 3, dorian: 10, hijaz: 8 }[parent]) % 12;
  return ([5, 10, 3, 8, 1, 6].includes(rel) ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
}

const SCALES = {
  major:    { name: 'Major',            short: 'major',     steps: [0, 2, 4, 5, 7, 9, 11], parent: 'major' },
  minor:    { name: 'Minor',            short: 'minor',     steps: [0, 2, 3, 5, 7, 8, 10], parent: 'minor' },
  pentamaj: { name: 'Major pentatonic', short: 'maj penta', steps: [0, 2, 4, 7, 9],        parent: 'major' },
  pentamin: { name: 'Minor pentatonic', short: 'min penta', steps: [0, 3, 5, 7, 10],       parent: 'minor' },
  blues:    { name: 'Blues',            short: 'blues',     steps: [0, 3, 5, 6, 7, 10],    parent: 'minor' },
  dorian:   { name: 'Dorian',           short: 'dorian',    steps: [0, 2, 3, 5, 7, 9, 10], parent: 'dorian' },
  hijaz:    { name: 'Hijaz',            short: 'hijaz',     steps: [0, 1, 4, 5, 7, 8, 10], parent: 'hijaz' },
};
const SCALE_ORDER = ['major', 'minor', 'pentamaj', 'pentamin', 'blues', 'dorian', 'hijaz'];

const DRUM_ZONES = [
  { id: 'kick', label: 'Kick' }, { id: 'snare', label: 'Snare' }, { id: 'hat', label: 'Hat' },
  { id: 'clap', label: 'Clap' }, { id: 'tomL', label: 'Low tom' }, { id: 'tomH', label: 'High tom' },
  { id: 'ohat', label: 'Open hat' }, { id: 'rim', label: 'Rim' },
];
const HAND_ZONES = [
  { id: 'dum', label: 'Dum' }, { id: 'tak', label: 'Tak' }, { id: 'ka', label: 'Ka' },
  { id: 'slap', label: 'Slap' }, { id: 'riq', label: 'Riq' }, { id: 'clap', label: 'Clap' },
  { id: 'cowbell', label: 'Cowbell' }, { id: 'shaker', label: 'Shaker' },
];

// Every instrument is played the same way: by plucking a string.
// The order is the palette order: six to a row, one family per row.
const INSTRUMENTS = {
  guitar:    { name: 'Guitar',          color: '#ffd166', oct: 3 },
  egtr:      { name: 'Electric guitar', color: '#ff5d73', oct: 3 },
  harp:      { name: 'Harp',            color: '#8ff0c0', oct: 4 },
  oud:       { name: 'Oud',             color: '#ff9e6b', oct: 3 },
  qanun:     { name: 'Qanun',           color: '#c9e265', oct: 4 },
  sitar:     { name: 'Sitar',           color: '#e6a0ff', oct: 3 },

  piano:     { name: 'Piano',           color: '#dfeaff', oct: 3 },
  epiano:    { name: 'Electric piano',  color: '#9fb8ff', oct: 3 },
  organ:     { name: 'Organ',           color: '#d9a877', oct: 3 },
  marimba:   { name: 'Marimba',         color: '#f2b880', oct: 4 },
  kalimba:   { name: 'Kalimba',         color: '#7fe0d0', oct: 4 },
  steelpan:  { name: 'Steel pan',       color: '#5fd4f4', oct: 4 },

  violin:    { name: 'Violin',          color: '#ffa8c5', oct: 4 },
  cello:     { name: 'Cello',           color: '#d98cb3', oct: 2 },
  strings:   { name: 'Strings',         color: '#ff8fd0', oct: 3 },
  flute:     { name: 'Flute',           color: '#9eeaff', oct: 4 },
  trumpet:   { name: 'Trumpet',         color: '#f5b83d', oct: 4 },
  voices:    { name: 'Voices',          color: '#d4c5ff', oct: 3 },

  bells:     { name: 'Bells',           color: '#fff59a', oct: 5 },
  synth:     { name: 'Synth',           color: '#6dff9c', oct: 4 },
  bass:      { name: 'Bass',            color: '#7aa8ff', oct: 1 },
  sub:       { name: '808 bass',        color: '#5b8cff', oct: 1 },
  drums:     { name: 'Drums',           color: '#ff6b6b', oct: 0, kit: DRUM_ZONES },
  handdrums: { name: 'Hand drums',      color: '#ff8552', oct: 0, kit: HAND_ZONES },
};
const INSTRUMENT_ORDER = Object.keys(INSTRUMENTS);
// membership tests that cannot be fooled by names like "__proto__" arriving from a file
const own = (table, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);

const MAX_STRINGS = 12;
const MAX_LAYERS = 8;

const state = {
  key: 9,                  // A
  scale: 'pentamin',
  strings: [],
  nextStringId: 1,
  menu: null,              // the open dot menu, if any
  preview: null,           // dashed line while both hands pinch
  fx: null,                // the air pad while one hand pinches and drags in open air
  shape: 'landscape',
  particles: [],
  pops: [],                // floating note names
  ripples: [],
  mode: 'idle',            // idle | camera | mouse | demo
  hands: [null, null],
  mouse: { x: -1, y: -1, px: -1, py: -1, down: false, inside: false, drag: null },
  safeTop: 70, safeBottom: 560,
  fps: 0,
  counts: { plucks: 0, created: 0, clicks: 0 },
  mix: { live: 0.85, beat: 0.8 },
  settings: {
    pinchSens: 1,
    allFingers: false,
    skeleton: true,
    labels: true,
    dim: 0.28,
    quantize: true,
    volume: 0.9,
    debug: false,
  },
};

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function toast(msg, ms = 2600) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

let audio, midiHz, buildGraph, initAudio, setFx, instBus, ksBuffer, env, VC, noiseSrc, oscAt, playNote, releaseVoice, bendVoice, SUSTAINS, buildVoice, playDrum, playEvent, BEATS, BEAT_ORDER, PARTS, PROGS, transport, stepDur, scaleDegree, scheduleStep, tick, startTransport, stopTransport, togglePlay, setBeat, stepAt, armLayer, captureEvent, makeLayer, layerOut, finishLayer, removeLayer, undoLayer, chordDegNow, chordLabel, rec, TAP_SRC, pushPcm, ensureTap, pickMime, startRecording, stopRecording, wavBlob, pcmFromVideo, mp3Blob, mp3Possible, finishRecording, saveMp3, download, renderOffline, wavBytes, CRC_TABLE, crc32, zipBlob, exportStems;

const strRoot = s => (s.root == null ? state.key : s.root);
const strScale = s => s.scale || state.scale;
const strLen = s => dist(s.a, s.b);
const strMid = s => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 });

function orient(s) { // a = low end: the left end, or the bottom end of a steep string
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const swap = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy > 0;
  if (swap) { const t = s.a; s.a = s.b; s.b = t; }
}
function zoneCount(s) {
  const len = strLen(s);
  const kit = INSTRUMENTS[s.inst].kit;
  return kit ? clamp(Math.round(len / 95), 2, kit.length) : clamp(Math.round(len / 72), 3, 15);
}
function zoneInfo(s, z) {
  const kit = INSTRUMENTS[s.inst].kit;
  if (kit) { const d = kit[z % kit.length]; return { drum: d.id, label: d.label }; }
  const sc = SCALES[strScale(s)], root = strRoot(s);
  const oct = INSTRUMENTS[s.inst].oct + s.oct;
  const fit = m => { while (m > 98) m -= 12; while (m < 24) m += 12; return m; };
  const cd = chordDegNow();
  if (cd != null) {                     // following the beat: the string offers the current chord's notes
    const parent = SCALES[state.scale].parent, low = cd >= 4 ? cd - 7 : cd;
    const T = n => low + [0, 2, 4][n % 3] + 7 * Math.floor(n / 3);
    if (s.mode === 'chord') return { notes: [0, 1, 2].map(k => fit(scaleDegree(parent, state.key, oct, T(z + k)))), label: chordLabel(cd) };
    const m = fit(scaleDegree(parent, state.key, oct, T(z)));
    return { notes: [m], label: spell(m, state.key, parent) };
  }
  if (s.mode === 'chord') {
    const notes = [0, 2, 4].map(k => fit(scaleDegree(sc.parent, root, oct, z + k)));
    const third = notes[1] - notes[0], fifth = notes[2] - notes[0];
    const q = fifth === 6 ? '°' : third === 3 ? 'm' : fifth === 8 ? '+' : '';
    return { notes, label: spell(notes[0], root, sc.parent) + q };
  }
  const steps = sc.steps;
  const m = fit(12 * (oct + 1) + root + 12 * Math.floor(z / steps.length) + steps[z % steps.length]);
  return { notes: [m], label: spell(m, root, sc.parent) };
}
function stringLabel(s) {
  const I = INSTRUMENTS[s.inst].name;
  if (INSTRUMENTS[s.inst].kit) return I;
  return `${I} · ${NOTE_NAMES[strRoot(s)]} ${SCALES[strScale(s)].short}${s.mode === 'chord' ? ' · chords' : ''}`;
}

function addString(p, q, opts = {}) {
  if (state.strings.length >= MAX_STRINGS) { toast(`${MAX_STRINGS} strings is the limit. Remove one to add another.`); return null; }
  const s = {
    id: state.nextStringId++, a: { x: p.x, y: p.y }, b: { x: q.x, y: q.y },
    inst: opts.inst || 'guitar', scale: opts.scale || null, root: opts.root == null ? null : opts.root,
    oct: opts.oct || 0, mode: opts.mode || 'notes',
    vib: { amp: 0, t0: 0, pos: 0.5 }, flash: { z: -1, t: 0 }, last: {}, track: {}, dwell: {}, holds: {}, voices: [], pull: null, bend: 0, born: nowS(), touched: nowS(),
  };
  orient(s);
  state.strings.push(s);
  state.counts.created++;
  burst(strMid(s), '#ffffff', 14, 120);
  if (!opts.silent) openMenu(s, 'instrument', true);
  refreshUI();
  return s;
}
function removeString(s) {
  for (const pid in s.holds) endHold(s, pid);
  state.strings = state.strings.filter(x => x !== s);
  if (state.menu && state.menu.s === s) state.menu = null;
  burst(strMid(s), INSTRUMENTS[s.inst].color, 26, 200);
  refreshUI();
}
function clearStrings() {
  if (state.cleared) {                        // second press within a few seconds puts them back
    state.strings = state.cleared.filter(s => !state.strings.includes(s)).concat(state.strings).slice(0, MAX_STRINGS);
    state.cleared = null; clearTimeout(clearStrings.t);
    refreshUI();
    return;
  }
  if (!state.strings.length) return;
  const kept = state.strings.slice();
  kept.forEach(removeString);
  state.menu = null;
  state.cleared = kept;
  clearTimeout(clearStrings.t);
  clearStrings.t = setTimeout(() => { state.cleared = null; refreshUI(); }, 8000);
  refreshUI();
}

// Sound a string at position u (0..1 along it).
function pluck(s, u, vel, down, quiet) {
  initAudio();
  const n = zoneCount(s), z = clamp(Math.floor(u * n), 0, n - 1);
  const info = zoneInfo(s, z);
  const ev = info.drum ? { inst: s.inst, drum: info.drum, vel } : { inst: s.inst, notes: info.notes, vel, down: !!down };
  const vs = playEvent(ev, audio.ctx.currentTime, audio.music);
  keepVoices(s, vs);
  captureEvent(ev);
  const t = nowS();
  s.vib = { amp: 6 + 16 * vel, t0: t, pos: clamp(u, 0.08, 0.92) };
  s.flash = { z, t };
  s.touched = t;
  state.counts.plucks++;
  const p = { x: lerp(s.a.x, s.b.x, u), y: lerp(s.a.y, s.b.y, u) };
  burst(p, INSTRUMENTS[s.inst].color, quiet ? 3 : Math.round(6 + 14 * vel), 90 + 260 * vel);
  if (!quiet) notePop(s, p, info.label, t);
  return vs;
}
function notePop(s, p, text, t) {
  state.pops.push({ x: p.x, y: p.y - 16, text, t, color: INSTRUMENTS[s.inst].color });
  if (state.pops.length > 24) state.pops.shift();
}
// the notes still ringing on a string, so a pull can bend them
function keepVoices(s, vs) {
  for (const v of vs) { if (s.bend) bendVoice(v, s.bend, 0.001); s.voices.push(v); }
  if (s.voices.length > 10) s.voices.splice(0, s.voices.length - 10);
}
function bendString(s, cents) {
  s.bend = cents;
  const now = audio.ctx ? audio.ctx.currentTime : 0;
  s.voices = s.voices.filter(v => now - v.t < 6);
  for (const v of s.voices) bendVoice(v, cents);
  for (const pid in s.holds) for (const v of s.holds[pid].voices) bendVoice(v, cents);
}

// ── holding a finger on a string ──
// Sustaining instruments (violin, voices, organ…) sing for as long as you stay; drums and mallets roll;
// everything else sounds when touched. Sliding along the string moves through its notes.
const ROLLS = { marimba: 1, steelpan: 1, oud: 1, qanun: 1, drums: 1, handdrums: 1 };
const HOLD_IN = 10, HOLD_OUT = 22, HOLD_AFTER = 0.14;
function holdNote(s, h, t) {
  initAudio();
  const n = zoneCount(s), z = clamp(Math.floor(h.u * n), 0, n - 1);
  const info = zoneInfo(s, z);
  const key = z + ':' + (info.notes ? info.notes.join(',') : info.drum);
  if (key === h.key) return;                          // same note as before (also catches chord changes)
  h.key = key; h.z = z;
  const p = { x: lerp(s.a.x, s.b.x, h.u), y: lerp(s.a.y, s.b.y, h.u) };
  if (SUSTAINS[s.inst]) {
    for (const v of h.voices) releaseVoice(v);
    const ev = { inst: s.inst, notes: info.notes, vel: 0.62 };
    h.voices = playEvent(ev, audio.ctx.currentTime, audio.music, { held: true });
    for (const v of h.voices) if (s.bend) bendVoice(v, s.bend, 0.001);
    h.cap = captureEvent(Object.assign({ hold: 0.2 }, ev)); h.capT = t;
    s.flash = { z, t }; s.touched = t; state.counts.plucks++;
    burst(p, INSTRUMENTS[s.inst].color, 8, 140);
    notePop(s, p, info.label, t);
  } else {
    pluck(s, h.u, 0.6, false);
    h.next = t + rollGap(s);
  }
}
const rollGap = s => (INSTRUMENTS[s.inst].kit && transport.playing ? stepDur() : 0.095);
function startHold(s, pid, u, t) {
  const h = s.holds[pid] = { u, t0: t, seen: t, voices: [], key: null, next: 0 };
  state.counts.holds = (state.counts.holds || 0) + 1;
  holdNote(s, h, t);
}
function endHold(s, pid) {
  const h = s.holds[pid];
  if (!h) return;
  for (const v of h.voices) releaseVoice(v);
  delete s.holds[pid];
}
// called every frame: keeps held notes alive, rolls the rolling ones, drops holds whose finger vanished
function updateHolds(t) {
  for (const s of state.strings) for (const pid in s.holds) {
    const h = s.holds[pid];
    if (t - h.seen > 0.3 || state.menu) { endHold(s, pid); continue; }
    if (h.voices.length) {
      if (h.cap) h.cap.hold = Math.max(0.15, t - h.capT);
      holdNote(s, h, t);                              // retune if the chord under it changed
      s.vib = { amp: 5, t0: t - 0.02, pos: clamp(h.u, 0.08, 0.92) };
    } else if (ROLLS[s.inst] && t >= h.next) {
      pluck(s, h.u, 0.42 + 0.12 * Math.random(), false, true);
      h.next = Math.max(h.next + rollGap(s), t + 0.03);
    }
  }
}

// A pointer (fingertip or mouse) is at P. Each string remembers which side the pointer was last
// clearly on; when it turns up clearly on the other side, having crossed between the ends, it plucks.
// The 3 px band either side of the string absorbs tracking jitter, and slow crossings still count.
// A pointer that settles on the string instead of crossing it starts a hold.
function sweep(pid, P, t) {
  if (state.menu || state.preview) return;
  for (const s of state.strings) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy;
    if (L2 < 1) continue;
    const L = Math.sqrt(L2);
    const d = ((P.x - s.a.x) * dy - (P.y - s.a.y) * dx) / L;             // signed distance to the line
    const up = ((P.x - s.a.x) * dx + (P.y - s.a.y) * dy) / L2;           // where along it
    const side = d > 0 ? 1 : -1;
    const h = s.holds[pid];
    if (h) {
      h.seen = t;
      if (Math.abs(d) > HOLD_OUT || up < -0.04 || up > 1.04) { endHold(s, pid); s.track[pid] = { side, d, x: P.x, y: P.y, t }; }
      else { h.u = clamp(up, 0, 0.999); holdNote(s, h, t); }
      continue;
    }
    // (not right at the ends or on the badge, where a pinch is usually on its way)
    if (Math.abs(d) < HOLD_IN && up > 0.05 && up < 0.95 && Math.abs(up - 0.5) * L > 26 && t - s.born > 0.5 && !s.pull) {
      const dw = s.dwell[pid];
      if (!dw || t - dw.last > 0.2) s.dwell[pid] = { t0: t, last: t };
      else { dw.last = t; if (t - dw.t0 >= HOLD_AFTER) { delete s.dwell[pid]; startHold(s, pid, clamp(up, 0, 0.999), t); continue; } }
    } else delete s.dwell[pid];
    if (Math.abs(d) < 3) continue;
    const tr = s.track[pid];
    const next = { side, d, x: P.x, y: P.y, t };
    if (!tr || t - tr.t > 0.45 || Math.hypot(P.x - tr.x, P.y - tr.y) > W * 0.3) { s.track[pid] = next; continue; }
    s.track[pid] = next;
    if (tr.side === side || t - s.born < 0.4) continue;
    const k = tr.d / (tr.d - d);
    const X = { x: lerp(tr.x, P.x, k), y: lerp(tr.y, P.y, k) };
    const u = ((X.x - s.a.x) * dx + (X.y - s.a.y) * dy) / L2;
    if (u < 0 || u > 1) continue;
    if (t - (s.last[pid] || 0) < 0.11) continue;
    s.last[pid] = t;
    const speed = Math.hypot(P.x - tr.x, P.y - tr.y) / Math.max(t - tr.t, 0.008);
    pluck(s, u, clamp(0.3 + speed / 2600, 0.3, 1), tr.side > 0);
  }
}
function forgetPointer(prefix) {
  for (const s of state.strings) {
    for (const k in s.track) if (k.startsWith(prefix)) delete s.track[k];
    for (const k in s.dwell) if (k.startsWith(prefix)) delete s.dwell[k];
    for (const k in s.holds) if (k.startsWith(prefix)) endHold(s, k);
  }
}

// ── pulling a string: pinch it, drag sideways to bend the pitch, let go to snap it ──
function nearestBody(p, r) {          // a point on a string, away from its ends and its badge
  let best = null, bd = r;
  for (const s of state.strings) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy || 1;
    const u = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / L2;
    if (u < 0.06 || u > 0.94) continue;
    const d = Math.hypot(p.x - (s.a.x + dx * u), p.y - (s.a.y + dy * u));
    if (d < bd) { bd = d; best = { s, u }; }
  }
  return best;
}
const PULL_MAX = 90, BEND_CENTS = 200;
function pullString(g, p) {            // g: { s, u } from nearestBody
  const s = g.s, dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy) || 1;
  const d = clamp(((p.x - s.a.x) * dy - (p.y - s.a.y) * dx) / L, -PULL_MAX, PULL_MAX);
  s.pull = { u: g.u, d };
  // towards the top of the screen raises the pitch
  let ny = dx / L; const up = ny > 0 ? -1 : 1;
  bendString(s, Math.abs(d) < 8 ? 0 : up * d / PULL_MAX * BEND_CENTS);
  s.touched = nowS();
  return d;
}
function releasePull(g) {
  const s = g.s, pl = s.pull;
  s.pull = null;
  if (!state.strings.includes(s)) return;
  const d = pl ? Math.abs(pl.d) : 0;
  if (d >= 14) {
    const from = s.bend;
    bendString(s, 0);
    const vs = pluck(s, g.u, clamp(0.35 + d / PULL_MAX * 0.65, 0.35, 1), false);
    for (const v of vs) { bendVoice(v, from * 0.5, 0.001); setTimeout(() => bendVoice(v, 0, 0.05), 20); }   // the twang as it snaps back
    s.vib.amp = 10 + d * 0.3;
    state.counts.snaps = (state.counts.snaps || 0) + 1;
  } else bendString(s, 0);
}

function burst(p, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.25 + Math.random() * 0.75);
    state.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.35 + Math.random() * 0.5, age: 0, color });
  }
  if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
}

function nearestEndpoint(p, r) {
  let best = null, bd = r;
  for (const s of state.strings) for (const end of ['a', 'b']) {
    const d = dist(p, s[end]);
    if (d < bd) { bd = d; best = { s, end }; }
  }
  return best;
}
function nearestDot(p, r) {
  let best = null, bd = r;
  for (const s of state.strings) { const d = dist(p, strMid(s)); if (d < bd) { bd = d; best = s; } }
  return best;
}
function distToString(p, s) {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy || 1;
  const u = clamp(((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / L2, 0, 1);
  return Math.hypot(p.x - (s.a.x + dx * u), p.y - (s.a.y + dy * u));
}

// ── the dot menu ──
// Opens on the dot at the middle of a string. Point at a choice and hold, or pinch it.
function menuItems(s, kind) {
  if (kind === 'instrument') return INSTRUMENT_ORDER.map(id => ({ id, label: INSTRUMENTS[id].name, color: INSTRUMENTS[id].color, on: s.inst === id }));
  if (kind === 'tone') return SCALE_ORDER.map(id => ({ id, label: SCALES[id].name, color: '#f3efe6', on: strScale(s) === id }));
  if (kind === 'key') return NOTE_NAMES.map((n, i) => ({ id: i, label: n, color: '#f3efe6', on: strRoot(s) === i }));
  const drums = !!INSTRUMENTS[s.inst].kit;
  return [
    { id: 'instrument', label: 'Instrument', color: INSTRUMENTS[s.inst].color, icon: s.inst },
    !drums && { id: 'tone', label: 'Tone', color: '#f3efe6' },
    !drums && { id: 'key', label: 'Key', color: '#f3efe6' },
    !drums && { id: 'mode', label: s.mode === 'chord' ? 'Single notes' : 'Chords', color: '#f3efe6' },
    !drums && { id: 'up', label: 'Higher', color: '#f3efe6' },
    !drums && { id: 'down', label: 'Lower', color: '#f3efe6' },
    { id: 'remove', label: 'Remove', color: '#ff6b6b' },
    { id: 'done', label: 'Done', color: '#8ff0c0' },
  ].filter(Boolean);
}
const MENU_TITLES = { instrument: 'Instrument', tone: 'Tone', key: 'Key', hub: 'String' };

function openMenu(s, kind, fresh) {
  const items = menuItems(s, kind);
  const m = strMid(s), t = nowS();
  const place = (halfW, halfH) => {          // centre on the string's dot, kept clear of the bars and edges
    const lo = state.safeTop + halfH + 8, hi = state.safeBottom - halfH - 8;
    return { cx: clamp(m.x, halfW + 8, W - halfW - 8), cy: hi > lo ? clamp(m.y, lo, hi) : (lo + hi) / 2 };
  };
  const base = { s, kind, fresh: !!fresh, title: MENU_TITLES[kind], opened: t, active: t };
  if (kind === 'instrument') {               // a palette: six icon tiles to a row
    const cols = 6, rows = Math.ceil(items.length / cols), tw = 96, th = 80, gap = 6, head = 52, pad = 14;
    const pw = cols * tw + (cols - 1) * gap + pad * 2, ph = head + rows * th + (rows - 1) * gap + pad;
    const { cx, cy } = place(pw / 2, ph / 2);
    const x0 = cx - pw / 2, y0 = cy - ph / 2;
    state.menu = Object.assign(base, { grid: true, cx, cy, x0, y0, pw, ph, R: Math.max(pw, ph) / 2,
      items: items.map((it, i) => Object.assign(it, { icon: it.id, w: tw, h: th, dwell: 0, hover: false,
        x: x0 + pad + (i % cols) * (tw + gap) + tw / 2, y: y0 + head + Math.floor(i / cols) * (th + gap) + th / 2 })) });
    return;
  }
  const R = items.length > 9 ? 150 : items.length > 7 ? 128 : 112;
  const { cx, cy } = place(R + 46, R + 38);
  state.menu = Object.assign(base, { cx, cy, R,
    items: items.map((it, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / items.length;
      return Object.assign(it, { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a, dwell: 0, hover: false });
    }) });
}
// is a point on the open menu (with some slack)?
function menuContains(p, slack) {
  const M = state.menu;
  if (M.grid) return p.x > M.x0 - slack && p.x < M.x0 + M.pw + slack && p.y > M.y0 - slack && p.y < M.y0 + M.ph + slack;
  return Math.hypot(p.x - M.cx, p.y - M.cy) < M.R + slack + 20;
}
function closeMenu() { state.menu = null; }
const menuIdle = M => (M.grid ? 9 : M.fresh ? 7 : 6);   // seconds without a pointer nearby before it closes

function chooseMenu(it) {
  const M = state.menu, s = M.s;
  s.touched = nowS();
  burst({ x: it.x, y: it.y }, it.color, 10, 120);
  const audition = () => { if (audio.ctx) pluckQuiet(s); };
  switch (M.kind) {
    case 'instrument':
      s.inst = it.id;
      audition();
      if (M.fresh && !INSTRUMENTS[it.id].kit) openMenu(s, 'tone', true); else closeMenu();
      break;
    case 'tone': s.scale = it.id; audition(); closeMenu(); break;
    case 'key': s.root = it.id; audition(); closeMenu(); break;
    default:
      if (it.id === 'instrument' || it.id === 'tone' || it.id === 'key') openMenu(s, it.id, false);
      else if (it.id === 'mode') { s.mode = s.mode === 'chord' ? 'notes' : 'chord'; audition(); closeMenu(); }
      else if (it.id === 'up') { s.oct = clamp(s.oct + 1, -2, 2); audition(); openMenu(s, 'hub'); }
      else if (it.id === 'down') { s.oct = clamp(s.oct - 1, -2, 2); audition(); openMenu(s, 'hub'); }
      else if (it.id === 'remove') removeString(s);
      else closeMenu();
  }
  refreshUI();
}
function pluckQuiet(s) { // a short preview so a choice can be heard
  const info = zoneInfo(s, 0);
  playEvent(info.drum ? { inst: s.inst, drum: info.drum, vel: 0.6 } : { inst: s.inst, notes: info.notes, vel: 0.55 }, audio.ctx.currentTime, audio.music);
  s.vib = { amp: 9, t0: nowS(), pos: 0.3 };
}

// pointers: [{x, y, press}] – press is true on the frame a pinch closes or the mouse clicks
function updateMenu(pointers, dt) {
  const M = state.menu;
  if (!M) return;
  const t = nowS();
  const HIT = 36, DWELL = 0.8;
  let chosen = null;
  for (const it of M.items) {
    let over = false, pressed = false;
    for (const p of pointers) {
      const hit = it.w ? Math.abs(p.x - it.x) < it.w / 2 - 2 && Math.abs(p.y - it.y) < it.h / 2 - 2 : Math.hypot(p.x - it.x, p.y - it.y) < HIT;
      if (hit) { over = true; if (p.press) pressed = true; }
    }
    if (over && !it.hover && M.kind === 'instrument' && audio.ctx && t - M.opened > 0.3 && t - (M.heard || 0) > 0.14) {
      M.heard = t;
      const base = scaleDegree(SCALES[strScale(M.s)].parent, strRoot(M.s), INSTRUMENTS[it.id].oct, 0);
      if (INSTRUMENTS[it.id].kit) playDrum(INSTRUMENTS[it.id].kit[1].id, audio.ctx.currentTime, 0.35, audio.music);
      else playNote(it.id, base, audio.ctx.currentTime, 0.35, audio.music);
    }
    // a finger that was already resting here when the ring opened must leave before it can hold-select
    if (!M.primed) it.blocked = over; else if (!over) it.blocked = false;
    it.hover = over;
    it.dwell = over && !it.blocked && t - M.opened > 0.35 ? it.dwell + dt : 0;
    if (pressed || it.dwell >= DWELL) chosen = chosen || it;
  }
  M.primed = true;
  if (pointers.some(p => menuContains(p, 70))) M.active = t;
  if (chosen) { chooseMenu(chosen); return; }
  if (t - M.active > menuIdle(M)) closeMenu();
}

// ───────────────────────── camera, hand tracking, gestures, mouse ─────────────────────────
let TRACKER, cam, modalOpen, loadTracker, startCamera, videoFit, readHands, newHand, processHands, moveFx, endFx, updateHand, pinchDown, pinchUp, dropHand, toClient, buttonAt, setHover, handClick, updateHandHover, initPointer, gatherPointers;

let GUITAR_BODY, ICONS, iconCache, iconImg, drawIcon, HAND_BONES, IVORY, FONT, g, label, drawBackdrop, drawString, drawFx, drawPreview, drawParticles, drawPops, rrect, drawPalette, drawMenu, drawHands, drawDebug, render, setCanvasContext;


const film = { on: false, counting: false, token: 0 };
function enterClean() { document.body.classList.add('clean'); layoutStage(); refreshUI(); }
function leaveClean() {
  document.body.classList.remove('clean');
  film.on = false; film.counting = false; film.token++;
  $('#count').classList.remove('show');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  layoutStage(); refreshUI();
}
async function startFilm() {
  if (rec.on || film.counting) return;
  initAudio();
  rec.mode = 'video';
  const my = ++film.token;
  film.counting = true;
  enterClean();
  try { await document.documentElement.requestFullscreen(); } catch (_) {}   // only works from a real click or key
  for (const n of [3, 2, 1]) {
    if (film.token !== my) return;
    const c = $('#count'); c.textContent = n; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    playDrum('tick', audio.ctx.currentTime, n === 1 ? 0.9 : 0.6, audio.beat);
    await new Promise(r => setTimeout(r, 1000));
  }
  if (film.token !== my) return;
  $('#count').classList.remove('show');
  film.counting = false; film.on = true;
  await startRecording();
  refreshUI();
}
function stopFilm() {
  if (rec.on) stopRecording(); else leaveClean();
}
function toggleClean() {
  if (film.on || film.counting) return;
  if (document.body.classList.contains('clean')) leaveClean(); else enterClean();
}

// ───────────────────────── stage shape: landscape or vertical ─────────────────────────
function setShape(shape) {
  if (shape === state.shape) return;
  if (rec.on) { toast('Stop the recording before changing the shape.'); return; }
  const [w, h] = shape === 'vertical' ? [720, 1280] : [1280, 720];
  const sx = w / W, sy = h / H;
  closeMenu(); state.preview = null; endFx();
  for (const s of state.strings) {
    for (const pid in s.holds) endHold(s, pid);
    s.a.x *= sx; s.a.y *= sy; s.b.x *= sx; s.b.y *= sy;
    s.track = {}; s.dwell = {}; s.pull = null; s.touched = nowS();
    orient(s);
  }
  state.particles = []; state.pops = [];
  W = w; H = h; state.shape = shape;
  const cv = $('#stage'); cv.width = W; cv.height = H;
  // a vertical picture uses only the middle of the camera frame, so ask the camera for more detail
  try {
    const tr = cam.video && cam.video.srcObject && cam.video.srcObject.getVideoTracks()[0];
    if (tr) tr.applyConstraints(shape === 'vertical' ? { width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }).catch(() => {});
  } catch (_) {}
  layoutStage(); refreshUI();
}

// ───────────────────────── setups: save and restore the whole stage ─────────────────────────
const SETUP_STORE = 'string-mirror-setups-v1';

// Ready-made layouts, in landscape coordinates (they are scaled to fit the vertical stage).
const STARTERS = [
  { id: 'harp', name: 'Harp', note: 'Four harp strings, low to high, with one for chords', key: 9, scale: 'pentamin', beat: 'lofi', bpm: 76, parts: [],
    strings: [[250, 470, 1030, 440, 'harp', null, -1], [250, 370, 1030, 340, 'harp', 'minor', 0, 'chord'], [250, 270, 1030, 240, 'harp', null, 0], [250, 170, 1030, 140, 'harp', null, 1]] },
  { id: 'band', name: 'Small band', note: 'Lead guitar, electric piano chords, bass and drums', key: 9, scale: 'minor', beat: 'boombap', bpm: 88, parts: ['kick', 'snare', 'hats'],
    strings: [[300, 170, 980, 150, 'guitar', 'pentamin', 0], [260, 290, 1020, 280, 'epiano', 'minor', 0, 'chord'], [240, 430, 640, 470, 'bass', 'minor', 0], [700, 470, 1060, 420, 'drums']] },
  { id: 'circle', name: 'Drum circle', note: 'Drum kit, hand drums, marimba and 808 bass', key: 2, scale: 'pentamaj', beat: 'dembow', bpm: 96, parts: ['kick'],
    strings: [[230, 220, 700, 170, 'drums'], [760, 170, 1080, 230, 'handdrums'], [260, 340, 1020, 330, 'marimba', null, 0], [380, 470, 900, 470, 'sub', null, 0]] },
  { id: 'oud', name: 'Oud night', note: 'Oud, qanun, a string section for chords and hand drums, in Hijaz', key: 2, scale: 'hijaz', beat: 'maqsum', bpm: 100, parts: ['kick', 'snare'],
    strings: [[280, 180, 1000, 160, 'oud', null, 0], [300, 290, 980, 300, 'qanun', null, 0], [260, 410, 700, 440, 'strings', null, 0, 'chord'], [760, 450, 1060, 400, 'handdrums']] },
  { id: 'chamber', name: 'Chamber group', note: 'Violin, cello, flute and voices: hold a finger on these to sustain', key: 7, scale: 'major', beat: 'lofi', bpm: 76, parts: [],
    strings: [[300, 170, 980, 150, 'violin', null, 0], [280, 300, 1000, 290, 'cello', null, 0], [300, 420, 700, 450, 'voices', null, 0, 'chord'], [740, 440, 1040, 400, 'flute', null, 0]] },
];
function starterSetup(S) {
  return { v: 1, name: S.name, w: 1280, h: 720, key: S.key, scale: S.scale, beat: S.beat, bpm: S.bpm, loopBars: 2, follow: false,
    parts: Object.fromEntries(PARTS.map(p => [p, S.parts.includes(p)])), layers: [],
    strings: S.strings.map(([ax, ay, bx, by, inst, scale, oct, mode]) => ({ a: [ax, ay], b: [bx, by], inst, scale: scale || null, root: null, oct: oct || 0, mode: mode || 'notes' })) };
}

function snapshot(name) {
  const r = v => Math.round(v * 10) / 10;
  return { v: 1, name, saved: Date.now(), w: W, h: H, shape: state.shape, key: state.key, scale: state.scale,
    beat: transport.beat, bpm: transport.bpm, parts: Object.assign({}, transport.parts), loopBars: transport.loopBars, follow: transport.follow,
    strings: state.strings.map(s => ({ a: [r(s.a.x), r(s.a.y)], b: [r(s.b.x), r(s.b.y)], inst: s.inst, scale: s.scale, root: s.root, oct: s.oct, mode: s.mode })),
    layers: transport.layers.map(L => ({ len: L.len, offset: L.offset, vol: L.vol, muted: L.muted, events: L.events })) };
}

// Everything is checked on the way in, because a setup can come from a file.
function applySetup(d) {
  if (!d || !Array.isArray(d.strings)) { toast('That file is not a String Mirror setup.'); return false; }
  const num = (v, a, b, def) => (Number.isFinite(+v) ? clamp(+v, a, b) : def);
  closeMenu(); state.preview = null; state.cleared = null;
  state.strings.slice().forEach(s => { for (const pid in s.holds) endHold(s, pid); });
  state.strings = [];
  transport.layers.slice().forEach(L => removeLayer(L.id));
  transport.rec = null;
  if ((d.shape === 'vertical' || d.shape === 'landscape') && d.shape !== state.shape) setShape(d.shape);

  state.key = Math.round(num(d.key, 0, 11, state.key));
  if (own(SCALES, d.scale)) state.scale = d.scale;
  if (own(BEATS, d.beat)) transport.beat = d.beat;
  transport.bpm = Math.round(num(d.bpm, 56, 180, BEATS[transport.beat].bpm));
  transport.loopBars = [1, 2, 4, 8].includes(d.loopBars) ? d.loopBars : 2;
  transport.follow = !!d.follow;
  for (const p of PARTS) transport.parts[p] = !!(d.parts && d.parts[p]);

  const sx = W / num(d.w, 100, 4000, 1280), sy = H / num(d.h, 100, 4000, 720);
  for (const o of d.strings.slice(0, MAX_STRINGS)) {
    if (!o || !Array.isArray(o.a) || !Array.isArray(o.b)) continue;
    const a = { x: num(o.a[0], -200, 4000, 0) * sx, y: num(o.a[1], -200, 4000, 0) * sy };
    const b = { x: num(o.b[0], -200, 4000, 0) * sx, y: num(o.b[1], -200, 4000, 0) * sy };
    if (dist(a, b) < 40) continue;
    addString(a, b, { silent: true, inst: own(INSTRUMENTS, o.inst) ? o.inst : 'guitar', scale: own(SCALES, o.scale) ? o.scale : null,
      root: o.root == null ? null : Math.round(num(o.root, 0, 11, 0)), oct: Math.round(num(o.oct, -2, 2, 0)), mode: o.mode === 'chord' ? 'chord' : 'notes' });
  }
  for (const L of (Array.isArray(d.layers) ? d.layers : []).slice(0, MAX_LAYERS)) {
    const len = [16, 32, 64, 128].includes(L && L.len) ? L.len : 0;
    if (!len || !Array.isArray(L.events)) continue;
    const events = [];
    for (const e of L.events.slice(0, 2000)) {
      if (!e || !own(INSTRUMENTS, e.inst)) continue;
      const base = { inst: e.inst, pos: num(e.pos, 0, len - 0.001, 0), vel: num(e.vel, 0.05, 1, 0.6) };
      if (typeof e.drum === 'string' && /^[a-zA-Z]{2,10}$/.test(e.drum)) events.push(Object.assign(base, { drum: e.drum }));
      else if (Array.isArray(e.notes) && e.notes.length && e.notes.length <= 6) {
        const notes = e.notes.map(n => Math.round(num(n, 12, 110, 60)));
        events.push(Object.assign(base, { notes, down: !!e.down }, e.hold ? { hold: num(e.hold, 0.08, 30, 0.3) } : {}));
      }
    }
    if (events.length) transport.layers.push(makeLayer({ len, offset: Math.round(num(L.offset, 0, len - 1, 0)), events, vol: num(L.vol, 0, 1.5, 1), muted: !!L.muted }));
  }
  state.strings.forEach(s => { s.touched = nowS(); });
  refreshUI();
  return true;
}

function storedSetups() {
  try { const a = JSON.parse(localStorage.getItem(SETUP_STORE) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function storeSetups(list) {
  try { localStorage.setItem(SETUP_STORE, JSON.stringify(list)); return true; }
  catch (_) { toast('This browser would not keep the setup. Use "Save to a file" instead.', 4500); return false; }
}
function saveSetup(name) {
  if (!state.strings.length && !transport.layers.length) { toast('There is nothing on the stage to save yet.'); return; }
  const list = storedSetups();
  name = (name || '').trim().slice(0, 40) || `Setup ${list.length + 1}`;
  const snap = snapshot(name), at = list.findIndex(s => s.name === name);
  if (at >= 0) list[at] = snap; else list.push(snap);
  if (storeSetups(list)) toast(at >= 0 ? `Updated “${name}”.` : `Saved “${name}”.`);
  refreshSetups();
}
function refreshSetups() {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('#starterList').innerHTML = STARTERS.map(S => `<button class="tile" data-starter="${S.id}"><b>${S.name}</b><span>${S.note}</span></button>`).join('');
  const list = storedSetups();
  $('#setupList').innerHTML = list.length ? list.map((s, i) =>
    `<div class="mrow"><span class="grow"><b>${esc(s.name)}</b><small>${(s.strings || []).length} strings${(s.layers || []).length ? ', ' + s.layers.length + ' layers' : ''} · ${esc(own(BEATS, s.beat) ? BEATS[s.beat].name : '')}</small></span><button data-load="${i}">Load</button><button data-drop="${i}" aria-label="Delete this setup">Delete</button></div>`).join('')
    : '<p class="small">Nothing saved yet. Build a stage you like, then save it here.</p>';
}
function setupToFile() {
  if (!state.strings.length && !transport.layers.length) { toast('There is nothing on the stage to save yet.'); return; }
  const name = ($('#setupName').value || '').trim() || 'setup';
  download(new Blob([JSON.stringify(snapshot(name))], { type: 'application/json' }), `string-mirror-${name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`);
}
async function setupFromFile(file) {
  try {
    if (file.size > 3e6) throw new Error('too large');
    if (applySetup(JSON.parse(await file.text()))) { toast('Setup loaded.'); closeModal('setupsModal'); }
  } catch (_) { toast('That file could not be read as a setup.'); }
}

// ───────────────────────── stems: each beat part and each layer as its own audio file ─────────────────────────
// Rendered offline at the current tempo and key, faster than real time, all the same length and
// starting on the same downbeat, so they line up when dropped into an editor.


function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) {
  $('#' + id).classList.remove('open');
  if (id === 'saveModal') { try { $('#takeVideo').pause(); $('#takeAudio').pause(); } catch (_) {} }
}

function buildChips() {
  $('#beatChips').innerHTML = BEAT_ORDER.map(id => `<button class="chip" data-beat="${id}">${BEATS[id].name}</button>`).join('');
  $('#partChips').innerHTML = PARTS.map(p => `<button class="chip" data-part="${p}"></button>`).join('');
  $('#leds').innerHTML = Array.from({ length: 16 }, (_, i) => `<i class="${i % 4 === 0 ? 'b' : ''}"></i>`).join('');
}

function refreshUI() {
  if (!$('#keyVal')) return;
  $('#keyVal').textContent = NOTE_NAMES[state.key];
  $('#toneVal').textContent = SCALES[state.scale].name;
  $('#bpmVal').textContent = transport.bpm;
  $('#barsVal').textContent = transport.loopBars === 1 ? '1 bar' : transport.loopBars + ' bars';
  $('#playBtn').classList.toggle('on', transport.playing);
  $('#playLabel').textContent = transport.playing ? 'Stop' : 'Play';
  const B = BEATS[transport.beat];
  $$('#beatChips .chip').forEach(b => b.classList.toggle('on', b.dataset.beat === transport.beat));
  $$('#partChips .chip').forEach((b, i) => { b.textContent = B.labels[i]; b.classList.toggle('on', transport.parts[b.dataset.part]); });
  const R = transport.rec;
  $('#layerBtn').classList.toggle('arming', !!R && R.state === 'countin');
  $('#layerBtn').classList.toggle('recording', !!R && R.state === 'rec');
  $('#layerLabel').textContent = R ? (R.state === 'rec' ? 'Recording… play now' : 'Get ready…') : 'Record a layer';
  $('#layerChips').innerHTML = transport.layers.map(L =>
    `<span class="layer"><button class="chip ${L.muted ? '' : 'on'}" data-layer="${L.id}" style="--c:${INSTRUMENTS[L.inst].color}" title="Mute or unmute">${L.name} · ${L.len / 16} bar${L.len > 16 ? 's' : ''}</button><button class="x" data-del="${L.id}" title="Remove this layer" aria-label="Remove layer">×</button></span>`).join('');
  $('#recBtn').classList.toggle('recording', rec.on);
  $('#recLabel').textContent = rec.on ? 'Stop' : 'Record';
  $('#recMode').textContent = rec.mode === 'video' ? 'Video + sound' : 'Sound only';
  $('#recMode').disabled = rec.on;
  if (!rec.on) $('#recTime').textContent = '';
  $('#clearBtn').disabled = !state.strings.length && !state.cleared;
  $('#clearBtn').textContent = state.cleared ? 'Undo clear' : 'Clear';
  $('#shapeBtn').textContent = state.shape === 'vertical' ? '9:16' : '16:9';
  $('#shapeBtn').disabled = rec.on;
  $('#filmBtn').disabled = rec.on || film.counting;
  $('#followBtn').classList.toggle('on', transport.follow);
  $('#undoLayer').disabled = !transport.layers.length && !transport.rec;
  $('#filmBar').classList.toggle('filming', film.on || film.counting);
  if (!rec.on) $('#filmTime').textContent = film.counting ? 'Get ready' : '0:00';
  $('#mixRows').innerHTML = mixRowsHTML();
}

function mixRowsHTML() {
  const pct = v => Math.round(v * 100) + '%';
  const row = (label, sub, key, v, extra = '') => `<div class="mrow"><span class="grow"><b>${label}</b><small>${sub}</small></span>${extra}`
    + `<button class="sq" data-vol="${key}" data-d="-1" aria-label="${label} quieter">−</button><span class="val">${pct(v)}</span><button class="sq" data-vol="${key}" data-d="1" aria-label="${label} louder">+</button></div>`;
  return row('Your playing', 'What you play live on the strings', 'live', state.mix.live)
    + row('Beat', BEATS[transport.beat].name, 'beat', state.mix.beat)
    + transport.layers.map((L, i) => row(`Layer ${i + 1}`, `${L.name} · ${L.len / 16} bar${L.len > 16 ? 's' : ''}`, 'L' + L.id, L.vol,
      `<button data-layer="${L.id}">${L.muted ? 'Unmute' : 'Mute'}</button><button data-del="${L.id}">Remove</button>`)).join('');
}
function nudgeVolume(key, d) {
  const step = v => Math.round(clamp(v + d * 0.1, 0, 1.5) * 10) / 10;
  if (key === 'live' || key === 'beat') {
    state.mix[key] = step(state.mix[key]);
    if (audio.ctx) { audio.music.gain.value = state.mix.live; audio.beat.gain.value = state.mix.beat; }
  } else {
    const L = transport.layers.find(l => 'L' + l.id === key);
    if (L) { L.vol = step(L.vol); if (L._g) L._g.gain.value = L.vol; }
  }
}

function currentHint() {
  if (state.mode === 'idle') return '';
  const R = transport.rec, M = state.menu, hands = state.mode !== 'mouse';
  if (R && R.state === 'countin') return 'Layer starts on the next bar. Listen for the count.';
  if (R && R.state === 'rec') return 'Recording your layer: play the strings now.';
  if (M) {
    if (M.kind === 'instrument') return hands ? 'Point at an instrument and hold still, or pinch it.' : 'Click an instrument.';
    if (M.kind === 'tone') return hands ? 'Now point at a tone for this string.' : 'Now click a tone for this string.';
    return hands ? 'Point and hold, or pinch, to choose.' : 'Click to choose.';
  }
  if (state.preview) return hands ? 'Pull your hands apart, then let go.' : 'Release to place the string.';
  if (!state.strings.length) return hands ? 'Pinch with both hands, pull them apart and let go to stretch a string.' : 'Drag anywhere to draw a string.';
  if (state.counts.plucks < 3) return hands ? 'Sweep a fingertip across the string to play it.' : 'Sweep the pointer across the string to play it.';
  if (state.counts.plucks < 14) return hands ? 'Pinch a string’s dot to change it. Pinch a button to press it.' : 'Click a string’s dot to change it. Drag an end to resize.';
  return '';
}

function layoutStage() {
  const cv = $('#stage');
  const sc = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.round(W * sc) + 'px';
  cv.style.height = Math.round(H * sc) + 'px';
  const r = cv.getBoundingClientRect();
  const top = $('#top').getBoundingClientRect(), dock = $('#dock').getBoundingClientRect();
  if (document.body.classList.contains('clean')) { state.safeTop = 0; state.safeBottom = H; return; }
  state.safeTop = clamp((top.bottom - r.top) * H / r.height, 0, H * 0.3);
  state.safeBottom = clamp((dock.top - r.top) * H / r.height, H * 0.58, H);
  // on the narrow vertical stage the hint sits at the top, clear of the instrument palette
  const hint = $('#hint'), tall = state.shape === 'vertical';
  hint.style.bottom = tall ? 'auto' : Math.round(innerHeight - dock.top + 16) + 'px';
  hint.style.top = tall ? Math.round(top.bottom + 12) + 'px' : 'auto';
  $('#toast').style.top = Math.round(top.bottom + (tall ? 64 : 14)) + 'px';
}

function initUI() {
  buildChips();
  const step = (arr, cur, d) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
  const on = (id, fn) => $('#' + id).addEventListener('click', e => { initAudio(); fn(e); refreshUI(); });

  on('keyDown', () => { state.key = (state.key + 11) % 12; });
  on('keyUp', () => { state.key = (state.key + 1) % 12; });
  on('toneDown', () => { state.scale = step(SCALE_ORDER, state.scale, -1); });
  on('toneUp', () => { state.scale = step(SCALE_ORDER, state.scale, 1); });
  on('bpmDown', () => { transport.bpm = clamp(transport.bpm - 4, 56, 180); });
  on('bpmUp', () => { transport.bpm = clamp(transport.bpm + 4, 56, 180); });
  on('barsDown', () => { transport.loopBars = step([1, 2, 4, 8], transport.loopBars, -1); });
  on('barsUp', () => { transport.loopBars = step([1, 2, 4, 8], transport.loopBars, 1); });
  on('playBtn', togglePlay);
  on('layerBtn', armLayer);
  on('recBtn', () => { rec.on ? stopRecording() : startRecording(); });
  on('clearBtn', clearStrings);
  on('shapeBtn', () => setShape(state.shape === 'vertical' ? 'landscape' : 'vertical'));
  on('filmBtn', startFilm);
  on('filmStop', stopFilm);
  on('cleanExit', leaveClean);
  on('followBtn', () => {
    transport.follow = !transport.follow;
    if (transport.follow && !transport.playing) toast('Follow chords takes effect while the beat is playing.');
  });
  on('undoLayer', undoLayer);
  on('mixBtn', () => { $('#stemsNote').textContent = ''; openModal('mixModal'); });
  on('setupsBtn', () => { refreshSetups(); openModal('setupsModal'); });
  on('setupSave', () => saveSetup($('#setupName').value));
  on('setupFileOut', setupToFile);
  on('setupFileIn', () => $('#setupFile').click());
  $('#setupFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) setupFromFile(f); });
  $('#starterList').addEventListener('click', e => {
    const b = e.target.closest('[data-starter]');
    if (!b) return;
    initAudio();
    const S = STARTERS.find(x => x.id === b.dataset.starter);
    if (applySetup(starterSetup(S))) { closeModal('setupsModal'); toast(`${S.name} is on the stage. Press Play for its beat.`); }
  });
  $('#setupList').addEventListener('click', e => {
    const ld = e.target.closest('[data-load]'), dr = e.target.closest('[data-drop]'), list = storedSetups();
    if (ld && list[+ld.dataset.load]) { initAudio(); if (applySetup(list[+ld.dataset.load])) { closeModal('setupsModal'); toast(`Loaded “${list[+ld.dataset.load].name}”.`); } }
    if (dr && list[+dr.dataset.drop]) { list.splice(+dr.dataset.drop, 1); storeSetups(list); refreshSetups(); }
  });
  $('#mixRows').addEventListener('click', e => {
    const v = e.target.closest('[data-vol]'), m = e.target.closest('[data-layer]'), d = e.target.closest('[data-del]');
    if (v) nudgeVolume(v.dataset.vol, +v.dataset.d);
    else if (d) { removeLayer(+d.dataset.del); return; }
    else if (m) { const L = transport.layers.find(l => l.id === +m.dataset.layer); if (L) L.muted = !L.muted; }
    refreshUI();
  });
  $('#stemsBtn').addEventListener('click', async () => {
    const b = $('#stemsBtn');
    b.disabled = true;
    try { await exportStems(msg => { $('#stemsNote').textContent = msg; }); }
    catch (err) { console.error(err); $('#stemsNote').textContent = 'The stems could not be rendered: ' + err.message; }
    b.disabled = false;
  });
  on('helpBtn', () => openModal('helpModal'));
  on('setBtn', () => openModal('setModal'));

  $('#beatChips').addEventListener('click', e => { const b = e.target.closest('[data-beat]'); if (b) { initAudio(); setBeat(b.dataset.beat); } });
  $('#partChips').addEventListener('click', e => {
    const b = e.target.closest('[data-part]');
    if (!b) return;
    initAudio();
    const p = b.dataset.part;
    transport.parts[p] = !transport.parts[p];
    if (transport.parts[p] && !transport.playing) startTransport();
    refreshUI();
  });
  $('#layerChips').addEventListener('click', e => {
    const m = e.target.closest('[data-layer]'), d = e.target.closest('[data-del]');
    if (d) removeLayer(+d.dataset.del);
    else if (m) { const L = transport.layers.find(l => l.id === +m.dataset.layer); if (L) L.muted = !L.muted; refreshUI(); }
  });

  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
  $('#saveVideo').addEventListener('click', () => rec.videoBlob && download(rec.videoBlob, `${rec.name}.${rec.ext}`));
  $('#saveWav').addEventListener('click', () => rec.wavBlob && download(rec.wavBlob, `${rec.name}.wav`));
  $('#saveMp3').addEventListener('click', saveMp3);
  on('recMode', () => { if (!rec.on) rec.mode = rec.mode === 'video' ? 'audio' : 'video'; });

  // settings
  const S = state.settings;
  const bind = (id, key, fn) => {
    const el = $('#' + id);
    if (el.type === 'checkbox') { el.checked = S[key]; el.addEventListener('change', () => { S[key] = el.checked; fn && fn(); }); }
    else { el.value = S[key]; el.addEventListener('input', () => { S[key] = +el.value; fn && fn(); }); }
  };
  bind('sSens', 'pinchSens'); bind('sAll', 'allFingers'); bind('sSkel', 'skeleton'); bind('sDim', 'dim'); bind('sLabels', 'labels');
  bind('sQuant', 'quantize'); bind('sDebug', 'debug');
  bind('sVol', 'volume', () => { if (audio.master) audio.master.gain.value = S.volume; });

  // start screen
  const status = msg => { $('#startStatus').textContent = msg; };
  $('#startCam').addEventListener('click', async () => {
    initAudio();
    $('#startCam').disabled = true;
    try {
      await startCamera(status);
      closeModal('startModal');
    } catch (err) {
      console.error(err);
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'NotFoundError');
      status(denied ? 'The camera did not open. Allow camera access for this page and try again, or play with the mouse.'
        : 'The hand tracker could not load (it needs an internet connection). You can still play with the mouse. ' + (err && err.message ? '(' + err.message + ')' : ''));
      $('#startCam').disabled = false;
    }
  });
  $('#startMouse').addEventListener('click', () => { initAudio(); state.mode = 'mouse'; closeModal('startModal'); });

  addEventListener('resize', layoutStage);
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.code === 'Space') { e.preventDefault(); initAudio(); togglePlay(); }
    if (e.key === 'r' || e.key === 'R') { if (film.on) stopFilm(); else $('#recBtn').click(); }
    if (e.key === 'l' || e.key === 'L') $('#layerBtn').click();
    if (e.key === 'f' || e.key === 'F') $('#filmBtn').click();
    if (e.key === 'z' || e.key === 'Z') undoLayer();
    if (e.key === 'h' || e.key === 'H') toggleClean();
    if (e.key === 'Escape') {
      if (film.on || film.counting) { stopFilm(); return; }
      closeMenu(); $$('.modal.open').forEach(m => m.id !== 'startModal' && m.classList.remove('open'));
    }
  });
  refreshSetups();
  layoutStage();
  refreshUI();
}

// ── main loop ──
let lastT = 0, fpsN = 0, fpsT = 0, hintShown = null, ledShown = -1, chordShown = null;
function frame() {
  requestAnimationFrame(frame);
  const t = nowS(), dt = Math.min(t - lastT, 0.1);
  lastT = t;
  if (++fpsN && t - fpsT > 1) { state.fps = Math.round(fpsN / (t - fpsT)); fpsN = 0; fpsT = t; }
  try {
    const dets = state.mode === 'camera' ? readHands(t) : state.mode === 'demo' ? demoHands(t) : null;
    if (dets) processHands(dets, t);
    const mo = state.mouse;      // the mouse plays like a fingertip: checked every frame, so resting on a string counts
    if (mo.inside && !mo.down && mo.x >= 0 && state.mode !== 'idle' && !modalOpen()) sweep('mouse', mo, t);
    updateHolds(t);
    updateMenu(gatherPointers(), dt);
    for (const h of state.hands) if (h) h.press = false;
    state.mouse.press = false;
    updateHandHover();
    render(t, dt);

    if (transport.dirty) { transport.dirty = false; refreshUI(); }
    const hint = currentHint();
    if (hint !== hintShown) { hintShown = hint; const el = $('#hint'); el.textContent = hint; el.classList.toggle('show', !!hint); }
    const cd = chordDegNow(), chord = cd == null ? '' : chordLabel(cd);
    if (chord !== chordShown) { chordShown = chord; $('#chordNow').textContent = chord; }
    let led = -1;
    if (transport.playing && audio.ctx) led = ((Math.floor(stepAt(audio.ctx.currentTime)) % 16) + 16) % 16;
    if (led !== ledShown) {
      const L = $('#leds').children;
      if (ledShown >= 0) L[ledShown].classList.remove('on');
      if (led >= 0) L[led].classList.add('on');
      ledShown = led;
    }
  } catch (err) {
    console.error(err);
    if (!frame.failed) { frame.failed = true; toast('Something went wrong: ' + err.message, 6000); }
  }
}

// ───────────────────────── #demo: scripted hands, no camera needed ─────────────────────────
// Feeds the same gesture code the camera does, so it doubles as a self-test.
const demo = { h: [{ on: false, x: 400, y: 400, p: 0 }, { on: false, x: 880, y: 400, p: 0 }], running: false, log: [] };

function demoHandPoints(h, d) {            // d: +1 thumb points right, -1 thumb points left
  const P = (x, y) => ({ x, y });
  const mix = (a, b, k) => P(lerp(a.x, b.x, k), lerp(a.y, b.y, k));
  const p = h.p;
  const tip8 = P(lerp(d * 30, d * 42, p), lerp(-175, -128, p));
  const tip4 = P(lerp(d * 78, d * 45, p), lerp(-70, -122, p));
  const anchor = p > 0.5 ? mix(tip4, tip8, 0.5) : tip8;       // what the script positions
  const w = P(h.x - anchor.x, h.y - anchor.y);
  const at = q => P(w.x + q.x, w.y + q.y);
  const m5 = P(d * 22, -85), m9 = P(0, -90), m13 = P(-d * 20, -84), m17 = P(-d * 38, -72);
  const t12 = P(0, -185), t16 = P(-d * 24, -170), t20 = P(-d * 46, -140), th1 = P(d * 28, -22);
  const L = [];
  L[0] = P(0, 0); L[1] = th1; L[2] = mix(th1, tip4, 0.4); L[3] = mix(th1, tip4, 0.75); L[4] = tip4;
  const finger = (i, m, tip) => { L[i] = m; L[i + 1] = mix(m, tip, 0.4); L[i + 2] = mix(m, tip, 0.72); L[i + 3] = tip; };
  finger(5, m5, tip8); finger(9, m9, t12); finger(13, m13, t16); finger(17, m17, t20);
  return L.map(at);
}
function demoHands() {
  const out = [];
  if (demo.h[0].on) out.push(demoHandPoints(demo.h[0], 1));
  if (demo.h[1].on) out.push(demoHandPoints(demo.h[1], -1));
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function tween(i, to, ms) {
  const h = demo.h[i], from = { x: h.x, y: h.y, p: h.p }, t0 = performance.now();
  h.on = true;
  for (;;) {
    const k = clamp((performance.now() - t0) / ms, 0, 1), e = k * k * (3 - 2 * k);
    h.x = lerp(from.x, to.x == null ? from.x : to.x, e);
    h.y = lerp(from.y, to.y == null ? from.y : to.y, e);
    h.p = lerp(from.p, to.p == null ? from.p : to.p, e);
    if (k >= 1) return;
    await sleep(16);
  }
}
const both = (a, b, ms) => Promise.all([tween(0, a, ms), tween(1, b, ms)]);
const canvasPosOf = el => {
  const r = el.getBoundingClientRect(), c = $('#stage').getBoundingClientRect();
  return { x: (r.left + r.width / 2 - c.left) * W / c.width, y: (r.top + r.height / 2 - c.top) * H / c.height };
};
async function demoStretch(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  await both({ x: mx - 150, y: my + 40, p: 0 }, { x: mx + 150, y: my + 40, p: 0 }, 500);
  await both({ x: mx - 120, y: my, p: 1 }, { x: mx + 120, y: my, p: 1 }, 450);
  await sleep(150);
  await both({ x: a.x, y: a.y }, { x: b.x, y: b.y }, 650);
  await sleep(150);
  await both({ p: 0 }, { p: 0 }, 220);
  await sleep(350);
}
async function demoChoose(i, id, pinch) {
  const it = state.menu && state.menu.items.find(x => x.id === id);
  if (!it) { demo.log.push('menu item missing: ' + id); return; }
  await tween(i, { x: it.x, y: it.y + (pinch ? 0 : 2), p: 0 }, 550);
  if (pinch) { await tween(i, { p: 1 }, 180); await sleep(140); await tween(i, { p: 0 }, 160); }
  else await sleep(1350);
  await sleep(300);
}
async function demoPress(i, sel) {
  const el = $(sel);
  if (!el) { demo.log.push('button missing: ' + sel); return; }
  const c = canvasPosOf(el);
  await tween(i, { x: c.x, y: c.y, p: 0 }, 600);
  await tween(i, { p: 1 }, 170); await sleep(130); await tween(i, { p: 0 }, 170);
  await sleep(250);
}
async function demoPluck(i, s, u, ms = 130) {
  if (!s) return;
  const x = lerp(s.a.x, s.b.x, u), y = lerp(s.a.y, s.b.y, u);
  const h = demo.h[i], above = h.y < y;
  if (Math.abs(h.x - x) > 12 || Math.abs(Math.abs(h.y - y) - 38) > 30) await tween(i, { x, y: y + (above ? -38 : 38), p: 0 }, 170);
  await tween(i, { x, y: y + (above ? 38 : -38) }, ms);
}

async function runDemo() {
  if (demo.running) return;
  demo.running = true;
  state.mode = 'demo';
  closeModal('startModal');
  initAudio();
  await sleep(500);
  await demoStretch({ x: 300, y: 250 }, { x: 980, y: 270 });
  await demoChoose(1, 'harp', false);          // point and hold
  await demoChoose(1, 'pentamin', false);
  const s1 = state.strings[0];
  for (const u of [0.1, 0.3, 0.5, 0.7, 0.9, 0.6]) await demoPluck(1, s1, u);
  await demoStretch({ x: 380, y: 430 }, { x: 900, y: 400 });
  await demoChoose(0, 'bass', true);           // pinch to choose
  await demoChoose(0, 'minor', true);
  const s2 = state.strings[1];
  await demoPress(0, '#playBtn');
  await demoPress(0, '[data-part="hats"]');
  await demoPress(0, '[data-part="bass"]');
  await demoPress(0, '[data-part="chords"]');
  await demoPress(0, '#layerBtn');
  await tween(0, { x: 300, y: 520, p: 0 }, 300);
  const wait = async f => { for (let k = 0; k < 400 && !f(); k++) await sleep(25); };
  await wait(() => transport.rec && transport.rec.state === 'rec');
  for (let k = 0; transport.rec && k < 40; k++) {
    await demoPluck(1, k % 3 === 2 ? s2 : s1, [0.15, 0.45, 0.3, 0.75, 0.55, 0.6, 0.9][k % 7], 110);
    await sleep(160);
  }
  await wait(() => !transport.rec);
  demo.done = true;
  for (let k = 0; demo.running; k++) {         // keep jamming over the loop
    await demoPluck(1, k % 4 === 3 ? s2 : s1, [0.2, 0.5, 0.35, 0.8, 0.65, 0.45, 0.95][k % 7], 120);
    await sleep(k % 4 === 1 ? 420 : 210);
    if (!state.strings.length) break;
  }
}

// ───────────────────────── boot ─────────────────────────
function boot() {
  const shared = { get W() { return W; }, get H() { return H; }, $, $$, clamp, lerp, dist, nowS, NOTE_NAMES, SHARP_NAMES, FLAT_NAMES, spell, SCALES, SCALE_ORDER, DRUM_ZONES, HAND_ZONES, INSTRUMENTS, INSTRUMENT_ORDER, own, MAX_STRINGS, MAX_LAYERS, state, hexA, toast, strRoot, strScale, strLen, strMid, orient, zoneCount, zoneInfo, stringLabel, addString, removeString, clearStrings, pluck, notePop, keepVoices, bendString, ROLLS, HOLD_IN, HOLD_OUT, HOLD_AFTER, holdNote, rollGap, startHold, endHold, updateHolds, sweep, forgetPointer, nearestBody, PULL_MAX, BEND_CENTS, pullString, releasePull, burst, nearestEndpoint, nearestDot, distToString, menuItems, MENU_TITLES, openMenu, menuContains, closeMenu, menuIdle, chooseMenu, pluckQuiet, updateMenu, film, enterClean, leaveClean, startFilm, stopFilm, toggleClean, setShape, SETUP_STORE, STARTERS, starterSetup, snapshot, applySetup, storedSetups, storeSetups, saveSetup, refreshSetups, setupToFile, setupFromFile, openModal, closeModal, buildChips, refreshUI, mixRowsHTML, nudgeVolume, currentHint, layoutStage, initUI, lastT, fpsN, fpsT, hintShown, ledShown, chordShown, frame, demo, demoHandPoints, demoHands, sleep, tween, both, canvasPosOf, demoStretch, demoChoose, demoPress, demoPluck, runDemo, boot };
  const audioAPI = createAudioModule(shared);
  ({ audio, midiHz, buildGraph, initAudio, setFx, instBus, ksBuffer, env, VC, noiseSrc, oscAt, playNote, releaseVoice, bendVoice, SUSTAINS, buildVoice, playDrum, playEvent, BEATS, BEAT_ORDER, PARTS, PROGS, transport, stepDur, scaleDegree, scheduleStep, tick, startTransport, stopTransport, togglePlay, setBeat, stepAt, armLayer, captureEvent, makeLayer, layerOut, finishLayer, removeLayer, undoLayer, chordDegNow, chordLabel, rec, TAP_SRC, pushPcm, ensureTap, pickMime, startRecording, stopRecording, wavBlob, pcmFromVideo, mp3Blob, mp3Possible, finishRecording, saveMp3, download, renderOffline, wavBytes, CRC_TABLE, crc32, zipBlob, exportStems } = audioAPI);
  const visionContext = Object.assign(Object.create(shared), audioAPI);
  const visionAPI = createVisionModule(visionContext);
  ({ TRACKER, cam, modalOpen, loadTracker, startCamera, videoFit, readHands, newHand, processHands, moveFx, endFx, updateHand, pinchDown, pinchUp, dropHand, toClient, buttonAt, setHover, handClick, updateHandHover, initPointer, gatherPointers } = visionAPI);
  const visualContext = Object.assign(Object.create(shared), audioAPI, visionAPI);
  const visualAPI = createVisualModule(visualContext);
  ({ GUITAR_BODY, ICONS, iconCache, iconImg, drawIcon, HAND_BONES, IVORY, FONT, g, label, drawBackdrop, drawString, drawFx, drawPreview, drawParticles, drawPops, rrect, drawPalette, drawMenu, drawHands, drawDebug, render, setCanvasContext } = visualAPI);
  setCanvasContext($('#stage').getContext('2d'));

  initUI();
  initPointer();
  lastT = fpsT = nowS();
  requestAnimationFrame(frame);
  if (location.hash.includes('demo')) { $('#startStatus').textContent = 'Demo: scripted hands are playing. Click anywhere if you hear nothing.'; runDemo(); }
  window.__sm = { state, transport, audio, rec, demo, cam, film, INSTRUMENTS, STARTERS, mp3Blob, iconImg, storedSetups, applySetup, starterSetup, snapshot, exportStems, setShape, chordDegNow, chordLabel,
    demoApi: { tween, both, demoStretch, sleep }, size: () => [W, H], pluck, addString, sweep, processHands, startRecording, stopRecording, armLayer, togglePlay, zoneInfo, zoneCount };
}
boot();
const runtime=window.__sm;if(runtime){installAudioExperience(runtime);installVisionLifecycle(runtime);installVisualExperience(runtime)}
})();
