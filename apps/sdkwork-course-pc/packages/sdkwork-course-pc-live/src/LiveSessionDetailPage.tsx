import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  EmptyState,
  LoadingSpinner,
  Notice,
  PageHeader,
  formatCompactCount,
} from '@sdkwork/sdkwork-course-pc-commons'
import { extractSdkItem, useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { isLiveNow, isScheduledStatus, liveCoverHue, mapLiveSession, type LiveSessionView } from './liveRoomModel'

export function LiveSessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [reminded, setReminded] = useState(false)
  const [replayLoading, setReplayLoading] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['liveSession', id],
    queryFn: async () => sdk.courseLiveSessions.retrieve(id!),
    enabled: !!id,
    refetchInterval: 30_000,
    retry: 1,
  })

  const record = extractSdkItem(data)
  const session = record ? mapLiveSession(record) : null

  // Entering the room is an in-app navigation; the room page owns the
  // join → heartbeat → leave attendance lifecycle itself.
  const enterLiveRoom = () => {
    if (!session?.id) return
    navigate(`/live/${session.id}/room`)
  }

  const showReplay = async () => {
    if (!id) return
    setReplayLoading(true)
    try {
      const payload = extractSdkItem(await sdk.courseLiveSessions.replay.retrieve(id))
      const url =
        payload && typeof payload === 'object'
          ? Object.values(payload as Record<string, unknown>).find(
              (value): value is string => typeof value === 'string' && /^https?:\/\//u.test(value),
            )
          : undefined
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setFeedback('回放正在整理中，开放后会在这里展示')
      }
    } catch {
      setFeedback('回放正在整理中，开放后会在这里展示')
    } finally {
      setReplayLoading(false)
    }
  }

  if (isLoading) return <LoadingSpinner text="加载直播详情..." />

  if (error || !session || !session.id) {
    return (
      <EmptyState
        icon="!"
        title="直播不存在"
        description="无法找到该直播课程"
        action={<Button onClick={() => navigate('/live')}>返回直播列表</Button>}
      />
    )
  }

  const isLive = isLiveNow(session)
  const isScheduled = isScheduledStatus(session)

  return (
    <div className="space-y-4">
      <PageHeader title={session.title} subtitle={session.description} />

      {feedback ? <Notice tone="info">{feedback}</Notice> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-900/5 bg-slate-950 text-white">
            {session.coverUrl ? (
              <>
                <img
                  src={session.coverUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
                />
                <img
                  src={session.coverUrl}
                  alt={session.title}
                  className="absolute inset-0 m-auto h-full w-auto max-w-full object-contain"
                />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 20%, hsl(${liveCoverHue(session.id)} 72% 42% / 0.5), transparent 45%), radial-gradient(circle at 80% 80%, hsl(${(liveCoverHue(session.id) + 48) % 360} 70% 38% / 0.45), transparent 50%)`,
                }}
              />
            )}
            <div className="relative z-10 rounded-2xl bg-slate-950/55 px-8 py-6 text-center backdrop-blur-sm sm:px-10">
              {isLive ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                    直播进行中
                  </span>
                  <p className="mt-4 text-2xl font-bold">{session.title}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {formatCompactCount(session.attendeeCount)} 人正在观看
                  </p>
                  <Button className="mt-5" onClick={enterLiveRoom}>
                    进入直播间
                  </Button>
                </>
              ) : isScheduled ? (
                <>
                  <span className="text-5xl">⏱</span>
                  <p className="mt-4 text-2xl font-bold">直播即将开始</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {session.scheduledStartAt
                      ? new Date(session.scheduledStartAt).toLocaleString('zh-CN')
                      : '开播时间待定'}
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
                    {(session.actualEndAt || session.scheduledEndAt)
                      ? new Date(session.actualEndAt || session.scheduledEndAt).toLocaleString('zh-CN')
                      : ''}
                  </p>
                  <Button className="mt-5" loading={replayLoading} onClick={() => void showReplay()}>
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
                  {session.scheduledStartAt
                    ? new Date(session.scheduledStartAt).toLocaleString('zh-CN')
                    : '待定'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">结束时间</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {session.scheduledEndAt
                    ? new Date(session.scheduledEndAt).toLocaleString('zh-CN')
                    : '待定'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">观看人数</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {formatCompactCount(session.attendeeCount)} 人
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              {isLive ? (
                <>
                  <Button fullWidth onClick={enterLiveRoom}>
                    进入直播间
                  </Button>
                  {session.providerRoomRef ? (
                    <a
                      href={session.providerRoomRef}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-center text-xs font-medium text-slate-400 hover:text-indigo-600"
                    >
                      或在服务商页面观看
                    </a>
                  ) : null}
                </>
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
                <Button fullWidth loading={replayLoading} onClick={() => void showReplay()}>
                  查看回放
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 text-xs leading-relaxed text-slate-500">
            直播由课程中心统一排期。进入直播间后可以观看直播画面，并在互动区自由发言；回放由讲师上传后开放。
          </div>
        </aside>
      </div>
    </div>
  )
}
