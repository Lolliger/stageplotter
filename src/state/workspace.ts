import { createContext, useContext } from 'react'
import type { ProjectMeta } from '../lib/library'
import type { EventInfo, SyncState } from '../lib/remote'
import type { Project } from '../model/types'

/** Plots im Browser („Meine Plots“), siehe D33. */
export interface LocalWorkspace {
  kind: 'local'
  projectId: string
  list: () => ProjectMeta[]
  open: (id: string) => void
  /** Legt einen neuen Plot an (leer oder z. B. aus einer Datei) und öffnet ihn. */
  create: (project?: Project) => void
  remove: (id: string) => void
}

/** Plot eines Events in der AK-Technik-App, für alle im Team gleich. */
export interface EventWorkspace {
  kind: 'event'
  event: EventInfo
  canEdit: boolean
  sync: SyncState
  retry: () => void
  /** Konflikt: den eigenen Stand speichern und den anderen überschreiben. */
  keepMine: () => void
  /** Konflikt: den Stand der anderen Person übernehmen (eigene Änderungen gehen verloren). */
  takeTheirs: () => void
  /** Die Plots aus dem Browser, um einen davon ins Event zu übernehmen. */
  listLocal: () => ProjectMeta[]
  loadLocal: (id: string) => Project | null
  /** Speichert den Stand zusätzlich unter „Meine Plots“. */
  copyToLocal: (project: Project) => void
}

export type WorkspaceStore = LocalWorkspace | EventWorkspace

export const WorkspaceContext = createContext<WorkspaceStore | null>(null)

export function useWorkspace(): WorkspaceStore {
  const store = useContext(WorkspaceContext)
  if (!store) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return store
}
