// SEEDSED — tests for the stages after sentences: his place and progress can't move, the answer is
// held back until the last rung, partial credit on long lines, and free talking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAGES, TIPS, getStage, listenPhrases } from "../app/js/curriculum.js";
import { present } from "../app/js/presentation.js";
import { assess, OUTCOMES, wordsInOrder } from "../app/js/assess.js";
import { feedback, STEP_PROMPTS, COACH } from "../app/js/feedback.js";
import { Progress, memoryStorage } from "../app/js/progress.js";
import { buildDailyPlan } from "../app/js/planner.js";
import { Session } from "../app/js/session.js";

const OLD = JSON.parse(readFileSync(new URL("./fixtures/stages-0.3.json", import.meta.url)));
const NEW_IDS = ["counting", "finish", "naming", "choices", "scripts", "talk"];
const master = (p, s, i) => { for (let n = 0; n < 3; n++) p.recordAttempt({ stageId: s, itemId: i, ok: true }); };
const P = (item, kind, step, solo = false) => present(item, kind, step, solo, { tips: TIPS, soloPrompt: COACH.soloPrompt, stepPrompts: STEP_PROMPTS });
const first = (stage, mode) => getStage(stage).items.find(i => !mode || i.mode === mode);

test("his place is safe: everything he has now is unchanged and still comes first", () => {
  const now = STAGES.slice(0, OLD.length).map(s => ({ id: s.id, items: s.items.map(i => [i.id, i.text, i.accept]) }));
  assert.deepEqual(now, OLD);
  assert.deepEqual(STAGES.slice(OLD.length).map(s => s.id), NEW_IDS);
});

test("his place is safe: recommendation and today's plan don't reach the new stages early", () => {
  const p = new Progress(memoryStorage());
  for (const id of ["voice", "alphabet"]) for (const i of getStage(id).items) master(p, id, i.id);
  assert.equal(p.recommendedStage(STAGES).id, "lips");
  const plan = buildDailyPlan({ stages: STAGES, progress: p, rng: () => 0.5 });
  assert.ok(plan.every(e => !NEW_IDS.includes(e.stage.id)), plan.map(e => e.stage.id).join());
});

test("new stages open up only once everything before them is complete", () => {
  const p = new Progress(memoryStorage());
  for (const s of STAGES.slice(0, OLD.length)) for (const i of s.items) master(p, s.id, i.id);
  assert.equal(p.recommendedStage(STAGES).id, "counting");
});

test("gentle: nothing heavy in any new wording, including hints and the other person's lines", () => {
  const heavy = /\b(stroke|sick|pain|hurt|die|died|dead|death|kill|weak|cancer|disease|disabled|mute|dumb|stupid|fail\w*|wrong|lose|lost|broken|alone|hate|ugly|fat|hospital|doctor|patient|damage|worse|worst|bad|sad|sorry|problem|trouble|shoot|gun|war|blood|hurry|quick|faster)\b/i;
  for (const id of NEW_IDS) for (const i of getStage(id).items) assert.ok(!heavy.test(JSON.stringify(i)), `${id}/${i.id}: ${JSON.stringify(i).match(heavy)?.[0]}`);
  for (const o of Object.values(OUTCOMES)) for (const talked of [false, true]) {
    const f = feedback({ outcome: o, heard: "x", heldMs: 2000, talked }, { item: first("talk"), tipText: "t", n: 0 });
    assert.ok(!heavy.test(f.headline + f.detail + f.speak));
  }
});

test("repeat mode is exactly what it was", () => {
  const bee = getStage("lips").items.find(i => i.id === "bee");
  const s0 = P(bee, "speech", 0), s1 = P(bee, "speech", 1), s2 = P(bee, "speech", 2), solo = P(bee, "speech", 0, true);
  assert.deepEqual([s0.display, s0.prompt, s0.say, s0.model, s0.slow, s0.hearLabel], ["bee", STEP_PROMPTS[0], [], true, false, "Hear it"]);
  assert.deepEqual([s1.say, s1.hint, s1.model, s1.slow], [[TIPS.b], TIPS.b, true, false]);
  assert.deepEqual([s2.prompt, s2.say, s2.model, s2.slow, s2.hearLabel], [STEP_PROMPTS[2], [], true, true, "Hear it slowly"]);
  assert.deepEqual([solo.prompt, solo.say, solo.model, solo.hearModel], [COACH.soloPrompt, [], false, true]);
  const hold = getStage("voice").items[0];
  assert.deepEqual([P(hold, "voice", 0).prompt, P(hold, "voice", 0).showMeter, P(hold, "voice", 0).model], ["Hold the sound for 2 seconds.", true, true]);
});

test("naming: the word stays hidden, then meaning and first letter, then the word itself", () => {
  const coffee = getStage("naming").items.find(i => i.id === "coffee");
  const s0 = P(coffee, "speech", 0), s1 = P(coffee, "speech", 1), s2 = P(coffee, "speech", 2), solo = P(coffee, "speech", 0, true);
  assert.deepEqual([s0.picture, s0.display, s0.model], ["☕", "", false]);
  assert.ok(!JSON.stringify([s0.say, s0.hint, s0.hear]).includes("coffee"));
  assert.match(s1.hint, /hot drink.*"C"/);
  assert.ok(!/coffee/i.test(s1.say.join()));
  assert.deepEqual([s2.display, s2.model, s2.slow], ["coffee", true, true]);
  assert.deepEqual([solo.display, solo.model], ["", false], "the solo try is just the picture");
});

test("asking for a hint gives a real one, and none is offered once the word is showing", () => {
  const coffee = getStage("naming").items.find(i => i.id === "coffee");
  assert.match(P(coffee, "speech", 0).askHint, /hot drink.*"C"/);
  assert.match(P(coffee, "speech", 0, true).askHint, /"C"/, "still there on the solo try: never stuck");
  assert.equal(P(coffee, "speech", 2).askHint, "");
  assert.match(P(first("finish"), "speech", 0).askHint, /"P"/);
  assert.equal(P(getStage("lips").items[0], "speech", 0).askHint, undefined, "repeating keeps its mouth tip");
});

test("finish: shows the start, holds back the end until the last rung", () => {
  const salt = first("finish");
  assert.deepEqual([P(salt, "speech", 0).display, P(salt, "speech", 0).say, P(salt, "speech", 0).model], ["Salt and ___", ["Salt and"], false]);
  assert.match(P(salt, "speech", 1).hint, /"P"/);
  assert.deepEqual([P(salt, "speech", 2).display, P(salt, "speech", 2).model], ["Salt and pepper", true]);
});

test("choices: any offered answer is right, and feedback names what he chose", () => {
  const q = first("choices");
  const r = assess(q, "speech", { voicedMs: 500, transcript: "tea" });
  assert.deepEqual([r.outcome, r.matched], [OUTCOMES.CORRECT, "tea"]);
  assert.match(feedback(r, { item: q, n: 1 }).detail, /"tea"/);
  assert.equal(assess(q, "speech", { voicedMs: 500, transcript: "coffee" }).outcome, OUTCOMES.CORRECT);
  assert.equal(P(q, "speech", 0).model, false, "doesn't put words in his mouth");
  assert.deepEqual(P(q, "speech", 0).say, [q.text]);
});

test("scripts: the other person's line is spoken first; stage directions aren't", () => {
  const lines = getStage("scripts").items;
  const hi = lines[0], ring = lines.find(i => i.other.startsWith("("));
  assert.deepEqual([P(hi, "speech", 0).before, P(hi, "speech", 0).say, P(hi, "speech", 0).model], [hi.other, [hi.other], true]);
  assert.deepEqual(P(ring, "speech", 0).say, []);
  assert.deepEqual([P(hi, "speech", 0, true).say, P(hi, "speech", 0, true).model], [[hi.other], false], "solo: only their line");
  // Conversations stay in order when a session starts them from the beginning.
  assert.equal(lines.slice(0, 4).every(i => i.group === hi.group), true);
});

test("scripts: most of a long line earns credit; a different line or a little of it doesn't", () => {
  const line = getStage("scripts").items.find(i => i.text === "I would like a coffee, please.");
  const judge = t => assess(line, "speech", { voicedMs: 900, transcript: t });
  assert.equal(judge("i would like a coffee please").part, undefined, "whole line");
  assert.equal(judge("i would like a coffee please").outcome, OUTCOMES.CORRECT);
  const most = judge("i would like coffee please");
  assert.deepEqual([most.outcome, most.part], [OUTCOMES.CORRECT, { said: 5, of: 6 }]);
  assert.match(feedback(most, { item: line, n: 1 }).detail, /5 of the 6 words/);
  assert.equal(judge("i would").outcome, OUTCOMES.OTHER);
  assert.equal(judge("please coffee a like would i").outcome, OUTCOMES.OTHER, "order matters");
  assert.equal(wordsInOrder("[unk] one two", "one x two"), 2);
  const short = getStage("scripts").items.find(i => i.text === "Two, please.");
  assert.equal(short.partial, undefined, "short lines need every word");
  assert.equal(assess(short, "speech", { voicedMs: 500, transcript: "please" }).outcome, OUTCOMES.OTHER);
});

test("talk: judged by how long he talks, never the words; a short answer is still praised", () => {
  const q = getStage("talk").items.find(i => i.talkSec === 5);
  assert.equal(assess(q, "talk", { voicedMs: 4100 }).outcome, OUTCOMES.CORRECT);
  const short = assess(q, "talk", { voicedMs: 1500 });
  assert.equal(short.outcome, OUTCOMES.SHORT);
  assert.match(feedback(short, { item: q, n: 0 }).headline, /heard you/);
  assert.match(feedback(assess(q, "talk", { voicedMs: 6000 }), { item: q, n: 1 }).detail, /talked for 6 seconds/);
  assert.equal(assess(q, "talk", { voicedMs: 50 }).outcome, OUTCOMES.SILENT);
  assert.equal(P(q, "talk", 0).model, false);
  assert.deepEqual(P(q, "talk", 0).say, [q.say]);
});

test("talk: any answer moves on, with no retry and no 'just you', and it's remembered honestly", () => {
  const talkStage = getStage("talk");
  for (const ok of [true, false]) {
    const s = new Session(talkStage, new Progress(memoryStorage()), { length: 3, rng: () => 0.5 });
    assert.equal(s.preview(ok), "next");
    assert.equal(s.submit(ok), "next");
    assert.equal(s.current().step, 0);
    assert.equal(s.current().solo, false);
    assert.equal(s.total, 3, "never comes back around in the session");
    assert.equal(s.results[0].ok, ok);
  }
  const f = feedback({ outcome: OUTCOMES.SHORT, heard: "", heldMs: 300, talked: true }, { item: talkStage.items[0], n: 0 });
  assert.ok(!/\d/.test(f.detail + f.speak), "no stopwatch on a short answer");
});

test("every new spoken answer can be listened for", () => {
  for (const id of NEW_IDS.filter(x => x !== "talk")) for (const i of getStage(id).items) {
    const list = listenPhrases(getStage(id), i);
    for (const a of i.accept) assert.ok(list.includes(a), `${id}/${i.id}: ${a}`);
  }
});
