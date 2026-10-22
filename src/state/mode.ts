import type { PlotMode } from '../model/types'

export type { PlotMode }

/** Zuletzt gewählter Modus; wird im Browser gemerkt, nicht im Projekt gespeichert. */
const KEY = 'stageplot.mode'

export function loadMode(): PlotMode {
  try {
    return localStorage.getItem(KEY) === 'lighting' ? 'lighting' : 'sound'
  } catch {
    return 'sound'
  }
}

export function saveMode(mode: PlotMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // privater Modus: Modus gilt nur bis zum Neuladen
  }
}
