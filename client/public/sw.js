const cacheName = "iron-forge-static-v4";
const cacheableDestinations = new Set(["document", "font", "image", "manifest", "script", "style"]);

function canCache(request) {
  const url = new URL(request.url);
  return request.method === "GET"
    && url.origin === self.location.origin
    && !url.searchParams.has("token")
    && !request.headers.has("authorization")
    && !url.pathname.startsWith("/api/")
    && !url.pathname.includes("/api/")
    && cacheableDestinations.has(request.destination);
}

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

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
  if (!canCache(event.request)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetchAndCache(event.request).catch(async () => (await caches.match(event.request)) ?? Response.error()));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) {
      event.waitUntil(fetchAndCache(event.request).catch(() => undefined));
      return cached;
    }
    return fetchAndCache(event.request);
  }));
});
