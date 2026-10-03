import { describe, expect, test } from 'vitest'
import type { Project, Vec2 } from '../model/types'
import { assign } from './assign'
import { normalizeSegments, routeCables, routeProject, trunkAxisFor, trunkLabels, type CableSegment } from './cables'

const ROOT = { x: 0, y: 0 }
const key = (p: Vec2) => `${p.x.toFixed(3)}:${p.y.toFixed(3)}`
const len = (s: CableSegment) => Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y)
const touchesRoot = (s: CableSegment, root = ROOT) => key(s.a) === key(root) || key(s.b) === key(root)

/** Kürzester Weg im Segment-Graphen (Dijkstra), um "kein Umweg" zu prüfen. */
function graphDistance(segments: CableSegment[], from: Vec2, to: Vec2): number {
  // Segmente an allen Endpunkten aufteilen, die auf ihnen liegen.
  const points = segments.flatMap((s) => [s.a, s.b])
  const edges = new Map<string, { to: string; w: number }[]>()
  const addEdge = (p: Vec2, q: Vec2) => {
    const w = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
    if (w === 0) return
    for (const [a, b] of [
      [p, q],
      [q, p],
    ]) {
      const list = edges.get(key(a)) ?? []
      list.push({ to: key(b), w })
      edges.set(key(a), list)
    }
  }
  for (const s of segments) {
    const horizontal = s.a.y === s.b.y
    const on = points
      .filter((p) =>
        horizontal
          ? p.y === s.a.y && p.x >= Math.min(s.a.x, s.b.x) && p.x <= Math.max(s.a.x, s.b.x)
          : p.x === s.a.x && p.y >= Math.min(s.a.y, s.b.y) && p.y <= Math.max(s.a.y, s.b.y),
      )
      .sort((p, q) => (horizontal ? p.x - q.x : p.y - q.y))
    for (let i = 0; i < on.length - 1; i++) addEdge(on[i], on[i + 1])
  }
  const dist = new Map<string, number>([[key(from), 0]])
  const queue = [key(from)]
  while (queue.length) {
    queue.sort((a, b) => dist.get(a)! - dist.get(b)!)
    const cur = queue.shift()!
    for (const e of edges.get(cur) ?? []) {
      const d = dist.get(cur)! + e.w
      if (d < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, d)
        queue.push(e.to)
      }
    }
  }
  return dist.get(key(to)) ?? Infinity
}

describe('routeCables', () => {
  test('a single cable is an L-shaped shortest path', () => {
    const r = routeCables(ROOT, [{ id: 'a', pos: { x: 4, y: 3 }, count: 2 }], { axis: 'horizontal' })
    expect(r.total).toBe(2)
    expect(r.segments.every((s) => s.a.x === s.b.x || s.a.y === s.b.y)).toBe(true)
    expect(r.segments.reduce((n, s) => n + len(s), 0)).toBe(7)
    // waagerecht an der Wand entlang zur Box
    const last = r.segments.find((s) => touchesRoot(s))!
    expect(last.a.y).toBe(0)
    expect(last.b.y).toBe(0)
    expect(last.count).toBe(2)
  })

  test('vertical trunk axis runs the last stretch along the side wall', () => {
    const r = routeCables(ROOT, [{ id: 'a', pos: { x: 4, y: 3 }, count: 1 }], { axis: 'vertical' })
    const last = r.segments.find((s) => touchesRoot(s))!
    expect(last.a.x).toBe(0)
    expect(last.b.x).toBe(0)
  })

  test('cables heading the same way are bundled into one trunk', () => {
    const r = routeCables(
      ROOT,
      [
        { id: 'drums', pos: { x: 4, y: 3 }, count: 7 },
        { id: 'bass', pos: { x: 6, y: 3 }, count: 2 },
      ],
      { axis: 'horizontal' },
    )
    // Gesamtlänge kleiner als zwei getrennte Kabel (7 + 9 m)
    expect(r.segments.reduce((n, s) => n + len(s), 0)).toBe(9)
    const trunk = r.segments.find((s) => touchesRoot(s))!
    expect(trunk.count).toBe(9)
    expect(r.segments.find((s) => key(s.a) === '6.000:3.000' || key(s.b) === '6.000:3.000')!.count).toBe(2)
  })

  test('cables on opposite sides are not bundled', () => {
    const r = routeCables(
      ROOT,
      [
        { id: 'l', pos: { x: -3, y: 2 }, count: 1 },
        { id: 'r', pos: { x: 3, y: 2 }, count: 1 },
      ],
      { axis: 'horizontal' },
    )
    const atRoot = r.segments.filter((s) => touchesRoot(s))
    expect(atRoot).toHaveLength(2)
    expect(atRoot.every((s) => s.count === 1)).toBe(true)
  })

  test('cables from in front of and behind the box share the run along the wall', () => {
    const r = routeCables(
      ROOT,
      [
        { id: 'a', pos: { x: 4, y: 2 }, count: 3 },
        { id: 'b', pos: { x: 4, y: -2 }, count: 1 },
      ],
      { axis: 'horizontal' },
    )
    const atRoot = r.segments.filter((s) => touchesRoot(s))
    expect(atRoot).toEqual([{ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, count: 4 }])
  })

  test('no cable takes a detour (path length = Manhattan distance)', () => {
    const terminals = [
      { id: '1', pos: { x: 2, y: 5 }, count: 1 },
      { id: '2', pos: { x: 6, y: 3 }, count: 2 },
      { id: '3', pos: { x: 5, y: 6 }, count: 7 },
      { id: '4', pos: { x: -4, y: 4 }, count: 1 },
      { id: '5', pos: { x: -1, y: 1.5 }, count: 1 },
      { id: '6', pos: { x: 3, y: -1 }, count: 1 },
    ]
    for (const axis of ['horizontal', 'vertical'] as const) {
      const r = routeCables(ROOT, terminals, { axis })
      for (const t of terminals) {
        expect(graphDistance(r.segments, t.pos, ROOT)).toBeCloseTo(Math.abs(t.pos.x) + Math.abs(t.pos.y))
      }
      expect(r.total).toBe(13)
      const atRoot = r.segments.filter((s) => touchesRoot(s)).reduce((n, s) => n + s.count, 0)
      expect(atRoot).toBe(13)
    }
  })

  test('small offsets are snapped so lines stay straight', () => {
    const r = routeCables({ x: 1, y: 1 }, [{ id: 'a', pos: { x: 1.1, y: 4 }, count: 1 }], { axis: 'horizontal' })
    expect(r.segments).toEqual([{ a: { x: 1, y: 1 }, b: { x: 1, y: 4 }, count: 1 }])
    expect(r.stubs).toEqual([{ from: { x: 1.1, y: 4 }, to: { x: 1, y: 4 } }])
  })

  test('elements at the box and empty terminals produce no cables', () => {
    const r = routeCables(ROOT, [
      { id: 'a', pos: { x: 0.05, y: 0 }, count: 3 },
      { id: 'b', pos: { x: 5, y: 5 }, count: 0 },
    ], { axis: 'horizontal' })
    expect(r.segments).toEqual([])
    expect(r.total).toBe(0)
  })
})

describe('trunkLabels', () => {
  test('places the count along the trunk, around corners, away from the box', () => {
    const r = routeCables(
      ROOT,
      [
        { id: 'a', pos: { x: 0.5, y: 4 }, count: 5 },
        { id: 'b', pos: { x: 3, y: 4 }, count: 2 },
      ],
      { axis: 'horizontal' },
    )
    // Strippe: (0,0) → (0.5,0) waagerecht, dann senkrecht runter
    expect(trunkLabels(r, ROOT, { offset: 1.5 })).toEqual([{ pos: { x: 0.5, y: 1 }, count: 7 }])
  })

  test('skips the area covered by the box and its capacity label', () => {
    const r = routeCables(ROOT, [{ id: 'a', pos: { x: 0.5, y: 4 }, count: 5 }], { axis: 'horizontal' })
    const [label] = trunkLabels(r, ROOT, { clear: { left: 1, right: 1, top: 0.5, bottom: 1.6 }, offset: 0.3 })
    expect(label.pos.x).toBe(0.5)
    expect(label.pos.y).toBeCloseTo(1.9, 1)
  })

  test('single cables get no label', () => {
    const r = routeCables(ROOT, [{ id: 'a', pos: { x: 3, y: 3 }, count: 1 }], { axis: 'horizontal' })
    expect(trunkLabels(r, ROOT, { offset: 1 })).toEqual([])
  })
})

describe('normalizeSegments', () => {
  test('sums overlapping collinear pieces and splits at their ends', () => {
    const out = normalizeSegments([
      { a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, count: 1 },
      { a: { x: 2, y: 0 }, b: { x: 6, y: 0 }, count: 2 },
    ])
    expect(out).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, count: 1 },
      { a: { x: 2, y: 0 }, b: { x: 4, y: 0 }, count: 3 },
      { a: { x: 4, y: 0 }, b: { x: 6, y: 0 }, count: 2 },
    ])
  })
})

describe('routeProject', () => {
  test('uses the assignment and picks the wall the box stands at', () => {
    expect(trunkAxisFor({ x: 1.5, y: 0.75 }, { width: 10, depth: 6 })).toBe('horizontal')
    expect(trunkAxisFor({ x: 0.5, y: 3 }, { width: 10, depth: 6 })).toBe('vertical')

    const project: Project = {
      version: 1,
      name: 't',
      stage: { width: 10, depth: 6 },
      boxes: [{ id: 'A', name: 'A', pos: { x: 1, y: 0.5 }, inputs: 16, outputs: 8, color: '#000' }],
      groups: [
        {
          id: 'g',
          type: 'other',
          name: 'g',
          pos: { x: 4, y: 3 },
          channels: [
            { id: 'c1', name: 'c1', pickup: '' },
            { id: 'c2', name: 'c2', pickup: '' },
          ],
        },
      ],
      outputs: [{ id: 'w', kind: 'wedge', name: 'w', pos: { x: 4, y: 5 } }],
    }
    const routes = routeProject(project, assign(project))
    expect(routes.A.total).toBe(3)
    const trunk = routes.A.segments.find((s) => touchesRoot(s, project.boxes[0].pos))!
    expect(trunk.count).toBe(3)
  })
})
