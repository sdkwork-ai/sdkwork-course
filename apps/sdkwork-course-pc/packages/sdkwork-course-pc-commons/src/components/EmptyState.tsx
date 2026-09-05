import React from 'react'

export interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <span className="text-4xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">{title}</h3>
      {description && <p className="text-gray-600 dark:text-zinc-300 mb-4">{description}</p>}
      {action}
    </div>
  )
}
