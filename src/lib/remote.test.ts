import { describe, expect, test } from 'vitest'
import { createDefaultProject } from '../model/defaults'
import type { Project } from '../model/types'
import { EventSaver, eventIdFromSearch, loadEventPlot, saveEventPlot, type SyncState } from './remote'

const EVENT = '0b6c1f4e-8d1a-4c3e-9f7a-2b5d6e7f8a9b'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const named = (name: string): Project => ({ ...createDefaultProject(), name })

/** Fake-Server mit Revision, wie app/api/stageplot/events/[id] in der aktapp. */
function fakeServer() {
  const server = { revision: 0, project: null as Project | null, calls: 0, fail: false }
  const fetcher = async (_url: string, init?: RequestInit) => {
    server.calls++
    if (server.fail) throw new TypeError('offline')
    const body = JSON.parse(String(init?.body)) as { project: Project; baseRevision: number }
    if (body.baseRevision !== server.revision) {
      return json({ error: 'Konflikt', revision: server.revision, project: server.project, updatedBy: 'Mia' }, 409)
    }
    server.revision++
    server.project = body.project
    return json({ revision: server.revision })
  }
  return { server, fetcher }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('eventIdFromSearch', () => {
  test('accepts only UUIDs', () => {
    expect(eventIdFromSearch(`?event=${EVENT}`)).toBe(EVENT)
    expect(eventIdFromSearch('?event=../../admin')).toBeNull()
    expect(eventIdFromSearch('')).toBeNull()
  })
})

describe('loadEventPlot', () => {
  test('reads plot, revision and rights', async () => {
    const p = named('Abiball')
    const r = await loadEventPlot(EVENT, async () =>
      json({ event: { name: 'Abiball', date: '2026-06-20' }, project: p, revision: 3, canEdit: true, updatedBy: 'Mia' }),
    )
    expect(r).toEqual({
      ok: true,
      plot: {
        event: { id: EVENT, name: 'Abiball', date: '2026-06-20' },
        project: p,
        revision: 3,
        canEdit: true,
        updatedBy: 'Mia',
        updatedAt: null,
      },
    })
  })

  test('treats the login page (HTML) as not signed in', async () => {
    const r = await loadEventPlot(EVENT, async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }))
    expect(r).toEqual({ ok: false, error: expect.stringContaining('Nicht angemeldet') })
  })

  test('passes server errors through', async () => {
    const r = await loadEventPlot(EVENT, async () => json({ error: 'Event nicht gefunden.' }, 404))
    expect(r).toEqual({ ok: false, error: 'Event nicht gefunden.' })
  })
})

describe('saveEventPlot', () => {
  test('reports conflicts with the other version', async () => {
    const { server, fetcher } = fakeServer()
    server.revision = 2
    server.project = named('Von Mia')
    const r = await saveEventPlot(EVENT, named('Meins'), 1, fetcher)
    expect(r).toMatchObject({ kind: 'conflict', revision: 2, updatedBy: 'Mia', project: { name: 'Von Mia' } })
  })
})

describe('EventSaver', () => {
  test('sends only the newest state after the running request', async () => {
    const { server, fetcher } = fakeServer()
    const states: SyncState['kind'][] = []
    const saver = new EventSaver(EVENT, 0, null, (s) => states.push(s.kind), fetcher)
    saver.save(named('1'))
    saver.save(named('2'))
    saver.save(named('3'))
    await settle()
    await settle()
    expect(server.project?.name).toBe('3')
    expect(server.calls).toBe(2)
    expect(server.revision).toBe(2)
    expect(states.at(-1)).toBe('saved')
    expect(saver.hasUnsaved).toBe(false)
  })

  test('does not resend the loaded state', async () => {
    const { server, fetcher } = fakeServer()
    const p = named('geladen')
    const saver = new EventSaver(EVENT, 0, p, () => {}, fetcher)
    saver.save(p)
    await settle()
    expect(server.calls).toBe(0)
  })

  test('waits after a conflict until the user overwrites', async () => {
    const { server, fetcher } = fakeServer()
    server.revision = 5
    let state: SyncState = { kind: 'saved' }
    const saver = new EventSaver(EVENT, 4, null, (s) => (state = s), fetcher)
    saver.save(named('Meins'))
    await settle()
    expect(state.kind).toBe('conflict')

    saver.save(named('Meins 2'))
    await settle()
    expect(server.calls).toBe(1)

    saver.overwrite(5)
    await settle()
    expect(server.project?.name).toBe('Meins 2')
    expect(state.kind).toBe('saved')
  })

  test('keeps the state after a network error and retries', async () => {
    const { server, fetcher } = fakeServer()
    server.fail = true
    let state: SyncState = { kind: 'saved' }
    const saver = new EventSaver(EVENT, 0, null, (s) => (state = s), fetcher)
    saver.save(named('Offline'))
    await settle()
    expect(state).toEqual({ kind: 'error', message: expect.stringContaining('Keine Verbindung') })
    expect(saver.hasUnsaved).toBe(true)

    server.fail = false
    saver.retry()
    await settle()
    expect(server.project?.name).toBe('Offline')
    expect(state.kind).toBe('saved')
  })
})
