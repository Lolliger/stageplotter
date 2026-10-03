import { useCallback, useState } from 'react'
import { AddInstrument } from './components/editors/AddInstrument'
import { AddOutput } from './components/editors/AddOutput'
import { DrumConfigurator } from './components/editors/DrumConfigurator'
import { GroupEditor } from './components/editors/GroupEditor'
import { OutputEditor } from './components/editors/OutputEditor'
import { ProjectSettings } from './components/editors/ProjectSettings'
import { Sheet } from './components/editors/Sheet'
import { StageboxEditor } from './components/editors/StageboxEditor'
import { InputList } from './components/lists/InputList'
import { OutputList } from './components/lists/OutputList'
import { Warnings } from './components/lists/Warnings'
import { StagePlot } from './components/stage/StagePlot'
import { Toolbar } from './components/toolbar/Toolbar'
import { createStagebox } from './model/defaults'
import type { ElementRef } from './model/types'
import { ProjectProvider } from './state/ProjectProvider'
import { useProject } from './state/useProject'
import './styles/layout.css'
import './styles/lists.css'
import './styles/ui.css'

type Panel =
  | { kind: 'edit'; target: ElementRef }
  | { kind: 'addInstrument' }
  | { kind: 'addOutput' }
  | { kind: 'drums'; groupId?: string }
  | { kind: 'settings' }
  | null

function Workspace() {
  const { project, dispatch } = useProject()
  const [panel, setPanel] = useState<Panel>(null)
  const close = useCallback(() => setPanel(null), [])

  const selected = panel?.kind === 'edit' ? panel.target : null
  const select = (target: ElementRef | null) => setPanel(target ? { kind: 'edit', target } : null)

  const addBox = () => {
    const box = createStagebox(project)
    dispatch({ type: 'addBox', box })
    select({ kind: 'box', id: box.id })
  }

  let sheet = null
  if (panel?.kind === 'addInstrument') {
    sheet = (
      <Sheet title="Instrument hinzufügen" onClose={close}>
        <AddInstrument onAdded={close} onConfigureDrums={() => setPanel({ kind: 'drums' })} />
      </Sheet>
    )
  } else if (panel?.kind === 'addOutput') {
    sheet = (
      <Sheet title="Output hinzufügen" onClose={close}>
        <AddOutput onAdded={close} />
      </Sheet>
    )
  } else if (panel?.kind === 'drums') {
    const group = panel.groupId ? project.groups.find((g) => g.id === panel.groupId) : undefined
    sheet = (
      <Sheet title={group ? `${group.name} konfigurieren` : 'Drumset konfigurieren'} onClose={close}>
        <DrumConfigurator
          key={panel.groupId ?? 'new'}
          group={group}
          onDone={(id) => (group ? select({ kind: 'group', id }) : close())}
        />
      </Sheet>
    )
  } else if (panel?.kind === 'settings') {
    sheet = (
      <Sheet title="Bühne & Projekt" onClose={close}>
        <ProjectSettings />
      </Sheet>
    )
  } else if (selected?.kind === 'group') {
    const group = project.groups.find((g) => g.id === selected.id)
    if (group)
      sheet = (
        <Sheet title={group.name} onClose={close}>
          <GroupEditor group={group} onDone={close} onConfigureDrums={() => setPanel({ kind: 'drums', groupId: group.id })} />
        </Sheet>
      )
  } else if (selected?.kind === 'output') {
    const output = project.outputs.find((o) => o.id === selected.id)
    if (output)
      sheet = (
        <Sheet title={output.name} onClose={close}>
          <OutputEditor output={output} onDone={close} />
        </Sheet>
      )
  } else if (selected?.kind === 'box') {
    const box = project.boxes.find((b) => b.id === selected.id)
    if (box)
      sheet = (
        <Sheet title={`Stagebox ${box.name}`} onClose={close}>
          <StageboxEditor box={box} onDone={close} />
        </Sheet>
      )
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          stageplot<small>{project.name}</small>
        </h1>
        <Toolbar
          onAddInstrument={() => setPanel({ kind: 'addInstrument' })}
          onAddOutput={() => setPanel({ kind: 'addOutput' })}
          onAddBox={addBox}
          onSettings={() => setPanel({ kind: 'settings' })}
        />
      </header>
      <main className="workspace">
        <section className="stage-panel" aria-label="Bühnenplan">
          <StagePlot selected={selected} onSelect={select} />
        </section>
        <aside className="side-panel" aria-label="Listen">
          <Warnings onSelect={select} />
          <h2 className="panel-title">Inputliste</h2>
          <InputList onSelect={select} />
          <h2 className="panel-title">Outputliste</h2>
          <OutputList onSelect={select} />
        </aside>
      </main>
      {sheet}
    </div>
  )
}

export default function App() {
  return (
    <ProjectProvider>
      <Workspace />
    </ProjectProvider>
  )
}
