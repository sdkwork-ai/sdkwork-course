import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useCourseSdk,
  extractSdkItem,
  readEntityString,
  readEntityNumber,
} from '@sdkwork/sdkwork-course-pc-core'

interface LearningProgressProps {
  enrollmentId: string
}

export function LearningProgress({ enrollmentId }: LearningProgressProps) {
  const sdk = useCourseSdk()

  const { data, isLoading } = useQuery({
    queryKey: ['progress', enrollmentId],
    queryFn: async () => sdk.courseProgress.retrieve(enrollmentId),
    enabled: !!enrollmentId,
  })

  const record = extractSdkItem(data)
  const progress = record
    ? {
        completedLessonCount: readEntityNumber(record, 'completedLessonCount', 'completed_lesson_count') ?? 0,
        requiredLessonCount: readEntityNumber(record, 'requiredLessonCount', 'required_lesson_count') ?? 0,
        progressPercent: readEntityString(record, 'progressPercent', 'progress_percent') || '0',
        watchSeconds: readEntityNumber(record, 'watchSeconds', 'watch_seconds') ?? 0,
        progressStatus: readEntityString(record, 'progressStatus', 'progress_status', 'status') || 'in_progress',
        startedAt: readEntityString(record, 'startedAt', 'started_at') || undefined,
        completedAt: readEntityString(record, 'completedAt', 'completed_at') || undefined,
      }
    : null

  if (isLoading) {
    return <div className="p-4 text-gray-500 dark:text-zinc-400">加载学习进度...</div>
  }

  if (!progress) {
    return <div className="p-4 text-gray-500 dark:text-zinc-400">暂无学习进度</div>
  }

  const percent = parseFloat(progress.progressPercent) || 0
  const watchHours = Math.floor(progress.watchSeconds / 3600)
  const watchMinutes = Math.floor((progress.watchSeconds % 3600) / 60)

  return (
    <div className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-6">
      <h3 className="font-semibold mb-4">学习进度</h3>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>完成进度</span>
          <span>{percent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{progress.completedLessonCount}</div>
          <div className="text-sm text-gray-500 dark:text-zinc-400">已完成课时</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-600 dark:text-zinc-300">{progress.requiredLessonCount}</div>
          <div className="text-sm text-gray-500 dark:text-zinc-400">总课时</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-zinc-400">学习时长</span>
          <span>{watchHours} 小时 {watchMinutes} 分钟</span>
        </div>
        {progress.startedAt && (
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500 dark:text-zinc-400">开始时间</span>
            <span>{new Date(progress.startedAt).toLocaleDateString()}</span>
          </div>
        )}
        {progress.completedAt && (
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500 dark:text-zinc-400">完成时间</span>
            <span>{new Date(progress.completedAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {progress.progressStatus === 'completed' && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg text-green-700 dark:text-green-400 text-sm">
          恭喜！你已完成本课程的学习
        </div>
      )}
    </div>
  )
}
