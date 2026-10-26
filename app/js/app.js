// SEEDSED — app.js
// Purpose: UI WIRING. Renders the screens and connects the owners through their contracts:
//          planner/curriculum/mywords (what) → session (order, cue step) → audio (record)
//          → recognizer (hear) → assess (verdict) → feedback (words) → progress (remember);
//          voicebank supplies the helper's recorded voice, speech the device voice.
// Screens: his side (home, practice, summary) stays simple: one big button. The helper's side
//          (stages, his words, recording your voice, settings) sits behind "Helper".
// Boundaries: holds no practice rules of its own. Every async result carries an attempt id and is
//             dropped if the screen has moved on, so a slow recognition can never land on the wrong word.

import { STAGES, TIPS, getStage, listenPhrases } from "./curriculum.js";
import { assess, OUTCOMES } from "./assess.js";
import { feedback, withName, STEP_PROMPTS, BREAK_OFFER, COACH } from "./feedback.js";
import { Progress } from "./progress.js";
import { Session } from "./session.js";
import { buildDailyPlan, PLAN } from "./planner.js";
import { makeItem, myStage, loadMyWords, saveMyWords, loadVocab, MY_STAGE_ID, MAX_WORDS } from "./mywords.js";
import { VoiceBank } from "./voicebank.js";
import { Mic } from "./audio.js";
import { Recognizer } from "./recognizer.js";
import { speak, cancelSpeech, canSpeak, listVoices, onVoicesChanged, setVoice, currentVoiceName } from "./speech.js";
import { startMirror, stopMirror, mirrorOn } from "./mirror.js";
import { loadSettings, saveSettings, cleanName } from "./settings.js";

const MODEL_URL = "model/model.tar.gz";
const MODEL_FLAG = "speak-again/model-ready";
const VOICE_SAMPLE = "Hi. I'm here to practise with you. Take all the time you need.";

const storage = (() => { try { localStorage.setItem("speak-again/probe", "1"); return localStorage; } catch { return { getItem: () => null, setItem() {}, removeItem() {} }; } })();
const progress = new Progress(storage);
let settings = loadSettings(storage);
let myWords = loadMyWords(storage);
const mic = new Mic();
const voices = new VoiceBank();
const recognizer = new Recognizer(MODEL_URL);
setVoice(settings.voiceName);
const $app = document.getElementById("app");
const $mirror = document.getElementById("mirror");

let screen = settings.askedName ? "home" : "welcome";
let P = null;           // practice state
let summary = null;
let attemptSeq = 0;
let confirmReset = false;
let updateReady = null; // waiting service worker
let n = 0;              // rotates praise wording
let voicesStage = "lips";
let recState = null;    // the recording in progress: { text, phase: "recording" | "saving" }
let wordNote = "";      // last helper-screen message (word added, recording saved, ...)

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mine = () => myStage(myWords);
const allStages = () => (myWords.length ? [...STAGES, mine()] : STAGES);
const stageById = id => (id === MY_STAGE_ID ? mine() : getStage(id));

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
const statusCard = () => { const ms = modelStatus(); return `<section class="card status ${ms.cls}"><div><span class="dotmark" aria-hidden="true"></span><div><h3>${ms.title}</h3><p class="muted">${ms.body}</p></div></div>${ms.action}</section>`; };

// Play the model for an item: the helper's recording if there is one, otherwise the device voice.
async function playModel(item, slow = false) {
  if (voices.has(item.text)) {
    try { const rec = await voices.load(item.text); if (rec) return await mic.play(rec); } catch (e) { console.warn("Recording:", e); }
  }
  return speak(item.say, { rate: slow ? Math.max(0.5, settings.rate * 0.7) : settings.rate });
}

// ---------------------------------------------------------------- his screens
function header(right) {
  return `<header class="top"><div class="brand">
    <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="var(--accent)"/><path d="M11 13h18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-6 5v-5h-4a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" fill="var(--accent-ink)"/></svg>
    <h1>Speak Again</h1></div>${right}</header>`;
}
const back = (to = "home", label = "← Back") => `<button class="quiet" data-act="go" data-to="${to}">${label}</button>`;

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
  const days = progress.practiceDays().map(d => `<div class="day${d.practised ? " on" : ""}"><i></i>${d.date.toLocaleDateString(undefined, { weekday: "narrow" })}</div>`).join("");
  const practisedDays = progress.practiceDays().filter(d => d.practised).length;
  const today = progress.practiceDays().at(-1).practised;
  const focus = progress.recommendedStage(STAGES);
  return header(`<button class="quiet" data-act="go" data-to="helper">Helper</button>`) +
    (settings.name ? `<h2>Hi, ${esc(settings.name)}!</h2>` : "") +
    (updateReady ? `<div class="banner"><span>A new version is ready.</span><button data-act="update">Update now</button></div>` : "") +
    (recognizer.state === "ready" ? "" : statusCard()) +
    `<button class="next daily" data-act="daily">
      <span class="eyebrow">${today ? "Ready for more?" : "Today"}</span>
      <h2>Start today's practice</h2><span>About 10 minutes · ${PLAN.length} words · now working on ${esc(focus.title)}</span>
    </button>
    <section class="card"><div class="status"><div><div><h3>This week</h3><p class="muted">Practised on ${practisedDays} of the last 7 days. A little every day works best.</p></div></div><div class="week">${days}</div></div></section>
    <div class="row"><button data-act="go" data-to="stages">Choose a stage</button>${myWords.length ? `<button data-act="start" data-stage="${MY_STAGE_ID}">My words</button>` : ""}</div>
    <p class="note">Speak Again is a practice aid, not a replacement for a speech-language pathologist. Short daily practice is best. Stop when tired.</p>`;
}

function viewStages() {
  const list = allStages().map((s, i) => {
    const st = progress.stageStats(s);
    return `<button class="stage" data-act="start" data-stage="${s.id}">
      <span class="num">${s.id === MY_STAGE_ID ? "★" : i + 1}</span>
      <div><h3>${esc(s.title)}</h3><small>${st.tried ? `${st.mastered} of ${st.total} learned` : `${st.total} to practise`}</small><div class="bar"><i style="width:${Math.round((st.mastered / st.total) * 100)}%"></i></div></div>
      ${st.complete ? '<span class="tick">✓ Done</span>' : ""}</button>`;
  }).join("");
  return header(back()) + `<h2>Choose a stage</h2><p class="muted">From easiest to hardest. "Start today's practice" picks for you.</p>
    <section class="stages">${list}</section>`;
}

function viewPractice() {
  const cur = P.session.current();
  const { item, stage, step, index, total } = cur;
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
    const why = item.selfCheck ? "This is one of your own words, so you or your helper decide." : "Listening isn't set up, so you or a helper decide.";
    fb = `<section class="fb info"><h2>How did that sound?</h2><p>${why}</p>
      <div class="row"><button data-act="playback">▶ Hear myself</button><button class="primary" data-act="self-yes">That was right</button><button data-act="self-no">Not yet</button></div></section>`;
  }
  if (P.phase === "break") {
    const easier = P.stage ? STAGES[STAGES.indexOf(P.stage) - 1] : null;
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
      ${item.partner ? `<p class="muted">Not "${esc(item.partner)}". Feel the difference.</p>` : ""}
      <p class="prompt">${voice ? `Hold the sound for ${item.holdSec} seconds.` : esc(cur.solo ? COACH.soloPrompt : STEP_PROMPTS[step])}</p>
      ${voice ? `<div class="hold" id="hold" aria-hidden="true"><i></i></div>` : ""}
      ${showTip && tip ? `<div class="tip"><p><b>Tip:</b> ${esc(tip)}</p><div id="mirror-slot"></div>
        <button class="quiet" data-act="mirror">${mirrorOn() ? "Hide mirror" : "Show my mouth (mirror)"}</button></div>`
        : tip ? `<button class="quiet" data-act="tip">Show a tip</button>` : ""}
    </section>
    ${fb || `<div class="speakrow">
      <button class="hear" data-act="hear" ${P.phase !== "ready" ? "disabled" : ""}>🔊 Hear it${step === 2 ? " slowly" : ""}</button>
      <button class="mic${micCls}" id="mic" data-act="mic" ${canTap ? "" : "disabled"} aria-label="${micLabel}"><span><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>${micLabel}</span></button>
    </div>
    <div class="row"><button class="quiet" data-act="skip" ${P.phase === "ready" ? "" : "disabled"}>Skip this one</button></div>`}`;
}

function viewSummary() {
  const s = summary.result;
  const stage = summary.stage; // null for today's practice
  const st = stage ? progress.stageStats(stage) : null;
  const nextUp = st?.complete && stage.id !== MY_STAGE_ID ? STAGES[STAGES.indexOf(stage) + 1] : null;
  const msg = s.total && s.correct / s.total >= 0.8 ? "That was a strong session." : s.correct ? "Good work. Every try builds the pathway." : "You kept trying. That's how progress happens.";
  const again = stage ? `data-act="start" data-stage="${stage.id}"` : `data-act="daily"`;
  return header("") + `<section class="card"><p class="eyebrow">${esc(stage ? stage.title : "Today's practice")}</p><h2>${msg}</h2>
    ${s.correct ? `<div class="tiles"><div class="tile g"><strong>${s.firstTry}</strong><span>Said first try</span></div><div class="tile h"><strong>${s.withHelp}</strong><span>Said with a tip</span></div><div class="tile"><strong>${s.total}</strong><span>Words practised</span></div></div>`
      : `<p>You practised ${s.total} ${s.total === 1 ? "word" : "words"}. Every try counts.</p>`}
    ${s.notYet.length ? `<p class="muted">We'll keep practising these together:</p><div class="chips">${s.notYet.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    ${st?.mastered ? `<p class="muted">${st.mastered} of ${st.total} learned in this stage.${st.complete ? " Stage complete! The next one is ready." : ""}</p>` : ""}
    ${nextUp ? `<p><b>${esc(COACH.nextLevel)}</b></p>` : ""}
    <div class="row">${nextUp ? `<button class="primary" data-act="start" data-stage="${nextUp.id}">Next level: ${esc(nextUp.title)}</button><button ${again}>Practise this again</button>`
      : `<button class="primary" ${again}>Practise more</button>`}<button data-act="go" data-to="home">Home</button></div></section>`;
}

// ---------------------------------------------------------------- helper screens
function viewHelper() {
  return header(back()) + `<h2>Helper</h2><p class="muted">Set things up for him here. Everything stays on this tablet.</p>
    <section class="helpgrid">
      <button class="card tile-btn" data-act="go" data-to="mywords"><h3>His words</h3><p class="muted">${myWords.length ? `${myWords.length} added` : "Add names, places and favourite things"}</p></button>
      <button class="card tile-btn" data-act="go" data-to="voices"><h3>Record your voice</h3><p class="muted">${voices.count ? `${voices.count} words recorded` : "Your voice instead of the computer's"}</p></button>
      <button class="card tile-btn" data-act="go" data-to="stages"><h3>All stages</h3><p class="muted">${allStages().length} stages, ${allStages().reduce((a, s) => a + s.items.length, 0)} items</p></button>
      <button class="card tile-btn" data-act="go" data-to="settings"><h3>Settings</h3><p class="muted">Voice, speed, name, feedback</p></button>
    </section>
    ${statusCard()}`;
}

function recButtons(text) {
  const busy = recState && recState.text === text;
  const has = voices.has(text);
  return `<span class="recbtns">
    <button class="${busy && recState.phase === "recording" ? "rec on" : "rec"}" data-act="rec" data-text="${esc(text)}" ${recState && !busy ? "disabled" : ""}>${busy ? (recState.phase === "recording" ? "■ Stop" : "Saving…") : has ? "● Redo" : "● Record"}</button>
    ${has ? `<button data-act="rec-play" data-text="${esc(text)}" ${recState ? "disabled" : ""}>▶</button><button class="quiet" data-act="rec-del" data-text="${esc(text)}" ${recState ? "disabled" : ""} aria-label="Delete recording">✕</button>` : ""}
  </span>`;
}

function viewMyWords() {
  const rows = myWords.map(w => `<li class="wordrow"><div><b>${esc(w.text)}</b><small>${w.selfCheck ? "You'll judge this one (the listener doesn't know it)" : "The listener knows this word"}</small></div>
    <span class="recbtns">${recButtons(w.text)}<button class="quiet" data-act="word-del" data-id="${esc(w.id)}" ${recState ? "disabled" : ""}>Remove</button></span></li>`).join("");
  return header(back("helper")) + `<h2>His words</h2>
    <section class="card"><form id="word-form" class="setting"><label for="word-input"><h3>Add a word or short phrase</h3></label>
      <p class="note">Family and friends' names, his street, his dog, his favourite foods, things he likes to say. Up to ${MAX_WORDS}.</p>
      <div class="row"><input id="word-input" class="text" maxlength="60" autocapitalize="words" placeholder="e.g. Brenda, fishing, my truck"><button class="primary" type="submit">Add</button></div>
      ${wordNote ? `<p class="note" role="status">${esc(wordNote)}</p>` : ""}</form></section>
    ${myWords.length ? `<section class="card"><ul class="wordlist">${rows}</ul><div class="row"><button class="primary" data-act="start" data-stage="${MY_STAGE_ID}">Practise his words</button></div></section>` : ""}`;
}

function viewVoices() {
  const stage = stageById(voicesStage) || STAGES[1];
  const options = allStages().filter(s => s.kind !== "voice").map(s => `<option value="${s.id}" ${s.id === stage.id ? "selected" : ""}>${esc(s.title)}</option>`).join("");
  const rows = stage.items.map(i => `<li class="wordrow"><div><b>${esc(i.text)}</b></div>${recButtons(i.text)}</li>`).join("");
  return header(back("helper")) + `<h2>Record your voice</h2>
    <section class="card"><p>Tap <b>● Record</b>, say the word clearly at a relaxed pace, then pause. It stops by itself.
      The app then plays your voice instead of the computer's for that word, everywhere it appears.</p>
      ${wordNote ? `<p class="note" role="status">${esc(wordNote)}</p>` : ""}
      <label class="setting" for="voice-stage"><h3>Words from</h3><select id="voice-stage" class="text">${options}</select></label></section>
    <section class="card"><ul class="wordlist">${rows}</ul></section>`;
}

function viewVoiceChooser() {
  const list = listVoices().slice(0, 8);
  if (!list.length) return "";
  const btn = (name, label, extra = "") => `<button data-act="voice" data-name="${esc(name)}" aria-pressed="${name === settings.voiceName}">${esc(label)}${extra}</button>`;
  return `<div class="setting"><h3>Computer voice</h3>
    <p class="note">Used for words you haven't recorded. Tap one to hear it. Now using: ${esc(currentVoiceName())}. For a more natural voice, see "Getting a natural voice" in the tablet guide.</p>
    <div class="seg">${btn("", "Most natural (automatic)")}${list.map(v => btn(v.name, v.name, v.offline ? "" : " · needs internet")).join("")}</div></div>`;
}

function viewSettings() {
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-key="${key}" data-v='${JSON.stringify(v)}' aria-pressed="${settings[key] === v}">${l}</button>`).join("")}</div>`;
  return header(back("helper")) + `<h2>Settings</h2>
    <section class="card">
      <form class="setting" id="name-form"><label for="name-input"><h3>Name</h3></label>
        <div class="row"><input id="name-input" class="text" maxlength="40" autocomplete="given-name" autocapitalize="words" placeholder="First name (optional)" value="${esc(settings.name)}"><button type="submit">Save name</button></div></form>
      ${viewVoiceChooser()}
      <div class="setting"><h3>Voice speed</h3>${seg("rate", [[0.6, "Slow"], [0.8, "Medium"], [1, "Normal"]])}<div><button data-act="test-voice">🔊 Test the voice</button></div></div>
      <div class="setting"><h3>Words per stage session</h3>${seg("length", [[8, "8"], [12, "12"], [20, "20"]])}</div>
      <div class="setting"><h3>Read encouragement aloud</h3>${seg("speakFeedback", [[true, "Yes"], [false, "No"]])}</div>
      <div class="setting"><h3>Show "Helper: that was right" button</h3>${seg("helperButtons", [[true, "Yes"], [false, "No"]])}</div>
      <div class="setting"><h3>Open the mirror with each tip</h3>${seg("autoMirror", [[true, "Yes"], [false, "No"]])}</div>
      <div class="setting"><h3>After a miss, show what the app heard</h3><p class="note">Off is gentler. A helper may find it useful.</p>${seg("showHeard", [[false, "No"], [true, "Yes"]])}</div>
    </section>
    ${statusCard()}
    <section class="card"><h3>Progress</h3><p class="muted">Saved on this device only.</p>
      <div class="row">${confirmReset ? `<button class="primary" data-act="reset-yes">Yes, erase all progress</button><button data-act="reset-no">Keep it</button>` : `<button data-act="reset">Erase progress…</button>`}</div></section>
    ${canSpeak ? "" : `<p class="note">This browser has no built-in voice, so models are shown as text only.</p>`}`;
}

const VIEWS = { welcome: viewWelcome, home: viewHome, stages: viewStages, practice: viewPractice, summary: viewSummary,
  helper: viewHelper, mywords: viewMyWords, voices: viewVoices, settings: viewSettings };

function render() {
  if (screen !== "practice" && mirrorOn()) stopMirror($mirror);
  $app.innerHTML = (VIEWS[screen] || viewHome)();
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
  wordNote = "";
  render();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- practice flow
function begin(session, stage) {
  P = { stage, session, phase: "ready", showTip: false, fb: null, result: null, verdict: null, recording: null, error: null, greet: true };
  go("practice");
  presentStep();
}

function startPractice(stageId) {
  mic.unlock(); // inside the tap: lets iOS start audio later
  const stage = stageById(stageId);
  if (!stage || !stage.items.length) return go("home");
  begin(new Session(stage, progress, { length: settings.length }), stage);
}

function startDaily() {
  mic.unlock();
  const extra = myWords.map(item => ({ stage: mine(), item }));
  begin(new Session(buildDailyPlan({ stages: STAGES, progress, extra }), progress), null);
}

async function presentStep() {
  const id = ++attemptSeq;
  const { item, step } = P.session.current();
  Object.assign(P, { phase: "ready", fb: null, result: null, verdict: null, recording: null, error: null, showTip: false });
  if (step >= 1 && settings.autoMirror && !mirrorOn() && TIPS[item.tip]) await startMirror($mirror);
  if (id !== attemptSeq) return;
  render();
  if (P.greet) { P.greet = false; await speak(COACH.start(settings.name), { rate: settings.rate }); }
  if (id !== attemptSeq) return;
  if (P.session.current().solo) return speak(COACH.soloPrompt, { rate: settings.rate });
  if (step === 1 && TIPS[item.tip]) await speak(TIPS[item.tip], { rate: settings.rate });
  if (id !== attemptSeq) return;
  await playModel(item, step === 2);
}

async function onMic() {
  if (P.phase === "listening") { mic.stop(); return; }
  if (P.phase !== "ready") return;
  mic.unlock();
  cancelSpeech();
  const id = ++attemptSeq;
  const { item, stage } = P.session.current();
  const voice = stage.kind === "voice";
  P.phase = "listening";
  render();

  const micEl = document.getElementById("mic");
  const holdEl = document.querySelector("#hold i");
  let recording;
  try {
    recording = await mic.record({
      maxMs: voice ? item.holdSec * 1000 + 4000 : item.accept[0].includes(" ") ? 8000 : 5000,
      endSilenceMs: voice ? 700 : 1200,
      onLevel: lv => {
        if (micEl) micEl.style.setProperty("--lvl", (1 + Math.min(0.35, lv.level * 6)).toFixed(3));
        if (holdEl) holdEl.style.width = Math.min(100, (lv.runMs / (item.holdSec * 1000)) * 100) + "%";
      }
    });
  } catch (e) {
    if (id !== attemptSeq) return;
    P.error = micError(e);
    P.phase = "ready";
    render();
    return;
  }
  if (id !== attemptSeq) return;
  P.recording = recording;

  let transcript = "";
  if (!voice && recording.voicedMs >= 150) {
    if (item.selfCheck || recognizer.state !== "ready") { P.phase = "selfcheck"; render(); return; }
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

function micError(e) {
  const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
  return denied
    ? { title: "The microphone is turned off for this app", body: "Allow the microphone: on iPad open Settings › Safari › Microphone (or the app's website settings), then try again." }
    : { title: "The microphone didn't start", body: String((e && e.message) || e) };
}

function showResult(result) {
  const { item, stage, step, solo } = P.session.current();
  const ok = result.outcome === OUTCOMES.CORRECT;
  const silent = result.outcome === OUTCOMES.SILENT;
  P.result = result;
  P.verdict = silent ? null : ok;
  if (!silent) progress.recordAttempt({ stageId: stage.id, itemId: item.id, ok, step, by: stage.kind === "voice" ? "meter" : "asr" });
  const lastTry = !ok && P.session.preview(false) !== "retry";
  P.fb = feedback(result, { item, tipText: TIPS[item.tip] || "", step, solo, lastTry, showHeard: settings.showHeard, name: settings.name, n: n++ });
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
  const { item, stage, step, solo } = P.session.current();
  progress.recordAttempt({ stageId: stage.id, itemId: item.id, ok, step, by: "self" });
  P.result = { outcome: ok ? OUTCOMES.CORRECT : OUTCOMES.UNCLEAR, heard: "" };
  P.verdict = ok;
  const lastTry = !ok && P.session.preview(false) !== "retry";
  P.fb = feedback(P.result, { item, tipText: TIPS[item.tip] || "", step, solo, lastTry, showHeard: settings.showHeard, name: settings.name, n: n++ });
  if (ok && !solo) coachAfterSuccess();
  P.phase = "feedback";
  render();
  if (settings.speakFeedback) speak(P.fb.speak, { rate: settings.rate });
}

function override() {
  const { item, stage, solo } = P.session.current();
  progress.overrideLast(stage.id, item.id, true);
  P.verdict = true;
  const praise = withName("Great job!", settings.name, n++);
  P.fb = { tone: "great", headline: praise, detail: "Your helper heard it. Well done.", speak: praise };
  if (!solo) coachAfterSuccess();
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
  progress.recordSession({ stageId: P.stage ? P.stage.id : "daily", correct: result.correct, total: result.total });
  summary = { stage: P.stage, result };
  stopMirror($mirror);
  go("summary");
  if (settings.speakFeedback) speak(result.correct ? COACH.goodbye(settings.name) : withName("Thank you for practising. Same time tomorrow?", settings.name), { rate: settings.rate });
}

// ---------------------------------------------------------------- helper actions
async function toggleRecording(text) {
  if (recState?.phase === "recording" && recState.text === text) { mic.stop(); return; }
  if (recState) return;
  mic.unlock();
  cancelSpeech();
  recState = { text, phase: "recording" };
  wordNote = "";
  render();
  let saved = false;
  try {
    const rec = await mic.record({ maxMs: 8000, endSilenceMs: 900 });
    if (rec.voicedMs < 150) {
      wordNote = `I didn't hear anything for "${text}". Try again a little closer to the tablet.`;
    } else {
      recState = { text, phase: "saving" };
      render();
      await voices.save(text, rec);
      wordNote = `Saved "${text}". Here's how it sounds.`;
      saved = true;
    }
  } catch (e) {
    wordNote = e?.name === "NotAllowedError" || e?.name === "SecurityError" ? micError(e).title : `Couldn't save the recording: ${e?.message || e}`;
  }
  recState = null;
  render();
  if (saved) await mic.play(await voices.load(text));
}

async function addWord(text) {
  const vocab = await loadVocab();
  const item = makeItem(text, vocab, new Set(myWords.map(w => w.id)));
  if (!item) return;
  if (myWords.length >= MAX_WORDS) { wordNote = `You can add up to ${MAX_WORDS} words.`; return render(); }
  myWords = [...myWords, item];
  saveMyWords(storage, myWords);
  wordNote = item.selfCheck
    ? `Added "${item.text}". The listener doesn't know this word, so he or you will judge it. Recording your voice for it helps.`
    : `Added "${item.text}".`;
  render();
  document.getElementById("word-input")?.focus();
}

// ---------------------------------------------------------------- events
$app.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const a = b.dataset.act;
  switch (a) {
    case "go": return go(b.dataset.to);
    case "daily": return startDaily();
    case "start": return startPractice(b.dataset.stage);
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
      return playModel(item, step === 2);
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
    case "rec": return toggleRecording(b.dataset.text);
    case "rec-play": { mic.unlock(); const rec = await voices.load(b.dataset.text); if (rec) await mic.play(rec); return; }
    case "rec-del": await voices.remove(b.dataset.text); return render();
    case "word-del":
      myWords = myWords.filter(w => w.id !== b.dataset.id);
      saveMyWords(storage, myWords);
      return render();
    case "set": {
      settings = { ...settings, [b.dataset.key]: JSON.parse(b.dataset.v) };
      saveSettings(storage, settings);
      render();
      if (b.dataset.key === "rate") speak(VOICE_SAMPLE, { rate: settings.rate });
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

$app.addEventListener("change", e => {
  if (e.target.id === "voice-stage") { voicesStage = e.target.value; wordNote = ""; render(); }
});

$app.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "word-form") {
    const input = document.getElementById("word-input");
    const text = input.value;
    input.value = "";
    return addWord(text);
  }
  if (e.target.id !== "name-form") return;
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
voices.open().then(() => { if (screen !== "practice") render(); }).catch(e => console.warn("Recordings unavailable:", e));

render();
if (storage.getItem(MODEL_FLAG)) loadModel(); // already downloaded once: loads from this device
