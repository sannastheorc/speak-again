// SEEDSED — progress.js
// Purpose: REMEMBER practice and decide mastery. Owns the stored record of attempts and sessions,
//          and the rules for "mastered item", "completed stage", "recommended stage", the spaced
//          review schedule (when a learned word is due again) and per-sound success rates.
// Input:  attempts { stageId, itemId, ok, step, by } and finished sessions.
// Output: stats per item/stage; saved after every attempt so nothing is lost on close or crash.
// Boundaries: does not pick items (session.js) or judge attempts (assess.js). Storage is injected
//             (localStorage in the app, memory in tests); a failed save never throws into the UI.

export const MASTERY = Object.freeze({ window: 4, needed: 3, stageShare: 0.8 });
// Days until a learned word comes back for review; each good review moves one step along.
export const REVIEW_DAYS = Object.freeze([1, 2, 4, 7, 14, 30, 60]);
const DAY = 24 * 60 * 60 * 1000;
const KEY = "speak-again/progress";
const VERSION = 1;
const KEEP_PER_ITEM = 20;
const KEEP_SESSIONS = 500;

export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

function empty() {
  return { version: VERSION, attempts: {}, sessions: [], schedule: {} };
}

export class Progress {
  constructor(storage, now = () => Date.now()) {
    this.storage = storage;
    this.now = now;
    this.lastSaveError = null;
    this.data = this.#load();
  }

  #load() {
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return empty();
      const d = JSON.parse(raw);
      if (!d || d.version !== VERSION || typeof d.attempts !== "object" || !Array.isArray(d.sessions)) return empty();
      d.schedule ||= {}; // added after 0.2.0; older records simply have no reviews yet
      return d;
    } catch {
      return empty();
    }
  }

  #save() {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
      this.lastSaveError = null;
    } catch (e) {
      this.lastSaveError = e;
    }
  }

  static key(stageId, itemId) {
    return `${stageId}/${itemId}`;
  }

  recordAttempt({ stageId, itemId, ok, step = 0, by = "asr" }) {
    const k = Progress.key(stageId, itemId);
    const list = (this.data.attempts[k] ||= []);
    list.push({ t: this.now(), ok: !!ok, step, by });
    if (list.length > KEEP_PER_ITEM) list.splice(0, list.length - KEEP_PER_ITEM);
    this.#schedule(k, ok);
    this.#save();
  }

  // Spaced review. A word enters the schedule when first mastered (due tomorrow). A good try on or
  // after its due date moves it to the next, longer gap; a miss brings it back tomorrow, gently.
  #schedule(k, ok) {
    const now = this.now();
    const s = this.data.schedule[k];
    const [stageId, itemId] = k.split("/");
    if (!s) {
      if (this.itemStats(stageId, itemId).mastered) this.data.schedule[k] = { level: 0, due: now + REVIEW_DAYS[0] * DAY };
      return;
    }
    if (!ok) Object.assign(s, { level: 0, due: now + REVIEW_DAYS[0] * DAY });
    else if (now >= s.due) {
      s.level = Math.min(s.level + 1, REVIEW_DAYS.length - 1);
      s.due = now + REVIEW_DAYS[s.level] * DAY;
    }
  }

  // Learned words whose review is due, most overdue first, as { stage, item } entries.
  dueEntries(stages) {
    const now = this.now();
    const out = [];
    for (const stage of stages) for (const item of stage.items) {
      const s = this.data.schedule[Progress.key(stage.id, item.id)];
      if (s && s.due <= now) out.push({ stage, item, due: s.due });
    }
    return out.sort((a, b) => a.due - b.due).map(({ stage, item }) => ({ stage, item }));
  }

  // Success rate per sound over each item's last few tries: { sound: { tries, ok, rate } }.
  soundStats(stages) {
    const out = {};
    for (const stage of stages) for (const item of stage.items) {
      const list = (this.data.attempts[Progress.key(stage.id, item.id)] || []).slice(-MASTERY.window);
      if (!list.length) continue;
      for (const s of item.sounds || []) {
        const o = (out[s] ||= { tries: 0, ok: 0, rate: 0 });
        o.tries += list.length;
        o.ok += list.filter(a => a.ok).length;
        o.rate = o.ok / o.tries;
      }
    }
    return out;
  }

  // A helper overrides the recognizer's last verdict for this item ("He got it").
  overrideLast(stageId, itemId, ok) {
    const list = this.data.attempts[Progress.key(stageId, itemId)];
    if (!list || !list.length) return false;
    Object.assign(list[list.length - 1], { ok: !!ok, by: "helper" });
    this.#schedule(Progress.key(stageId, itemId), ok);
    this.#save();
    return true;
  }

  recordSession({ stageId, correct, total }) {
    this.data.sessions.push({ t: this.now(), stageId, correct, total });
    if (this.data.sessions.length > KEEP_SESSIONS) this.data.sessions.splice(0, this.data.sessions.length - KEEP_SESSIONS);
    this.#save();
  }

  itemStats(stageId, itemId) {
    const list = this.data.attempts[Progress.key(stageId, itemId)] || [];
    const recent = list.slice(-MASTERY.window);
    const recentOk = recent.filter(a => a.ok).length;
    return { tries: list.length, recentOk, mastered: recentOk >= MASTERY.needed };
  }

  stageStats(stage) {
    const items = stage.items.map(i => this.itemStats(stage.id, i.id));
    const mastered = items.filter(s => s.mastered).length;
    const tried = items.filter(s => s.tries > 0).length;
    return { mastered, tried, total: items.length, complete: mastered >= Math.ceil(stage.items.length * MASTERY.stageShare) };
  }

  // First stage that is not complete yet; the last stage once everything is complete.
  recommendedStage(stages) {
    return stages.find(s => !this.stageStats(s).complete) || stages[stages.length - 1];
  }

  practiceDays(days = 7) {
    const keys = new Set(this.data.sessions.map(s => new Date(s.t).toDateString()));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(this.now());
      d.setDate(d.getDate() - i);
      out.push({ date: d, practised: keys.has(d.toDateString()) });
    }
    return out;
  }

  reset() {
    this.data = empty();
    this.#save();
  }
}
