export const COURSE_TABLE_NAMES = [
  "course_category",
  "course_instructor",
  "course_catalog",
  "course_offering",
  "course_section",
  "course_lesson",
  "course_resource_ref",
  "course_live_session",
  "course_enrollment",
  "course_learning_progress",
  "course_lesson_progress",
  "course_comment",
  "course_reaction",
  "course_catalog_link",
  "course_application",
  "course_audit_log",
] as const;

export type CourseDatabaseTableName = (typeof COURSE_TABLE_NAMES)[number];

export const COURSE_KINDS = ["standard", "column", "collection"] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

export const COURSE_REVIEW_DECISIONS = [
  "approve",
  "reject",
  "request_changes",
] as const;
export type CourseReviewDecision = (typeof COURSE_REVIEW_DECISIONS)[number];

export const COURSE_OFFERING_TYPES = ["vod", "live", "blended", "cohort"] as const;
export type CourseOfferingType = (typeof COURSE_OFFERING_TYPES)[number];

export const COURSE_LESSON_KINDS = [
  "vod_video",
  "live_session",
  "article",
  "download",
  "quiz",
  "assignment",
] as const;
export type CourseLessonKind = (typeof COURSE_LESSON_KINDS)[number];

export const COURSE_RESOURCE_ROLES = [
  "cover",
  "intro_video",
  "vod_video",
  "live_replay",
  "subtitle",
  "attachment",
  "handout",
  "avatar",
] as const;
export type CourseResourceRole = (typeof COURSE_RESOURCE_ROLES)[number];

export const COURSE_LIVE_STATUSES = [
  "scheduled",
  "preparing",
  "live",
  "ended",
  "recording_processing",
  "replay_ready",
  "cancelled",
  "archived",
] as const;
export type CourseLiveStatus = (typeof COURSE_LIVE_STATUSES)[number];

export const COURSE_ENROLLMENT_STATUSES = [
  "active",
  "completed",
  "expired",
  "cancelled",
  "revoked",
] as const;
export type CourseEnrollmentStatus = (typeof COURSE_ENROLLMENT_STATUSES)[number];

export const COURSE_PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "missed",
  "attended",
  "expired",
] as const;
export type CourseProgressStatus = (typeof COURSE_PROGRESS_STATUSES)[number];

export interface CourseRequestContext {
  tenantId: string;
  organizationId: string;
  userId?: string;
  actorId?: string;
  correlationId?: string;
  traceId?: string;
  permissions: readonly string[];
}

export interface CourseMediaResource {
  provider: "drive";
  resourceId: string;
  role: CourseResourceRole;
  mimeType?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface CourseCatalogDraft {
  categoryId?: string;
  instructorId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover?: CourseMediaResource;
  level?: "beginner" | "intermediate" | "advanced" | "all";
  tags: readonly string[];
}

export interface CourseOfferingDraft {
  courseId: string;
  offeringType: CourseOfferingType;
  title: string;
  startsAt?: string;
  endsAt?: string;
  enrollmentStartsAt?: string;
  enrollmentEndsAt?: string;
  capacityLimit?: number;
  completionRule?: Record<string, unknown>;
}

export interface CourseLessonDraft {
  courseId: string;
  sectionId?: string;
  lessonKind: CourseLessonKind;
  title: string;
  summary?: string;
  durationSeconds?: number;
  freePreview: boolean;
  resources: readonly CourseMediaResource[];
}

export interface CourseLiveSessionDraft {
  courseId: string;
  offeringId: string;
  lessonId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  instructorId?: string;
  providerCode?: string;
}

export interface CourseEnrollmentCommand {
  offeringId: string;
  learnerUserId: string;
  source: "self_service" | "operator_grant" | "external_entitlement";
  idempotencyKey?: string;
}

export interface CourseLessonProgressCommand {
  enrollmentId: string;
  lessonId: string;
  progressStatus: CourseProgressStatus;
  watchedSeconds?: number;
  completedAt?: string;
  idempotencyKey?: string;
}

export interface CourseCommentCommand {
  courseId: string;
  lessonId?: string;
  parentCommentId?: string;
  content: string;
}

export interface CourseReactionCommand {
  targetType: "course" | "lesson" | "comment" | "live_session";
  targetId: string;
  reactionType: "like" | "favorite" | "save" | "share";
}

export interface CourseAuditCommand {
  actorId: string;
  targetType: string;
  targetId: string;
  operation: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
}
