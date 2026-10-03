import { STAGE_LIMITS } from '../../model/defaults'
import { useProject } from '../../state/useProject'
import { Stepper } from '../ui/Stepper'
import { TextField } from '../ui/TextField'
import { Segmented } from '../ui/Toggle'

const PRESETS = [
  { label: 'Club', width: 6, depth: 4 },
  { label: 'Standard', width: 10, depth: 6 },
  { label: 'Halle', width: 12, depth: 8 },
  { label: 'Open Air', width: 16, depth: 10 },
]

export function ProjectSettings() {
  const { project, dispatch } = useProject()
  const { stage } = project
  const setStage = (patch: Partial<typeof stage>) => dispatch({ type: 'setStage', stage: { ...stage, ...patch } })

  return (
    <div className="editor">
      <TextField label="Projektname" value={project.name} onChange={(name) => dispatch({ type: 'setName', name })} />
      <div className="field-row">
        <Stepper
          label="Breite"
          value={stage.width}
          min={STAGE_LIMITS.min}
          max={STAGE_LIMITS.max}
          step={STAGE_LIMITS.step}
          decimals={1}
          unit="m"
          onChange={(width) => setStage({ width })}
        />
        <Stepper
          label="Tiefe"
          value={stage.depth}
          min={STAGE_LIMITS.min}
          max={STAGE_LIMITS.max}
          step={STAGE_LIMITS.step}
          decimals={1}
          unit="m"
          onChange={(depth) => setStage({ depth })}
        />
      </div>
      <div className="field">
        <span className="field-label">Schnellauswahl</span>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn"
              aria-pressed={stage.width === p.width && stage.depth === p.depth}
              onClick={() => setStage({ width: p.width, depth: p.depth })}
            >
              {p.label}
              <small>
                {p.width} × {p.depth} m
              </small>
            </button>
          ))}
        </div>
      </div>
      <Segmented
        label="Kabel im Plan"
        value={project.cableView ?? 'bundled'}
        options={[
          { value: 'bundled', label: 'Gebündelt' },
          { value: 'direct', label: 'Luftlinie' },
        ]}
        onChange={(cableView) => dispatch({ type: 'setCableView', cableView })}
      />
      <p className="hint">
        Breite = von links nach rechts (Sicht Publikum), Tiefe = von der Rückwand bis zur Bühnenkante. Beim
        Verkleinern werden Elemente an den Rand geschoben.
      </p>
    </div>
  )
}
