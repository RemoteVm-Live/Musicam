# Musicam — Cyber Matrix V2

A separate experimental redesign branch. The original `main` branch remains the preserved baseline.

## Branch and baseline

- Branch: `cyber-matrix-v2`
- Base: `main` at `892e51da7c96fdc1e7d4904e07df1058b4e4f05e`
- No changes are made to `main` by this branch.
- V2 is a compatibility-first modular refactor and remains experimental until browser regression and licensing checks are complete.

## Run locally

Serve this folder over HTTP or HTTPS; do not open it with `file://`. Camera access requires HTTPS or localhost and explicit browser permission. A current Chromium-based browser is recommended.

## Six-file application layout

```
index.html
styles.css
js/
  app.js
  audio.js
  vision.js
  visuals.js
```

- `index.html`: page shell, original embedded LAME encoder, V2 controls, and module entry point.
- `styles.css`: extracted original stylesheet plus responsive Cyber Matrix green / cyan / violet theme.
- `js/app.js`: application composition root, central state, UI/event orchestration, setup storage, demo and lifecycle wiring. It creates subsystem modules through dependency-injected context objects.
- `js/audio.js`: Web Audio graph, instrument synthesis, effects, beats, transport, loop layers, PCM capture, WAV/MP3/video audio handling, offline rendering and stems. The original audio graph and scheduling behavior are retained.
- `js/vision.js`: MediaPipe loading, camera lifecycle, landmark processing, gesture recognition, pinch/mapping behavior, pointer and mouse fallback. It receives the live stage dimensions through context accessors.
- `js/visuals.js`: original Canvas renderer, instrument icon drawing, hand overlays, stage rendering and V2 audio-reactive Matrix / Fractal / Oscilloscope / Spectrum overlay.

## Preserved functionality

The refactor retains the original 24 instruments, seven scale configurations, two-hand MediaPipe tracking, mouse fallback, 12 virtual strings, beat patterns and transport, up to eight loop layers, v1 JSON setups, WAV/MP3/video recording, stem ZIP export and scripted demo.

The original gesture mapping semantics, transport, recording pipeline, and the 20 retained instrument algorithms are preserved. Four legacy instrument slots keep their stored IDs but now use dedicated experimental synthesis engines: `marimba` → ABYSS, `kalimba` → MUTANT, `steelpan` → RIFT, and `bells` → VOID. Setup v1 serialization remains ID-compatible; the new engine patches are stored separately as local presets.

## Psy profiles and macros

- Psychedelic, Psyambient and Psytrance profiles are exposed with PSY, DARK, MOTION, and SPACE macros.
- The four replacement slots use independent engines: ABYSS (evolving layered drone), MUTANT (three-stage cascaded FM), RIFT (inharmonic resonator bank, ring-modulated path and bounded comb feedback), and VOID (procedural looping grain cloud).
- A dedicated Sound Design panel exposes engine-specific controls, six factory patches per engine, local user preset save/load, bounded randomization, A/B patch snapshots, and a live waveform/spectrum monitor.
- Engine controls are applied to active voices where the synthesis graph supports safe AudioParam updates; structural settings such as resonator/grain counts are bounded by the active voice's existing graph.
- The RIFT ring-mod path is a gain-modulation implementation, not a frequency shifter. MUTANT uses a cascaded three-operator FM topology; it does not claim DX-style operator feedback or exact phase modulation.
- VOID uses a generated procedural texture buffer and a bounded set of looping grain windows; external sample loading is not included.
- Shared engine send routing feeds the existing reverb and tempo echo buses. Stereo spread uses a controlled dual-path Haas-style widening network.
- The global stage visualizer continues to consume the real output analyser signal; the sound-design panel has its own compact analyser monitor.

## Reliability work in this branch

- Camera stream is retained on the vision subsystem and tracks are stopped during startup failure and page lifecycle cleanup.
- HandLandmarker close is guarded and the video element is detached on cleanup.
- Shared stage dimensions are exposed through live context getters to avoid stale values after landscape/vertical stage changes.
- Module factories receive explicit context objects; application state ownership remains in `app.js`.

## Validation status

Static JavaScript parse checks passed for all four application modules after the sound-engine and UI changes. This is not equivalent to browser runtime validation. The new synthesis algorithms and UI wiring have not yet been auditioned or stress-tested in a real browser. No claim is made that real camera, audio hardware, recording, export, mobile layout, or long-session tests have passed in this environment.

Before release, run the complete browser regression matrix: startup and demo; mouse interaction; camera permission grant/deny; GPU-to-CPU MediaPipe fallback; repeated camera start/stop; all instruments and scales; gesture mapping; beats/BPM/chord/layers; Setup v1 import/export; WAV/MP3/video recording; offline stems/ZIP; reduced motion; responsive layouts; and repeated AudioContext lifecycle transitions.

## Dependencies and licensing

- MediaPipe Tasks Vision is pinned to `0.10.14`; the Hand Landmarker model is loaded from Google's model hosting.
- The embedded `lamejs` 1.2.1 encoder is identified by the upstream project as LGPL-3.0. Preserve the copyright/license notice and include the applicable LGPL license text and source availability obligations before redistribution.
- No framework, build system, backend, or additional runtime dependency was introduced.

## Release status

Experimental branch only. The four synth engines and Sound Design console are implemented on this branch, but this is not a production release. Do not merge into `main` or distribute until browser/runtime regression, audio listening, CPU/memory stress tests, Setup v1 compatibility, recording/export tests, and LGPL packaging are completed.


## Sound engine implementation notes

- Engine IDs remain `marimba`, `kalimba`, `steelpan`, and `bells` to avoid changing stored Setup v1 string instrument IDs.
- Factory preset data and engine parameter defaults live in `js/audio.js`; user-created presets are stored in browser LocalStorage under `musicam.soundDesign.presets.v1`.
- A/B snapshots are in-memory and scoped per engine; user presets persist locally.
- ABYSS sustains while its string voice is held and has a bounded maximum voice duration. It is not yet an independent free-running drone track.
- MUTANT is a cascaded carrier/modulator implementation using native oscillators and AudioParams. It is not a full general-purpose modular FM matrix.
- RIFT uses parallel Biquad resonators and a feedback comb path capped below unity. Its ring modulation is a gain-modulation approximation.
- VOID uses up to 24 looping grains per voice from a generated two-second texture buffer. It does not yet provide sample import or a full continuously rescheduled granular cloud.
- The master chain and offline rendering path have not yet been validated with the new engine nodes. Treat stems and OfflineAudioContext support as unverified until runtime tests pass.
