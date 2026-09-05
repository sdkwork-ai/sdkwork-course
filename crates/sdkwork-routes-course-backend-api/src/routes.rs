use std::sync::Arc;

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::http_handlers;
use crate::service_state::CourseBackendApiState;

pub fn build_sdkwork_course_backend_api_router(
    service: Arc<dyn sdkwork_content_course_service::CourseApplicationService>,
) -> Router {
    let prefix = "/backend/v3/api";
    let router = Router::new()
        .route(format!("{prefix}/course_categories").as_str(), get(http_handlers::course_categories_list).post(http_handlers::course_categories_create))
        .route(format!("{prefix}/course_categories/{{categoryId}}").as_str(), patch(http_handlers::course_categories_update).delete(http_handlers::course_categories_delete))
        .route(format!("{prefix}/course_categories/reorder").as_str(), put(http_handlers::course_categories_reorder))
        .route(format!("{prefix}/course_instructors").as_str(), get(http_handlers::course_instructors_list).post(http_handlers::course_instructors_create))
        .route(format!("{prefix}/course_instructors/{{instructorId}}").as_str(), get(http_handlers::course_instructors_retrieve).patch(http_handlers::course_instructors_update))
        .route(format!("{prefix}/course_instructors/{{instructorId}}/status").as_str(), patch(http_handlers::course_instructors_status_update))
        .route(format!("{prefix}/courses").as_str(), get(http_handlers::courses_list).post(http_handlers::courses_create))
        .route(format!("{prefix}/courses/{{courseId}}").as_str(), get(http_handlers::courses_retrieve).patch(http_handlers::courses_update).delete(http_handlers::courses_delete))
        .route(format!("{prefix}/courses/{{courseId}}/publish").as_str(), post(http_handlers::courses_publish))
        .route(format!("{prefix}/courses/{{courseId}}/unpublish").as_str(), post(http_handlers::courses_unpublish))
        .route(format!("{prefix}/courses/{{courseId}}/offerings").as_str(), get(http_handlers::course_offerings_list).post(http_handlers::course_offerings_create))
        .route(format!("{prefix}/course_offerings/{{offeringId}}").as_str(), get(http_handlers::course_offerings_retrieve).patch(http_handlers::course_offerings_update).delete(http_handlers::course_offerings_delete))
        .route(format!("{prefix}/course_offerings/{{offeringId}}/publish").as_str(), post(http_handlers::course_offerings_publish))
        .route(format!("{prefix}/course_offerings/{{offeringId}}/close").as_str(), post(http_handlers::course_offerings_close))
        .route(format!("{prefix}/courses/{{courseId}}/sections").as_str(), get(http_handlers::course_sections_list).post(http_handlers::course_sections_create))
        .route(format!("{prefix}/course_sections/{{sectionId}}").as_str(), patch(http_handlers::course_sections_update).delete(http_handlers::course_sections_delete))
        .route(format!("{prefix}/courses/{{courseId}}/sections/reorder").as_str(), put(http_handlers::course_sections_reorder))
        .route(format!("{prefix}/courses/{{courseId}}/lessons").as_str(), get(http_handlers::course_lessons_list).post(http_handlers::course_lessons_create))
        .route(format!("{prefix}/course_lessons/{{lessonId}}").as_str(), get(http_handlers::course_lessons_retrieve).patch(http_handlers::course_lessons_update).delete(http_handlers::course_lessons_delete))
        .route(format!("{prefix}/courses/{{courseId}}/lessons/reorder").as_str(), put(http_handlers::course_lessons_reorder))
        .route(format!("{prefix}/course_lessons/{{lessonId}}/resources").as_str(), get(http_handlers::course_resources_list).post(http_handlers::course_resources_create))
        .route(format!("{prefix}/course_resources/{{resourceRefId}}").as_str(), patch(http_handlers::course_resources_update).delete(http_handlers::course_resources_delete))
        .route(format!("{prefix}/course_live_sessions").as_str(), get(http_handlers::course_live_sessions_list).post(http_handlers::course_live_sessions_create))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}").as_str(), get(http_handlers::course_live_sessions_retrieve).patch(http_handlers::course_live_sessions_update))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/start").as_str(), post(http_handlers::course_live_sessions_start))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/end").as_str(), post(http_handlers::course_live_sessions_end))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/cancel").as_str(), post(http_handlers::course_live_sessions_cancel))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/replay").as_str(), post(http_handlers::course_live_sessions_replay_attach))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/replay/publish").as_str(), post(http_handlers::course_live_sessions_replay_publish))
        .route(format!("{prefix}/course_enrollments").as_str(), get(http_handlers::course_enrollments_list))
        .route(format!("{prefix}/course_enrollments/grants").as_str(), post(http_handlers::course_enrollments_grant))
        .route(format!("{prefix}/course_enrollments/{{enrollmentId}}/revoke").as_str(), post(http_handlers::course_enrollments_revoke))
        .route(format!("{prefix}/course_progress").as_str(), get(http_handlers::course_progress_list))
        .route(format!("{prefix}/course_enrollments/{{enrollmentId}}/progress").as_str(), get(http_handlers::course_progress_retrieve))
        .route(format!("{prefix}/course_lesson_progress/{{lessonProgressId}}").as_str(), patch(http_handlers::course_lesson_progress_repair))
        .route(format!("{prefix}/course_comments").as_str(), get(http_handlers::course_comments_list))
        .route(format!("{prefix}/course_comments/{{commentId}}/moderation").as_str(), patch(http_handlers::course_comments_moderate))
        .route(format!("{prefix}/course_comments/{{commentId}}").as_str(), delete(http_handlers::course_comments_delete))
        .route(format!("{prefix}/course_reactions").as_str(), get(http_handlers::course_reactions_list))
        .route(format!("{prefix}/course_applications").as_str(), get(http_handlers::course_applications_list))
        .route(format!("{prefix}/course_applications/{{applicationId}}").as_str(), get(http_handlers::course_applications_retrieve))
        .route(format!("{prefix}/course_applications/{{applicationId}}/review").as_str(), patch(http_handlers::course_applications_review))
        .route(format!("{prefix}/course_applications/{{applicationId}}/convert").as_str(), post(http_handlers::course_applications_convert_to_course))
        .route(format!("{prefix}/course_reports/overview").as_str(), get(http_handlers::course_reports_overview_retrieve))
        .route(format!("{prefix}/course_reports/learning").as_str(), get(http_handlers::course_reports_learning_list))
        .route(format!("{prefix}/course_reports/live_sessions").as_str(), get(http_handlers::course_reports_live_sessions_list))
        .route(format!("{prefix}/course_audit_logs").as_str(), get(http_handlers::course_audit_logs_list))
        .route(format!("{prefix}/course_audit_logs/{{auditLogId}}").as_str(), get(http_handlers::course_audit_logs_retrieve))
        .with_state(CourseBackendApiState::new(service));

    // Bare API router for gateway-owned Web Framework hosts (API_ASSEMBLY_SPEC
    // §4.1.1): the composed host's canonical pipeline (standalone gateway or
    // platform cloud gateway) owns classification, authentication,
    // authorization, and domain context injection, so the assembly path must
    // not self-wrap an interceptor pipeline.
    router
}

pub fn build_router(
    service: Arc<dyn sdkwork_content_course_service::CourseApplicationService>,
) -> Router {
    build_sdkwork_course_backend_api_router(service)
}
