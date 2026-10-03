import { useRef, useState } from 'react'
import { exportFileName, saveFile } from '../../lib/export/files'
import { parseProjectFile, serializeProject } from '../../lib/export/json'
import { createDefaultProject } from '../../model/defaults'
import type { Project } from '../../model/types'
import { useProject } from '../../state/useProject'
import { ConfirmButton } from '../ui/ConfirmButton'

export function ProjectMenu({ onDone }: { onDone: () => void }) {
  const { project, dispatch } = useProject()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          <button type="button" className="template-btn" onClick={exportJson}>
            <span className="template-label">Projektdatei (JSON)</span>
            <span className="template-meta">Zum Sichern, Weitergeben oder auf anderem Gerät öffnen</span>
          </button>
        </div>
      </section>

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
        {error && (
          <p className="hint hint-error" role="alert">
            {error}
          </p>
        )}
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
