import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { assign } from '../lib/assign'
import { loadProject, saveProject } from '../lib/storage'
import { createDefaultProject } from '../model/defaults'
import type { Project } from '../model/types'
import { ProjectContext } from './context'
import { projectReducer } from './reducer'

const SAVE_DELAY = 300

export function ProjectProvider({ initial, children }: { initial?: Project; children: ReactNode }) {
  const [project, dispatch] = useReducer(
    projectReducer,
    initial,
    (p) => p ?? loadProject() ?? createDefaultProject(),
  )
  const assignment = useMemo(() => assign(project), [project])
  const store = useMemo(() => ({ project, dispatch, assignment }), [project, assignment])

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
