/* Service Worker: haelt die statische App-Huelle offline verfuegbar. API-Aufrufe gehen immer ins Netz. */
const CACHE = "network-shell-v3";
const SCOPE = self.registration.scope;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icon.svg`])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!url.href.startsWith(SCOPE) || url.pathname.includes("/api/") || url.pathname.includes("/dns-query")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
