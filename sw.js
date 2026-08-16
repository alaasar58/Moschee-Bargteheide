/* Offline-Betrieb der Website.

   Seiten, Gestaltung und Inhalte werden zwischengespeichert und im Hintergrund
   aufgefrischt. Die Gebetszeiten werden zuerst aus dem Netz geholt; ohne
   Verbindung kommen sie aus dem Speicher – so sind sie auch offline verfuegbar. */

const VERSION = "v2";
const SHELL_CACHE = `moschee-shell-${VERSION}`;
const DATA_CACHE = `moschee-data-${VERSION}`;

const SHELL = [
  "./",
  "index.html",
  "gebetszeiten.html",
  "ramadan.html",
  "kurse.html",
  "neuigkeiten.html",
  "veranstaltungen.html",
  "ueber-uns.html",
  "kontakt.html",
  "mitglied-werden.html",
  "spenden.html",
  "uebersicht.html",
  "website-fuer-moscheen.html",
  "assets/css/style.css",
  "assets/js/site.js",
  "assets/js/pages.js",
  "assets/js/prayer.js",
  "assets/js/hijri.js",
  "assets/js/ramadan.js",
  "assets/js/content.js",
  "assets/js/overview.js",
  "assets/js/service.js",
  "assets/img/favicon.svg",
  "content/settings.json",
  "content/islamic-days.json",
  "content/news.json",
  "content/events.json",
  "content/courses.json",
  "content/overview.json",
  "content/service.json",
  "content/i18n/de.json",
  "content/i18n/tr.json",
  "content/i18n/ar.json",
  "content/i18n/sq.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Einzeln ablegen: Fehlt eine Datei, scheitert nicht die ganze Installation.
      .then((cache) => Promise.all(SHELL.map((path) => cache.add(path).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Ohne Abfrageteil ablegen – die Website haengt an JSON-Dateien ein "?v=..." an,
  // sonst wuerde der Speicher mit immer neuen Eintraegen volllaufen.
  const cacheKey = new Request(url.origin + url.pathname);

  // Gebetszeiten: erst das Netz, dann der Speicher.
  if (url.pathname.endsWith("/data/prayer-times.json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(cacheKey, copy));
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  // Alles andere: aus dem Speicher anzeigen und im Hintergrund auffrischen.
  event.respondWith(
    caches.match(cacheKey).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(cacheKey, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
