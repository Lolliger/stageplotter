import type { PointerEventHandler } from 'react'
import type { BoxUsage, GroupAssignment } from '../../lib/assign'
import { PX_PER_M } from '../../model/defaults'
import type { InstrumentGroup, InstrumentType, Stagebox } from '../../model/types'

interface DragBindings {
  onPointerDown: PointerEventHandler<SVGGElement>
  onPointerMove: PointerEventHandler<SVGGElement>
  onPointerUp: PointerEventHandler<SVGGElement>
  onPointerCancel: PointerEventHandler<SVGGElement>
}

/** Mindestgröße der Trefferfläche in CSS-px (Radius 24 → 48 px Durchmesser). */
const HIT_RADIUS = 24

const TYPE_ABBR: Record<InstrumentType, string> = {
  drums: 'DR',
  percussion: 'PC',
  bass: 'BS',
  guitar: 'GT',
  keys: 'KY',
  vocals: 'VX',
  other: '•',
}

interface GroupNodeProps {
  group: InstrumentGroup
  assignment: GroupAssignment | undefined
  boxById: Map<string, Stagebox>
  /** SVG-Einheiten pro CSS-Pixel. */
  k: number
  selected: boolean
  bind: DragBindings
}

export function GroupNode({ group, assignment, boxById, k, selected, bind }: GroupNodeProps) {
  const x = group.pos.x * PX_PER_M
  const y = group.pos.y * PX_PER_M
  const r = 17 * k
  const primary = assignment?.boxIds[0] ? boxById.get(assignment.boxIds[0]) : undefined
  const problem = (assignment?.unpatched ?? 0) > 0
  const count = group.channels.length

  return (
    <g
      className={`node group-node${selected ? ' selected' : ''}${problem ? ' problem' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`${group.name}, ${count} Kanäle`}
    >
      <circle className="hit" r={Math.max(HIT_RADIUS * k, r + 4 * k)} />
      {selected && <circle className="selection" r={r + 5 * k} strokeWidth={2 * k} />}
      <circle className="body" r={r} strokeWidth={3 * k} style={primary ? { stroke: primary.color } : undefined} />
      <text className="abbr" style={{ fontSize: 12 * k }} dominantBaseline="central" textAnchor="middle">
        {TYPE_ABBR[group.type]}
      </text>
      <g transform={`translate(${r * 0.75} ${-r * 0.75})`}>
        <circle className="badge" r={8 * k} />
        <text className="badge-text" style={{ fontSize: 9.5 * k }} dominantBaseline="central" textAnchor="middle">
          {problem ? '!' : count}
        </text>
      </g>
      <text className="label" y={r + 13 * k} style={{ fontSize: 11 * k }} textAnchor="middle">
        {group.name}
      </text>
    </g>
  )
}

interface BoxNodeProps {
  box: Stagebox
  usage: BoxUsage | undefined
  k: number
  selected: boolean
  bind: DragBindings
}

export function BoxNode({ box, usage, k, selected, bind }: BoxNodeProps) {
  const x = box.pos.x * PX_PER_M
  const y = box.pos.y * PX_PER_M
  const s = 30 * k
  const inUsed = usage?.inputsUsed ?? 0
  const outUsed = usage?.outputsUsed ?? 0
  const inProblem = (usage?.inputsMissing ?? 0) > 0
  const outProblem = (usage?.outputsMissing ?? 0) > 0
  const inText = `${inUsed}/${box.inputs} In`
  const outText = `${outUsed}/${box.outputs} Out`
  const capW = (Math.max(inText.length, outText.length) * 6.6 + 12) * k
  const lineH = 12 * k
  const capH = 2 * lineH + 4 * k

  return (
    <g
      className={`node box-node${selected ? ' selected' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`Stagebox ${box.name}, ${inUsed} von ${box.inputs} Inputs, ${outUsed} von ${box.outputs} Outputs`}
    >
      <rect className="hit" x={-Math.max(HIT_RADIUS * k, s / 2)} y={-Math.max(HIT_RADIUS * k, s / 2)} width={Math.max(2 * HIT_RADIUS * k, s)} height={Math.max(2 * HIT_RADIUS * k, s) + capH} />
      {selected && (
        <rect className="selection" x={-s / 2 - 5 * k} y={-s / 2 - 5 * k} width={s + 10 * k} height={s + 10 * k} rx={8 * k} strokeWidth={2 * k} />
      )}
      <rect className="box-body" x={-s / 2} y={-s / 2} width={s} height={s} rx={5 * k} fill={box.color} />
      <text className="box-name" style={{ fontSize: 15 * k }} dominantBaseline="central" textAnchor="middle">
        {box.name}
      </text>
      <g transform={`translate(0 ${s / 2 + 4 * k})`}>
        <rect className="cap-bg" x={-capW / 2} y={0} width={capW} height={capH} rx={6 * k} />
        <text className="cap" style={{ fontSize: 10.5 * k }} textAnchor="middle">
          <tspan x={0} y={2 * k + lineH / 2} dominantBaseline="central" className={inProblem ? 'over' : ''}>
            {inText}
          </tspan>
          <tspan x={0} y={2 * k + lineH * 1.5} dominantBaseline="central" className={outProblem ? 'over' : ''}>
            {outText}
          </tspan>
        </text>
      </g>
    </g>
  )
}
