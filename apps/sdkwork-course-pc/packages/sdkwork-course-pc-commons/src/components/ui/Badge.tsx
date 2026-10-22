import React from 'react'
import { cn } from '../../utils/cn'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  dot?: boolean
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  violet: 'border-indigo-200 bg-indigo-50 text-indigo-700',
}

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  violet: 'bg-indigo-500',
}

export function Badge({ tone = 'neutral', dot = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} /> : null}
      {children}
    </span>
  )
}

export function reviewTone(publishStatus?: string | null): BadgeTone {
  switch (publishStatus) {
    case 'published':
      return 'success'
    case 'reviewing':
      return 'warning'
    case 'unpublished':
      return 'danger'
    case 'archived':
      return 'neutral'
    default:
      return 'info'
  }
}
