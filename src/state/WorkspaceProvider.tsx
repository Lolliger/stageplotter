import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { newId } from '../lib/id'
import {
  deleteProjectById,
  listProjects,
  loadProjectById,
  openCurrent,
  saveProjectById,
  setCurrentId,
  type KeyValueStore,
} from '../lib/library'
import { EventSaver, eventIdFromSearch, loadEventPlot, type EventPlot, type SyncState } from '../lib/remote'
import { createDefaultProject } from '../model/defaults'
import type { Project } from '../model/types'
import { ProjectProvider } from './ProjectProvider'
import { WorkspaceContext, type WorkspaceStore } from './workspace'

/** localStorage, oder ein Speicher, der nichts behält (privater Modus, gesperrte Cookies). */
function browserStore(): KeyValueStore {
  try {
    const s = window.localStorage
    s.getItem('stageplot.projects')
    return {
      getItem: (k) => s.getItem(k),
      setItem: (k, v) => {
        try {
          s.setItem(k, v)
        } catch {
          // Speicher voll: App funktioniert weiter, nur ohne Persistenz.
        }
      },
      removeItem: (k) => s.removeItem(k),
    }
  } catch {
    const data = new Map<string, string>()
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
  }
}

/** Zeit, bis eine Änderung an den Server geht. Länger als lokal, Drags kommen gebündelt an. */
const EVENT_SAVE_DELAY = 1000

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const eventId = useMemo(() => eventIdFromSearch(window.location.search), [])
  return eventId ? (
    <EventWorkspaceProvider eventId={eventId}>{children}</EventWorkspaceProvider>
  ) : (
    <LocalWorkspaceProvider>{children}</LocalWorkspaceProvider>
  )
}

function LocalWorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => browserStore(), [])
  const [current, setCurrent] = useState(() => openCurrent(store, newId, createDefaultProject))

  const persist = useCallback((project: Project) => saveProjectById(store, current.id, project), [store, current.id])

  const workspace = useMemo<WorkspaceStore>(() => {
    const show = (id: string, project: Project) => {
      setCurrentId(store, id)
      setCurrent({ id, project })
    }
    return {
      kind: 'local',
      projectId: current.id,
      list: () => listProjects(store),
      open: (id) => {
        const project = loadProjectById(store, id)
        if (project) show(id, project)
      },
      create: (project = createDefaultProject()) => {
        const id = newId()
        saveProjectById(store, id, project)
        show(id, project)
      },
      remove: (id) => {
        deleteProjectById(store, id)
        if (id === current.id) setCurrent(openCurrent(store, newId, createDefaultProject))
      },
    }
  }, [store, current.id])

  return (
    <WorkspaceContext.Provider value={workspace}>
      {/* key: neues Projekt = neuer Undo-Verlauf, man kann nicht in ein anderes Projekt zurück. */}
      <ProjectProvider key={current.id} initial={current.project} onPersist={persist}>
        {children}
      </ProjectProvider>
    </WorkspaceContext.Provider>
  )
}

/** Pro geladenem Stand ein eigener Speicherer: Der alte Editor kann beim Schließen nichts mehr an den neuen schicken. */
type Loaded = { plot: EventPlot; project: Project; saver: EventSaver; session: number }

function EventWorkspaceProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const local = useMemo(() => browserStore(), [])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncState>({ kind: 'saved' })

  const start = useCallback(
    (plot: EventPlot, project: Project, revision: number, stored: Project | null) => {
      const saver = new EventSaver(eventId, revision, stored, setSync)
      setSync({ kind: 'saved' })
      setLoaded((prev) => ({ plot, project, saver, session: (prev?.session ?? 0) + 1 }))
    },
    [eventId],
  )

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof loadEventPlot>>) => {
      if (!result.ok) {
        setError(result.error)
        return
      }
      const { plot } = result
      const project = plot.project ?? { ...createDefaultProject(), name: plot.event.name }
      start(plot, project, plot.revision, plot.project)
    },
    [start],
  )

  const load = useCallback(() => loadEventPlot(eventId).then(apply), [eventId, apply])

  useEffect(() => {
    let active = true
    void loadEventPlot(eventId).then((result) => active && apply(result))
    return () => {
      active = false
    }
  }, [eventId, apply])

  // Wieder online: liegengebliebene Änderungen senden.
  const saver = loaded?.saver
  useEffect(() => {
    if (!saver) return
    const onOnline = () => saver.retry()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [saver])

  const canEdit = loaded?.plot.canEdit ?? false
  const persist = useCallback(
    (project: Project) => {
      if (canEdit) saver?.save(project)
    },
    [canEdit, saver],
  )

  const workspace = useMemo<WorkspaceStore | null>(() => {
    if (!loaded) return null
    return {
      kind: 'event',
      event: loaded.plot.event,
      canEdit,
      sync,
      retry: () => loaded.saver.retry(),
      keepMine: () => {
        if (sync.kind === 'conflict') loaded.saver.overwrite(sync.revision)
      },
      takeTheirs: () => {
        if (sync.kind !== 'conflict') return
        start(loaded.plot, sync.project ?? loaded.project, sync.revision, sync.project)
      },
      listLocal: () => listProjects(local),
      loadLocal: (id) => loadProjectById(local, id),
      copyToLocal: (project) => saveProjectById(local, newId(), project),
    }
  }, [loaded, canEdit, sync, start, local])

  if (!workspace || !loaded) {
    return (
      <div className="app-status">
        {error ? (
          <>
            <p className="hint hint-error" role="alert">
              Der Plot des Events konnte nicht geladen werden: {error}
            </p>
            <div className="menu-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setError(null)
                  void load()
                }}
              >
                Erneut versuchen
              </button>
              <a className="btn" href={window.location.pathname}>
                Meine Plots öffnen
              </a>
            </div>
          </>
        ) : (
          <p className="hint">Plot wird geladen …</p>
        )}
      </div>
    )
  }

  return (
    <WorkspaceContext.Provider value={workspace}>
      <ProjectProvider key={loaded.session} initial={loaded.project} onPersist={persist} saveDelay={EVENT_SAVE_DELAY}>
        {children}
      </ProjectProvider>
    </WorkspaceContext.Provider>
  )
}
