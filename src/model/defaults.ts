import { newId } from '../lib/id'
import type { InstrumentType, Project, Stagebox, StageSize, Vec2 } from './types'

/** Maßstab: 1 m entspricht 30 SVG-Einheiten. */
export const PX_PER_M = 30

export const DEFAULT_STAGE: StageSize = { width: 10, depth: 6 }
export const STAGE_LIMITS = { min: 2, max: 40, step: 0.5 }

export const DEFAULT_BOX_INPUTS = 16
export const DEFAULT_BOX_OUTPUTS = 8

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
export function spawnPosition(project: Pick<Project, 'stage' | 'boxes' | 'groups' | 'outputs'>): Vec2 {
  const { width, depth } = project.stage
  const center = { x: width / 2, y: depth / 2 }
  const step = 1.5
  const cells: Vec2[] = []
  for (let y = center.y - Math.floor(center.y / step) * step; y <= depth; y += step)
    for (let x = center.x - Math.floor(center.x / step) * step; x <= width; x += step)
      cells.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
  cells.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))
  const taken = [...project.boxes, ...project.groups, ...project.outputs].map((e) => e.pos)
  return cells.find((c) => taken.every((t) => Math.hypot(t.x - c.x, t.y - c.y) >= 1.2)) ?? center
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
