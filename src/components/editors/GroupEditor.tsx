import { euclidean, roundMeters } from '../../lib/geometry'
import { TYPE_LABELS } from '../../model/defaults'
import type { InstrumentGroup } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { TextField } from '../ui/TextField'

export function GroupEditor({ group, onDone }: { group: InstrumentGroup; onDone: () => void }) {
  const { project, dispatch, assignment } = useProject()
  const a = assignment.groups[group.id]
  const boxById = new Map(project.boxes.map((b) => [b.id, b]))

  return (
    <div className="editor">
      <TextField
        label="Name"
        value={group.name}
        onChange={(name) => dispatch({ type: 'updateGroup', id: group.id, patch: { name } })}
      />

      <div className="assign-summary">
        <span className="field-label">Zuordnung</span>
        {a && a.boxIds.length > 0 ? (
          <ul className="chips">
            {a.boxIds.map((id) => {
              const box = boxById.get(id)!
              return (
                <li key={id} className="chip" style={{ borderColor: box.color }}>
                  <span className="dot" style={{ background: box.color }} />
                  Box {box.name} · {a.channelsPerBox[id]} Kan. · {fmtM(euclidean(group.pos, box.pos))}
                </li>
              )
            })}
          </ul>
        ) : (
          group.channels.length > 0 && <p className="hint hint-error">Keiner Stagebox zugeordnet.</p>
        )}
        {a?.split && <p className="hint hint-warning">Auf mehrere Boxen aufgeteilt.</p>}
        {a && a.unpatched > 0 && <p className="hint hint-error">{a.unpatched} Kanäle ohne Input.</p>}
      </div>

      <div className="field">
        <span className="field-label">
          {TYPE_LABELS[group.type]} · {group.channels.length} {group.channels.length === 1 ? 'Kanal' : 'Kanäle'}
        </span>
        <ol className="channel-list">
          {group.channels.map((c) => (
            <li key={c.id}>
              <span className="channel-name">{c.name}</span>
              <span className="channel-pickup">{c.pickup}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="editor-actions">
        <ConfirmButton
          onConfirm={() => {
            dispatch({ type: 'delete', target: { kind: 'group', id: group.id } })
            onDone()
          }}
        >
          Instrument löschen
        </ConfirmButton>
      </div>
    </div>
  )
}

function fmtM(m: number): string {
  return `${roundMeters(m).toLocaleString('de-DE')} m`
}
