import { useCallback, useState } from 'react'
import { Sheet } from './components/editors/Sheet'
import { StageboxEditor } from './components/editors/StageboxEditor'
import { StagePlot } from './components/stage/StagePlot'
import { Toolbar } from './components/toolbar/Toolbar'
import { createStagebox } from './model/defaults'
import type { ElementRef } from './model/types'
import { ProjectProvider } from './state/ProjectProvider'
import { useProject } from './state/useProject'
import './styles/layout.css'
import './styles/ui.css'

type Panel = { kind: 'edit'; target: ElementRef } | null

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
  if (selected?.kind === 'box') {
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
        <Toolbar onAddInstrument={() => {}} onAddBox={addBox} onSettings={() => {}} />
      </header>
      <main className="workspace">
        <section className="stage-panel" aria-label="Bühnenplan">
          <StagePlot selected={selected} onSelect={select} />
        </section>
        <aside className="side-panel" aria-label="Listen" />
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
