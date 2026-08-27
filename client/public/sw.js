const cacheName = "powerlifting-program-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const responseCopy = response.clone();
      caches.open(cacheName).then((cache) => cache.put(event.request, responseCopy));
      return response;
    }))
  );
});
