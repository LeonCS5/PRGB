// O build injeta a versão e todos os arquivos necessários para abrir offline.
const CACHE_NAME = 'prgb-shell-__BUILD_VERSION__'
const SHELL_FILES = __SHELL_FILES__
const shellUrls = new Set(SHELL_FILES.map((file) => new URL(file, self.registration.scope).href))
const NAVIGATION_TIMEOUT_MS = 3500
const indexUrl =new URL('index.html', self.registration.scope).href

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
    || /^\/(api|cdn2?)\/tabs\//.test(url.pathname)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      // The index is never rewritten here: this cache belongs to one build, and a newer index (served while this
      // worker is still the active one) points to chunks that only the newer cache has. The index of this build
      // entered the cache at install.
      const network = fetch(request).then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar o app.')
        return response
      })
      network.catch(() => {}) // a late failure after the cached shell was served must not surface
      // Slow network: open the cached shell instead of leaving a blank tab, but only if there is one
      let timer
      const slow = new Promise((resolve) => {
        timer = setTimeout(async () => resolve(await cache.match(indexUrl)), NAVIGATION_TIMEOUT_MS)
      })
      try {
        const first = await Promise.race([network, slow])
        if (first) return first
        return await network
      } catch (error) {
        const cached = await cache.match(indexUrl)
        if (cached) return cached
        throw error
      } finally {
        clearTimeout(timer)
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
