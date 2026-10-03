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
}

export const OUTPUT_SHAPES: Record<OutputKind, ShapeSpec> = {
  // Wedge: Trapez, schmale Seite zeigt zum Musiker (nach hinten)
  wedge: { shape: 'trapezoid', w: 30, h: 15, rx: 0, abbr: 'W' },
  iem: { shape: 'rect', w: 30, h: 16, rx: 8, abbr: 'IEM' },
  sidefill: { shape: 'rect', w: 18, h: 28, rx: 3, abbr: 'SF' },
  pa: { shape: 'rect', w: 22, h: 32, rx: 2, abbr: 'PA' },
  sub: { shape: 'rect', w: 34, h: 18, rx: 2, abbr: 'SUB' },
}

/** Verstärker (Amp): Kasten wie ein Gitarren-/Bass-Cabinet. */
export const AMP_SHAPE = { w: 40, h: 26, rx: 4, abbr: 'AMP' }

/** Output-Arten, die neben bzw. vor der Bühne stehen dürfen (wie Stageboxen bis 1 m). */
export const OFFSTAGE_OUTPUTS: OutputKind[] = ['pa', 'sub']
