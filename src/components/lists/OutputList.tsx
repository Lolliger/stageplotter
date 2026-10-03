import { roundMeters } from '../../lib/geometry'
import { targetKindLabel, unpatchedTargetName } from '../../model/devices'
import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'

function fmtM(m: number): string {
  return `${roundMeters(m).toLocaleString('de-DE', { minimumFractionDigits: 1 })} m`
}

export function OutputList({ onSelect }: { onSelect: (target: ElementRef) => void }) {
  const { project, assignment } = useProject()

  if (project.outputs.length === 0 && project.devices.length === 0) {
    return (
      <div className="empty">
        <p className="hint">Noch keine Wedges, IEMs oder Sidefills. Tippe auf „+ Output“.</p>
      </div>
    )
  }

  const unpatched = assignment.unpatchedOutputs
  const boxes = project.boxes.filter((b) => (assignment.outputs[b.id] ?? []).length > 0 || assignment.usage[b.id]?.outputsMissing)

  return (
    <div className="lists">
      {boxes.map((box) => {
        const ports = assignment.outputs[box.id] ?? []
        const usage = assignment.usage[box.id]
        const over = usage && usage.outputsMissing > 0
        return (
          <section key={box.id} className="list-card" style={{ borderTopColor: box.color }}>
            <header className="list-header">
              <button type="button" className="list-title" onClick={() => onSelect({ kind: 'box', id: box.id })}>
                <span className="dot" style={{ background: box.color }} />
                Stagebox {box.name}
              </button>
              <span className={`usage${over ? ' over' : ''}`}>
                {usage?.outputsUsed ?? 0}/{box.outputs} Out
                {over && ` (+${usage.outputsMissing})`}
              </span>
            </header>
            <table className="io-table">
              <thead>
                <tr>
                  <th scope="col">Port</th>
                  <th scope="col">Ziel</th>
                  <th scope="col">Art</th>
                  <th scope="col" className="num">
                    Abstand
                  </th>
                </tr>
              </thead>
              <tbody>
                {ports.map((p) => (
                  <tr
                    key={`${p.outputId}:${p.inputIndex ?? ''}`}
                    onClick={() => onSelect({ kind: p.inputIndex === undefined ? 'output' : 'device', id: p.outputId })}
                  >
                    <td className="port">{p.label}</td>
                    <td>
                      <span className="src">{p.name}</span>
                    </td>
                    <td>{targetKindLabel(p.kind)}</td>
                    <td className="num">{fmtM(p.distance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
      {unpatched.length > 0 && (
        <section className="list-card list-card-error">
          <header className="list-header">
            <span className="list-title">Ohne Output</span>
            <span className="usage over">{unpatched.length}</span>
          </header>
          <table className="io-table">
            <tbody>
              {unpatched.map((u) => {
                const target = unpatchedTargetName(project, u.outputId, u.inputIndex)
                if (!target) return null
                return (
                  <tr
                    key={`${u.outputId}:${u.inputIndex ?? ''}`}
                    onClick={() => onSelect({ kind: u.inputIndex === undefined ? 'output' : 'device', id: u.outputId })}
                  >
                    <td className="port">–</td>
                    <td>
                      <span className="src">{target.name}</span>
                    </td>
                    <td>{target.kind}</td>
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
