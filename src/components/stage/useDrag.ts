import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { PX_PER_M } from '../../model/defaults'
import type { ElementRef, Vec2 } from '../../model/types'

/** Ab dieser Bewegung (CSS-px) ist es ein Drag, darunter ein Tap. */
const DRAG_THRESHOLD = 6

interface DragState {
  target: ElementRef
  pointerId: number
  startClient: Vec2
  startSvg: DOMPoint
  startPos: Vec2
  moved: boolean
}

function round(v: number): number {
  return Math.round(v * 20) / 20 // 5 cm
}

/**
 * Drag & Tap für SVG-Elemente per Pointer Events (Maus, Touch, Stift).
 * Positionen in Metern; die Umrechnung läuft über die aktuelle Bildschirm-Matrix des SVG.
 */
export function useDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  onMove: (target: ElementRef, pos: Vec2) => void,
  onTap: (target: ElementRef) => void,
) {
  const drag = useRef<DragState | null>(null)

  function toSvg(clientX: number, clientY: number): DOMPoint | null {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return null
    return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  }

  function bind(target: ElementRef, pos: Vec2) {
    return {
      onPointerDown(e: ReactPointerEvent<SVGGElement>) {
        if (drag.current) return // zweiter Finger ignorieren
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const startSvg = toSvg(e.clientX, e.clientY)
        if (!startSvg) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = {
          target,
          pointerId: e.pointerId,
          startClient: { x: e.clientX, y: e.clientY },
          startSvg,
          startPos: pos,
          moved: false,
        }
      },
      onPointerMove(e: ReactPointerEvent<SVGGElement>) {
        const d = drag.current
        if (!d || d.pointerId !== e.pointerId) return
        if (!d.moved) {
          const dist = Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y)
          if (dist < DRAG_THRESHOLD) return
          d.moved = true
        }
        const p = toSvg(e.clientX, e.clientY)
        if (!p) return
        onMove(d.target, {
          x: round(d.startPos.x + (p.x - d.startSvg.x) / PX_PER_M),
          y: round(d.startPos.y + (p.y - d.startSvg.y) / PX_PER_M),
        })
      },
      onPointerUp(e: ReactPointerEvent<SVGGElement>) {
        const d = drag.current
        if (!d || d.pointerId !== e.pointerId) return
        drag.current = null
        if (!d.moved) onTap(d.target)
      },
      onPointerCancel(e: ReactPointerEvent<SVGGElement>) {
        if (drag.current?.pointerId === e.pointerId) drag.current = null
      },
    }
  }

  return bind
}
