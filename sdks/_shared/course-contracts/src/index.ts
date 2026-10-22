export type CourseApiSurface = "app" | "backend";
export type CourseHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export * from "./course-api.ts";
export * from "./course-domain.ts";

export interface CourseOperationContract {
  apiSurface: CourseApiSurface;
  method: CourseHttpMethod;
  operationId: string;
  path: string;
  tag: CourseSdkNamespace;
}

export type CourseSdkNamespace =
  | "courseApplications"
  | "courseAuditLogs"
  | "courseCategories"
  | "courseCollectionItems"
  | "courseComments"
  | "courseEnrollments"
  | "courseInstructors"
  | "courseLessonProgress"
  | "courseLessonResources"
  | "courseLessons"
  | "courseLiveSessions"
  | "courseOfferings"
  | "courseProgress"
  | "courseReactions"
  | "courseReports"
  | "courseResources"
  | "courseReviews"
  | "courseSections"
  | "courses"
  | "studioCourses";

export const SDKWORK_COURSE_TABLES = {
  application: "course_application",
  auditLog: "course_audit_log",
  catalog: "course_catalog",
  catalogLink: "course_catalog_link",
  category: "course_category",
  comment: "course_comment",
  enrollment: "course_enrollment",
  instructor: "course_instructor",
  learningProgress: "course_learning_progress",
  lesson: "course_lesson",
  lessonProgress: "course_lesson_progress",
  liveSession: "course_live_session",
  offering: "course_offering",
  reaction: "course_reaction",
  resourceRef: "course_resource_ref",
  section: "course_section",
} as const;

export type CourseTableName = (typeof SDKWORK_COURSE_TABLES)[keyof typeof SDKWORK_COURSE_TABLES];
export const COURSE_TABLE_NAMES = Object.values(SDKWORK_COURSE_TABLES);

const app = "/app/v3/api";
const backend = "/backend/v3/api";

export const SDKWORK_COURSE_APP_OPERATIONS = {
  courseCategoriesList: operation("app", "GET", "/app/v3/api/course_categories", "courseCategories.list", "courseCategories"),
  courseCategoriesRetrieve: operation("app", "GET", "/app/v3/api/course_categories/{categoryId}", "courseCategories.retrieve", "courseCategories"),
  coursesList: operation("app", "GET", "/app/v3/api/courses", "courses.list", "courses"),
  coursesRetrieve: operation("app", "GET", "/app/v3/api/courses/{courseId}", "courses.retrieve", "courses"),
  courseOfferingsList: operation("app", "GET", "/app/v3/api/courses/{courseId}/offerings", "courseOfferings.list", "courseOfferings"),
  courseOfferingsRetrieve: operation("app", "GET", "/app/v3/api/course_offerings/{offeringId}", "courseOfferings.retrieve", "courseOfferings"),
  courseEnrollmentsCreate: operation("app", "POST", "/app/v3/api/course_offerings/{offeringId}/enrollments", "courseEnrollments.create", "courseEnrollments"),
  courseEnrollmentsCurrentList: operation("app", "GET", "/app/v3/api/course_enrollments", "courseEnrollments.current.list", "courseEnrollments"),
  courseEnrollmentsRetrieve: operation("app", "GET", "/app/v3/api/course_enrollments/{enrollmentId}", "courseEnrollments.retrieve", "courseEnrollments"),
  courseEnrollmentsDelete: operation("app", "DELETE", "/app/v3/api/course_enrollments/{enrollmentId}", "courseEnrollments.delete", "courseEnrollments"),
  courseSectionsList: operation("app", "GET", "/app/v3/api/courses/{courseId}/sections", "courseSections.list", "courseSections"),
  courseLessonsList: operation("app", "GET", "/app/v3/api/courses/{courseId}/lessons", "courseLessons.list", "courseLessons"),
  courseLessonsRetrieve: operation("app", "GET", "/app/v3/api/course_lessons/{lessonId}", "courseLessons.retrieve", "courseLessons"),
  courseLessonResourcesList: operation("app", "GET", "/app/v3/api/course_lessons/{lessonId}/resources", "courseLessonResources.list", "courseLessonResources"),
  courseProgressRetrieve: operation("app", "GET", "/app/v3/api/course_enrollments/{enrollmentId}/progress", "courseProgress.retrieve", "courseProgress"),
  courseLessonProgressUpdate: operation("app", "PATCH", "/app/v3/api/course_lessons/{lessonId}/progress", "courseLessonProgress.update", "courseLessonProgress"),
  courseLessonProgressWatchPositionsUpdate: operation("app", "PATCH", "/app/v3/api/course_lessons/{lessonId}/watch_position", "courseLessonProgress.watchPositions.update", "courseLessonProgress"),
  courseLiveSessionsList: operation("app", "GET", "/app/v3/api/course_live_sessions", "courseLiveSessions.list", "courseLiveSessions"),
  courseLiveSessionsRetrieve: operation("app", "GET", "/app/v3/api/course_live_sessions/{liveSessionId}", "courseLiveSessions.retrieve", "courseLiveSessions"),
  courseLiveSessionsJoin: operation("app", "POST", "/app/v3/api/course_live_sessions/{liveSessionId}/join", "courseLiveSessions.join", "courseLiveSessions"),
  courseLiveSessionsHeartbeat: operation("app", "POST", "/app/v3/api/course_live_sessions/{liveSessionId}/heartbeat", "courseLiveSessions.heartbeat", "courseLiveSessions"),
  courseLiveSessionsLeave: operation("app", "POST", "/app/v3/api/course_live_sessions/{liveSessionId}/leave", "courseLiveSessions.leave", "courseLiveSessions"),
  courseLiveSessionsReplayRetrieve: operation("app", "GET", "/app/v3/api/course_live_sessions/{liveSessionId}/replay", "courseLiveSessions.replay.retrieve", "courseLiveSessions"),
  courseCommentsList: operation("app", "GET", "/app/v3/api/courses/{courseId}/comments", "courseComments.list", "courseComments"),
  courseCommentsCreate: operation("app", "POST", "/app/v3/api/courses/{courseId}/comments", "courseComments.create", "courseComments"),
  courseCommentsDelete: operation("app", "DELETE", "/app/v3/api/course_comments/{commentId}", "courseComments.delete", "courseComments"),
  courseReactionsUpdate: operation("app", "PUT", "/app/v3/api/course_reactions", "courseReactions.update", "courseReactions"),
  courseReactionsDelete: operation("app", "DELETE", "/app/v3/api/course_reactions/{reactionId}", "courseReactions.delete", "courseReactions"),
  courseApplicationsCreate: operation("app", "POST", "/app/v3/api/course_applications", "courseApplications.create", "courseApplications"),
  courseApplicationsCurrentList: operation("app", "GET", "/app/v3/api/course_applications", "courseApplications.current.list", "courseApplications"),
  courseApplicationsRetrieve: operation("app", "GET", "/app/v3/api/course_applications/{applicationId}", "courseApplications.retrieve", "courseApplications"),
  coursesCurriculumRetrieve: operation("app", "GET", "/app/v3/api/courses/{courseId}/curriculum", "courseCurriculum.retrieve", "courses"),
  courseCollectionItemsList: operation("app", "GET", "/app/v3/api/courses/{courseId}/items", "courseCollectionItems.list", "courseCollectionItems"),
  studioCoursesList: operation("app", "GET", "/app/v3/api/studio/courses", "studioCourses.list", "studioCourses"),
  studioCoursesCreate: operation("app", "POST", "/app/v3/api/studio/courses", "studioCourses.create", "studioCourses"),
  studioCoursesRetrieve: operation("app", "GET", "/app/v3/api/studio/courses/{courseId}", "studioCourses.retrieve", "studioCourses"),
  studioCoursesUpdate: operation("app", "PUT", "/app/v3/api/studio/courses/{courseId}", "studioCourses.update", "studioCourses"),
  studioCoursesDelete: operation("app", "DELETE", "/app/v3/api/studio/courses/{courseId}", "studioCourses.delete", "studioCourses"),
  studioCoursesSubmit: operation("app", "POST", "/app/v3/api/studio/courses/{courseId}/submit", "studioCourses.submit", "studioCourses"),
  studioCoursesWithdraw: operation("app", "POST", "/app/v3/api/studio/courses/{courseId}/withdraw", "studioCourses.withdraw", "studioCourses"),
};

export const SDKWORK_COURSE_BACKEND_OPERATIONS = {
  courseCategoriesList: operation("backend", "GET", "/backend/v3/api/course_categories", "courseCategories.list", "courseCategories"),
  courseCategoriesCreate: operation("backend", "POST", "/backend/v3/api/course_categories", "courseCategories.create", "courseCategories"),
  courseCategoriesUpdate: operation("backend", "PATCH", "/backend/v3/api/course_categories/{categoryId}", "courseCategories.update", "courseCategories"),
  courseCategoriesDelete: operation("backend", "DELETE", "/backend/v3/api/course_categories/{categoryId}", "courseCategories.delete", "courseCategories"),
  courseCategoriesUpdateReorder: operation("backend", "PUT", "/backend/v3/api/course_categories/reorder", "courseCategories.reorder", "courseCategories"),
  courseInstructorsList: operation("backend", "GET", "/backend/v3/api/course_instructors", "courseInstructors.list", "courseInstructors"),
  courseInstructorsCreate: operation("backend", "POST", "/backend/v3/api/course_instructors", "courseInstructors.create", "courseInstructors"),
  courseInstructorsRetrieve: operation("backend", "GET", "/backend/v3/api/course_instructors/{instructorId}", "courseInstructors.retrieve", "courseInstructors"),
  courseInstructorsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_instructors/{instructorId}", "courseInstructors.update", "courseInstructors"),
  courseInstructorsStatusUpdate: operation("backend", "PATCH", "/backend/v3/api/course_instructors/{instructorId}/status", "courseInstructors.status.update", "courseInstructors"),
  coursesList: operation("backend", "GET", "/backend/v3/api/courses", "courses.list", "courses"),
  coursesCreate: operation("backend", "POST", "/backend/v3/api/courses", "courses.create", "courses"),
  coursesRetrieve: operation("backend", "GET", "/backend/v3/api/courses/{courseId}", "courses.retrieve", "courses"),
  coursesUpdate: operation("backend", "PATCH", "/backend/v3/api/courses/{courseId}", "courses.update", "courses"),
  coursesDelete: operation("backend", "DELETE", "/backend/v3/api/courses/{courseId}", "courses.delete", "courses"),
  coursesPublish: operation("backend", "POST", "/backend/v3/api/courses/{courseId}/publish", "courses.publish", "courses"),
  coursesUnpublish: operation("backend", "POST", "/backend/v3/api/courses/{courseId}/unpublish", "courses.unpublish", "courses"),
  courseOfferingsList: operation("backend", "GET", "/backend/v3/api/courses/{courseId}/offerings", "courseOfferings.list", "courseOfferings"),
  courseOfferingsCreate: operation("backend", "POST", "/backend/v3/api/courses/{courseId}/offerings", "courseOfferings.create", "courseOfferings"),
  courseOfferingsRetrieve: operation("backend", "GET", "/backend/v3/api/course_offerings/{offeringId}", "courseOfferings.retrieve", "courseOfferings"),
  courseOfferingsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_offerings/{offeringId}", "courseOfferings.update", "courseOfferings"),
  courseOfferingsPublish: operation("backend", "POST", "/backend/v3/api/course_offerings/{offeringId}/publish", "courseOfferings.publish", "courseOfferings"),
  courseOfferingsClose: operation("backend", "POST", "/backend/v3/api/course_offerings/{offeringId}/close", "courseOfferings.close", "courseOfferings"),
  courseOfferingsDelete: operation("backend", "DELETE", "/backend/v3/api/course_offerings/{offeringId}", "courseOfferings.delete", "courseOfferings"),
  courseSectionsList: operation("backend", "GET", "/backend/v3/api/courses/{courseId}/sections", "courseSections.list", "courseSections"),
  courseSectionsCreate: operation("backend", "POST", "/backend/v3/api/courses/{courseId}/sections", "courseSections.create", "courseSections"),
  courseSectionsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_sections/{sectionId}", "courseSections.update", "courseSections"),
  courseSectionsDelete: operation("backend", "DELETE", "/backend/v3/api/course_sections/{sectionId}", "courseSections.delete", "courseSections"),
  courseSectionsUpdateReorder: operation("backend", "PUT", "/backend/v3/api/courses/{courseId}/sections/reorder", "courseSections.reorder", "courseSections"),
  courseLessonsList: operation("backend", "GET", "/backend/v3/api/courses/{courseId}/lessons", "courseLessons.list", "courseLessons"),
  courseLessonsCreate: operation("backend", "POST", "/backend/v3/api/courses/{courseId}/lessons", "courseLessons.create", "courseLessons"),
  courseLessonsRetrieve: operation("backend", "GET", "/backend/v3/api/course_lessons/{lessonId}", "courseLessons.retrieve", "courseLessons"),
  courseLessonsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_lessons/{lessonId}", "courseLessons.update", "courseLessons"),
  courseLessonsDelete: operation("backend", "DELETE", "/backend/v3/api/course_lessons/{lessonId}", "courseLessons.delete", "courseLessons"),
  courseLessonsUpdateReorder: operation("backend", "PUT", "/backend/v3/api/courses/{courseId}/lessons/reorder", "courseLessons.reorder", "courseLessons"),
  courseResourcesList: operation("backend", "GET", "/backend/v3/api/course_lessons/{lessonId}/resources", "courseResources.list", "courseResources"),
  courseResourcesCreate: operation("backend", "POST", "/backend/v3/api/course_lessons/{lessonId}/resources", "courseResources.create", "courseResources"),
  courseResourcesUpdate: operation("backend", "PATCH", "/backend/v3/api/course_resources/{resourceRefId}", "courseResources.update", "courseResources"),
  courseResourcesDelete: operation("backend", "DELETE", "/backend/v3/api/course_resources/{resourceRefId}", "courseResources.delete", "courseResources"),
  courseLiveSessionsList: operation("backend", "GET", "/backend/v3/api/course_live_sessions", "courseLiveSessions.list", "courseLiveSessions"),
  courseLiveSessionsCreate: operation("backend", "POST", "/backend/v3/api/course_live_sessions", "courseLiveSessions.create", "courseLiveSessions"),
  courseLiveSessionsRetrieve: operation("backend", "GET", "/backend/v3/api/course_live_sessions/{liveSessionId}", "courseLiveSessions.retrieve", "courseLiveSessions"),
  courseLiveSessionsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_live_sessions/{liveSessionId}", "courseLiveSessions.update", "courseLiveSessions"),
  courseLiveSessionsStart: operation("backend", "POST", "/backend/v3/api/course_live_sessions/{liveSessionId}/start", "courseLiveSessions.start", "courseLiveSessions"),
  courseLiveSessionsEnd: operation("backend", "POST", "/backend/v3/api/course_live_sessions/{liveSessionId}/end", "courseLiveSessions.end", "courseLiveSessions"),
  courseLiveSessionsCancel: operation("backend", "POST", "/backend/v3/api/course_live_sessions/{liveSessionId}/cancel", "courseLiveSessions.cancel", "courseLiveSessions"),
  courseLiveSessionsReplayCreate: operation("backend", "POST", "/backend/v3/api/course_live_sessions/{liveSessionId}/replay", "courseLiveSessions.replay.create", "courseLiveSessions"),
  courseLiveSessionsReplayPublish: operation("backend", "POST", "/backend/v3/api/course_live_sessions/{liveSessionId}/replay/publish", "courseLiveSessions.replay.publish", "courseLiveSessions"),
  courseEnrollmentsList: operation("backend", "GET", "/backend/v3/api/course_enrollments", "courseEnrollments.list", "courseEnrollments"),
  courseEnrollmentsCreate: operation("backend", "POST", "/backend/v3/api/course_enrollments/grants", "courseEnrollments.create", "courseEnrollments"),
  courseEnrollmentsRevoke: operation("backend", "POST", "/backend/v3/api/course_enrollments/{enrollmentId}/revoke", "courseEnrollments.revoke", "courseEnrollments"),
  courseProgressList: operation("backend", "GET", "/backend/v3/api/course_progress", "courseProgress.list", "courseProgress"),
  courseProgressRetrieve: operation("backend", "GET", "/backend/v3/api/course_enrollments/{enrollmentId}/progress", "courseProgress.retrieve", "courseProgress"),
  courseLessonProgressUpdate: operation("backend", "PATCH", "/backend/v3/api/course_lesson_progress/{lessonProgressId}", "courseLessonProgress.update", "courseLessonProgress"),
  courseCommentsList: operation("backend", "GET", "/backend/v3/api/course_comments", "courseComments.list", "courseComments"),
  courseCommentsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_comments/{commentId}/moderation", "courseComments.update", "courseComments"),
  courseCommentsDelete: operation("backend", "DELETE", "/backend/v3/api/course_comments/{commentId}", "courseComments.delete", "courseComments"),
  courseReactionsList: operation("backend", "GET", "/backend/v3/api/course_reactions", "courseReactions.list", "courseReactions"),
  courseApplicationsList: operation("backend", "GET", "/backend/v3/api/course_applications", "courseApplications.list", "courseApplications"),
  courseApplicationsRetrieve: operation("backend", "GET", "/backend/v3/api/course_applications/{applicationId}", "courseApplications.retrieve", "courseApplications"),
  courseApplicationsUpdate: operation("backend", "PATCH", "/backend/v3/api/course_applications/{applicationId}/review", "courseApplications.update", "courseApplications"),
  courseApplicationsConvert: operation("backend", "POST", "/backend/v3/api/course_applications/{applicationId}/convert", "courseApplications.convert", "courseApplications"),
  courseReportsOverviewRetrieve: operation("backend", "GET", "/backend/v3/api/course_reports/overview", "courseReports.overview.retrieve", "courseReports"),
  courseReportsLearningList: operation("backend", "GET", "/backend/v3/api/course_reports/learning", "courseReports.learning.list", "courseReports"),
  courseReportsLiveSessionsList: operation("backend", "GET", "/backend/v3/api/course_reports/live_sessions", "courseReports.liveSessions.list", "courseReports"),
  courseAuditLogsList: operation("backend", "GET", "/backend/v3/api/course_audit_logs", "courseAuditLogs.list", "courseAuditLogs"),
  courseAuditLogsRetrieve: operation("backend", "GET", "/backend/v3/api/course_audit_logs/{auditLogId}", "courseAuditLogs.retrieve", "courseAuditLogs"),
  courseReviewsList: operation("backend", "GET", "/backend/v3/api/course_reviews", "courseReviews.list", "courseReviews"),
  courseReviewsStats: operation("backend", "GET", "/backend/v3/api/course_reviews/stats", "courseReviews.stats", "courseReviews"),
  courseReviewsRetrieve: operation("backend", "GET", "/backend/v3/api/course_reviews/{courseId}", "courseReviews.retrieve", "courseReviews"),
  courseReviewsReview: operation("backend", "POST", "/backend/v3/api/course_reviews/{courseId}/review", "courseReviews.review", "courseReviews"),
  coursesOffline: operation("backend", "POST", "/backend/v3/api/courses/{courseId}/offline", "courses.offline", "courses"),
};

export const SDKWORK_COURSE_STANDARD = {
  api: {
    appPrefix: app,
    backendPrefix: backend,
    openapi: "3.1.2",
  },
  appOperations: Object.values(SDKWORK_COURSE_APP_OPERATIONS),
  backendOperations: Object.values(SDKWORK_COURSE_BACKEND_OPERATIONS),
  capability: "course",
  domain: "content",
  tables: SDKWORK_COURSE_TABLES,
} as const;

function operation(
  apiSurface: CourseApiSurface,
  method: CourseHttpMethod,
  path: string,
  operationId: string,
  tag: CourseSdkNamespace,
): CourseOperationContract {
  return {
    apiSurface,
    method,
    operationId,
    path,
    tag,
  };
}
