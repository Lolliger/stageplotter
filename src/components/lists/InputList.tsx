import { roundMeters } from '../../lib/geometry'
import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'

function fmtM(m: number): string {
  return `${roundMeters(m).toLocaleString('de-DE', { minimumFractionDigits: 1 })} m`
}

export function InputList({ onSelect }: { onSelect: (target: ElementRef) => void }) {
  const { project, assignment } = useProject()
  const groupById = new Map(project.groups.map((g) => [g.id, g]))

  if (project.groups.length === 0) {
    return (
      <div className="empty">
        <p>Noch keine Instrumente auf der Bühne.</p>
        <p className="hint">Tippe auf „+ Instrument“, platziere es per Drag – die Inputliste entsteht automatisch.</p>
      </div>
    )
  }

  const unpatched = assignment.unpatchedInputs

  return (
    <div className="lists">
      {project.boxes.map((box) => {
        const ports = assignment.inputs[box.id] ?? []
        const usage = assignment.usage[box.id]
        const over = usage && usage.inputsMissing > 0
        return (
          <section key={box.id} className="list-card" style={{ borderTopColor: box.color }}>
            <header className="list-header">
              <button type="button" className="list-title" onClick={() => onSelect({ kind: 'box', id: box.id })}>
                <span className="dot" style={{ background: box.color }} />
                Stagebox {box.name}
              </button>
              <span className={`usage${over ? ' over' : ''}`}>
                {usage?.inputsUsed ?? 0}/{box.inputs} In
                {over && ` (+${usage.inputsMissing})`}
              </span>
            </header>
            {ports.length === 0 ? (
              <p className="hint list-empty">Keine Kanäle zugeordnet.</p>
            ) : (
              <table className="io-table">
                <thead>
                  <tr>
                    <th scope="col">Port</th>
                    <th scope="col">Quelle</th>
                    <th scope="col">Abnahme</th>
                    <th scope="col" className="num">
                      Abstand
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ports.map((p) => (
                    <tr key={p.channelId} onClick={() => onSelect({ kind: 'group', id: p.groupId })}>
                      <td className="port">{p.label}</td>
                      <td>
                        <span className="src">{p.channelName}</span>
                        {p.channelName !== p.groupName && <span className="src-group">{p.groupName}</span>}
                        {p.note && <span className="src-note">{p.note}</span>}
                      </td>
                      <td>{p.pickup}</td>
                      <td className="num">{fmtM(p.distance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )
      })}

      {unpatched.length > 0 && (
        <section className="list-card list-card-error">
          <header className="list-header">
            <span className="list-title">Ohne Input</span>
            <span className="usage over">{unpatched.length}</span>
          </header>
          <table className="io-table">
            <tbody>
              {unpatched.map((u) => {
                const group = groupById.get(u.groupId)!
                const channel = group.channels.find((c) => c.id === u.channelId)!
                return (
                  <tr key={u.channelId} onClick={() => onSelect({ kind: 'group', id: u.groupId })}>
                    <td className="port">–</td>
                    <td>
                      <span className="src">{channel.name}</span>
                      {channel.name !== group.name && <span className="src-group">{group.name}</span>}
                    </td>
                    <td>{channel.pickup}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
