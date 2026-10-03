import { createContext, type Dispatch } from 'react'
import type { Assignment } from '../lib/assign'
import type { Project } from '../model/types'
import type { Action } from './reducer'

export interface ProjectStore {
  project: Project
  dispatch: Dispatch<Action>
  /** Aus dem Projekt abgeleitet, nie gespeichert. */
  assignment: Assignment
}

export const ProjectContext = createContext<ProjectStore | null>(null)
