/**
 * Course App SDK port contract.
 *
 * Hosts (sdkwork-im h5, standalone sdkwork-course h5) bind the generated
 * `@sdkwork/course-app-sdk` client to this port through
 * `createGeneratedCourseAppSdkPort` (sdkwork-course-runtime) and hand it to
 * the mobile React package via `configureCourseRuntimePort`. The port is the
 * UI-facing seam: pages never touch generated SDK records or raw HTTP.
 */

import type {
  CourseCatalog,
  CourseCategory,
  CourseEnrollment,
  CourseEnrollmentCommand,
  CourseLearningProgress,
  CourseLesson,
  CourseLessonProgress,
  CourseLessonProgressCommand,
  CourseListParams,
  CourseLiveSession,
  CourseOffering,
  CourseReaction,
  CourseReactionCommand,
  CourseSection,
  CourseWatchPositionCommand,
} from "./course-types";

export interface CourseAppSdkPort {
  categories: {
    list(): Promise<readonly CourseCategory[]>;
  };
  courses: {
    list(params?: CourseListParams): Promise<readonly CourseCatalog[]>;
    retrieve(courseId: string): Promise<CourseCatalog>;
    collectionItems(courseId: string): Promise<readonly CourseCatalog[]>;
  };
  offerings: {
    list(courseId: string): Promise<readonly CourseOffering[]>;
  };
  enrollments: {
    create(offeringId: string, command: CourseEnrollmentCommand): Promise<CourseEnrollment>;
    current: {
      list(): Promise<readonly CourseEnrollment[]>;
    };
  };
  sections: {
    list(courseId: string): Promise<readonly CourseSection[]>;
  };
  lessons: {
    list(courseId: string): Promise<readonly CourseLesson[]>;
  };
  lessonProgress: {
    update(lessonId: string, command: CourseLessonProgressCommand): Promise<CourseLessonProgress>;
    watchPositions: {
      update(lessonId: string, command: CourseWatchPositionCommand): Promise<unknown>;
    };
  };
  progress: {
    retrieve(enrollmentId: string): Promise<CourseLearningProgress>;
  };
  liveSessions: {
    list(): Promise<readonly CourseLiveSession[]>;
    retrieve(liveSessionId: string): Promise<CourseLiveSession>;
    join(liveSessionId: string): Promise<CourseLiveSession>;
    heartbeat(liveSessionId: string): Promise<CourseLiveSession>;
    leave(liveSessionId: string): Promise<CourseLiveSession>;
  };
  reactions: {
    update(command: CourseReactionCommand): Promise<CourseReaction>;
  };
}

export type {
  CourseCatalog,
  CourseCategory,
  CourseEnrollment,
  CourseEnrollmentCommand,
  CourseLearningProgress,
  CourseLesson,
  CourseLessonProgress,
  CourseLessonProgressCommand,
  CourseListParams,
  CourseLiveSession,
  CourseOffering,
  CourseReaction,
  CourseReactionCommand,
  CourseSection,
  CourseTargetType,
  CourseWatchPositionCommand,
} from "./course-types";
