import { STAGE_LIMITS } from '../../model/defaults'
import { viewSettings } from '../../model/lights'
import type { ViewSettings } from '../../model/types'
import type { PlotMode } from '../../state/mode'
import { useProject } from '../../state/useProject'
import { Stepper } from '../ui/Stepper'
import { TextField } from '../ui/TextField'
import { Segmented, Toggle } from '../ui/Toggle'

const PRESETS = [
  { label: 'Club', width: 6, depth: 4 },
  { label: 'Standard', width: 10, depth: 6 },
  { label: 'Halle', width: 12, depth: 8 },
  { label: 'Open Air', width: 16, depth: 10 },
]

const SOUND_IN_LIGHT: { key: keyof ViewSettings['sound']; label: string }[] = [
  { key: 'instruments', label: 'Instrumente' },
  { key: 'pa', label: 'PA & Subs' },
  { key: 'monitors', label: 'Wedges, IEMs, Sidefills' },
  { key: 'boxes', label: 'Stageboxen & PA-Technik' },
  { key: 'cables', label: 'Kabel' },
]

/** Was vom anderen Gewerk zu sehen ist; der aktuelle Modus steht oben. */
function Visibility({ mode }: { mode: PlotMode }) {
  const { project, dispatch } = useProject()
  const view = viewSettings(project)
  const set = (next: ViewSettings) => dispatch({ type: 'setView', view: next })
  const light = (
    <div className="field" key="light">
      <span className="field-label">Im Lichtplot zeigen (klein und grau)</span>
      <div className="toggle-row">
        {SOUND_IN_LIGHT.map(({ key, label }) => (
          <Toggle key={key} pressed={view.sound[key]} onChange={(on) => set({ ...view, sound: { ...view.sound, [key]: on } })}>
            {label}
          </Toggle>
        ))}
      </div>
    </div>
  )
  const sound = (
    <div className="field" key="sound">
      <span className="field-label">Im Tonplot zeigen</span>
      <div className="toggle-row">
        <Toggle pressed={view.lights} onChange={(lights) => set({ ...view, lights })}>
          Lampen und Traversen (klein und grau)
        </Toggle>
      </div>
    </div>
  )
  return <>{mode === 'lighting' ? [light, sound] : [sound, light]}</>
}

export function ProjectSettings({ mode }: { mode: PlotMode }) {
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
      <div className="field">
        <span className="field-label">Verschieben</span>
        <div className="toggle-row">
          <Toggle pressed={!!project.snap} onChange={(snap) => dispatch({ type: 'setSnap', snap })}>
            Am Raster einrasten (25 cm)
          </Toggle>
        </div>
      </div>
      <Visibility mode={mode} />
      <p className="hint">
        Breite = von links nach rechts (Sicht Publikum), Tiefe = von der Rückwand bis zur Bühnenkante. Beim
        Verkleinern werden Elemente an den Rand geschoben.
      </p>
    </div>
  )
}
