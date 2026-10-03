import { newId } from '../lib/id'
import type { Channel, InstrumentGroup, InstrumentType, Vec2 } from './types'

export interface ChannelTemplate {
  name: string
  pickup: string
  note?: string
}

export interface InstrumentTemplate {
  id: string
  type: InstrumentType
  /** Anzeige im Hinzufügen-Menü. */
  label: string
  /** Name der neuen Gruppe. */
  name: string
  channels: ChannelTemplate[]
}

/** Einfache Vorlagen. Drums haben einen eigenen Konfigurator (siehe drums.ts). */
export const INSTRUMENT_TEMPLATES: InstrumentTemplate[] = [
  {
    id: 'bass-di-mic',
    type: 'bass',
    label: 'Bass (DI + Mikro)',
    name: 'Bass',
    channels: [
      { name: 'Bass DI', pickup: 'DI' },
      { name: 'Bass Amp', pickup: 'RE20' },
    ],
  },
  {
    id: 'bass-di',
    type: 'bass',
    label: 'Bass (DI)',
    name: 'Bass',
    channels: [{ name: 'Bass DI', pickup: 'DI' }],
  },
  {
    id: 'guitar-1',
    type: 'guitar',
    label: 'Gitarre (1 Mikro)',
    name: 'Gitarre',
    channels: [{ name: 'Gitarre', pickup: 'SM57' }],
  },
  {
    id: 'guitar-2',
    type: 'guitar',
    label: 'Gitarre (2 Mikros)',
    name: 'Gitarre',
    channels: [
      { name: 'Gitarre 1', pickup: 'SM57' },
      { name: 'Gitarre 2', pickup: 'e906' },
    ],
  },
  {
    id: 'acoustic',
    type: 'guitar',
    label: 'Akustikgitarre (DI)',
    name: 'Akustik',
    channels: [{ name: 'Akustik', pickup: 'DI' }],
  },
  {
    id: 'keys-mono',
    type: 'keys',
    label: 'Keys (mono)',
    name: 'Keys',
    channels: [{ name: 'Keys', pickup: 'DI' }],
  },
  {
    id: 'keys-stereo',
    type: 'keys',
    label: 'Keys (stereo)',
    name: 'Keys',
    channels: [
      { name: 'Keys L', pickup: 'DI' },
      { name: 'Keys R', pickup: 'DI' },
    ],
  },
  {
    id: 'lead-vox',
    type: 'vocals',
    label: 'Lead Vox',
    name: 'Lead Vox',
    channels: [{ name: 'Lead Vox', pickup: 'SM58' }],
  },
  {
    id: 'backing-vox',
    type: 'vocals',
    label: 'Backing Vox',
    name: 'Backing Vox',
    channels: [{ name: 'Backing Vox', pickup: 'SM58' }],
  },
  {
    id: 'percussion',
    type: 'percussion',
    label: 'Percussion',
    name: 'Percussion',
    channels: [
      { name: 'Perc L', pickup: 'KM 184' },
      { name: 'Perc R', pickup: 'KM 184' },
    ],
  },
]

export function getTemplate(id: string): InstrumentTemplate | undefined {
  return INSTRUMENT_TEMPLATES.find((t) => t.id === id)
}

export function channelsFromTemplate(channels: ChannelTemplate[]): Channel[] {
  return channels.map((c) => ({ id: newId(), ...c }))
}

export function createGroupFromTemplate(
  template: InstrumentTemplate,
  pos: Vec2,
  name = template.name,
): InstrumentGroup {
  return {
    id: newId(),
    type: template.type,
    name,
    pos,
    channels: channelsFromTemplate(template.channels),
  }
}

/** Vorschläge für das Abnahme-Feld (Freitext bleibt möglich). */
export const PICKUP_SUGGESTIONS = [
  'DI',
  'SM57',
  'SM58',
  'Beta 52A',
  'Beta 57A',
  'Beta 58A',
  'Beta 91A',
  'D112',
  'e604',
  'e606',
  'e906',
  'e935',
  'MD 421',
  'KM 184',
  'C414',
  'RE20',
  'KSM9',
  'Funk',
]
