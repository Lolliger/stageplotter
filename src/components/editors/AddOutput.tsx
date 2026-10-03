import { OUTPUT_LABELS, createOutput, createPaPair } from '../../model/defaults'
import { createAmp, createCrossover } from '../../model/devices'
import type { ElementRef, OutputElement, OutputKind } from '../../model/types'
import { useProject } from '../../state/useProject'

interface Choice {
  id: string
  label: string
  description: string
  outputs: number
  create: () => OutputElement[]
}

export function AddOutput({ onAdded }: { onAdded: (target: ElementRef) => void }) {
  const { project, dispatch, assignment } = useProject()
  const free = Object.values(assignment.usage).reduce((sum, u) => sum + (u.outputs - u.outputsUsed), 0)
  const single = (kind: Exclude<OutputKind, 'pa'>) => () => [createOutput(project, kind)]

  const monitoring: Choice[] = [
    { id: 'wedge', label: OUTPUT_LABELS.wedge, description: 'Bodenmonitor, Platz an der Bühnenkante', outputs: 1, create: single('wedge') },
    { id: 'iem', label: OUTPUT_LABELS.iem, description: 'In-Ear-Strecke (Sender am Platz)', outputs: 1, create: single('iem') },
    { id: 'sidefill', label: OUTPUT_LABELS.sidefill, description: 'Seitliche Monitorbox', outputs: 1, create: single('sidefill') },
  ]
  const pa: Choice[] = [
    {
      id: 'pa',
      label: 'PA (L + R)',
      description: 'Hauptlautsprecher links und rechts neben der Bühne',
      outputs: 2,
      create: () => createPaPair(project),
    },
    { id: 'sub', label: OUTPUT_LABELS.sub, description: 'Subwoofer vor der Bühnenkante', outputs: 1, create: single('sub') },
  ]

  const add = (choice: Choice) => {
    const created = choice.create()
    for (const output of created) dispatch({ type: 'addOutput', output })
    onAdded({ kind: 'output', id: created[0].id })
  }

  const section = (title: string, choices: Choice[]) => (
    <section className="template-group">
      <h3>{title}</h3>
      <div className="template-grid">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`template-btn${c.outputs > free ? ' too-big' : ''}`}
            onClick={() => add(c)}
          >
            <span className="template-label">{c.label}</span>
            <span className="template-meta">
              {c.description} · {c.outputs} {c.outputs === 1 ? 'Output' : 'Outputs'}
            </span>
          </button>
        ))}
      </div>
    </section>
  )

  const devices = [
    {
      id: 'crossover',
      label: 'Frequenzweiche',
      description: 'Controller mit Hoch-/Tiefpass je Ausgang, z. B. Tops + Sub',
      create: () => createCrossover(project),
    },
    {
      id: 'amp',
      label: 'Endstufe',
      description: 'Für passive Lautsprecher, gespeist von Weiche oder Stagebox',
      create: () => createAmp(project),
    },
  ]

  return (
    <div className="editor">
      <p className="hint">Noch {free} Outputs frei auf allen Stageboxen.</p>
      {section('Monitoring', monitoring)}
      {section('PA', pa)}
      <section className="template-group">
        <h3>PA-Technik</h3>
        <div className="template-grid">
          {devices.map((d) => (
            <button
              key={d.id}
              type="button"
              className="template-btn"
              onClick={() => {
                const device = d.create()
                dispatch({ type: 'addDevice', device })
                onAdded({ kind: 'device', id: device.id })
              }}
            >
              <span className="template-label">{d.label} …</span>
              <span className="template-meta">{d.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
