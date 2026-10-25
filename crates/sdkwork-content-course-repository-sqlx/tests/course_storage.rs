use sdkwork_content_course_repository_sqlx::db::schema::COURSE_TABLES;
use sdkwork_content_course_repository_sqlx::{EmptyCourseRepository, PostgresCourseRepository};
use sqlx::PgPool;

fn optional_postgres_database_url() -> Option<String> {
    std::env::var("SDKWORK_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok()
        .filter(|url| url.starts_with("postgres://") || url.starts_with("postgresql://"))
}

#[test]
fn course_repository_schema_lists_the_professional_course_tables() {
    assert_eq!(COURSE_TABLES.len(), 21);
    assert!(COURSE_TABLES.contains(&"course_catalog"));
    assert!(COURSE_TABLES.contains(&"course_catalog_link"));
    assert!(COURSE_TABLES.contains(&"course_offering"));
    assert!(COURSE_TABLES.contains(&"course_live_session"));
    assert!(COURSE_TABLES.contains(&"course_learning_progress"));
    assert!(COURSE_TABLES.contains(&"course_lesson_progress"));
    assert!(COURSE_TABLES.contains(&"course_audit_log"));
    assert!(COURSE_TABLES.contains(&"course_question"));
    assert!(COURSE_TABLES.contains(&"course_question_paper"));
    assert!(COURSE_TABLES.contains(&"course_question_paper_item"));
    assert!(COURSE_TABLES.contains(&"course_question_handout"));
    assert!(COURSE_TABLES.contains(&"course_question_handout_item"));

    let repository = EmptyCourseRepository::new();
    assert_eq!(repository, EmptyCourseRepository);
}

#[tokio::test]
async fn course_repository_applies_the_database_baseline_schema() {
    let Some(database_url) = optional_postgres_database_url() else {
        eprintln!("skipping course storage test: set SDKWORK_DATABASE_URL or DATABASE_URL to a postgres URL");
        return;
    };
    let pool = PgPool::connect(&database_url)
        .await
        .expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());

    let table_names = COURSE_TABLES
        .iter()
        .map(|table_name| format!("'{table_name}'"))
        .collect::<Vec<_>>()
        .join(", ");
    // The baseline DDL creates tables without a schema qualifier, so they land
    // in the connection's search_path schema (e.g. `sdkwork_ai_dev`) rather
    // than `public`. Count in the session schema to stay environment-agnostic.
    let sql = format!(
        "SELECT COUNT(1) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ({table_names})"
    );
    let table_count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(sql))
        .fetch_one(&pool)
        .await
        .expect("course table count");

    assert_eq!(table_count, 21);
    assert_eq!(repository.table_names().len(), 21);
}
