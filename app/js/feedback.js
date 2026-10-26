// SEEDSED — feedback.js
// Purpose: WHAT TO SAY after an attempt. Turns an assessed outcome into short, warm, specific words.
// Input:  { outcome, heard, heldMs } from assess.js, plus { item, tipText, lastTry, showHeard, n }.
// Output: { tone, headline, detail, speak } — `speak` is the short line read aloud.
// Boundaries: never decides correctness and never stores anything.
// Gentleness contract (the person is sensitive about losing speech):
//   - never "wrong", "incorrect", "fail", "no", "mistake" or "error";
//   - effort is praised on every try; misses become a concrete, kind next step;
//   - what the recognizer thought it heard is shown only if `showHeard` is on (off by default);
//   - the spoken line after a miss is encouragement only, never a description of the miss.
// The recognizer is imperfect (about 80% agreement with human listeners in Ballard 2019), which is
// one more reason a miss is always "let's try again".

import { OUTCOMES } from "./assess.js";

const PRAISE = ["Yes! That's it.", "Great job!", "Nice and clear!", "You got it!", "Well done!", "That sounded good!", "Wonderful!"];
const EFFORT = ["Good try.", "Nice effort.", "You're working hard. Good.", "That's the way, keep at it.", "Good work trying."];
const MOVE_ON = "Good effort. We'll come back to this one later.";

// Adds the person's name to every other praise line: "Great job!" -> "Great job, Dave!".
export function withName(line, name, n = 0) {
  if (!name || n % 2) return line;
  return line.replace(/[.!]+$/, "") + `, ${name}!`;
}

export function pick(list, n) {
  return list[Math.abs(n | 0) % list.length];
}

export function feedback(result, ctx) {
  const n = ctx.n || 0;
  if (ctx.solo) {
    // The bonus "just you" try after a word came with a tip: celebrate a success, shrug off a miss.
    if (result.outcome === OUTCOMES.CORRECT) {
      const h = withName("You did it on your own!", ctx.name, 0);
      return { tone: "great", headline: h, detail: "No help needed that time.", speak: h };
    }
    if (result.outcome !== OUTCOMES.SILENT) {
      return { tone: "try", headline: "That's okay.", detail: "You already said it with the tip. Let's keep going.", speak: "That's okay. Let's keep going." };
    }
  }
  switch (result.outcome) {
    case OUTCOMES.CORRECT: {
      const h = withName(pick(PRAISE, n), ctx.name, n);
      const detail = result.heldMs ? `You held it for ${(result.heldMs / 1000).toFixed(1)} seconds.` : `That was "${ctx.item.text}".`;
      return { tone: "great", headline: h, detail, speak: h };
    }
    case OUTCOMES.SHORT: {
      const secs = ((result.heldMs || 0) / 1000).toFixed(1);
      return {
        tone: "try", headline: "Good, I heard your voice!",
        detail: `You held it for ${secs} seconds. Take a big breath and keep it going until the bar is full.`,
        speak: "Good. Big breath, and keep it going."
      };
    }
    case OUTCOMES.OTHER:
    case OUTCOMES.UNCLEAR: {
      const headline = pick(EFFORT, n);
      const heard = ctx.showHeard && result.heard ? `It sounded like "${result.heard}" to me. ` : "";
      const detail = ctx.lastTry ? heard + MOVE_ON : heard + ctx.tipText;
      return { tone: "try", headline, detail, speak: ctx.lastTry ? MOVE_ON : headline + " Let's try again." };
    }
    case OUTCOMES.SILENT:
    default:
      return {
        tone: "info", headline: "Ready when you are.",
        detail: "Tap the button and say it whenever you're ready. A little louder helps me hear you.",
        speak: "Ready when you are."
      };
  }
}

// Coaching line for each step of the cue ladder (session.js decides the step).
export const STEP_PROMPTS = [
  "Listen, then say it.",
  "Watch your mouth in the mirror. Try the tip.",
  "Listen slowly once more, then say it right after."
];

// The coach: supportive, with a gentle push now and then. Never pressure, never a timer.
export const COACH = {
  start: name => withName("Let's get started.", name, 0),
  soloNudge: "Now let's try it on your own.",
  soloPrompt: "Now just you. No help this time.",
  roll: ["You're on a roll!", "Look at you go!", "Keep it coming!"],
  nextLevel: "You've learned most of these. Ready to try the next level?",
  goodbye: name => withName("Good work today. Same time tomorrow?", name, 0)
};

// Offered when several words in a row didn't come (session.js decides when).
export const BREAK_OFFER = {
  headline: "These are tricky ones today.",
  detail: "You're doing the hard work. Would you like a short rest, or try an easier stage for a while?"
};
