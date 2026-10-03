/** Dateiname wie "stageplot-sommerfest-2026-10-03.json". */
export function exportFileName(projectName: string, ext: string, date = new Date()): string {
  const slug = projectName
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
  return ['stageplot', slug || null, day].filter(Boolean).join('-') + '.' + ext
}

/**
 * Datei ausgeben: auf Touch-Geräten über das Teilen-Menü (iOS: „In Dateien sichern“, AirDrop,
 * Mail), sonst als normaler Download.
 */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type })
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // Nutzer hat abgebrochen
      // sonst auf Download zurückfallen
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  // Im iframe: falls der Browser den Download ignoriert, öffnet sich die Datei in einem neuen Tab,
  // statt den Editor wegzunavigieren.
  if (window.self !== window.top) a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
