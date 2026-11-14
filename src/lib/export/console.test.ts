import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../../model/defaults'
import { createGroupFromTemplate, getTemplate } from '../../model/templates'
import { assign } from '../assign'
import { CONSOLE_NAME_LENGTH, consoleCsv, consoleRows, shortName } from './console'

describe('console channel list', () => {
  test('keeps short names and shortens long ones to the console length', () => {
    expect(shortName('Kick')).toBe('Kick')
    expect(shortName('Lead Vox')).toBe('Lead Vox')
    expect(shortName('Background Vocal 2')).toHaveLength(CONSOLE_NAME_LENGTH)
    expect(shortName('Background Vocal 2').endsWith('2')).toBe(true)
    expect(shortName('Akustikgitarre').length).toBeLessThanOrEqual(CONSOLE_NAME_LENGTH)
    expect(shortName('Akustikgitarre')[0]).toBe('A')
  })

  test('numbers channels in stagebox order with unique short names', () => {
    const p = createDefaultProject()
    const a = createGroupFromTemplate(getTemplate('lead-vox')!, { x: 1.5, y: 2 })
    const b = createGroupFromTemplate(getTemplate('lead-vox')!, { x: 2.5, y: 2 })
    p.groups.push(a, b)
    const rows = consoleRows(p, assign(p))
    expect(rows.map((r) => r.channel)).toEqual([1, 2])
    expect(new Set(rows.map((r) => r.short.toLowerCase())).size).toBe(2)
    expect(rows.every((r) => r.short.length <= CONSOLE_NAME_LENGTH)).toBe(true)
  })

  test('writes a semicolon CSV with header and one line per channel', () => {
    const p = createDefaultProject()
    p.groups.push(createGroupFromTemplate(getTemplate('keys-stereo')!, { x: 1.5, y: 3.75 }))
    const lines = consoleCsv(p, assign(p)).trim().split('\r\n')
    expect(lines[0]).toContain('Kanal;Eingang;')
    expect(lines).toHaveLength(3)
    expect(lines[1].startsWith('1;A1;Keys L;Keys L;Keys;')).toBe(true)
  })
})
