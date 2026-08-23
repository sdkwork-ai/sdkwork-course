/**
 * Generated Course App SDK → `CourseAppSdkPort` adapter.
 *
 * The generated `@sdkwork/course-app-sdk` client returns untyped record
 * payloads (`SdkWorkPageData.items` / `Record<string, unknown>`). This
 * adapter maps those records onto the stable UI types of
 * `@sdkwork/course-sdk-ports` and keeps pages free of generated SDK imports.
 * Field names mirror what the course service layer returns (camelCase with
 * snake_case fallbacks), matching the h5 page reads.
 */

import type { SdkworkAppClient } from "@sdkwork/course-app-sdk";
import type {
  CourseAppSdkPort,
  CourseCatalog,
  CourseCategory,
  CourseComment,
  CourseEnrollment,
  CourseLearningProgress,
  CourseLesson,
  CourseLiveSession,
  CourseOffering,
  CourseReaction,
  CourseSection,
} from "@sdkwork/course-sdk-ports";
import { uuid } from "@sdkwork/utils/id";

function firstString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function listItems(payload: unknown): readonly Record<string, unknown>[] {
  const items = (payload as { items?: unknown } | undefined)?.items;
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

function mapCourseCategory(record: Record<string, unknown>): CourseCategory {
  return {
    id: String(record.id ?? ""),
    title: firstString(record, "title", "name") ?? "",
    slug: firstString(record, "slug"),
    description: firstString(record, "description", "summary"),
    icon: firstString(record, "icon", "avatar", "cover"),
    sortOrder: firstNumber(record, "sortOrder", "sort_order", "priority"),
  };
}

function mapCourseCatalog(record: Record<string, unknown>): CourseCatalog {
  return {
    id: String(record.id ?? record.courseId ?? ""),
    title: firstString(record, "title", "name") ?? "",
    subtitle: firstString(record, "subtitle"),
    description: firstString(record, "description", "summary"),
    thumbnail: firstString(record, "thumbnail", "cover", "coverUrl"),
    instructor: firstString(record, "instructor", "instructorName"),
    lessonsCount: firstNumber(record, "lessonsCount", "lessons_count"),
    studentsCount: firstNumber(record, "studentsCount", "students_count", "students"),
    ratingScore: firstString(record, "ratingScore", "rating", "rating_score"),
    type: firstString(record, "type", "offeringType") as CourseCatalog["type"],
    liveStatus: firstString(record, "liveStatus", "live_status", "status") as CourseCatalog["liveStatus"],
    price: firstNumber(record, "price", "listPrice", "list_price"),
    originalPrice: firstNumber(record, "originalPrice", "original_price"),
    isPurchased: record.isPurchased === undefined ? undefined : Boolean(record.isPurchased),
  };
}

function mapCourseOffering(record: Record<string, unknown>): CourseOffering {
  return {
    id: String(record.id ?? ""),
    courseId: firstString(record, "courseId", "course_id"),
    title: firstString(record, "title", "name"),
    type: firstString(record, "type") as CourseOffering["type"],
    startsAt: firstString(record, "startsAt", "starts_at", "startTime", "start_time"),
  };
}

function mapCourseEnrollment(record: Record<string, unknown>): CourseEnrollment {
  return {
    id: String(record.id ?? record.enrollmentId ?? ""),
    courseId: firstString(record, "courseId", "course_id") ?? "",
    enrollmentStatus: (firstString(record, "enrollmentStatus", "status", "enrollment_status")
      ?? "active") as CourseEnrollment["enrollmentStatus"],
    enrolledAt: firstString(record, "enrolledAt", "enrolled_at") ?? new Date().toISOString(),
    courseTitle: firstString(record, "courseTitle", "course_title", "title"),
    courseThumbnail: firstString(record, "courseThumbnail", "course_thumbnail", "thumbnail", "cover"),
  };
}

function mapCourseSection(record: Record<string, unknown>): CourseSection {
  return {
    id: String(record.id ?? ""),
    courseId: firstString(record, "courseId", "course_id"),
    title: firstString(record, "title", "name") ?? "",
    sortOrder: firstNumber(record, "sortOrder", "sort_order"),
  };
}

function mapCourseLesson(record: Record<string, unknown>): CourseLesson {
  return {
    id: String(record.id ?? record.lessonId ?? ""),
    courseId: firstString(record, "courseId", "course_id"),
    sectionId: firstString(record, "sectionId", "section_id"),
    title: firstString(record, "title", "name") ?? "",
    description: firstString(record, "description"),
    kind: firstString(record, "kind", "lessonKind", "lesson_kind") as CourseLesson["kind"],
    durationSeconds: firstNumber(record, "durationSeconds", "duration_seconds"),
    videoUrl: firstString(record, "videoUrl", "video_url", "mediaUrl", "media_url"),
    free: record.free === undefined ? undefined : Boolean(record.free),
    completed: record.completed === undefined ? undefined : Boolean(record.completed),
  };
}

function mapCourseLiveSession(record: Record<string, unknown>): CourseLiveSession {
  return {
    id: String(record.id ?? record.liveSessionId ?? ""),
    title: firstString(record, "title", "name") ?? "",
    description: firstString(record, "description"),
    liveStatus: (firstString(record, "liveStatus", "live_status", "status")
      ?? "scheduled") as CourseLiveSession["liveStatus"],
    scheduledStartAt: firstString(record, "scheduledStartAt", "scheduled_start_at")
      ?? new Date().toISOString(),
    scheduledEndAt: firstString(record, "scheduledEndAt", "scheduled_end_at"),
    actualStartAt: firstString(record, "actualStartAt", "actual_start_at"),
  };
}

function mapCourseLearningProgress(record: Record<string, unknown>): CourseLearningProgress {
  return {
    enrollmentId: firstString(record, "enrollmentId", "enrollment_id"),
    completedLessonCount: firstNumber(record, "completedLessonCount", "completed_lesson_count") ?? 0,
    requiredLessonCount: firstNumber(record, "requiredLessonCount", "required_lesson_count") ?? 0,
    progressPercent: firstString(record, "progressPercent", "progress_percent") ?? "0",
    watchSeconds: firstNumber(record, "watchSeconds", "watch_seconds") ?? 0,
    progressStatus: (firstString(record, "progressStatus", "progress_status", "status")
      ?? "in_progress") as CourseLearningProgress["progressStatus"],
  };
}

function mapCourseComment(record: Record<string, unknown>): CourseComment {
  return {
    id: String(record.id ?? record.commentId ?? ""),
    courseId: firstString(record, "courseId", "course_id"),
    targetType: firstString(record, "targetType", "target_type") as CourseComment["targetType"],
    targetId: firstString(record, "targetId", "target_id"),
    author: firstString(record, "author", "authorName", "userName"),
    content: firstString(record, "content", "body", "text") ?? "",
    createdAt: firstString(record, "createdAt", "created_at") ?? new Date().toISOString(),
  };
}

function mapCourseReaction(record: Record<string, unknown>): CourseReaction {
  return {
    id: firstString(record, "id", "reactionId"),
    targetType: (firstString(record, "targetType", "target_type")
      ?? "course") as CourseReaction["targetType"],
    targetId: firstString(record, "targetId", "target_id") ?? "",
    reactionType: firstString(record, "reactionType", "reaction_type") ?? "",
    reactionValue: firstString(record, "reactionValue", "reaction_value") ?? "",
    createdAt: firstString(record, "createdAt", "created_at"),
  };
}

export function createGeneratedCourseAppSdkPort(client: SdkworkAppClient): CourseAppSdkPort {
  return {
    categories: {
      async list() {
        const payload = await client.courseCategories.list();
        return listItems(payload).map(mapCourseCategory);
      },
    },
    courses: {
      async list(params) {
        const payload = await client.courses.list(
          params
            ? {
                q: params.q,
                page: params.page,
                pageSize: params.pageSize,
                status: params.status,
              }
            : undefined,
        );
        return listItems(payload).map(mapCourseCatalog);
      },
      async retrieve(courseId) {
        const payload = await client.courses.retrieve(courseId);
        return mapCourseCatalog(payload as Record<string, unknown>);
      },
    },
    offerings: {
      async list(courseId) {
        const payload = await client.courseOfferings.list(courseId);
        return listItems(payload).map(mapCourseOffering);
      },
    },
    enrollments: {
      async create(offeringId, command) {
        const payload = await client.courseEnrollments.create(
          offeringId,
          { source: command.source ?? "self_service" },
          { idempotencyKey: uuid() },
        );
        return mapCourseEnrollment(payload as Record<string, unknown>);
      },
      current: {
        async list() {
          const payload = await client.courseEnrollments.current.list();
          return listItems(payload).map(mapCourseEnrollment);
        },
      },
    },
    sections: {
      async list(courseId) {
        const payload = await client.courseSections.list(courseId);
        return listItems(payload).map(mapCourseSection);
      },
    },
    lessons: {
      async list(courseId) {
        const payload = await client.courseLessons.list(courseId);
        return listItems(payload).map(mapCourseLesson);
      },
    },
    lessonProgress: {
      async update(lessonId, command) {
        const payload = await client.courseLessonProgress.update(lessonId, {
          completed: command.completed,
          progressPercent: command.progressPercent,
          watchSeconds: command.watchSeconds,
        });
        const record = payload as Record<string, unknown>;
        return {
          id: firstString(record, "id"),
          lessonId: firstString(record, "lessonId", "lesson_id") ?? lessonId,
          enrollmentId: firstString(record, "enrollmentId", "enrollment_id"),
          completed: record.completed === undefined ? undefined : Boolean(record.completed),
          progressPercent:
            firstNumber(record, "progressPercent", "progress_percent") ?? command.progressPercent,
          watchSeconds: firstNumber(record, "watchSeconds", "watch_seconds") ?? command.watchSeconds,
          updatedAt: firstString(record, "updatedAt", "updated_at"),
        };
      },
      watchPositions: {
        async update(lessonId, command) {
          return client.courseLessonProgress.watchPositions.update(lessonId, {
            positionSeconds: command.positionSeconds,
            durationSeconds: command.durationSeconds,
          });
        },
      },
    },
    progress: {
      async retrieve(enrollmentId) {
        const payload = await client.courseProgress.retrieve(enrollmentId);
        return mapCourseLearningProgress(payload as Record<string, unknown>);
      },
    },
    liveSessions: {
      async list() {
        const payload = await client.courseLiveSessions.list();
        return listItems(payload).map(mapCourseLiveSession);
      },
      async retrieve(liveSessionId) {
        const payload = await client.courseLiveSessions.retrieve(liveSessionId);
        return mapCourseLiveSession(payload as Record<string, unknown>);
      },
      async join(liveSessionId) {
        const payload = await client.courseLiveSessions.join(liveSessionId, {
          action: "join",
        });
        return mapCourseLiveSession({
          id: payload.resourceId ?? liveSessionId,
          status: payload.status,
        } as unknown as Record<string, unknown>);
      },
      async heartbeat(liveSessionId) {
        const payload = await client.courseLiveSessions.heartbeat(liveSessionId, {
          action: "heartbeat",
        });
        return mapCourseLiveSession({
          id: payload.resourceId ?? liveSessionId,
          status: payload.status,
        } as unknown as Record<string, unknown>);
      },
      async leave(liveSessionId) {
        const payload = await client.courseLiveSessions.leave(liveSessionId, {
          action: "leave",
        });
        return mapCourseLiveSession({
          id: payload.resourceId ?? liveSessionId,
          status: payload.status,
        } as unknown as Record<string, unknown>);
      },
    },
    comments: {
      async list(courseId) {
        const payload = await client.courseComments.list(courseId);
        return listItems(payload).map(mapCourseComment);
      },
      async create(courseId, command) {
        const payload = await client.courseComments.create(courseId, {
          targetType: command.targetType,
          targetId: command.targetId,
          content: command.content,
        });
        return mapCourseComment(payload as Record<string, unknown>);
      },
    },
    reactions: {
      async update(command) {
        const payload = await client.courseReactions.update({
          targetType: command.targetType,
          targetId: command.targetId,
          reactionType: command.reactionType,
          reactionValue: command.reactionValue,
        });
        return mapCourseReaction(payload as Record<string, unknown>);
      },
    },
  };
}
