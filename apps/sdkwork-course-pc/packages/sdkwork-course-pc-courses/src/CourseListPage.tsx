import React, { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import {
  Button,
  DiscoverCourseCard,
  CourseGridSkeleton,
  EmptyState,
  Notice,
  SelectField,
  formatRelativeTime,
} from '@sdkwork/sdkwork-course-pc-commons'
import { mapCourse, readPageItems, readPageTotal } from './courseModel'

const KIND_OPTIONS = [
  { value: '', label: '全部课程' },
  { value: 'standard', label: '体系课程' },
  { value: 'column', label: '专栏' },
  { value: 'collection', label: '合集' },
]

const LEVEL_OPTIONS = [
  { value: '', label: '全部难度' },
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高级' },
  { value: 'all', label: '不限' },
]

const PAGE_SIZE = 12

const KIND_TITLES: Record<string, string> = {
  '': '课程中心',
  standard: '体系课程',
  column: '专栏',
  collection: '合集',
}

export interface CourseListPageProps {
  /** Render inside a host surface (SDKWork plugin, IM) instead of the standalone shell. */
  embedded?: boolean
}

export function CourseListPage({ embedded = false }: CourseListPageProps) {
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const [searchParams, setSearchParams] = useSearchParams()

  const kind = searchParams.get('kind') ?? ''
  const category = searchParams.get('category') ?? ''
  const level = searchParams.get('level') ?? ''
  const q = searchParams.get('q') ?? ''

  const updateParam = (key: string, nextValue: string) => {
    const next = new URLSearchParams(searchParams)
    if (nextValue) next.set(key, nextValue)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const coursesQuery = useInfiniteQuery({
    queryKey: ['courses', kind, category, level, q],
    queryFn: ({ pageParam }) =>
      sdk.courses.list({
        kind: kind || undefined,
        category: category || undefined,
        level: level || undefined,
        q: q || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + readPageItems(page).length, 0)
      const total = readPageTotal(lastPage)
      if (total > 0) return loaded < total ? allPages.length + 1 : undefined
      return readPageItems(lastPage).length >= PAGE_SIZE ? allPages.length + 1 : undefined
    },
    placeholderData: (previous) => previous,
  })

  const categoryQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => sdk.courseCategories.list({ pageSize: 50 }),
    staleTime: 5 * 60 * 1000,
  })

  const courses = coursesQuery.data?.pages.flatMap((page) => readPageItems(page).map(mapCourse)) ?? []
  const total = coursesQuery.data ? readPageTotal(coursesQuery.data.pages[0]) : 0
  const categories = readPageItems(categoryQuery.data)
    .map((value) => {
      const record = value as Record<string, unknown>
      return { id: String(record.id ?? ''), name: String(record.name ?? '未命名分类') }
    })
    .filter((item) => item.id)

  const hasActiveFilter = Boolean(kind || category || level || q)
  const title = KIND_TITLES[kind] ?? '课程中心'

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = coursesQuery
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // IntersectionObserver reattaches whenever the loaded pages change so a
  // sentinel still in view keeps triggering loads. isFetching guards against
  // appending onto placeholderData while a new filter's first page loads;
  // jsdom and engines without the API degrade to first-page-only rendering.
  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasNextPage || isFetching || isFetchingNextPage) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage()
      },
      // Start loading before the user visibly reaches the bottom edge.
      { rootMargin: '480px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, coursesQuery.data])

  return (
    <div className="space-y-4 pb-8">
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <button type="button" onClick={() => navigate('/')} className="hover:text-slate-700">
          首页
        </button>
        <span>/</span>
        <span className="text-slate-600">{title}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            找到适合你的学习路径，按章节学习并记录进度。
          </p>
        </div>
        {total > 0 ? <span className="text-xs text-slate-400">共 {total} 个内容</span> : null}
      </div>

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {['', 'standard', 'column', 'collection'].map((value) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => updateParam('kind', value)}
              className={
                kind === value
                  ? 'h-9 border-b-2 border-indigo-600 px-3 text-[13px] font-semibold text-indigo-600'
                  : 'h-9 border-b-2 border-transparent px-3 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900'
              }
            >
              {KIND_OPTIONS.find((option) => option.value === value)?.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_150px] lg:w-[600px]">
          <label className="relative block">
            <span className="sr-only">搜索课程</span>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="搜索课程、专栏或合集"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
            />
          </label>
          <SelectField
            aria-label="按分类筛选"
            value={category}
            onChange={(event) => updateParam('category', event.target.value)}
            className="h-9 rounded-lg text-[13px]"
            options={[
              { value: '', label: '全部分类' },
              ...categories.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <SelectField
            aria-label="按难度筛选"
            value={level}
            onChange={(event) => updateParam('level', event.target.value)}
            className="h-9 rounded-lg text-[13px]"
            options={LEVEL_OPTIONS}
          />
        </div>
      </section>

      {hasActiveFilter ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>当前筛选：</span>
          {kind ? <FilterChip label={KIND_OPTIONS.find((item) => item.value === kind)?.label ?? kind} onClear={() => updateParam('kind', '')} /> : null}
          {category ? <FilterChip label={categories.find((item) => item.id === category)?.name ?? category} onClear={() => updateParam('category', '')} /> : null}
          {level ? <FilterChip label={LEVEL_OPTIONS.find((item) => item.value === level)?.label ?? level} onClear={() => updateParam('level', '')} /> : null}
          {q ? <FilterChip label={`关键词：${q}`} onClear={() => updateParam('q', '')} /> : null}
          <button
            type="button"
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            清除全部
          </button>
        </div>
      ) : null}

      {coursesQuery.error && courses.length === 0 ? (
        <Notice tone="error" title="课程列表加载失败">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>请稍后再试，或检查网络连接。</span>
            <Button size="sm" onClick={() => void coursesQuery.refetch()}>
              重试
            </Button>
          </div>
        </Notice>
      ) : coursesQuery.isLoading ? (
        <CourseGridSkeleton count={8} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="没有找到匹配的内容"
          description={hasActiveFilter ? '试试调整筛选条件，或清除全部筛选。' : '课程正在准备中，请稍后再来。'}
        />
      ) : (
        <>
          <div
            className={embedded ? 'grid gap-4' : 'grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5'}
            style={
              embedded
                ? { gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }
                : undefined
            }
          >
            {courses.map((course) => (
              <DiscoverCourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                cover={course.thumbnail}
                kind={course.kind}
                lessonsCount={course.lessonsCount}
                studentsCount={course.studentsCount}
                durationSeconds={course.durationSeconds}
                author={course.author}
                dateText={
                  course.publishedAt || course.updatedAt
                    ? formatRelativeTime(course.publishedAt ?? course.updatedAt)
                    : undefined
                }
                priceAmount={course.priceAmount}
                isFree={course.isFree}
                currency={course.currency}
                onClick={(id) =>
                  navigate(
                    course.kind === 'collection' ? `/courses/${id}` : `/courses/${id}/play`,
                  )
                }
              />
            ))}
          </div>
          <div
            ref={loadMoreRef}
            className="flex min-h-12 items-center justify-center pt-2 text-[12px] text-slate-400"
            aria-live="polite"
          >
            {isFetchingNextPage ? (
              <span className="flex items-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500"
                  aria-hidden="true"
                />
                正在加载更多课程…
              </span>
            ) : coursesQuery.error && hasNextPage ? (
              <button
                type="button"
                onClick={() => void coursesQuery.fetchNextPage()}
                className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-5 text-[12px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                加载失败，点击重试
              </button>
            ) : !hasNextPage ? (
              <span>已加载全部课程</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
      {label}
      <button type="button" onClick={onClear} aria-label={`移除筛选 ${label}`} className="text-slate-400 hover:text-slate-700">
        ×
      </button>
    </span>
  )
}
