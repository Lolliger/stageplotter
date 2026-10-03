import type { OutputKind } from './types'

/**
 * Formen der Elemente im Plan in Design-Pixeln (werden mit dem Faktor k skaliert). Gemeinsam
 * genutzt vom Bildschirm-Plan (components/stage/nodes.tsx) und vom Druck-SVG (lib/export/plotSvg.ts).
 */
export interface ShapeSpec {
  shape: 'trapezoid' | 'rect'
  w: number
  h: number
  rx: number
  abbr: string
  /** Abstrahlrichtung bei Drehung 0 (nach hinten = 'up', zum Publikum = 'down'); null = ohne. */
  front: 'up' | 'down' | null
}

export const OUTPUT_SHAPES: Record<OutputKind, ShapeSpec> = {
  // Wedge: Trapez, schmale Seite zeigt zum Musiker (nach hinten)
  wedge: { shape: 'trapezoid', w: 30, h: 15, rx: 0, abbr: 'W', front: 'up' },
  iem: { shape: 'rect', w: 30, h: 16, rx: 8, abbr: 'IEM', front: null },
  sidefill: { shape: 'rect', w: 18, h: 28, rx: 3, abbr: 'SF', front: 'up' },
  pa: { shape: 'rect', w: 22, h: 32, rx: 2, abbr: 'PA', front: 'down' },
  sub: { shape: 'rect', w: 34, h: 18, rx: 2, abbr: 'SUB', front: 'down' },
}

/** Backline-Verstärker (Gitarren-/Bass-Amp): Kasten wie ein Cabinet, Front zum Publikum. */
export const AMP_SHAPE: ShapeSpec = { shape: 'rect', w: 40, h: 26, rx: 4, abbr: 'AMP', front: 'down' }

export type Direction = 'up' | 'right' | 'down' | 'left'

const DIRECTION_DEG: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 }

/** Auf 0–359 ganze Grad bringen (im Uhrzeigersinn, wie SVG-rotate). */
export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  const r = Math.round(((deg % 360) + 360) % 360)
  return r === 360 ? 0 : r
}

/** Drehung, bei der eine Form mit Front `front` in Richtung `dir` abstrahlt. */
export function rotationFacing(front: 'up' | 'down', dir: Direction): number {
  return normalizeRotation(DIRECTION_DEG[dir] - DIRECTION_DEG[front])
}

/** Richtung (auf 90° gerundet), in die eine gedrehte Form abstrahlt – für Beschriftungen. */
export function facingDirection(front: 'up' | 'down', rotation: number): Direction {
  const deg = normalizeRotation(DIRECTION_DEG[front] + rotation)
  const dirs: Direction[] = ['up', 'right', 'down', 'left']
  return dirs[Math.round(deg / 90) % 4]
}

/**
 * Pfeil vor der Front in Form-Koordinaten (vor der Drehung), als Polygon-Punkte.
 * Größen in Design-Pixeln, k = SVG-Einheiten pro Design-Pixel.
 */
export function frontArrowPoints(spec: ShapeSpec, k: number): string | null {
  if (!spec.front) return null
  const sign = spec.front === 'up' ? -1 : 1
  const edge = (sign * spec.h * k) / 2
  const base = edge + sign * 2 * k
  const tip = edge + sign * 8 * k
  const half = 5 * k
  return `${-half},${base} ${half},${base} 0,${tip}`
}

/** Output-Arten, die neben bzw. vor der Bühne stehen dürfen (wie Stageboxen bis 1 m). */
export const OFFSTAGE_OUTPUTS: OutputKind[] = ['pa', 'sub']
