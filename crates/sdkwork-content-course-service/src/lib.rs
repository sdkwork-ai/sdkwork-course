//! SDKWork content course service contracts and ports.

pub mod domain;
pub mod ports;
pub mod service;
pub mod test_support;

pub use domain::commands::{
    CourseAuditCommand, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLessonKind, CourseLessonProgressCommand, CourseLiveJoinGrant, CourseLiveSessionCommand,
    CourseMediaResourceRef, CourseOfflineCommand, CourseOfferingCommand, CourseOfferingType,
    CourseProgressStatus, CourseReviewDecisionCommand, CourseServiceContext,
    CourseStudioDraftCommand, CourseStudioLessonDraft, CourseStudioResourceDraft,
    CourseStudioSectionDraft, COURSE_KIND_COLLECTION, COURSE_KIND_COLUMN, COURSE_KIND_STANDARD,
    is_supported_course_kind, normalize_course_kind,
};
pub use domain::models::{
    ComposeBucket, CourseApplicationCreateRequest, CourseApplicationItem,
    CourseApplicationReviewRequest, CourseAuditLogItem, CourseCategoryItem, CourseCollectionItem,
    CourseCurriculum, CourseEngagementItem, CourseError, CourseItem, CourseLessonItem,
    CourseLessonMutationRequest, CourseMutationRequest, CoursePage, CourseQuery, CourseResourceItem,
    CourseResult, CourseSectionItem, CourseSectionMutationRequest, CourseStudioDetail,
    QuestionItem, QuestionPage, QuestionQuery, QUESTION_TYPE_SECTION_ORDER,
    is_supported_question_type,
};
pub use ports::provider::{
    CourseAuditEventPort, CourseDrivePort, CourseEntitlementPort, CourseLiveProviderPort,
    CourseNotificationPort,
};
pub use ports::repository::{
    CourseApplicationRepository, CourseAuditLogRepository, CourseCatalogRepository,
    CourseCategoryRepository, CourseEnrollmentRepository,
    CourseInstructorRepository, CourseLessonRepository, CourseLiveSessionRepository,
    CourseOfferingRepository, CourseProgressRepository, CourseReactionRepository,
    CourseResourceRepository, QuestionBankRepository,
};
pub use service::course_service::{CourseApplicationService, CourseServiceImpl};
pub use service::question_bank_service::{QuestionBankService, QuestionBankServiceImpl};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn course_error_exposes_stable_code_and_message() {
        let error = CourseError::invalid("title is required");
        assert_eq!(error.code(), "invalid");
        assert_eq!(error.message(), "title is required");
    }

    #[test]
    fn course_query_clamps_page_size() {
        let query = CourseQuery {
            page: Some(2),
            page_size: Some(500),
            ..CourseQuery::default()
        };
        assert_eq!(query.limit(), 200);
        assert_eq!(query.offset(), 200);
    }

    #[test]
    fn question_query_clamps_page_size() {
        let query = QuestionQuery {
            page: Some(3),
            page_size: Some(1_000),
            ..QuestionQuery::default()
        };
        assert_eq!(query.limit(), 200);
        assert_eq!(query.offset(), 400);
    }
}
