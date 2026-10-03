import { TYPE_LABELS, TYPE_ORDER, spawnPosition, uniqueName } from '../../model/defaults'
import { INSTRUMENT_TEMPLATES, createGroupFromTemplate, type InstrumentTemplate } from '../../model/templates'
import { useProject } from '../../state/useProject'

export function AddInstrument({ onAdded }: { onAdded: (groupId: string) => void }) {
  const { project, dispatch, assignment } = useProject()
  const freeInputs = Object.values(assignment.usage).reduce((sum, u) => sum + (u.inputs - u.inputsUsed), 0)

  const add = (template: InstrumentTemplate) => {
    const name = uniqueName(template.name, project.groups.map((g) => g.name))
    const group = createGroupFromTemplate(template, spawnPosition(project.stage, project.groups.length), name)
    dispatch({ type: 'addGroup', group })
    onAdded(group.id)
  }

  const types = TYPE_ORDER.filter((t) => INSTRUMENT_TEMPLATES.some((tpl) => tpl.type === t))

  return (
    <div className="editor">
      <p className="hint">Noch {freeInputs} Inputs frei auf allen Stageboxen.</p>
      {types.map((type) => (
        <section key={type} className="template-group">
          <h3>{TYPE_LABELS[type]}</h3>
          <div className="template-grid">
            {INSTRUMENT_TEMPLATES.filter((t) => t.type === type).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`template-btn${t.channels.length > freeInputs ? ' too-big' : ''}`}
                onClick={() => add(t)}
              >
                <span className="template-label">{t.label}</span>
                <span className="template-meta">
                  {t.channels.length} {t.channels.length === 1 ? 'Kanal' : 'Kanäle'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
