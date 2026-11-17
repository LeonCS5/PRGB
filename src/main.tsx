import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { getAppearance } from './appearance/useAppearance.ts'

// public/appearance-boot.js already applied the saved look before the first paint; this loads the store and
// applies it again (idempotent), and covers a browser where the boot script did not run
getAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.error('Não foi possível ativar o modo offline.', error)
    })
  })
}
