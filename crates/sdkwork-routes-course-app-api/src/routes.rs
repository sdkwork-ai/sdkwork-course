use std::sync::Arc;

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::http_handlers;
use crate::service_state::CourseAppApiState;

pub fn build_sdkwork_course_app_api_router(
    service: Arc<dyn sdkwork_content_course_service::CourseApplicationService>,
) -> Router {
    let prefix = "/app/v3/api";
    let router = Router::new()
        .route(format!("{prefix}/course_categories").as_str(), get(http_handlers::course_categories_list))
        .route(format!("{prefix}/course_categories/{{categoryId}}").as_str(), get(http_handlers::course_categories_retrieve))
        .route(format!("{prefix}/courses").as_str(), get(http_handlers::courses_list))
        .route(format!("{prefix}/courses/{{courseId}}").as_str(), get(http_handlers::courses_retrieve))
        .route(format!("{prefix}/courses/{{courseId}}/offerings").as_str(), get(http_handlers::course_offerings_list))
        .route(format!("{prefix}/course_offerings/{{offeringId}}").as_str(), get(http_handlers::course_offerings_retrieve))
        .route(format!("{prefix}/course_offerings/{{offeringId}}/enrollments").as_str(), post(http_handlers::course_enrollments_create))
        .route(format!("{prefix}/course_enrollments").as_str(), get(http_handlers::course_enrollments_current_list))
        .route(format!("{prefix}/course_enrollments/{{enrollmentId}}").as_str(), get(http_handlers::course_enrollments_retrieve).delete(http_handlers::course_enrollments_cancel))
        .route(format!("{prefix}/courses/{{courseId}}/sections").as_str(), get(http_handlers::course_sections_list))
        .route(format!("{prefix}/courses/{{courseId}}/lessons").as_str(), get(http_handlers::course_lessons_list))
        .route(format!("{prefix}/course_lessons/{{lessonId}}").as_str(), get(http_handlers::course_lessons_retrieve))
        .route(format!("{prefix}/course_lessons/{{lessonId}}/resources").as_str(), get(http_handlers::course_lesson_resources_list))
        .route(format!("{prefix}/course_enrollments/{{enrollmentId}}/progress").as_str(), get(http_handlers::course_progress_retrieve))
        .route(format!("{prefix}/course_lessons/{{lessonId}}/progress").as_str(), patch(http_handlers::course_lesson_progress_update))
        .route(format!("{prefix}/course_lessons/{{lessonId}}/watch_position").as_str(), patch(http_handlers::course_lesson_progress_watch_positions_update))
        .route(format!("{prefix}/course_live_sessions").as_str(), get(http_handlers::course_live_sessions_list))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}").as_str(), get(http_handlers::course_live_sessions_retrieve))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/join").as_str(), post(http_handlers::course_live_sessions_join))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/heartbeat").as_str(), post(http_handlers::course_live_sessions_heartbeat))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/leave").as_str(), post(http_handlers::course_live_sessions_leave))
        .route(format!("{prefix}/course_live_sessions/{{liveSessionId}}/replay").as_str(), get(http_handlers::course_live_sessions_replay_retrieve))
        .route(format!("{prefix}/courses/{{courseId}}/comments").as_str(), get(http_handlers::course_comments_list).post(http_handlers::course_comments_create))
        .route(format!("{prefix}/course_comments/{{commentId}}").as_str(), delete(http_handlers::course_comments_delete))
        .route(format!("{prefix}/course_reactions").as_str(), put(http_handlers::course_reactions_replace))
        .route(format!("{prefix}/course_reactions/{{reactionId}}").as_str(), delete(http_handlers::course_reactions_delete))
        .route(format!("{prefix}/course_applications").as_str(), post(http_handlers::course_applications_create).get(http_handlers::course_applications_current_list))
        .route(format!("{prefix}/course_applications/{{applicationId}}").as_str(), get(http_handlers::course_applications_retrieve))
        .with_state(CourseAppApiState::new(service));

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
    build_sdkwork_course_app_api_router(service)
}
