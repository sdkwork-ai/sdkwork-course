import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  EmptyState,
  LoadingSpinner,
  Notice,
  cn,
  formatCompactCount,
} from '@sdkwork/sdkwork-course-pc-commons'
import { extractSdkItem, useAppStore, useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { LiveStage } from './LiveStage'
import { LiveChatPanel, type LiveHeart } from './LiveChatPanel'
import { useLiveChat } from './useLiveChat'
import {
  isLiveNow,
  isScheduledStatus,
  liveCoverHue,
  liveStartClockMs,
  mapLiveSession,
  type LiveSessionView,
} from './liveRoomModel'

/**
 * In-app live room. Layout mirrors the VOD lesson player (stage + action bar
 * + description on the left, sticky sidebar on the right); the sidebar is a
 * Douyin-PC-style live chat dock instead of a curriculum tree. Attendance is
 * reported with join → heartbeat → leave over the course live-session API.
 */
export function LiveRoomPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const user = useAppStore((state) => state.user)
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [reminded, setReminded] = useState(false)
  const [followed, setFollowed] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [hearts, setHearts] = useState<LiveHeart[]>([])
  const [replayLoading, setReplayLoading] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const sessionQuery = useQuery({
    queryKey: ['liveSession', id],
    queryFn: async () => sdk.courseLiveSessions.retrieve(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
    retry: 1,
  })

  const record = extractSdkItem(sessionQuery.data)
  const session = useMemo<LiveSessionView | null>(
    () => (record ? mapLiveSession(record) : null),
    [record],
  )

  const live = Boolean(session && isLiveNow(session))
  const scheduled = Boolean(session && isScheduledStatus(session))

  // Wall-clock tick for the on-stage elapsed timer and countdowns.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Reflect the live room in the browser tab so pinned tabs stay recognizable.
  useEffect(() => {
    const previousTitle = document.title
    if (session?.title) {
      document.title = `${live ? '🔴 ' : ''}${session.title} · 直播间`
    }
    return () => {
      document.title = previousTitle
    }
  }, [session?.title, live])

  // Attendance lifecycle: join once, heartbeat every minute, leave on exit.
  const joinedRef = useRef(false)
  useEffect(() => {
    if (!id || !isAuthenticated || !live || joinedRef.current) return undefined
    joinedRef.current = true
    void sdk.courseLiveSessions.join(id, {}).catch(() => undefined)
    const heartbeat = window.setInterval(() => {
      void sdk.courseLiveSessions.heartbeat(id, {}).catch(() => undefined)
    }, 60_000)
    return () => {
      joinedRef.current = false
      window.clearInterval(heartbeat)
      void sdk.courseLiveSessions.leave(id, {}).catch(() => undefined)
    }
  }, [id, isAuthenticated, live, sdk])

  const viewer = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.name?.trim() || '同学',
            avatarUrl: user.avatar,
          }
        : null,
    [user],
  )

  const pollIntervalMs = live ? 4_000 : scheduled ? 15_000 : 0
  const chat = useLiveChat({
    liveSessionId: id ?? '',
    viewer,
    pollIntervalMs,
    enabled: isAuthenticated && Boolean(id),
  })

  const elapsedSeconds = useMemo(() => {
    if (!session) return 0
    const startMs = liveStartClockMs(session)
    if (live) return Math.max(0, (nowMs - startMs) / 1000)
    const endMs = Date.parse(session.actualEndAt || session.scheduledEndAt)
    if (!Number.isNaN(endMs) && endMs > startMs) return (endMs - startMs) / 1000
    return 0
  }, [session, live, nowMs])

  const countdownMs = useMemo(() => {
    if (!session || !scheduled) return Number.NaN
    const startMs = Date.parse(session.scheduledStartAt)
    if (Number.isNaN(startMs)) return Number.NaN
    return startMs - nowMs
  }, [session, scheduled, nowMs])

  const handleLike = () => {
    const heartId = Date.now() + Math.random()
    setHearts((current) => [
      ...current.slice(-11),
      { id: heartId, drift: Math.random() * 56 - 28 },
    ])
    setLikeCount((count) => count + 1)
    window.setTimeout(() => {
      setHearts((current) => current.filter((heart) => heart.id !== heartId))
    }, 2_000)
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setFeedback('直播间链接已复制，快去邀请同学一起看直播')
    } catch {
      setFeedback('复制失败，请从地址栏复制直播间链接')
    }
  }

  const handleReplay = async () => {
    if (!id) return
    setReplayLoading(true)
    try {
      const payload = extractSdkItem(await sdk.courseLiveSessions.replay.retrieve(id))
      const url =
        typeof payload === 'object' && payload
          ? Object.values(payload).find(
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

  if (sessionQuery.isLoading) {
    return <LoadingSpinner text="正在进入直播间..." />
  }

  if (sessionQuery.error || !session || !session.id) {
    return (
      <EmptyState
        icon="!"
        title="直播间不存在"
        description="无法找到该直播，可能已被取消或链接失效。"
        action={
          <Button onClick={() => (id ? void sessionQuery.refetch() : navigate('/live'))}>
            重新加载
          </Button>
        }
      />
    )
  }

  const hue = liveCoverHue(session.id)
  const instructorName = session.instructorName || '平台讲师'
  const canChat = isAuthenticated && !['ended', 'replay_ready', 'recording_processing'].includes(session.liveStatus)
  const disabledReason = !isAuthenticated ? '登录后即可参与实时互动' : '直播已结束，聊天通道已关闭'

  return (
    <div className="space-y-3 pb-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
          <Link to="/live" className="font-semibold text-indigo-600 hover:text-indigo-500">
            直播课堂
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate">{session.title}</span>
        </div>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-[20px]">
          {session.title}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" aria-hidden />
              直播中
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {scheduled ? '即将开始' : '已结束'}
            </span>
          )}
          <span>{formatCompactCount(session.attendeeCount)} 人观看</span>
          {session.scheduledStartAt ? (
            <span>开播 {new Date(session.scheduledStartAt).toLocaleString('zh-CN')}</span>
          ) : null}
          <span>主播 {instructorName}</span>
          <span className="text-slate-300">·</span>
          <Link to={`/live/${session.id}`} className="font-medium text-slate-500 hover:text-indigo-600">
            直播详情
          </Link>
        </div>
      </div>

      {feedback ? <Notice tone="info">{feedback}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <LiveStage
            session={session}
            viewerCount={session.attendeeCount}
            elapsedSeconds={elapsedSeconds}
            countdownMs={countdownMs}
            reminded={reminded}
            onRemind={() => {
              setReminded(true)
              setFeedback('已预约，开播前会在这里提醒你')
            }}
            replayLoading={replayLoading}
            onReplay={() => void handleReplay()}
          />

          {/* Action bar, mirroring the VOD player action row */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                aria-label="为直播点赞"
                onClick={handleLike}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                  <path d="M12 21s-7.5-4.7-10-9.3C.4 8.9 2.4 5.5 5.9 5.1c2-.2 3.9.8 5.1 2.4h2c1.2-1.6 3.1-2.6 5.1-2.4 3.5.4 5.5 3.8 3.9 6.6C19.5 16.3 12 21 12 21Z" />
                </svg>
                {likeCount > 0 ? likeCount : '点赞'}
              </button>
              <button
                type="button"
                aria-label="分享直播间"
                onClick={() => void handleShare()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M15 5 21 11l-6 6M21 11H9a5 5 0 0 0-5 5v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                分享
              </button>
              <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs font-medium text-slate-400">
                {live ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                    实时直播中，欢迎参与讨论
                  </>
                ) : scheduled ? (
                  '还未开播，可在互动区先聊起来'
                ) : (
                  '本场直播已结束'
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {live && session.providerRoomRef ? (
                <a
                  href={session.providerRoomRef}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600"
                >
                  在服务商页面观看
                </a>
              ) : null}
              {session.courseId ? (
                <Button variant="outline" size="sm" onClick={() => navigate(`/courses/${session.courseId}`)}>
                  前往课程
                </Button>
              ) : null}
            </div>
          </div>

          {/* Session details card, mirroring the VOD lesson description card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">直播介绍</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {session.description || '主播尚未填写直播介绍。'}
                </p>
              </div>
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                style={{
                  backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 42) % 360} 72% 32%))`,
                }}
                aria-hidden
              >
                LIVE
              </span>
            </div>
            <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">计划开播</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {session.scheduledStartAt
                    ? new Date(session.scheduledStartAt).toLocaleString('zh-CN')
                    : '待定'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">计划结束</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {session.scheduledEndAt
                    ? new Date(session.scheduledEndAt).toLocaleString('zh-CN')
                    : '待定'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">主播</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{instructorName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">直播间须知</dt>
                <dd className={cn('mt-0.5 text-slate-500', live ? 'font-semibold text-emerald-600' : '')}>
                  {live ? '正在直播，欢迎在右侧互动区自由发言' : '互动消息会实时同步给全场观众'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {/* Host card, mirroring the VOD author card */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{
                backgroundImage: `linear-gradient(135deg, hsl(${hue} 65% 48%), hsl(${(hue + 40) % 360} 70% 36%))`,
              }}
              aria-hidden
            >
              {instructorName.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{instructorName}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">主播 · 实时答疑</p>
            </div>
            <Button
              variant={followed ? 'outline' : 'primary'}
              size="sm"
              onClick={() => {
                setFollowed((value) => !value)
                setFeedback(followed ? '已取消关注' : `已关注 ${instructorName}，开播会提醒你`)
              }}
            >
              {followed ? '已关注' : '关注'}
            </Button>
          </div>

          <LiveChatPanel
            session={session}
            messages={chat.messages}
            viewer={viewer}
            canChat={canChat}
            disabledReason={disabledReason}
            loginHref={
              isAuthenticated
                ? ''
                : `/login?redirect=${encodeURIComponent(`/live/${session.id}/room`)}`
            }
            viewerCount={session.attendeeCount}
            connection={chat.connection}
            isSending={chat.isSending}
            onSend={(body) => void chat.send(body)}
            onRetry={chat.retry}
            onRefresh={chat.refresh}
            likeCount={likeCount}
            hearts={hearts}
            onLike={handleLike}
            className="h-[520px] lg:h-[calc(100vh-19rem)] lg:min-h-[460px]"
          />
        </aside>
      </div>
    </div>
  )
}
