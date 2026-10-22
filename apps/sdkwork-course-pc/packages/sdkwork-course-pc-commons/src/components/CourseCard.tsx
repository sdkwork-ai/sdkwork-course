import React from 'react'
import { cn } from '../utils/cn'
import { formatCount, formatPrice, kindLabel, resolveCourseCover } from '../utils/format'

export interface CourseCardProps {
  id: string
  title: string
  description?: string
  thumbnail?: string
  instructor?: string
  lessonsCount?: number
  studentsCount?: number
  rating?: string
  kind?: string
  priceAmount?: string | null
  isFree?: boolean
  currency?: string | null
  author?: string
  badge?: React.ReactNode
  progress?: number
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
  kind,
  priceAmount,
  isFree = true,
  currency,
  author,
  badge,
  progress,
  onClick,
}: CourseCardProps) {
  const cover = resolveCourseCover(thumbnail, title)
  const interactive = typeof onClick === 'function'

  const activate = () => onClick?.(id)

  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-200',
        interactive && 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg',
      )}
      onClick={interactive ? activate : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                activate()
              }
            }
          : undefined
      }
      role={interactive ? 'link' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${kindLabel(kind)}：${title}` : undefined}
    >
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        {cover.url ? (
          <img
            src={cover.url}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-end p-4"
            style={{
              backgroundImage: `linear-gradient(135deg, hsl(${cover.fallbackHue} 70% 55%), hsl(${
                (cover.fallbackHue + 40) % 360
              } 75% 42%))`,
            }}
          >
            <span className="line-clamp-2 text-lg font-bold leading-snug text-white/95">
              {title}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur">
            {kindLabel(kind)}
          </span>
          {badge}
        </div>
        {rating && Number.parseFloat(rating) > 0 ? (
          <div className="absolute right-3 top-3 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold text-amber-600 shadow-sm">
            ★ {rating}
          </div>
        ) : null}
        {progress != null && progress > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 group-hover:text-indigo-700">
          {title}
        </h3>
        {description ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
            {description}
          </p>
        ) : null}
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 text-[12px] text-slate-500">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                {(author || instructor || '课').slice(0, 1)}
              </span>
              <span className="truncate">{author || instructor || '讲师'}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2.5">
              {lessonsCount != null ? <span>{lessonsCount} 课时</span> : null}
              {studentsCount != null ? <span>{formatCount(studentsCount)} 人</span> : null}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className={cn('text-sm font-bold', isFree ? 'text-emerald-600' : 'text-rose-600')}>
              {formatPrice(priceAmount, isFree, currency)}
            </span>
            <span className="text-[11px] font-medium text-slate-400 transition-colors group-hover:text-indigo-600">
              查看详情 →
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
