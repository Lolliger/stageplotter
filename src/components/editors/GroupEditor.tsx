import { euclidean, roundMeters } from '../../lib/geometry'
import { TYPE_LABELS, TYPE_ORDER } from '../../model/defaults'
import type { InstrumentGroup, InstrumentType } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { TextField } from '../ui/TextField'
import { BoxPicker } from './BoxPicker'
import { ChannelEditor } from './ChannelEditor'

interface Props {
  group: InstrumentGroup
  onDone: () => void
  onConfigureDrums: () => void
}

export function GroupEditor({ group, onDone, onConfigureDrums }: Props) {
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

      <BoxPicker
        boxes={project.boxes}
        pinnedBoxId={group.pinnedBoxId}
        onChange={(pinnedBoxId) => dispatch({ type: 'updateGroup', id: group.id, patch: { pinnedBoxId } })}
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
                  {a.pinned && '📌 '}Box {box.name} · {a.channelsPerBox[id]} Kan. · {fmtM(euclidean(group.pos, box.pos))}
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

      <label className="field">
        <span className="field-label">Typ (bestimmt die Reihenfolge in der Inputliste)</span>
        <select
          className="select"
          value={group.type}
          onChange={(e) => dispatch({ type: 'updateGroup', id: group.id, patch: { type: e.target.value as InstrumentType } })}
        >
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <span className="field-label">
        {group.channels.length} {group.channels.length === 1 ? 'Kanal' : 'Kanäle'}
      </span>
      <ChannelEditor
        channels={group.channels}
        groupName={group.name}
        onChange={(channels) => dispatch({ type: 'updateGroup', id: group.id, patch: { channels } })}
      />

      <div className="editor-actions">
        {group.type === 'drums' && (
          <button type="button" className="btn" onClick={onConfigureDrums}>
            Konfigurator
          </button>
        )}
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
