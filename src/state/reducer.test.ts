import { describe, expect, test } from 'vitest'
import { createDefaultProject, createOutput, createPaPair, createStagebox, spawnPosition } from '../model/defaults'
import { createFixtures } from '../model/lights'
import { createGroupFromTemplate, getTemplate } from '../model/templates'
import type { Project } from '../model/types'
import { projectReducer } from './reducer'

function withGroup(project: Project, x = 5, y = 3): Project {
  const group = createGroupFromTemplate(getTemplate('lead-vox')!, { x, y })
  return projectReducer(project, { type: 'addGroup', group })
}

describe('default project', () => {
  test('has two boxes A and B with 16 in / 8 out on a 10 x 6 m stage', () => {
    const p = createDefaultProject()
    expect(p.stage).toEqual({ width: 10, depth: 6 })
    expect(p.boxes.map((b) => b.name)).toEqual(['A', 'B'])
    expect(p.boxes.every((b) => b.inputs === 16 && b.outputs === 8)).toBe(true)
    expect(new Set(p.boxes.map((b) => b.color)).size).toBe(2)
  })

  test('new boxes get the next free letter', () => {
    const p = createDefaultProject()
    const c = createStagebox(p)
    expect(c.name).toBe('C')
    const withoutA = { ...p, boxes: p.boxes.slice(1) }
    expect(createStagebox(withoutA).name).toBe('A')
  })

  test('new boxes are placed away from existing ones', () => {
    const p = createDefaultProject()
    const c = createStagebox(p)
    for (const b of p.boxes) expect(Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y)).toBeGreaterThanOrEqual(2)
  })
})

test('new elements spawn at stage center, then at the nearest free spot', () => {
  let p = createDefaultProject()
  const first = spawnPosition(p)
  expect(first).toEqual({ x: 5, y: 3 })
  p = withGroup(p, first.x, first.y)
  const second = spawnPosition(p)
  expect(Math.hypot(second.x - 5, second.y - 3)).toBeCloseTo(1.5)
  for (const b of p.boxes) expect(Math.hypot(b.pos.x - second.x, b.pos.y - second.y)).toBeGreaterThanOrEqual(1.2)
})

test('outputs get numbered names and sensible spots', () => {
  let p = createDefaultProject()
  const w1 = createOutput(p, 'wedge')
  expect(w1.name).toBe('Wedge 1')
  expect(w1.pos.y).toBeGreaterThan(4) // vorne
  p = projectReducer(p, { type: 'addOutput', output: w1 })
  const w2 = createOutput(p, 'wedge')
  expect(w2.name).toBe('Wedge 2')
  expect(w2.pos).not.toEqual(w1.pos)
  const sf = createOutput(p, 'sidefill')
  expect(sf.pos.x).toBeLessThan(2) // erster Sidefill links
})

test('PA pair stands left and right beside the stage, subs in front of it', () => {
  let p = createDefaultProject()
  const [l, r] = createPaPair(p)
  expect([l.name, r.name]).toEqual(['PA L', 'PA R'])
  expect(l.pos.x).toBeLessThan(0)
  expect(r.pos.x).toBeGreaterThan(p.stage.width)
  p = projectReducer(projectReducer(p, { type: 'addOutput', output: l }), { type: 'addOutput', output: r })
  expect(p.outputs.map((o) => o.pos)).toEqual([l.pos, r.pos]) // nicht auf die Bühne geschoben
  const [l2] = createPaPair(p)
  expect(l2.name).toBe('PA L 2')
  expect(l2.pos).not.toEqual(l.pos)
  const sub = createOutput(p, 'sub')
  expect(sub.name).toBe('Sub 1')
  expect(sub.pos.y).toBeGreaterThan(p.stage.depth)
})

test('only PA and subs may stand off stage (up to 1 m)', () => {
  let p = createDefaultProject()
  const [pa] = createPaPair(p)
  const wedge = createOutput(p, 'wedge')
  p = projectReducer(projectReducer(p, { type: 'addOutput', output: pa }), { type: 'addOutput', output: wedge })
  const far = { x: -5, y: 20 }
  p = projectReducer(p, { type: 'move', target: { kind: 'output', id: pa.id }, pos: far })
  p = projectReducer(p, { type: 'move', target: { kind: 'output', id: wedge.id }, pos: far })
  expect(p.outputs[0].pos).toEqual({ x: -1, y: 7 })
  expect(p.outputs[1].pos).toEqual({ x: 0, y: 6 })
})

describe('projectReducer', () => {
  test('move clamps groups to the stage', () => {
    const p = withGroup(createDefaultProject())
    const id = p.groups[0].id
    const moved = projectReducer(p, { type: 'move', target: { kind: 'group', id }, pos: { x: 20, y: -3 } })
    expect(moved.groups[0].pos).toEqual({ x: 10, y: 0 })
  })

  test('snap rounds moves to 25 cm when enabled', () => {
    let p = withGroup(createDefaultProject())
    const target = { kind: 'group' as const, id: p.groups[0].id }
    p = projectReducer(p, { type: 'move', target, pos: { x: 2.37, y: 1.12 } })
    expect(p.groups[0].pos).toEqual({ x: 2.37, y: 1.12 })
    p = projectReducer(p, { type: 'setSnap', snap: true })
    p = projectReducer(p, { type: 'move', target, pos: { x: 2.37, y: 1.12 } })
    expect(p.groups[0].pos).toEqual({ x: 2.25, y: 1 })
  })

  test('boxes may stand up to 1 m outside the stage', () => {
    const p = createDefaultProject()
    const id = p.boxes[0].id
    const moved = projectReducer(p, { type: 'move', target: { kind: 'box', id }, pos: { x: -0.5, y: -5 } })
    expect(moved.boxes[0].pos).toEqual({ x: -0.5, y: -1 })
  })

  test('shrinking the stage pushes elements back onto it', () => {
    const p = withGroup(createDefaultProject(), 9, 5)
    const next = projectReducer(p, { type: 'setStage', stage: { width: 6, depth: 4 } })
    expect(next.stage).toEqual({ width: 6, depth: 4 })
    expect(next.groups[0].pos).toEqual({ x: 6, y: 4 })
    // Box B stand bei x = 8.5 → max. 1 m außerhalb
    expect(next.boxes[1].pos.x).toBe(7)
  })

  test('stage size is limited to sane values', () => {
    const p = createDefaultProject()
    const next = projectReducer(p, { type: 'setStage', stage: { width: 0, depth: 100 } })
    expect(next.stage).toEqual({ width: 2, depth: 40 })
  })

  test('box capacity is rounded and never negative', () => {
    const p = createDefaultProject()
    const id = p.boxes[0].id
    const next = projectReducer(p, { type: 'updateBox', id, patch: { inputs: -4, outputs: 7.6 } })
    expect(next.boxes[0].inputs).toBe(0)
    expect(next.boxes[0].outputs).toBe(8)
  })

  test('deleting a box removes pins pointing to it', () => {
    let p = withGroup(createDefaultProject())
    const boxId = p.boxes[0].id
    p = projectReducer(p, { type: 'updateGroup', id: p.groups[0].id, patch: { pinnedBoxId: boxId } })
    expect(p.groups[0].pinnedBoxId).toBe(boxId)
    p = projectReducer(p, { type: 'delete', target: { kind: 'box', id: boxId } })
    expect(p.boxes).toHaveLength(1)
    expect(p.groups[0].pinnedBoxId).toBeUndefined()
  })

  test('pins survive moves and can be cleared', () => {
    let p = withGroup(createDefaultProject())
    const id = p.groups[0].id
    const boxId = p.boxes[1].id
    p = projectReducer(p, { type: 'updateGroup', id, patch: { pinnedBoxId: boxId } })
    p = projectReducer(p, { type: 'move', target: { kind: 'group', id }, pos: { x: 0.5, y: 0.5 } })
    expect(p.groups[0].pinnedBoxId).toBe(boxId)
    p = projectReducer(p, { type: 'updateGroup', id, patch: { pinnedBoxId: undefined } })
    expect('pinnedBoxId' in p.groups[0]).toBe(false)
  })

  test('rename and delete groups', () => {
    let p = withGroup(createDefaultProject())
    const id = p.groups[0].id
    p = projectReducer(p, { type: 'updateGroup', id, patch: { name: 'Sängerin' } })
    expect(p.groups[0].name).toBe('Sängerin')
    p = projectReducer(p, { type: 'delete', target: { kind: 'group', id } })
    expect(p.groups).toHaveLength(0)
  })

  test('does not mutate the previous state', () => {
    const p = withGroup(createDefaultProject())
    const snapshot = structuredClone(p)
    projectReducer(p, { type: 'move', target: { kind: 'group', id: p.groups[0].id }, pos: { x: 1, y: 1 } })
    projectReducer(p, { type: 'setStage', stage: { width: 3, depth: 3 } })
    expect(p).toEqual(snapshot)
  })
})

test('amp templates create groups drawn as amps, sorted by their instrument type', () => {
  const amp = createGroupFromTemplate(getTemplate('bass-amp')!, { x: 1, y: 1 })
  expect(amp).toMatchObject({ type: 'bass', form: 'amp', name: 'Bass-Amp' })
  expect(amp.channels.map((c) => c.pickup)).toEqual(['DI', 'RE20'])
  expect('form' in createGroupFromTemplate(getTemplate('bass-di')!, { x: 1, y: 1 })).toBe(false)
})

test('rotation is normalized and sidefills face the stage center', () => {
  let p = createDefaultProject()
  const left = createOutput(p, 'sidefill')
  expect(left.rotation).toBe(90) // links → strahlt nach rechts
  p = projectReducer(p, { type: 'addOutput', output: left })
  const right = createOutput(p, 'sidefill')
  expect(right.rotation).toBe(270)
  p = projectReducer(p, { type: 'updateOutput', id: left.id, patch: { rotation: -15 } })
  expect(p.outputs[0].rotation).toBe(345)
})

describe('lights', () => {
  function rig(): Project {
    let p = createDefaultProject()
    p = projectReducer(p, { type: 'addTruss', truss: { id: 't', name: 'Hinten', pos: { x: 5, y: 1 }, length: 8, rotation: 0 } })
    const fixtures = createFixtures(p, 'par', 2, 't')
    return projectReducer(p, { type: 'addFixtures', fixtures })
  }

  test('fixtures snap onto a truss and come loose when dragged away', () => {
    let p = rig()
    const id = p.fixtures[0].id
    p = projectReducer(p, { type: 'move', target: { kind: 'fixture', id }, pos: { x: 4, y: 1.25 } })
    expect(p.fixtures[0]).toMatchObject({ pos: { x: 4, y: 1 }, trussId: 't' })
    p = projectReducer(p, { type: 'move', target: { kind: 'fixture', id }, pos: { x: 4, y: 12 } })
    expect(p.fixtures[0].pos).toEqual({ x: 4, y: 12 })
    expect('trussId' in p.fixtures[0]).toBe(false)
  })

  test('fixtures may stand far off stage but not anywhere', () => {
    const start = rig()
    const p = projectReducer(start, { type: 'move', target: { kind: 'fixture', id: start.fixtures[0].id }, pos: { x: -50, y: 50 } })
    expect(p.fixtures[0].pos).toEqual({ x: -8, y: 14 })
  })

  test('moving and turning a truss carries its fixtures', () => {
    let p = rig()
    const before = p.fixtures.map((f) => f.pos.x)
    p = projectReducer(p, { type: 'move', target: { kind: 'truss', id: 't' }, pos: { x: 5, y: 3 } })
    expect(p.fixtures.map((f) => f.pos)).toEqual(before.map((x) => ({ x, y: 3 })))
    p = projectReducer(p, { type: 'updateTruss', id: 't', patch: { rotation: 90 } })
    expect(p.fixtures.every((f) => f.rotation === 90 && Math.abs(f.pos.x - 5) < 1e-9)).toBe(true)
  })

  test('deleting a truss keeps its fixtures in place', () => {
    const p = projectReducer(rig(), { type: 'delete', target: { kind: 'truss', id: 't' } })
    expect(p.trusses).toEqual([])
    expect(p.fixtures).toHaveLength(2)
    expect(p.fixtures.some((f) => f.trussId)).toBe(false)
  })

  test('fixture values are kept in range and empty fields dropped', () => {
    let p = rig()
    const id = p.fixtures[0].id
    p = projectReducer(p, { type: 'updateFixture', id, patch: { channels: 999, universe: 0, address: 0, color: '', rotation: -90 } })
    expect(p.fixtures[0]).toMatchObject({ channels: 512, universe: 1, address: 1, rotation: 270 })
    expect('color' in p.fixtures[0]).toBe(false)
    p = projectReducer(p, { type: 'updateFixture', id, patch: { address: undefined } })
    expect('address' in p.fixtures[0]).toBe(false)
  })

  test('auto-addressing goes through the reducer (undo-able)', () => {
    const p = projectReducer(rig(), { type: 'autoAddress', options: { universe: 1, address: 1, keepExisting: false } })
    expect(p.fixtures.map((f) => f.address)).toEqual([1, 4])
  })
})
