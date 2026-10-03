import { useMemo } from 'react'
import { deviceColor } from '../../lib/cables'
import { signalTables } from '../../lib/export/tables'
import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'

/** PA-Signalweg: je Frequenzweiche/Endstufe, was rein- und rausgeht. */
export function SignalChain({ onSelect }: { onSelect: (target: ElementRef) => void }) {
  const { project, assignment } = useProject()
  const tables = useMemo(() => signalTables(project, assignment), [project, assignment])

  return (
    <div className="lists">
      {tables.map((t) => {
        const color = deviceColor(project, assignment, t.device.id) ?? 'var(--border)'
        const select = () => onSelect({ kind: 'device', id: t.device.id })
        const crossover = t.device.kind === 'crossover'
        return (
          <section key={t.device.id} className="list-card" style={{ borderTopColor: color }}>
            <header className="list-header">
              <button type="button" className="list-title" onClick={select}>
                {t.title}
              </button>
            </header>
            <p className="list-summary">{t.summary}</p>
            {t.feeds.length > 0 && (
              <ul className="list-feeds">
                {t.feeds.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <table className="io-table">
              <thead>
                <tr>
                  <th scope="col">{crossover ? 'Ausgang' : 'Kanal'}</th>
                  <th scope="col">{crossover ? 'Filter' : 'Eingang'}</th>
                  <th scope="col">An</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.port} onClick={select}>
                    <td className="port">{r.port}</td>
                    <td>
                      {crossover ? (
                        <>
                          <span className="src">{r.name}</span>
                          <span className="src-group">
                            {r.detail} · von {r.from}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="src">{r.from}</span>
                          <span className="src-group">{r.detail}</span>
                        </>
                      )}
                    </td>
                    <td>{r.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
