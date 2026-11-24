# Musicam — Cyber Matrix V2

A separate experimental redesign branch of Musicam. The original `main` branch is preserved unchanged.

## Branch and baseline

- Branch: `cyber-matrix-v2`
- Base: `main` at `892e51da7c96fdc1e7d4904e07df1058b4e4f05e`
- Original interaction and sound engine are retained as the compatibility baseline.
- This branch is not yet a release candidate; see the verification notes below.

## Run locally

Use a local HTTP server (ES modules do not run reliably from `file://`) or deploy to GitHub Pages over HTTPS. Open `index.html` in a current Chromium-based browser. Camera access requires HTTPS or localhost and user permission.

## Current V2 file layout

```
index.html
styles.css
js/
  app.js
  audio.js
  vision.js
  visuals.js
```

- `index.html`: semantic page shell, original embedded LAME encoder, V2 controls, and ES-module entry point.
- `styles.css`: extracted original stylesheet plus the Cyber Matrix green / cyan / violet theme.
- `js/app.js`: original application runtime, including the existing synthesis engine, gesture mapping, MediaPipe integration, drawing, recording/export, setups, and demo. It also installs the V2 modules.
- `js/audio.js`: additive Psychedelic / Psyambient / Psytrance profile and macro controls that adjust existing audio graph parameters.
- `js/vision.js`: camera stream tracking and cleanup hooks, including startup-failure and page-lifecycle cleanup.
- `js/visuals.js`: optional audio-reactive Matrix, Fractal, Oscilloscope, and Spectrum overlay using the existing output analyser signal.

## Preserved baseline features

The original app runtime is retained in `js/app.js`: 24 instruments, seven scale configurations, two-hand MediaPipe tracking, mouse fallback, 12 virtual strings, beat patterns and transport, up to eight loop layers, setups (v1 JSON), WAV/MP3/video recording, stem export, and scripted demo mode.

The original pinch/gesture mapping is intentionally not redesigned in this compatibility pass.

## Important implementation boundary

This is a compatibility-first V2 foundation, not the completed deep module extraction originally envisioned. The legacy engine still lives together in `js/app.js`; the audio, gesture-recognition, and canvas-rendering internals have **not** yet been fully separated into their respective modules. The new profile layer changes existing graph parameters only; it does not add independent synthesis engines or claim new FM capabilities. The visualizer is an overlay and does not replace the original stage renderer.

Before calling this release-ready, complete the deeper dependency-injection extraction and run the browser regression suite on real hardware. In particular, test AudioContext lifecycle, all instruments and scales, camera permission denial and repeated start/stop, gesture mapping, long recording sessions, MP3/WAV/video export, offline stems, setup v1 import/export, reduced motion, and mobile layouts.

## Dependencies and licensing

- MediaPipe Tasks Vision is loaded from the pinned `0.10.14` CDN bundle by the existing runtime; the hand-landmarker model is loaded from Google's model hosting.
- The embedded `lamejs` 1.2.1 encoder is identified by the upstream project as LGPL-3.0. Preserve its copyright/license notice and include the applicable LGPL license text and source availability obligations before redistributing a release.
- No framework, build system, backend, or new runtime dependency was added.

## Release status

Experimental branch only. Static source review has been performed during branch construction, but no browser/runtime test, automated test suite, or real camera/audio hardware validation has been run in this environment. Do not merge into `main` until the remaining module extraction, license packaging, and regression checks are complete.
