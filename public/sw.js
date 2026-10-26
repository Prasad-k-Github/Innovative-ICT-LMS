// Innovative ICT service worker (අඩු data භාවිතය සහ offline):
// - static assets (JS/CSS/fonts/icons/logo) cache කරයි -> නැවත විවෘත කිරීම වේගවත් සහ data අඩුයි
// - ආරක්ෂාව: පිටු (HTML), API සහ ලොග් වූ සිසුන්ගේ දත්ත කිසිවිටෙක cache නොකරයි (බෙදාගත් දුරකථනවල පෞද්ගලිකත්වය)
// - network නැති විට පමණක් /offline.html පෙන්වයි
const STATIC = "ict-static-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/pwa-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
