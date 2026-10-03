import type { Project } from '../model/types'
import { parseProject } from './schema'

const KEY = 'stageplot.project'

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const result = parseProject(JSON.parse(raw))
    return result.ok ? result.project : null
  } catch {
    return null
  }
}

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(project))
  } catch {
    // Speicher voll oder privater Modus: App funktioniert weiter, nur ohne Persistenz.
  }
}
