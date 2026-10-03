import { BOX_COLORS } from '../../model/defaults'
import type { Stagebox } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Stepper } from '../ui/Stepper'
import { TextField } from '../ui/TextField'

export function StageboxEditor({ box, onDone }: { box: Stagebox; onDone: () => void }) {
  const { dispatch, assignment } = useProject()
  const usage = assignment.usage[box.id]
  const update = (patch: Partial<Stagebox>) => dispatch({ type: 'updateBox', id: box.id, patch })

  return (
    <div className="editor">
      <TextField label="Name" value={box.name} onChange={(name) => update({ name })} />
      <div className="field-row">
        <Stepper label="Inputs" value={box.inputs} min={0} max={256} onChange={(inputs) => update({ inputs })} />
        <Stepper label="Outputs" value={box.outputs} min={0} max={256} onChange={(outputs) => update({ outputs })} />
      </div>
      {usage && (
        <p className={`hint${usage.inputsMissing || usage.outputsMissing ? ' hint-error' : ''}`}>
          Belegt: {usage.inputsUsed}/{usage.inputs} Inputs · {usage.outputsUsed}/{usage.outputs} Outputs
          {usage.inputsMissing > 0 && <> · {usage.inputsMissing} Inputs fehlen</>}
          {usage.outputsMissing > 0 && <> · {usage.outputsMissing} Outputs fehlen</>}
        </p>
      )}
      <div className="field">
        <span className="field-label">Farbe</span>
        <div className="swatches" role="radiogroup" aria-label="Farbe">
          {BOX_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={box.color === color}
              aria-label={color}
              className="swatch"
              style={{ background: color }}
              onClick={() => update({ color })}
            />
          ))}
        </div>
      </div>
      <div className="editor-actions">
        <ConfirmButton
          onConfirm={() => {
            dispatch({ type: 'delete', target: { kind: 'box', id: box.id } })
            onDone()
          }}
        >
          Stagebox löschen
        </ConfirmButton>
      </div>
    </div>
  )
}
