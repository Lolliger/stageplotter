import { useContext } from 'react'
import { ProjectContext, type ProjectStore } from './context'

export function useProject(): ProjectStore {
  const store = useContext(ProjectContext)
  if (!store) throw new Error('useProject must be used inside <ProjectProvider>')
  return store
}
