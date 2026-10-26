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

test("stages run from voice warm-up through the alphabet to phrases and sentences", () => {
  assert.deepEqual(STAGES.slice(0, 2).map(s => s.id), ["voice", "alphabet"]);
  assert.deepEqual(STAGES.slice(-2).map(s => s.id), ["phrases", "sentences"]);
  assert.equal(getStage("alphabet").items.length, 26);
});

test("thorough: over 1000 practice items, every item tagged with its sounds where it has one", () => {
  const items = STAGES.flatMap(s => s.items);
  assert.ok(items.length >= 1000, `only ${items.length}`);
  for (const s of STAGES) for (const i of s.items) {
    assert.ok(Array.isArray(i.sounds), `${s.id}/${i.id}`);
    if (["lipwords", "tipwords", "backwords", "pairs"].includes(s.id)) assert.ok(i.sounds.length, `${s.id}/${i.id} has no sound tag`);
  }
});

test("gentle: no emotionally heavy or unkind words anywhere in practice", () => {
  const heavy = /\b(stroke|sick|pain|hurt|die|died|dead|death|kill|weak|cancer|disease|disabled|mute|dumb|stupid|fail\w*|wrong|lose|lost|broken|alone|hate|ugly|fat|hospital|doctor|patient|damage|worse|worst|bad|sad|sorry|problem|trouble|shoot|gun|war|blood)\b/i;
  const hits = STAGES.flatMap(s => s.items.filter(i => heavy.test(i.text)).map(i => `${s.id}: ${i.text}`));
  assert.deepEqual(hits, []);
});

test("pairs: each word's partner is in its listen list, so the contrast is really checked", () => {
  const pairs = getStage("pairs");
  for (const i of pairs.items) assert.ok(listenPhrases(pairs, i).includes(i.partner), `${i.text} vs ${i.partner}`);
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
