import type { Project } from '../../model/types'
import { assign, type Assignment } from '../assign'
import { parseProject, type ParseResult } from '../schema'
import { inputTables, outputTables, signalTables } from './tables'

/**
 * Abgeleiteter Patch zum Nachlesen in der Datei: Ports, Mikros, Abstände, Signalweg, Hinweise.
 * Wird beim Import ignoriert und aus dem Projekt neu berechnet (siehe D29).
 */
export function patchSummary(project: Project, assignment: Assignment = assign(project)) {
  const inputs = inputTables(project, assignment)
  const outputs = outputTables(project, assignment)
  return {
    note: 'Nur zur Info: Ports, Abstände und Signalweg werden beim Import aus dem Projekt neu berechnet.',
    inputs: inputs.boxes.flatMap((t) =>
      t.rows.map((r, i) => ({
        box: t.box.name,
        port: r.port,
        channel: r.channel,
        instrument: r.group,
        pickup: r.pickup,
        ...(r.note ? { note: r.note } : {}),
        distance: r.distance,
        ...(t.pinned.has(i) ? { pinned: true } : {}),
      })),
    ),
    unpatchedInputs: inputs.unpatched.map((r) => ({ channel: r.channel, instrument: r.group, pickup: r.pickup })),
    outputs: outputs.boxes.flatMap((t) =>
      t.rows.map((r, i) => ({
        box: t.box.name,
        port: r.port,
        target: r.name,
        kind: r.kind,
        distance: r.distance,
        ...(t.pinned.has(i) ? { pinned: true } : {}),
      })),
    ),
    unpatchedOutputs: outputs.unpatched.map((r) => ({ target: r.name, kind: r.kind })),
    signalChain: signalTables(project, assignment).map((t) => ({
      device: t.device.name,
      title: t.title,
      summary: t.summary,
      ...(t.feeds.length ? { feeds: t.feeds } : {}),
      ports: t.rows.map((r) => ({ port: r.port, ...(r.name ? { name: r.name } : {}), from: r.from, detail: r.detail, to: r.to })),
    })),
    warnings: assignment.warnings.map((w) => `${w.level === 'error' ? 'Fehler' : 'Hinweis'}: ${w.message}`),
  }
}

/**
 * Exportformat: Kennung, das Projekt (alles, was zum Wiederherstellen nötig ist) und zum Nachlesen
 * der abgeleitete Patch.
 */
export function serializeProject(project: Project, date = new Date(), assignment?: Assignment): string {
  return JSON.stringify(
    { app: 'stageplot', exportedAt: date.toISOString(), ...project, patch: patchSummary(project, assignment) },
    null,
    2,
  )
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
