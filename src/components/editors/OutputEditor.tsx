import { euclidean, roundMeters } from '../../lib/geometry'
import { OUTPUT_LABELS } from '../../model/defaults'
import type { OutputElement, OutputKind } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { TextField } from '../ui/TextField'
import { Segmented } from '../ui/Toggle'
import { OUTPUT_SHAPES } from '../../model/shapes'
import { outputLabel, sourcesForOutputElement } from '../../model/devices'
import { BoxPicker } from './BoxPicker'
import { SourceSelect } from './SourceSelect'
import { RotationControl } from './RotationControl'

export function OutputEditor({ output, onDone }: { output: OutputElement; onDone: () => void }) {
  const { project, dispatch, assignment } = useProject()
  const a = assignment.outputElements[output.id]
  const box = a?.boxId ? project.boxes.find((b) => b.id === a.boxId) : undefined
  const update = (patch: Partial<OutputElement>) => dispatch({ type: 'updateOutput', id: output.id, patch })
  const sources = sourcesForOutputElement(project)
  const fedBy = a?.source ? project.devices.find((d) => d.id === a.source!.deviceId) : undefined

  return (
    <div className="editor">
      <TextField label="Name" value={output.name} onChange={(name) => update({ name })} />
      <Segmented
        label="Art"
        value={output.kind}
        options={(Object.keys(OUTPUT_LABELS) as OutputKind[]).map((k) => ({ value: k, label: OUTPUT_LABELS[k] }))}
        onChange={(kind) => update({ kind })}
      />
      {OUTPUT_SHAPES[output.kind].front && (
        <RotationControl
          front={OUTPUT_SHAPES[output.kind].front!}
          rotation={output.rotation ?? 0}
          onChange={(rotation) => update({ rotation })}
        />
      )}
      {sources.length > 0 && (
        <SourceSelect
          label="Signal von"
          value={output.source}
          boxLabel="Stagebox (aktiver Lautsprecher)"
          options={sources}
          onChange={(source) => update({ source })}
        />
      )}
      {!fedBy && (
        <BoxPicker boxes={project.boxes} pinnedBoxId={output.pinnedBoxId} onChange={(pinnedBoxId) => update({ pinnedBoxId })} />
      )}
      <div className="assign-summary">
        <span className="field-label">Zuordnung</span>
        {fedBy ? (
          <ul className="chips">
            <li className="chip">
              ← {fedBy.name} · {outputLabel(fedBy, output.source!.output)}
              {fedBy.kind === 'crossover' ? ` (${fedBy.outputs[output.source!.output].name})` : ''}
            </li>
          </ul>
        ) : box && a?.label ? (
          <ul className="chips">
            <li className="chip" style={{ borderColor: box.color }}>
              <span className="dot" style={{ background: box.color }} />
              {a.pinned && '📌 '}
              {a.label} · {roundMeters(euclidean(output.pos, box.pos)).toLocaleString('de-DE')} m
            </li>
          </ul>
        ) : (
          <p className="hint hint-error">Kein freier Output – Outputs einer Box erhöhen oder Box hinzufügen.</p>
        )}
      </div>
      <div className="editor-actions">
        <ConfirmButton
          onConfirm={() => {
            dispatch({ type: 'delete', target: { kind: 'output', id: output.id } })
            onDone()
          }}
        >
          Output löschen
        </ConfirmButton>
      </div>
    </div>
  )
}
