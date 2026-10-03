import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../model/defaults'
import { HISTORY_LIMIT, historyReducer, initHistory } from './history'

describe('historyReducer', () => {
  test('undo and redo restore previous states', () => {
    let h = initHistory(createDefaultProject())
    const original = h.present
    h = historyReducer(h, { type: 'setName', name: 'Gig' })
    h = historyReducer(h, { type: 'setStage', stage: { width: 8, depth: 5 } })
    h = historyReducer(h, { type: 'undo' })
    expect(h.present.stage).toEqual({ width: 10, depth: 6 })
    expect(h.present.name).toBe('Gig')
    h = historyReducer(h, { type: 'undo' })
    expect(h.present).toBe(original)
    h = historyReducer(h, { type: 'redo' })
    expect(h.present.name).toBe('Gig')
  })

  test('a new change clears the redo stack', () => {
    let h = initHistory(createDefaultProject())
    h = historyReducer(h, { type: 'setName', name: 'A' })
    h = historyReducer(h, { type: 'undo' })
    h = historyReducer(h, { type: 'setName', name: 'B' })
    expect(h.future).toEqual([])
    expect(historyReducer(h, { type: 'redo' })).toBe(h)
  })

  test('all moves of one drag are a single undo step', () => {
    let h = initHistory(createDefaultProject())
    const boxId = h.present.boxes[0].id
    const start = h.present.boxes[0].pos
    for (let i = 1; i <= 10; i++) {
      h = historyReducer(h, { type: 'move', target: { kind: 'box', id: boxId }, pos: { x: 2 + i / 10, y: 1 }, coalesce: 'drag-1' })
    }
    expect(h.past).toHaveLength(1)
    // ein zweiter Drag ist ein eigener Schritt
    h = historyReducer(h, { type: 'move', target: { kind: 'box', id: boxId }, pos: { x: 5, y: 2 }, coalesce: 'drag-2' })
    expect(h.past).toHaveLength(2)
    h = historyReducer(historyReducer(h, { type: 'undo' }), { type: 'undo' })
    expect(h.present.boxes[0].pos).toEqual(start)
  })

  test('undo with empty history is a no-op, history is capped', () => {
    let h = initHistory(createDefaultProject())
    expect(historyReducer(h, { type: 'undo' })).toBe(h)
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = historyReducer(h, { type: 'setName', name: `n${i}` })
    expect(h.past).toHaveLength(HISTORY_LIMIT)
  })
})
