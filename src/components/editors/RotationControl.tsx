import { facingDirection, normalizeRotation, rotationFacing, type Direction } from '../../model/shapes'

interface Props {
  /** Abstrahlrichtung der Form bei Drehung 0. */
  front: 'up' | 'down'
  rotation: number
  onChange: (rotation: number) => void
}

const DIRECTIONS: { dir: Direction; arrow: string; label: string }[] = [
  { dir: 'up', arrow: '↑', label: 'nach hinten' },
  { dir: 'left', arrow: '←', label: 'nach links' },
  { dir: 'down', arrow: '↓', label: 'zum Publikum' },
  { dir: 'right', arrow: '→', label: 'nach rechts' },
]

const STEPS = [-45, -15, 15, 45]

/** Ausrichtung: Richtungsknöpfe (zeigt nach …) und Feinschritte in Grad. */
export function RotationControl({ front, rotation, onChange }: Props) {
  const current = normalizeRotation(rotation)
  const exact = current % 90 === 0
  const facing = facingDirection(front, current)

  return (
    <div className="field">
      <span className="field-label">
        Ausrichtung · {current}° · strahlt {DIRECTIONS.find((d) => d.dir === facing)!.label}
        {exact ? '' : ' (schräg)'}
      </span>
      <div className="rotation">
        <div className="rotation-dirs" role="radiogroup" aria-label="Richtung">
          {DIRECTIONS.map((d) => (
            <button
              key={d.dir}
              type="button"
              role="radio"
              aria-checked={exact && facing === d.dir}
              aria-label={`Strahlt ${d.label}`}
              title={`Strahlt ${d.label}`}
              onClick={() => onChange(rotationFacing(front, d.dir))}
            >
              {d.arrow}
            </button>
          ))}
        </div>
        <div className="rotation-steps">
          {STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className="btn"
              aria-label={`${Math.abs(step)}° ${step < 0 ? 'gegen den' : 'im'} Uhrzeigersinn drehen`}
              onClick={() => onChange(normalizeRotation(current + step))}
            >
              {step < 0 ? '↺' : '↻'} {Math.abs(step)}°
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
