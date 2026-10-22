import { trussOffset } from '../model/lights'
import type { Fixture, Truss } from '../model/types'

/** Kanäle pro DMX-Universe. */
export const DMX_SIZE = 512

/** „1.001“ – Universe und dreistellige Adresse, wie an den meisten Pulten. */
export function formatAddress(universe: number, address: number): string {
  return `${universe}.${String(address).padStart(3, '0')}`
}

/** Letzter belegter Kanal; null ohne Adresse oder ohne Kanäle. */
export function addressEnd(f: Pick<Fixture, 'address' | 'channels'>): number | null {
  if (f.address === undefined || f.channels <= 0) return null
  return f.address + f.channels - 1
}

/** „1.001–1.008“, „1.017“ bei einem Kanal, „–“ ohne Adresse. */
export function formatRange(f: Pick<Fixture, 'universe' | 'address' | 'channels'>): string {
  if (f.address === undefined) return '–'
  const end = addressEnd(f)
  if (end === null || end === f.address) return formatAddress(f.universe, f.address)
  return `${formatAddress(f.universe, f.address)}–${formatAddress(f.universe, end)}`
}

export interface DmxIssue {
  level: 'error' | 'warning'
  message: string
  fixtureIds: string[]
}

const label = (f: Fixture) => `#${f.number} ${f.name}`

/** Überschneidungen, Bereiche über 512 hinaus und Lampen ohne Adresse. */
export function dmxIssues(fixtures: Fixture[]): DmxIssue[] {
  const issues: DmxIssue[] = []
  const addressed = fixtures.filter((f) => addressEnd(f) !== null)
  for (const f of addressed) {
    const end = addressEnd(f)!
    if (end > DMX_SIZE)
      issues.push({
        level: 'error',
        message: `${label(f)}: ${f.channels} Kanäle ab ${formatAddress(f.universe, f.address!)} gehen über Kanal ${DMX_SIZE} hinaus.`,
        fixtureIds: [f.id],
      })
  }
  const sorted = [...addressed].sort((a, b) => a.universe - b.universe || a.address! - b.address!)
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      if (b.universe !== a.universe || b.address! > addressEnd(a)!) break
      issues.push({
        level: 'error',
        message: `${label(a)} (${formatRange(a)}) überschneidet sich mit ${label(b)} (${formatRange(b)}).`,
        fixtureIds: [a.id, b.id],
      })
    }
  }
  const missing = fixtures.filter((f) => f.address === undefined && f.channels > 0)
  if (missing.length)
    issues.push({
      level: 'warning',
      message:
        missing.length === 1
          ? `${label(missing[0])} hat noch keine DMX-Adresse.`
          : `${missing.length} Lampen haben noch keine DMX-Adresse (${missing.map((f) => `#${f.number}`).join(', ')}).`,
      fixtureIds: missing.map((f) => f.id),
    })
  const numbers = new Map<number, Fixture[]>()
  for (const f of fixtures) numbers.set(f.number, [...(numbers.get(f.number) ?? []), f])
  for (const [n, list] of numbers)
    if (list.length > 1)
      issues.push({
        level: 'warning',
        message: `Lampennummer #${n} ist ${list.length}× vergeben (${list.map((f) => f.name).join(', ')}).`,
        fixtureIds: list.map((f) => f.id),
      })
  return issues
}

/**
 * Reihenfolge für Auto-Adressierung und Listen: Traverse für Traverse (von hinten nach vorne,
 * dann links nach rechts), auf der Traverse vom Anfang zum Ende; danach freie Lampen ebenso.
 */
export function fixtureOrder(fixtures: Fixture[], trusses: Truss[]): Fixture[] {
  const trussRank = new Map(
    [...trusses]
      .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
      .map((t, i) => [t.id, { i, truss: t }] as const),
  )
  const key = (f: Fixture): [number, number, number] => {
    const t = f.trussId ? trussRank.get(f.trussId) : undefined
    if (t) return [t.i, trussOffset(t.truss, f.pos).along, 0]
    return [trusses.length, f.pos.y, f.pos.x]
  }
  return [...fixtures].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || a.number - b.number
  })
}

export interface AutoAddressOptions {
  /** Erste Adresse, z. B. Universe 1, Adresse 1. */
  universe: number
  address: number
  /** true: vorhandene Adressen bleiben, nur Lampen ohne Adresse bekommen eine. */
  keepExisting: boolean
  /** Lampennummern in derselben Reihenfolge neu vergeben (1, 2, 3 …). */
  renumber?: boolean
}

/**
 * Vergibt Adressen lückenlos in `fixtureOrder`. Eine Lampe wird nie auf zwei Universes verteilt:
 * passt sie nicht mehr hinein, geht es im nächsten Universe bei 1 weiter. Belegte Bereiche
 * (beibehaltene Adressen) werden übersprungen. Lampen ohne Kanäle bleiben ohne Adresse.
 */
export function autoAddress(fixtures: Fixture[], trusses: Truss[], options: AutoAddressOptions): Fixture[] {
  const ordered = fixtureOrder(fixtures, trusses)
  const keep = (f: Fixture) => options.keepExisting && f.address !== undefined
  const taken = new Map<number, [number, number][]>()
  const occupy = (u: number, from: number, to: number) => taken.set(u, [...(taken.get(u) ?? []), [from, to]])
  for (const f of fixtures) if (keep(f) && addressEnd(f) !== null) occupy(f.universe, f.address!, addressEnd(f)!)

  let universe = Math.max(1, Math.round(options.universe))
  let cursor = Math.min(DMX_SIZE, Math.max(1, Math.round(options.address)))
  const place = (channels: number): { universe: number; address: number } => {
    for (;;) {
      const end = cursor + channels - 1
      const clash = (taken.get(universe) ?? []).find(([a, b]) => cursor <= b && end >= a)
      if (clash) {
        cursor = clash[1] + 1
      } else if (end > DMX_SIZE) {
        if (channels > DMX_SIZE) return { universe, address: cursor } // passt nirgends, Hinweis folgt
        universe += 1
        cursor = 1
      } else {
        return { universe, address: cursor }
      }
    }
  }

  const result = new Map<string, Fixture>()
  ordered.forEach((f, i) => {
    let next: Fixture = f
    if (!keep(f)) {
      if (f.channels <= 0) {
        next = { ...f }
        delete next.address
      } else {
        const at = place(f.channels)
        next = { ...f, universe: at.universe, address: at.address }
        occupy(at.universe, at.address, at.address + f.channels - 1)
        cursor = at.address + f.channels
      }
    }
    if (options.renumber) next = { ...next, number: i + 1 }
    result.set(f.id, next)
  })
  return fixtures.map((f) => result.get(f.id)!)
}

export interface AddressRow {
  fixture: Fixture
  /** „1.001“ oder „–“ */
  address: string
  /** „1.001–1.008“ */
  range: string
  /** Name der Traverse oder „frei“ */
  place: string
}

/** Adressliste: je Universe nach Adresse, Lampen ohne Adresse am Ende (in Plan-Reihenfolge). */
export function addressList(fixtures: Fixture[], trusses: Truss[]): { universes: { universe: number; rows: AddressRow[]; used: number }[]; unaddressed: AddressRow[] } {
  const trussName = new Map(trusses.map((t) => [t.id, t.name]))
  const row = (f: Fixture): AddressRow => ({
    fixture: f,
    address: f.address === undefined ? '–' : formatAddress(f.universe, f.address),
    range: formatRange(f),
    place: (f.trussId && trussName.get(f.trussId)) || 'frei',
  })
  const byUniverse = new Map<number, Fixture[]>()
  for (const f of fixtures)
    if (f.address !== undefined) byUniverse.set(f.universe, [...(byUniverse.get(f.universe) ?? []), f])
  const universes = [...byUniverse.entries()]
    .sort(([a], [b]) => a - b)
    .map(([universe, list]) => {
      const sorted = list.sort((a, b) => a.address! - b.address! || a.number - b.number)
      return { universe, rows: sorted.map(row), used: sorted.reduce((n, f) => n + Math.max(0, f.channels), 0) }
    })
  const unaddressed = fixtureOrder(
    fixtures.filter((f) => f.address === undefined),
    trusses,
  ).map(row)
  return { universes, unaddressed }
}

/** Erste freie Startadresse im Universe für `channels` Kanäle (andere Lampen als `exceptId`). */
export function nextFreeAddress(fixtures: Fixture[], universe: number, channels: number, exceptId?: string): number | null {
  const taken = fixtures
    .filter((f) => f.id !== exceptId && f.universe === universe && addressEnd(f) !== null)
    .map((f) => [f.address!, addressEnd(f)!] as const)
    .sort((a, b) => a[0] - b[0])
  const need = Math.max(1, channels)
  let cursor = 1
  for (const [from, to] of taken) {
    if (cursor + need - 1 < from) break
    cursor = Math.max(cursor, to + 1)
  }
  return cursor + need - 1 <= DMX_SIZE ? cursor : null
}
