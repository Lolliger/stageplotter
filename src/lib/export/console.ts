import type { Project } from '../../model/types'
import type { Assignment } from '../assign'
import { inputTables } from './tables'

/** Namen am Pult sind kurz: Allen & Heath SQ zeigt 8 Zeichen pro Kanal. */
export const CONSOLE_NAME_LENGTH = 8

/**
 * Kürzt einen Kanalnamen auf die Länge des Pults: erst Leerzeichen und Satzzeichen weg, dann
 * Vokale im Wortinneren (von hinten), zuletzt abschneiden. Ziffern am Ende bleiben erhalten,
 * damit "Background Vocal 2" nicht zu "Bckgrnd" wird, sondern zu "BckgrnV2".
 */
export function shortName(name: string, max = CONSOLE_NAME_LENGTH): string {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  const tail = clean.match(/\d+$/)?.[0] ?? ''
  const words = clean
    .slice(0, clean.length - tail.length)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
  const room = max - tail.length
  let chars = words.join('').split('')
  // Vokale im Wortinneren von hinten streichen, Großbuchstaben (Wortanfänge) bleiben.
  for (let i = chars.length - 1; i > 0 && chars.length > room; i--) {
    if (/[aeiouäöü]/.test(chars[i])) chars.splice(i, 1)
  }
  if (chars.length > room) chars = chars.slice(0, room)
  return chars.join('') + tail
}

export interface ConsoleRow {
  channel: number
  port: string
  short: string
  name: string
  source: string
  pickup: string
}

/** Kanäle in Pult-Reihenfolge (Box für Box, Port für Port) mit eindeutigen Kurznamen. */
export function consoleRows(project: Project, assignment: Assignment): ConsoleRow[] {
  const used = new Set<string>()
  const rows: ConsoleRow[] = []
  for (const table of inputTables(project, assignment).boxes) {
    for (const row of table.rows) {
      let short = shortName(row.channel)
      // Gleicher Kurzname zweimal: hinten durchzählen.
      for (let n = 2; used.has(short.toLowerCase()); n++) {
        const suffix = String(n)
        short = shortName(row.channel, CONSOLE_NAME_LENGTH - suffix.length).slice(0, CONSOLE_NAME_LENGTH - suffix.length) + suffix
      }
      used.add(short.toLowerCase())
      rows.push({ channel: rows.length + 1, port: row.port, short, name: row.channel, source: row.group, pickup: row.pickup })
    }
  }
  return rows
}

const cell = (value: string | number) => {
  const text = String(value)
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Kanalliste fürs Pult als CSV (Semikolon und BOM, damit Excel und Numbers sie auf Deutsch
 * richtig öffnen). Das SQ liest keine Namenslisten ein; die Liste ist zum Abtippen am Pult
 * oder in MixPad gedacht, in der Reihenfolge der Stagebox-Eingänge.
 */
export function consoleCsv(project: Project, assignment: Assignment): string {
  const lines = [
    ['Kanal', 'Eingang', `Name am Pult (max. ${CONSOLE_NAME_LENGTH})`, 'Name', 'Quelle', 'Abnahme'],
    ...consoleRows(project, assignment).map((r) => [r.channel, r.port, r.short, r.name, r.source, r.pickup]),
  ]
  return '﻿' + lines.map((line) => line.map(cell).join(';')).join('\r\n') + '\r\n'
}
