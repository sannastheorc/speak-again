// SEEDSED — assess.js
// Purpose: decide what ONE attempt was, from what the microphone measured and what the recognizer heard.
// Input:  item (curriculum), stage kind, observation { voicedMs, longestVoicedMs, transcript }.
// Output: { outcome, heard } where outcome is one of OUTCOMES.
// Boundaries: no wording (feedback.js), no storage (progress.js), no audio or model access.

export const OUTCOMES = Object.freeze({
  CORRECT: "correct",   // matched the target (or held the sound long enough)
  OTHER: "other",       // clearly heard a different word
  UNCLEAR: "unclear",   // voice heard, but no word recognised
  SHORT: "short",       // voice stage: sound too short
  SILENT: "silent"      // nothing loud enough to count as voice
});

export const MIN_VOICED_MS = 150;
export const HOLD_FRACTION = 0.8; // a hold counts at 80% of the target time

export function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\[unk\]/g, " ")
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(heard, phrase) {
  const h = ` ${heard} `;
  return h.includes(` ${normalise(phrase)} `);
}

export function assess(item, kind, obs) {
  const voicedMs = obs.voicedMs || 0;
  if (voicedMs < MIN_VOICED_MS) return { outcome: OUTCOMES.SILENT, heard: "" };

  if (kind === "voice") {
    const held = obs.longestVoicedMs || 0;
    const ok = held >= item.holdSec * 1000 * HOLD_FRACTION;
    return { outcome: ok ? OUTCOMES.CORRECT : OUTCOMES.SHORT, heard: "", heldMs: held };
  }

  const heard = normalise(obs.transcript);
  if (item.accept.some(p => containsPhrase(heard, p))) return { outcome: OUTCOMES.CORRECT, heard };
  if (heard) return { outcome: OUTCOMES.OTHER, heard };
  return { outcome: OUTCOMES.UNCLEAR, heard: "" };
}
