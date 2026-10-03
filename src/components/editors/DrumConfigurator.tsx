import { useMemo, useState } from 'react'
import { assign } from '../../lib/assign'
import { DRUM_LIMITS, DRUM_PRESETS, applyDrumConfig, createDrumGroup, matchPreset, type DrumPresetId } from '../../model/drums'
import { spawnPosition, uniqueName } from '../../model/defaults'
import type { DrumConfig, InstrumentGroup, KickMode, Project } from '../../model/types'
import { useProject } from '../../state/useProject'
import { Stepper } from '../ui/Stepper'
import { Segmented, Toggle } from '../ui/Toggle'

interface Props {
  /** Vorhandene Gruppe bearbeiten; ohne Gruppe wird ein neues Drumset angelegt. */
  group?: InstrumentGroup
  onDone: (groupId: string) => void
}

const KICK_OPTIONS: { value: KickMode; label: string }[] = [
  { value: 'in', label: 'In' },
  { value: 'out', label: 'Out' },
  { value: 'both', label: 'Beides' },
]

/** Entwurf als Gruppe im Projekt, damit `assign` die Auswirkung live berechnen kann. */
function draftProject(project: Project, draft: InstrumentGroup): Project {
  const exists = project.groups.some((g) => g.id === draft.id)
  return {
    ...project,
    groups: exists ? project.groups.map((g) => (g.id === draft.id ? draft : g)) : [...project.groups, draft],
  }
}

export function DrumConfigurator({ group, onDone }: Props) {
  const { project, dispatch } = useProject()
  const [config, setConfig] = useState<DrumConfig>(group?.drumConfig ?? DRUM_PRESETS.standard.config)
  const [newGroup] = useState(() =>
    createDrumGroup(
      DRUM_PRESETS.standard.config,
      spawnPosition(project),
      uniqueName('Drums', project.groups.map((g) => g.name)),
    ),
  )
  const base = group ?? newGroup
  const set = (patch: Partial<DrumConfig>) => setConfig((c) => ({ ...c, ...patch }))

  const draft: InstrumentGroup = useMemo(
    () => ({ ...base, drumConfig: config, channels: applyDrumConfig(base.channels, config) }),
    [base, config],
  )
  const preview = useMemo(() => assign(draftProject(project, draft)), [project, draft])
  const placement = preview.groups[draft.id]
  const count = draft.channels.length
  const preset = matchPreset(config)
  const boxById = new Map(project.boxes.map((b) => [b.id, b]))

  const submit = () => {
    if (group) dispatch({ type: 'updateGroup', id: group.id, patch: { drumConfig: config, channels: draft.channels } })
    else dispatch({ type: 'addGroup', group: draft })
    onDone(draft.id)
  }

  let placementText = ''
  let placementLevel: 'ok' | 'warning' | 'error' = 'ok'
  if (placement && placement.unpatched > 0) {
    placementLevel = 'error'
    placementText = `${placement.unpatched} ${placement.unpatched === 1 ? 'Kanal passt' : 'Kanäle passen'} auf keine Box`
  } else if (placement?.split) {
    placementLevel = 'warning'
    placementText = `Aufgeteilt: ${placement.boxIds.map((id) => `${boxById.get(id)!.name} (${placement.channelsPerBox[id]})`).join(', ')}`
  } else if (placement?.boxIds[0]) {
    placementText = `→ Box ${boxById.get(placement.boxIds[0])!.name}${placement.pinned ? ' (gepinnt)' : ''}`
  }

  return (
    <div className="editor configurator">
      <div className="field">
        <span className="field-label">Vorlage</span>
        <div className="preset-row">
          {(Object.keys(DRUM_PRESETS) as DrumPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="btn"
              aria-pressed={preset === id}
              onClick={() => setConfig(DRUM_PRESETS[id].config)}
            >
              {DRUM_PRESETS[id].label}
              <small>{applyDrumConfig([], DRUM_PRESETS[id].config).length} Kanäle</small>
            </button>
          ))}
        </div>
      </div>

      <Segmented label="Kick" value={config.kick} options={KICK_OPTIONS} onChange={(kick) => set({ kick })} />

      <div className="field">
        <span className="field-label">Snare & Becken</span>
        <div className="toggle-row">
          <Toggle pressed={config.snareTop} onChange={(snareTop) => set({ snareTop })}>
            Snare Top
          </Toggle>
          <Toggle pressed={config.snareBottom} onChange={(snareBottom) => set({ snareBottom })}>
            Snare Bottom
          </Toggle>
          <Toggle pressed={config.hihat} onChange={(hihat) => set({ hihat })}>
            Hi-Hat
          </Toggle>
          <Toggle pressed={config.percussion} onChange={(percussion) => set({ percussion })}>
            Percussion
          </Toggle>
        </div>
      </div>

      <div className="counter-grid">
        <Stepper label="Toms" value={config.toms} max={DRUM_LIMITS.toms} onChange={(toms) => set({ toms })} />
        <Stepper
          label="Overheads"
          value={config.overheads}
          max={DRUM_LIMITS.overheads}
          onChange={(overheads) => set({ overheads })}
        />
        <Stepper label="Room-Mikros" value={config.rooms} max={DRUM_LIMITS.rooms} onChange={(rooms) => set({ rooms })} />
      </div>

      <div className="config-summary" aria-live="polite">
        <div className="summary-main">
          <strong>
            {count} {count === 1 ? 'Kanal' : 'Kanäle'}
          </strong>
          {placementText && <span className={`summary-place summary-${placementLevel}`}>{placementText}</span>}
        </div>
        <ul className="capacity-chips" aria-label="Freie Inputs danach">
          {project.boxes.map((b) => {
            const u = preview.usage[b.id]
            const free = u.inputs - u.inputsUsed
            return (
              <li key={b.id} className={free === 0 || u.inputsMissing > 0 ? 'full' : ''}>
                <span className="dot" style={{ background: b.color }} />
                {b.name}: {u.inputsMissing > 0 ? `${u.inputsMissing} fehlen` : `${free} frei`}
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={count === 0}>
          {group ? 'Übernehmen' : 'Drumset hinzufügen'}
        </button>
      </div>
    </div>
  )
}
