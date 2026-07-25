// Service worker da PWA — Fase 1 (fundação).
// Regra de ouro: NUNCA cachear HTML autenticado nem respostas do Supabase.
// As páginas do técnico são force-dynamic com dados por RLS (por usuário);
// servir uma página cacheada mostraria dados de outro técnico. Por isso:
//   - navegação (HTML): network-first, cai no /offline.html só quando offline;
//   - assets estáticos versionados (_next/static, /icons, /brands): cache-first;
//   - todo o resto (Supabase, Server Actions, POST): passa direto, sem cache.

const CACHE_VERSION = 'v2'
const SHELL_CACHE = `wave-shell-${CACHE_VERSION}`
const ASSET_CACHE = `wave-assets-${CACHE_VERSION}`

const SHELL_ASSETS = [
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brands/')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegação (documentos HTML): network-first, offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then((r) => r ?? Response.error()),
      ),
    )
    return
  }

  // Assets estáticos versionados: cache-first com revalidação em background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
  }
})

// --- Web Push (ADR-018): entrega com o app fechado. ---

// Payload esperado: { title, body?, link? } (JSON). Fallback defensivo caso venha vazio.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Wave Ops', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Wave Ops'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: data.link || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Ao clicar: foca uma aba já aberta do app (navegando para o link) ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(link)
            return client.focus()
          }
        }
        return self.clients.openWindow(link)
      }),
  )
})
