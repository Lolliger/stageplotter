import type { Project } from '../../model/types'
import { parseProject, type ParseResult } from '../schema'

/** Exportformat: das Projekt plus Kennung, damit fremde JSON-Dateien erkennbar sind. */
export function serializeProject(project: Project, date = new Date()): string {
  return JSON.stringify({ app: 'stageplot', exportedAt: date.toISOString(), ...project }, null, 2)
}

/** Liest eine importierte Datei. Fehlermeldungen sind für Nutzer formuliert. */
export function parseProjectFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' }
  }
  if (typeof data === 'object' && data !== null && 'app' in data && (data as { app: unknown }).app !== 'stageplot') {
    return { ok: false, error: 'Die Datei stammt nicht aus stageplot.' }
  }
  const result = parseProject(data)
  return result.ok ? result : { ok: false, error: `Ungültiges Projekt: ${result.error}` }
}
