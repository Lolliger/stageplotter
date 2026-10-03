import { useRef, useState } from 'react'
import { exportFileName, saveFile } from '../../lib/export/files'
import { parseProjectFile, serializeProject } from '../../lib/export/json'
import { createDefaultProject } from '../../model/defaults'
import type { Project } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'

export function ProjectMenu({ onDone }: { onDone: () => void }) {
  const { project, dispatch, assignment } = useProject()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const exportPdf = async () => {
    setError(null)
    setPdfBusy(true)
    try {
      // PDF-Bibliotheken erst bei Bedarf laden (eigener Chunk).
      const { buildPdf } = await import('../../lib/export/pdf')
      const blob = await buildPdf(project, assignment)
      await saveFile(blob, exportFileName(project.name, 'pdf'))
    } catch (e) {
      setError(`PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setPdfBusy(false)
    }
  }

  const exportJson = () => {
    const blob = new Blob([serializeProject(project)], { type: 'application/json' })
    void saveFile(blob, exportFileName(project.name, 'json'))
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
          <button type="button" className="template-btn" onClick={() => void exportPdf()} disabled={pdfBusy}>
            <span className="template-label">{pdfBusy ? 'PDF wird erstellt …' : 'PDF'}</span>
            <span className="template-meta">Bühnenplan, Inputliste und Outputliste zum Drucken oder Mailen</span>
          </button>
          <button type="button" className="template-btn" onClick={exportJson}>
            <span className="template-label">Projektdatei (JSON)</span>
            <span className="template-meta">Zum Sichern, Weitergeben oder auf anderem Gerät öffnen</span>
          </button>
        </div>
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
