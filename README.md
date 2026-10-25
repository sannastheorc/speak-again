# Speak Again

SEEDSED. An offline speech-practice app (PWA) for rebuilding speech after a stroke. It goes from
voice warm-up and the alphabet through lip, tongue-tip and back-of-tongue sounds, to short words,
longer words and everyday phrases. It reads each target aloud, listens with an on-device recognizer,
encourages gently, coaches tongue and lip placement, and can show a camera mirror.

- Why it's built this way: [docs/RESEARCH.md](docs/RESEARCH.md)
- How it's built: [docs/DESIGN.md](docs/DESIGN.md)

## Status (2026-10-25)

Candidate version 0.1.0. **Not yet tried on a real iPad, or with his voice.**

What has been verified, in Chromium on Linux:
- 21 unit tests pass (`npm test`), including a check that every practice word is in the model's vocabulary.
- In-browser: the model loads, a known recording is transcribed exactly, and unrelated words come back as unknown.
- The practice flow runs end to end, with a recorded clip standing in for the microphone.
- The cue ladder, helper override and break offer all work.
- **Offline:** with the server stopped, the app opens, the recognizer loads from the device, and the
  voice warm-up measures a 0.9 s and a 2.6 s hold correctly.

Still to check on the iPad:
- The microphone permission prompt, and whether iOS asks again on each try.
- Speaker volume after recording.
- The text-to-speech voice quality.
- Recognition accuracy on his speech.

## Run it on this computer

```bash
npm run model    # one time: downloads and verifies the 41 MB speech model
```

```bash
npm test
```

```bash
npm run serve    # then open http://127.0.0.1:8642/app/
```

## Put it on the iPad

iPads only allow the microphone and offline mode over **HTTPS**, so the `app/` folder (including
`app/model/model.tar.gz`) needs to be hosted somewhere with HTTPS, for example GitHub Pages or Netlify.
Then, on the iPad:
1. Open the link in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the Home Screen and tap **Set up now** while on Wi-Fi.

After that it works with no internet.

## Third-party parts

- `app/vendor/vosk.js`: vosk-browser 0.0.8, Apache-2.0 (sha256 `29504515526e974f4cb053cf08811c4de5fb2a74007c0a5a957db50eaa8d5d0c`).
- Speech model: vosk-model-small-en-us-0.15, Apache-2.0, fetched by `scripts/fetch-model.sh` and checksum-verified.

`tests/fixtures/vosk-sample.wav`: sample recording from the Vosk project (Apache-2.0), used only by the browser test.

`prototype/single-page-draft.html` is an earlier one-page draft (no microphone, no offline), kept for reference.
