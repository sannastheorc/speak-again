// SEEDSED — planner.js
// Purpose: TODAY'S PRACTICE. Builds the one-button daily session (about 10 minutes):
//   1. a warm-up word he already knows, so the day starts with a success;
//   2. learned words that are due for review (spaced schedule in progress.js);
//   3. extra words for his weakest sounds;
//   4. a couple of his own words, if the helper added any;
//   5. new words from his current stage, filling the rest.
//   Then they're interleaved so no part of the session is all hard or all review.
// Input:  { stages, progress, extra: [{stage,item}] (his own words), length, rng }.
// Output: [{ stage, item }] entries for a Session.
// Boundaries: pure. Never changes progress; never decides correctness or wording.

export const PLAN = Object.freeze({ length: 15, reviewShare: 0.3, weakShare: 0.2, mine: 2, weakBelow: 0.6, weakMinTries: 4 });

const key = e => `${e.stage.id}/${e.item.id}`;

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDailyPlan({ stages, progress, extra = [], length = PLAN.length, rng = Math.random }) {
  const focus = progress.recommendedStage(stages);
  const focusAt = stages.indexOf(focus);
  const reached = stages.slice(0, focusAt + 1);
  const mastered = e => progress.itemStats(e.stage.id, e.item.id).mastered;
  const entriesOf = list => list.flatMap(stage => stage.items.map(item => ({ stage, item })));
  const taken = new Set();
  const take = (list, n) => {
    const out = [];
    for (const e of list) {
      if (out.length >= n) break;
      if (!taken.has(key(e))) { taken.add(key(e)); out.push(e); }
    }
    return out;
  };

  // The voice warm-up stage is its own short routine.
  if (focus.kind === "voice") return take(entriesOf([focus]), Math.min(length, focus.items.length));

  const known = entriesOf(reached).filter(mastered);
  const warmUp = take(shuffle(known, rng), 1);
  // Reviews: most overdue first, but at most one voice hold (they're warm-ups, not words).
  const due = progress.dueEntries(reached);
  const firstHold = due.find(e => e.stage.kind === "voice");
  const review = take(due.filter(e => e.stage.kind !== "voice" || e === firstHold), Math.ceil(length * PLAN.reviewShare));

  const stats = progress.soundStats(stages); // all practice counts, even ahead of his current stage
  const weakSounds = Object.entries(stats)
    .filter(([, s]) => s.tries >= PLAN.weakMinTries && s.rate < PLAN.weakBelow)
    .sort((a, b) => a[1].rate - b[1].rate)
    .map(([s]) => s);
  const weakPool = entriesOf(stages.slice(0, focusAt + 2))
    .filter(e => !mastered(e) && e.item.sounds?.some(s => weakSounds.includes(s)))
    .sort((a, b) => weakSounds.indexOf(a.item.sounds.find(s => weakSounds.includes(s))) - weakSounds.indexOf(b.item.sounds.find(s => weakSounds.includes(s))));
  const weak = take(weakPool, Math.ceil(length * PLAN.weakShare));

  const mine = take([...extra.filter(e => !mastered(e)), ...shuffle(extra.filter(mastered), rng)], PLAN.mine);

  const room = Math.max(0, length - warmUp.length - review.length - weak.length - mine.length);
  const later = stages.slice(focusAt + 1);
  const fresh = take([...entriesOf([focus]).filter(e => !mastered(e)), ...entriesOf(later).filter(e => !mastered(e))], room);
  // Not enough new material (everything learned): fill with more review of what he knows.
  const filler = take(shuffle(known, rng), length - warmUp.length - review.length - weak.length - mine.length - fresh.length);

  // Interleave: new, review, weak, mine, new, ... after the warm-up.
  const lanes = [fresh, review, weak, mine, filler].map(l => l.slice());
  const mixed = [];
  while (lanes.some(l => l.length)) for (const l of lanes) if (l.length) mixed.push(l.shift());
  return [...warmUp, ...mixed];
}
