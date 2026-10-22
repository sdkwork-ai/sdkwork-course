use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseServiceContext {
    pub tenant_id: String,
    pub organization_id: String,
    pub actor_id: Option<String>,
    pub user_id: Option<String>,
    pub request_id: Option<String>,
    pub trace_id: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CourseOfferingType {
    #[default]
    Vod,
    Live,
    Blended,
    Cohort,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CourseLessonKind {
    #[default]
    VodVideo,
    LiveSession,
    Article,
    Download,
    Quiz,
    Assignment,
}

impl CourseLessonKind {
    /// Canonical snake_case wire value stored in `course_lesson.lesson_kind`.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::VodVideo => "vod_video",
            Self::LiveSession => "live_session",
            Self::Article => "article",
            Self::Download => "download",
            Self::Quiz => "quiz",
            Self::Assignment => "assignment",
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CourseProgressStatus {
    #[default]
    NotStarted,
    InProgress,
    Completed,
    Expired,
}

impl CourseProgressStatus {
    /// Canonical snake_case wire value stored in progress tables.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::NotStarted => "not_started",
            Self::InProgress => "in_progress",
            Self::Completed => "completed",
            Self::Expired => "expired",
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseMediaResourceRef {
    pub drive_resource_id: String,
    pub role: String,
    pub mime_type: Option<String>,
    pub duration_seconds: Option<i64>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseCatalogCommand {
    pub course_id: Option<String>,
    pub category_id: Option<String>,
    pub instructor_id: Option<String>,
    pub title: String,
    pub subtitle: Option<String>,
    pub description: Option<String>,
    pub cover: Option<CourseMediaResourceRef>,
    pub level: Option<String>,
    pub tags: Vec<String>,
    /// Content shape for operator-created catalog entries.
    pub kind: Option<String>,
    pub summary: Option<String>,
    pub price_amount: Option<String>,
    pub currency: Option<String>,
    pub is_free: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseStudioResourceDraft {
    pub drive_resource_id: String,
    pub resource_role: String,
    pub mime_type: Option<String>,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub duration_seconds: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseStudioLessonDraft {
    pub id: Option<String>,
    pub lesson_kind: CourseLessonKind,
    pub title: String,
    pub summary: Option<String>,
    /// Article body for `article` lessons.
    pub content: Option<String>,
    pub duration_seconds: i64,
    pub free_preview: bool,
    pub external_source_id: Option<String>,
    pub source_provider: Option<String>,
    pub sort_order: i64,
    pub resources: Vec<CourseStudioResourceDraft>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseStudioSectionDraft {
    pub id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub sort_order: i64,
    pub lessons: Vec<CourseStudioLessonDraft>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseStudioDraftCommand {
    pub course_id: Option<String>,
    pub title: String,
    pub subtitle: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
    /// `standard`, `column`, or `collection`.
    pub kind: String,
    pub cover: Option<CourseMediaResourceRef>,
    pub price_amount: Option<String>,
    pub original_price_amount: Option<String>,
    pub currency: Option<String>,
    pub is_free: bool,
    /// Display-only creator name captured from the session at creation time.
    pub author_display_name: Option<String>,
    pub sections: Vec<CourseStudioSectionDraft>,
    /// Ordered linked course ids for `collection` courses.
    pub collection_items: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseReviewDecisionCommand {
    /// `approve` / `reject` / `request_changes`.
    pub decision: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseOfflineCommand {
    pub note: Option<String>,
}

/// Canonical content shapes for the course center.
pub const COURSE_KIND_STANDARD: &str = "standard";
pub const COURSE_KIND_COLUMN: &str = "column";
pub const COURSE_KIND_COLLECTION: &str = "collection";

pub fn normalize_course_kind(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        COURSE_KIND_STANDARD => Some(COURSE_KIND_STANDARD),
        COURSE_KIND_COLUMN => Some(COURSE_KIND_COLUMN),
        COURSE_KIND_COLLECTION => Some(COURSE_KIND_COLLECTION),
        _ => None,
    }
}

pub fn is_supported_course_kind(value: &str) -> bool {
    normalize_course_kind(value).is_some()
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseOfferingCommand {
    pub offering_id: Option<String>,
    pub course_id: String,
    pub offering_type: CourseOfferingType,
    pub title: String,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub enrollment_starts_at: Option<String>,
    pub enrollment_ends_at: Option<String>,
    pub capacity_limit: Option<i64>,
    pub completion_rule: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseLessonCommand {
    pub lesson_id: Option<String>,
    pub course_id: String,
    pub section_id: Option<String>,
    pub lesson_kind: CourseLessonKind,
    pub title: String,
    pub summary: Option<String>,
    pub duration_seconds: Option<i64>,
    pub free_preview: bool,
    pub resources: Vec<CourseMediaResourceRef>,
    /// External source id (e.g. bilibili BV id) for connected lessons.
    pub external_source_id: Option<String>,
    /// External source provider (`bilibili`, `manual`, ...).
    pub source_provider: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseLiveSessionCommand {
    pub live_session_id: Option<String>,
    pub course_id: String,
    pub offering_id: String,
    pub lesson_id: Option<String>,
    pub title: String,
    pub starts_at: String,
    pub ends_at: String,
    pub instructor_id: Option<String>,
    pub provider_code: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseEnrollmentCommand {
    pub offering_id: String,
    pub learner_user_id: String,
    pub source: String,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseLessonProgressCommand {
    pub enrollment_id: String,
    pub lesson_id: String,
    pub progress_status: CourseProgressStatus,
    pub watched_seconds: Option<i64>,
    pub watch_position_seconds: Option<i64>,
    pub completed_at: Option<String>,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseLiveJoinGrant {
    pub live_session_id: String,
    pub provider_code: String,
    pub join_url: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseAuditCommand {
    pub target_type: String,
    pub target_id: String,
    pub operation: String,
    pub before_snapshot: Option<serde_json::Value>,
    pub after_snapshot: Option<serde_json::Value>,
}
