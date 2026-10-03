import type { Stagebox } from '../../model/types'

interface Props {
  boxes: Stagebox[]
  pinnedBoxId: string | undefined
  onChange: (boxId: string | undefined) => void
}

/** Auto-Zuordnung oder feste Box (Pin). Der Pin bleibt beim Verschieben erhalten. */
export function BoxPicker({ boxes, pinnedBoxId, onChange }: Props) {
  return (
    <div className="field">
      <span className="field-label">Stagebox</span>
      <div className="box-picker" role="radiogroup" aria-label="Stagebox">
        <button type="button" role="radio" aria-checked={!pinnedBoxId} onClick={() => onChange(undefined)}>
          Auto
        </button>
        {boxes.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={pinnedBoxId === b.id}
            aria-label={`Fest auf Box ${b.name}`}
            onClick={() => onChange(b.id)}
            style={{ ['--box-color' as string]: b.color }}
          >
            <span className="dot" style={{ background: b.color }} />
            {b.name}
          </button>
        ))}
      </div>
      <p className="hint">
        {pinnedBoxId
          ? 'Fest zugewiesen (📌) – bleibt auch beim Verschieben auf dieser Box.'
          : 'Automatisch: nächstgelegene Box mit genug freien Anschlüssen.'}
      </p>
    </div>
  )
}
