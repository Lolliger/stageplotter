import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  onConfirm: () => void
  children: ReactNode
  confirmLabel?: string
}

/** Zweistufiger Lösch-Button: erst tippen, dann bestätigen. Kein nativer Dialog. */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Wirklich löschen?' }: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      className={`btn btn-danger${armed ? ' armed' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
