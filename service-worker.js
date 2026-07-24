const CACHE_VERSION = "hideline-shell-v1.2.0";
const RUNTIME_CACHE = "hideline-runtime-v1.2.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./config.js",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
  "./src/styles.css",
  "./src/app.js",
  "./src/core/constants.js",
  "./src/core/format.js",
  "./src/core/time.js",
  "./src/core/geo.js",
  "./src/core/score.js",
  "./src/core/store.js",
  "./src/core/deduction.js",
  "./src/core/spatial.js",
  "./src/data/stations.js",
  "./src/data/questions.js",
  "./src/data/question-deduction.js",
  "./src/data/rules.js",
  "./src/data/boundary.js",
  "./src/data/station-geo.js",
  "./src/services/geolocation.js",
  "./src/services/tfl.js",
  "./src/services/media.js",
  "./src/services/evidence.js",
  "./src/services/map.js",
  "./src/services/spatial-data.js",
  "./src/services/stations.js",
  "./src/services/supabase.js",
  "./src/ui/icons.js",
  "./src/ui/shell.js",
  "./src/ui/play.js",
  "./src/ui/map-view.js",
  "./src/ui/deduction-view.js",
  "./src/ui/questions-view.js",
  "./src/ui/tools-view.js",
  "./src/ui/rules-view.js",
  "./src/ui/modals.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_VERSION, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    const cacheableLeaflet = url.hostname === "unpkg.com" && url.pathname.includes("/leaflet@1.9.4/dist/");
    if (cacheableLeaflet) {
      event.respondWith(
        caches.open(RUNTIME_CACHE).then(async (cache) => {
          const cached = await cache.match(request);
          if (cached) return cached;
          const response = await fetch(request);
          if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
          return response;
        })
      );
    }
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () => (await caches.match("./index.html")) || caches.match("./offline.html"))
    );
    return;
  }

  if (url.pathname.endsWith("/config.js")) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
