import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../../model/defaults'
import { createGroupFromTemplate, getTemplate } from '../../model/templates'
import { assign } from '../assign'
import { inputTables, outputTables } from './tables'

function sample() {
  const p = createDefaultProject() // A hinten links, B hinten rechts
  const keys = createGroupFromTemplate(getTemplate('keys-stereo')!, { x: 1.5, y: 3.75 })
  keys.channels[0].note = 'Nord'
  const vox = { ...createGroupFromTemplate(getTemplate('lead-vox')!, { x: 1.5, y: 2 }), pinnedBoxId: p.boxes[1].id }
  p.groups.push(keys, vox)
  p.outputs.push({ id: 'w1', kind: 'wedge', name: 'Wedge 1', pos: { x: 8.5, y: 4.75 } })
  return p
}

describe('export tables', () => {
  test('input rows per box with port, source, pickup, note and distance', () => {
    const p = sample()
    const t = inputTables(p, assign(p))
    expect(t.boxes.map((b) => b.usage)).toEqual(['2/16 In', '1/16 In'])
    expect(t.boxes[0].rows[0]).toEqual({ port: 'A1', channel: 'Keys L', group: 'Keys', pickup: 'DI', note: 'Nord', distance: '3,0 m' })
    expect(t.boxes[1].rows[0]).toMatchObject({ port: 'B1', channel: 'Lead Vox', distance: '7,1 m' })
    expect([...t.boxes[1].pinned]).toEqual([0])
    expect(t.unpatched).toEqual([])
  })

  test('lists channels without input', () => {
    const p = sample()
    p.boxes = p.boxes.map((b) => ({ ...b, inputs: 1 }))
    const t = inputTables(p, assign(p))
    expect(t.unpatched.map((r) => r.channel)).toEqual(['Keys R'])
    expect(t.boxes[0].missing).toBe(1)
  })

  test('output rows skip boxes without outputs', () => {
    const p = sample()
    const t = outputTables(p, assign(p))
    expect(t.boxes).toHaveLength(1)
    expect(t.boxes[0]).toMatchObject({ usage: '1/8 Out', rows: [{ port: 'B-Out 1', name: 'Wedge 1', kind: 'Wedge', distance: '4,0 m' }] })
  })
})
