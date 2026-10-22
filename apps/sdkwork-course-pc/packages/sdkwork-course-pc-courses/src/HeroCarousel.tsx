import React, { useEffect, useMemo, useState } from 'react'
import {
  cn,
  formatCompactCount,
  formatDuration,
  kindLabel,
  resolveCourseCover,
} from '@sdkwork/sdkwork-course-pc-commons'
import type { CourseSummary } from './courseModel'

export interface HeroCarouselProps {
  courses: CourseSummary[]
  onOpen: (courseId: string) => void
  /** Open the informational course detail page rather than the player. */
  onDetails?: (courseId: string) => void
  /** Use a shorter banner inside embedding host surfaces. */
  compact?: boolean
}

export function HeroCarousel({ courses, onOpen, onDetails, compact = false }: HeroCarouselProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const items = useMemo(() => courses.filter((course) => course.id).slice(0, 6), [courses])
  const current = items[index] ?? items[0]

  useEffect(() => {
    if (items.length <= 1 || paused) return undefined
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % items.length)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [items.length, paused])

  useEffect(() => {
    if (index >= items.length) setIndex(0)
  }, [index, items.length])

  if (!current) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-lg bg-slate-900 text-sm text-slate-400">
        推荐内容正在准备中
      </div>
    )
  }

  const cover = resolveCourseCover(current.thumbnail, current.title)
  const go = (direction: -1 | 1) => {
    setIndex((value) => (value + direction + items.length) % items.length)
  }

  return (
    <section
      className={cn(
        'group relative overflow-hidden rounded-lg bg-slate-950 shadow-sm',
        compact ? 'h-[300px] sm:h-[340px]' : 'h-[340px] sm:h-[420px] lg:h-full lg:min-h-[460px]',
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="精选推荐"
    >
      {cover.url ? (
        <img
          src={cover.url}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-700"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 18% 18%, rgba(255,255,255,0.2), transparent 34%), radial-gradient(circle at 84% 76%, rgba(15,23,42,0.3), transparent 44%), linear-gradient(135deg, hsl(${cover.fallbackHue} 65% 42%), hsl(${
              (cover.fallbackHue + 45) % 360
            } 72% 24%))`,
          }}
        >
          <span className="pointer-events-none absolute right-6 top-5 text-[52px] font-black tracking-[0.12em] text-white/10 sm:text-[72px]">
            COURSE
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/95 via-slate-950/55 to-slate-950/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            精选推荐
          </span>
          <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
            {kindLabel(current.kind)}
          </span>
          {!current.isFree ? (
            <span className="rounded bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
              付费
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onOpen(current.id)}
          className="mt-3 block max-w-2xl text-left"
        >
          <h2 className="line-clamp-2 max-w-[620px] text-balance text-[24px] font-bold leading-tight tracking-tight text-white sm:text-[28px] lg:text-[31px]">
            {current.title}
          </h2>
          <p className="mt-2 line-clamp-2 max-w-xl text-[13px] leading-relaxed text-slate-200/90 sm:text-sm">
            {current.summary ?? current.description}
          </p>
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300/90 sm:text-xs">
          <span>{current.author ?? '平台讲师'}</span>
          <span>{current.lessonsCount} 课时</span>
          <span>{formatDuration(current.durationSeconds)}</span>
          <span>{formatCompactCount(current.studentsCount)} 人在学</span>
          {Number.parseFloat(current.ratingScore) > 0 ? (
            <span className="text-amber-300">★ {current.ratingScore}</span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onOpen(current.id)}
            className="course-primary inline-flex h-9 items-center rounded px-4 text-xs font-semibold transition hover:brightness-[0.98] sm:text-sm"
          >
            立即学习
          </button>
          <button
            type="button"
            onClick={() => (onDetails ?? onOpen)(current.id)}
            className="inline-flex h-9 items-center rounded border border-white/25 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 sm:text-sm"
          >
            查看详情
          </button>
        </div>
      </div>

      {items.length > 1 ? (
        <>
          <div className="absolute bottom-5 right-5 hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              aria-label="上一张"
              onClick={() => go(-1)}
              className="flex h-8 w-8 items-center justify-center rounded bg-slate-950/40 text-lg text-white/80 backdrop-blur-sm transition hover:bg-slate-950/70 hover:text-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="下一张"
              onClick={() => go(1)}
              className="flex h-8 w-8 items-center justify-center rounded bg-slate-950/40 text-lg text-white/80 backdrop-blur-sm transition hover:bg-slate-950/70 hover:text-white"
            >
              ›
            </button>
          </div>
          <div className="absolute bottom-7 right-24 hidden items-center gap-1.5 sm:flex">
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={`切换到 ${item.title}`}
                onClick={() => setIndex(itemIndex)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  itemIndex === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
