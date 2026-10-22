use crate::domain::commands::{
    CourseAuditCommand, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLessonProgressCommand, CourseLiveSessionCommand, CourseOfferingCommand,
    CourseReviewDecisionCommand, CourseServiceContext, CourseStudioDraftCommand,
};
use crate::domain::models::{
    CourseApplicationItem, CourseCategoryItem, CourseCollectionItem, CourseCurriculum, CourseItem, CourseLessonItem, CoursePage, CourseQuery, CourseResult,
    CourseSectionItem, CourseStudioDetail,
};

#[async_trait::async_trait]
pub trait CourseCategoryRepository: Send + Sync {
    async fn list_categories(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseCategoryItem>>;

    async fn save_category(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn reorder_categories(
        &self,
        context: &CourseServiceContext,
        category_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseCategoryItem>>;

    async fn delete_category(
        &self,
        context: &CourseServiceContext,
        category_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseInstructorRepository: Send + Sync {
    async fn list_instructors(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<serde_json::Value>>;

    async fn retrieve_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;

    async fn save_instructor(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn update_instructor_status(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn delete_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseCatalogRepository: Send + Sync {
    async fn list_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage>;

    async fn retrieve_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseItem>>;

    async fn save_course(
        &self,
        context: &CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseResult<CourseItem>;

    async fn publish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn unpublish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn delete_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<()>;

    async fn save_studio_course(
        &self,
        context: &CourseServiceContext,
        command: CourseStudioDraftCommand,
    ) -> CourseResult<CourseItem>;

    async fn retrieve_course_detail(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseStudioDetail>>;

    async fn retrieve_curriculum(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseCurriculum>>;

    async fn list_collection_items(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseCollectionItem>>;

    async fn submit_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn withdraw_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn review_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: CourseReviewDecisionCommand,
    ) -> CourseResult<CourseItem>;

    async fn offline_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        note: Option<String>,
    ) -> CourseResult<CourseItem>;

    async fn list_review_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage>;

    async fn review_stats(&self, context: &CourseServiceContext) -> CourseResult<serde_json::Value>;
}

#[async_trait::async_trait]
pub trait CourseOfferingRepository: Send + Sync {
    async fn save_offering(
        &self,
        context: &CourseServiceContext,
        command: CourseOfferingCommand,
    ) -> CourseResult<String>;

    async fn transition_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        status: String,
    ) -> CourseResult<()>;

    async fn list_offerings(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<serde_json::Value>>;

    async fn retrieve_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;

    async fn delete_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<()>;

    async fn find_offering_scope(
        &self,
        offering_id: String,
    ) -> CourseResult<Option<(String, String)>>;
}

#[async_trait::async_trait]
pub trait CourseLessonRepository: Send + Sync {
    async fn list_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseSectionItem>>;

    async fn save_section(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: serde_json::Value,
    ) -> CourseResult<CourseSectionItem>;

    async fn reorder_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        section_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseSectionItem>>;

    async fn list_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseLessonItem>>;

    async fn retrieve_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<Option<CourseLessonItem>>;

    async fn save_lesson(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonCommand,
    ) -> CourseResult<CourseLessonItem>;

    async fn reorder_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        lesson_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseLessonItem>>;

    async fn delete_section(
        &self,
        context: &CourseServiceContext,
        section_id: String,
    ) -> CourseResult<()>;

    async fn delete_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseLiveSessionRepository: Send + Sync {
    async fn save_live_session(
        &self,
        context: &CourseServiceContext,
        command: CourseLiveSessionCommand,
    ) -> CourseResult<String>;

    async fn transition_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        live_status: String,
    ) -> CourseResult<()>;

    async fn attach_live_replay(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        resource_ref_id: String,
    ) -> CourseResult<()>;

    async fn list_live_sessions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<serde_json::Value>>;

    async fn retrieve_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;
}

#[async_trait::async_trait]
pub trait CourseEnrollmentRepository: Send + Sync {
    async fn create_enrollment(
        &self,
        context: &CourseServiceContext,
        command: CourseEnrollmentCommand,
    ) -> CourseResult<String>;

    async fn retrieve_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;

    async fn revoke_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<()>;

    async fn list_enrollments(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<serde_json::Value>>;

    /// Whether a learner has an active enrollment for a course.
    async fn has_active_enrollment(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        user_id: String,
    ) -> CourseResult<bool>;
}

#[async_trait::async_trait]
pub trait CourseProgressRepository: Send + Sync {
    async fn upsert_lesson_progress(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonProgressCommand,
    ) -> CourseResult<()>;

    async fn repair_lesson_progress(
        &self,
        context: &CourseServiceContext,
        lesson_progress_id: String,
        command: serde_json::Value,
    ) -> CourseResult<()>;

    async fn list_progress(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<serde_json::Value>>;

    async fn retrieve_progress(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;
}

#[async_trait::async_trait]
pub trait CourseApplicationRepository: Send + Sync {
    async fn list_applications(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseApplicationItem>>;

    async fn retrieve_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<Option<CourseApplicationItem>>;

    async fn submit_application(
        &self,
        context: &CourseServiceContext,
        request: crate::domain::models::CourseApplicationCreateRequest,
    ) -> CourseResult<CourseApplicationItem>;

    async fn review_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
        request: crate::domain::models::CourseApplicationReviewRequest,
    ) -> CourseResult<CourseApplicationItem>;

    async fn convert_to_course(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<CourseItem>;
}

#[async_trait::async_trait]
pub trait CourseAuditLogRepository: Send + Sync {
    async fn append_audit_log(
        &self,
        context: &CourseServiceContext,
        command: CourseAuditCommand,
    ) -> CourseResult<()>;

    async fn list_audit_logs(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<crate::domain::models::CourseAuditLogItem>>;

    async fn retrieve_audit_log(
        &self,
        context: &CourseServiceContext,
        audit_log_id: String,
    ) -> CourseResult<Option<crate::domain::models::CourseAuditLogItem>>;
}

#[async_trait::async_trait]
pub trait CourseResourceRepository: Send + Sync {
    async fn list_resources(
        &self,
        context: &CourseServiceContext,
        owner_type: String,
        owner_id: String,
    ) -> CourseResult<Vec<serde_json::Value>>;

    async fn save_resource_ref(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn delete_resource_ref(
        &self,
        context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseReactionRepository: Send + Sync {
    async fn course_engagement(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<serde_json::Value>;

    async fn list_reactions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<serde_json::Value>>;

    async fn save_reaction(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn delete_reaction(
        &self,
        context: &CourseServiceContext,
        reaction_id: String,
    ) -> CourseResult<()>;
}
