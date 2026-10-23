import type { Project } from '../model/types'
import { parseProject } from './schema'

/** Minimaler Ausschnitt von `Storage`, damit die Bibliothek ohne Browser testbar bleibt. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Eintrag in „Meine Plots“. Das Projekt selbst liegt unter einem eigenen Schlüssel. */
export interface ProjectMeta {
  id: string
  name: string
  /** ISO-Zeitpunkt der letzten Speicherung. */
  updatedAt: string
}

const INDEX_KEY = 'stageplot.projects'
const CURRENT_KEY = 'stageplot.current'
const PROJECT_PREFIX = 'stageplot.project.'
/** Bis D33 gab es genau ein Projekt unter diesem Schlüssel. */
export const LEGACY_KEY = 'stageplot.project'

function readIndex(store: KeyValueStore): ProjectMeta[] {
  try {
    const raw = store.getItem(INDEX_KEY)
    const data: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(data)) return []
    return data.filter(
      (m): m is ProjectMeta =>
        typeof m === 'object' &&
        m !== null &&
        typeof m.id === 'string' &&
        typeof m.name === 'string' &&
        typeof m.updatedAt === 'string',
    )
  } catch {
    return []
  }
}

function writeIndex(store: KeyValueStore, index: ProjectMeta[]): void {
  store.setItem(INDEX_KEY, JSON.stringify(index))
}

/** Alle Plots, zuletzt gespeicherte zuerst. */
export function listProjects(store: KeyValueStore): ProjectMeta[] {
  return [...readIndex(store)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadProjectById(store: KeyValueStore, id: string): Project | null {
  try {
    const raw = store.getItem(PROJECT_PREFIX + id)
    if (!raw) return null
    const result = parseProject(JSON.parse(raw))
    return result.ok ? result.project : null
  } catch {
    return null
  }
}

/** Speichert ein Projekt und hält den Eintrag in der Liste (Name, Zeitpunkt) aktuell. */
export function saveProjectById(store: KeyValueStore, id: string, project: Project, now: Date = new Date()): void {
  store.setItem(PROJECT_PREFIX + id, JSON.stringify(project))
  const meta: ProjectMeta = { id, name: project.name, updatedAt: now.toISOString() }
  const index = readIndex(store).filter((m) => m.id !== id)
  writeIndex(store, [...index, meta])
}

export function deleteProjectById(store: KeyValueStore, id: string): void {
  store.removeItem(PROJECT_PREFIX + id)
  writeIndex(
    store,
    readIndex(store).filter((m) => m.id !== id),
  )
  if (store.getItem(CURRENT_KEY) === id) store.removeItem(CURRENT_KEY)
}

export function setCurrentId(store: KeyValueStore, id: string): void {
  store.setItem(CURRENT_KEY, id)
}

/**
 * Das zuletzt geöffnete Projekt. Übernimmt beim ersten Start das alte Einzelprojekt in die Liste;
 * gibt es gar nichts (oder nichts Lesbares), entsteht über `create` ein neues.
 */
export function openCurrent(
  store: KeyValueStore,
  newId: () => string,
  create: () => Project,
  now: Date = new Date(),
): { id: string; project: Project } {
  const legacy = store.getItem(LEGACY_KEY)
  if (legacy !== null) {
    let project: Project | null = null
    try {
      const result = parseProject(JSON.parse(legacy))
      if (result.ok) project = result.project
    } catch {
      // Unlesbares Altprojekt wird verworfen wie bisher beim Laden.
    }
    if (project) {
      const id = newId()
      saveProjectById(store, id, project, now)
      setCurrentId(store, id)
    }
    store.removeItem(LEGACY_KEY)
  }

  const currentId = store.getItem(CURRENT_KEY)
  const candidates = [currentId, ...listProjects(store).map((m) => m.id)]
  for (const id of candidates) {
    if (!id) continue
    const project = loadProjectById(store, id)
    if (project) {
      setCurrentId(store, id)
      return { id, project }
    }
  }

  const id = newId()
  const project = create()
  saveProjectById(store, id, project, now)
  setCurrentId(store, id)
  return { id, project }
}
