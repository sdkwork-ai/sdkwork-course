use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_content_course_service::CourseError;
use sdkwork_utils_rust::{
    PageInfo, PageMode, SdkWorkApiResponse, SdkWorkCommandData, SdkWorkPageData,
    SdkWorkProblemDetail, SdkWorkProblemRouting, SdkWorkResourceData, SdkWorkResultCode,
};
use sdkwork_web_core::WebRequestContext;

use crate::context::CourseAuthError;

pub fn resolve_trace_id(context: Option<&WebRequestContext>) -> String {
    context
        .map(WebRequestContext::resolved_trace_id)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(sdkwork_utils_rust::uuid)
}

fn problem_routing(context: Option<&WebRequestContext>) -> SdkWorkProblemRouting {
    context
        .map(WebRequestContext::problem_routing)
        .unwrap_or_default()
}

fn problem_for_context(
    context: Option<&WebRequestContext>,
    status: StatusCode,
    result_code: SdkWorkResultCode,
    detail: impl Into<String>,
) -> Response {
    let trace_id = resolve_trace_id(context);
    let problem = SdkWorkProblemDetail::platform_enriched(
        result_code,
        detail,
        trace_id.clone(),
        problem_routing(context),
    );
    attach_trace_header((status, Json(problem)).into_response(), &trace_id)
}

pub fn success_item<T: serde::Serialize>(context: Option<&WebRequestContext>, item: T) -> Response {
    let trace_id = resolve_trace_id(context);
    let envelope = SdkWorkApiResponse::success(SdkWorkResourceData { item }, trace_id.clone());
    attach_trace_header((StatusCode::OK, Json(envelope)).into_response(), &trace_id)
}

pub fn success_items<T: serde::Serialize>(
    context: Option<&WebRequestContext>,
    items: Vec<T>,
    page: i64,
    page_size: i64,
    total_items: Option<i64>,
) -> Response {
    let trace_id = resolve_trace_id(context);
    let envelope = SdkWorkApiResponse::success(
        SdkWorkPageData {
            items,
            page_info: PageInfo {
                mode: PageMode::Offset,
                page: Some(page.max(1) as i32),
                page_size: Some(page_size.clamp(1, 200) as i32),
                total_items: total_items.map(|value| value.max(0).to_string()),
                total_pages: total_items.map(|total| {
                    let size = page_size.clamp(1, 200);
                    ((total + size - 1) / size) as i32
                }),
                next_cursor: None,
                has_more: None,
            },
        },
        trace_id.clone(),
    );
    attach_trace_header((StatusCode::OK, Json(envelope)).into_response(), &trace_id)
}

pub fn success_command(
    context: Option<&WebRequestContext>,
    resource_id: Option<String>,
    status: Option<String>,
) -> Response {
    let trace_id = resolve_trace_id(context);
    let envelope = SdkWorkApiResponse::success(
        SdkWorkCommandData {
            accepted: true,
            resource_id,
            status,
        },
        trace_id.clone(),
    );
    attach_trace_header((StatusCode::OK, Json(envelope)).into_response(), &trace_id)
}

pub fn map_course_error(context: Option<&WebRequestContext>, error: CourseError) -> Response {
    let (status, result_code, detail) = match error.code() {
        "not_found" => (
            StatusCode::NOT_FOUND,
            SdkWorkResultCode::NotFound,
            error.message().to_string(),
        ),
        "storage" => (
            StatusCode::INTERNAL_SERVER_ERROR,
            SdkWorkResultCode::InternalError,
            error.message().to_string(),
        ),
        _ => (
            StatusCode::BAD_REQUEST,
            SdkWorkResultCode::ValidationError,
            error.message().to_string(),
        ),
    };
    problem_for_context(context, status, result_code, detail)
}

pub fn map_auth_error(context: Option<&WebRequestContext>, error: CourseAuthError) -> Response {
    problem_for_context(
        context,
        error.status,
        SdkWorkResultCode::AuthenticationRequired,
        error.message,
    )
}

pub fn map_route_error(
    context: Option<&WebRequestContext>,
    code: &'static str,
    message: String,
) -> Response {
    let (status, result_code) = match code {
        "not_found" => (StatusCode::NOT_FOUND, SdkWorkResultCode::NotFound),
        "internal" => (
            StatusCode::INTERNAL_SERVER_ERROR,
            SdkWorkResultCode::InternalError,
        ),
        _ => (StatusCode::BAD_REQUEST, SdkWorkResultCode::ValidationError),
    };
    problem_for_context(context, status, result_code, message)
}

fn attach_trace_header(response: Response, trace_id: &str) -> Response {
    let mut response = response;
    if let Ok(value) = HeaderValue::from_str(trace_id) {
        response
            .headers_mut()
            .insert(HeaderName::from_static("x-sdkwork-trace-id"), value);
    }
    response
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;
    use sdkwork_utils_rust::SdkWorkResultCode;

    use super::{map_route_error, success_item};

    #[tokio::test]
    async fn success_item_uses_sdkwork_api_response_envelope() {
        let response = success_item(None, serde_json::json!({ "id": "course-1" }));
        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_response().into_body(), usize::MAX)
            .await
            .expect("response body");
        let payload: serde_json::Value = serde_json::from_slice(&body).expect("json body");
        assert_eq!(payload["code"], 0);
        assert_eq!(payload["data"]["item"]["id"], "course-1");
        assert!(payload["traceId"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
    }

    #[tokio::test]
    async fn map_route_error_uses_problem_detail_envelope() {
        let response = map_route_error(None, "not_found", "Course not found".to_string());
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let body = to_bytes(response.into_response().into_body(), usize::MAX)
            .await
            .expect("response body");
        let payload: serde_json::Value = serde_json::from_slice(&body).expect("json body");
        assert_eq!(payload["status"], 404);
        assert_eq!(payload["code"], SdkWorkResultCode::NotFound.as_i32());
        assert_eq!(payload["detail"], "Course not found");
        assert!(payload["traceId"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
    }
}
