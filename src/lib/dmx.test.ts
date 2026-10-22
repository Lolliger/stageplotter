import { describe, expect, test } from 'vitest'
import type { Fixture, Truss } from '../model/types'
import { addressList, autoAddress, dmxIssues, fixtureOrder, formatAddress, formatRange, nextFreeAddress } from './dmx'

function fx(id: string, channels: number, extra: Partial<Fixture> = {}): Fixture {
  return { id, kind: 'par', number: Number(id.replace(/\D/g, '')) || 1, name: id, pos: { x: 0, y: 0 }, channels, universe: 1, ...extra }
}

describe('formatting', () => {
  test('universe.address with three digits', () => {
    expect(formatAddress(1, 1)).toBe('1.001')
    expect(formatAddress(2, 512)).toBe('2.512')
    expect(formatRange(fx('f1', 8, { address: 17 }))).toBe('1.017–1.024')
    expect(formatRange(fx('f1', 1, { address: 5 }))).toBe('1.005')
    expect(formatRange(fx('f1', 8))).toBe('–')
  })
})

describe('dmxIssues', () => {
  test('finds overlaps, overflow and missing addresses', () => {
    const issues = dmxIssues([
      fx('f1', 8, { address: 1 }),
      fx('f2', 8, { address: 8 }),
      fx('f3', 8, { address: 9, universe: 2 }),
      fx('f4', 16, { address: 500 }),
      fx('f5', 4),
    ])
    expect(issues.map((i) => i.fixtureIds)).toEqual([['f4'], ['f1', 'f2'], ['f5']])
    expect(issues[1].message).toBe('#1 f1 (1.001–1.008) überschneidet sich mit #2 f2 (1.008–1.015).')
  })

  test('reports duplicate fixture numbers', () => {
    const issues = dmxIssues([fx('a', 1, { number: 3, address: 1 }), fx('b', 1, { number: 3, address: 2 })])
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', fixtureIds: ['a', 'b'] })])
  })
})

const back: Truss = { id: 'back', name: 'Hinten', pos: { x: 5, y: 0.5 }, length: 8 }
const foh: Truss = { id: 'foh', name: 'FOH', pos: { x: 5, y: 9 }, length: 8 }

describe('autoAddress', () => {
  const rig = [
    fx('foh2', 8, { trussId: 'foh', pos: { x: 7, y: 9 } }),
    fx('back2', 16, { trussId: 'back', pos: { x: 7, y: 0.5 } }),
    fx('floor', 4, { pos: { x: 2, y: 5 } }),
    fx('back1', 16, { trussId: 'back', pos: { x: 3, y: 0.5 } }),
    fx('foh1', 8, { trussId: 'foh', pos: { x: 3, y: 9 } }),
  ]

  test('orders by truss from upstage, then along the truss, loose fixtures last', () => {
    expect(fixtureOrder(rig, [foh, back]).map((f) => f.id)).toEqual(['back1', 'back2', 'foh1', 'foh2', 'floor'])
  })

  test('addresses without gaps in that order', () => {
    const out = autoAddress(rig, [back, foh], { universe: 1, address: 1, keepExisting: false })
    const by = Object.fromEntries(out.map((f) => [f.id, formatRange(f)]))
    expect(by).toEqual({
      back1: '1.001–1.016',
      back2: '1.017–1.032',
      foh1: '1.033–1.040',
      foh2: '1.041–1.048',
      floor: '1.049–1.052',
    })
    expect(out.map((f) => f.id)).toEqual(rig.map((f) => f.id)) // Reihenfolge im Projekt bleibt
  })

  test('keeps existing addresses and fills around them', () => {
    const fixed = rig.map((f) => (f.id === 'foh1' ? { ...f, address: 20 } : f))
    const out = autoAddress(fixed, [back, foh], { universe: 1, address: 1, keepExisting: true })
    const by = Object.fromEntries(out.map((f) => [f.id, formatRange(f)]))
    expect(by.foh1).toBe('1.020–1.027')
    expect(by.back1).toBe('1.001–1.016')
    expect(by.back2).toBe('1.028–1.043')
    expect(dmxIssues(out).filter((i) => i.level === 'error')).toEqual([])
  })

  test('never splits a fixture across universes and can renumber', () => {
    const big = [fx('a1', 300), fx('b2', 300, { pos: { x: 1, y: 0 } })]
    const out = autoAddress(big, [], { universe: 1, address: 1, keepExisting: false, renumber: true })
    expect(out.map((f) => [formatAddress(f.universe, f.address!), f.number])).toEqual([
      ['1.001', 1],
      ['2.001', 2],
    ])
  })
})

test('addressList groups by universe and lists unaddressed fixtures last', () => {
  const list = addressList(
    [fx('f3', 4, { address: 1, universe: 2 }), fx('f1', 8, { address: 9, trussId: 'back' }), fx('f2', 8, { address: 1 }), fx('f4', 2)],
    [back],
  )
  expect(list.universes.map((u) => [u.universe, u.used, u.rows.map((r) => r.fixture.id)])).toEqual([
    [1, 16, ['f2', 'f1']],
    [2, 4, ['f3']],
  ])
  expect(list.universes[0].rows[1]).toMatchObject({ address: '1.009', range: '1.009–1.016', place: 'Hinten' })
  expect(list.unaddressed.map((r) => r.fixture.id)).toEqual(['f4'])
})

test('nextFreeAddress finds the first gap that fits', () => {
  const rig = [fx('a1', 8, { address: 1 }), fx('b2', 8, { address: 13 }), fx('c3', 4, { address: 9, universe: 2 })]
  expect(nextFreeAddress(rig, 1, 4)).toBe(9)
  expect(nextFreeAddress(rig, 1, 5)).toBe(21)
  expect(nextFreeAddress(rig, 1, 8, 'a1')).toBe(1)
  expect(nextFreeAddress(rig, 2, 8)).toBe(1)
  expect(nextFreeAddress([fx('big', 510, { address: 1 })], 1, 4)).toBeNull()
})
