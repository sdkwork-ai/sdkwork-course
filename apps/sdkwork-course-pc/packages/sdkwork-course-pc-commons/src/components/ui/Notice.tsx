import React from 'react'
import { cn } from '../../utils/cn'

export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  onDismiss?: () => void
}

const TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
}

export function Notice({ tone = 'info', title, onDismiss, className, children, ...rest }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={cn('rounded-xl border px-4 py-3 text-sm', TONES[tone], className)}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <p className="mb-1 font-semibold">{title}</p> : null}
          {children}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="关闭提示"
            className="shrink-0 rounded p-0.5 text-current opacity-60 transition hover:opacity-100"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}
