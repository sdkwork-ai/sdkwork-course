//! Live-PostgreSQL regression suite for the question bank repository layer.
//!
//! Skips automatically when no database profile is resolvable (same convention
//! as `course_storage.rs`). Every row is written under an ephemeral tenant and
//! hard-deleted afterwards, so runs never touch tenant data.

use sdkwork_content_course_repository_sqlx::{
    connect_course_database_pool_from_env, PostgresCourseRepository,
};
use sdkwork_content_course_service::ports::repository::QuestionBankRepository;
use sdkwork_content_course_service::{CourseQuery, CourseServiceContext, QuestionQuery};
use uuid::Uuid;

async fn optional_pool() -> Option<sqlx::PgPool> {
    match connect_course_database_pool_from_env().await {
        Ok(pool) => Some(pool.as_postgres().expect("postgres pool").clone()),
        Err(error) => {
            eprintln!("skipping question bank storage test: no resolvable database profile ({error})");
            None
        }
    }
}

fn test_context(tenant_id: &str) -> CourseServiceContext {
    CourseServiceContext {
        tenant_id: tenant_id.to_string(),
        organization_id: "0".to_string(),
        actor_id: Some("it-runner".to_string()),
        user_id: Some("it-runner".to_string()),
        request_id: None,
        trace_id: None,
        permissions: Vec::new(),
    }
}

fn question_command(stem: &str, question_type: &str, difficulty: &str) -> serde_json::Value {
    serde_json::json!({
        "grade_level": "grade7",
        "subject": "math",
        "chapter": "第一章 有理数",
        "knowledge_points_json": "[\"有理数\"]",
        "question_type": question_type,
        "stem": stem,
        "options_json": if question_type == "single_choice" {
            serde_json::json!([{ "key": "A", "content": "1" }, { "key": "B", "content": "2" }]).to_string()
        } else {
            "[]".to_string()
        },
        "answer": "A",
        "analysis": "解析",
        "difficulty": difficulty,
        "default_score": "3",
        "source_type": "manual",
        "tags_json": "[\"回归\"]",
        "wrong_book": false,
        "status": "active",
    })
}

#[tokio::test]
async fn question_bank_repository_round_trip_on_postgres() {
    let Some(pool) = optional_pool().await else {
        return;
    };
    let repo = PostgresCourseRepository::new(pool.clone());
    let tenant = format!("qbank-it-{}", Uuid::new_v4().simple());
    let context = test_context(&tenant);

    // ── question insert: generated question_code, i64 decode of INTEGER cols ──
    let created = repo
        .save_question(&context, question_command("1 + 1 = ______", "fill_blank", "easy"))
        .await
        .expect("insert question");
    assert!(created.id.starts_with('q') || !created.id.is_empty());
    assert!(created.question_code.starts_with("q-"));
    assert_eq!(created.version, 0);
    assert!(!created.wrong_book);
    assert_eq!(created.knowledge_points, serde_json::json!(["有理数"]));

    let choice = repo
        .save_question(
            &context,
            question_command("1 + 1 = ?", "single_choice", "easy"),
        )
        .await
        .expect("insert choice question");

    // ── list + filters ──
    let page = repo
        .list_questions(
            &context,
            QuestionQuery {
                grade_level: Some("grade7".into()),
                subject: Some("math".into()),
                knowledge_point: Some("有理数".into()),
                ..QuestionQuery::default()
            },
        )
        .await
        .expect("list questions");
    assert!(page.total >= 2);
    assert!(page.items.iter().all(|item| item.grade_level == "grade7"));

    let search = repo
        .list_questions(
            &context,
            QuestionQuery {
                q: Some("1 + 1".into()),
                ..QuestionQuery::default()
            },
        )
        .await
        .expect("search questions");
    assert!(search.items.iter().any(|item| item.id == created.id));

    let wrong_only = repo
        .list_questions(
            &context,
            QuestionQuery {
                wrong_book: Some(true),
                ..QuestionQuery::default()
            },
        )
        .await
        .expect("wrong-book filter");
    assert!(wrong_only.items.is_empty());

    // ── update with an empty question_code must keep the existing code ──
    let mut update = question_command("1 + 2 = ______", "fill_blank", "easy");
    update["id"] = serde_json::Value::String(created.id.clone());
    update["question_code"] = serde_json::Value::String(String::new());
    let updated = repo.save_question(&context, update).await.expect("update question");
    assert_eq!(updated.question_code, created.question_code);
    assert_eq!(updated.stem, "1 + 2 = ______");
    assert_eq!(updated.version, 1);

    // ── compose candidate selection honours excludes and limit ──
    let candidates = repo
        .select_compose_candidates(
            &context,
            serde_json::json!({
                "grade_level": "grade7",
                "subject": "math",
                "question_type": "fill_blank",
                "difficulty": serde_json::Value::Null,
                "chapters": [],
                "knowledge_points": [],
                "exclude_ids": [created.id],
                "limit": 5,
            }),
        )
        .await
        .expect("compose candidates");
    assert!(candidates.iter().all(|item| item.id != created.id));

    // An empty exclusion list must still yield rows (NOT id = ANY(NULL) is
    // NULL, not true — the SQL carries an explicit empty-list guard).
    let unfiltered = repo
        .select_compose_candidates(
            &context,
            serde_json::json!({
                "grade_level": "grade7",
                "subject": "math",
                "question_type": "fill_blank",
                "difficulty": serde_json::Value::Null,
                "chapters": [],
                "knowledge_points": [],
                "exclude_ids": [],
                "limit": 5,
            }),
        )
        .await
        .expect("compose candidates without exclusions");
    assert!(unfiltered.iter().any(|item| item.id == created.id));

    // ── paper round trip: two sections, embedded question snapshots ──
    let paper_command = serde_json::json!({
        "paper": {
            "title": "回归测试卷",
            "grade_level": "grade7",
            "subject": "math",
            "paper_mode": "manual",
            "exam_duration_seconds": 5400i64,
            "total_score": "100",
            "scope_json": "{}",
            "score_allocation_json": "[]",
            "header_note": "注意审题",
            "sealed_line": true,
            "paper_status": "draft",
            "owner_user_id": "it-runner",
        },
        "items": [
            { "question_id": choice.id, "section_no": "1", "sort_order": 0, "score": "3" },
            { "question_id": created.id, "section_no": "2", "sort_order": 0, "score": "4" },
        ],
    });
    let paper = repo.save_paper(&context, paper_command).await.expect("save paper");
    assert_eq!(paper.get("examDurationSeconds").and_then(serde_json::Value::as_i64), Some(5400));
    assert_eq!(paper.get("questionCount").and_then(serde_json::Value::as_i64), Some(2));
    let items = paper
        .get("items")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].get("sectionNo").and_then(serde_json::Value::as_str), Some("1"));
    assert!(items[0]
        .get("question")
        .map(|question| !question.is_null())
        .unwrap_or(false));
    let paper_id = paper.get("id").and_then(serde_json::Value::as_str).unwrap().to_string();

    // ── reference guard: question is in a paper, deletion must count it ──
    let references = repo
        .question_references(&context, choice.id.clone())
        .await
        .expect("references");
    assert_eq!(references.get("paperCount").and_then(serde_json::Value::as_i64), Some(1));

    let archived = repo
        .archive_paper(&context, paper_id.clone())
        .await
        .expect("archive paper");
    assert_eq!(
        archived.get("paperStatus").and_then(serde_json::Value::as_str),
        Some("archived")
    );

    // ── handout round trip with an embedded question item ──
    let handout_command = serde_json::json!({
        "handout": {
            "title": "回归讲义",
            "grade_level": "grade7",
            "subject": "math",
            "lesson_tag": "第1课时",
            "body_json": serde_json::json!([
                { "type": "heading", "content": "例题" },
                { "type": "question", "questionId": created.id, "usageRole": "example" },
            ]).to_string(),
            "owner_user_id": "it-runner",
            "status": "active",
        },
        "items": [
            { "question_id": created.id, "sort_order": 1, "usage_role": "example" },
        ],
    });
    let handout = repo.save_handout(&context, handout_command).await.expect("save handout");
    let handout_id = handout
        .get("id")
        .and_then(serde_json::Value::as_str)
        .unwrap()
        .to_string();
    let handout_items = handout
        .get("items")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    assert_eq!(handout_items.len(), 1);
    assert_eq!(
        handout_items[0].get("usageRole").and_then(serde_json::Value::as_str),
        Some("example")
    );
    let references = repo
        .question_references(&context, created.id.clone())
        .await
        .expect("handout references");
    assert_eq!(references.get("handoutCount").and_then(serde_json::Value::as_i64), Some(1));

    // ── taxonomy aggregates from the seeded rows ──
    let taxonomy = repo
        .retrieve_taxonomy(&context, QuestionQuery::default())
        .await
        .expect("taxonomy");
    let grades = taxonomy
        .get("grades")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    assert!(grades
        .iter()
        .any(|entry| entry.get("value").and_then(serde_json::Value::as_str) == Some("grade7")));

    // ── papers/handouts listing pages decode INTEGER columns as i64 ──
    let papers = repo
        .list_papers(&context, CourseQuery::default())
        .await
        .expect("list papers");
    assert_eq!(papers.get("total").and_then(serde_json::Value::as_i64), Some(1));
    let handouts = repo
        .list_handouts(&context, CourseQuery::default())
        .await
        .expect("list handouts");
    assert_eq!(handouts.get("total").and_then(serde_json::Value::as_i64), Some(1));

    // ── deletion: blocked by nothing once references are gone, then cleanup ──
    repo.delete_handout(&context, handout_id).await.expect("delete handout");
    repo.delete_paper(&context, paper_id).await.expect("delete paper");
    let references = repo
        .question_references(&context, choice.id.clone())
        .await
        .expect("references after deletes");
    assert_eq!(references.get("paperCount").and_then(serde_json::Value::as_i64), Some(0));
    repo.delete_question(&context, choice.id).await.expect("delete question");

    cleanup_tenant(&pool, &tenant).await;
}

async fn cleanup_tenant(pool: &sqlx::PgPool, tenant: &str) {
    for table in [
        "course_question_handout_item",
        "course_question_handout",
        "course_question_paper_item",
        "course_question_paper",
        "course_question",
    ] {
        // Table names come from the fixed allowlist above; only the tenant
        // value is bound, and the assembled string is audited here.
        let sql = format!("DELETE FROM {table} WHERE tenant_id = $1");
        if let Err(error) = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(tenant)
            .execute(pool)
            .await
        {
            eprintln!("cleanup failed for {table}: {error}");
        }
    }
}

/// The demo seed (`021_question_bank.sql`) targets tenant `100001`; when it has
/// been applied, every seeded junior-high subject must be present. Skips
/// silently on databases where the demo seed was never applied.
#[tokio::test]
async fn question_bank_demo_seed_covers_every_junior_high_subject() {
    let Some(pool) = optional_pool().await else {
        return;
    };
    let repo = PostgresCourseRepository::new(pool.clone());
    let context = test_context("100001");
    let page = repo
        .list_questions(
            &context,
            QuestionQuery {
                page_size: Some(200),
                ..QuestionQuery::default()
            },
        )
        .await
        .expect("list seeded questions");
    if page.total == 0 {
        eprintln!("demo question bank seed not applied to this database; skipping");
        return;
    }
    let subjects: std::collections::BTreeSet<&str> =
        page.items.iter().map(|item| item.subject.as_str()).collect();
    for subject in ["math", "english", "history", "geography", "biology"] {
        assert!(
            subjects.contains(subject),
            "demo seed is missing subject {subject}"
        );
    }
    assert!(
        page.items.iter().any(|item| item.source_type == "real_exam"),
        "demo seed must include real-exam sourced questions"
    );
    assert!(
        page.items.iter().any(|item| item.wrong_book),
        "demo seed must include wrong-book entries"
    );
}
