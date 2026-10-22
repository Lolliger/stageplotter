import type { PointerEventHandler } from 'react'
import { formatAddress } from '../../lib/dmx'
import { PX_PER_M } from '../../model/defaults'
import { FIXTURE_SIZE, FIXTURE_TYPES, TRUSS_WIDTH, beamPolygon, labelPlacement } from '../../model/lights'
import type { Fixture, Truss } from '../../model/types'

interface DragBindings {
  onPointerDown: PointerEventHandler<SVGGElement>
  onPointerMove: PointerEventHandler<SVGGElement>
  onPointerUp: PointerEventHandler<SVGGElement>
  onPointerCancel: PointerEventHandler<SVGGElement>
}

/** Mindestgröße der Trefferfläche in CSS-px (wie bei den Ton-Knoten). */
const HIT_RADIUS = 22
/** Länge des Lichtkegels im Plan (m). */
const BEAM_LENGTH = 1.6

/** Symbol eines Lampentyps, zentriert, Leuchtrichtung nach unten (+y). Auch für Ghost/Legende. */
export function FixtureShape({ kind, s, className }: { kind: Fixture['kind']; s: number; className: string }) {
  const h = s / 2
  switch (FIXTURE_TYPES[kind].shape) {
    case 'circle':
      return <circle className={className} r={h} />
    case 'square':
      // Moving Head: Kopf mit Linse
      return (
        <>
          <rect className={className} x={-h} y={-h} width={s} height={s} rx={s * 0.22} />
          <circle className="lens" cy={h * 0.62} r={h * 0.22} />
        </>
      )
    case 'rect':
      return <rect className={className} x={-h * 0.62} y={-h * 1.15} width={s * 0.62} height={s * 1.15} rx={s * 0.1} />
    case 'hex': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i
        return `${(Math.cos(a) * h).toFixed(2)},${(Math.sin(a) * h).toFixed(2)}`
      }).join(' ')
      return <polygon className={className} points={pts} />
    }
    case 'diamond':
      return <polygon className={className} points={`0,${-h} ${h},0 0,${h} ${-h},0`} />
  }
}

interface FixtureNodeProps {
  fixture: Fixture
  k: number
  selected: boolean
  /** Adresse überschneidet sich oder läuft über – rot markieren. */
  problem: boolean
  bind: DragBindings
}

export function FixtureNode({ fixture, k, selected, problem, bind }: FixtureNodeProps) {
  const x = fixture.pos.x * PX_PER_M
  const y = fixture.pos.y * PX_PER_M
  const type = FIXTURE_TYPES[fixture.kind]
  const s = FIXTURE_SIZE * k
  const address = fixture.address === undefined ? '–' : formatAddress(fixture.universe, fixture.address)
  const label = labelPlacement(fixture.rotation ?? 0, s, k)

  return (
    <g
      className={`node fixture-node${selected ? ' selected' : ''}${problem ? ' problem' : ''}${fixture.address === undefined ? ' unaddressed' : ''}`}
      transform={`translate(${x} ${y})`}
      {...bind}
      role="button"
      aria-label={`Lampe ${fixture.number} ${fixture.name}, Adresse ${address}`}
    >
      <circle className="hit" r={Math.max(HIT_RADIUS * k, s * 0.7)} />
      {selected && <circle className="selection" r={s * 0.75 + 4 * k} strokeWidth={2 * k} />}
      <g transform={`rotate(${fixture.rotation ?? 0})`}>
        <FixtureShape kind={fixture.kind} s={s} className="body" />
        {type.beam > 0 && <polygon className="front" points={`${-3.5 * k},${s * 0.62} ${3.5 * k},${s * 0.62} 0,${s * 0.62 + 5 * k}`} />}
      </g>
      <text className="abbr" style={{ fontSize: (type.abbr.length > 2 ? 6 : 7) * k }} dominantBaseline="central" textAnchor="middle">
        {type.abbr}
      </text>
      {/* Nummer und Adresse untereinander auf der Rückseite, gegenüber vom Lichtkegel */}
      <text className="label" x={label.x} y={label.y} style={{ fontSize: 9.5 * k }} textAnchor={label.anchor}>
        <tspan className="fixture-number" x={label.x}>
          #{fixture.number}
        </tspan>
        <tspan className="fixture-address" x={label.x} dy={10 * k} style={{ fontSize: 8.5 * k }}>
          {address}
        </tspan>
      </text>
    </g>
  )
}

/** Lichtkegel einer Lampe; liegt unter allen Symbolen und fängt keine Klicks. */
export function Beam({ fixture, k, ghost }: { fixture: Fixture; k: number; ghost?: boolean }) {
  const beam = FIXTURE_TYPES[fixture.kind].beam
  if (beam <= 0) return null
  const start = FIXTURE_SIZE * k * 0.5
  return (
    <polygon
      className={`beam${ghost ? ' ghost' : ''}`}
      transform={`translate(${fixture.pos.x * PX_PER_M} ${fixture.pos.y * PX_PER_M}) rotate(${fixture.rotation ?? 0})`}
      points={beamPolygon(beam, Math.max(BEAM_LENGTH * PX_PER_M, start + 24 * k), start)}
      fill="url(#beam-gradient)"
    />
  )
}

interface TrussNodeProps {
  truss: Truss
  k: number
  selected: boolean
  bind?: DragBindings
  ghost?: boolean
}

/** Traverse als Leiter (zwei Gurte, Diagonalen alle 0,5 m), Name über der Mitte. */
export function TrussNode({ truss, k, selected, bind, ghost }: TrussNodeProps) {
  const len = truss.length * PX_PER_M
  const th = Math.max(TRUSS_WIDTH * PX_PER_M, 7 * k)
  const rot = truss.rotation ?? 0
  const rad = (rot * Math.PI) / 180
  const segs = Math.max(1, Math.round(truss.length / 0.5))
  const step = len / segs
  const zig = Array.from({ length: segs }, (_, i) => {
    const x0 = -len / 2 + i * step
    return `M ${x0} ${i % 2 ? th / 2 : -th / 2} L ${x0 + step} ${i % 2 ? -th / 2 : th / 2}`
  }).join(' ')
  // Name vor dem Anfang der Traverse (dort hängt keine Lampe), immer waagerecht lesbar
  const ax = Math.cos(rad)
  const ay = Math.sin(rad)
  const gap = len / 2 + 6 * k
  const flat = Math.abs(ax) >= 0.5
  const startX = -ax * gap
  const startY = -ay * gap
  // senkrechte Traversen (Türme): Name über bzw. unter dem Anfang
  const nameAnchor = flat ? (ax > 0 ? 'end' : 'start') : 'middle'
  const nx = startX
  const ny = flat ? startY : startY + (ay > 0 ? -4 * k : 4 * k)

  return (
    <g
      className={`truss-node${ghost ? ' ghost' : ' node'}${selected ? ' selected' : ''}`}
      transform={`translate(${truss.pos.x * PX_PER_M} ${truss.pos.y * PX_PER_M})`}
      {...(bind ?? {})}
      role={ghost ? undefined : 'button'}
      aria-label={ghost ? undefined : `Traverse ${truss.name}, ${truss.length.toLocaleString('de-DE')} m`}
    >
      <g transform={`rotate(${rot})`}>
        {!ghost && <rect className="hit" x={-len / 2 - 4 * k} y={-Math.max(HIT_RADIUS * k, th)} width={len + 8 * k} height={2 * Math.max(HIT_RADIUS * k, th)} />}
        {selected && (
          <rect className="selection" x={-len / 2 - 5 * k} y={-th / 2 - 5 * k} width={len + 10 * k} height={th + 10 * k} rx={4 * k} strokeWidth={2 * k} />
        )}
        <rect className="truss-body" x={-len / 2} y={-th / 2} width={len} height={th} strokeWidth={1.6 * k} />
        <path className="truss-zig" d={zig} strokeWidth={1 * k} />
      </g>
      <text className="label truss-label" x={nx} y={ny} style={{ fontSize: 10 * k }} textAnchor={nameAnchor} dominantBaseline="central">
        {truss.name}
      </text>
    </g>
  )
}
