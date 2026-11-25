export function createAudioModule(ctx) {
const { W, H, $, $$, clamp, lerp, dist, nowS, NOTE_NAMES, SHARP_NAMES, FLAT_NAMES, spell, SCALES, SCALE_ORDER, DRUM_ZONES, HAND_ZONES, INSTRUMENTS, INSTRUMENT_ORDER, own, MAX_STRINGS, MAX_LAYERS, state, hexA, toast, strRoot, strScale, strLen, strMid, orient, zoneCount, zoneInfo, stringLabel, addString, removeString, clearStrings, pluck, notePop, keepVoices, bendString, ROLLS, HOLD_IN, HOLD_OUT, HOLD_AFTER, holdNote, rollGap, startHold, endHold, updateHolds, sweep, forgetPointer, nearestBody, PULL_MAX, BEND_CENTS, pullString, releasePull, burst, nearestEndpoint, nearestDot, distToString, menuItems, MENU_TITLES, openMenu, menuContains, closeMenu, menuIdle, chooseMenu, pluckQuiet, updateMenu, film, enterClean, leaveClean, startFilm, stopFilm, toggleClean, setShape, SETUP_STORE, STARTERS, starterSetup, snapshot, applySetup, storedSetups, storeSetups, saveSetup, refreshSetups, setupToFile, setupFromFile, openModal, closeModal, buildChips, refreshUI, mixRowsHTML, nudgeVolume, currentHint, layoutStage, initUI, lastT, fpsN, fpsT, hintShown, ledShown, chordShown, frame, demo, demoHandPoints, demoHands, sleep, tween, both, canvasPosOf, demoStretch, demoChoose, demoPress, demoPluck, runDemo, boot } = ctx;
// ───────────────────────── sound engine (all synthesised, no samples) ─────────────────────────
const audio = { ctx: null, ready: false, ks: new Map(), activeVoices: new Set() };
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
  let engineInfo;
  try { engineInfo = buildVoice(id, midi, t, vel, out, len, H); } finally { VC = null; }
  const voice = { srcs, gate, t, id, engine: engineInfo && engineInfo.engine, update: engineInfo && engineInfo.update };
  if (voice.engine) {
    audio.activeVoices.add(voice);
    let remaining = srcs.length;
    if (!remaining) audio.activeVoices.delete(voice);
    srcs.forEach(source => { source.onended = () => { if (--remaining <= 0) audio.activeVoices.delete(voice); }; });
  }
  return voice;
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

// ─────────────────────── professional experimental synth engines ───────────────────────
const SYNTH_DEFAULTS = {
  abyss: { oscMix: 48, sub: 32, detune: 18, phase: 35, morph: 42, density: 58, cutoff: 3200, resonance: 3, lfoRate: 0.12, lfoDepth: 28, evolution: 35, width: 72, reverb: 55, delay: 28 },
  mutant: { ratioA: 1, ratioB: 2.71, ratioC: 1.414, fmIndex: 38, modDepth: 42, modAttack: 12, pitchDrop: 24, shape: 35, cutoff: 5200, resonance: 6, drive: 28, motion: 42, width: 55, reverb: 18, delay: 32 },
  rift: { exciter: 55, resonators: 7, spread: 38, inharmonicity: 62, resonance: 48, decay: 65, ringFreq: 173, ringDepth: 42, combDelay: 18, feedback: 22, cutoff: 6200, drive: 35, width: 65, reverb: 42, delay: 24 },
  void: { grainSize: 180, density: 42, position: 48, pitch: 0, pitchRandom: 28, positionRandom: 55, texture: 62, filter: 4200, resonance: 3, modRate: 0.18, modDepth: 35, width: 78, reverb: 68, delay: 42 }
};
audio.synth = Object.fromEntries(Object.entries(SYNTH_DEFAULTS).map(([id, values]) => [id, { ...values }]));
audio.synthBuffers = new Map();

function setSynthParameter(engine, name, value) {
  const params = audio.synth && audio.synth[engine];
  if (!params || !Object.prototype.hasOwnProperty.call(params, name)) return false;
  const def = SYNTH_DEFAULTS[engine][name];
  const ranges = {
    oscMix:[0,100],sub:[0,100],detune:[0,100],phase:[0,100],morph:[0,100],density:[0,100],cutoff:[80,18000],resonance:[0,18],lfoRate:[0.02,4],lfoDepth:[0,100],evolution:[0,100],width:[0,100],reverb:[0,100],delay:[0,100],
    ratioA:[0.25,8],ratioB:[0.25,12],ratioC:[0.25,16],fmIndex:[0,100],modDepth:[0,100],modAttack:[0,100],pitchDrop:[0,100],shape:[0,100],drive:[0,100],motion:[0,100],
    exciter:[0,100],resonators:[2,12],spread:[0,100],inharmonicity:[0,100],decay:[0,100],ringFreq:[20,2000],ringDepth:[0,100],combDelay:[2,35],feedback:[0,48],
    grainSize:[40,500],position:[0,100],pitch:[-24,24],pitchRandom:[0,100],positionRandom:[0,100],texture:[0,100],filter:[100,16000],modRate:[0.02,3]
  };
  const range = ranges[name];
  if (!range || !Number.isFinite(Number(value))) return false;
  params[name] = clamp(Number(value), range[0], range[1]);
  for (const voice of audio.activeVoices || []) if (voice.engine === engine && typeof voice.update === 'function') { try { voice.update(name, params[name]); } catch (_) {} }
  return true;
}

function proceduralTextureBuffer(ctx) {
  const key = ctx.sampleRate;
  if (audio.synthBuffers.has(key)) return audio.synthBuffers.get(key);
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let low = 0, mid = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    low += 0.012 * (white - low);
    mid += 0.12 * (white - mid);
    const t = i / length;
    data[i] = clamp((low * 1.9 + (mid - low) * 0.65 + white * 0.12) * (0.8 + 0.2 * Math.sin(t * Math.PI * 6)), -1, 1);
  }
  buffer.getChannelData(0).set(data);
  audio.synthBuffers.set(key, buffer);
  return buffer;
}

function engineEnvelope(ctx, t, duration, peak, attack = 0.03, release = 0.4) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  g.gain.setValueAtTime(Math.max(0.0001, peak), Math.max(t + attack, t + duration - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  return g;
}

function routeEngineOutput(source, out, params) {
  const ctx = audio.ctx;
  const mono = ctx.createGain(), left = ctx.createGain(), right = ctx.createGain();
  const leftPan = ctx.createStereoPanner(), rightPan = ctx.createStereoPanner();
  const spreadDelay = ctx.createDelay(0.03);
  leftPan.pan.value = -1; rightPan.pan.value = 1; spreadDelay.delayTime.value = 0.009;
  const setWidth = value => {
    const w = clamp(value / 100, 0, 1);
    mono.gain.setTargetAtTime(1 - w * 0.32, ctx.currentTime, 0.04);
    left.gain.setTargetAtTime(w * 0.23, ctx.currentTime, 0.04);
    right.gain.setTargetAtTime(w * 0.23, ctx.currentTime, 0.04);
  };
  source.connect(mono); mono.connect(out);
  source.connect(left); left.connect(leftPan); leftPan.connect(out);
  source.connect(right); right.connect(spreadDelay); spreadDelay.connect(rightPan); rightPan.connect(out);
  setWidth(params && params.width != null ? params.width : 0);
  let reverbSend = null, delaySend = null;
  if (params && params.reverb != null) { reverbSend = ctx.createGain(); reverbSend.gain.value = params.reverb / 100 * 0.42; source.connect(reverbSend); reverbSend.connect(audio.reverb); }
  if (params && params.delay != null) { delaySend = ctx.createGain(); delaySend.gain.value = params.delay / 100 * 0.36; source.connect(delaySend); delaySend.connect(audio.echoSend); }
  return { pan: mono, setWidth, reverbSend, delaySend };
}

function buildAbyss(midi, t, vel, out, H) {
  const ctx = audio.ctx, p = audio.synth.abyss, f = midiHz(midi);
  const hold = H(7), dur = Math.min(hold + 2.2, 48), amp = engineEnvelope(ctx, t, dur, 0.19 * vel, 0.65, 1.8);
  const mix = ctx.createGain(); mix.gain.value = 1;
  const low = ctx.createOscillator(); low.type = 'sine'; low.frequency.value = f / 2;
  const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = f;
  const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = f * (1 + p.detune / 18000);
  const ga = ctx.createGain(); ga.gain.value = 0.28 + p.oscMix / 170;
  const gb = ctx.createGain(); gb.gain.value = 0.12 + p.morph / 250;
  const sub = ctx.createGain(); sub.gain.value = p.sub / 180;
  const phaseDelay = ctx.createDelay(0.02); phaseDelay.delayTime.value = clamp(p.phase / 360 / f, 0.00001, 0.02);
  const textureNoise = noiseSrc(t, dur), noiseLevel = ctx.createGain(); noiseLevel.gain.value = p.density / 1800;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = p.cutoff; filter.Q.value = p.resonance;
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = p.lfoRate;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = p.lfoDepth * 18;
  lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
  const drift = ctx.createOscillator(); drift.type = 'sine'; drift.frequency.value = 0.025 + p.evolution / 1600;
  const driftGain = ctx.createGain(); driftGain.gain.value = p.evolution * 0.08;
  drift.connect(driftGain); driftGain.connect(b.detune);
  low.connect(sub); a.connect(ga); b.connect(gb); gb.connect(phaseDelay); phaseDelay.connect(mix);
  textureNoise.connect(noiseLevel); noiseLevel.connect(mix);
  sub.connect(mix); ga.connect(mix); mix.connect(filter); filter.connect(amp); const route=routeEngineOutput(amp,out,p);
  for (const n of [low,a,b,lfo,drift]) { VC.push(n); n.start(t); n.stop(t + dur + 0.05); }
  return { engine:'abyss', duration: dur, update(name,value) {
    if(name==='cutoff') filter.frequency.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='resonance') filter.Q.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='lfoRate') lfo.frequency.setTargetAtTime(value,ctx.currentTime,.05);
    else if(name==='lfoDepth') lfoGain.gain.setTargetAtTime(value*18,ctx.currentTime,.05);
    else if(name==='sub') sub.gain.setTargetAtTime(value/180,ctx.currentTime,.04);
    else if(name==='oscMix') ga.gain.setTargetAtTime(.28+value/170,ctx.currentTime,.04);
    else if(name==='morph') gb.gain.setTargetAtTime(.12+value/250,ctx.currentTime,.04);
    else if(name==='detune') b.detune.setTargetAtTime(value/18000*1200,ctx.currentTime,.05);
    else if(name==='phase') phaseDelay.delayTime.setTargetAtTime(clamp(value/360/f,.00001,.02),ctx.currentTime,.04);
    else if(name==='density') noiseLevel.gain.setTargetAtTime(value/1800,ctx.currentTime,.04);
    else if(name==='evolution'){drift.frequency.setTargetAtTime(.025+value/1600,ctx.currentTime,.1);driftGain.gain.setTargetAtTime(value*.08,ctx.currentTime,.1);}
    else if(name==='width') route.setWidth(value);
    else if(name==='reverb'&&route.reverbSend) route.reverbSend.gain.setTargetAtTime(value/100*.42,ctx.currentTime,.05);
    else if(name==='delay'&&route.delaySend) route.delaySend.gain.setTargetAtTime(value/100*.36,ctx.currentTime,.05);
  } };
}

function buildMutant(midi, t, vel, out, H) {
  const ctx = audio.ctx, p = audio.synth.mutant, f = midiHz(midi);
  const hold = H(0.8), dur = Math.min(hold + 0.35, 46);
  const carrier = ctx.createOscillator(); carrier.type = 'sawtooth'; carrier.frequency.value = f;
  const opA = ctx.createOscillator(); opA.type = 'sine'; opA.frequency.value = f * p.ratioA;
  const opB = ctx.createOscillator(); opB.type = 'triangle'; opB.frequency.value = f * p.ratioB;
  const opC = ctx.createOscillator(); opC.type = 'sine'; opC.frequency.value = f * p.ratioC;
  const cGain = ctx.createGain(); cGain.gain.value = f * (p.fmIndex / 42);
  const bGain = ctx.createGain(); bGain.gain.value = f * (p.modDepth / 58);
  const aGain = ctx.createGain(); aGain.gain.value = f * 0.12;
  opC.connect(cGain); cGain.connect(opB.frequency);
  opB.connect(bGain); bGain.connect(opA.frequency);
  opA.connect(aGain); aGain.connect(carrier.frequency);
  const sh = ctx.createWaveShaper(), curve = new Float32Array(1025), amount = 1 + p.shape / 13;
  for (let i=0;i<curve.length;i++){const x=i/512-1;curve[i]=Math.tanh(x*amount);}
  sh.curve=curve; sh.oversample='2x';
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=p.cutoff;filter.Q.value=p.resonance;
  const drive=ctx.createGain();drive.gain.value=1+p.drive/22;
  const amp=engineEnvelope(ctx,t,dur,0.22*vel,0.008,0.28);
  carrier.connect(drive);drive.connect(sh);sh.connect(filter);filter.connect(amp);const route=routeEngineOutput(amp,out,p);
  const pitch=ctx.createGain();pitch.gain.value=-f*(p.pitchDrop/100)*0.8;
  const motionLfo=ctx.createOscillator();motionLfo.type='sine';motionLfo.frequency.value=.2+p.motion/24;
  const motionGain=ctx.createGain();motionGain.gain.value=p.motion*0.12;motionLfo.connect(motionGain);motionGain.connect(carrier.detune);
  const pitchEnv=ctx.createOscillator();pitchEnv.type='sawtooth';pitchEnv.frequency.value=0.7+p.modAttack/32;
  const pg=ctx.createGain();pg.gain.value=pitch.gain.value;pitchEnv.connect(pg);pg.connect(carrier.detune);
  for(const n of [carrier,opA,opB,opC,pitchEnv,motionLfo]){VC.push(n);n.start(t);n.stop(t+dur+0.05);}
  return {engine:'mutant',duration:dur,update(name,value){
    if(name==='ratioA')opA.frequency.setTargetAtTime(f*value,ctx.currentTime,.03);
    else if(name==='ratioB')opB.frequency.setTargetAtTime(f*value,ctx.currentTime,.03);
    else if(name==='ratioC')opC.frequency.setTargetAtTime(f*value,ctx.currentTime,.03);
    else if(name==='fmIndex')cGain.gain.setTargetAtTime(f*(value/42),ctx.currentTime,.03);
    else if(name==='modDepth')bGain.gain.setTargetAtTime(f*(value/58),ctx.currentTime,.03);
    else if(name==='cutoff')filter.frequency.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='resonance')filter.Q.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='drive')drive.gain.setTargetAtTime(1+value/22,ctx.currentTime,.04);
    else if(name==='pitchDrop')pg.gain.setTargetAtTime(-f*(value/100)*.8,ctx.currentTime,.04);
    else if(name==='modAttack')pitchEnv.frequency.setTargetAtTime(.7+value/32,ctx.currentTime,.04);
    else if(name==='motion'){motionLfo.frequency.setTargetAtTime(.2+value/24,ctx.currentTime,.04);motionGain.gain.setTargetAtTime(value*.12,ctx.currentTime,.04);}
    else if(name==='shape'){const c=new Float32Array(1025),amount=1+value/13;for(let i=0;i<c.length;i++){const x=i/512-1;c[i]=Math.tanh(x*amount)}sh.curve=c;}
    else if(name==='width')route.setWidth(value);
    else if(name==='reverb'&&route.reverbSend)route.reverbSend.gain.setTargetAtTime(value/100*.42,ctx.currentTime,.05);
    else if(name==='delay'&&route.delaySend)route.delaySend.gain.setTargetAtTime(value/100*.36,ctx.currentTime,.05);
  }};
}

function buildRift(midi, t, vel, out, H) {
  const ctx=audio.ctx,p=audio.synth.rift,f=midiHz(midi),hold=H(1.2),dur=Math.min(hold+0.8,46);
  const noise=ctx.createBufferSource();noise.buffer=audio.noise;noise.loop=true;noise.start(t);noise.stop(t+dur+0.05);
  const exciter=ctx.createOscillator();exciter.type='square';exciter.frequency.value=f;exciter.start(t);exciter.stop(t+dur+0.05);
  const exciteGain=ctx.createGain();exciteGain.gain.value=p.exciter/130;
  const source=ctx.createGain();noise.connect(exciteGain);exciter.connect(exciteGain);exciteGain.connect(source);
  const sum=ctx.createGain();const bands=[],bandLevels=[],bandRatios=[];const count=Math.round(p.resonators);
  for(let i=0;i<count;i++){
    const band=ctx.createBiquadFilter();band.type='bandpass';
    const ratio=1+(i+1)*(0.21+p.inharmonicity/160)+(i*i*p.inharmonicity/900);bandRatios.push(ratio);
    band.frequency.value=clamp(f*ratio*(1+(i-count/2)*p.spread/1800),80,16000);
    band.Q.value=2+p.resonance*0.24;bands.push(band);
    const level=ctx.createGain();level.gain.value=1/Math.sqrt(count);bandLevels.push(level);
    source.connect(band);band.connect(level);level.connect(sum);
  }
  const ring=ctx.createOscillator();ring.type='sine';ring.frequency.value=p.ringFreq;
  const ringGain=ctx.createGain();ringGain.gain.value=p.ringDepth/100*0.48;
  const ringCarrier=ctx.createGain();ringCarrier.gain.value=1-ringGain.gain.value;
  // Gain modulation implements a bounded ring-mod approximation without a fake frequency shifter.
  const ringMod=ctx.createGain();ringMod.gain.value=0;
  ring.connect(ringGain);ringGain.connect(ringMod.gain);
  sum.connect(ringCarrier);sum.connect(ringMod);
  const comb=ctx.createDelay(0.05);comb.delayTime.value=p.combDelay/1000;
  const feedback=ctx.createGain();feedback.gain.value=Math.min(0.48,p.feedback/110);
  const wet=ctx.createGain();wet.gain.value=0.5;
  sum.connect(comb);comb.connect(feedback);feedback.connect(comb);comb.connect(wet);
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=p.cutoff;
  const amp=engineEnvelope(ctx,t,dur,0.2*vel,0.004,Math.max(0.12,p.decay/100*1.4));
  const merged=ctx.createGain();ringCarrier.connect(merged);ringMod.connect(merged);wet.connect(merged);
  const drive=ctx.createGain();drive.gain.value=1+p.drive/25;const shaper=ctx.createWaveShaper(),curve=new Float32Array(513);for(let i=0;i<curve.length;i++){const x=i/256-1;curve[i]=Math.tanh(x*drive.gain.value)}shaper.curve=curve;shaper.oversample='2x';
  merged.connect(drive);drive.connect(shaper);shaper.connect(filter);filter.connect(amp);const route=routeEngineOutput(amp,out,p);
  ring.start(t);ring.stop(t+dur+0.05);
  VC.push(noise,exciter,ring);
  return {engine:'rift',duration:dur,update(name,value){
    if(name==='exciter')exciteGain.gain.setTargetAtTime(value/130,ctx.currentTime,.03);
    else if(name==='resonators')bandLevels.forEach((g,i)=>g.gain.setTargetAtTime(i<Math.round(value)?1/Math.sqrt(Math.round(value)):0,ctx.currentTime,.04));
    else if(name==='spread'||name==='inharmonicity')bands.forEach((b,i)=>{const inh=name==='inharmonicity'?value:p.inharmonicity,sp=name==='spread'?value:p.spread,ratio=1+(i+1)*(.21+inh/160)+(i*i*inh/900);b.frequency.setTargetAtTime(clamp(f*ratio*(1+(i-bands.length/2)*sp/1800),80,16000),ctx.currentTime,.04)});
    else if(name==='drive'){drive.gain.setTargetAtTime(1+value/25,ctx.currentTime,.04);const c=new Float32Array(513),amount=1+value/25;for(let i=0;i<c.length;i++){const x=i/256-1;c[i]=Math.tanh(x*amount)}shaper.curve=c;}
    else if(name==='ringFreq')ring.frequency.setTargetAtTime(value,ctx.currentTime,.03);
    else if(name==='ringDepth'){ringGain.gain.setTargetAtTime(value/100*.48,ctx.currentTime,.03);ringCarrier.gain.setTargetAtTime(1-value/100*.48,ctx.currentTime,.03);}
    else if(name==='combDelay')comb.delayTime.setTargetAtTime(value/1000,ctx.currentTime,.03);
    else if(name==='feedback')feedback.gain.setTargetAtTime(Math.min(.48,value/110),ctx.currentTime,.03);
    else if(name==='cutoff')filter.frequency.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='width')route.setWidth(value);
    else if(name==='resonance')bands.forEach(b=>b.Q.setTargetAtTime(2+value*.24,ctx.currentTime,.04));
    else if(name==='reverb'&&route.reverbSend)route.reverbSend.gain.setTargetAtTime(value/100*.42,ctx.currentTime,.05);
    else if(name==='delay'&&route.delaySend)route.delaySend.gain.setTargetAtTime(value/100*.36,ctx.currentTime,.05);
  }};
}

function buildVoid(midi, t, vel, out, H) {
  const ctx=audio.ctx,p=audio.synth.void,buffer=proceduralTextureBuffer(ctx),hold=H(2.5),dur=Math.min(hold+0.5,46);
  const count=Math.round(8+p.density*0.16),grain=Math.max(0.04,p.grainSize/1000);
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=p.filter;
  const pans=[],grainSources=[],grainGains=[],grainOffsets=[],grainPitchOffsets=[];filter.Q.value=p.resonance;
  const motion=ctx.createOscillator(),motionGain=ctx.createGain();motion.type='sine';motion.frequency.value=p.modRate;motionGain.gain.value=p.modDepth*18;motion.connect(motionGain);motionGain.connect(filter.frequency);motion.start(t);motion.stop(t+dur+.05);VC.push(motion);
  const amp=engineEnvelope(ctx,t,dur,0.14*vel,0.12,0.5);filter.connect(amp);const route=routeEngineOutput(amp,out,p);
  // Bounded looping grains: each source loops a short window to sustain a texture without timers or unbounded scheduling.
  const safeCount=Math.min(24,Math.max(6,count));
  for(let i=0;i<safeCount;i++){
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    const span=Math.min(grain,0.42),maxStart=Math.max(0.01,buffer.duration-span-0.01);
    const center=(p.position/100)*maxStart;
    const jitter=(Math.random()*2-1)*(p.positionRandom/100)*maxStart*0.45;
    const offset=clamp(center+jitter,0,maxStart);
    source.loopStart=offset;source.loopEnd=offset+span;
    const pitch=p.pitch+(Math.random()*2-1)*p.pitchRandom/100*12;
    source.playbackRate.value=Math.pow(2,pitch/12);
    const pan=ctx.createStereoPanner();pan.pan.value=clamp((i/(safeCount-1)*2-1)*(p.width/100),-1,1);pans.push(pan);
    const grainGain=ctx.createGain();grainGain.gain.value=(0.18+ p.texture/180)/Math.sqrt(safeCount);
    source.connect(grainGain);grainGain.connect(pan);pan.connect(filter);
    grainSources.push(source);grainGains.push(grainGain);grainOffsets.push(offset);grainPitchOffsets.push(pitch-p.pitch);
    source.start(t,offset);source.stop(t+dur+0.06);VC.push(source);
  }
  return {engine:'void',duration:dur,update(name,value){
    if(name==='filter')filter.frequency.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='modRate')motion.frequency.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='modDepth')motionGain.gain.setTargetAtTime(value*18,ctx.currentTime,.04);
    else if(name==='grainSize')grainSources.forEach((source,i)=>{const end=Math.min(buffer.duration-.005,grainOffsets[i]+Math.min(value/1000,.42));if(end>source.loopStart+.02)source.loopEnd=end});
    else if(name==='position')grainSources.forEach((source,i)=>{const span=source.loopEnd-source.loopStart,max=buffer.duration-span-.01,offset=clamp(value/100*max,0,max);source.loopStart=offset;source.loopEnd=offset+span});
    else if(name==='pitch')grainSources.forEach((source,i)=>source.playbackRate.setTargetAtTime(Math.pow(2,(value+grainPitchOffsets[i])/12),ctx.currentTime,.04));
    else if(name==='pitchRandom')grainSources.forEach((source,i)=>{grainPitchOffsets[i]=(Math.random()*2-1)*value/100*12;source.playbackRate.setTargetAtTime(Math.pow(2,(p.pitch+grainPitchOffsets[i])/12),ctx.currentTime,.04)});
    else if(name==='density')grainGains.forEach(g=>g.gain.setTargetAtTime((.18+p.texture/180)*Math.min(1,value/45)/Math.sqrt(safeCount),ctx.currentTime,.04));
    else if(name==='positionRandom')grainSources.forEach((source,i)=>{const span=source.loopEnd-source.loopStart,max=buffer.duration-span-.01,center=(p.position/100)*max,offset=clamp(center+(Math.random()*2-1)*value/100*max*.45,0,max);source.loopStart=offset;source.loopEnd=offset+span;grainOffsets[i]=offset});
    else if(name==='texture')grainGains.forEach(g=>g.gain.setTargetAtTime((.18+value/180)/Math.sqrt(safeCount),ctx.currentTime,.04));
    else if(name==='resonance')filter.Q.setTargetAtTime(value,ctx.currentTime,.04);
    else if(name==='reverb'&&route.reverbSend)route.reverbSend.gain.setTargetAtTime(value/100*.42,ctx.currentTime,.05);
    else if(name==='delay'&&route.delaySend)route.delaySend.gain.setTargetAtTime(value/100*.36,ctx.currentTime,.05);
    else if(name==='width'){route.setWidth(value);pans.forEach((pan,i)=>pan.pan.setTargetAtTime((i/(pans.length-1)*2-1)*value/100,ctx.currentTime,.04));}
  }};
}

const SUSTAINS = { organ: 1, violin: 1, cello: 1, strings: 1, flute: 1, trumpet: 1, voices: 1, synth: 1, marimba: 1, kalimba: 1, steelpan: 1, bells: 1 };

function buildVoice(id, midi, t, vel, out, len, H) {
  const ctx = audio.ctx;
  const f = midiHz(midi);
  if (id === 'marimba') return buildAbyss(midi, t, vel, out, H);
  if (id === 'kalimba') return buildMutant(midi, t, vel, out, H);
  if (id === 'steelpan') return buildRift(midi, t, vel, out, H);
  if (id === 'bells') return buildVoid(midi, t, vel, out, H);

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
return { audio, midiHz, buildGraph, initAudio, setFx, instBus, ksBuffer, env, VC, noiseSrc, oscAt, playNote, releaseVoice, bendVoice, SUSTAINS, buildVoice, setSynthParameter, SYNTH_DEFAULTS, playDrum, playEvent, BEATS, BEAT_ORDER, PARTS, PROGS, transport, stepDur, scaleDegree, scheduleStep, tick, startTransport, stopTransport, togglePlay, setBeat, stepAt, armLayer, captureEvent, makeLayer, layerOut, finishLayer, removeLayer, undoLayer, chordDegNow, chordLabel, rec, TAP_SRC, pushPcm, ensureTap, pickMime, startRecording, stopRecording, wavBlob, pcmFromVideo, mp3Blob, mp3Possible, finishRecording, saveMp3, download, renderOffline, wavBytes, CRC_TABLE, crc32, zipBlob, exportStems };
}

export function installAudioExperience(r) {
  const root = document.querySelector('#psyConsole');
  const a = r && r.audio;
  const sd = document.querySelector('#soundDesign');
  const clampValue = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));
  if (!root || !a) return;
  a.setSynthParameter = setSynthParameter;

  // Explicit profile definitions. Keep these local: the former implementation
  // referenced an undefined P symbol and aborted the remaining V2 installers.
  const profiles = {
    psychedelic: { cut: 13500, echo: 0.18, delay: 0.42, psy: 45, dark: 25, motion: 35, space: 45 },
    psyambient:  { cut: 6200,  echo: 0.36, delay: 0.90, psy: 30, dark: 70, motion: 18, space: 78 },
    psytrance:   { cut: 16500, echo: 0.12, delay: 0.28, psy: 70, dark: 18, motion: 65, space: 28 },
  };
  let profile = 'psychedelic';
  const values = { psy: 45, dark: 25, motion: 35, space: 45 };
  const set = (param, value, time = 0.12) => {
    if (!param || !a.ctx) return;
    try { param.setTargetAtTime(value, a.ctx.currentTime, time); } catch (_) {}
  };
  const apply = () => {
    if (!a.ctx) return;
    const p = profiles[profile];
    const psy = values.psy / 100;
    const dark = values.dark / 100;
    const motion = values.motion / 100;
    set(a.lp && a.lp.frequency, clampValue(p.cut * (1 - dark * 0.78), 650, 19000));
    set(a.echoSend && a.echoSend.gain, clampValue(p.echo + psy * 0.28 + motion * 0.12, 0, 0.72), 0.18);
    set(a.echoDelay && a.echoDelay.delayTime, clampValue(p.delay * (0.65 + motion * 0.8), 0.08, 1.45), 0.2);
  };
  const select = name => {
    if (!Object.prototype.hasOwnProperty.call(profiles, name)) return;
    profile = name;
    root.querySelectorAll('[data-profile]').forEach(button => {
      button.classList.toggle('active', button.dataset.profile === name);
    });
    Object.keys(values).forEach(key => {
      values[key] = profiles[name][key];
      const input = root.querySelector('[data-macro="' + key + '"]');
      if (input) {
        input.value = values[key];
        if (input.nextElementSibling) input.nextElementSibling.value = values[key];
      }
    });
    apply();
  };

  root.querySelectorAll('[data-profile]').forEach(button => {
    button.addEventListener('click', () => select(button.dataset.profile));
  });
  root.querySelectorAll('[data-macro]').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.macro;
      if (!Object.prototype.hasOwnProperty.call(values, key)) return;
      values[key] = clampValue(Number(input.value) || 0, 0, 100);
      if (input.nextElementSibling) input.nextElementSibling.value = values[key];
      apply();
    });
  });
  const toggle = root.querySelector('#psyToggle');
  const body = root.querySelector('#psyBody');
  if (toggle && body) {
    toggle.addEventListener('click', event => {
      body.hidden = !body.hidden;
      event.currentTarget.textContent = body.hidden ? '+' : '−';
      event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
    });
  }
  document.addEventListener('pointerdown', apply, { capture: true });
  select('psychedelic');

  // Full parameter-level sound design for the four replacement engines.
  const engineMeta = {
    abyss: { title:'ABYSS — EVOLVING DRONE', sections:{
      SOURCE:['oscMix','sub','detune','phase'], SPECTRAL:['morph','density','evolution'], FILTER:['cutoff','resonance'], MODULATION:['lfoRate','lfoDepth'], SPACE:['width','reverb','delay'] } },
    mutant: { title:'MUTANT — THREE OPERATOR FM', sections:{
      OPERATORS:['ratioA','ratioB','ratioC'], FM:['fmIndex','modDepth','modAttack','pitchDrop'], TIMBRE:['shape','drive'], FILTER:['cutoff','resonance'], MOTION:['motion','width'], SPACE:['reverb','delay'] } },
    rift: { title:'RIFT — INHARMONIC RESONATOR', sections:{
      EXCITER:['exciter','resonators'], RESONATOR:['spread','inharmonicity','resonance','decay'], RING_MOD:['ringFreq','ringDepth'], COMB:['combDelay','feedback'], OUTPUT:['cutoff','drive','width'], SPACE:['reverb','delay'] } },
    void: { title:'VOID — GRANULAR TEXTURE', sections:{
      GRAINS:['grainSize','density','position','positionRandom'], PITCH:['pitch','pitchRandom'], TEXTURE:['texture'], FILTER:['filter','resonance'], MOTION:['modRate','modDepth','width'], SPACE:['reverb','delay'] } }
  };
  const labels = {
    oscMix:['Oscillator Mix',0,100,'%'],sub:['Sub Level',0,100,'%'],detune:['Detune',0,100,'%'],phase:['Phase Offset',0,100,'%'],
    morph:['Spectral Morph',0,100,'%'],density:['Harmonic Density',0,100,'%'],evolution:['Evolution',0,100,'%'],cutoff:['Filter Cutoff',80,18000,'Hz'],resonance:['Resonance',0,18,'Q'],
    lfoRate:['LFO Rate',0.02,4,'Hz'],lfoDepth:['LFO Depth',0,100,'%'],width:['Stereo Width',0,100,'%'],reverb:['Reverb Send',0,100,'%'],delay:['Delay Send',0,100,'%'],
    ratioA:['Operator A Ratio',0.25,8,'x'],ratioB:['Operator B Ratio',0.25,12,'x'],ratioC:['Operator C Ratio',0.25,16,'x'],fmIndex:['FM Index',0,100,'%'],modDepth:['Modulation Depth',0,100,'%'],modAttack:['Modulator Attack',0,100,'%'],pitchDrop:['Pitch Drop',0,100,'%'],shape:['Wave Shape',0,100,'%'],drive:['Drive',0,100,'%'],motion:['Motion',0,100,'%'],
    exciter:['Exciter Level',0,100,'%'],resonators:['Resonator Count',2,12,''],spread:['Resonator Spread',0,100,'%'],inharmonicity:['Inharmonicity',0,100,'%'],decay:['Decay',0,100,'%'],ringFreq:['Ring Frequency',20,2000,'Hz'],ringDepth:['Ring Depth',0,100,'%'],combDelay:['Comb Delay',2,35,'ms'],feedback:['Feedback',0,48,'%'],
    grainSize:['Grain Size',40,500,'ms'],position:['Grain Position',0,100,'%'],pitch:['Pitch',-24,24,'st'],pitchRandom:['Pitch Random',0,100,'%'],positionRandom:['Position Random',0,100,'%'],texture:['Texture Density',0,100,'%'],filter:['Texture Filter',100,16000,'Hz'],modRate:['Modulation Rate',0.02,3,'Hz']
  };
  const presets = {
    abyss:[
      ['Deep Void',{oscMix:38,sub:72,detune:24,morph:18,density:66,cutoff:950,resonance:2,lfoRate:.06,lfoDepth:12,evolution:24,width:82,reverb:82,delay:32}],
      ['Black Horizon',{oscMix:55,sub:55,detune:42,morph:38,density:78,cutoff:1800,resonance:4,lfoRate:.11,lfoDepth:25,evolution:62,width:90,reverb:72,delay:44}],
      ['Frozen Nebula',{oscMix:68,sub:25,detune:12,morph:72,density:42,cutoff:6200,resonance:2,lfoRate:.035,lfoDepth:38,evolution:76,width:100,reverb:90,delay:20}],
      ['Abyssal Drift',{oscMix:48,sub:48,detune:35,morph:55,density:52,cutoff:2700,resonance:5,lfoRate:.08,lfoDepth:50,evolution:88,width:78,reverb:66,delay:62}],
      ['Submerged Temple',{oscMix:25,sub:88,detune:8,morph:30,density:84,cutoff:1400,resonance:7,lfoRate:.045,lfoDepth:16,evolution:35,width:65,reverb:96,delay:18}],
      ['Eternal Night',{oscMix:60,sub:60,detune:28,morph:64,density:70,cutoff:4200,resonance:3,lfoRate:.025,lfoDepth:32,evolution:92,width:96,reverb:88,delay:48}]
    ],
    mutant:[
      ['Alien Squelch',{ratioA:1,ratioB:2.71,ratioC:1.414,fmIndex:68,modDepth:74,modAttack:8,pitchDrop:22,shape:55,cutoff:4800,resonance:8,drive:45,motion:70,width:58}],
      ['Insect Mutation',{ratioA:1.03,ratioB:5.17,ratioC:2.31,fmIndex:82,modDepth:66,modAttack:4,pitchDrop:48,shape:78,cutoff:7200,resonance:12,drive:52,motion:88,width:72}],
      ['Dark Matter',{ratioA:0.5,ratioB:3.14,ratioC:1.73,fmIndex:45,modDepth:52,modAttack:34,pitchDrop:12,shape:28,cutoff:2100,resonance:5,drive:30,motion:28,width:48}],
      ['Acid Parasite',{ratioA:1,ratioB:1.997,ratioC:4.23,fmIndex:76,modDepth:88,modAttack:12,pitchDrop:36,shape:62,cutoff:3400,resonance:14,drive:68,motion:82,width:62}],
      ['Fractal Attack',{ratioA:1.5,ratioB:2.83,ratioC:7.11,fmIndex:92,modDepth:90,modAttack:2,pitchDrop:64,shape:84,cutoff:8600,resonance:6,drive:74,motion:96,width:80}],
      ['Bio Mechanical',{ratioA:1,ratioB:3.5,ratioC:2.01,fmIndex:56,modDepth:72,modAttack:22,pitchDrop:18,shape:48,cutoff:5600,resonance:9,drive:58,motion:52,width:68}]
    ],
    rift:[
      ['Metallic Rift',{exciter:58,resonators:9,spread:54,inharmonicity:82,resonance:58,decay:76,ringFreq:211,ringDepth:34,combDelay:12,feedback:28,cutoff:8500,drive:32,width:75}],
      ['Broken Resonance',{exciter:74,resonators:12,spread:92,inharmonicity:95,resonance:84,decay:42,ringFreq:83,ringDepth:66,combDelay:7,feedback:34,cutoff:4200,drive:62,width:60}],
      ['Quantum Impact',{exciter:92,resonators:5,spread:38,inharmonicity:70,resonance:32,decay:18,ringFreq:640,ringDepth:78,combDelay:3,feedback:12,cutoff:11000,drive:55,width:85}],
      ['Industrial Ghost',{exciter:62,resonators:8,spread:65,inharmonicity:88,resonance:72,decay:90,ringFreq:47,ringDepth:22,combDelay:25,feedback:42,cutoff:2800,drive:78,width:92}],
      ['Distorted Relic',{exciter:82,resonators:10,spread:44,inharmonicity:60,resonance:90,decay:56,ringFreq:330,ringDepth:54,combDelay:16,feedback:38,cutoff:6200,drive:86,width:70}],
      ['Fracture Field',{exciter:48,resonators:12,spread:100,inharmonicity:100,resonance:44,decay:68,ringFreq:970,ringDepth:88,combDelay:5,feedback:18,cutoff:9800,drive:42,width:100}]
    ],
    void:[
      ['Organic Fog',{grainSize:340,density:28,position:45,pitch:0,pitchRandom:12,positionRandom:78,texture:76,filter:1800,resonance:2,modRate:.08,modDepth:24,width:100,reverb:92,delay:54}],
      ['Ghost Particles',{grainSize:90,density:72,position:62,pitch:7,pitchRandom:68,positionRandom:90,texture:52,filter:8200,resonance:5,modRate:.7,modDepth:48,width:95,reverb:78,delay:66}],
      ['Dark Bloom',{grainSize:480,density:18,position:25,pitch:-7,pitchRandom:18,positionRandom:45,texture:88,filter:950,resonance:3,modRate:.035,modDepth:16,width:84,reverb:100,delay:30}],
      ['Granular Memory',{grainSize:160,density:55,position:72,pitch:0,pitchRandom:38,positionRandom:62,texture:68,filter:4200,resonance:4,modRate:.16,modDepth:42,width:88,reverb:85,delay:72}],
      ['Spectral Dust',{grainSize:55,density:90,position:50,pitch:12,pitchRandom:85,positionRandom:100,texture:44,filter:12500,resonance:8,modRate:1.2,modDepth:68,width:100,reverb:74,delay:88}],
      ['Forgotten Signal',{grainSize:260,density:36,position:18,pitch:-12,pitchRandom:24,positionRandom:48,texture:82,filter:2600,resonance:6,modRate:.06,modDepth:32,width:92,reverb:96,delay:44}]
    ]
  };
  const engineSelect = document.querySelector('#sdEngine');
  const presetSelect = document.querySelector('#sdPreset');
  const sections = document.querySelector('#sdSections');
  const status = document.querySelector('#sdStatus');
  const title = document.querySelector('#sdEngineTitle');
  const snapshots = { A:{}, B:{} };
  let activeSlot = 'A';
  let currentEngine = 'abyss';
  const persistKey = 'musicam.soundDesign.presets.v1';
  const readSaved = () => { try { return JSON.parse(localStorage.getItem(persistKey) || '{}'); } catch (_) { return {}; } };
  const writeSaved = data => { try { localStorage.setItem(persistKey, JSON.stringify(data)); return true; } catch (_) { return false; } };
  const applyPatch = (engine, patch) => {
    Object.entries(patch || {}).forEach(([key,value]) => {
      if (a.synth[engine] && Object.prototype.hasOwnProperty.call(a.synth[engine],key)) {
        a.synth[engine][key] = value;
        const meta = labels[key];
        if (meta) a.setSynthParameter(engine,key,value);
      }
    });
    renderControls();
  };
  const renderControls = () => {
    if (!sections) return;
    sections.innerHTML = '';
    const spec = engineMeta[currentEngine];
    Object.entries(spec.sections).forEach(([section,keys]) => {
      const box = document.createElement('section'); box.className='sd-section';
      const heading = document.createElement('h4'); heading.textContent=section; box.appendChild(heading);
      keys.forEach(key => {
        const meta=labels[key],value=a.synth[currentEngine][key];
        const row=document.createElement('label');row.className='sd-control';
        const name=document.createElement('span');name.textContent=meta[0];
        const input=document.createElement('input');input.type='range';input.min=meta[1];input.max=meta[2];input.step=(key==='resonators'||key==='density')?1:(meta[2]-meta[1]>100?1:0.01);input.value=value;
        const output=document.createElement('output');output.textContent=Number(value).toFixed(meta[3]==='Hz'&&value<100?1:0)+(meta[3]?' '+meta[3]:'');
        input.addEventListener('input',()=>{
          const n=Number(input.value);
          a.setSynthParameter(currentEngine,key,n);
          output.textContent=Number(n).toFixed(meta[3]==='Hz'&&n<100?1:0)+(meta[3]?' '+meta[3]:'');
          if(status)status.textContent='PARAMETER UPDATED · NEW NOTES USE CURRENT PATCH';
        });
        row.append(name,input,output);box.appendChild(row);
      });
      sections.appendChild(box);
    });
  };
  const loadPreset = (engine,index) => {
    const preset=presets[engine] && presets[engine][index];
    if (!preset) return;
    applyPatch(engine,preset[1]);
    if(status)status.textContent='LOADED · '+preset[0].toUpperCase();
  };
  const refreshPresets = () => {
    if(!presetSelect)return;
    const custom=readSaved()[currentEngine]||[];
    presetSelect.innerHTML='';
    presets[currentEngine].forEach((p,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=p[0];presetSelect.appendChild(o)});
    custom.forEach((p,i)=>{const o=document.createElement('option');o.value='custom:'+i;o.textContent='USER · '+p.name;presetSelect.appendChild(o)});
  };
  const chooseEngine = engine => {
    if(!engineMeta[engine])return;
    currentEngine=engine;
    if(title)title.textContent=engineMeta[engine].title;
    refreshPresets();renderControls();
    if(engineSelect)engineSelect.value=engine;
  };
  if(engineSelect)engineSelect.addEventListener('change',()=>chooseEngine(engineSelect.value));
  if(presetSelect)document.querySelector('#sdLoad')?.addEventListener('click',()=>{
    const value=presetSelect.value;
    if(value.startsWith('custom:')){const custom=readSaved()[currentEngine]||[];const p=custom[Number(value.slice(7))];if(p)applyPatch(currentEngine,p.params);if(status)status.textContent='USER PRESET LOADED'}
    else loadPreset(currentEngine,Number(value));
  });
  document.querySelector('#sdSave')?.addEventListener('click',()=>{
    const data=readSaved(),list=data[currentEngine]||[];
    const name=window.prompt('Preset name');
    if(!name||!name.trim())return;
    list.push({name:name.trim().slice(0,48),params:{...a.synth[currentEngine]}});
    data[currentEngine]=list.slice(-40);
    if(writeSaved(data)){refreshPresets();if(status)status.textContent='PRESET SAVED LOCALLY'}else if(status)status.textContent='STORAGE UNAVAILABLE';
  });
  document.querySelector('#sdRandom')?.addEventListener('click',()=>{
    const patch={};
    Object.entries(a.synth[currentEngine]).forEach(([key,base])=>{
      const meta=labels[key];if(!meta)return;
      const lo=meta[1],hi=meta[2];
      const scale=(key==='cutoff'||key==='filter'||key==='ringFreq')?'log':'linear';
      patch[key]=scale==='log'?Math.exp(Math.log(lo)+(Math.log(hi)-Math.log(lo))*Math.random()):lo+Math.random()*(hi-lo);
    });
    applyPatch(currentEngine,patch);if(status)status.textContent='SAFE-RANGE RANDOM PATCH GENERATED';
  });
  const saveSlot=slot=>{snapshots[slot][currentEngine]={...a.synth[currentEngine]};activeSlot=slot;if(status)status.textContent='SLOT '+slot+' STORED FOR '+currentEngine.toUpperCase()};
  document.querySelector('#sdA')?.addEventListener('click',()=>saveSlot('A'));
  document.querySelector('#sdB')?.addEventListener('click',()=>saveSlot('B'));
  document.querySelector('#sdCompare')?.addEventListener('click',()=>{
    const other=activeSlot==='A'?'B':'A';
    if(!snapshots[other][currentEngine]){if(status)status.textContent='STORE BOTH A AND B FOR THIS ENGINE FIRST';return;}
    activeSlot=other;applyPatch(currentEngine,snapshots[other][currentEngine]);if(status)status.textContent='A/B · ACTIVE SLOT '+other;
  });
  const sdToggle=document.querySelector('#sdToggle'),sdBody=document.querySelector('#sdBody');
  if(sdToggle&&sdBody)sdToggle.addEventListener('click',e=>{sdBody.hidden=!sdBody.hidden;e.currentTarget.textContent=sdBody.hidden?'+':'−';e.currentTarget.setAttribute('aria-expanded',String(!sdBody.hidden))});
  chooseEngine('abyss');

  const macroMap = {
    abyss:{psy:['morph','density'],dark:['cutoff','sub'],motion:['lfoRate','lfoDepth'],space:['reverb','delay','width']},
    mutant:{psy:['fmIndex','modDepth','shape'],dark:['cutoff','drive'],motion:['motion','modAttack'],space:['width','motion']},
    rift:{psy:['ringDepth','inharmonicity'],dark:['cutoff','feedback'],motion:['ringFreq','spread'],space:['width','feedback']},
    void:{psy:['density','pitchRandom'],dark:['filter','texture'],motion:['modRate','positionRandom'],space:['reverb','delay','width']}
  };
  const applyMacros = () => {
    const base=SYNTH_DEFAULTS[currentEngine], map=macroMap[currentEngine];
    Object.entries(map).forEach(([macro,keys])=>{
      const amount=values[macro]/100;
      keys.forEach(key=>{
        const range=labels[key];if(!range)return;
        let value=base[key];
        if(macro==='dark' && (key==='cutoff'||key==='filter')) value=range[1]*Math.pow(range[0]/range[1],amount);
        else if(macro==='space') value=range[1]*amount;
        else value=range[1]*amount;
        a.setSynthParameter(currentEngine,key,value);
      });
    });
    renderControls();
  };
  root.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>applyMacros()));
  root.querySelectorAll('[data-macro]').forEach(input=>input.addEventListener('input',()=>{
    if(input.dataset.macro==='space') { values.space=clampValue(input.value,0,100); applyMacros(); }
    else if(['psy','dark','motion'].includes(input.dataset.macro)){values[input.dataset.macro]=clampValue(input.value,0,100);applyMacros();}
  }));


}
