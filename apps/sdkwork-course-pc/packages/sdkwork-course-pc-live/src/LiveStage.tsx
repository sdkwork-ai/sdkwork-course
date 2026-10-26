import React, { useEffect, useState } from 'react'
import { Badge, Button, cn, formatCompactCount } from '@sdkwork/sdkwork-course-pc-commons'
import {
  formatLiveCountdown,
  formatLiveElapsed,
  isLiveNow,
  isScheduledStatus,
  liveCoverHue,
  liveStatusLabel,
  type LiveSessionView,
} from './liveRoomModel'

interface LiveStageProps {
  session: LiveSessionView
  viewerCount: number
  /** Seconds elapsed since the stream started (live) or its total runtime (closed). */
  elapsedSeconds: number
  /** Countdown to the scheduled start, shown while waiting. */
  countdownMs: number
  reminded: boolean
  onRemind: () => void
  replayLoading: boolean
  onReplay: () => void
}

/**
 * Immersive live stage: blurred cover backdrop, status badges, viewer count,
 * elapsed wall clock, and a Douyin-PC-style control bar with a real
 * fullscreen toggle. Scheduled and closed sessions render their own overlay.
 */
export function LiveStage({
  session,
  viewerCount,
  elapsedSeconds,
  countdownMs,
  reminded,
  onRemind,
  replayLoading,
  onReplay,
}: LiveStageProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(
        Boolean(document.fullscreenElement) && document.fullscreenElement === containerRef.current,
      )
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    const element = containerRef.current
    if (!element) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    } else if (element.requestFullscreen) {
      void element.requestFullscreen().catch(() => undefined)
    }
  }

  const live = isLiveNow(session)
  const scheduled = isScheduledStatus(session)
  const hue = liveCoverHue(session.id)
  const [streamFailed, setStreamFailed] = useState(false)
  const [streamMuted, setStreamMuted] = useState(true)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const hlsRef = React.useRef<{ destroy: () => void } | null>(null)
  const streamPlaying = live && Boolean(session.playbackUrl) && !streamFailed

  useEffect(() => {
    setStreamFailed(false)
    setStreamMuted(true)
  }, [session.playbackUrl, session.id])

  // Wire the stream: plain src for progressive formats and Safari HLS, hls.js
  // (dynamically imported so the chunk only loads when an HLS stream exists)
  // for MSE browsers.
  useEffect(() => {
    const video = videoRef.current
    const url = session.playbackUrl
    if (!streamPlaying || !video || !url) return undefined
    const isHlsStream = /\.m3u8(?:[?#]|$)/i.test(url)
    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''
    if (!isHlsStream || nativeHls) {
      video.src = url
      return undefined
    }
    let cancelled = false
    void import('hls.js').then((module) => {
      if (cancelled) return
      const Hls = module.default
      if (!Hls.isSupported()) {
        video.src = url
        return
      }
      const hls = new Hls({ enableWorker: true })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setStreamFailed(true)
      })
      hls.loadSource(url)
      hls.attachMedia(video)
      hlsRef.current = hls
    })
    return () => {
      cancelled = true
      hlsRef.current?.destroy()
      hlsRef.current = null
      video.removeAttribute('src')
      video.load()
    }
  }, [streamPlaying, session.playbackUrl])

  const toggleStreamMute = () => {
    setStreamMuted((muted) => !muted)
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-video max-h-[calc(100vh-13rem)] w-full overflow-hidden rounded-2xl border border-slate-900/5 bg-slate-950 text-white shadow-sm"
    >
      {streamPlaying ? (
        <video
          ref={videoRef}
          poster={session.coverUrl}
          autoPlay
          muted={streamMuted}
          playsInline
          preload="auto"
          onError={() => setStreamFailed(true)}
          aria-label={`${session.title} 直播画面`}
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
      ) : session.coverUrl ? (
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
            backgroundImage: `radial-gradient(circle at 18% 22%, hsl(${hue} 72% 42% / 0.55), transparent 46%), radial-gradient(circle at 82% 78%, hsl(${(hue + 48) % 360} 70% 38% / 0.5), transparent 50%), linear-gradient(150deg, hsl(${hue} 60% 16%), hsl(${(hue + 30) % 360} 65% 8%))`,
          }}
        />
      )}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-t',
          streamPlaying
            ? 'from-slate-950/45 via-transparent to-slate-950/25'
            : 'from-slate-950/85 via-transparent to-slate-950/45',
        )}
      />

      {!live ? (
        <span className="pointer-events-none absolute bottom-4 left-6 select-none text-6xl font-black tracking-widest text-white/10">
          LIVE
        </span>
      ) : null}

      {streamFailed && session.playbackUrl ? (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-center backdrop-blur">
          <p className="text-sm font-semibold text-white/90">直播画面加载失败</p>
          <p className="mt-1 text-xs text-slate-300">
            {session.providerRoomRef ? '可通过右下角「服务商页面观看」继续观看' : '请稍后刷新重试'}
          </p>
        </div>
      ) : null}

      {/* Status badges */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold shadow-lg shadow-rose-600/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            直播中
          </span>
        ) : (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold',
              scheduled ? 'bg-sky-600 shadow-lg shadow-sky-600/30' : 'bg-slate-600/90',
            )}
          >
            {liveStatusLabel(session.liveStatus)}
          </span>
        )}
        {session.coverUrl ? (
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur">
            1080P
          </span>
        ) : null}
      </div>

      {/* Viewer count */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur"
          title="当前观看人数"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {formatCompactCount(viewerCount)}
        </span>
        {live ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
            title={isFullscreen ? '退出全屏' : '进入全屏'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur transition hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M9 4v3a2 2 0 0 1-2 2H4M20 9h-3a2 2 0 0 1-2-2V4M4 15h3a2 2 0 0 1 2 2v3M15 20v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : null}
      </div>

      {/* Waiting / closed overlays */}
      {scheduled ? (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <span className="text-5xl" aria-hidden>
            ⏱
          </span>
          <p className="mt-4 text-2xl font-bold">直播即将开始</p>
          <p className="mt-2 text-sm text-slate-300">
            {session.scheduledStartAt
              ? new Date(session.scheduledStartAt).toLocaleString('zh-CN')
              : '开播时间待定'}
          </p>
          {Number.isFinite(countdownMs) && countdownMs > 0 ? (
            <p className="mt-1 font-mono text-sm font-semibold text-sky-300">
              {formatLiveCountdown(countdownMs)}后开播
            </p>
          ) : null}
          <Button className="mt-5" variant={reminded ? 'outline' : 'primary'} onClick={onRemind}>
            {reminded ? '已预约' : '预约提醒'}
          </Button>
        </div>
      ) : null}

      {!live && !scheduled ? (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <span className="text-5xl" aria-hidden>
            🎬
          </span>
          <p className="mt-4 text-2xl font-bold">直播已结束</p>
          <p className="mt-2 text-sm text-slate-300">
            {(session.actualEndAt || session.scheduledEndAt)
              ? new Date(session.actualEndAt || session.scheduledEndAt).toLocaleString('zh-CN')
              : ''}
          </p>
          <Button className="mt-5" loading={replayLoading} onClick={onReplay}>
            查看回放
          </Button>
        </div>
      ) : null}

      {/* Douyin-style bottom control bar (live only) */}
      {live ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent px-5 pb-4 pt-10">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 font-mono text-[13px] font-bold tracking-wide text-white/90 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
              直播进行中 · {formatLiveElapsed(elapsedSeconds)}
            </span>
            <Badge tone="neutral" className="border-white/15 bg-white/10 text-white/80">
              高清
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {session.providerRoomRef ? (
              <a
                href={session.providerRoomRef}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M14 5h5v5M19 5l-7 7M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                服务商页面观看
              </a>
            ) : null}
            {streamPlaying ? (
              <button
                type="button"
                onClick={toggleStreamMute}
                aria-label={streamMuted ? '开启声音' : '静音'}
                title={streamMuted ? '开启声音' : '静音'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 backdrop-blur transition hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {streamMuted ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M11 5 6.5 8.5H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.5L11 19V5Z" strokeLinejoin="round" />
                    <path d="m16 9 5 6M21 9l-5 6" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M11 5 6.5 8.5H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.5L11 19V5Z" strokeLinejoin="round" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
              title={isFullscreen ? '退出全屏' : '进入全屏'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 backdrop-blur transition hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M9 4v3a2 2 0 0 1-2 2H4M20 9h-3a2 2 0 0 1-2-2V4M4 15h3a2 2 0 0 1 2 2v3M15 20v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
