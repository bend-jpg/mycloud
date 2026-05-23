// MyTitanCloud Service Worker — minimal mais suffisant pour rendre la PWA
// "installable" (Chrome/Edge/Android : déclenche beforeinstallprompt) +
// offline page de fallback.
//
// Stratégies :
//   - Navigation requests (HTML) : network-first, fallback offline page
//   - Assets statiques (icons, manifest, css, js) : cache-first
//   - API : toujours réseau, pas de cache (sensible)
//   - Tout le reste : stale-while-revalidate
//
// Version bumpée à chaque deploy via le build hash (ici on fait simple :
// on incrémente manuellement quand on change la logique).

const VERSION = "mytitancloud-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// Assets pré-cachés à l'install — minimal, on évite de surcharger.
// On utilise Promise.allSettled donc un 404 n'empêche pas l'install du SW.
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        // addAll fail si UN seul asset 404 — on fait du add individuel pour tolérer
        Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Nettoie les caches d'ancienne version
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // On ignore tout ce qui n'est pas GET et tout ce qui n'est pas même origine
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // API → toujours réseau, pas de cache (peut contenir des données privées)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation HTML → network-first, fallback dernière version cachée
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Met en cache la dernière version HTML
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(async () => {
          // Hors-ligne : sers la dernière version cachée, sinon la home
          const cached = await caches.match(req);
          return cached ?? caches.match("/");
        }),
    );
    return;
  }

  // Statics (css/js/icons) → cache-first avec revalidation en background
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          // Met à jour le cache pour la prochaine fois
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? networkFetch;
    }),
  );
});

// Notifications push (futur — on garde le handler vide pour activer le scope)
self.addEventListener("push", () => {
  // À implémenter quand on aura les notifications serveur
});
