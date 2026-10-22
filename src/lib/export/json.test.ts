import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../../model/defaults'
import { DRUM_PRESETS, createDrumGroup } from '../../model/drums'
import { exportFileName } from './files'
import { parseProjectFile, serializeProject } from './json'

describe('JSON export/import', () => {
  test('round-trips a project', () => {
    const p = { ...createDefaultProject(), name: 'Sommerfest', cableView: 'direct' as const }
    p.groups.push(createDrumGroup(DRUM_PRESETS.standard.config, { x: 3, y: 2 }))
    p.outputs.push({ id: 'w', kind: 'wedge', name: 'Wedge 1', pos: { x: 5, y: 5 }, pinnedBoxId: p.boxes[1].id })
    const text = serializeProject(p, new Date('2026-10-03T12:00:00Z'))
    expect(JSON.parse(text)).toMatchObject({ app: 'stageplot', exportedAt: '2026-10-03T12:00:00.000Z' })
    expect(parseProjectFile(text)).toEqual({ ok: true, project: p })
  })

  test('includes the derived patch for reading, ignored on import', () => {
    const p = createDefaultProject()
    p.groups.push(createDrumGroup(DRUM_PRESETS.standard.config, { x: 3, y: 2 }))
    p.outputs.push({ id: 'w', kind: 'wedge', name: 'Wedge 1', pos: { x: 5, y: 5 } })
    const data = JSON.parse(serializeProject(p))
    expect(data.patch.inputs[0]).toMatchObject({ port: expect.stringMatching(/^[AB]1$/), channel: 'Kick In', instrument: 'Drums', pickup: expect.any(String) })
    expect(data.patch.inputs).toHaveLength(p.groups[0].channels.length)
    expect(data.patch.outputs).toEqual([expect.objectContaining({ target: 'Wedge 1', kind: 'Wedge' })])
    expect(parseProjectFile(JSON.stringify(data))).toEqual({ ok: true, project: p })
  })

  test('includes the DMX address list', () => {
    const p = createDefaultProject()
    p.trusses.push({ id: 't', name: 'FOH', pos: { x: 5, y: 8 }, length: 6, rotation: 0 })
    p.fixtures.push(
      { id: 'a', kind: 'spot', number: 1, name: 'Spot', pos: { x: 4, y: 8 }, channels: 14, mode: '14 Kanal', universe: 1, address: 1, trussId: 't' },
      { id: 'b', kind: 'par', number: 2, name: 'PAR', pos: { x: 2, y: 2 }, channels: 8, universe: 1, color: 'L201' },
    )
    const { patch } = JSON.parse(serializeProject(p))
    expect(patch.dmx.universes).toEqual([
      { universe: 1, used: 14, fixtures: [{ range: '1.001–1.014', number: 1, name: 'Spot', type: 'Moving Head Spot', channels: 14, mode: '14 Kanal', place: 'FOH' }] },
    ])
    expect(patch.dmx.unaddressed).toEqual([{ range: '–', number: 2, name: 'PAR', type: 'LED-PAR', channels: 8, place: 'frei', color: 'L201' }])
    expect(patch.warnings).toContain('Hinweis (DMX): #2 PAR hat noch keine DMX-Adresse.')
  })

  test('reports broken or foreign files', () => {
    expect(parseProjectFile('{nope')).toEqual({ ok: false, error: 'Die Datei ist kein gültiges JSON.' })
    expect(parseProjectFile('{"app":"other"}')).toEqual({ ok: false, error: 'Die Datei stammt nicht aus stageplot.' })
    expect(parseProjectFile('[1,2]')).toEqual({ ok: false, error: 'Ungültiges Projekt: Projekt: Objekt erwartet' })
  })
})

describe('exportFileName', () => {
  test('builds a safe, dated file name', () => {
    const d = new Date(2026, 9, 3)
    expect(exportFileName('Sommerfest Groß & Klein', 'json', d)).toBe('stageplot-sommerfest-gross-klein-2026-10-03.json')
    expect(exportFileName('Café Rösti', 'pdf', d)).toBe('stageplot-cafe-roesti-2026-10-03.pdf')
    expect(exportFileName('!!!', 'pdf', d)).toBe('stageplot-2026-10-03.pdf')
  })
})
