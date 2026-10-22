import React from 'react'
import { cn } from '../../utils/cn'

export interface ProgressBarProps {
  value: number
  className?: string
  tone?: 'indigo' | 'emerald' | 'amber'
}

const TONES = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
}

export function ProgressBar({ value, className, tone = 'indigo' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
