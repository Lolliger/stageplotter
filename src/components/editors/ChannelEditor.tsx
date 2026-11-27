import { useState } from 'react'
import { newId } from '../../lib/id'
import { PICKUP_SUGGESTIONS, STAND_SUGGESTIONS } from '../../model/templates'
import type { Channel } from '../../model/types'
import { TextField } from '../ui/TextField'

interface Props {
  channels: Channel[]
  groupName: string
  onChange: (channels: Channel[]) => void
}

/** Kanalliste einer Gruppe: antippen zum Bearbeiten, verschieben, löschen, hinzufügen. */
export function ChannelEditor({ channels, groupName, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  const update = (id: string, patch: Partial<Channel>) => {
    onChange(
      channels.map((c) => {
        if (c.id !== id) return c
        const next = { ...c, ...patch }
        if (!next.stand) delete next.stand
        if (!next.note) delete next.note
        return next
      }),
    )
  }
  const move = (index: number, dir: -1 | 1) => {
    const next = [...channels]
    const [item] = next.splice(index, 1)
    next.splice(index + dir, 0, item)
    onChange(next)
  }
  const remove = (id: string) => {
    onChange(channels.filter((c) => c.id !== id))
    setOpenId(null)
  }
  const add = () => {
    const channel: Channel = { id: newId(), name: `${groupName} ${channels.length + 1}`, pickup: '' }
    onChange([...channels, channel])
    setOpenId(channel.id)
  }

  return (
    <div className="field">
      <datalist id="pickup-suggestions">
        {PICKUP_SUGGESTIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="stand-suggestions">
        {STAND_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <ol className="channel-list editable">
        {channels.map((c, i) => {
          const open = openId === c.id
          return (
            <li key={c.id} className={open ? 'open' : ''}>
              <button
                type="button"
                className="channel-row"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : c.id)}
              >
                <span className="channel-index">{i + 1}</span>
                <span className="channel-name">
                  {c.name}
                  {(c.stand || c.note) && <small className="channel-note">{[c.stand, c.note].filter(Boolean).join(' · ')}</small>}
                </span>
                <span className="channel-pickup">{c.pickup || '–'}</span>
                <span className="chevron" aria-hidden="true">
                  {open ? '▴' : '▾'}
                </span>
              </button>
              {open && (
                <div className="channel-form">
                  <div className="field-row">
                    <TextField label="Name" value={c.name} onChange={(name) => update(c.id, { name })} />
                    <TextField
                      label="Abnahme"
                      value={c.pickup}
                      list="pickup-suggestions"
                      placeholder="Mikro oder DI"
                      allowEmpty
                      onChange={(pickup) => update(c.id, { pickup })}
                    />
                  </div>
                  <TextField
                    label="Stativ"
                    value={c.stand ?? ''}
                    list="stand-suggestions"
                    placeholder="z. B. Galgen klein, Clip"
                    allowEmpty
                    onChange={(stand) => update(c.id, { stand })}
                  />
                  <TextField
                    label="Notiz"
                    value={c.note ?? ''}
                    placeholder="z. B. 48V, Kabel 10 m"
                    allowEmpty
                    onChange={(note) => update(c.id, { note })}
                  />
                  <div className="channel-actions">
                    <button type="button" className="btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Nach oben">
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={i === channels.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Nach unten"
                    >
                      ↓
                    </button>
                    <span className="spacer" />
                    <button type="button" className="btn btn-danger" onClick={() => remove(c.id)}>
                      Kanal entfernen
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <button type="button" className="btn add-channel" onClick={add}>
        + Kanal
      </button>
    </div>
  )
}
