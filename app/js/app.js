// SEEDSED — app.js
// Purpose: UI WIRING. Renders the screens and connects the owners through their contracts:
//          curriculum (what) → session (order, cue step) → audio (record) → recognizer (hear)
//          → assess (verdict) → feedback (words) → progress (remember).
// Boundaries: holds no practice rules of its own. Every async result carries an attempt id and is
//             dropped if the screen has moved on, so a slow recognition can never land on the wrong word.

import { STAGES, TIPS, getStage, listenPhrases } from "./curriculum.js";
import { assess, OUTCOMES } from "./assess.js";
import { feedback, withName, STEP_PROMPTS, BREAK_OFFER, COACH } from "./feedback.js";
import { Progress } from "./progress.js";
import { Session } from "./session.js";
import { Mic } from "./audio.js";
import { Recognizer } from "./recognizer.js";
import { speak, cancelSpeech, canSpeak, listVoices, onVoicesChanged, setVoice, currentVoiceName } from "./speech.js";
import { startMirror, stopMirror, mirrorOn } from "./mirror.js";
import { loadSettings, saveSettings, cleanName } from "./settings.js";

const MODEL_URL = "model/model.tar.gz";
const MODEL_FLAG = "speak-again/model-ready";

const storage = (() => { try { localStorage.setItem("speak-again/probe", "1"); return localStorage; } catch { return { getItem: () => null, setItem() {}, removeItem() {} }; } })();
const progress = new Progress(storage);
let settings = loadSettings(storage);
const mic = new Mic();
setVoice(settings.voiceName);
const VOICE_SAMPLE = "Hi. I'm here to practise with you. Take all the time you need.";
const recognizer = new Recognizer(MODEL_URL);
const $app = document.getElementById("app");
const $mirror = document.getElementById("mirror");

let screen = settings.askedName ? "home" : "welcome";
let P = null;           // practice state
let summary = null;
let attemptSeq = 0;
let confirmReset = false;
let updateReady = null; // waiting service worker
let n = 0;              // rotates praise wording

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------------------------------------------------------------- model
function loadModel() {
  render();
  recognizer.load().then(() => {
    try { storage.setItem(MODEL_FLAG, "1"); } catch {}
    navigator.storage?.persist?.().catch(() => {});
    render();
  }).catch(() => render());
}

function modelStatus() {
  const s = recognizer.state;
  if (s === "ready") return { cls: "ready", title: "Listening works offline", body: "Speech is checked on this device. Nothing is sent anywhere.", action: "" };
  if (s === "loading") return { cls: "loading", title: "Getting listening ready…", body: storage.getItem(MODEL_FLAG) ? "Loading from this device." : "Downloading the speech model once (about 41 MB). Keep the app open.", action: "" };
  if (s === "error") return { cls: "", title: "Listening isn't set up yet", body: navigator.onLine ? `It didn't finish: ${esc(recognizer.error?.message || "unknown error")}` : "Connect to the internet once to download it.", action: '<button class="primary" data-act="model">Try again</button>' };
  return { cls: "", title: "Set up listening", body: "One-time download (about 41 MB) so the app can hear words, even offline. Until then, you or a helper judge each try.", action: '<button class="primary" data-act="model">Set up now</button>' };
}

// ---------------------------------------------------------------- screens
function header(right) {
  return `<header class="top"><div class="brand">
    <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="var(--accent)"/><path d="M11 13h18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-6 5v-5h-4a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" fill="var(--accent-ink)"/></svg>
    <h1>Speak Again</h1></div>${right}</header>`;
}

function viewWelcome() {
  return header("") + `<section class="card"><h2>Welcome to Speak Again</h2>
    <p>A little practice every day, at your own pace. There's no account and no password. Everything stays on this tablet.</p>
    <form class="setting" id="name-form"><label for="name-input"><h3>What's your first name?</h3></label>
      <p class="note">Optional. The app uses it to cheer you on. A helper can type it.</p>
      <input id="name-input" class="text" maxlength="40" autocomplete="given-name" autocapitalize="words" placeholder="First name">
      <div class="row"><button class="primary" type="submit">Continue</button><button type="button" data-act="skip-name">Skip</button></div>
    </form></section>`;
}

function viewHome() {
  const ms = modelStatus();
  const rec = progress.recommendedStage(STAGES);
  const rs = progress.stageStats(rec);
  const days = progress.practiceDays().map(d => `<div class="day${d.practised ? " on" : ""}"><i></i>${d.date.toLocaleDateString(undefined, { weekday: "narrow" })}</div>`).join("");
  const practisedDays = progress.practiceDays().filter(d => d.practised).length;
  const list = STAGES.map((s, i) => {
    const st = progress.stageStats(s);
    return `<button class="stage" data-act="start" data-stage="${s.id}">
      <span class="num">${i + 1}</span>
      <div><h3>${esc(s.title)}</h3><small>${st.tried ? `${st.mastered} of ${st.total} learned` : "Not started"}</small><div class="bar"><i style="width:${Math.round((st.mastered / st.total) * 100)}%"></i></div></div>
      ${st.complete ? '<span class="tick">✓ Done</span>' : ""}</button>`;
  }).join("");
  return header(`<button class="quiet" data-act="settings">Settings</button>`) +
    (settings.name ? `<h2>Hi, ${esc(settings.name)}!</h2>` : "") +
    (updateReady ? `<div class="banner"><span>A new version is ready.</span><button data-act="update">Update now</button></div>` : "") +
    `<section class="card status ${ms.cls}"><div><span class="dotmark" aria-hidden="true"></span><div><h3>${ms.title}</h3><p class="muted">${ms.body}</p></div></div>${ms.action}</section>
    <button class="next" data-act="start" data-stage="${rec.id}">
      <span class="eyebrow">${rs.tried ? "Keep going" : "Start here"}</span>
      <h2>${esc(rec.title)}</h2><span>${esc(rec.goal)}</span>
    </button>
    <section class="card"><div class="status"><div><div><h3>This week</h3><p class="muted">Practised on ${practisedDays} of the last 7 days. A little every day works best.</p></div></div><div class="week">${days}</div></div></section>
    <section class="stages" aria-label="All stages"><p class="eyebrow">All stages</p>${list}</section>
    <p class="note">Speak Again is a practice aid, not a replacement for a speech-language pathologist. Short daily practice is best. Stop when tired.</p>`;
}

function viewPractice() {
  const cur = P.session.current();
  const { item, step, index, total } = cur;
  const stage = P.stage;
  const voice = stage.kind === "voice";
  const long = item.text.length > 9;
  const tip = TIPS[item.tip];
  const showTip = step >= 1 || P.showTip;
  const micCls = P.phase === "listening" ? " listening" : P.phase === "thinking" ? " thinking" : "";
  const micLabel = P.phase === "listening" ? (voice ? "Stop" : "Listening…") : P.phase === "thinking" ? "Checking…" : "Tap to speak";
  const canTap = P.phase === "ready" || P.phase === "listening";

  let fb = "";
  if (P.phase === "feedback") {
    const f = P.fb;
    const next = P.verdict === null ? "" : P.session.preview(P.verdict);
    const nextLabel = next === "retry" ? "Try again" : next === "solo" ? "Now just you" : next === "done" ? "See how you did" : "Next";
    const silent = P.result.outcome === OUTCOMES.SILENT;
    fb = `<section class="fb ${f.tone}" role="status"><h2>${esc(f.headline)}</h2><p>${esc(f.detail)}</p>
      <div class="row">
        ${P.recording && !silent ? `<button data-act="playback">▶ Hear myself</button>` : ""}
        <button class="primary" data-act="${silent ? "again" : "continue"}">${silent ? "Try again" : nextLabel}</button>
      </div>
      ${settings.helperButtons && !silent && !P.verdict ? `<button class="quiet helper" data-act="override">Helper: that was right</button>` : ""}
    </section>`;
  }
  if (P.phase === "selfcheck") {
    fb = `<section class="fb info"><h2>How did that sound?</h2><p>Listening isn't set up, so you or a helper decide.</p>
      <div class="row"><button data-act="playback">▶ Hear myself</button><button class="primary" data-act="self-yes">That was right</button><button data-act="self-no">Not yet</button></div></section>`;
  }
  if (P.phase === "break") {
    const easier = STAGES[STAGES.indexOf(stage) - 1];
    fb = `<section class="fb info"><h2>${esc(BREAK_OFFER.headline)}</h2><p>${esc(BREAK_OFFER.detail)}</p>
      <div class="row"><button class="primary" data-act="keep-going">Keep going</button>
      ${easier ? `<button data-act="start" data-stage="${easier.id}">Easier: ${esc(easier.title)}</button>` : ""}
      <button data-act="rest">Rest now</button></div></section>`;
  }
  if (P.error) fb = `<section class="fb info" role="alert"><h2>${esc(P.error.title)}</h2><p>${esc(P.error.body)}</p><div class="row"><button class="primary" data-act="again">Try again</button></div></section>`;

  return `<div class="pbar"><button class="quiet" data-act="end">✕ End</button><div class="bar" role="progressbar" aria-valuenow="${index}" aria-valuemax="${total}"><i style="width:${Math.round((index / total) * 100)}%"></i></div><span class="count">${index + 1} of ${total}</span></div>
    <section class="card target">
      <p class="eyebrow">${esc(item.group || stage.title)}</p>
      <div class="word${long ? " long" : ""}">${esc(item.text)}</div>
      <p class="prompt">${voice ? `Hold the sound for ${item.holdSec} seconds.` : esc(cur.solo ? COACH.soloPrompt : STEP_PROMPTS[step])}</p>
      ${voice ? `<div class="hold" id="hold" aria-hidden="true"><i></i></div>` : ""}
      ${showTip ? `<div class="tip"><p><b>Tip:</b> ${esc(tip)}</p><div id="mirror-slot"></div>
        <button class="quiet" data-act="mirror">${mirrorOn() ? "Hide mirror" : "Show my mouth (mirror)"}</button></div>`
        : `<button class="quiet" data-act="tip">Show a tip</button>`}
    </section>
    ${fb || `<div class="speakrow">
      <button class="hear" data-act="hear" ${P.phase !== "ready" ? "disabled" : ""}>🔊 Hear it${step === 2 ? " slowly" : ""}</button>
      <button class="mic${micCls}" id="mic" data-act="mic" ${canTap ? "" : "disabled"} aria-label="${micLabel}"><span><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>${micLabel}</span></button>
    </div>
    <div class="row"><button class="quiet" data-act="skip" ${P.phase === "ready" ? "" : "disabled"}>Skip this one</button></div>`}`;
}

function viewSummary() {
  const s = summary.result;
  const stage = summary.stage;
  const names = s.notYet.map(id => stage.items.find(i => i.id === id)?.text || id);
  const st = progress.stageStats(stage);
  const nextUp = st.complete ? STAGES[STAGES.indexOf(stage) + 1] : null;
  const msg = s.total && s.correct / s.total >= 0.8 ? "That was a strong session." : s.correct ? "Good work. Every try builds the pathway." : "You kept trying. That's how progress happens.";
  return header("") + `<section class="card"><p class="eyebrow">${esc(stage.title)}</p><h2>${msg}</h2>
    ${s.correct ? `<div class="tiles"><div class="tile g"><strong>${s.firstTry}</strong><span>Said first try</span></div><div class="tile h"><strong>${s.withHelp}</strong><span>Said with a tip</span></div><div class="tile"><strong>${s.total}</strong><span>Words practised</span></div></div>`
      : `<p>You practised ${s.total} ${s.total === 1 ? "word" : "words"}. Every try counts.</p>`}
    ${names.length ? `<p class="muted">We'll keep practising these together:</p><div class="chips">${names.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    ${st.mastered ? `<p class="muted">${st.mastered} of ${st.total} learned in this stage.${st.complete ? " Stage complete! The next one is ready." : ""}</p>` : ""}
    ${nextUp ? `<p><b>${esc(COACH.nextLevel)}</b></p>` : ""}
    <div class="row">${nextUp ? `<button class="primary" data-act="start" data-stage="${nextUp.id}">Next level: ${esc(nextUp.title)}</button><button data-act="start" data-stage="${stage.id}">Practise this again</button>`
      : `<button class="primary" data-act="start" data-stage="${stage.id}">Practise again</button>`}<button data-act="home">Home</button></div></section>`;
}

function viewVoices() {
  const voices = listVoices().slice(0, 8);
  if (!voices.length) return "";
  const active = currentVoiceName();
  const btn = (name, label, extra = "") => `<button data-act="voice" data-name="${esc(name)}" aria-pressed="${name === settings.voiceName}">${esc(label)}${extra}</button>`;
  return `<div class="setting"><h3>Voice</h3>
    <p class="note">Tap one to hear it. Now using: ${esc(active)}. For a more natural voice, see "Getting a natural voice" in the tablet guide.</p>
    <div class="seg">${btn("", "Most natural (automatic)")}${voices.map(v => btn(v.name, v.name, v.offline ? "" : " · needs internet")).join("")}</div></div>`;
}

function viewSettings() {
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-key="${key}" data-v='${JSON.stringify(v)}' aria-pressed="${settings[key] === v}">${l}</button>`).join("")}</div>`;
  const ms = modelStatus();
  return header(`<button class="quiet" data-act="home">← Home</button>`) + `<h2>Settings</h2>
    <section class="card">
      <form class="setting" id="name-form"><label for="name-input"><h3>Name</h3></label>
        <div class="row"><input id="name-input" class="text" maxlength="40" autocomplete="given-name" autocapitalize="words" placeholder="First name (optional)" value="${esc(settings.name)}"><button type="submit">Save name</button></div></form>
      ${viewVoices()}
      <div class="setting"><h3>Voice speed</h3>${seg("rate", [[0.6, "Slow"], [0.8, "Medium"], [1, "Normal"]])}<div><button data-act="test-voice">🔊 Test the voice</button></div></div>
      <div class="setting"><h3>Words per session</h3>${seg("length", [[8, "8"], [12, "12"], [20, "20"]])}</div>
      <div class="setting"><h3>Read encouragement aloud</h3>${seg("speakFeedback", [[true, "Yes"], [false, "No"]])}</div>
      <div class="setting"><h3>Show "Helper: that was right" button</h3>${seg("helperButtons", [[true, "Yes"], [false, "No"]])}</div>
      <div class="setting"><h3>Open the mirror with each tip</h3>${seg("autoMirror", [[true, "Yes"], [false, "No"]])}</div>
      <div class="setting"><h3>After a miss, show what the app heard</h3><p class="note">Off is gentler. A helper may find it useful.</p>${seg("showHeard", [[false, "No"], [true, "Yes"]])}</div>
    </section>
    <section class="card status ${ms.cls}"><div><span class="dotmark"></span><div><h3>${ms.title}</h3><p class="muted">${ms.body}</p></div></div>${ms.action}</section>
    <section class="card"><h3>Progress</h3><p class="muted">Saved on this device only.</p>
      <div class="row">${confirmReset ? `<button class="primary" data-act="reset-yes">Yes, erase all progress</button><button data-act="reset-no">Keep it</button>` : `<button data-act="reset">Erase progress…</button>`}</div></section>
    ${canSpeak ? "" : `<p class="note">This browser has no built-in voice, so models are shown as text only.</p>`}`;
}

function render() {
  if (screen !== "practice" && mirrorOn()) stopMirror($mirror);
  $app.innerHTML = screen === "practice" ? viewPractice() : screen === "summary" ? viewSummary() : screen === "settings" ? viewSettings() : screen === "welcome" ? viewWelcome() : viewHome();
  const slot = document.getElementById("mirror-slot");
  if (slot && mirrorOn()) { slot.appendChild($mirror); $mirror.hidden = false; }
  else { $mirror.hidden = true; document.body.appendChild($mirror); }
}

function go(next) {
  cancelSpeech();
  mic.stop();
  attemptSeq++;
  screen = next;
  confirmReset = false;
  render();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- practice flow
function startPractice(stageId) {
  mic.unlock(); // inside the tap: lets iOS start audio later
  const stage = getStage(stageId);
  P = { stage, session: new Session(stage, progress, { length: settings.length }), phase: "ready", showTip: false, fb: null, result: null, verdict: null, recording: null, error: null, greet: true };
  go("practice");
  presentStep();
}

async function presentStep() {
  const id = ++attemptSeq;
  const { item, step } = P.session.current();
  Object.assign(P, { phase: "ready", fb: null, result: null, verdict: null, recording: null, error: null, showTip: false });
  if (step >= 1 && settings.autoMirror && !mirrorOn()) await startMirror($mirror);
  if (id !== attemptSeq) return;
  render();
  if (P.greet) { P.greet = false; await speak(COACH.start(settings.name), { rate: settings.rate }); }
  if (id !== attemptSeq) return;
  if (P.session.current().solo) return speak(COACH.soloPrompt, { rate: settings.rate });
  if (step === 1) await speak(TIPS[item.tip], { rate: settings.rate });
  if (id !== attemptSeq) return;
  await speak(item.say, { rate: step === 2 ? Math.max(0.5, settings.rate * 0.7) : settings.rate });
}

async function onMic() {
  if (P.phase === "listening") { mic.stop(); return; }
  if (P.phase !== "ready") return;
  mic.unlock();
  cancelSpeech();
  const id = ++attemptSeq;
  const { item } = P.session.current();
  const stage = P.stage;
  const voice = stage.kind === "voice";
  P.phase = "listening";
  render();

  const micEl = document.getElementById("mic");
  const holdEl = document.querySelector("#hold i");
  let recording;
  try {
    recording = await mic.record({
      maxMs: voice ? item.holdSec * 1000 + 4000 : item.accept[0].includes(" ") ? 7000 : 5000,
      endSilenceMs: voice ? 700 : 1200,
      onLevel: lv => {
        if (micEl) micEl.style.setProperty("--lvl", (1 + Math.min(0.35, lv.level * 6)).toFixed(3));
        if (holdEl) holdEl.style.width = Math.min(100, (lv.runMs / (item.holdSec * 1000)) * 100) + "%";
      }
    });
  } catch (e) {
    if (id !== attemptSeq) return;
    const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    P.error = denied
      ? { title: "The microphone is turned off for this app", body: "Allow the microphone: on iPad open Settings › Safari › Microphone (or the app's website settings), then try again." }
      : { title: "The microphone didn't start", body: String(e && e.message || e) };
    P.phase = "ready";
    render();
    return;
  }
  if (id !== attemptSeq) return;
  P.recording = recording;

  let transcript = "";
  if (!voice && recording.voicedMs >= 150) {
    if (recognizer.state !== "ready") { P.phase = "selfcheck"; render(); return; }
    P.phase = "thinking";
    render();
    try {
      transcript = (await recognizer.recognize(recording, listenPhrases(stage, item))).text;
    } catch (e) {
      console.warn(e);
      transcript = "";
    }
    if (id !== attemptSeq) return;
  }
  showResult(assess(item, stage.kind, { ...recording, transcript }));
}

function showResult(result) {
  const { item, step, solo } = P.session.current();
  const ok = result.outcome === OUTCOMES.CORRECT;
  const silent = result.outcome === OUTCOMES.SILENT;
  P.result = result;
  P.verdict = silent ? null : ok;
  if (!silent) progress.recordAttempt({ stageId: P.stage.id, itemId: item.id, ok, step, by: P.stage.kind === "voice" ? "meter" : "asr" });
  const lastTry = !ok && P.session.preview(false) !== "retry";
  P.fb = feedback(result, { item, tipText: TIPS[item.tip], step, solo, lastTry, showHeard: settings.showHeard, name: settings.name, n: n++ });
  if (ok && !solo) coachAfterSuccess();
  P.phase = "feedback";
  render();
  if (settings.speakFeedback) speak(P.fb.speak, { rate: Math.min(1, settings.rate + 0.1) });
}

// Gentle pushes after a success: ask for a solo try if a tip was needed; cheer a streak.
function coachAfterSuccess() {
  const f = { ...P.fb };
  if (P.session.preview(true) === "solo") {
    f.detail = `${f.detail} ${COACH.soloNudge}`;
    f.speak = `${f.speak} ${COACH.soloNudge}`;
  } else {
    const streak = P.session.successStreak() + 1;
    if (streak >= 3 && streak % 3 === 0) {
      const line = COACH.roll[(streak / 3 - 1) % COACH.roll.length];
      f.detail = `${line} ${f.detail}`;
      f.speak = `${f.speak} ${line}`;
    }
  }
  P.fb = f;
}

function selfJudged(ok) {
  const { item, step, solo } = P.session.current();
  progress.recordAttempt({ stageId: P.stage.id, itemId: item.id, ok, step, by: "self" });
  P.result = { outcome: ok ? OUTCOMES.CORRECT : OUTCOMES.UNCLEAR, heard: "" };
  P.verdict = ok;
  const lastTry = !ok && P.session.preview(false) !== "retry";
  P.fb = feedback(P.result, { item, tipText: TIPS[item.tip], step, solo, lastTry, showHeard: settings.showHeard, name: settings.name, n: n++ });
  if (ok && !solo) coachAfterSuccess();
  P.phase = "feedback";
  render();
  if (settings.speakFeedback) speak(P.fb.speak, { rate: settings.rate });
}

function override() {
  const { item } = P.session.current();
  progress.overrideLast(P.stage.id, item.id, true);
  P.verdict = true;
  const praise = withName("Great job!", settings.name, n++);
  P.fb = { tone: "great", headline: praise, detail: "Your helper heard it. Well done.", speak: praise };
  if (!P.session.current().solo) coachAfterSuccess();
  render();
  if (settings.speakFeedback) speak(P.fb.speak, { rate: settings.rate });
}

function continueOn() {
  const r = P.session.submit(P.verdict);
  if (r === "done") return finishSession();
  if (P.session.shouldOfferBreak()) {
    attemptSeq++;
    P.phase = "break";
    render();
    if (settings.speakFeedback) speak("You're working hard. Would you like a rest?", { rate: settings.rate });
    return;
  }
  presentStep();
}

function finishSession() {
  const result = P.session.summary();
  progress.recordSession({ stageId: P.stage.id, correct: result.correct, total: result.total });
  summary = { stage: P.stage, result };
  stopMirror($mirror);
  go("summary");
  if (settings.speakFeedback) speak(result.correct ? COACH.goodbye(settings.name) : withName("Thank you for practising. Same time tomorrow?", settings.name), { rate: settings.rate });
}

// ---------------------------------------------------------------- events
$app.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const a = b.dataset.act;
  switch (a) {
    case "start": return startPractice(b.dataset.stage);
    case "home": return go("home");
    case "settings": return go("settings");
    case "model": return loadModel();
    case "update": updateReady?.postMessage("skip-waiting"); return;
    case "end":
      stopMirror($mirror);
      if (P.session.results.length) return finishSession();
      return go("home");
    case "mic": return onMic();
    case "hear": {
      const { item, step } = P.session.current();
      mic.unlock();
      return speak(item.say, { rate: step === 2 ? Math.max(0.5, settings.rate * 0.7) : settings.rate });
    }
    case "tip": P.showTip = true; render(); if (settings.autoMirror) { await startMirror($mirror); render(); } return;
    case "mirror": if (mirrorOn()) stopMirror($mirror); else await startMirror($mirror); return render();
    case "playback": cancelSpeech(); if (P.recording) await mic.play(P.recording); return;
    case "continue": return continueOn();
    case "again": attemptSeq++; Object.assign(P, { phase: "ready", fb: null, result: null, error: null }); return render();
    case "override": return override();
    case "keep-going": return presentStep();
    case "rest": return finishSession();
    case "self-yes": return selfJudged(true);
    case "self-no": return selfJudged(false);
    case "skip": { const r = P.session.skip(); return r === "done" ? (P.session.results.length ? finishSession() : go("home")) : presentStep(); }
    case "set": {
      settings = { ...settings, [b.dataset.key]: JSON.parse(b.dataset.v) };
      saveSettings(storage, settings);
      render();
      if (b.dataset.key === "rate") speak("This is how I will sound.", { rate: settings.rate });
      return;
    }
    case "skip-name":
      settings = { ...settings, askedName: true };
      saveSettings(storage, settings);
      return go("home");
    case "voice":
      settings = { ...settings, voiceName: b.dataset.name };
      saveSettings(storage, settings);
      setVoice(settings.voiceName);
      render();
      return speak(VOICE_SAMPLE, { rate: settings.rate });
    case "test-voice": return speak(VOICE_SAMPLE, { rate: settings.rate });
    case "reset": confirmReset = true; return render();
    case "reset-no": confirmReset = false; return render();
    case "reset-yes": progress.reset(); confirmReset = false; return render();
  }
});

$app.addEventListener("submit", e => {
  if (e.target.id !== "name-form") return;
  e.preventDefault();
  const name = cleanName(document.getElementById("name-input").value);
  const first = screen === "welcome";
  settings = { ...settings, name, askedName: true };
  saveSettings(storage, settings);
  if (first) {
    go("home");
    if (name) speak(`Hi, ${name}. Let's practise together.`, { rate: settings.rate });
  } else render();
});

// ---------------------------------------------------------------- offline shell
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) { updateReady = w; if (screen === "home") render(); } });
    if (reg.waiting && navigator.serviceWorker.controller) updateReady = reg.waiting;
    reg.addEventListener("updatefound", () => watch(reg.installing));
  }).catch(e => console.warn("Offline support unavailable:", e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updateReady && !reloaded) { reloaded = true; location.reload(); } });
}
onVoicesChanged(() => { if (screen === "settings") render(); });
for (const ev of ["online", "offline"]) window.addEventListener(ev, () => { if (screen !== "practice") render(); });

render();
if (storage.getItem(MODEL_FLAG)) loadModel(); // already downloaded once: loads from this device
