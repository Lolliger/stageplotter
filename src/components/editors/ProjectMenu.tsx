import { useRef, useState } from 'react'
import { exportFileName, saveFile } from '../../lib/export/files'
import { parseProjectFile, serializeProject } from '../../lib/export/json'
import { createDefaultProject } from '../../model/defaults'
import type { PlotMode, Project } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'

type PdfKind = 'sound' | 'light' | 'all'

const PDF_CHOICES: { kind: PdfKind; label: string; meta: string }[] = [
  { kind: 'sound', label: 'PDF Ton', meta: 'Bühnenplan, Input-, Outputliste und PA-Signalweg' },
  { kind: 'light', label: 'PDF Licht', meta: 'Lichtplot mit Lampentypen und DMX-Adressliste' },
  { kind: 'all', label: 'PDF komplett', meta: 'Ton und Licht in einer Datei' },
]

export function ProjectMenu({ mode, onDone }: { mode: PlotMode; onDone: () => void }) {
  const { project, dispatch, assignment } = useProject()
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

  return (
    <div className="editor">
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
              „{pending.name}“ laden ({pending.groups.length} Instrumente, {pending.boxes.length} Stageboxen)? Das
              aktuelle Projekt wird ersetzt.
            </p>
            <div className="editor-actions">
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  dispatch({ type: 'replace', project: pending })
                  onDone()
                }}
              >
                Laden
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="menu-section">
        <h3>Neu anfangen</h3>
        <p className="hint">Leeres Projekt mit zwei Stageboxen. Vorher exportieren, wenn du das aktuelle behalten willst.</p>
        <div>
          <ConfirmButton
            confirmLabel="Wirklich alles verwerfen?"
            onConfirm={() => {
              dispatch({ type: 'replace', project: createDefaultProject() })
              onDone()
            }}
          >
            Neues Projekt
          </ConfirmButton>
        </div>
      </section>
    </div>
  )
}
