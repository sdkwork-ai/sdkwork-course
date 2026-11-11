//! In-process purchase-to-enrollment grant (`MODULE_SPEC.md` §4.2).
//!
//! Verifies that the commerce-facing grant port shares the persisted enrollment
//! path with the course service: the purchase reference is the enrollment
//! idempotency key, so replaying a delivery returns the first enrollment —
//! sequentially and under concurrent delivery.

use sdkwork_content_course_repository_sqlx::PostgresCourseRepository;
use sdkwork_content_course_service::{
    CourseCatalogRepository, CourseEntitlementGrantRepository, CourseLessonKind,
    CourseMediaResourceRef, CourseOfferingCommand, CourseOfferingRepository, CourseOfferingType,
    CourseServiceContext, CourseStudioDraftCommand, CourseStudioLessonDraft,
    CourseStudioSectionDraft,
};
use sqlx::PgPool;

/// Concurrent deliveries of the same purchase reference in the replay test.
const CONCURRENT_DELIVERIES: usize = 8;

fn database_url() -> Option<String> {
    std::env::var("SDKWORK_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok()
        .filter(|url| url.starts_with("postgres://") || url.starts_with("postgresql://"))
}

fn unique_suffix(prefix: &str) -> String {
    let nanos = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
    format!("{prefix}-{nanos}")
}

fn context(user_id: &str) -> CourseServiceContext {
    CourseServiceContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        actor_id: Some(user_id.to_owned()),
        user_id: Some(user_id.to_owned()),
        request_id: Some("course-entitlement-grant-test".to_owned()),
        trace_id: None,
        permissions: vec!["course.*".to_owned()],
    }
}

fn draft(title: &str) -> CourseStudioDraftCommand {
    CourseStudioDraftCommand {
        course_id: None,
        title: title.to_owned(),
        subtitle: Some("entitlement grant test".to_owned()),
        summary: Some("Repository-level purchase projection verification.".to_owned()),
        description: Some("Verifies the in-process course entitlement grant.".to_owned()),
        category_id: Some("course-category-ai".to_owned()),
        level: Some("beginner".to_owned()),
        tags: vec!["test".to_owned()],
        kind: "standard".to_owned(),
        cover: Some(CourseMediaResourceRef {
            drive_resource_id: "drive-cover-entitlement-grant".to_owned(),
            role: "cover".to_owned(),
            mime_type: Some("image/png".to_owned()),
            duration_seconds: None,
            metadata: None,
        }),
        price_amount: None,
        original_price_amount: None,
        currency: None,
        is_free: false,
        author_display_name: Some("Integration Tester".to_owned()),
        sections: vec![CourseStudioSectionDraft {
            id: None,
            title: "Chapter one".to_owned(),
            description: None,
            sort_order: 0,
            lessons: vec![CourseStudioLessonDraft {
                id: None,
                lesson_kind: CourseLessonKind::Article,
                title: "Lesson one".to_owned(),
                summary: None,
                content: Some(
                    "This is a long enough article body for the entitlement grant test.".to_owned(),
                ),
                duration_seconds: 600,
                free_preview: false,
                external_source_id: None,
                source_provider: None,
                sort_order: 0,
                resources: vec![],
            }],
        }],
        collection_items: vec![],
    }
}

/// Creates a published, open, paid offering and returns `(course_id, offering_id)`.
async fn published_open_offering(
    repository: &PostgresCourseRepository,
    operator: &CourseServiceContext,
    title: &str,
) -> (String, String) {
    let course = repository
        .save_studio_course(operator, draft(title))
        .await
        .expect("save studio draft");
    let offering_id = repository
        .save_offering(
            operator,
            CourseOfferingCommand {
                offering_id: None,
                course_id: course.id.clone(),
                offering_type: CourseOfferingType::Vod,
                title: "Paid cohort".to_owned(),
                starts_at: None,
                ends_at: None,
                enrollment_starts_at: None,
                enrollment_ends_at: None,
                capacity_limit: Some(10),
                completion_rule: None,
            },
        )
        .await
        .expect("save offering");
    repository
        .transition_offering(operator, offering_id.clone(), "published".to_owned())
        .await
        .expect("publish offering");
    repository
        .transition_offering(operator, offering_id.clone(), "open".to_owned())
        .await
        .expect("open offering");
    (course.id, offering_id)
}

async fn enrollment_count(pool: &PgPool, offering_id: &str, learner_user_id: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM course_enrollment WHERE offering_id = $1 AND user_id = $2",
    )
    .bind(offering_id)
    .bind(learner_user_id)
    .fetch_one(pool)
    .await
    .expect("count enrollments")
}

#[tokio::test]
async fn purchase_grant_is_idempotent_on_the_replayed_purchase_reference() {
    let Some(database_url) = database_url() else {
        eprintln!(
            "skipping course entitlement grant test: set SDKWORK_DATABASE_URL or DATABASE_URL"
        );
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let operator = context("entitlement-grant-test-operator");
    let (course_id, offering_id) =
        published_open_offering(&repository, &operator, &unique_suffix("Entitlement grant")).await;

    let learner_user_id = unique_suffix("entitlement-grant-test-learner");
    let purchase_ref = format!("order-{course_id}");
    let first = repository
        .grant_entitlement_by_offering(
            offering_id.clone(),
            learner_user_id.clone(),
            purchase_ref.clone(),
        )
        .await
        .expect("first grant creates the enrollment");
    let replayed = repository
        .grant_entitlement_by_offering(offering_id.clone(), learner_user_id.clone(), purchase_ref)
        .await
        .expect("replayed grant returns the existing enrollment");
    assert_eq!(
        replayed, first,
        "a replayed purchase must not mint a second enrollment"
    );

    assert_eq!(
        enrollment_count(&pool, &offering_id, &learner_user_id).await,
        1
    );
}

/// The relay resolves a whole page of purchases with one tenant-scoped batch
/// lookup, so the lookup must answer for exactly the references that were
/// delivered and must never leak across tenants.
#[tokio::test]
async fn granted_purchase_refs_are_a_tenant_scoped_batch_lookup() {
    let Some(database_url) = database_url() else {
        eprintln!(
            "skipping course entitlement batch lookup test: set SDKWORK_DATABASE_URL or DATABASE_URL"
        );
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let operator = context("entitlement-batch-lookup-operator");
    let (course_id, offering_id) = published_open_offering(
        &repository,
        &operator,
        &unique_suffix("Entitlement batch lookup"),
    )
    .await;

    let learner_user_id = unique_suffix("entitlement-batch-lookup-learner");
    let purchase_ref = format!("order-{course_id}");
    repository
        .grant_entitlement_by_offering(
            offering_id.clone(),
            learner_user_id.clone(),
            purchase_ref.clone(),
        )
        .await
        .expect("grant creates the enrollment");

    let requested = vec![purchase_ref.clone(), "order-never-delivered".to_owned()];
    let granted = repository
        .list_granted_purchase_refs(&operator.tenant_id, &requested)
        .await
        .expect("batch lookup answers for the tenant");
    assert!(granted.contains(&purchase_ref));
    assert!(!granted.contains("order-never-delivered"));

    let other_tenant = repository
        .list_granted_purchase_refs("999999", &requested)
        .await
        .expect("batch lookup is tenant scoped");
    assert!(
        other_tenant.is_empty(),
        "a different tenant must not see the purchase: {other_tenant:?}"
    );
}

/// The enrollment insert is the idempotency key, so the second delivery of a
/// concurrent pair must read the winner's row instead of surfacing the unique
/// constraint violation as a storage error.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_replays_of_the_same_purchase_create_one_enrollment() {
    let Some(database_url) = database_url() else {
        eprintln!(
            "skipping concurrent course entitlement grant test: set SDKWORK_DATABASE_URL or DATABASE_URL"
        );
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let operator = context("entitlement-grant-race-operator");
    let (course_id, offering_id) = published_open_offering(
        &repository,
        &operator,
        &unique_suffix("Entitlement grant race"),
    )
    .await;

    let learner_user_id = unique_suffix("entitlement-grant-race-learner");
    let purchase_ref = format!("order-{course_id}");
    let barrier = std::sync::Arc::new(tokio::sync::Barrier::new(CONCURRENT_DELIVERIES));

    let mut deliveries = Vec::with_capacity(CONCURRENT_DELIVERIES);
    for _ in 0..CONCURRENT_DELIVERIES {
        let repository = repository.clone();
        let barrier = std::sync::Arc::clone(&barrier);
        let offering_id = offering_id.clone();
        let learner_user_id = learner_user_id.clone();
        let purchase_ref = purchase_ref.clone();
        deliveries.push(tokio::spawn(async move {
            barrier.wait().await;
            repository
                .grant_entitlement_by_offering(offering_id, learner_user_id, purchase_ref)
                .await
        }));
    }

    let mut enrollment_ids = Vec::with_capacity(CONCURRENT_DELIVERIES);
    for delivery in deliveries {
        let result = delivery
            .await
            .expect("concurrent grant task must not panic");
        enrollment_ids.push(
            result.expect("every concurrent replay must succeed with the existing enrollment"),
        );
    }

    let first = enrollment_ids
        .first()
        .expect("the replay test always collects an enrollment id")
        .clone();
    assert!(
        enrollment_ids.iter().all(|id| id == &first),
        "every concurrent replay must return the same enrollment: {enrollment_ids:?}"
    );
    assert_eq!(
        enrollment_count(&pool, &offering_id, &learner_user_id).await,
        1,
        "concurrent replays must persist exactly one enrollment"
    );
    let progress_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM course_learning_progress WHERE enrollment_id = $1",
    )
    .bind(&first)
    .fetch_one(&pool)
    .await
    .expect("count learning progress rows");
    assert_eq!(
        progress_count, 1,
        "only the winning delivery may initialize learning progress"
    );
}
