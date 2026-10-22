import { useState } from 'react'
import { FIXTURE_ORDER, FIXTURE_TYPES, createFixtures } from '../../model/lights'
import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'
import { Stepper } from '../ui/Stepper'

interface Props {
  /** Vorauswahl, z. B. aus dem Traversen-Editor. */
  trussId?: string
  onAdded: (target: ElementRef | null) => void
}

/** Lampen aus der Bibliothek hinzufügen – einzeln oder mehrere gleichmäßig auf eine Traverse. */
export function AddFixture({ trussId: initialTruss, onAdded }: Props) {
  const { project, dispatch } = useProject()
  const [count, setCount] = useState(1)
  const [trussId, setTrussId] = useState(initialTruss ?? project.trusses[0]?.id ?? '')

  const add = (kind: (typeof FIXTURE_ORDER)[number]) => {
    const fixtures = createFixtures(project, kind, count, trussId || undefined)
    dispatch({ type: 'addFixtures', fixtures })
    // Eine Lampe gleich bearbeiten, bei mehreren zurück zum Plan
    onAdded(fixtures.length === 1 ? { kind: 'fixture', id: fixtures[0].id } : null)
  }

  return (
    <div className="editor">
      <div className="field-row">
        <Stepper label="Anzahl" value={count} min={1} max={24} onChange={setCount} />
        <label className="field">
          <span className="field-label">Hängt an</span>
          <select className="select" value={trussId} onChange={(e) => setTrussId(e.target.value)}>
            <option value="">Frei (Bühnenmitte)</option>
            {project.trusses.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.length.toLocaleString('de-DE')} m
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="template-group">
        <h3>Lampentyp</h3>
        <div className="template-grid">
          {FIXTURE_ORDER.map((kind) => {
            const type = FIXTURE_TYPES[kind]
            const channels = type.modes.map((m) => m.channels).join('/')
            return (
              <button key={kind} type="button" className="template-btn" onClick={() => add(kind)}>
                <span className="template-label">
                  {count > 1 ? `${count} × ` : ''}
                  {type.label}
                </span>
                <span className="template-meta">
                  {type.abbr} · {kind === 'custom' ? 'Kanäle frei wählbar' : `${channels} Kanäle`}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <p className="hint">
        Adressen vergibst du danach einzeln in der Lampe oder für alle auf einmal über „Adressen“. Auf einer
        Traverse werden die Lampen gleichmäßig verteilt.
      </p>
    </div>
  )
}
