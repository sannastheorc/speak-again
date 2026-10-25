// SEEDSED — curriculum tests: content integrity and recognizer-vocabulary coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { STAGES, TIPS, getStage, listenPhrases } from "../app/js/curriculum.js";

const VOCAB = new URL("../build/vocab.txt", import.meta.url);

test("stage and item ids are unique", () => {
  assert.equal(new Set(STAGES.map(s => s.id)).size, STAGES.length);
  for (const s of STAGES) assert.equal(new Set(s.items.map(i => i.id)).size, s.items.length, s.id);
});

test("every item has text, a known tip and a judging rule", () => {
  for (const s of STAGES) for (const i of s.items) {
    assert.ok(i.text && i.say, `${s.id}/${i.id} text`);
    assert.ok(TIPS[i.tip], `${s.id}/${i.id} tip ${i.tip}`);
    if (s.kind === "voice") assert.ok(i.holdSec > 0, `${i.id} holdSec`);
    else assert.ok(i.accept.length > 0, `${s.id}/${i.id} accept`);
  }
});

test("stages run from voice warm-up through the alphabet to phrases", () => {
  assert.deepEqual(STAGES.slice(0, 2).map(s => s.id), ["voice", "alphabet"]);
  assert.equal(STAGES.at(-1).id, "phrases");
  assert.equal(getStage("alphabet").items.length, 26);
});

test("listen list includes the target and same-group neighbours only", () => {
  const abc = getStage("alphabet");
  const b = abc.items.find(i => i.id === "b");
  const phrases = listenPhrases(abc, b);
  assert.ok(phrases.includes("bee"));
  assert.ok(phrases.includes("p"), "lip neighbour P");
  assert.ok(!phrases.includes("d"), "tongue-tip D is another group");
});

test("every accepted word is in the recognizer vocabulary", { skip: !existsSync(VOCAB) && "run npm run model first" }, () => {
  const vocab = new Set(readFileSync(VOCAB, "utf8").split("\n"));
  const missing = [];
  for (const s of STAGES) for (const i of s.items) {
    for (const p of listenPhrases(s, i)) for (const w of p.split(" ")) if (!vocab.has(w)) missing.push(`${s.id}/${i.id}: ${w}`);
  }
  assert.deepEqual(missing, []);
});
