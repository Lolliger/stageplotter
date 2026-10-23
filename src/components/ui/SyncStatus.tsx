import { useWorkspace } from '../../state/workspace'

function time(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : ` um ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
}

/** Kurzer Speicherstand in der Kopfzeile, nur für Plots eines Events. */
export function SyncLabel() {
  const workspace = useWorkspace()
  if (workspace.kind !== 'event') return null
  const { sync } = workspace
  const [text, tone] = !workspace.canEdit
    ? ['Nur ansehen', '']
    : sync.kind === 'saving'
      ? ['Speichert …', '']
      : sync.kind === 'saved'
        ? ['Gespeichert', '']
        : ['Nicht gespeichert', ' is-error']
  return (
    <span className={`sync-label${tone}`} role="status">
      {text}
    </span>
  )
}

/** Konflikt oder Fehler beim Speichern: unter der Kopfzeile, mit den möglichen Schritten. */
export function SyncBanner() {
  const workspace = useWorkspace()
  if (workspace.kind !== 'event') return null
  const { sync } = workspace

  if (sync.kind === 'conflict') {
    const who = sync.updatedBy ?? 'Jemand anderes'
    return (
      <div className="sync-banner" role="alert">
        <p>
          {who} hat den Plot{time(sync.updatedAt)} geändert, während du ihn bearbeitet hast. Deine letzten Änderungen sind
          noch nicht gespeichert.
        </p>
        <div className="menu-row">
          <button type="button" className="btn" onClick={workspace.takeTheirs} disabled={!sync.project}>
            Stand von {who} laden
          </button>
          <button type="button" className="btn btn-primary" onClick={workspace.keepMine}>
            Meinen Stand speichern
          </button>
        </div>
      </div>
    )
  }

  if (sync.kind === 'error') {
    return (
      <div className="sync-banner is-error" role="alert">
        <p>Nicht gespeichert: {sync.message}</p>
        <div className="menu-row">
          <button type="button" className="btn" onClick={workspace.retry}>
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return null
}
