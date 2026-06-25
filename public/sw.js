// Service Worker — WebApp Gestión Integral
// Estrategia: Cache First para assets estáticos, Network First para API

const CACHE_NAME = 'webapp-gestion-v1'
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json']

// Instalar: pre-cachear assets críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activar: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: Network First para Supabase, Cache First para el resto
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Supabase y otras APIs: siempre ir a la red (no cachear datos)
  if (url.hostname.includes('supabase') || event.request.method !== 'GET') {
    return
  }

  // Assets estáticos: Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }).catch(() => caches.match('/index.html'))
    })
  )
})
