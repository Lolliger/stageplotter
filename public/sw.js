/* stageplot Service Worker: macht die App offline nutzbar (z. B. in Venues ohne Netz).
 * Beim Installieren werden alle Dateien aus precache-manifest.json (vom Build erzeugt, inkl.
 * nachgeladener Chunks wie dem PDF-Export) zwischengespeichert. Die Build-Version steht in der
 * Registrierungs-URL (?build=…), dadurch installiert jeder neue Build einen neuen Worker.
 * Alle Pfade sind relativ zum Worker, die App kann also auch unter einem Unterpfad liegen. */
const BUILD = new URL(self.location.href).searchParams.get('build') || 'dev'
const CACHE = `stageplot-${BUILD}`
/** Startseite der App, z. B. https://ak-seite.de/stageplot/ */
const APP_ROOT = new URL('./', self.location.href).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(new URL('precache-manifest.json', APP_ROOT), { cache: 'no-store' })
      const { files } = await res.json()
      const cache = await caches.open(CACHE)
      await cache.addAll([APP_ROOT, ...files.map((f) => new URL(f, APP_ROOT).href)])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('stageplot-') && k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // Seitenaufrufe: erst Netz (aktuelle Version), offline die zwischengespeicherte App.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(APP_ROOT)) || Response.error()),
    )
    return
  }

  // Dateien: aus dem Cache, sonst Netz (und für später merken).
  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE)
        cache.put(request, response.clone())
      }
      return response
    })(),
  )
})
