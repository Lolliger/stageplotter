import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline-Fähigkeit nur im Produktionsbuild (im Dev-Server würde der Cache stören).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?build=${__BUILD_ID__}`).catch(() => {
      // Ohne Service Worker funktioniert die App weiter, nur nicht offline.
    })
  })
}
