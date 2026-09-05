import React from 'react'

export interface CourseCardProps {
  id: string
  title: string
  description?: string
  thumbnail?: string
  instructor?: string
  lessonsCount?: number
  studentsCount?: number
  rating?: string
  onClick?: (id: string) => void
}

export function CourseCard({
  id,
  title,
  description,
  thumbnail,
  instructor,
  lessonsCount,
  studentsCount,
  rating,
  onClick,
}: CourseCardProps) {
  return (
    <div
      className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none overflow-hidden cursor-pointer hover:shadow-lg dark:hover:shadow-none transition-shadow"
      onClick={() => onClick?.(id)}
    >
      <div className="h-48 bg-gradient-to-r from-blue-500 to-purple-500 relative">
        {thumbnail && (
          <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
        )}
        {rating && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-black px-2 py-1 rounded text-sm font-semibold">
            ★ {rating}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{title}</h3>
        {description && (
          <p className="text-gray-600 dark:text-zinc-300 text-sm mb-3 line-clamp-2">{description}</p>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-zinc-400">
          {instructor && <span>{instructor}</span>}
          <div className="flex gap-2">
            {lessonsCount != null && <span>{lessonsCount} 课时</span>}
            {studentsCount != null && <span>{studentsCount} 人</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
