export type CourseApiOperationSurface = "app-api" | "backend-api";

export type CourseApiOperationMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export interface CourseOperationPlan {
  surface: CourseApiOperationSurface;
  method: CourseApiOperationMethod;
  path: string;
  operationId: string;
  resource: string;
  authMode: "anonymous" | "dual-token" | "dual-token-or-anonymous" | "internal";
  permission?: string;
  auditEvent?: string;
  idempotency?: "required" | "recommended";
}

export const COURSE_APP_API_PREFIX = "/app/v3/api";
export const COURSE_BACKEND_API_PREFIX = "/backend/v3/api";
export const COURSE_APP_API_AUTHORITY = "sdkwork-course-app-api";
export const COURSE_BACKEND_API_AUTHORITY = "sdkwork-course-backend-api";

export const COURSE_APP_API_OPERATION_IDS = [
  "courseApplications.create",
  "courseApplications.current.list",
  "courseApplications.retrieve",
  "courseCategories.list",
  "courseCategories.retrieve",
  "courseComments.create",
  "courseComments.delete",
  "courseComments.list",
  "courseEnrollments.create",
  "courseEnrollments.current.list",
  "courseEnrollments.delete",
  "courseEnrollments.retrieve",
  "courseLessonProgress.update",
  "courseLessonProgress.watchPositions.update",
  "courseLessonResources.list",
  "courseLessons.list",
  "courseLessons.retrieve",
  "courseLiveSessions.heartbeat",
  "courseLiveSessions.join",
  "courseLiveSessions.leave",
  "courseLiveSessions.list",
  "courseLiveSessions.replay.retrieve",
  "courseLiveSessions.retrieve",
  "courseOfferings.list",
  "courseOfferings.retrieve",
  "courseProgress.retrieve",
  "courseReactions.delete",
  "courseReactions.update",
  "courseSections.list",
  "courses.list",
  "courses.retrieve",
  "courseCurriculum.retrieve",
  "courseCollectionItems.list",
  "studioCourses.create",
  "studioCourses.delete",
  "studioCourses.list",
  "studioCourses.retrieve",
  "studioCourses.submit",
  "studioCourses.update",
  "studioCourses.withdraw",
] as const;

export type CourseAppOperationId = (typeof COURSE_APP_API_OPERATION_IDS)[number];

export const COURSE_BACKEND_API_OPERATION_IDS = [
  "courseApplications.convert",
  "courseApplications.list",
  "courseApplications.retrieve",
  "courseApplications.update",
  "courseAuditLogs.list",
  "courseAuditLogs.retrieve",
  "courseCategories.create",
  "courseCategories.delete",
  "courseCategories.list",
  "courseCategories.reorder",
  "courseCategories.update",
  "courseComments.delete",
  "courseComments.list",
  "courseComments.update",
  "courseEnrollments.create",
  "courseEnrollments.list",
  "courseEnrollments.revoke",
  "courseInstructors.create",
  "courseInstructors.list",
  "courseInstructors.retrieve",
  "courseInstructors.status.update",
  "courseInstructors.update",
  "courseLessonProgress.update",
  "courseLessons.create",
  "courseLessons.delete",
  "courseLessons.list",
  "courseLessons.retrieve",
  "courseLessons.reorder",
  "courseLessons.update",
  "courseLiveSessions.cancel",
  "courseLiveSessions.create",
  "courseLiveSessions.end",
  "courseLiveSessions.list",
  "courseLiveSessions.replay.create",
  "courseLiveSessions.replay.publish",
  "courseLiveSessions.retrieve",
  "courseLiveSessions.start",
  "courseLiveSessions.update",
  "courseOfferings.close",
  "courseOfferings.create",
  "courseOfferings.delete",
  "courseOfferings.list",
  "courseOfferings.publish",
  "courseOfferings.retrieve",
  "courseOfferings.update",
  "courseProgress.list",
  "courseProgress.retrieve",
  "courseReactions.list",
  "courseReports.learning.list",
  "courseReports.liveSessions.list",
  "courseReports.overview.retrieve",
  "courseResources.create",
  "courseResources.delete",
  "courseResources.list",
  "courseResources.update",
  "courseSections.create",
  "courseSections.delete",
  "courseSections.list",
  "courseSections.reorder",
  "courseSections.update",
  "courses.create",
  "courses.delete",
  "courses.list",
  "courses.publish",
  "courses.offline",
  "courses.retrieve",
  "courses.unpublish",
  "courses.update",
  "courseReviews.list",
  "courseReviews.retrieve",
  "courseReviews.review",
  "courseReviews.stats",
] as const;

export type CourseBackendOperationId = (typeof COURSE_BACKEND_API_OPERATION_IDS)[number];

export const COURSE_API_MATERIALIZATION_PLAN = {
  app: {
    apiAuthority: COURSE_APP_API_AUTHORITY,
    apiPrefix: COURSE_APP_API_PREFIX,
    operationIds: COURSE_APP_API_OPERATION_IDS,
    sdkFamily: "sdkwork-course-app-sdk",
  },
  backend: {
    apiAuthority: COURSE_BACKEND_API_AUTHORITY,
    apiPrefix: COURSE_BACKEND_API_PREFIX,
    operationIds: COURSE_BACKEND_API_OPERATION_IDS,
    sdkFamily: "sdkwork-course-backend-sdk",
  },
} as const;
