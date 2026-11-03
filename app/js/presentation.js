// SEEDSED — presentation.js
// Purpose: HOW AN ITEM IS PROMPTED at each step of the cue ladder. Repeating shows the word and
//          plays an example; the later stages hold the answer back so he finds it himself, and reveal
//          it only as the last rung (meaning first, then first letter, then the word).
// Input:  item, stage kind, step, solo, tips (curriculum TIPS), soloPrompt, stepPrompts.
// Output: { picture, display, before, prompt, hint, say, model, slow, hearLabel, hearModel, hear, showMeter }:
//         `say` lines are spoken first; `model` means then play the example of the answer. The Hear
//         button plays the example if `hearModel`, otherwise it speaks the `hear` lines. `askHint`,
//         when present, is what "Give me a hint" shows (empty: no hint left to give).
// Boundaries: pure. No audio, no DOM, no judging, no storage.

const firstLetter = text => text.trim()[0].toUpperCase();
const firstLetterHint = text => `It starts with "${firstLetter(text)}".`;

export function present(item, kind, step, solo, { tips, soloPrompt, stepPrompts }) {
  const tip = tips[item.tip] || "";
  const base = { picture: "", before: "", display: item.text, prompt: "", hint: "", say: [], model: false, slow: false, hearLabel: "Hear it", hearModel: true, hear: [], showMeter: false };

  if (kind === "voice") {
    return { ...base, prompt: `Hold the sound for ${item.holdSec} seconds.`, hint: step >= 1 ? tip : "", say: step === 1 ? [tip] : [],
      model: !solo, slow: step === 2, showMeter: true, hearLabel: step === 2 ? "Hear it slowly" : "Hear it" };
  }
  if (kind === "talk") {
    return { ...base, prompt: solo ? soloPrompt : `Talk for about ${item.talkSec} seconds. Tap Stop when you're done.`, hint: step >= 1 ? tip : "",
      say: [item.say], showMeter: true, hearLabel: "Hear the question", hearModel: false, hear: [item.say] };
  }

  switch (item.mode) {
    case "name": {
      const shown = step === 2 && !solo;
      return { ...base, picture: item.picture, display: shown ? item.text : "", prompt: solo ? soloPrompt : shown ? "Listen, then say it." : "What is this? Say it out loud.",
        hint: step === 1 ? `${item.hint} ${firstLetterHint(item.text)}` : "",
        say: solo || shown ? [] : step === 1 ? [item.hint] : ["What is this?"], model: shown, slow: shown,
        hearLabel: shown ? "Hear it slowly" : "Hear the question", hearModel: shown, hear: step === 1 && !solo ? [item.hint] : ["What is this?"],
        askHint: shown ? "" : `${item.hint} ${firstLetterHint(item.text)}` };
    }
    case "finish": {
      const shown = step === 2 && !solo;
      return { ...base, display: shown ? `${item.start} ${item.text}` : `${item.start} ___`, prompt: solo ? soloPrompt : shown ? "Listen, then say it." : "How does it end? Say it out loud.",
        hint: step === 1 ? firstLetterHint(item.text) : "", say: shown ? [] : [item.start], model: shown, slow: shown,
        hearLabel: shown ? "Hear it slowly" : "Hear the start", hearModel: shown, hear: [item.start],
        askHint: shown ? "" : firstLetterHint(item.text) };
    }
    case "choice": {
      const shown = step === 2 && !solo;
      return { ...base, prompt: solo ? soloPrompt : shown ? `You could say "${item.say}". Any answer is fine.` : "Say the one you choose.",
        hint: step >= 1 ? tip : "", say: [item.text], model: shown, hearLabel: "Hear the question", hearModel: false, hear: [item.text] };
    }
    case "script": {
      return { ...base, before: item.other, prompt: solo ? soloPrompt : stepPrompts[step], hint: step >= 1 ? tip : "",
        say: [...(step === 1 && !solo ? [tip] : []), ...(item.other.startsWith("(") ? [] : [item.other])], model: !solo, slow: step === 2,
        hearLabel: step === 2 ? "Hear it slowly" : "Hear it" };
    }
    default:
      return { ...base, prompt: solo ? soloPrompt : stepPrompts[step], hint: step >= 1 ? tip : "", say: step === 1 && !solo ? [tip] : [],
        model: !solo, slow: step === 2, hearLabel: step === 2 ? "Hear it slowly" : "Hear it" };
  }
}
