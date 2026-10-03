import {
  CONNECTOR_LABELS,
  DEVICE_LABELS,
  consumersOf,
  describeFilter,
  inputLabel,
  outputLabel,
  targetKindLabel,
  unpatchedTargetName,
} from '../../model/devices'
import type { Device, Project, Stagebox } from '../../model/types'
import type { Assignment } from '../assign'
import { roundMeters } from '../geometry'

export interface InputRow {
  port: string
  channel: string
  group: string
  pickup: string
  note: string
  distance: string
}

export interface OutputRow {
  port: string
  name: string
  kind: string
  distance: string
}

export interface BoxTable<Row> {
  box: Stagebox
  /** z. B. "11/16 In" */
  usage: string
  missing: number
  pinned: Set<number>
  rows: Row[]
}

export function formatMeters(m: number): string {
  return `${roundMeters(m).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`
}

/** Inputliste je Box für den Export (gleiche Reihenfolge wie in der App). */
export function inputTables(project: Project, assignment: Assignment): { boxes: BoxTable<InputRow>[]; unpatched: InputRow[] } {
  const groupById = new Map(project.groups.map((g) => [g.id, g]))
  const boxes = project.boxes.map((box) => {
    const ports = assignment.inputs[box.id] ?? []
    const usage = assignment.usage[box.id]
    const pinned = new Set<number>()
    const rows = ports.map((p, i) => {
      if (assignment.groups[p.groupId]?.pinned) pinned.add(i)
      return {
        port: p.label,
        channel: p.channelName,
        group: p.groupName,
        pickup: p.pickup,
        note: p.note ?? '',
        distance: formatMeters(p.distance),
      }
    })
    return { box, usage: `${usage.inputsUsed}/${usage.inputs} In`, missing: usage.inputsMissing, pinned, rows }
  })
  const unpatched = assignment.unpatchedInputs.map((u) => {
    const group = groupById.get(u.groupId)!
    const channel = group.channels.find((c) => c.id === u.channelId)!
    return { port: '–', channel: channel.name, group: group.name, pickup: channel.pickup, note: channel.note ?? '', distance: '' }
  })
  return { boxes, unpatched }
}

/** Outputliste je Box für den Export. Boxen ohne Outputs werden weggelassen. */
export function outputTables(project: Project, assignment: Assignment): { boxes: BoxTable<OutputRow>[]; unpatched: OutputRow[] } {
  const boxes = project.boxes
    .map((box) => {
      const ports = assignment.outputs[box.id] ?? []
      const usage = assignment.usage[box.id]
      const pinned = new Set<number>()
      const rows = ports.map((p, i) => {
        const a = p.inputIndex === undefined ? assignment.outputElements[p.outputId] : assignment.deviceInputs[p.outputId]?.[p.inputIndex]
        if (a?.pinned) pinned.add(i)
        return { port: p.label, name: p.name, kind: targetKindLabel(p.kind), distance: formatMeters(p.distance) }
      })
      return { box, usage: `${usage.outputsUsed}/${usage.outputs} Out`, missing: usage.outputsMissing, pinned, rows }
    })
    .filter((t) => t.rows.length > 0 || t.missing > 0)
  const unpatched = assignment.unpatchedOutputs.flatMap((u) => {
    const target = unpatchedTargetName(project, u.outputId, u.inputIndex)
    return target ? [{ port: '–', name: target.name, kind: target.kind, distance: '' }] : []
  })
  return { boxes, unpatched }
}

// ---------- PA-Signalweg ----------

export interface SignalRow {
  /** „Out 1“ bzw. „Kanal A“ */
  port: string
  /** Name des Ausgangs (Weiche) */
  name: string
  /** Woher das Signal kommt */
  from: string
  /** Filter (Weiche) bzw. Leistung (Endstufe) und Anschluss */
  detail: string
  /** Was daran hängt */
  to: string
}

export interface DeviceTable {
  device: Device
  title: string
  /** z. B. „2 Eingänge (XLR) · 3 Ausgänge“ */
  summary: string
  /** Speisung der Weichen-Eingänge, z. B. „In A (L) ← B-Out 1“ */
  feeds: string[]
  rows: SignalRow[]
}

/** Woher kommt ein Geräte-Eingang? Für Listen und PDF. */
export function inputFeedLabel(project: Project, assignment: Assignment, device: Device, index: number): string {
  const a = assignment.deviceInputs[device.id]?.[index]
  if (a?.source) {
    const from = project.devices.find((d) => d.id === a.source!.deviceId)
    if (!from) return '—'
    const out = from.outputs[a.source.output]
    return `${from.name} · ${outputLabel(from, a.source.output)}${from.kind === 'crossover' && out ? ` ${out.name}` : ''}`
  }
  if (a?.unused) return 'frei'
  return a?.label ? `Stagebox ${a.label}` : 'kein freier Output'
}

export function signalTables(project: Project, assignment: Assignment): DeviceTable[] {
  return project.devices.map((device) => {
    const to = (i: number) => consumersOf(project, device.id, i).map((c) => c.label).join(', ') || '—'
    if (device.kind === 'crossover') {
      const connectors = [...new Set(device.inputs.map((i) => CONNECTOR_LABELS[i.connector]))].join('/')
      return {
        device,
        title: `${DEVICE_LABELS.crossover}: ${device.name}`,
        summary: `${device.inputs.length} ${device.inputs.length === 1 ? 'Eingang' : 'Eingänge'} (${connectors}) · ${device.outputs.length} ${device.outputs.length === 1 ? 'Ausgang' : 'Ausgänge'}`,
        feeds: device.inputs.map(
          (input, i) => `${inputLabel(device, i)} (${input.name}) ← ${inputFeedLabel(project, assignment, device, i)}`,
        ),
        rows: device.outputs.map((o, i) => ({
          port: outputLabel(device, i),
          name: o.name,
          from: (o.from ?? []).map((f) => device.inputs[f]?.name ?? '?').join(' + ') || '—',
          detail: `${describeFilter(o)} · ${CONNECTOR_LABELS[o.connector]}`,
          to: to(i),
        })),
      }
    }
    const power = device.power ?? { watts: 1000, ohms: 4 }
    const inConn = CONNECTOR_LABELS[device.inputs[0]?.connector ?? 'xlr']
    const outConn = CONNECTOR_LABELS[device.outputs[0]?.connector ?? 'speakon-nl4']
    return {
      device,
      title: `${DEVICE_LABELS.amp}: ${device.name}`,
      summary: `${device.inputs.length} × ${power.watts} W @ ${power.ohms} Ω · ${inConn} → ${outConn}`,
      feeds: [],
      rows: device.outputs.map((_, i) => ({
        port: outputLabel(device, i),
        name: '',
        from: inputFeedLabel(project, assignment, device, i),
        detail: `${power.watts} W @ ${power.ohms} Ω`,
        to: to(i),
      })),
    }
  })
}
