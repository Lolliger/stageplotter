import { normalizeDrumConfig } from '../model/drums'
import { normalizeRotation } from '../model/shapes'
import { CONNECTORS, FILTER_SLOPES, clampFrequency, cleanSources } from '../model/devices'
import { BOX_COLORS, DEFAULT_BOX_INPUTS, DEFAULT_BOX_OUTPUTS, DEFAULT_STAGE, STAGE_LIMITS } from '../model/defaults'
import type {
  Channel,
  ConnectorType,
  Device,
  DeviceInput,
  DeviceKind,
  DeviceOutput,
  DrumConfig,
  FilterSlope,
  SignalSource,
  InstrumentGroup,
  InstrumentType,
  OutputElement,
  OutputKind,
  Project,
  Stagebox,
  Vec2,
} from '../model/types'
import { clamp } from './geometry'
import { newId } from './id'

export const SCHEMA_VERSION = 1

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string }

const INSTRUMENT_TYPES: InstrumentType[] = ['drums', 'percussion', 'bass', 'guitar', 'keys', 'vocals', 'other']
const OUTPUT_KINDS: OutputKind[] = ['wedge', 'iem', 'sidefill', 'pa', 'sub']

class SchemaError extends Error {}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function obj(v: unknown, where: string): Obj {
  if (!isObj(v)) throw new SchemaError(`${where}: Objekt erwartet`)
  return v
}

function arr(v: unknown, where: string): unknown[] {
  if (v === undefined) return []
  if (!Array.isArray(v)) throw new SchemaError(`${where}: Liste erwartet`)
  return v
}

function num(v: unknown, where: string): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new SchemaError(`${where}: Zahl erwartet`)
  return n
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v : fallback
}

function id(v: unknown): string {
  return typeof v === 'string' && v !== '' ? v : newId()
}

function vec(v: unknown, where: string): Vec2 {
  const o = obj(v, where)
  return { x: num(o.x, `${where}.x`), y: num(o.y, `${where}.y`) }
}

function capacity(v: unknown, fallback: number, where: string): number {
  if (v === undefined) return fallback
  return clamp(Math.round(num(v, where)), 0, 256)
}

function channel(v: unknown, where: string): Channel {
  const o = obj(v, where)
  const c: Channel = { id: id(o.id), name: str(o.name, 'Kanal'), pickup: typeof o.pickup === 'string' ? o.pickup : '' }
  if (typeof o.note === 'string' && o.note !== '') c.note = o.note
  if (typeof o.slot === 'string' && o.slot !== '') c.slot = o.slot
  return c
}

function source(v: unknown): { source?: SignalSource } {
  if (!isObj(v) || typeof v.deviceId !== 'string' || !Number.isInteger(v.output)) return {}
  return { source: { deviceId: v.deviceId, output: v.output as number } }
}

function rotation(v: unknown): { rotation?: number } {
  return typeof v === 'number' && Number.isFinite(v) ? { rotation: normalizeRotation(v) } : {}
}

function drumConfig(v: unknown): { drumConfig?: DrumConfig } {
  if (!isObj(v)) return {}
  const n = (x: unknown) => (typeof x === 'number' ? x : 0)
  return {
    drumConfig: normalizeDrumConfig({
      kick: v.kick as DrumConfig['kick'],
      snareTop: v.snareTop === true,
      snareBottom: v.snareBottom === true,
      hihat: v.hihat === true,
      toms: n(v.toms),
      overheads: n(v.overheads),
      rooms: n(v.rooms),
      percussion: v.percussion === true,
    }),
  }
}

/**
 * Prüft und normalisiert ein Projekt aus unbekannter Quelle (localStorage, JSON-Import).
 * Fehlende optionale Felder werden ergänzt, kaputte Pflichtfelder führen zu einer Fehlermeldung.
 */
export function parseProject(data: unknown): ParseResult {
  try {
    const o = obj(data, 'Projekt')
    if (o.version !== undefined && o.version !== SCHEMA_VERSION) {
      throw new SchemaError(`Unbekannte Version ${String(o.version)}`)
    }

    const stageRaw = o.stage === undefined ? DEFAULT_STAGE : obj(o.stage, 'stage')
    const stage = {
      width: clamp(num(stageRaw.width, 'stage.width'), STAGE_LIMITS.min, STAGE_LIMITS.max),
      depth: clamp(num(stageRaw.depth, 'stage.depth'), STAGE_LIMITS.min, STAGE_LIMITS.max),
    }

    const boxes: Stagebox[] = arr(o.boxes, 'boxes').map((v, i) => {
      const b = obj(v, `boxes[${i}]`)
      return {
        id: id(b.id),
        name: str(b.name, String.fromCharCode(65 + (i % 26))),
        pos: vec(b.pos, `boxes[${i}].pos`),
        inputs: capacity(b.inputs, DEFAULT_BOX_INPUTS, `boxes[${i}].inputs`),
        outputs: capacity(b.outputs, DEFAULT_BOX_OUTPUTS, `boxes[${i}].outputs`),
        color: typeof b.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(b.color) ? b.color : BOX_COLORS[i % BOX_COLORS.length],
      }
    })
    const boxIds = new Set(boxes.map((b) => b.id))
    const pin = (v: unknown) => (typeof v === 'string' && boxIds.has(v) ? { pinnedBoxId: v } : {})

    const groups: InstrumentGroup[] = arr(o.groups, 'groups').map((v, i) => {
      const g = obj(v, `groups[${i}]`)
      return {
        id: id(g.id),
        type: INSTRUMENT_TYPES.includes(g.type as InstrumentType) ? (g.type as InstrumentType) : 'other',
        name: str(g.name, 'Instrument'),
        pos: vec(g.pos, `groups[${i}].pos`),
        channels: arr(g.channels, `groups[${i}].channels`).map((c, j) => channel(c, `groups[${i}].channels[${j}]`)),
        ...pin(g.pinnedBoxId),
        ...drumConfig(g.drumConfig),
        ...(g.form === 'amp' ? { form: 'amp' as const } : {}),
        ...rotation(g.rotation),
      }
    })

    const outputs: OutputElement[] = arr(o.outputs, 'outputs').map((v, i) => {
      const e = obj(v, `outputs[${i}]`)
      return {
        id: id(e.id),
        kind: OUTPUT_KINDS.includes(e.kind as OutputKind) ? (e.kind as OutputKind) : 'wedge',
        name: str(e.name, 'Output'),
        pos: vec(e.pos, `outputs[${i}].pos`),
        ...pin(e.pinnedBoxId),
        ...rotation(e.rotation),
        ...source(e.source),
      }
    })

    const devices: Device[] = arr(o.devices, 'devices').map((v, i) => {
      const d = obj(v, `devices[${i}]`)
      const kind: DeviceKind = d.kind === 'amp' ? 'amp' : 'crossover'
      const allowed = CONNECTORS[kind]
      const connector = (c: unknown, list: ConnectorType[]): ConnectorType =>
        list.includes(c as ConnectorType) ? (c as ConnectorType) : list[0]
      const inputs: DeviceInput[] = arr(d.inputs, `devices[${i}].inputs`).map((iv, j) => {
        const x = obj(iv, `devices[${i}].inputs[${j}]`)
        return { name: str(x.name, `In ${j + 1}`), connector: connector(x.connector, allowed.inputs), ...source(x.source) }
      })
      const outputs: DeviceOutput[] = arr(d.outputs, `devices[${i}].outputs`).map((ov, j) => {
        const x = obj(ov, `devices[${i}].outputs[${j}]`)
        const out: DeviceOutput = { name: str(x.name, `Out ${j + 1}`), connector: connector(x.connector, allowed.outputs) }
        if (kind === 'crossover') {
          if (typeof x.hp === 'number') out.hp = clampFrequency(x.hp)
          if (typeof x.lp === 'number') out.lp = clampFrequency(x.lp)
          out.slope = FILTER_SLOPES.includes(x.slope as FilterSlope) ? (x.slope as FilterSlope) : 24
          out.filter = x.filter === 'bw' || x.filter === 'bessel' ? x.filter : 'lr'
          out.from = Array.isArray(x.from)
            ? [...new Set(x.from.filter((f): f is number => Number.isInteger(f) && f >= 0 && f < inputs.length))]
            : []
        }
        return out
      })
      const device: Device = {
        id: id(d.id),
        kind,
        name: str(d.name, kind === 'amp' ? 'Endstufe' : 'Weiche'),
        pos: vec(d.pos, `devices[${i}].pos`),
        inputs,
        outputs,
        ...pin(d.pinnedBoxId),
      }
      if (kind === 'amp') {
        const power = isObj(d.power) ? d.power : {}
        device.power = {
          watts: typeof power.watts === 'number' && power.watts > 0 ? Math.round(power.watts) : 1000,
          ohms: typeof power.ohms === 'number' && power.ohms > 0 ? power.ohms : 4,
        }
      }
      return device
    })

    return {
      ok: true,
      project: {
        version: SCHEMA_VERSION,
        name: str(o.name, 'Projekt'),
        stage,
        ...(o.cableView === 'direct' || o.cableView === 'bundled' ? { cableView: o.cableView } : {}),
        ...(typeof o.snap === 'boolean' ? { snap: o.snap } : {}),
        // Verweise auf fehlende Geräte/Ausgänge oder unerlaubte Verbindungen fallen weg
        ...cleanSources({ boxes, groups, outputs, devices }),
      },
    }
  } catch (e) {
    if (e instanceof SchemaError) return { ok: false, error: e.message }
    throw e
  }
}
