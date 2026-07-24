const CACHE_VERSION = "hideline-shell-v2.2.1";
const RUNTIME_CACHE = "hideline-runtime-v2.2.1";
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
  "./src/styles.css?v=2.2.1",
  "./src/app.js?v=2.2.1",
  "./src/core/constants.js",
  "./src/core/format.js",
  "./src/core/time.js",
  "./src/core/geo.js",
  "./src/core/score.js",
  "./src/core/store.js",
  "./src/core/notifications.js",
  "./src/core/question-location.js",
  "./src/core/deduction.js",
  "./src/core/spatial.js",
  "./src/data/stations.js",
  "./src/data/questions.js",
  "./src/data/question-deduction.js",
  "./src/data/rules.js",
  "./src/data/boundary.js",
  "./src/data/thames-centreline.js",
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
  "./src/ui/question-location.js",
  "./src/ui/tools-view.js",
  "./src/ui/rules-view.js",
  "./src/ui/modals.js"
];

async function putIfCacheable(cache, request, response) {
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName = CACHE_VERSION) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: "no-store" });
    return putIfCacheable(cache, request, response);
  } catch {
    return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  }
}

async function cacheFirst(request, cacheName = CACHE_VERSION) {
  const cache = await caches.open(cacheName);
  const cached = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  if (cached) return cached;
  const response = await fetch(request);
  return putIfCacheable(cache, request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
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
    if (cacheableLeaflet) event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request).then((response) => response || caches.match("./offline.html"))
    );
    return;
  }

  const isVersionSensitive =
    url.pathname.endsWith("/config.js") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.includes("/src/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (isVersionSensitive) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || new URL("./?view=play", self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const sameOrigin = clients.find((client) => {
        try { return new URL(client.url).origin === new URL(target).origin; }
        catch { return false; }
      });
      if (sameOrigin) {
        if ("navigate" in sameOrigin) await sameOrigin.navigate(target);
        return sameOrigin.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
