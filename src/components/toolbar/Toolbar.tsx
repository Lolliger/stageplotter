interface Props {
  onAddInstrument: () => void
  onAddOutput: () => void
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
  output: 'M5 9h3l5-4v14l-5-4H5zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  box: 'M4 6h16v12H4zM8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01',
  stage: 'M3 7h18v10H3zM3 17l-1 3M21 17l1 3M8 7V4M16 7V4',
}

export function Toolbar({ onAddInstrument, onAddOutput, onAddBox, onSettings }: Props) {
  return (
    <nav className="toolbar" aria-label="Werkzeuge">
      <button type="button" className="tool" onClick={onAddInstrument} aria-label="Instrument hinzufügen">
        <Icon d={ICONS.instrument} />
        <span>
          <span className="plus">+ </span>
          Instrument
        </span>
      </button>
      <button type="button" className="tool" onClick={onAddOutput} aria-label="Output hinzufügen">
        <Icon d={ICONS.output} />
        <span>
          <span className="plus">+ </span>
          Output
        </span>
      </button>
      <button type="button" className="tool" onClick={onAddBox} aria-label="Stagebox hinzufügen">
        <Icon d={ICONS.box} />
        <span>
          <span className="plus">+ </span>
          Stagebox
        </span>
      </button>
      <button type="button" className="tool" onClick={onSettings}>
        <Icon d={ICONS.stage} />
        <span>Bühne</span>
      </button>
    </nav>
  )
}
