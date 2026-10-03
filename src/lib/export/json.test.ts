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
