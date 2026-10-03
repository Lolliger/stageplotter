import { useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  decimals?: number
}

function format(value: number, decimals: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: decimals, useGrouping: false })
}

/** Zahleneingabe mit großen − / + Buttons für Touch. */
export function Stepper({ label, value, onChange, min = 0, max = Infinity, step = 1, unit, decimals = 0 }: Props) {
  // Während der Eingabe gilt der Entwurf, sonst der Wert aus dem Projekt.
  const [draft, setDraft] = useState<string | null>(null)

  const clampValue = (v: number) => Math.min(max, Math.max(min, v))
  const commit = (raw: string) => {
    const parsed = Number(raw.replace(',', '.'))
    if (raw.trim() !== '' && Number.isFinite(parsed)) onChange(clampValue(parsed))
  }
  const bump = (dir: 1 | -1) => {
    const next = Math.round((value + dir * step) / step) * step
    onChange(clampValue(Number(next.toFixed(4))))
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`${label} verringern`} onClick={() => bump(-1)} disabled={value <= min}>
          −
        </button>
        <label className="stepper-input">
          <input
            inputMode={decimals > 0 ? 'decimal' : 'numeric'}
            value={draft ?? format(value, decimals)}
            aria-label={label}
            onFocus={(e) => {
              setDraft(e.currentTarget.value)
              e.currentTarget.select()
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              setDraft(null)
              commit(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          {unit && <span className="unit">{unit}</span>}
        </label>
        <button type="button" aria-label={`${label} erhöhen`} onClick={() => bump(1)} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  )
}
