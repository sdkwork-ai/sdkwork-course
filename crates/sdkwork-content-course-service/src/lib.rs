//! SDKWork content course service contracts and ports.

pub mod domain;
pub mod ports;
pub mod service;
pub mod test_support;

pub use domain::commands::{
    is_supported_course_kind, normalize_course_kind, CourseAuditCommand, CourseCatalogCommand,
    CourseEnrollmentCommand, CourseLessonCommand, CourseLessonKind, CourseLessonProgressCommand,
    CourseLiveJoinGrant, CourseLiveSessionCommand, CourseMediaResourceRef, CourseOfferingCommand,
    CourseOfferingType, CourseOfflineCommand, CourseProgressStatus, CourseReviewDecisionCommand,
    CourseServiceContext, CourseStudioDraftCommand, CourseStudioLessonDraft,
    CourseStudioResourceDraft, CourseStudioSectionDraft, COURSE_KIND_COLLECTION,
    COURSE_KIND_COLUMN, COURSE_KIND_STANDARD,
};
pub use domain::models::{
    is_supported_question_type, ComposeBucket, CourseApplicationCreateRequest,
    CourseApplicationItem, CourseApplicationReviewRequest, CourseAuditLogItem, CourseCategoryItem,
    CourseCollectionItem, CourseCurriculum, CourseEngagementItem, CourseError, CourseItem,
    CourseLessonItem, CourseLessonMutationRequest, CourseMutationRequest, CoursePage, CourseQuery,
    CourseResourceItem, CourseResult, CourseSectionItem, CourseSectionMutationRequest,
    CourseStudioDetail, QuestionItem, QuestionPage, QuestionQuery, QUESTION_TYPE_SECTION_ORDER,
};
pub use ports::provider::{
    CourseAuditEventPort, CourseDrivePort, CourseEntitlementPort, CourseLiveProviderPort,
    CourseNotificationPort,
};
pub use ports::repository::{
    CourseApplicationRepository, CourseAuditLogRepository, CourseCatalogRepository,
    CourseCategoryRepository, CourseEnrollmentRepository, CourseEntitlementGrantRepository,
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

    #[test]
    fn reports_overview_payload_keeps_the_admin_surface_keys() {
        let payload =
            crate::service::course_service::reports_overview_payload(2685, 2684, 0, 0, 3, 0.0);
        assert_eq!(
            payload,
            serde_json::json!({
                "courseCount": 2685,
                "publishedCourseCount": 2684,
                "studentCount": 0,
                "enrollmentCount": 0,
                "liveSessionCount": 3,
                "completionRate": 0.0,
            })
        );
        // The admin console reads exactly these names with a zero fallback, so
        // a renamed key is invisible in review but renders 0 on every card.
        for key in [
            "courseCount",
            "publishedCourseCount",
            "studentCount",
            "enrollmentCount",
            "liveSessionCount",
            "completionRate",
        ] {
            assert!(payload.get(key).is_some(), "missing overview key {key}");
        }
    }
}
