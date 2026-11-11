const CACHE = "bn-lanches-static-v1";
const ASSETS = ["/","/cardapio.css","/cardapio.js","/catalog.mjs","/install.js","/manifest.webmanifest","/icons/bn.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/admin.html" || url.pathname === "/admin.js" || url.pathname === "/painel.html") return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match("/")) || Response.error();
    }));
    return;
  }
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) {
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
      }
      return response;
    }).catch(()=>caches.match(req)));
  }
});