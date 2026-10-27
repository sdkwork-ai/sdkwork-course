use sdkwork_content_course_service::{CourseQuery, CourseServiceContext, QuestionQuery};
use serde_json::Value;

pub fn parse_question_query(params: &Value) -> QuestionQuery {
    let read = |key: &str| {
        params
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    let read_i64 = |key: &str| {
        params.get(key).and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
        })
    };
    let read_bool = |key: &str| {
        params.get(key).and_then(|v| {
            v.as_bool()
                .or_else(|| v.as_str().map(|s| matches!(s, "1" | "true" | "yes" | "on")))
        })
    };
    QuestionQuery {
        page: read_i64("page"),
        page_size: read_i64("page_size").or_else(|| read_i64("pageSize")),
        q: read("q"),
        grade_level: read("grade")
            .or_else(|| read("grade_level"))
            .or_else(|| read("gradeLevel")),
        subject: read("subject"),
        chapter: read("chapter"),
        knowledge_point: read("knowledge_point").or_else(|| read("knowledgePoint")),
        question_type: read("question_type").or_else(|| read("questionType")),
        difficulty: read("difficulty"),
        tag: read("tag"),
        source_type: read("source")
            .or_else(|| read("source_type"))
            .or_else(|| read("sourceType")),
        wrong_book: read_bool("wrong_book").or_else(|| read_bool("wrongBook")),
        status: read("status"),
        owner_user_id: read("owner_user_id").or_else(|| read("ownerUserId")),
    }
}

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

/// Page query for question-bank paper/handout listings. The contract exposes
/// `grade`/`subject`/`owner_user_id` wire params; they map onto the shared
/// `CourseQuery` fields (`level`/`category`/`author_user_id`) the repository
/// already consumes.
pub fn parse_question_bank_page_query(params: &Value) -> CourseQuery {
    let mut query = parse_course_query(params);
    let read = |key: &str| {
        params
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty())
    };
    if query.level.is_none() {
        query.level = read("grade").or_else(|| read("gradeLevel"));
    }
    if query.category.is_none() {
        query.category = read("subject");
    }
    if query.author_user_id.is_none() {
        query.author_user_id = read("owner_user_id").or_else(|| read("ownerUserId"));
    }
    query
}

#[cfg(test)]
mod tests {
    use super::{parse_course_query, parse_question_bank_page_query, parse_question_query};
    use serde_json::json;

    #[test]
    fn parses_question_bank_page_filters() {
        let query = parse_question_bank_page_query(&json!({
            "page": "1",
            "grade": "grade8",
            "subject": "english",
            "owner_user_id": "teacher-9",
            "status": "archived",
        }));
        assert_eq!(query.level.as_deref(), Some("grade8"));
        assert_eq!(query.category.as_deref(), Some("english"));
        assert_eq!(query.author_user_id.as_deref(), Some("teacher-9"));
        assert_eq!(query.status.as_deref(), Some("archived"));
    }

    #[test]
    fn parses_pagination_from_query_string_values() {
        let query = parse_course_query(&json!({
            "page": "2",
            "page_size": "25",
            "q": "rust",
            "category": "backend"
        }));
        assert_eq!(query.page, Some(2));
        assert_eq!(query.page_size, Some(25));
        assert_eq!(query.q.as_deref(), Some("rust"));
        assert_eq!(query.category.as_deref(), Some("backend"));
    }

    #[test]
    fn accepts_json_numbers_and_rejects_invalid_pages() {
        let query = parse_course_query(&json!({"page": 3, "page_size": "not-a-number"}));
        assert_eq!(query.page, Some(3));
        assert_eq!(query.page_size, None);

        let camel = parse_course_query(&json!({"page": "2", "pageSize": "10"}));
        assert_eq!(camel.page_size, Some(10));
    }

    #[test]
    fn parses_question_bank_filters() {
        let query = parse_question_query(&json!({
            "page": "1",
            "page_size": "20",
            "grade": "grade7",
            "subject": "math",
            "questionType": "single_choice",
            "difficulty": "easy",
            "wrongBook": "true",
        }));
        assert_eq!(query.grade_level.as_deref(), Some("grade7"));
        assert_eq!(query.subject.as_deref(), Some("math"));
        assert_eq!(query.question_type.as_deref(), Some("single_choice"));
        assert_eq!(query.difficulty.as_deref(), Some("easy"));
        assert_eq!(query.wrong_book, Some(true));
    }
}
