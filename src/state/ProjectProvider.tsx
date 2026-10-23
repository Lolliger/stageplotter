import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { assign } from '../lib/assign'
import type { Project } from '../model/types'
import { ProjectContext, type ProjectStore } from './context'
import { historyReducer, initHistory } from './history'

interface Props {
  initial: Project
  /** Speichert den Stand (lokal oder beim Event, siehe WorkspaceProvider). */
  onPersist: (project: Project) => void
  /** Wartezeit nach der letzten Änderung, damit Drag nicht bei jedem Pixel speichert. */
  saveDelay?: number
  children: ReactNode
}

export function ProjectProvider({ initial, onPersist, saveDelay = 300, children }: Props) {
  const [history, dispatch] = useReducer(historyReducer, initial, initHistory)
  const project = history.present
  const assignment = useMemo(() => assign(project), [project])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const store = useMemo<ProjectStore>(
    () => ({
      project,
      dispatch,
      assignment,
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      canUndo,
      canRedo,
    }),
    [project, assignment, canUndo, canRedo],
  )

  const persist = useRef(onPersist)
  const latest = useRef(project)
  const dirty = useRef(false)
  useEffect(() => {
    persist.current = onPersist
  }, [onPersist])

  useEffect(() => {
    latest.current = project
    if (project === initial) return
    dirty.current = true
    const t = setTimeout(() => {
      dirty.current = false
      persist.current(project)
    }, saveDelay)
    return () => clearTimeout(t)
  }, [project, initial, saveDelay])

  // Beim Verlassen, Wegwechseln und beim Wechsel auf ein anderes Projekt sofort sichern
  // (iOS beendet Tabs ohne Vorwarnung).
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return
      dirty.current = false
      persist.current(latest.current)
    }
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [])

  return <ProjectContext.Provider value={store}>{children}</ProjectContext.Provider>
}
