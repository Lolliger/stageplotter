import { dmxIssues, formatRange, nextFreeAddress } from '../../lib/dmx'
import { newId } from '../../lib/id'
import {
  FIXTURE_CHANNEL_LIMITS,
  FIXTURE_ORDER,
  FIXTURE_TYPES,
  UNIVERSE_LIMITS,
  nextFixtureNumber,
  pointOnTruss,
  trussOffset,
} from '../../model/lights'
import type { Fixture, FixtureKind } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Stepper } from '../ui/Stepper'
import { TextField } from '../ui/TextField'
import { RotationControl } from './RotationControl'

const CUSTOM_MODE = '__custom'

export function FixtureEditor({ fixture, onDone, onSelect }: { fixture: Fixture; onDone: () => void; onSelect: (id: string) => void }) {
  const { project, dispatch } = useProject()
  const update = (patch: Partial<Fixture>) => dispatch({ type: 'updateFixture', id: fixture.id, patch })
  const type = FIXTURE_TYPES[fixture.kind]
  const mode = type.modes.find((m) => m.name === fixture.mode && m.channels === fixture.channels)
  const truss = fixture.trussId ? project.trusses.find((t) => t.id === fixture.trussId) : undefined
  const issues = dmxIssues(project.fixtures).filter((i) => i.fixtureIds.includes(fixture.id))
  const free = nextFreeAddress(project.fixtures, fixture.universe, fixture.channels, fixture.id)

  const setKind = (kind: FixtureKind) => {
    const first = FIXTURE_TYPES[kind].modes[0]
    // Name mitnehmen, solange er noch der Typname war
    const name = fixture.name === type.label ? FIXTURE_TYPES[kind].label : fixture.name
    update({ kind, name, mode: first.name, channels: first.channels })
  }

  const setMode = (value: string) => {
    if (value === CUSTOM_MODE) return update({ mode: undefined })
    const m = type.modes.find((x) => x.name === value)
    if (m) update({ mode: m.name, channels: m.channels })
  }

  const hangOn = (trussId: string) => {
    const t = project.trusses.find((x) => x.id === trussId)
    if (!t) return update({ trussId: undefined })
    update({ trussId, pos: pointOnTruss(t, trussOffset(t, fixture.pos).along) })
  }

  const duplicate = () => {
    const copy: Fixture = {
      ...fixture,
      id: newId(),
      number: nextFixtureNumber(project.fixtures),
      pos: truss ? pointOnTruss(truss, trussOffset(truss, fixture.pos).along + 0.6) : { x: fixture.pos.x + 0.6, y: fixture.pos.y },
    }
    delete copy.address
    dispatch({ type: 'addFixtures', fixtures: [copy] })
    onSelect(copy.id)
  }

  return (
    <div className="editor">
      <div className="field-row">
        <Stepper label="Nummer" value={fixture.number} min={1} max={9999} onChange={(number) => update({ number })} />
        <TextField label="Name" value={fixture.name} onChange={(name) => update({ name })} />
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Typ</span>
          <select className="select" value={fixture.kind} onChange={(e) => setKind(e.target.value as FixtureKind)}>
            {FIXTURE_ORDER.map((k) => (
              <option key={k} value={k}>
                {FIXTURE_TYPES[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Modus</span>
          <select className="select" value={mode ? mode.name : CUSTOM_MODE} onChange={(e) => setMode(e.target.value)}>
            {type.modes.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
            <option value={CUSTOM_MODE}>Eigene Kanalzahl</option>
          </select>
        </label>
      </div>
      <TextField
        label="Gerät (optional)"
        value={fixture.model ?? ''}
        placeholder="z. B. Cameo Zenit W600"
        allowEmpty
        onChange={(model) => update({ model: model || undefined })}
      />

      <section className="menu-section">
        <h3>DMX</h3>
        <div className="field-row">
          <Stepper
            label="Kanäle"
            value={fixture.channels}
            min={FIXTURE_CHANNEL_LIMITS.min}
            max={FIXTURE_CHANNEL_LIMITS.max}
            onChange={(channels) => update({ channels, mode: type.modes.find((m) => m.channels === channels)?.name })}
          />
          <Stepper
            label="Universe"
            value={fixture.universe}
            min={UNIVERSE_LIMITS.min}
            max={UNIVERSE_LIMITS.max}
            onChange={(universe) => update({ universe })}
          />
          {fixture.address !== undefined && (
            <Stepper label="Adresse" value={fixture.address} min={1} max={512} onChange={(address) => update({ address })} />
          )}
        </div>
        <p className="dmx-range">
          {fixture.address === undefined ? 'Noch keine Adresse' : `Belegt ${formatRange(fixture)}`}
        </p>
        <div className="menu-row">
          {free !== null && free !== fixture.address && (
            <button type="button" className="btn" onClick={() => update({ address: free })}>
              {fixture.address === undefined ? 'Adresse vergeben' : 'Nächste freie'}: {fixture.universe}.{String(free).padStart(3, '0')}
            </button>
          )}
          {fixture.address !== undefined && (
            <button type="button" className="btn" onClick={() => update({ address: undefined })}>
              Adresse entfernen
            </button>
          )}
        </div>
        {issues.map((i) => (
          <p key={i.message} className={`hint ${i.level === 'error' ? 'hint-error' : 'hint-warning'}`}>
            {i.message}
          </p>
        ))}
      </section>

      <RotationControl front="down" verb="leuchtet" rotation={fixture.rotation ?? 0} onChange={(rotation) => update({ rotation })} />

      <label className="field">
        <span className="field-label">Traverse</span>
        <select className="select" value={fixture.trussId ?? ''} onChange={(e) => hangOn(e.target.value)}>
          <option value="">Hängt frei / steht am Boden</option>
          {project.trusses.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="field-row">
        <TextField
          label="Farbe / Filter"
          value={fixture.color ?? ''}
          placeholder="z. B. L201, Warmweiß"
          allowEmpty
          onChange={(color) => update({ color: color || undefined })}
        />
        <TextField label="Notiz" value={fixture.note ?? ''} allowEmpty onChange={(note) => update({ note: note || undefined })} />
      </div>

      <div className="editor-actions">
        <button type="button" className="btn" onClick={duplicate}>
          Kopie anlegen
        </button>
        <ConfirmButton
          onConfirm={() => {
            dispatch({ type: 'delete', target: { kind: 'fixture', id: fixture.id } })
            onDone()
          }}
        >
          Lampe löschen
        </ConfirmButton>
      </div>
    </div>
  )
}
