import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Button,
  EmptyState,
  LoadingSpinner,
  Notice,
  PageHeader,
  formatCompactCount,
} from '@sdkwork/sdkwork-course-pc-commons'
import {
  extractSdkItem,
  readEntityNumber,
  readEntityString,
  useCourseSdk,
} from '@sdkwork/sdkwork-course-pc-core'

export function LiveSessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const sdk = useCourseSdk()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [reminded, setReminded] = useState(false)

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
        scheduledStartAt:
          readEntityString(record, 'scheduledStartAt', 'scheduled_start_at') ||
          new Date().toISOString(),
        scheduledEndAt:
          readEntityString(record, 'scheduledEndAt', 'scheduled_end_at') || new Date().toISOString(),
        actualEndAt: readEntityString(record, 'actualEndAt', 'actual_end_at') || undefined,
        providerRoomRef:
          readEntityString(record, 'providerRoomRef', 'provider_room_ref') || undefined,
        attendees: readEntityNumber(record, 'attendeeCountSnapshot', 'attendee_count_snapshot') ?? 0,
      }
    : null

  const joinMutation = useMutation({
    mutationFn: () => sdk.courseLiveSessions.join(id!, {}),
  })

  const enterLiveRoom = () => {
    setJoined(true)
    setFeedback('已加入直播，正在打开直播间')
    void joinMutation.mutateAsync().catch(() => undefined)
    if (session?.providerRoomRef) {
      window.open(session.providerRoomRef, '_blank', 'noopener,noreferrer')
    } else {
      setFeedback('直播间地址尚未配置，请联系课程运营')
    }
  }

  const showReplay = () => {
    setFeedback('回放正在整理中，开放后会在这里展示')
  }

  if (isLoading) return <LoadingSpinner text="加载直播详情..." />

  if (error || !session) {
    return (
      <EmptyState
        icon="!"
        title="直播不存在"
        description="无法找到该直播课程"
        action={<Button onClick={() => window.location.reload()}>重新加载</Button>}
      />
    )
  }

  const isLive = session.liveStatus === 'live'
  const isScheduled = session.liveStatus === 'scheduled'

  return (
    <div className="space-y-4">
      <PageHeader title={session.title} subtitle={session.description} />

      {feedback ? <Notice tone="info">{feedback}</Notice> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-900/5 bg-slate-950 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.35),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.25),transparent_45%)]" />
            <div className="relative z-10 text-center">
              {isLive ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                    直播进行中
                  </span>
                  <p className="mt-4 text-2xl font-bold">AI Agent 公开课直播现场</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {formatCompactCount(session.attendees)} 人正在观看
                  </p>
                  <Button className="mt-5" onClick={enterLiveRoom}>
                    {joined ? '已加入直播' : '加入直播'}
                  </Button>
                </>
              ) : isScheduled ? (
                <>
                  <span className="text-5xl">⏱</span>
                  <p className="mt-4 text-2xl font-bold">直播即将开始</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {new Date(session.scheduledStartAt).toLocaleString('zh-CN')}
                  </p>
                  <Button
                    className="mt-5"
                    variant={reminded ? 'outline' : 'primary'}
                    onClick={() => {
                      setReminded(true)
                      setFeedback('已预约，开始前会在这里提醒你')
                    }}
                  >
                    {reminded ? '已预约' : '预约提醒'}
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-5xl">🎬</span>
                  <p className="mt-4 text-2xl font-bold">直播已结束</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {session.actualEndAt
                      ? new Date(session.actualEndAt).toLocaleString('zh-CN')
                      : new Date(session.scheduledEndAt).toLocaleString('zh-CN')}
                  </p>
                  <Button className="mt-5" onClick={showReplay}>
                    查看回放
                  </Button>
                </>
              )}
            </div>
          </div>

          <section className="rounded-xl border border-slate-100 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">直播详情</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {session.description || '暂无详情描述'}
            </p>
          </section>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-100 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                直播状态
              </span>
              <span
                className={
                  isLive
                    ? 'rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600'
                    : isScheduled
                      ? 'rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600'
                      : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500'
                }
              >
                {isLive ? '直播中' : isScheduled ? '即将开始' : '已结束'}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">开始时间</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {new Date(session.scheduledStartAt).toLocaleString('zh-CN')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">结束时间</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {new Date(session.scheduledEndAt).toLocaleString('zh-CN')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">观看人数</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {formatCompactCount(session.attendees)} 人
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              {isLive ? (
                <Button fullWidth onClick={enterLiveRoom}>
                  {joined ? '已加入直播' : '加入直播'}
                </Button>
              ) : isScheduled ? (
                <Button
                  fullWidth
                  variant={reminded ? 'outline' : 'primary'}
                  onClick={() => {
                    setReminded(true)
                    setFeedback('已预约，开始前会在这里提醒你')
                  }}
                >
                  {reminded ? '已预约' : '预约提醒'}
                </Button>
              ) : (
                <Button fullWidth onClick={showReplay}>
                  查看回放
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 text-xs leading-relaxed text-slate-500">
            直播由课程中心统一排期。加入后会跳转到直播服务商房间；回放由讲师上传后开放。
          </div>
        </aside>
      </div>
    </div>
  )
}
