# Music Maker



Stretch strings in the air, give each one an instrument, and play them with your fingers.
A single-page, camera-tracked instrument that runs entirely in the browser.

**Play it:** https://hashem-al-ghaili.github.io/music-maker/

## How it works

- **Stretch** – pinch thumb to index finger on both hands, pull apart, let go. A string stays where you left it.
- **Choose** – pick one of 24 instruments and a tone (major, minor, pentatonic, blues, dorian, hijaz).
- **Play** – sweep a fingertip across a string. Add a beat, loop your own layers, and record the result as video, MP3 or WAV.

No camera? Choose "Play with the mouse instead" on the start screen.

## Notes

- Use Chrome or Edge. The camera needs a secure (https) page, which GitHub Pages provides.
- Hand tracking uses MediaPipe Hand Landmarker, loaded from a CDN on first use.
- All sound is synthesised in the browser; there are no audio samples.
- MP3 export uses [lamejs](https://github.com/zhuker/lamejs) (LGPL-3.0), embedded in the page.
