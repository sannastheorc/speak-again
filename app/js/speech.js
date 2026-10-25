// SEEDSED — speech.js
// Purpose: SPOKEN MODEL. Reads targets, tips and praise aloud with the device's own voices,
//          which on iPad/iPhone/Android work offline.
// Boundaries: output only. Resolves when speech ends (or a length-based safety timeout), so the app
//             never starts recording over its own voice.

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
let voice = null;

function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    voice =
      vs.find(v => v.localService && /en-US/i.test(v.lang) && /samantha|enhanced|premium|natural/i.test(v.name)) ||
      vs.find(v => v.localService && /en-US/i.test(v.lang)) ||
      vs.find(v => v.localService) || vs[0] || null;
  } catch { voice = null; }
}
if (canSpeak) {
  pickVoice();
  try { speechSynthesis.addEventListener("voiceschanged", pickVoice); } catch {}
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
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
    } catch { end(); }
  });
}
