//! Postgres `CourseSqlxRepositoryPort` implementation.
//! Historically generated from the sqlite template by
//! scripts/dev/generate-course-postgres-repository-port.mjs, but the sqlite
//! template block was removed from course_repository.rs, so this file is now
//! HAND-MAINTAINED. Do not run the generator: it fails loudly rather than
//! overwriting this file.

use serde_json::Value;
use sqlx::Row;

use sdkwork_content_course_service::{
    CourseApplicationCreateRequest, CourseApplicationItem, CourseApplicationReviewRequest,
    CourseAuditCommand, CourseAuditLogItem, CourseCatalogCommand, CourseCategoryItem,
    CourseEnrollmentCommand, CourseError,
    CourseItem, CourseLessonCommand, CourseLessonItem, CourseLessonProgressCommand,
    CourseLiveSessionCommand, CourseOfferingCommand, CoursePage, CourseQuery,
    CourseResult, CourseSectionItem, CourseServiceContext,
};

use super::course_repository::{
    CourseRepositoryFuture, CourseSqlxRepositoryPort, PostgresCourseRepository,
};

fn sqlx_storage_error(error: sqlx::Error) -> CourseError {
    CourseError::storage(error.to_string())
}

/// Recomputes the live-session attendee snapshot from active attendance rows.
async fn refresh_live_attendee_count(
    pool: &sqlx::PgPool,
    tenant_id: &str,
    live_session_id: &str,
    now: &str,
    actor_id: Option<&str>,
) -> CourseResult<()> {
    sqlx::query(
        r#"
        UPDATE course_live_session
        SET attendee_count_snapshot = (
                SELECT COUNT(*)::int
                FROM course_live_attendance a
                WHERE a.tenant_id = course_live_session.tenant_id
                  AND a.live_session_id = course_live_session.id
                  AND a.left_at IS NULL
                  AND a.deleted_at IS NULL
            ),
            updated_at = $3,
            updated_by = $4
        WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(tenant_id)
    .bind(live_session_id)
    .bind(now)
    .bind(actor_id)
    .execute(pool)
    .await
    .map_err(sqlx_storage_error)?;
    Ok(())
}

impl CourseSqlxRepositoryPort for PostgresCourseRepository {
    fn list_categories<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<CourseCategoryItem>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();
            let status_filter = query.status.as_deref().unwrap_or("active");
            let q_filter = query.q.as_deref().unwrap_or("");

            let sql = r#"
                SELECT id, category_code as code, name, description, icon_resource_snapshot as icon_key,
                       sort_order::bigint as sort_weight, course_count_snapshot::bigint as course_count
                FROM course_category
                WHERE tenant_id = $1 
                  AND (organization_id = $2 OR organization_id = '0')
                  AND status = $3
                  AND (name LIKE '%' || $4 || '%' OR description LIKE '%' || $4 || '%' OR $4 = '')
                  AND deleted_at IS NULL
                ORDER BY sort_order ASC, id ASC
                LIMIT $5 OFFSET $6
            "#;

            let categories = sqlx::query_as::<_, CourseCategoryItem>(sql)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(status_filter)
                .bind(q_filter)
                .bind(limit)
                .bind(offset)
                .fetch_all(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

            Ok(categories)
        })
    }

    fn retrieve_category<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        category_id: String,
    ) -> CourseRepositoryFuture<'a, Option<CourseCategoryItem>> {
        Box::pin(async move {
            let category = sqlx::query_as::<_, CourseCategoryItem>(
                r#"
                SELECT id, category_code as code, name, description, icon_resource_snapshot as icon_key,
                       sort_order::bigint as sort_weight, course_count_snapshot::bigint as course_count
                FROM course_category
                WHERE id = $1
                  AND tenant_id = $2
                  AND (organization_id = $3 OR organization_id = '0')
                  AND deleted_at IS NULL
                "#,
            )
            .bind(&category_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(category)
        })
    }

    fn save_category<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value> {
        Box::pin(async move {
            let category_id = command
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let category_code = command
                .get("category_code")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let name = command.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let description = command.get("description").and_then(|v| v.as_str());
            let parent_id = command.get("parent_id").and_then(|v| v.as_str());
            let icon_resource_snapshot = command.get("icon_resource_snapshot");
            let sort_order = command
                .get("sort_order")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let status = command
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("active");
            let version = command.get("version").and_then(|v| v.as_i64()).unwrap_or(0);

            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            // Calculate path based on parent
            let path = if let Some(parent_id) = parent_id {
                let parent_path: String = sqlx::query_scalar(
                    "SELECT path FROM course_category WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
                )
                .bind(parent_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                format!("{}/{}", parent_path, category_code)
            } else {
                category_code.to_string()
            };

            // Calculate level_no
            let level_no = if parent_id.is_some() {
                let parent_level: i32 = sqlx::query_scalar(
                    "SELECT level_no FROM course_category WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
                )
                .bind(parent_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                parent_level + 1
            } else {
                0
            };

            if let Some(id) = category_id {
                // Update existing category
                let result = sqlx::query(
                    r#"
                    UPDATE course_category 
                    SET category_code = $1, name = $2, description = $3, parent_id = $4,
                        icon_resource_snapshot = $5, path = $6, level_no = $7, sort_order = $8,
                        status = $9, updated_at = $10, updated_by = $11, version = version + 1
                    WHERE id = $12 AND tenant_id = $13 AND version = $14 AND deleted_at IS NULL
                    "#,
                )
                .bind(category_code)
                .bind(name)
                .bind(description)
                .bind(parent_id)
                .bind(icon_resource_snapshot.map(|v| v.to_string()))
                .bind(&path)
                .bind(level_no)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&id)
                .bind(&context.tenant_id)
                .bind(version)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid(
                        "Category not found or version conflict",
                    ));
                }

                Ok(command)
            } else {
                // Insert new category
                let id = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    r#"
                    INSERT INTO course_category (
                        id, uuid, tenant_id, organization_id, parent_id, category_code, name,
                        description, icon_resource_snapshot, path, level_no, sort_order,
                        course_count_snapshot, status, created_at, created_by, updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, $14, $15, $16, $17, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(parent_id)
                .bind(category_code)
                .bind(name)
                .bind(description)
                .bind(icon_resource_snapshot.map(|v| v.to_string()))
                .bind(&path)
                .bind(level_no)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                let mut result = command.clone();
                result["id"] = serde_json::Value::String(id);
                result["uuid"] = serde_json::Value::String(uuid);
                result["path"] = serde_json::Value::String(path);
                result["level_no"] = serde_json::Value::Number(level_no.into());
                result["created_at"] = serde_json::Value::String(now.clone());
                result["updated_at"] = serde_json::Value::String(now);
                result["version"] = serde_json::Value::Number(0.into());

                Ok(result)
            }
        })
    }

    fn reorder_categories<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value> {
        Box::pin(async move {
            let category_ids = command
                .get("category_ids")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            if category_ids.is_empty() {
                return Err(CourseError::invalid("category_ids is required"));
            }

            let now = chrono::Utc::now().to_rfc3339();

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            // Update sort_order for each category
            for (index, category_id) in category_ids.iter().enumerate() {
                let result = sqlx::query(
                    r#"
                    UPDATE course_category 
                    SET sort_order = $1, updated_at = $2, updated_by = $3, version = version + 1
                    WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
                    "#,
                )
                .bind(index as i64)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(category_id)
                .bind(&context.tenant_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::not_found(format!(
                        "Category {} not found",
                        category_id
                    )));
                }
            }

            // Commit transaction
            tx.commit().await.map_err(sqlx_storage_error)?;

            // Return updated categories
            let mut categories = Vec::new();
            for category_id in &category_ids {
                let category = sqlx::query_as::<_, CourseCategoryItem>(
                    r#"
                    SELECT id, category_code as code, name, description, icon_resource_snapshot as icon_key,
                           sort_order::bigint as sort_weight, course_count_snapshot::bigint as course_count
                    FROM course_category
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#
                )
                .bind(category_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;
                categories.push(category);
            }

            Ok(serde_json::to_value(categories).unwrap_or_default())
        })
    }

    fn save_instructor<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value> {
        Box::pin(async move {
            let instructor_id = command
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let display_name = command
                .get("display_name")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let title = command.get("title").and_then(|v| v.as_str());
            let bio = command.get("bio").and_then(|v| v.as_str());
            let user_id = command.get("user_id").and_then(|v| v.as_str());
            let avatar_resource_snapshot = command.get("avatar_resource_snapshot");
            let profile_links_json = command.get("profile_links_json");
            let expertise_tags_json = command.get("expertise_tags_json");
            let qualification_status = command
                .get("qualification_status")
                .and_then(|v| v.as_str())
                .unwrap_or("pending");
            let sort_order = command
                .get("sort_order")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let status = command
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("active");
            let version = command.get("version").and_then(|v| v.as_i64()).unwrap_or(0);

            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            if let Some(id) = instructor_id {
                // Update existing instructor
                let result = sqlx::query(
                    r#"
                    UPDATE course_instructor 
                    SET display_name = $1, title = $2, bio = $3, user_id = $4,
                        avatar_resource_snapshot = $5, profile_links_json = $6, expertise_tags_json = $7,
                        qualification_status = $8, sort_order = $9, status = $10,
                        updated_at = $11, updated_by = $12, version = version + 1
                    WHERE id = $13 AND tenant_id = $14 AND version = $15 AND deleted_at IS NULL
                    "#
                )
                .bind(display_name)
                .bind(title)
                .bind(bio)
                .bind(user_id)
                .bind(avatar_resource_snapshot.map(|v| v.to_string()))
                .bind(profile_links_json.map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string()))
                .bind(expertise_tags_json.map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string()))
                .bind(qualification_status)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&id)
                .bind(&context.tenant_id)
                .bind(version)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid(
                        "Instructor not found or version conflict",
                    ));
                }

                Ok(command)
            } else {
                // Insert new instructor
                let id = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    r#"
                    INSERT INTO course_instructor (
                        id, uuid, tenant_id, organization_id, user_id, display_name, title, bio,
                        avatar_resource_snapshot, profile_links_json, expertise_tags_json,
                        qualification_status, sort_order, status, created_at, created_by,
                        updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(user_id)
                .bind(display_name)
                .bind(title)
                .bind(bio)
                .bind(avatar_resource_snapshot.map(|v| v.to_string()))
                .bind(profile_links_json.map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string()))
                .bind(expertise_tags_json.map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string()))
                .bind(qualification_status)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                let mut result = command.clone();
                result["id"] = serde_json::Value::String(id);
                result["uuid"] = serde_json::Value::String(uuid);
                result["created_at"] = serde_json::Value::String(now.clone());
                result["updated_at"] = serde_json::Value::String(now);
                result["version"] = serde_json::Value::Number(0.into());

                Ok(result)
            }
        })
    }

    fn update_instructor_status<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        instructor_id: String,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value> {
        Box::pin(async move {
            let qualification_status = command
                .get("qualification_status")
                .and_then(|v| v.as_str())
                .unwrap_or("pending");
            let status = command
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("active");
            let version = command.get("version").and_then(|v| v.as_i64()).unwrap_or(0);

            let now = chrono::Utc::now().to_rfc3339();

            // Update instructor status
            let result = sqlx::query(
                r#"
                UPDATE course_instructor 
                SET qualification_status = $1, status = $2, updated_at = $3, updated_by = $4,
                    version = version + 1
                WHERE id = $5 AND tenant_id = $6 AND version = $7 AND deleted_at IS NULL
                "#,
            )
            .bind(qualification_status)
            .bind(status)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&instructor_id)
            .bind(&context.tenant_id)
            .bind(version)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid(
                    "Instructor not found or version conflict",
                ));
            }

            // Return updated command
            let mut result = command.clone();
            result["updated_at"] = serde_json::Value::String(now);
            result["version"] = serde_json::Value::Number((version + 1).into());

            Ok(result)
        })
    }

    fn list_instructors<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();
            let status_filter = query.status.as_deref().unwrap_or("active");
            let q_filter = query.q.as_deref().unwrap_or("");

            let sql = r#"
                SELECT id, uuid, display_name, title, bio, user_id,
                       qualification_status, sort_order, status
                FROM course_instructor
                WHERE tenant_id = $1
                  AND (organization_id = $2 OR organization_id = '0')
                  AND status = $3
                  AND (display_name LIKE '%' || $4 || '%' OR title LIKE '%' || $4 || '%' OR $4 = '')
                  AND deleted_at IS NULL
                ORDER BY sort_order ASC, id ASC
                LIMIT $5 OFFSET $6
            "#;

            let instructors = sqlx::query(sqlx::AssertSqlSafe(sql))
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(status_filter)
                .bind(q_filter)
                .bind(limit)
                .bind(offset)
                .fetch_all(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

            let result: Vec<Value> = instructors
                .iter()
                .map(|row| {
                    serde_json::json!({
                        "id": row.get::<String, _>("id"),
                        "uuid": row.get::<String, _>("uuid"),
                        "displayName": row.get::<String, _>("display_name"),
                        "title": row.get::<Option<String>, _>("title"),
                        "bio": row.get::<Option<String>, _>("bio"),
                        "userId": row.get::<Option<String>, _>("user_id"),
                        "qualificationStatus": row.get::<String, _>("qualification_status"),
                        "sortOrder": row.get::<i32, _>("sort_order"),
                        "status": row.get::<String, _>("status"),
                    })
                })
                .collect();

            Ok(result)
        })
    }

    fn retrieve_instructor<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        instructor_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>> {
        Box::pin(async move {
            let sql = r#"
                SELECT id, uuid, display_name, title, bio, user_id,
                       qualification_status, sort_order, status
                FROM course_instructor
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            "#;

            let instructor = sqlx::query(sqlx::AssertSqlSafe(sql))
                .bind(&instructor_id)
                .bind(&context.tenant_id)
                .fetch_optional(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

            Ok(instructor.map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "uuid": row.get::<String, _>("uuid"),
                    "displayName": row.get::<String, _>("display_name"),
                    "title": row.get::<Option<String>, _>("title"),
                    "bio": row.get::<Option<String>, _>("bio"),
                    "userId": row.get::<Option<String>, _>("user_id"),
                    "qualificationStatus": row.get::<String, _>("qualification_status"),
                    "sortOrder": row.get::<i32, _>("sort_order"),
                    "status": row.get::<String, _>("status"),
                })
            }))
        })
    }

    fn delete_instructor<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        instructor_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            let result = sqlx::query(
                r#"
                UPDATE course_instructor
                SET status = 'deleted', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4
                WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
                "#,
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&instructor_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::not_found("Instructor not found"));
            }

            Ok(())
        })
    }

    fn count_courses<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        publish_status: Option<String>,
    ) -> CourseRepositoryFuture<'a, i64> {
        Box::pin(async move {
            let status_filter = publish_status.as_deref().unwrap_or("");
            let count = sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*)
                FROM course_catalog
                WHERE tenant_id = $1
                  AND (organization_id = $2 OR organization_id = '0')
                  AND ($3 = '' OR publish_status = $3)
                  AND deleted_at IS NULL
                "#,
            )
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(status_filter)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            Ok(count)
        })
    }

    fn list_courses<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, CoursePage> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();
            // An empty status means "every publication state" so operator
            // consoles can see drafts and pending reviews. Learner surfaces set
            // `status = published` explicitly at the HTTP boundary.
            let status_filter = query.status.as_deref().unwrap_or("");
            let kind_filter = query.kind.as_deref().unwrap_or("");
            let author_filter = query.author_user_id.as_deref().unwrap_or("");
            let q_filter = query.q.as_deref().unwrap_or("");
            let category_filter = query.category.as_deref().unwrap_or("");
            let level_filter = query.level.as_deref().unwrap_or("");

            let total = sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*) FROM course_catalog
                WHERE tenant_id = $1
                  AND (organization_id = $2 OR organization_id = '0')
                  AND ($3 = '' OR publish_status = $3)
                  AND ($4 = '' OR course_kind = $4)
                  AND ($5 = '' OR author_user_id = $5)
                  AND deleted_at IS NULL
                  AND (title LIKE '%' || $6 || '%' OR $6 = '')
                  AND (category_id = $7 OR $7 = '')
                  AND (difficulty_level = $8 OR $8 = '')
                "#,
            )
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(status_filter)
            .bind(kind_filter)
            .bind(author_filter)
            .bind(q_filter)
            .bind(category_filter)
            .bind(level_filter)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            let courses = sqlx::query_as::<_, CourseItem>(
                r#"
                SELECT id, course_code, title, subtitle, summary, description,
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
                FROM course_catalog
                WHERE tenant_id = $1
                  AND (organization_id = $2 OR organization_id = '0')
                  AND ($3 = '' OR publish_status = $3)
                  AND ($4 = '' OR course_kind = $4)
                  AND ($5 = '' OR author_user_id = $5)
                  AND deleted_at IS NULL
                  AND (title LIKE '%' || $6 || '%' OR $6 = '')
                  AND (category_id = $7 OR $7 = '')
                  AND (difficulty_level = $8 OR $8 = '')
                ORDER BY updated_at DESC, id DESC
                LIMIT $9 OFFSET $10
                "#
            )
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(status_filter)
            .bind(kind_filter)
            .bind(author_filter)
            .bind(q_filter)
            .bind(category_filter)
            .bind(level_filter)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(CoursePage {
                items: courses,
                page: query.page.unwrap_or(1),
                page_size: limit,
                total,
            })
        })
    }

    fn retrieve_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Option<CourseItem>> {
        Box::pin(async move {
            let course = sqlx::query_as::<_, CourseItem>(
                r#"
                SELECT id, course_code, title, subtitle, summary, description,
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
            FROM course_catalog
                WHERE id = $1 
                  AND tenant_id = $2 
                  AND (organization_id = $3 OR organization_id = '0')
                  AND deleted_at IS NULL
                "#
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(course)
        })
    }

    fn save_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseRepositoryFuture<'a, CourseItem> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            // Validate category exists if provided
            if let Some(category_id) = &command.category_id {
                let category_exists = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM course_category WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"
                )
                .bind(category_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if !category_exists {
                    return Err(CourseError::invalid("Category not found"));
                }
            }

            // Validate instructor exists if provided
            if let Some(instructor_id) = &command.instructor_id {
                let instructor_exists = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM course_instructor WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"
                )
                .bind(instructor_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if !instructor_exists {
                    return Err(CourseError::invalid("Instructor not found"));
                }
            }

            if let Some(course_id) = &command.course_id {
                // Update existing course
                let result = sqlx::query(
                    r#"
                    UPDATE course_catalog 
                    SET category_id = $1, primary_instructor_id = $2, title = $3, subtitle = $4,
                        description = $5, difficulty_level = $6, tags_json = $7,
                        cover_resource_snapshot = $8, updated_at = $9, updated_by = $10,
                        version = version + 1
                    WHERE id = $11 AND tenant_id = $12 AND deleted_at IS NULL
                    "#,
                )
                .bind(&command.category_id)
                .bind(&command.instructor_id)
                .bind(&command.title)
                .bind(&command.subtitle)
                .bind(&command.description)
                .bind(&command.level)
                .bind(serde_json::to_string(&command.tags).unwrap_or_else(|_| "[]".to_string()))
                .bind(
                    command
                        .cover
                        .as_ref()
                        .map(|c| serde_json::to_string(c).unwrap_or_default()),
                )
                .bind(&now)
                .bind(&context.actor_id)
                .bind(course_id)
                .bind(&context.tenant_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid("Course not found or version conflict"));
                }

                // Fetch updated course
                let course = sqlx::query_as::<_, CourseItem>(
                    r#"
                    SELECT id, course_code, title, subtitle, summary, description,
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
            FROM course_catalog
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#
                )
                .bind(course_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(course)
            } else {
                // Insert new course
                let id = uuid::Uuid::new_v4().to_string();
                let course_code = format!("CRS-{}", &id[..8]);

                sqlx::query(
                    r#"
                    INSERT INTO course_catalog (
                        id, uuid, tenant_id, organization_id, course_code, category_id,
                        primary_instructor_id, title, subtitle, description, difficulty_level,
                        tags_json, cover_resource_snapshot, visibility, publish_status, status,
                        created_at, created_by, updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'tenant', 'draft', 'active', $14, $15, $16, $17, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(&course_code)
                .bind(&command.category_id)
                .bind(&command.instructor_id)
                .bind(&command.title)
                .bind(&command.subtitle)
                .bind(&command.description)
                .bind(&command.level)
                .bind(serde_json::to_string(&command.tags).unwrap_or_else(|_| "[]".to_string()))
                .bind(command.cover.as_ref().map(|c| serde_json::to_string(c).unwrap_or_default()))
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                // Fetch created course
                let course = sqlx::query_as::<_, CourseItem>(
                    r#"
                    SELECT id, course_code, title, subtitle, summary, description,
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
            FROM course_catalog
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#
                )
                .bind(&id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(course)
            }
        })
    }

    fn publish_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, CourseItem> {
        Box::pin(async move {
            // Check if course has sections
            let section_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_section WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if section_count == 0 {
                return Err(CourseError::invalid(
                    "Course must have at least one section",
                ));
            }

            // Check if course has lessons
            let lesson_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_lesson WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if lesson_count == 0 {
                return Err(CourseError::invalid("Course must have at least one lesson"));
            }

            // Check if course has offerings
            let offering_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_offering WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if offering_count == 0 {
                return Err(CourseError::invalid(
                    "Course must have at least one offering",
                ));
            }

            let now = chrono::Utc::now().to_rfc3339();

            // Update publish status
            let result = sqlx::query(
                r#"
                UPDATE course_catalog 
                SET publish_status = 'published', published_at = $1, updated_at = $2, updated_by = $3,
                    version = version + 1
                WHERE id = $4 AND tenant_id = $5 AND publish_status = 'draft' AND deleted_at IS NULL
                "#
            )
            .bind(&now)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&course_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid(
                    "Course not found or not in draft status",
                ));
            }

            // Fetch updated course
            let course = sqlx::query_as::<_, CourseItem>(
                r#"
                SELECT id, course_code, title, subtitle, summary, description,
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
            FROM course_catalog
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(course)
        })
    }

    fn unpublish_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, CourseItem> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Update publish status
            let result = sqlx::query(
                r#"
                UPDATE course_catalog 
                SET publish_status = 'unpublished', updated_at = $1, updated_by = $2,
                    version = version + 1
                WHERE id = $3 AND tenant_id = $4 AND publish_status = 'published' AND deleted_at IS NULL
                "#
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&course_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid(
                    "Course not found or not in published status",
                ));
            }

            // Fetch updated course
            let course = sqlx::query_as::<_, CourseItem>(
                r#"
                SELECT id, course_code, title, subtitle, summary, description,
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
            FROM course_catalog
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(course)
        })
    }

    fn delete_course<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            // Check for active offerings
            let active_offering_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_offering WHERE course_id = $1 AND tenant_id = $2 AND status IN ('published', 'open') AND deleted_at IS NULL"
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if active_offering_count > 0 {
                return Err(CourseError::invalid(
                    "Cannot delete course with active offerings",
                ));
            }

            // Check for active enrollments
            let active_enrollment_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_enrollment WHERE course_id = $1 AND tenant_id = $2 AND enrollment_status = 'active' AND deleted_at IS NULL"
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if active_enrollment_count > 0 {
                return Err(CourseError::invalid(
                    "Cannot delete course with active enrollments",
                ));
            }

            let now = chrono::Utc::now().to_rfc3339();

            // Soft delete course
            let result = sqlx::query(
                r#"
                UPDATE course_catalog 
                SET status = 'deleted', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4,
                    version = version + 1
                WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
                "#
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&course_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid("Course not found"));
            }

            Ok(())
        })
    }

    fn save_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseOfferingCommand,
    ) -> CourseRepositoryFuture<'a, String> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            // Validate course exists
            let course_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM course_catalog WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"
            )
            .bind(&command.course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if !course_exists {
                return Err(CourseError::invalid("Course not found"));
            }

            if let Some(offering_id) = &command.offering_id {
                // Update existing offering
                let result = sqlx::query(
                    r#"
                    UPDATE course_offering 
                    SET title = $1, offering_type = $2, delivery_mode = $3, access_mode = $4,
                        start_at = $5, end_at = $6, open_at = $7, close_at = $8,
                        capacity = $9, completion_rule_json = $10, updated_at = $11,
                        updated_by = $12, version = version + 1
                    WHERE id = $13 AND tenant_id = $14 AND deleted_at IS NULL
                    "#,
                )
                .bind(&command.title)
                .bind(
                    serde_json::to_string(&command.offering_type)
                        .unwrap_or_else(|_| "\"vod\"".to_string()),
                )
                .bind("self_paced") // Default delivery mode
                .bind("free") // Default access mode
                .bind(&command.starts_at)
                .bind(&command.ends_at)
                .bind(&command.enrollment_starts_at)
                .bind(&command.enrollment_ends_at)
                .bind(command.capacity_limit)
                .bind(
                    command
                        .completion_rule
                        .as_ref()
                        .map(|r| serde_json::to_string(r).unwrap_or_else(|_| "{}".to_string())),
                )
                .bind(&now)
                .bind(&context.actor_id)
                .bind(offering_id)
                .bind(&context.tenant_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid("Offering not found"));
                }

                Ok(offering_id.clone())
            } else {
                // Insert new offering
                let id = uuid::Uuid::new_v4().to_string();
                let offering_code = format!("OFR-{}", &id[..8]);

                sqlx::query(
                    r#"
                    INSERT INTO course_offering (
                        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
                        offering_type, delivery_mode, access_mode, access_policy_json,
                        start_at, end_at, open_at, close_at, capacity, completion_rule_json,
                        status, created_at, created_by, updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'draft', $18, $19, $20, $21, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(&command.course_id)
                .bind(&offering_code)
                .bind(&command.title)
                .bind(serde_json::to_string(&command.offering_type).unwrap_or_else(|_| "\"vod\"".to_string()))
                .bind("self_paced") // Default delivery mode
                .bind("free") // Default access mode
                .bind("{}") // Default access policy
                .bind(&command.starts_at)
                .bind(&command.ends_at)
                .bind(&command.enrollment_starts_at)
                .bind(&command.enrollment_ends_at)
                .bind(command.capacity_limit)
                .bind(command.completion_rule.as_ref().map(|r| serde_json::to_string(r).unwrap_or_else(|_| "{}".to_string())))
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(id)
            }
        })
    }

    fn transition_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        offering_id: String,
        status: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Validate status transition
            let valid_transitions = match status.as_str() {
                "published" => vec!["draft"],
                "open" => vec!["published"],
                "closed" => vec!["open"],
                "archived" => vec!["closed", "draft"],
                _ => return Err(CourseError::invalid("Invalid offering status")),
            };

            let current_status = sqlx::query_scalar::<_, String>(
                "SELECT status FROM course_offering WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
            )
            .bind(&offering_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if !valid_transitions.contains(&current_status.as_str()) {
                return Err(CourseError::invalid(format!(
                    "Cannot transition offering from {} to {}",
                    current_status, status
                )));
            }

            // Update status
            let result = sqlx::query(
                r#"
                UPDATE course_offering 
                SET status = $1, updated_at = $2, updated_by = $3, version = version + 1
                WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
                "#,
            )
            .bind(&status)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&offering_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid("Offering not found"));
            }

            Ok(())
        })
    }

    fn list_sections<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Vec<CourseSectionItem>> {
        Box::pin(async move {
            let sections = sqlx::query_as::<_, CourseSectionItem>(
                r#"
                SELECT id, course_id, section_no, title, description,
                       lesson_count_snapshot::bigint as lesson_count, duration_seconds_snapshot::bigint as duration_seconds,
                       sort_order::bigint as sort_weight, status
                FROM course_section
                WHERE course_id = $1 
                  AND tenant_id = $2 
                  AND status != 'deleted'
                  AND deleted_at IS NULL
                ORDER BY sort_order ASC, id ASC
                "#
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(sections)
        })
    }

    fn save_section<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
        command: Value,
    ) -> CourseRepositoryFuture<'a, CourseSectionItem> {
        Box::pin(async move {
            let read_str = |camel: &str, snake: &str| {
                command
                    .get(camel)
                    .or_else(|| command.get(snake))
                    .and_then(|v| v.as_str())
            };
            let read_i64 = |camel: &str, snake: &str, fallback: i64| {
                command
                    .get(camel)
                    .or_else(|| command.get(snake))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(fallback)
            };

            let section_id = read_str("id", "id").map(str::to_owned);
            let title = read_str("title", "title").unwrap_or("").trim().to_owned();
            if title.is_empty() {
                return Err(CourseError::invalid("Section title is required"));
            }
            let mut course_id = course_id;
            if course_id.trim().is_empty() {
                let Some(id) = section_id.as_deref() else {
                    return Err(CourseError::invalid("courseId is required"));
                };
                course_id = sqlx::query_scalar::<_, String>(
                    "SELECT course_id FROM course_section WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
                )
                .bind(id)
                .bind(&context.tenant_id)
                .fetch_optional(self.pool())
                .await
                .map_err(sqlx_storage_error)?
                .ok_or_else(|| CourseError::not_found("Section not found"))?;
            }

            let course_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM course_catalog WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)",
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            if !course_exists {
                return Err(CourseError::not_found("Course not found"));
            }

            let description = read_str("description", "description");
            let sort_order = read_i64("sortWeight", "sort_order", read_i64("sortOrder", "sort_order", 0));
            let status = read_str("status", "status").unwrap_or("active");
            let version = read_i64("version", "version", 0);
            let now = chrono::Utc::now().to_rfc3339();

            if let Some(id) = section_id {
                let section_no = read_str("sectionNo", "section_no");
                let result = sqlx::query(
                    r#"
                    UPDATE course_section
                    SET section_no = COALESCE($1, section_no), title = $2, description = $3,
                        sort_order = $4, status = $5, updated_at = $6, updated_by = $7,
                        version = version + 1
                    WHERE id = $8 AND course_id = $9 AND tenant_id = $10
                      AND ($11 = 0 OR version = $11) AND deleted_at IS NULL
                    "#,
                )
                .bind(section_no)
                .bind(&title)
                .bind(description)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&id)
                .bind(&course_id)
                .bind(&context.tenant_id)
                .bind(version)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid(
                        "Section not found or version conflict",
                    ));
                }

                let section = sqlx::query_as::<_, CourseSectionItem>(
                    r#"
                    SELECT id, course_id, section_no, title, description,
                           lesson_count_snapshot::bigint as lesson_count,
                           duration_seconds_snapshot::bigint as duration_seconds,
                           sort_order::bigint as sort_weight, status
                    FROM course_section
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#,
                )
                .bind(&id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(section)
            } else {
                let id = uuid::Uuid::new_v4().to_string();
                let uuid = uuid::Uuid::new_v4().to_string();
                let section_no = match read_str("sectionNo", "section_no") {
                    Some(value) if !value.trim().is_empty() => value.to_owned(),
                    _ => {
                        let count = sqlx::query_scalar::<_, i64>(
                            "SELECT COUNT(*) FROM course_section WHERE course_id = $1 AND tenant_id = $2",
                        )
                        .bind(&course_id)
                        .bind(&context.tenant_id)
                        .fetch_one(self.pool())
                        .await
                        .map_err(sqlx_storage_error)?;
                        format!("S{:04}", count + 1)
                    }
                };

                sqlx::query(
                    r#"
                    INSERT INTO course_section (
                        id, uuid, tenant_id, organization_id, course_id, section_no, title,
                        description, sort_order, visibility, status, created_at, created_by,
                        updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'tenant', $10, $11, $12, $13, $14, 0)
                    "#,
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(&course_id)
                .bind(&section_no)
                .bind(&title)
                .bind(description)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                let section = sqlx::query_as::<_, CourseSectionItem>(
                    r#"
                    SELECT id, course_id, section_no, title, description,
                           lesson_count_snapshot::bigint as lesson_count,
                           duration_seconds_snapshot::bigint as duration_seconds,
                           sort_order::bigint as sort_weight, status
                    FROM course_section
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#,
                )
                .bind(&id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(section)
            }
        })
    }

    fn reorder_sections<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
        section_ids: Vec<String>,
    ) -> CourseRepositoryFuture<'a, Vec<CourseSectionItem>> {
        Box::pin(async move {
            if section_ids.is_empty() {
                return Err(CourseError::invalid("section_ids is required"));
            }

            let now = chrono::Utc::now().to_rfc3339();

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            // Update sort_order for each section
            for (index, section_id) in section_ids.iter().enumerate() {
                let result = sqlx::query(
                    r#"
                    UPDATE course_section 
                    SET sort_order = $1, updated_at = $2, updated_by = $3, version = version + 1
                    WHERE id = $4 AND course_id = $5 AND tenant_id = $6 AND deleted_at IS NULL
                    "#,
                )
                .bind(index as i64)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(section_id)
                .bind(&course_id)
                .bind(&context.tenant_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::not_found(format!(
                        "Section {} not found",
                        section_id
                    )));
                }
            }

            // Commit transaction
            tx.commit().await.map_err(sqlx_storage_error)?;

            // Return updated sections
            let sections = sqlx::query_as::<_, CourseSectionItem>(
                r#"
                SELECT id, course_id, section_no, title, description,
                       lesson_count_snapshot::bigint as lesson_count, duration_seconds_snapshot::bigint as duration_seconds,
                       sort_order::bigint as sort_weight, status
                FROM course_section
                WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                ORDER BY sort_order ASC
                "#
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(sections)
        })
    }

    fn list_lessons<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Vec<CourseLessonItem>> {
        Box::pin(async move {
            let lessons = sqlx::query_as::<_, CourseLessonItem>(
                r#"
                SELECT id, course_id, section_id, lesson_no, title, description,
                       content, duration_seconds::bigint as duration_seconds, duration_seconds::text as duration_text,
                       free_preview::boolean as free_preview, sort_order::bigint as sort_weight, status,
                       TRIM(BOTH '"' FROM lesson_kind) as kind, external_source_id, source_provider
                FROM course_lesson
                WHERE course_id = $1 
                  AND tenant_id = $2 
                  AND status != 'deleted'
                  AND deleted_at IS NULL
                ORDER BY sort_order ASC, id ASC
                "#,
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(lessons)
        })
    }

    fn save_lesson<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseLessonCommand,
    ) -> CourseRepositoryFuture<'a, CourseLessonItem> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            if let Some(lesson_id) = &command.lesson_id {
                // Update existing lesson
                let result = sqlx::query(
                    r#"
                    UPDATE course_lesson 
                    SET section_id = $1, lesson_kind = $2, title = $3, description = $4,
                        duration_seconds = $5, free_preview = $6, external_source_id = $7,
                        source_provider = $8, updated_at = $9,
                        updated_by = $10, version = version + 1
                    WHERE id = $11 AND course_id = $12 AND tenant_id = $13 AND deleted_at IS NULL
                    "#,
                )
                .bind(&command.section_id)
                .bind(command.lesson_kind.as_str())
                .bind(&command.title)
                .bind(&command.summary)
                .bind(command.duration_seconds.unwrap_or(0))
                .bind(command.free_preview)
                .bind(&command.external_source_id)
                .bind(&command.source_provider)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(lesson_id)
                .bind(&command.course_id)
                .bind(&context.tenant_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid("Lesson not found"));
                }

                // Delete existing resource refs
                sqlx::query(
                    "UPDATE course_resource_ref SET status = 'deleted', deleted_at = $1, deleted_by = $2 WHERE owner_type = 'lesson' AND owner_id = $3 AND tenant_id = $4"
                )
                .bind(&now)
                .bind(&context.actor_id)
                .bind(lesson_id)
                .bind(&context.tenant_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                // Insert new resource refs
                for (index, resource) in command.resources.iter().enumerate() {
                    let resource_ref_id = uuid::Uuid::new_v4().to_string();
                    let resource_ref_uuid = uuid::Uuid::new_v4().to_string();

                    sqlx::query(
                        r#"
                        INSERT INTO course_resource_ref (
                            id, uuid, tenant_id, organization_id, owner_type, owner_id,
                            resource_role, drive_resource_id, media_resource_snapshot,
                            mime_type, duration_seconds, sort_order, visibility, status,
                            created_at, created_by, updated_at, updated_by, version
                        ) VALUES ($1, $2, $3, $4, 'lesson', $5, $6, $7, $8, $9, $10, $11, 'tenant', 'active', $12, $13, $14, $15, 0)
                        "#
                    )
                    .bind(&resource_ref_id)
                    .bind(&resource_ref_uuid)
                    .bind(&context.tenant_id)
                    .bind(&context.organization_id)
                    .bind(lesson_id)
                    .bind(&resource.role)
                    .bind(&resource.drive_resource_id)
                    .bind(serde_json::to_string(resource).unwrap_or_default())
                    .bind(&resource.mime_type)
                    .bind(resource.duration_seconds)
                    .bind(index as i64)
                    .bind(&now)
                    .bind(&context.actor_id)
                    .bind(&now)
                    .bind(&context.actor_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(sqlx_storage_error)?;
                }

                // Commit transaction
                tx.commit().await.map_err(sqlx_storage_error)?;

                // Fetch updated lesson
                let lesson = sqlx::query_as::<_, CourseLessonItem>(
                    r#"
                    SELECT id, course_id, section_id, lesson_no, title, description,
                           content, duration_seconds::bigint as duration_seconds, duration_seconds::text as duration_text,
                           free_preview::boolean as free_preview, sort_order::bigint as sort_weight, status,
                           TRIM(BOTH '"' FROM lesson_kind) as kind, external_source_id, source_provider
                    FROM course_lesson
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#,
                )
                .bind(lesson_id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(lesson)
            } else {
                // Insert new lesson
                let id = uuid::Uuid::new_v4().to_string();
                let lesson_no = format!("LES-{}", &id[..8]);

                sqlx::query(
                    r#"
                    INSERT INTO course_lesson (
                        id, uuid, tenant_id, organization_id, course_id, section_id,
                        lesson_no, lesson_kind, title, description, duration_seconds,
                        free_preview, external_source_id, source_provider, sort_order, status, created_at, created_by,
                        updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 'draft', $15, $16, $17, $18, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(&command.course_id)
                .bind(&command.section_id)
                .bind(&lesson_no)
                .bind(command.lesson_kind.as_str())
                .bind(&command.title)
                .bind(&command.summary)
                .bind(command.duration_seconds.unwrap_or(0))
                .bind(command.free_preview)
                .bind(&command.external_source_id)
                .bind(&command.source_provider)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                // Insert resource refs
                for (index, resource) in command.resources.iter().enumerate() {
                    let resource_ref_id = uuid::Uuid::new_v4().to_string();
                    let resource_ref_uuid = uuid::Uuid::new_v4().to_string();

                    sqlx::query(
                        r#"
                        INSERT INTO course_resource_ref (
                            id, uuid, tenant_id, organization_id, owner_type, owner_id,
                            resource_role, drive_resource_id, media_resource_snapshot,
                            mime_type, duration_seconds, sort_order, visibility, status,
                            created_at, created_by, updated_at, updated_by, version
                        ) VALUES ($1, $2, $3, $4, 'lesson', $5, $6, $7, $8, $9, $10, $11, 'tenant', 'active', $12, $13, $14, $15, 0)
                        "#
                    )
                    .bind(&resource_ref_id)
                    .bind(&resource_ref_uuid)
                    .bind(&context.tenant_id)
                    .bind(&context.organization_id)
                    .bind(&id)
                    .bind(&resource.role)
                    .bind(&resource.drive_resource_id)
                    .bind(serde_json::to_string(resource).unwrap_or_default())
                    .bind(&resource.mime_type)
                    .bind(resource.duration_seconds)
                    .bind(index as i64)
                    .bind(&now)
                    .bind(&context.actor_id)
                    .bind(&now)
                    .bind(&context.actor_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(sqlx_storage_error)?;
                }

                // Commit transaction
                tx.commit().await.map_err(sqlx_storage_error)?;

                // Fetch created lesson
                let lesson = sqlx::query_as::<_, CourseLessonItem>(
                    r#"
                    SELECT id, course_id, section_id, lesson_no, title, description,
                           content, duration_seconds::bigint as duration_seconds, duration_seconds::text as duration_text,
                           free_preview::boolean as free_preview, sort_order::bigint as sort_weight, status,
                           TRIM(BOTH '"' FROM lesson_kind) as kind, external_source_id, source_provider
                    FROM course_lesson
                    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                    "#,
                )
                .bind(&id)
                .bind(&context.tenant_id)
                .fetch_one(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(lesson)
            }
        })
    }

    fn reorder_lessons<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
        lesson_ids: Vec<String>,
    ) -> CourseRepositoryFuture<'a, Vec<CourseLessonItem>> {
        Box::pin(async move {
            if lesson_ids.is_empty() {
                return Err(CourseError::invalid("lesson_ids is required"));
            }

            let now = chrono::Utc::now().to_rfc3339();

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            // Update sort_order for each lesson
            for (index, lesson_id) in lesson_ids.iter().enumerate() {
                let result = sqlx::query(
                    r#"
                    UPDATE course_lesson 
                    SET sort_order = $1, updated_at = $2, updated_by = $3, version = version + 1
                    WHERE id = $4 AND course_id = $5 AND tenant_id = $6 AND deleted_at IS NULL
                    "#,
                )
                .bind(index as i64)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(lesson_id)
                .bind(&course_id)
                .bind(&context.tenant_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::not_found(format!(
                        "Lesson {} not found",
                        lesson_id
                    )));
                }
            }

            // Commit transaction
            tx.commit().await.map_err(sqlx_storage_error)?;

            // Return updated lessons
            let lessons = sqlx::query_as::<_, CourseLessonItem>(
                r#"
                SELECT id, course_id, section_id, lesson_no, title, description,
                       content, duration_seconds::bigint as duration_seconds, duration_seconds::text as duration_text,
                       free_preview::boolean as free_preview, sort_order::bigint as sort_weight, status,
                       TRIM(BOTH '"' FROM lesson_kind) as kind, external_source_id, source_provider
                FROM course_lesson
                WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                ORDER BY sort_order ASC
                "#,
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(lessons)
        })
    }

    fn save_resource_ref<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: Value,
    ) -> CourseRepositoryFuture<'a, Value> {
        Box::pin(async move {
            let resource_ref_id = command
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let owner_type = command
                .get("owner_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let owner_id = command
                .get("owner_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let resource_role = command
                .get("resource_role")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let drive_resource_id = command
                .get("drive_resource_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let media_resource_snapshot = command.get("media_resource_snapshot");
            let mime_type = command.get("mime_type").and_then(|v| v.as_str());
            let duration_seconds = command.get("duration_seconds").and_then(|v| v.as_i64());
            let sort_order = command
                .get("sort_order")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let status = command
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("active");
            let version = command.get("version").and_then(|v| v.as_i64()).unwrap_or(0);

            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            if let Some(id) = resource_ref_id {
                // Update existing resource ref
                let result = sqlx::query(
                    r#"
                    UPDATE course_resource_ref 
                    SET owner_type = $1, owner_id = $2, resource_role = $3, drive_resource_id = $4,
                        media_resource_snapshot = $5, mime_type = $6, duration_seconds = $7,
                        sort_order = $8, status = $9, updated_at = $10, updated_by = $11,
                        version = version + 1
                    WHERE id = $12 AND tenant_id = $13 AND version = $14 AND deleted_at IS NULL
                    "#,
                )
                .bind(owner_type)
                .bind(owner_id)
                .bind(resource_role)
                .bind(drive_resource_id)
                .bind(media_resource_snapshot.map(|v| v.to_string()))
                .bind(mime_type)
                .bind(duration_seconds)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&id)
                .bind(&context.tenant_id)
                .bind(version)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid(
                        "Resource ref not found or version conflict",
                    ));
                }

                Ok(command)
            } else {
                // Insert new resource ref
                let id = uuid::Uuid::new_v4().to_string();

                sqlx::query(
                    r#"
                    INSERT INTO course_resource_ref (
                        id, uuid, tenant_id, organization_id, owner_type, owner_id,
                        resource_role, drive_resource_id, media_resource_snapshot,
                        mime_type, duration_seconds, sort_order, visibility, status,
                        created_at, created_by, updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'tenant', $13, $14, $15, $16, $17, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(owner_type)
                .bind(owner_id)
                .bind(resource_role)
                .bind(drive_resource_id)
                .bind(media_resource_snapshot.map(|v| v.to_string()))
                .bind(mime_type)
                .bind(duration_seconds)
                .bind(sort_order)
                .bind(status)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                let mut result = command.clone();
                result["id"] = serde_json::Value::String(id);
                result["uuid"] = serde_json::Value::String(uuid);
                result["created_at"] = serde_json::Value::String(now.clone());
                result["updated_at"] = serde_json::Value::String(now);
                result["version"] = serde_json::Value::Number(0.into());

                Ok(result)
            }
        })
    }

    fn save_live_session<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseLiveSessionCommand,
    ) -> CourseRepositoryFuture<'a, String> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            // Validate course exists
            let course_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM course_catalog WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"
            )
            .bind(&command.course_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if !course_exists {
                return Err(CourseError::invalid("Course not found"));
            }

            // Validate offering exists
            let offering_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM course_offering WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"
            )
            .bind(&command.offering_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if !offering_exists {
                return Err(CourseError::invalid("Offering not found"));
            }

            if let Some(live_session_id) = &command.live_session_id {
                // Update existing live session
                let result = sqlx::query(
                    r#"
                    UPDATE course_live_session 
                    SET title = $1, instructor_id = $2, scheduled_start_at = $3,
                        scheduled_end_at = $4, live_provider_code = $5, updated_at = $6,
                        updated_by = $7, version = version + 1
                    WHERE id = $8 AND tenant_id = $9 AND deleted_at IS NULL
                    "#,
                )
                .bind(&command.title)
                .bind(&command.instructor_id)
                .bind(&command.starts_at)
                .bind(&command.ends_at)
                .bind(&command.provider_code)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(live_session_id)
                .bind(&context.tenant_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                if result.rows_affected() == 0 {
                    return Err(CourseError::invalid("Live session not found"));
                }

                Ok(live_session_id.clone())
            } else {
                // Insert new live session
                let id = uuid::Uuid::new_v4().to_string();

                sqlx::query(
                    r#"
                    INSERT INTO course_live_session (
                        id, uuid, tenant_id, organization_id, course_id, offering_id,
                        lesson_id, instructor_id, title, live_provider_code,
                        scheduled_start_at, scheduled_end_at, live_status, status,
                        created_at, created_by, updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'scheduled', 'active', $13, $14, $15, $16, 0)
                    "#
                )
                .bind(&id)
                .bind(&uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(&command.course_id)
                .bind(&command.offering_id)
                .bind(&command.lesson_id)
                .bind(&command.instructor_id)
                .bind(&command.title)
                .bind(&command.provider_code)
                .bind(&command.starts_at)
                .bind(&command.ends_at)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

                Ok(id)
            }
        })
    }

    fn transition_live_session<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
        live_status: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Validate status transition
            let valid_transitions = match live_status.as_str() {
                "preparing" => vec!["scheduled"],
                "live" => vec!["preparing"],
                "ended" => vec!["live"],
                "recording_processing" => vec!["ended"],
                "replay_ready" => vec!["recording_processing"],
                "cancelled" => vec!["scheduled", "preparing"],
                "archived" => vec!["replay_ready", "cancelled"],
                _ => return Err(CourseError::invalid("Invalid live session status")),
            };

            let current_status = sqlx::query_scalar::<_, String>(
                "SELECT live_status FROM course_live_session WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
            )
            .bind(&live_session_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if !valid_transitions.contains(&current_status.as_str()) {
                return Err(CourseError::invalid(format!(
                    "Cannot transition live session from {} to {}",
                    current_status, live_status
                )));
            }

            // Update status
            let result = sqlx::query(
                r#"
                UPDATE course_live_session 
                SET live_status = $1, updated_at = $2, updated_by = $3, version = version + 1
                WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
                "#,
            )
            .bind(&live_status)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&live_session_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid("Live session not found"));
            }

            // Update actual start/end times based on status
            match live_status.as_str() {
                "live" => {
                    sqlx::query(
                        "UPDATE course_live_session SET actual_start_at = $1 WHERE id = $2 AND tenant_id = $3"
                    )
                    .bind(&now)
                    .bind(&live_session_id)
                    .bind(&context.tenant_id)
                    .execute(self.pool())
                    .await
                    .map_err(sqlx_storage_error)?;
                }
                "ended" => {
                    sqlx::query(
                        "UPDATE course_live_session SET actual_end_at = $1 WHERE id = $2 AND tenant_id = $3"
                    )
                    .bind(&now)
                    .bind(&live_session_id)
                    .bind(&context.tenant_id)
                    .execute(self.pool())
                    .await
                    .map_err(sqlx_storage_error)?;
                }
                _ => {}
            }

            Ok(())
        })
    }

    fn attach_live_replay<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
        resource_ref_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Validate resource ref exists
            let resource_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM course_resource_ref WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"
            )
            .bind(&resource_ref_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if !resource_exists {
                return Err(CourseError::invalid("Resource ref not found"));
            }

            // Update live session with replay resource
            let result = sqlx::query(
                r#"
                UPDATE course_live_session 
                SET replay_resource_ref_id = $1, live_status = 'replay_ready',
                    replay_available_at = $2, updated_at = $3, updated_by = $4,
                    version = version + 1
                WHERE id = $5 AND tenant_id = $6 AND live_status = 'recording_processing' AND deleted_at IS NULL
                "#
            )
            .bind(&resource_ref_id)
            .bind(&now)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&live_session_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid(
                    "Live session not found or not in recording_processing status",
                ));
            }

            Ok(())
        })
    }

    fn count_enrollments<'a>(
        &'a self,
        context: &'a CourseServiceContext,
    ) -> CourseRepositoryFuture<'a, i64> {
        Box::pin(async move {
            let count = sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*)
                FROM course_enrollment
                WHERE tenant_id = $1
                  AND (organization_id = $2 OR organization_id = '0')
                  AND deleted_at IS NULL
                "#,
            )
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            Ok(count)
        })
    }

    fn create_enrollment<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseEnrollmentCommand,
    ) -> CourseRepositoryFuture<'a, String> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();

            // Check for existing enrollment (idempotency)
            let existing_enrollment = sqlx::query_scalar::<_, String>(
                "SELECT id FROM course_enrollment WHERE tenant_id = $1 AND offering_id = $2 AND user_id = $3 AND deleted_at IS NULL"
            )
            .bind(&context.tenant_id)
            .bind(&command.offering_id)
            .bind(&command.learner_user_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if let Some(existing_id) = existing_enrollment {
                return Ok(existing_id);
            }

            // Validate offering exists and is open
            let offering = sqlx::query_as::<_, (String, String, String)>(
                "SELECT id, status, course_id FROM course_offering WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
            )
            .bind(&command.offering_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if offering.1 != "open" && offering.1 != "published" {
                return Err(CourseError::invalid("Offering is not open for enrollment"));
            }

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            // Create enrollment
            let enrollment_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO course_enrollment (
                    id, uuid, tenant_id, organization_id, course_id, offering_id,
                    user_id, enrollment_source, enrolled_at, enrollment_status, status,
                    created_at, created_by, updated_at, updated_by, version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', 'active', $10, $11, $12, $13, 0)
                "#
            )
            .bind(&enrollment_id)
            .bind(&uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&offering.2) // course_id
            .bind(&command.offering_id)
            .bind(&command.learner_user_id)
            .bind(&command.source)
            .bind(&now)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            // Initialize learning progress
            let progress_id = uuid::Uuid::new_v4().to_string();
            let progress_uuid = uuid::Uuid::new_v4().to_string();

            sqlx::query(
                r#"
                INSERT INTO course_learning_progress (
                    id, uuid, tenant_id, organization_id, course_id, offering_id,
                    enrollment_id, user_id, progress_status, status,
                    created_at, created_by, updated_at, updated_by, version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'not_started', 'active', $9, $10, $11, $12, 0)
                "#
            )
            .bind(&progress_id)
            .bind(&progress_uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&offering.2) // course_id
            .bind(&command.offering_id)
            .bind(&enrollment_id)
            .bind(&command.learner_user_id)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            // Commit transaction
            tx.commit().await.map_err(sqlx_storage_error)?;

            Ok(enrollment_id)
        })
    }

    fn revoke_enrollment<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        enrollment_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            // Update enrollment status
            let result = sqlx::query(
                r#"
                UPDATE course_enrollment 
                SET enrollment_status = 'revoked', updated_at = $1, updated_by = $2,
                    version = version + 1
                WHERE id = $3 AND tenant_id = $4 AND enrollment_status = 'active' AND deleted_at IS NULL
                "#
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid("Enrollment not found or not active"));
            }

            // Freeze learning progress
            sqlx::query(
                r#"
                UPDATE course_learning_progress 
                SET progress_status = 'expired', updated_at = $1, updated_by = $2,
                    version = version + 1
                WHERE enrollment_id = $3 AND tenant_id = $4 AND progress_status IN ('not_started', 'in_progress')
                "#
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            // Commit transaction
            tx.commit().await.map_err(sqlx_storage_error)?;

            Ok(())
        })
    }

    fn upsert_lesson_progress<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseLessonProgressCommand,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Start transaction
            let mut tx = self.pool().begin().await.map_err(sqlx_storage_error)?;

            // Learner clients (mobile/H5) may report progress without an
            // enrollment id. Resolve the user's active enrollment from the
            // lesson's course instead of failing the write.
            let enrollment_id = if command.enrollment_id.trim().is_empty() {
                let user_id = context
                    .user_id
                    .as_deref()
                    .ok_or_else(|| CourseError::invalid("User ID required"))?;
                sqlx::query_scalar::<_, String>(
                    r#"
                    SELECT e.id
                    FROM course_enrollment e
                    JOIN course_lesson l ON l.course_id = e.course_id
                    WHERE e.tenant_id = $1 AND e.user_id = $2 AND l.id = $3
                      AND e.enrollment_status IN ('active', 'completed')
                      AND e.status = 'active' AND e.deleted_at IS NULL
                    ORDER BY e.enrolled_at DESC
                    LIMIT 1
                    "#,
                )
                .bind(&context.tenant_id)
                .bind(user_id)
                .bind(&command.lesson_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?
                .ok_or_else(|| CourseError::not_found("Active enrollment required"))?
            } else {
                command.enrollment_id.clone()
            };
            let completed_at = if command.completed_at.is_none()
                && command.progress_status.as_str() == "completed"
            {
                Some(now.clone())
            } else {
                command.completed_at.clone()
            };

            // Get enrollment and course info
            let enrollment = sqlx::query_as::<_, (String, String, String)>(
                "SELECT id, course_id, offering_id FROM course_enrollment WHERE id = $1 AND tenant_id = $2 AND enrollment_status = 'active' AND deleted_at IS NULL"
            )
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            // Upsert lesson progress
            let existing_progress = sqlx::query_scalar::<_, String>(
                "SELECT id FROM course_lesson_progress WHERE tenant_id = $1 AND offering_id = $2 AND lesson_id = $3 AND user_id = $4 AND deleted_at IS NULL"
            )
            .bind(&context.tenant_id)
            .bind(&enrollment.2) // offering_id
            .bind(&command.lesson_id)
            .bind(&context.user_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            if let Some(progress_id) = existing_progress {
                // Update existing progress
                sqlx::query(
                    r#"
                    UPDATE course_lesson_progress 
                    SET progress_status = CASE
                            WHEN progress_status = 'completed' THEN 'completed'
                            ELSE $1
                        END,
                        watch_seconds = COALESCE($2, watch_seconds),
                        watch_position_seconds = COALESCE($3, watch_position_seconds),
                        completed_at = COALESCE($4, completed_at),
                        updated_at = $5, updated_by = $6,
                        version = version + 1
                    WHERE id = $7 AND tenant_id = $8
                    "#,
                )
                .bind(command.progress_status.as_str())
                .bind(command.watched_seconds)
                .bind(command.watch_position_seconds)
                .bind(&completed_at)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&progress_id)
                .bind(&context.tenant_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;
            } else {
                // Insert new progress
                let progress_id = uuid::Uuid::new_v4().to_string();
                let progress_uuid = uuid::Uuid::new_v4().to_string();

                // Get lesson kind
                let lesson_kind = sqlx::query_scalar::<_, String>(
                    "SELECT lesson_kind FROM course_lesson WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
                )
                .bind(&command.lesson_id)
                .bind(&context.tenant_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;

                sqlx::query(
                    r#"
                    INSERT INTO course_lesson_progress (
                        id, uuid, tenant_id, organization_id, course_id, offering_id,
                        lesson_id, enrollment_id, user_id, lesson_kind, progress_status,
                        watch_seconds, watch_position_seconds, completed_at, status,
                        created_at, created_by, updated_at, updated_by, version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                              $14, 'active', $15, $16, $17, $18, 0)
                    "#,
                )
                .bind(&progress_id)
                .bind(&progress_uuid)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(&enrollment.1) // course_id
                .bind(&enrollment.2) // offering_id
                .bind(&command.lesson_id)
                .bind(&enrollment_id)
                .bind(&context.user_id)
                .bind(&lesson_kind)
                .bind(command.progress_status.as_str())
                .bind(command.watched_seconds.unwrap_or(0))
                .bind(command.watch_position_seconds.unwrap_or(0))
                .bind(&completed_at)
                .bind(&now)
                .bind(&context.actor_id)
                .bind(&now)
                .bind(&context.actor_id)
                .execute(&mut *tx)
                .await
                .map_err(sqlx_storage_error)?;
            }

            // Recompute course learning progress
            let completed_lessons = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_lesson_progress WHERE enrollment_id = $1 AND tenant_id = $2 AND progress_status = 'completed' AND deleted_at IS NULL"
            )
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            let required_lessons = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM course_lesson WHERE course_id = $1 AND tenant_id = $2 AND required_for_completion = 1 AND status = 'published' AND deleted_at IS NULL"
            )
            .bind(&enrollment.1) // course_id
            .bind(&context.tenant_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            let progress_percent = if required_lessons > 0 {
                (completed_lessons as f64 / required_lessons as f64 * 100.0).min(100.0)
            } else {
                0.0
            };

            let progress_status = if progress_percent >= 100.0 {
                "completed"
            } else if progress_percent > 0.0 {
                "in_progress"
            } else {
                "not_started"
            };

            sqlx::query(
                r#"
                UPDATE course_learning_progress 
                SET progress_status = $1, completed_lesson_count = $2, required_lesson_count = $3,
                    progress_percent = $4, updated_at = $5, updated_by = $6, version = version + 1
                WHERE enrollment_id = $7 AND tenant_id = $8
                "#,
            )
            .bind(progress_status)
            .bind(completed_lessons)
            .bind(required_lessons)
            .bind(progress_percent.to_string())
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .execute(&mut *tx)
            .await
            .map_err(sqlx_storage_error)?;

            // Commit transaction
            tx.commit().await.map_err(sqlx_storage_error)?;

            Ok(())
        })
    }

    fn submit_application<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        request: CourseApplicationCreateRequest,
    ) -> CourseRepositoryFuture<'a, CourseApplicationItem> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();
            let id = uuid::Uuid::new_v4().to_string();

            // source_provider / external_bvid have no dedicated columns on
            // course_application; preserve them in metadata_json instead of
            // dropping them at the boundary.
            let mut metadata = request.metadata.clone().unwrap_or_else(|| serde_json::json!({}));
            if let Some(obj) = metadata.as_object_mut() {
                if !obj.contains_key("sourceProvider") && !request.source_provider.is_empty() {
                    obj.insert(
                        "sourceProvider".to_string(),
                        serde_json::json!(request.source_provider),
                    );
                }
                if !obj.contains_key("externalBvid") {
                    if let Some(bvid) = request.external_bvid.as_ref() {
                        obj.insert("externalBvid".to_string(), serde_json::json!(bvid));
                    }
                }
            }
            let metadata_json =
                serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());

            // Insert application
            sqlx::query(
                r#"
                INSERT INTO course_application (
                    id, uuid, tenant_id, organization_id, applicant_user_id, title,
                    category_id, description, contact_name, contact_email,
                    application_status, metadata_json, status, created_at, created_by,
                    updated_at, updated_by, version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted', $11, 'active', $12, $13, $14, $15, 0)
                "#
            )
            .bind(&id)
            .bind(&uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&context.user_id)
            .bind(&request.title)
            .bind(&request.category)
            .bind(&request.description)
            .bind(&request.contact_name)
            .bind(&request.contact_email)
            .bind(metadata_json)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            // Fetch created application
            let application = sqlx::query_as::<_, CourseApplicationItem>(
                r#"
                SELECT id, title, category_id as category_id, category_id as category, application_status as status,
                       applicant_user_id, contact_name, created_at as submitted_at, reviewed_at
                FROM course_application
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#,
            )
            .bind(&id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(application)
        })
    }

    fn count_applications<'a>(
        &'a self,
        context: &'a CourseServiceContext,
    ) -> CourseRepositoryFuture<'a, i64> {
        Box::pin(async move {
            let count = sqlx::query_scalar::<_, i64>(
                r#"
                SELECT COUNT(*)
                FROM course_application
                WHERE tenant_id = $1
                  AND (organization_id = $2 OR organization_id = '0')
                  AND deleted_at IS NULL
                "#,
            )
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            Ok(count)
        })
    }

    fn list_applications<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<CourseApplicationItem>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();
            let status_filter = query.status.as_deref().unwrap_or("");
            let applicant_filter = query.applicant_user_id.as_deref().unwrap_or("");

            let applications = sqlx::query_as::<_, CourseApplicationItem>(
                r#"
                SELECT id, title, category_id as category_id, category_id as category, application_status as status,
                       applicant_user_id, contact_name, created_at as submitted_at, reviewed_at
                FROM course_application
                WHERE tenant_id = $1
                  AND ($2 = '' OR application_status = $2)
                  AND ($3 = '' OR applicant_user_id = $3)
                  AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT $4 OFFSET $5
                "#,
            )
            .bind(&context.tenant_id)
            .bind(status_filter)
            .bind(applicant_filter)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(applications)
        })
    }

    fn review_application<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        application_id: String,
        request: CourseApplicationReviewRequest,
    ) -> CourseRepositoryFuture<'a, CourseApplicationItem> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            // Update application review status
            let result = sqlx::query(
                r#"
                UPDATE course_application 
                SET application_status = $1, reviewed_by = $2, reviewed_at = $3,
                    review_note = $4, updated_at = $5, updated_by = $6,
                    version = version + 1
                WHERE id = $7 AND tenant_id = $8 AND application_status = 'submitted' AND deleted_at IS NULL
                "#
            )
            .bind(&request.status)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&request.review_note)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&application_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::invalid(
                    "Application not found or not in submitted status",
                ));
            }

            // Fetch updated application
            let application = sqlx::query_as::<_, CourseApplicationItem>(
                r#"
                SELECT id, title, category_id as category_id, category_id as category, application_status as status,
                       applicant_user_id, contact_name, created_at as submitted_at, reviewed_at
                FROM course_application
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#,
            )
            .bind(&application_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(application)
        })
    }

    fn append_audit_log<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        command: CourseAuditCommand,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();
            let uuid = uuid::Uuid::new_v4().to_string();
            let id = uuid::Uuid::new_v4().to_string();
            let operation_id = format!("{}-{}", command.target_type, uuid::Uuid::new_v4());

            sqlx::query(
                r#"
                INSERT INTO course_audit_log (
                    id, uuid, tenant_id, organization_id, actor_type, actor_id,
                    operation_id, audit_event_type, target_type, target_id,
                    request_id, idempotency_key, before_snapshot_json, after_snapshot_json,
                    metadata_json, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', $16)
                "#
            )
            .bind(&id)
            .bind(&uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind("user") // Default actor type
            .bind(&context.actor_id)
            .bind(&operation_id)
            .bind(&command.operation)
            .bind(&command.target_type)
            .bind(&command.target_id)
            .bind(&context.request_id)
            .bind::<Option<String>>(None) // idempotency_key
            .bind(command.before_snapshot.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default()))
            .bind(command.after_snapshot.as_ref().map(|s| serde_json::to_string(s).unwrap_or_default()))
            .bind("{}") // metadata_json
            .bind(&now)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(())
        })
    }

    fn list_audit_logs<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<CourseAuditLogItem>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();

            let audit_logs = sqlx::query_as::<_, CourseAuditLogItem>(
                r#"
                SELECT id, uuid, tenant_id, organization_id, actor_type, actor_id,
                       operation_id, audit_event_type, target_type, target_id,
                       request_id, idempotency_key, before_snapshot_json, after_snapshot_json,
                       metadata_json, status, created_at
                FROM course_audit_log
                WHERE tenant_id = $1 
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(&context.tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(audit_logs)
        })
    }

    fn delete_category<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        category_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            let result = sqlx::query(
                r#"
                UPDATE course_category
                SET status = 'deleted', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4
                WHERE id = $5 AND tenant_id = $6 AND status != 'deleted' AND deleted_at IS NULL
                "#,
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&category_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::not_found("Category not found"));
            }

            Ok(())
        })
    }

    fn list_offerings<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        course_id: String,
    ) -> CourseRepositoryFuture<'a, Vec<Value>> {
        Box::pin(async move {
            let offerings = sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    Option<String>,
                    Option<String>,
                    String,
                ),
            >(
                r#"
                SELECT id, offering_code, title, offering_type, delivery_mode,
                       access_mode, access_policy_json, start_at, end_at, status
                FROM course_offering
                WHERE course_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                ORDER BY created_at DESC
                "#,
            )
            .bind(&course_id)
            .bind(&context.tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            let items: Vec<Value> = offerings
                .into_iter()
                .map(
                    |(id, code, title, offering_type, delivery_mode, access_mode, policy, start_at, end_at, status)| {
                        serde_json::json!({
                            "id": id,
                            "offeringCode": code,
                            "title": title,
                            "offeringType": offering_type,
                            "deliveryMode": delivery_mode,
                            "accessMode": access_mode,
                            "accessPolicyJson": policy,
                            "startAt": start_at,
                            "endAt": end_at,
                            "status": status
                        })
                    },
                )
                .collect();

            Ok(items)
        })
    }

    fn retrieve_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        offering_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>> {
        Box::pin(async move {
            let offering = sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    Option<String>,
                    Option<String>,
                    Option<i32>,
                    String,
                ),
            >(
                r#"
                SELECT id, offering_code, title, offering_type, delivery_mode, access_mode,
                       access_policy_json, start_at, end_at, capacity, status
                FROM course_offering
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#,
            )
            .bind(&offering_id)
            .bind(&context.tenant_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(offering.map(
                |(
                    id,
                    code,
                    title,
                    offering_type,
                    delivery_mode,
                    access_mode,
                    policy,
                    start_at,
                    end_at,
                    capacity,
                    status,
                )| {
                    serde_json::json!({
                        "id": id,
                        "offeringCode": code,
                        "title": title,
                        "offeringType": offering_type,
                        "deliveryMode": delivery_mode,
                        "accessMode": access_mode,
                        "accessPolicyJson": policy,
                        "startAt": start_at,
                        "endAt": end_at,
                        "capacity": capacity,
                        "status": status
                    })
                },
            ))
        })
    }

    fn delete_offering<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        offering_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let now = chrono::Utc::now().to_rfc3339();

            let result = sqlx::query(
                r#"
                UPDATE course_offering
                SET status = 'archived', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4
                WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
                "#,
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&offering_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::not_found("Offering not found"));
            }

            Ok(())
        })
    }

    fn find_offering_scope<'a>(
        &'a self,
        offering_id: String,
    ) -> CourseRepositoryFuture<'a, Option<(String, String)>> {
        Box::pin(async move {
            let row = sqlx::query(
                r#"
                SELECT tenant_id, organization_id
                FROM course_offering
                WHERE id = $1 AND deleted_at IS NULL
                LIMIT 1
                "#,
            )
            .bind(offering_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            Ok(row.map(|row| {
                (
                    row.try_get::<String, _>("tenant_id").unwrap_or_default(),
                    row.try_get::<String, _>("organization_id")
                        .unwrap_or_else(|_| "0".to_owned()),
                )
            }))
        })
    }

    fn list_live_sessions<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();

            let sessions = sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    Option<String>,
                    String,
                ),
            >(
                r#"
                SELECT id, title, description, live_status, scheduled_start_at,
                       scheduled_end_at, actual_start_at, status
                FROM course_live_session
                WHERE tenant_id = $1 AND deleted_at IS NULL
                ORDER BY scheduled_start_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(&context.tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            let items: Vec<Value> = sessions
                .into_iter()
                .map(
                    |(id, title, desc, live_status, start, end, actual_start, status)| {
                        serde_json::json!({
                            "id": id,
                            "title": title,
                            "description": desc,
                            "liveStatus": live_status,
                            "scheduledStartAt": start,
                            "scheduledEndAt": end,
                            "actualStartAt": actual_start,
                            "status": status
                        })
                    },
                )
                .collect();

            Ok(items)
        })
    }

    fn retrieve_live_session<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>> {
        Box::pin(async move {
            let session = sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    Option<String>,
                    Option<String>,
                    Option<String>,
                    i32,
                    String,
                ),
            >(
                r#"
                SELECT id, title, description, live_status, scheduled_start_at,
                       scheduled_end_at, actual_start_at, actual_end_at, provider_room_ref,
                       attendee_count_snapshot, status
                FROM course_live_session
                WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#,
            )
            .bind(&live_session_id)
            .bind(&context.tenant_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(session.map(
                |(
                    id,
                    title,
                    desc,
                    live_status,
                    start,
                    end,
                    actual_start,
                    actual_end,
                    room_ref,
                    attendee_count,
                    status,
                )| {
                    serde_json::json!({
                        "id": id,
                        "title": title,
                        "description": desc,
                        "liveStatus": live_status,
                        "scheduledStartAt": start,
                        "scheduledEndAt": end,
                        "actualStartAt": actual_start,
                        "actualEndAt": actual_end,
                        "providerRoomRef": room_ref,
                        "attendeeCountSnapshot": attendee_count,
                        "status": status
                    })
                },
            ))
        })
    }

    fn record_live_join<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let user_id = context
                .user_id
                .clone()
                .ok_or_else(|| CourseError::invalid("User ID required"))?;
            let now = chrono::Utc::now().to_rfc3339();
            let attendance_id = uuid::Uuid::new_v4().to_string();
            let attendance_uuid = uuid::Uuid::new_v4().to_string();

            let result = sqlx::query(
                r#"
                INSERT INTO course_live_attendance (
                    id, uuid, tenant_id, organization_id, live_session_id, course_id,
                    offering_id, lesson_id, user_id, joined_at, last_heartbeat_at,
                    status, created_at, created_by, updated_at, updated_by, version
                )
                SELECT $1, $2, $3, $4, s.id, s.course_id, s.offering_id, s.lesson_id,
                       $6, $7, $7, 'joined', $7, $8, $7, $8, 0
                FROM course_live_session s
                WHERE s.id = $5 AND s.tenant_id = $3 AND s.deleted_at IS NULL
                ON CONFLICT (tenant_id, live_session_id, user_id) DO UPDATE SET
                    joined_at = EXCLUDED.joined_at,
                    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
                    left_at = NULL,
                    attendance_seconds = 0,
                    status = 'joined',
                    updated_at = EXCLUDED.updated_at,
                    updated_by = EXCLUDED.updated_by,
                    version = course_live_attendance.version + 1
                "#,
            )
            .bind(&attendance_id)
            .bind(&attendance_uuid)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&live_session_id)
            .bind(&user_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::not_found("Live session not found"));
            }

            let _ = refresh_live_attendee_count(
                self.pool(),
                &context.tenant_id,
                &live_session_id,
                &now,
                context.actor_id.as_deref(),
            )
            .await?;
            Ok(())
        })
    }

    fn heartbeat_live_attendance<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let user_id = context
                .user_id
                .clone()
                .ok_or_else(|| CourseError::invalid("User ID required"))?;
            let now = chrono::Utc::now().to_rfc3339();

            let result = sqlx::query(
                r#"
                UPDATE course_live_attendance
                SET last_heartbeat_at = $1, status = 'attending',
                    updated_at = $1, updated_by = $2, version = version + 1
                WHERE tenant_id = $3 AND live_session_id = $4 AND user_id = $5
                  AND left_at IS NULL AND deleted_at IS NULL
                "#,
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&context.tenant_id)
            .bind(&live_session_id)
            .bind(&user_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            if result.rows_affected() == 0 {
                return Err(CourseError::not_found(
                    "Live attendance not found; join the session first",
                ));
            }
            Ok(())
        })
    }

    fn leave_live_attendance<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        live_session_id: String,
    ) -> CourseRepositoryFuture<'a, ()> {
        Box::pin(async move {
            let user_id = context
                .user_id
                .clone()
                .ok_or_else(|| CourseError::invalid("User ID required"))?;
            let now = chrono::Utc::now().to_rfc3339();

            let result = sqlx::query(
                r#"
                UPDATE course_live_attendance
                SET left_at = $1, status = 'left',
                    attendance_seconds = GREATEST(
                        0,
                        EXTRACT(EPOCH FROM ($1::timestamptz - joined_at::timestamptz))::int
                    ),
                    updated_at = $1, updated_by = $2, version = version + 1
                WHERE tenant_id = $3 AND live_session_id = $4 AND user_id = $5
                  AND left_at IS NULL AND deleted_at IS NULL
                "#,
            )
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&context.tenant_id)
            .bind(&live_session_id)
            .bind(&user_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            // Leaving twice is harmless; still refresh the snapshot.
            if result.rows_affected() > 0 {
                let _ = refresh_live_attendee_count(
                    self.pool(),
                    &context.tenant_id,
                    &live_session_id,
                    &now,
                    context.actor_id.as_deref(),
                )
                .await?;
            }
            Ok(())
        })
    }

    fn list_enrollments<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();

            let enrollments =
                sqlx::query_as::<_, (String, String, String, String, String, String)>(
                    r#"
                SELECT id, course_id, offering_id, user_id, enrollment_status, enrolled_at
                FROM course_enrollment
                WHERE tenant_id = $1 AND deleted_at IS NULL
                ORDER BY enrolled_at DESC
                LIMIT $2 OFFSET $3
                "#,
                )
                .bind(&context.tenant_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(self.pool())
                .await
                .map_err(sqlx_storage_error)?;

            let items: Vec<Value> = enrollments
                .into_iter()
                .map(
                    |(id, course_id, offering_id, user_id, status, enrolled_at)| {
                        serde_json::json!({
                            "id": id,
                            "courseId": course_id,
                            "offeringId": offering_id,
                            "userId": user_id,
                            "enrollmentStatus": status,
                            "enrolledAt": enrolled_at
                        })
                    },
                )
                .collect();

            Ok(items)
        })
    }

    fn list_progress<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        query: CourseQuery,
    ) -> CourseRepositoryFuture<'a, Vec<Value>> {
        Box::pin(async move {
            let limit = query.limit();
            let offset = query.offset();

            let progress = sqlx::query_as::<_, (String, String, String, String, String, String, i32, i32, String)>(
                r#"
                SELECT id, course_id, offering_id, enrollment_id, user_id,
                       progress_status, completed_lesson_count, required_lesson_count, progress_percent
                FROM course_learning_progress
                WHERE tenant_id = $1 AND deleted_at IS NULL
                ORDER BY updated_at DESC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(&context.tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            let items: Vec<Value> = progress
                .into_iter()
                .map(
                    |(
                        id,
                        course_id,
                        offering_id,
                        enrollment_id,
                        user_id,
                        status,
                        completed,
                        required,
                        percent,
                    )| {
                        serde_json::json!({
                            "id": id,
                            "courseId": course_id,
                            "offeringId": offering_id,
                            "enrollmentId": enrollment_id,
                            "userId": user_id,
                            "progressStatus": status,
                            "completedLessonCount": completed,
                            "requiredLessonCount": required,
                            "progressPercent": percent
                        })
                    },
                )
                .collect();

            Ok(items)
        })
    }

    fn retrieve_progress<'a>(
        &'a self,
        context: &'a CourseServiceContext,
        enrollment_id: String,
    ) -> CourseRepositoryFuture<'a, Option<Value>> {
        Box::pin(async move {
            let progress = sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    String,
                    String,
                    String,
                    String,
                    i32,
                    i32,
                    String,
                    i64,
                    Option<String>,
                    Option<String>,
                    Option<String>,
                ),
            >(
                r#"
                SELECT id, course_id, offering_id, enrollment_id, user_id,
                       progress_status, completed_lesson_count, required_lesson_count,
                       progress_percent, watch_seconds::bigint as watch_seconds,
                       last_lesson_id, started_at, completed_at
                FROM course_learning_progress
                WHERE enrollment_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
                "#,
            )
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(progress.map(
                |(
                    id,
                    course_id,
                    offering_id,
                    enrollment_id,
                    user_id,
                    status,
                    completed,
                    required,
                    percent,
                    watch,
                    last_lesson,
                    started,
                    completed_at,
                )| {
                    serde_json::json!({
                        "id": id,
                        "courseId": course_id,
                        "offeringId": offering_id,
                        "enrollmentId": enrollment_id,
                        "userId": user_id,
                        "progressStatus": status,
                        "completedLessonCount": completed,
                        "requiredLessonCount": required,
                        "progressPercent": percent,
                        "watchSeconds": watch,
                        "lastLessonId": last_lesson,
                        "startedAt": started,
                        "completedAt": completed_at
                    })
                },
            ))
        })
    }
}
