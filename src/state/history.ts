import type { Project } from '../model/types'
import { projectReducer, type Action } from './reducer'

export const HISTORY_LIMIT = 100

export interface History {
  past: Project[]
  present: Project
  future: Project[]
  /** Schlüssel der letzten zusammenfassbaren Aktion (z. B. ein laufender Drag). */
  lastCoalesce?: string
}

export type HistoryAction = Action | { type: 'undo' } | { type: 'redo' }

export function initHistory(present: Project): History {
  return { past: [], present, future: [] }
}

/**
 * Undo/Redo um den Projekt-Reducer. Aufeinanderfolgende Aktionen mit gleichem `coalesce`
 * (alle Bewegungen eines Drags) ergeben einen einzigen Undo-Schritt.
 */
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] }
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    const [next, ...future] = state.future
    return { past: [...state.past, state.present], present: next, future }
  }

  const next = projectReducer(state.present, action)
  if (next === state.present) return state
  const coalesce = 'coalesce' in action ? action.coalesce : undefined
  if (coalesce !== undefined && coalesce === state.lastCoalesce) {
    return { ...state, present: next, future: [] }
  }
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastCoalesce: coalesce,
  }
}
