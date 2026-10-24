// Minimal service worker so the app is installable where browsers require
// one. It deliberately caches nothing: offline mode is out of scope for v1.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
