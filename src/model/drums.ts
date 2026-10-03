import { newId } from '../lib/id'
import type { Channel, DrumConfig, InstrumentGroup, Vec2 } from './types'

export const DRUM_LIMITS = { toms: 4, overheads: 2, rooms: 2 }

export type DrumPresetId = 'minimal' | 'standard' | 'full'

export const DRUM_PRESETS: Record<DrumPresetId, { label: string; config: DrumConfig }> = {
  minimal: {
    label: 'Minimal',
    config: { kick: 'in', snareTop: true, snareBottom: false, hihat: false, toms: 0, overheads: 2, rooms: 0, percussion: false },
  },
  standard: {
    label: 'Standard',
    config: { kick: 'in', snareTop: true, snareBottom: false, hihat: true, toms: 2, overheads: 2, rooms: 0, percussion: false },
  },
  full: {
    label: 'Voll',
    config: { kick: 'both', snareTop: true, snareBottom: true, hihat: true, toms: 4, overheads: 2, rooms: 2, percussion: true },
  },
}

interface DrumSlot {
  slot: string
  name: string
  pickup: string
}

function clampInt(v: number, max: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0
}

export function normalizeDrumConfig(config: DrumConfig): DrumConfig {
  return {
    kick: config.kick === 'out' || config.kick === 'both' ? config.kick : 'in',
    snareTop: !!config.snareTop,
    snareBottom: !!config.snareBottom,
    hihat: !!config.hihat,
    toms: clampInt(config.toms, DRUM_LIMITS.toms),
    overheads: clampInt(config.overheads, DRUM_LIMITS.overheads),
    rooms: clampInt(config.rooms, DRUM_LIMITS.rooms),
    percussion: !!config.percussion,
  }
}

function pair(prefix: string, label: string, count: number, pickup: string): DrumSlot[] {
  if (count === 1) return [{ slot: `${prefix}-1`, name: label, pickup }]
  return Array.from({ length: count }, (_, i) => ({
    slot: `${prefix}-${i + 1}`,
    name: `${label} ${count === 2 ? (i === 0 ? 'L' : 'R') : i + 1}`,
    pickup,
  }))
}

/** Kanäle in üblicher Reihenfolge einer Drum-Inputliste. */
export function drumSlots(input: DrumConfig): DrumSlot[] {
  const c = normalizeDrumConfig(input)
  const slots: DrumSlot[] = []
  if (c.kick === 'in' || c.kick === 'both') slots.push({ slot: 'kick-in', name: 'Kick In', pickup: 'Beta 91A' })
  if (c.kick === 'out' || c.kick === 'both') slots.push({ slot: 'kick-out', name: 'Kick Out', pickup: 'D112' })
  if (c.snareTop) slots.push({ slot: 'snare-top', name: 'Snare Top', pickup: 'SM57' })
  if (c.snareBottom) slots.push({ slot: 'snare-bottom', name: 'Snare Bottom', pickup: 'e604' })
  if (c.hihat) slots.push({ slot: 'hihat', name: 'Hi-Hat', pickup: 'KM 184' })
  for (let i = 1; i <= c.toms; i++) slots.push({ slot: `tom-${i}`, name: `Tom ${i}`, pickup: 'e604' })
  slots.push(...pair('oh', 'OH', c.overheads, 'KM 184'))
  slots.push(...pair('room', 'Room', c.rooms, 'C414'))
  if (c.percussion) slots.push({ slot: 'perc', name: 'Percussion', pickup: 'SM57' })
  return slots
}

export function countDrumChannels(config: DrumConfig): number {
  return drumSlots(config).length
}

/**
 * Baut die Kanalliste aus einer Konfiguration. Bestehende Kanäle mit gleichem Slot werden
 * wiederverwendet (eigene Namen, Mikros und Notizen bleiben erhalten), manuell hinzugefügte
 * Kanäle ohne Slot bleiben am Ende stehen.
 */
export function applyDrumConfig(existing: Channel[], config: DrumConfig): Channel[] {
  const bySlot = new Map(existing.filter((c) => c.slot).map((c) => [c.slot!, c]))
  const fromConfig = drumSlots(config).map(
    (s): Channel => bySlot.get(s.slot) ?? { id: newId(), name: s.name, pickup: s.pickup, slot: s.slot },
  )
  return [...fromConfig, ...existing.filter((c) => !c.slot)]
}

/** Erkennt, ob eine Konfiguration genau einer Vorlage entspricht. */
export function matchPreset(config: DrumConfig): DrumPresetId | null {
  const c = normalizeDrumConfig(config)
  for (const [id, preset] of Object.entries(DRUM_PRESETS) as [DrumPresetId, (typeof DRUM_PRESETS)[DrumPresetId]][]) {
    if (JSON.stringify(preset.config) === JSON.stringify(c)) return id
  }
  return null
}

export function createDrumGroup(config: DrumConfig, pos: Vec2, name = 'Drums'): InstrumentGroup {
  const drumConfig = normalizeDrumConfig(config)
  return { id: newId(), type: 'drums', name, pos, channels: applyDrumConfig([], drumConfig), drumConfig }
}
