use sdkwork_content_course_repository_sqlx::PostgresCourseRepository;
use sdkwork_content_course_service::{
    CourseCatalogRepository, CourseEnrollmentRepository, CourseLessonKind, CourseMediaResourceRef,
    CourseReviewDecisionCommand, CourseServiceContext, CourseStudioDraftCommand,
    CourseStudioLessonDraft, CourseStudioSectionDraft,
};
use sqlx::PgPool;

fn database_url() -> Option<String> {
    std::env::var("SDKWORK_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok()
        .filter(|url| url.starts_with("postgres://") || url.starts_with("postgresql://"))
}

fn context(user_id: &str) -> CourseServiceContext {
    CourseServiceContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        actor_id: Some(user_id.to_owned()),
        user_id: Some(user_id.to_owned()),
        request_id: Some("studio-flow-test".to_owned()),
        trace_id: None,
        permissions: vec!["course.*".to_owned()],
    }
}

fn draft(title: &str) -> CourseStudioDraftCommand {
    CourseStudioDraftCommand {
        course_id: None,
        title: title.to_owned(),
        subtitle: Some("integration test".to_owned()),
        summary: Some(
            "A studio draft created by the repository integration test to verify the SQL flow."
                .to_owned(),
        ),
        description: Some("Repository-level UGC and review flow verification.".to_owned()),
        category_id: Some("course-category-ai".to_owned()),
        level: Some("beginner".to_owned()),
        tags: vec!["test".to_owned()],
        kind: "standard".to_owned(),
        cover: Some(CourseMediaResourceRef {
            drive_resource_id: "drive-cover-test".to_owned(),
            role: "cover".to_owned(),
            mime_type: Some("image/png".to_owned()),
            duration_seconds: None,
            metadata: None,
        }),
        price_amount: None,
        original_price_amount: None,
        currency: None,
        is_free: true,
        author_display_name: Some("Integration Tester".to_owned()),
        sections: vec![CourseStudioSectionDraft {
            id: None,
            title: "Chapter one".to_owned(),
            description: Some("First chapter".to_owned()),
            sort_order: 0,
            lessons: vec![CourseStudioLessonDraft {
                id: None,
                lesson_kind: CourseLessonKind::Article,
                title: "Lesson one".to_owned(),
                summary: Some("First lesson".to_owned()),
                content: Some(
                    "This is a long enough article body for the studio integration test."
                        .to_owned(),
                ),
                duration_seconds: 600,
                free_preview: true,
                external_source_id: None,
                source_provider: None,
                sort_order: 0,
                resources: vec![],
            }],
        }],
        collection_items: vec![],
    }
}

#[tokio::test]
async fn studio_authoring_submit_and_review_publish_flow() {
    let Some(database_url) = database_url() else {
        eprintln!("skipping studio flow test: set SDKWORK_DATABASE_URL or DATABASE_URL");
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let creator = context("studio-flow-test-creator");
    let title = format!(
        "Studio flow {}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    );

    let created = repository
        .save_studio_course(&creator, draft(&title))
        .await
        .expect("save studio draft");
    assert_eq!(created.kind, "standard");
    assert_eq!(created.publish_status, "draft");
    assert_eq!(created.lessons_count, 1);
    assert!(!repository
        .has_active_enrollment(
            &creator,
            created.id.clone(),
            "studio-flow-test-creator".to_owned()
        )
        .await
        .expect("enrollment check"));

    let detail = repository
        .retrieve_course_detail(&creator, created.id.clone())
        .await
        .expect("retrieve detail")
        .expect("detail exists");
    assert_eq!(detail.sections.len(), 1);
    assert_eq!(detail.lessons.len(), 1);
    assert_eq!(
        detail.course.author_user_id.as_deref(),
        Some("studio-flow-test-creator")
    );
    assert_eq!(
        detail.course.category_id.as_deref(),
        Some("course-category-ai")
    );

    let mut updated = draft(&title);
    updated.course_id = Some(created.id.clone());
    updated.title = format!("{title} updated");
    updated.cover = None;
    repository
        .save_studio_course(&creator, updated)
        .await
        .expect("update draft without a replacement cover");
    let after_update = repository
        .retrieve_course_detail(&creator, created.id.clone())
        .await
        .expect("retrieve updated detail")
        .expect("updated detail exists");
    assert_eq!(after_update.course.title, format!("{title} updated"));
    assert!(
        after_update
            .course
            .thumbnail
            .as_deref()
            .is_some_and(|value| value.starts_with('{')),
        "existing cover must survive a draft update that does not set a new cover"
    );

    let intruder = context("studio-flow-test-intruder");
    let mut hijack = draft(&title);
    hijack.course_id = Some(created.id.clone());
    hijack.title = "Hijacked title".to_owned();
    let ownership_error = repository
        .save_studio_course(&intruder, hijack)
        .await
        .expect_err("another creator must not edit the draft");
    assert_eq!(ownership_error.code(), "not_found");

    let submitted = repository
        .submit_course(&creator, created.id.clone())
        .await
        .expect("submit");
    assert_eq!(submitted.publish_status, "reviewing");
    assert_eq!(submitted.review_round, 1);

    let operator = context("studio-flow-test-operator");
    let published = repository
        .review_course(
            &operator,
            created.id.clone(),
            CourseReviewDecisionCommand {
                decision: "approve".to_owned(),
                note: Some("Looks good".to_owned()),
            },
        )
        .await
        .expect("approve");
    assert_eq!(published.publish_status, "published");

    let offering_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM course_offering WHERE course_id = $1 AND access_mode = 'free' AND deleted_at IS NULL",
    )
    .bind(&created.id)
    .fetch_one(&pool)
    .await
    .expect("offering count");
    assert_eq!(offering_count, 1);

    let stats = repository
        .review_stats(&operator)
        .await
        .expect("review stats");
    assert!(
        stats
            .get("published")
            .and_then(|value| value.as_i64())
            .unwrap_or(0)
            >= 1
    );

    // Cleanup: published content has an offering and an enrollment guard, so the
    // test removes the fixture directly.
    sqlx::query("DELETE FROM course_offering WHERE course_id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup offering");
    sqlx::query(
        "DELETE FROM course_resource_ref WHERE owner_id IN (SELECT id FROM course_lesson WHERE course_id = $1)",
    )
    .bind(&created.id)
    .execute(&pool)
    .await
    .expect("cleanup resources");
    sqlx::query("DELETE FROM course_lesson WHERE course_id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup lessons");
    sqlx::query("DELETE FROM course_section WHERE course_id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup sections");
    sqlx::query("DELETE FROM course_catalog WHERE id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup course");
}

#[tokio::test]
async fn collection_draft_links_published_courses() {
    let Some(database_url) = database_url() else {
        eprintln!("skipping collection flow test: set SDKWORK_DATABASE_URL or DATABASE_URL");
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let creator = context("studio-flow-test-curator");

    let published_course: Option<String> = sqlx::query_scalar(
        "SELECT id FROM course_catalog WHERE tenant_id = '100001' AND publish_status = 'published' AND deleted_at IS NULL LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .expect("published course");
    let Some(linked_course_id) = published_course else {
        eprintln!("skipping collection flow test: no published course in the database");
        return;
    };

    let title = format!(
        "Collection flow {}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    );
    let mut command = draft(&title);
    command.kind = "collection".to_owned();
    command.sections = vec![];
    command.collection_items = vec![linked_course_id.clone()];
    let created = repository
        .save_studio_course(&creator, command)
        .await
        .expect("save collection draft");
    assert_eq!(created.kind, "collection");
    assert_eq!(created.is_collection, true);

    let detail = repository
        .retrieve_course_detail(&creator, created.id.clone())
        .await
        .expect("retrieve collection")
        .expect("collection exists");
    assert_eq!(detail.collection_items.len(), 1);
    assert_eq!(detail.collection_items[0].course_id, linked_course_id);

    let items = repository
        .list_collection_items(&creator, created.id.clone())
        .await
        .expect("list collection items");
    assert_eq!(items.len(), 1);

    sqlx::query("DELETE FROM course_catalog_link WHERE course_id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup links");
    sqlx::query("DELETE FROM course_offering WHERE course_id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup offering");
    sqlx::query("DELETE FROM course_catalog WHERE id = $1")
        .bind(&created.id)
        .execute(&pool)
        .await
        .expect("cleanup collection");
}
