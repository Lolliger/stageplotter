import { describe, expect, test } from 'vitest'
import type { Device, InstrumentGroup, InstrumentType, OutputElement, Project, Stagebox } from '../model/types'
import { assign } from './assign'
import { manhattan, type DistanceFn } from './geometry'

function box(name: string, x: number, y: number, inputs = 16, outputs = 8): Stagebox {
  return { id: `box-${name}`, name, pos: { x, y }, inputs, outputs, color: '#000' }
}

function group(
  id: string,
  x: number,
  y: number,
  channels: number,
  opts: { type?: InstrumentType; pinnedBoxId?: string; name?: string } = {},
): InstrumentGroup {
  return {
    id,
    type: opts.type ?? 'other',
    name: opts.name ?? id,
    pos: { x, y },
    channels: Array.from({ length: channels }, (_, i) => ({
      id: `${id}-ch${i + 1}`,
      name: `${id} ${i + 1}`,
      pickup: i % 2 === 0 ? 'SM57' : 'DI',
    })),
    ...(opts.pinnedBoxId ? { pinnedBoxId: opts.pinnedBoxId } : {}),
  }
}

function output(id: string, x: number, y: number, pinnedBoxId?: string): OutputElement {
  return { id, kind: 'wedge', name: id, pos: { x, y }, ...(pinnedBoxId ? { pinnedBoxId } : {}) }
}

function project(boxes: Stagebox[], groups: InstrumentGroup[] = [], outputs: OutputElement[] = []): Project {
  return { version: 1, name: 'Test', stage: { width: 10, depth: 6 }, boxes, groups, outputs, devices: [] }
}

const A = box('A', 0, 0)
const B = box('B', 10, 0)

describe('assign – inputs', () => {
  test('assigns a group to the nearest box', () => {
    const r = assign(project([A, B], [group('left', 2, 3, 2), group('right', 8, 3, 3)]))
    expect(r.groups.left.boxIds).toEqual(['box-A'])
    expect(r.groups.right.boxIds).toEqual(['box-B'])
    expect(r.usage['box-A'].inputsUsed).toBe(2)
    expect(r.usage['box-B'].inputsUsed).toBe(3)
    expect(r.warnings).toEqual([])
  })

  test('keeps a group together on the next box when the nearest one is too full', () => {
    const small = box('A', 0, 0, 4)
    const r = assign(project([small, B], [group('drums', 1, 1, 7)]))
    expect(r.groups.drums.boxIds).toEqual(['box-B'])
    expect(r.groups.drums.split).toBe(false)
    expect(r.usage['box-A'].inputsUsed).toBe(0)
  })

  test('assigns larger groups first so they are not pushed away by small ones', () => {
    // Beide Gruppen stehen bei A; A hat Platz für 8. Die große Gruppe (8) muss A bekommen,
    // obwohl die kleine zuerst angelegt wurde.
    const a = box('A', 0, 0, 8)
    const r = assign(project([a, B], [group('vox', 1, 1, 1), group('drums', 1, 1, 8)]))
    expect(r.groups.drums.boxIds).toEqual(['box-A'])
    expect(r.groups.vox.boxIds).toEqual(['box-B'])
  })

  test('equal channel counts keep creation order', () => {
    const a = box('A', 0, 0, 2)
    const r = assign(project([a, B], [group('first', 1, 1, 2), group('second', 1, 1, 2)]))
    expect(r.groups.first.boxIds).toEqual(['box-A'])
    expect(r.groups.second.boxIds).toEqual(['box-B'])
  })

  test('splits a group that fits nowhere completely and warns', () => {
    const a = box('A', 0, 0, 5)
    const b = box('B', 10, 0, 5)
    const r = assign(project([a, b], [group('drums', 2, 1, 9, { name: 'Drums' })]))
    expect(r.groups.drums.boxIds).toEqual(['box-A', 'box-B'])
    expect(r.groups.drums.channelsPerBox).toEqual({ 'box-A': 5, 'box-B': 4 })
    expect(r.groups.drums.split).toBe(true)
    expect(r.inputs['box-A'].map((p) => p.channelName)).toEqual([1, 2, 3, 4, 5].map((i) => `drums ${i}`))
    expect(r.inputs['box-B'].map((p) => p.channelName)).toEqual([6, 7, 8, 9].map((i) => `drums ${i}`))
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatchObject({ level: 'warning', code: 'group-split', groupIds: ['drums'] })
    expect(r.warnings[0].message).toContain('Drums (9 Kanäle)')
    expect(r.warnings[0].message).toContain('A (5), B (4)')
  })

  test('never exceeds capacity and reports concretely what is missing', () => {
    const a = box('A', 0, 0, 4)
    const r = assign(project([a], [group('drums', 1, 1, 6, { name: 'Drums' })]))
    expect(r.usage['box-A']).toMatchObject({ inputsUsed: 4, inputs: 4, inputsMissing: 2 })
    expect(r.unpatchedInputs.map((u) => u.channelId)).toEqual(['drums-ch5', 'drums-ch6'])
    expect(r.unpatchedInputs.every((u) => u.wantedBoxId === 'box-A')).toBe(true)
    expect(r.groups.drums.unpatched).toBe(2)
    const err = r.warnings.find((w) => w.code === 'inputs-missing')!
    expect(err.level).toBe('error')
    expect(err.boxId).toBe('box-A')
    expect(err.message).toBe(
      'Box A: 2 Inputs fehlen (Drums). Box A auf 6 Inputs erhöhen oder weitere Stagebox hinzufügen.',
    )
  })

  test('errors come before warnings', () => {
    const a = box('A', 0, 0, 3)
    const b = box('B', 10, 0, 3)
    const r = assign(project([a, b], [group('g1', 1, 1, 4), group('g2', 1, 1, 4)]))
    expect(r.warnings.map((w) => w.level)).toEqual(['error', 'warning'])
  })

  test('ignores empty groups', () => {
    const r = assign(project([A], [group('empty', 1, 1, 0)]))
    expect(r.groups.empty.boxIds).toEqual([])
    expect(r.inputs['box-A']).toEqual([])
    expect(r.warnings).toEqual([])
  })

  test('reports a missing stagebox', () => {
    const r = assign(project([], [group('vox', 1, 1, 2)], [output('w1', 1, 1)]))
    expect(r.unpatchedInputs).toHaveLength(2)
    expect(r.unpatchedOutputs).toHaveLength(1)
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatchObject({ level: 'error', code: 'no-boxes' })
    expect(r.warnings[0].message).toContain('2 Kanäle und 1 Output')
  })

  test('no warning for an empty project without boxes', () => {
    expect(assign(project([])).warnings).toEqual([])
  })

  test('equal distance is resolved by box name', () => {
    const b = box('B', 0, 0)
    const a = box('A', 10, 0)
    const r = assign(project([b, a], [group('mid', 5, 0, 1)]))
    expect(r.groups.mid.boxIds).toEqual(['box-A'])
  })

  test('uses an injected distance function', () => {
    // "Kabelweg": Box B ist trotz größerer Luftlinie schneller erreichbar.
    const cableRoute: DistanceFn = (_from, to) => (to.x === 10 ? 1 : 100)
    const r = assign(project([A, B], [group('g', 1, 1, 1)]), cableRoute)
    expect(r.groups.g.boxIds).toEqual(['box-B'])
    expect(r.inputs['box-B'][0].distance).toBe(1)
  })
})

test('manhattan distance can replace the default', () => {
  // Luftlinie: A (5 m) näher als B (6 m); rechtwinklig: B (6 m) näher als A (7 m)
  const a = box('A', 0, 0)
  const b = box('B', 10, 3)
  const g = group('g', 4, 3, 1)
  expect(assign(project([a, b], [g])).groups.g.boxIds).toEqual(['box-A'])
  expect(assign(project([a, b], [g]), manhattan).groups.g.boxIds).toEqual(['box-B'])
})

describe('assign – pins', () => {
  test('a pinned group goes to its box even if another is closer', () => {
    const r = assign(project([A, B], [group('g', 1, 1, 2, { pinnedBoxId: 'box-B' })]))
    expect(r.groups.g.boxIds).toEqual(['box-B'])
    expect(r.groups.g.pinned).toBe(true)
  })

  test('pinned groups reserve capacity before automatic ones', () => {
    const a = box('A', 0, 0, 4)
    const r = assign(
      project([a, B], [group('big', 1, 1, 4), group('pinned', 9, 1, 2, { pinnedBoxId: 'box-A' })]),
    )
    expect(r.groups.pinned.boxIds).toEqual(['box-A'])
    expect(r.groups.big.boxIds).toEqual(['box-B'])
  })

  test('a pinned group is never redirected; overflow is reported with "Pin lösen"', () => {
    const a = box('A', 0, 0, 3)
    const r = assign(project([a, B], [group('drums', 1, 1, 5, { pinnedBoxId: 'box-A', name: 'Drums' })]))
    expect(r.groups.drums.boxIds).toEqual(['box-A'])
    expect(r.groups.drums.unpatched).toBe(2)
    expect(r.usage['box-B'].inputsUsed).toBe(0)
    const err = r.warnings.find((w) => w.code === 'inputs-missing')!
    expect(err.message).toBe(
      'Box A: 2 Inputs fehlen (Drums). Box A auf 5 Inputs erhöhen, weitere Stagebox hinzufügen oder Pin lösen.',
    )
  })

  test('a pin to a box that no longer exists is ignored', () => {
    const r = assign(project([A, B], [group('g', 9, 1, 1, { pinnedBoxId: 'gone' })]))
    expect(r.groups.g.boxIds).toEqual(['box-B'])
    expect(r.groups.g.pinned).toBe(false)
  })
})

describe('assign – port numbering', () => {
  test('ports are numbered per box, starting at 1, labelled with the box name', () => {
    const r = assign(project([A, B], [group('l', 1, 1, 2), group('r', 9, 1, 3)]))
    expect(r.inputs['box-A'].map((p) => p.label)).toEqual(['A1', 'A2'])
    expect(r.inputs['box-B'].map((p) => p.label)).toEqual(['B1', 'B2', 'B3'])
    expect(r.inputs['box-A'][0]).toMatchObject({ port: 1, pickup: 'SM57', groupName: 'l' })
  })

  test('within a box, ports follow input list order (drums, bass, …, vocals)', () => {
    const r = assign(
      project(
        [A],
        [
          group('vox', 1, 1, 1, { type: 'vocals' }),
          group('keys', 1, 1, 2, { type: 'keys' }),
          group('drums', 1, 1, 2, { type: 'drums' }),
          group('bass', 1, 1, 1, { type: 'bass' }),
        ],
      ),
    )
    expect(r.inputs['box-A'].map((p) => p.channelId)).toEqual([
      'drums-ch1',
      'drums-ch2',
      'bass-ch1',
      'keys-ch1',
      'keys-ch2',
      'vox-ch1',
    ])
  })

  test('same type keeps creation order', () => {
    const r = assign(
      project([A], [group('g1', 1, 1, 1, { type: 'guitar' }), group('g2', 1, 1, 3, { type: 'guitar' })]),
    )
    expect(r.inputs['box-A'].map((p) => p.groupId)).toEqual(['g1', 'g2', 'g2', 'g2'])
  })

  test('reports the distance from group to box in meters', () => {
    const r = assign(project([A], [group('g', 3, 4, 1)]))
    expect(r.inputs['box-A'][0].distance).toBe(5)
  })

  test('carries channel notes through', () => {
    const g = group('g', 1, 1, 1)
    g.channels[0].note = '48V'
    const r = assign(project([A], [g]))
    expect(r.inputs['box-A'][0].note).toBe('48V')
  })
})

describe('assign – outputs', () => {
  test('each output element takes one output on the nearest box', () => {
    const r = assign(project([A, B], [], [output('w1', 1, 5), output('w2', 9, 5), output('w3', 2, 5)]))
    expect(r.outputs['box-A'].map((o) => o.label)).toEqual(['A-Out 1', 'A-Out 2'])
    expect(r.outputs['box-A'].map((o) => o.outputId)).toEqual(['w1', 'w3'])
    expect(r.outputs['box-B'].map((o) => o.label)).toEqual(['B-Out 1'])
    expect(r.outputElements.w2).toEqual({ boxId: 'box-B', label: 'B-Out 1', pinned: false })
    expect(r.usage['box-A'].outputsUsed).toBe(2)
  })

  test('falls back to the next box when the nearest has no free output', () => {
    const a = box('A', 0, 0, 16, 1)
    const r = assign(project([a, B], [], [output('w1', 1, 1), output('w2', 1, 1)]))
    expect(r.outputElements.w1.boxId).toBe('box-A')
    expect(r.outputElements.w2.boxId).toBe('box-B')
  })

  test('pinned outputs come first and stay on their box', () => {
    const a = box('A', 0, 0, 16, 1)
    const r = assign(project([a, B], [], [output('near', 1, 1), output('pinned', 9, 1, 'box-A')]))
    expect(r.outputElements.pinned).toMatchObject({ boxId: 'box-A', pinned: true })
    expect(r.outputElements.near.boxId).toBe('box-B')
  })

  test('reports missing outputs', () => {
    const a = box('A', 0, 0, 16, 1)
    const r = assign(project([a], [], [output('Wedge 1', 1, 1), output('Wedge 2', 1, 1)]))
    expect(r.unpatchedOutputs).toEqual([{ outputId: 'Wedge 2', wantedBoxId: 'box-A' }])
    expect(r.usage['box-A'].outputsMissing).toBe(1)
    const err = r.warnings.find((w) => w.code === 'outputs-missing')!
    expect(err.level).toBe('error')
    expect(err.message).toBe(
      'Box A: 1 Output fehlt (Wedge 2). Box A auf 2 Outputs erhöhen oder weitere Stagebox hinzufügen.',
    )
  })
})

test('is deterministic and does not mutate the project', () => {
  const p = project([A, B], [group('d', 2, 2, 9), group('v', 8, 2, 2)], [output('w', 5, 5)])
  const snapshot = structuredClone(p)
  expect(assign(p)).toEqual(assign(p))
  expect(p).toEqual(snapshot)
})

describe('assign – PA signal chain', () => {
  // Weiche neben der Bühne rechts (nahe B), Endstufe ebenfalls, PA L/R gespeist von der Endstufe
  function chain() {
    const xo: Device = {
      id: 'xo',
      kind: 'crossover',
      name: 'Weiche',
      pos: { x: 10.6, y: 3 },
      inputs: [
        { name: 'L', connector: 'xlr' },
        { name: 'R', connector: 'xlr' },
      ],
      outputs: [
        { name: 'Top L', connector: 'xlr', from: [0], hp: 100 },
        { name: 'Top R', connector: 'xlr', from: [1], hp: 100 },
        { name: 'Sub', connector: 'xlr', from: [0, 1], lp: 100 },
      ],
    }
    const amp: Device = {
      id: 'amp',
      kind: 'amp',
      name: 'Endstufe',
      pos: { x: 10.6, y: 4.5 },
      inputs: [
        { name: 'Kanal A', connector: 'xlr', source: { deviceId: 'xo', output: 0 } },
        { name: 'Kanal B', connector: 'xlr' }, // direkt von der Stagebox
      ],
      outputs: [
        { name: 'Kanal A', connector: 'speakon-nl4' },
        { name: 'Kanal B', connector: 'speakon-nl4' },
      ],
      power: { watts: 1000, ohms: 4 },
    }
    const p = project(
      [A, B],
      [],
      [
        { ...output('PA L', -0.6, 5.5), source: { deviceId: 'amp', output: 0 } },
        output('Wedge 1', 9, 5),
      ],
    )
    return { ...p, devices: [xo, amp] }
  }

  test('only stagebox-fed targets use box outputs', () => {
    const r = assign(chain())
    // Wedge + 2 Weichen-Eingänge + Endstufe Kanal B hängen an der Box, PA L und Kanal A nicht
    expect(r.outputs['box-B'].map((o) => [o.label, o.name])).toEqual([
      ['B-Out 1', 'Wedge 1'],
      ['B-Out 2', 'Weiche · In A (L)'],
      ['B-Out 3', 'Weiche · In B (R)'],
      ['B-Out 4', 'Endstufe · Kanal B'],
    ])
    expect(r.outputs['box-B'][1]).toMatchObject({ outputId: 'xo', inputIndex: 0, kind: 'crossover' })
    expect(r.outputElements['PA L']).toEqual({ boxId: null, label: null, pinned: false, source: { deviceId: 'amp', output: 0 } })
    expect(r.deviceInputs.amp[0].source).toEqual({ deviceId: 'xo', output: 0 })
    expect(r.deviceInputs.xo.map((a) => a.label)).toEqual(['B-Out 2', 'B-Out 3'])
    expect(r.usage['box-B'].outputsUsed).toBe(4)
  })

  test('device inputs count towards missing outputs with readable names', () => {
    const p = chain()
    p.boxes = [box('B', 10, 0, 16, 2)]
    const r = assign(p)
    const err = r.warnings.find((w) => w.code === 'outputs-missing')!
    expect(err.message).toBe(
      'Box B: 2 Outputs fehlen (Weiche · In B (R), Endstufe · Kanal B). Box B auf 4 Outputs erhöhen oder weitere Stagebox hinzufügen.',
    )
    expect(r.unpatchedOutputs).toEqual([
      { outputId: 'xo', inputIndex: 1, wantedBoxId: 'box-B' },
      { outputId: 'amp', inputIndex: 1, wantedBoxId: 'box-B' },
    ])
  })
})
