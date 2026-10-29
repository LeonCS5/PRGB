import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'prgb-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const publicFiles = [
        'favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
        'fonts/inter-latin-wght-normal.woff2', 'fonts/space-grotesk-latin-wght-normal.woff2',
        'fonts/jetbrains-mono-latin-wght-normal.woff2'
      ]
      const shellFiles = ['index.html', ...Object.keys(bundle).filter((file) => file.startsWith('assets/')), ...publicFiles]
      const template = readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8')
      const hash = createHash('sha256').update(template)
      for (const file of Object.values(bundle)) {
        hash.update(file.type === 'chunk' ? file.code : file.source)
      }
      for (const file of publicFiles) {
        hash.update(readFileSync(new URL(`./public/${file}`, import.meta.url)))
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 16))
          .replace('__SHELL_FILES__', JSON.stringify(shellFiles)),
      })
    },
  }],
  server: {
    port: 5173,
    proxy: {
      '/api/songsterr': {
        target: 'https://www.songsterr.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/songsterr/, '/api'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      },
      '/cdn/songsterr': {
        target: 'https://dqsljvtekg760.cloudfront.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cdn\/songsterr/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    }
  }
})
