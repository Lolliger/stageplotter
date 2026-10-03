import { describe, expect, test } from 'vitest'
import { parseProject } from '../lib/schema'
import { projectReducer } from '../state/reducer'
import { createDefaultProject, createPaPair } from './defaults'
import {
  applyCrossoverPreset,
  consumersOf,
  createAmp,
  createCrossover,
  crossoverIssues,
  describeFilter,
  isValidSource,
  setAmpChannels,
  setCrossoverInputs,
  setCrossoverOutputs,
  sourcesForDeviceInput,
  sourcesForOutputElement,
} from './devices'
import type { Project } from './types'

function rig() {
  let p: Project = createDefaultProject()
  const xo = createCrossover(p)
  p = projectReducer(p, { type: 'addDevice', device: xo })
  const amp = createAmp(p)
  p = projectReducer(p, { type: 'addDevice', device: amp })
  const [paL, paR] = createPaPair(p)
  p = projectReducer(p, { type: 'addOutput', output: paL })
  p = projectReducer(p, { type: 'addOutput', output: paR })
  return { p, xo, amp, paL, paR }
}

describe('crossover', () => {
  test('default preset: stereo tops with high pass, summed mono sub with low pass', () => {
    const xo = createCrossover(createDefaultProject())
    expect(xo).toMatchObject({ kind: 'crossover', name: 'Weiche' })
    expect(xo.inputs.map((i) => i.name)).toEqual(['L', 'R'])
    expect(xo.outputs.map((o) => [o.name, o.from, o.hp, o.lp])).toEqual([
      ['Top L', [0], 100, undefined],
      ['Top R', [1], 100, undefined],
      ['Sub', [0, 1], undefined, 100],
    ])
    expect(xo.pos.x).toBeGreaterThan(10) // neben der Bühne
  })

  test('presets and counts can be changed', () => {
    let xo = applyCrossoverPreset(createCrossover(createDefaultProject()), 'stereo-3way')
    expect(xo.outputs).toHaveLength(6)
    expect(describeFilter(xo.outputs[1])).toBe('BP 100 Hz–1,5 kHz · 24 dB/Okt LR')
    xo = setCrossoverInputs(xo, 1)
    expect(xo.outputs.every((o) => o.from!.every((f) => f === 0))).toBe(true)
    expect(crossoverIssues(xo).length).toBe(3) // R-Ausgänge haben keinen Eingang mehr
    xo = setCrossoverOutputs(xo, 2)
    expect(xo.outputs.map((o) => o.name)).toEqual(['Low L', 'Mid L'])
    expect(setCrossoverOutputs(xo, 3).outputs[2]).toMatchObject({ name: 'Out 3', from: [0] })
  })

  test('describes filters and flags inverted band pass', () => {
    expect(describeFilter({ name: 'x', connector: 'xlr' })).toBe('Vollbereich')
    expect(describeFilter({ name: 'x', connector: 'xlr', lp: 90, slope: 48, filter: 'bw' })).toBe('LP 90 Hz · 48 dB/Okt BW')
    const xo = createCrossover(createDefaultProject())
    xo.outputs[0] = { ...xo.outputs[0], hp: 2000, lp: 500 }
    expect(crossoverIssues(xo)[0]).toContain('Hochpass (2000 Hz) liegt nicht unter dem Tiefpass (500 Hz)')
  })
})

describe('amp', () => {
  test('channels keep their feeds when the count changes', () => {
    const { p, xo } = rig()
    let amp = createAmp(p, '4ch')
    expect(amp.inputs).toHaveLength(4)
    expect(amp.power).toEqual({ watts: 700, ohms: 4 })
    amp = { ...amp, inputs: amp.inputs.map((i, n) => (n === 1 ? { ...i, source: { deviceId: xo.id, output: 2 } } : i)) }
    amp = setAmpChannels(amp, 2)
    expect(amp.outputs.map((o) => o.name)).toEqual(['Kanal A', 'Kanal B'])
    expect(amp.inputs[1].source).toEqual({ deviceId: xo.id, output: 2 })
  })
})

describe('signal sources', () => {
  test('allowed chain: box → crossover → amp → speaker, no loops', () => {
    const { p, xo, amp } = rig()
    expect(sourcesForDeviceInput(p, xo)).toEqual([]) // Weiche nur von der Stagebox
    expect(sourcesForDeviceInput(p, amp).map((s) => s.label)).toEqual([
      'Weiche · Out 1 Top L (HP 100 Hz · 24 dB/Okt LR)',
      'Weiche · Out 2 Top R (HP 100 Hz · 24 dB/Okt LR)',
      'Weiche · Out 3 Sub (LP 100 Hz · 24 dB/Okt LR)',
    ])
    expect(sourcesForOutputElement(p)).toHaveLength(5) // 3 Weichen- + 2 Endstufen-Ausgänge
    expect(isValidSource(p, { deviceId: amp.id, output: 0 }, { kind: 'device', device: amp })).toBe(false)
    expect(isValidSource(p, { deviceId: xo.id, output: 9 }, { kind: 'element' })).toBe(false)
  })

  test('consumers of a device output and cleanup when devices change', () => {
    let { p, xo, amp, paL, paR } = rig()
    const ampFed = { ...amp, inputs: amp.inputs.map((i, n) => ({ ...i, source: { deviceId: xo.id, output: n } })) }
    p = projectReducer(p, { type: 'updateDevice', id: amp.id, device: ampFed })
    p = projectReducer(p, { type: 'updateOutput', id: paL.id, patch: { source: { deviceId: amp.id, output: 0 } } })
    p = projectReducer(p, { type: 'updateOutput', id: paR.id, patch: { source: { deviceId: amp.id, output: 1 } } })
    expect(consumersOf(p, xo.id, 0).map((c) => c.label)).toEqual(['Endstufe · Kanal A'])
    expect(consumersOf(p, amp.id, 1).map((c) => c.label)).toEqual(['PA R'])

    // Endstufe auf 1 Kanal: PA R verliert seine Quelle
    p = projectReducer(p, { type: 'updateDevice', id: amp.id, device: setAmpChannels(p.devices[1], 1) })
    expect(p.outputs.find((o) => o.id === paR.id)!.source).toBeUndefined()
    expect(p.outputs.find((o) => o.id === paL.id)!.source).toEqual({ deviceId: amp.id, output: 0 })

    // Weiche löschen: Endstufen-Eingänge hängen wieder an der Stagebox
    p = projectReducer(p, { type: 'delete', target: { kind: 'device', id: xo.id } })
    expect(p.devices[0].inputs[0].source).toBeUndefined()

    // Quelle zurücksetzen = Stagebox
    p = projectReducer(p, { type: 'updateOutput', id: paL.id, patch: { source: undefined } })
    expect('source' in p.outputs.find((o) => o.id === paL.id)!).toBe(false)
  })

  test('import keeps devices and drops broken references', () => {
    const { p, xo, amp, paL } = rig()
    const data = JSON.parse(JSON.stringify(p))
    data.outputs[0].source = { deviceId: amp.id, output: 1 }
    data.outputs[1].source = { deviceId: 'gone', output: 0 }
    data.devices[0].inputs[0].source = { deviceId: amp.id, output: 0 } // Weiche darf nicht von Endstufe
    const r = parseProject(data)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.project.devices.map((d) => d.kind)).toEqual(['crossover', 'amp'])
    expect(r.project.devices[0]).toMatchObject({ id: xo.id, outputs: xo.outputs })
    expect(r.project.devices[0].inputs[0].source).toBeUndefined()
    expect(r.project.outputs.find((o) => o.id === paL.id)!.source).toEqual({ deviceId: amp.id, output: 1 })
    expect(r.project.outputs[1].source).toBeUndefined()
  })
})
