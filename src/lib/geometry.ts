import type { StageSize, Vec2 } from '../model/types'

/** Abstandsfunktion in Metern. Austauschbar, z. B. später gegen Kabelweg. */
export type DistanceFn = (a: Vec2, b: Vec2) => number

/** Luftlinie. */
export const euclidean: DistanceFn = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

export function clamp(value: number, min: number, max: number): number {
  const result = Math.min(max, Math.max(min, value))
  return result === 0 ? 0 : result // -0 vermeiden
}

/** Begrenzt eine Position auf die Bühne, optional mit Rand außerhalb (in Metern). */
export function clampToStage(pos: Vec2, stage: StageSize, margin = 0): Vec2 {
  return {
    x: clamp(pos.x, -margin, stage.width + margin),
    y: clamp(pos.y, -margin, stage.depth + margin),
  }
}

export function snap(value: number, step: number): number {
  return Math.round(value / step) * step
}

/** Rundet auf eine Nachkommastelle, für Anzeige von Metern. */
export function roundMeters(value: number): number {
  return Math.round(value * 10) / 10
}
