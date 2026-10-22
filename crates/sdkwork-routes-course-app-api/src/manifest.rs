use serde_json::Value;

pub const ROUTE_MANIFEST_PATH: &str =
    "sdks/_route-manifests/app-api/sdkwork-routes-course-app-api.route-manifest.json";

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

pub const COURSE_APP_API_MANIFEST_METADATA: CourseRouteManifestMetadata =
    CourseRouteManifestMetadata {
        package_name: "sdkwork-routes-course-app-api",
        surface: "app-api",
        owner: "sdkwork-course",
        domain: "content",
        capability: "course",
        api_authority: "sdkwork-course-app-api",
        sdk_family: "sdkwork-course-app-sdk",
        prefix: "/app/v3/api",
    };

pub fn route_manifest_path() -> &'static str {
    ROUTE_MANIFEST_PATH
}

pub fn build_route_manifest() -> Value {
    serde_json::json!({
        "kind": "sdkwork.route.manifest",
        "schemaVersion": 1,
        "package": COURSE_APP_API_MANIFEST_METADATA.package_name,
        "surface": COURSE_APP_API_MANIFEST_METADATA.surface,
        "owner": COURSE_APP_API_MANIFEST_METADATA.owner,
        "domain": COURSE_APP_API_MANIFEST_METADATA.domain,
        "capability": COURSE_APP_API_MANIFEST_METADATA.capability,
        "apiAuthority": COURSE_APP_API_MANIFEST_METADATA.api_authority,
        "sdkFamily": COURSE_APP_API_MANIFEST_METADATA.sdk_family,
        "prefix": COURSE_APP_API_MANIFEST_METADATA.prefix,
        "operations": [
            { "operationId": "course_categories_list", "method": "GET", "path": "/course_categories" },
            { "operationId": "course_categories_retrieve", "method": "GET", "path": "/course_categories/{categoryId}" },
            { "operationId": "courses_list", "method": "GET", "path": "/courses" },
            { "operationId": "courses_retrieve", "method": "GET", "path": "/courses/{courseId}" },
            { "operationId": "course_offerings_list", "method": "GET", "path": "/courses/{courseId}/offerings" },
            { "operationId": "course_offerings_retrieve", "method": "GET", "path": "/course_offerings/{offeringId}" },
            { "operationId": "course_enrollments_create", "method": "POST", "path": "/course_offerings/{offeringId}/enrollments" },
            { "operationId": "course_enrollments_current_list", "method": "GET", "path": "/course_enrollments" },
            { "operationId": "course_enrollments_retrieve", "method": "GET", "path": "/course_enrollments/{enrollmentId}" },
            { "operationId": "course_enrollments_cancel", "method": "DELETE", "path": "/course_enrollments/{enrollmentId}" },
            { "operationId": "course_sections_list", "method": "GET", "path": "/courses/{courseId}/sections" },
            { "operationId": "course_lessons_list", "method": "GET", "path": "/courses/{courseId}/lessons" },
            { "operationId": "course_lessons_retrieve", "method": "GET", "path": "/course_lessons/{lessonId}" },
            { "operationId": "course_lesson_resources_list", "method": "GET", "path": "/course_lessons/{lessonId}/resources" },
            { "operationId": "course_progress_retrieve", "method": "GET", "path": "/course_enrollments/{enrollmentId}/progress" },
            { "operationId": "course_lesson_progress_update", "method": "PATCH", "path": "/course_lessons/{lessonId}/progress" },
            { "operationId": "course_lesson_progress_watch_positions_update", "method": "PATCH", "path": "/course_lessons/{lessonId}/watch_position" },
            { "operationId": "course_live_sessions_list", "method": "GET", "path": "/course_live_sessions" },
            { "operationId": "course_live_sessions_retrieve", "method": "GET", "path": "/course_live_sessions/{liveSessionId}" },
            { "operationId": "course_live_sessions_join", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/join" },
            { "operationId": "course_live_sessions_heartbeat", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/heartbeat" },
            { "operationId": "course_live_sessions_leave", "method": "POST", "path": "/course_live_sessions/{liveSessionId}/leave" },
            { "operationId": "course_live_sessions_replay_retrieve", "method": "GET", "path": "/course_live_sessions/{liveSessionId}/replay" },
            { "operationId": "course_engagement_retrieve", "method": "GET", "path": "/courses/{courseId}/engagement" },
            { "operationId": "course_entitlements_grant", "method": "POST", "path": "/course_entitlements/grant" },
            { "operationId": "course_reactions_replace", "method": "PUT", "path": "/course_reactions" },
            { "operationId": "course_reactions_delete", "method": "DELETE", "path": "/course_reactions/{reactionId}" },
            { "operationId": "course_applications_create", "method": "POST", "path": "/course_applications" },
            { "operationId": "course_applications_current_list", "method": "GET", "path": "/course_applications" },
            { "operationId": "course_applications_retrieve", "method": "GET", "path": "/course_applications/{applicationId}" }
        ]
    })
}
