interface Props {
  onAddInstrument: () => void
  onAddBox: () => void
  onSettings: () => void
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS = {
  instrument: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  box: 'M4 6h16v12H4zM8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01',
  stage: 'M3 7h18v10H3zM3 17l-1 3M21 17l1 3M8 7V4M16 7V4',
}

export function Toolbar({ onAddInstrument, onAddBox, onSettings }: Props) {
  return (
    <nav className="toolbar" aria-label="Werkzeuge">
      <button type="button" className="tool" onClick={onAddInstrument}>
        <Icon d={ICONS.instrument} />
        <span>+ Instrument</span>
      </button>
      <button type="button" className="tool" onClick={onAddBox}>
        <Icon d={ICONS.box} />
        <span>+ Stagebox</span>
      </button>
      <button type="button" className="tool" onClick={onSettings}>
        <Icon d={ICONS.stage} />
        <span>Bühne</span>
      </button>
    </nav>
  )
}
