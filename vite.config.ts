/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const BUILD_ID = Date.now().toString(36)

/** Schreibt die Liste aller Build-Dateien für den Service Worker (Offline-Cache). */
function precacheManifest(): Plugin {
  return {
    name: 'stageplot-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Relativ zum Service Worker, damit die App auch unter einem Unterpfad läuft.
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const extra = ['manifest.webmanifest', 'favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ build: BUILD_ID, files: [...files, ...extra] }, null, 2),
      })
    },
  }
}

export default defineConfig({
  // Relative Pfade: dieselbe Version läuft unter eigener Domain und unter einem Unterpfad
  // (z. B. ak-seite.de/stageplot/ per Vercel-Rewrite).
  base: './',
  plugins: [react(), precacheManifest()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    // Der PDF-Chunk (jsPDF, svg2pdf) ist groß, wird aber nur beim Export nachgeladen.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
