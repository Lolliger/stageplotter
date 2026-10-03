import type { ReactNode } from 'react'

interface ToggleProps {
  pressed: boolean
  onChange: (pressed: boolean) => void
  children: ReactNode
}

/** Großer Ein/Aus-Schalter als Chip. */
export function Toggle({ pressed, onChange, children }: ToggleProps) {
  return (
    <button type="button" className="toggle" aria-pressed={pressed} onClick={() => onChange(!pressed)}>
      <span className="toggle-check" aria-hidden="true">
        {pressed ? '✓' : ''}
      </span>
      {children}
    </button>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
