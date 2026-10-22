use std::error::Error;
use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

pub type CourseResult<T> = Result<T, CourseError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CourseError {
    code: &'static str,
    message: String,
}

impl CourseError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "invalid",
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            code: "not_found",
            message: message.into(),
        }
    }

    pub fn storage(message: impl Into<String>) -> Self {
        Self {
            code: "storage",
            message: message.into(),
        }
    }

    pub fn code(&self) -> &'static str {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl Display for CourseError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl Error for CourseError {}

impl From<serde_json::Error> for CourseError {
    fn from(error: serde_json::Error) -> Self {
        Self::storage(error.to_string())
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub q: Option<String>,
    pub category: Option<String>,
    pub level: Option<String>,
    pub status: Option<String>,
    /// Content shape filter (`standard` / `column` / `collection`).
    pub kind: Option<String>,
    /// Restricts a query to one author. App surfaces force this to the
    /// authenticated user; backend queries may pass it explicitly.
    pub author_user_id: Option<String>,
    /// Application list ownership filter.
    pub applicant_user_id: Option<String>,
    /// Audit log filters.
    pub target_type: Option<String>,
    pub target_id: Option<String>,
}

impl CourseQuery {
    pub fn limit(&self) -> i64 {
        self.page_size.unwrap_or(20).clamp(1, 200)
    }

    pub fn offset(&self) -> i64 {
        (self.page.unwrap_or(1).max(1) - 1) * self.limit()
    }

    /// True when the caller asked for drafts in a learner-facing catalog.
    pub fn requested_status(&self) -> Option<&str> {
        self.status.as_deref().filter(|value| !value.is_empty())
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseApplicationCreateRequest {
    pub title: String,
    pub category: String,
    pub description: String,
    pub source_provider: String,
    pub external_bvid: Option<String>,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseApplicationReviewRequest {
    pub status: String,
    pub review_note: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseMutationRequest {
    pub course_code: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub level: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub status: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseSectionMutationRequest {
    pub section_no: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub duration_seconds: Option<i64>,
    pub sort_weight: Option<i64>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CourseLessonMutationRequest {
    pub section_id: Option<String>,
    pub lesson_no: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub external_bvid: Option<String>,
    pub duration_seconds: Option<i64>,
    pub free_preview: Option<bool>,
    pub status: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseCategoryItem {
    pub id: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub icon_key: Option<String>,
    pub sort_weight: i64,
    pub course_count: i64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseItem {
    pub id: String,
    pub course_code: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub instructor: Option<String>,
    pub duration_text: Option<String>,
    pub lessons_count: i64,
    pub rating_score: String,
    pub students_count: i64,
    pub level: Option<String>,
    pub category: Option<String>,
    pub category_id: Option<String>,
    pub tags: String,
    pub content: Option<String>,
    /// Row lifecycle (`active` / `archived` / `deleted`).
    pub status: String,
    /// Publication state: `draft` / `reviewing` / `published` /
    /// `unpublished` / `archived`.
    pub publish_status: String,
    pub published_at: Option<String>,
    /// Content shape: `standard` / `column` / `collection`.
    pub kind: String,
    pub is_free: bool,
    pub is_collection: bool,
    pub price_amount: Option<String>,
    pub original_price_amount: Option<String>,
    pub currency: Option<String>,
    pub author_user_id: Option<String>,
    pub author_display_name: Option<String>,
    pub review_note: Option<String>,
    pub submitted_at: Option<String>,
    pub reviewed_at: Option<String>,
    pub reviewed_by: Option<String>,
    pub review_round: i64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseResourceItem {
    pub id: String,
    pub owner_type: String,
    pub owner_id: String,
    pub resource_role: String,
    pub drive_resource_id: String,
    pub media_resource_snapshot: Option<String>,
    pub mime_type: Option<String>,
    pub duration_seconds: Option<i64>,
    pub file_size_bytes: Option<i64>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseCollectionItem {
    pub course_id: String,
    pub title: String,
    pub cover: Option<String>,
    pub kind: String,
    pub lessons_count: i64,
    pub duration_seconds: i64,
    pub sort_order: i64,
    pub author_display_name: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CourseCurriculum {
    pub course_id: String,
    pub sections: Vec<CourseSectionItem>,
    pub lessons: Vec<CourseLessonItem>,
    pub resources: Vec<CourseResourceItem>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CourseStudioDetail {
    pub course: CourseItem,
    pub sections: Vec<CourseSectionItem>,
    pub lessons: Vec<CourseLessonItem>,
    pub resources: Vec<CourseResourceItem>,
    pub collection_items: Vec<CourseCollectionItem>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoursePage {
    pub items: Vec<CourseItem>,
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseSectionItem {
    pub id: String,
    pub course_id: String,
    pub section_no: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub lesson_count: i64,
    pub duration_seconds: i64,
    pub sort_weight: i64,
    pub status: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseLessonItem {
    pub id: String,
    pub course_id: String,
    pub section_id: Option<String>,
    pub lesson_no: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub duration_seconds: i64,
    pub duration_text: Option<String>,
    pub content: Option<String>,
    pub free_preview: bool,
    pub sort_weight: i64,
    pub status: String,
    /// Normalized lesson kind (`vod_video` / `live_session` / `article` /
    /// `download` / `quiz` / `assignment`), trimmed of legacy quote-wrapped
    /// JSON string storage.
    pub kind: Option<String>,
    /// External source id (e.g. bilibili BV id) for connected lessons.
    pub external_source_id: Option<String>,
    /// External source provider (`bilibili`, `manual`, ...).
    pub source_provider: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseApplicationItem {
    pub id: String,
    pub title: String,
    pub category: String,
    pub status: String,
    pub applicant_user_id: Option<String>,
    pub contact_name: Option<String>,
    pub submitted_at: String,
    pub reviewed_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseAuditLogItem {
    pub id: String,
    pub uuid: String,
    pub tenant_id: String,
    pub organization_id: Option<String>,
    pub actor_type: String,
    pub actor_id: Option<String>,
    pub operation_id: String,
    pub audit_event_type: String,
    pub target_type: String,
    pub target_id: String,
    pub request_id: Option<String>,
    pub idempotency_key: Option<String>,
    pub before_snapshot_json: Option<String>,
    pub after_snapshot_json: Option<String>,
    pub metadata_json: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseEngagementItem {
    pub id: String,
    pub course_id: String,
    pub title: Option<String>,
    pub views: i64,
    pub likes: i64,
    pub saves: i64,
    pub shares: i64,
    pub discussions: i64,
    pub students_count: i64,
}
