import type { Project, StageSize, Vec2 } from '../model/types'
import type { Assignment } from './assign'

/**
 * Gebündelte Kabelwege.
 *
 * Pro Stagebox wird ein rechtwinkliger Baum gebaut (Rectilinear Steiner Arborescence, Heuristik
 * nach Rao et al.): Jedes Kabel bleibt ein kürzester rechtwinkliger Weg zur Box, und Kabel
 * werden genau dort zusammengelegt, wo sich ihre kürzesten Wege ohne Umweg überlappen können.
 */

export interface CableTerminal {
  id: string
  pos: Vec2
  /** Anzahl Kabel von diesem Punkt zur Box. */
  count: number
}

/** Achsparalleles Stück einer Strippe. */
export interface CableSegment {
  a: Vec2
  b: Vec2
  count: number
}

/** Kurzes Verbindungsstück vom Element zum (gerasterten) Strippen-Anfang, liegt unter dem Knoten. */
export interface CableStub {
  from: Vec2
  to: Vec2
}

/**
 * Richtung der letzten Strecke zur Box: 'horizontal' = an der Rück-/Vorderwand entlang,
 * 'vertical' = an der Seitenwand entlang.
 */
export type TrunkAxis = 'horizontal' | 'vertical'

export interface CableRoute {
  segments: CableSegment[]
  stubs: CableStub[]
  /** Kabel insgesamt (ohne Elemente direkt an der Box). */
  total: number
}

export interface RouteOptions {
  axis: TrunkAxis
  /** Raster in Metern, damit kleine Versätze keine Mini-Knicke erzeugen. */
  snap?: number
}

interface TreeNode {
  x: number
  y: number
  count: number
}

const EPS = 1e-6

function roundTo(v: number, step: number): number {
  const r = Math.round(v / step) * step
  return Math.abs(r) < EPS ? 0 : Math.round(r * 1e6) / 1e6
}

/**
 * RSA-Heuristik in einem Quadranten (alle Koordinaten ≥ 0, Wurzel im Ursprung).
 * Liefert Kanten Kind → Elternknoten; Eltern liegen immer näher an der Wurzel (x und y ≤ Kind).
 */
function arborescence(points: TreeNode[]): { child: TreeNode; parent: TreeNode }[] {
  const edges: { child: TreeNode; parent: TreeNode }[] = []
  const active = points.map((p) => ({ ...p }))

  while (active.length > 1) {
    // Paar, dessen gemeinsamer Punkt am weitesten von der Wurzel entfernt ist.
    let best = { i: 0, j: 1, score: -1 }
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const score = Math.min(active[i].x, active[j].x) + Math.min(active[i].y, active[j].y)
        if (score > best.score + EPS) best = { i, j, score }
      }
    const p = active[best.i]
    const q = active[best.j]
    const m: TreeNode = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), count: p.count + q.count }
    const same = (a: TreeNode, b: TreeNode) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
    if (same(m, p)) {
      edges.push({ child: q, parent: p })
      p.count += q.count
      active.splice(best.j, 1)
    } else if (same(m, q)) {
      edges.push({ child: p, parent: q })
      q.count += p.count
      active.splice(best.i, 1)
    } else {
      edges.push({ child: p, parent: m }, { child: q, parent: m })
      active.splice(best.j, 1)
      active.splice(best.i, 1, m)
    }
  }

  const top = active[0]
  if (top && (top.x > EPS || top.y > EPS)) edges.push({ child: top, parent: { x: 0, y: 0, count: top.count } })
  return edges
}

/** Fasst überlappende, kollineare Stücke zusammen und summiert die Kabelanzahl. */
export function normalizeSegments(segments: CableSegment[]): CableSegment[] {
  const out: CableSegment[] = []
  const groups = new Map<string, { horizontal: boolean; line: number; spans: { from: number; to: number; count: number }[] }>()

  for (const s of segments) {
    const horizontal = Math.abs(s.a.y - s.b.y) < EPS
    if (horizontal && Math.abs(s.a.x - s.b.x) < EPS) continue // Länge 0
    const line = horizontal ? s.a.y : s.a.x
    const [from, to] = horizontal ? [s.a.x, s.b.x].sort((a, b) => a - b) : [s.a.y, s.b.y].sort((a, b) => a - b)
    const key = `${horizontal ? 'h' : 'v'}:${line.toFixed(4)}`
    const g = groups.get(key) ?? { horizontal, line, spans: [] }
    g.spans.push({ from, to, count: s.count })
    groups.set(key, g)
  }

  for (const g of groups.values()) {
    const cuts = [...new Set(g.spans.flatMap((s) => [s.from, s.to]).map((v) => v.toFixed(6)))]
      .map(Number)
      .sort((a, b) => a - b)
    // Elementare Intervalle nicht wieder verschmelzen: Ein Schnittpunkt mit gleicher Anzahl ist
    // eine Verzweigung (z. B. die Box selbst) und soll Endpunkt bleiben.
    for (let i = 0; i < cuts.length - 1; i++) {
      const lo = cuts[i]
      const hi = cuts[i + 1]
      const count = g.spans.filter((s) => s.from <= lo + EPS && s.to >= hi - EPS).reduce((n, s) => n + s.count, 0)
      if (count === 0) continue
      out.push(
        g.horizontal
          ? { a: { x: lo, y: g.line }, b: { x: hi, y: g.line }, count }
          : { a: { x: g.line, y: lo }, b: { x: g.line, y: hi }, count },
      )
    }
  }
  return out
}

/** Baut die Strippen von allen Terminals zu einer Box (Wurzel). */
export function routeCables(root: Vec2, terminals: CableTerminal[], options: RouteOptions): CableRoute {
  const snap = options.snap ?? 0.25
  const stubs: CableStub[] = []
  const merged = new Map<string, { x: number; y: number; count: number }>()

  for (const t of terminals) {
    if (t.count <= 0) continue
    const rx = roundTo(t.pos.x - root.x, snap)
    const ry = roundTo(t.pos.y - root.y, snap)
    const snapped = { x: root.x + rx, y: root.y + ry }
    if (Math.abs(snapped.x - t.pos.x) > EPS || Math.abs(snapped.y - t.pos.y) > EPS) stubs.push({ from: t.pos, to: snapped })
    const key = `${rx}:${ry}`
    const m = merged.get(key) ?? { x: rx, y: ry, count: 0 }
    m.count += t.count
    merged.set(key, m)
  }

  // Quadranten getrennt rechnen (gespiegelt in den positiven Bereich).
  const quadrants = new Map<string, { sx: number; sy: number; points: TreeNode[] }>()
  let total = 0
  for (const p of merged.values()) {
    if (p.x === 0 && p.y === 0) continue // steht direkt an der Box
    total += p.count
    const sx = p.x < 0 ? -1 : 1
    const sy = p.y < 0 ? -1 : 1
    const key = `${sx}:${sy}`
    const q = quadrants.get(key) ?? { sx, sy, points: [] }
    q.points.push({ x: Math.abs(p.x), y: Math.abs(p.y), count: p.count })
    quadrants.set(key, q)
  }

  const raw: CableSegment[] = []
  for (const { sx, sy, points } of quadrants.values()) {
    for (const { child, parent } of arborescence(points)) {
      // Ecke so wählen, dass das Stück am Elternknoten in Richtung der Hauptachse läuft.
      const corner = options.axis === 'horizontal' ? { x: child.x, y: parent.y } : { x: parent.x, y: child.y }
      const toStage = (v: { x: number; y: number }): Vec2 => ({ x: root.x + sx * v.x, y: root.y + sy * v.y })
      raw.push({ a: toStage(child), b: toStage(corner), count: child.count })
      raw.push({ a: toStage(corner), b: toStage(parent), count: child.count })
    }
  }

  return { segments: normalizeSegments(raw), stubs, total }
}

/** Box an Rück- oder Vorderwand → Strippe läuft waagerecht, an einer Seitenwand → senkrecht. */
export function trunkAxisFor(pos: Vec2, stage: StageSize): TrunkAxis {
  const toBackOrFront = Math.min(pos.y, stage.depth - pos.y)
  const toSide = Math.min(pos.x, stage.width - pos.x)
  return toBackOrFront <= toSide ? 'horizontal' : 'vertical'
}

/** Kabelwege für alle Boxen eines Projekts, passend zur aktuellen Zuordnung. */
export function routeProject(project: Project, assignment: Assignment): Record<string, CableRoute> {
  const result: Record<string, CableRoute> = {}
  for (const box of project.boxes) {
    const terminals: CableTerminal[] = []
    for (const g of project.groups) {
      const count = assignment.groups[g.id]?.channelsPerBox[box.id] ?? 0
      if (count > 0) terminals.push({ id: g.id, pos: g.pos, count })
    }
    for (const o of project.outputs) {
      if (assignment.outputElements[o.id]?.boxId === box.id) terminals.push({ id: o.id, pos: o.pos, count: 1 })
    }
    result[box.id] = routeCables(box.pos, terminals, { axis: trunkAxisFor(box.pos, project.stage) })
  }
  return result
}

export interface LabelOptions {
  /** Bereich um die Box (relativ zur Box, in Metern), in dem keine Zahl stehen soll. */
  clear?: { left: number; right: number; top: number; bottom: number }
  /** Zusätzlicher Abstand hinter dem freizuhaltenden Bereich, in Metern. */
  offset?: number
}

/**
 * Positionen für die Kabelanzahl am Abgang zur Box: entlang der Hauptstrippe (gleiche Anzahl,
 * auch um Ecken) bis aus dem Bereich der Box heraus, plus `offset`. Endet die Strippe vorher,
 * steht die Zahl an ihrem Ende.
 */
export function trunkLabels(route: CableRoute, root: Vec2, options: LabelOptions = {}): { pos: Vec2; count: number }[] {
  const same = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
  const clear = options.clear ?? { left: 0, right: 0, top: 0, bottom: 0 }
  const offset = options.offset ?? 0
  const inside = (p: Vec2) =>
    p.x > root.x - clear.left + EPS &&
    p.x < root.x + clear.right - EPS &&
    p.y > root.y - clear.top + EPS &&
    p.y < root.y + clear.bottom - EPS
  const STEP = 0.02
  const labels: { pos: Vec2; count: number }[] = []

  for (const start of route.segments.filter((s) => same(s.a, root) || same(s.b, root))) {
    if (start.count < 2) continue
    let from = root
    let seg: CableSegment | undefined = start
    const used = new Set<CableSegment>()
    let pos = root
    let remaining: number | null = null // Rest-Abstand, sobald der Box-Bereich verlassen ist
    walk: while (seg) {
      used.add(seg)
      const to: Vec2 = same(seg.a, from) ? seg.b : seg.a
      const len = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
      for (let d = 0; d <= len + EPS; d += STEP) {
        const t = Math.min(1, d / len)
        const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
        if (remaining === null && !inside(p)) remaining = offset
        if (remaining !== null) {
          const prev = pos
          const stepLen = Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y)
          if (stepLen >= remaining) {
            const k = stepLen === 0 ? 0 : remaining / stepLen
            pos = { x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k }
            break walk
          }
          remaining -= stepLen
        }
        pos = p
      }
      pos = to
      from = to
      // Weiter nur, wenn genau ein Stück mit gleicher Anzahl anschließt (die Strippe verzweigt nicht).
      const next = route.segments.filter((s) => !used.has(s) && s.count === start.count && (same(s.a, to) || same(s.b, to)))
      seg = next.length === 1 ? next[0] : undefined
    }
    labels.push({ pos: { x: Math.round(pos.x * 1e4) / 1e4, y: Math.round(pos.y * 1e4) / 1e4 }, count: start.count })
  }
  return labels
}
