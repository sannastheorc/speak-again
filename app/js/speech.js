// SEEDSED — speech.js
// Purpose: SPOKEN MODEL. Reads targets, tips and praise aloud with the device's own voices,
//          which on iPad/iPhone/Android work offline. Picks the most natural installed English voice
//          (Premium/Enhanced/Siri first) unless the person has chosen one.
// Boundaries: output only. Resolves when speech ends (or a length-based safety timeout), so the app
//             never starts recording over its own voice.

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

// Apple's joke and very robotic voices; never offered.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

// Pure: English voices, most natural first. Offline (on-device) voices beat online ones.
export function rankVoices(voices) {
  const score = v => {
    const n = v.name || "";
    let s = 0;
    if (/premium/i.test(n)) s += 50;
    else if (/enhanced/i.test(n)) s += 40;
    else if (/siri/i.test(n)) s += 35;
    else if (/natural|neural/i.test(n)) s += 30;
    if (v.localService) s += 15;
    if (/^en[-_]US/i.test(v.lang)) s += 3;
    return s;
  };
  return voices
    .filter(v => /^en/i.test(v.lang || "") && !NOVELTY.test(v.name || ""))
    .map(v => ({ v, s: score(v) }))
    .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name))
    .map(x => x.v);
}

let ranked = [];
let chosenName = "";
const listeners = new Set();

function refresh() {
  try { ranked = rankVoices(speechSynthesis.getVoices()); } catch { ranked = []; }
  listeners.forEach(fn => fn());
}
if (canSpeak) {
  refresh();
  try { speechSynthesis.addEventListener("voiceschanged", refresh); } catch {}
}

export function listVoices() {
  return ranked.map(v => ({ name: v.name, lang: v.lang, offline: !!v.localService }));
}
export function onVoicesChanged(fn) { listeners.add(fn); }
export function setVoice(name) { chosenName = name || ""; }
export function currentVoiceName() { return currentVoice()?.name || ""; }

function currentVoice() {
  return (chosenName && ranked.find(v => v.name === chosenName)) || ranked[0] || null;
}

export function cancelSpeech() {
  if (canSpeak) try { speechSynthesis.cancel(); } catch {}
}

export function speak(text, { rate = 0.8 } = {}) {
  if (!canSpeak || !text) return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const end = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
    const t = setTimeout(end, 1500 + (text.length * 120) / rate);
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      const voice = currentVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
    } catch { end(); }
  });
}
