import { describe, expect, test } from 'vitest'
import { clampView, fitView, panBy, viewBoxFor, zoomAt } from './viewport'

const BASE = { x: -50, y: -50, w: 400, h: 300 }

describe('viewport', () => {
  test('fit shows the whole base box', () => {
    expect(viewBoxFor(BASE, fitView(BASE))).toEqual(BASE)
  })

  test('zooming keeps the anchor point in place', () => {
    const at = { x: 250, y: 150 }
    const v = zoomAt(BASE, fitView(BASE), 2, at)
    const before = viewBoxFor(BASE, fitView(BASE))
    const after = viewBoxFor(BASE, v)
    // relative Lage des Ankers im Ausschnitt bleibt gleich
    expect((at.x - after.x) / after.w).toBeCloseTo((at.x - before.x) / before.w)
    expect((at.y - after.y) / after.h).toBeCloseTo((at.y - before.y) / before.h)
    expect(after.w).toBe(200)
  })

  test('zoom is limited and the view never leaves the base box', () => {
    expect(clampView(BASE, { zoom: 99, cx: 0, cy: 0 }).zoom).toBe(5)
    expect(clampView(BASE, { zoom: 0.2, cx: 0, cy: 0 })).toEqual(fitView(BASE))
    const v = panBy(BASE, { zoom: 2, cx: 150, cy: 100 }, 10_000, -10_000)
    const box = viewBoxFor(BASE, v)
    expect(box.x + box.w).toBeCloseTo(BASE.x + BASE.w)
    expect(box.y).toBeCloseTo(BASE.y)
  })

  test('panning at zoom 1 does nothing', () => {
    expect(panBy(BASE, fitView(BASE), 30, 30)).toEqual(fitView(BASE))
  })
})
