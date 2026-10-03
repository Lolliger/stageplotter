import type { PointerEventHandler } from 'react'
import type { BoxUsage, GroupAssignment, OutputAssignment } from '../../lib/assign'
import { PX_PER_M } from '../../model/defaults'
import { AMP_SHAPE, DEVICE_SHAPE, OUTPUT_SHAPES, frontArrowPoints } from '../../model/shapes'
import { DEVICE_ABBR, DEVICE_LABELS } from '../../model/devices'
import type { Device, InstrumentGroup, InstrumentType, OutputElement, Stagebox } from '../../model/types'

interface DragBindings {
  onPointerDown: PointerEventHandler<SVGGElement>
  onPointerMove: PointerEventHandler<SVGGElement>
  onPointerUp: PointerEventHandler<SVGGElement>
  onPointerCancel: PointerEventHandler<SVGGElement>
}

/** Mindestgröße der Trefferfläche in CSS-px (Radius 24 → 48 px Durchmesser). */
const HIT_RADIUS = 24

/** Kleines Pin-Symbol oben links an einem Knoten. */
function PinMark({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <g className="pin-mark" transform={`translate(${x} ${y}) scale(${k})`} aria-hidden="true">
      <circle r={8} />
      <path d="M -2.5 -4.5 h 5 l -1 3.5 l 2.5 2 h -8 l 2.5 -2 Z M 0 1 v 4.5" />
    </g>
  )
}

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
  const amp = group.form === 'amp'
  const r = 17 * k
  // Halbe Höhe/Breite des Körpers: Kreis bzw. Verstärker-Kasten
  const halfW = amp ? (AMP_SHAPE.w / 2) * k : r
  const halfH = amp ? (AMP_SHAPE.h / 2) * k : r
  const primary = assignment?.boxIds[0] ? boxById.get(assignment.boxIds[0]) : undefined
  const problem = (assignment?.unpatched ?? 0) > 0
  const count = group.channels.length
  const bodyStyle = primary ? { stroke: primary.color } : undefined

  return (
    <g
      className={`node group-node${selected ? ' selected' : ''}${problem ? ' problem' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`${group.name}, ${count} Kanäle`}
    >
      <circle className="hit" r={Math.max(HIT_RADIUS * k, halfW + 4 * k)} />
      {selected &&
        (amp ? (
          <rect
            className="selection"
            x={-halfW - 5 * k}
            y={-halfH - 5 * k}
            width={2 * halfW + 10 * k}
            height={2 * halfH + 10 * k}
            rx={8 * k}
            strokeWidth={2 * k}
          />
        ) : (
          <circle className="selection" r={r + 5 * k} strokeWidth={2 * k} />
        ))}
      {amp ? (
        <g transform={`rotate(${group.rotation ?? 0})`}>
          <rect
            className="body"
            x={-halfW}
            y={-halfH}
            width={2 * halfW}
            height={2 * halfH}
            rx={AMP_SHAPE.rx * k}
            strokeWidth={3 * k}
            style={bodyStyle}
          />
          <polygon
            className="front"
            points={frontArrowPoints(AMP_SHAPE, k)!}
            style={primary ? { fill: primary.color } : undefined}
          />
        </g>
      ) : (
        <circle className="body" r={r} strokeWidth={3 * k} style={bodyStyle} />
      )}
      <text className="abbr" style={{ fontSize: (amp ? 10 : 12) * k }} dominantBaseline="central" textAnchor="middle">
        {amp ? AMP_SHAPE.abbr : TYPE_ABBR[group.type]}
      </text>
      <g transform={`translate(${halfW * (amp ? 1 : 0.75)} ${-halfH * (amp ? 1 : 0.75)})`}>
        <circle className="badge" r={8 * k} />
        <text className="badge-text" style={{ fontSize: 9.5 * k }} dominantBaseline="central" textAnchor="middle">
          {problem ? '!' : count}
        </text>
      </g>
      {assignment?.pinned && <PinMark x={-halfW * (amp ? 1 : 0.75)} y={-halfH * (amp ? 1 : 0.75)} k={k} />}
      <text className="label" y={halfH + 13 * k} style={{ fontSize: 11 * k }} textAnchor="middle">
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
  /** Farbe der PA-Kette, wenn der Lautsprecher an einem Gerät hängt. */
  chainColor?: string | null
  k: number
  selected: boolean
  bind: DragBindings
}

/** Output-Element, Form je Art aus model/shapes.ts (Wedge-Trapez, IEM-Pille, Sidefill, PA, Sub). */
export function OutputNode({ output, assignment, boxById, chainColor, k, selected, bind }: OutputNodeProps) {
  const x = output.pos.x * PX_PER_M
  const y = output.pos.y * PX_PER_M
  const box = assignment?.boxId ? boxById.get(assignment.boxId) : undefined
  const fedByDevice = !!assignment?.source
  const problem = !assignment?.boxId && !fedByDevice
  const color = box?.color ?? (fedByDevice ? chainColor : null)
  const stroke = color ? { stroke: color } : undefined
  const sw = 2.5 * k

  const spec = OUTPUT_SHAPES[output.kind]
  const w = spec.w * k
  const h = spec.h * k
  const shape =
    spec.shape === 'trapezoid' ? (
      <path
        className="body"
        d={`M ${-w / 2} ${h / 2} L ${w / 2} ${h / 2} L ${w / 3} ${-h / 2} L ${-w / 3} ${-h / 2} Z`}
        strokeWidth={sw}
        strokeLinejoin="round"
        style={stroke}
      />
    ) : (
      <rect className="body" x={-w / 2} y={-h / 2} width={w} height={h} rx={spec.rx * k} strokeWidth={sw} style={stroke} />
    )
  const abbr = spec.abbr
  const arrow = frontArrowPoints(spec, k)
  const rotation = output.rotation ?? 0

  return (
    <g
      className={`node output-node${selected ? ' selected' : ''}${problem ? ' problem' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`${output.name}${assignment?.label ? `, ${assignment.label}` : ''}`}
    >
      <circle className="hit" r={Math.max(HIT_RADIUS * k, Math.max(w, h) / 2 + 6 * k)} />
      {selected && <circle className="selection" r={Math.max(w, h) / 2 + 6 * k} strokeWidth={2 * k} />}
      <g transform={`rotate(${rotation})`}>
        {shape}
        {arrow && <polygon className="front" points={arrow} style={stroke ? { fill: stroke.stroke } : undefined} />}
      </g>
      <text className="abbr" style={{ fontSize: 9 * k }} dominantBaseline="central" textAnchor="middle">
        {abbr}
      </text>
      {assignment?.pinned && <PinMark x={-w / 2} y={-h / 2 - 2 * k} k={k} />}
      <text className="label" y={h / 2 + 11 * k} style={{ fontSize: 10 * k }} textAnchor="middle">
        {output.name}
      </text>
    </g>
  )
}

interface DeviceNodeProps {
  device: Device
  /** Farbe der speisenden Stagebox, null = noch nicht gespeist. */
  color: string | null
  k: number
  selected: boolean
  bind: DragBindings
}

/** Frequenzweiche oder Endstufe als Rack-Kasten mit Kürzel und Ein-/Ausgangszahl. */
export function DeviceNode({ device, color, k, selected, bind }: DeviceNodeProps) {
  const x = device.pos.x * PX_PER_M
  const y = device.pos.y * PX_PER_M
  const w = DEVICE_SHAPE.w * k
  const h = DEVICE_SHAPE.h * k
  const io = device.kind === 'amp' ? `×${device.inputs.length}` : `${device.inputs.length}→${device.outputs.length}`

  return (
    <g
      className={`node device-node${selected ? ' selected' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`${DEVICE_LABELS[device.kind]} ${device.name}`}
    >
      <circle className="hit" r={Math.max(HIT_RADIUS * k, w / 2 + 4 * k)} />
      {selected && (
        <rect
          className="selection"
          x={-w / 2 - 5 * k}
          y={-h / 2 - 5 * k}
          width={w + 10 * k}
          height={h + 10 * k}
          rx={7 * k}
          strokeWidth={2 * k}
        />
      )}
      <rect
        className="body"
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={DEVICE_SHAPE.rx * k}
        strokeWidth={2.5 * k}
        style={color ? { stroke: color } : undefined}
      />
      {/* Rack-Ohren links und rechts */}
      <line className="rack-ear" x1={-w / 2 + 4 * k} y1={-h / 2 + 3 * k} x2={-w / 2 + 4 * k} y2={h / 2 - 3 * k} strokeWidth={1.5 * k} />
      <line className="rack-ear" x1={w / 2 - 4 * k} y1={-h / 2 + 3 * k} x2={w / 2 - 4 * k} y2={h / 2 - 3 * k} strokeWidth={1.5 * k} />
      <text className="abbr" style={{ fontSize: 9.5 * k }} dominantBaseline="central" textAnchor="middle">
        {DEVICE_ABBR[device.kind]} <tspan className="io">{io}</tspan>
      </text>
      <text className="label" y={h / 2 + 11 * k} style={{ fontSize: 10 * k }} textAnchor="middle">
        {device.name}
      </text>
    </g>
  )
}
