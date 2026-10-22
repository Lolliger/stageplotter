import { clamp } from '../lib/geometry'
import { newId } from '../lib/id'
import { uniqueName } from './defaults'
import { normalizeRotation } from './shapes'
import type { Fixture, FixtureKind, Project, StageSize, Truss, Vec2, ViewSettings } from './types'

/** Ein DMX-Modus eines Lampentyps. */
export interface FixtureMode {
  name: string
  channels: number
}

export interface FixtureType {
  label: string
  /** Kürzel im Plan */
  abbr: string
  /** Symbol im Plan */
  shape: 'circle' | 'square' | 'rect' | 'hex' | 'diamond'
  /** Lichtkegel: Öffnungswinkel in Grad (0 = keiner, z. B. Nebel) */
  beam: number
  modes: FixtureMode[]
}

/** Lampenbibliothek. Die Modi sind typische Werte; Kanalzahl ist je Lampe frei änderbar. */
export const FIXTURE_TYPES: Record<FixtureKind, FixtureType> = {
  par: {
    label: 'LED-PAR',
    abbr: 'PAR',
    shape: 'circle',
    beam: 40,
    modes: [
      { name: '3 Kanal (RGB)', channels: 3 },
      { name: '4 Kanal (RGBW)', channels: 4 },
      { name: '7 Kanal', channels: 7 },
      { name: '8 Kanal', channels: 8 },
    ],
  },
  spot: {
    label: 'Moving Head Spot',
    abbr: 'MH',
    shape: 'square',
    beam: 20,
    modes: [
      { name: '14 Kanal', channels: 14 },
      { name: '18 Kanal', channels: 18 },
      { name: '24 Kanal', channels: 24 },
    ],
  },
  wash: {
    label: 'Moving Head Wash',
    abbr: 'WA',
    shape: 'square',
    beam: 45,
    modes: [
      { name: '13 Kanal', channels: 13 },
      { name: '16 Kanal', channels: 16 },
      { name: '22 Kanal', channels: 22 },
    ],
  },
  beam: {
    label: 'Moving Head Beam',
    abbr: 'BM',
    shape: 'square',
    beam: 8,
    modes: [
      { name: '16 Kanal', channels: 16 },
      { name: '20 Kanal', channels: 20 },
    ],
  },
  profile: {
    label: 'Profilscheinwerfer',
    abbr: 'PR',
    shape: 'rect',
    beam: 26,
    modes: [
      { name: '1 Kanal (Dimmer)', channels: 1 },
      { name: '4 Kanal', channels: 4 },
      { name: '8 Kanal', channels: 8 },
    ],
  },
  fresnel: {
    label: 'Weißlicht / Halogen',
    abbr: 'WL',
    shape: 'circle',
    beam: 50,
    modes: [
      { name: '1 Kanal (Dimmer)', channels: 1 },
      { name: '2 Kanal', channels: 2 },
    ],
  },
  blinder: {
    label: 'Blinder',
    abbr: 'BL',
    shape: 'rect',
    beam: 70,
    modes: [
      { name: '1 Kanal', channels: 1 },
      { name: '2 Kanal (2 × Dimmer)', channels: 2 },
      { name: '4 Kanal', channels: 4 },
    ],
  },
  strobe: {
    label: 'Strobe',
    abbr: 'ST',
    shape: 'rect',
    beam: 90,
    modes: [
      { name: '2 Kanal', channels: 2 },
      { name: '4 Kanal', channels: 4 },
    ],
  },
  bar: {
    label: 'LED-Bar',
    abbr: 'BAR',
    shape: 'rect',
    beam: 60,
    modes: [
      { name: '4 Kanal', channels: 4 },
      { name: '8 Kanal', channels: 8 },
      { name: '24 Kanal (Pixel)', channels: 24 },
    ],
  },
  follow: {
    label: 'Verfolger',
    abbr: 'VF',
    shape: 'rect',
    beam: 12,
    modes: [
      { name: 'Ohne DMX', channels: 0 },
      { name: '2 Kanal', channels: 2 },
    ],
  },
  fog: {
    label: 'Nebel / Hazer',
    abbr: 'FOG',
    shape: 'hex',
    beam: 0,
    modes: [
      { name: '1 Kanal', channels: 1 },
      { name: '2 Kanal', channels: 2 },
    ],
  },
  custom: {
    label: 'Eigener Typ',
    abbr: 'FX',
    shape: 'diamond',
    beam: 30,
    modes: [{ name: 'Frei', channels: 1 }],
  },
}

export const FIXTURE_ORDER: FixtureKind[] = [
  'par',
  'wash',
  'spot',
  'beam',
  'bar',
  'profile',
  'fresnel',
  'blinder',
  'strobe',
  'follow',
  'fog',
  'custom',
]

/** Symbolgröße in Design-Pixeln (wird wie die übrigen Knoten mit k skaliert). */
export const FIXTURE_SIZE = 22

/** Lampen und Traversen dürfen bis zu so weit (m) neben, vor und hinter der Bühne stehen. */
export const LIGHT_AREA_MARGIN = 8
/** Lichtmodus: Mindestrand um die Bühne im Plan (m), damit FOH und Türme Platz haben. */
export const LIGHT_VIEW_PAD = 3

export const FIXTURE_CHANNEL_LIMITS = { min: 0, max: 512 }
export const UNIVERSE_LIMITS = { min: 1, max: 64 }
export const TRUSS_LIMITS = { min: 0.5, max: 30, step: 0.5 }
/** Breite einer Traverse im Plan (m). */
export const TRUSS_WIDTH = 0.3
/** Lampen rasten an einer Traverse ein, wenn sie näher als das liegen (m). */
export const TRUSS_SNAP = 0.4

export const DEFAULT_VIEW: ViewSettings = {
  sound: { instruments: true, pa: true, monitors: false, boxes: false, cables: false },
  lights: false,
}

export function viewSettings(project: Pick<Project, 'view'>): ViewSettings {
  return project.view ?? DEFAULT_VIEW
}

/** Position im erlaubten Bereich für Lampen und Traversen. */
export function clampToLightArea(pos: Vec2, stage: StageSize): Vec2 {
  return {
    x: clamp(pos.x, -LIGHT_AREA_MARGIN, stage.width + LIGHT_AREA_MARGIN),
    y: clamp(pos.y, -LIGHT_AREA_MARGIN, stage.depth + LIGHT_AREA_MARGIN),
  }
}

// ---------- Traversen-Geometrie ----------

/** Einheitsvektor entlang der Traverse (0° = quer, also entlang x). */
export function trussAxis(truss: Pick<Truss, 'rotation'>): Vec2 {
  const rad = ((truss.rotation ?? 0) * Math.PI) / 180
  return { x: Math.cos(rad), y: Math.sin(rad) }
}

export function trussEnds(truss: Truss): [Vec2, Vec2] {
  const a = trussAxis(truss)
  const h = truss.length / 2
  return [
    { x: truss.pos.x - a.x * h, y: truss.pos.y - a.y * h },
    { x: truss.pos.x + a.x * h, y: truss.pos.y + a.y * h },
  ]
}

/** Position entlang der Traverse (m ab Mitte, negativ = Anfang) und Abstand quer dazu. */
export function trussOffset(truss: Truss, pos: Vec2): { along: number; across: number } {
  const a = trussAxis(truss)
  const dx = pos.x - truss.pos.x
  const dy = pos.y - truss.pos.y
  return { along: dx * a.x + dy * a.y, across: -dx * a.y + dy * a.x }
}

/** Punkt auf der Traverse bei `along` m ab Mitte (auf die Länge begrenzt). */
export function pointOnTruss(truss: Truss, along: number): Vec2 {
  const a = trussAxis(truss)
  const t = clamp(along, -truss.length / 2, truss.length / 2)
  return { x: round(truss.pos.x + a.x * t), y: round(truss.pos.y + a.y * t) }
}

/** Nächste Traverse in Reichweite, Lampe darauf eingerastet; sonst null. */
export function snapToTruss(pos: Vec2, trusses: Truss[], range = TRUSS_SNAP): { pos: Vec2; trussId: string } | null {
  let best: { pos: Vec2; trussId: string; dist: number } | null = null
  for (const t of trusses) {
    const { along } = trussOffset(t, pos)
    const p = pointOnTruss(t, along)
    const dist = Math.hypot(p.x - pos.x, p.y - pos.y)
    if (dist <= range && (!best || dist < best.dist)) best = { pos: p, trussId: t.id, dist }
  }
  return best && { pos: best.pos, trussId: best.trussId }
}

/** `count` Plätze gleichmäßig verteilt auf der Traverse (mit halbem Abstand zu den Enden). */
export function spreadOnTruss(truss: Truss, count: number): Vec2[] {
  const step = truss.length / count
  return Array.from({ length: count }, (_, i) => pointOnTruss(truss, -truss.length / 2 + step * (i + 0.5)))
}

/**
 * Traverse von `before` nach `after` geändert (verschoben, gedreht, kürzer): Lampen daran
 * bewegen sich mit – gleiche Lage entlang der Traverse, Drehung um denselben Winkel.
 */
export function carryFixtures(fixtures: Fixture[], before: Truss, after: Truss): Fixture[] {
  const turn = (after.rotation ?? 0) - (before.rotation ?? 0)
  return fixtures.map((f) => {
    if (f.trussId !== before.id) return f
    const { along } = trussOffset(before, f.pos)
    const moved: Fixture = { ...f, pos: pointOnTruss(after, along) }
    if (turn !== 0) moved.rotation = normalizeRotation((f.rotation ?? 0) + turn)
    return moved
  })
}

// ---------- Anlegen ----------

/** Leuchtrichtung für eine neue Lampe: vor der Bühne zur Bühne hin, sonst zum Publikum. */
export function defaultFixtureRotation(pos: Vec2, stage: StageSize): number {
  if (pos.y > stage.depth) return 180
  if (pos.x < 0) return 270
  if (pos.x > stage.width) return 90
  return 0
}

export function nextFixtureNumber(fixtures: Fixture[]): number {
  return fixtures.reduce((n, f) => Math.max(n, f.number), 0) + 1
}

type LightProject = Pick<Project, 'stage' | 'fixtures' | 'trusses'>

/**
 * Neue Lampen: auf eine Traverse verteilt, sonst nebeneinander über der Bühnenmitte.
 * Nummern fortlaufend, ohne Adresse (die vergibt man einzeln oder per Auto-Adressierung).
 */
export function createFixtures(project: LightProject, kind: FixtureKind, count: number, trussId?: string): Fixture[] {
  const type = FIXTURE_TYPES[kind]
  const truss = trussId ? project.trusses.find((t) => t.id === trussId) : undefined
  const n = Math.max(1, Math.min(48, Math.round(count)))
  const first = nextFixtureNumber(project.fixtures)
  const { width, depth } = project.stage
  const positions = truss
    ? spreadOnTruss(truss, n)
    : Array.from({ length: n }, (_, i) => ({ x: round(width / 2 + (i - (n - 1) / 2) * 0.8), y: round(depth / 2) }))
  return positions.map((pos, i) => ({
    id: newId(),
    kind,
    number: first + i,
    name: type.label,
    pos,
    rotation: defaultFixtureRotation(pos, project.stage),
    channels: type.modes[0].channels,
    mode: type.modes[0].name,
    universe: 1,
    ...(truss ? { trussId: truss.id } : {}),
  }))
}

/** Neue Traverse: erst hinten über der Bühne, dann Mitte, dann FOH vor der Bühne. */
export function createTruss(project: LightProject): Truss {
  const { width, depth } = project.stage
  const candidates = [0.5, depth + 2, depth / 2, -1, depth + 4]
  const free = candidates.find((y) => project.trusses.every((t) => Math.abs(t.pos.y - y) > 0.8)) ?? depth / 2
  return {
    id: newId(),
    name: uniqueName('Traverse', project.trusses.map((t) => t.name)),
    pos: { x: round(width / 2), y: round(free) },
    length: Math.max(TRUSS_LIMITS.min, Math.round(Math.min(width, 12) * 2) / 2),
    rotation: 0,
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}

/** Ausdehnung aller Lampen und Traversen in Metern (für den Plan-Ausschnitt); null ohne Licht. */
export function lightExtent(project: Pick<Project, 'fixtures' | 'trusses'>): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts: Vec2[] = [...project.fixtures.map((f) => f.pos), ...project.trusses.flatMap((t) => trussEnds(t))]
  if (pts.length === 0) return null
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  }
}

/** Lichtkegel in Form-Koordinaten (Lampe bei 0,0, leuchtet bei Drehung 0 nach unten = +y). */
export function beamPolygon(beamDeg: number, length: number, start: number): string {
  const half = (Math.max(beamDeg, 12) / 2) * (Math.PI / 180)
  const spread = Math.tan(half)
  const r0 = start * spread * 0.6
  const r1 = length * spread
  const f = (v: number) => Math.round(v * 100) / 100
  return `${f(-r0)},${f(start)} ${f(r0)},${f(start)} ${f(r1)},${f(length)} ${f(-r1)},${f(length)}`
}

/** Platz für die zweizeilige Beschriftung (Nummer, Adresse) auf der Rückseite der Lampe. */
export function labelPlacement(rotation: number, s: number, k: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  // Leuchtrichtung bei 0° = unten; im Uhrzeigersinn gedreht: 90° = links, 180° = oben, 270° = rechts
  const quarter = Math.round((((rotation % 360) + 360) % 360) / 90) % 4
  const edge = s * 0.62
  switch (quarter) {
    case 0:
      return { x: 0, y: -edge - 14 * k, anchor: 'middle' } // Rückseite oben
    case 2:
      return { x: 0, y: edge + 10 * k, anchor: 'middle' } // Rückseite unten
    case 1:
      return { x: edge + 4 * k, y: -3 * k, anchor: 'start' } // Rückseite rechts
    default:
      return { x: -edge - 4 * k, y: -3 * k, anchor: 'end' } // Rückseite links
  }
}
