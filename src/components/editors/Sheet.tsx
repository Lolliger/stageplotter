import { useEffect, type ReactNode } from 'react'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
}

/** Handy: Bottom-Sheet. Breite Displays: Panel über der rechten Seitenleiste. */
export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <section className="sheet" role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="sheet-header">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  )
}
