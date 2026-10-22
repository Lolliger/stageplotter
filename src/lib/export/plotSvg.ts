import { PX_PER_M } from '../../model/defaults'
import {
  FIXTURE_SIZE,
  FIXTURE_TYPES,
  TRUSS_WIDTH,
  beamPolygon,
  labelPlacement,
  lightExtent,
  viewSettings,
} from '../../model/lights'
import { AMP_SHAPE, DEVICE_SHAPE, OFFSTAGE_OUTPUTS, OUTPUT_SHAPES, frontArrowPoints } from '../../model/shapes'
import type { Fixture, InstrumentType, PlotMode, Project, Truss, Vec2 } from '../../model/types'
import type { Assignment } from '../assign'
import { deviceColor, routeProject, trunkLabels } from '../cables'
import { dmxIssues, formatAddress } from '../dmx'
import { DEVICE_ABBR } from '../../model/devices'

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
  warning: '#8a5b12',
  beam: '#f59e0b',
  truss: '#6b7280',
  ghost: '#aab1bc',
  ghostFill: '#f1f3f5',
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
export function plotViewBox(
  project: Pick<Project, 'stage' | 'boxes' | 'groups' | 'outputs' | 'devices' | 'fixtures' | 'trusses' | 'view'>,
  mode: PlotMode = 'sound',
) {
  const { width, depth } = project.stage
  const view = viewSettings(project)
  const sound =
    mode === 'sound'
      ? [...project.boxes, ...project.groups, ...project.outputs, ...project.devices]
      : [
          ...(view.sound.boxes ? [...project.boxes, ...project.devices] : []),
          ...(view.sound.instruments ? project.groups : []),
          ...project.outputs.filter((o) => (OFFSTAGE_OUTPUTS.includes(o.kind) ? view.sound.pa : view.sound.monitors)),
        ]
  const elements = sound.map((e) => e.pos)
  const lights = mode === 'lighting' || view.lights ? lightExtent(project) : null
  // Lampen: Platz für Beschriftung (Nummer/Adresse) und Traversen-Namen daneben
  const lx = lights ? [lights.minX - 1.6, lights.maxX + 1.6] : []
  const ly = lights ? [lights.minY - 1.1, lights.maxY + 1.2] : []
  const minX = Math.min(-0.6, ...elements.map((p) => p.x - 1), ...lx)
  const maxX = Math.max(width + 0.4, ...elements.map((p) => p.x + 1), ...lx)
  const minY = Math.min(-0.6, ...elements.map((p) => p.y - 0.9), ...ly)
  // Platz unter dem untersten Element (inkl. Beschriftung) für die Publikumszeile
  const maxY = Math.max(depth + 0.3, ...elements.map((p) => p.y + 0.95), ...ly) + 0.45
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

/** Symbol eines Lampentyps (wie FixtureShape in components/stage/lightNodes.tsx). */
function fixtureShape(kind: Fixture['kind'], s: number, a: Attrs): string {
  const h = s / 2
  switch (FIXTURE_TYPES[kind].shape) {
    case 'circle':
      return el('circle', { r: h, ...a })
    case 'square':
      return el('rect', { x: -h, y: -h, width: s, height: s, rx: s * 0.22, ...a })
    case 'rect':
      return el('rect', { x: -h * 0.62, y: -h * 1.15, width: s * 0.62, height: s * 1.15, rx: s * 0.1, ...a })
    case 'hex': {
      const pts = Array.from({ length: 6 }, (_, i) => `${n(Math.cos((Math.PI / 3) * i) * h)},${n(Math.sin((Math.PI / 3) * i) * h)}`).join(' ')
      return el('polygon', { points: pts, ...a })
    }
    case 'diamond':
      return el('polygon', { points: `0,${n(-h)} ${n(h)},0 0,${n(h)} ${n(-h)},0`, ...a })
  }
}

/** Traverse als Leiter; `ghost` = grau im Hintergrund (Tonplot). */
function trussSvg(t: Truss, k: number, ghost: boolean): string {
  const P = (m: number) => m * PX_PER_M
  const len = P(t.length)
  const th = Math.max(P(TRUSS_WIDTH), 7 * k)
  const color = ghost ? C.ghost : C.truss
  const segs = Math.max(1, Math.round(t.length / 0.5))
  const step = len / segs
  const zig = Array.from({ length: segs }, (_, i) => {
    const x0 = -len / 2 + i * step
    return `M ${n(x0)} ${n(i % 2 ? th / 2 : -th / 2)} L ${n(x0 + step)} ${n(i % 2 ? -th / 2 : th / 2)}`
  }).join(' ')
  const rad = ((t.rotation ?? 0) * Math.PI) / 180
  const ax = Math.cos(rad)
  const ay = Math.sin(rad)
  const gap = len / 2 + 6 * k
  const flat = Math.abs(ax) >= 0.5
  const label = flat
    ? text(-ax * gap, -ay * gap, 9.5 * k, t.name, { fill: ghost ? C.ghost : C.muted, 'font-weight': 'bold', 'text-anchor': ax > 0 ? 'end' : 'start' })
    : text(-ax * gap, -ay * gap + (ay > 0 ? -4 * k : 4 * k), 9.5 * k, t.name, { fill: ghost ? C.ghost : C.muted, 'font-weight': 'bold' })
  return el(
    'g',
    { transform: `translate(${n(P(t.pos.x))} ${n(P(t.pos.y))})` },
    el(
      'g',
      { transform: `rotate(${t.rotation ?? 0})` },
      el('rect', { x: -len / 2, y: -th / 2, width: len, height: th, fill: ghost ? 'none' : '#f3f4f6', stroke: color, 'stroke-width': 1.4 * k }) +
        el('path', { d: zig, fill: 'none', stroke: color, 'stroke-width': 0.9 * k }),
    ) + label,
  )
}

export function renderPlotSvg(project: Project, assignment: Assignment, k: number, mode: PlotMode = 'sound'): string {
  const { stage } = project
  const vb = plotViewBox(project, mode)
  const view = viewSettings(project)
  const lighting = mode === 'lighting'
  const P = (m: number) => m * PX_PER_M
  const W = P(stage.width)
  const D = P(stage.depth)
  const boxById = new Map(project.boxes.map((b) => [b.id, b]))
  const parts: string[] = []

  // Bühne, Raster, Maßstab (im Lichtplot am Rand, damit er nicht mit Traversen kollidiert)
  const scaleY = lighting ? vb.y + 8 * k : -8 * k
  const scaleX = lighting ? vb.x + vb.w - 8 * k : -8 * k
  parts.push(el('rect', { x: 0, y: 0, width: W, height: D, fill: C.floor }))
  const step = stage.width > 24 || stage.depth > 24 ? 2 : 1
  for (let m = 0; m <= stage.width + 1e-9; m += step) {
    parts.push(el('line', { x1: P(m), y1: 0, x2: P(m), y2: D, stroke: m % 5 === 0 ? C.gridMajor : C.grid, 'stroke-width': 0.6 * k }))
    parts.push(text(P(m), scaleY, 8 * k, String(m), { fill: C.label }))
  }
  for (let m = 0; m <= stage.depth + 1e-9; m += step) {
    parts.push(el('line', { x1: 0, y1: P(m), x2: W, y2: P(m), stroke: m % 5 === 0 ? C.gridMajor : C.grid, 'stroke-width': 0.6 * k }))
    parts.push(text(scaleX, P(m), 8 * k, String(m), { fill: C.label }))
  }
  parts.push(el('rect', { x: 0, y: 0, width: W, height: D, fill: 'none', stroke: C.edge, 'stroke-width': 1.2 * k }))
  parts.push(el('line', { x1: 0, y1: D, x2: W, y2: D, stroke: C.edge, 'stroke-width': 4 * k }))
  const size = `${stage.width.toLocaleString('de-DE')} × ${stage.depth.toLocaleString('de-DE')} m`
  // Publikumszeile ganz unten, unter PA und Subs vor der Bühne
  parts.push(text(W / 2, vb.y + vb.h - 9 * k, 10 * k, `PUBLIKUM · ${size}`, { fill: C.label, 'letter-spacing': 1 * k }))

  // Tonplot mit eingeblendetem Licht: Traversen und Lampen grau im Hintergrund
  if (!lighting && view.lights) {
    for (const t of project.trusses) parts.push(trussSvg(t, k, true))
    for (const f of project.fixtures)
      parts.push(
        el(
          'g',
          { transform: `translate(${n(P(f.pos.x))} ${n(P(f.pos.y))}) rotate(${f.rotation ?? 0})` },
          fixtureShape(f.kind, FIXTURE_SIZE * k * 0.62, { fill: C.ghostFill, stroke: C.ghost, 'stroke-width': 0.8 * k }),
        ),
      )
  }

  // Kabel (Kabelanzahlen werden zuletzt gezeichnet, damit sie über den Knoten liegen)
  const cableLabels: string[] = []
  const cableStart = parts.length
  const showCables = !lighting || view.sound.cables
  if (!showCables) {
    // Lichtplot ohne Kabel
  } else if ((project.cableView ?? 'bundled') === 'bundled') {
    for (const tree of routeProject(project, assignment)) {
      const { route } = tree
      if (route.total === 0) continue
      const color = tree.color ?? C.muted
      // Kabel ab Geräten (PA-Kette) gestrichelt
      const dash = tree.kind === 'device' ? `${n(5 * k)} ${n(3 * k)}` : undefined
      for (const s of route.stubs)
        parts.push(
          el('line', { x1: P(s.from.x), y1: P(s.from.y), x2: P(s.to.x), y2: P(s.to.y), stroke: color, 'stroke-width': 1.5 * k, 'stroke-dasharray': dash }),
        )
      for (const s of [...route.segments].sort((a, b) => a.count - b.count))
        parts.push(
          el('line', {
            x1: P(s.a.x),
            y1: P(s.a.y),
            x2: P(s.b.x),
            y2: P(s.b.y),
            stroke: color,
            'stroke-width': (1.2 + Math.sqrt(s.count)) * k,
            'stroke-linecap': 'round',
            'stroke-dasharray': dash,
          }),
        )
      const m = (cssPx: number) => (cssPx * k) / PX_PER_M
      const clear =
        tree.kind === 'box'
          ? { left: m(17), right: m(17), top: m(17), bottom: m(17) }
          : { left: m(25), right: m(25), top: m(14), bottom: m(14) }
      for (const { pos, count } of trunkLabels(route, tree.root, { clear, offset: m(9) })) {
        const t = String(count)
        const w = (t.length * 6.5 + 8) * k
        const h = 14 * k
        cableLabels.push(
          el('rect', { x: P(pos.x) - w / 2, y: P(pos.y) - h / 2, width: w, height: h, rx: h / 2, fill: color }) +
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
    // PA-Kette: Geräte an der Box, Lautsprecher/Endstufen an Geräten
    const deviceById = new Map(project.devices.map((d) => [d.id, d]))
    const line = (a: Vec2, b: Vec2, stroke: string, dash: string) =>
      el('line', { x1: P(a.x), y1: P(a.y), x2: P(b.x), y2: P(b.y), stroke, 'stroke-width': 1.5 * k, 'stroke-dasharray': dash })
    for (const d of project.devices) {
      const inputs = assignment.deviceInputs[d.id] ?? []
      for (const boxId of new Set(inputs.map((a) => a.boxId).filter((b): b is string => !!b))) {
        const box = boxById.get(boxId)!
        parts.push(line(d.pos, box.pos, box.color, `${n(2 * k)} ${n(3 * k)}`))
      }
    }
    const fed = [
      ...project.outputs.map((o) => ({ pos: o.pos, source: assignment.outputElements[o.id]?.source })),
      ...project.devices.flatMap((d) => (assignment.deviceInputs[d.id] ?? []).map((a) => ({ pos: d.pos, source: a.source }))),
    ]
    for (const { pos, source } of fed) {
      const from = source ? deviceById.get(source.deviceId) : undefined
      if (from) parts.push(line(pos, from.pos, deviceColor(project, assignment, from.id) ?? C.muted, `${n(5 * k)} ${n(3 * k)}`))
    }
  }

  if (lighting) {
    // Kabel nur als blasse Andeutung, ohne Zahlen
    const cables = parts.splice(cableStart)
    if (cables.length) parts.push(el('g', { opacity: 0.18 }, cables.join('')))
    cableLabels.length = 0
    parts.push(...ghostSound(project, view, k), ...lightsSvg(project, k))
    const body = parts.join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(vb.x)} ${n(vb.y)} ${n(vb.w)} ${n(vb.h)}" width="${n(vb.w)}" height="${n(vb.h)}">${body}</svg>`
  }

  // Geräte (Weiche, Endstufe)
  for (const d of project.devices) {
    const w = DEVICE_SHAPE.w * k
    const h = DEVICE_SHAPE.h * k
    const color = deviceColor(project, assignment, d.id) ?? C.muted
    const io = d.kind === 'amp' ? `×${d.inputs.length}` : `${d.inputs.length}>${d.outputs.length}` // WinAnsi-Schrift kennt keinen Pfeil
    parts.push(
      el(
        'g',
        { transform: `translate(${n(P(d.pos.x))} ${n(P(d.pos.y))})` },
        el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: DEVICE_SHAPE.rx * k, fill: '#eef0f3', stroke: color, 'stroke-width': 2.5 * k }) +
          text(0, 0, 9.5 * k, `${DEVICE_ABBR[d.kind]} ${io}`, { fill: C.text, 'font-weight': 'bold' }) +
          haloText(0, h / 2 + 9 * k, 9.5 * k, d.name, C.muted, k),
      ),
    )
  }

  // Outputs
  for (const o of project.outputs) {
    const a = assignment.outputElements[o.id]
    const box = a?.boxId ? boxById.get(a.boxId) : undefined
    const chain = a?.source ? (deviceColor(project, assignment, a.source.deviceId) ?? C.muted) : null
    const ok = !!box || !!chain
    const stroke = box?.color ?? chain ?? C.danger
    const common: Attrs = {
      fill: '#ffffff',
      stroke,
      'stroke-width': 2.5 * k,
      'stroke-dasharray': ok ? undefined : `${n(4 * k)} ${n(3 * k)}`,
    }
    const spec = OUTPUT_SHAPES[o.kind]
    const w = spec.w * k
    const h = spec.h * k
    const shape =
      spec.shape === 'trapezoid'
        ? el('path', { d: `M ${n(-w / 2)} ${n(h / 2)} L ${n(w / 2)} ${n(h / 2)} L ${n(w / 3)} ${n(-h / 2)} L ${n(-w / 3)} ${n(-h / 2)} Z`, ...common })
        : el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: spec.rx * k, ...common })
    const abbr = spec.abbr
    const arrow = frontArrowPoints(spec, k)
    const rotated = el(
      'g',
      { transform: `rotate(${o.rotation ?? 0})` },
      shape + (arrow ? el('polygon', { points: arrow, fill: stroke }) : ''),
    )
    parts.push(
      el(
        'g',
        { transform: `translate(${n(P(o.pos.x))} ${n(P(o.pos.y))})` },
        rotated +
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
          ? el(
              'g',
              { transform: `rotate(${g.rotation ?? 0})` },
              el('rect', { x: -halfW, y: -halfH, width: 2 * halfW, height: 2 * halfH, rx: AMP_SHAPE.rx * k, ...body }) +
                el('polygon', { points: frontArrowPoints(AMP_SHAPE, k)!, fill: String(body.stroke) }),
            )
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

/** Ton-Elemente klein und grau für den Lichtplot (wie components/stage/ghost.tsx). */
function ghostSound(project: Project, view: ReturnType<typeof viewSettings>, k: number): string[] {
  const P = (m: number) => m * PX_PER_M
  const g = 0.62
  const body: Attrs = { fill: C.ghostFill, stroke: C.ghost, 'stroke-width': 0.8 * k }
  const label = (y: number, t: string) => text(0, y, 8 * k, t, { fill: C.ghost, 'font-weight': 'bold' })
  const at = (pos: Vec2, inner: string) => el('g', { transform: `translate(${n(P(pos.x))} ${n(P(pos.y))})` }, inner)
  const out: string[] = []
  if (view.sound.boxes)
    for (const d of project.devices) {
      const w = DEVICE_SHAPE.w * k * g
      const h = DEVICE_SHAPE.h * k * g
      out.push(at(d.pos, el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 2 * k, ...body }) + label(h / 2 + 8 * k, d.name)))
    }
  for (const o of project.outputs) {
    if (!(OFFSTAGE_OUTPUTS.includes(o.kind) ? view.sound.pa : view.sound.monitors)) continue
    const spec = OUTPUT_SHAPES[o.kind]
    const kk = k * g
    const w = spec.w * kk
    const h = spec.h * kk
    const shape =
      spec.shape === 'trapezoid'
        ? el('path', { d: `M ${n(-w / 2)} ${n(h / 2)} L ${n(w / 2)} ${n(h / 2)} L ${n(w / 3)} ${n(-h / 2)} L ${n(-w / 3)} ${n(-h / 2)} Z`, ...body })
        : el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: spec.rx * kk, ...body })
    const arrow = frontArrowPoints(spec, kk)
    out.push(
      at(
        o.pos,
        el('g', { transform: `rotate(${o.rotation ?? 0})` }, shape + (arrow ? el('polygon', { points: arrow, fill: C.ghost }) : '')) +
          label(h / 2 + 8 * k, o.name),
      ),
    )
  }
  if (view.sound.instruments)
    for (const gr of project.groups) {
      const amp = gr.form === 'amp'
      const r = 17 * k * g
      const shape = amp
        ? el(
            'g',
            { transform: `rotate(${gr.rotation ?? 0})` },
            el('rect', { x: (-AMP_SHAPE.w / 2) * k * g, y: (-AMP_SHAPE.h / 2) * k * g, width: AMP_SHAPE.w * k * g, height: AMP_SHAPE.h * k * g, rx: 2 * k, ...body }),
          )
        : el('circle', { r, ...body })
      out.push(at(gr.pos, shape + label((amp ? (AMP_SHAPE.h / 2) * k * g : r) + 8 * k, gr.name)))
    }
  if (view.sound.boxes)
    for (const b of project.boxes) {
      const s = 30 * k * g
      out.push(at(b.pos, el('rect', { x: -s / 2, y: -s / 2, width: s, height: s, rx: 3 * k, ...body }) + text(0, 0, 9 * k, b.name, { fill: C.ghost, 'font-weight': 'bold' })))
    }
  return out
}

/** Traversen, Lichtkegel und Lampen mit Nummer und Adresse (wie components/stage/lightNodes.tsx). */
function lightsSvg(project: Project, k: number): string[] {
  const P = (m: number) => m * PX_PER_M
  const problems = new Set(dmxIssues(project.fixtures).filter((i) => i.level === 'error').flatMap((i) => i.fixtureIds))
  const out: string[] = project.trusses.map((t) => trussSvg(t, k, false))
  const s = FIXTURE_SIZE * k
  for (const f of project.fixtures) {
    const beam = FIXTURE_TYPES[f.kind].beam
    if (beam <= 0) continue
    const start = s * 0.5
    out.push(
      el('polygon', {
        transform: `translate(${n(P(f.pos.x))} ${n(P(f.pos.y))}) rotate(${f.rotation ?? 0})`,
        points: beamPolygon(beam, Math.max(1.6 * PX_PER_M, start + 24 * k), start),
        fill: C.beam,
        'fill-opacity': 0.22,
      }),
    )
  }
  for (const f of project.fixtures) {
    const type = FIXTURE_TYPES[f.kind]
    const problem = problems.has(f.id)
    const rot = f.rotation ?? 0
    const lbl = labelPlacement(rot, s, k)
    const address = f.address === undefined ? '-' : formatAddress(f.universe, f.address)
    const anchor = lbl.anchor
    const front =
      type.beam > 0 ? el('polygon', { points: `${n(-3.5 * k)},${n(s * 0.62)} ${n(3.5 * k)},${n(s * 0.62)} 0,${n(s * 0.62 + 5 * k)}`, fill: C.beam }) : ''
    const lens = type.shape === 'square' ? el('circle', { cy: (s / 2) * 0.62, r: (s / 2) * 0.22, fill: C.beam }) : ''
    out.push(
      el(
        'g',
        { transform: `translate(${n(P(f.pos.x))} ${n(P(f.pos.y))})` },
        el(
          'g',
          { transform: `rotate(${rot})` },
          fixtureShape(f.kind, s, {
            fill: '#ffffff',
            stroke: problem ? C.danger : C.text,
            'stroke-width': 1.3 * k,
            'stroke-dasharray': problem ? `${n(3 * k)} ${n(2 * k)}` : undefined,
          }) +
            lens +
            front,
        ) +
          text(0, 0, (type.abbr.length > 2 ? 6 : 7) * k, type.abbr, { fill: C.text, 'font-weight': 'bold' }) +
          text(lbl.x, lbl.y, 9.5 * k, `#${f.number}`, { fill: C.text, 'font-weight': 'bold', 'text-anchor': anchor }) +
          text(lbl.x, lbl.y + 10 * k, 8.5 * k, address, {
            fill: problem ? C.danger : f.address === undefined ? C.warning : C.muted,
            'font-weight': 'bold',
            'text-anchor': anchor,
          }),
      ),
    )
  }
  return out
}
