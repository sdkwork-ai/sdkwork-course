import { readEntityNumber, readEntityString } from '@sdkwork/sdkwork-course-pc-core'
import { parseTags } from '@sdkwork/sdkwork-course-pc-commons'

export interface CourseSummary {
  id: string
  courseCode: string
  title: string
  subtitle?: string
  summary?: string
  description?: string
  thumbnail?: string
  author?: string
  lessonsCount: number
  studentsCount: number
  ratingScore: string
  level?: string
  category?: string
  categoryId?: string
  tags: string[]
  status: string
  publishStatus: string
  kind: 'standard' | 'column' | 'collection'
  isFree: boolean
  priceAmount?: string
  originalPriceAmount?: string
  currency?: string
  reviewNote?: string
  submittedAt?: string
  reviewedAt?: string
  publishedAt?: string
  reviewRound: number
  durationSeconds: number
  itemCount: number
  updatedAt?: string
}

export interface CurriculumLesson {
  id: string
  courseId: string
  sectionId?: string
  lessonNo?: string
  title: string
  description?: string
  durationSeconds: number
  durationText?: string
  content?: string
  freePreview: boolean
  sortWeight: number
  status: string
  kind?: string
  externalSourceId?: string
  sourceProvider?: string
}

export interface CurriculumSection {
  id: string
  courseId: string
  sectionNo?: string
  title: string
  description?: string
  lessonCount: number
  durationSeconds: number
  sortWeight: number
  status: string
}

export interface CurriculumResource {
  id: string
  ownerType: string
  ownerId: string
  resourceRole: string
  driveResourceId: string
  mimeType?: string
  durationSeconds?: number
  fileSizeBytes?: number
  sortOrder: number
}

export interface CourseCurriculum {
  courseId: string
  sections: CurriculumSection[]
  lessons: CurriculumLesson[]
  resources: CurriculumResource[]
}

export interface CollectionItem {
  courseId: string
  title: string
  cover?: string
  kind: string
  lessonsCount: number
  durationSeconds: number
  sortOrder: number
  authorDisplayName?: string
}

export interface StudioCourseDetail {
  course: CourseSummary
  sections: CurriculumSection[]
  lessons: CurriculumLesson[]
  resources: CurriculumResource[]
  collectionItems: CollectionItem[]
}

function readBoolean(record: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      if (value === 'true' || value === '1') return true
      if (value === 'false' || value === '0') return false
    }
  }
  return false
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function mapCourse(value: unknown): CourseSummary {
  const record = asRecord(value)
  const kind = readEntityString(record, 'kind', 'courseKind', 'course_kind') || 'standard'
  const isFree = readBoolean(record, 'isFree', 'is_free')
  return {
    id: readEntityString(record, 'id', 'courseId'),
    courseCode: readEntityString(record, 'courseCode', 'course_code'),
    title: readEntityString(record, 'title', 'name') || '未命名课程',
    subtitle: readEntityString(record, 'subtitle') || undefined,
    summary: readEntityString(record, 'summary') || undefined,
    description: readEntityString(record, 'description') || undefined,
    thumbnail: readEntityString(record, 'thumbnail', 'cover', 'coverUrl') || undefined,
    author:
      readEntityString(record, 'authorDisplayName', 'author_display_name', 'author', 'instructor') ||
      undefined,
    lessonsCount: readEntityNumber(record, 'lessonsCount', 'lessons_count') ?? 0,
    studentsCount: readEntityNumber(record, 'studentsCount', 'students_count') ?? 0,
    ratingScore: readEntityString(record, 'ratingScore', 'rating_score') || '0',
    level: readEntityString(record, 'level', 'difficultyLevel') || undefined,
    category: readEntityString(record, 'category', 'categoryName', 'category_name') || undefined,
    categoryId: readEntityString(record, 'categoryId', 'category_id') || undefined,
    tags: parseTags(record.tags),
    status: readEntityString(record, 'status') || 'active',
    publishStatus:
      readEntityString(record, 'publishStatus', 'publish_status') ||
      readEntityString(record, 'status') ||
      'draft',
    kind: kind === 'column' || kind === 'collection' ? kind : 'standard',
    isFree,
    priceAmount: readEntityString(record, 'priceAmount', 'price_amount') || undefined,
    originalPriceAmount:
      readEntityString(record, 'originalPriceAmount', 'original_price_amount') || undefined,
    currency: readEntityString(record, 'currency') || undefined,
    reviewNote: readEntityString(record, 'reviewNote', 'review_note') || undefined,
    submittedAt: readEntityString(record, 'submittedAt', 'submitted_at') || undefined,
    reviewedAt: readEntityString(record, 'reviewedAt', 'reviewed_at') || undefined,
    publishedAt: readEntityString(record, 'publishedAt', 'published_at') || undefined,
    reviewRound: readEntityNumber(record, 'reviewRound', 'review_round') ?? 0,
    durationSeconds: readEntityNumber(record, 'durationSeconds', 'estimatedDurationSeconds') ?? 0,
    itemCount: readEntityNumber(record, 'itemCount', 'item_count') ?? 0,
    updatedAt: readEntityString(record, 'updatedAt', 'updated_at') || undefined,
  }
}

export function mapSection(value: unknown): CurriculumSection {
  const record = asRecord(value)
  return {
    id: readEntityString(record, 'id', 'sectionId'),
    courseId: readEntityString(record, 'courseId', 'course_id'),
    sectionNo: readEntityString(record, 'sectionNo', 'section_no') || undefined,
    title: readEntityString(record, 'title', 'name') || '未命名章节',
    description: readEntityString(record, 'description') || undefined,
    lessonCount: readEntityNumber(record, 'lessonCount', 'lesson_count') ?? 0,
    durationSeconds: readEntityNumber(record, 'durationSeconds', 'duration_seconds') ?? 0,
    sortWeight: readEntityNumber(record, 'sortWeight', 'sort_weight', 'sortOrder') ?? 0,
    status: readEntityString(record, 'status') || 'active',
  }
}

export function mapLesson(value: unknown): CurriculumLesson {
  const record = asRecord(value)
  return {
    id: readEntityString(record, 'id', 'lessonId'),
    courseId: readEntityString(record, 'courseId', 'course_id'),
    sectionId: readEntityString(record, 'sectionId', 'section_id') || undefined,
    lessonNo: readEntityString(record, 'lessonNo', 'lesson_no') || undefined,
    title: readEntityString(record, 'title', 'name') || '未命名课时',
    description: readEntityString(record, 'description', 'summary') || undefined,
    durationSeconds: readEntityNumber(record, 'durationSeconds', 'duration_seconds') ?? 0,
    durationText: readEntityString(record, 'durationText', 'duration_text') || undefined,
    content: readEntityString(record, 'content') || undefined,
    freePreview: readBoolean(record, 'freePreview', 'free_preview'),
    sortWeight: readEntityNumber(record, 'sortWeight', 'sort_weight', 'sortOrder') ?? 0,
    status: readEntityString(record, 'status') || 'active',
    kind: readEntityString(record, 'kind', 'lessonKind') || undefined,
    externalSourceId:
      readEntityString(record, 'externalSourceId', 'external_source_id') || undefined,
    sourceProvider: readEntityString(record, 'sourceProvider', 'source_provider') || undefined,
  }
}

export function mapResource(value: unknown): CurriculumResource {
  const record = asRecord(value)
  return {
    id: readEntityString(record, 'id', 'resourceRefId'),
    ownerType: readEntityString(record, 'ownerType', 'owner_type'),
    ownerId: readEntityString(record, 'ownerId', 'owner_id'),
    resourceRole: readEntityString(record, 'resourceRole', 'resource_role'),
    driveResourceId: readEntityString(record, 'driveResourceId', 'drive_resource_id'),
    mimeType: readEntityString(record, 'mimeType', 'mime_type') || undefined,
    durationSeconds: readEntityNumber(record, 'durationSeconds', 'duration_seconds') ?? undefined,
    fileSizeBytes: readEntityNumber(record, 'fileSizeBytes', 'file_size_bytes') ?? undefined,
    sortOrder: readEntityNumber(record, 'sortOrder', 'sort_order') ?? 0,
  }
}

export function mapCollectionItem(value: unknown): CollectionItem {
  const record = asRecord(value)
  return {
    courseId: readEntityString(record, 'courseId', 'course_id', 'id'),
    title: readEntityString(record, 'title', 'name') || '未命名课程',
    cover: readEntityString(record, 'cover', 'thumbnail') || undefined,
    kind: readEntityString(record, 'kind') || 'standard',
    lessonsCount: readEntityNumber(record, 'lessonsCount', 'lessons_count') ?? 0,
    durationSeconds: readEntityNumber(record, 'durationSeconds', 'duration_seconds') ?? 0,
    sortOrder: readEntityNumber(record, 'sortOrder', 'sort_order') ?? 0,
    authorDisplayName:
      readEntityString(record, 'authorDisplayName', 'author_display_name') || undefined,
  }
}

export function mapCurriculum(value: unknown): CourseCurriculum {
  const record = asRecord(value)
  const sections = Array.isArray(record.sections) ? record.sections.map(mapSection) : []
  const lessons = Array.isArray(record.lessons) ? record.lessons.map(mapLesson) : []
  const resources = Array.isArray(record.resources) ? record.resources.map(mapResource) : []
  return {
    courseId: readEntityString(record, 'courseId', 'course_id'),
    sections,
    lessons,
    resources,
  }
}

export function mapStudioDetail(value: unknown): StudioCourseDetail {
  const record = asRecord(value)
  const courseRecord = asRecord(record.course)
  return {
    course: mapCourse(courseRecord),
    sections: Array.isArray(record.sections) ? record.sections.map(mapSection) : [],
    lessons: Array.isArray(record.lessons) ? record.lessons.map(mapLesson) : [],
    resources: Array.isArray(record.resources) ? record.resources.map(mapResource) : [],
    collectionItems: Array.isArray(record.collectionItems)
      ? record.collectionItems.map(mapCollectionItem)
      : [],
  }
}

export function readPageItems(data: unknown): unknown[] {
  const record = asRecord(data)
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.records)) return record.records
  if (Array.isArray(record.list)) return record.list
  return []
}

export function readPageTotal(data: unknown): number {
  const record = asRecord(data)
  const pageInfo = asRecord(record.pageInfo)
  return (
    readEntityNumber(record, 'total') ??
    readEntityNumber(pageInfo, 'totalItems') ??
    readEntityNumber(record, 'totalItems') ??
    0
  )
}

export function buildCurriculumTree(curriculum: CourseCurriculum) {
  const lessonsBySection = new Map<string, CurriculumLesson[]>()
  const ungrouped: CurriculumLesson[] = []
  for (const lesson of curriculum.lessons) {
    if (lesson.sectionId) {
      const list = lessonsBySection.get(lesson.sectionId) ?? []
      list.push(lesson)
      lessonsBySection.set(lesson.sectionId, list)
    } else {
      ungrouped.push(lesson)
    }
  }
  const sections = curriculum.sections.map((section) => ({
    section,
    lessons: lessonsBySection.get(section.id) ?? [],
  }))
  if (ungrouped.length > 0) {
    sections.push({
      section: {
        id: '__ungrouped__',
        courseId: curriculum.courseId,
        title: '全部内容',
        lessonCount: ungrouped.length,
        durationSeconds: ungrouped.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
        sortWeight: 9999,
        status: 'active',
      },
      lessons: ungrouped,
    })
  }
  return sections
}

export function findLessonResources(
  resources: CurriculumResource[],
  lessonId: string,
): CurriculumResource[] {
  return resources.filter((resource) => resource.ownerId === lessonId)
}
