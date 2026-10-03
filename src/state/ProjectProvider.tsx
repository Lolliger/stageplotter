import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { assign } from '../lib/assign'
import { loadProject, saveProject } from '../lib/storage'
import { createDefaultProject } from '../model/defaults'
import type { Project } from '../model/types'
import { ProjectContext, type ProjectStore } from './context'
import { historyReducer, initHistory } from './history'

const SAVE_DELAY = 300

export function ProjectProvider({ initial, children }: { initial?: Project; children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, initial, (p) =>
    initHistory(p ?? loadProject() ?? createDefaultProject()),
  )
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

  // Debounced speichern, damit Drag nicht bei jedem Pixel schreibt.
  useEffect(() => {
    const t = setTimeout(() => saveProject(project), SAVE_DELAY)
    return () => clearTimeout(t)
  }, [project])

  // Beim Verlassen/Wegwechseln sofort sichern (iOS beendet Tabs ohne Vorwarnung).
  useEffect(() => {
    const flush = () => saveProject(project)
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [project])

  return <ProjectContext.Provider value={store}>{children}</ProjectContext.Provider>
}
