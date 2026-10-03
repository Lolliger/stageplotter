import { TYPE_LABELS, TYPE_ORDER, spawnPosition, uniqueName } from '../../model/defaults'
import { AMP_TEMPLATES, INSTRUMENT_TEMPLATES, createGroupFromTemplate, type InstrumentTemplate } from '../../model/templates'
import { useProject } from '../../state/useProject'

interface Props {
  onAdded: (groupId: string) => void
  onConfigureDrums: () => void
}

export function AddInstrument({ onAdded, onConfigureDrums }: Props) {
  const { project, dispatch, assignment } = useProject()
  const freeInputs = Object.values(assignment.usage).reduce((sum, u) => sum + (u.inputs - u.inputsUsed), 0)

  const add = (template: InstrumentTemplate) => {
    const name = uniqueName(template.name, project.groups.map((g) => g.name))
    const group = createGroupFromTemplate(template, spawnPosition(project), name)
    dispatch({ type: 'addGroup', group })
    onAdded(group.id)
  }

  const types = TYPE_ORDER.filter((t) => INSTRUMENT_TEMPLATES.some((tpl) => tpl.type === t))

  return (
    <div className="editor">
      <p className="hint">Noch {freeInputs} Inputs frei auf allen Stageboxen.</p>
      <section className="template-group">
        <h3>{TYPE_LABELS.drums}</h3>
        <div className="template-grid">
          <button type="button" className="template-btn" onClick={onConfigureDrums}>
            <span className="template-label">Drumset …</span>
            <span className="template-meta">Konfigurator: Kick, Snare, Toms, OH …</span>
          </button>
        </div>
      </section>
      {[...types.map((type) => ({ title: TYPE_LABELS[type], templates: INSTRUMENT_TEMPLATES.filter((t) => t.type === type) })),
        { title: 'Backline (Instrumenten-Amps)', templates: AMP_TEMPLATES }].map(({ title, templates }) => (
        <section key={title} className="template-group">
          <h3>{title}</h3>
          <div className="template-grid">
            {templates.map((t) => (
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
