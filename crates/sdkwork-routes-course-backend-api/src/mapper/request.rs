use sdkwork_content_course_service::{CourseQuery, CourseServiceContext};
use serde_json::Value;

pub fn parse_course_query(params: &Value) -> CourseQuery {
    let read = |key: &str| {
        params
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    // Query extractors hand every value over as a string; accept both JSON
    // numbers and numeric strings so pagination is never silently dropped.
    let read_i64 = |key: &str| {
        params.get(key).and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
        })
    };
    CourseQuery {
        page: read_i64("page"),
        page_size: read_i64("page_size").or_else(|| read_i64("pageSize")),
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

#[cfg(test)]
mod tests {
    use super::parse_course_query;
    use serde_json::json;

    #[test]
    fn parses_pagination_from_query_string_values() {
        let query = parse_course_query(&json!({
            "page": "2",
            "page_size": "25",
            "q": "rust",
            "author_user_id": "user-1"
        }));
        assert_eq!(query.page, Some(2));
        assert_eq!(query.page_size, Some(25));
        assert_eq!(query.q.as_deref(), Some("rust"));
        assert_eq!(query.author_user_id.as_deref(), Some("user-1"));
    }
}
