import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { PlotMode } from '../../state/mode'

interface Props {
  mode: PlotMode
  onChange: (mode: PlotMode) => void
}

interface Wipe {
  to: PlotMode
  x: number
  y: number
  key: number
}

/** Dauer, bis die Farbwelle den Bildschirm bedeckt (dann wird umgeschaltet), und Ausblenden. */
const COVER_MS = 380
const FADE_MS = 520

/**
 * Schalter „Ton | Licht“. Beim Wechsel läuft ein Farbverlauf kreisförmig vom Schalter über die
 * Seite; unter dem Verlauf wird umgeschaltet. Bei „Bewegung reduzieren“ nur sofort umschalten.
 */
export function ModeSwitch({ mode, onChange }: Props) {
  const [wipe, setWipe] = useState<Wipe | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const pick = (next: PlotMode, e: MouseEvent<HTMLButtonElement>) => {
    if (next === mode || wipe) return
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      onChange(next)
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    setWipe({ to: next, x: r.left + r.width / 2, y: r.top + r.height / 2, key: Date.now() })
    timers.current.push(
      window.setTimeout(() => onChange(next), COVER_MS),
      window.setTimeout(() => setWipe(null), COVER_MS + FADE_MS),
    )
  }

  return (
    <>
      <div className={`mode-switch mode-${mode}`} role="radiogroup" aria-label="Plot">
        <span className="mode-thumb" aria-hidden="true" />
        <button type="button" role="radio" aria-checked={mode === 'sound'} onClick={(e) => pick('sound', e)}>
          Ton
        </button>
        <button type="button" role="radio" aria-checked={mode === 'lighting'} onClick={(e) => pick('lighting', e)}>
          Licht
        </button>
      </div>
      {wipe && (
        <div
          key={wipe.key}
          className={`mode-wipe to-${wipe.to}`}
          style={{ ['--wx' as string]: `${wipe.x}px`, ['--wy' as string]: `${wipe.y}px`, ['--cover' as string]: `${COVER_MS}ms`, ['--fade' as string]: `${FADE_MS}ms` }}
          aria-hidden="true"
        />
      )}
    </>
  )
}
