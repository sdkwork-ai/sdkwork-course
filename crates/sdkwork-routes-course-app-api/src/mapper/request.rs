use sdkwork_content_course_service::{CourseQuery, CourseServiceContext};
use serde_json::Value;

pub fn parse_course_query(params: &Value) -> CourseQuery {
    let read = |key: &str| {
        params
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    CourseQuery {
        page: params.get("page").and_then(|v| v.as_i64()),
        page_size: params.get("page_size").and_then(|v| v.as_i64()),
        q: read("q"),
        category: read("category"),
        level: read("level"),
        status: read("status"),
        kind: read("kind"),
        author_user_id: read("author_user_id").or_else(|| read("authorUserId")),
        applicant_user_id: read("applicant_user_id").or_else(|| read("applicantUserId")),
        target_type: read("target_type").or_else(|| read("targetType")),
        target_id: read("target_id").or_else(|| read("targetId")),
    }
}

pub fn parse_service_context(
    tenant_id: &str,
    organization_id: &str,
    user_id: Option<&str>,
    actor_id: Option<&str>,
) -> CourseServiceContext {
    CourseServiceContext {
        tenant_id: tenant_id.to_string(),
        organization_id: organization_id.to_string(),
        user_id: user_id.map(|s| s.to_string()),
        actor_id: actor_id.map(|s| s.to_string()),
        request_id: None,
        trace_id: None,
        permissions: vec![],
    }
}
