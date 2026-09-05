import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, LoadingSpinner, EmptyState } from '@sdkwork/sdkwork-course-pc-commons'
import {
  useCourseSdk,
  extractSdkListItems,
  readEntityString,
} from '@sdkwork/sdkwork-course-pc-core'

export function LiveSessionListPage() {
  const navigate = useNavigate()
  const sdk = useCourseSdk()

  const { data, isLoading, error } = useQuery({
    queryKey: ['liveSessions'],
    queryFn: async () => sdk.courseLiveSessions.list(),
  })

  const sessions = extractSdkListItems(data).map((record) => ({
    id: readEntityString(record, 'id', 'liveSessionId'),
    title: readEntityString(record, 'title', 'name'),
    description: readEntityString(record, 'description') || undefined,
    liveStatus: readEntityString(record, 'liveStatus', 'live_status', 'status') || 'scheduled',
    scheduledStartAt: readEntityString(record, 'scheduledStartAt', 'scheduled_start_at') || new Date().toISOString(),
    scheduledEndAt: readEntityString(record, 'scheduledEndAt', 'scheduled_end_at') || new Date().toISOString(),
  }))

  if (isLoading) {
    return <LoadingSpinner text="加载直播课程..." />
  }

  if (error) {
    return (
      <EmptyState
        icon="!"
        title="加载失败"
        description="无法加载直播课程列表"
      />
    )
  }

  return (
    <div>
      <PageHeader title="直播课堂" subtitle="参与实时互动学习" />

      {sessions.length === 0 ? (
        <EmptyState
          icon="📺"
          title="暂无直播课程"
          description="没有即将开始的直播课程"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700/60 rounded-lg shadow dark:shadow-none overflow-hidden cursor-pointer hover:shadow-lg dark:hover:shadow-none transition-shadow"
              onClick={() => navigate(`/live/${session.id}`)}
            >
              <div className="h-40 bg-gradient-to-r from-red-500 to-pink-500 relative">
                <div className="absolute top-2 left-2">
                  {session.liveStatus === 'live' && (
                    <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold animate-pulse">
                      直播中
                    </span>
                  )}
                  {session.liveStatus === 'scheduled' && (
                    <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">
                      即将开始
                    </span>
                  )}
                  {session.liveStatus === 'ended' && (
                    <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs font-semibold">
                      已结束
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">{session.title}</h3>
                {session.description && (
                  <p className="text-gray-600 dark:text-zinc-300 text-sm mb-2 line-clamp-2">{session.description}</p>
                )}
                <div className="text-sm text-gray-500 dark:text-zinc-400">
                  <p>开始时间: {new Date(session.scheduledStartAt).toLocaleString()}</p>
                  <p>结束时间: {new Date(session.scheduledEndAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
