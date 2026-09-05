import React from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, LoadingSpinner, EmptyState } from '@sdkwork/sdkwork-course-pc-commons'
import {
  useCourseSdk,
  extractSdkItem,
  readEntityString,
} from '@sdkwork/sdkwork-course-pc-core'

export function LiveSessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const sdk = useCourseSdk()

  const { data, isLoading, error } = useQuery({
    queryKey: ['liveSession', id],
    queryFn: async () => sdk.courseLiveSessions.retrieve(id!),
    enabled: !!id,
  })

  const record = extractSdkItem(data)
  const session = record
    ? {
        id: readEntityString(record, 'id', 'liveSessionId'),
        title: readEntityString(record, 'title', 'name'),
        description: readEntityString(record, 'description') || undefined,
        liveStatus: readEntityString(record, 'liveStatus', 'live_status', 'status') || 'scheduled',
        scheduledStartAt: readEntityString(record, 'scheduledStartAt', 'scheduled_start_at') || new Date().toISOString(),
        scheduledEndAt: readEntityString(record, 'scheduledEndAt', 'scheduled_end_at') || new Date().toISOString(),
        actualStartAt: readEntityString(record, 'actualStartAt', 'actual_start_at') || undefined,
        actualEndAt: readEntityString(record, 'actualEndAt', 'actual_end_at') || undefined,
      }
    : null

  if (isLoading) {
    return <LoadingSpinner text="加载直播详情..." />
  }

  if (error || !session) {
    return (
      <EmptyState
        icon="!"
        title="直播不存在"
        description="无法找到该直播课程"
      />
    )
  }

  const isLive = session.liveStatus === 'live'
  const isScheduled = session.liveStatus === 'scheduled'
  const isEnded = session.liveStatus === 'ended'

  return (
    <div>
      <PageHeader title={session.title} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg overflow-hidden mb-6">
            <div className="h-96 flex items-center justify-center">
              {isLive ? (
                <div className="text-white text-center">
                  <div className="text-6xl mb-4 animate-pulse text-red-500">LIVE</div>
                  <p className="text-lg">直播进行中</p>
                  <button className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
                    加入直播
                  </button>
                </div>
              ) : isScheduled ? (
                <div className="text-white text-center">
                  <div className="text-6xl mb-4">⏱</div>
                  <p className="text-lg">即将开始</p>
                  <p className="text-sm text-gray-400 mt-2">
                    开始时间: {new Date(session.scheduledStartAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="text-white text-center">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-lg">直播已结束</p>
                  {session.actualEndAt && (
                    <p className="text-sm text-gray-400 mt-2">
                      结束时间: {new Date(session.actualEndAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-6">
            <h2 className="text-xl font-semibold mb-4">直播详情</h2>
            <p className="text-gray-600 dark:text-zinc-300">{session.description || '暂无详情描述'}</p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none p-6 sticky top-4">
            <div className="text-center mb-4">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  isLive
                    ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400'
                    : isScheduled
                      ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200'
                }`}
              >
                {isLive ? '直播中' : isScheduled ? '即将开始' : '已结束'}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-sm text-gray-500">开始时间</span>
                <p className="font-semibold">{new Date(session.scheduledStartAt).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-zinc-400">结束时间</span>
                <p className="font-semibold">{new Date(session.scheduledEndAt).toLocaleString()}</p>
              </div>
              {session.actualStartAt && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-zinc-400">实际开始</span>
                  <p className="font-semibold">{new Date(session.actualStartAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            {isLive && (
              <button className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                加入直播
              </button>
            )}

            {isScheduled && (
              <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                预约提醒
              </button>
            )}

            {isEnded && (
              <button className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors">
                查看回放
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
