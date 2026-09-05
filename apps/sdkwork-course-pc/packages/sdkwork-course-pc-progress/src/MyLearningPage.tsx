import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, LoadingSpinner, EmptyState } from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk, extractSdkListItems, readEntityString } from '@sdkwork/sdkwork-course-pc-core'

export function MyLearningPage() {
  const navigate = useNavigate()
  const sdk = useCourseSdk()

  const { data, isLoading, error } = useQuery({
    queryKey: ['enrollments'],
    queryFn: async () => sdk.courseEnrollments.current.list(),
  })

  const enrollments = extractSdkListItems(data).map((record) => ({
    id: readEntityString(record, 'id', 'enrollmentId'),
    courseId: readEntityString(record, 'courseId', 'course_id'),
    offeringId: readEntityString(record, 'offeringId', 'offering_id'),
    userId: readEntityString(record, 'userId', 'user_id'),
    enrollmentStatus: readEntityString(record, 'enrollmentStatus', 'status', 'enrollment_status') || 'active',
    enrolledAt: readEntityString(record, 'enrolledAt', 'enrolled_at') || new Date().toISOString(),
    completedAt: readEntityString(record, 'completedAt', 'completed_at') || undefined,
  }))

  if (isLoading) {
    return <LoadingSpinner text="加载我的课程..." />
  }

  if (error) {
    return (
      <EmptyState
        icon="!"
        title="加载失败"
        description="无法加载你的课程列表"
      />
    )
  }

  return (
    <div>
      <PageHeader title="我的学习" subtitle="查看你的学习进度和课程" />

      {enrollments.length === 0 ? (
        <EmptyState
          icon="📚"
          title="还没有报名课程"
          description="去课程中心探索精品课程吧"
          action={
            <button
              onClick={() => navigate('/courses')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              浏览课程
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-4 cursor-pointer hover:shadow-lg dark:hover:shadow-none transition-shadow"
              onClick={() => navigate(`/courses/${enrollment.courseId}`)}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    enrollment.enrollmentStatus === 'active'
                      ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-400'
                      : enrollment.enrollmentStatus === 'completed'
                        ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200'
                  }`}
                >
                  {enrollment.enrollmentStatus === 'active'
                    ? '学习中'
                    : enrollment.enrollmentStatus === 'completed'
                      ? '已完成'
                      : enrollment.enrollmentStatus}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  {new Date(enrollment.enrolledAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-semibold mb-2">课程 ID: {enrollment.courseId}</h3>
              <button
                className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/courses/${enrollment.courseId}`)
                }}
              >
                继续学习
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
