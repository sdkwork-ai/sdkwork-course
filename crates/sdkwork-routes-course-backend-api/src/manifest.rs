use serde_json::Value;

pub const ROUTE_MANIFEST_PATH: &str =
    "sdks/_route-manifests/backend-api/sdkwork-routes-course-backend-api.route-manifest.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CourseRouteManifestMetadata {
    pub package_name: &'static str,
    pub surface: &'static str,
    pub owner: &'static str,
    pub domain: &'static str,
    pub capability: &'static str,
    pub api_authority: &'static str,
    pub sdk_family: &'static str,
    pub prefix: &'static str,
}

pub const COURSE_BACKEND_API_MANIFEST_METADATA: CourseRouteManifestMetadata =
    CourseRouteManifestMetadata {
        package_name: "sdkwork-routes-course-backend-api",
        surface: "backend-api",
        owner: "sdkwork-course",
        domain: "content",
        capability: "course",
        api_authority: "sdkwork-course-backend-api",
        sdk_family: "sdkwork-course-backend-sdk",
        prefix: "/backend/v3/api",
    };

pub fn route_manifest_path() -> &'static str {
    ROUTE_MANIFEST_PATH
}

pub fn build_route_manifest() -> Value {
    serde_json::json!({
        "kind": "sdkwork.route.manifest",
        "schemaVersion": 1,
        "package": COURSE_BACKEND_API_MANIFEST_METADATA.package_name,
        "surface": COURSE_BACKEND_API_MANIFEST_METADATA.surface,
        "owner": COURSE_BACKEND_API_MANIFEST_METADATA.owner,
        "domain": COURSE_BACKEND_API_MANIFEST_METADATA.domain,
        "capability": COURSE_BACKEND_API_MANIFEST_METADATA.capability,
        "apiAuthority": COURSE_BACKEND_API_MANIFEST_METADATA.api_authority,
        "sdkFamily": COURSE_BACKEND_API_MANIFEST_METADATA.sdk_family,
        "prefix": COURSE_BACKEND_API_MANIFEST_METADATA.prefix,
        "operations": [
            { "operationId": "course_categories_list", "method": "GET", "path": "/course_categories" },
            { "operationId": "course_categories_create", "method": "POST", "path": "/course_categories" },
            { "operationId": "course_categories_update", "method": "PATCH", "path": "/course_categories/{categoryId}" },
            { "operationId": "course_categories_delete", "method": "DELETE", "path": "/course_categories/{categoryId}" },
            { "operationId": "course_categories_reorder", "method": "PUT", "path": "/course_categories/reorder" },
            { "operationId": "course_instructors_list", "method": "GET", "path": "/course_instructors" },
            { "operationId": "course_instructors_create", "method": "POST", "path": "/course_instructors" },
            { "operationId": "course_instructors_retrieve", "method": "GET", "path": "/course_instructors/{instructorId}" },
            { "operationId": "course_instructors_update", "method": "PATCH", "path": "/course_instructors/{instructorId}" },
            { "operationId": "course_instructors_status_update", "method": "PATCH", "path": "/course_instructors/{instructorId}/status" },
            { "operationId": "courses_list", "method": "GET", "path": "/courses" },
            { "operationId": "courses_create", "method": "POST", "path": "/courses" },
            { "operationId": "courses_retrieve", "method": "GET", "path": "/courses/{courseId}" },
            { "operationId": "courses_update", "method": "PATCH", "path": "/courses/{courseId}" },
            { "operationId": "courses_delete", "method": "DELETE", "path": "/courses/{courseId}" },
            { "operationId": "courses_publish", "method": "POST", "path": "/courses/{courseId}/publish" },
            { "operationId": "courses_unpublish", "method": "POST", "path": "/courses/{courseId}/unpublish" },
            { "operationId": "course_offerings_list", "method": "GET", "path": "/courses/{courseId}/offerings" },
            { "operationId": "course_offerings_create", "method": "POST", "path": "/courses/{courseId}/offerings" },
            { "operationId": "course_offerings_retrieve", "method": "GET", "path": "/course_offerings/{offeringId}" },
            { "operationId": "course_offerings_update", "method": "PATCH", "path": "/course_offerings/{offeringId}" },
            { "operationId": "course_offerings_publish", "method": "POST", "path": "/course_offerings/{offeringId}/publish" },
            { "operationId": "course_offerings_close", "method": "POST", "path": "/course_offerings/{offeringId}/close" },
            { "operationId": "course_offerings_delete", "method": "DELETE", "path": "/course_offerings/{offeringId}" },
            { "operationId": "course_sections_list", "method": "GET", "path": "/courses/{courseId}/sections" },
            { "operationId": "course_sections_create", "method": "POST", "path": "/courses/{courseId}/sections" },
            { "operationId": "course_sections_update", "method": "PATCH", "path": "/course_sections/{sectionId}" },
            { "operationId": "course_sections_delete", "method": "DELETE", "path": "/course_sections/{sectionId}" },
            { "operationId": "course_sections_reorder", "method": "PUT", "path": "/courses/{courseId}/sections/reorder" },
            { "operationId": "course_lessons_list", "method": "GET", "path": "/courses/{courseId}/lessons" },
            { "operationId": "course_lessons_create", "method": "POST", "path": "/courses/{courseId}/lessons" },
            { "operationId": "course_lessons_retrieve", "method": "GET", "path": "/course_lessons/{lessonId}" },
            { "operationId": "course_lessons_update", "method": "PATCH", "path": "/course_lessons/{lessonId}" },
            { "operationId": "course_lessons_delete", "method": "DELETE", "path": "/course_lessons/{lessonId}" },
            { "operationId": "course_lessons_reorder", "method": "PUT", "path": "/courses/{courseId}/lessons/reorder" },
            { "operationId": "course_resources_list", "method": "GET", "path": "/course_lessons/{lessonId}/resources" },
            { "operationId": "course_resources_create", "method": "POST", "path": "/course_lessons/{lessonId}/resources" },
            { "operationId": "course_resources_update", "method": "PATCH", "path": "/course_resources/{resourceRefId}" },
            { "operationId": "course_resources_delete", "method": "DELETE", "path": "/course_resources/{resourceRefId}" },
            { "operationId": "course_live_sessions_list", "method": "GET", "path": "/course_live_sessions" },
            { "operationId": "course_live_sessions_create", "method": "POST", "path": "/course_live_sessions" },
            { "operationId": "course_live_sessions_retrieve", "method": "GET", "path": "/course_live_sessions/{liveSessionId}" },
            { "operationId": "course_live_sessions_update", "method": "PATCH", "path": "/course_live_sessions/{liveSessionId}" },
            { "operationId": "course_live_sessions_start", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/start" },
            { "operationId": "course_live_sessions_end", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/end" },
            { "operationId": "course_live_sessions_cancel", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/cancel" },
            { "operationId": "course_live_sessions_replay_attach", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/replay" },
            { "operationId": "course_live_sessions_replay_publish", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/replay/publish" },
            { "operationId": "course_enrollments_list", "method": "GET", "path": "/course_enrollments" },
            { "operationId": "course_enrollments_grant", "method": "POST", "path": "/course_enrollments/grants" },
            { "operationId": "course_enrollments_revoke", "method": "POST", "path": "/course_enrollments/{enrollmentId}/revoke" },
            { "operationId": "course_progress_list", "method": "GET", "path": "/course_progress" },
            { "operationId": "course_progress_retrieve", "method": "GET", "path": "/course_enrollments/{enrollmentId}/progress" },
            { "operationId": "course_lesson_progress_repair", "method": "PATCH", "path": "/course_lesson_progress/{lessonProgressId}" },
            { "operationId": "course_reactions_list", "method": "GET", "path": "/course_reactions" },
            { "operationId": "course_applications_list", "method": "GET", "path": "/course_applications" },
            { "operationId": "course_applications_retrieve", "method": "GET", "path": "/course_applications/{applicationId}" },
            { "operationId": "course_applications_review", "method": "PATCH", "path": "/course_applications/{applicationId}/review" },
            { "operationId": "course_applications_convert_to_course", "method": "POST", "path": "/course_applications/{applicationId}/convert" },
            { "operationId": "course_reports_overview_retrieve", "method": "GET", "path": "/course_reports/overview" },
            { "operationId": "course_reports_learning_list", "method": "GET", "path": "/course_reports/learning" },
            { "operationId": "course_reports_live_sessions_list", "method": "GET", "path": "/course_reports/live_sessions" },
            { "operationId": "course_audit_logs_list", "method": "GET", "path": "/course_audit_logs" },
            { "operationId": "course_audit_logs_retrieve", "method": "GET", "path": "/course_audit_logs/{auditLogId}" }
        ]
    })
}
