//! HTTP handlers for course app API routes.
//! Path parameter names follow OpenAPI camelCase identifiers.

#![allow(non_snake_case)]

use std::collections::BTreeMap;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use sdkwork_routes_course_http_auth::{
    course_service_context_from_web, handler_value_to_response, map_auth_error, map_route_error,
};
use sdkwork_content_course_service::CourseServiceContext;
use sdkwork_web_core::WebRequestContext;
use serde_json::Value;

use crate::handlers;
use crate::service_state::CourseAppApiState;

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
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_categories_list)
}

pub async fn course_categories_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(categoryId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, categoryId, course_categories_retrieve)
}

pub async fn courses_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, courses_list)
}

pub async fn courses_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, courses_retrieve)
}

pub async fn course_offerings_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_offerings_list)
}

pub async fn course_offerings_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, offeringId, course_offerings_retrieve)
}

pub async fn course_enrollments_create(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(offeringId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, offeringId, body, course_enrollments_create)
}

pub async fn course_enrollments_current_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_enrollments_current_list)
}

pub async fn course_enrollments_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(enrollmentId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, enrollmentId, course_enrollments_retrieve)
}

pub async fn course_enrollments_cancel(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(enrollmentId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, enrollmentId, course_enrollments_cancel)
}

pub async fn course_sections_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_sections_list)
}

pub async fn course_lessons_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_lessons_list)
}

pub async fn course_lessons_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, lessonId, course_lessons_retrieve)
}

pub async fn course_lesson_resources_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, lessonId, course_lesson_resources_list)
}

pub async fn course_progress_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(enrollmentId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, enrollmentId, course_progress_retrieve)
}

pub async fn course_lesson_progress_update(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, lessonId, body, course_lesson_progress_update)
}

pub async fn course_lesson_progress_watch_positions_update(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(lessonId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, lessonId, body, course_lesson_progress_watch_positions_update)
}

pub async fn course_live_sessions_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_live_sessions_list)
}

pub async fn course_live_sessions_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_retrieve)
}

pub async fn course_live_sessions_join(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_join)
}

pub async fn course_live_sessions_heartbeat(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_heartbeat)
}

pub async fn course_live_sessions_leave(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_leave)
}

pub async fn course_live_sessions_replay_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(liveSessionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, liveSessionId, course_live_sessions_replay_retrieve)
}

pub async fn course_engagement_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_engagement_retrieve)
}

pub async fn course_reactions_replace(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_reactions_replace)
}

pub async fn course_reactions_delete(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(reactionId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, reactionId, course_reactions_delete)
}

pub async fn course_applications_create(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, course_applications_create)
}

pub async fn course_applications_current_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, course_applications_current_list)
}

pub async fn course_applications_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(applicationId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, applicationId, course_applications_retrieve)
}

pub async fn course_curriculum_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_curriculum_retrieve)
}

pub async fn course_collection_items_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, course_collection_items_list)
}

pub async fn studio_courses_list(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    query: Query<BTreeMap<String, String>>,
) -> Response {
    course_handler_query!(state, app_ctx, query, studio_courses_list)
}

pub async fn studio_courses_create(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    body: Json<Value>,
) -> Response {
    course_handler_body!(state, app_ctx, body, studio_courses_create)
}

pub async fn studio_courses_retrieve(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, studio_courses_retrieve)
}

pub async fn studio_courses_update(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
    body: Json<Value>,
) -> Response {
    course_handler_path_body!(state, app_ctx, courseId, body, studio_courses_update)
}

pub async fn studio_courses_delete(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, studio_courses_delete)
}

pub async fn studio_courses_submit(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, studio_courses_submit)
}

pub async fn studio_courses_withdraw(
    State(state): State<CourseAppApiState>,
    app_ctx: WebRequestContext,
    Path(courseId): Path<String>,
) -> Response {
    course_handler_path!(state, app_ctx, courseId, studio_courses_withdraw)
}

/// Internal purchase-to-course entitlement grant.
///
/// The caller must present the shared secret configured in
/// `SDKWORK_COURSE_ENTITLEMENT_SECRET`; the route is registered as anonymous
/// because the order relay has no learner access token.
pub async fn course_entitlements_grant(
    State(state): State<CourseAppApiState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let expected = std::env::var("SDKWORK_COURSE_ENTITLEMENT_SECRET")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let Some(expected) = expected else {
        return (StatusCode::SERVICE_UNAVAILABLE, "entitlement grant is not configured")
            .into_response();
    };
    let provided = headers
        .get("x-sdkwork-entitlement-secret")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if provided != expected {
        return (StatusCode::FORBIDDEN, "invalid entitlement grant secret").into_response();
    }
    let offering_id = body.get("offeringId").and_then(Value::as_str).unwrap_or_default();
    let learner_user_id = body
        .get("learnerUserId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let purchase_ref = body.get("purchaseRef").and_then(Value::as_str).unwrap_or_default();
    if offering_id.is_empty() || learner_user_id.is_empty() || purchase_ref.is_empty() {
        return (StatusCode::UNPROCESSABLE_ENTITY, "invalid entitlement grant payload")
            .into_response();
    }
    let service = state.service();
    match service
        .grant_entitlement_by_offering(
            offering_id.to_owned(),
            learner_user_id.to_owned(),
            purchase_ref.to_owned(),
        )
        .await
    {
        Ok(resource_id) => handler_value_to_response(
            None,
            crate::handlers::ok(serde_json::json!({
                "accepted": true,
                "resourceId": resource_id,
            })),
            None,
        ),
        Err(error) => map_route_error(None, error.code(), error.message().to_owned()),
    }
}
