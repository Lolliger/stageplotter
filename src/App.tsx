import { useCallback, useEffect, useState } from 'react'
import { AddInstrument } from './components/editors/AddInstrument'
import { AddOutput } from './components/editors/AddOutput'
import { DrumConfigurator } from './components/editors/DrumConfigurator'
import { GroupEditor } from './components/editors/GroupEditor'
import { OutputEditor } from './components/editors/OutputEditor'
import { ProjectMenu } from './components/editors/ProjectMenu'
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
  | { kind: 'project' }
  | null

function Workspace() {
  const { project, dispatch, undo, redo, canUndo, canRedo } = useProject()
  const [panel, setPanel] = useState<Panel>(null)
  const close = useCallback(() => setPanel(null), [])

  // Strg/Cmd+Z, Strg/Cmd+Umschalt+Z, Strg+Y – nicht während der Eingabe in Feldern.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
  } else if (panel?.kind === 'project') {
    sheet = (
      <Sheet title="Projekt & Export" onClose={close}>
        <ProjectMenu onDone={close} />
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
        <div className="topbar-actions">
          <button type="button" className="icon-btn" aria-label="Rückgängig" title="Rückgängig" disabled={!canUndo} onClick={undo}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="icon-btn" aria-label="Wiederholen" title="Wiederholen" disabled={!canRedo} onClick={redo}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Projekt & Export"
            title="Projekt & Export"
            onClick={() => setPanel({ kind: 'project' })}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
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
