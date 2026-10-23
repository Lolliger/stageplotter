import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../model/defaults'
import {
  LEGACY_KEY,
  deleteProjectById,
  listProjects,
  loadProjectById,
  openCurrent,
  saveProjectById,
  setCurrentId,
  type KeyValueStore,
} from './library'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function ids() {
  let n = 0
  return () => `p${++n}`
}

const named = (name: string) => ({ ...createDefaultProject(), name })

describe('project library', () => {
  test('saves projects and lists them newest first with their names', () => {
    const store = memoryStore()
    saveProjectById(store, 'a', named('Abiball'), new Date('2026-01-01'))
    saveProjectById(store, 'b', named('Sommerfest'), new Date('2026-02-01'))
    saveProjectById(store, 'a', named('Abiball 2026'), new Date('2026-03-01'))
    expect(listProjects(store).map((m) => [m.id, m.name])).toEqual([
      ['a', 'Abiball 2026'],
      ['b', 'Sommerfest'],
    ])
    expect(loadProjectById(store, 'a')?.name).toBe('Abiball 2026')
  })

  test('deletes a project and forgets it as current', () => {
    const store = memoryStore()
    saveProjectById(store, 'a', named('A'))
    setCurrentId(store, 'a')
    deleteProjectById(store, 'a')
    expect(listProjects(store)).toEqual([])
    expect(loadProjectById(store, 'a')).toBeNull()
    expect(store.getItem('stageplot.current')).toBeNull()
  })

  test('migrates the old single project into the list', () => {
    const store = memoryStore()
    store.setItem(LEGACY_KEY, JSON.stringify(named('Altes Projekt')))
    const { id, project } = openCurrent(store, ids(), createDefaultProject)
    expect(project.name).toBe('Altes Projekt')
    expect(id).toBe('p1')
    expect(store.getItem(LEGACY_KEY)).toBeNull()
    expect(listProjects(store).map((m) => m.name)).toEqual(['Altes Projekt'])
  })

  test('reopens the current project, falls back to the newest, then creates one', () => {
    const store = memoryStore()
    saveProjectById(store, 'a', named('A'), new Date('2026-01-01'))
    saveProjectById(store, 'b', named('B'), new Date('2026-02-01'))
    setCurrentId(store, 'a')
    expect(openCurrent(store, ids(), createDefaultProject).id).toBe('a')

    store.removeItem('stageplot.current')
    expect(openCurrent(store, ids(), createDefaultProject).id).toBe('b')

    const empty = memoryStore()
    const created = openCurrent(empty, ids(), () => named('Frisch'))
    expect(created.project.name).toBe('Frisch')
    expect(listProjects(empty).map((m) => m.id)).toEqual([created.id])
  })

  test('skips unreadable entries', () => {
    const store = memoryStore()
    store.setItem('stageplot.projects', '{kaputt')
    store.setItem(LEGACY_KEY, '{kaputt')
    const { project } = openCurrent(store, ids(), () => named('Neu'))
    expect(project.name).toBe('Neu')
    expect(store.getItem(LEGACY_KEY)).toBeNull()
  })
})
