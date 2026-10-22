import React from 'react'
import { cn } from '../../utils/cn'

export interface ModalProps {
  open: boolean
  title?: React.ReactNode
  description?: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  size = 'md',
  children,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            {title ? <h2 className="text-lg font-bold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-transparent px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
