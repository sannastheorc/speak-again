// SEEDSED — mirror.js
// Purpose: VISUAL FEEDBACK. Shows the front camera as a mirror so he can watch his lips and tongue.
// Boundaries: preview only. Nothing is recorded, stored or sent anywhere.

let stream = null;

export async function startMirror(video) {
  if (stream) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
    video.srcObject = stream;
    video.setAttribute("playsinline", "");
    video.muted = true;
    await video.play().catch(() => {});
    return true;
  } catch (e) {
    console.warn("Mirror unavailable:", e);
    stream = null;
    return false;
  }
}

export function stopMirror(video) {
  if (stream) stream.getTracks().forEach(t => { try { t.stop(); } catch {} });
  stream = null;
  if (video) video.srcObject = null;
}

export const mirrorOn = () => !!stream;
