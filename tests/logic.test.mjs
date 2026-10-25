// SEEDSED — tests for assess, feedback, progress and session (the pure decision owners).
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, OUTCOMES, normalise } from "../app/js/assess.js";
import { feedback } from "../app/js/feedback.js";
import { Progress, memoryStorage, MASTERY } from "../app/js/progress.js";
import { Session, MAX_STEPS } from "../app/js/session.js";
import { getStage, STAGES } from "../app/js/curriculum.js";

const lips = getStage("lips");
const bee = lips.items.find(i => i.id === "bee");
const hold = getStage("voice").items[0]; // 2 s

// ---- assess
test("assess: matches accepted forms as whole words", () => {
  assert.equal(assess(bee, "speech", { voicedMs: 400, transcript: "bee" }).outcome, OUTCOMES.CORRECT);
  assert.equal(assess(bee, "speech", { voicedMs: 400, transcript: "[unk] be" }).outcome, OUTCOMES.CORRECT);
  assert.equal(assess(bee, "speech", { voicedMs: 400, transcript: "beef" }).outcome, OUTCOMES.OTHER, "no substring match");
  const other = assess(bee, "speech", { voicedMs: 400, transcript: "pay" });
  assert.deepEqual([other.outcome, other.heard], [OUTCOMES.OTHER, "pay"]);
});

test("assess: unknown-only and silence", () => {
  assert.equal(assess(bee, "speech", { voicedMs: 400, transcript: "[unk]" }).outcome, OUTCOMES.UNCLEAR);
  assert.equal(assess(bee, "speech", { voicedMs: 400, transcript: "" }).outcome, OUTCOMES.UNCLEAR);
  assert.equal(assess(bee, "speech", { voicedMs: 100, transcript: "bee" }).outcome, OUTCOMES.SILENT, "too little voice even if decoded");
});

test("assess: multi-word phrases", () => {
  const ty = getStage("phrases").items.find(i => i.id === "thank-you");
  assert.equal(assess(ty, "speech", { voicedMs: 900, transcript: "thank you" }).outcome, OUTCOMES.CORRECT);
  assert.equal(assess(ty, "speech", { voicedMs: 900, transcript: "thank" }).outcome, OUTCOMES.OTHER);
});

test("assess: voice holds use the longest continuous stretch at 80%", () => {
  assert.equal(assess(hold, "voice", { voicedMs: 2500, longestVoicedMs: 1600 }).outcome, OUTCOMES.CORRECT);
  assert.equal(assess(hold, "voice", { voicedMs: 2500, longestVoicedMs: 1500 }).outcome, OUTCOMES.SHORT);
  assert.equal(assess(hold, "voice", { voicedMs: 50, longestVoicedMs: 50 }).outcome, OUTCOMES.SILENT);
});

test("normalise strips punctuation and unknown markers", () => {
  assert.equal(normalise("  [unk] Thank-You! "), "thank you");
});

// ---- feedback
test("feedback is gentle: no negative words, and the tip comes before the last try", () => {
  const ctx = { item: bee, tipText: "Lips together.", n: 1, lastTry: false };
  for (const showHeard of [false, true]) for (const lastTry of [false, true]) for (let k = 0; k < 8; k++) {
    for (const outcome of Object.values(OUTCOMES)) {
      const f = feedback({ outcome, heard: "pay", heldMs: 900 }, { ...ctx, showHeard, lastTry, n: k });
      assert.ok(f.headline && f.speak, outcome);
      assert.ok(!/\b(wrong|incorrect|fail\w*|mistake|error|no)\b/i.test(f.headline + " " + f.detail + " " + f.speak), `${outcome}: ${f.headline} ${f.detail} ${f.speak}`);
    }
  }
  assert.match(feedback({ outcome: OUTCOMES.OTHER, heard: "pay" }, ctx).detail, /Lips together/);
  assert.match(feedback({ outcome: OUTCOMES.OTHER, heard: "pay" }, { ...ctx, lastTry: true }).detail, /come back/);
  assert.match(feedback({ outcome: OUTCOMES.CORRECT, heard: "bee" }, ctx).detail, /bee/);
});

test("feedback hides what was heard unless asked, and never speaks the miss aloud", () => {
  const ctx = { item: bee, tipText: "Lips together.", n: 0, lastTry: false };
  const hidden = feedback({ outcome: OUTCOMES.OTHER, heard: "pay" }, ctx);
  assert.ok(!/pay/.test(hidden.headline + hidden.detail + hidden.speak));
  const shown = feedback({ outcome: OUTCOMES.OTHER, heard: "pay" }, { ...ctx, showHeard: true });
  assert.match(shown.detail, /pay/);
  assert.ok(!/pay/.test(shown.speak), "spoken line stays encouragement only");
});

// ---- progress
test("progress: mastery needs 3 of the last 4 and survives reload", () => {
  const store = memoryStorage();
  const p = new Progress(store);
  for (const ok of [false, true, true]) p.recordAttempt({ stageId: "lips", itemId: "bee", ok });
  assert.equal(p.itemStats("lips", "bee").mastered, false);
  p.recordAttempt({ stageId: "lips", itemId: "bee", ok: true });
  assert.equal(p.itemStats("lips", "bee").mastered, true);
  assert.equal(new Progress(store).itemStats("lips", "bee").mastered, true, "persisted");
  assert.equal(MASTERY.needed, 3);
});

test("progress: helper override flips the last attempt", () => {
  const p = new Progress(memoryStorage());
  assert.equal(p.overrideLast("lips", "bee", true), false, "nothing to override");
  p.recordAttempt({ stageId: "lips", itemId: "bee", ok: false });
  assert.equal(p.overrideLast("lips", "bee", true), true);
  assert.equal(p.itemStats("lips", "bee").recentOk, 1);
});

test("progress: corrupt or foreign data starts fresh; failed save does not throw", () => {
  const s = memoryStorage();
  s.setItem("speak-again/progress", "{not json");
  assert.deepEqual(new Progress(s).data.attempts, {});
  s.setItem("speak-again/progress", JSON.stringify({ version: 99 }));
  assert.deepEqual(new Progress(s).data.sessions, []);
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  const p = new Progress(broken);
  p.recordAttempt({ stageId: "lips", itemId: "bee", ok: true });
  assert.equal(p.lastSaveError.message, "quota");
  assert.equal(p.itemStats("lips", "bee").tries, 1, "kept in memory");
});

test("progress: stage completes at 80% mastered and recommendation moves on", () => {
  const p = new Progress(memoryStorage());
  const voice = STAGES[0];
  assert.equal(p.recommendedStage(STAGES).id, "voice");
  for (const i of voice.items.slice(0, 4)) for (let n = 0; n < 3; n++) p.recordAttempt({ stageId: "voice", itemId: i.id, ok: true });
  assert.equal(p.stageStats(voice).complete, true, "4 of 5 = 80%");
  assert.equal(p.recommendedStage(STAGES).id, "alphabet");
});

// ---- session
const seq = () => { let x = 0.37; return () => (x = (x * 9301 + 49297) % 233280 / 233280); };

test("session: success moves on; misses climb the cue ladder then set the item aside", () => {
  const s = new Session(lips, new Progress(memoryStorage()), { length: 5, rng: seq() });
  const first = s.current().item;
  assert.equal(s.current().step, 0);
  assert.equal(s.submit(false), "retry");
  assert.equal(s.current().step, 1);
  assert.equal(s.submit(false), "retry");
  assert.equal(s.current().step, MAX_STEPS - 1);
  assert.equal(s.submit(false), "next");
  assert.notEqual(s.current().item.id, first.id);
  assert.equal(s.current().step, 0);
  assert.equal(s.total, 6, "missed item returns once");
  // Finish the session; the missed item must reappear exactly once more.
  const seen = [];
  while (!s.finished) { seen.push(s.current().item.id); s.submit(true); }
  assert.equal(seen.filter(id => id === first.id).length, 1);
  const sum = s.summary();
  assert.equal(sum.total, 6);
  assert.deepEqual(sum.notYet, []);
});

test("session: preview always agrees with submit and changes nothing", () => {
  for (const pattern of [[true, true, true], [false, false, false, true, true], [false, true, false, false, false, true, true, true]]) {
    const s = new Session(lips, new Progress(memoryStorage()), { length: 3, rng: seq() });
    for (const ok of pattern) {
      if (s.finished) break;
      const before = JSON.stringify([s.queue.map(i => i.id), s.step, s.total]);
      const p = s.preview(ok);
      assert.equal(JSON.stringify([s.queue.map(i => i.id), s.step, s.total]), before);
      assert.equal(s.submit(ok), p);
    }
  }
  const one = new Session(lips, new Progress(memoryStorage()), { length: 1, rng: seq() });
  assert.equal(one.preview(true), "done");
  one.submit(false); one.submit(false);
  assert.equal(one.preview(false), "done", "last item, last step, too few left to retry");
});

test("session: summary separates first-try and with-help successes", () => {
  const s = new Session(lips, new Progress(memoryStorage()), { length: 2, rng: seq() });
  s.submit(true);
  s.submit(false); s.submit(true);
  assert.deepEqual(s.summary(), { firstTry: 1, withHelp: 1, notYet: [], correct: 2, total: 2 });
});

test("session: opens with one known word, then unmastered items in curriculum order", () => {
  const p = new Progress(memoryStorage());
  for (let n = 0; n < 3; n++) p.recordAttempt({ stageId: "lips", itemId: "me", ok: true });
  const s = new Session(lips, p, { length: 4, rng: seq() });
  assert.deepEqual(s.queue.map(i => i.id), ["me", "my", "moo", "may"]);
  const fresh = new Session(lips, new Progress(memoryStorage()), { length: 3, rng: seq() });
  assert.deepEqual(fresh.queue.map(i => i.id), ["me", "my", "moo"], "nothing known yet: plain curriculum order");
});

test("session: offers a break after 3 missed words in a row, once per streak", () => {
  const s = new Session(lips, new Progress(memoryStorage()), { length: 10, rng: seq() });
  const miss = () => { s.submit(false); s.submit(false); s.submit(false); };
  miss(); miss();
  assert.equal(s.shouldOfferBreak(), false);
  miss();
  assert.equal(s.shouldOfferBreak(), true);
  assert.equal(s.shouldOfferBreak(), false, "not again for the same streak");
  s.submit(true);
  miss(); miss(); miss();
  assert.equal(s.shouldOfferBreak(), true, "a new streak after a success");
});
