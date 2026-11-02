// Keeps the app's code, styles, fonts and icons on the phone so opening Casa
// doesn't download them again. Pages and data always come from the network:
// pages so sign-in is checked as usual, data so it's never out of date (each
// section shows its last data itself while it loads; see src/lib/saved-copy.ts).
// Offline mode is out of scope.

// The page registers /sw.js?cache=1 in production only: in development the
// files under /_next/static change without changing name.
const CACHING = new URL(self.location.href).searchParams.get("cache") === "1";

// Bump to throw away everything cached by an older version of this file.
const CACHE = "casa-files-v1";
// Each deploy adds new files; keep the most recent ones.
const MAX_ENTRIES = 400;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE || !CACHING) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHING) return;
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js gives these a new name whenever they change, so a stored copy is
  // always right.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
    // These keep their name when changed: show the stored copy, update it for next time.
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(request);
  if (stored) return stored;
  const response = await fetch(request);
  if (response.ok) await store(cache, request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await store(cache, request, response.clone());
    return response;
  });
  if (stored) {
    event.waitUntil(fresh.catch(() => {}));
    return stored;
  }
  return fresh;
}

async function store(cache, request, response) {
  await cache.put(request, response);
  // Keys come back oldest first.
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
}
