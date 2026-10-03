import { useState } from 'react'
import {
  AMP_PRESETS,
  CONNECTORS,
  CONNECTOR_LABELS,
  CROSSOVER_PRESETS,
  DEVICE_LABELS,
  FILTER_LABELS,
  FILTER_SLOPES,
  LIMITS,
  applyCrossoverPreset,
  clampFrequency,
  consumersOf,
  crossoverIssues,
  describeFilter,
  inputLabel,
  outputLabel,
  setAmpChannels,
  setCrossoverInputs,
  setCrossoverOutputs,
  sourcesForDeviceInput,
} from '../../model/devices'
import type { ConnectorType, Device, DeviceOutput, FilterSlope, FilterType } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Stepper } from '../ui/Stepper'
import { TextField } from '../ui/TextField'
import { Segmented, Toggle } from '../ui/Toggle'
import { BoxPicker } from './BoxPicker'
import { SourceSelect } from './SourceSelect'

interface Props {
  device: Device
  onDone: () => void
}

/** Editor für Frequenzweiche und Endstufe: Vorlagen, Ein-/Ausgänge, Filter bzw. Kanäle. */
export function DeviceEditor({ device, onDone }: Props) {
  const { project, dispatch, assignment } = useProject()
  const save = (next: Device) => dispatch({ type: 'updateDevice', id: device.id, device: next })
  const inputs = assignment.deviceInputs[device.id] ?? []
  const boxFed = inputs.some((a) => !a.source)

  return (
    <div className="editor">
      <TextField label="Name" value={device.name} onChange={(name) => save({ ...device, name })} />
      {device.kind === 'crossover' ? (
        <CrossoverConfig device={device} save={save} />
      ) : (
        <AmpConfig device={device} save={save} />
      )}

      {boxFed && (
        <BoxPicker
          boxes={project.boxes}
          pinnedBoxId={device.pinnedBoxId}
          onChange={(pinnedBoxId) => save({ ...device, pinnedBoxId })}
        />
      )}

      <div className="editor-actions">
        <ConfirmButton
          onConfirm={() => {
            dispatch({ type: 'delete', target: { kind: 'device', id: device.id } })
            onDone()
          }}
        >
          {DEVICE_LABELS[device.kind]} löschen
        </ConfirmButton>
      </div>
    </div>
  )
}

function ConnectorSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: ConnectorType
  options: ConnectorType[]
  onChange: (c: ConnectorType) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value as ConnectorType)}>
        {options.map((c) => (
          <option key={c} value={c}>
            {CONNECTOR_LABELS[c]}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Wohin geht ein Geräte-Ausgang? (Endstufen-Kanäle, Lautsprecher) */
function Targets({ device, output }: { device: Device; output: number }) {
  const { project } = useProject()
  const consumers = consumersOf(project, device.id, output)
  return (
    <span className={`targets${consumers.length ? '' : ' none'}`}>
      {consumers.length ? `→ ${consumers.map((c) => c.label).join(', ')}` : 'nicht verbunden'}
    </span>
  )
}

/** Woher kommt ein Geräte-Eingang? Stagebox-Port oder (Endstufe) Weichen-Ausgang. */
function InputFeed({ device, index, save }: { device: Device; index: number; save: (d: Device) => void }) {
  const { project, assignment } = useProject()
  const a = assignment.deviceInputs[device.id]?.[index]
  const options = sourcesForDeviceInput(project, device)
  const boxLabel = a?.unused
    ? 'Stagebox · frei (am Ausgang hängt nichts)'
    : a?.label
      ? `Stagebox · ${a.label}`
      : 'Stagebox · kein freier Output'
  if (options.length === 0) return <span className={`feed${a?.label ? '' : ' none'}`}>← {boxLabel}</span>
  return (
    <SourceSelect
      label={`${inputLabel(device, index)} gespeist von`}
      value={device.inputs[index].source}
      boxLabel={a?.source ? 'Stagebox (automatisch)' : boxLabel}
      options={options}
      onChange={(source) =>
        save({
          ...device,
          inputs: device.inputs.map((x, n) => {
            if (n !== index) return x
            const next = { ...x, source }
            if (!source) delete next.source
            return next
          }),
        })
      }
    />
  )
}

// ---------- Frequenzweiche ----------

function CrossoverConfig({ device, save }: { device: Device; save: (d: Device) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const issues = crossoverIssues(device)
  const updateOutput = (i: number, patch: Partial<DeviceOutput>) => {
    const outputs = device.outputs.map((o, n) => {
      if (n !== i) return o
      const next = { ...o, ...patch }
      if (next.hp === undefined) delete next.hp
      if (next.lp === undefined) delete next.lp
      return next
    })
    save({ ...device, outputs })
  }
  const current = CROSSOVER_PRESETS.find(
    (p) =>
      p.inputs.length === device.inputs.length &&
      p.outputs.length === device.outputs.length &&
      p.outputs.every(
        (o, i) =>
          o.name === device.outputs[i].name &&
          o.hp === device.outputs[i].hp &&
          o.lp === device.outputs[i].lp &&
          JSON.stringify(o.from) === JSON.stringify(device.outputs[i].from),
      ),
  )

  return (
    <>
      <div className="field">
        <span className="field-label">Vorlage</span>
        <div className="preset-row">
          {CROSSOVER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn"
              aria-pressed={current?.id === p.id}
              onClick={() => save(applyCrossoverPreset(device, p.id))}
            >
              {p.label}
              <small>
                {p.inputs.length} In · {p.outputs.length} Out
              </small>
            </button>
          ))}
        </div>
      </div>

      <section className="io-section">
        <div className="field-row">
          <Stepper
            label="Eingänge"
            value={device.inputs.length}
            min={LIMITS.crossoverInputs.min}
            max={LIMITS.crossoverInputs.max}
            onChange={(n) => save(setCrossoverInputs(device, n))}
          />
          <Stepper
            label="Ausgänge"
            value={device.outputs.length}
            min={LIMITS.crossoverOutputs.min}
            max={LIMITS.crossoverOutputs.max}
            onChange={(n) => save(setCrossoverOutputs(device, n))}
          />
        </div>
        <span className="field-label">Eingänge</span>
        <ul className="io-list">
          {device.inputs.map((input, i) => (
            <li key={i}>
              <div className="io-head">
                <strong>{inputLabel(device, i)}</strong>
                <InputFeed device={device} index={i} save={save} />
              </div>
              <div className="field-row">
                <TextField
                  label="Name"
                  value={input.name}
                  onChange={(name) => save({ ...device, inputs: device.inputs.map((x, n) => (n === i ? { ...x, name } : x)) })}
                />
                <ConnectorSelect
                  label="Anschluss"
                  value={input.connector}
                  options={CONNECTORS.crossover.inputs}
                  onChange={(connector) =>
                    save({ ...device, inputs: device.inputs.map((x, n) => (n === i ? { ...x, connector } : x)) })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="io-section">
        <span className="field-label">Ausgänge · Filter</span>
        <ol className="channel-list editable">
          {device.outputs.map((o, i) => {
            const isOpen = open === i
            return (
              <li key={i} className={isOpen ? 'open' : ''}>
                <button
                  type="button"
                  className="channel-row"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="channel-index">{i + 1}</span>
                  <span className="channel-name">
                    {o.name}
                    <small className="channel-note">
                      {describeFilter(o)} · von {(o.from ?? []).map((f) => device.inputs[f]?.name ?? '?').join(' + ') || '—'}
                    </small>
                    <Targets device={device} output={i} />
                  </span>
                  <span className="chevron" aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </button>
                {isOpen && <CrossoverOutputForm device={device} index={i} update={(patch) => updateOutput(i, patch)} />}
              </li>
            )
          })}
        </ol>
      </section>

      {issues.length > 0 && (
        <ul className="warnings">
          {issues.map((text) => (
            <li key={text} className="warning warning-warning">
              <span className="warning-text">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CrossoverOutputForm({
  device,
  index,
  update,
}: {
  device: Device
  index: number
  update: (patch: Partial<DeviceOutput>) => void
}) {
  const o = device.outputs[index]
  const from = o.from ?? []
  return (
    <div className="channel-form">
      <div className="field-row">
        <TextField label="Name" value={o.name} onChange={(name) => update({ name })} />
        <ConnectorSelect
          label="Anschluss"
          value={o.connector}
          options={CONNECTORS.crossover.outputs}
          onChange={(connector) => update({ connector })}
        />
      </div>
      <div className="field">
        <span className="field-label">Gespeist von (summiert)</span>
        <div className="toggle-row">
          {device.inputs.map((input, n) => (
            <Toggle
              key={n}
              pressed={from.includes(n)}
              onChange={(on) => update({ from: on ? [...from, n].sort() : from.filter((f) => f !== n) })}
            >
              {inputLabel(device, n)} · {input.name}
            </Toggle>
          ))}
        </div>
      </div>
      <div className="filter-grid">
        {/* Startwerte passend zum anderen Filter: z. B. Sub mit LP 100 Hz bekommt HP ~33 Hz */}
        <FrequencyField
          label="Hochpass"
          value={o.hp}
          fallback={o.lp !== undefined ? clampFrequency(o.lp / 3) : 100}
          onChange={(hp) => update({ hp })}
        />
        <FrequencyField
          label="Tiefpass"
          value={o.lp}
          fallback={o.hp !== undefined ? clampFrequency(o.hp * 10) : 100}
          onChange={(lp) => update({ lp })}
        />
      </div>
      {(o.hp !== undefined || o.lp !== undefined) && (
        <>
          <Segmented
            label="Flankensteilheit"
            value={String(o.slope ?? 24)}
            options={FILTER_SLOPES.map((s) => ({ value: String(s), label: `${s} dB` }))}
            onChange={(v) => update({ slope: Number(v) as FilterSlope })}
          />
          <Segmented
            label="Charakteristik"
            value={o.filter ?? 'lr'}
            options={(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
            onChange={(filter) => update({ filter })}
          />
        </>
      )}
      <p className="hint">
        {outputLabel(device, index)}: {describeFilter(o)} <Targets device={device} output={index} />
      </p>
    </div>
  )
}

/** Filterfrequenz mit Ein/Aus-Schalter. */
function FrequencyField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: number | undefined
  fallback: number
  onChange: (hz: number | undefined) => void
}) {
  const on = value !== undefined
  return (
    <div className="frequency-field">
      <Toggle pressed={on} onChange={(next) => onChange(next ? fallback : undefined)}>
        {label}
      </Toggle>
      {on && (
        <Stepper
          label={`${label} (Hz)`}
          value={value}
          min={LIMITS.frequency.min}
          max={LIMITS.frequency.max}
          step={value >= 1000 ? 100 : 10}
          unit="Hz"
          onChange={(hz) => onChange(clampFrequency(hz))}
        />
      )}
    </div>
  )
}

// ---------- Endstufe ----------

function AmpConfig({ device, save }: { device: Device; save: (d: Device) => void }) {
  const power = device.power ?? { watts: 1000, ohms: 4 }
  const current = AMP_PRESETS.find(
    (p) => p.channels === device.inputs.length && p.watts === power.watts && p.ohms === power.ohms,
  )
  const setAllConnectors = (side: 'inputs' | 'outputs', connector: ConnectorType) =>
    save({ ...device, [side]: device[side].map((x) => ({ ...x, connector })) })

  return (
    <>
      <div className="field">
        <span className="field-label">Vorlage</span>
        <div className="preset-row">
          {AMP_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn"
              aria-pressed={current?.id === p.id}
              onClick={() => save({ ...setAmpChannels(device, p.channels), power: { watts: p.watts, ohms: p.ohms } })}
            >
              {p.label}
              <small>@ {p.ohms} Ω</small>
            </button>
          ))}
        </div>
      </div>

      <div className="counter-grid">
        <Stepper
          label="Kanäle"
          value={device.inputs.length}
          min={LIMITS.ampChannels.min}
          max={LIMITS.ampChannels.max}
          onChange={(n) => save(setAmpChannels(device, n))}
        />
        <Stepper
          label="Leistung pro Kanal"
          value={power.watts}
          min={50}
          max={20000}
          step={50}
          unit="W"
          onChange={(watts) => save({ ...device, power: { ...power, watts } })}
        />
      </div>
      <Segmented
        label="bei Impedanz"
        value={String(power.ohms)}
        options={[2, 4, 8, 16].map((o) => ({ value: String(o), label: `${o} Ω` }))}
        onChange={(v) => save({ ...device, power: { ...power, ohms: Number(v) } })}
      />
      <div className="field-row">
        <ConnectorSelect
          label="Eingänge"
          value={device.inputs[0]?.connector ?? 'xlr'}
          options={CONNECTORS.amp.inputs}
          onChange={(c) => setAllConnectors('inputs', c)}
        />
        <ConnectorSelect
          label="Ausgänge"
          value={device.outputs[0]?.connector ?? 'speakon-nl4'}
          options={CONNECTORS.amp.outputs}
          onChange={(c) => setAllConnectors('outputs', c)}
        />
      </div>

      <section className="io-section">
        <span className="field-label">Kanäle</span>
        <ul className="io-list">
          {device.inputs.map((_, i) => (
            <li key={i}>
              <div className="io-head">
                <strong>{inputLabel(device, i)}</strong>
                <Targets device={device} output={i} />
              </div>
              <InputFeed device={device} index={i} save={save} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
