//! Read-only integration coverage for the course list lookup columns.
//!
//! `course_catalog` stores `category_id` and `primary_instructor_id`, but the
//! operator and learner surfaces render `CourseItem.category` / `CourseItem.instructor`
//! as display text. This test pins that contract: a listed course must expose the
//! category and instructor *names*, never the raw ids. It skips when no
//! PostgreSQL URL is configured.
use sdkwork_content_course_repository_sqlx::PostgresCourseRepository;
use sdkwork_content_course_service::{CourseCatalogRepository, CourseQuery, CourseServiceContext};
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
        actor_id: Some("course-lookup-test".to_owned()),
        user_id: Some("course-lookup-test".to_owned()),
        request_id: Some("course-lookup-test".to_owned()),
        trace_id: None,
        permissions: vec!["course.*".to_owned()],
        caller: sdkwork_content_course_service::CallerCredentials::default(),
    }
}

#[tokio::test]
async fn course_list_exposes_category_and_instructor_names() {
    let Some(database_url) = database_url() else {
        eprintln!("skipping course lookup test: set SDKWORK_DATABASE_URL or DATABASE_URL");
        return;
    };
    let pool = PgPool::connect(&database_url).await.expect("postgres pool");
    let repository = PostgresCourseRepository::new(pool.clone());
    let context = context();

    let page = repository
        .list_courses(
            &context,
            CourseQuery {
                page: Some(1),
                page_size: Some(20),
                ..CourseQuery::default()
            },
        )
        .await
        .expect("list courses");
    assert!(!page.items.is_empty(), "the fixture database has courses");

    let mut resolved_categories = 0;
    let mut resolved_instructors = 0;
    for course in &page.items {
        if let Some(category) = course.category.as_deref() {
            assert!(
                !category.starts_with("course-category-"),
                "category must be the display name, not the id ({})",
                course.id
            );
            resolved_categories += 1;
        }
        if let Some(instructor) = course.instructor.as_deref() {
            assert!(
                !instructor.starts_with("instructor-"),
                "instructor must be the display name, not the id ({})",
                course.id
            );
            resolved_instructors += 1;
        }
    }
    assert!(
        resolved_categories > 0 && resolved_instructors > 0,
        "the fixture courses carry both lookup names (categories={resolved_categories}, instructors={resolved_instructors})"
    );

    // The detail read shares the same projection, so it must agree with the list.
    let first = &page.items[0];
    let detail = repository
        .retrieve_course(&context, first.id.clone())
        .await
        .expect("retrieve course")
        .expect("course exists");
    assert_eq!(detail.category, first.category);
    assert_eq!(detail.instructor, first.instructor);
}
