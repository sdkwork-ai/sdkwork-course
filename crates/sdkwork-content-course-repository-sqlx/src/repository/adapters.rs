use serde_json::Value;
use sqlx::Row;

use sdkwork_content_course_service::domain::models::{
    CourseApplicationCreateRequest, CourseApplicationItem, CourseApplicationReviewRequest,
    CourseAuditLogItem, CourseCategoryItem, CourseError, CourseItem, CourseLessonItem, CoursePage,
    CourseQuery, CourseResult, CourseSectionItem,
};
use sdkwork_content_course_service::ports::repository::{
    CourseApplicationRepository, CourseAuditLogRepository, CourseCatalogRepository,
    CourseCategoryRepository, CourseEnrollmentRepository, CourseInstructorRepository,
    CourseLessonRepository, CourseLiveSessionRepository, CourseOfferingRepository,
    CourseProgressRepository, CourseReactionRepository, CourseResourceRepository,
};
use sdkwork_content_course_service::{
    CourseAuditCommand, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLessonProgressCommand, CourseLiveSessionCommand, CourseOfferingCommand,
    CourseServiceContext,
};

use super::course_repository::CourseSqlxRepositoryPort;

fn sqlx_storage_error(error: sqlx::Error) -> CourseError {
    CourseError::storage(error.to_string())
}

// ── Category ────────────────────────────────────────────────────────

// ── Instructor ──────────────────────────────────────────────────────

// ── Catalog ─────────────────────────────────────────────────────────

// ── Offering ────────────────────────────────────────────────────────

// ── Lesson / Section ────────────────────────────────────────────────

// ── Live Session ────────────────────────────────────────────────────

// ── Enrollment ──────────────────────────────────────────────────────

// ── Progress ────────────────────────────────────────────────────────

// ── Comment ─────────────────────────────────────────────────────────

// ── Application ─────────────────────────────────────────────────────

// ── Audit Log ───────────────────────────────────────────────────────

// ── Resource ────────────────────────────────────────────────────────

// ── Reaction ────────────────────────────────────────────────────────
