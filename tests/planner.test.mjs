// SEEDSED — tests for the spaced review schedule, per-sound stats and the daily plan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Progress, memoryStorage, REVIEW_DAYS } from "../app/js/progress.js";
import { buildDailyPlan, PLAN } from "../app/js/planner.js";
import { STAGES, getStage } from "../app/js/curriculum.js";

const DAY = 864e5;
const clock = () => { let t = Date.UTC(2026, 9, 26, 9); const now = () => t; now.add = d => { t += d * DAY; }; return now; };
const seq = () => { let x = 0.37; return () => (x = (x * 9301 + 49297) % 233280 / 233280); };
const master = (p, stageId, itemId) => { for (let i = 0; i < 3; i++) p.recordAttempt({ stageId, itemId, ok: true }); };
const keys = plan => plan.map(e => `${e.stage.id}/${e.item.id}`);

test("schedule: a word becomes due a day after it's learned, and gaps grow with good reviews", () => {
  const now = clock();
  const p = new Progress(memoryStorage(), now);
  master(p, "lips", "me");
  const lips = getStage("lips");
  assert.equal(p.dueEntries([lips]).length, 0, "not due the same day");
  now.add(1);
  assert.deepEqual(p.dueEntries([lips]).map(e => e.item.id), ["me"]);
  p.recordAttempt({ stageId: "lips", itemId: "me", ok: true });
  assert.equal(p.dueEntries([lips]).length, 0);
  now.add(REVIEW_DAYS[1] - 0.01);
  assert.equal(p.dueEntries([lips]).length, 0, "next gap is longer");
  now.add(0.02);
  assert.equal(p.dueEntries([lips]).length, 1);
});

test("schedule: a missed review just comes back tomorrow", () => {
  const now = clock();
  const p = new Progress(memoryStorage(), now);
  master(p, "lips", "me");
  now.add(1);
  p.recordAttempt({ stageId: "lips", itemId: "me", ok: true });
  now.add(2);
  p.recordAttempt({ stageId: "lips", itemId: "me", ok: false });
  now.add(1);
  assert.equal(p.dueEntries([getStage("lips")]).length, 1);
});

test("schedule: older saved progress without a schedule still loads", () => {
  const s = memoryStorage();
  s.setItem("speak-again/progress", JSON.stringify({ version: 1, attempts: { "lips/me": [{ t: 1, ok: true, step: 0, by: "asr" }] }, sessions: [] }));
  const p = new Progress(s);
  assert.equal(p.itemStats("lips", "me").tries, 1);
  assert.deepEqual(p.dueEntries(STAGES), []);
});

test("sound stats: success rate per sound from recent tries", () => {
  const p = new Progress(memoryStorage());
  p.recordAttempt({ stageId: "tip", itemId: "tea", ok: false });
  p.recordAttempt({ stageId: "tip", itemId: "two", ok: false });
  p.recordAttempt({ stageId: "tip", itemId: "toe", ok: true });
  p.recordAttempt({ stageId: "lips", itemId: "me", ok: true });
  const s = p.soundStats(STAGES);
  assert.equal(s.t.tries, 3);
  assert.equal(s.t.ok, 1);
  assert.equal(s.m.rate, 1);
});

test("plan: a brand-new learner starts with the voice warm-up", () => {
  const plan = buildDailyPlan({ stages: STAGES, progress: new Progress(memoryStorage()), rng: seq() });
  assert.ok(plan.length > 0);
  assert.ok(plan.every(e => e.stage.id === "voice"));
});

test("plan: warm-up first, then a mix of new words, due reviews, weak sounds and his own words", () => {
  const now = clock();
  const p = new Progress(memoryStorage(), now);
  // He has finished the voice warm-up and the alphabet, and learned some lip words.
  for (const id of ["voice", "alphabet"]) for (const i of getStage(id).items) master(p, id, i.id);
  for (const i of getStage("lips").items.slice(0, 4)) master(p, "lips", i.id);
  // He struggles with the tongue tip.
  for (const i of getStage("tip").items.slice(0, 3)) for (let n = 0; n < 2; n++) p.recordAttempt({ stageId: "tip", itemId: i.id, ok: false });
  now.add(1); // yesterday's learned words are now due

  const mine = { id: "mine", title: "My words", kind: "speech", items: [{ id: "stan", text: "Stan", accept: ["stan"], tip: "s", sounds: ["s"] }] };
  const plan = buildDailyPlan({ stages: STAGES, progress: p, extra: [{ stage: mine, item: mine.items[0] }], rng: seq() });
  const k = keys(plan);

  assert.equal(plan.length, PLAN.length);
  assert.equal(new Set(k).size, k.length, "no word twice");
  assert.ok(p.itemStats(plan[0].stage.id, plan[0].item.id).mastered, "opens with a known word");
  const reviews = plan.slice(1).filter(e => p.itemStats(e.stage.id, e.item.id).mastered);
  assert.ok(reviews.length >= 3, "includes due reviews");
  assert.ok(reviews.filter(e => e.stage.kind === "voice").length <= 1, "at most one voice hold among reviews");
  assert.ok(plan.some(e => e.item.sounds.includes("t") && !e.stage.id.startsWith("lips")), "includes weak tongue-tip practice");
  assert.ok(k.includes("mine/stan"), "includes his own word");
  assert.ok(plan.some(e => e.stage.id === "lips" && !p.itemStats("lips", e.item.id).mastered), "includes new words from his current stage");
  // Interleaved: not all reviews bunched together at the end.
  const firstNew = k.findIndex((x, i) => i > 0 && !p.itemStats(...x.split("/")).mastered);
  assert.ok(firstNew > 0 && firstNew <= 2);
});

test("plan: when everything is learned it still fills a session with review", () => {
  const p = new Progress(memoryStorage());
  const small = [getStage("voice"), getStage("lips")];
  for (const s of small) for (const i of s.items) master(p, s.id, i.id);
  const plan = buildDailyPlan({ stages: small, progress: p, length: 10, rng: seq() });
  assert.equal(plan.length, 10);
  assert.equal(new Set(keys(plan)).size, 10);
});
