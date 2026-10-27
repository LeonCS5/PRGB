// O build injeta a versão e todos os arquivos necessários para abrir offline.
const CACHE_NAME = 'prgb-shell-__BUILD_VERSION__'
const SHELL_FILES = __SHELL_FILES__
const shellUrls = new Set(SHELL_FILES.map((file) => new URL(file, self.registration.scope).href))
const indexUrl = new URL('index.html', self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...shellUrls])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter((key) => key.startsWith('prgb-shell-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/songsterr') || url.pathname.startsWith('/cdn/songsterr')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      try {
        const response = await fetch(request)
        if (!response.ok) throw new Error('Falha ao carregar o app.')
        if (response.type === 'basic' && response.headers.get('content-type')?.includes('text/html')
          && (url.pathname === new URL(self.registration.scope).pathname || url.href === indexUrl)) {
          await cache.put(indexUrl, response.clone())
        }
        return response
      } catch (error) {
        const cached = await cache.match(indexUrl)
        if (cached) return cached
        throw error
      }
    })())
    return
  }

  url.search = ''
  if (shellUrls.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(url.href)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(url.href, response.clone())
      return response
    })())
  }
})
