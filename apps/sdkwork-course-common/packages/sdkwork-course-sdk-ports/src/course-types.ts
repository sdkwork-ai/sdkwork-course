/**
 * Course UI domain types.
 *
 * The generated `@sdkwork/course-app-sdk` client returns untyped record
 * payloads; these types are the stable UI-facing surface produced by the
 * `CourseAppSdkPort` implementations (generated SDK adapter or host test
 * doubles). Field sets mirror what the mobile course pages actually consume
 * plus the domain enumerations owned by `@sdkwork/course-contracts`.
 */

import type {
  CourseEnrollmentStatus,
  CourseLessonKind,
  CourseLiveStatus,
  CourseOfferingType,
  CourseProgressStatus,
} from "@sdkwork/course-contracts";

export type CourseTargetType = "course" | "lesson" | "live_session" | "comment";

export interface CourseCategory {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CourseCatalog {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  instructor?: string;
  author?: string;
  lessonsCount?: number;
  studentsCount?: number;
  ratingScore?: string;
  type?: CourseOfferingType;
  kind?: string;
  liveStatus?: CourseLiveStatus;
  price?: number;
  priceAmount?: string;
  isFree?: boolean;
  originalPrice?: number;
  isPurchased?: boolean;
}

export interface CourseOffering {
  id: string;
  courseId?: string;
  title?: string;
  type?: CourseOfferingType;
  startsAt?: string;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  enrollmentStatus: CourseEnrollmentStatus;
  enrolledAt: string;
  courseTitle?: string;
  courseThumbnail?: string;
}

export interface CourseSection {
  id: string;
  courseId?: string;
  title: string;
  sortOrder?: number;
  lessons?: CourseLesson[];
}

export interface CourseLesson {
  id: string;
  courseId?: string;
  sectionId?: string;
  title: string;
  description?: string;
  kind?: CourseLessonKind;
  durationSeconds?: number;
  videoUrl?: string;
  free?: boolean;
  completed?: boolean;
  /** External source id (e.g. bilibili BV id) for connected lessons. */
  externalSourceId?: string;
  /** External source provider (`bilibili`, `manual`, ...). */
  sourceProvider?: string;
  /** Rich text body for article-style lessons. */
  content?: string;
}

export interface CourseLiveSession {
  id: string;
  title: string;
  description?: string;
  liveStatus: CourseLiveStatus;
  scheduledStartAt: string;
  scheduledEndAt?: string;
  actualStartAt?: string;
}

export interface CourseLearningProgress {
  enrollmentId?: string;
  completedLessonCount: number;
  requiredLessonCount: number;
  progressPercent: string;
  watchSeconds: number;
  progressStatus: CourseProgressStatus;
}

export interface CourseLessonProgress {
  id?: string;
  lessonId?: string;
  enrollmentId?: string;
  completed?: boolean;
  progressPercent?: number;
  watchSeconds?: number;
  updatedAt?: string;
}

export interface CourseComment {
  id: string;
  courseId?: string;
  targetType?: CourseTargetType;
  targetId?: string;
  author?: string;
  content: string;
  createdAt: string;
}

export interface CourseReaction {
  id?: string;
  targetType: CourseTargetType;
  targetId: string;
  reactionType: string;
  reactionValue: string;
  createdAt?: string;
}

export interface CourseListParams {
  q?: string;
  categoryId?: string;
  kind?: string;
  level?: string;
  page?: number;
  pageSize?: number;
}

export interface CourseEnrollmentCommand {
  source?: string;
}

export interface CourseCommentCommand {
  targetType: CourseTargetType;
  targetId: string;
  content: string;
}

export interface CourseReactionCommand {
  targetType: CourseTargetType;
  targetId: string;
  reactionType: string;
  reactionValue: string;
}

export interface CourseLessonProgressCommand {
  completed?: boolean;
  progressPercent?: number;
  watchSeconds?: number;
}

export interface CourseWatchPositionCommand {
  positionSeconds: number;
  durationSeconds?: number;
}
