/** Ausschnitt des Bühnenplans (Zoom/Pan) in SVG-Einheiten. Rein, ohne DOM. */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface View {
  zoom: number
  /** Mittelpunkt des Ausschnitts in SVG-Einheiten. */
  cx: number
  cy: number
}

export const ZOOM_LIMITS = { min: 1, max: 5 }

export function fitView(base: Box): View {
  return { zoom: 1, cx: base.x + base.w / 2, cy: base.y + base.h / 2 }
}

/** Hält Zoom in den Grenzen und den Ausschnitt innerhalb des Grundrahmens. */
export function clampView(base: Box, view: View): View {
  const zoom = Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, view.zoom))
  const w = base.w / zoom
  const h = base.h / zoom
  const cx = Math.min(base.x + base.w - w / 2, Math.max(base.x + w / 2, view.cx))
  const cy = Math.min(base.y + base.h - h / 2, Math.max(base.y + h / 2, view.cy))
  return { zoom, cx, cy }
}

export function viewBoxFor(base: Box, view: View): Box {
  const v = clampView(base, view)
  const w = base.w / v.zoom
  const h = base.h / v.zoom
  return { x: v.cx - w / 2, y: v.cy - h / 2, w, h }
}

/** Zoomt um `factor`, wobei der Punkt `at` (SVG-Einheiten) an derselben Bildschirmstelle bleibt. */
export function zoomAt(base: Box, view: View, factor: number, at: { x: number; y: number }): View {
  const current = clampView(base, view)
  const zoom = Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, current.zoom * factor))
  const ratio = current.zoom / zoom
  return clampView(base, {
    zoom,
    cx: at.x + (current.cx - at.x) * ratio,
    cy: at.y + (current.cy - at.y) * ratio,
  })
}

/** Verschiebt den Ausschnitt um (dx, dy) SVG-Einheiten. */
export function panBy(base: Box, view: View, dx: number, dy: number): View {
  const current = clampView(base, view)
  return clampView(base, { ...current, cx: current.cx + dx, cy: current.cy + dy })
}
