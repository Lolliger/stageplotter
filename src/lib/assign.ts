import { TYPE_ORDER } from '../model/defaults'
import type { InstrumentGroup, OutputElement, OutputKind, Project, Stagebox, Vec2 } from '../model/types'
import { euclidean, type DistanceFn } from './geometry'

export interface InputPort {
  boxId: string
  /** Fortlaufend ab 1 pro Box. */
  port: number
  /** z. B. "A1" */
  label: string
  groupId: string
  channelId: string
  groupName: string
  channelName: string
  pickup: string
  note?: string
  /** Abstand Gruppe → Box in Metern. */
  distance: number
}

export interface OutputPort {
  boxId: string
  port: number
  /** z. B. "A-Out 1" */
  label: string
  outputId: string
  name: string
  kind: OutputKind
  distance: number
}

export interface BoxUsage {
  inputsUsed: number
  inputs: number
  /** Kanäle, die auf diese Box wollten, aber keinen Platz bekamen. */
  inputsMissing: number
  outputsUsed: number
  outputs: number
  outputsMissing: number
}

export interface GroupAssignment {
  /** Genutzte Boxen, nächstgelegene zuerst. Mehr als eine = aufgeteilt. */
  boxIds: string[]
  /** Kanäle je Box. */
  channelsPerBox: Record<string, number>
  split: boolean
  pinned: boolean
  unpatched: number
}

export interface OutputAssignment {
  boxId: string | null
  label: string | null
  pinned: boolean
}

export interface UnpatchedChannel {
  groupId: string
  channelId: string
  /** Box, auf die der Kanal gehört hätte (gepinnt oder nächstgelegen). */
  wantedBoxId: string | null
}

export interface UnpatchedOutput {
  outputId: string
  wantedBoxId: string | null
}

export type WarningCode = 'no-boxes' | 'group-split' | 'inputs-missing' | 'outputs-missing'

export interface Warning {
  level: 'error' | 'warning'
  code: WarningCode
  message: string
  boxId?: string
  groupIds?: string[]
  outputIds?: string[]
}

export interface Assignment {
  inputs: Record<string, InputPort[]>
  outputs: Record<string, OutputPort[]>
  usage: Record<string, BoxUsage>
  groups: Record<string, GroupAssignment>
  outputElements: Record<string, OutputAssignment>
  unpatchedInputs: UnpatchedChannel[]
  unpatchedOutputs: UnpatchedOutput[]
  warnings: Warning[]
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

function boxesByDistance(boxes: Stagebox[], pos: Vec2, distance: DistanceFn): Stagebox[] {
  return boxes
    .map((box) => ({ box, d: distance(pos, box.pos) }))
    .sort((a, b) => a.d - b.d || collator.compare(a.box.name, b.box.name))
    .map((e) => e.box)
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

interface Allocation {
  group: InstrumentGroup
  groupIndex: number
  channelIndex: number
}

/**
 * Ordnet Instrumentengruppen und Output-Elemente den Stageboxen zu.
 *
 * Inputs: gepinnte Gruppen zuerst (nie umgeleitet), dann übrige Gruppen nach Kanalzahl
 * absteigend auf die nächstgelegene Box mit genug freien Inputs. Passt eine Gruppe nirgends
 * komplett, wird sie entlang der Distanz aufgeteilt. Kapazitäten sind harte Grenzen.
 *
 * Outputs: jedes Element belegt einen Output; gepinnte zuerst, dann nächstgelegene Box mit
 * freiem Output.
 */
export function assign(project: Project, distance: DistanceFn = euclidean): Assignment {
  const { boxes, groups, outputs } = project
  const boxById = new Map(boxes.map((b) => [b.id, b]))

  const freeIn = new Map(boxes.map((b) => [b.id, b.inputs]))
  const freeOut = new Map(boxes.map((b) => [b.id, b.outputs]))
  const allocations = new Map<string, Allocation[]>(boxes.map((b) => [b.id, []]))
  const missingIn = new Map<string, { count: number; groupIds: Set<string> }>()
  const missingOut = new Map<string, { count: number; outputIds: string[] }>()

  const result: Assignment = {
    inputs: {},
    outputs: {},
    usage: {},
    groups: {},
    outputElements: {},
    unpatchedInputs: [],
    unpatchedOutputs: [],
    warnings: [],
  }

  // ---------- Inputs ----------

  const indexed = groups.map((group, groupIndex) => ({ group, groupIndex }))
  const isPinned = (g: InstrumentGroup) => g.pinnedBoxId !== undefined && boxById.has(g.pinnedBoxId)
  const pinned = indexed.filter((e) => isPinned(e.group))
  const unpinned = indexed
    .filter((e) => !isPinned(e.group))
    // Array.prototype.sort ist stabil → Gleichstand bleibt in Erstellungsreihenfolge.
    .sort((a, b) => b.group.channels.length - a.group.channels.length)

  for (const { group, groupIndex } of [...pinned, ...unpinned]) {
    const pinnedBox = isPinned(group) ? boxById.get(group.pinnedBoxId!)! : undefined
    const candidates = pinnedBox ? [pinnedBox] : boxesByDistance(boxes, group.pos, distance)
    const total = group.channels.length

    const assignment: GroupAssignment = {
      boxIds: [],
      channelsPerBox: {},
      split: false,
      pinned: pinnedBox !== undefined,
      unpatched: 0,
    }
    result.groups[group.id] = assignment
    if (total === 0) continue

    // Ganze Gruppe auf die nächste Box, die genug Platz hat; sonst entlang der Distanz aufteilen.
    const whole = candidates.find((b) => freeIn.get(b.id)! >= total)
    const plan: { box: Stagebox; count: number }[] = []
    if (whole) {
      plan.push({ box: whole, count: total })
    } else {
      let remaining = total
      for (const box of candidates) {
        if (remaining === 0) break
        const take = Math.min(freeIn.get(box.id)!, remaining)
        if (take > 0) {
          plan.push({ box, count: take })
          remaining -= take
        }
      }
    }

    let channelIndex = 0
    for (const { box, count } of plan) {
      freeIn.set(box.id, freeIn.get(box.id)! - count)
      assignment.boxIds.push(box.id)
      assignment.channelsPerBox[box.id] = count
      for (let i = 0; i < count; i++) {
        allocations.get(box.id)!.push({ group, groupIndex, channelIndex })
        channelIndex++
      }
    }
    assignment.split = plan.length > 1

    const wantedBoxId = candidates[0]?.id ?? null
    for (; channelIndex < total; channelIndex++) {
      assignment.unpatched++
      result.unpatchedInputs.push({ groupId: group.id, channelId: group.channels[channelIndex].id, wantedBoxId })
    }
    if (assignment.unpatched > 0 && wantedBoxId) {
      const entry = missingIn.get(wantedBoxId) ?? { count: 0, groupIds: new Set<string>() }
      entry.count += assignment.unpatched
      entry.groupIds.add(group.id)
      missingIn.set(wantedBoxId, entry)
    }

    if (assignment.split) {
      const parts = plan.map(({ box, count }) => `${box.name} (${count})`).join(', ')
      result.warnings.push({
        level: 'warning',
        code: 'group-split',
        message: `${group.name} (${plural(total, 'Kanal', 'Kanäle')}) passt auf keine Box komplett und wurde aufgeteilt: ${parts}.`,
        groupIds: [group.id],
      })
    }
  }

  // Ports je Box in Inputlisten-Reihenfolge vergeben (Typ, Erstellung, Kanal).
  const typeRank = (g: InstrumentGroup) => {
    const i = TYPE_ORDER.indexOf(g.type)
    return i === -1 ? TYPE_ORDER.length : i
  }
  for (const box of boxes) {
    const list = allocations
      .get(box.id)!
      .slice()
      .sort(
        (a, b) =>
          typeRank(a.group) - typeRank(b.group) ||
          a.groupIndex - b.groupIndex ||
          a.channelIndex - b.channelIndex,
      )
    result.inputs[box.id] = list.map(({ group, channelIndex }, i) => {
      const channel = group.channels[channelIndex]
      const port: InputPort = {
        boxId: box.id,
        port: i + 1,
        label: `${box.name}${i + 1}`,
        groupId: group.id,
        channelId: channel.id,
        groupName: group.name,
        channelName: channel.name,
        pickup: channel.pickup,
        distance: distance(group.pos, box.pos),
      }
      if (channel.note) port.note = channel.note
      return port
    })
  }

  // ---------- Outputs ----------

  const isOutputPinned = (o: OutputElement) => o.pinnedBoxId !== undefined && boxById.has(o.pinnedBoxId)
  const outputOrder = [...outputs.filter(isOutputPinned), ...outputs.filter((o) => !isOutputPinned(o))]
  const outputAlloc = new Map<string, OutputElement[]>(boxes.map((b) => [b.id, []]))

  for (const output of outputOrder) {
    const pinnedBox = isOutputPinned(output) ? boxById.get(output.pinnedBoxId!)! : undefined
    const candidates = pinnedBox ? [pinnedBox] : boxesByDistance(boxes, output.pos, distance)
    const box = candidates.find((b) => freeOut.get(b.id)! > 0)
    result.outputElements[output.id] = { boxId: box?.id ?? null, label: null, pinned: pinnedBox !== undefined }
    if (box) {
      freeOut.set(box.id, freeOut.get(box.id)! - 1)
      outputAlloc.get(box.id)!.push(output)
    } else {
      const wantedBoxId = candidates[0]?.id ?? null
      result.unpatchedOutputs.push({ outputId: output.id, wantedBoxId })
      if (wantedBoxId) {
        const entry = missingOut.get(wantedBoxId) ?? { count: 0, outputIds: [] }
        entry.count++
        entry.outputIds.push(output.id)
        missingOut.set(wantedBoxId, entry)
      }
    }
  }

  const outputIndex = new Map(outputs.map((o, i) => [o.id, i]))
  for (const box of boxes) {
    const list = outputAlloc.get(box.id)!.slice().sort((a, b) => outputIndex.get(a.id)! - outputIndex.get(b.id)!)
    result.outputs[box.id] = list.map((output, i) => {
      const label = `${box.name}-Out ${i + 1}`
      result.outputElements[output.id].label = label
      return {
        boxId: box.id,
        port: i + 1,
        label,
        outputId: output.id,
        name: output.name,
        kind: output.kind,
        distance: distance(output.pos, box.pos),
      }
    })
  }

  // ---------- Auslastung und Warnungen ----------

  for (const box of boxes) {
    result.usage[box.id] = {
      inputsUsed: box.inputs - freeIn.get(box.id)!,
      inputs: box.inputs,
      inputsMissing: missingIn.get(box.id)?.count ?? 0,
      outputsUsed: box.outputs - freeOut.get(box.id)!,
      outputs: box.outputs,
      outputsMissing: missingOut.get(box.id)?.count ?? 0,
    }
  }

  const totalChannels = groups.reduce((sum, g) => sum + g.channels.length, 0)
  if (boxes.length === 0 && (totalChannels > 0 || outputs.length > 0)) {
    const what = [
      totalChannels > 0 ? plural(totalChannels, 'Kanal', 'Kanäle') : null,
      outputs.length > 0 ? plural(outputs.length, 'Output', 'Outputs') : null,
    ]
      .filter(Boolean)
      .join(' und ')
    result.warnings.unshift({
      level: 'error',
      code: 'no-boxes',
      message: `Keine Stagebox vorhanden – ${what} nicht gepatcht. Füge eine Stagebox hinzu.`,
    })
  }

  for (const box of boxes) {
    const inMissing = missingIn.get(box.id)
    if (inMissing) {
      const groupIds = [...inMissing.groupIds]
      const names = groupIds.map((id) => groups.find((g) => g.id === id)!.name).join(', ')
      const pinnedHere = groupIds.some((id) => result.groups[id].pinned)
      const fix = [
        `Box ${box.name} auf ${box.inputs + inMissing.count} Inputs erhöhen`,
        'weitere Stagebox hinzufügen',
        pinnedHere ? 'Pin lösen' : null,
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/, ([^,]*)$/, ' oder $1')
      result.warnings.push({
        level: 'error',
        code: 'inputs-missing',
        message: `Box ${box.name}: ${plural(inMissing.count, 'Input fehlt', 'Inputs fehlen')} (${names}). ${fix}.`,
        boxId: box.id,
        groupIds,
      })
    }
    const outMissing = missingOut.get(box.id)
    if (outMissing) {
      const names = outMissing.outputIds.map((id) => outputs.find((o) => o.id === id)!.name).join(', ')
      const pinnedHere = outMissing.outputIds.some((id) => result.outputElements[id].pinned)
      const fix = [
        `Box ${box.name} auf ${box.outputs + outMissing.count} Outputs erhöhen`,
        'weitere Stagebox hinzufügen',
        pinnedHere ? 'Pin lösen' : null,
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/, ([^,]*)$/, ' oder $1')
      result.warnings.push({
        level: 'error',
        code: 'outputs-missing',
        message: `Box ${box.name}: ${plural(outMissing.count, 'Output fehlt', 'Outputs fehlen')} (${names}). ${fix}.`,
        boxId: box.id,
        outputIds: outMissing.outputIds,
      })
    }
  }

  // Fehler vor Hinweisen.
  result.warnings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))

  return result
}
