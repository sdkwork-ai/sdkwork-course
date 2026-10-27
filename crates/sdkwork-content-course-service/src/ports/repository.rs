use crate::domain::commands::{
    CourseAuditCommand, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLessonProgressCommand, CourseLiveSessionCommand, CourseOfferingCommand,
    CourseReviewDecisionCommand, CourseServiceContext, CourseStudioDraftCommand,
};
use crate::domain::models::{
    CourseApplicationItem, CourseCategoryItem, CourseCollectionItem, CourseCurriculum, CourseItem,
    CourseLessonItem, CoursePage, CourseQuery, CourseResult, CourseSectionItem, CourseStudioDetail,
    QuestionItem, QuestionPage, QuestionQuery,
};

#[async_trait::async_trait]
pub trait CourseCategoryRepository: Send + Sync {
    async fn list_categories(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseCategoryItem>>;

    async fn retrieve_category(
        &self,
        context: &CourseServiceContext,
        category_id: String,
    ) -> CourseResult<Option<CourseCategoryItem>>;

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
    async fn count_courses(
        &self,
        context: &CourseServiceContext,
        publish_status: Option<String>,
    ) -> CourseResult<i64>;
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

    async fn review_stats(&self, context: &CourseServiceContext)
        -> CourseResult<serde_json::Value>;
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

    async fn record_live_join(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;

    async fn heartbeat_live_attendance(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;

    async fn leave_live_attendance(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseEnrollmentRepository: Send + Sync {
    async fn count_enrollments(&self, context: &CourseServiceContext) -> CourseResult<i64>;

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
    async fn count_applications(&self, context: &CourseServiceContext) -> CourseResult<i64>;

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

// ── Question bank ───────────────────────────────────────────────────

#[async_trait::async_trait]
pub trait QuestionBankRepository: Send + Sync {
    async fn list_questions(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<QuestionPage>;

    async fn retrieve_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<Option<QuestionItem>>;

    /// Inserts or updates a question. `command.id` present means update.
    async fn save_question(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<QuestionItem>;

    async fn delete_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<()>;

    /// Reference counts (`paperCount`, `handoutCount`) guarding deletion.
    async fn question_references(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<serde_json::Value>;

    /// Imports questions one row at a time; per-row failures are reported in
    /// the outcome instead of failing the whole batch.
    async fn import_questions(
        &self,
        context: &CourseServiceContext,
        commands: Vec<serde_json::Value>,
    ) -> CourseResult<serde_json::Value>;

    /// Applies a partial patch (tags / knowledge points / wrong-book flag /
    /// status) to an explicit list of question ids.
    async fn update_questions_batch(
        &self,
        context: &CourseServiceContext,
        question_ids: Vec<String>,
        patch: serde_json::Value,
    ) -> CourseResult<u64>;

    /// Random candidate selection for smart composition. The store picks the
    /// rows (`ORDER BY random()`), the caller only bounds the count and the
    /// exclusion list, so no unbounded in-memory collect happens.
    async fn select_compose_candidates(
        &self,
        context: &CourseServiceContext,
        spec: serde_json::Value,
    ) -> CourseResult<Vec<QuestionItem>>;

    /// Aggregated grade/subject/chapter/knowledge-point/tag taxonomy.
    async fn retrieve_taxonomy(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<serde_json::Value>;

    /// Paper list page; returns `{ items, total }`.
    async fn list_papers(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<serde_json::Value>;

    /// Paper with its ordered item rows and embedded question snapshots.
    async fn retrieve_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;

    /// Inserts or updates a paper and replaces its item rows atomically.
    async fn save_paper(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn delete_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<()>;

    async fn archive_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<serde_json::Value>;

    /// Handout list page; returns `{ items, total }`.
    async fn list_handouts(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<serde_json::Value>;

    /// Handout with its embedded question references.
    async fn retrieve_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<Option<serde_json::Value>>;

    async fn save_handout(
        &self,
        context: &CourseServiceContext,
        command: serde_json::Value,
    ) -> CourseResult<serde_json::Value>;

    async fn delete_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<()>;
}
