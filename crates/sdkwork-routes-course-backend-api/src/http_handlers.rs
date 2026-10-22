//! HTTP handlers for course backend API routes.
//! Path parameter names follow OpenAPI camelCase identifiers.

#![allow(non_snake_case)]

use std::collections::BTreeMap;

use axum::{
    extract::{Path, Query, State},
    response::Response,
    Json,
};
use sdkwork_routes_course_http_auth::{
    course_service_context_from_web, handler_value_to_response, map_auth_error, map_route_error,
};
use sdkwork_web_core::WebRequestContext;
use serde_json::Value;

use crate::handlers;
use crate::service_state::CourseBackendApiState;

macro_rules! course_handler_ctx {
    ($state:expr, $app_ctx:expr, $handler:ident) => {{
        let web_ctx = Some(&$app_ctx);
        let context = match course_service_context_from_web(&$app_ctx) {
            Ok(context) => context,
            Err(error) => return map_auth_error(web_ctx, error),
        };
        let service = $state.service();
        match handlers::$handler(service.as_ref(), &context).await {
            Ok(value) => handler_value_to_response(web_ctx, value, None),
            Err(error) => map_route_error(web_ctx, error.code(), error.message().to_owned()),
        }
    }};
}

macro_rules! course_handler_query {
    ($state:expr, $app_ctx:expr, $query:expr, $handler:ident) => {{
        let web_ctx = Some(&$app_ctx);
        let context = match course_service_context_from_web(&$app_ctx) {
            Ok(context) => context,
            Err(error) => return map_auth_error(web_ctx, error),
        };
        let service = $state.service();
        let params = serde_json::to_value($query.0).unwrap_or(Value::Null);
        let course_query = crate::mapper::request::parse_course_query(&params);
        match handlers::$handler(service.as_ref(), &context, course_query.clone()).await {
            Ok(value) => handler_value_to_response(web_ctx, value, Some(&course_query)),
            Err(error) => map_route_error(web_ctx, error.code(), error.message().to_owned()),
        }
    }};
}

macro_rules! course_handler_path {
    ($state:expr, $app_ctx:expr, $path:expr, $handler:ident) => {{
        let web_ctx = Some(&$app_ctx);
        let context = match course_service_context_from_web(&$app_ctx) {
            Ok(context) => context,
            Err(error) => return map_auth_error(web_ctx, error),
        };
        let service = $state.service();
        match handlers::$handler(service.as_ref(), &context, $path).await {
            Ok(value) => handler_value_to_response(web_ctx, value, None),
            Err(error) => map_route_error(web_ctx, error.code(), error.message().to_owned()),
        }
    }};
}

macro_rules! course_handler_path_body {
    ($state:expr, $app_ctx:expr, $path:expr, $body:expr, $handler:ident) => {{
        let web_ctx = Some(&$app_ctx);
        let context = match course_service_context_from_web(&$app_ctx) {
            Ok(context) => context,
            Err(error) => return map_auth_error(web_ctx, error),
        };
        let service = $state.service();
        match handlers::$handler(service.as_ref(), &context, $path, $body.0).await {
            Ok(value) => handler_value_to_response(web_ctx, value, None),
            Err(error) => map_route_error(web_ctx, error.code(), error.message().to_owned()),
        }
    }};
}

macro_rules! course_handler_body {
    ($state:expr, $app_ctx:expr, $body:expr, $handler:ident) => {{
        let web_ctx = Some(&$app_ctx);
        let context = match course_service_context_from_web(&$app_ctx) {
            Ok(context) => context,
            Err(error) => return map_auth_error(web_ctx, error),
        };
        let service = $state.service();
        match handlers::$handler(service.as_ref(), &context, $body.0).await {
            Ok(value) => handler_value_to_response(web_ctx, value, None),
            Err(error) => map_route_error(web_ctx, error.code(), error.message().to_owned()),
        }
    }};
}


pub async fn course_categories_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_categories_list)
}

pub async fn course_categories_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_categories_create)
}

pub async fn course_categories_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(categoryId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, categoryId, body, course_categories_update)
}

pub async fn course_categories_delete(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(categoryId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, categoryId, course_categories_delete)
}

pub async fn course_categories_reorder(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_categories_reorder)
}

pub async fn course_instructors_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_instructors_list)
}

pub async fn course_instructors_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_instructors_create)
}

pub async fn course_instructors_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(instructorId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, instructorId, course_instructors_retrieve)
}

pub async fn course_instructors_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(instructorId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, instructorId, body, course_instructors_update)
}

pub async fn course_instructors_status_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(instructorId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, instructorId, body, course_instructors_status_update)
}

pub async fn courses_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, courses_list)
}

pub async fn courses_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, courses_create)
}

pub async fn courses_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, courses_retrieve)
}

pub async fn courses_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, courses_update)
}

pub async fn courses_delete(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, courses_delete)
}

pub async fn courses_publish(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, courses_publish)
}

pub async fn courses_unpublish(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, courses_unpublish)
}

pub async fn course_offerings_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_offerings_list)
}

pub async fn course_offerings_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, course_offerings_create)
}

pub async fn course_offerings_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, offeringId, course_offerings_retrieve)
}

pub async fn course_offerings_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, offeringId, body, course_offerings_update)
}

pub async fn course_offerings_publish(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, offeringId, course_offerings_publish)
}

pub async fn course_offerings_close(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, offeringId, course_offerings_close)
}

pub async fn course_offerings_delete(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, offeringId, course_offerings_delete)
}

pub async fn course_sections_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_sections_list)
}

pub async fn course_sections_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, course_sections_create)
}

pub async fn course_sections_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(sectionId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, sectionId, body, course_sections_update)
}

pub async fn course_sections_delete(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(sectionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, sectionId, course_sections_delete)
}

pub async fn course_sections_reorder(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, course_sections_reorder)
}

pub async fn course_lessons_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_lessons_list)
}

pub async fn course_lessons_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, course_lessons_create)
}

pub async fn course_lessons_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, lessonId, course_lessons_retrieve)
}

pub async fn course_lessons_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, lessonId, body, course_lessons_update)
}

pub async fn course_lessons_delete(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, lessonId, course_lessons_delete)
}

pub async fn course_lessons_reorder(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, course_lessons_reorder)
}

pub async fn course_resources_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, lessonId, course_resources_list)
}

pub async fn course_resources_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, lessonId, body, course_resources_create)
}

pub async fn course_resources_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(resourceRefId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, resourceRefId, body, course_resources_update)
}

pub async fn course_resources_delete(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(resourceRefId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, resourceRefId, course_resources_delete)
}

pub async fn course_live_sessions_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_live_sessions_list)
}

pub async fn course_live_sessions_create(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_live_sessions_create)
}

pub async fn course_live_sessions_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_retrieve)
}

pub async fn course_live_sessions_update(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, liveSessionId, body, course_live_sessions_update)
}

pub async fn course_live_sessions_start(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_start)
}

pub async fn course_live_sessions_end(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_end)
}

pub async fn course_live_sessions_cancel(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_cancel)
}

pub async fn course_live_sessions_replay_attach(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, liveSessionId, body, course_live_sessions_replay_attach)
}

pub async fn course_live_sessions_replay_publish(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_replay_publish)
}

pub async fn course_enrollments_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_enrollments_list)
}

pub async fn course_enrollments_grant(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_enrollments_grant)
}

pub async fn course_enrollments_revoke(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(enrollmentId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, enrollmentId, course_enrollments_revoke)
}

pub async fn course_progress_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_progress_list)
}

pub async fn course_progress_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(enrollmentId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, enrollmentId, course_progress_retrieve)
}

pub async fn course_lesson_progress_repair(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(lessonProgressId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, lessonProgressId, body, course_lesson_progress_repair)
}

pub async fn course_reactions_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_reactions_list)
}

pub async fn course_applications_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_applications_list)
}

pub async fn course_applications_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(applicationId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, applicationId, course_applications_retrieve)
}

pub async fn course_applications_review(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(applicationId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, applicationId, body, course_applications_review)
}

pub async fn course_applications_convert_to_course(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(applicationId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, applicationId, course_applications_convert_to_course)
}

pub async fn course_reports_overview_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
) -> Response {
    course_handler_ctx!(state, app_ctx, course_reports_overview_retrieve)
}

pub async fn course_reports_learning_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_reports_learning_list)
}

pub async fn course_reports_live_sessions_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_reports_live_sessions_list)
}

pub async fn course_audit_logs_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_audit_logs_list)
}

pub async fn course_audit_logs_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(auditLogId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, auditLogId, course_audit_logs_retrieve)
}

pub async fn course_reviews_list(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_reviews_list)
}

pub async fn course_reviews_stats(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
) -> Response {
    course_handler_ctx!(state, app_ctx, course_reviews_stats)
}

pub async fn course_reviews_retrieve(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_reviews_retrieve)
}

pub async fn course_reviews_review(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, course_reviews_review)
}

pub async fn courses_offline(
    State(state): State<CourseBackendApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, courses_offline)
}
