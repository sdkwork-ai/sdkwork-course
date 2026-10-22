import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  CourseCard,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  ProgressBar,
  formatDate,
} from '@sdkwork/sdkwork-course-pc-commons'
import {
  extractSdkListItems,
  getCommentsClient,
  readEntityString,
  useCourseSdk,
} from '@sdkwork/sdkwork-course-pc-core'
import { mapCourse, readPageItems } from '@sdkwork/sdkwork-course-pc-courses'

type LearningTab = 'history' | 'favorites' | 'visits'

export function MyLearningPage() {
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const [tab, setTab] = useState<LearningTab>('history')

  const enrollmentsQuery = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => sdk.courseEnrollments.current.list(),
  })
  const coursesQuery = useQuery({
    queryKey: ['my-learning-courses'],
    queryFn: () => sdk.courses.list({ pageSize: 100 }),
  })
  const favoritesQuery = useQuery({
    queryKey: ['my-favorite-courses'],
    enabled: tab === 'favorites' && Boolean(coursesQuery.data),
    queryFn: async () => {
      const page = await getCommentsClient().engagement.favorites.list({ pageSize: 100 })
      const favoriteIds = new Set(
        (page.items ?? [])
          .filter((item) => item.targetKind === 'course-lesson')
          .map((item) => item.targetId),
      )
      return readPageItems(coursesQuery.data)
        .map(mapCourse)
        .filter((course) => favoriteIds.has(course.id))
    },
  })
  const visitsQuery = useQuery({
    queryKey: ['my-visits'],
    enabled: tab === 'visits' && Boolean(coursesQuery.data),
    queryFn: async () => {
      const page = await getCommentsClient().engagement.visits.list({ pageSize: 100 })
      const ids = Array.from(
        new Set(
          (page.items ?? [])
            .filter((item) => item.targetKind === 'course-lesson')
            .map((item) => item.targetId),
        ),
      )
      const byId = new Map(readPageItems(coursesQuery.data).map(mapCourse).map((course) => [course.id, course]))
      return ids.map((id) => byId.get(id)).filter((course): course is NonNullable<typeof course> => Boolean(course))
    },
  })

  const coursesById = useMemo(
    () => new Map(readPageItems(coursesQuery.data).map(mapCourse).map((course) => [course.id, course])),
    [coursesQuery.data],
  )
  const enrollments = extractSdkListItems(enrollmentsQuery.data)
    .map((record) => ({
      id: readEntityString(record, 'id', 'enrollmentId'),
      courseId: readEntityString(record, 'courseId', 'course_id'),
      status: readEntityString(record, 'enrollmentStatus', 'status', 'enrollment_status') || 'active',
      enrolledAt: readEntityString(record, 'enrolledAt', 'enrolled_at') || '',
      completedAt: readEntityString(record, 'completedAt', 'completed_at') || undefined,
    }))
    .filter((item) => item.id)
    .sort((left, right) => right.enrolledAt.localeCompare(left.enrolledAt))

  if (enrollmentsQuery.isLoading) {
    return <LoadingSpinner text="加载我的学习..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的学习"
        subtitle="最近学习、收藏课程与学习进度"
        actions={
          <Link to="/courses" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            浏览更多课程 →
          </Link>
        }
      />

      <div className="flex gap-2 border-b border-slate-100">
        {([
          ['history', '最近学习'],
          ['favorites', '我的收藏'],
          ['visits', '浏览记录'],
        ] as Array<[LearningTab, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === value
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'favorites' ? (
        favoritesQuery.isLoading ? (
          <LoadingSpinner text="正在加载收藏..." />
        ) : (favoritesQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon="☆"
            title="还没有收藏课程"
            description="在课程播放页点击收藏，就会出现在这里。"
            action={<Button onClick={() => navigate('/courses')}>去发现课程</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(favoritesQuery.data ?? []).map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.summary ?? course.description}
                thumbnail={course.thumbnail}
                instructor={course.author}
                lessonsCount={course.lessonsCount}
                studentsCount={course.studentsCount}
                rating={course.ratingScore}
                kind={course.kind}
                priceAmount={course.priceAmount}
                isFree={course.isFree}
                currency={course.currency}
                onClick={(id) => navigate(`/courses/${id}?view=overview`)}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === 'visits' ? (
        visitsQuery.isLoading ? (
          <LoadingSpinner text="正在加载浏览记录..." />
        ) : (visitsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon="🕘"
            title="还没有浏览记录"
            description="打开任意课程后，这里会记录最近浏览。"
            action={<Button onClick={() => navigate('/courses')}>去浏览课程</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(visitsQuery.data ?? []).map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.summary ?? course.description}
                thumbnail={course.thumbnail}
                instructor={course.author}
                lessonsCount={course.lessonsCount}
                studentsCount={course.studentsCount}
                rating={course.ratingScore}
                kind={course.kind}
                priceAmount={course.priceAmount}
                isFree={course.isFree}
                currency={course.currency}
                onClick={(id) => navigate(`/courses/${id}?view=overview`)}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === 'history' ? (
        enrollmentsQuery.error ? (
          <EmptyState icon="!" title="加载失败" description="无法加载你的学习记录" />
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon="📚"
            title="还没有学习记录"
            description="去课程中心探索精品课程，开始你的第一门课。"
            action={<Button onClick={() => navigate('/courses')}>去选课</Button>}
          />
        ) : (
          <div className="grid gap-4">
            {enrollments.map((enrollment) => {
              const course = coursesById.get(enrollment.courseId)
              return (
                <div
                  key={enrollment.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/courses/${enrollment.courseId}/play`)}
                    className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 text-lg font-bold text-white sm:w-48"
                  >
                    {(course?.title ?? '课程').slice(0, 6)}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={enrollment.status === 'completed' ? 'success' : 'info'} dot>
                        {enrollment.status === 'completed' ? '已完成' : '学习中'}
                      </Badge>
                      {course ? (
                        <Badge tone="neutral">
                          {course.kind === 'collection' ? '合集' : course.kind === 'column' ? '专栏' : '课程'}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="mt-2 line-clamp-1 text-base font-bold text-slate-900">
                      {course?.title ?? `课程 ${enrollment.courseId}`}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      最近学习 {enrollment.enrolledAt ? formatDate(enrollment.enrolledAt) : '--'}
                      {enrollment.completedAt ? ` · 完成于 ${formatDate(enrollment.completedAt)}` : ''}
                    </p>
                    <div className="mt-3 max-w-xs">
                      <ProgressBar value={enrollment.status === 'completed' ? 100 : 0} />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <Button size="sm" onClick={() => navigate(`/courses/${enrollment.courseId}/play`)}>
                      继续学习
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/courses/${enrollment.courseId}?tab=curriculum&view=overview`)}
                    >
                      查看目录
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : null}
    </div>
  )
}
