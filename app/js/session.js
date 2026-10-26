// SEEDSED — session.js
// Purpose: the ORDER and CUE LADDER of one practice session (Sound Production Treatment style):
//          step 0 listen-and-say, step 1 placement tip + mirror, step 2 slow model; after a success
//          the next item comes, after the last step the item is set aside and returns once later.
//          Coach nudge: a success that needed a tip earns one bonus "now just you" try; whatever
//          happens on that try, the session moves on (a gentle push, never a penalty).
// Input:  stage, progress (for mastery), options { length, rng }.
// Output: current() -> { item, step, index, total } | null; submit(ok) advances; summary().
// Boundaries: no audio, no storage writes, no wording. Pure state machine, fully testable.

export const MAX_STEPS = 3;

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const BREAK_AFTER_MISSES = 3;

export function planItems(stage, progress, length, rng = Math.random) {
  // Not-yet-mastered items first (in curriculum order, which keeps early practice predictable),
  // mastered ones mixed in for review. If something is already mastered, one of those opens the
  // session so it starts with a success.
  const stats = i => progress.itemStats(stage.id, i.id);
  const learning = stage.items.filter(i => !stats(i).mastered);
  const review = shuffle(stage.items.filter(i => stats(i).mastered), rng);
  const warmUp = learning.length && review.length ? [review.shift()] : [];
  const base = learning.length ? warmUp.concat(learning, review) : shuffle(stage.items, rng);
  const out = [];
  while (out.length < length) out.push(...base);
  return out.slice(0, Math.max(1, length));
}

export class Session {
  constructor(stage, progress, { length = 12, rng = Math.random } = {}) {
    this.stage = stage;
    this.queue = planItems(stage, progress, length, rng);
    this.total = this.queue.length;
    this.done = 0;
    this.step = 0;
    this.results = []; // { itemId, ok, step }
    this.retried = new Set();
  }

  current() {
    if (!this.queue.length) return null;
    return { item: this.queue[0], step: this.step, solo: !!this.solo, index: this.done, total: this.total };
  }

  get finished() {
    return this.queue.length === 0;
  }

  // What submit(ok) would return, without changing anything (lets the UI label its button
  // while a helper can still correct the verdict).
  preview(ok) {
    if (!this.current()) return "done";
    if (this.solo) return this.queue.length > 1 ? "next" : "done";
    if (ok && this.step > 0) return "solo";
    if (!ok && this.step + 1 < MAX_STEPS) return "retry";
    return this.queue.length > 1 ? "next" : "done";
  }

  // Returns "next" (new item), "retry" (same item, next step), "solo" (same item, one try
  // without help) or "done".
  submit(ok) {
    const cur = this.current();
    if (!cur) return "done";
    if (this.solo) {
      this.results[this.results.length - 1].soloOk = !!ok;
      return this.#advance();
    }
    if (ok) {
      this.results.push({ itemId: cur.item.id, ok: true, step: this.step });
      if (this.step > 0) {
        this.solo = true;
        this.step = 0;
        return "solo";
      }
      return this.#advance();
    }
    if (this.step + 1 < MAX_STEPS) {
      this.step++;
      return "retry";
    }
    this.results.push({ itemId: cur.item.id, ok: false, step: this.step });
    if (!this.retried.has(cur.item.id) && this.queue.length > 2) {
      // Come back to it once, a few items later, from the start of the ladder.
      this.retried.add(cur.item.id);
      this.queue.splice(Math.min(3, this.queue.length), 0, cur.item);
      this.total++;
    }
    return this.#advance();
  }

  // Words said in a row, counting from the latest (for "you're on a roll").
  successStreak() {
    let streak = 0;
    for (let i = this.results.length - 1; i >= 0 && this.results[i].ok; i--) streak++;
    return streak;
  }

  // True when the last few words in a row didn't come; the UI then offers a rest or an easier
  // stage. Offered once per streak.
  shouldOfferBreak() {
    let streak = 0;
    for (let i = this.results.length - 1; i >= 0 && !this.results[i].ok; i--) streak++;
    if (streak < BREAK_AFTER_MISSES || this.breakOfferedAt === this.results.length) return false;
    this.breakOfferedAt = this.results.length;
    return true;
  }

  // Skip without counting (e.g. the person is tired of this word).
  skip() {
    return this.#advance();
  }

  #advance() {
    this.queue.shift();
    this.done++;
    this.step = 0;
    this.solo = false;
    return this.queue.length ? "next" : "done";
  }

  summary() {
    const firstTry = this.results.filter(r => r.ok && r.step === 0).length;
    const withHelp = this.results.filter(r => r.ok && r.step > 0).length;
    // "Not yet" = never said successfully this session, even after coming back to it.
    const succeeded = new Set(this.results.filter(r => r.ok).map(r => r.itemId));
    const notYet = this.results.filter(r => !r.ok && !succeeded.has(r.itemId)).map(r => r.itemId);
    return { firstTry, withHelp, notYet: [...new Set(notYet)], correct: firstTry + withHelp, total: this.results.length };
  }
}
