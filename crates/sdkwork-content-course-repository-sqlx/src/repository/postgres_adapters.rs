//! Postgres repository adapter implementations.
//! Historically generated from the sqlite template by
//! scripts/dev/generate-course-postgres-adapters.mjs, but the sqlite template
//! was removed, so this file is now HAND-MAINTAINED. The generator script
//! fails loudly when its source marker is missing.

use serde_json::Value;
use sqlx::{PgPool, Row};

use sdkwork_content_course_service::domain::models::{
    CourseApplicationCreateRequest, CourseApplicationItem, CourseApplicationReviewRequest,
    CourseAuditLogItem, CourseCategoryItem, CourseCollectionItem, CourseCurriculum, CourseError,
    CourseItem, CourseLessonItem, CoursePage, CourseQuery, CourseResult, CourseSectionItem,
    CourseStudioDetail,
};
use sdkwork_content_course_service::ports::repository::{
    CourseApplicationRepository, CourseAuditLogRepository, CourseCatalogRepository,
    CourseCategoryRepository, CourseEnrollmentRepository, CourseInstructorRepository,
    CourseLessonRepository, CourseLiveSessionRepository, CourseOfferingRepository,
    CourseProgressRepository, CourseReactionRepository, CourseResourceRepository,
};
use sdkwork_content_course_service::{
    CourseAuditCommand, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLessonProgressCommand, CourseLiveSessionCommand, CourseOfferingCommand,
    CourseReviewDecisionCommand, CourseServiceContext, CourseStudioDraftCommand,
};

use super::course_repository::{CourseSqlxRepositoryPort, PostgresCourseRepository};

fn sqlx_storage_error(error: sqlx::Error) -> CourseError {
    CourseError::storage(error.to_string())
}

// ── Category ────────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseCategoryRepository for PostgresCourseRepository {
    async fn list_categories(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseCategoryItem>> {
        CourseSqlxRepositoryPort::list_categories(self, context, query).await
    }

    async fn retrieve_category(
        &self,
        context: &CourseServiceContext,
        category_id: String,
    ) -> CourseResult<Option<CourseCategoryItem>> {
        CourseSqlxRepositoryPort::retrieve_category(self, context, category_id).await
    }

    async fn save_category(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        CourseSqlxRepositoryPort::save_category(self, context, command).await
    }

    async fn reorder_categories(
        &self,
        context: &CourseServiceContext,
        category_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseCategoryItem>> {
        let command = serde_json::json!({ "categoryIds": category_ids });
        let _result = CourseSqlxRepositoryPort::reorder_categories(self, context, command).await?;
        // Return the reordered categories
        let query = CourseQuery::default();
        CourseSqlxRepositoryPort::list_categories(self, context, query).await
    }

    async fn delete_category(
        &self,
        context: &CourseServiceContext,
        category_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::delete_category(self, context, category_id).await
    }
}

// ── Instructor ──────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseInstructorRepository for PostgresCourseRepository {
    async fn list_instructors(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        CourseSqlxRepositoryPort::list_instructors(self, context, query).await
    }

    async fn retrieve_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<Option<Value>> {
        CourseSqlxRepositoryPort::retrieve_instructor(self, context, instructor_id).await
    }

    async fn save_instructor(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        CourseSqlxRepositoryPort::save_instructor(self, context, command).await
    }

    async fn update_instructor_status(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
        command: Value,
    ) -> CourseResult<Value> {
        CourseSqlxRepositoryPort::update_instructor_status(self, context, instructor_id, command)
            .await
    }

    async fn delete_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::delete_instructor(self, context, instructor_id).await
    }
}

// ── Catalog ─────────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseCatalogRepository for PostgresCourseRepository {
    async fn count_courses(
        &self,
        context: &CourseServiceContext,
        publish_status: Option<String>,
    ) -> CourseResult<i64> {
        CourseSqlxRepositoryPort::count_courses(self, context, publish_status).await
    }

    async fn list_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage> {
        CourseSqlxRepositoryPort::list_courses(self, context, query).await
    }

    async fn retrieve_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseItem>> {
        CourseSqlxRepositoryPort::retrieve_course(self, context, course_id).await
    }

    async fn save_course(
        &self,
        context: &CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseResult<CourseItem> {
        CourseSqlxRepositoryPort::save_course(self, context, command).await
    }

    async fn publish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        self.publish_course_impl(context, &course_id).await
    }

    async fn unpublish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        CourseSqlxRepositoryPort::unpublish_course(self, context, course_id).await
    }

    async fn delete_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::delete_course(self, context, course_id).await
    }

    async fn save_studio_course(
        &self,
        context: &CourseServiceContext,
        command: CourseStudioDraftCommand,
    ) -> CourseResult<CourseItem> {
        self.save_studio_course_impl(context, command).await
    }

    async fn retrieve_course_detail(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseStudioDetail>> {
        self.retrieve_course_detail_impl(context, &course_id).await
    }

    async fn retrieve_curriculum(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseCurriculum>> {
        self.retrieve_curriculum_impl(context, &course_id).await
    }

    async fn list_collection_items(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseCollectionItem>> {
        self.list_collection_items_impl(context, &course_id).await
    }

    async fn submit_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        self.submit_course_impl(context, &course_id).await
    }

    async fn withdraw_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        self.withdraw_course_impl(context, &course_id).await
    }

    async fn review_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: CourseReviewDecisionCommand,
    ) -> CourseResult<CourseItem> {
        self.review_course_impl(context, &course_id, command).await
    }

    async fn offline_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        note: Option<String>,
    ) -> CourseResult<CourseItem> {
        self.offline_course_impl(context, &course_id, note).await
    }

    async fn list_review_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage> {
        self.list_review_courses_impl(context, query).await
    }

    async fn review_stats(
        &self,
        context: &CourseServiceContext,
    ) -> CourseResult<serde_json::Value> {
        self.review_stats_impl(context).await
    }
}

// ── Offering ────────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseOfferingRepository for PostgresCourseRepository {
    async fn save_offering(
        &self,
        context: &CourseServiceContext,
        command: CourseOfferingCommand,
    ) -> CourseResult<String> {
        CourseSqlxRepositoryPort::save_offering(self, context, command).await
    }

    async fn transition_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        status: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::transition_offering(self, context, offering_id, status).await
    }

    async fn list_offerings(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<Value>> {
        CourseSqlxRepositoryPort::list_offerings(self, context, course_id).await
    }

    async fn retrieve_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<Option<Value>> {
        CourseSqlxRepositoryPort::retrieve_offering(self, context, offering_id).await
    }

    async fn delete_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::delete_offering(self, context, offering_id).await
    }

    async fn find_offering_scope(
        &self,
        offering_id: String,
    ) -> CourseResult<Option<(String, String)>> {
        CourseSqlxRepositoryPort::find_offering_scope(self, offering_id).await
    }
}

// ── Lesson / Section ────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseLessonRepository for PostgresCourseRepository {
    async fn list_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseSectionItem>> {
        CourseSqlxRepositoryPort::list_sections(self, context, course_id).await
    }

    async fn save_section(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: Value,
    ) -> CourseResult<CourseSectionItem> {
        CourseSqlxRepositoryPort::save_section(self, context, course_id, command).await
    }

    async fn reorder_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        section_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseSectionItem>> {
        CourseSqlxRepositoryPort::reorder_sections(self, context, course_id, section_ids).await
    }

    async fn list_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseLessonItem>> {
        CourseSqlxRepositoryPort::list_lessons(self, context, course_id).await
    }

    async fn retrieve_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<Option<CourseLessonItem>> {
        let sql = r#"
            SELECT id, course_id, section_id, lesson_no, title,
                   description, content, duration_seconds::bigint as duration_seconds,
                   duration_seconds::text as duration_text,
                   free_preview::boolean as free_preview,
                   TRIM(BOTH '"' FROM lesson_kind) as kind, external_source_id, source_provider,
                   required_for_completion, sort_order::bigint as sort_weight, status
            FROM course_lesson
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        "#;

        let lesson = sqlx::query_as::<_, CourseLessonItem>(sql)
            .bind(&lesson_id)
            .bind(&context.tenant_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

        Ok(lesson)
    }

    async fn save_lesson(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonCommand,
    ) -> CourseResult<CourseLessonItem> {
        CourseSqlxRepositoryPort::save_lesson(self, context, command).await
    }

    async fn reorder_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        lesson_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseLessonItem>> {
        CourseSqlxRepositoryPort::reorder_lessons(self, context, course_id, lesson_ids).await
    }

    async fn delete_section(
        &self,
        context: &CourseServiceContext,
        section_id: String,
    ) -> CourseResult<()> {
        // Soft delete via save_section with status=deleted
        let cmd = serde_json::json!({ "id": section_id, "status": "deleted" });
        CourseSqlxRepositoryPort::save_section(self, context, String::new(), cmd).await?;
        Ok(())
    }

    async fn delete_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let result = sqlx::query(
            r#"
            UPDATE course_lesson
            SET status = 'deleted', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4
            WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&lesson_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        if result.rows_affected() == 0 {
            return Err(CourseError::not_found("Lesson not found"));
        }

        Ok(())
    }
}

// ── Live Session ────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseLiveSessionRepository for PostgresCourseRepository {
    async fn save_live_session(
        &self,
        context: &CourseServiceContext,
        command: CourseLiveSessionCommand,
    ) -> CourseResult<String> {
        CourseSqlxRepositoryPort::save_live_session(self, context, command).await
    }

    async fn transition_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        live_status: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::transition_live_session(
            self,
            context,
            live_session_id,
            live_status,
        )
        .await
    }

    async fn attach_live_replay(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        resource_ref_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::attach_live_replay(
            self,
            context,
            live_session_id,
            resource_ref_id,
        )
        .await
    }

    async fn list_live_sessions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        CourseSqlxRepositoryPort::list_live_sessions(self, context, query).await
    }

    async fn retrieve_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<Option<Value>> {
        CourseSqlxRepositoryPort::retrieve_live_session(self, context, live_session_id).await
    }

    async fn record_live_join(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::record_live_join(self, context, live_session_id).await
    }

    async fn heartbeat_live_attendance(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::heartbeat_live_attendance(self, context, live_session_id).await
    }

    async fn leave_live_attendance(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::leave_live_attendance(self, context, live_session_id).await
    }
}

// ── Enrollment ──────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseEnrollmentRepository for PostgresCourseRepository {
    async fn count_enrollments(&self, context: &CourseServiceContext) -> CourseResult<i64> {
        CourseSqlxRepositoryPort::count_enrollments(self, context).await
    }

    async fn create_enrollment(
        &self,
        context: &CourseServiceContext,
        command: CourseEnrollmentCommand,
    ) -> CourseResult<String> {
        CourseSqlxRepositoryPort::create_enrollment(self, context, command).await
    }

    async fn retrieve_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<Value>> {
        let sql = r#"
            SELECT id, uuid, course_id, offering_id, user_id, enrollment_source,
                   access_snapshot_json, enrolled_at, started_at, completed_at,
                   expires_at, enrollment_status, status, created_at
            FROM course_enrollment
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        "#;

        let enrollment = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(&enrollment_id)
            .bind(&context.tenant_id)
            .fetch_optional(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

        Ok(enrollment.map(|row| {
            serde_json::json!({
                "id": row.get::<String, _>("id"),
                "uuid": row.get::<String, _>("uuid"),
                "courseId": row.get::<String, _>("course_id"),
                "offeringId": row.get::<String, _>("offering_id"),
                "userId": row.get::<String, _>("user_id"),
                "enrollmentSource": row.get::<String, _>("enrollment_source"),
                "accessSnapshotJson": row.get::<String, _>("access_snapshot_json"),
                "enrolledAt": row.get::<String, _>("enrolled_at"),
                "startedAt": row.get::<Option<String>, _>("started_at"),
                "completedAt": row.get::<Option<String>, _>("completed_at"),
                "expiresAt": row.get::<Option<String>, _>("expires_at"),
                "enrollmentStatus": row.get::<String, _>("enrollment_status"),
                "status": row.get::<String, _>("status"),
                "createdAt": row.get::<String, _>("created_at"),
            })
        }))
    }

    async fn revoke_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::revoke_enrollment(self, context, enrollment_id).await
    }

    async fn list_enrollments(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        CourseSqlxRepositoryPort::list_enrollments(self, context, query).await
    }

    async fn has_active_enrollment(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        user_id: String,
    ) -> CourseResult<bool> {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM course_enrollment \
             WHERE tenant_id = $1 AND course_id = $2 AND user_id = $3 \
               AND enrollment_status IN ('active', 'completed') AND status = 'active' \
               AND deleted_at IS NULL)",
        )
        .bind(&context.tenant_id)
        .bind(&course_id)
        .bind(&user_id)
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        Ok(exists)
    }
}

// ── Progress ────────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseProgressRepository for PostgresCourseRepository {
    async fn upsert_lesson_progress(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonProgressCommand,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::upsert_lesson_progress(self, context, command).await
    }

    async fn repair_lesson_progress(
        &self,
        context: &CourseServiceContext,
        lesson_progress_id: String,
        command: Value,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();

        let progress_status = command
            .get("progressStatus")
            .and_then(|v| v.as_str())
            .unwrap_or("not_started");
        let watch_seconds = command
            .get("watchSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let watch_position_seconds = command
            .get("watchPositionSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let result = sqlx::query(
            r#"
            UPDATE course_lesson_progress
            SET progress_status = $1, watch_seconds = $2, watch_position_seconds = $3,
                updated_at = $4, updated_by = $5, version = version + 1
            WHERE id = $6 AND tenant_id = $7 AND deleted_at IS NULL
            "#,
        )
        .bind(progress_status)
        .bind(watch_seconds)
        .bind(watch_position_seconds)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&lesson_progress_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        if result.rows_affected() == 0 {
            return Err(CourseError::not_found("Lesson progress not found"));
        }

        Ok(())
    }

    async fn list_progress(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        CourseSqlxRepositoryPort::list_progress(self, context, query).await
    }

    async fn retrieve_progress(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<Value>> {
        CourseSqlxRepositoryPort::retrieve_progress(self, context, enrollment_id).await
    }
}

// ── Comment ─────────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseApplicationRepository for PostgresCourseRepository {
    async fn count_applications(&self, context: &CourseServiceContext) -> CourseResult<i64> {
        CourseSqlxRepositoryPort::count_applications(self, context).await
    }

    async fn list_applications(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseApplicationItem>> {
        CourseSqlxRepositoryPort::list_applications(self, context, query).await
    }

    async fn retrieve_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<Option<CourseApplicationItem>> {
        let application = sqlx::query_as::<_, CourseApplicationItem>(
            r#"
            SELECT id, title, category_id as category_id, category_id as category, description, applicant_user_id,
                   application_status as status, contact_name, contact_email,
                   created_at as submitted_at, reviewed_at, review_note
            FROM course_application
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
            "#,
        )
        .bind(&application_id)
        .bind(&context.tenant_id)
        .fetch_optional(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        Ok(application)
    }

    async fn submit_application(
        &self,
        context: &CourseServiceContext,
        request: CourseApplicationCreateRequest,
    ) -> CourseResult<CourseApplicationItem> {
        CourseSqlxRepositoryPort::submit_application(self, context, request).await
    }

    async fn review_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
        request: CourseApplicationReviewRequest,
    ) -> CourseResult<CourseApplicationItem> {
        CourseSqlxRepositoryPort::review_application(self, context, application_id, request).await
    }

    async fn convert_to_course(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<CourseItem> {
        // Retrieve the application
        let application = self
            .retrieve_application(context, application_id.clone())
            .await?
            .ok_or_else(|| CourseError::not_found("Application not found"))?;

        // Create a new course from the application
        let now = chrono::Utc::now().to_rfc3339();
        let course_id = uuid::Uuid::new_v4().to_string();
        let course_uuid = uuid::Uuid::new_v4().to_string();
        let course_code = format!("CRS-{}", &course_id[..8]);

        sqlx::query(
            r#"
            INSERT INTO course_catalog (
                id, uuid, tenant_id, organization_id, course_code, title,
                category_id, publish_status, status, created_at, created_by,
                updated_at, updated_by, version
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', 'active', $8, $9, $10, $11, 0)
            "#,
        )
        .bind(&course_id)
        .bind(&course_uuid)
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(&course_code)
        .bind(&application.title)
        .bind(&application.category)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&now)
        .bind(&context.actor_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        // Update application status to converted
        sqlx::query(
            r#"
            UPDATE course_application
            SET application_status = 'converted', converted_course_id = $1,
                updated_at = $2, updated_by = $3
            WHERE id = $4 AND tenant_id = $5
            "#,
        )
        .bind(&course_id)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&application_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        // Fetch the created course
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
            "#,
        )
        .bind(&course_id)
        .bind(&context.tenant_id)
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        Ok(course)
    }
}

// ── Audit Log ───────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseAuditLogRepository for PostgresCourseRepository {
    async fn append_audit_log(
        &self,
        context: &CourseServiceContext,
        command: CourseAuditCommand,
    ) -> CourseResult<()> {
        CourseSqlxRepositoryPort::append_audit_log(self, context, command).await
    }

    async fn list_audit_logs(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseAuditLogItem>> {
        CourseSqlxRepositoryPort::list_audit_logs(self, context, query).await
    }

    async fn retrieve_audit_log(
        &self,
        context: &CourseServiceContext,
        audit_log_id: String,
    ) -> CourseResult<Option<CourseAuditLogItem>> {
        let audit_log = sqlx::query_as::<_, CourseAuditLogItem>(
            r#"
            SELECT id, uuid, tenant_id, organization_id, actor_type, actor_id,
                   operation_id, audit_event_type, target_type, target_id,
                   request_id, idempotency_key, before_snapshot_json, after_snapshot_json,
                   metadata_json, status, created_at
            FROM course_audit_log
            WHERE id = $1 AND tenant_id = $2
            "#,
        )
        .bind(&audit_log_id)
        .bind(&context.tenant_id)
        .fetch_optional(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        Ok(audit_log)
    }
}

// ── Resource ────────────────────────────────────────────────────────

#[async_trait::async_trait]
impl CourseResourceRepository for PostgresCourseRepository {
    async fn list_resources(
        &self,
        context: &CourseServiceContext,
        owner_type: String,
        owner_id: String,
    ) -> CourseResult<Vec<Value>> {
        let sql = r#"
            SELECT id, uuid, owner_type, owner_id, resource_role, drive_resource_id,
                   media_resource_snapshot, mime_type, duration_seconds::bigint as duration_seconds,
                   file_size_bytes::bigint as file_size_bytes,
                   sort_order, visibility, status, created_at
            FROM course_resource_ref
            WHERE owner_type = $1
              AND owner_id = $2
              AND tenant_id = $3
              AND status = 'active'
              AND deleted_at IS NULL
            ORDER BY sort_order ASC, created_at ASC
        "#;

        let resources = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(&owner_type)
            .bind(&owner_id)
            .bind(&context.tenant_id)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

        let result: Vec<Value> = resources
            .iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "uuid": row.get::<String, _>("uuid"),
                    "ownerType": row.get::<String, _>("owner_type"),
                    "ownerId": row.get::<String, _>("owner_id"),
                    "resourceRole": row.get::<String, _>("resource_role"),
                    "driveResourceId": row.get::<String, _>("drive_resource_id"),
                    "mediaResourceSnapshot": row.get::<String, _>("media_resource_snapshot"),
                    "mimeType": row.get::<Option<String>, _>("mime_type"),
                    "durationSeconds": row.get::<Option<i64>, _>("duration_seconds"),
                    "fileSizeBytes": row.get::<Option<i64>, _>("file_size_bytes"),
                    "sortOrder": row.get::<i32, _>("sort_order"),
                    "visibility": row.get::<String, _>("visibility"),
                    "status": row.get::<String, _>("status"),
                    "createdAt": row.get::<String, _>("created_at"),
                })
            })
            .collect();

        Ok(result)
    }

    async fn save_resource_ref(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        CourseSqlxRepositoryPort::save_resource_ref(self, context, command).await
    }

    async fn delete_resource_ref(
        &self,
        context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let result = sqlx::query(
            r#"
            UPDATE course_resource_ref
            SET status = 'deleted', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4
            WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&resource_ref_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        if result.rows_affected() == 0 {
            return Err(CourseError::not_found("Resource reference not found"));
        }

        Ok(())
    }
}

// ── Reaction ────────────────────────────────────────────────────────

/// Counts course discussions owned by the comments module.
///
/// The comments tables are optional from the course module's perspective:
/// standalone course deployments and older schemas do not have them. Their
/// absence must not fail the engagement endpoint, so a missing comments schema
/// yields zero discussions instead of a 500.
async fn course_discussion_count(
    pool: &PgPool,
    tenant_id: &str,
    course_id: &str,
) -> CourseResult<i64> {
    let available: bool = sqlx::query_scalar(
        "SELECT to_regclass('comments_thread') IS NOT NULL
            AND to_regclass('comments_comment') IS NOT NULL",
    )
    .fetch_one(pool)
    .await
    .map_err(sqlx_storage_error)?;
    if !available {
        return Ok(0);
    }

    // Comments tables use BIGINT tenant ids, while course tables use TEXT.
    // Bind a separate typed parameter instead of reusing the TEXT $1, which
    // would make PostgreSQL reject the mixed comparison at runtime.
    let Ok(tenant_id) = tenant_id.parse::<i64>() else {
        return Ok(0);
    };
    let count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM comments_comment cc
        JOIN comments_thread ct
          ON ct.id = cc.thread_id AND ct.tenant_id = cc.tenant_id
        WHERE ct.tenant_id = $1
          AND ct.owner_kind = 'course'
          AND ct.owner_id = $2
          AND cc.status = 'published'
          AND cc.deleted_at IS NULL
        "#,
    )
    .bind(tenant_id)
    .bind(course_id)
    .fetch_one(pool)
    .await
    .map_err(sqlx_storage_error)?;
    Ok(count)
}

#[async_trait::async_trait]
impl CourseReactionRepository for PostgresCourseRepository {
    async fn course_engagement(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Value> {
        let viewer_id = context.user_id.as_deref().unwrap_or("");
        let row = sqlx::query(
            r#"
            SELECT
              (SELECT COUNT(*) FROM course_reaction
                WHERE tenant_id = $1 AND target_type = 'course' AND target_id = $2
                  AND reaction_type = 'like' AND reaction_value = 'true'
                  AND status = 'active' AND deleted_at IS NULL) AS likes,
              (SELECT COUNT(*) FROM course_reaction
                WHERE tenant_id = $1 AND target_type = 'course' AND target_id = $2
                  AND reaction_type = 'favorite' AND reaction_value = 'true'
                  AND status = 'active' AND deleted_at IS NULL) AS favorites,
              (SELECT COUNT(*) FROM course_reaction
                WHERE tenant_id = $1 AND target_type = 'course' AND target_id = $2
                  AND reaction_type = 'share' AND reaction_value = 'true'
                  AND status = 'active' AND deleted_at IS NULL) AS shares,
              EXISTS (
                SELECT 1 FROM course_reaction
                WHERE tenant_id = $1 AND target_type = 'course' AND target_id = $2
                  AND actor_user_id = $3 AND reaction_type = 'like'
                  AND reaction_value = 'true' AND status = 'active' AND deleted_at IS NULL
              ) AS viewer_liked,
              EXISTS (
                SELECT 1 FROM course_reaction
                WHERE tenant_id = $1 AND target_type = 'course' AND target_id = $2
                  AND actor_user_id = $3 AND reaction_type = 'favorite'
                  AND reaction_value = 'true' AND status = 'active' AND deleted_at IS NULL
              ) AS viewer_favorited,
              EXISTS (
                SELECT 1 FROM course_reaction
                WHERE tenant_id = $1 AND target_type = 'course' AND target_id = $2
                  AND actor_user_id = $3 AND reaction_type = 'share'
                  AND reaction_value = 'true' AND status = 'active' AND deleted_at IS NULL
              ) AS viewer_shared
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&course_id)
        .bind(viewer_id)
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        let likes: i64 = row.try_get("likes").map_err(sqlx_storage_error)?;
        let favorites: i64 = row.try_get("favorites").map_err(sqlx_storage_error)?;
        let shares: i64 = row.try_get("shares").map_err(sqlx_storage_error)?;
        let discussions =
            match course_discussion_count(self.pool(), &context.tenant_id, &course_id).await {
                Ok(count) => count,
                Err(error) => {
                    // Discussions are auxiliary data owned by the comments
                    // module. A missing or incompatible comments schema must
                    // not turn the whole engagement endpoint into a 500.
                    tracing::warn!(
                        tenant_id = %context.tenant_id,
                        course_id = %course_id,
                        trace_id = ?context.trace_id,
                        error = %error,
                        "course engagement discussions unavailable; returning 0"
                    );
                    0
                }
            };
        let viewer_liked: bool = row.try_get("viewer_liked").map_err(sqlx_storage_error)?;
        let viewer_favorited: bool = row
            .try_get("viewer_favorited")
            .map_err(sqlx_storage_error)?;
        let viewer_shared: bool = row.try_get("viewer_shared").map_err(sqlx_storage_error)?;

        Ok(serde_json::json!({
            "courseId": course_id,
            "likes": likes,
            "favorites": favorites,
            "shares": shares,
            "discussions": discussions,
            "viewer": {
                "liked": viewer_liked,
                "favorited": viewer_favorited,
                "shared": viewer_shared,
            }
        }))
    }

    async fn list_reactions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        let limit = query.limit();
        let offset = query.offset();
        let status_filter = query.status.as_deref().unwrap_or("active");

        let sql = r#"
            SELECT id, uuid, target_type, target_id, actor_user_id,
                   reaction_type, reaction_value, status, created_at
            FROM course_reaction
            WHERE tenant_id = $1
              AND status = $2
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
        "#;

        let reactions = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(&context.tenant_id)
            .bind(status_filter)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

        let result: Vec<Value> = reactions
            .iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "uuid": row.get::<String, _>("uuid"),
                    "targetType": row.get::<String, _>("target_type"),
                    "targetId": row.get::<String, _>("target_id"),
                    "actorUserId": row.get::<String, _>("actor_user_id"),
                    "reactionType": row.get::<String, _>("reaction_type"),
                    "reactionValue": row.get::<String, _>("reaction_value"),
                    "status": row.get::<String, _>("status"),
                    "createdAt": row.get::<String, _>("created_at"),
                })
            })
            .collect();

        Ok(result)
    }

    async fn save_reaction(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        let uuid_val = uuid::Uuid::new_v4().to_string();

        let target_type = command
            .get("targetType")
            .and_then(|v| v.as_str())
            .unwrap_or("course");
        let target_id = command
            .get("targetId")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let reaction_type = command
            .get("reactionType")
            .and_then(|v| v.as_str())
            .unwrap_or("like");
        let reaction_value = command
            .get("reactionValue")
            .and_then(|v| v.as_str())
            .unwrap_or("true");

        // Check for existing reaction (upsert)
        let existing = sqlx::query_scalar::<_, String>(
            r#"
            SELECT id FROM course_reaction
            WHERE tenant_id = $1 AND target_type = $2 AND target_id = $3
              AND actor_user_id = $4 AND reaction_type = $5 AND status = 'active'
            "#,
        )
        .bind(&context.tenant_id)
        .bind(target_type)
        .bind(target_id)
        .bind(&context.user_id)
        .bind(reaction_type)
        .fetch_optional(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        if let Some(existing_id) = existing {
            // Update existing reaction
            sqlx::query(
                r#"
                UPDATE course_reaction
                SET reaction_value = $1, updated_at = $2, updated_by = $3, version = version + 1
                WHERE id = $4 AND tenant_id = $5
                "#,
            )
            .bind(reaction_value)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&existing_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            // Fetch updated reaction
            let reaction = sqlx::query(
                r#"
                SELECT id, uuid, target_type, target_id, actor_user_id,
                       reaction_type, reaction_value, status, created_at
                FROM course_reaction
                WHERE id = $1 AND tenant_id = $2
                "#,
            )
            .bind(&existing_id)
            .bind(&context.tenant_id)
            .fetch_one(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(serde_json::json!({
                "id": reaction.get::<String, _>("id"),
                "uuid": reaction.get::<String, _>("uuid"),
                "targetType": reaction.get::<String, _>("target_type"),
                "targetId": reaction.get::<String, _>("target_id"),
                "actorUserId": reaction.get::<String, _>("actor_user_id"),
                "reactionType": reaction.get::<String, _>("reaction_type"),
                "reactionValue": reaction.get::<String, _>("reaction_value"),
                "status": reaction.get::<String, _>("status"),
                "createdAt": reaction.get::<String, _>("created_at"),
            }))
        } else {
            // Insert new reaction
            sqlx::query(
                r#"
                INSERT INTO course_reaction (
                    id, uuid, tenant_id, organization_id, target_type, target_id,
                    actor_user_id, reaction_type, reaction_value, status,
                    created_at, created_by, updated_at, updated_by, version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, $13, 0)
                "#,
            )
            .bind(&id)
            .bind(&uuid_val)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(target_type)
            .bind(target_id)
            .bind(&context.user_id)
            .bind(reaction_type)
            .bind(reaction_value)
            .bind(&now)
            .bind(&context.actor_id)
            .bind(&now)
            .bind(&context.actor_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;

            Ok(serde_json::json!({
                "id": id,
                "uuid": uuid_val,
                "targetType": target_type,
                "targetId": target_id,
                "actorUserId": context.user_id,
                "reactionType": reaction_type,
                "reactionValue": reaction_value,
                "status": "active",
                "createdAt": now,
            }))
        }
    }

    async fn delete_reaction(
        &self,
        context: &CourseServiceContext,
        reaction_id: String,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let result = sqlx::query(
            r#"
            UPDATE course_reaction
            SET status = 'deleted', deleted_at = $1, deleted_by = $2, updated_at = $3, updated_by = $4
            WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&now)
        .bind(&context.actor_id)
        .bind(&reaction_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        if result.rows_affected() == 0 {
            return Err(CourseError::not_found("Reaction not found"));
        }

        Ok(())
    }
}
