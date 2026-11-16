//! Read-only integration coverage for the admin report-overview aggregates.
//!
//! The admin console renders six cards from `/backend/v3/api/course_reports/overview`.
//! Each card is a separate tenant-scoped aggregate, so this test pins the
//! repository half of that contract: the aggregates must agree with an
//! independent SQL query over the same scope. It never writes, and it skips
//! when no PostgreSQL URL is configured.
use sdkwork_content_course_repository_sqlx::PostgresCourseRepository;
use sdkwork_content_course_service::{
    CourseCatalogRepository, CourseEnrollmentRepository, CourseLiveSessionRepository,
    CourseProgressRepository, CourseServiceContext,
};
use sqlx::PgPool;

fn database_url() -> Option<String> {
    std::env::var("SDKWORK_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok()
        .filter(|url| url.starts_with("postgres://") || url.starts_with("postgresql://"))
}

fn context() -> CourseServiceContext {
    CourseServiceContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        actor_id: Some("reports-overview-test".to_owned()),
        user_id: Some("reports-overview-test".to_owned()),
        request_id: Some("reports-overview-test".to_owned()),
        trace_id: None,
        permissions: vec!["course.*".to_owned()],
    }
}

#[tokio::test]
async fn reports_overview_aggregates_match_their_tenant_scope() {
    let Some(database_url) = database_url() else {
        eprintln!("skipping reports overview test: set SDKWORK_DATABASE_URL or DATABASE_URL");
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let context = context();

    let course_count = repository
        .count_courses(&context, None)
        .await
        .expect("count courses");
    let published_course_count = repository
        .count_courses(&context, Some("published".to_owned()))
        .await
        .expect("count published courses");
    let enrollment_count = repository
        .count_enrollments(&context)
        .await
        .expect("count enrollments");
    let student_count = repository
        .count_students(&context)
        .await
        .expect("count students");
    let live_session_count = repository
        .count_live_sessions(&context)
        .await
        .expect("count live sessions");
    let completion_rate = repository
        .completion_rate(&context)
        .await
        .expect("completion rate");

    let scoped_courses: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM course_catalog
        WHERE tenant_id = $1
          AND (organization_id = $2 OR organization_id = '0')
          AND deleted_at IS NULL
        "#,
    )
    .bind(&context.tenant_id)
    .bind(&context.organization_id)
    .fetch_one(&pool)
    .await
    .expect("direct course count");
    let scoped_live_sessions: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM course_live_session
        WHERE tenant_id = $1
          AND (organization_id = $2 OR organization_id = '0')
          AND deleted_at IS NULL
        "#,
    )
    .bind(&context.tenant_id)
    .bind(&context.organization_id)
    .fetch_one(&pool)
    .await
    .expect("direct live-session count");

    assert_eq!(course_count, scoped_courses);
    assert!(
        published_course_count <= course_count,
        "published courses must be a subset of all courses"
    );
    assert_eq!(live_session_count, scoped_live_sessions);
    assert!(
        student_count <= enrollment_count,
        "distinct students cannot exceed enrollments"
    );
    assert!(
        (0.0..=1.0).contains(&completion_rate),
        "completion rate must stay a 0.0..=1.0 fraction, got {completion_rate}"
    );
}
