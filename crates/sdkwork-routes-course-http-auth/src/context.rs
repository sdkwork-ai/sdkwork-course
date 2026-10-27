use axum::http::StatusCode;
use sdkwork_content_course_service::CourseServiceContext;
use sdkwork_web_core::WebRequestContext;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseAuthError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl CourseAuthError {
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: "unauthenticated",
            message: message.into(),
        }
    }
}

fn course_runtime_environment_allows_dev_fallback() -> bool {
    matches!(
        std::env::var("SDKWORK_COURSE_ENVIRONMENT")
            .or_else(|_| std::env::var("SDKWORK_IM_ENVIRONMENT"))
            .or_else(|_| std::env::var("SDKWORK_ENVIRONMENT"))
            .unwrap_or_else(|_| "development".to_owned())
            .to_ascii_lowercase()
            .as_str(),
        "development" | "dev" | "test" | "local"
    )
}

pub fn course_service_context_from_web(
    app_ctx: &WebRequestContext,
) -> Result<CourseServiceContext, CourseAuthError> {
    if let Some(principal) = app_ctx.principal.as_ref() {
        return Ok(CourseServiceContext {
            tenant_id: principal.tenant_id().to_owned(),
            organization_id: principal.organization_id().unwrap_or("0").to_owned(),
            user_id: Some(principal.user_id().to_owned()),
            actor_id: Some(principal.user_id().to_owned()),
            request_id: Some(app_ctx.request_id.0.clone()),
            trace_id: app_ctx.trace_id.clone(),
            permissions: principal
                .scopes
                .permission_scope
                .iter()
                .filter(|scope| scope.starts_with("course.") || scope.as_str() == "course.*")
                .cloned()
                .collect(),
        });
    }

    if course_runtime_environment_allows_dev_fallback() {
        let tenant_id = std::env::var("SDKWORK_COURSE_TENANT_ID")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "100001".to_owned());
        let organization_id = std::env::var("SDKWORK_COURSE_ORGANIZATION_ID")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "0".to_owned());
        let user_id = std::env::var("SDKWORK_COURSE_ACTOR_ID")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                std::env::var("SDKWORK_COURSE_OPERATOR_ID")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
            });

        return Ok(CourseServiceContext {
            tenant_id,
            organization_id,
            user_id: user_id.clone(),
            actor_id: user_id,
            request_id: Some(app_ctx.request_id.0.clone()),
            trace_id: app_ctx.trace_id.clone(),
            // Development/test fallback simulates a fully scoped course
            // operator so local flows (enrollment, progress, live join) work
            // without provisioning IAM roles. Production always requires a
            // resolved principal with real permissions.
            permissions: vec!["course.*".to_owned()],
        });
    }

    Err(CourseAuthError::unauthorized(
        "authenticated request context is required",
    ))
}
