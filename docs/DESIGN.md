# Speak Again — design

SEEDSED. One owner per decision. Owners connect through the contracts below; `app.js` only wires them.

| Module | Decides | Input → Output | Must not |
|---|---|---|---|
| `curriculum.js` | What to practise | → stages, items `{id,text,say,accept,tip,group,holdSec}`, `listenPhrases()` | judge, store, order |
| `session.js` | Order, cue step, break offer | stage + progress → `current()`, `preview(ok)`, `submit(ok)`, `summary()` | touch audio, storage, wording |
| `audio.js` | Mic capture, voice activity, playback | tap → `Recording {samples, sampleRate, voicedMs, longestVoicedMs}` | judge or recognise |
| `recognizer.js` | Offline word recognition (Vosk) | Recording + phrases → `{text, words}` | judge |
| `assess.js` | Verdict for one attempt | item + measurements + transcript → `correct/other/unclear/short/silent` | word it, store it |
| `feedback.js` | What to say | outcome → `{tone, headline, detail, speak}` (gentleness contract inside) | decide correctness |
| `progress.js` | Memory and mastery rules | attempts → item and stage stats, recommendation | pick items |
| `settings.js` | Preferences | → validated settings | practice rules |
| `speech.js`, `mirror.js` | Voice model, camera mirror | output only | store anything |
| `sw.js` | Offline app shell | cache-first | cache the model (Vosk keeps it in IndexedDB) |

## Rules worth knowing

- **Cue ladder** (Sound Production Treatment style): step 0 listen and say; step 1 placement tip,
  mirror and the tip read aloud; step 2 slow model. After 3 tries the word is set aside and comes
  back once later in the session.
- **Mastery:** 3 of the last 4 tries correct. A stage is complete at 80% of its items mastered.
  Every stage stays open; "Start here" just recommends one.
- **Gentleness:** no negative words (enforced by a test), misses read aloud as encouragement only,
  what the recognizer heard is hidden by default, each session opens with a known word, a break is
  offered after 3 missed words in a row, and the results screen never shows a zero score.
- **Coach:** opens with "Let's get started, <name>"; a word said with a tip earns one bonus
  "now just you" try (no model played) and the session moves on whatever happens; every 3rd word in
  a row gets a "you're on a roll"; a completed stage offers "Next level" first; sessions end with
  "Same time tomorrow?". No timers, no pressure words (enforced by tests).
- **Personal touches:** optional first name (no account, no password); the most natural installed
  voice is picked automatically (Premium > Enhanced > Siri > others, offline first) or chosen in Settings.
- **Recognizer listen-list:** the target's accepted forms plus up to 8 nearby items from the same
  group, plus `[unk]`. A near miss is heard as a different word instead of being forced to the target.
- **Stale results:** every async step carries an attempt id. A result that arrives after the screen
  has moved on is dropped.
- **Lifecycle:** progress is saved after every attempt. The mic is released after every attempt;
  cleanup errors are logged and never replace the real error.
- **Updates:** a new version waits until "Update now" is tapped, so practice is never interrupted.
  Bump `VERSION` in `sw.js` whenever a shell file changes.
