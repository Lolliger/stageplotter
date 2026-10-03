import { trunkLabels, type CableTree } from '../../lib/cables'
import { PX_PER_M } from '../../model/defaults'

const px = (m: number) => m * PX_PER_M

/** Strichstärke in CSS-px nach Kabelanzahl. */
function width(count: number): number {
  return 1.2 + Math.sqrt(count)
}

/** Farbe eines Baums; Geräte ohne Speisung in neutralem Grau aus dem Theme. */
function treeColor(tree: CableTree): string {
  return tree.color ?? 'var(--text-muted)'
}

interface Props {
  trees: CableTree[]
  /** SVG-Einheiten pro CSS-Pixel. */
  k: number
}

/**
 * Gebündelte, rechtwinklige Kabelwege je Stagebox und je Gerät (siehe lib/cables.ts).
 * Kabel ab Geräten (Lautsprecher-/Line-Kabel der PA) sind gestrichelt. Liegt unter den Knoten.
 */
export function CableLines({ trees, k }: Props) {
  return (
    <g className="cables">
      {trees.map((tree) => {
        const { route } = tree
        if (route.total === 0) return null
        const segments = [...route.segments].sort((a, b) => a.count - b.count)
        const dash = tree.kind === 'device' ? `${5 * k} ${3 * k}` : undefined
        return (
          <g key={tree.rootId} style={{ stroke: treeColor(tree) }} strokeDasharray={dash}>
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

/** Kabelanzahl direkt am Abgang jeder Box bzw. jedes Geräts; liegt über den Knoten. */
export function CableLabels({ trees, k }: Props) {
  // Box-Quadrat (30 CSS-px, siehe BoxNode) plus Rand, umgerechnet in Meter.
  const m = (cssPx: number) => (cssPx * k) / PX_PER_M
  const clear = { left: m(17), right: m(17), top: m(17), bottom: m(17) }
  const deviceClear = { left: m(25), right: m(25), top: m(14), bottom: m(14) }

  return (
    <g className="cable-counts">
      {trees.map((tree) =>
        trunkLabels(tree.route, tree.root, { clear: tree.kind === 'box' ? clear : deviceClear, offset: m(9) }).map(
          ({ pos, count }, i) => {
            const text = String(count)
            const w = (text.length * 6.5 + 8) * k
            const h = 14 * k
            return (
              <g key={`${tree.rootId}-${i}`} className="cable-count" transform={`translate(${px(pos.x)} ${px(pos.y)})`}>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} style={{ fill: treeColor(tree) }} />
                <text style={{ fontSize: 10 * k }} textAnchor="middle" dominantBaseline="central">
                  {text}
                </text>
              </g>
            )
          },
        ),
      )}
    </g>
  )
}
