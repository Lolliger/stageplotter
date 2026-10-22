import { formatRange } from '../../lib/dmx'
import { TRUSS_LIMITS } from '../../model/lights'
import { normalizeRotation } from '../../model/shapes'
import type { Truss } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Stepper } from '../ui/Stepper'
import { TextField } from '../ui/TextField'

const STEPS = [-45, -15, 15, 45]

export function TrussEditor({
  truss,
  onDone,
  onAddFixtures,
  onSelectFixture,
}: {
  truss: Truss
  onDone: () => void
  onAddFixtures: () => void
  onSelectFixture: (id: string) => void
}) {
  const { project, dispatch } = useProject()
  const update = (patch: Partial<Truss>) => dispatch({ type: 'updateTruss', id: truss.id, patch })
  const rotation = normalizeRotation(truss.rotation ?? 0)
  const fixtures = project.fixtures.filter((f) => f.trussId === truss.id)
  const along = rotation % 180 === 0 ? 'quer' : rotation % 180 === 90 ? 'längs' : 'schräg'

  return (
    <div className="editor">
      <TextField label="Name" value={truss.name} onChange={(name) => update({ name })} />
      <Stepper
        label="Länge"
        value={truss.length}
        min={TRUSS_LIMITS.min}
        max={TRUSS_LIMITS.max}
        step={TRUSS_LIMITS.step}
        decimals={1}
        unit="m"
        onChange={(length) => update({ length })}
      />
      <div className="field">
        <span className="field-label">
          Richtung · {rotation}° · {along}
        </span>
        <div className="rotation">
          <div className="rotation-dirs" role="radiogroup" aria-label="Richtung">
            <button type="button" role="radio" aria-checked={rotation === 0} title="Quer (parallel zur Bühnenkante)" aria-label="Quer" onClick={() => update({ rotation: 0 })}>
              ↔
            </button>
            <button type="button" role="radio" aria-checked={rotation === 90} title="Längs (zum Publikum)" aria-label="Längs" onClick={() => update({ rotation: 90 })}>
              ↕
            </button>
          </div>
          <div className="rotation-steps">
            {STEPS.map((step) => (
              <button
                key={step}
                type="button"
                className="btn"
                aria-label={`${Math.abs(step)}° ${step < 0 ? 'gegen den' : 'im'} Uhrzeigersinn drehen`}
                onClick={() => update({ rotation: normalizeRotation(rotation + step) })}
              >
                {step < 0 ? '↺' : '↻'} {Math.abs(step)}°
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="hint">Lampen an der Traverse wandern beim Verschieben und Drehen mit.</p>

      <section className="menu-section">
        <h3>Lampen an dieser Traverse · {fixtures.length}</h3>
        {fixtures.length > 0 && (
          <ul className="chips">
            {fixtures
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((f) => (
                <li key={f.id}>
                  <button type="button" className="chip" onClick={() => onSelectFixture(f.id)}>
                    #{f.number} {f.name} · {formatRange(f)}
                  </button>
                </li>
              ))}
          </ul>
        )}
        <div>
          <button type="button" className="btn" onClick={onAddFixtures}>
            Lampen auf diese Traverse …
          </button>
        </div>
      </section>

      <div className="editor-actions">
        <ConfirmButton
          onConfirm={() => {
            dispatch({ type: 'delete', target: { kind: 'truss', id: truss.id } })
            onDone()
          }}
        >
          Traverse löschen
        </ConfirmButton>
      </div>
    </div>
  )
}
