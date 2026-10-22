import { describe, expect, test } from 'vitest'
import { createDefaultProject } from './defaults'
import {
  carryFixtures,
  createFixtures,
  createTruss,
  defaultFixtureRotation,
  snapToTruss,
  spreadOnTruss,
  trussEnds,
  trussOffset,
} from './lights'
import type { Truss } from './types'

const truss: Truss = { id: 't', name: 'Traverse', pos: { x: 5, y: 1 }, length: 8, rotation: 0 }

describe('truss geometry', () => {
  test('ends follow length and rotation', () => {
    expect(trussEnds(truss)).toEqual([
      { x: 1, y: 1 },
      { x: 9, y: 1 },
    ])
    const [a, b] = trussEnds({ ...truss, rotation: 90 })
    expect(a.x).toBeCloseTo(5)
    expect(a.y).toBeCloseTo(-3)
    expect(b.y).toBeCloseTo(5)
  })

  test('snaps fixtures within reach onto the truss, clamped to its ends', () => {
    expect(snapToTruss({ x: 3, y: 1.3 }, [truss])).toEqual({ pos: { x: 3, y: 1 }, trussId: 't' })
    expect(snapToTruss({ x: 9.2, y: 1.1 }, [truss])).toEqual({ pos: { x: 9, y: 1 }, trussId: 't' })
    expect(snapToTruss({ x: 3, y: 2 }, [truss])).toBeNull()
  })

  test('spreads fixtures evenly with half a gap at the ends', () => {
    expect(spreadOnTruss(truss, 4).map((p) => p.x)).toEqual([2, 4, 6, 8])
  })

  test('fixtures travel and turn with their truss', () => {
    const [f] = createFixtures({ stage: { width: 10, depth: 6 }, fixtures: [], trusses: [truss] }, 'par', 1, 't')
    const onTruss = { ...f, pos: { x: 7, y: 1 }, rotation: 0 }
    const loose = { ...f, id: 'loose', trussId: undefined }
    const after: Truss = { ...truss, pos: { x: 5, y: 3 }, rotation: 90 }
    const [moved, untouched] = carryFixtures([onTruss, loose], truss, after)
    expect(moved.pos.x).toBeCloseTo(5)
    expect(moved.pos.y).toBeCloseTo(5)
    expect(moved.rotation).toBe(90)
    expect(trussOffset(after, moved.pos).along).toBeCloseTo(2)
    expect(untouched).toBe(loose)
  })
})

describe('creating lights', () => {
  test('numbers continue and fixtures sit on the chosen truss', () => {
    const p = { ...createDefaultProject(), trusses: [truss] }
    const first = createFixtures(p, 'spot', 2, 't')
    expect(first.map((f) => [f.number, f.trussId, f.channels, f.address])).toEqual([
      [1, 't', 14, undefined],
      [2, 't', 14, undefined],
    ])
    const more = createFixtures({ ...p, fixtures: first }, 'par', 1)
    expect(more[0].number).toBe(3)
    expect(more[0].trussId).toBeUndefined()
  })

  test('new lights in front of the stage point at it', () => {
    const stage = { width: 10, depth: 6 }
    expect(defaultFixtureRotation({ x: 5, y: 8 }, stage)).toBe(180)
    expect(defaultFixtureRotation({ x: 5, y: 1 }, stage)).toBe(0)
    expect(defaultFixtureRotation({ x: -2, y: 3 }, stage)).toBe(270)
  })

  test('trusses go upstage first, then FOH', () => {
    const p = createDefaultProject()
    const back = createTruss(p)
    const foh = createTruss({ ...p, trusses: [back] })
    expect(back.pos.y).toBe(0.5)
    expect(foh.pos.y).toBe(p.stage.depth + 2)
    expect(foh.name).toBe('Traverse 2')
  })
})
