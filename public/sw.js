/* CONFESS service worker.
 * Sengaja minimal & aman:
 *  - TIDAK menyimpan halaman HTML, /api, maupun data Firebase (data pengguna
 *    dan moderasi harus selalu segar).
 *  - Aset statis berhash (/_next/static) dan ikon: cache-first.
 *  - Navigasi: jaringan dulu; bila offline tampilkan /offline.html.
 * Ubah VERSION untuk membersihkan cache lama.
 */
const VERSION = "v1";
const STATIC_CACHE = `confess-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("confess-static-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Deezer, dll: biarkan
  if (url.pathname.startsWith("/api/")) return;

  // Navigasi halaman: jaringan dulu, fallback ke halaman offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then(
          (res) => res || new Response("Offline", { status: 503, statusText: "Offline" })
        )
      )
    );
    return;
  }

  // Aset statis: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
