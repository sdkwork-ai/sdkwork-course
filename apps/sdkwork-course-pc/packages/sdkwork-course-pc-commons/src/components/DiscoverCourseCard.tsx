import React from 'react'
import { cn } from '../utils/cn'
import {
  formatCompactCount,
  formatCompactDuration,
  formatPrice,
  kindLabel,
  resolveCourseCover,
} from '../utils/format'

export interface DiscoverCourseCardProps {
  id: string
  title: string
  cover?: string
  kind?: string
  lessonsCount?: number
  studentsCount?: number
  durationSeconds?: number
  author?: string
  dateText?: string
  priceAmount?: string | null
  isFree?: boolean
  currency?: string | null
  badge?: string
  onClick?: (id: string) => void
  className?: string
}

/**
 * Bilibili-like discovery card: media cover with overlay stats, two-line title,
 * and a muted author/date line. Price stays visible for commercial content but
 * never dominates the editorial hierarchy.
 */
export function DiscoverCourseCard({
  id,
  title,
  cover,
  kind,
  lessonsCount,
  studentsCount,
  durationSeconds,
  author,
  dateText,
  priceAmount,
  isFree = true,
  currency,
  badge,
  onClick,
  className,
}: DiscoverCourseCardProps) {
  const resolved = resolveCourseCover(cover, title)
  const duration = formatCompactDuration(durationSeconds)
  const metaCount = studentsCount && studentsCount > 0 ? studentsCount : lessonsCount

  return (
    <article
      className={cn('group min-w-0', onClick && 'cursor-pointer', className)}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${kindLabel(kind)}：${title}` : undefined}
      onClick={() => onClick?.(id)}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick(id)
        }
      }}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-200">
        {resolved.url ? (
          <img
            src={resolved.url}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="h-full w-full transition duration-300 group-hover:scale-[1.04]"
            style={{
              backgroundImage: `radial-gradient(circle at 22% 18%, rgba(255,255,255,0.24), transparent 34%), radial-gradient(circle at 82% 78%, rgba(15,23,42,0.28), transparent 42%), linear-gradient(135deg, hsl(${resolved.fallbackHue} 68% 55%), hsl(${
                (resolved.fallbackHue + 38) % 360
              } 72% 38%))`,
            }}
          >
            <span className="pointer-events-none flex h-full items-center justify-center text-[54px] font-black tracking-[0.12em] text-white/25">
              {title.slice(0, 1)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent opacity-80" />

        <span className="absolute left-2 top-2 rounded bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/95 backdrop-blur-sm">
          {badge ?? kindLabel(kind)}
        </span>

        <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 text-[11px] font-medium text-white">
          <span className="flex min-w-0 items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 fill-current opacity-90" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="truncate">{formatCompactCount(metaCount)}</span>
            {lessonsCount && studentsCount ? (
              <span className="text-white/65">· {lessonsCount} 课时</span>
            ) : null}
          </span>
          {duration ? (
            <span className="shrink-0 rounded bg-slate-950/50 px-1 py-0.5 tabular-nums backdrop-blur-sm">
              {duration}
            </span>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/55 text-white backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
      </div>

      <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-5 text-slate-800 transition-colors group-hover:text-indigo-600">
        {title}
      </h3>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex min-w-0 items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 fill-slate-300" aria-hidden>
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
          </svg>
          <span className="truncate">{author || '平台讲师'}</span>
          {dateText ? <span className="shrink-0">· {dateText}</span> : null}
        </span>
        <span className={cn('shrink-0 font-semibold', isFree ? 'text-emerald-600' : 'text-rose-500')}>
          {formatPrice(priceAmount, isFree, currency)}
        </span>
      </div>
    </article>
  )
}
