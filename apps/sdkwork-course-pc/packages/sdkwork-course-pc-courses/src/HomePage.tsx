import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import {
  DiscoverCourseCard,
  EmptyState,
  Notice,
  cn,
  formatRelativeTime,
} from '@sdkwork/sdkwork-course-pc-commons'
import { CategoryPanel } from './CategoryPanel'
import { HeroCarousel } from './HeroCarousel'
import { mapCourse, readPageItems } from './courseModel'

export interface HomePageProps {
  /** Render inside a host surface (SDKWork plugin, IM) instead of the standalone shell. */
  embedded?: boolean
}

export function HomePage({ embedded = false }: HomePageProps) {
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const [rotation, setRotation] = useState(0)

  const coursesQuery = useQuery({
    queryKey: ['home-courses'],
    queryFn: () => sdk.courses.list({ pageSize: 30 }),
  })
  const categoryQuery = useQuery({
    queryKey: ['home-categories'],
    queryFn: () => sdk.courseCategories.list({ pageSize: 30 }),
    staleTime: 5 * 60 * 1000,
  })

  const allCourses = useMemo(
    () => readPageItems(coursesQuery.data).map(mapCourse),
    [coursesQuery.data],
  )
  const rotated = useMemo(() => {
    if (allCourses.length <= 1) return allCourses
    const offset = rotation % allCourses.length
    return [...allCourses.slice(offset), ...allCourses.slice(0, offset)]
  }, [allCourses, rotation])

  const featured = rotated.slice(0, 6)
  const topRow = rotated.slice(1, 7)
  const feed = rotated.length > 7 ? rotated.slice(7, 27) : rotated

  const categories = readPageItems(categoryQuery.data)
    .map((value) => {
      const record = value as Record<string, unknown>
      return { id: String(record.id ?? ''), name: String(record.name ?? '未命名分类') }
    })
    .filter((category) => category.id)

  const shuffle = () => setRotation((value) => value + 1)
  const open = (id: string) => {
    const target = allCourses.find((course) => course.id === id)
    navigate(target?.kind === 'collection' ? `/courses/${id}` : `/courses/${id}/play`)
  }

  const renderCard = (course: ReturnType<typeof mapCourse>) => (
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
      onClick={open}
    />
  )

  return (
    <div className="space-y-4 pb-10">
      {coursesQuery.error ? (
        <Notice tone="error" title="课程中心加载失败">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>请检查网络或稍后再试。</span>
            <button
              type="button"
              onClick={() => void coursesQuery.refetch()}
              className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              重新加载
            </button>
          </div>
        </Notice>
      ) : null}

      <CategoryPanel categories={categories} compact={embedded} />

      {coursesQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="h-[420px] animate-pulse rounded-lg bg-slate-200 lg:col-span-2" />
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <div className="aspect-video animate-pulse rounded-lg bg-slate-200" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : allCourses.length === 0 ? (
        <EmptyState
          icon="📚"
          title="课程正在准备中"
          description="运营同学可以在管理后台创建并发布第一门课程，创作者也可以在创作中心上传内容。"
        />
      ) : (
        <>
          <div className="relative">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
              <div className="h-full sm:col-span-2 lg:col-span-2 lg:row-span-2">
                <HeroCarousel
                  courses={featured}
                  onOpen={open}
                  onDetails={(id) => navigate(`/courses/${id}?view=overview`)}
                />
              </div>
              {topRow.map(renderCard)}
              {topRow.length < 6 ? (
                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className={cn(
                    'group flex h-full min-h-[180px] flex-col items-start justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white p-5 text-left transition hover:border-indigo-300 hover:bg-slate-50',
                    topRow.length === 5 ? 'lg:col-span-1' : 'sm:col-span-2 lg:col-span-2',
                  )}
                >
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                    课程库
                  </span>
                  <span className="text-lg font-bold tracking-tight text-slate-900">
                    查看更多课程
                  </span>
                  <span className="max-w-xs text-xs leading-relaxed text-slate-500">
                    浏览全部体系课程、专栏与合集，按分类和难度找到下一条学习路径。
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                    进入课程中心 <span className="transition group-hover:translate-x-0.5">→</span>
                  </span>
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={shuffle}
              title="换一换"
              className="absolute top-24 hidden w-9 flex-col items-center gap-1 rounded-md border border-slate-200 bg-white py-3 text-[11px] font-medium leading-4 text-slate-500 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 min-[1680px]:flex"
              style={{ right: -48 }}
            >
              <svg viewBox="0 0 24 24" className="mb-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>换</span>
              <span>一</span>
              <span>换</span>
            </button>
          </div>

          {feed.length > 0 ? (
            <section className="pt-2">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="flex items-end gap-4">
                  <h2 className="text-[17px] font-bold tracking-tight text-slate-900">为你推荐</h2>
                  <div className="hidden items-center gap-3 text-[12px] text-slate-400 sm:flex">
                    <span className="font-semibold text-indigo-600">推荐</span>
                    <Link to="/courses?kind=standard" className="hover:text-slate-700">
                      体系课程
                    </Link>
                    <Link to="/courses?kind=column" className="hover:text-slate-700">
                      专栏
                    </Link>
                    <Link to="/courses?kind=collection" className="hover:text-slate-700">
                      合集
                    </Link>
                  </div>
                </div>
                <Link to="/courses" className="text-[12px] font-medium text-slate-400 hover:text-indigo-600">
                  查看更多 ›
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {feed.map(renderCard)}
              </div>
            </section>
          ) : null}

          {feed.length > 0 ? (
            <div className="flex justify-center pt-2">
              <Link
                to="/courses"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-[12px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                查看更多课程
                <span className="text-slate-400">›</span>
              </Link>
            </div>
          ) : null}

          <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col items-start justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">把你的经验，变成一门课</h2>
                <p className="mt-1 text-[12px] text-slate-500">
                  上传封面与课时，编排章节或合集，提交平台审核后发布。
                </p>
              </div>
              <Link
                to="/studio?create=1"
                className="course-primary inline-flex h-9 shrink-0 items-center rounded px-4 text-[12px] font-semibold transition hover:brightness-[0.98]"
              >
                上传课程
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
