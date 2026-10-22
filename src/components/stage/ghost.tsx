import { PX_PER_M } from '../../model/defaults'
import { FIXTURE_SIZE } from '../../model/lights'
import { AMP_SHAPE, DEVICE_SHAPE, OUTPUT_SHAPES, frontArrowPoints } from '../../model/shapes'
import type { Device, Fixture, InstrumentGroup, OutputElement, Stagebox } from '../../model/types'
import { FixtureShape } from './lightNodes'

/**
 * Gegenpart im Hintergrund: Ton-Elemente im Lichtmodus bzw. Lampen im Tonmodus – klein, grau,
 * ohne Zähler und nicht anfassbar. `s` = Verkleinerung gegenüber den normalen Knoten.
 */
const s = 0.62

export function GhostGroup({ group, k }: { group: InstrumentGroup; k: number }) {
  const amp = group.form === 'amp'
  const r = 17 * k * s
  return (
    <g className="ghost" transform={`translate(${group.pos.x * PX_PER_M} ${group.pos.y * PX_PER_M})`}>
      {amp ? (
        <g transform={`rotate(${group.rotation ?? 0})`}>
          <rect className="ghost-body" x={(-AMP_SHAPE.w / 2) * k * s} y={(-AMP_SHAPE.h / 2) * k * s} width={AMP_SHAPE.w * k * s} height={AMP_SHAPE.h * k * s} rx={2 * k} />
        </g>
      ) : (
        <circle className="ghost-body" r={r} />
      )}
      <text className="ghost-label" y={(amp ? (AMP_SHAPE.h / 2) * k * s : r) + 9 * k} style={{ fontSize: 8.5 * k }} textAnchor="middle">
        {group.name}
      </text>
    </g>
  )
}

export function GhostOutput({ output, k }: { output: OutputElement; k: number }) {
  const spec = OUTPUT_SHAPES[output.kind]
  const kk = k * s
  const w = spec.w * kk
  const h = spec.h * kk
  const arrow = frontArrowPoints(spec, kk)
  return (
    <g className="ghost" transform={`translate(${output.pos.x * PX_PER_M} ${output.pos.y * PX_PER_M})`}>
      <g transform={`rotate(${output.rotation ?? 0})`}>
        {spec.shape === 'trapezoid' ? (
          <path className="ghost-body" d={`M ${-w / 2} ${h / 2} L ${w / 2} ${h / 2} L ${w / 3} ${-h / 2} L ${-w / 3} ${-h / 2} Z`} />
        ) : (
          <rect className="ghost-body" x={-w / 2} y={-h / 2} width={w} height={h} rx={spec.rx * kk} />
        )}
        {arrow && <polygon className="ghost-front" points={arrow} />}
      </g>
      <text className="ghost-label" y={h / 2 + 9 * k} style={{ fontSize: 8.5 * k }} textAnchor="middle">
        {output.name}
      </text>
    </g>
  )
}

export function GhostBox({ box, k }: { box: Stagebox; k: number }) {
  const b = 30 * k * s
  return (
    <g className="ghost" transform={`translate(${box.pos.x * PX_PER_M} ${box.pos.y * PX_PER_M})`}>
      <rect className="ghost-body" x={-b / 2} y={-b / 2} width={b} height={b} rx={3 * k} />
      <text className="ghost-abbr" style={{ fontSize: 9 * k }} dominantBaseline="central" textAnchor="middle">
        {box.name}
      </text>
    </g>
  )
}

export function GhostDevice({ device, k }: { device: Device; k: number }) {
  const w = DEVICE_SHAPE.w * k * s
  const h = DEVICE_SHAPE.h * k * s
  return (
    <g className="ghost" transform={`translate(${device.pos.x * PX_PER_M} ${device.pos.y * PX_PER_M})`}>
      <rect className="ghost-body" x={-w / 2} y={-h / 2} width={w} height={h} rx={2 * k} />
      <text className="ghost-label" y={h / 2 + 9 * k} style={{ fontSize: 8.5 * k }} textAnchor="middle">
        {device.name}
      </text>
    </g>
  )
}

export function GhostFixture({ fixture, k }: { fixture: Fixture; k: number }) {
  return (
    <g className="ghost" transform={`translate(${fixture.pos.x * PX_PER_M} ${fixture.pos.y * PX_PER_M})`}>
      <g transform={`rotate(${fixture.rotation ?? 0})`}>
        <FixtureShape kind={fixture.kind} s={FIXTURE_SIZE * k * s} className="ghost-body" />
      </g>
    </g>
  )
}
