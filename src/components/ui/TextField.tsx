import { useState } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Leere Eingabe übernehmen (z. B. Notiz löschen). */
  allowEmpty?: boolean
  list?: string
}

/** Textfeld, das beim Verlassen übernimmt (leere Eingabe wird verworfen). */
export function TextField({ label, value, onChange, placeholder, allowEmpty = false, list }: Props) {
  // Während der Eingabe gilt der Entwurf, sonst der Wert aus dem Projekt.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const trimmed = (draft ?? '').trim()
    if (draft !== null && (trimmed || allowEmpty) && trimmed !== value) onChange(trimmed)
    setDraft(null)
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="text-input"
        value={draft ?? value}
        placeholder={placeholder}
        list={list}
        onFocus={() => setDraft(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </label>
  )
}
