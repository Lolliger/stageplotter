import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../../model/defaults'
import { createGroupFromTemplate, getTemplate } from '../../model/templates'
import { assign } from '../assign'
import { renderPlotSvg } from './plotSvg'

function sample() {
  const p = { ...createDefaultProject(), name: 'Test' }
  p.groups.push({ ...createGroupFromTemplate(getTemplate('keys-stereo')!, { x: 3, y: 3 }), name: 'Keys <Nord> & Co' })
  p.groups.push(createGroupFromTemplate(getTemplate('lead-vox')!, { x: 4, y: 4 }))
  p.outputs.push({ id: 'w', kind: 'wedge', name: 'Wedge 1', pos: { x: 4, y: 5 } })
  return p
}

test('draws amps as cabinets and PA/sub with their labels', () => {
  const p = sample()
  p.groups.push(createGroupFromTemplate(getTemplate('guitar-amp')!, { x: 7, y: 2 }))
  p.outputs.push({ id: 'pa', kind: 'pa', name: 'PA L', pos: { x: -0.6, y: 5.5 } })
  p.outputs.push({ id: 'sub', kind: 'sub', name: 'Sub 1', pos: { x: 5, y: 6.6 } })
  const svg = renderPlotSvg(p, assign(p), 1)
  expect(svg).toContain('>AMP</text>')
  expect(svg).toContain('>Gitarren-Amp</text>')
  expect(svg).toContain('>PA</text>')
  expect(svg).toContain('>SUB</text>')
})

describe('renderPlotSvg', () => {
  test('contains stage, boxes, instruments and outputs with escaped names', () => {
    const p = sample()
    const svg = renderPlotSvg(p, assign(p), 1)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('PUBLIKUM · 10 × 6 m')
    expect(svg).toContain('>A</text>')
    expect(svg).toContain('>3/16 In<')
    expect(svg).toContain('Keys &lt;Nord&gt; &amp; Co')
    expect(svg).toContain('Wedge 1')
    expect(svg).not.toContain('var(') // keine CSS-Variablen im Druck
  })

  test('draws bundled cables with counts, or straight lines', () => {
    const p = sample()
    const bundled = renderPlotSvg(p, assign(p), 1)
    // Kabelanzahl am Abgang von Box A: 2 Keys + 1 Vox + 1 Wedge
    const countPill = /<rect[^>]*rx="7" fill="#3b82f6"\/><text[^>]*>4<\/text>/
    expect(bundled).toMatch(countPill)
    const direct = renderPlotSvg({ ...p, cableView: 'direct' }, assign(p), 1)
    expect(direct).toContain('stroke-dasharray')
    expect(direct).not.toMatch(countPill)
  })
})

describe('light plot', () => {
  function rig() {
    const p = sample()
    p.trusses.push({ id: 't', name: 'Backtruss', pos: { x: 5, y: 0.5 }, length: 8, rotation: 0 })
    p.fixtures.push(
      { id: 'f1', kind: 'wash', number: 1, name: 'Wash', pos: { x: 3, y: 0.5 }, channels: 16, universe: 1, address: 1, trussId: 't' },
      { id: 'f2', kind: 'par', number: 2, name: 'PAR', pos: { x: 5, y: 9 }, rotation: 180, channels: 8, universe: 2 },
    )
    return p
  }

  test('draws trusses, fixtures with number and address, and ghosts only what the view asks for', () => {
    const p = rig()
    const svg = renderPlotSvg(p, assign(p), 1, 'lighting')
    expect(svg).toContain('>Backtruss</text>')
    expect(svg).toContain('>#1</text>')
    expect(svg).toContain('>1.001</text>')
    expect(svg).toContain('>#2</text>')
    expect(svg).toContain('>WA</text>')
    // Standard: Instrumente grau, keine Stageboxen, keine Kabelzahlen, kein Wedge
    expect(svg).toContain('>Lead Vox</text>')
    expect(svg).not.toContain('In</text>')
    expect(svg).not.toContain('>Wedge 1</text>')
    p.view = { sound: { instruments: false, pa: true, monitors: true, boxes: true, cables: false }, lights: false }
    const custom = renderPlotSvg(p, assign(p), 1, 'lighting')
    expect(custom).not.toContain('>Lead Vox</text>')
    expect(custom).toContain('>Wedge 1</text>')
  })

  test('sound plot shows lights only when switched on', () => {
    const p = rig()
    expect(renderPlotSvg(p, assign(p), 1)).not.toContain('>Backtruss</text>')
    p.view = { sound: { instruments: true, pa: true, monitors: false, boxes: false, cables: false }, lights: true }
    const svg = renderPlotSvg(p, assign(p), 1)
    expect(svg).toContain('>Backtruss</text>')
    expect(svg).not.toContain('>#1</text>')
  })
})
