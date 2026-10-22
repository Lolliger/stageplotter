import { useMemo, useRef, useState } from 'react'
import { deviceColor, routeProject } from '../../lib/cables'
import { dmxIssues } from '../../lib/dmx'
import { PX_PER_M } from '../../model/defaults'
import { DEFAULT_VIEW, LIGHT_VIEW_PAD, lightExtent, viewSettings } from '../../model/lights'
import { OFFSTAGE_OUTPUTS } from '../../model/shapes'
import type { ElementRef } from '../../model/types'
import type { PlotMode } from '../../state/mode'
import { useProject } from '../../state/useProject'
import { CableLabels, CableLines } from './Cables'
import { GhostBox, GhostDevice, GhostFixture, GhostGroup, GhostOutput } from './ghost'
import { Beam, FixtureNode, TrussNode } from './lightNodes'
import { BoxNode, DeviceNode, GroupNode, OutputNode } from './nodes'
import { useDrag } from './useDrag'
import { useUnitsPerPx } from './useUnitsPerPx'
import { useZoomPan } from './useZoomPan'
import { ZOOM_LIMITS } from '../../lib/viewport'
import './stage.css'

/** Rand um die Bühne in Metern (Platz für Boxen außerhalb und Beschriftung). */
const PAD = 1.6
/** Unten mehr Rand: Platz für PA/Subs vor der Bühne (bis 1 m) und darunter die Publikumszeile. */
const PAD_BOTTOM = 2.2

interface Props {
  mode: PlotMode
  selected: ElementRef | null
  onSelect: (target: ElementRef | null) => void
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Ausschnitt in Metern. Ton: Bühne mit Rand (Licht nur, wenn eingeblendet). Licht: größerer Rand
 * für FOH und Türme, wächst mit den Lampen und Traversen (auf halbe Meter gerundet).
 */
function plotBounds(project: Parameters<typeof lightExtent>[0] & { stage: { width: number; depth: number } }, mode: PlotMode, showLights: boolean): Bounds {
  const { width, depth } = project.stage
  const lights = mode === 'lighting' || showLights ? lightExtent(project) : null
  const pad = mode === 'lighting' ? LIGHT_VIEW_PAD : PAD
  const b: Bounds = { minX: -pad, minY: -pad, maxX: width + pad, maxY: depth + (mode === 'lighting' ? pad : PAD_BOTTOM) }
  if (lights) {
    // Rand für Beschriftungen neben den Lampen; unten zusätzlich für die Publikumszeile
    b.minX = Math.min(b.minX, Math.floor((lights.minX - 3) * 2) / 2)
    b.minY = Math.min(b.minY, Math.floor((lights.minY - 1.5) * 2) / 2)
    b.maxX = Math.max(b.maxX, Math.ceil((lights.maxX + 3) * 2) / 2)
    b.maxY = Math.max(b.maxY, Math.ceil((lights.maxY + 3) * 2) / 2)
  }
  return b
}

export function StagePlot({ mode, selected, onSelect }: Props) {
  const { project, assignment, dispatch } = useProject()
  const { stage } = project
  const svgRef = useRef<SVGSVGElement>(null)
  const lighting = mode === 'lighting'
  const view = viewSettings(project)

  // Während eines Drags bleibt der Ausschnitt stehen, sonst springt das Element unter dem Finger.
  const [frozen, setFrozen] = useState<Bounds | null>(null)
  const live = plotBounds(project, mode, view.lights)
  const bounds = frozen ?? live
  const vx = bounds.minX * PX_PER_M
  const vy = bounds.minY * PX_PER_M
  const vw = (bounds.maxX - bounds.minX) * PX_PER_M
  const vh = (bounds.maxY - bounds.minY) * PX_PER_M
  const zp = useZoomPan(svgRef, { x: vx, y: vy, w: vw, h: vh }, () => onSelect(null))
  const vb = zp.viewBox
  // Gezoomt werden Knoten nicht größer, sondern es entsteht mehr Platz zwischen ihnen.
  const { unitsPerPx, widthPx } = useUnitsPerPx(svgRef, vb.w, vb.h)
  // Auf großen Flächen Knoten etwas größer zeichnen, auf dem Handy Basisgröße.
  const boost = Math.min(1.4, Math.max(1, widthPx / 520))
  const k = Math.min(4, Math.max(0.35, unitsPerPx * boost))

  const bind = useDrag(
    svgRef,
    (target, pos, session) => {
      if (!frozen) setFrozen(live)
      dispatch({ type: 'move', target, pos, coalesce: session })
    },
    (target) => onSelect(target),
    () => setFrozen(null),
  )

  const boxById = new Map(project.boxes.map((b) => [b.id, b]))
  const bundled = (project.cableView ?? 'bundled') === 'bundled'
  // Licht: Kabel nur als durchsichtige Andeutung, wenn eingeblendet
  const cablesInLighting = project.view?.sound.cables ?? DEFAULT_VIEW.sound.cables
  const showCables = !lighting || cablesInLighting
  const trees = useMemo(
    () => (bundled && (!lighting || cablesInLighting) ? routeProject(project, assignment) : null),
    [bundled, lighting, cablesInLighting, project, assignment],
  )
  const dmxProblems = useMemo(
    () => new Set(dmxIssues(project.fixtures).filter((i) => i.level === 'error').flatMap((i) => i.fixtureIds)),
    [project.fixtures],
  )
  const deviceById = new Map(project.devices.map((d) => [d.id, d]))
  const isSelected = (kind: ElementRef['kind'], id: string) => selected?.kind === kind && selected.id === id

  // Maßstab: im Lichtmodus am Rand des Ausschnitts, damit er nicht mit Traversen kollidiert
  const scaleY = lighting ? vb.y + 12 * k : -5 * k
  const scaleX = lighting ? vb.x + vb.w - 6 * k : -5 * k
  const W = stage.width * PX_PER_M
  const D = stage.depth * PX_PER_M
  const gridStep = stage.width > 24 || stage.depth > 24 ? 2 : 1
  const xs = range(0, stage.width, gridStep)
  const ys = range(0, stage.depth, gridStep)

  return (
    <div className="stage-wrap">
      <svg
        ref={svgRef}
        className="stage-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        // Ungezoomt darf die Seite über dem Plan scrollen; gezoomt gehören alle Gesten dem Plan.
        style={{ aspectRatio: `${vw} / ${vh}`, touchAction: zp.zoom > 1 ? 'none' : 'pan-y' }}
        role="img"
        aria-label={`Bühnenplan ${fmt(stage.width)} × ${fmt(stage.depth)} m`}
        {...zp.handlers}
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
            <text key={`lx${m}`} x={m * PX_PER_M} y={scaleY} textAnchor="middle">
              {m}
            </text>
          ))}
          {ys.map((m) => (
            <text key={`ly${m}`} x={scaleX} y={m * PX_PER_M} textAnchor="end" dominantBaseline="middle">
              {m}
            </text>
          ))}
          <text x={W + 5 * k} y={scaleY}>
            m
          </text>
        </g>
        <defs>
          <linearGradient id="beam-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="beam-stop-start" />
            <stop offset="1" className="beam-stop-end" />
          </linearGradient>
        </defs>
        <text className="stage-audience" x={W / 2} y={vy + vh - 10 * k} style={{ fontSize: 11 * k }}>
          PUBLIKUM · {fmt(stage.width)} × {fmt(stage.depth)} m
        </text>

        {/* Tonmodus mit eingeblendetem Licht: Traversen und Lampen grau im Hintergrund */}
        {!lighting && view.lights && (
          <g className="ghost-layer" aria-hidden="true">
            {project.trusses.map((t) => (
              <TrussNode key={t.id} truss={t} k={k} selected={false} ghost />
            ))}
            {project.fixtures.map((f) => (
              <GhostFixture key={f.id} fixture={f} k={k} />
            ))}
          </g>
        )}

        {/* Verbindungen Gruppe/Output → Box: gebündelt oder als Luftlinie */}
        <g className={lighting ? 'ghost-cables' : undefined}>
        {!showCables ? null : trees ? (
          <CableLines trees={trees} k={k} />
        ) : (
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
          {/* PA-Kette: Lautsprecher und Endstufen-Eingänge, die an einem Gerät hängen */}
          {[
            ...project.outputs.map((o) => ({ id: o.id, pos: o.pos, source: assignment.outputElements[o.id]?.source })),
            ...project.devices.flatMap((d) =>
              (assignment.deviceInputs[d.id] ?? []).map((a, i) => ({ id: `${d.id}:${i}`, pos: d.pos, source: a.source })),
            ),
          ].map(({ id, pos, source }) => {
            const from = source ? deviceById.get(source.deviceId) : undefined
            if (!from) return null
            return (
              <line
                key={`${id}-src`}
                x1={pos.x * PX_PER_M}
                y1={pos.y * PX_PER_M}
                x2={from.pos.x * PX_PER_M}
                y2={from.pos.y * PX_PER_M}
                style={{ stroke: deviceColor(project, assignment, from.id) ?? 'var(--text-muted)' }}
                strokeWidth={1.5 * k}
                strokeDasharray={`${5 * k} ${3 * k}`}
              />
            )
          })}
          {project.devices.flatMap((d) =>
            [...new Set((assignment.deviceInputs[d.id] ?? []).map((a) => a.boxId).filter((b): b is string => !!b))].map(
              (boxId) => {
                const box = boxById.get(boxId)!
                return (
                  <line
                    key={`${d.id}-${boxId}`}
                    x1={d.pos.x * PX_PER_M}
                    y1={d.pos.y * PX_PER_M}
                    x2={box.pos.x * PX_PER_M}
                    y2={box.pos.y * PX_PER_M}
                    stroke={box.color}
                    strokeWidth={1.5 * k}
                    strokeDasharray={`${2 * k} ${3 * k}`}
                  />
                )
              },
            ),
          )}
          {project.outputs.map((o) => {
            const boxId = assignment.outputElements[o.id]?.boxId
            const box = boxId ? boxById.get(boxId) : undefined
            if (!box) return null
            return (
              <line
                key={`${o.id}-${box.id}`}
                x1={o.pos.x * PX_PER_M}
                y1={o.pos.y * PX_PER_M}
                x2={box.pos.x * PX_PER_M}
                y2={box.pos.y * PX_PER_M}
                stroke={box.color}
                strokeWidth={1.5 * k}
                strokeDasharray={`${2 * k} ${3 * k}`}
              />
            )
          })}
        </g>
        )}
        </g>

        {lighting ? (
          <>
            {/* Ton-Elemente klein und grau, nicht anfassbar */}
            <g className="ghost-layer" aria-hidden="true">
              {view.sound.boxes && project.devices.map((d) => <GhostDevice key={d.id} device={d} k={k} />)}
              {project.outputs
                .filter((o) => (OFFSTAGE_OUTPUTS.includes(o.kind) ? view.sound.pa : view.sound.monitors))
                .map((o) => (
                  <GhostOutput key={o.id} output={o} k={k} />
                ))}
              {view.sound.instruments && project.groups.map((g) => <GhostGroup key={g.id} group={g} k={k} />)}
              {view.sound.boxes && project.boxes.map((b) => <GhostBox key={b.id} box={b} k={k} />)}
            </g>
            {project.trusses
              .slice()
              .sort((a, b) => Number(isSelected('truss', a.id)) - Number(isSelected('truss', b.id)))
              .map((t) => (
                <TrussNode key={t.id} truss={t} k={k} selected={isSelected('truss', t.id)} bind={bind({ kind: 'truss', id: t.id }, t.pos)} />
              ))}
            <g className="beams" aria-hidden="true">
              {project.fixtures.map((f) => (
                <Beam key={f.id} fixture={f} k={k} />
              ))}
            </g>
            {project.fixtures
              .slice()
              .sort((a, b) => Number(isSelected('fixture', a.id)) - Number(isSelected('fixture', b.id)))
              .map((f) => (
                <FixtureNode
                  key={f.id}
                  fixture={f}
                  k={k}
                  selected={isSelected('fixture', f.id)}
                  problem={dmxProblems.has(f.id)}
                  bind={bind({ kind: 'fixture', id: f.id }, f.pos)}
                />
              ))}
          </>
        ) : (
          <>
        {/* Reihenfolge: Instrumente, darüber Boxen (Kapazität bleibt lesbar), ausgewähltes Element ganz oben. */}
        {[
          ...project.devices.map((d) => ({ kind: 'device' as const, el: d })),
          ...project.outputs.map((o) => ({ kind: 'output' as const, el: o })),
          ...project.groups.map((g) => ({ kind: 'group' as const, el: g })),
          ...project.boxes.map((b) => ({ kind: 'box' as const, el: b })),
        ]
          .sort((a, b) => Number(isSelected(a.kind, a.el.id)) - Number(isSelected(b.kind, b.el.id)))
          .map((item) =>
            item.kind === 'device' ? (
              <DeviceNode
                key={item.el.id}
                device={item.el}
                color={deviceColor(project, assignment, item.el.id)}
                k={k}
                selected={isSelected('device', item.el.id)}
                bind={bind({ kind: 'device', id: item.el.id }, item.el.pos)}
              />
            ) : item.kind === 'output' ? (
              <OutputNode
                key={item.el.id}
                output={item.el}
                assignment={assignment.outputElements[item.el.id]}
                boxById={boxById}
                chainColor={
                  assignment.outputElements[item.el.id]?.source
                    ? deviceColor(project, assignment, assignment.outputElements[item.el.id].source!.deviceId)
                    : null
                }
                k={k}
                selected={isSelected('output', item.el.id)}
                bind={bind({ kind: 'output', id: item.el.id }, item.el.pos)}
              />
            ) : item.kind === 'box' ? (
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

        {trees && <CableLabels trees={trees} k={k} />}
          </>
        )}
      </svg>
      <div className="zoom-controls" role="group" aria-label="Zoom">
        <button type="button" className="icon-btn" aria-label="Vergrößern" onClick={zp.zoomIn} disabled={zp.zoom >= ZOOM_LIMITS.max}>
          +
        </button>
        <button type="button" className="icon-btn" aria-label="Verkleinern" onClick={zp.zoomOut} disabled={zp.zoom <= ZOOM_LIMITS.min}>
          −
        </button>
        <button type="button" className="icon-btn" aria-label="Ganze Bühne zeigen" onClick={zp.reset} disabled={zp.zoom <= ZOOM_LIMITS.min}>
          ⤢
        </button>
      </div>
    </div>
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
