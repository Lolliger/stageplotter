import type { Project } from '../model/types'
import { parseProject } from './schema'

/**
 * Plot eines Events in der AK-Technik-App (D33). Der Editor läuft dort unter /stageplot-app/ auf
 * derselben Domain, das Login-Cookie geht also automatisch mit. Gespeichert wird mit Revision:
 * Hat inzwischen jemand anderes gespeichert, antwortet der Server mit 409 und dem neuen Stand.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Event-ID aus `?event=…`, sonst null (lokaler Modus). */
export function eventIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('event')
  return id && UUID.test(id) ? id : null
}

export function eventPlotUrl(eventId: string): string {
  return `/api/stageplot/events/${eventId}`
}

export interface EventInfo {
  id: string
  name: string
  date: string | null
}

export interface EventPlot {
  event: EventInfo
  /** null = für dieses Event gibt es noch keinen Plot. */
  project: Project | null
  /** 0 = noch nie gespeichert. */
  revision: number
  canEdit: boolean
  updatedBy: string | null
  updatedAt: string | null
}

export interface Conflict {
  /** Stand der anderen Person; null, wenn er sich nicht lesen ließ. */
  project: Project | null
  revision: number
  updatedBy: string | null
  updatedAt: string | null
}

export type SaveResult =
  | { kind: 'saved'; revision: number }
  | ({ kind: 'conflict' } & Conflict)
  | { kind: 'error'; message: string }

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

const NOT_SIGNED_IN = 'Nicht angemeldet. Bitte in der AK-Technik-App neu einloggen.'
const OFFLINE = 'Keine Verbindung zur AK-Technik-App.'

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0
}

function project(v: unknown): Project | null {
  if (v === null || v === undefined) return null
  const result = parseProject(v)
  return result.ok ? result.project : null
}

/** Ohne Login leitet die App auf die Login-Seite um, dann kommt HTML statt JSON. */
async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.headers.get('content-type')?.includes('application/json')) return null
  const body: unknown = await res.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}

function errorText(res: Response, body: Record<string, unknown> | null): string {
  if (res.status === 401 || body === null) return NOT_SIGNED_IN
  return str(body.error) ?? `Fehler ${res.status}`
}

export async function loadEventPlot(
  eventId: string,
  fetcher: Fetch = fetch,
): Promise<{ ok: true; plot: EventPlot } | { ok: false; error: string }> {
  let res: Response
  try {
    res = await fetcher(eventPlotUrl(eventId), { cache: 'no-store', credentials: 'same-origin' })
  } catch {
    return { ok: false, error: OFFLINE }
  }
  const body = await readJson(res)
  if (!res.ok || body === null) return { ok: false, error: errorText(res, body) }
  const event = (body.event ?? {}) as Record<string, unknown>
  if (body.project !== null && body.project !== undefined && project(body.project) === null) {
    return { ok: false, error: 'Der gespeicherte Plot ließ sich nicht lesen.' }
  }
  return {
    ok: true,
    plot: {
      event: { id: eventId, name: str(event.name) ?? 'Event', date: str(event.date) },
      project: project(body.project),
      revision: num(body.revision),
      canEdit: body.canEdit === true,
      updatedBy: str(body.updatedBy),
      updatedAt: str(body.updatedAt),
    },
  }
}

/** Unter dieser Größe darf der Browser die Anfrage auch beim Schließen der Seite noch senden. */
const KEEPALIVE_LIMIT = 60_000

export async function saveEventPlot(
  eventId: string,
  data: Project,
  baseRevision: number,
  fetcher: Fetch = fetch,
): Promise<SaveResult> {
  const payload = JSON.stringify({ project: data, baseRevision })
  let res: Response
  try {
    res = await fetcher(eventPlotUrl(eventId), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: payload,
      keepalive: payload.length < KEEPALIVE_LIMIT,
    })
  } catch {
    return { kind: 'error', message: OFFLINE }
  }
  const body = await readJson(res)
  if (res.status === 409 && body) {
    return {
      kind: 'conflict',
      project: project(body.project),
      revision: num(body.revision),
      updatedBy: str(body.updatedBy),
      updatedAt: str(body.updatedAt),
    }
  }
  if (!res.ok || body === null) return { kind: 'error', message: errorText(res, body) }
  return { kind: 'saved', revision: num(body.revision) }
}

export type SyncState =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | ({ kind: 'conflict' } & Conflict)

/**
 * Speichert nacheinander, nie zwei Anfragen gleichzeitig: Kommt während des Speicherns eine
 * neue Änderung, wird danach nur der neueste Stand gesendet. Bei Konflikt oder Fehler wartet der
 * letzte Stand, bis `overwrite()` bzw. `retry()` aufgerufen wird.
 */
export class EventSaver {
  private pending: Project | null = null
  private inFlight = false
  private blocked = false
  private lastSent: Project | null

  constructor(
    private readonly eventId: string,
    private revision: number,
    initial: Project | null,
    private readonly onState: (state: SyncState) => void,
    private readonly fetcher: Fetch = fetch,
  ) {
    this.lastSent = initial
  }

  save(project: Project): void {
    if (project === this.lastSent && this.pending === null) return
    this.pending = project
    if (!this.inFlight && !this.blocked) void this.flush()
  }

  /** Nach einem Fehler (z. B. wieder online) den letzten Stand erneut senden. */
  retry(): void {
    if (this.inFlight || this.pending === null) return
    this.blocked = false
    void this.flush()
  }

  /** Konflikt: den eigenen Stand trotzdem speichern (der andere wird überschrieben). */
  overwrite(revision: number): void {
    this.revision = revision
    this.retry()
  }

  get hasUnsaved(): boolean {
    return this.pending !== null || this.inFlight
  }

  private async flush(): Promise<void> {
    this.inFlight = true
    while (this.pending !== null) {
      const project = this.pending
      this.pending = null
      this.onState({ kind: 'saving' })
      const result = await saveEventPlot(this.eventId, project, this.revision, this.fetcher)
      if (result.kind === 'saved') {
        this.revision = result.revision
        this.lastSent = project
        continue
      }
      // Den Stand behalten, sofern nicht inzwischen ein neuerer wartet.
      this.pending ??= project
      this.blocked = true
      this.inFlight = false
      this.onState(result.kind === 'conflict' ? result : { kind: 'error', message: result.message })
      return
    }
    this.inFlight = false
    this.onState({ kind: 'saved' })
  }
}
