// SEEDSED — audio.js
// Purpose: MICROPHONE in, PLAYBACK out. Records one attempt, measures voice activity live
//          (for the hold meter and auto-stop), trims silence, and plays recordings back.
// Output: Recording { samples: Float32Array, sampleRate, voicedMs, longestVoicedMs, durationMs }.
// Boundaries: no judging (assess.js) and no recognition (recognizer.js). The mic is released after
//             every attempt (also fixes iOS routing playback to the quiet earpiece while it is open).
//             Cleanup failures are logged and never replace the primary error.

export class VoiceTracker {
  // Pure: fed one RMS value per audio frame. Learns the room's noise floor over the first frames,
  // then counts voiced time. Gaps up to `bridgeMs` inside a sound still count as one continuous hold.
  constructor({ calibrateMs = 250, minThreshold = 0.012, floorFactor = 2.5, bridgeMs = 160 } = {}) {
    Object.assign(this, { calibrateMs, minThreshold, floorFactor, bridgeMs });
    this.elapsedMs = 0; this.floorSum = 0; this.floorN = 0;
    this.voicedMs = 0; this.longestVoicedMs = 0; this.runMs = 0; this.gapMs = 0;
    this.lastVoicedAt = -1; this.firstVoicedAt = -1;
  }

  get threshold() {
    const floor = this.floorN ? this.floorSum / this.floorN : 0;
    return Math.max(this.minThreshold, floor * this.floorFactor);
  }

  update(rms, frameMs) {
    const t = this.elapsedMs;
    this.elapsedMs += frameMs;
    if (t < this.calibrateMs) {
      this.floorSum += rms; this.floorN++;
      return false;
    }
    const voiced = rms >= this.threshold;
    if (voiced) {
      if (this.firstVoicedAt < 0) this.firstVoicedAt = t;
      this.lastVoicedAt = t + frameMs;
      this.voicedMs += frameMs;
      this.runMs += this.gapMs + frameMs; // a bridged gap belongs to the hold
      this.gapMs = 0;
      this.longestVoicedMs = Math.max(this.longestVoicedMs, this.runMs);
    } else if (this.runMs > 0) {
      this.gapMs += frameMs;
      if (this.gapMs > this.bridgeMs) { this.runMs = 0; this.gapMs = 0; }
    }
    return voiced;
  }

  silenceSinceVoiceMs() {
    return this.lastVoicedAt < 0 ? Infinity : this.elapsedMs - this.lastVoicedAt;
  }
}

export function rms(frame) {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
  return Math.sqrt(s / (frame.length || 1));
}

function concat(chunks, total) {
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

export class Mic {
  constructor() {
    this.ctx = null;
    this.active = null;
  }

  // Must be called synchronously inside a tap handler (iOS only starts audio from a gesture).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  stop() {
    if (this.active) this.active.stopRequested = true;
  }

  async record({ maxMs = 5000, endSilenceMs = 900, minVoicedMs = 150, onLevel } = {}) {
    if (this.active) throw new Error("Already recording");
    const ctx = this.unlock();
    const run = (this.active = { stopRequested: false });
    let stream, source, proc, sink;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      source = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(2048, 1, 1);
      sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(proc); proc.connect(sink); sink.connect(ctx.destination);

      const sr = ctx.sampleRate;
      const tracker = new VoiceTracker();
      const chunks = []; let total = 0;
      const frames = []; // per-frame voiced flags, for trimming

      await new Promise(resolve => {
        proc.onaudioprocess = e => {
          const data = new Float32Array(e.inputBuffer.getChannelData(0));
          chunks.push(data); total += data.length;
          const level = rms(data);
          const frameMs = (data.length / sr) * 1000;
          const voiced = tracker.update(level, frameMs);
          frames.push(voiced);
          if (onLevel) onLevel({ level, voiced, threshold: tracker.threshold, voicedMs: tracker.voicedMs, longestVoicedMs: tracker.longestVoicedMs, runMs: tracker.runMs, elapsedMs: tracker.elapsedMs });
          const spoke = tracker.voicedMs >= minVoicedMs;
          if (run.stopRequested || tracker.elapsedMs >= maxMs || (spoke && tracker.silenceSinceVoiceMs() >= endSilenceMs)) resolve();
        };
      });

      // Keep 300 ms either side of the voiced part; recognition is faster and playback tidier.
      const all = concat(chunks, total);
      const frameLen = chunks.length ? chunks[0].length : 2048;
      const firstV = frames.indexOf(true), lastV = frames.lastIndexOf(true);
      const pad = Math.ceil((0.3 * sr) / frameLen);
      const samples = firstV < 0 ? all : all.subarray(Math.max(0, firstV - pad) * frameLen, Math.min(frames.length, lastV + 1 + pad) * frameLen);
      return { samples, sampleRate: sr, voicedMs: tracker.voicedMs, longestVoicedMs: tracker.longestVoicedMs, durationMs: tracker.elapsedMs };
    } finally {
      this.active = null;
      for (const step of [() => proc && (proc.onaudioprocess = null), () => source && source.disconnect(), () => proc && proc.disconnect(), () => sink && sink.disconnect(), () => stream && stream.getTracks().forEach(t => t.stop())]) {
        try { step(); } catch (e) { console.warn("Mic cleanup:", e); }
      }
    }
  }

  play(recording) {
    const ctx = this.unlock();
    const buf = ctx.createBuffer(1, recording.samples.length, recording.sampleRate);
    buf.getChannelData(0).set(recording.samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    return new Promise(resolve => { src.onended = resolve; src.start(); });
  }
}
