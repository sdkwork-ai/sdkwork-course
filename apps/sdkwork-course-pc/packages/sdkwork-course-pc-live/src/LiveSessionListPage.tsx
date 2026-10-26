import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader, LoadingSpinner, EmptyState, formatCompactCount } from '@sdkwork/sdkwork-course-pc-commons'
import { extractSdkListItems, useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import {
  isClosedStatus,
  isLiveNow,
  isScheduledStatus,
  liveCoverHue,
  liveSessionSortRank,
  mapLiveSession,
  liveStatusLabel,
  type LiveSessionView,
} from './liveRoomModel'

function cardTarget(session: LiveSessionView): string {
  // Ongoing sessions skip the detail page and go straight into the live room.
  return isLiveNow(session) ? `/live/${session.id}/room` : `/live/${session.id}`
}

export function LiveSessionListPage() {
  const sdk = useCourseSdk()

  const { data, isLoading, error } = useQuery({
    queryKey: ['liveSessions'],
    queryFn: async () => sdk.courseLiveSessions.list(),
    // Sessions flip live/scheduled server-side; keep the badges fresh.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const sessions = extractSdkListItems(data)
    .map(mapLiveSession)
    .filter((session) => session.id)
    .sort((a, b) => {
      const rank = liveSessionSortRank(a) - liveSessionSortRank(b)
      if (rank !== 0) return rank
      const aStart = Date.parse(a.scheduledStartAt) || 0
      const bStart = Date.parse(b.scheduledStartAt) || 0
      // Ongoing and upcoming sessions read naturally soonest-first; closed
      // sessions read most-recent-first.
      return isClosedStatus(a) ? bStart - aStart : aStart - bStart
    })

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
          {sessions.map((session) => {
            const live = isLiveNow(session)
            return (
              <Link
                key={session.id}
                to={cardTarget(session)}
                className="group block overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={live ? `进入直播间：${session.title}` : `查看直播详情：${session.title}`}
              >
                <div className="relative h-40 overflow-hidden bg-slate-950">
                  {session.coverUrl ? (
                    <img
                      src={session.coverUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full scale-105 object-cover opacity-90 transition duration-500 group-hover:scale-[1.08]"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 transition duration-500 group-hover:scale-[1.04]"
                      style={{
                        backgroundImage: `radial-gradient(circle at 20% 25%, hsl(${liveCoverHue(session.id)} 72% 42% / 0.6), transparent 48%), radial-gradient(circle at 80% 75%, hsl(${(liveCoverHue(session.id) + 48) % 360} 70% 38% / 0.55), transparent 52%), linear-gradient(150deg, hsl(${liveCoverHue(session.id)} 60% 18%), hsl(${(liveCoverHue(session.id) + 30) % 360} 65% 9%))`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                  <span className="pointer-events-none absolute bottom-3 right-4 text-3xl font-black tracking-widest text-white/20">
                    LIVE
                  </span>
                  <div className="absolute left-2 top-2">
                    {live ? (
                      <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
                        直播中
                      </span>
                    ) : (
                      <span
                        className={
                          isScheduledStatus(session)
                            ? 'bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold'
                            : 'bg-gray-600 text-white px-2 py-1 rounded text-xs font-semibold'
                        }
                      >
                        {liveStatusLabel(session.liveStatus)}
                      </span>
                    )}
                  </div>
                  {live ? (
                    <>
                      <span className="absolute bottom-3 left-3 inline-flex translate-y-1 items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-rose-600 opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        进入直播间
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {formatCompactCount(session.attendeeCount)} 观看
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-1">{session.title}</h3>
                  {session.description ? (
                    <p className="text-slate-600 text-sm mb-2 line-clamp-2">{session.description}</p>
                  ) : null}
                  <div className="text-sm text-slate-500">
                    <p>开始时间: {session.scheduledStartAt ? new Date(session.scheduledStartAt).toLocaleString() : '待定'}</p>
                    <p>结束时间: {session.scheduledEndAt ? new Date(session.scheduledEndAt).toLocaleString() : '待定'}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
