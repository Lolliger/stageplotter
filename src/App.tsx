import { useState } from 'react'
import { StagePlot } from './components/stage/StagePlot'
import type { ElementRef } from './model/types'
import { ProjectProvider } from './state/ProjectProvider'
import { useProject } from './state/useProject'
import './styles/layout.css'

function Workspace() {
  const { project } = useProject()
  const [selected, setSelected] = useState<ElementRef | null>(null)

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          stageplot<small>{project.name}</small>
        </h1>
      </header>
      <main className="workspace">
        <section className="stage-panel" aria-label="Bühnenplan">
          <StagePlot selected={selected} onSelect={setSelected} />
        </section>
        <aside className="side-panel" aria-label="Listen" />
      </main>
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
