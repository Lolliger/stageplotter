import { describe, expect, test } from 'vitest'
import { facingDirection, frontArrowPoints, normalizeRotation, OUTPUT_SHAPES, rotationFacing } from './shapes'

describe('rotation helpers', () => {
  test('normalizes to whole degrees 0–359', () => {
    expect(normalizeRotation(370)).toBe(10)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(359.6)).toBe(0)
    expect(normalizeRotation(Number.NaN)).toBe(0)
  })

  test('rotationFacing turns the front towards a direction', () => {
    // Wedge strahlt bei 0 nach hinten (up)
    expect(rotationFacing('up', 'up')).toBe(0)
    expect(rotationFacing('up', 'right')).toBe(90)
    expect(rotationFacing('up', 'down')).toBe(180)
    // PA strahlt bei 0 zum Publikum (down)
    expect(rotationFacing('down', 'down')).toBe(0)
    expect(rotationFacing('down', 'left')).toBe(90)
  })

  test('facingDirection is the inverse, rounded to 90°', () => {
    for (const front of ['up', 'down'] as const)
      for (const dir of ['up', 'right', 'down', 'left'] as const)
        expect(facingDirection(front, rotationFacing(front, dir))).toBe(dir)
    expect(facingDirection('up', 30)).toBe('up')
    expect(facingDirection('up', 60)).toBe('right')
  })

  test('front arrow sits outside the front edge, none for IEM', () => {
    expect(frontArrowPoints(OUTPUT_SHAPES.iem, 1)).toBeNull()
    // Wedge: Front oben → Pfeilspitze über der Oberkante (negatives y)
    expect(frontArrowPoints(OUTPUT_SHAPES.wedge, 1)).toBe('-5,-9.5 5,-9.5 0,-15.5')
    // PA: Front unten → Spitze unterhalb
    expect(frontArrowPoints(OUTPUT_SHAPES.pa, 1)).toBe('-5,18 5,18 0,24')
  })
})
