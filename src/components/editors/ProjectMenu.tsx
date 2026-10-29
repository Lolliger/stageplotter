import { useRef, useState } from 'react'
import { exportFileName, saveFile } from '../../lib/export/files'
import { parseProjectFile, serializeProject } from '../../lib/export/json'
import { createDefaultProject } from '../../model/defaults'
import type { PlotMode, Project } from '../../model/types'
import type { ProjectMeta } from '../../lib/library'
import { useProject } from '../../state/useProject'
import { useWorkspace, type EventWorkspace, type LocalWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'

type PdfKind = 'sound' | 'light' | 'all'

const PDF_CHOICES: { kind: PdfKind; label: string; meta: string }[] = [
  { kind: 'sound', label: 'PDF Ton', meta: 'Bühnenplan, Input-, Outputliste und PA-Signalweg' },
  { kind: 'light', label: 'PDF Licht', meta: 'Lichtplot mit Lampentypen und DMX-Adressliste' },
  { kind: 'all', label: 'PDF komplett', meta: 'Ton und Licht in einer Datei' },
]

export function ProjectMenu({ mode, onDone }: { mode: PlotMode; onDone: () => void }) {
  const { project, dispatch, assignment } = useProject()
  const workspace = useWorkspace()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState<PdfKind | null>(null)
  const [copied, setCopied] = useState(false)
  // Im iframe (Reiter der AK-Seite) blockieren manche Browser (Safari) Downloads.
  const embedded = typeof window !== 'undefined' && window.self !== window.top

  const exportPdf = async (kind: PdfKind) => {
    setError(null)
    setPdfBusy(kind)
    try {
      // PDF-Bibliotheken erst bei Bedarf laden (eigener Chunk).
      const { buildPdf } = await import('../../lib/export/pdf')
      const blob = await buildPdf(project, assignment, { sound: kind !== 'light', light: kind !== 'sound' })
      const suffix = kind === 'light' ? ' Licht' : kind === 'sound' ? ' Ton' : ''
      await saveFile(blob, exportFileName(project.name + suffix, 'pdf'))
    } catch (e) {
      setError(`PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setPdfBusy(null)
    }
  }
  // Der aktuelle Modus steht vorne
  const pdfChoices = mode === 'lighting' ? [PDF_CHOICES[1], PDF_CHOICES[0], PDF_CHOICES[2]] : PDF_CHOICES

  const exportJson = () => {
    const blob = new Blob([serializeProject(project, new Date(), assignment)], { type: 'application/json' })
    void saveFile(blob, exportFileName(project.name, 'json'))
  }

  const copyJson = async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(serializeProject(project, new Date(), assignment))
      setCopied(true)
    } catch {
      setError('Kopieren nicht möglich. Öffne den Editor im eigenen Tab und exportiere dort.')
    }
  }

  const onFile = async (file: File | undefined) => {
    setError(null)
    setPending(null)
    if (!file) return
    const result = parseProjectFile(await file.text())
    if (result.ok) setPending(result.project)
    else setError(result.error)
  }

  const canChange = workspace.kind === 'local' || workspace.canEdit
  const loadPending = (next: Project) => {
    if (workspace.kind === 'local') workspace.create(next)
    else dispatch({ type: 'replace', project: next })
    onDone()
  }

  return (
    <div className="editor">
      {workspace.kind === 'local' ? (
        <LocalPlots workspace={workspace} project={project} onDone={onDone} />
      ) : (
        <EventPlot workspace={workspace} project={project} onPick={setPending} />
      )}

      <section className="menu-section">
        <h3>Exportieren</h3>
        <div className="menu-grid">
          {pdfChoices.map((c) => (
            <button key={c.kind} type="button" className="template-btn" onClick={() => void exportPdf(c.kind)} disabled={pdfBusy !== null}>
              <span className="template-label">{pdfBusy === c.kind ? 'PDF wird erstellt …' : c.label}</span>
              <span className="template-meta">{c.meta}</span>
            </button>
          ))}
          <button type="button" className="template-btn" onClick={exportJson}>
            <span className="template-label">Projektdatei (JSON)</span>
            <span className="template-meta">Zum Sichern, Weitergeben oder auf anderem Gerät öffnen – mit Patch, Mikros, Signalweg und DMX-Adressen</span>
          </button>
        </div>
        <div className="menu-row">
          <button type="button" className="btn" onClick={() => void copyJson()}>
            {copied ? 'JSON kopiert ✓' : 'JSON in Zwischenablage kopieren'}
          </button>
          {embedded && (
            <a className="btn" href={window.location.href} target="_blank" rel="noopener">
              Im eigenen Tab öffnen ↗
            </a>
          )}
        </div>
        {embedded && (
          <p className="hint">
            Startet kein Download (z. B. in Safari), öffne den Editor im eigenen Tab: Dort ist dasselbe Projekt, und der
            Export klappt.
          </p>
        )}
      </section>

      {error && (
        <p className="hint hint-error" role="alert">
          {error}
        </p>
      )}

      {canChange && (
        <section className="menu-section">
          <h3>Importieren</h3>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Projektdatei öffnen …
          </button>
          {pending && (
            <div className="confirm-box" role="alert">
              <p>
                „{pending.name}“ ({pending.groups.length} Instrumente, {pending.boxes.length} Stageboxen)
                {workspace.kind === 'local'
                  ? ' als neuen Plot öffnen? Der aktuelle bleibt unter „Meine Plots“.'
                  : ' in den Plot des Events laden? Der bisherige Stand wird ersetzt (Rückgängig ist möglich).'}
              </p>
              <div className="editor-actions">
                <button type="button" className="btn" onClick={() => setPending(null)}>
                  Abbrechen
                </button>
                <button type="button" className="btn btn-primary" onClick={() => loadPending(pending)}>
                  {workspace.kind === 'local' ? 'Öffnen' : 'Laden'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {workspace.kind === 'event' && workspace.canEdit && (
        <section className="menu-section">
          <h3>Neu anfangen</h3>
          <p className="hint">Leerer Plot mit zwei Stageboxen für dieses Event. Rückgängig ist möglich.</p>
          <div>
            <ConfirmButton
              confirmLabel="Wirklich alles verwerfen?"
              onConfirm={() => {
                dispatch({ type: 'replace', project: { ...createDefaultProject(), name: workspace.event.name } })
                onDone()
              }}
            >
              Plot leeren
            </ConfirmButton>
          </div>
        </section>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function PlotList({ plots, currentId, onPick }: { plots: ProjectMeta[]; currentId?: string; onPick: (id: string) => void }) {
  return (
    <div className="menu-grid">
      {plots.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`template-btn${m.id === currentId ? ' is-current' : ''}`}
          aria-current={m.id === currentId ? 'true' : undefined}
          onClick={() => onPick(m.id)}
        >
          <span className="template-label">{m.name || 'Ohne Namen'}</span>
          <span className="template-meta">
            {m.id === currentId ? 'Geöffnet · ' : ''}
            {formatDate(m.updatedAt)}
          </span>
        </button>
      ))}
    </div>
  )
}

function LocalPlots({ workspace, project, onDone }: { workspace: LocalWorkspace; project: Project; onDone: () => void }) {
  const plots = workspace.list()
  return (
    <section className="menu-section">
      <h3>Meine Plots</h3>
      <p className="hint">Gespeichert in diesem Browser. Für ein Event mit dem ganzen Team: in der AK-Technik-App beim Event auf „Stageplot“.</p>
      <PlotList
        plots={plots}
        currentId={workspace.projectId}
        onPick={(id) => {
          if (id !== workspace.projectId) workspace.open(id)
          onDone()
        }}
      />
      <div className="menu-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            workspace.create()
            onDone()
          }}
        >
          Neuer Plot
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            workspace.create({ ...structuredClone(project), name: `${project.name} (Kopie)` })
            onDone()
          }}
        >
          Duplizieren
        </button>
        <ConfirmButton confirmLabel={`„${project.name}“ löschen?`} onConfirm={() => workspace.remove(workspace.projectId)}>
          Diesen Plot löschen
        </ConfirmButton>
      </div>
    </section>
  )
}

function EventPlot({ workspace, project, onPick }: { workspace: EventWorkspace; project: Project; onPick: (p: Project) => void }) {
  const [copied, setCopied] = useState(false)
  const [picking, setPicking] = useState(false)
  const plots = picking ? workspace.listLocal() : []
  return (
    <section className="menu-section">
      <h3>Plot zum Event</h3>
      <p className="hint">
        {workspace.canEdit
          ? `Gehört zum Event „${workspace.event.name}“. Änderungen werden automatisch für alle im Team gespeichert.`
          : `Gehört zum Event „${workspace.event.name}“. Du kannst ihn ansehen und exportieren, aber nicht ändern.`}
      </p>
      <div className="menu-row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            workspace.copyToLocal({ ...structuredClone(project), name: `${project.name} (Kopie)` })
            setCopied(true)
          }}
        >
          {copied ? 'Unter „Meine Plots“ gespeichert ✓' : 'Kopie unter „Meine Plots“ speichern'}
        </button>
        {workspace.canEdit && (
          <button type="button" className="btn" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            Aus „Meine Plots“ übernehmen …
          </button>
        )}
      </div>
      {picking &&
        (plots.length > 0 ? (
          <PlotList
            plots={plots}
            onPick={(id) => {
              const p = workspace.loadLocal(id)
              if (p) onPick({ ...p, name: workspace.event.name })
              setPicking(false)
            }}
          />
        ) : (
          <p className="hint">In diesem Browser sind keine eigenen Plots gespeichert.</p>
        ))}
    </section>
  )
}
