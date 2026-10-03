import { OUTPUT_LABELS, createOutput } from '../../model/defaults'
import type { OutputKind } from '../../model/types'
import { useProject } from '../../state/useProject'

const DESCRIPTIONS: Record<OutputKind, string> = {
  wedge: 'Bodenmonitor, Platz an der Bühnenkante',
  iem: 'In-Ear-Strecke (Sender am Platz)',
  sidefill: 'Seitliche Monitorbox',
}

export function AddOutput({ onAdded }: { onAdded: (id: string) => void }) {
  const { project, dispatch, assignment } = useProject()
  const free = Object.values(assignment.usage).reduce((sum, u) => sum + (u.outputs - u.outputsUsed), 0)

  return (
    <div className="editor">
      <p className="hint">Noch {free} Outputs frei auf allen Stageboxen. Jedes Element belegt einen Output.</p>
      <div className="template-grid">
        {(Object.keys(OUTPUT_LABELS) as OutputKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className={`template-btn${free === 0 ? ' too-big' : ''}`}
            onClick={() => {
              const output = createOutput(project, kind)
              dispatch({ type: 'addOutput', output })
              onAdded(output.id)
            }}
          >
            <span className="template-label">{OUTPUT_LABELS[kind]}</span>
            <span className="template-meta">{DESCRIPTIONS[kind]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
