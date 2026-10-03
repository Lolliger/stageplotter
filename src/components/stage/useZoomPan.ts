import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { fitView, panBy, viewBoxFor, zoomAt, type Box, type View } from '../../lib/viewport'

const TAP_THRESHOLD = 6
const BUTTON_FACTOR = 1.5

interface Gesture {
  moved: boolean
  start: { x: number; y: number }
  maxPointers: number
}

/**
 * Zoom und Verschieben des Bühnenplans.
 * - Buttons (+ / − / Einpassen), Mausrad bzw. Trackpad-Pinch
 * - Touch: zwei Finger = Pinch-Zoom, ein Finger auf freier Fläche = verschieben (nur gezoomt;
 *   ungezoomt scrollt die Seite normal weiter)
 * - Antippen der freien Fläche ruft `onBackgroundTap` auf
 */
export function useZoomPan(svgRef: RefObject<SVGSVGElement | null>, base: Box, onBackgroundTap: () => void) {
  const { x, y, w, h } = base
  const stableBase = useMemo(() => ({ x, y, w, h }), [x, y, w, h])
  const [view, setView] = useState<View>(() => fitView(stableBase))
  const viewBox = viewBoxFor(stableBase, view)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)

  const toSvg = (clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM()
    return ctm ? new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse()) : null
  }
  /** SVG-Einheiten pro Bildschirmpixel im aktuellen Ausschnitt. */
  const unitsPerPx = () => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 1
    return Math.max(viewBox.w / rect.width, viewBox.h / rect.height)
  }

  // Mausrad: auf breiten Layouts immer, auf dem Handy nur mit Strg/Cmd (sonst scrollt die Seite).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) && window.innerWidth < 900) return
      e.preventDefault()
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      setView((v) => zoomAt(stableBase, v, factor, at))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgRef, stableBase])

  const handlers = {
    onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 1) gesture.current = { moved: false, start: { x: e.clientX, y: e.clientY }, maxPointers: 1 }
      else if (gesture.current) gesture.current.maxPointers = Math.max(gesture.current.maxPointers, pointers.current.size)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
      const last = pointers.current.get(e.pointerId)
      const g = gesture.current
      if (!last || !g) return
      const now = { x: e.clientX, y: e.clientY }
      if (!g.moved && Math.hypot(now.x - g.start.x, now.y - g.start.y) >= TAP_THRESHOLD) g.moved = true

      if (pointers.current.size === 2) {
        const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)![1]
        const before = Math.hypot(last.x - other.x, last.y - other.y)
        const after = Math.hypot(now.x - other.x, now.y - other.y)
        const midBefore = { x: (last.x + other.x) / 2, y: (last.y + other.y) / 2 }
        const midAfter = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 }
        const at = toSvg(midBefore.x, midBefore.y)
        const upp = unitsPerPx()
        if (at && before > 0) {
          setView((v) =>
            panBy(stableBase, zoomAt(stableBase, v, after / before, at), -(midAfter.x - midBefore.x) * upp, -(midAfter.y - midBefore.y) * upp),
          )
        }
        g.moved = true
      } else if (pointers.current.size === 1 && view.zoom > 1 && g.moved) {
        const upp = unitsPerPx()
        setView((v) => panBy(stableBase, v, -(now.x - last.x) * upp, -(now.y - last.y) * upp))
      }
      pointers.current.set(e.pointerId, now)
    },
    onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
      pointers.current.delete(e.pointerId)
      const g = gesture.current
      if (pointers.current.size === 0) {
        if (g && !g.moved && g.maxPointers === 1) onBackgroundTap()
        gesture.current = null
      }
    },
    onPointerCancel(e: ReactPointerEvent<SVGSVGElement>) {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size === 0) gesture.current = null
    },
  }

  const center = { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 }
  return {
    viewBox,
    zoom: view.zoom,
    handlers,
    zoomIn: () => setView((v) => zoomAt(stableBase, v, BUTTON_FACTOR, center)),
    zoomOut: () => setView((v) => zoomAt(stableBase, v, 1 / BUTTON_FACTOR, center)),
    reset: () => setView(fitView(stableBase)),
  }
}
