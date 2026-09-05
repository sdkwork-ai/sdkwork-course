import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { PageHeader, LoadingSpinner, EmptyState } from '@sdkwork/sdkwork-course-pc-commons'
import {
  useCourseSdk,
  extractSdkItem,
  readEntityString,
  readEntityNumber,
  enrollInFirstCourseOffering,
  CourseEnrollmentError,
} from '@sdkwork/sdkwork-course-pc-core'

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const sdk = useCourseSdk()
  const [enrollFeedback, setEnrollFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => sdk.courses.retrieve(id!),
    enabled: !!id,
  })

  const enrollMutation = useMutation({
    mutationFn: async () => enrollInFirstCourseOffering(sdk, id!),
    onSuccess: () => {
      setEnrollFeedback({ tone: 'success', message: '报名成功' })
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof CourseEnrollmentError
          ? mutationError.message
          : '报名失败，请稍后再试'
      setEnrollFeedback({ tone: 'error', message })
    },
  })

  const courseRecord = extractSdkItem(data)
  const course = courseRecord
    ? {
        id: readEntityString(courseRecord, 'id', 'courseId'),
        courseCode: readEntityString(courseRecord, 'courseCode', 'course_code'),
        title: readEntityString(courseRecord, 'title', 'name'),
        subtitle: readEntityString(courseRecord, 'subtitle') || undefined,
        description: readEntityString(courseRecord, 'description', 'summary') || undefined,
        thumbnail: readEntityString(courseRecord, 'thumbnail', 'cover', 'coverUrl') || undefined,
        instructor: readEntityString(courseRecord, 'instructor', 'instructorName') || undefined,
        lessonsCount: readEntityNumber(courseRecord, 'lessonsCount', 'lessons_count') ?? 0,
        studentsCount: readEntityNumber(courseRecord, 'studentsCount', 'students_count', 'students') ?? 0,
        ratingScore: readEntityString(courseRecord, 'ratingScore', 'rating', 'rating_score') || '暂无评分',
        category: readEntityString(courseRecord, 'category', 'categoryId') || undefined,
        tags: Array.isArray(courseRecord.tags) ? (courseRecord.tags as string[]) : [],
        status: readEntityString(courseRecord, 'status') || 'draft',
        visibility: readEntityString(courseRecord, 'visibility') || 'public',
        publishStatus: readEntityString(courseRecord, 'publishStatus', 'publish_status') || readEntityString(courseRecord, 'status'),
      }
    : null

  if (isLoading) {
    return <LoadingSpinner text="加载课程详情..." />
  }

  if (error || !course) {
    return (
      <EmptyState
        icon="!"
        title="课程不存在"
        description="无法找到该课程，请检查链接是否正确"
      />
    )
  }

  return (
    <div>
      <PageHeader title={course.title} subtitle={course.subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-6 mb-6">
            <div className="h-64 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mb-4 relative">
              {course.thumbnail && (
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover rounded-lg" />
              )}
            </div>
            <h2 className="text-xl font-semibold mb-2">课程简介</h2>
            <p className="text-gray-600 dark:text-zinc-300">{course.description || '暂无简介'}</p>
          </div>

          <div className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-6">
            <h2 className="text-xl font-semibold mb-4">课程目录</h2>
            <p className="text-gray-600 dark:text-zinc-300">课程内容加载中...</p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-6 sticky top-4">
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {course.ratingScore || '暂无评分'}
              </div>
              <div className="text-sm text-gray-500 dark:text-zinc-400">课程评分</div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-zinc-300">课时数</span>
                <span className="font-semibold">{course.lessonsCount} 课时</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-zinc-300">学习人数</span>
                <span className="font-semibold">{course.studentsCount} 人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-zinc-300">课程状态</span>
                <span className="font-semibold">{course.publishStatus}</span>
              </div>
            </div>

            {enrollFeedback && (
              <p
                className={`mb-3 text-sm ${
                  enrollFeedback.tone === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {enrollFeedback.message}
              </p>
            )}

            <button
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={enrollMutation.isPending}
              onClick={() => {
                setEnrollFeedback(null)
                enrollMutation.mutate()
              }}
            >
              {enrollMutation.isPending ? '报名中...' : '立即报名'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
