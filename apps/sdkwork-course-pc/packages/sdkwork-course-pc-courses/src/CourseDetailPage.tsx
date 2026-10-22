import React, { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  enrollInFirstCourseOffering,
  useCourseSdk,
} from '@sdkwork/sdkwork-course-pc-core'
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Notice,
  ProgressBar,
  cn,
  formatCount,
  formatDate,
  formatDuration,
  formatPrice,
  kindLabel,
  parseTags,
  resolveCourseCover,
  reviewTone,
  statusLabel,
} from '@sdkwork/sdkwork-course-pc-commons'
import { CourseDiscussionPanel } from './CourseDiscussionPanel'
import { CoursePurchasePanel } from './CoursePurchasePanel'
import {
  buildCurriculumTree,
  mapCollectionItem,
  mapCourse,
  mapCurriculum,
  readPageItems,
} from './courseModel'

type DetailTab = 'overview' | 'curriculum' | 'discussion'

const LEVEL_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}

export interface CourseDetailPageProps {
  /** Render inside a host surface (SDKWork plugin, IM) instead of the standalone shell. */
  embedded?: boolean
}

export function CourseDetailPage({ embedded = false }: CourseDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sdk = useCourseSdk()
  const [tab, setTab] = useState<DetailTab>(
    searchParams.get('tab') === 'curriculum' ? 'curriculum' : 'overview',
  )
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  )

  const courseQuery = useQuery({
    queryKey: ['course', id],
    queryFn: () => sdk.courses.retrieve(id!),
    enabled: Boolean(id),
  })
  const curriculumQuery = useQuery({
    queryKey: ['course-curriculum', id],
    queryFn: () => sdk.courseCurriculum.retrieve(id!),
    enabled: Boolean(id),
  })
  const course = courseQuery.data ? mapCourse(courseQuery.data) : null
  const curriculum = curriculumQuery.data ? mapCurriculum(curriculumQuery.data) : null

  const collectionQuery = useQuery({
    queryKey: ['course-items', id],
    queryFn: () => sdk.courseCollectionItems.list(id!, { pageSize: 50 }),
    enabled: Boolean(id) && course?.kind === 'collection',
  })
  const collectionItems = readPageItems(collectionQuery.data).map(mapCollectionItem)
  const enrollmentsQuery = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => sdk.courseEnrollments.current.list(),
    retry: false,
  })
  const enrollment = readPageItems(enrollmentsQuery.data)
    .map((value) => value as Record<string, unknown>)
    .find((item) => String(item.courseId ?? item.course_id ?? '') === id)
  const canWatch = Boolean(course?.isFree || enrollment)
  const overviewRequested = searchParams.get('view') === 'overview'

  useEffect(() => {
    if (!id || !course || overviewRequested) return
    if (course.kind === 'collection') {
      if (collectionQuery.isLoading) return
      const selectedItemId = searchParams.get('item')
      const firstItem =
        collectionItems.find((item) => item.courseId === selectedItemId) ?? collectionItems[0]
      if (firstItem) {
        navigate(`/courses/${firstItem.courseId}/play?collection=${id}`, { replace: true })
      }
      return
    }
    if (!canWatch || enrollmentsQuery.isLoading) return
    navigate(`/courses/${id}/play`, { replace: true })
  }, [
    id,
    course,
    overviewRequested,
    canWatch,
    enrollmentsQuery.isLoading,
    collectionQuery.isLoading,
    collectionItems,
    searchParams,
    navigate,
  ])

  const sections = useMemo(
    () => (curriculum ? buildCurriculumTree(curriculum) : []),
    [curriculum],
  )
  const cover = course ? resolveCourseCover(course.thumbnail, course.title) : null
  const tags = course ? parseTags(course.tags) : []
  const totalDuration =
    course?.durationSeconds && course.durationSeconds > 0
      ? course.durationSeconds
      : sections.reduce((sum, group) => sum + group.section.durationSeconds, 0)

  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: current[sectionId] === false,
    }))
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setFeedback({ tone: 'success', message: '链接已复制' })
    } catch {
      setFeedback({ tone: 'error', message: '复制失败，请从地址栏复制链接' })
    }
  }

  const startLearning = () => {
    setFeedback(null)
    if (course?.kind === 'collection') {
      if (collectionItems[0]) {
        navigate(`/courses/${collectionItems[0].courseId}/play?collection=${id}`)
      } else {
        setTab('curriculum')
      }
      return
    }
    if (course && canWatch) {
      navigate(`/courses/${course.id}/play`)
      return
    }
    setFeedback({
      tone: 'info',
      message: '该课程为付费内容，在线购买即将开放。已购买或获得学习权益的用户可直接联系运营开通。',
    })
  }

  if (courseQuery.isLoading) {
    return <LoadingSpinner text="正在加载课程详情..." />
  }

  if (courseQuery.error || !course) {
    return (
      <EmptyState
        icon="!"
        title="课程不存在或已下架"
        description="请检查链接是否正确，或返回课程中心浏览其他内容。"
      />
    )
  }

  if (course.kind === 'collection' && !overviewRequested && collectionItems.length > 0) {
    const selectedItemId = searchParams.get('item')
    const target =
      collectionItems.find((item) => item.courseId === selectedItemId) ?? collectionItems[0]
    return <Navigate to={`/courses/${target.courseId}/play?collection=${course.id}`} replace />
  }

  return (
    <div className="w-full space-y-4 pb-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
        <Link to="/" className="hover:text-slate-700">
          首页
        </Link>
        <span>/</span>
        <Link to={`/courses?kind=${course.kind}`} className="hover:text-slate-700">
          {kindLabel(course.kind)}
        </Link>
        <span>/</span>
        <span className="max-w-[220px] truncate text-slate-600">{course.title}</span>
      </nav>

      {feedback ? (
        <Notice tone={feedback.tone} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Notice>
      ) : null}

      <section className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={course.kind === 'collection' ? 'violet' : course.kind === 'column' ? 'info' : 'neutral'}>
              {kindLabel(course.kind)}
            </Badge>
            <Badge tone={reviewTone(course.publishStatus)} dot>
              {statusLabel(course.publishStatus)}
            </Badge>
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
            {course.title}
          </h1>
          <p className="mt-1 line-clamp-2 max-w-5xl text-sm leading-relaxed text-slate-600">
            {course.summary ?? course.description ?? course.subtitle ?? '暂无课程简介'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>{course.author ?? '平台讲师'}</span>
            <span>{course.lessonsCount} 课时</span>
            <span>{formatDuration(totalDuration)}</span>
            <span>{formatCount(course.studentsCount)} 人在学</span>
            {Number.parseFloat(course.ratingScore) > 0 ? (
              <span className="font-semibold text-amber-600">★ {course.ratingScore}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button onClick={startLearning}>
            {canWatch ? '进入课堂' : course.isFree ? '免费学习' : '获取学习权益'}
          </Button>
          <Button variant="outline" onClick={() => setTab('curriculum')}>
            查看目录
          </Button>
          <Button variant="ghost" onClick={() => void copyLink()}>
            分享
          </Button>
        </div>
      </section>

      <div className={embedded ? 'grid gap-6' : 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]'}>
        <div className="min-w-0 space-y-4">
          <section className="relative overflow-hidden rounded-2xl bg-slate-900">
            <div className="relative h-[clamp(320px,55vh,620px)] w-full">
              {cover?.url ? (
                <img src={cover.url} alt={course.title} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `linear-gradient(135deg, hsl(${cover?.fallbackHue ?? 240} 60% 42%), hsl(${
                      ((cover?.fallbackHue ?? 240) + 35) % 360
                    } 65% 28%))`,
                  }}
                />
              )}
              <div className="absolute inset-0 bg-slate-950/60" />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                {canWatch ? (
                  <>
                    <button
                      type="button"
                      onClick={startLearning}
                      className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/15 transition hover:bg-white/25"
                      aria-label="进入课堂"
                    >
                      <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    <p className="mt-3 text-sm font-semibold">进入课堂</p>
                    <p className="mt-1 text-xs text-slate-200">
                      {course.kind === 'collection'
                        ? `${collectionItems.length} 门课程 · 按路径学习`
                        : `从第 1 课开始 · 共 ${course.lessonsCount} 课时`}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/10">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
                        <rect x="5" y="10" width="14" height="10" rx="2" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                    </span>
                    <h2 className="mt-3 text-xl font-bold">购买后解锁全部课时</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-200">
                      付费内容由平台统一管理学习权益，开通后可直接观看全部课时并记录学习进度。
                    </p>
                  </>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-2 bg-slate-950/65 px-4 py-3 text-xs text-white">
                <span>
                  {course.kind === 'collection'
                    ? `合集 · ${collectionItems.length} 门课程`
                    : `${sections.length} 个章节 · ${course.lessonsCount} 课时`}
                </span>
                <span>
                  {course.publishedAt ? `上线 ${formatDate(course.publishedAt)}` : '持续更新'}
                </span>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
            {(
              [
                ['overview', '课程介绍'],
                ['curriculum', `课程目录 · ${course.lessonsCount}`],
                ['discussion', '学习讨论'],
              ] as Array<[DetailTab, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition',
                  tab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <section className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
              <div>
                <h2 className="text-lg font-bold text-slate-900">你将学到什么</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {course.description ?? course.summary ?? '课程介绍整理中。'}
                </p>
              </div>
              {tags.length > 0 ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">适合人群与关键词</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {course.kind === 'collection' ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">合集包含</h3>
                  <CollectionList items={collectionItems} collectionId={id} />
                </div>
              ) : null}
            </section>
          ) : tab === 'curriculum' ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">课程目录</h2>
                <p className="text-xs text-slate-500">
                  {sections.length} 个章节 · {course.lessonsCount} 课时
                </p>
              </div>
              {curriculumQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">正在加载目录...</div>
              ) : sections.length === 0 && collectionItems.length === 0 ? (
                <EmptyState icon="📖" title="目录整理中" description="课程内容正在准备，请稍后再来。" />
              ) : (
                <div className="space-y-3">
                  {course.kind === 'collection' ? <CollectionList items={collectionItems} collectionId={id} /> : null}
                  {sections.map((group) => {
                    const expanded = expandedSections[group.section.id] !== false
                    return (
                      <div key={group.section.id} className="overflow-hidden rounded-xl border border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleSection(group.section.id)}
                          className="flex w-full items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100"
                          aria-expanded={expanded}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-900">
                              {group.section.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {group.lessons.length} 课时
                              {group.section.durationSeconds > 0
                                ? ` · ${formatDuration(group.section.durationSeconds)}`
                                : ''}
                            </span>
                          </span>
                          <span className={cn('text-slate-400 transition-transform', expanded && 'rotate-180')}>
                            ▾
                          </span>
                        </button>
                        {expanded ? (
                          <ul className="divide-y divide-slate-100">
                            {group.lessons.map((lesson, index) => (
                              <li key={lesson.id}>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/courses/${course.id}/learn/${lesson.id}`)}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-indigo-50/50"
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                                    {index + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-slate-800">
                                      {lesson.title}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                      <span>{lesson.kind === 'article' ? '图文' : lesson.kind === 'live_session' ? '直播' : '视频'}</span>
                                      {lesson.durationSeconds > 0 ? <span>{formatDuration(lesson.durationSeconds)}</span> : null}
                                      {lesson.freePreview ? (
                                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-600">
                                          可试看
                                        </span>
                                      ) : null}
                                    </span>
                                  </span>
                                  <span className="text-xs font-semibold text-indigo-600">学习 →</span>
                                </button>
                              </li>
                            ))}
                            {group.lessons.length === 0 ? (
                              <li className="px-4 py-4 text-xs text-slate-500">章节内容整理中</li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          ) : (
            <CourseDiscussionPanel courseId={course.id} targetType="course" targetId={course.id} />
          )}
        </div>

        <aside className={cn('space-y-4', !embedded && 'lg:sticky lg:top-24 lg:self-start')}>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">课程价格</p>
                <p className={cn('mt-1 text-3xl font-bold', course.isFree ? 'text-emerald-600' : 'text-rose-600')}>
                  {formatPrice(course.priceAmount, course.isFree, course.currency)}
                </p>
                {!course.isFree && course.originalPriceAmount ? (
                  <p className="mt-1 text-xs text-slate-400 line-through">
                    {formatPrice(course.originalPriceAmount, false, course.currency)}
                  </p>
                ) : null}
              </div>
              <Badge tone={course.isFree ? 'success' : 'warning'}>
                {course.isFree ? '免费学习' : '付费课程'}
              </Badge>
            </div>
            <Button
              fullWidth
              size="lg"
              className="mt-5"
              onClick={() => {
                setFeedback(null)
                if (course.kind === 'collection') {
                  if (collectionItems[0]) {
                    navigate(`/courses/${collectionItems[0].courseId}/play?collection=${id}`)
                  } else {
                    setTab('curriculum')
                  }
                  return
                }
                if (canWatch) {
                  navigate(`/courses/${course.id}/play`)
                  return
                }
                setPurchaseOpen(true)
              }}
            >
              {canWatch ? '立即观看' : '购买课程'}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
              {course.isFree
                ? '可直接观看全部章节；报名后记录学习进度'
                : '订单与支付由 SDKWork 订单中心统一处理'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">课程目录</h3>
              <button
                type="button"
                onClick={() => setTab('curriculum')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                全部
              </button>
            </div>
            {course.kind === 'collection' ? (
              <ol className="mt-3 space-y-2">
                {collectionItems.slice(0, 3).map((item) => (
                  <li key={item.courseId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/courses/${item.courseId}/play?collection=${id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-50"
                    >
                      <span className="truncate text-slate-700">{item.title}</span>
                      <span className="shrink-0 text-slate-400">{item.lessonsCount} 课时</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : sections.length > 0 ? (
              <div className="mt-3 space-y-2">
                {sections
                  .slice(0, 2)
                  .flatMap((group) => group.lessons.slice(0, 4))
                  .map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => navigate(`/courses/${course.id}/learn/${lesson.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-50"
                    >
                      <span className="truncate text-slate-700">{lesson.title}</span>
                      {lesson.durationSeconds > 0 ? (
                        <span className="shrink-0 text-slate-400">{formatDuration(lesson.durationSeconds)}</span>
                      ) : null}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">目录整理中</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">课程信息</h3>
            <dl className="mt-3 space-y-3 text-sm">
              {[
                ['内容类型', kindLabel(course.kind)],
                ['章节数', `${sections.length} 个`],
                ['课时数', `${course.lessonsCount} 个`],
                ['总时长', formatDuration(totalDuration)],
                ['难度', course.level ? LEVEL_LABELS[course.level] ?? course.level : '不限'],
                ['最近更新', course.publishedAt ? formatDate(course.publishedAt) : '持续更新'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
            <h3 className="text-sm font-bold text-amber-900">学习保障</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-800">
              <li>· 支持随时回看，进度自动保存</li>
              <li>· 内容经平台审核，发现违规可举报</li>
              <li>· 付费课程通过 SDKWork 订单中心完成支付</li>
            </ul>
          </div>
        </aside>
      </div>

      <CoursePurchasePanel
        open={purchaseOpen}
        courseId={course.id}
        priceAmount={course.priceAmount}
        onClose={() => setPurchaseOpen(false)}
        onPurchased={() => {
          void enrollInFirstCourseOffering(sdk, course.id, 'commerce')
            .then(() => {
              setFeedback({ tone: 'success', message: '支付成功，学习权益已开通。' })
              setPurchaseOpen(false)
              navigate(`/courses/${course.id}/play`)
            })
            .catch((reason) =>
              setFeedback({
                tone: 'error',
                message: reason instanceof Error ? reason.message : '权益开通失败，请联系运营',
              }),
            )
        }}
      />
    </div>
  )
}

function CollectionList({
  items,
  collectionId,
}: {
  items: ReturnType<typeof mapCollectionItem>[]
  collectionId?: string
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">合集内容整理中。</p>
  }
  return (
    <ol className="mt-3 space-y-3">
      {items.map((item, index) => (
        <li key={item.courseId}>
          <Link
            to={
              collectionId
                ? `/courses/${item.courseId}/play?collection=${collectionId}`
                : `/courses/${item.courseId}/play`
            }
            className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/30"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {index + 1}
            </span>
            <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
              {item.cover ? (
                <img src={item.cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                  {index + 1}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {item.authorDisplayName ?? '平台讲师'} · {item.lessonsCount} 课时 ·{' '}
                {formatDuration(item.durationSeconds)}
              </span>
            </span>
            <span className="text-xs font-semibold text-indigo-600">进入 →</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
