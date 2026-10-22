import { getCourseConsolePcHost } from '../courseConsoleHost';
import { uploadCourseMediaFile } from '@sdkwork/sdkwork-course-pc-core';
import {
  readNumber,
  readRecords,
  readSingleRecord,
  readString,
  unwrapCourseBackendEnvelope,
  asRecord,
} from './courseBackendResponse';

export interface ConsoleCourseItem {
  id: string;
  courseCode: string;
  title: string;
  status: string;
  publishStatus: string;
  kind: string;
  author?: string;
  reviewNote?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewRound: number;
  summary?: string;
  priceAmount?: string;
  isFree: boolean;
  currency?: string;
  studentsCount: number;
  lessonsCount: number;
  category?: string;
  instructor?: string;
}

export interface ConsoleReviewStats {
  pending: number;
  changesRequested: number;
  published: number;
  ugcTotal: number;
  ugcPublished: number;
  pendingOverdue: number;
  avgReviewHours: number;
}

export interface ConsoleReviewDetail {
  course: ConsoleCourseItem;
  sections: Array<{ id: string; title: string; lessonCount: number }>;
  lessons: Array<{
    id: string;
    sectionId?: string;
    title: string;
    kind?: string;
    durationSeconds: number;
    freePreview: boolean;
    content?: string;
    externalSourceId?: string;
    sourceProvider?: string;
  }>;
  resources: Array<{ id: string; ownerId: string; resourceRole: string; driveResourceId: string }>;
  collectionItems: Array<{ courseId: string; title: string; kind: string; lessonsCount: number }>;
  auditLogs: Array<{ id: string; operationId: string; actorId?: string; createdAt: string }>;
}

export interface ConsoleCourseListResult {
  items: ConsoleCourseItem[];
  total: number;
}

export interface CreateConsoleCourseInput {
  title: string;
  subtitle?: string;
  description?: string;
}

export interface ConsoleCourseCategoryItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder: number;
}

export interface ConsoleCourseCategoryListResult {
  items: ConsoleCourseCategoryItem[];
  total: number;
}

export interface CreateConsoleCourseCategoryInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface ConsoleCourseSectionItem {
  id: string;
  courseId: string;
  title: string;
  lessonCount: number;
  sortOrder: number;
  status: string;
}

export interface ConsoleCourseLessonItem {
  id: string;
  courseId: string;
  sectionId?: string;
  title: string;
  durationSeconds: number;
  freePreview: boolean;
  status: string;
  /** Lesson form: vod_video / live_session / article / download / quiz / assignment. */
  kind?: string;
  /** External source id (e.g. bilibili BV id) for connected lessons. */
  externalSourceId?: string;
  /** External source provider (`bilibili`, `manual`, ...). */
  sourceProvider?: string;
}

export interface CreateConsoleCourseSectionInput {
  title: string;
  description?: string;
}

export interface CreateConsoleCourseLessonInput {
  title: string;
  sectionId?: string;
  description?: string;
  freePreview?: boolean;
  /** Lesson form: vod_video / live_session / article / download / quiz / assignment. */
  kind?: string;
  /** External source id (e.g. bilibili BV id) for connected lessons. */
  externalSourceId?: string;
  /** External source provider (`bilibili`, `manual`, ...). */
  sourceProvider?: string;
}

function mapCategoryItem(record: ReturnType<typeof asRecord>): ConsoleCourseCategoryItem {
  return {
    id: readString(record, ['id', 'categoryId']),
    name: readString(record, ['name', 'title'], '未命名分类'),
    slug: readString(record, ['slug', 'code']),
    status: readString(record, ['status'], 'active'),
    sortOrder: readNumber(record, ['sortOrder', 'sort_order', 'order']),
  };
}

function mapSectionItem(record: ReturnType<typeof asRecord>): ConsoleCourseSectionItem {
  return {
    id: readString(record, ['id', 'sectionId']),
    courseId: readString(record, ['courseId', 'course_id']),
    title: readString(record, ['title', 'name'], '未命名章节'),
    lessonCount: readNumber(record, ['lessonCount', 'lesson_count']),
    sortOrder: readNumber(record, ['sortWeight', 'sort_weight', 'sortOrder']),
    status: readString(record, ['status'], 'active'),
  };
}

function mapLessonItem(record: ReturnType<typeof asRecord>): ConsoleCourseLessonItem {
  return {
    id: readString(record, ['id', 'lessonId']),
    courseId: readString(record, ['courseId', 'course_id']),
    sectionId: readString(record, ['sectionId', 'section_id']) || undefined,
    title: readString(record, ['title', 'name'], '未命名课时'),
    durationSeconds: readNumber(record, ['durationSeconds', 'duration_seconds']),
    freePreview: Boolean(record.freePreview ?? record.free_preview),
    status: readString(record, ['status'], 'draft'),
    kind: readString(record, ['kind']) || undefined,
    externalSourceId: readString(record, ['externalSourceId', 'external_source_id']) || undefined,
    sourceProvider: readString(record, ['sourceProvider', 'source_provider']) || undefined,
  };
}

function mapCourseItem(record: ReturnType<typeof asRecord>): ConsoleCourseItem {
  return {
    id: readString(record, ['id', 'courseId']),
    courseCode: readString(record, ['courseCode', 'course_code', 'code']),
    title: readString(record, ['title', 'name'], '未命名课程'),
    status: readString(record, ['status'], 'active'),
    publishStatus:
      readString(record, ['publishStatus', 'publish_status']) || readString(record, ['status'], 'draft'),
    kind: readString(record, ['kind', 'courseKind', 'course_kind'], 'standard'),
    author:
      readString(record, ['authorDisplayName', 'author_display_name', 'author', 'instructor']) ||
      undefined,
    reviewNote: readString(record, ['reviewNote', 'review_note']) || undefined,
    submittedAt: readString(record, ['submittedAt', 'submitted_at']) || undefined,
    reviewedAt: readString(record, ['reviewedAt', 'reviewed_at']) || undefined,
    reviewRound: readNumber(record, ['reviewRound', 'review_round']),
    summary: readString(record, ['summary']) || undefined,
    priceAmount: readString(record, ['priceAmount', 'price_amount']) || undefined,
    isFree: Boolean(record.isFree ?? record.is_free ?? true),
    currency: readString(record, ['currency']) || undefined,
    studentsCount: readNumber(record, ['studentsCount', 'students_count', 'studentCount']),
    lessonsCount: readNumber(record, ['lessonsCount', 'lessons_count', 'lessonCount']),
    category: readString(record, ['category', 'categoryName']) || undefined,
    instructor: readString(record, ['instructor', 'instructorName']) || undefined,
  };
}

function readPageTotal(response: unknown, fallback: number): number {
  const page = asRecord(unwrapCourseBackendEnvelope(response));
  const pageInfo = asRecord(page.pageInfo);
  return readNumber(pageInfo, ['totalItems'], readNumber(page, ['total'], fallback));
}

export const courseConsoleService = {
  async listCourses(params?: { q?: string; status?: string; kind?: string; limit?: number }): Promise<ConsoleCourseListResult> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courses.list({
      q: params?.q,
      status: params?.status,
      kind: params?.kind,
      pageSize: params?.limit ?? 50,
    });
    const items = readRecords(response, ['items', 'records', 'data', 'list', 'rows', 'content', 'courses'])
      .map(mapCourseItem)
      .filter((item) => item.id);
    return { items, total: readPageTotal(response, items.length) };
  },

  async createCourse(input: CreateConsoleCourseInput): Promise<ConsoleCourseItem> {
    const title = input.title.trim();
    if (!title) {
      throw new Error('课程标题不能为空');
    }

    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courses.create({
      title,
      subtitle: input.subtitle?.trim() || undefined,
      description: input.description?.trim() || undefined,
      tags: [],
    });
    return mapCourseItem(readSingleRecord(response));
  },

  async publishCourse(courseId: string): Promise<ConsoleCourseItem> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courses.publish(courseId, {});
    return mapCourseItem(readSingleRecord(response));
  },

  async unpublishCourse(courseId: string): Promise<ConsoleCourseItem> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courses.unpublish(courseId, {});
    return mapCourseItem(readSingleRecord(response));
  },

  async listCategories(params?: { q?: string; limit?: number }): Promise<ConsoleCourseCategoryListResult> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseCategories.list({
      q: params?.q,
      pageSize: params?.limit ?? 100,
    });
    const items = readRecords(response, ['items', 'records', 'data', 'list', 'rows', 'content', 'categories'])
      .map(mapCategoryItem)
      .filter((item) => item.id);
    return { items, total: readPageTotal(response, items.length) };
  },

  async createCategory(input: CreateConsoleCourseCategoryInput): Promise<ConsoleCourseCategoryItem> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('分类名称不能为空');
    }

    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseCategories.create({
      name,
      slug: input.slug?.trim() || undefined,
      description: input.description?.trim() || undefined,
    });
    return mapCategoryItem(readSingleRecord(response));
  },

  async listSections(courseId: string): Promise<ConsoleCourseSectionItem[]> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseSections.list(courseId, { pageSize: 200 });
    return readRecords(response, ['items', 'records', 'data', 'list', 'rows', 'content', 'sections'])
      .map(mapSectionItem)
      .filter((item) => item.id);
  },

  async createSection(
    courseId: string,
    input: CreateConsoleCourseSectionInput,
  ): Promise<ConsoleCourseSectionItem> {
    const title = input.title.trim();
    if (!title) {
      throw new Error('章节标题不能为空');
    }

    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseSections.create(courseId, {
      title,
      description: input.description?.trim() || undefined,
    });
    return mapSectionItem(readSingleRecord(response));
  },

  async listLessons(courseId: string): Promise<ConsoleCourseLessonItem[]> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseLessons.list(courseId, { pageSize: 500 });
    return readRecords(response, ['items', 'records', 'data', 'list', 'rows', 'content', 'lessons'])
      .map(mapLessonItem)
      .filter((item) => item.id);
  },

  async createLesson(
    courseId: string,
    input: CreateConsoleCourseLessonInput,
  ): Promise<ConsoleCourseLessonItem> {
    const title = input.title.trim();
    if (!title) {
      throw new Error('课时标题不能为空');
    }

    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseLessons.create(courseId, {
      title,
      sectionId: input.sectionId,
      description: input.description?.trim() || undefined,
      freePreview: input.freePreview ?? false,
      lessonKind: input.kind ?? 'vod_video',
      externalSourceId: input.externalSourceId?.trim() || undefined,
      sourceProvider: input.sourceProvider?.trim() || undefined,
    });
    return mapLessonItem(readSingleRecord(response));
  },

  async attachLessonResource(lessonId: string, file: File): Promise<{ driveResourceId: string; fileName: string }> {
    // Upload through the drive app SDK, then link the uploaded node to the
    // lesson as an attachment resource via the backend resources API.
    const upload = await uploadCourseMediaFile(file);
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    await client.courseResources.create(lessonId, {
      drive_resource_id: upload.driveResourceId,
      resource_role: 'attachment',
      mime_type: upload.mimeType,
      media_resource_snapshot: JSON.stringify({
        provider: 'drive',
        driveResourceId: upload.driveResourceId,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
      }),
    });
    return { driveResourceId: upload.driveResourceId, fileName: upload.fileName };
  },

  async reviewCourse(courseId: string, decision: 'approve' | 'reject' | 'request_changes', note?: string): Promise<ConsoleCourseItem> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseReviews.review(courseId, {
      decision,
      note: note?.trim() || undefined,
    });
    return mapCourseItem(readSingleRecord(response));
  },

  async offlineCourse(courseId: string, note?: string): Promise<ConsoleCourseItem> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courses.offline(courseId, { note: note?.trim() || undefined });
    return mapCourseItem(readSingleRecord(response));
  },

  async listReviews(params?: { status?: string; kind?: string; q?: string; limit?: number }): Promise<ConsoleCourseListResult> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseReviews.list({
      status: params?.status,
      kind: params?.kind,
      q: params?.q,
      pageSize: params?.limit ?? 50,
    });
    const items = readRecords(response, ['items', 'records', 'data', 'list', 'rows', 'content', 'courses'])
      .map(mapCourseItem)
      .filter((item) => item.id);
    return { items, total: readPageTotal(response, items.length) };
  },

  async reviewStats(): Promise<ConsoleReviewStats> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseReviews.stats();
    const record = readSingleRecord(response);
    return {
      pending: readNumber(record, ['pending']),
      changesRequested: readNumber(record, ['changesRequested', 'changes_requested']),
      published: readNumber(record, ['published']),
      ugcTotal: readNumber(record, ['ugcTotal', 'ugc_total']),
      ugcPublished: readNumber(record, ['ugcPublished', 'ugc_published']),
      pendingOverdue: readNumber(record, ['pendingOverdue', 'pending_overdue']),
      avgReviewHours: readNumber(record, ['avgReviewHours', 'avg_review_hours']),
    };
  },

  async getReviewDetail(courseId: string): Promise<ConsoleReviewDetail> {
    const client = getCourseConsolePcHost().getBackendClientWithSession();
    const response = await client.courseReviews.retrieve(courseId);
    const record = asRecord(unwrapCourseBackendEnvelope(response));
    const data = asRecord(record.data) ?? record;
    const course = mapCourseItem(asRecord(data.course));
    const sections = readRecords(data, ['sections']).map((section) => ({
      id: readString(section, ['id']),
      title: readString(section, ['title'], '未命名章节'),
      lessonCount: readNumber(section, ['lessonCount', 'lesson_count']),
    }));
    const lessons = readRecords(data, ['lessons']).map((lesson) => ({
      id: readString(lesson, ['id']),
      sectionId: readString(lesson, ['sectionId', 'section_id']) || undefined,
      title: readString(lesson, ['title'], '未命名课时'),
      kind: readString(lesson, ['kind']) || undefined,
      durationSeconds: readNumber(lesson, ['durationSeconds', 'duration_seconds']),
      freePreview: Boolean(lesson.freePreview ?? lesson.free_preview),
      content: readString(lesson, ['content']) || undefined,
      externalSourceId: readString(lesson, ['externalSourceId', 'external_source_id']) || undefined,
      sourceProvider: readString(lesson, ['sourceProvider', 'source_provider']) || undefined,
    }));
    const resources = readRecords(data, ['resources']).map((resource) => ({
      id: readString(resource, ['id']),
      ownerId: readString(resource, ['ownerId', 'owner_id']),
      resourceRole: readString(resource, ['resourceRole', 'resource_role']),
      driveResourceId: readString(resource, ['driveResourceId', 'drive_resource_id']),
    }));
    const collectionItems = readRecords(data, ['collectionItems', 'collection_items']).map((item) => ({
      courseId: readString(item, ['courseId', 'course_id']),
      title: readString(item, ['title'], '未命名课程'),
      kind: readString(item, ['kind'], 'standard'),
      lessonsCount: readNumber(item, ['lessonsCount', 'lessons_count']),
    }));
    return { course, sections, lessons, resources, collectionItems, auditLogs: [] };
  },
};
