const CACHE_NAME = "project-leverage-v2";
const STATIC_ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/base.css",
  "css/components.css",
  "css/features.css",
  "js/app.js",
  "js/config.js",
  "js/state.js",
  "js/utils.js",
  "js/lab.js",
  "js/services/http.js",
  "js/services/market-values.js",
  "js/services/sleeper.js",
  "js/domain/players.js",
  "js/domain/leagues.js",
  "js/domain/managers.js",
  "js/domain/portfolio.js",
  "js/ui/dashboard.js",
  "js/ui/managers.js",
  "js/ui/portfolio.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
