import type { SourceOption } from '../../model/devices'
import type { SignalSource } from '../../model/types'

interface Props {
  label: string
  value: SignalSource | undefined
  /** Text für „direkt von der Stagebox“, z. B. mit dem belegten Port. */
  boxLabel: string
  options: SourceOption[]
  onChange: (source: SignalSource | undefined) => void
}

const key = (s: SignalSource) => `${s.deviceId}:${s.output}`

/** Signalquelle wählen: Stagebox oder ein Geräte-Ausgang (Weiche/Endstufe). */
export function SourceSelect({ label, value, boxLabel, options, onChange }: Props) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        className="select"
        value={value ? key(value) : ''}
        onChange={(e) => onChange(options.find((o) => key(o.source) === e.target.value)?.source)}
      >
        <option value="">{boxLabel}</option>
        {options.map((o) => (
          <option key={key(o.source)} value={key(o.source)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
