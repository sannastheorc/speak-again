// SEEDSED — recognizer.js
// Purpose: OFFLINE WORD RECOGNITION. Wraps vosk-browser (Kaldi compiled to WebAssembly, Apache-2.0).
//          The model downloads once, then lives in the browser's IndexedDB and loads without a network.
// Input:  Recording from audio.js and the list of phrases to listen for (curriculum.listenPhrases).
// Output: { text, words: [{ word, conf }] }.
// Boundaries: never judges right/wrong (assess.js). One recognition at a time; each uses its own
//             recognizer, so a late result from an old attempt can never be attributed to a new one.

const CHUNK_SEC = 1;
const TIMEOUT_MS = 15000;

export class Recognizer {
  constructor(modelUrl, vosk = globalThis.Vosk) {
    // vosk-browser fetches from inside a blob: worker, and caches by URL string, so it must be absolute and stable.
    this.modelUrl = new URL(modelUrl, globalThis.location?.href).href;
    this.vosk = vosk;
    this.model = null;
    this.state = "idle"; // idle | loading | ready | error
    this.error = null;
    this.loading = null;
    this.chain = Promise.resolve();
  }

  load() {
    if (this.loading) return this.loading;
    this.state = "loading";
    this.loading = (async () => {
      if (!this.vosk) throw new Error("Speech engine script did not load.");
      const model = await this.vosk.createModel(this.modelUrl, -1);
      model.on("error", m => console.warn("Recognizer:", m.error));
      this.model = model;
      this.state = "ready";
      return this;
    })().catch(e => {
      this.state = "error";
      this.error = e;
      this.loading = null; // allow a retry
      throw e;
    });
    return this.loading;
  }

  recognize(recording, phrases) {
    const job = this.chain.then(() => this.#run(recording, phrases));
    this.chain = job.catch(() => {});
    return job;
  }

  #run(recording, phrases) {
    if (this.state !== "ready") return Promise.reject(new Error("Recognizer not ready"));
    const grammar = JSON.stringify([...new Set(phrases.map(p => p.toLowerCase()))].concat("[unk]"));
    const rec = new this.model.KaldiRecognizer(recording.sampleRate, grammar);
    rec.setWords(true);

    const { samples, sampleRate } = recording;
    const step = Math.round(sampleRate * CHUNK_SEC);
    const chunkCount = Math.max(1, Math.ceil(samples.length / step));
    // The worker answers each audio chunk with exactly one event, then retrieveFinalResult with one more.
    const expected = chunkCount + 1;

    return new Promise((resolve, reject) => {
      let seen = 0;
      const texts = [];
      const words = [];
      const timer = setTimeout(() => finish(new Error("Recognition timed out")), TIMEOUT_MS);
      const finish = err => {
        clearTimeout(timer);
        try { rec.remove(); } catch (e) { console.warn("Recognizer cleanup:", e); }
        if (err) reject(err);
        else resolve({ text: texts.join(" ").trim(), words });
      };
      const count = () => { if (++seen === expected) finish(); };
      rec.on("result", m => {
        const r = m.result || {};
        if (r.text) texts.push(r.text);
        if (Array.isArray(r.result)) words.push(...r.result.map(w => ({ word: w.word, conf: w.conf })));
        count();
      });
      rec.on("partialresult", count);
      rec.on("error", m => finish(new Error(m.error || "Recognition failed")));

      for (let i = 0; i < chunkCount; i++) {
        rec.acceptWaveformFloat(samples.slice(i * step, (i + 1) * step), sampleRate);
      }
      rec.retrieveFinalResult();
    });
  }
}
