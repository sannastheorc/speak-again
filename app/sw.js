// SEEDSED — sw.js
// Purpose: OFFLINE SHELL. Pre-caches every file the app needs and serves them cache-first, so the app
//          opens with no network. Bump VERSION whenever a shell file changes.
// Boundaries: the 41 MB speech model is NOT cached here; the speech engine keeps it in IndexedDB itself
//             (caching it twice would double the storage). A new version waits until the person taps
//             "Update now", so practice is never interrupted by a reload.

const VERSION = "speak-again-v1";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/curriculum.js", "js/assess.js", "js/feedback.js", "js/progress.js", "js/session.js",
  "js/audio.js", "js/recognizer.js", "js/speech.js", "js/mirror.js", "js/settings.js",
  "vendor/vosk.js", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.endsWith("/model/model.tar.gz")) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" && await cache.match("index.html"));
    if (hit) return hit;
    return fetch(req);
  })());
});
