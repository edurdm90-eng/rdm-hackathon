const IS_LOCAL_DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);
const CACHE_NAME = "rdm-hack-room-v4";
const APP_SHELL = ["/login", "/dashboard", "/hack-room", "/profile", "/manifest.webmanifest", "/icons/rdm-logo.png"];

function clearAllCaches() {
  return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
}

self.addEventListener("install", (event) => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(clearAllCaches().then(() => self.skipWaiting()));
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(
      clearAllCaches()
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: "window" }))
        .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url)))),
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (IS_LOCAL_DEV) {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.pathname.startsWith("/trpc") || url.pathname.startsWith("/api")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/login");
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "opaque") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    }),
  );
});
