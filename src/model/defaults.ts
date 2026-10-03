import { newId } from '../lib/id'
import type { InstrumentType, OutputElement, OutputKind, Project, Stagebox, StageSize, Vec2 } from './types'

/** Maßstab: 1 m entspricht 30 SVG-Einheiten. */
export const PX_PER_M = 30

export const DEFAULT_STAGE: StageSize = { width: 10, depth: 6 }
export const STAGE_LIMITS = { min: 2, max: 40, step: 0.5 }

export const DEFAULT_BOX_INPUTS = 16
export const DEFAULT_BOX_OUTPUTS = 8

/** Rastermaß beim Einrasten, in Metern. */
export const SNAP_STEP = 0.25

/** Stageboxen dürfen so weit (in Metern) außerhalb der Bühne stehen. */
export const BOX_STAGE_MARGIN = 1

/** Auf hellem und dunklem Hintergrund gut erkennbar; Rot ist für Warnungen reserviert. */
export const BOX_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
]

/** Übliche Reihenfolge einer Inputliste. */
export const TYPE_ORDER: InstrumentType[] = [
  'drums',
  'percussion',
  'bass',
  'guitar',
  'keys',
  'vocals',
  'other',
]

export const OUTPUT_LABELS: Record<OutputKind, string> = {
  wedge: 'Wedge',
  iem: 'IEM',
  sidefill: 'Sidefill',
  pa: 'PA',
  sub: 'Sub',
}

export const TYPE_LABELS: Record<InstrumentType, string> = {
  drums: 'Drums',
  percussion: 'Percussion',
  bass: 'Bass',
  guitar: 'Gitarre',
  keys: 'Keys',
  vocals: 'Vocals',
  other: 'Sonstiges',
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Nächster freier Buchstabe (A, B, …), danach A2, B2, … */
export function nextBoxName(existing: Stagebox[]): string {
  const used = new Set(existing.map((b) => b.name))
  for (let round = 1; ; round++) {
    for (const letter of LETTERS) {
      const name = round === 1 ? letter : `${letter}${round}`
      if (!used.has(name)) return name
    }
  }
}

export function nextBoxColor(existing: Stagebox[]): string {
  const used = new Set(existing.map((b) => b.color))
  return BOX_COLORS.find((c) => !used.has(c)) ?? BOX_COLORS[existing.length % BOX_COLORS.length]
}

/** Freier Platz für eine neue Box: hinten Mitte, Seiten, vorne – mind. 2 m Abstand zu anderen Boxen. */
export function freeBoxPosition(project: Pick<Project, 'boxes' | 'stage'>): Vec2 {
  const { width: w, depth: d } = project.stage
  const candidates: Vec2[] = [
    { x: w / 2, y: 0.75 },
    { x: 0.75, y: d / 2 },
    { x: w - 0.75, y: d / 2 },
    { x: w / 2, y: d - 0.75 },
    { x: 1.5, y: d - 0.75 },
    { x: w - 1.5, y: d - 0.75 },
    { x: w / 4, y: 0.75 },
    { x: (3 * w) / 4, y: 0.75 },
  ]
  const free = candidates.find((c) => project.boxes.every((b) => Math.hypot(b.pos.x - c.x, b.pos.y - c.y) >= 2))
  return free ?? candidates[0]
}

export function createStagebox(project: Pick<Project, 'boxes' | 'stage'>, pos?: Vec2): Stagebox {
  return {
    id: newId(),
    name: nextBoxName(project.boxes),
    pos: pos ?? freeBoxPosition(project),
    inputs: DEFAULT_BOX_INPUTS,
    outputs: DEFAULT_BOX_OUTPUTS,
    color: nextBoxColor(project.boxes),
  }
}

/** Fügt " 2", " 3", … an, falls der Name schon vergeben ist. */
export function uniqueName(base: string, existing: string[]): string {
  const used = new Set(existing)
  if (!used.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`
    if (!used.has(candidate)) return candidate
  }
}

/**
 * Position für neue Elemente: Rasterpunkte (1,5 m) nach Abstand zur Bühnenmitte, der erste,
 * der mindestens 1,2 m von allen vorhandenen Elementen entfernt ist.
 */
export function spawnPosition(
  project: Pick<Project, 'stage' | 'boxes' | 'groups' | 'outputs'>,
  /** Bevorzugter Ort, Standard: Bühnenmitte. */
  prefer?: Vec2,
): Vec2 {
  const { width, depth } = project.stage
  const center = { x: width / 2, y: depth / 2 }
  const target = prefer ?? center
  const step = 1.5
  // Raster um den bevorzugten Ort, damit dieser selbst ein Kandidat ist.
  const cells: Vec2[] = []
  for (let y = target.y - Math.floor(target.y / step) * step; y <= depth + 1e-9; y += step)
    for (let x = target.x - Math.floor(target.x / step) * step; x <= width + 1e-9; x += step)
      cells.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
  cells.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
  const taken = [...project.boxes, ...project.groups, ...project.outputs].map((e) => e.pos)
  return cells.find((c) => taken.every((t) => Math.hypot(t.x - c.x, t.y - c.y) >= 1.2)) ?? target
}

/** "Wedge 1", "Wedge 2", … – nächste freie Nummer. */
export function nextNumberedName(base: string, existing: string[]): string {
  const used = new Set(existing)
  for (let i = 1; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`
}

/** Erster Platz aus `candidates`, der mind. 1,2 m von allen Elementen entfernt ist. */
function firstFree(project: Pick<Project, 'boxes' | 'groups' | 'outputs'>, candidates: Vec2[]): Vec2 {
  const taken = [...project.boxes, ...project.groups, ...project.outputs].map((e) => e.pos)
  return candidates.find((c) => taken.every((t) => Math.hypot(t.x - c.x, t.y - c.y) >= 1.2)) ?? candidates[0]
}

type SpawnProject = Pick<Project, 'stage' | 'boxes' | 'groups' | 'outputs'>

/**
 * Wedges vorne an der Bühnenkante, Sidefills abwechselnd links/rechts, IEMs in der Mitte.
 * Subs vor der Bühnenkante (außerhalb), PA-Lautsprecher siehe createPaPair.
 */
export function createOutput(project: SpawnProject, kind: Exclude<OutputKind, 'pa'>): OutputElement {
  const { width, depth } = project.stage
  const name = nextNumberedName(OUTPUT_LABELS[kind], project.outputs.map((o) => o.name))
  if (kind === 'sub') {
    const front = depth + 0.6
    const xs = [width / 2, width / 2 - 1.5, width / 2 + 1.5, width / 2 - 3, width / 2 + 3]
    return { id: newId(), kind, name, pos: firstFree(project, xs.map((x) => ({ x, y: front }))) }
  }
  const sidefills = project.outputs.filter((o) => o.kind === 'sidefill').length
  const prefer: Record<'wedge' | 'iem' | 'sidefill', Vec2> = {
    wedge: { x: width / 2, y: Math.max(0, depth - 0.75) },
    iem: { x: width / 2, y: depth / 2 },
    sidefill: { x: sidefills % 2 === 0 ? 0.5 : Math.max(0, width - 0.5), y: Math.max(0, depth - 1.5) },
  }
  return { id: newId(), kind, name, pos: spawnPosition(project, prefer[kind]) }
}

/** PA links und rechts neben der Bühnenkante (aus Sicht des Publikums), je ein Output. */
export function createPaPair(project: SpawnProject): [OutputElement, OutputElement] {
  const { width, depth } = project.stage
  const names = project.outputs.map((o) => o.name)
  const ys = [depth - 0.5, depth - 2, depth - 3.5].map((y) => Math.max(0, y))
  const left = firstFree(project, ys.map((y) => ({ x: -0.6, y })))
  const right = firstFree(project, ys.map((y) => ({ x: width + 0.6, y })))
  return [
    { id: newId(), kind: 'pa', name: uniqueName('PA L', names), pos: left },
    { id: newId(), kind: 'pa', name: uniqueName('PA R', names), pos: right },
  ]
}

export function createDefaultProject(): Project {
  const stage = { ...DEFAULT_STAGE }
  const project: Project = {
    version: 1,
    name: 'Neues Projekt',
    stage,
    boxes: [],
    groups: [],
    outputs: [],
  }
  project.boxes.push(createStagebox(project, { x: 1.5, y: 0.75 }))
  project.boxes.push(createStagebox(project, { x: stage.width - 1.5, y: 0.75 }))
  return project
}
