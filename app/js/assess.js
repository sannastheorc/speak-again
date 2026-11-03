// SEEDSED — assess.js
// Purpose: decide what ONE attempt was, from what the microphone measured and what the recognizer heard.
// Input:  item (curriculum), stage kind, observation { voicedMs, longestVoicedMs, transcript }.
// Output: { outcome, heard, matched?, part? } where outcome is one of OUTCOMES. `matched` is the accepted
//         answer that was heard; `part` is { said, of } when a long line earned credit for most of its words.
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

// How many of the target's words came through, in order (longest common subsequence).
export function wordsInOrder(heard, target) {
  const a = heard.split(" ").filter(Boolean), b = target.split(" ").filter(Boolean);
  let row = new Array(b.length + 1).fill(0);
  for (const w of a) {
    const next = [0];
    for (let j = 1; j <= b.length; j++) next[j] = w === b[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
    row = next;
  }
  return row[b.length];
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

  if (kind === "talk") {
    const ok = voicedMs >= item.talkSec * 1000 * HOLD_FRACTION;
    return { outcome: ok ? OUTCOMES.CORRECT : OUTCOMES.SHORT, heard: "", heldMs: voicedMs, talked: true };
  }

  const heard = normalise(obs.transcript);
  const matched = item.accept.find(p => containsPhrase(heard, p));
  if (matched) return { outcome: OUTCOMES.CORRECT, heard, matched };
  if (item.partial) {
    const target = normalise(item.accept[0]);
    const said = wordsInOrder(heard, target), of = target.split(" ").length;
    if (said / of >= item.partial) return { outcome: OUTCOMES.CORRECT, heard, part: { said, of } };
  }
  if (heard) return { outcome: OUTCOMES.OTHER, heard };
  return { outcome: OUTCOMES.UNCLEAR, heard: "" };
}
