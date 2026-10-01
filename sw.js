/* Service worker: permite usar la app sin internet y mostrar notificaciones.
   Si cambias algún archivo, sube el número de versión para que el celular lo actualice. */
const CACHE = "calendario-docente-v1";
const ARCHIVOS = [
  "./", "index.html", "styles.css", "horario.js", "app.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(claves =>
    Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Primero intenta internet (para recibir cambios); si no hay, usa la copia guardada
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});

// Al tocar una notificación se abre la app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(ventanas =>
    ventanas.length ? ventanas[0].focus() : self.clients.openWindow("./")));
});
