// SEEDSED — voicebank.js
// Purpose: THE HELPER'S VOICE. Stores short recordings of the helper saying practice words, so the
//          app can play a familiar human voice instead of the computer voice.
// Storage: IndexedDB on this tablet only, keyed by the word's text (one recording serves that word
//          in every stage). Audio is kept as 16 kHz 16-bit mono (about 32 KB per second).
// Boundaries: storage and format only. Recording and playback are audio.js; never uploaded anywhere.

import { normaliseText } from "./mywords.js";

export const STORE_RATE = 16000;
const DB = "speak-again";
const STORE = "voices";

export function keyFor(text) {
  return normaliseText(text);
}

// Pure: average-downsample to the storage rate (speech needs nothing above 8 kHz).
export function downsample(samples, fromRate, toRate = STORE_RATE) {
  if (fromRate <= toRate) return Float32Array.from(samples);
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += samples[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

export function toInt16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
  return out;
}

export function toFloat32(i16) {
  const out = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) out[i] = i16[i] / 32767;
  return out;
}

function req(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

export class VoiceBank {
  constructor(idb = globalThis.indexedDB) {
    this.idb = idb;
    this.db = null;
    this.keys = new Set();
    this.ready = null;
  }

  open() {
    this.ready ||= (async () => {
      if (!this.idb) throw new Error("This browser can't store recordings.");
      const r = this.idb.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      this.db = await req(r);
      const tx = this.db.transaction(STORE, "readonly");
      for (const k of await req(tx.objectStore(STORE).getAllKeys())) this.keys.add(k);
      return this;
    })().catch(e => { this.ready = null; throw e; });
    return this.ready;
  }

  has(text) {
    return this.keys.has(keyFor(text));
  }

  get count() {
    return this.keys.size;
  }

  async save(text, recording) {
    await this.open();
    const k = keyFor(text);
    const pcm = toInt16(downsample(recording.samples, recording.sampleRate));
    const tx = this.db.transaction(STORE, "readwrite");
    await req(tx.objectStore(STORE).put({ pcm, sampleRate: STORE_RATE, savedAt: Date.now() }, k));
    this.keys.add(k);
  }

  async load(text) {
    await this.open();
    const v = await req(this.db.transaction(STORE, "readonly").objectStore(STORE).get(keyFor(text)));
    return v ? { samples: toFloat32(v.pcm), sampleRate: v.sampleRate } : null;
  }

  async remove(text) {
    await this.open();
    const k = keyFor(text);
    await req(this.db.transaction(STORE, "readwrite").objectStore(STORE).delete(k));
    this.keys.delete(k);
  }
}
