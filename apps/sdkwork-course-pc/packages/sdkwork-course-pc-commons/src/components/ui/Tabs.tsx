import React from 'react'
import { cn } from '../../utils/cn'

export interface TabItem {
  id: string
  label: React.ReactNode
  count?: number
}

export interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ items, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={active === item.id}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
            active === item.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {item.label}
          {item.count != null ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                active === item.id ? 'bg-indigo-50 text-indigo-600' : 'bg-white/70 text-slate-500',
              )}
            >
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
