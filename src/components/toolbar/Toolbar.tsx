import type { PlotMode } from '../../state/mode'

interface Props {
  mode: PlotMode
  onAddInstrument: () => void
  onAddOutput: () => void
  onAddBox: () => void
  onAddFixture: () => void
  onAddTruss: () => void
  onAddresses: () => void
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
  // Scheinwerfer mit Bügel und Lichtstrahl
  fixture: 'M8 4h8l-1 7H9zM12 2v2M6 7H4m16 0h-2M9 11l-3 9M15 11l3 9M12 11v9',
  truss: 'M2 9h20v6H2zM2 15l5-6 5 6 5-6 5 6',
  dmx: 'M4 6h16v12H4zM8 12h.01M12 12h.01M16 12h.01M9 18v3M15 18v3',
}

interface Tool {
  key: string
  icon: string
  label: string
  plus?: boolean
  aria?: string
  onClick: () => void
}

export function Toolbar(props: Props) {
  const tools: Tool[] =
    props.mode === 'lighting'
      ? [
          { key: 'fixture', icon: ICONS.fixture, label: 'Lampe', plus: true, aria: 'Lampe hinzufügen', onClick: props.onAddFixture },
          { key: 'truss', icon: ICONS.truss, label: 'Traverse', plus: true, aria: 'Traverse hinzufügen', onClick: props.onAddTruss },
          { key: 'dmx', icon: ICONS.dmx, label: 'Adressen', aria: 'Adressen vergeben', onClick: props.onAddresses },
          { key: 'stage', icon: ICONS.stage, label: 'Bühne', onClick: props.onSettings },
        ]
      : [
          { key: 'instrument', icon: ICONS.instrument, label: 'Instrument', plus: true, aria: 'Instrument hinzufügen', onClick: props.onAddInstrument },
          { key: 'output', icon: ICONS.output, label: 'Output', plus: true, aria: 'Output hinzufügen', onClick: props.onAddOutput },
          { key: 'box', icon: ICONS.box, label: 'Stagebox', plus: true, aria: 'Stagebox hinzufügen', onClick: props.onAddBox },
          { key: 'stage', icon: ICONS.stage, label: 'Bühne', onClick: props.onSettings },
        ]
  return (
    <nav className="toolbar" aria-label="Werkzeuge">
      {tools.map((t) => (
        <button key={t.key} type="button" className="tool" onClick={t.onClick} aria-label={t.aria}>
          <Icon d={t.icon} />
          <span>
            {t.plus && <span className="plus">+ </span>}
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
