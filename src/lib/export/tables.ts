import { targetKindLabel, unpatchedTargetName } from '../../model/devices'
import type { Project, Stagebox } from '../../model/types'
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
