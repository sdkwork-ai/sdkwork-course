use std::future::Future;
use std::pin::Pin;

use serde_json::Value;
use sqlx::{PgPool, Row};

use crate::db::schema::COURSE_TABLES;
use sdkwork_content_course_service::{
    CourseApplicationCreateRequest, CourseApplicationItem, CourseApplicationReviewRequest,
    CourseAuditCommand, CourseAuditLogItem, CourseCatalogCommand, CourseCategoryItem,
    CourseEnrollmentCommand, CourseError,
    CourseItem, CourseLessonCommand, CourseLessonItem, CourseLessonProgressCommand,
    CourseLiveSessionCommand, CourseOfferingCommand, CoursePage, CourseQuery, CourseResult,
    CourseSectionItem, CourseServiceContext,
};

pub type CourseRepositoryFuture<'a, T> = Pin<Box<dyn Future<Output = CourseResult<T>> + Send + 'a>>;

#[derive(Debug, Clone)]
pub struct SqlxCourseRepository<Pool> {
    pool: Pool,
}

pub type PostgresCourseRepository = SqlxCourseRepository<PgPool>;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct EmptyCourseRepository;

pub trait CourseSqlxRepositoryPort {
    fn list_categories<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<CourseCategoryItem>>;

    fn save_category<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value>;

    fn reorder_categories<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value>;

    fn save_instructor<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value>;

    fn list_instructors<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>>;

    fn retrieve_instructor<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        instructor_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>>;

    fn update_instructor_status<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        instructor_id: String,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value>;

    fn delete_instructor<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        instructor_id: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn list_courses<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, CoursePage>;

    fn retrieve_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Option<CourseItem>>;

    fn save_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseRepositoryFuture<'a, CourseItem>;

    fn publish_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, CourseItem>;

    fn unpublish_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, CourseItem>;

    fn delete_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn save_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseOfferingCommand,
    ) -> CourseRepositoryFuture<'a, String>;

    fn transition_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        offering_id: String,
        status: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn list_sections<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Vec<CourseSectionItem>>;

    fn save_section<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
        command: Value,
    ) -> CourseRepositoryFuture<'a, CourseSectionItem>;

    fn reorder_sections<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
        section_ids: Vec<String>,
    ) -> CourseRepositoryFuture<'a, Vec<CourseSectionItem>>;

    fn list_lessons<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Vec<CourseLessonItem>>;

    fn save_lesson<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseLessonCommand,
    ) -> CourseRepositoryFuture<'a, CourseLessonItem>;

    fn reorder_lessons<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
        lesson_ids: Vec<String>,
    ) -> CourseRepositoryFuture<'a, Vec<CourseLessonItem>>;

    fn save_resource_ref<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value>;

    fn save_live_session<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseLiveSessionCommand,
    ) -> CourseRepositoryFuture<'a, String>;

    fn transition_live_session<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
        live_status: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn attach_live_replay<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
        resource_ref_id: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn create_enrollment<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseEnrollmentCommand,
    ) -> CourseRepositoryFuture<'a, String>;

    fn revoke_enrollment<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        enrollment_id: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn upsert_lesson_progress<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseLessonProgressCommand,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn submit_application<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        request: CourseApplicationCreateRequest,
    ) -> CourseRepositoryFuture<'a, CourseApplicationItem>;

    fn list_applications<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<CourseApplicationItem>>;

    fn review_application<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        application_id: String,
        request: CourseApplicationReviewRequest,
    ) -> CourseRepositoryFuture<'a, CourseApplicationItem>;

    fn append_audit_log<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseAuditCommand,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn list_audit_logs<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<CourseAuditLogItem>>;

    fn delete_category<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        category_id: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn list_offerings<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Vec<Value>>;

    fn retrieve_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        offering_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>>;

    fn delete_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        offering_id: String,
    ) -> CourseRepositoryFuture<'a, ()>;

    fn find_offering_scope<'a>(
        &'a self,
        offering_id: String,
    ) -> CourseRepositoryFuture<'a, Option<(String, String)>>;

    fn list_live_sessions<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>>;

    fn retrieve_live_session<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>>;

    fn list_enrollments<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>>;

    fn list_progress<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>>;

    fn retrieve_progress<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        enrollment_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>>;
}

impl<Pool> SqlxCourseRepository<Pool> {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &Pool {
        &self.pool
    }

    pub fn table_names(&self) -> &'static [&'static str] {
        &COURSE_TABLES
    }
}

impl EmptyCourseRepository {
    pub fn new() -> Self {
        Self
    }
}


fn sqlx_storage_error(error: sqlx::Error) -> CourseError {
    CourseError::storage(error.to_string())
}
