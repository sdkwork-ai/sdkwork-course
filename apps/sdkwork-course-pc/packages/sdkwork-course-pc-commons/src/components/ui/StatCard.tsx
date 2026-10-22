import React from 'react'
import { cn } from '../../utils/cn'

export interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'warning' | 'success' | 'danger'
  icon?: React.ReactNode
  className?: string
}

const TONES = {
  default: 'border-slate-100 bg-white text-slate-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
}

export function StatCard({ label, value, hint, tone = 'default', icon, className }: StatCardProps) {
  return (
    <div className={cn('rounded-2xl border p-5 shadow-sm', TONES[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {icon ? <span className="opacity-70">{icon}</span> : null}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
    </div>
  )
}
