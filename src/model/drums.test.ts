import { describe, expect, test } from 'vitest'
import {
  DRUM_PRESETS,
  applyDrumConfig,
  countDrumChannels,
  createDrumGroup,
  drumSlots,
  matchPreset,
  normalizeDrumConfig,
} from './drums'
import type { DrumConfig } from './types'

const names = (c: DrumConfig) => drumSlots(c).map((s) => s.name)

describe('drum presets', () => {
  test('Minimal = Kick, Snare, 2x OH', () => {
    expect(names(DRUM_PRESETS.minimal.config)).toEqual(['Kick In', 'Snare Top', 'OH L', 'OH R'])
  })

  test('Standard = Minimal + Hi-Hat + 2 Toms', () => {
    expect(names(DRUM_PRESETS.standard.config)).toEqual(['Kick In', 'Snare Top', 'Hi-Hat', 'Tom 1', 'Tom 2', 'OH L', 'OH R'])
  })

  test('Voll = everything', () => {
    expect(names(DRUM_PRESETS.full.config)).toEqual([
      'Kick In',
      'Kick Out',
      'Snare Top',
      'Snare Bottom',
      'Hi-Hat',
      'Tom 1',
      'Tom 2',
      'Tom 3',
      'Tom 4',
      'OH L',
      'OH R',
      'Room L',
      'Room R',
      'Percussion',
    ])
    expect(countDrumChannels(DRUM_PRESETS.full.config)).toBe(14)
  })

  test('matchPreset recognises presets and custom configs', () => {
    expect(matchPreset(DRUM_PRESETS.standard.config)).toBe('standard')
    expect(matchPreset({ ...DRUM_PRESETS.standard.config, toms: 3 })).toBeNull()
  })
})

describe('drum config', () => {
  test('kick in / out / both', () => {
    const base = DRUM_PRESETS.minimal.config
    expect(names({ ...base, kick: 'out' })[0]).toBe('Kick Out')
    expect(names({ ...base, kick: 'both' }).slice(0, 2)).toEqual(['Kick In', 'Kick Out'])
  })

  test('single overhead / room are named without L/R', () => {
    const c = { ...DRUM_PRESETS.minimal.config, overheads: 1, rooms: 1 }
    expect(names(c)).toEqual(['Kick In', 'Snare Top', 'OH', 'Room'])
  })

  test('counts are clamped to their limits', () => {
    const c = normalizeDrumConfig({ ...DRUM_PRESETS.minimal.config, toms: 9, overheads: -1, rooms: 2.4 })
    expect(c).toMatchObject({ toms: 4, overheads: 0, rooms: 2 })
  })

  test('reconfiguring keeps edited channels and manual extras', () => {
    const group = createDrumGroup(DRUM_PRESETS.standard.config, { x: 0, y: 0 })
    const edited = group.channels.map((c) => (c.slot === 'snare-top' ? { ...c, pickup: 'i5', note: 'Clip' } : c))
    edited.push({ id: 'extra', name: 'Trigger', pickup: 'DI' })
    const next = applyDrumConfig(edited, { ...DRUM_PRESETS.standard.config, toms: 3, hihat: false })
    expect(next.map((c) => c.name)).toEqual(['Kick In', 'Snare Top', 'Tom 1', 'Tom 2', 'Tom 3', 'OH L', 'OH R', 'Trigger'])
    const snare = next.find((c) => c.slot === 'snare-top')!
    expect(snare).toMatchObject({ pickup: 'i5', note: 'Clip' })
    expect(snare.id).toBe(group.channels.find((c) => c.slot === 'snare-top')!.id)
  })

  test('createDrumGroup stores the config', () => {
    const g = createDrumGroup(DRUM_PRESETS.minimal.config, { x: 1, y: 2 }, 'Drums 2')
    expect(g).toMatchObject({ type: 'drums', name: 'Drums 2', pos: { x: 1, y: 2 }, drumConfig: DRUM_PRESETS.minimal.config })
    expect(g.channels).toHaveLength(4)
  })
})
