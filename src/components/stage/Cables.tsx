import { trunkLabels, type CableRoute } from '../../lib/cables'
import { PX_PER_M } from '../../model/defaults'
import type { Stagebox } from '../../model/types'

const px = (m: number) => m * PX_PER_M

/** Strichstärke in CSS-px nach Kabelanzahl. */
function width(count: number): number {
  return 1.2 + Math.sqrt(count)
}

interface Props {
  boxes: Stagebox[]
  routes: Record<string, CableRoute>
  /** SVG-Einheiten pro CSS-Pixel. */
  k: number
}

/** Gebündelte, rechtwinklige Kabelwege je Stagebox (siehe lib/cables.ts). Liegt unter den Knoten. */
export function CableLines({ boxes, routes, k }: Props) {
  return (
    <g className="cables">
      {boxes.map((box) => {
        const route = routes[box.id]
        if (!route || route.total === 0) return null
        const segments = [...route.segments].sort((a, b) => a.count - b.count)
        return (
          <g key={box.id} stroke={box.color}>
            {route.stubs.map((s, i) => (
              <line key={`s${i}`} x1={px(s.from.x)} y1={px(s.from.y)} x2={px(s.to.x)} y2={px(s.to.y)} strokeWidth={1.5 * k} />
            ))}
            {segments.map((s, i) => (
              <line key={i} x1={px(s.a.x)} y1={px(s.a.y)} x2={px(s.b.x)} y2={px(s.b.y)} strokeWidth={width(s.count) * k} />
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** Kabelanzahl direkt am Abgang jeder Box; liegt über den Knoten. */
export function CableLabels({ boxes, routes, k }: Props) {
  // Box-Quadrat (30 CSS-px, siehe BoxNode) plus Rand, umgerechnet in Meter.
  const m = (cssPx: number) => (cssPx * k) / PX_PER_M
  const clear = { left: m(17), right: m(17), top: m(17), bottom: m(17) }

  return (
    <g className="cable-counts">
      {boxes.map((box) => {
        const route = routes[box.id]
        if (!route) return null
        return trunkLabels(route, box.pos, { clear, offset: m(9) }).map(({ pos, count }, i) => {
          const text = String(count)
          const w = (text.length * 6.5 + 8) * k
          const h = 14 * k
          return (
            <g key={`${box.id}-${i}`} className="cable-count" transform={`translate(${px(pos.x)} ${px(pos.y)})`}>
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={box.color} />
              <text style={{ fontSize: 10 * k }} textAnchor="middle" dominantBaseline="central">
                {text}
              </text>
            </g>
          )
        })
      })}
    </g>
  )
}
