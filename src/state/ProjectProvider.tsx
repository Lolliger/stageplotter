import { useMemo, useReducer, type ReactNode } from 'react'
import { assign } from '../lib/assign'
import { createDefaultProject } from '../model/defaults'
import type { Project } from '../model/types'
import { ProjectContext } from './context'
import { projectReducer } from './reducer'

export function ProjectProvider({ initial, children }: { initial?: Project; children: ReactNode }) {
  const [project, dispatch] = useReducer(projectReducer, initial, (p) => p ?? createDefaultProject())
  const assignment = useMemo(() => assign(project), [project])
  const store = useMemo(() => ({ project, dispatch, assignment }), [project, assignment])
  return <ProjectContext.Provider value={store}>{children}</ProjectContext.Provider>
}
