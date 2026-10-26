// SEEDSED — mywords.js
// Purpose: HIS OWN WORDS. The helper adds names, places and favourite things; they become the
//          "My words" stage and join the daily plan. Each word is checked against the listener's
//          vocabulary: known words are checked automatically, unknown ones (often names) are
//          judged by him or the helper, so they still work.
// Input:  text typed by the helper; the vocabulary word set (from data/vocab.txt).
// Output: curriculum-shaped items and the "mine" stage; saved in this browser only.
// Boundaries: no judging, no audio. Never sends the words anywhere.

const KEY = "speak-again/mywords";
export const MY_STAGE_ID = "mine";
export const MAX_WORDS = 200;

export function normaliseText(text) {
  return String(text || "").toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
}

// A rough first-sound guess from spelling, for the mouth tip and weak-sound tracking.
const DIGRAPHS = { sh: "sh", ch: "ch", th: "th", ph: "f", wh: "w", kn: "n", wr: "r" };
const LETTERS = { b: "b", c: "k", d: "d", f: "f", g: "g", h: "h", j: "j", k: "k", l: "l", m: "m", n: "n", p: "p", q: "k", r: "r", s: "s", t: "t", v: "v", w: "w", y: "y", z: "z", x: "z" };
export function firstSound(text) {
  const w = normaliseText(text);
  return DIGRAPHS[w.slice(0, 2)] || LETTERS[w[0]] || null;
}

export function makeItem(text, vocab, takenIds = new Set()) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const norm = normaliseText(clean);
  if (!norm) return null;
  const words = norm.split(" ");
  let id = norm.replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "") || "word";
  for (let n = 2; takenIds.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
  const sound = firstSound(norm);
  const known = vocab ? words.every(w => vocab.has(w)) : false;
  return {
    id, text: clean, say: clean, accept: [norm],
    tip: words.length > 1 ? "phrase" : sound || "phrase",
    sounds: sound ? [sound] : [],
    selfCheck: !known // the listener doesn't know it, so he or the helper judges
  };
}

export function myStage(items) {
  return {
    id: MY_STAGE_ID, title: "My words", kind: "speech",
    goal: "Names and words that matter to you.", items
  };
}

export function loadMyWords(storage) {
  try {
    const list = JSON.parse(storage.getItem(KEY));
    return Array.isArray(list) ? list.filter(i => i && i.id && i.text && Array.isArray(i.accept)) : [];
  } catch {
    return [];
  }
}

export function saveMyWords(storage, items) {
  try { storage.setItem(KEY, JSON.stringify(items.slice(0, MAX_WORDS))); return true; } catch { return false; }
}

let vocabPromise = null;
export function loadVocab(url = "data/vocab.txt") {
  vocabPromise ||= fetch(url)
    .then(r => (r.ok ? r.text() : Promise.reject(new Error(`vocab ${r.status}`))))
    .then(t => new Set(t.split("\n")))
    .catch(e => { vocabPromise = null; console.warn("Vocabulary unavailable:", e); return null; });
  return vocabPromise;
}
