import { clampToStage } from '../lib/geometry'
import { BOX_STAGE_MARGIN, STAGE_LIMITS } from '../model/defaults'
import type {
  CableView,
  ElementRef,
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
  /** `coalesce`: gleicher Schlüssel = gleicher Undo-Schritt (z. B. alle Bewegungen eines Drags). */
  | { type: 'move'; target: ElementRef; pos: Vec2; coalesce?: string }
  | { type: 'addBox'; box: Stagebox }
  | { type: 'updateBox'; id: string; patch: Partial<Omit<Stagebox, 'id'>> }
  | { type: 'addGroup'; group: InstrumentGroup }
  | { type: 'updateGroup'; id: string; patch: Partial<Omit<InstrumentGroup, 'id'>> }
  | { type: 'addOutput'; output: OutputElement }
  | { type: 'updateOutput'; id: string; patch: Partial<Omit<OutputElement, 'id'>> }
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

    case 'setStage': {
      const stage = clampStageSize(action.stage)
      return {
        ...state,
        stage,
        boxes: state.boxes.map((b) => ({ ...b, pos: placeBox(b.pos, stage) })),
        groups: state.groups.map((g) => ({ ...g, pos: placeElement(g.pos, stage) })),
        outputs: state.outputs.map((o) => ({ ...o, pos: placeElement(o.pos, stage) })),
      }
    }

    case 'move': {
      const { target, pos } = action
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
              pos: placeElement(pos, state.stage),
            })),
          }
      }
      return state
    }

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
          const next = dropEmptyPin({ ...g, ...action.patch })
          return { ...next, pos: placeElement(next.pos, state.stage) }
        }),
      }

    case 'addOutput':
      return {
        ...state,
        outputs: [...state.outputs, { ...action.output, pos: placeElement(action.output.pos, state.stage) }],
      }

    case 'updateOutput':
      return {
        ...state,
        outputs: updateById(state.outputs, action.id, (o) => {
          const next = dropEmptyPin({ ...o, ...action.patch })
          return { ...next, pos: placeElement(next.pos, state.stage) }
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
        }
      }
      if (kind === 'group') return { ...state, groups: state.groups.filter((g) => g.id !== id) }
      return { ...state, outputs: state.outputs.filter((o) => o.id !== id) }
    }

    case 'replace':
      return action.project
  }
}
