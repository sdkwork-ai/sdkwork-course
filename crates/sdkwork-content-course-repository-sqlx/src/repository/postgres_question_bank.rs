//! Postgres `QuestionBankRepository` implementation on `PostgresCourseRepository`.
//!
//! Hand-maintained (the sqlite adapter generator was retired). All composition
//! selection happens in SQL (`ORDER BY random()`), never as an in-memory
//! collect over the whole question table.

use serde_json::{json, Value};
use sqlx::{PgPool, Row};

use sdkwork_content_course_service::domain::models::{QuestionItem, QuestionPage, QuestionQuery};
use sdkwork_content_course_service::ports::repository::QuestionBankRepository;
use sdkwork_content_course_service::{
    CourseError, CourseQuery, CourseResult, CourseServiceContext,
};

use super::course_repository::PostgresCourseRepository;

fn sqlx_storage_error(error: sqlx::Error) -> CourseError {
    CourseError::storage(error.to_string())
}

/// Escapes SQL LIKE wildcards so a keyword like `100%` matches literally.
fn escape_like(input: &str) -> String {
    let mut escaped = input.replace('\\', "\\\\");
    escaped = escaped.replace('%', "\\%");
    escaped = escaped.replace('_', "\\_");
    escaped
}

fn parse_json_text(raw: Option<String>) -> Value {
    raw.and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .unwrap_or(Value::Array(Vec::new()))
}

fn question_from_row(row: &sqlx::postgres::PgRow) -> QuestionItem {
    QuestionItem {
        id: row.get::<String, _>("id"),
        question_code: row.get::<String, _>("question_code"),
        grade_level: row.get::<String, _>("grade_level"),
        subject: row.get::<String, _>("subject"),
        chapter: row.get::<Option<String>, _>("chapter"),
        knowledge_points: parse_json_text(row.get::<Option<String>, _>("knowledge_points_json")),
        question_type: row.get::<String, _>("question_type"),
        stem: row.get::<String, _>("stem"),
        options: parse_json_text(row.get::<Option<String>, _>("options_json")),
        answer: row.get::<String, _>("answer"),
        analysis: row.get::<Option<String>, _>("analysis"),
        difficulty: row.get::<String, _>("difficulty"),
        default_score: row.get::<String, _>("default_score"),
        source_type: row.get::<String, _>("source_type"),
        source_ref: row.get::<Option<String>, _>("source_ref"),
        tags: parse_json_text(row.get::<Option<String>, _>("tags_json")),
        wrong_book: row.get::<i64, _>("wrong_book") != 0,
        wrong_note: row.get::<Option<String>, _>("wrong_note"),
        owner_user_id: row.get::<Option<String>, _>("owner_user_id"),
        status: row.get::<String, _>("status"),
        created_at: row.get::<String, _>("created_at"),
        updated_at: row.get::<String, _>("updated_at"),
        version: row.get::<i64, _>("version"),
    }
}

/// Question list (binds $1..$14 filter, $15 limit, $16 offset).
pub(crate) const QUESTION_LIST_SQL: &str = "    SELECT id, question_code, grade_level, subject, chapter, knowledge_points_json, question_type, stem, options_json, answer, analysis, difficulty, default_score, source_type, source_ref, tags_json, wrong_book::bigint AS wrong_book, wrong_note, owner_user_id, status, created_at, updated_at, version::bigint AS version FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND ($5::text IS NULL OR chapter = $5) AND ($6::text IS NULL OR knowledge_points_json::jsonb ? $6) AND ($7::text IS NULL OR question_type = $7) AND ($8::text IS NULL OR difficulty = $8) AND ($9::text IS NULL OR tags_json::jsonb ? $9) AND ($10::text IS NULL OR source_type = $10) AND ($11::boolean IS NULL OR wrong_book = CASE WHEN $11 THEN 1 ELSE 0 END) AND ($12::text IS NULL OR status = $12) AND ($13::text IS NULL OR owner_user_id = $13) AND ($14::text IS NULL OR stem LIKE '%' || $14 || '%' ESCAPE '\' OR answer LIKE '%' || $14 || '%' ESCAPE '\' OR analysis LIKE '%' || $14 || '%' ESCAPE '\' OR question_code LIKE '%' || $14 || '%' ESCAPE '\') AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC LIMIT $15 OFFSET $16";

/// Random candidate selection for smart composition.
pub(crate) const QUESTION_LIST_RANDOM_SQL: &str = "    SELECT id, question_code, grade_level, subject, chapter, knowledge_points_json, question_type, stem, options_json, answer, analysis, difficulty, default_score, source_type, source_ref, tags_json, wrong_book::bigint AS wrong_book, wrong_note, owner_user_id, status, created_at, updated_at, version::bigint AS version FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND ($5::text IS NULL OR chapter = $5) AND ($6::text IS NULL OR knowledge_points_json::jsonb ? $6) AND ($7::text IS NULL OR question_type = $7) AND ($8::text IS NULL OR difficulty = $8) AND ($9::text IS NULL OR tags_json::jsonb ? $9) AND ($10::text IS NULL OR source_type = $10) AND ($11::boolean IS NULL OR wrong_book = CASE WHEN $11 THEN 1 ELSE 0 END) AND ($12::text IS NULL OR status = $12) AND ($13::text IS NULL OR owner_user_id = $13) AND ($14::text IS NULL OR stem LIKE '%' || $14 || '%' ESCAPE '\' OR answer LIKE '%' || $14 || '%' ESCAPE '\' OR analysis LIKE '%' || $14 || '%' ESCAPE '\' OR question_code LIKE '%' || $14 || '%' ESCAPE '\') AND deleted_at IS NULL ORDER BY random() LIMIT $15 OFFSET $16";

/// Question by id (binds id, tenant).
pub(crate) const QUESTION_BY_ID_SQL: &str = "SELECT id, question_code, grade_level, subject, chapter, knowledge_points_json, question_type, stem, options_json, answer, analysis, difficulty, default_score, source_type, source_ref, tags_json, wrong_book::bigint AS wrong_book, wrong_note, owner_user_id, status, created_at, updated_at, version::bigint AS version FROM course_question WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL";

/// Compose candidate selection (binds tenant, org, grade, subject, type, difficulty, chapters[], knowledge points[], exclude ids[], limit).
pub(crate) const QUESTION_COMPOSE_SQL: &str = "SELECT id, question_code, grade_level, subject, chapter, knowledge_points_json, question_type, stem, options_json, answer, analysis, difficulty, default_score, source_type, source_ref, tags_json, wrong_book::bigint AS wrong_book, wrong_note, owner_user_id, status, created_at, updated_at, version::bigint AS version FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND grade_level = $3 AND subject = $4 AND question_type = $5 AND ($6::text IS NULL OR difficulty = $6) AND ($7::text[] IS NULL OR cardinality($7) = 0 OR chapter = ANY($7)) AND ($8::text[] IS NULL OR cardinality($8) = 0 OR knowledge_points_json::jsonb ?| $8) AND ($9::text[] IS NULL OR cardinality($9) = 0 OR NOT (id = ANY($9))) AND status = 'active' AND deleted_at IS NULL ORDER BY random() LIMIT $10";

/// Distinct grade levels with counts.
pub(crate) const TAXONOMY_GRADES_SQL: &str = "SELECT grade_level AS value, COUNT(*)::bigint AS count FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND deleted_at IS NULL GROUP BY grade_level ORDER BY count DESC, value ASC";

/// Distinct subjects with counts.
pub(crate) const TAXONOMY_SUBJECTS_SQL: &str = "SELECT subject AS value, COUNT(*)::bigint AS count FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND deleted_at IS NULL GROUP BY subject ORDER BY count DESC, value ASC";

/// Distinct question types with counts.
pub(crate) const TAXONOMY_QUESTION_TYPES_SQL: &str = "SELECT question_type AS value, COUNT(*)::bigint AS count FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND deleted_at IS NULL GROUP BY question_type ORDER BY count DESC, value ASC";

/// Distinct difficulties with counts.
pub(crate) const TAXONOMY_DIFFICULTIES_SQL: &str = "SELECT difficulty AS value, COUNT(*)::bigint AS count FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND deleted_at IS NULL GROUP BY difficulty ORDER BY count DESC, value ASC";

/// Distinct chapters per subject with counts.
pub(crate) const TAXONOMY_CHAPTERS_SQL: &str = "SELECT chapter AS value, subject, COUNT(*)::bigint AS count FROM course_question WHERE tenant_id = $1 AND (organization_id = $2 OR organization_id = '0') AND ($3::text IS NULL OR grade_level = $3) AND ($4::text IS NULL OR subject = $4) AND deleted_at IS NULL AND chapter IS NOT NULL AND chapter <> '' GROUP BY chapter, subject ORDER BY count DESC, value ASC LIMIT 200";

/// Distinct knowledge points with counts.
pub(crate) const TAXONOMY_KNOWLEDGE_POINTS_SQL: &str = "SELECT entry.value AS value, COUNT(*)::bigint AS count FROM course_question q, jsonb_array_elements_text(q.knowledge_points_json::jsonb) AS entry(value) WHERE q.tenant_id = $1 AND (q.organization_id = $2 OR q.organization_id = '0') AND ($3::text IS NULL OR q.grade_level = $3) AND ($4::text IS NULL OR q.subject = $4) AND q.deleted_at IS NULL GROUP BY entry.value ORDER BY count DESC, value ASC LIMIT 200";

/// Distinct tags with counts.
pub(crate) const TAXONOMY_TAGS_SQL: &str = "SELECT entry.value AS value, COUNT(*)::bigint AS count FROM course_question q, jsonb_array_elements_text(q.tags_json::jsonb) AS entry(value) WHERE q.tenant_id = $1 AND (q.organization_id = $2 OR q.organization_id = '0') AND ($3::text IS NULL OR q.grade_level = $3) AND ($4::text IS NULL OR q.subject = $4) AND q.deleted_at IS NULL GROUP BY entry.value ORDER BY count DESC, value ASC LIMIT 200";

struct QuestionFilter {
    grade_level: Option<String>,
    subject: Option<String>,
    chapter: Option<String>,
    knowledge_point: Option<String>,
    question_type: Option<String>,
    difficulty: Option<String>,
    tag: Option<String>,
    source_type: Option<String>,
    wrong_book: Option<bool>,
    status: Option<String>,
    owner_user_id: Option<String>,
    q: Option<String>,
}

fn question_filter(query: &QuestionQuery) -> QuestionFilter {
    QuestionFilter {
        grade_level: query.grade_level.clone().filter(|v| !v.is_empty()),
        subject: query.subject.clone().filter(|v| !v.is_empty()),
        chapter: query.chapter.clone().filter(|v| !v.is_empty()),
        knowledge_point: query.knowledge_point.clone().filter(|v| !v.is_empty()),
        question_type: query.question_type.clone().filter(|v| !v.is_empty()),
        difficulty: query.difficulty.clone().filter(|v| !v.is_empty()),
        tag: query.tag.clone().filter(|v| !v.is_empty()),
        source_type: query.source_type.clone().filter(|v| !v.is_empty()),
        wrong_book: query.wrong_book,
        status: query.status.clone().filter(|v| !v.is_empty()),
        owner_user_id: query.owner_user_id.clone().filter(|v| !v.is_empty()),
        q: query
            .q
            .clone()
            .filter(|v| !v.is_empty())
            .map(|value| escape_like(&value)),
    }
}

async fn fetch_question_rows(
    pool: &PgPool,
    context: &CourseServiceContext,
    filter: &QuestionFilter,
    limit: Option<i64>,
    offset: i64,
    random_order: bool,
) -> CourseResult<Vec<sqlx::postgres::PgRow>> {
    let sql = if random_order {
        QUESTION_LIST_RANDOM_SQL
    } else {
        QUESTION_LIST_SQL
    };
    let rows = sqlx::query(sql)
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(filter.grade_level.clone())
        .bind(filter.subject.clone())
        .bind(filter.chapter.clone())
        .bind(filter.knowledge_point.clone())
        .bind(filter.question_type.clone())
        .bind(filter.difficulty.clone())
        .bind(filter.tag.clone())
        .bind(filter.source_type.clone())
        .bind(filter.wrong_book)
        .bind(filter.status.clone())
        .bind(filter.owner_user_id.clone())
        .bind(filter.q.clone())
        .bind(limit.unwrap_or(2_000i64).min(2_000))
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(sqlx_storage_error)?;
    Ok(rows)
}

async fn count_question_rows(
    pool: &PgPool,
    context: &CourseServiceContext,
    filter: &QuestionFilter,
) -> CourseResult<i64> {
    let sql = r#"
        SELECT COUNT(*)::bigint
        FROM course_question
        WHERE tenant_id = $1
          AND (organization_id = $2 OR organization_id = '0')
          AND ($3::text IS NULL OR grade_level = $3)
          AND ($4::text IS NULL OR subject = $4)
          AND ($5::text IS NULL OR chapter = $5)
          AND ($6::text IS NULL OR knowledge_points_json::jsonb ? $6)
          AND ($7::text IS NULL OR question_type = $7)
          AND ($8::text IS NULL OR difficulty = $8)
          AND ($9::text IS NULL OR tags_json::jsonb ? $9)
          AND ($10::text IS NULL OR source_type = $10)
          AND ($11::boolean IS NULL OR wrong_book = CASE WHEN $11 THEN 1 ELSE 0 END)
          AND ($12::text IS NULL OR status = $12)
          AND ($13::text IS NULL OR owner_user_id = $13)
          AND ($14::text IS NULL OR stem LIKE '%' || $14 || '%' OR answer LIKE '%' || $14 || '%'
               OR analysis LIKE '%' || $14 || '%' OR question_code LIKE '%' || $14 || '%')
          AND deleted_at IS NULL
        "#;
    let total: i64 = sqlx::query_scalar(sql)
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(filter.grade_level.clone())
        .bind(filter.subject.clone())
        .bind(filter.chapter.clone())
        .bind(filter.knowledge_point.clone())
        .bind(filter.question_type.clone())
        .bind(filter.difficulty.clone())
        .bind(filter.tag.clone())
        .bind(filter.source_type.clone())
        .bind(filter.wrong_book)
        .bind(filter.status.clone())
        .bind(filter.owner_user_id.clone())
        .bind(filter.q.clone())
        .fetch_one(pool)
        .await
        .map_err(sqlx_storage_error)?;
    Ok(total)
}

async fn load_question_row(
    pool: &PgPool,
    context: &CourseServiceContext,
    question_id: &str,
) -> CourseResult<Option<sqlx::postgres::PgRow>> {
    let row = sqlx::query(QUESTION_BY_ID_SQL)
        .bind(question_id)
        .bind(&context.tenant_id)
        .fetch_optional(pool)
        .await
        .map_err(sqlx_storage_error)?;
    Ok(row)
}

/// Inserts or updates a question row from a snake_case command and returns it.
async fn write_question(
    pool: &PgPool,
    context: &CourseServiceContext,
    command: &Value,
) -> CourseResult<QuestionItem> {
    let now = chrono::Utc::now().to_rfc3339();
    let existing_id = command.get("id").and_then(Value::as_str).map(str::to_owned);

    if let Some(question_id) = &existing_id {
        let existing = load_question_row(pool, context, question_id)
            .await?
            .ok_or_else(|| CourseError::not_found("Question not found"))?;
        let version: i64 = existing.get("version");
        let result = sqlx::query(
            r#"
            UPDATE course_question
            SET question_code = CASE WHEN $1 = '' THEN question_code ELSE $1 END,
                grade_level = $2, subject = $3, chapter = $4,
                knowledge_points_json = $5, question_type = $6, stem = $7, options_json = $8,
                answer = $9, analysis = $10, difficulty = $11, default_score = $12,
                source_type = $13, source_ref = $14, tags_json = $15, wrong_book = $16,
                wrong_note = $17, status = $18, updated_at = $19, updated_by = $20,
                version = version + 1
            WHERE id = $21 AND tenant_id = $22 AND version = $23 AND deleted_at IS NULL
            "#,
        )
        .bind(
            command
                .get("question_code")
                .and_then(Value::as_str)
                .unwrap_or(""),
        )
        .bind(
            command
                .get("grade_level")
                .and_then(Value::as_str)
                .unwrap_or(""),
        )
        .bind(command.get("subject").and_then(Value::as_str).unwrap_or(""))
        .bind(command.get("chapter").and_then(Value::as_str))
        .bind(
            command
                .get("knowledge_points_json")
                .and_then(Value::as_str)
                .unwrap_or("[]"),
        )
        .bind(
            command
                .get("question_type")
                .and_then(Value::as_str)
                .unwrap_or(""),
        )
        .bind(command.get("stem").and_then(Value::as_str).unwrap_or(""))
        .bind(
            command
                .get("options_json")
                .and_then(Value::as_str)
                .unwrap_or("[]"),
        )
        .bind(command.get("answer").and_then(Value::as_str).unwrap_or(""))
        .bind(command.get("analysis").and_then(Value::as_str))
        .bind(
            command
                .get("difficulty")
                .and_then(Value::as_str)
                .unwrap_or("medium"),
        )
        .bind(
            command
                .get("default_score")
                .and_then(Value::as_str)
                .unwrap_or("0"),
        )
        .bind(
            command
                .get("source_type")
                .and_then(Value::as_str)
                .unwrap_or("manual"),
        )
        .bind(command.get("source_ref").and_then(Value::as_str))
        .bind(
            command
                .get("tags_json")
                .and_then(Value::as_str)
                .unwrap_or("[]"),
        )
        .bind(i64::from(
            command
                .get("wrong_book")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        ))
        .bind(command.get("wrong_note").and_then(Value::as_str))
        .bind(
            command
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("active"),
        )
        .bind(&now)
        .bind(context.actor_id.clone())
        .bind(question_id)
        .bind(&context.tenant_id)
        .bind(version)
        .execute(pool)
        .await
        .map_err(sqlx_storage_error)?;
        if result.rows_affected() == 0 {
            return Err(CourseError::invalid(
                "Question not found or version conflict",
            ));
        }
        let row = load_question_row(pool, context, question_id)
            .await?
            .ok_or_else(|| CourseError::not_found("Question not found"))?;
        return Ok(question_from_row(&row));
    }

    let question_id = uuid::Uuid::new_v4().to_string();
    let mut question_code = command
        .get("question_code")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if question_code.is_empty() {
        question_code = format!("q-{}", uuid::Uuid::new_v4().simple());
    }
    sqlx::query(
        r#"
        INSERT INTO course_question (
            id, uuid, tenant_id, organization_id, question_code, grade_level, subject, chapter,
            knowledge_points_json, question_type, stem, options_json, answer, analysis,
            difficulty, default_score, source_type, source_ref, tags_json, wrong_book,
            wrong_note, owner_user_id, status, created_at, created_by, updated_at, updated_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )
        "#,
    )
    .bind(&question_id)
    .bind(&question_id)
    .bind(&context.tenant_id)
    .bind(&context.organization_id)
    .bind(&question_code)
    .bind(
        command
            .get("grade_level")
            .and_then(Value::as_str)
            .unwrap_or(""),
    )
    .bind(command.get("subject").and_then(Value::as_str).unwrap_or(""))
    .bind(command.get("chapter").and_then(Value::as_str))
    .bind(
        command
            .get("knowledge_points_json")
            .and_then(Value::as_str)
            .unwrap_or("[]"),
    )
    .bind(
        command
            .get("question_type")
            .and_then(Value::as_str)
            .unwrap_or(""),
    )
    .bind(command.get("stem").and_then(Value::as_str).unwrap_or(""))
    .bind(
        command
            .get("options_json")
            .and_then(Value::as_str)
            .unwrap_or("[]"),
    )
    .bind(command.get("answer").and_then(Value::as_str).unwrap_or(""))
    .bind(command.get("analysis").and_then(Value::as_str))
    .bind(
        command
            .get("difficulty")
            .and_then(Value::as_str)
            .unwrap_or("medium"),
    )
    .bind(
        command
            .get("default_score")
            .and_then(Value::as_str)
            .unwrap_or("0"),
    )
    .bind(
        command
            .get("source_type")
            .and_then(Value::as_str)
            .unwrap_or("manual"),
    )
    .bind(command.get("source_ref").and_then(Value::as_str))
    .bind(
        command
            .get("tags_json")
            .and_then(Value::as_str)
            .unwrap_or("[]"),
    )
    .bind(i64::from(
        command
            .get("wrong_book")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    ))
    .bind(command.get("wrong_note").and_then(Value::as_str))
    .bind(command.get("owner_user_id").and_then(Value::as_str))
    .bind(
        command
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("active"),
    )
    .bind(&now)
    .bind(context.actor_id.clone())
    .bind(&now)
    .bind(context.actor_id.clone())
    .execute(pool)
    .await
    .map_err(sqlx_storage_error)?;

    let row = load_question_row(pool, context, &question_id)
        .await?
        .ok_or_else(|| CourseError::storage("inserted question row is missing"))?;
    Ok(question_from_row(&row))
}

fn paper_row_to_value(row: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": row.get::<String, _>("id"),
        "paperCode": row.get::<String, _>("paper_code"),
        "title": row.get::<String, _>("title"),
        "gradeLevel": row.get::<String, _>("grade_level"),
        "subject": row.get::<String, _>("subject"),
        "paperMode": row.get::<String, _>("paper_mode"),
        "examDurationSeconds": row.get::<i64, _>("exam_duration_seconds"),
        "totalScore": row.get::<String, _>("total_score"),
        "scope": parse_json_text(row.get::<Option<String>, _>("scope_json")),
        "scoreAllocation": parse_json_text(row.get::<Option<String>, _>("score_allocation_json")),
        "headerNote": row.get::<Option<String>, _>("header_note"),
        "sealedLine": row.get::<i64, _>("sealed_line") != 0,
        "paperStatus": row.get::<String, _>("paper_status"),
        "archivedAt": row.get::<Option<String>, _>("archived_at"),
        "ownerUserId": row.get::<Option<String>, _>("owner_user_id"),
        "questionCount": row.get::<i64, _>("question_count_snapshot"),
        "status": row.get::<String, _>("status"),
        "createdAt": row.get::<String, _>("created_at"),
        "updatedAt": row.get::<String, _>("updated_at"),
        "version": row.get::<i64, _>("version"),
    })
}

fn handout_row_to_value(row: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": row.get::<String, _>("id"),
        "handoutCode": row.get::<String, _>("handout_code"),
        "title": row.get::<String, _>("title"),
        "gradeLevel": row.get::<String, _>("grade_level"),
        "subject": row.get::<String, _>("subject"),
        "lessonTag": row.get::<Option<String>, _>("lesson_tag"),
        "body": parse_json_text(row.get::<Option<String>, _>("body_json")),
        "ownerUserId": row.get::<Option<String>, _>("owner_user_id"),
        "status": row.get::<String, _>("status"),
        "createdAt": row.get::<String, _>("created_at"),
        "updatedAt": row.get::<String, _>("updated_at"),
        "version": row.get::<i64, _>("version"),
    })
}

async fn load_paper_row(
    pool: &PgPool,
    context: &CourseServiceContext,
    paper_id: &str,
) -> CourseResult<Option<sqlx::postgres::PgRow>> {
    let row = sqlx::query(
        r#"
        SELECT id, paper_code, title, grade_level, subject, paper_mode,
               exam_duration_seconds::bigint AS exam_duration_seconds,
               total_score, scope_json, score_allocation_json, header_note,
               sealed_line::bigint AS sealed_line,
               paper_status, archived_at, owner_user_id,
               question_count_snapshot::bigint AS question_count_snapshot, status,
               created_at, updated_at, version::bigint AS version
        FROM course_question_paper
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(paper_id)
    .bind(&context.tenant_id)
    .fetch_optional(pool)
    .await
    .map_err(sqlx_storage_error)?;
    Ok(row)
}

async fn load_handout_row(
    pool: &PgPool,
    context: &CourseServiceContext,
    handout_id: &str,
) -> CourseResult<Option<sqlx::postgres::PgRow>> {
    let row = sqlx::query(
        r#"
        SELECT id, handout_code, title, grade_level, subject, lesson_tag, body_json,
               owner_user_id, status, created_at, updated_at, version::bigint AS version
        FROM course_question_handout
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(handout_id)
    .bind(&context.tenant_id)
    .fetch_optional(pool)
    .await
    .map_err(sqlx_storage_error)?;
    Ok(row)
}

/// Paper detail: paper fields plus ordered items with question snapshots.
async fn paper_with_items(
    pool: &PgPool,
    context: &CourseServiceContext,
    paper_row: sqlx::postgres::PgRow,
) -> CourseResult<Value> {
    let paper_id: String = paper_row.get("id");
    let mut paper = paper_row_to_value(&paper_row);
    let rows = sqlx::query(
        r#"
        SELECT i.question_id, i.section_no, i.sort_order::bigint AS sort_order, i.score,
               q.question_code, q.grade_level AS q_grade, q.subject AS q_subject, q.chapter AS q_chapter,
               q.knowledge_points_json AS q_knowledge, q.question_type, q.stem, q.options_json AS q_options,
               q.answer AS q_answer, q.analysis AS q_analysis, q.difficulty AS q_difficulty,
               q.default_score AS q_default_score, q.source_type AS q_source_type,
               q.tags_json AS q_tags, q.wrong_book::bigint AS q_wrong_book, q.status AS q_status
        FROM course_question_paper_item i
        LEFT JOIN course_question q
               ON q.id = i.question_id AND q.tenant_id = i.tenant_id AND q.deleted_at IS NULL
        WHERE i.paper_id = $1 AND i.tenant_id = $2
        ORDER BY (NULLIF(regexp_replace(i.section_no, '\D', '', 'g'), '')::int) ASC NULLS LAST,
                 i.section_no ASC, i.sort_order ASC
        "#,
    )
    .bind(&paper_id)
    .bind(&context.tenant_id)
    .fetch_all(pool)
    .await
    .map_err(sqlx_storage_error)?;

    let items: Vec<Value> = rows
        .iter()
        .map(|row| {
            let question_id: String = row.get("question_id");
            let question_present: Option<String> = row.get("question_type");
            let question = if question_present.is_some() {
                json!({
                    "id": question_id,
                    "questionCode": row.get::<Option<String>, _>("question_code"),
                    "gradeLevel": row.get::<Option<String>, _>("q_grade"),
                    "subject": row.get::<Option<String>, _>("q_subject"),
                    "chapter": row.get::<Option<String>, _>("q_chapter"),
                    "knowledgePoints": parse_json_text(row.get::<Option<String>, _>("q_knowledge")),
                    "questionType": row.get::<Option<String>, _>("question_type"),
                    "stem": row.get::<Option<String>, _>("stem"),
                    "options": parse_json_text(row.get::<Option<String>, _>("q_options")),
                    "answer": row.get::<Option<String>, _>("q_answer"),
                    "analysis": row.get::<Option<String>, _>("q_analysis"),
                    "difficulty": row.get::<Option<String>, _>("q_difficulty"),
                    "defaultScore": row.get::<Option<String>, _>("q_default_score"),
                    "sourceType": row.get::<Option<String>, _>("q_source_type"),
                    "tags": parse_json_text(row.get::<Option<String>, _>("q_tags")),
                    "wrongBook": row.get::<Option<i64>, _>("q_wrong_book").unwrap_or(0) != 0,
                    "status": row.get::<Option<String>, _>("q_status"),
                })
            } else {
                Value::Null
            };
            json!({
                "questionId": question_id,
                "sectionNo": row.get::<String, _>("section_no"),
                "sortOrder": row.get::<i64, _>("sort_order"),
                "score": row.get::<String, _>("score"),
                "question": question,
            })
        })
        .collect();

    if let Some(object) = paper.as_object_mut() {
        object.insert("items".to_string(), Value::Array(items));
    }
    Ok(paper)
}

#[async_trait::async_trait]
impl QuestionBankRepository for PostgresCourseRepository {
    async fn list_questions(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<QuestionPage> {
        let filter = question_filter(&query);
        let total = count_question_rows(self.pool(), context, &filter).await?;
        let rows = fetch_question_rows(
            self.pool(),
            context,
            &filter,
            Some(query.limit()),
            query.offset(),
            false,
        )
        .await?;
        let items = rows.iter().map(question_from_row).collect();
        Ok(QuestionPage {
            items,
            page: query.page.unwrap_or(1).max(1),
            page_size: query.limit(),
            total,
        })
    }

    async fn retrieve_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<Option<QuestionItem>> {
        let row = load_question_row(self.pool(), context, &question_id).await?;
        Ok(row.as_ref().map(question_from_row))
    }

    async fn save_question(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<QuestionItem> {
        write_question(self.pool(), context, &command).await
    }

    async fn delete_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE course_question
            SET deleted_at = $1, deleted_by = $2, status = 'deleted', updated_at = $1
            WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(context.actor_id.clone())
        .bind(&question_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        Ok(())
    }

    async fn question_references(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<Value> {
        let paper_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM course_question_paper_item i
            JOIN course_question_paper p ON p.id = i.paper_id AND p.tenant_id = i.tenant_id
            WHERE i.tenant_id = $1 AND i.question_id = $2 AND p.deleted_at IS NULL
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&question_id)
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        let handout_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM course_question_handout_item i
            JOIN course_question_handout h ON h.id = i.handout_id AND h.tenant_id = i.tenant_id
            WHERE i.tenant_id = $1 AND i.question_id = $2 AND h.deleted_at IS NULL
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&question_id)
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        Ok(json!({ "paperCount": paper_count, "handoutCount": handout_count }))
    }

    async fn import_questions(
        &self,
        context: &CourseServiceContext,
        commands: Vec<Value>,
    ) -> CourseResult<Value> {
        let mut accepted: i64 = 0;
        let mut failed: Vec<Value> = Vec::new();
        for (index, command) in commands.into_iter().enumerate() {
            match write_question(self.pool(), context, &command).await {
                Ok(_) => accepted += 1,
                Err(error) => failed.push(json!({
                    "index": index,
                    "reason": error.message(),
                })),
            }
        }
        Ok(json!({ "accepted": accepted, "failed": failed }))
    }

    async fn update_questions_batch(
        &self,
        context: &CourseServiceContext,
        question_ids: Vec<String>,
        patch: Value,
    ) -> CourseResult<u64> {
        let now = chrono::Utc::now().to_rfc3339();
        let mut total: u64 = 0;
        for question_id in &question_ids {
            let result = sqlx::query(
                r#"
                UPDATE course_question
                SET chapter = COALESCE($2, chapter),
                    knowledge_points_json = COALESCE($3, knowledge_points_json),
                    tags_json = COALESCE($4, tags_json),
                    difficulty = COALESCE($5, difficulty),
                    wrong_book = COALESCE($6, wrong_book),
                    wrong_note = COALESCE($7, wrong_note),
                    status = COALESCE($8, status),
                    updated_at = $9, updated_by = $10, version = version + 1
                WHERE id = $11 AND tenant_id = $12 AND deleted_at IS NULL
                "#,
            )
            .bind(patch.get("chapter").and_then(Value::as_str))
            .bind(patch.get("knowledge_points_json").and_then(Value::as_str))
            .bind(patch.get("tags_json").and_then(Value::as_str))
            .bind(patch.get("difficulty").and_then(Value::as_str))
            .bind(
                patch
                    .get("wrong_book")
                    .and_then(Value::as_bool)
                    .map(i64::from),
            )
            .bind(patch.get("wrong_note").and_then(Value::as_str))
            .bind(patch.get("status").and_then(Value::as_str))
            .bind(&now)
            .bind(context.actor_id.clone())
            .bind(question_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            total += result.rows_affected();
        }
        Ok(total)
    }

    async fn select_compose_candidates(
        &self,
        context: &CourseServiceContext,
        spec: Value,
    ) -> CourseResult<Vec<QuestionItem>> {
        let filter = QuestionFilter {
            grade_level: spec
                .get("grade_level")
                .and_then(Value::as_str)
                .map(str::to_owned),
            subject: spec
                .get("subject")
                .and_then(Value::as_str)
                .map(str::to_owned),
            chapter: None,
            knowledge_point: None,
            question_type: spec
                .get("question_type")
                .and_then(Value::as_str)
                .map(str::to_owned),
            difficulty: spec
                .get("difficulty")
                .and_then(Value::as_str)
                .map(str::to_owned),
            tag: None,
            source_type: None,
            wrong_book: None,
            status: Some("active".to_string()),
            owner_user_id: None,
            q: None,
        };
        let chapters: Vec<String> = spec
            .get("chapters")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let knowledge_points: Vec<String> = spec
            .get("knowledge_points")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let exclude_ids: Vec<String> = spec
            .get("exclude_ids")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let limit: i64 = spec
            .get("limit")
            .and_then(Value::as_i64)
            .unwrap_or(10)
            .clamp(1, 200);

        let rows = sqlx::query(QUESTION_COMPOSE_SQL)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(filter.grade_level.clone())
            .bind(filter.subject.clone())
            .bind(filter.question_type.clone())
            .bind(filter.difficulty.clone())
            .bind(if chapters.is_empty() {
                None
            } else {
                Some(chapters)
            })
            .bind(if knowledge_points.is_empty() {
                None
            } else {
                Some(knowledge_points)
            })
            .bind(if exclude_ids.is_empty() {
                None
            } else {
                Some(exclude_ids)
            })
            .bind(limit)
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
        Ok(rows.iter().map(question_from_row).collect())
    }

    async fn retrieve_taxonomy(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<Value> {
        let grade_filter = query.grade_level.clone().filter(|v| !v.is_empty());
        let subject_filter = query.subject.clone().filter(|v| !v.is_empty());

        let scalar_groups = [
            ("grades", TAXONOMY_GRADES_SQL),
            ("subjects", TAXONOMY_SUBJECTS_SQL),
            ("questionTypes", TAXONOMY_QUESTION_TYPES_SQL),
            ("difficulties", TAXONOMY_DIFFICULTIES_SQL),
        ];
        let mut result = serde_json::Map::new();
        for (key, sql) in scalar_groups {
            let rows = sqlx::query(sql)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(grade_filter.clone())
                .bind(subject_filter.clone())
                .fetch_all(self.pool())
                .await
                .map_err(sqlx_storage_error)?;
            let entries: Vec<Value> = rows
                .iter()
                .map(|row| {
                    json!({
                        "value": row.get::<String, _>("value"),
                        "count": row.get::<i64, _>("count"),
                    })
                })
                .collect();
            result.insert(key.to_string(), Value::Array(entries));
        }

        let rows = sqlx::query(TAXONOMY_CHAPTERS_SQL)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(grade_filter.clone())
            .bind(subject_filter.clone())
            .fetch_all(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
        let chapters: Vec<Value> = rows
            .iter()
            .map(|row| {
                json!({
                    "value": row.get::<String, _>("value"),
                    "subject": row.get::<String, _>("subject"),
                    "count": row.get::<i64, _>("count"),
                })
            })
            .collect();
        result.insert("chapters".to_string(), Value::Array(chapters));

        let jsonb_groups = [
            ("knowledgePoints", TAXONOMY_KNOWLEDGE_POINTS_SQL),
            ("tags", TAXONOMY_TAGS_SQL),
        ];
        for (key, sql) in jsonb_groups {
            let rows = sqlx::query(sql)
                .bind(&context.tenant_id)
                .bind(&context.organization_id)
                .bind(grade_filter.clone())
                .bind(subject_filter.clone())
                .fetch_all(self.pool())
                .await
                .map_err(sqlx_storage_error)?;
            let entries: Vec<Value> = rows
                .iter()
                .map(|row| {
                    json!({
                        "value": row.get::<String, _>("value"),
                        "count": row.get::<i64, _>("count"),
                    })
                })
                .collect();
            result.insert(key.to_string(), Value::Array(entries));
        }

        Ok(Value::Object(result))
    }

    async fn list_papers(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value> {
        let status_filter = query.status.clone().filter(|v| !v.is_empty() && v != "all");
        let q_filter = query.q.clone().filter(|v| !v.is_empty());
        let owner_filter = query.author_user_id.clone().filter(|v| !v.is_empty());

        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM course_question_paper
            WHERE tenant_id = $1
              AND (organization_id = $2 OR organization_id = '0')
              AND ($3::text IS NULL OR paper_status = $3)
              AND ($4::text IS NULL OR title LIKE '%' || $4 || '%' OR paper_code LIKE '%' || $4 || '%')
              AND ($5::text IS NULL OR owner_user_id = $5)
              AND deleted_at IS NULL
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(status_filter.clone())
        .bind(q_filter.clone())
        .bind(owner_filter.clone())
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        let rows = sqlx::query(
            r#"
            SELECT id, paper_code, title, grade_level, subject, paper_mode, exam_duration_seconds::bigint AS exam_duration_seconds,
                   total_score, scope_json, score_allocation_json, header_note, sealed_line::bigint AS sealed_line,
                   paper_status, archived_at, owner_user_id, question_count_snapshot::bigint AS question_count_snapshot, status,
                   created_at, updated_at, version::bigint AS version
            FROM course_question_paper
            WHERE tenant_id = $1
              AND (organization_id = $2 OR organization_id = '0')
              AND ($3::text IS NULL OR paper_status = $3)
              AND ($4::text IS NULL OR title LIKE '%' || $4 || '%' OR paper_code LIKE '%' || $4 || '%')
              AND ($5::text IS NULL OR owner_user_id = $5)
              AND deleted_at IS NULL
            ORDER BY updated_at DESC, id ASC
            LIMIT $6 OFFSET $7
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(status_filter)
        .bind(q_filter)
        .bind(owner_filter)
        .bind(query.limit())
        .bind(query.offset())
        .fetch_all(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        let items: Vec<Value> = rows.iter().map(paper_row_to_value).collect();
        Ok(json!({ "items": items, "total": total }))
    }

    async fn retrieve_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Option<Value>> {
        let Some(row) = load_paper_row(self.pool(), context, &paper_id).await? else {
            return Ok(None);
        };
        let paper = paper_with_items(self.pool(), context, row).await?;
        Ok(Some(paper))
    }

    async fn save_paper(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let paper = command.get("paper").cloned().unwrap_or(Value::Null);
        let items = command
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let now = chrono::Utc::now().to_rfc3339();
        let existing_id = paper.get("id").and_then(Value::as_str).map(str::to_owned);
        let owner_user_id = paper
            .get("owner_user_id")
            .map(|value| value.as_str().map(str::to_owned))
            .unwrap_or(None);

        let paper_id = if let Some(paper_id) = &existing_id {
            let version: Option<i64> = paper.get("version").and_then(Value::as_i64);
            let result = sqlx::query(
                r#"
                UPDATE course_question_paper
                SET title = $1, grade_level = $2, subject = $3, paper_mode = $4,
                    exam_duration_seconds = $5, total_score = $6, scope_json = $7,
                    score_allocation_json = $8, header_note = $9, sealed_line = $10,
                    paper_status = $11, question_count_snapshot = $12,
                    updated_at = $13, updated_by = $14, version = version + 1
                WHERE id = $15 AND tenant_id = $16 AND deleted_at IS NULL
                  AND ($17::bigint IS NULL OR version = $17)
                "#,
            )
            .bind(paper.get("title").and_then(Value::as_str).unwrap_or(""))
            .bind(
                paper
                    .get("grade_level")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            )
            .bind(paper.get("subject").and_then(Value::as_str).unwrap_or(""))
            .bind(
                paper
                    .get("paper_mode")
                    .and_then(Value::as_str)
                    .unwrap_or("manual"),
            )
            .bind(
                paper
                    .get("exam_duration_seconds")
                    .and_then(Value::as_i64)
                    .unwrap_or(0),
            )
            .bind(
                paper
                    .get("total_score")
                    .and_then(Value::as_str)
                    .unwrap_or("0"),
            )
            .bind(
                paper
                    .get("scope_json")
                    .and_then(Value::as_str)
                    .unwrap_or("{}"),
            )
            .bind(
                paper
                    .get("score_allocation_json")
                    .and_then(Value::as_str)
                    .unwrap_or("[]"),
            )
            .bind(paper.get("header_note").and_then(Value::as_str))
            .bind(i64::from(
                paper
                    .get("sealed_line")
                    .and_then(Value::as_bool)
                    .unwrap_or(true),
            ))
            .bind(
                paper
                    .get("paper_status")
                    .and_then(Value::as_str)
                    .unwrap_or("draft"),
            )
            .bind(items.len() as i64)
            .bind(&now)
            .bind(context.actor_id.clone())
            .bind(paper_id)
            .bind(&context.tenant_id)
            .bind(version)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            if result.rows_affected() == 0 {
                return Err(CourseError::invalid("Paper not found or version conflict"));
            }
            paper_id.clone()
        } else {
            let paper_id = uuid::Uuid::new_v4().to_string();
            let paper_code = format!("p-{}", uuid::Uuid::new_v4().simple());
            sqlx::query(
                r#"
                INSERT INTO course_question_paper (
                    id, uuid, tenant_id, organization_id, paper_code, title, grade_level, subject,
                    paper_mode, exam_duration_seconds, total_score, scope_json, score_allocation_json,
                    header_note, sealed_line, paper_status, owner_user_id, question_count_snapshot,
                    status, created_at, created_by, updated_at, updated_by
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, 'active', $19, $20, $21, $22
                )
                "#,
            )
            .bind(&paper_id)
            .bind(&paper_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&paper_code)
            .bind(paper.get("title").and_then(Value::as_str).unwrap_or(""))
            .bind(paper.get("grade_level").and_then(Value::as_str).unwrap_or(""))
            .bind(paper.get("subject").and_then(Value::as_str).unwrap_or(""))
            .bind(paper.get("paper_mode").and_then(Value::as_str).unwrap_or("manual"))
            .bind(paper.get("exam_duration_seconds").and_then(Value::as_i64).unwrap_or(0))
            .bind(paper.get("total_score").and_then(Value::as_str).unwrap_or("0"))
            .bind(paper.get("scope_json").and_then(Value::as_str).unwrap_or("{}"))
            .bind(paper.get("score_allocation_json").and_then(Value::as_str).unwrap_or("[]"))
            .bind(paper.get("header_note").and_then(Value::as_str))
            .bind(i64::from(paper.get("sealed_line").and_then(Value::as_bool).unwrap_or(true)))
            .bind(paper.get("paper_status").and_then(Value::as_str).unwrap_or("draft"))
            .bind(owner_user_id)
            .bind(items.len() as i64)
            .bind(&now)
            .bind(context.actor_id.clone())
            .bind(&now)
            .bind(context.actor_id.clone())
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            paper_id
        };

        // Replace the item rows with the provided ordering.
        sqlx::query(
            "DELETE FROM course_question_paper_item WHERE paper_id = $1 AND tenant_id = $2",
        )
        .bind(&paper_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        for item in &items {
            let item_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO course_question_paper_item (
                    id, uuid, tenant_id, organization_id, paper_id, question_id,
                    section_no, sort_order, score, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (tenant_id, paper_id, question_id) DO UPDATE SET
                    section_no = EXCLUDED.section_no,
                    sort_order = EXCLUDED.sort_order,
                    score = EXCLUDED.score,
                    updated_at = EXCLUDED.updated_at
                "#,
            )
            .bind(&item_id)
            .bind(&item_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&paper_id)
            .bind(
                item.get("question_id")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            )
            .bind(
                item.get("section_no")
                    .and_then(Value::as_str)
                    .unwrap_or("1"),
            )
            .bind(item.get("sort_order").and_then(Value::as_i64).unwrap_or(0))
            .bind(item.get("score").and_then(Value::as_str).unwrap_or("0"))
            .bind(&now)
            .bind(&now)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
        }

        let row = load_paper_row(self.pool(), context, &paper_id)
            .await?
            .ok_or_else(|| CourseError::storage("saved paper row is missing"))?;
        paper_with_items(self.pool(), context, row).await
    }

    async fn delete_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE course_question_paper
            SET deleted_at = $1, deleted_by = $2, status = 'deleted', updated_at = $1
            WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(context.actor_id.clone())
        .bind(&paper_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        Ok(())
    }

    async fn archive_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Value> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE course_question_paper
            SET paper_status = 'archived', archived_at = $1,
                updated_at = $1, updated_by = $2, version = version + 1
            WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(context.actor_id.clone())
        .bind(&paper_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        let row = load_paper_row(self.pool(), context, &paper_id)
            .await?
            .ok_or_else(|| CourseError::not_found("Paper not found"))?;
        paper_with_items(self.pool(), context, row).await
    }

    async fn list_handouts(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value> {
        let q_filter = query.q.clone().filter(|v| !v.is_empty());
        let owner_filter = query.author_user_id.clone().filter(|v| !v.is_empty());
        let grade_filter = query.level.clone().filter(|v| !v.is_empty());
        let subject_filter = query.category.clone().filter(|v| !v.is_empty());

        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM course_question_handout
            WHERE tenant_id = $1
              AND (organization_id = $2 OR organization_id = '0')
              AND ($3::text IS NULL OR title LIKE '%' || $3 || '%' OR handout_code LIKE '%' || $3 || '%'
                   OR lesson_tag LIKE '%' || $3 || '%')
              AND ($4::text IS NULL OR owner_user_id = $4)
              AND ($5::text IS NULL OR grade_level = $5)
              AND ($6::text IS NULL OR subject = $6)
              AND deleted_at IS NULL
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(q_filter.clone())
        .bind(owner_filter.clone())
        .bind(grade_filter.clone())
        .bind(subject_filter.clone())
        .fetch_one(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        let rows = sqlx::query(
            r#"
            SELECT id, handout_code, title, grade_level, subject, lesson_tag, body_json,
                   owner_user_id, status, created_at, updated_at, version::bigint AS version
            FROM course_question_handout
            WHERE tenant_id = $1
              AND (organization_id = $2 OR organization_id = '0')
              AND ($3::text IS NULL OR title LIKE '%' || $3 || '%' OR handout_code LIKE '%' || $3 || '%'
                   OR lesson_tag LIKE '%' || $3 || '%')
              AND ($4::text IS NULL OR owner_user_id = $4)
              AND ($5::text IS NULL OR grade_level = $5)
              AND ($6::text IS NULL OR subject = $6)
              AND deleted_at IS NULL
            ORDER BY updated_at DESC, id ASC
            LIMIT $7 OFFSET $8
            "#,
        )
        .bind(&context.tenant_id)
        .bind(&context.organization_id)
        .bind(q_filter)
        .bind(owner_filter)
        .bind(grade_filter)
        .bind(subject_filter)
        .bind(query.limit())
        .bind(query.offset())
        .fetch_all(self.pool())
        .await
        .map_err(sqlx_storage_error)?;

        let items: Vec<Value> = rows.iter().map(handout_row_to_value).collect();
        Ok(json!({ "items": items, "total": total }))
    }

    async fn retrieve_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<Option<Value>> {
        let Some(row) = load_handout_row(self.pool(), context, &handout_id).await? else {
            return Ok(None);
        };
        let mut handout = handout_row_to_value(&row);
        let item_rows = sqlx::query(
            r#"
            SELECT i.question_id, i.sort_order::bigint AS sort_order, i.usage_role,
                   q.question_code, q.grade_level AS q_grade, q.subject AS q_subject,
                   q.chapter AS q_chapter, q.knowledge_points_json AS q_knowledge,
                   q.question_type, q.stem, q.options_json AS q_options, q.answer AS q_answer,
                   q.analysis AS q_analysis, q.difficulty AS q_difficulty,
                   q.default_score AS q_default_score, q.tags_json AS q_tags
            FROM course_question_handout_item i
            LEFT JOIN course_question q
                   ON q.id = i.question_id AND q.tenant_id = i.tenant_id AND q.deleted_at IS NULL
            WHERE i.handout_id = $1 AND i.tenant_id = $2
            ORDER BY i.sort_order ASC
            "#,
        )
        .bind(&handout_id)
        .bind(&context.tenant_id)
        .fetch_all(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        let items: Vec<Value> = item_rows
            .iter()
            .map(|item_row| {
                let question_id: String = item_row.get("question_id");
                let question_present: Option<String> = item_row.get("question_type");
                let question = if question_present.is_some() {
                    json!({
                        "id": question_id,
                        "questionCode": item_row.get::<Option<String>, _>("question_code"),
                        "gradeLevel": item_row.get::<Option<String>, _>("q_grade"),
                        "subject": item_row.get::<Option<String>, _>("q_subject"),
                        "chapter": item_row.get::<Option<String>, _>("q_chapter"),
                        "knowledgePoints": parse_json_text(item_row.get::<Option<String>, _>("q_knowledge")),
                        "questionType": item_row.get::<Option<String>, _>("question_type"),
                        "stem": item_row.get::<Option<String>, _>("stem"),
                        "options": parse_json_text(item_row.get::<Option<String>, _>("q_options")),
                        "answer": item_row.get::<Option<String>, _>("q_answer"),
                        "analysis": item_row.get::<Option<String>, _>("q_analysis"),
                        "difficulty": item_row.get::<Option<String>, _>("q_difficulty"),
                        "defaultScore": item_row.get::<Option<String>, _>("q_default_score"),
                        "tags": parse_json_text(item_row.get::<Option<String>, _>("q_tags")),
                    })
                } else {
                    Value::Null
                };
                json!({
                    "questionId": question_id,
                    "sortOrder": item_row.get::<i64, _>("sort_order"),
                    "usageRole": item_row.get::<String, _>("usage_role"),
                    "question": question,
                })
            })
            .collect();
        if let Some(object) = handout.as_object_mut() {
            object.insert("items".to_string(), Value::Array(items));
        }
        Ok(Some(handout))
    }

    async fn save_handout(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let handout = command.get("handout").cloned().unwrap_or(Value::Null);
        let items = command
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let now = chrono::Utc::now().to_rfc3339();
        let existing_id = handout.get("id").and_then(Value::as_str).map(str::to_owned);

        let handout_id = if let Some(handout_id) = &existing_id {
            sqlx::query(
                r#"
                UPDATE course_question_handout
                SET title = $1, grade_level = $2, subject = $3, lesson_tag = $4,
                    body_json = $5, status = $6, updated_at = $7, updated_by = $8,
                    version = version + 1
                WHERE id = $9 AND tenant_id = $10 AND deleted_at IS NULL
                "#,
            )
            .bind(handout.get("title").and_then(Value::as_str).unwrap_or(""))
            .bind(
                handout
                    .get("grade_level")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            )
            .bind(handout.get("subject").and_then(Value::as_str).unwrap_or(""))
            .bind(handout.get("lesson_tag").and_then(Value::as_str))
            .bind(
                handout
                    .get("body_json")
                    .and_then(Value::as_str)
                    .unwrap_or("[]"),
            )
            .bind(
                handout
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("active"),
            )
            .bind(&now)
            .bind(context.actor_id.clone())
            .bind(handout_id)
            .bind(&context.tenant_id)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            handout_id.clone()
        } else {
            let handout_id = uuid::Uuid::new_v4().to_string();
            let handout_code = format!("h-{}", uuid::Uuid::new_v4().simple());
            let owner_user_id = handout
                .get("owner_user_id")
                .map(|value| value.as_str().map(str::to_owned))
                .unwrap_or(None);
            sqlx::query(
                r#"
                INSERT INTO course_question_handout (
                    id, uuid, tenant_id, organization_id, handout_code, title, grade_level,
                    subject, lesson_tag, body_json, owner_user_id, status,
                    created_at, created_by, updated_at, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                "#,
            )
            .bind(&handout_id)
            .bind(&handout_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&handout_code)
            .bind(handout.get("title").and_then(Value::as_str).unwrap_or(""))
            .bind(
                handout
                    .get("grade_level")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            )
            .bind(handout.get("subject").and_then(Value::as_str).unwrap_or(""))
            .bind(handout.get("lesson_tag").and_then(Value::as_str))
            .bind(
                handout
                    .get("body_json")
                    .and_then(Value::as_str)
                    .unwrap_or("[]"),
            )
            .bind(owner_user_id)
            .bind(
                handout
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("active"),
            )
            .bind(&now)
            .bind(context.actor_id.clone())
            .bind(&now)
            .bind(context.actor_id.clone())
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
            handout_id
        };

        sqlx::query(
            "DELETE FROM course_question_handout_item WHERE handout_id = $1 AND tenant_id = $2",
        )
        .bind(&handout_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        for item in &items {
            let item_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO course_question_handout_item (
                    id, uuid, tenant_id, organization_id, handout_id, question_id,
                    sort_order, usage_role, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (tenant_id, handout_id, question_id) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    usage_role = EXCLUDED.usage_role,
                    updated_at = EXCLUDED.updated_at
                "#,
            )
            .bind(&item_id)
            .bind(&item_id)
            .bind(&context.tenant_id)
            .bind(&context.organization_id)
            .bind(&handout_id)
            .bind(
                item.get("question_id")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            )
            .bind(item.get("sort_order").and_then(Value::as_i64).unwrap_or(0))
            .bind(
                item.get("usage_role")
                    .and_then(Value::as_str)
                    .unwrap_or("practice"),
            )
            .bind(&now)
            .bind(&now)
            .execute(self.pool())
            .await
            .map_err(sqlx_storage_error)?;
        }

        let row = load_handout_row(self.pool(), context, &handout_id)
            .await?
            .ok_or_else(|| CourseError::storage("saved handout row is missing"))?;
        let mut handout_value = handout_row_to_value(&row);
        let item_rows = sqlx::query(
            "SELECT question_id, sort_order::bigint AS sort_order, usage_role FROM course_question_handout_item \
             WHERE handout_id = $1 AND tenant_id = $2 ORDER BY sort_order ASC",
        )
        .bind(&handout_id)
        .bind(&context.tenant_id)
        .fetch_all(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        let saved_items: Vec<Value> = item_rows
            .iter()
            .map(|item_row| {
                json!({
                    "questionId": item_row.get::<String, _>("question_id"),
                    "sortOrder": item_row.get::<i64, _>("sort_order"),
                    "usageRole": item_row.get::<String, _>("usage_role"),
                })
            })
            .collect();
        if let Some(object) = handout_value.as_object_mut() {
            object.insert("items".to_string(), Value::Array(saved_items));
        }
        Ok(handout_value)
    }

    async fn delete_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE course_question_handout
            SET deleted_at = $1, deleted_by = $2, status = 'deleted', updated_at = $1
            WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
            "#,
        )
        .bind(&now)
        .bind(context.actor_id.clone())
        .bind(&handout_id)
        .bind(&context.tenant_id)
        .execute(self.pool())
        .await
        .map_err(sqlx_storage_error)?;
        Ok(())
    }
}
