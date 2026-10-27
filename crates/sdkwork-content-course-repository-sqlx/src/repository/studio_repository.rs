//! Studio authoring and review persistence.
//!
//! The author studio edits a course as one document: metadata plus the ordered
//! chapter/lesson tree and, for collection courses, the ordered course bundle.
//! A draft save replaces the draft's content atomically, which keeps the editor
//! simple and avoids partial trees after a failed request. Ownership and the
//! draft-only guard live in SQL, so a caller cannot edit another author's draft
//! by guessing its id.

use serde_json::Value;
use sqlx::{Postgres, Row, Transaction};

use sdkwork_content_course_service::{
    CourseCollectionItem, CourseCurriculum, CourseError, CourseItem, CoursePage, CourseQuery,
    CourseResourceItem, CourseResult, CourseReviewDecisionCommand, CourseSectionItem,
    CourseServiceContext, CourseStudioDetail, CourseStudioDraftCommand, CourseStudioLessonDraft,
};

use super::course_repository::PostgresCourseRepository;

const COURSE_ITEM_COLUMNS: &str = r#"
    id, course_code, title, subtitle, summary, description,
    cover_resource_snapshot as thumbnail,
    primary_instructor_id as instructor,
    estimated_duration_seconds::text as duration_text,
    lesson_count_snapshot::bigint as lessons_count,
    rating_score_snapshot as rating_score,
    student_count_snapshot::bigint as students_count,
    difficulty_level as level,
    category_id as category_id, category_id as category, tags_json as tags, body_content as content,
    status, publish_status, published_at,
    course_kind as kind,
    (is_free <> 0) as is_free,
    (is_collection <> 0) as is_collection,
    price_amount, original_price_amount, currency,
    author_user_id, author_display_name,
    review_note, submitted_at, reviewed_at, reviewed_by, review_round::bigint as review_round
"#;

const LESSON_SELECT: &str = r#"
    SELECT id, course_id, section_id, lesson_no, title, description,
           content, duration_seconds::bigint as duration_seconds,
           duration_seconds::text as duration_text,
           free_preview::boolean as free_preview,
           sort_order::bigint as sort_weight, status,
           TRIM(BOTH '"' FROM lesson_kind) as kind,
           external_source_id, source_provider
    FROM course_lesson
    WHERE course_id = $1
      AND tenant_id = $2
      AND status != 'deleted'
      AND deleted_at IS NULL
    ORDER BY sort_order ASC, id ASC
"#;

const SECTION_SELECT: &str = r#"
    SELECT id, course_id, section_no, title, description,
           lesson_count_snapshot::bigint as lesson_count,
           duration_seconds_snapshot::bigint as duration_seconds,
           sort_order::bigint as sort_weight, status
    FROM course_section
    WHERE course_id = $1
      AND tenant_id = $2
      AND deleted_at IS NULL
    ORDER BY sort_order ASC, id ASC
"#;

const RESOURCE_SELECT: &str = r#"
    SELECT id, owner_type, owner_id, resource_role, drive_resource_id,
           media_resource_snapshot, mime_type, duration_seconds, file_size_bytes,
           sort_order::bigint as sort_order
    FROM course_resource_ref
    WHERE tenant_id = $1
      AND owner_type = 'lesson'
      AND status != 'deleted'
      AND deleted_at IS NULL
      AND owner_id IN (
        SELECT id FROM course_lesson
        WHERE course_id = $2 AND tenant_id = $1 AND deleted_at IS NULL
      )
    ORDER BY sort_order ASC, id ASC
"#;

const COLLECTION_ITEM_SELECT: &str = r#"
    SELECT link.linked_course_id as course_id,
           course.title,
           course.cover_resource_snapshot as cover,
           course.course_kind as kind,
           course.lesson_count_snapshot::bigint as lessons_count,
           course.estimated_duration_seconds::bigint as duration_seconds,
           link.sort_order::bigint as sort_order,
           course.author_display_name
    FROM course_catalog_link link
    JOIN course_catalog course ON course.id = link.linked_course_id
    WHERE link.course_id = $1
      AND link.tenant_id = $2
      AND link.link_type = 'collection_item'
      AND link.status = 'active'
      AND course.deleted_at IS NULL
      AND course.publish_status = 'published'
    ORDER BY link.sort_order ASC, link.id ASC
"#;

fn storage_error(error: sqlx::Error) -> CourseError {
    CourseError::storage(error.to_string())
}

impl PostgresCourseRepository {
    pub async fn fetch_course_item(
        &self,
        tenant_id: &str,
        course_id: &str,
    ) -> CourseResult<CourseItem> {
        let sql = format!(
            "SELECT {COURSE_ITEM_COLUMNS} FROM course_catalog WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
        );
        sqlx::query_as::<_, CourseItem>(sqlx::AssertSqlSafe(sql))
            .bind(course_id)
            .bind(tenant_id)
            .fetch_optional(self.pool())
            .await
            .map_err(storage_error)?
            .ok_or_else(|| CourseError::not_found("Course not found"))
    }

    pub async fn retrieve_course_detail_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
    ) -> CourseResult<Option<CourseStudioDetail>> {
        let sql = format!(
            "SELECT {COURSE_ITEM_COLUMNS} FROM course_catalog WHERE id = $1 AND tenant_id = $2 AND (organization_id = $3 OR organization_id = '0') AND deleted_at IS NULL"
        );
        let course = sqlx::query_as::<_, CourseItem>(sqlx::AssertSqlSafe(sql))
            .bind(course_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .fetch_optional(self.pool())
            .await
            .map_err(storage_error)?;
        let Some(course) = course else {
            return Ok(None);
        };

        let sections = self
            .list_sections_for(course_id, &context.tenant_id)
            .await?;
        let lessons = self.list_lessons_for(course_id, &context.tenant_id).await?;
        let resources = self
            .list_resources_for(course_id, &context.tenant_id)
            .await?;
        let collection_items = self
            .collection_items_for(course_id, &context.tenant_id)
            .await?;

        Ok(Some(CourseStudioDetail {
            course,
            sections,
            lessons,
            resources,
            collection_items,
        }))
    }

    pub async fn retrieve_curriculum_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
    ) -> CourseResult<Option<CourseCurriculum>> {
        let Some(_course) = self.retrieve_course_detail_impl(context, course_id).await? else {
            return Ok(None);
        };
        Ok(Some(CourseCurriculum {
            course_id: course_id.to_string(),
            sections: self
                .list_sections_for(course_id, &context.tenant_id)
                .await?,
            lessons: self.list_lessons_for(course_id, &context.tenant_id).await?,
            resources: self
                .list_resources_for(course_id, &context.tenant_id)
                .await?,
        }))
    }

    pub async fn list_collection_items_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
    ) -> CourseResult<Vec<CourseCollectionItem>> {
        self.collection_items_for(course_id, &context.tenant_id)
            .await
    }

    async fn list_sections_for(
        &self,
        course_id: &str,
        tenant_id: &str,
    ) -> CourseResult<Vec<CourseSectionItem>> {
        sqlx::query_as::<_, CourseSectionItem>(SECTION_SELECT)
            .bind(course_id)
            .bind(tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(storage_error)
    }

    async fn list_lessons_for(
        &self,
        course_id: &str,
        tenant_id: &str,
    ) -> CourseResult<Vec<sdkwork_content_course_service::CourseLessonItem>> {
        sqlx::query_as::<_, sdkwork_content_course_service::CourseLessonItem>(LESSON_SELECT)
            .bind(course_id)
            .bind(tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(storage_error)
    }

    async fn list_resources_for(
        &self,
        course_id: &str,
        tenant_id: &str,
    ) -> CourseResult<Vec<CourseResourceItem>> {
        sqlx::query_as::<_, CourseResourceItem>(RESOURCE_SELECT)
            .bind(tenant_id)
            .bind(course_id)
            .fetch_all(self.pool())
            .await
            .map_err(storage_error)
    }

    async fn collection_items_for(
        &self,
        course_id: &str,
        tenant_id: &str,
    ) -> CourseResult<Vec<CourseCollectionItem>> {
        sqlx::query_as::<_, CourseCollectionItem>(COLLECTION_ITEM_SELECT)
            .bind(course_id)
            .bind(tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(storage_error)
    }

    pub async fn save_studio_course_impl(
        &self,
        context: &CourseServiceContext,
        command: CourseStudioDraftCommand,
    ) -> CourseResult<CourseItem> {
        let author_user_id = context
            .user_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| CourseError::invalid("An authenticated creator is required"))?;
        let now = chrono::Utc::now().to_rfc3339();
        let kind = sdkwork_content_course_service::normalize_course_kind(&command.kind)
            .ok_or_else(|| CourseError::invalid("Unsupported course kind"))?;

        let mut tx = self.pool().begin().await.map_err(storage_error)?;

        if let Some(category_id) = command.category_id.as_deref() {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM course_category WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)",
            )
            .bind(category_id)
            .bind(&context.tenant_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(storage_error)?;
            if !exists {
                return Err(CourseError::invalid("Category not found"));
            }
        }

        let existing = if let Some(course_id) = command.course_id.as_deref() {
            let row = sqlx::query(
                "SELECT author_user_id, publish_status FROM course_catalog WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
            )
            .bind(course_id)
            .bind(&context.tenant_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(storage_error)?;
            let Some(row) = row else {
                return Err(CourseError::not_found("Course not found"));
            };
            let author: Option<String> = row.try_get("author_user_id").map_err(storage_error)?;
            let publish_status: String = row.try_get("publish_status").map_err(storage_error)?;
            if author.as_deref() != Some(author_user_id) {
                // Do not disclose the existence of another author's draft.
                return Err(CourseError::not_found("Course not found"));
            }
            if publish_status != "draft" && publish_status != "unpublished" {
                return Err(CourseError::invalid(
                    "Only draft or unpublished courses can be edited; withdraw the review first",
                ));
            }
            Some((course_id.to_string(), publish_status))
        } else {
            None
        };

        let (course_id, is_insert) = match &existing {
            Some((course_id, _)) => (course_id.clone(), false),
            None => (uuid::Uuid::new_v4().to_string(), true),
        };

        let cover_json = command
            .cover
            .as_ref()
            .map(|cover| serde_json::to_string(cover).unwrap_or_default());
        let tags_json = serde_json::to_string(&command.tags).unwrap_or_else(|_| "[]".to_string());
        let author_display_name = command
            .author_display_name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.chars().take(120).collect::<String>());
        let is_free = if command.is_free { 1_i64 } else { 0_i64 };
        let is_collection = if kind == "collection" { 1_i64 } else { 0_i64 };

        if is_insert {
            let uuid = uuid::Uuid::new_v4().to_string();
            let course_code = format!("CRS-{}", &course_id[..8]);
            sqlx::query(
                r#"
                INSERT INTO course_catalog (
                    id, uuid, tenant_id, organization_id, course_code, category_id,
                    primary_instructor_id, title, subtitle, summary, description,
                    difficulty_level, tags_json, cover_resource_snapshot,
                    price_amount, original_price_amount, currency, is_free,
                    is_collection, course_kind, author_user_id, author_display_name,
                    visibility, publish_status, status, review_round,
                    created_at, created_by, updated_at, updated_by, version
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21,
                    'tenant', 'draft', 'active', 0,
                    $22, $23, $24, $25, 0
                )
                "#,
            )
            .bind(&course_id)
            .bind(&uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&course_code)
            .bind(&command.category_id)
            .bind(command.title.trim())
            .bind(&command.subtitle)
            .bind(&command.summary)
            .bind(&command.description)
            .bind(&command.level)
            .bind(&tags_json)
            .bind(&cover_json)
            .bind(&command.price_amount)
            .bind(&command.original_price_amount)
            .bind(&command.currency)
            .bind(is_free)
            .bind(is_collection)
            .bind(kind)
            .bind(author_user_id)
            .bind(&author_display_name)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        } else {
            sqlx::query(
                r#"
                UPDATE course_catalog
                SET category_id = $1, title = $2, subtitle = $3, summary = $4,
                    description = $5, difficulty_level = $6, tags_json = $7,
                    cover_resource_snapshot = COALESCE($8, cover_resource_snapshot), price_amount = $9,
                    original_price_amount = $10, currency = $11, is_free = $12,
                    is_collection = $13, course_kind = $14,
                    author_display_name = COALESCE($15, author_display_name),
                    updated_at = $16, updated_by = $17, version = version + 1
                WHERE id = $18 AND tenant_id = $19 AND author_user_id = $20
                  AND publish_status IN ('draft', 'unpublished') AND deleted_at IS NULL
                "#,
            )
            .bind(&command.category_id)
            .bind(command.title.trim())
            .bind(&command.subtitle)
            .bind(&command.summary)
            .bind(&command.description)
            .bind(&command.level)
            .bind(&tags_json)
            .bind(&cover_json)
            .bind(&command.price_amount)
            .bind(&command.original_price_amount)
            .bind(&command.currency)
            .bind(is_free)
            .bind(is_collection)
            .bind(kind)
            .bind(&author_display_name)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&course_id)
            .bind(&context.tenant_id)
            .bind(author_user_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        }

        // The draft is replaced as a whole so removed chapters, lessons and
        // resources cannot survive a save.
        sqlx::query(
            r#"
            DELETE FROM course_resource_ref
            WHERE tenant_id = $1 AND owner_type = 'lesson'
              AND owner_id IN (SELECT id FROM course_lesson WHERE course_id = $2 AND tenant_id = $1)
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&course_id)
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;
        sqlx::query("DELETE FROM course_lesson WHERE course_id = $1 AND tenant_id = $2")
            .bind(&course_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        sqlx::query("DELETE FROM course_section WHERE course_id = $1 AND tenant_id = $2")
            .bind(&course_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        sqlx::query(
            "DELETE FROM course_catalog_link WHERE course_id = $1 AND tenant_id = $2 AND link_type = 'collection_item'",
        )
        .bind(&course_id)
        .bind(&context.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;

        let mut lesson_total = 0_i64;
        let mut duration_total = 0_i64;
        for (section_index, section) in command.sections.iter().enumerate() {
            let section_id = uuid::Uuid::new_v4().to_string();
            let section_uuid = uuid::Uuid::new_v4().to_string();
            let section_no = format!("S{:04}", section_index + 1);
            let section_duration: i64 = section
                .lessons
                .iter()
                .map(|lesson| lesson.duration_seconds)
                .sum();
            sqlx::query(
                r#"
                INSERT INTO course_section (
                    id, uuid, tenant_id, organization_id, course_id, section_no,
                    title, description, sort_order, lesson_count_snapshot,
                    duration_seconds_snapshot, visibility, status,
                    created_at, created_by, updated_at, updated_by, version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'tenant', 'active', $12, $13, $14, $15, 0)
                "#,
            )
            .bind(&section_id)
            .bind(&section_uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&course_id)
            .bind(&section_no)
            .bind(section.title.trim())
            .bind(&section.description)
            .bind(section_index as i64)
            .bind(section.lessons.len() as i64)
            .bind(section_duration)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;

            for (lesson_index, lesson) in section.lessons.iter().enumerate() {
                lesson_total += 1;
                duration_total += lesson.duration_seconds.max(0);
                self.insert_studio_lesson(
                    &mut tx,
                    context,
                    &course_id,
                    &section_id,
                    lesson,
                    lesson_total,
                    lesson_index as i64,
                    &now,
                )
                .await?;
            }
        }

        for (index, linked_course_id) in command.collection_items.iter().enumerate() {
            let exists: bool = sqlx::query_scalar(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM course_catalog
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                      AND publish_status = 'published'
                )
                "#,
            )
            .bind(linked_course_id)
            .bind(&context.tenant_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(storage_error)?;
            if !exists {
                return Err(CourseError::invalid(format!(
                    "Collection item {} is not a published course",
                    linked_course_id
                )));
            }
            let link_id = uuid::Uuid::new_v4().to_string();
            let link_uuid = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO course_catalog_link (
                    id, uuid, tenant_id, organization_id, course_id, linked_course_id,
                    link_type, sort_order, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'collection_item', $7, 'active', $8, $9)
                "#,
            )
            .bind(&link_id)
            .bind(&link_uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&course_id)
            .bind(linked_course_id)
            .bind(index as i64)
            .bind(&now)
            .bind(&now)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        }

        sqlx::query(
            r#"
            UPDATE course_catalog
            SET lesson_count_snapshot = $1, estimated_duration_seconds = $2,
                is_collection = $3, updated_at = $4, updated_by = $5,
                version = version + 1
            WHERE id = $6 AND tenant_id = $7
            "#,
        )
        .bind(lesson_total)
        .bind(duration_total)
        .bind(is_collection)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&course_id)
        .bind(&context.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;

        tx.commit().await.map_err(storage_error)?;
        self.fetch_course_item(&context.tenant_id, &course_id).await
    }

    #[allow(clippy::too_many_arguments)]
    async fn insert_studio_lesson(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        context: &CourseServiceContext,
        course_id: &str,
        section_id: &str,
        lesson: &CourseStudioLessonDraft,
        sort_order: i64,
        _section_lesson_index: i64,
        now: &str,
    ) -> CourseResult<()> {
        let lesson_id = uuid::Uuid::new_v4().to_string();
        let lesson_uuid = uuid::Uuid::new_v4().to_string();
        let lesson_no = format!("L{:04}", sort_order);
        sqlx::query(
            r#"
            INSERT INTO course_lesson (
                id, uuid, tenant_id, organization_id, course_id, section_id,
                lesson_no, lesson_kind, title, description, content,
                duration_seconds, free_preview, external_source_id, source_provider,
                required_for_completion, sort_order, status,
                created_at, created_by, updated_at, updated_by, version
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, 1, $16, 'active',
                $17, $18, $19, $20, 0
            )
            "#,
        )
        .bind(&lesson_id)
        .bind(&lesson_uuid)
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(course_id)
        .bind(section_id)
        .bind(&lesson_no)
        .bind(lesson.lesson_kind.as_str())
        .bind(lesson.title.trim())
        .bind(&lesson.summary)
        .bind(&lesson.content)
        .bind(lesson.duration_seconds.max(0))
        .bind(if lesson.free_preview { 1_i64 } else { 0_i64 })
        .bind(&lesson.external_source_id)
        .bind(&lesson.source_provider)
        .bind(sort_order)
        .bind(now)
        .bind(&context.actor_id)
        .bind(now)
        .bind(&context.actor_id)
        .execute(&mut **tx)
        .await
        .map_err(storage_error)?;

        for (index, resource) in lesson.resources.iter().enumerate() {
            let resource_id = uuid::Uuid::new_v4().to_string();
            let resource_uuid = uuid::Uuid::new_v4().to_string();
            let snapshot = serde_json::json!({
                "provider": "drive",
                "driveResourceId": resource.drive_resource_id,
                "fileName": resource.file_name,
                "mimeType": resource.mime_type,
                "fileSizeBytes": resource.file_size_bytes,
            });
            sqlx::query(
                r#"
                INSERT INTO course_resource_ref (
                    id, uuid, tenant_id, organization_id, owner_type, owner_id,
                    resource_role, drive_resource_id, media_resource_snapshot,
                    mime_type, duration_seconds, file_size_bytes, sort_order,
                    visibility, status, created_at, created_by, updated_at, updated_by, version
                ) VALUES (
                    $1, $2, $3, $4, 'lesson', $5, $6, $7, $8,
                    $9, $10, $11, $12, 'tenant', 'active', $13, $14, $15, $16, 0
                )
                "#,
            )
            .bind(&resource_id)
            .bind(&resource_uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&lesson_id)
            .bind(&resource.resource_role)
            .bind(&resource.drive_resource_id)
            .bind(snapshot.to_string())
            .bind(&resource.mime_type)
            .bind(resource.duration_seconds)
            .bind(resource.file_size_bytes)
            .bind(index as i64)
            .bind(now)
            .bind(&context.actor_id)
            .bind(now)
            .bind(&context.actor_id)
            .execute(&mut **tx)
            .await
            .map_err(storage_error)?;
        }
        Ok(())
    }

    pub async fn submit_course_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
    ) -> CourseResult<CourseItem> {
        let now = chrono::Utc::now().to_rfc3339();
        let user_id = context
            .user_id
            .as_deref()
            .ok_or_else(|| CourseError::invalid("An authenticated creator is required"))?;
        let result = sqlx::query(
            r#"
            UPDATE course_catalog
            SET publish_status = 'reviewing', submitted_at = $1, review_note = NULL,
                reviewed_at = NULL, reviewed_by = NULL,
                review_round = review_round + 1,
                updated_at = $2, updated_by = $3, version = version + 1
            WHERE id = $4 AND tenant_id = $5 AND author_user_id = $6
              AND publish_status IN ('draft', 'unpublished') AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(course_id)
        .bind(&context.tenant_id)
        .bind(user_id)
        .execute(self.pool())
        .await
        .map_err(storage_error)?;
        if result.rows_affected() == 0 {
            return Err(CourseError::invalid(
                "Course is not an editable draft owned by this creator",
            ));
        }
        self.fetch_course_item(&context.tenant_id, course_id).await
    }

    pub async fn withdraw_course_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
    ) -> CourseResult<CourseItem> {
        let now = chrono::Utc::now().to_rfc3339();
        let user_id = context
            .user_id
            .as_deref()
            .ok_or_else(|| CourseError::invalid("An authenticated creator is required"))?;
        let result = sqlx::query(
            r#"
            UPDATE course_catalog
            SET publish_status = 'draft', review_note = NULL,
                updated_at = $1, updated_by = $2, version = version + 1
            WHERE id = $3 AND tenant_id = $4 AND author_user_id = $5
              AND publish_status = 'reviewing' AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(&context.actor_id)
        .bind(course_id)
        .bind(&context.tenant_id)
        .bind(user_id)
        .execute(self.pool())
        .await
        .map_err(storage_error)?;
        if result.rows_affected() == 0 {
            return Err(CourseError::invalid(
                "Only a course under review can be withdrawn",
            ));
        }
        self.fetch_course_item(&context.tenant_id, course_id).await
    }

    pub async fn review_course_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
        command: CourseReviewDecisionCommand,
    ) -> CourseResult<CourseItem> {
        let now = chrono::Utc::now().to_rfc3339();
        let decision = command.decision.trim().to_ascii_lowercase();
        let mut tx = self.pool().begin().await.map_err(storage_error)?;

        let row = sqlx::query(
            r#"
            SELECT course_code, is_free::bigint as is_free, price_amount, currency
            FROM course_catalog
            WHERE id = $1 AND tenant_id = $2 AND publish_status = 'reviewing' AND deleted_at IS NULL
            FOR UPDATE
            "#,
        )
        .bind(course_id)
        .bind(&context.tenant_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage_error)?;
        let Some(row) = row else {
            return Err(CourseError::invalid(
                "Course is not awaiting review in this tenant",
            ));
        };

        if decision == "approve" {
            let course_code: String = row.try_get("course_code").map_err(storage_error)?;
            let is_free: i64 = row.try_get("is_free").map_err(storage_error)?;
            let price_amount: Option<String> =
                row.try_get("price_amount").map_err(storage_error)?;
            let currency: Option<String> = row.try_get("currency").map_err(storage_error)?;
            ensure_default_offering(
                &mut tx,
                context,
                course_id,
                &course_code,
                is_free,
                price_amount.as_deref(),
                currency.as_deref(),
                &now,
            )
            .await?;
            sqlx::query(
                r#"
                UPDATE course_catalog
                SET publish_status = 'published', published_at = $1,
                    reviewed_at = $2, reviewed_by = $3, review_note = $4,
                    updated_at = $5, updated_by = $6, version = version + 1
                WHERE id = $7 AND tenant_id = $8
                "#,
            )
            .bind(&now)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&command.note)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(course_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        } else {
            sqlx::query(
                r#"
                UPDATE course_catalog
                SET publish_status = 'draft', reviewed_at = $1, reviewed_by = $2,
                    review_note = $3, updated_at = $4, updated_by = $5,
                    version = version + 1
                WHERE id = $6 AND tenant_id = $7
                "#,
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&command.note)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(course_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(storage_error)?;
        }

        tx.commit().await.map_err(storage_error)?;
        self.fetch_course_item(&context.tenant_id, course_id).await
    }

    pub async fn offline_course_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
        note: Option<String>,
    ) -> CourseResult<CourseItem> {
        let now = chrono::Utc::now().to_rfc3339();
        let result = sqlx::query(
            r#"
            UPDATE course_catalog
            SET publish_status = 'unpublished', review_note = COALESCE($1, review_note),
                reviewed_at = $2, reviewed_by = $3,
                updated_at = $4, updated_by = $5, version = version + 1
            WHERE id = $6 AND tenant_id = $7
              AND publish_status = 'published' AND deleted_at IS NULL
            "#,
        )
        .bind(&note)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(course_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(storage_error)?;
        if result.rows_affected() == 0 {
            return Err(CourseError::invalid("Course is not currently published"));
        }
        self.fetch_course_item(&context.tenant_id, course_id).await
    }

    pub async fn list_review_courses_impl(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage> {
        <Self as sdkwork_content_course_service::CourseCatalogRepository>::list_courses(
            self, context, query,
        )
        .await
    }

    pub async fn review_stats_impl(&self, context: &CourseServiceContext) -> CourseResult<Value> {
        let row = sqlx::query(
            r#"
            SELECT
              COUNT(*) FILTER (WHERE publish_status = 'reviewing') as pending,
              COUNT(*) FILTER (WHERE publish_status = 'draft' AND reviewed_at IS NOT NULL) as changes_requested,
              COUNT(*) FILTER (WHERE publish_status = 'published') as published,
              COUNT(*) FILTER (WHERE author_user_id IS NOT NULL) as ugc_total,
              COUNT(*) FILTER (WHERE author_user_id IS NOT NULL AND publish_status = 'published') as ugc_published,
              COUNT(*) FILTER (
                WHERE publish_status = 'reviewing'
                  AND NULLIF(submitted_at, '')::timestamptz < NOW() - INTERVAL '48 hours'
              ) as pending_overdue,
              COALESCE(
                AVG(
                  EXTRACT(EPOCH FROM (
                    NULLIF(reviewed_at, '')::timestamptz - NULLIF(submitted_at, '')::timestamptz
                  )) / 3600.0
                ) FILTER (WHERE reviewed_at IS NOT NULL AND submitted_at IS NOT NULL),
                0
              )::float8 as avg_review_hours
            FROM course_catalog
            WHERE tenant_id = $1
              AND (organization_id = $2 OR organization_id = '0')
              AND deleted_at IS NULL
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .fetch_one(self.pool())
        .await
        .map_err(storage_error)?;

        let pending: i64 = row.try_get("pending").map_err(storage_error)?;
        let changes_requested: i64 = row.try_get("changes_requested").map_err(storage_error)?;
        let published: i64 = row.try_get("published").map_err(storage_error)?;
        let ugc_total: i64 = row.try_get("ugc_total").map_err(storage_error)?;
        let ugc_published: i64 = row.try_get("ugc_published").map_err(storage_error)?;
        let pending_overdue: i64 = row.try_get("pending_overdue").map_err(storage_error)?;
        let avg_review_hours: f64 = row.try_get("avg_review_hours").map_err(storage_error)?;

        Ok(serde_json::json!({
            "pending": pending,
            "changesRequested": changes_requested,
            "published": published,
            "ugcTotal": ugc_total,
            "ugcPublished": ugc_published,
            "pendingOverdue": pending_overdue,
            "avgReviewHours": (avg_review_hours * 10.0).round() / 10.0,
        }))
    }

    pub async fn publish_course_impl(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
    ) -> CourseResult<CourseItem> {
        let now = chrono::Utc::now().to_rfc3339();
        let mut tx = self.pool().begin().await.map_err(storage_error)?;

        let row = sqlx::query(
            r#"
            SELECT course_code, is_free::bigint as is_free, price_amount, currency, course_kind,
                   publish_status,
                   (SELECT COUNT(*) FROM course_lesson WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL) as lesson_count,
                   (SELECT COUNT(*) FROM course_catalog_link WHERE course_id = $1 AND tenant_id = $2 AND link_type = 'collection_item' AND status = 'active') as item_count
            FROM course_catalog
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            FOR UPDATE
            "#,
        )
        .bind(course_id)
        .bind(&context.tenant_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage_error)?;
        let Some(row) = row else {
            return Err(CourseError::not_found("Course not found"));
        };
        let publish_status: String = row.try_get("publish_status").map_err(storage_error)?;
        if publish_status == "published" {
            return Err(CourseError::invalid("Course is already published"));
        }
        if publish_status == "archived" {
            return Err(CourseError::invalid("Archived courses cannot be published"));
        }
        let kind: String = row.try_get("course_kind").map_err(storage_error)?;
        let lesson_count: i64 = row.try_get("lesson_count").map_err(storage_error)?;
        let item_count: i64 = row.try_get("item_count").map_err(storage_error)?;
        if kind == "collection" {
            if item_count == 0 {
                return Err(CourseError::invalid(
                    "A collection must bundle at least one published course",
                ));
            }
        } else if lesson_count == 0 {
            return Err(CourseError::invalid(
                "A course must have at least one lesson before publishing",
            ));
        }

        let course_code: String = row.try_get("course_code").map_err(storage_error)?;
        let is_free: i64 = row.try_get("is_free").map_err(storage_error)?;
        let price_amount: Option<String> = row.try_get("price_amount").map_err(storage_error)?;
        let currency: Option<String> = row.try_get("currency").map_err(storage_error)?;

        ensure_default_offering(
            &mut tx,
            context,
            course_id,
            &course_code,
            is_free,
            price_amount.as_deref(),
            currency.as_deref(),
            &now,
        )
        .await?;

        sqlx::query(
            r#"
            UPDATE course_catalog
            SET publish_status = 'published', published_at = $1,
                reviewed_at = $2, reviewed_by = $3,
                updated_at = $4, updated_by = $5, version = version + 1
            WHERE id = $6 AND tenant_id = $7
            "#,
        )
        .bind(&now)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(course_id)
        .bind(&context.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(storage_error)?;

        tx.commit().await.map_err(storage_error)?;
        self.fetch_course_item(&context.tenant_id, course_id).await
    }
}

async fn ensure_default_offering(
    tx: &mut Transaction<'_, Postgres>,
    context: &CourseServiceContext,
    course_id: &str,
    course_code: &str,
    is_free: i64,
    price_amount: Option<&str>,
    currency: Option<&str>,
    now: &str,
) -> CourseResult<()> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM course_offering WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL)",
    )
    .bind(course_id)
    .bind(&context.tenant_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(storage_error)?;
    if exists {
        return Ok(());
    }

    let access_mode = if is_free != 0 { "free" } else { "paid" };
    let access_policy = serde_json::json!({
        "priceAmount": price_amount,
        "currency": currency,
    });
    let offering_id = uuid::Uuid::new_v4().to_string();
    let offering_uuid = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO course_offering (
            id, uuid, tenant_id, organization_id, course_id, offering_code, title,
            offering_type, delivery_mode, access_mode, access_policy_json,
            completion_rule_json, certificate_enabled, status,
            created_at, created_by, updated_at, updated_by, version
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 'vod', 'self_paced', $8, $9,
            '{}', 0, 'published', $10, $11, $12, $13, 0
        )
        "#,
    )
    .bind(&offering_id)
    .bind(&offering_uuid)
    .bind(&context.tenant_id)
    .bind(&context.organization_id)
    .bind(course_id)
    .bind(format!("{course_code}-default"))
    .bind(course_code)
    .bind(access_mode)
    .bind(access_policy.to_string())
    .bind(now)
    .bind(&context.actor_id)
    .bind(now)
    .bind(&context.actor_id)
    .execute(&mut **tx)
    .await
    .map_err(storage_error)?;
    Ok(())
}
