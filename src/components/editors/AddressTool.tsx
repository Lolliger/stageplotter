import { useState } from 'react'
import { dmxIssues } from '../../lib/dmx'
import { UNIVERSE_LIMITS } from '../../model/lights'
import { useProject } from '../../state/useProject'
import { Stepper } from '../ui/Stepper'
import { Segmented, Toggle } from '../ui/Toggle'

/** Auto-Adressierung: Traverse für Traverse von hinten nach vorne, lückenlos. */
export function AddressTool({ onDone }: { onDone: () => void }) {
  const { project, dispatch } = useProject()
  const [universe, setUniverse] = useState(1)
  const [address, setAddress] = useState(1)
  const [scope, setScope] = useState<'missing' | 'all'>(project.fixtures.some((f) => f.address !== undefined) ? 'missing' : 'all')
  const [renumber, setRenumber] = useState(false)
  const missing = project.fixtures.filter((f) => f.address === undefined && f.channels > 0).length
  const errors = dmxIssues(project.fixtures).filter((i) => i.level === 'error').length

  if (project.fixtures.length === 0) {
    return (
      <div className="editor">
        <p className="hint">Noch keine Lampen. Tippe auf „+ Lampe“.</p>
      </div>
    )
  }

  const run = () => {
    dispatch({ type: 'autoAddress', options: { universe, address, keepExisting: scope === 'missing', renumber } })
    onDone()
  }

  return (
    <div className="editor">
      <p className="hint">
        {project.fixtures.length} Lampen · {missing} ohne Adresse
        {errors > 0 ? ` · ${errors} Adresskonflikt${errors === 1 ? '' : 'e'}` : ''}
      </p>
      <Segmented
        label="Welche Lampen"
        value={scope}
        options={[
          { value: 'missing', label: 'Nur ohne Adresse' },
          { value: 'all', label: 'Alle neu' },
        ]}
        onChange={setScope}
      />
      <div className="field-row">
        <Stepper label="Ab Universe" value={universe} min={UNIVERSE_LIMITS.min} max={UNIVERSE_LIMITS.max} onChange={setUniverse} />
        <Stepper label="Ab Adresse" value={address} min={1} max={512} onChange={setAddress} />
      </div>
      <div className="toggle-row">
        <Toggle pressed={renumber} onChange={setRenumber}>
          Lampennummern in derselben Reihenfolge neu vergeben
        </Toggle>
      </div>
      <p className="hint">
        Reihenfolge: Traverse für Traverse von hinten nach vorne, auf jeder Traverse vom Anfang zum Ende, danach
        freie Lampen. Eine Lampe wird nie auf zwei Universes verteilt.
      </p>
      <div className="editor-actions">
        <button type="button" className="btn btn-primary" onClick={run}>
          Adressen vergeben
        </button>
      </div>
    </div>
  )
}
