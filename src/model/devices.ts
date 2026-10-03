import { newId } from '../lib/id'
import { OUTPUT_LABELS, uniqueName } from './defaults'
import type {
  ConnectorType,
  OutputKind,
  Device,
  DeviceInput,
  DeviceKind,
  DeviceOutput,
  FilterSlope,
  FilterType,
  OutputElement,
  Project,
  SignalSource,
  Vec2,
} from './types'

/** Frequenzweichen und Endstufen der PA: Vorlagen, Konfiguration, erlaubte Signalquellen. */

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  crossover: 'Frequenzweiche',
  amp: 'Endstufe',
}

/** Kürzel im Plan. */
export const DEVICE_ABBR: Record<DeviceKind, string> = {
  crossover: 'XO',
  amp: 'PWR',
}

/** Art eines Box-Output-Ziels: Lautsprecher-Art oder Gerät. */
export function targetKindLabel(kind: OutputKind | DeviceKind): string {
  return kind === 'crossover' || kind === 'amp' ? DEVICE_LABELS[kind] : OUTPUT_LABELS[kind]
}

/** Name eines Ziels ohne Box-Output (Lautsprecher oder Geräte-Eingang) für Listen. */
export function unpatchedTargetName(project: Pick<Project, 'outputs' | 'devices'>, outputId: string, inputIndex?: number) {
  if (inputIndex === undefined) {
    const o = project.outputs.find((x) => x.id === outputId)
    return o ? { name: o.name, kind: targetKindLabel(o.kind) } : null
  }
  const d = project.devices.find((x) => x.id === outputId)
  return d ? { name: `${d.name} · ${inputLabel(d, inputIndex)}`, kind: DEVICE_LABELS[d.kind] } : null
}

export const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  xlr: 'XLR (analog)',
  aes: 'AES/EBU',
  dante: 'Dante (Netzwerk)',
  jack: 'Klinke 6,3 mm',
  'speakon-nl4': 'Speakon NL4',
  'speakon-nl8': 'Speakon NL8',
  binding: 'Klemmen',
}

/** Anschlüsse, die je Geräteart und Seite sinnvoll sind. */
export const CONNECTORS: Record<DeviceKind, { inputs: ConnectorType[]; outputs: ConnectorType[] }> = {
  crossover: { inputs: ['xlr', 'aes', 'dante'], outputs: ['xlr', 'aes', 'dante'] },
  amp: { inputs: ['xlr', 'jack', 'aes', 'dante'], outputs: ['speakon-nl4', 'speakon-nl8', 'binding'] },
}

export const FILTER_SLOPES: FilterSlope[] = [12, 18, 24, 48]

export const FILTER_LABELS: Record<FilterType, string> = {
  lr: 'Linkwitz-Riley',
  bw: 'Butterworth',
  bessel: 'Bessel',
}

export const LIMITS = {
  crossoverInputs: { min: 1, max: 4 },
  crossoverOutputs: { min: 1, max: 8 },
  ampChannels: { min: 1, max: 8 },
  frequency: { min: 20, max: 20000 },
}

const LETTERS = 'ABCDEFGH'

/** Bezeichnung eines Eingangs/Kanals: „In A“ bzw. „Kanal A“. */
export function inputLabel(device: Device, index: number): string {
  return `${device.kind === 'amp' ? 'Kanal' : 'In'} ${LETTERS[index] ?? index + 1}`
}

/** Bezeichnung eines Ausgangs: „Out 1“ bzw. „Kanal A“. */
export function outputLabel(device: Device, index: number): string {
  return device.kind === 'amp' ? `Kanal ${LETTERS[index] ?? index + 1}` : `Out ${index + 1}`
}

// ---------- Vorlagen ----------

interface OutputTemplate {
  name: string
  from: number[]
  hp?: number
  lp?: number
}

export interface CrossoverPreset {
  id: string
  label: string
  inputs: string[]
  outputs: OutputTemplate[]
}

const XOVER = 100 // Trennfrequenz Top/Sub in Hz

export const CROSSOVER_PRESETS: CrossoverPreset[] = [
  {
    id: 'stereo-mono-sub',
    label: 'Stereo + Mono-Sub',
    inputs: ['L', 'R'],
    outputs: [
      { name: 'Top L', from: [0], hp: XOVER },
      { name: 'Top R', from: [1], hp: XOVER },
      { name: 'Sub', from: [0, 1], lp: XOVER },
    ],
  },
  {
    id: 'stereo-2way',
    label: '2-Wege stereo',
    inputs: ['L', 'R'],
    outputs: [
      { name: 'Top L', from: [0], hp: XOVER },
      { name: 'Top R', from: [1], hp: XOVER },
      { name: 'Sub L', from: [0], lp: XOVER },
      { name: 'Sub R', from: [1], lp: XOVER },
    ],
  },
  {
    id: 'stereo-3way',
    label: '3-Wege stereo',
    inputs: ['L', 'R'],
    outputs: [
      { name: 'Low L', from: [0], lp: XOVER },
      { name: 'Mid L', from: [0], hp: XOVER, lp: 1500 },
      { name: 'High L', from: [0], hp: 1500 },
      { name: 'Low R', from: [1], lp: XOVER },
      { name: 'Mid R', from: [1], hp: XOVER, lp: 1500 },
      { name: 'High R', from: [1], hp: 1500 },
    ],
  },
  {
    id: 'mono-2way',
    label: '2-Wege mono',
    inputs: ['Mono'],
    outputs: [
      { name: 'Top', from: [0], hp: XOVER },
      { name: 'Sub', from: [0], lp: XOVER },
    ],
  },
]

export interface AmpPreset {
  id: string
  label: string
  channels: number
  watts: number
  ohms: number
}

export const AMP_PRESETS: AmpPreset[] = [
  { id: '2ch', label: '2 Kanäle · 2 × 1000 W', channels: 2, watts: 1000, ohms: 4 },
  { id: '4ch', label: '4 Kanäle · 4 × 700 W', channels: 4, watts: 700, ohms: 4 },
  { id: '8ch', label: '8 Kanäle · 8 × 500 W', channels: 8, watts: 500, ohms: 4 },
]

function crossoverOutput(t: OutputTemplate): DeviceOutput {
  const out: DeviceOutput = { name: t.name, connector: 'xlr', slope: 24, filter: 'lr', from: [...t.from] }
  if (t.hp !== undefined) out.hp = t.hp
  if (t.lp !== undefined) out.lp = t.lp
  return out
}

/** Ein- und Ausgänge einer Weiche nach Vorlage (Name und Position bleiben). */
export function applyCrossoverPreset(device: Device, presetId: string): Device {
  const preset = CROSSOVER_PRESETS.find((p) => p.id === presetId) ?? CROSSOVER_PRESETS[0]
  return {
    ...device,
    inputs: preset.inputs.map((name, i) => ({ name, connector: device.inputs[i]?.connector ?? 'xlr' })),
    outputs: preset.outputs.map(crossoverOutput),
  }
}

function ampChannel(i: number, previous?: { input?: DeviceInput; output?: DeviceOutput }) {
  return {
    input: previous?.input ?? { name: `Kanal ${LETTERS[i] ?? i + 1}`, connector: 'xlr' as ConnectorType },
    output: previous?.output ?? { name: `Kanal ${LETTERS[i] ?? i + 1}`, connector: 'speakon-nl4' as ConnectorType },
  }
}

/** Kanalzahl einer Endstufe ändern; vorhandene Kanäle (inkl. Speisung) bleiben erhalten. */
export function setAmpChannels(device: Device, channels: number): Device {
  const n = clampInt(channels, LIMITS.ampChannels.min, LIMITS.ampChannels.max)
  const list = Array.from({ length: n }, (_, i) =>
    ampChannel(i, { input: device.inputs[i], output: device.outputs[i] }),
  )
  return { ...device, inputs: list.map((c) => c.input), outputs: list.map((c) => c.output) }
}

/** Anzahl der Weichen-Eingänge ändern; Ausgänge verlieren Verweise auf entfernte Eingänge. */
export function setCrossoverInputs(device: Device, count: number): Device {
  const n = clampInt(count, LIMITS.crossoverInputs.min, LIMITS.crossoverInputs.max)
  const inputs = Array.from(
    { length: n },
    (_, i) => device.inputs[i] ?? { name: `In ${LETTERS[i]}`, connector: device.inputs[0]?.connector ?? 'xlr' },
  )
  const outputs = device.outputs.map((o) => ({ ...o, from: (o.from ?? []).filter((f) => f < n) }))
  return { ...device, inputs, outputs }
}

/** Anzahl der Weichen-Ausgänge ändern; neue Ausgänge sind Vollbereich vom ersten Eingang. */
export function setCrossoverOutputs(device: Device, count: number): Device {
  const n = clampInt(count, LIMITS.crossoverOutputs.min, LIMITS.crossoverOutputs.max)
  const outputs = Array.from(
    { length: n },
    (_, i) => device.outputs[i] ?? crossoverOutput({ name: `Out ${i + 1}`, from: [0] }),
  )
  return { ...device, outputs }
}

function clampInt(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : min
}

export function clampFrequency(hz: number): number {
  return clampInt(hz, LIMITS.frequency.min, LIMITS.frequency.max)
}

/** Kurzbeschreibung eines Weichen-Ausgangs, z. B. „HP 100 Hz · 24 dB/Okt LR“. */
export function describeFilter(out: DeviceOutput): string {
  const fmt = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toLocaleString('de-DE')} kHz` : `${hz} Hz`)
  const parts: string[] = []
  if (out.hp !== undefined && out.lp !== undefined) parts.push(`BP ${fmt(out.hp)}–${fmt(out.lp)}`)
  else if (out.hp !== undefined) parts.push(`HP ${fmt(out.hp)}`)
  else if (out.lp !== undefined) parts.push(`LP ${fmt(out.lp)}`)
  else return 'Vollbereich'
  parts.push(`${out.slope ?? 24} dB/Okt ${(out.filter ?? 'lr').toUpperCase()}`)
  return parts.join(' · ')
}

/** Hinweise zu einer Weichen-Konfiguration (keine harten Fehler). */
export function crossoverIssues(device: Device): string[] {
  if (device.kind !== 'crossover') return []
  const issues: string[] = []
  device.outputs.forEach((o, i) => {
    const label = `${outputLabel(device, i)} (${o.name})`
    if (!o.from || o.from.length === 0) issues.push(`${label}: kein Eingang zugewiesen, der Ausgang bleibt stumm.`)
    if (o.hp !== undefined && o.lp !== undefined && o.hp >= o.lp)
      issues.push(`${label}: Hochpass (${o.hp} Hz) liegt nicht unter dem Tiefpass (${o.lp} Hz).`)
  })
  return issues
}

// ---------- Anlegen ----------

type DeviceProject = Pick<Project, 'stage' | 'boxes' | 'groups' | 'outputs' | 'devices'>

/** Geräte stehen als Rack neben der Bühne (rechts), untereinander ohne Überlappung. */
function devicePosition(project: DeviceProject): Vec2 {
  const { width, depth } = project.stage
  const taken = [...project.boxes, ...project.groups, ...project.outputs, ...project.devices].map((e) => e.pos)
  const candidates: Vec2[] = []
  for (let y = Math.max(0.5, depth - 2.5); y >= 0; y -= 1.7) candidates.push({ x: width + 0.6, y })
  for (let y = Math.max(0.5, depth - 2.5); y >= 0; y -= 1.7) candidates.push({ x: -0.6, y })
  return candidates.find((c) => taken.every((t) => Math.hypot(t.x - c.x, t.y - c.y) >= 1.2)) ?? candidates[0]
}

export function createCrossover(project: DeviceProject, presetId = CROSSOVER_PRESETS[0].id): Device {
  const base: Device = {
    id: newId(),
    kind: 'crossover',
    name: uniqueName('Weiche', project.devices.map((d) => d.name)),
    pos: devicePosition(project),
    inputs: [],
    outputs: [],
  }
  return applyCrossoverPreset(base, presetId)
}

export function createAmp(project: DeviceProject, presetId = AMP_PRESETS[0].id): Device {
  const preset = AMP_PRESETS.find((p) => p.id === presetId) ?? AMP_PRESETS[0]
  const base: Device = {
    id: newId(),
    kind: 'amp',
    name: uniqueName('Endstufe', project.devices.map((d) => d.name)),
    pos: devicePosition(project),
    inputs: [],
    outputs: [],
    power: { watts: preset.watts, ohms: preset.ohms },
  }
  return setAmpChannels(base, preset.channels)
}

// ---------- Signalquellen ----------

export interface SourceOption {
  source: SignalSource
  label: string
}

function sourceOptions(devices: Device[], kinds: DeviceKind[], excludeId?: string): SourceOption[] {
  return devices
    .filter((d) => kinds.includes(d.kind) && d.id !== excludeId)
    .flatMap((d) =>
      d.outputs.map((o, i) => ({
        source: { deviceId: d.id, output: i },
        label: `${d.name} · ${outputLabel(d, i)}${d.kind === 'crossover' ? ` ${o.name} (${describeFilter(o)})` : ''}`,
      })),
    )
}

/**
 * Mögliche Quellen außer der Stagebox. Kette ohne Schleifen: Stagebox → Weiche → Endstufe →
 * Lautsprecher. Weichen-Eingänge kommen immer von der Stagebox.
 */
export function sourcesForOutputElement(project: Pick<Project, 'devices'>): SourceOption[] {
  return sourceOptions(project.devices, ['crossover', 'amp'])
}

export function sourcesForDeviceInput(project: Pick<Project, 'devices'>, device: Device): SourceOption[] {
  return device.kind === 'amp' ? sourceOptions(project.devices, ['crossover'], device.id) : []
}

/** Ist die Quelle im Projekt gültig und für diesen Verbraucher erlaubt? */
export function isValidSource(
  project: Pick<Project, 'devices'>,
  source: SignalSource | undefined,
  consumer: { kind: 'element' } | { kind: 'device'; device: Device },
): boolean {
  if (!source) return false
  const device = project.devices.find((d) => d.id === source.deviceId)
  if (!device || !Number.isInteger(source.output) || source.output < 0 || source.output >= device.outputs.length) return false
  if (consumer.kind === 'element') return true
  return consumer.device.kind === 'amp' && device.kind === 'crossover' && device.id !== consumer.device.id
}

export interface Consumer {
  kind: 'element' | 'device'
  id: string
  /** Bei Geräten: Index des gespeisten Eingangs. */
  inputIndex?: number
  label: string
}

/** Wer hängt an einem Geräte-Ausgang? (Lautsprecher, Endstufen-Kanäle) */
export function consumersOf(
  project: Pick<Project, 'devices' | 'outputs'>,
  deviceId: string,
  output: number,
): Consumer[] {
  const matches = (s?: SignalSource) => s?.deviceId === deviceId && s.output === output
  const elements: Consumer[] = project.outputs
    .filter((o: OutputElement) => matches(o.source))
    .map((o) => ({ kind: 'element', id: o.id, label: o.name }))
  const devices: Consumer[] = project.devices.flatMap((d) =>
    d.inputs.flatMap((input, i) =>
      matches(input.source) ? [{ kind: 'device' as const, id: d.id, inputIndex: i, label: `${d.name} · ${inputLabel(d, i)}` }] : [],
    ),
  )
  return [...devices, ...elements]
}

/**
 * Entfernt ungültige Quellen (gelöschtes Gerät, entfernter Ausgang, unerlaubte Verbindung),
 * damit nichts ins Leere zeigt. Gibt dasselbe Projekt zurück, wenn nichts zu tun war.
 */
export function cleanSources<T extends Pick<Project, 'devices' | 'outputs'>>(project: T): T {
  let changed = false
  const outputs = project.outputs.map((o) => {
    if (!o.source || isValidSource(project, o.source, { kind: 'element' })) return o
    changed = true
    const copy = { ...o }
    delete copy.source
    return copy
  })
  const devices = project.devices.map((d) => {
    let deviceChanged = false
    const inputs = d.inputs.map((input) => {
      if (!input.source || isValidSource(project, input.source, { kind: 'device', device: d })) return input
      deviceChanged = true
      const copy = { ...input }
      delete copy.source
      return copy
    })
    if (!deviceChanged) return d
    changed = true
    return { ...d, inputs }
  })
  return changed ? { ...project, outputs, devices } : project
}
