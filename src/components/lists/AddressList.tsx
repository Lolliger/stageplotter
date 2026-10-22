import { useMemo } from 'react'
import { DMX_SIZE, addressList, dmxIssues, type AddressRow } from '../../lib/dmx'
import { FIXTURE_TYPES } from '../../model/lights'
import type { ElementRef } from '../../model/types'
import { useProject } from '../../state/useProject'

/** DMX-Hinweise: Überschneidungen, über 512, fehlende Adressen, doppelte Nummern. */
export function DmxWarnings({ onSelect }: { onSelect: (target: ElementRef) => void }) {
  const { project } = useProject()
  const issues = useMemo(() => dmxIssues(project.fixtures), [project.fixtures])
  if (issues.length === 0) return null
  return (
    <ul className="warnings" aria-label="DMX-Hinweise">
      {issues.map((w) => (
        <li key={w.message} className={`warning warning-${w.level}`}>
          <span className="warning-icon" aria-hidden="true">
            {w.level === 'error' ? '⛔' : '⚠️'}
          </span>
          <button type="button" className="warning-text" onClick={() => onSelect({ kind: 'fixture', id: w.fixtureIds[0] })}>
            {w.message}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Rows({ rows, onSelect, problems }: { rows: AddressRow[]; onSelect: (target: ElementRef) => void; problems: Set<string> }) {
  return (
    <table className="io-table">
      <thead>
        <tr>
          <th scope="col">Adresse</th>
          <th scope="col">Lampe</th>
          <th scope="col">Typ</th>
          <th scope="col">Ort</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ fixture: f, range, place }) => (
          <tr key={f.id} className={problems.has(f.id) ? 'row-error' : undefined} onClick={() => onSelect({ kind: 'fixture', id: f.id })}>
            <td className="port">{range}</td>
            <td>
              <span className="src">
                #{f.number} {f.name}
              </span>
              {(f.color || f.note) && <span className="src-note">{[f.color, f.note].filter(Boolean).join(' · ')}</span>}
            </td>
            <td>
              {f.model ?? FIXTURE_TYPES[f.kind].label}
              <span className="src-group">
                {f.channels} {f.channels === 1 ? 'Kanal' : 'Kanäle'}
                {f.mode && f.mode !== `${f.channels} Kanal` ? ` · ${f.mode}` : ''}
              </span>
            </td>
            <td>{place}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Adressliste: je Universe nach Adresse, Lampen ohne Adresse am Ende. */
export function AddressList({ onSelect }: { onSelect: (target: ElementRef) => void }) {
  const { project } = useProject()
  const list = useMemo(() => addressList(project.fixtures, project.trusses), [project.fixtures, project.trusses])
  const problems = useMemo(
    () => new Set(dmxIssues(project.fixtures).filter((i) => i.level === 'error').flatMap((i) => i.fixtureIds)),
    [project.fixtures],
  )

  if (project.fixtures.length === 0) {
    return (
      <div className="empty">
        <p>Noch keine Lampen.</p>
        <p className="hint">Tippe auf „+ Lampe“ oder lege zuerst eine Traverse an.</p>
      </div>
    )
  }

  return (
    <div className="lists">
      {list.universes.map((u) => (
        <section key={u.universe} className="list-card list-card-dmx">
          <header className="list-header">
            <span className="list-title">Universe {u.universe}</span>
            <span className={`usage${u.used > DMX_SIZE ? ' over' : ''}`}>
              {u.used}/{DMX_SIZE} Kanäle
            </span>
          </header>
          <Rows rows={u.rows} onSelect={onSelect} problems={problems} />
        </section>
      ))}
      {list.unaddressed.length > 0 && (
        <section className="list-card list-card-warning">
          <header className="list-header">
            <span className="list-title">Ohne Adresse</span>
            <span className="usage">{list.unaddressed.length}</span>
          </header>
          <Rows rows={list.unaddressed} onSelect={onSelect} problems={problems} />
        </section>
      )}
    </div>
  )
}
