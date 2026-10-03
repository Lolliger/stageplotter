import type { PointerEventHandler } from 'react'
import type { BoxUsage, GroupAssignment, OutputAssignment } from '../../lib/assign'
import { PX_PER_M } from '../../model/defaults'
import type { InstrumentGroup, InstrumentType, OutputElement, Stagebox } from '../../model/types'

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

interface OutputNodeProps {
  output: OutputElement
  assignment: OutputAssignment | undefined
  boxById: Map<string, Stagebox>
  k: number
  selected: boolean
  bind: DragBindings
}

/** Wedge als Trapez (Abstrahlrichtung nach hinten zum Musiker), IEM als Pille, Sidefill als Stack. */
export function OutputNode({ output, assignment, boxById, k, selected, bind }: OutputNodeProps) {
  const x = output.pos.x * PX_PER_M
  const y = output.pos.y * PX_PER_M
  const box = assignment?.boxId ? boxById.get(assignment.boxId) : undefined
  const problem = !assignment?.boxId
  const stroke = box ? { stroke: box.color } : undefined
  const sw = 2.5 * k

  let shape
  let h: number
  if (output.kind === 'wedge') {
    const w = 30 * k
    h = 15 * k
    shape = (
      <path
        className="body"
        d={`M ${-w / 2} ${h / 2} L ${w / 2} ${h / 2} L ${w / 3} ${-h / 2} L ${-w / 3} ${-h / 2} Z`}
        strokeWidth={sw}
        strokeLinejoin="round"
        style={stroke}
      />
    )
  } else if (output.kind === 'sidefill') {
    const w = 18 * k
    h = 28 * k
    shape = <rect className="body" x={-w / 2} y={-h / 2} width={w} height={h} rx={3 * k} strokeWidth={sw} style={stroke} />
  } else {
    const w = 30 * k
    h = 16 * k
    shape = <rect className="body" x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} strokeWidth={sw} style={stroke} />
  }
  const abbr = output.kind === 'iem' ? 'IEM' : output.kind === 'sidefill' ? 'SF' : 'W'

  return (
    <g
      className={`node output-node${selected ? ' selected' : ''}${problem ? ' problem' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`${output.name}${assignment?.label ? `, ${assignment.label}` : ''}`}
    >
      <circle className="hit" r={Math.max(HIT_RADIUS * k, h / 2 + 6 * k)} />
      {selected && <circle className="selection" r={h / 2 + 12 * k} strokeWidth={2 * k} />}
      {shape}
      <text className="abbr" style={{ fontSize: 9 * k }} dominantBaseline="central" textAnchor="middle">
        {abbr}
      </text>
      <text className="label" y={h / 2 + 11 * k} style={{ fontSize: 10 * k }} textAnchor="middle">
        {output.name}
      </text>
    </g>
  )
}
