import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'

export function Warnings({ onSelect }: { onSelect: (target: ElementRef) => void }) {
  const { assignment } = useProject()
  if (assignment.warnings.length === 0) return null

  return (
    <ul className="warnings" aria-label="Warnungen">
      {assignment.warnings.map((w, i) => {
        const target: ElementRef | null = w.groupIds?.length
          ? { kind: 'group', id: w.groupIds[0] }
          : w.boxId
            ? { kind: 'box', id: w.boxId }
            : null
        return (
          <li key={`${w.code}-${i}`} className={`warning warning-${w.level}`}>
            <span className="warning-icon" aria-hidden="true">
              {w.level === 'error' ? '⛔' : '⚠️'}
            </span>
            {target ? (
              <button type="button" className="warning-text" onClick={() => onSelect(target)}>
                {w.message}
              </button>
            ) : (
              <span className="warning-text">{w.message}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
