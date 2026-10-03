import { PX_PER_M } from '../../model/defaults'
import { AMP_SHAPE, OUTPUT_SHAPES } from '../../model/shapes'
import type { InstrumentType, Project } from '../../model/types'
import type { Assignment } from '../assign'
import { routeProject, trunkLabels } from '../cables'

/**
 * Bühnenplan als eigenständiges SVG für den Druck (PDF). Alle Farben stehen direkt in den
 * Attributen (keine CSS-Variablen), immer helles Farbschema. Geometrie wie in der App
 * (components/stage), Größen über den Faktor `k` (SVG-Einheiten pro Design-Pixel).
 */

const C = {
  floor: '#ffffff',
  grid: '#e6e8ec',
  gridMajor: '#d0d4da',
  edge: '#8b93a1',
  label: '#6b7280',
  text: '#111827',
  muted: '#4b5563',
  danger: '#a3352a',
  accent: '#0e7c86',
  boxText: '#0b0d12',
  pill: '#ffffff',
  pillBorder: '#d1d5db',
}

const TYPE_ABBR: Record<InstrumentType, string> = {
  drums: 'DR',
  percussion: 'PC',
  bass: 'BS',
  guitar: 'GT',
  keys: 'KY',
  vocals: 'VX',
  other: '•',
}

/**
 * Enger Ausschnitt für den Druck: Bühne plus Platz für Maßstab und Publikumszeile, erweitert um
 * Elemente, die über den Rand ragen (z. B. Stageboxen neben der Bühne). In Metern berechnet.
 */
export function plotViewBox(project: Pick<Project, 'stage' | 'boxes' | 'groups' | 'outputs'>) {
  const { width, depth } = project.stage
  const elements = [...project.boxes, ...project.groups, ...project.outputs].map((e) => e.pos)
  const minX = Math.min(-0.6, ...elements.map((p) => p.x - 1))
  const maxX = Math.max(width + 0.4, ...elements.map((p) => p.x + 1))
  const minY = Math.min(-0.6, ...elements.map((p) => p.y - 0.9))
  // Platz unter dem untersten Element (inkl. Beschriftung) für die Publikumszeile
  const maxY = Math.max(depth + 0.3, ...elements.map((p) => p.y + 0.95)) + 0.45
  return {
    x: minX * PX_PER_M,
    y: minY * PX_PER_M,
    w: (maxX - minX) * PX_PER_M,
    h: (maxY - minY) * PX_PER_M,
  }
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function n(v: number): string {
  return String(Math.round(v * 100) / 100)
}

type Attrs = Record<string, string | number | undefined>

function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([key, v]) => ` ${key}="${typeof v === 'number' ? n(v) : esc(v!)}"`)
    .join('')
}

function el(tag: string, a: Attrs, children = ''): string {
  return children ? `<${tag}${attrs(a)}>${children}</${tag}>` : `<${tag}${attrs(a)}/>`
}

/** Zentrierter Text; y ist die optische Mitte (svg2pdf kennt kein dominant-baseline). */
function text(x: number, y: number, size: number, content: string, extra: Attrs = {}): string {
  return el(
    'text',
    { x, y: y + size * 0.35, 'font-size': size, 'font-family': 'helvetica', 'text-anchor': 'middle', ...extra },
    esc(content),
  )
}

/** Text mit weißem Rand, damit er über Linien lesbar bleibt. */
function haloText(x: number, y: number, size: number, content: string, fill: string, k: number): string {
  return (
    text(x, y, size, content, { fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 3 * k, 'font-weight': 'bold' }) +
    text(x, y, size, content, { fill, 'font-weight': 'bold' })
  )
}

function pinMark(x: number, y: number, k: number): string {
  return el(
    'g',
    { transform: `translate(${n(x)} ${n(y)}) scale(${n(k)})` },
    el('circle', { r: 7, fill: C.accent }) +
      el('path', {
        d: 'M -2.5 -4.5 h 5 l -1 3.5 l 2.5 2 h -8 l 2.5 -2 Z M 0 1 v 4.5',
        fill: '#ffffff',
        stroke: '#ffffff',
        'stroke-width': 1.2,
        'stroke-linejoin': 'round',
      }),
  )
}

export function renderPlotSvg(project: Project, assignment: Assignment, k: number): string {
  const { stage } = project
  const vb = plotViewBox(project)
  const P = (m: number) => m * PX_PER_M
  const W = P(stage.width)
  const D = P(stage.depth)
  const boxById = new Map(project.boxes.map((b) => [b.id, b]))
  const parts: string[] = []

  // Bühne, Raster, Maßstab
  parts.push(el('rect', { x: 0, y: 0, width: W, height: D, fill: C.floor }))
  const step = stage.width > 24 || stage.depth > 24 ? 2 : 1
  for (let m = 0; m <= stage.width + 1e-9; m += step) {
    parts.push(el('line', { x1: P(m), y1: 0, x2: P(m), y2: D, stroke: m % 5 === 0 ? C.gridMajor : C.grid, 'stroke-width': 0.6 * k }))
    parts.push(text(P(m), -8 * k, 8 * k, String(m), { fill: C.label }))
  }
  for (let m = 0; m <= stage.depth + 1e-9; m += step) {
    parts.push(el('line', { x1: 0, y1: P(m), x2: W, y2: P(m), stroke: m % 5 === 0 ? C.gridMajor : C.grid, 'stroke-width': 0.6 * k }))
    parts.push(text(-8 * k, P(m), 8 * k, String(m), { fill: C.label }))
  }
  parts.push(el('rect', { x: 0, y: 0, width: W, height: D, fill: 'none', stroke: C.edge, 'stroke-width': 1.2 * k }))
  parts.push(el('line', { x1: 0, y1: D, x2: W, y2: D, stroke: C.edge, 'stroke-width': 4 * k }))
  const size = `${stage.width.toLocaleString('de-DE')} × ${stage.depth.toLocaleString('de-DE')} m`
  // Publikumszeile ganz unten, unter PA und Subs vor der Bühne
  parts.push(text(W / 2, vb.y + vb.h - 9 * k, 10 * k, `PUBLIKUM · ${size}`, { fill: C.label, 'letter-spacing': 1 * k }))

  // Kabel (Kabelanzahlen werden zuletzt gezeichnet, damit sie über den Knoten liegen)
  const cableLabels: string[] = []
  if ((project.cableView ?? 'bundled') === 'bundled') {
    const routes = routeProject(project, assignment)
    for (const box of project.boxes) {
      const route = routes[box.id]
      if (!route || route.total === 0) continue
      for (const s of route.stubs)
        parts.push(el('line', { x1: P(s.from.x), y1: P(s.from.y), x2: P(s.to.x), y2: P(s.to.y), stroke: box.color, 'stroke-width': 1.5 * k }))
      for (const s of [...route.segments].sort((a, b) => a.count - b.count))
        parts.push(
          el('line', {
            x1: P(s.a.x),
            y1: P(s.a.y),
            x2: P(s.b.x),
            y2: P(s.b.y),
            stroke: box.color,
            'stroke-width': (1.2 + Math.sqrt(s.count)) * k,
            'stroke-linecap': 'round',
          }),
        )
      const m = (cssPx: number) => (cssPx * k) / PX_PER_M
      for (const { pos, count } of trunkLabels(route, box.pos, {
        clear: { left: m(17), right: m(17), top: m(17), bottom: m(17) },
        offset: m(9),
      })) {
        const t = String(count)
        const w = (t.length * 6.5 + 8) * k
        const h = 14 * k
        cableLabels.push(
          el('rect', { x: P(pos.x) - w / 2, y: P(pos.y) - h / 2, width: w, height: h, rx: h / 2, fill: box.color }) +
            text(P(pos.x), P(pos.y), 10 * k, t, { fill: C.boxText, 'font-weight': 'bold' }),
        )
      }
    }
  } else {
    for (const g of project.groups) {
      const a = assignment.groups[g.id]
      for (const boxId of a?.boxIds ?? []) {
        const box = boxById.get(boxId)!
        parts.push(
          el('line', {
            x1: P(g.pos.x),
            y1: P(g.pos.y),
            x2: P(box.pos.x),
            y2: P(box.pos.y),
            stroke: box.color,
            'stroke-width': 2 * k,
            'stroke-dasharray': a.split ? `${n(6 * k)} ${n(4 * k)}` : undefined,
          }),
        )
      }
    }
    for (const o of project.outputs) {
      const boxId = assignment.outputElements[o.id]?.boxId
      const box = boxId ? boxById.get(boxId) : undefined
      if (box)
        parts.push(
          el('line', {
            x1: P(o.pos.x),
            y1: P(o.pos.y),
            x2: P(box.pos.x),
            y2: P(box.pos.y),
            stroke: box.color,
            'stroke-width': 1.5 * k,
            'stroke-dasharray': `${n(2 * k)} ${n(3 * k)}`,
          }),
        )
    }
  }

  // Outputs
  for (const o of project.outputs) {
    const a = assignment.outputElements[o.id]
    const box = a?.boxId ? boxById.get(a.boxId) : undefined
    const stroke = box?.color ?? C.danger
    const common: Attrs = {
      fill: '#ffffff',
      stroke,
      'stroke-width': 2.5 * k,
      'stroke-dasharray': box ? undefined : `${n(4 * k)} ${n(3 * k)}`,
    }
    const spec = OUTPUT_SHAPES[o.kind]
    const w = spec.w * k
    const h = spec.h * k
    const shape =
      spec.shape === 'trapezoid'
        ? el('path', { d: `M ${n(-w / 2)} ${n(h / 2)} L ${n(w / 2)} ${n(h / 2)} L ${n(w / 3)} ${n(-h / 2)} L ${n(-w / 3)} ${n(-h / 2)} Z`, ...common })
        : el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: spec.rx * k, ...common })
    const abbr = spec.abbr
    parts.push(
      el(
        'g',
        { transform: `translate(${n(P(o.pos.x))} ${n(P(o.pos.y))})` },
        shape +
          text(0, 0, 9 * k, abbr, { fill: C.text, 'font-weight': 'bold' }) +
          (a?.pinned ? pinMark(-w / 2, -h / 2 - 2 * k, k) : '') +
          haloText(0, h / 2 + 9 * k, 9.5 * k, o.name, C.muted, k),
      ),
    )
  }

  // Instrumente
  for (const g of project.groups) {
    const a = assignment.groups[g.id]
    const primary = a?.boxIds[0] ? boxById.get(a.boxIds[0]) : undefined
    const problem = (a?.unpatched ?? 0) > 0
    const amp = g.form === 'amp'
    const r = 17 * k
    const halfW = amp ? (AMP_SHAPE.w / 2) * k : r
    const halfH = amp ? (AMP_SHAPE.h / 2) * k : r
    const corner = amp ? 1 : 0.75
    const badge = { x: halfW * corner, y: -halfH * corner }
    const body: Attrs = {
      fill: '#ffffff',
      stroke: problem ? C.danger : (primary?.color ?? C.muted),
      'stroke-width': 3 * k,
      'stroke-dasharray': problem ? `${n(4 * k)} ${n(3 * k)}` : undefined,
    }
    parts.push(
      el(
        'g',
        { transform: `translate(${n(P(g.pos.x))} ${n(P(g.pos.y))})` },
        (amp
          ? el('rect', { x: -halfW, y: -halfH, width: 2 * halfW, height: 2 * halfH, rx: AMP_SHAPE.rx * k, ...body })
          : el('circle', { r, ...body })) +
          text(0, 0, (amp ? 10 : 12) * k, amp ? AMP_SHAPE.abbr : TYPE_ABBR[g.type], { fill: C.text, 'font-weight': 'bold' }) +
          el('circle', { cx: badge.x, cy: badge.y, r: 8 * k, fill: problem ? C.danger : C.text }) +
          text(badge.x, badge.y, 9.5 * k, problem ? '!' : String(g.channels.length), { fill: '#ffffff', 'font-weight': 'bold' }) +
          (a?.pinned ? pinMark(-halfW * corner, -halfH * corner, k) : '') +
          haloText(0, halfH + 11 * k, 11 * k, g.name, C.text, k),
      ),
    )
  }

  // Stageboxen
  for (const box of project.boxes) {
    const u = assignment.usage[box.id]
    const s = 30 * k
    const inText = `${u.inputsUsed}/${box.inputs} In`
    const outText = `${u.outputsUsed}/${box.outputs} Out`
    const capW = (Math.max(inText.length, outText.length) * 6.6 + 12) * k
    const lineH = 12 * k
    const capH = 2 * lineH + 4 * k
    const capY = s / 2 + 4 * k
    parts.push(
      el(
        'g',
        { transform: `translate(${n(P(box.pos.x))} ${n(P(box.pos.y))})` },
        el('rect', { x: -s / 2, y: -s / 2, width: s, height: s, rx: 5 * k, fill: box.color, stroke: '#00000040', 'stroke-width': 0.8 * k }) +
          text(0, 0, 15 * k, box.name, { fill: C.boxText, 'font-weight': 'bold' }) +
          el('rect', { x: -capW / 2, y: capY, width: capW, height: capH, rx: 6 * k, fill: C.pill, stroke: C.pillBorder, 'stroke-width': 0.8 * k }) +
          text(0, capY + 2 * k + lineH / 2, 10.5 * k, inText, { fill: u.inputsMissing ? C.danger : C.text, 'font-weight': 'bold' }) +
          text(0, capY + 2 * k + lineH * 1.5, 10.5 * k, outText, { fill: u.outputsMissing ? C.danger : C.text, 'font-weight': 'bold' }),
      ),
    )
  }

  const body = parts.join('') + cableLabels.join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(vb.x)} ${n(vb.y)} ${n(vb.w)} ${n(vb.h)}" width="${n(vb.w)}" height="${n(vb.h)}">${body}</svg>`
}
