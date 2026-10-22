export type CourseKind = 'standard' | 'column' | 'collection' | string

const KIND_LABELS: Record<string, string> = {
  standard: '课程',
  column: '专栏',
  collection: '合集',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  reviewing: '审核中',
  published: '已发布',
  unpublished: '已下架',
  archived: '已归档',
  active: '有效',
  deleted: '已删除',
}

export function kindLabel(kind?: string | null): string {
  return KIND_LABELS[kind ?? ''] ?? '课程'
}

export function statusLabel(status?: string | null): string {
  return STATUS_LABELS[status ?? ''] ?? status ?? '未知'
}

/** A rejected draft keeps `draft` publish state but carries a review note. */
export function reviewStateLabel(
  publishStatus?: string | null,
  reviewedAt?: string | null,
  reviewNote?: string | null,
): string {
  if (publishStatus === 'reviewing') return '审核中'
  if (publishStatus === 'published') return '已发布'
  if (publishStatus === 'unpublished') return '已下架'
  if (publishStatus === 'archived') return '已归档'
  if (reviewedAt && reviewNote) return '已退回'
  return '草稿'
}

export function formatPrice(
  priceAmount?: string | null,
  isFree = true,
  currency?: string | null,
): string {
  if (isFree) return '免费'
  const amount = Number(priceAmount ?? '')
  if (!Number.isFinite(amount) || amount <= 0) return '免费'
  const symbol = currency === 'CNY' || !currency ? '¥' : `${currency} `
  return `${symbol}${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '--'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(minutes, 1)} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

/** Compact `H:MM:SS` / `M:SS` duration used on media cards. */
export function formatCompactDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return ''
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function formatCompactCount(value?: number | null): string {
  if (value == null || value <= 0) return '0'
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

const CATEGORY_LABELS: Record<string, string> = {
  'course-category-ai': 'AI 与大模型',
  'course-category-programming': '编程开发',
  'course-category-design': '设计创意',
  'course-category-business': '商业管理',
  'course-category-language': '语言学习',
  'course-category-career': '职场效率',
}

/** Presents a category id or name without leaking internal ids into the UI. */
export function formatCategory(value?: string | null): string {
  if (!value) return '未分类'
  if (CATEGORY_LABELS[value]) return CATEGORY_LABELS[value]
  if (value.startsWith('course-category-')) {
    return value.slice('course-category-'.length).replace(/-/g, ' ')
  }
  return value
}

export function formatCount(value?: number | null): string {
  if (value == null || value <= 0) return '0'
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`
  return String(value)
}

export function formatDate(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return formatDate(value)
}

export function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === 'string')
  if (typeof tags === 'string' && tags.trim()) {
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed)
        ? parsed.filter((tag): tag is string => typeof tag === 'string')
        : []
    } catch {
      return tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    }
  }
  return []
}

export interface ResolvedCover {
  url?: string
  fallbackHue: number
}

/**
 * Covers are stored as either a Drive media-resource JSON snapshot or a plain
 * URL (legacy/seed rows). Resolve both and keep a deterministic hue for the
 * gradient fallback.
 */
export function resolveCourseCover(
  thumbnail?: string | null,
  seed?: string | null,
): ResolvedCover {
  const hue = hashHue(seed || thumbnail || 'course')
  if (!thumbnail) return { fallbackHue: hue }
  const trimmed = thumbnail.trim()
  if (!trimmed) return { fallbackHue: hue }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const metadata =
        parsed.metadata && typeof parsed.metadata === 'object'
          ? (parsed.metadata as Record<string, unknown>)
          : undefined
      const url =
        pickString(metadata?.previewUrl) ??
        pickString(parsed.url) ??
        pickString(parsed.previewUrl) ??
        pickString(parsed.coverUrl) ??
        pickString(parsed.resourceUrl)
      return { url, fallbackHue: hue }
    } catch {
      return { fallbackHue: hue }
    }
  }
  return /^https?:\/\//u.test(trimmed) ? { url: trimmed, fallbackHue: hue } : { fallbackHue: hue }
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function hashHue(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360
  }
  return hash
}
