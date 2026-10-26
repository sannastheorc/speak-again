// SEEDSED — tests for his own words (mywords.js) and the helper-voice format (voicebank.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { makeItem, myStage, loadMyWords, saveMyWords, firstSound, normaliseText } from "../app/js/mywords.js";
import { downsample, toInt16, toFloat32, keyFor, STORE_RATE } from "../app/js/voicebank.js";
import { memoryStorage } from "../app/js/progress.js";
import { assess, OUTCOMES } from "../app/js/assess.js";
import { listenPhrases } from "../app/js/curriculum.js";

const VOCAB = new URL("../build/vocab.txt", import.meta.url);
const vocab = existsSync(VOCAB) ? new Set(readFileSync(VOCAB, "utf8").split("\n")) : new Set(["my", "dog", "coffee", "fishing"]);

test("my words: known words are checked by the listener; unknown names are judged by a person", () => {
  const coffee = makeItem("Coffee", vocab);
  assert.deepEqual([coffee.id, coffee.accept, coffee.selfCheck, coffee.sounds], ["coffee", ["coffee"], false, ["k"]]);
  const dog = makeItem("  my   dog ", vocab);
  assert.deepEqual([dog.text, dog.accept[0], dog.tip, dog.selfCheck], ["my dog", "my dog", "phrase", false]);
  const name = makeItem("Zbigniewska", vocab);
  assert.equal(name.selfCheck, true);
  assert.equal(makeItem("   ", vocab), null);
  assert.equal(makeItem("Coffee", null).selfCheck, true, "no vocabulary available: a person judges");
});

test("my words: works with the existing judge and listen list", () => {
  const coffee = makeItem("coffee", vocab);
  const stage = myStage([coffee, makeItem("fishing", vocab)]);
  assert.equal(assess(coffee, "speech", { voicedMs: 500, transcript: "coffee" }).outcome, OUTCOMES.CORRECT);
  assert.deepEqual(listenPhrases(stage, coffee), ["coffee", "fishing"]);
});

test("my words: duplicate words get distinct ids; saved list survives reload; junk ignored", () => {
  const a = makeItem("Fishing", vocab);
  const b = makeItem("fishing", vocab, new Set([a.id]));
  assert.notEqual(a.id, b.id);
  const s = memoryStorage();
  saveMyWords(s, [a, b]);
  assert.deepEqual(loadMyWords(s).map(i => i.id), [a.id, b.id]);
  s.setItem("speak-again/mywords", JSON.stringify([{ nope: 1 }, a]));
  assert.deepEqual(loadMyWords(s).map(i => i.id), [a.id]);
  s.setItem("speak-again/mywords", "{bad");
  assert.deepEqual(loadMyWords(s), []);
});

test("my words: first-sound guesses from spelling", () => {
  assert.deepEqual(["Shirley", "Charlie", "Thomas", "Phil", "knee", "Kate", "Cat", "Amy"].map(firstSound), ["sh", "ch", "th", "f", "n", "k", "k", null]);
  assert.equal(normaliseText("Grandma's  house!"), "grandma's house");
});

test("voice bank: recordings are stored at 16 kHz and round-trip faithfully", () => {
  const sr = 48000;
  const tone = Float32Array.from({ length: sr }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 300 * i) / sr));
  const down = downsample(tone, sr);
  assert.equal(down.length, STORE_RATE);
  const back = toFloat32(toInt16(down));
  let maxErr = 0;
  for (let i = 0; i < back.length; i++) maxErr = Math.max(maxErr, Math.abs(back[i] - down[i]));
  assert.ok(maxErr < 1e-4);
  assert.ok(Math.max(...back.slice(0, 200)) > 0.4, "the tone is still there");
  assert.deepEqual(Array.from(toInt16(Float32Array.from([2, -2]))), [32767, -32768], "clipped, not wrapped");
  assert.equal(downsample(Float32Array.from([1, 2]), 8000).length, 2, "never upsamples");
  assert.equal(keyFor("Thank you!"), keyFor("thank you"), "one recording per word, any stage");
});
