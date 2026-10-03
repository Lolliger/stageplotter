import { useRef } from 'react'
import { PX_PER_M } from '../../model/defaults'
import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'
import { BoxNode, GroupNode } from './nodes'
import { useDrag } from './useDrag'
import { useUnitsPerPx } from './useUnitsPerPx'
import './stage.css'

/** Rand um die Bühne in Metern (Platz für Boxen außerhalb und Beschriftung). */
const PAD = 1.6

interface Props {
  selected: ElementRef | null
  onSelect: (target: ElementRef | null) => void
}

export function StagePlot({ selected, onSelect }: Props) {
  const { project, assignment, dispatch } = useProject()
  const { stage } = project
  const svgRef = useRef<SVGSVGElement>(null)

  const vx = -PAD * PX_PER_M
  const vy = -PAD * PX_PER_M
  const vw = (stage.width + 2 * PAD) * PX_PER_M
  const vh = (stage.depth + 2 * PAD) * PX_PER_M
  const { unitsPerPx, widthPx } = useUnitsPerPx(svgRef, vw, vh)
  // Auf großen Flächen Knoten etwas größer zeichnen, auf dem Handy Basisgröße.
  const boost = Math.min(1.4, Math.max(1, widthPx / 520))
  const k = Math.min(4, Math.max(0.35, unitsPerPx * boost))

  const bind = useDrag(
    svgRef,
    (target, pos) => dispatch({ type: 'move', target, pos }),
    (target) => onSelect(target),
  )

  const boxById = new Map(project.boxes.map((b) => [b.id, b]))
  const isSelected = (kind: ElementRef['kind'], id: string) => selected?.kind === kind && selected.id === id

  const W = stage.width * PX_PER_M
  const D = stage.depth * PX_PER_M
  const gridStep = stage.width > 24 || stage.depth > 24 ? 2 : 1
  const xs = range(0, stage.width, gridStep)
  const ys = range(0, stage.depth, gridStep)

  return (
    <svg
      ref={svgRef}
      className="stage-svg"
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: `${vw} / ${vh}` }}
      role="img"
      aria-label={`Bühnenplan ${fmt(stage.width)} × ${fmt(stage.depth)} m`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as Element).classList.contains('stage-floor')) onSelect(null)
      }}
    >
      {/* Bühne und Raster */}
      <rect className="stage-floor" x={0} y={0} width={W} height={D} />
      <g className="stage-grid">
        {xs.map((m) => (
          <line key={`x${m}`} x1={m * PX_PER_M} y1={0} x2={m * PX_PER_M} y2={D} className={m % 5 === 0 ? 'major' : ''} />
        ))}
        {ys.map((m) => (
          <line key={`y${m}`} x1={0} y1={m * PX_PER_M} x2={W} y2={m * PX_PER_M} className={m % 5 === 0 ? 'major' : ''} />
        ))}
      </g>
      <rect className="stage-outline" x={0} y={0} width={W} height={D} />
      <line className="stage-front" x1={0} y1={D} x2={W} y2={D} />

      <g className="stage-scale" style={{ fontSize: 9 * k }}>
        {xs.map((m) => (
          <text key={`lx${m}`} x={m * PX_PER_M} y={-5 * k} textAnchor="middle">
            {m}
          </text>
        ))}
        {ys.map((m) => (
          <text key={`ly${m}`} x={-5 * k} y={m * PX_PER_M} textAnchor="end" dominantBaseline="middle">
            {m}
          </text>
        ))}
        <text x={W + 5 * k} y={-5 * k}>
          m
        </text>
      </g>
      <text className="stage-audience" x={W / 2} y={D + 14 * k} style={{ fontSize: 11 * k }}>
        PUBLIKUM · {fmt(stage.width)} × {fmt(stage.depth)} m
      </text>

      {/* Verbindungen Gruppe → Box */}
      <g className="links">
        {project.groups.flatMap((g) => {
          const a = assignment.groups[g.id]
          if (!a) return []
          return a.boxIds.map((boxId) => {
            const box = boxById.get(boxId)!
            return (
              <line
                key={`${g.id}-${boxId}`}
                x1={g.pos.x * PX_PER_M}
                y1={g.pos.y * PX_PER_M}
                x2={box.pos.x * PX_PER_M}
                y2={box.pos.y * PX_PER_M}
                stroke={box.color}
                strokeWidth={2 * k}
                strokeDasharray={a.split ? `${6 * k} ${4 * k}` : undefined}
              />
            )
          })
        })}
      </g>

      {/* Reihenfolge: Instrumente, darüber Boxen (Kapazität bleibt lesbar), ausgewähltes Element ganz oben. */}
      {[
        ...project.groups.map((g) => ({ kind: 'group' as const, el: g })),
        ...project.boxes.map((b) => ({ kind: 'box' as const, el: b })),
      ]
        .sort((a, b) => Number(isSelected(a.kind, a.el.id)) - Number(isSelected(b.kind, b.el.id)))
        .map((item) =>
          item.kind === 'box' ? (
            <BoxNode
              key={item.el.id}
              box={item.el}
              usage={assignment.usage[item.el.id]}
              k={k}
              selected={isSelected('box', item.el.id)}
              bind={bind({ kind: 'box', id: item.el.id }, item.el.pos)}
            />
          ) : (
            <GroupNode
              key={item.el.id}
              group={item.el}
              assignment={assignment.groups[item.el.id]}
              boxById={boxById}
              k={k}
              selected={isSelected('group', item.el.id)}
              bind={bind({ kind: 'group', id: item.el.id }, item.el.pos)}
            />
          ),
        )}
    </svg>
  )
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

function fmt(m: number): string {
  return m.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}
