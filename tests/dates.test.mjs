// SEEDSED — date-look tests: what a person sees is US English (owner, 2026-10-31: dates are MM/DD/YYYY, month first),
// never the tablet's own language settings. Reads the app's source only; no browser, no storage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const APP = readFileSync(new URL("../app/js/app.js", import.meta.url), "utf8");

test("dates on screen are pinned to US English", () => {
  assert.doesNotMatch(APP, /toLocale(Date|Time)?String\((undefined|\[\]|\))/);
  assert.match(APP, /toLocaleDateString\("en-US", \{ weekday: "narrow" \}\)/);
});

test("the practice-week letters read as US weekdays", () => {
  const letter = new Date(2026, 9, 31).toLocaleDateString("en-US", { weekday: "narrow" });
  assert.equal(letter, "S"); // Saturday
});
