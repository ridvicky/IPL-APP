import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      {/* Panel */}
      <div className={`relative z-10 bg-ipl-card border border-ipl-border rounded-lg shadow-2xl w-full max-w-md mx-4 ${className}`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-ipl-border">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button
              className="text-gray-400 hover:text-white text-xl leading-none"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}
