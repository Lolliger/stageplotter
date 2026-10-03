import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../../model/defaults'
import { createGroupFromTemplate, getTemplate } from '../../model/templates'
import { assign } from '../assign'
import { createAmp, createCrossover } from '../../model/devices'
import { inputTables, outputTables, signalTables } from './tables'

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

describe('signal tables', () => {
  test('crossover and amp rows show source, filter and targets', () => {
    const p = sample()
    const xo = createCrossover(p)
    p.devices.push(xo)
    const amp = createAmp(p)
    amp.inputs[0].source = { deviceId: xo.id, output: 2 } // Kanal A ← Sub
    p.devices.push(amp)
    p.outputs.push({ id: 'sub', kind: 'sub', name: 'Sub 1', pos: { x: 5, y: 6.6 }, source: { deviceId: amp.id, output: 0 } })
    const [xoTable, ampTable] = signalTables(p, assign(p))
    expect(xoTable.title).toBe('Frequenzweiche: Weiche')
    expect(xoTable.summary).toBe('2 Eingänge (XLR (analog)) · 3 Ausgänge')
    expect(xoTable.feeds[0]).toMatch(/^In A \(L\) ← Stagebox B-Out \d$/)
    expect(xoTable.rows[2]).toEqual({
      port: 'Out 3',
      name: 'Sub',
      from: 'L + R',
      detail: 'LP 100 Hz · 24 dB/Okt LR · XLR (analog)',
      to: 'Endstufe · Kanal A',
    })
    expect(ampTable.summary).toBe('2 × 1000 W @ 4 Ω · XLR (analog) → Speakon NL4')
    expect(ampTable.rows[0]).toMatchObject({ port: 'Kanal A', from: 'Weiche · Out 3 Sub', to: 'Sub 1' })
    expect(ampTable.rows[1]).toMatchObject({ from: 'frei', to: '—' })
  })
})
