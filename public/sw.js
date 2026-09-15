// Kolhapuri Khanawal Restaurant OS — Service Worker
const CACHE_NAME = "khanawal-pwa-v2";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/waiter",
  "/kitchen",
  "/billing",
  "/menu",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
];

// 1. Install: Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn("PWA: Some pre-cache assets failed to load", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Message listener for skip waiting prompt from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 2. Activate: Clean old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("PWA: Evicting obsolete cache", key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch: Network-First for Navigation / HTML pages, Cache-First for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignore non-GET and chrome-extension / API requests
  if (request.method !== "GET" || !request.url.startsWith("http")) {
    return;
  }

  // A. Navigation requests (HTML pages) -> Network First with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/dashboard");
          if (fallback) return fallback;
          return caches.match("/");
        })
    );
    return;
  }

  // B. Static Assets (_next/static, images, icons, fonts) -> Cache First
  const isStatic =
    request.url.includes("/_next/static/") ||
    request.url.includes("/icons/") ||
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style";

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            // Never cache HTML fallback pages as stylesheets/scripts
            !networkResponse.headers.get("content-type")?.includes("text/html")
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C. Standard requests: Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
