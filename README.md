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

The original gesture mapping semantics and audio engine algorithms were not intentionally redesigned. V2 profile controls are additive parameter changes against the existing audio graph.

## Psy profiles and macros

- Psychedelic, Psyambient and Psytrance presets are exposed as profiles.
- PSY, DARK and MOTION macros adjust existing filter / echo parameters with bounded targets.
- No independent replacement synthesis engines or unsupported FM features are claimed.
- Visualizer modes consume the real audio output analyser signal. The original stage renderer remains active underneath the optional overlay.

## Reliability work in this branch

- Camera stream is retained on the vision subsystem and tracks are stopped during startup failure and page lifecycle cleanup.
- HandLandmarker close is guarded and the video element is detached on cleanup.
- Shared stage dimensions are exposed through live context getters to avoid stale values after landscape/vertical stage changes.
- Module factories receive explicit context objects; application state ownership remains in `app.js`.

## Validation status

Static JavaScript parse checks passed for the four application modules after extraction. This is not equivalent to browser runtime validation. No claim is made that real camera, audio hardware, recording, export, mobile layout, or long-session tests have passed in this environment.

Before release, run the complete browser regression matrix: startup and demo; mouse interaction; camera permission grant/deny; GPU-to-CPU MediaPipe fallback; repeated camera start/stop; all instruments and scales; gesture mapping; beats/BPM/chord/layers; Setup v1 import/export; WAV/MP3/video recording; offline stems/ZIP; reduced motion; responsive layouts; and repeated AudioContext lifecycle transitions.

## Dependencies and licensing

- MediaPipe Tasks Vision is pinned to `0.10.14`; the Hand Landmarker model is loaded from Google's model hosting.
- The embedded `lamejs` 1.2.1 encoder is identified by the upstream project as LGPL-3.0. Preserve the copyright/license notice and include the applicable LGPL license text and source availability obligations before redistribution.
- No framework, build system, backend, or additional runtime dependency was introduced.

## Release status

Experimental branch only. Do not merge into `main` or distribute as a production release until browser/runtime regression tests and LGPL packaging are completed.
