
import { installAudioExperience } from './audio.js';
import { installVisionLifecycle } from './vision.js';
import { installVisualExperience } from './visuals.js';
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

// ───────────────────────── sound engine (all synthesised, no samples) ─────────────────────────
const audio = { ctx: null, ready: false, ks: new Map() };
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// Builds the whole mixing graph on a context. The live one is built once; stems are rendered by
// building the same graph on an offline context and swapping it in for a moment.
function buildGraph(ctx, o = {}) {
  const G = { ctx, waves: {} };
  const master = G.master = ctx.createGain();
  master.gain.value = o.offline ? 0.9 : state.settings.volume;
  const out = G.out = ctx.createGain();
  out.gain.value = 0.9;
  // performance effects on the whole mix: a two-way filter and a tempo echo
  const hp = G.hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 20; hp.Q.value = 0.8;
  const lp = G.lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.9;
  master.connect(hp); hp.connect(lp);
  if (o.plain) lp.connect(out);
  else {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    lp.connect(comp); comp.connect(out);
  }
  out.connect(ctx.destination);
  G.echoSend = ctx.createGain(); G.echoSend.gain.value = 0;
  G.echoDelay = ctx.createDelay(2); G.echoDelay.delayTime.value = 0.4;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  master.connect(G.echoSend); G.echoSend.connect(G.echoDelay); G.echoDelay.connect(fb); fb.connect(G.echoDelay); G.echoDelay.connect(hp);

  const bus = v => { const b = ctx.createGain(); b.gain.value = v; b.connect(master); return b; };
  G.music = bus(o.offline ? 0.85 : state.mix.live);      // what you play live
  G.beat = bus(o.offline ? 0.8 : state.mix.beat);        // the pre-made beat
  G.layers = bus(0.85);     // your looped layers, each through its own volume

  // reverb: generated impulse response
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.3);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lpf = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lpf += 0.35 * ((Math.random() * 2 - 1) - lpf);
      d[i] = lpf * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1);
    }
  }
  conv.buffer = ir;
  const revOut = ctx.createGain(); revOut.gain.value = 0.9;
  conv.connect(revOut); revOut.connect(master);
  G.reverb = conv;

  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  G.noise = nb;

  const wave = a => ctx.createPeriodicWave(new Float32Array(a.length), new Float32Array(a));
  G.waves.piano = wave([0, 1, 0.52, 0.3, 0.19, 0.12, 0.085, 0.06, 0.04, 0.03, 0.02, 0.014]);
  G.waves.keys = wave([0, 1, 0.3, 0.1, 0.16, 0.03, 0.05]);
  G.waves.organ = wave([0, 0.22, 0.9, 0, 0.55, 0, 0.3, 0, 0.2]);   // drawbars, on a wave an octave below the note

  if (!o.offline) { G.recDest = ctx.createMediaStreamDestination(); out.connect(G.recDest); }
  return G;
}
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state !== 'running') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  Object.assign(audio, buildGraph(new AC({ latencyHint: 'interactive' })));
  audio.ready = true;
}
// brightness sweeps down (dark) or up (thin); echo is 0..1
function setFx(dark, thin, echo) {
  const c = audio.ctx;
  if (!c) return;
  const t = c.currentTime;
  audio.lp.frequency.setTargetAtTime(20000 * Math.pow(0.018, dark), t, 0.04);
  audio.hp.frequency.setTargetAtTime(20 * Math.pow(90, thin), t, 0.04);
  audio.echoSend.gain.setTargetAtTime(echo * 0.75, t, 0.05);
  audio.echoDelay.delayTime.setTargetAtTime(clamp(60 / transport.bpm * 0.75, 0.1, 1.5), t, 0.1);
}

// One input per instrument and destination, with its own tone shaping and reverb amount.
function instBus(id, dest) {
  dest = dest || audio.music;
  const cache = dest._buses || (dest._buses = {});
  if (cache[id]) return cache[id];
  const ctx = audio.ctx;
  const cfg = {
    guitar: { gain: 0.8, rev: 0.16 }, piano: { gain: 0.75, rev: 0.2 }, harp: { gain: 0.85, rev: 0.3 },
    oud: { gain: 0.85, rev: 0.14 }, bass: { gain: 1.0, rev: 0.03, lp: 1400 }, strings: { gain: 0.5, rev: 0.35 },
    flute: { gain: 0.6, rev: 0.34 }, bells: { gain: 0.5, rev: 0.4 }, drums: { gain: 0.9, rev: 0.07 },
    keys: { gain: 0.5, rev: 0.22 }, sub: { gain: 0.9, rev: 0 },
    egtr: { gain: 0.42, rev: 0.2, drive: 7, lp: 3600 }, qanun: { gain: 0.8, rev: 0.24 }, sitar: { gain: 0.7, rev: 0.26, peak: 2700 },
    organ: { gain: 0.75, rev: 0.26 }, marimba: { gain: 0.85, rev: 0.2 }, kalimba: { gain: 0.85, rev: 0.3 },
    steelpan: { gain: 0.8, rev: 0.3 }, violin: { gain: 0.55, rev: 0.32 }, cello: { gain: 0.7, rev: 0.3 },
    trumpet: { gain: 0.8, rev: 0.28 }, voices: { gain: 1.9, rev: 0.4 }, synth: { gain: 0.4, rev: 0.2 },
  }[id] || { gain: 0.7, rev: 0.15 };
  const inp = ctx.createGain();
  inp.gain.value = cfg.gain;
  let tail = inp;
  if (cfg.drive) {                 // amplifier: push the signal into a soft clipper
    const pre = ctx.createGain(); pre.gain.value = cfg.drive;
    const sh = ctx.createWaveShaper(), c = new Float32Array(1025);
    for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 1.6) * 0.8; }
    sh.curve = c; sh.oversample = '2x';
    tail.connect(pre); pre.connect(sh); tail = sh;
  }
  if (cfg.peak) {
    const f = ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = cfg.peak; f.Q.value = 1.2; f.gain.value = 7;
    tail.connect(f); tail = f;
  }
  if (cfg.lp) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cfg.lp;
    tail.connect(f); tail = f;
  }
  tail.connect(dest);
  if (cfg.rev) {
    const s = ctx.createGain(); s.gain.value = cfg.rev;
    tail.connect(s); s.connect(audio.reverb);
  }
  return (cache[id] = inp);
}

// Karplus-Strong plucked string, rendered once per note and cached.
function ksBuffer(id, midi) {
  const key = id + ':' + midi;
  const hit = audio.ks.get(key);
  if (hit) return hit;
  const P = {
    guitar: { dur: 2.6, bright: 0.62, pick: 0.2, t60: 3.4 },
    harp:   { dur: 3.2, bright: 0.34, pick: 0.48, t60: 5.0 },
    oud:    { dur: 1.7, bright: 0.85, pick: 0.11, t60: 1.9, det: [-6, 6] },
    bass:   { dur: 2.2, bright: 0.24, pick: 0.3, t60: 3.0 },
    egtr:   { dur: 3.0, bright: 0.7, pick: 0.14, t60: 5.0 },
    qanun:  { dur: 2.4, bright: 0.9, pick: 0.08, t60: 2.8, det: [-7, 0, 7] },
    sitar:  { dur: 3.2, bright: 0.95, pick: 0.06, t60: 4.5, buzz: true },
  }[id];
  const ctx = audio.ctx, sr = ctx.sampleRate, n = Math.floor(sr * P.dur);
  const data = new Float32Array(n);
  const render = (freq, gain) => {
    const period = sr / freq;
    let N = Math.floor(period - 0.5), frac = period - 0.5 - N;
    if (frac < 0.1) { N -= 1; frac += 1; }
    if (N < 2) N = 2;
    const C = (1 - frac) / (1 + frac);
    const dl = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += P.bright * ((Math.random() * 2 - 1) - lp); dl[i] = lp; }
    const off = Math.max(1, Math.round(P.pick * N));
    const ex = dl.slice();
    let peak = 1e-6;
    for (let i = 0; i < N; i++) { dl[i] = ex[i] - ex[(i - off + N) % N]; peak = Math.max(peak, Math.abs(dl[i])); }
    for (let i = 0; i < N; i++) dl[i] /= peak;
    const decay = Math.pow(0.001, 1 / (freq * P.t60));
    let idx = 0, prev = 0, apx = 0, apy = 0;
    for (let i = 0; i < n; i++) {
      const x = dl[idx];
      const avg = P.buzz && x < 0 ? 0.9 * x + 0.1 * prev : 0.5 * (x + prev); prev = x;   // buzz: the bridge only damps one half of the swing
      const y = C * avg + apx - C * apy; apx = avg; apy = y;
      dl[idx] = y * decay;
      data[i] += x * gain;
      if (++idx >= N) idx = 0;
    }
  };
  const f = midiHz(midi);
  if (P.det) for (const c of P.det) render(f * Math.pow(2, c / 1200), 1 / P.det.length + 0.1);   // doubled or tripled courses
  else render(f, 1);
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < n; i++) {
    let g = 0.85 / peak;
    if (i > n - fade) g *= (n - i) / fade;
    data[i] *= g;
  }
  const buf = ctx.createBuffer(1, n, sr);
  buf.getChannelData(0).set(data);
  if (audio.ks.size > 260) audio.ks.delete(audio.ks.keys().next().value);
  audio.ks.set(key, buf);
  return buf;
}

function env(param, t, pts) { // pts: [[dt, value, 'lin'|'exp'], ...]
  param.cancelScheduledValues(t);
  param.setValueAtTime(pts[0][1], t + pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    const [dt, v, kind] = pts[i];
    if (kind === 'exp') param.exponentialRampToValueAtTime(Math.max(v, 1e-4), t + dt);
    else param.linearRampToValueAtTime(v, t + dt);
  }
}
let VC = null;            // while a note is being built, its sound sources are collected here
function noiseSrc(t, dur) {
  const s = audio.ctx.createBufferSource();
  s.buffer = audio.noise; s.loop = true;
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  if (VC) VC.push(s);
  return s;
}
function oscAt(type, freq, t, dur) {
  const o = audio.ctx.createOscillator();
  if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
  o.frequency.value = freq;
  o.start(t); o.stop(t + dur + 0.05);
  if (VC) VC.push(o);
  return o;
}

// A pitched note on any melodic instrument.
// o.held keeps a sustaining instrument sounding until releaseVoice; o.holdSec sets a fixed length.
// Returns the voice, so it can be bent or released later.
function playNote(id, midi, t, vel, dest, len, o) {
  const ctx = audio.ctx;
  if (!ctx) return null;
  t = Math.max(t, ctx.currentTime);
  vel = clamp(vel, 0.05, 1);
  if (id === 'epiano') id = 'keys';
  const bus = instBus(id, dest);
  const held = !!(o && o.held);
  let out = bus, gate = null;
  if (held) { gate = ctx.createGain(); gate.connect(bus); out = gate; }
  const hs = held ? 45 : o && o.holdSec;
  const H = base => (hs != null ? Math.max(hs, 0.08) : base * (len || 1));
  const srcs = VC = [];
  try { buildVoice(id, midi, t, vel, out, len, H); } finally { VC = null; }
  return { srcs, gate, t };
}
function releaseVoice(v) {
  if (!v || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  if (v.gate) v.gate.gain.setTargetAtTime(0, t, 0.07);
  for (const s of v.srcs) { try { s.stop(t + 0.6); } catch (_) {} }
}
function bendVoice(v, cents, glide = 0.025) {
  if (!v || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  for (const s of v.srcs) {
    if (!s.detune) continue;
    if (s._d0 == null) s._d0 = s.detune.value;
    s.detune.cancelScheduledValues(t);
    s.detune.setTargetAtTime(s._d0 + cents, t, glide);
  }
}
const SUSTAINS = { organ: 1, violin: 1, cello: 1, strings: 1, flute: 1, trumpet: 1, voices: 1, synth: 1 };

function buildVoice(id, midi, t, vel, out, len, H) {
  const ctx = audio.ctx;
  const f = midiHz(midi);

  if (id === 'guitar' || id === 'harp' || id === 'oud' || id === 'bass' || id === 'egtr' || id === 'qanun' || id === 'sitar') {
    const s = ctx.createBufferSource();
    s.buffer = ksBuffer(id, midi);
    VC.push(s);
    const g = ctx.createGain(); g.gain.value = 0.25 + 0.75 * vel;
    s.connect(g); g.connect(out);
    s.start(t);
    if (id === 'bass') {
      const o = oscAt('sine', f, t, 0.9), og = ctx.createGain();
      env(og.gain, t, [[0, 0], [0.01, 0.5 * vel], [0.9, 0.0001, 'exp']]);
      o.connect(og); og.connect(out);
    }
    return;
  }
  if (id === 'piano' || id === 'keys') {
    const dur = clamp(3.2 - (midi - 36) * 0.03, 1.2, 3.2) * (len || 1);
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.4;
    env(lp.frequency, t, [[0, Math.min(11000, f * 5 + 2500 * vel + 600)], [dur * 0.6, Math.max(500, f * 1.6), 'exp']]);
    env(g.gain, t, [[0, 0], [0.005, 0.55 * vel], [0.12, 0.3 * vel, 'exp'], [dur, 0.0001, 'exp']]);
    const wave = id === 'keys' ? audio.waves.keys : audio.waves.piano;
    const o1 = oscAt(wave, f, t, dur), o2 = oscAt(wave, f * 1.0018, t, dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.6;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
    if (id === 'piano') {
      const n = noiseSrc(t, 0.04), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8;
      env(ng.gain, t, [[0, 0.18 * vel], [0.035, 0.0001, 'exp']]);
      n.connect(bp); bp.connect(ng); ng.connect(out);
    }
    return;
  }
  if (id === 'strings') {
    const hold = H(0.95), dur = hold + 0.8;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1100 + 2400 * vel; lp.Q.value = 0.6;
    env(g.gain, t, [[0, 0], [0.09, 0.3 * vel], [hold, 0.24 * vel], [dur, 0.0001, 'exp']]);
    const lfo = oscAt('sine', 5.3, t, dur), lg = ctx.createGain();
    env(lg.gain, t, [[0, 0], [0.25, 0], [0.6, 7]]);
    lfo.connect(lg);
    for (const d of [-9, 0, 8]) {
      const o = oscAt('sawtooth', f, t, dur);
      o.detune.value = d; lg.connect(o.detune); o.connect(lp);
    }
    lp.connect(g); g.connect(out);
    return;
  }
  if (id === 'flute') {
    const hold = H(0.5), dur = hold + 0.3;
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.05, 0.5 * vel], [hold, 0.42 * vel], [dur, 0.0001, 'exp']]);
    const lfo = oscAt('sine', 5, t, dur), lg = ctx.createGain();
    env(lg.gain, t, [[0, 0], [0.18, 0], [0.45, 9]]);
    lfo.connect(lg);
    const o1 = oscAt('sine', f, t, dur), o2 = oscAt('triangle', f * 2, t, dur), g2 = ctx.createGain();
    g2.gain.value = 0.13;
    lg.connect(o1.detune); lg.connect(o2.detune);
    o1.connect(g); o2.connect(g2); g2.connect(g);
    const n = noiseSrc(t, dur), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2.2); bp.Q.value = 1.6;
    env(ng.gain, t, [[0, 0.5], [0.07, 0.1, 'exp'], [dur, 0.05]]);
    n.connect(bp); bp.connect(ng); ng.connect(g);
    g.connect(out);
    return;
  }
  if (id === 'bells') {
    const dur = 2.8;
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.003, 0.5 * vel], [dur, 0.0001, 'exp']]);
    const car = oscAt('sine', f, t, dur), mod = oscAt('sine', f * 3.51, t, dur), mg = ctx.createGain();
    env(mg.gain, t, [[0, f * (1.2 + 2 * vel)], [1.1, f * 0.15, 'exp']]);
    mod.connect(mg); mg.connect(car.frequency);
    const p2 = oscAt('sine', f * 2.76, t, 0.9), pg = ctx.createGain();
    env(pg.gain, t, [[0, 0.16 * vel], [0.8, 0.0001, 'exp']]);
    car.connect(g); p2.connect(pg); pg.connect(g); g.connect(out);
    return;
  }
  if (id === 'organ') {
    const hold = H(0.55), dur = hold + 0.14;
    const g = ctx.createGain(), trem = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.012, 0.5 * vel], [hold, 0.5 * vel], [dur, 0.0001, 'exp']]);
    const o = oscAt(audio.waves.organ, f / 2, t, dur);
    const lfo = oscAt('sine', 6.2, t, dur), lg = ctx.createGain(); lg.gain.value = 0.12; trem.gain.value = 0.88;
    lfo.connect(lg); lg.connect(trem.gain);
    o.connect(trem); trem.connect(g); g.connect(out);
    return;
  }
  if (id === 'marimba' || id === 'kalimba') {
    const M = id === 'marimba';
    const g = ctx.createGain(); g.gain.value = 1; g.connect(out);
    const part = (mult, level, decay) => {
      const o = oscAt('sine', f * mult, t, decay), pg = ctx.createGain();
      env(pg.gain, t, [[0, 0], [0.002, level * vel], [decay, 0.0001, 'exp']]);
      o.connect(pg); pg.connect(g);
    };
    if (M) { part(1, 0.6, 0.9); part(4, 0.22, 0.14); part(10, 0.07, 0.04); }
    else { part(1, 0.6, 1.7); part(2, 0.08, 0.5); part(5.4, 0.16, 0.09); part(8.9, 0.05, 0.04); }
    return;
  }
  if (id === 'steelpan') {
    const dur = 1.5;
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.004, 0.5 * vel], [0.2, 0.26 * vel, 'exp'], [dur, 0.0001, 'exp']]);
    const car = oscAt('sine', f, t, dur), mod = oscAt('sine', f * 2, t, dur), mg = ctx.createGain();
    env(car.frequency, t, [[0, f * 1.012], [0.05, f, 'exp']]);
    env(mg.gain, t, [[0, f * (1.4 + 1.6 * vel)], [0.3, f * 0.18, 'exp']]);
    mod.connect(mg); mg.connect(car.frequency);
    const p2 = oscAt('sine', f * 2.005, t, 0.7), pg = ctx.createGain();
    env(pg.gain, t, [[0, 0.2 * vel], [0.7, 0.0001, 'exp']]);
    car.connect(g); p2.connect(pg); pg.connect(g); g.connect(out);
    return;
  }
  if (id === 'violin' || id === 'cello') {
    const V = id === 'violin';
    const hold = H(0.55), dur = hold + 0.24;
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.07, 0.36 * vel], [hold, 0.3 * vel], [dur, 0.0001, 'exp']]);
    const lfo = oscAt('sine', V ? 5.8 : 5.1, t, dur), lg = ctx.createGain();
    env(lg.gain, t, [[0, 0], [0.16, 0], [0.4, V ? 14 : 9]]);
    lfo.connect(lg);
    let node = ctx.createGain();
    for (const d of [0, 5]) { const o = oscAt('sawtooth', f, t, dur); o.detune.value = d; lg.connect(o.detune); o.connect(node); }
    for (const [fr, gain] of (V ? [[520, 6], [1150, 4], [2900, 6]] : [[230, 6], [600, 5], [1500, 4]])) {   // body resonances
      const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = fr; b.Q.value = 2.2; b.gain.value = gain;
      node.connect(b); node = b;
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = (V ? 4800 : 2600) + 1500 * vel;
    node.connect(lp); lp.connect(g);
    const n = noiseSrc(t, dur), bp = ctx.createBiquadFilter(), ng = ctx.createGain();     // bow hair
    bp.type = 'bandpass'; bp.frequency.value = V ? 3200 : 1800; bp.Q.value = 0.7;
    env(ng.gain, t, [[0, 0.05], [0.1, 0.012, 'exp'], [dur, 0.008]]);
    n.connect(bp); bp.connect(ng); ng.connect(g);
    g.connect(out);
    return;
  }
  if (id === 'trumpet') {
    const hold = H(0.4), dur = hold + 0.13;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.4;
    env(lp.frequency, t, [[0, f * 1.2], [0.05, Math.min(9000, f * (4 + 4 * vel))], [hold, Math.min(8000, f * 4)], [dur, f * 1.5]]);
    env(g.gain, t, [[0, 0], [0.03, 0.4 * vel], [hold, 0.34 * vel], [dur, 0.0001, 'exp']]);
    const lfo = oscAt('sine', 5.4, t, dur), lg = ctx.createGain();
    env(lg.gain, t, [[0, 0], [0.22, 0], [0.42, 8]]);
    lfo.connect(lg);
    const o1 = oscAt('sawtooth', f, t, dur), o2 = oscAt('square', f, t, dur), g2 = ctx.createGain();
    g2.gain.value = 0.25; lg.connect(o1.detune); lg.connect(o2.detune);
    env(o1.detune, t, [[0, -35], [0.045, 0]]);                      // the lip scoop at the start of a note
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
    return;
  }
  if (id === 'voices') {
    const hold = H(0.9), dur = hold + 0.75;
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.14, 0.3 * vel], [hold, 0.26 * vel], [dur, 0.0001, 'exp']]);
    const src = ctx.createGain();
    const lfo = oscAt('sine', 4.8, t, dur), lg = ctx.createGain();
    env(lg.gain, t, [[0, 0], [0.3, 0], [0.7, 8]]);
    lfo.connect(lg);
    for (const d of [-9, 0, 9]) { const o = oscAt('sawtooth', f, t, dur); o.detune.value = d; lg.connect(o.detune); o.connect(src); }
    const n = noiseSrc(t, dur), ng = ctx.createGain(); ng.gain.value = 0.05; n.connect(ng); ng.connect(src);
    for (const [fr, q, level] of [[780, 7, 1], [1180, 8, 0.6], [2850, 9, 0.28]]) {      // "aah"
      const b = ctx.createBiquadFilter(), bg = ctx.createGain();
      b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = q; bg.gain.value = level;
      src.connect(b); b.connect(bg); bg.connect(g);
    }
    g.connect(out);
    return;
  }
  if (id === 'synth') {
    const hold = H(0.3), dur = hold + 0.14;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 7;
    env(lp.frequency, t, [[0, Math.min(12000, f * (5 + 7 * vel))], [0.22, Math.min(9000, f * 2.2), 'exp']]);
    env(g.gain, t, [[0, 0], [0.005, 0.42 * vel], [0.14, 0.28 * vel, 'exp'], [hold, 0.25 * vel], [dur, 0.0001, 'exp']]);
    const o1 = oscAt('sawtooth', f, t, dur), o2 = oscAt('square', f, t, dur), g2 = ctx.createGain();
    o2.detune.value = 9; g2.gain.value = 0.5;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
    return;
  }
  if (id === 'sub') { // 808-style bass for the trap beat
    const dur = 0.9 * (len || 1);
    const g = ctx.createGain();
    env(g.gain, t, [[0, 0], [0.008, 0.9 * vel], [dur, 0.0001, 'exp']]);
    const o = oscAt('sine', f, t, dur);
    env(o.frequency, t, [[0, f * 2.2], [0.05, f, 'exp']]);
    const sh = ctx.createWaveShaper(), c = new Float32Array(257);
    for (let i = 0; i < 257; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 2.2); }
    sh.curve = c;
    o.connect(sh); sh.connect(g); g.connect(out);
  }
}

function playDrum(name, t, vel, dest) {
  const ctx = audio.ctx;
  if (!ctx) return;
  t = Math.max(t, ctx.currentTime);
  vel = clamp(vel, 0.05, 1);
  const out = instBus('drums', dest);
  const g = ctx.createGain(); g.connect(out);
  const tone = (type, f0, f1, sweep, dur, level) => {
    const o = oscAt(type, f0, t, dur), og = ctx.createGain();
    env(o.frequency, t, [[0, f0], [sweep, f1, 'exp']]);
    env(og.gain, t, [[0, level * vel], [dur, 0.0001, 'exp']]);
    o.connect(og); og.connect(g);
  };
  const noise = (type, freq, q, dur, level, at = 0) => {
    const n = noiseSrc(t + at, dur), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(ng.gain, t + at, [[0, level * vel], [dur, 0.0001, 'exp']]);
    n.connect(f); f.connect(ng); ng.connect(g);
  };
  switch (name) {
    case 'kick': tone('sine', 155, 44, 0.11, 0.42, 1.0); noise('lowpass', 2500, 0.5, 0.012, 0.35); break;
    case 'snare': noise('highpass', 1300, 0.6, 0.19, 0.6); tone('triangle', 200, 165, 0.05, 0.11, 0.45); break;
    case 'hat': noise('highpass', 7800, 0.8, 0.045, 0.3); break;
    case 'ohat': noise('highpass', 7200, 0.8, 0.3, 0.26); break;
    case 'clap': noise('bandpass', 1500, 1.1, 0.02, 0.5); noise('bandpass', 1500, 1.1, 0.02, 0.5, 0.012);
      noise('bandpass', 1500, 1.1, 0.16, 0.55, 0.026); break;
    case 'tomL': tone('sine', 135, 82, 0.2, 0.34, 0.85); break;
    case 'tomH': tone('sine', 215, 140, 0.16, 0.28, 0.8); break;
    case 'rim': tone('triangle', 1750, 1700, 0.01, 0.03, 0.4); noise('bandpass', 2400, 3, 0.02, 0.3); break;
    case 'dum': tone('sine', 98, 58, 0.09, 0.3, 1.0); noise('lowpass', 900, 0.5, 0.02, 0.4); break;
    case 'tak': noise('bandpass', 3300, 1.6, 0.04, 0.7); tone('sine', 790, 760, 0.02, 0.06, 0.22); break;
    case 'riq': noise('highpass', 6200, 1.2, 0.06, 0.2); break;
    case 'ka': noise('bandpass', 2300, 1.4, 0.035, 0.45); break;
    case 'slap': noise('bandpass', 1700, 0.9, 0.07, 0.75); tone('sine', 420, 300, 0.03, 0.06, 0.3); break;
    case 'shaker': noise('highpass', 5200, 0.9, 0.11, 0.2); break;
    case 'cowbell': {
      const bp = ctx.createBiquadFilter(), cg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2.5;
      env(cg.gain, t, [[0, 0.5 * vel], [0.28, 0.0001, 'exp']]);
      oscAt('square', 540, t, 0.3).connect(bp); oscAt('square', 808, t, 0.3).connect(bp);
      bp.connect(cg); cg.connect(g); break;
    }
    case 'tick': tone('triangle', 1500, 1480, 0.01, 0.04, 0.5); break;
  }
}

// A pluck, strum or drum hit described so it can be replayed later by a loop layer.
function playEvent(ev, t, dest, o) {
  if (!audio.ctx) return [];
  if (ev.drum) { playDrum(ev.drum, t, ev.vel, dest); return []; }
  const notes = ev.down ? ev.notes.slice().reverse() : ev.notes;
  const opts = o || (ev.hold ? { holdSec: ev.hold } : null);
  return notes.map((m, i) => playNote(ev.inst, m, t + i * 0.022, ev.vel * (notes.length > 1 ? 0.8 : 1), dest, 1, opts)).filter(Boolean);
}

// ───────────────────────── beats, transport and loop layers ─────────────────────────
// Patterns are 16 steps to a bar. x = hit, X = accent, o = open hat. Several bars alternate.
// Bass: 0 root, 3 third, 5 fifth, 8 octave. Chords change once a bar.
const BEATS = {
  boombap: { name: 'Boom bap', bpm: 88, swing: 0.16, labels: ['Kick', 'Snare', 'Hats', 'Bass', 'Chords'],
    kick: ['X-----x---x-----', 'X-----x--x-x----'], snare: ['----X-------X---'], hats: ['x-x-x-x-x-x-x-x-'],
    bass: ['0-----0---0-----', '0-----0--0-5----'], chords: ['x--x------x-----'], chordInst: 'piano', bassInst: 'bass', chordLen: 0.6 },
  house: { name: 'House', bpm: 122, swing: 0, labels: ['Kick', 'Clap', 'Hats', 'Bass', 'Chords'],
    kick: ['X---X---X---X---'], snare: ['----X-------X---'], hats: ['--o---o---o---o-', '--o---o---o--xo-'],
    bass: ['--0--0-0--0--0-8'], chords: ['x--x--x---x--x--'], chordInst: 'keys', bassInst: 'bass', chordLen: 0.35, snareAs: 'clap' },
  lofi: { name: 'Lo-fi', bpm: 76, swing: 0.22, labels: ['Kick', 'Snare', 'Hats', 'Bass', 'Chords'],
    kick: ['X-----x-x-------', 'X-----x---x--x--'], snare: ['----x-------x---'], hats: ['x-x-x-x-x-x-x-x-'],
    bass: ['0-------0--5----', '0-------0-----3-'], chords: ['x-------x-------'], chordInst: 'keys', bassInst: 'bass', chordLen: 1.4, seventh: true },
  trap: { name: 'Trap', bpm: 140, swing: 0, labels: ['Kick', 'Snare', 'Hats', '808', 'Chords'],
    kick: ['X------x--x-----', 'X-----x---x--x--'], snare: ['--------X-------'], hats: ['x-x-x-x-xxx-x-xx', 'x-x-xxx-x-x-xxxx'],
    bass: ['0------0--0-----', '0-----0---0--5--'], chords: ['x---------------'], chordInst: 'bells', bassInst: 'sub', chordLen: 1 },
  dembow: { name: 'Dembow', bpm: 96, swing: 0, labels: ['Kick', 'Snare', 'Hats', 'Bass', 'Chords'],
    kick: ['X---X---X---X---'], snare: ['---x--x----x--x-'], hats: ['x-x-x-x-x-x-x-x-'],
    bass: ['0-----0-0-----5-'], chords: ['x-----x---x-----'], chordInst: 'guitar', bassInst: 'bass', chordLen: 1 },
  maqsum: { name: 'Maqsum', bpm: 100, swing: 0, labels: ['Dum', 'Tak', 'Riq', 'Bass', 'Oud'],
    kick: ['X-------X-------'], snare: ['--X---X-----X---', '--X---X-----X-x-'], hats: ['x-xxx-xxx-xxx-xx'],
    bass: ['0-------0-----5-'], chords: ['x-------------x-'], chordInst: 'oud', bassInst: 'bass', chordLen: 1,
    kickAs: 'dum', snareAs: 'tak', hatAs: 'riq' },
};
const BEAT_ORDER = ['boombap', 'house', 'lofi', 'trap', 'dembow', 'maqsum'];
const PARTS = ['kick', 'snare', 'hats', 'bass', 'chords'];
// four-bar chord progressions, as scale degrees of the song's parent scale
const PROGS = { major: [0, 4, 5, 3], minor: [0, 5, 2, 6], dorian: [0, 3, 0, 6], hijaz: [0, 1, 0, 6] };

const transport = {
  playing: false, beat: 'boombap', bpm: 88,
  parts: { kick: false, snare: false, hats: false, bass: false, chords: false },
  step: 0, stepTime: 0, lastStep: -1, lastStepTime: 0, timer: null,
  loopBars: 2, layers: [], rec: null, nextLayerId: 1, follow: false,
};
const stepDur = () => 60 / transport.bpm / 4;

function scaleDegree(parent, root, oct, d) {
  const steps = SCALES[parent].steps;
  return 12 * (oct + 1) + root + 12 * Math.floor(d / steps.length) + steps[((d % steps.length) + steps.length) % steps.length];
}

// Live playback passes no options. Stem rendering passes { parts, layers, dest } to play a chosen
// subset into a chosen output, with no side effects on the transport.
function scheduleStep(step, t, o) {
  const live = !o;
  const B = BEATS[transport.beat], P = o ? o.parts : transport.parts;
  const bar = Math.floor(step / 16), s = step % 16;
  const pick = arr => arr[bar % arr.length][s];
  if (s % 2 === 1) t += B.swing * stepDur();

  if (P.kick) { const c = pick(B.kick); if (c !== '-') playDrum(B.kickAs || 'kick', t, c === 'X' ? 1 : 0.75, audio.beat); }
  if (P.snare) { const c = pick(B.snare); if (c !== '-') playDrum(B.snareAs || 'snare', t, c === 'X' ? 0.95 : 0.7, audio.beat); }
  if (P.hats) {
    const c = pick(B.hats);
    if (c !== '-') playDrum(c === 'o' ? 'ohat' : (B.hatAs || 'hat'), t, s % 4 === 0 ? 0.8 : 0.5, audio.beat);
  }
  const parent = SCALES[state.scale].parent;
  const deg = PROGS[parent][bar % 4];
  if (P.bass) {
    const c = pick(B.bass);
    if (c !== '-') {
      const add = { 0: 0, 3: 2, 5: 4, 8: 7 }[c] || 0;
      let m = scaleDegree(parent, state.key, 1, deg + add);
      while (m > 52) m -= 12;
      playNote(B.bassInst, m, t, 0.85, audio.beat, 1);
    }
  }
  if (P.chords) {
    const c = pick(B.chords);
    if (c !== '-') {
      const tones = B.seventh ? [0, 2, 4, 6] : [0, 2, 4];
      tones.forEach((k, i) => {
        let m = scaleDegree(parent, state.key, 3, deg + k);
        while (m > 76) m -= 12;
        playNote(B.chordInst, m, t + i * 0.012, 0.42, audio.beat, B.chordLen);
      });
    }
  }

  // loop layers
  for (const L of (o ? o.layers : transport.layers)) {
    if (live && L.muted) continue;
    const p = (((step - L.offset) % L.len) + L.len) % L.len;
    const evs = L.buckets[p];
    if (evs) for (const ev of evs) playEvent(ev, t + (ev.pos - p) * stepDur(), o ? o.dest(L) : layerOut(L));
  }
  if (!live) return;

  // layer being recorded: count-in ticks, then start and finish on bar lines
  const R = transport.rec;
  if (R) {
    if (step >= R.start - 16 && step < R.start && s % 4 === 0) playDrum('tick', t, s === 0 ? 0.9 : 0.55, audio.beat);
    if (step === R.start) { R.state = 'rec'; transport.dirty = true; }
    if (step === R.start + R.len) finishLayer();
  }
  transport.lastStep = step; transport.lastStepTime = t - (s % 2 === 1 ? B.swing * stepDur() : 0);
}

function tick() {
  if (!transport.playing) return;
  const ctx = audio.ctx;
  while (transport.stepTime < ctx.currentTime + 0.12) {
    scheduleStep(transport.step, transport.stepTime);
    transport.step++;
    transport.stepTime += stepDur();
  }
}

function startTransport() {
  initAudio();
  if (transport.playing) return;
  transport.playing = true;
  transport.step = 0;
  transport.stepTime = audio.ctx.currentTime + 0.08;
  transport.lastStep = -1; transport.lastStepTime = transport.stepTime - stepDur();
  transport.timer = setInterval(tick, 25);
  tick();
  refreshUI();
}
function stopTransport() {
  transport.playing = false;
  clearInterval(transport.timer);
  if (transport.rec) { transport.rec = null; toast('Layer recording cancelled'); }
  refreshUI();
}
function togglePlay() {
  if (transport.playing) { stopTransport(); return; }
  if (!PARTS.some(p => transport.parts[p]) && !transport.layers.length) transport.parts.kick = true;
  startTransport();
}
function setBeat(id) {
  transport.beat = id;
  transport.bpm = BEATS[id].bpm;
  refreshUI();
}
// position in steps (fractional) of an audio-clock time
function stepAt(time) {
  return transport.lastStep + (time - transport.lastStepTime) / stepDur();
}

// ── loop layers: play a phrase once, and it keeps going round ──
function armLayer() {
  initAudio();
  if (transport.rec) { transport.rec = null; refreshUI(); toast('Layer recording cancelled'); return; }
  if (transport.layers.length >= MAX_LAYERS) { toast('That is the most layers this holds. Remove one first.'); return; }
  if (!state.strings.length) { toast('Stretch a string first, then record a layer with it.'); return; }
  const wasPlaying = transport.playing;
  if (!wasPlaying) startTransport();
  // start on a bar line, with at least two beats of count-in before it
  const cur = wasPlaying ? Math.max(transport.step, 0) : 0;
  let start = Math.ceil(cur / 16) * 16;
  if (start - cur < 8) start += 16;
  transport.rec = { state: 'countin', start, len: transport.loopBars * 16, events: [] };
  refreshUI();
}
function captureEvent(ev) {
  const R = transport.rec;
  if (!R || !audio.ctx) return;
  let pos = stepAt(audio.ctx.currentTime) - R.start;
  if (pos < 0) { if (pos > -1.5) pos = 0; else return; }   // a touch early still counts as the downbeat
  if (pos >= R.len) return;
  if (state.settings.quantize) pos = Math.round(pos) % R.len;
  const kept = Object.assign({}, ev, { pos });
  R.events.push(kept);
  return kept;
}
function makeLayer(d) {       // d: { len, offset, events, vol, muted, id? }
  const buckets = {};
  for (const ev of d.events) (buckets[Math.floor(ev.pos)] = buckets[Math.floor(ev.pos)] || []).push(ev);
  const insts = [...new Set(d.events.map(e => e.inst))].filter(i => own(INSTRUMENTS, i));
  return { id: transport.nextLayerId++, len: d.len, offset: d.offset || 0, events: d.events, buckets, count: d.events.length,
    muted: !!d.muted, vol: d.vol == null ? 1 : d.vol, inst: insts[0] || 'guitar', name: insts.map(i => INSTRUMENTS[i].name).join(' + ') };
}
// each layer plays through its own volume control
function layerOut(L) {
  if (!L._g || L._g.context !== audio.ctx) {
    L._g = audio.ctx.createGain();
    L._g.connect(audio.layers);
  }
  L._g.gain.value = L.vol;
  return L._g;
}
function finishLayer() {
  const R = transport.rec;
  transport.rec = null;
  if (!R.events.length) { toast('Nothing was played, so no layer was added.'); refreshUI(); return; }
  transport.layers.push(makeLayer({ len: R.len, offset: R.start % R.len, events: R.events }));
  toast('Layer added. It keeps looping while you play over it.');
  refreshUI();
}
function removeLayer(id) {
  const L = transport.layers.find(l => l.id === id);
  if (L && L._g) { const g = L._g; g.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.03); setTimeout(() => g.disconnect(), 3000); }
  transport.layers = transport.layers.filter(l => l.id !== id);
  refreshUI();
}
function undoLayer() {
  if (transport.rec) { transport.rec = null; toast('Layer recording cancelled'); refreshUI(); return; }
  const L = transport.layers[transport.layers.length - 1];
  if (L) { removeLayer(L.id); toast('Removed the last layer.'); }
}

// ── follow the chords: strings retune to the chord the beat is on ──
function chordDegNow() {
  if (!transport.follow || !transport.playing || !audio.ctx) return null;
  const bar = Math.floor(Math.max(stepAt(audio.ctx.currentTime) + 0.6, 0) / 16);     // a touch early counts as the next bar
  return PROGS[SCALES[state.scale].parent][bar % 4];
}
function chordLabel(deg) {
  const parent = SCALES[state.scale].parent;
  const n = [0, 2, 4].map(k => scaleDegree(parent, state.key, 3, deg + k));
  const third = n[1] - n[0], fifth = n[2] - n[0];
  return spell(n[0], state.key, parent) + (fifth === 6 ? '°' : third === 3 ? 'm' : fifth === 8 ? '+' : '');
}

// ───────────────────────── strings: creation, notes, plucking, the dot menu ─────────────────────────
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
const TRACKER = Object.assign({
  bundle: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  model: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
}, window.__SM_PATHS || {});

const cam = { video: null, tracker: null, lastVT: -1, delegate: '', frames: 0, fpsT: 0, trackFps: 0 };
const modalOpen = () => !!document.querySelector('.modal.open');

async function loadTracker() {
  const vision = await import(TRACKER.bundle);
  const files = await vision.FilesetResolver.forVisionTasks(TRACKER.wasm);
  const make = delegate => vision.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: TRACKER.model, delegate },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  if (TRACKER.delegate === 'CPU') { cam.tracker = await make('CPU'); cam.delegate = 'CPU'; return; }
  try { cam.tracker = await make('GPU'); cam.delegate = 'GPU'; }
  catch (e) { cam.tracker = await make('CPU'); cam.delegate = 'CPU'; }
}

async function startCamera(setStatus) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot open a camera from here.');
  setStatus('Waiting for camera permission…');
  const stream = cam.stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false,
  });
  const v = cam.video = $('#cam');
  try {
    v.srcObject = stream;
    await v.play();
    setStatus('Loading the hand tracker…');
    await loadTracker();
    state.mode = 'camera';
  } catch (error) {
    try { cam.tracker?.close?.(); } catch (_) {}
    cam.tracker = null;
    try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
    try { v.pause(); v.srcObject = null; } catch (_) {}
    cam.stream = null;
    throw error;
  }
}

// camera frame → mirrored canvas coordinates, matching how the picture is drawn ("cover" fit)
function videoFit() {
  const v = cam.video, vw = v.videoWidth || W, vh = v.videoHeight || H;
  const sc = Math.max(W / vw, H / vh);
  return { vw, vh, sc, ox: (W - vw * sc) / 2, oy: (H - vh * sc) / 2 };
}
function readHands(t) {
  const v = cam.video;
  if (!cam.tracker || !v || v.readyState < 2 || v.currentTime === cam.lastVT) return null;
  cam.lastVT = v.currentTime;
  const res = cam.tracker.detectForVideo(v, performance.now());
  const f = videoFit();
  cam.frames++;
  if (t - cam.fpsT > 1) { cam.trackFps = Math.round(cam.frames / (t - cam.fpsT)); cam.frames = 0; cam.fpsT = t; }
  return (res.landmarks || []).map(lm => lm.map(p => ({ x: W - (p.x * f.vw * f.sc + f.ox), y: p.y * f.vh * f.sc + f.oy })));
}

function newHand() {
  return { lm: null, raw0: null, present: true, seen: 0, pinch: false, pc: 0, ratio: 1, cursor: { x: 0, y: 0 },
    prev: {}, intent: null, pinchT: 0, pinchStart: null, drag: null, dot: null, lastRelease: -9, press: false, hoverEl: null };
}

// dets: up to two hands, each 21 points in canvas space
function processHands(dets, t) {
  const slots = state.hands;
  const D = [];
  for (const d of dets) {   // the tracker sometimes reports one hand twice
    if (!D.some(e => dist(e[0], d[0]) < 70 && dist(e[8], d[8]) < 70)) D.push(d);
  }
  D.length = Math.min(D.length, 2);
  const taken = [false, false], assign = [null, null], dUsed = [];
  const pairs = [];
  D.forEach((d, i) => slots.forEach((h, j) => { if (h && h.present) pairs.push({ i, j, dd: dist(d[0], h.raw0) }); }));
  pairs.sort((a, b) => a.dd - b.dd);
  for (const p of pairs) {
    if (dUsed[p.i] || taken[p.j] || p.dd > 340) continue;
    assign[p.j] = D[p.i]; taken[p.j] = true; dUsed[p.i] = true;
  }
  D.forEach((d, i) => {
    if (dUsed[i]) return;
    const j = !taken[0] ? 0 : !taken[1] ? 1 : -1;
    if (j < 0) return;
    if (slots[j] && slots[j].present) dropHand(j);
    slots[j] = newHand();
    assign[j] = d; taken[j] = true;
  });
  for (let j = 0; j < 2; j++) {
    if (assign[j]) updateHand(j, assign[j], t);
    else if (slots[j] && slots[j].present && t - slots[j].seen > 0.25) dropHand(j);
  }

  // both hands pinching in open air: a string is being stretched
  const [a, b] = slots;
  // (a hand that has only just pinched a string, or started the air pad, still counts as free)
  const free = h => h && h.present && h.pinch && (h.intent === 'free' || h.intent === 'create' || h.intent === 'fx'
    || (h.intent === 'grab' && t - h.pinchT < 0.6 && (!h.grab.s.pull || Math.abs(h.grab.s.pull.d) < 14)));
  if (free(a) && free(b) && !state.menu && !modalOpen()) {
    for (const h of [a, b]) {
      if (h.intent === 'grab') { h.grab.s.pull = null; bendString(h.grab.s, 0); }
      if (h.intent === 'fx') endFx();
      h.intent = 'create';
    }
    state.preview = { a: { ...a.cursor }, b: { ...b.cursor } };
  }
  slots.forEach((h, j) => {
    if (!h || !h.present || !h.pinch) return;
    if (h.intent === 'drag') { h.drag.s[h.drag.end] = { ...h.cursor }; h.drag.s.touched = t; }
    if (h.intent === 'grab') pullString(h.grab, h.cursor);
    // one hand pinching and dragging through open air: the air pad
    const o = slots[1 - j];
    if (h.intent === 'free' && !(o && o.present && o.pinch) && dist(h.cursor, h.pinchStart) > 45 && !buttonAt(h.pinchStart) && !modalOpen()) h.intent = 'fx';
    if (h.intent === 'fx') moveFx(h.pinchStart, h.cursor);
  });
}

// The air pad: down darkens the whole mix, up thins it, sideways adds echo. Letting go clears it.
function moveFx(from, to) {
  const dy = to.y - from.y, dx = Math.abs(to.x - from.x);
  const dark = clamp((dy - 20) / 240, 0, 1), thin = clamp((-dy - 20) / 240, 0, 1), echo = clamp((dx - 30) / 260, 0, 1);
  state.fx = { from: { ...from }, to: { ...to }, dark, thin, echo };
  setFx(dark, thin, echo);
}
function endFx() {
  if (!state.fx) return;
  state.fx = null;
  setFx(0, 0, 0);
}

function updateHand(j, d, t) {
  const h = state.hands[j];
  const dt = h.seen ? t - h.seen : 0.033;
  h.raw0 = d[0];
  if (!h.lm) h.lm = d.map(p => ({ ...p }));
  else for (let k = 0; k < 21; k++) {
    const a = clamp(dist(d[k], h.lm[k]) / 14, 0.4, 1);
    h.lm[k].x += a * (d[k].x - h.lm[k].x);
    h.lm[k].y += a * (d[k].y - h.lm[k].y);
  }
  h.seen = t; h.present = true;
  const lm = h.lm;
  const size = Math.max(dist(lm[0], lm[9]), dist(lm[5], lm[17]) * 1.25, 1);
  h.ratio = dist(lm[4], lm[8]) / size;
  h.cursor = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
  const sens = state.settings.pinchSens, down = 0.3 * sens, up = 0.46 * sens;
  if (!h.pinch) {
    if (h.ratio < down) { if (++h.pc >= 2) { h.pinch = true; h.pc = 0; pinchDown(h, t); } } else h.pc = 0;
  } else {
    if (h.ratio > up) { if (++h.pc >= 2) { h.pinch = false; h.pc = 0; pinchUp(j, t); } } else h.pc = 0;
  }
  // plucking with open fingers (paused while a pinch is closing or has just opened)
  h.plucking = !h.pinch && t - h.lastRelease > 0.25 && h.ratio > 0.34 * sens && !modalOpen();
  if (h.plucking) {
    const tips = state.settings.allFingers ? [8, 12, 16, 20] : [8];
    for (const k of tips) sweep(`h${j}-${k}`, lm[k], t);
  }
}

function pinchDown(h, t) {
  h.pinchT = t; h.pinchStart = { ...h.cursor }; h.press = true;
  forgetPointer('h' + state.hands.indexOf(h) + '-');
  if (state.menu) { h.intent = 'menu'; return; }
  if (modalOpen()) { h.intent = 'tap'; return; }
  const ep = nearestEndpoint(h.cursor, 36);
  if (ep) { h.intent = 'drag'; h.drag = ep; return; }
  const dot = nearestDot(h.cursor, 34);
  if (dot) { h.intent = 'dot'; h.dot = dot; return; }
  const body = nearestBody(h.cursor, 16);
  if (body) { h.intent = 'grab'; h.grab = body; return; }
  h.intent = 'free';
}
function pinchUp(j, t) {
  const h = state.hands[j], other = state.hands[1 - j];
  const still = h.pinchStart && dist(h.cursor, h.pinchStart) < 60;
  if (h.intent === 'create') {
    const pv = state.preview;
    state.preview = null;
    if (other) other.intent = 'used';
    if (pv && dist(pv.a, pv.b) >= 90) addString(pv.a, pv.b);
    else if (pv) toast('Pull your hands further apart to make a string.');
  } else if (h.intent === 'drag') {
    const s = h.drag.s;
    orient(s);
    if (strLen(s) < 60) removeString(s);
  } else if (h.intent === 'dot') {
    if (still && state.strings.includes(h.dot)) openMenu(h.dot, 'hub');
  } else if (h.intent === 'grab') {
    releasePull(h.grab);
  } else if (h.intent === 'fx') {
    endFx();
  } else if (h.intent === 'free' || h.intent === 'tap') {
    if (still && t - h.pinchT < 1) handClick(h.pinchStart);
  }
  h.intent = null; h.lastRelease = t;
}
function dropHand(j) {
  const h = state.hands[j];
  if (!h) return;
  if (h.intent === 'create') {
    state.preview = null;
    const o = state.hands[1 - j];
    if (o && o.intent === 'create') o.intent = 'used';
  }
  if (h.intent === 'drag') orient(h.drag.s);
  if (h.intent === 'grab') { h.grab.s.pull = null; bendString(h.grab.s, 0); }
  if (h.intent === 'fx') endFx();
  setHover(h, null);
  h.present = false; h.pinch = false; h.intent = null; h.plucking = false;
  forgetPointer('h' + j + '-');
}

// ── hands on the on-screen buttons ──
function toClient(p) {
  const r = $('#stage').getBoundingClientRect();
  return { x: r.left + p.x * r.width / W, y: r.top + p.y * r.height / H };
}
function buttonAt(p) {
  const c = toClient(p);
  const el = document.elementFromPoint(c.x, c.y);
  const b = el && el.closest && el.closest('button');
  return b && !b.disabled ? b : null;
}
function setHover(h, el) {
  if (h.hoverEl === el) return;
  if (h.hoverEl) h.hoverEl.classList.remove('hand-hover');
  h.hoverEl = el;
  if (el) el.classList.add('hand-hover');
}
function handClick(p) {
  const b = buttonAt(p);
  if (!b) return;
  state.counts.clicks++;
  state.ripples.push({ x: p.x, y: p.y, t: nowS() });
  b.click();
}
function updateHandHover() {
  for (const h of state.hands) if (h) setHover(h, h.present ? buttonAt(h.cursor) : null);
}

// ── mouse / touch: the same instrument without a camera ──
function initPointer() {
  const cv = $('#stage'), m = state.mouse;
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  cv.addEventListener('pointerdown', e => {
    initAudio();
    const p = pos(e);
    m.x = m.px = p.x; m.y = m.py = p.y; m.inside = true; m.down = true; m.press = true;
    forgetPointer('mouse');
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (state.menu) {
      if (!menuContains(p, 50)) closeMenu();
      m.drag = null; return;
    }
    const ep = nearestEndpoint(p, 16);
    if (ep) { m.drag = { type: 'end', ep }; return; }
    const dot = nearestDot(p, 15);
    if (dot) { m.drag = { type: 'dot', s: dot, from: p }; return; }
    if (e.shiftKey) { m.drag = { type: 'fx', from: p }; return; }       // Shift-drag: the air pad
    const body = nearestBody(p, 7);
    if (body) { m.drag = { type: 'grab', g: body }; return; }
    m.drag = { type: 'new', from: p };
  });
  cv.addEventListener('pointermove', e => {
    const p = pos(e), t = nowS();
    m.inside = true;
    if (m.down && m.drag) {
      if (m.drag.type === 'new' && dist(p, m.drag.from) > 12) state.preview = { a: m.drag.from, b: p };
      if (m.drag.type === 'end') { m.drag.ep.s[m.drag.ep.end] = { ...p }; m.drag.ep.s.touched = t; }
      if (m.drag.type === 'grab') pullString(m.drag.g, p);
      if (m.drag.type === 'fx') moveFx(m.drag.from, p);
    }
    m.x = p.x; m.y = p.y; m.t = t;
  });
  const up = e => {
    if (!m.down) return;
    m.down = false;
    const p = pos(e), d = m.drag;
    m.drag = null;
    if (!d) return;
    if (d.type === 'new') {
      const pv = state.preview; state.preview = null;
      if (pv && dist(pv.a, pv.b) >= 60) addString(pv.a, pv.b);
    } else if (d.type === 'end') {
      orient(d.ep.s);
      if (strLen(d.ep.s) < 40) removeString(d.ep.s);
    } else if (d.type === 'grab') releasePull(d.g);
    else if (d.type === 'fx') endFx();
    else if (d.type === 'dot' && dist(p, d.from) < 10) openMenu(d.s, 'hub');
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!m.down) { m.inside = false; m.x = -1; forgetPointer('mouse'); } });
}

// everything that can point at the dot menu this frame
function gatherPointers() {
  const P = [];
  for (const h of state.hands) {
    if (!h || !h.present || !h.lm) continue;
    P.push({ x: h.lm[8].x, y: h.lm[8].y, press: h.press });
    // the pinch pointer only counts while the fingers are closing, so an open hand points with one fingertip
    if (h.pinch || h.press) P.push({ x: h.cursor.x, y: h.cursor.y, press: h.press });
  }
  const m = state.mouse;
  if (m.inside && m.x >= 0) P.push({ x: m.x, y: m.y, press: !!m.press });
  return P;
}

// ───────────────────────── instrument icons (drawn in code, 24 × 24 grid) ─────────────────────────
// k.S strokes a path, k.F fills one, k.C is a ring, k.D a dot, k.B a solid body of circles, k.cut carves detail out.
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
const rec = { on: false, mode: 'video', mr: null, chunks: [], mime: '', ext: 'webm', t0: 0, pcm: [], frames: 0, tap: null, tapReady: null,
  videoBlob: null, wavBlob: null, mp3Blob: null, url: null, audioUrl: null, maxSec: 600, timer: null };

const TAP_SRC = `
class PcmTap extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.l = new Float32Array(4096); this.r = new Float32Array(4096); this.n = 0;
    this.port.onmessage = e => { this.on = e.data.on; if (!this.on) this.flush(); }; }
  flush() { if (this.n) { this.port.postMessage({ l: this.l.slice(0, this.n), r: this.r.slice(0, this.n) }); this.n = 0; } }
  process(inputs) {
    if (this.on) { const i = inputs[0]; if (i && i[0]) { const L = i[0], R = i[1] || i[0];
      if (this.n + L.length > 4096) this.flush();
      this.l.set(L, this.n); this.r.set(R, this.n); this.n += L.length; } }
    return true; }
}
registerProcessor('pcm-tap', PcmTap);`;

function pushPcm(l, r) {
  const out = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) {
    out[i * 2] = Math.max(-1, Math.min(1, l[i])) * 32767;
    out[i * 2 + 1] = Math.max(-1, Math.min(1, r[i])) * 32767;
  }
  rec.pcm.push(out); rec.frames += l.length;
}
// A tap on the final mix so the sound can also be saved as an uncompressed WAV.
function ensureTap() {
  if (rec.tapReady) return rec.tapReady;
  const ctx = audio.ctx;
  const mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);
  rec.tapReady = (async () => {
    try {
      const url = URL.createObjectURL(new Blob([TAP_SRC], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, 'pcm-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
      node.port.onmessage = e => { if (rec.on || rec.flushing) pushPcm(e.data.l, e.data.r); };
      audio.out.connect(node); node.connect(mute);
      rec.tap = { set: on => node.port.postMessage({ on }) };
    } catch (err) {
      const node = ctx.createScriptProcessor(4096, 2, 1);
      let on = false;
      node.onaudioprocess = e => { if (on) pushPcm(e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(1)); };
      audio.out.connect(node); node.connect(mute);
      rec.tap = { set: v => { on = v; } };
    }
  })();
  return rec.tapReady;
}

function pickMime() {
  const c = ['video/mp4;codecs="avc1.64001F,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01F,mp4a.40.2"', 'video/mp4;codecs="avc1,mp4a.40.2"',
    'video/webm;codecs="vp9,opus"', 'video/webm;codecs="vp8,opus"', 'video/webm'];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// rec.mode: 'video' films the mirror with its sound; 'audio' captures the sound alone.
// Either way the sound is also kept uncompressed, so it can be saved as MP3 or WAV afterwards.
async function startRecording() {
  initAudio();
  if (rec.on) return;
  await ensureTap();
  rec.chunks = []; rec.pcm = []; rec.frames = 0; rec.mr = null; rec.mp3Blob = null; rec.videoBlob = null;
  rec.video = rec.mode === 'video';
  if (rec.video && !window.MediaRecorder) { rec.video = false; toast('This browser cannot record video, so only the sound is being recorded.'); }
  if (rec.video) {
    rec.mime = pickMime();
    rec.ext = rec.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const stream = $('#stage').captureStream(30);
    audio.recDest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
    const mr = rec.mr = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 6e6, audioBitsPerSecond: 192000 }, rec.mime ? { mimeType: rec.mime } : {}));
    mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    mr.onstop = finishRecording;
    mr.start(1000);
  }
  rec.tap.set(true);
  rec.on = true; rec.t0 = nowS();
  rec.timer = setInterval(() => {
    const s = Math.floor(nowS() - rec.t0);
    $('#recTime').textContent = $('#filmTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= rec.maxSec) { toast('Ten minutes reached, so the recording was stopped.'); stopRecording(); }
  }, 250);
  refreshUI();
}
function stopRecording() {
  if (!rec.on) return;
  rec.on = false; rec.flushing = true;
  clearInterval(rec.timer);
  rec.tap.set(false);
  rec.dur = nowS() - rec.t0;
  if (rec.mr) { try { rec.mr.stop(); } catch (_) { finishRecording(); } } else finishRecording();
  if (film.on) leaveClean();
  refreshUI();
}
function wavBlob() {
  const sr = audio.ctx.sampleRate, n = rec.frames, bytes = n * 4;
  const buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, bytes, true);
  const out = new Int16Array(buf, 44);
  let o = 0;
  for (const c of rec.pcm) { out.set(c, o); o += c.length; }
  return new Blob([buf], { type: 'audio/wav' });
}
// If the live sound tap gave nothing, recover the sound from the recorded video file instead.
async function pcmFromVideo() {
  const buf = await audio.ctx.decodeAudioData(await rec.videoBlob.arrayBuffer());
  rec.pcm = []; rec.frames = 0;
  pushPcm(buf.getChannelData(0), buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0));
}
// MP3 is encoded in the page, in slices so the window stays responsive.
async function mp3Blob(onProgress) {
  if (rec.mp3Blob) return rec.mp3Blob;
  const sr = audio.ctx.sampleRate, n = rec.frames;
  const L = new Int16Array(n), R = new Int16Array(n);
  let o = 0;
  for (const c of rec.pcm) { for (let i = 0; i < c.length; i += 2) { L[o] = c[i]; R[o] = c[i + 1]; o++; } }
  const enc = new lamejs.Mp3Encoder(2, sr, 192), parts = [], BLOCK = 1152 * 24;
  let last = performance.now();
  for (let i = 0; i < n; i += BLOCK) {
    const out = enc.encodeBuffer(L.subarray(i, i + BLOCK), R.subarray(i, i + BLOCK));
    if (out.length) parts.push(out);
    if (performance.now() - last > 40) { onProgress(i / n); await new Promise(r => setTimeout(r, 0)); last = performance.now(); }
  }
  const end = enc.flush();
  if (end.length) parts.push(end);
  return (rec.mp3Blob = new Blob(parts, { type: 'audio/mpeg' }));
}
const mp3Possible = () => typeof lamejs !== 'undefined' && [32000, 44100, 48000].includes(audio.ctx.sampleRate);

function finishRecording() {
  setTimeout(async () => {          // let the last audio block arrive
    rec.flushing = false;
    rec.videoBlob = rec.video ? new Blob(rec.chunks, { type: rec.mime || 'video/webm' }) : null;
    if (!rec.frames && rec.videoBlob) { try { await pcmFromVideo(); } catch (_) {} }
    rec.wavBlob = rec.frames ? wavBlob() : null;
    for (const k of ['url', 'audioUrl']) if (rec[k]) { URL.revokeObjectURL(rec[k]); rec[k] = null; }
    const d = new Date(), z = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
    rec.name = `string-mirror-${stamp}`;
    const mb = b => (b.size / 1048576).toFixed(1) + ' MB';
    const v = $('#takeVideo'), a = $('#takeAudio');
    v.classList.toggle('hide', !rec.videoBlob); a.classList.toggle('hide', !!rec.videoBlob || !rec.wavBlob);
    $('#saveVideo').classList.toggle('hide', !rec.videoBlob);
    if (rec.videoBlob) { v.src = rec.url = URL.createObjectURL(rec.videoBlob); $('#saveVideo').textContent = `Save video (.${rec.ext}, ${mb(rec.videoBlob)})`; }
    else if (rec.wavBlob) a.src = rec.audioUrl = URL.createObjectURL(rec.wavBlob);
    $('#saveMp3').textContent = 'Save audio (.mp3)';
    $('#saveMp3').disabled = !rec.wavBlob || !mp3Possible();
    $('#saveWav').textContent = rec.wavBlob ? `Save audio (.wav, ${mb(rec.wavBlob)})` : 'Save audio (.wav)';
    $('#saveWav').disabled = !rec.wavBlob;
    $('#saveMp3').classList.toggle('primary', !rec.videoBlob);
    $('#takeTitle').textContent = rec.videoBlob ? 'Your recording' : 'Your sound recording';
    $('#takeNote').textContent = !rec.wavBlob ? 'No sound was captured in this take, so there is no audio file to save.'
      : rec.videoBlob && rec.ext !== 'mp4' ? 'This browser records video as WebM. The audio files work everywhere.' : '';
    openModal('saveModal');
  }, 250);
}
async function saveMp3() {
  const b = $('#saveMp3');
  if (b.disabled || !rec.wavBlob) return;
  b.disabled = true;
  try {
    const blob = await mp3Blob(k => { b.textContent = `Making MP3… ${Math.round(k * 100)}%`; });
    b.textContent = `Save audio (.mp3, ${(blob.size / 1048576).toFixed(1)} MB)`;
    download(blob, `${rec.name}.mp3`);
  } catch (err) {
    console.error(err);
    b.textContent = 'MP3 failed. Use the WAV instead';
    return;
  }
  b.disabled = false;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ───────────────────────── filming: clean view, countdown, record ─────────────────────────
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

async function renderOffline(bars, o) {
  const sr = audio.ctx.sampleRate, sd = stepDur();
  const off = new OfflineAudioContext(2, Math.ceil((bars * 16 * sd + 2) * sr), sr);
  const G = buildGraph(off, { offline: true, plain: !o.mix });
  const live = {};
  for (const k in G) live[k] = audio[k];
  if (o.mix) { G.music.gain.value = live.music.gain.value; G.beat.gain.value = live.beat.gain.value; G.layers.gain.value = live.layers.gain.value; }
  Object.assign(audio, G);                  // the engine now builds its notes on the offline graph…
  try {
    const gains = new Map();
    const dest = L => {
      if (!gains.has(L)) { const g = off.createGain(); g.gain.value = o.mix ? L.vol : 1; g.connect(G.layers); gains.set(L, g); }
      return gains.get(L);
    };
    for (let step = 0; step < bars * 16; step++) scheduleStep(step, 0.02 + step * sd, { parts: o.parts, layers: o.layers, dest });
  } finally { Object.assign(audio, live); }  // …and is handed back before anything else can run
  return off.startRendering();
}

function wavBytes(buf) {
  const n = buf.length, ch = Math.min(buf.numberOfChannels, 2), L = buf.getChannelData(0), R = buf.getChannelData(ch > 1 ? 1 : 0);
  const out = new ArrayBuffer(44 + n * 4), v = new DataView(out);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 4, true);
  const pcm = new Int16Array(out, 44);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    pcm[i * 2] = l * 32767; pcm[i * 2 + 1] = r * 32767;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  return { bytes: new Uint8Array(out), peak };
}

// A plain (uncompressed) zip, so the stems arrive as one download.
let CRC_TABLE = null;
function crc32(u8) {
  if (!CRC_TABLE) { CRC_TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipBlob(files) {            // files: [{ name, bytes }]
  const enc = new TextEncoder(), parts = [], central = [], now = new Date();
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), dosTime = (now.getHours() << 11) | (now.getMinutes() << 5);
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.bytes), n = f.bytes.length;
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, 0, true);
    head.setUint16(10, dosTime, true); head.setUint16(12, dosDate, true);
    head.setUint32(14, crc, true); head.setUint32(18, n, true); head.setUint32(22, n, true); head.setUint16(26, name.length, true);
    parts.push(head.buffer, name, f.bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true);
    c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + n;
  }
  const size = central.reduce((a, b) => a + (b.byteLength || b.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

async function exportStems(onStatus) {
  initAudio();
  const B = BEATS[transport.beat];
  const on = PARTS.filter(p => transport.parts[p]), layers = transport.layers.slice();
  if (!on.length && !layers.length) { toast('Switch on a beat part or record a layer first. Stems are made from those.'); return null; }
  const bars = Math.max(4, ...layers.map(L => L.len / 16));
  const none = Object.fromEntries(PARTS.map(p => [p, false]));
  const safe = s => s.replace(/[^\w +-]+/g, '').trim();
  const jobs = [];
  on.forEach(p => jobs.push({ name: `Beat - ${safe(B.labels[PARTS.indexOf(p)])}`, o: { parts: Object.assign({}, none, { [p]: true }), layers: [] } }));
  layers.forEach((L, i) => jobs.push({ name: `Layer ${i + 1} - ${safe(L.name)}`, o: { parts: none, layers: [L] } }));
  jobs.push({ name: 'Full mix', o: { parts: Object.assign({}, transport.parts), layers: layers.filter(L => !L.muted), mix: true } });
  const files = [], lines = [];
  for (let i = 0; i < jobs.length; i++) {
    onStatus(`Rendering ${i + 1} of ${jobs.length}: ${jobs[i].name}…`);
    await new Promise(r => setTimeout(r, 0));
    const w = wavBytes(await renderOffline(bars, jobs[i].o));
    const file = `${String(i + 1).padStart(2, '0')} ${jobs[i].name}.wav`;
    files.push({ name: file, bytes: w.bytes });
    lines.push(`${file}  (peak ${w.peak.toFixed(2)})`);
  }
  const secs = bars * 16 * stepDur();
  const info = [`String Mirror stems`, ``, `Tempo: ${transport.bpm} BPM`, `Key: ${NOTE_NAMES[state.key]} ${SCALES[state.scale].name}`, `Beat: ${B.name}`,
    `Length: ${bars} bars (${secs.toFixed(2)} s) plus a 2 second tail for the reverb to ring out.`,
    `Every file starts on the same downbeat. Trim each to ${secs.toFixed(2)} s to loop it.`,
    `Stems are unmixed (full level, no master compressor). "Full mix" uses your mixer volumes.`,
    `Live playing is not in the stems; record a take for that.`, ``, ...lines].join('\r\n');
  files.push({ name: 'About these stems.txt', bytes: new TextEncoder().encode(info) });
  const d = new Date(), z = n => String(n).padStart(2, '0');
  const name = `string-mirror-stems-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.zip`;
  const blob = zipBlob(files);
  download(blob, name);
  onStatus(`Saved ${jobs.length} files, ${bars} bars each, as ${name}.`);
  return { blob, name, count: jobs.length, bars };
}

// ───────────────────────── interface wiring ─────────────────────────
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
  g = $('#stage').getContext('2d');
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
