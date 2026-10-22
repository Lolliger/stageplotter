import { clampToStage, snap } from '../lib/geometry'
import { BOX_STAGE_MARGIN, SNAP_STEP, STAGE_LIMITS } from '../model/defaults'
import { OFFSTAGE_OUTPUTS, normalizeRotation } from '../model/shapes'
import { cleanSources } from '../model/devices'
import { autoAddress, type AutoAddressOptions } from '../lib/dmx'
import {
  FIXTURE_CHANNEL_LIMITS,
  TRUSS_LIMITS,
  UNIVERSE_LIMITS,
  carryFixtures,
  clampToLightArea,
  snapToTruss,
} from '../model/lights'
import { clamp } from '../lib/geometry'
import type {
  CableView,
  Device,
  ElementRef,
  Fixture,
  Truss,
  ViewSettings,
  InstrumentGroup,
  OutputElement,
  Project,
  Stagebox,
  StageSize,
  Vec2,
} from '../model/types'

export type Action =
  | { type: 'setName'; name: string }
  | { type: 'setStage'; stage: StageSize }
  | { type: 'setCableView'; cableView: CableView }
  | { type: 'setSnap'; snap: boolean }
  /** `coalesce`: gleicher Schlüssel = gleicher Undo-Schritt (z. B. alle Bewegungen eines Drags). */
  | { type: 'move'; target: ElementRef; pos: Vec2; coalesce?: string }
  | { type: 'addBox'; box: Stagebox }
  | { type: 'updateBox'; id: string; patch: Partial<Omit<Stagebox, 'id'>> }
  | { type: 'addGroup'; group: InstrumentGroup }
  | { type: 'updateGroup'; id: string; patch: Partial<Omit<InstrumentGroup, 'id'>> }
  | { type: 'addOutput'; output: OutputElement }
  | { type: 'addDevice'; device: Device }
  | { type: 'updateDevice'; id: string; device: Device }
  | { type: 'updateOutput'; id: string; patch: Partial<Omit<OutputElement, 'id'>> }
  | { type: 'addFixtures'; fixtures: Fixture[] }
  | { type: 'updateFixture'; id: string; patch: Partial<Omit<Fixture, 'id'>> }
  | { type: 'addTruss'; truss: Truss }
  | { type: 'updateTruss'; id: string; patch: Partial<Omit<Truss, 'id'>> }
  | { type: 'autoAddress'; options: AutoAddressOptions }
  | { type: 'setView'; view: ViewSettings }
  | { type: 'delete'; target: ElementRef }
  | { type: 'replace'; project: Project }

function clampStageSize(stage: StageSize): StageSize {
  const fix = (v: number) =>
    Number.isFinite(v) ? Math.min(STAGE_LIMITS.max, Math.max(STAGE_LIMITS.min, v)) : STAGE_LIMITS.min
  return { width: fix(stage.width), depth: fix(stage.depth) }
}

function clampCapacity(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(256, Math.round(n))) : 0
}

function placeBox(pos: Vec2, stage: StageSize): Vec2 {
  return clampToStage(pos, stage, BOX_STAGE_MARGIN)
}

function placeElement(pos: Vec2, stage: StageSize): Vec2 {
  return clampToStage(pos, stage)
}

/** PA und Subs dürfen wie Stageboxen neben bzw. vor der Bühne stehen. */
function placeOutput(output: OutputElement, pos: Vec2, stage: StageSize): Vec2 {
  return OFFSTAGE_OUTPUTS.includes(output.kind) ? placeBox(pos, stage) : placeElement(pos, stage)
}

function sanitizeBox(box: Stagebox, stage: StageSize): Stagebox {
  return {
    ...box,
    pos: placeBox(box.pos, stage),
    inputs: clampCapacity(box.inputs),
    outputs: clampCapacity(box.outputs),
  }
}

function updateById<T extends { id: string }>(items: T[], id: string, fn: (item: T) => T): T[] {
  return items.map((item) => (item.id === id ? fn(item) : item))
}

/** Entfernt einen auf undefined gesetzten Pin, damit kein leerer Schlüssel gespeichert wird. */
function dropEmptyPin<T extends { pinnedBoxId?: string }>(item: T): T {
  if (item.pinnedBoxId !== undefined) return item
  const copy = { ...item }
  delete copy.pinnedBoxId
  return copy
}

/** Quelle auf undefined gesetzt = wieder direkt von der Stagebox. */
function dropEmptySource<T extends { source?: unknown }>(item: T): T {
  if (item.source !== undefined) return item
  const copy = { ...item }
  delete copy.source
  return copy
}

function withRotation<T extends { rotation?: number }>(item: T): T {
  return item.rotation === undefined ? item : { ...item, rotation: normalizeRotation(item.rotation) }
}

/** Werte einer Lampe in gültige Bereiche bringen; leere optionale Felder entfernen. */
function sanitizeFixture(f: Fixture, stage: StageSize): Fixture {
  const next: Fixture = {
    ...f,
    pos: clampToLightArea(f.pos, stage),
    number: Math.max(1, Math.round(f.number) || 1),
    channels: clamp(Math.round(f.channels) || 0, FIXTURE_CHANNEL_LIMITS.min, FIXTURE_CHANNEL_LIMITS.max),
    universe: clamp(Math.round(f.universe) || 1, UNIVERSE_LIMITS.min, UNIVERSE_LIMITS.max),
  }
  if (next.address === undefined || !Number.isFinite(next.address)) delete next.address
  else next.address = clamp(Math.round(next.address), 1, 512)
  if (next.rotation !== undefined) next.rotation = normalizeRotation(next.rotation)
  for (const key of ['trussId', 'mode', 'model', 'color', 'note'] as const) {
    if (next[key] === undefined || next[key] === '') delete next[key]
  }
  return next
}

function sanitizeTruss(t: Truss, stage: StageSize): Truss {
  return {
    ...t,
    pos: clampToLightArea(t.pos, stage),
    length: clamp(Number.isFinite(t.length) ? t.length : TRUSS_LIMITS.min, TRUSS_LIMITS.min, TRUSS_LIMITS.max),
    rotation: normalizeRotation(t.rotation ?? 0),
  }
}

/** Lampe verschoben: an einer Traverse in Reichweite einrasten, sonst frei. */
function moveFixture(f: Fixture, pos: Vec2, trusses: Truss[], stage: StageSize): Fixture {
  const snapped = snapToTruss(pos, trusses)
  const next = { ...f, pos: snapped ? snapped.pos : pos, trussId: snapped?.trussId }
  return sanitizeFixture(next, stage)
}

function changeTruss(state: Project, id: string, change: (t: Truss) => Truss): Project {
  const before = state.trusses.find((t) => t.id === id)
  if (!before) return state
  const after = sanitizeTruss(change(before), state.stage)
  return {
    ...state,
    trusses: updateById(state.trusses, id, () => after),
    fixtures: carryFixtures(state.fixtures, before, after).map((f) => sanitizeFixture(f, state.stage)),
  }
}

function unpin<T extends { pinnedBoxId?: string }>(item: T, boxId: string): T {
  if (item.pinnedBoxId !== boxId) return item
  const copy = { ...item }
  delete copy.pinnedBoxId
  return copy
}

export function projectReducer(state: Project, action: Action): Project {
  switch (action.type) {
    case 'setName':
      return { ...state, name: action.name }

    case 'setCableView':
      return { ...state, cableView: action.cableView }

    case 'setSnap':
      return { ...state, snap: action.snap }

    case 'setStage': {
      const stage = clampStageSize(action.stage)
      return {
        ...state,
        stage,
        boxes: state.boxes.map((b) => ({ ...b, pos: placeBox(b.pos, stage) })),
        groups: state.groups.map((g) => ({ ...g, pos: placeElement(g.pos, stage) })),
        outputs: state.outputs.map((o) => ({ ...o, pos: placeOutput(o, o.pos, stage) })),
        devices: state.devices.map((d) => ({ ...d, pos: placeBox(d.pos, stage) })),
        trusses: state.trusses.map((t) => sanitizeTruss(t, stage)),
        fixtures: state.fixtures.map((f) => sanitizeFixture(f, stage)),
      }
    }

    case 'setView':
      return { ...state, view: action.view }

    case 'addFixtures':
      return { ...state, fixtures: [...state.fixtures, ...action.fixtures.map((f) => sanitizeFixture(f, state.stage))] }

    case 'updateFixture':
      return {
        ...state,
        fixtures: updateById(state.fixtures, action.id, (f) => sanitizeFixture({ ...f, ...action.patch }, state.stage)),
      }

    case 'addTruss':
      return { ...state, trusses: [...state.trusses, sanitizeTruss(action.truss, state.stage)] }

    case 'updateTruss':
      return changeTruss(state, action.id, (t) => ({ ...t, ...action.patch }))

    case 'autoAddress':
      return {
        ...state,
        fixtures: autoAddress(state.fixtures, state.trusses, action.options).map((f) => sanitizeFixture(f, state.stage)),
      }

    case 'move': {
      const { target } = action
      const pos = state.snap ? { x: snap(action.pos.x, SNAP_STEP), y: snap(action.pos.y, SNAP_STEP) } : action.pos
      switch (target.kind) {
        case 'box':
          return {
            ...state,
            boxes: updateById(state.boxes, target.id, (b) => ({ ...b, pos: placeBox(pos, state.stage) })),
          }
        case 'group':
          return {
            ...state,
            groups: updateById(state.groups, target.id, (g) => ({
              ...g,
              pos: placeElement(pos, state.stage),
            })),
          }
        case 'output':
          return {
            ...state,
            outputs: updateById(state.outputs, target.id, (o) => ({
              ...o,
              pos: placeOutput(o, pos, state.stage),
            })),
          }
        case 'device':
          return {
            ...state,
            devices: updateById(state.devices, target.id, (d) => ({ ...d, pos: placeBox(pos, state.stage) })),
          }
        case 'fixture':
          return {
            ...state,
            fixtures: updateById(state.fixtures, target.id, (f) => moveFixture(f, pos, state.trusses, state.stage)),
          }
        case 'truss':
          return changeTruss(state, target.id, (t) => ({ ...t, pos }))
      }
      return state
    }

    case 'addDevice':
      return { ...state, devices: [...state.devices, { ...action.device, pos: placeBox(action.device.pos, state.stage) }] }

    case 'updateDevice':
      // Ganze Geräte ersetzen (Konfiguratoren ändern mehrere Felder auf einmal); danach Verweise
      // auf entfernte Ausgänge aufräumen.
      return cleanSources({
        ...state,
        devices: updateById(state.devices, action.id, () =>
          dropEmptyPin({ ...action.device, id: action.id, pos: placeBox(action.device.pos, state.stage) }),
        ),
      })

    case 'addBox':
      return { ...state, boxes: [...state.boxes, sanitizeBox(action.box, state.stage)] }

    case 'updateBox':
      return {
        ...state,
        boxes: updateById(state.boxes, action.id, (b) => sanitizeBox({ ...b, ...action.patch }, state.stage)),
      }

    case 'addGroup':
      return {
        ...state,
        groups: [...state.groups, { ...action.group, pos: placeElement(action.group.pos, state.stage) }],
      }

    case 'updateGroup':
      return {
        ...state,
        groups: updateById(state.groups, action.id, (g) => {
          const next = withRotation(dropEmptyPin({ ...g, ...action.patch }))
          return { ...next, pos: placeElement(next.pos, state.stage) }
        }),
      }

    case 'addOutput':
      return {
        ...state,
        outputs: [...state.outputs, { ...action.output, pos: placeOutput(action.output, action.output.pos, state.stage) }],
      }

    case 'updateOutput':
      return {
        ...state,
        outputs: updateById(state.outputs, action.id, (o) => {
          const next = withRotation(dropEmptyPin(dropEmptySource({ ...o, ...action.patch })))
          return { ...next, pos: placeOutput(next, next.pos, state.stage) }
        }),
      }

    case 'delete': {
      const { kind, id } = action.target
      if (kind === 'box') {
        // Pins auf die gelöschte Box werden aufgehoben, damit nichts ins Leere zeigt.
        return {
          ...state,
          boxes: state.boxes.filter((b) => b.id !== id),
          groups: state.groups.map((g) => unpin(g, id)),
          outputs: state.outputs.map((o) => unpin(o, id)),
          devices: state.devices.map((d) => unpin(d, id)),
        }
      }
      if (kind === 'group') return { ...state, groups: state.groups.filter((g) => g.id !== id) }
      if (kind === 'device') return cleanSources({ ...state, devices: state.devices.filter((d) => d.id !== id) })
      if (kind === 'fixture') return { ...state, fixtures: state.fixtures.filter((f) => f.id !== id) }
      if (kind === 'truss') {
        // Lampen bleiben, wo sie sind, hängen aber an nichts mehr.
        return {
          ...state,
          trusses: state.trusses.filter((t) => t.id !== id),
          fixtures: state.fixtures.map((f) => (f.trussId === id ? sanitizeFixture({ ...f, trussId: undefined }, state.stage) : f)),
        }
      }
      return { ...state, outputs: state.outputs.filter((o) => o.id !== id) }
    }

    case 'replace':
      return action.project
  }
}
