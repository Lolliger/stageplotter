import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../model/defaults'
import { DRUM_PRESETS, createDrumGroup } from '../model/drums'
import { createGroupFromTemplate, getTemplate } from '../model/templates'
import { parseProject } from './schema'

describe('parseProject', () => {
  test('round-trips a valid project unchanged', () => {
    const p = createDefaultProject()
    p.groups.push({ ...createDrumGroup(DRUM_PRESETS.full.config, { x: 2, y: 2 }), pinnedBoxId: p.boxes[0].id })
    p.groups.push(createGroupFromTemplate(getTemplate('keys-stereo')!, { x: 4, y: 2 }))
    p.groups[0].channels[0].note = '48V'
    p.outputs.push({ id: 'o1', kind: 'iem', name: 'IEM Vox', pos: { x: 5, y: 5 } })
    const r = parseProject(JSON.parse(JSON.stringify(p)))
    expect(r).toEqual({ ok: true, project: p })
  })

  test('fills in missing optional fields', () => {
    const r = parseProject({ boxes: [{ pos: { x: 1, y: 1 } }], groups: [{ pos: { x: 2, y: 2 } }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.project.stage).toEqual({ width: 10, depth: 6 })
    expect(r.project.boxes[0]).toMatchObject({ name: 'A', inputs: 16, outputs: 8 })
    expect(r.project.boxes[0].id).toBeTruthy()
    expect(r.project.groups[0]).toMatchObject({ type: 'other', name: 'Instrument', channels: [] })
    expect(r.project.outputs).toEqual([])
  })

  test('drops pins to unknown boxes', () => {
    const r = parseProject({ boxes: [], groups: [{ pos: { x: 1, y: 1 }, pinnedBoxId: 'nope' }] })
    expect(r.ok && r.project.groups[0].pinnedBoxId).toBe(undefined)
  })

  test('clamps stage size and capacities', () => {
    const r = parseProject({ stage: { width: 500, depth: 1 }, boxes: [{ pos: { x: 0, y: 0 }, inputs: -3, outputs: 9999 }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.project.stage).toEqual({ width: 40, depth: 2 })
    expect(r.project.boxes[0]).toMatchObject({ inputs: 0, outputs: 256 })
  })

  test('rejects garbage with a readable error', () => {
    expect(parseProject('hello')).toEqual({ ok: false, error: 'Projekt: Objekt erwartet' })
    expect(parseProject({ boxes: 'x' })).toEqual({ ok: false, error: 'boxes: Liste erwartet' })
    expect(parseProject({ groups: [{ pos: { x: 'a', y: 1 } }] })).toEqual({
      ok: false,
      error: 'groups[0].pos.x: Zahl erwartet',
    })
    expect(parseProject({ version: 99 })).toEqual({ ok: false, error: 'Unbekannte Version 99' })
  })
})
