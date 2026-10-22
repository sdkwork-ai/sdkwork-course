export interface StudioResourceDraft {
  driveResourceId: string
  resourceRole: string
  mimeType?: string
  fileName?: string
  fileSizeBytes?: number
  durationSeconds?: number
}

export interface StudioLessonDraft {
  clientId: string
  id?: string
  lessonKind: string
  title: string
  summary?: string
  content?: string
  durationSeconds: number
  freePreview: boolean
  externalSourceId?: string
  sourceProvider?: string
  sortOrder: number
  resources: StudioResourceDraft[]
  existingResourceCount?: number
}

export interface StudioSectionDraft {
  clientId: string
  id?: string
  title: string
  description?: string
  sortOrder: number
  lessons: StudioLessonDraft[]
}

export interface StudioCoverDraft {
  driveResourceId: string
  role: 'cover'
  mimeType?: string
  fileName?: string
  metadata?: { previewUrl?: string }
}

export interface StudioDraft {
  courseId?: string
  title: string
  subtitle?: string
  summary?: string
  description?: string
  categoryId?: string
  level?: string
  tags: string[]
  kind: 'standard' | 'column' | 'collection'
  cover?: StudioCoverDraft
  coverPreviewUrl?: string
  priceAmount?: string
  originalPriceAmount?: string
  currency: string
  isFree: boolean
  authorDisplayName?: string
  sections: StudioSectionDraft[]
  collectionItems: string[]
}

export interface StudioCoursePayload {
  title: string
  subtitle?: string
  summary?: string
  description?: string
  categoryId?: string
  level?: string
  tags: string[]
  kind: string
  cover?: { driveResourceId: string; role: string; mimeType?: string; metadata?: { previewUrl?: string } }
  priceAmount?: string
  originalPriceAmount?: string
  currency?: string
  isFree: boolean
  authorDisplayName?: string
  sections: Array<{
    title: string
    description?: string
    sortOrder: number
    lessons: Array<{
      lessonKind: string
      title: string
      summary?: string
      content?: string
      durationSeconds: number
      freePreview: boolean
      externalSourceId?: string
      sourceProvider?: string
      sortOrder: number
      resources: Array<{
        driveResourceId: string
        resourceRole: string
        mimeType?: string
        fileName?: string
        fileSizeBytes?: number
        durationSeconds?: number
      }>
    }>
  }>
  collectionItems: string[]
}

export const LESSON_KIND_OPTIONS = [
  { value: 'vod_video', label: '视频课时' },
  { value: 'article', label: '图文课时' },
  { value: 'live_session', label: '直播课时' },
  { value: 'download', label: '资料下载' },
  { value: 'quiz', label: '测验' },
  { value: 'assignment', label: '作业' },
]

export const COURSE_KIND_OPTIONS = [
  { value: 'standard', label: '体系课程', description: '按章节组织课时，适合系统学习' },
  { value: 'column', label: '专栏', description: '围绕主题持续更新的系列内容' },
  { value: 'collection', label: '合集', description: '把多门已发布课程组合成学习路径' },
]

export function newClientId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyLesson(sortOrder: number): StudioLessonDraft {
  return {
    clientId: newClientId('lesson'),
    lessonKind: 'vod_video',
    title: '',
    durationSeconds: 0,
    freePreview: false,
    sortOrder,
    resources: [],
    existingResourceCount: 0,
  }
}

export function createEmptySection(sortOrder: number): StudioSectionDraft {
  return {
    clientId: newClientId('section'),
    title: '',
    sortOrder,
    lessons: [createEmptyLesson(1)],
  }
}

export function emptyDraft(kind: StudioDraft['kind'] = 'standard'): StudioDraft {
  return {
    title: '',
    subtitle: '',
    summary: '',
    description: '',
    categoryId: '',
    level: '',
    tags: [],
    kind,
    currency: 'CNY',
    isFree: true,
    priceAmount: '',
    originalPriceAmount: '',
    authorDisplayName: '',
    sections: kind === 'collection' ? [] : [createEmptySection(0)],
    collectionItems: [],
  }
}

export function toPayload(draft: StudioDraft): StudioCoursePayload {
  return {
    title: draft.title.trim(),
    subtitle: draft.subtitle?.trim() || undefined,
    summary: draft.summary?.trim() || undefined,
    description: draft.description?.trim() || undefined,
    categoryId: draft.categoryId || undefined,
    level: draft.level || undefined,
    tags: draft.tags,
    kind: draft.kind,
    cover: draft.cover
      ? {
          driveResourceId: draft.cover.driveResourceId,
          role: 'cover',
          mimeType: draft.cover.mimeType,
          ...(draft.cover.metadata ? { metadata: draft.cover.metadata } : {}),
        }
      : undefined,
    priceAmount: draft.isFree ? undefined : draft.priceAmount?.trim() || undefined,
    originalPriceAmount:
      !draft.isFree && draft.originalPriceAmount?.trim() ? draft.originalPriceAmount.trim() : undefined,
    currency: draft.isFree ? undefined : draft.currency,
    isFree: draft.isFree,
    authorDisplayName: draft.authorDisplayName?.trim() || undefined,
    sections:
      draft.kind === 'collection'
        ? []
        : draft.sections.map((section, sectionIndex) => ({
            title: section.title.trim(),
            description: section.description?.trim() || undefined,
            sortOrder: sectionIndex,
            lessons: section.lessons.map((lesson, lessonIndex) => ({
              lessonKind: lesson.lessonKind,
              title: lesson.title.trim(),
              summary: lesson.summary?.trim() || undefined,
              content: lesson.content?.trim() || undefined,
              durationSeconds: Math.max(0, Math.round(lesson.durationSeconds)),
              freePreview: lesson.freePreview,
              externalSourceId: lesson.externalSourceId?.trim() || undefined,
              sourceProvider: lesson.sourceProvider?.trim() || undefined,
              sortOrder: lessonIndex,
              resources: lesson.resources.map((resource) => ({
                driveResourceId: resource.driveResourceId,
                resourceRole: resource.resourceRole,
                mimeType: resource.mimeType,
                fileName: resource.fileName,
                fileSizeBytes: resource.fileSizeBytes,
                durationSeconds: resource.durationSeconds,
              })),
            })),
          })),
    collectionItems: draft.kind === 'collection' ? draft.collectionItems : [],
  }
}

export interface StudioDetailSource {
  course: {
    id: string
    title: string
    subtitle?: string
    summary?: string
    description?: string
    categoryId?: string
    category?: string
    level?: string
    tags: string[]
    kind: string
    thumbnail?: string
    priceAmount?: string
    originalPriceAmount?: string
    currency?: string
    isFree: boolean
    author?: string
  }
  sections: Array<{
    id: string
    title: string
    description?: string
    sortWeight: number
  }>
  lessons: Array<{
    id: string
    sectionId?: string
    title: string
    description?: string
    content?: string
    durationSeconds: number
    freePreview: boolean
    kind?: string
    externalSourceId?: string
    sourceProvider?: string
    sortWeight: number
  }>
  resources: Array<{
    id: string
    ownerId: string
    resourceRole: string
    driveResourceId: string
    mimeType?: string
    fileSizeBytes?: number
    durationSeconds?: number
    sortOrder: number
  }>
  collectionItems: Array<{ courseId: string }>
}

export function draftFromDetail(detail: StudioDetailSource): StudioDraft {
  const { course } = detail
  let cover: StudioCoverDraft | undefined
  let coverPreviewUrl: string | undefined
  if (course.thumbnail?.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(course.thumbnail) as Record<string, unknown>
      const driveResourceId =
        typeof parsed.driveResourceId === 'string' ? parsed.driveResourceId : undefined
      if (driveResourceId) {
        const metadata =
          parsed.metadata && typeof parsed.metadata === 'object'
            ? (parsed.metadata as Record<string, unknown>)
            : undefined
        const previewUrl =
          typeof metadata?.previewUrl === 'string'
            ? metadata.previewUrl
            : typeof parsed.previewUrl === 'string'
              ? parsed.previewUrl
              : typeof parsed.url === 'string'
                ? parsed.url
                : undefined
        cover = {
          driveResourceId,
          role: 'cover',
          mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : undefined,
          fileName: typeof parsed.fileName === 'string' ? parsed.fileName : undefined,
          ...(previewUrl ? { metadata: { previewUrl } } : {}),
        }
        coverPreviewUrl = previewUrl
      }
    } catch {
      coverPreviewUrl = undefined
    }
  } else if (course.thumbnail && /^https?:\/\//u.test(course.thumbnail)) {
    coverPreviewUrl = course.thumbnail
  }

  const resourcesByLesson = new Map<string, StudioResourceDraft[]>()
  for (const resource of detail.resources) {
    const list = resourcesByLesson.get(resource.ownerId) ?? []
    list.push({
      driveResourceId: resource.driveResourceId,
      resourceRole: resource.resourceRole,
      mimeType: resource.mimeType,
      fileSizeBytes: resource.fileSizeBytes,
      durationSeconds: resource.durationSeconds,
    })
    resourcesByLesson.set(resource.ownerId, list)
  }

  const lessonsBySection = new Map<string, typeof detail.lessons>()
  for (const lesson of detail.lessons) {
    const key = lesson.sectionId ?? '__ungrouped__'
    const list = lessonsBySection.get(key) ?? []
    list.push(lesson)
    lessonsBySection.set(key, list)
  }

  const sections: StudioSectionDraft[] = detail.sections.map((section, index) => ({
    clientId: `section-${section.id}`,
    id: section.id,
    title: section.title,
    description: section.description,
    sortOrder: index,
    lessons: (lessonsBySection.get(section.id) ?? []).map((lesson, lessonIndex) => ({
      clientId: `lesson-${lesson.id}`,
      id: lesson.id,
      lessonKind: lesson.kind ?? 'vod_video',
      title: lesson.title,
      summary: lesson.description,
      content: lesson.content,
      durationSeconds: lesson.durationSeconds,
      freePreview: lesson.freePreview,
      externalSourceId: lesson.externalSourceId,
      sourceProvider: lesson.sourceProvider,
      sortOrder: lessonIndex,
      resources: resourcesByLesson.get(lesson.id) ?? [],
      existingResourceCount: (resourcesByLesson.get(lesson.id) ?? []).length,
    })),
  }))

  const ungrouped = lessonsBySection.get('__ungrouped__') ?? []
  if (ungrouped.length > 0) {
    sections.push({
      clientId: 'section-ungrouped',
      title: '全部内容',
      description: '未归入章节的课时',
      sortOrder: sections.length,
      lessons: ungrouped.map((lesson, lessonIndex) => ({
        clientId: `lesson-${lesson.id}`,
        id: lesson.id,
        lessonKind: lesson.kind ?? 'vod_video',
        title: lesson.title,
        summary: lesson.description,
        content: lesson.content,
        durationSeconds: lesson.durationSeconds,
        freePreview: lesson.freePreview,
        externalSourceId: lesson.externalSourceId,
        sourceProvider: lesson.sourceProvider,
        sortOrder: lessonIndex,
        resources: resourcesByLesson.get(lesson.id) ?? [],
        existingResourceCount: (resourcesByLesson.get(lesson.id) ?? []).length,
      })),
    })
  }

  return {
    courseId: course.id,
    title: course.title,
    subtitle: course.subtitle ?? '',
    summary: course.summary ?? '',
    description: course.description ?? '',
    categoryId: course.categoryId ?? '',
    level: course.level ?? '',
    tags: course.tags,
    kind:
      course.kind === 'column' || course.kind === 'collection'
        ? course.kind
        : 'standard',
    cover,
    coverPreviewUrl,
    priceAmount: course.priceAmount ?? '',
    originalPriceAmount: course.originalPriceAmount ?? '',
    currency: course.currency ?? 'CNY',
    isFree: course.isFree,
    authorDisplayName: course.author ?? '',
    sections: course.kind === 'collection' ? [] : sections,
    collectionItems: detail.collectionItems.map((item) => item.courseId),
  }
}

