export function createVisionModule(ctx) {
const { $, $$, clamp, lerp, dist, nowS, NOTE_NAMES, SHARP_NAMES, FLAT_NAMES, spell, SCALES, SCALE_ORDER, DRUM_ZONES, HAND_ZONES, INSTRUMENTS, INSTRUMENT_ORDER, own, MAX_STRINGS, MAX_LAYERS, state, hexA, toast, strRoot, strScale, strLen, strMid, orient, zoneCount, zoneInfo, stringLabel, addString, removeString, clearStrings, pluck, notePop, keepVoices, bendString, ROLLS, HOLD_IN, HOLD_OUT, HOLD_AFTER, holdNote, rollGap, startHold, endHold, updateHolds, sweep, forgetPointer, nearestBody, PULL_MAX, BEND_CENTS, pullString, releasePull, burst, nearestEndpoint, nearestDot, distToString, menuItems, MENU_TITLES, openMenu, menuContains, closeMenu, menuIdle, chooseMenu, pluckQuiet, updateMenu, film, enterClean, leaveClean, startFilm, stopFilm, toggleClean, setShape, SETUP_STORE, STARTERS, starterSetup, snapshot, applySetup, storedSetups, storeSetups, saveSetup, refreshSetups, setupToFile, setupFromFile, openModal, closeModal, buildChips, refreshUI, mixRowsHTML, nudgeVolume, currentHint, layoutStage, initUI, lastT, fpsN, fpsT, hintShown, ledShown, chordShown, frame, demo, demoHandPoints, demoHands, sleep, tween, both, canvasPosOf, demoStretch, demoChoose, demoPress, demoPluck, runDemo, boot, audio, midiHz, buildGraph, initAudio, setFx, instBus, ksBuffer, env, VC, noiseSrc, oscAt, playNote, releaseVoice, bendVoice, SUSTAINS, buildVoice, playDrum, playEvent, BEATS, BEAT_ORDER, PARTS, PROGS, transport, stepDur, scaleDegree, scheduleStep, tick, startTransport, stopTransport, togglePlay, setBeat, stepAt, armLayer, captureEvent, makeLayer, layerOut, finishLayer, removeLayer, undoLayer, chordDegNow, chordLabel, rec, TAP_SRC, pushPcm, ensureTap, pickMime, startRecording, stopRecording, wavBlob, pcmFromVideo, mp3Blob, mp3Possible, finishRecording, saveMp3, download, renderOffline, wavBytes, CRC_TABLE, crc32, zipBlob, exportStems } = ctx;
const TRACKER = Object.assign({
  bundle: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  model: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
}, window.__SM_PATHS || {});

const cam = { video: null, tracker: null, lastVT: -1, delegate: '', frames: 0, fpsT: 0, trackFps: 0 };
const modalOpen = () => !!document.querySelector('.modal.open');

const withStartupTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(label + ' timed out after ' + Math.round(ms / 1000) + ' seconds')), ms);
  Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});

async function loadTracker() {
  const vision = await withStartupTimeout(import(TRACKER.bundle), 20000, 'Hand-tracker download');
  const files = await withStartupTimeout(vision.FilesetResolver.forVisionTasks(TRACKER.wasm), 20000, 'Hand-tracker WASM setup');
  const make = delegate => withStartupTimeout(vision.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: TRACKER.model, delegate },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  }), 25000, 'Hand model initialization');
  if (TRACKER.delegate === 'CPU') { cam.tracker = await make('CPU'); cam.delegate = 'CPU'; return; }
  try { cam.tracker = await make('GPU'); cam.delegate = 'GPU'; }
  catch (e) { cam.tracker = await make('CPU'); cam.delegate = 'CPU'; }
}

async function startCamera(setStatus) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot open a camera from here.');
  setStatus('Waiting for camera permission…');
  const request = navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false,
  });
  // If a browser leaves its permission prompt pending, fail visibly instead of freezing
  // the start screen forever. Stop a late stream if the timeout already fired.
  let timedOut = false;
  request.then(stream => { if (timedOut) stream.getTracks().forEach(track => track.stop()); }).catch(() => {});
  let stream;
  try { stream = await withStartupTimeout(request, 20000, 'Camera permission request'); }
  catch (error) { timedOut = true; throw error; }
  cam.stream = stream;
  const v = cam.video = $('#cam');
  try {
    v.srcObject = stream;
    await withStartupTimeout(v.play(), 10000, 'Camera video startup');
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
  const v = cam.video, vw = v.videoWidth || ctx.W, vh = v.videoHeight || ctx.H;
  const sc = Math.max(ctx.W / vw, ctx.H / vh);
  return { vw, vh, sc, ox: (ctx.W - vw * sc) / 2, oy: (ctx.H - vh * sc) / 2 };
}
function readHands(t) {
  const v = cam.video;
  if (!cam.tracker || !v || v.readyState < 2 || v.currentTime === cam.lastVT) return null;
  cam.lastVT = v.currentTime;
  const res = cam.tracker.detectForVideo(v, performance.now());
  const f = videoFit();
  cam.frames++;
  if (t - cam.fpsT > 1) { cam.trackFps = Math.round(cam.frames / (t - cam.fpsT)); cam.frames = 0; cam.fpsT = t; }
  return (res.landmarks || []).map(lm => lm.map(p => ({ x: ctx.W - (p.x * f.vw * f.sc + f.ox), y: p.y * f.vh * f.sc + f.oy })));
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
  return { x: r.left + p.x * r.width / ctx.W, y: r.top + p.y * r.height / ctx.H };
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
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * ctx.W / r.width, y: (e.clientY - r.top) * ctx.H / r.height }; };
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
return { TRACKER, cam, modalOpen, loadTracker, startCamera, videoFit, readHands, newHand, processHands, moveFx, endFx, updateHand, pinchDown, pinchUp, dropHand, toClient, buttonAt, setHover, handClick, updateHandHover, initPointer, gatherPointers };
}

export function installVisionLifecycle(r){const cam=r.cam,video=document.querySelector('#cam');let disposed=false;const stop=s=>{try{s?.getTracks?.().forEach(t=>{try{t.stop()}catch(_){}})}catch(_){}},cleanup=()=>{if(disposed)return;const v=cam?.video||video,s=cam?.stream||v?.srcObject;stop(s);if(cam)cam.stream=null;if(v){try{v.pause()}catch(_){};v.srcObject=null}try{cam?.tracker?.close?.()}catch(_){}if(cam){cam.tracker=null;cam.lastVT=-1;cam.frames=0}disposed=true};video?.addEventListener('loadedmetadata',()=>{disposed=false});video?.addEventListener('error',cleanup);addEventListener('pagehide',cleanup,{once:true});addEventListener('beforeunload',cleanup,{once:true});r.disposeVision=cleanup}