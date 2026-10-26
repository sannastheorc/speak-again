// SEEDSED — settings.js
// Purpose: the person's preferences (voice speed, session length, helper buttons, mirror, read-aloud).
// Boundaries: preferences only; no practice rules. Unknown or invalid stored values fall back to defaults.

const KEY = "speak-again/settings";

export const DEFAULTS = Object.freeze({
  rate: 0.8,          // model voice speed
  length: 12,         // items per session
  speakFeedback: true,
  helperButtons: true,
  autoMirror: true,   // open the mirror when the tip appears
  showHeard: false,   // show what the recognizer thought it heard (off: gentler)
  name: "",           // optional first name, used in greetings and praise
  askedName: false,   // the welcome question has been shown once
  voiceName: ""       // chosen device voice; empty = most natural installed voice
});

const VALID = {
  rate: v => [0.6, 0.8, 1].includes(v),
  length: v => [8, 12, 20].includes(v),
  speakFeedback: v => typeof v === "boolean",
  helperButtons: v => typeof v === "boolean",
  autoMirror: v => typeof v === "boolean",
  showHeard: v => typeof v === "boolean",
  name: v => typeof v === "string" && v.length <= 40,
  askedName: v => typeof v === "boolean",
  voiceName: v => typeof v === "string" && v.length <= 120
};

export function loadSettings(storage) {
  let stored = {};
  try { stored = JSON.parse(storage.getItem(KEY)) || {}; } catch {}
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (k in stored && VALID[k](stored[k])) out[k] = stored[k];
  return out;
}

export function cleanName(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function saveSettings(storage, settings) {
  try { storage.setItem(KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
