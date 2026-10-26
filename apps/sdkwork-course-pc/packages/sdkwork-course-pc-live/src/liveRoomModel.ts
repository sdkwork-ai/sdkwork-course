import { readEntityNumber, readEntityString } from '@sdkwork/sdkwork-course-pc-core'

/** Live-session status values produced by the course service state machine. */
export type LiveSessionStatus =
  | 'live'
  | 'scheduled'
  | 'ended'
  | 'recording_processing'
  | 'replay_ready'
  | (string & {})

export interface LiveSessionView {
  id: string
  title: string
  description: string
  liveStatus: LiveSessionStatus
  scheduledStartAt: string
  scheduledEndAt: string
  actualStartAt: string
  actualEndAt: string
  providerRoomRef: string
  attendeeCount: number
  coverUrl?: string
  instructorName?: string
  courseId?: string
  /** Stream address (HLS/MP4) from the session metadata bag, if provisioned. */
  playbackUrl?: string
}

function readMetadata(record: Record<string, unknown>): Record<string, unknown> {
  const value = record.metadata
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

/**
 * Map a course live-session payload (list row or retrieve item) onto the room
 * view model. Cover and instructor fields are optional reads over both the
 * entity and its metadata bag so the page lights up automatically once the
 * backend starts returning them, without a contract change on the frontend.
 */
export function mapLiveSession(record: Record<string, unknown>): LiveSessionView {
  const metadata = readMetadata(record)
  const coverUrl =
    readEntityString(record, 'coverUrl', 'cover_url') ||
    readEntityString(metadata, 'coverUrl', 'cover_url')
  const instructorName =
    readEntityString(record, 'instructorName', 'instructor_name') ||
    readEntityString(metadata, 'instructorName', 'instructor_name')
  const courseId = readEntityString(record, 'courseId', 'course_id')
  const playbackUrl =
    readEntityString(record, 'playbackUrl', 'playback_url', 'hlsUrl', 'hls_url') ||
    readEntityString(
      metadata,
      'playbackUrl',
      'playback_url',
      'hlsUrl',
      'hls_url',
      'streamUrl',
      'stream_url',
    )

  return {
    id: readEntityString(record, 'id', 'liveSessionId', 'live_session_id'),
    title: readEntityString(record, 'title', 'name'),
    description: readEntityString(record, 'description'),
    liveStatus: readEntityString(record, 'liveStatus', 'live_status') || 'scheduled',
    scheduledStartAt: readEntityString(record, 'scheduledStartAt', 'scheduled_start_at'),
    scheduledEndAt: readEntityString(record, 'scheduledEndAt', 'scheduled_end_at'),
    actualStartAt: readEntityString(record, 'actualStartAt', 'actual_start_at'),
    actualEndAt: readEntityString(record, 'actualEndAt', 'actual_end_at'),
    providerRoomRef: readEntityString(record, 'providerRoomRef', 'provider_room_ref'),
    attendeeCount: readEntityNumber(
      record,
      'attendeeCountSnapshot',
      'attendee_count_snapshot',
      'viewerCount',
      'viewer_count',
    ) ?? 0,
    coverUrl: coverUrl || undefined,
    instructorName: instructorName || undefined,
    courseId: courseId || undefined,
    playbackUrl: playbackUrl || undefined,
  }
}

export function isLiveNow(session: Pick<LiveSessionView, 'liveStatus'>): boolean {
  return session.liveStatus === 'live'
}

export function isScheduledStatus(session: Pick<LiveSessionView, 'liveStatus'>): boolean {
  return session.liveStatus === 'scheduled'
}

export function isClosedStatus(session: Pick<LiveSessionView, 'liveStatus'>): boolean {
  return ['ended', 'recording_processing', 'replay_ready'].includes(session.liveStatus)
}

export function liveStatusLabel(status: LiveSessionStatus): string {
  if (status === 'live') return '直播中'
  if (status === 'scheduled') return '即将开始'
  if (status === 'replay_ready') return '回放已就绪'
  if (status === 'recording_processing') return '回放生成中'
  return '已结束'
}

/** Rank used to sort the live list: ongoing first, upcoming next, closed last. */
export function liveSessionSortRank(session: LiveSessionView): number {
  if (isLiveNow(session)) return 0
  if (isScheduledStatus(session)) return 1
  return 2
}

/** `01:24:30` style wall clock used for the on-stage elapsed timer. */
export function formatLiveElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** Human countdown such as `2 天 04:12:33`; day remainders fold into HH:MM:SS. */
export function formatLiveCountdown(msRemaining: number): string {
  const safe = Math.max(0, Math.floor(msRemaining))
  const days = Math.floor(safe / 86_400_000)
  const rest = formatLiveElapsed((safe % 86_400_000) / 1000)
  return days > 0 ? `${days} 天 ${rest}` : rest
}

/** Compact chat timestamp: `HH:mm` today, `M/D HH:mm` otherwise. */
export function formatChatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return clock
  return `${date.getMonth() + 1}/${date.getDate()} ${clock}`
}

/** Stable hue per session id so gradient covers stay consistent across visits. */
export function liveCoverHue(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360
  }
  return hash
}

/** Resolve the media timestamp a live timer should count from. */
export function liveStartClockMs(session: LiveSessionView): number {
  const started = Date.parse(session.actualStartAt)
  if (!Number.isNaN(started)) return started
  const scheduled = Date.parse(session.scheduledStartAt)
  return Number.isNaN(scheduled) ? Date.now() : scheduled
}
