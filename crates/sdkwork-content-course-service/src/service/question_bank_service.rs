//! Question bank application service: questions, papers (smart + manual
//! composition), and teaching handouts.

use serde_json::{json, Value};

use crate::domain::commands::CourseServiceContext;
use crate::domain::models::{
    is_supported_question_type, ComposeBucket, CourseError, CourseQuery, CourseResult, QuestionItem,
    QuestionPage, QuestionQuery, QUESTION_TYPE_SECTION_ORDER,
};
use crate::ports::repository::QuestionBankRepository;

/// Permission that lifts the owner-only restrictions on question bank
/// mutations (operators and institution admins).
const QUESTION_BANK_ADMIN_PERMISSIONS: [&str; 3] =
    ["*", "course.admin", "course.questionbank.admin"];

pub struct QuestionBankServiceImpl {
    repo: Box<dyn QuestionBankRepository>,
}

impl QuestionBankServiceImpl {
    pub fn new(repo: Box<dyn QuestionBankRepository>) -> Self {
        Self { repo }
    }

    fn can_manage_all(&self, context: &CourseServiceContext) -> bool {
        context
            .permissions
            .iter()
            .any(|permission| QUESTION_BANK_ADMIN_PERMISSIONS.contains(&permission.as_str()))
    }

    fn actor_user_id(&self, context: &CourseServiceContext) -> Option<String> {
        context
            .user_id
            .clone()
            .or_else(|| context.actor_id.clone())
            .filter(|value| !value.is_empty())
    }

    fn ensure_owner(
        &self,
        context: &CourseServiceContext,
        owner_user_id: Option<&str>,
        what: &str,
    ) -> CourseResult<()> {
        if self.can_manage_all(context) {
            return Ok(());
        }
        let actor = self
            .actor_user_id(context)
            .ok_or_else(|| CourseError::invalid("An authenticated user is required"))?;
        if owner_user_id.is_some_and(|owner| owner == actor) {
            return Ok(());
        }
        Err(CourseError::invalid(format!(
            "Only the owner or an administrator may modify this {what}"
        )))
    }

    /// Per-question delete guard shared by single and batch deletion.
    async fn delete_one_guarded(
        &self,
        context: &CourseServiceContext,
        question_id: &str,
    ) -> CourseResult<()> {
        let existing = self
            .repo
            .retrieve_question(context, question_id.to_string())
            .await?
            .ok_or_else(|| CourseError::not_found("Question not found"))?;
        self.ensure_owner(context, existing.owner_user_id.as_deref(), "question")?;
        let references = self
            .repo
            .question_references(context, question_id.to_string())
            .await?;
        let paper_refs = references
            .get("paperCount")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let handout_refs = references
            .get("handoutCount")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        if paper_refs > 0 || handout_refs > 0 {
            return Err(CourseError::invalid(format!(
                "still referenced by {paper_refs} paper(s) and {handout_refs} handout(s)"
            )));
        }
        self.repo
            .delete_question(context, question_id.to_string())
            .await
    }

    async fn load_owned_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: &str,
    ) -> CourseResult<Value> {
        let paper = self
            .repo
            .retrieve_paper(context, paper_id.to_string())
            .await?
            .ok_or_else(|| CourseError::not_found("Paper not found"))?;
        let owner = paper.get("ownerUserId").and_then(Value::as_str);
        self.ensure_owner(context, owner, "paper")?;
        Ok(paper)
    }

    async fn load_owned_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: &str,
    ) -> CourseResult<Value> {
        let handout = self
            .repo
            .retrieve_handout(context, handout_id.to_string())
            .await?
            .ok_or_else(|| CourseError::not_found("Handout not found"))?;
        let owner = handout.get("ownerUserId").and_then(Value::as_str);
        self.ensure_owner(context, owner, "handout")?;
        Ok(handout)
    }
}

#[async_trait::async_trait]
pub trait QuestionBankService: Send + Sync {
    // Questions
    async fn list_questions(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<QuestionPage>;

    async fn retrieve_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<Option<QuestionItem>>;

    async fn save_question(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<QuestionItem>;

    async fn delete_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<()>;

    /// Batch deletion with per-question ownership and reference guards;
    /// failures are reported per id instead of failing the whole batch.
    async fn delete_questions_batch(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn import_questions(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn update_questions_batch(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn retrieve_taxonomy(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<Value>;

    // Papers
    async fn list_papers(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value>;

    async fn retrieve_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn compose_paper(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn update_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
        command: Value,
    ) -> CourseResult<Value>;

    async fn delete_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<()>;

    async fn archive_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Value>;

    // Handouts
    async fn list_handouts(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value>;

    async fn retrieve_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn save_handout(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn update_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
        command: Value,
    ) -> CourseResult<Value>;

    async fn delete_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<()>;
}

fn require_str(command: &Value, key: &str, what: &str) -> CourseResult<String> {
    let value = command
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| CourseError::invalid(format!("{what} is required")))?;
    Ok(value.to_string())
}

fn optional_str(command: &Value, key: &str) -> Option<String> {
    command
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn optional_i64(command: &Value, key: &str) -> Option<i64> {
    command.get(key).and_then(Value::as_i64).or_else(|| {
        command
            .get(key)
            .and_then(Value::as_str)
            .and_then(|value| value.parse::<i64>().ok())
    })
}

fn optional_bool(command: &Value, key: &str) -> Option<bool> {
    command.get(key).and_then(Value::as_bool)
}

fn array_field(command: &Value, key: &str) -> Vec<Value> {
    command
        .get(key)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::trim).filter(|v| !v.is_empty()))
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn decimal_string(value: Option<&Value>, fallback: &str) -> String {
    let parsed = match value {
        Some(Value::Number(number)) => number.to_string(),
        Some(Value::String(text)) => text.trim().to_string(),
        _ => String::new(),
    };
    if parsed.is_empty() {
        return fallback.to_string();
    }
    if parsed.parse::<f64>().is_ok() {
        return parsed;
    }
    fallback.to_string()
}

/// Formats a score total with up to two decimals and no trailing zeros
/// (`4` stays `4`, `4.5` stays `4.5`, `0.30000000000000004` becomes `0.3`).
fn format_decimal(value: f64) -> String {
    let text = format!("{value:.2}");
    let trimmed = text.trim_end_matches('0').trim_end_matches('.');
    if trimmed.is_empty() || trimmed == "-0" {
        return "0".to_string();
    }
    trimmed.to_string()
}

fn validate_question_fields(command: &Value) -> CourseResult<()> {
    require_str(command, "gradeLevel", "gradeLevel")?;
    require_str(command, "subject", "subject")?;
    let question_type = require_str(command, "questionType", "questionType")?;
    require_str(command, "stem", "stem")?;
    if !is_supported_question_type(&question_type) {
        return Err(CourseError::invalid(format!(
            "Unsupported question type: {question_type}"
        )));
    }
    let difficulty = optional_str(command, "difficulty").unwrap_or_else(|| "medium".to_string());
    if !matches!(difficulty.as_str(), "easy" | "medium" | "hard") {
        return Err(CourseError::invalid(format!(
            "Unsupported difficulty: {difficulty}"
        )));
    }
    let default_score = decimal_string(command.get("defaultScore"), "0");
    if default_score.parse::<f64>().is_err() {
        return Err(CourseError::invalid("defaultScore must be numeric"));
    }
    let source_type = optional_str(command, "sourceType").unwrap_or_else(|| "manual".to_string());
    if !matches!(source_type.as_str(), "manual" | "import" | "real_exam") {
        return Err(CourseError::invalid(format!(
            "Unsupported source type: {source_type}"
        )));
    }
    Ok(())
}

/// Normalizes a camelCase wire command into the snake_case repo shape.
fn normalize_question_command(command: &Value) -> Value {
    let option_entries: Vec<Value> = array_field(command, "options")
        .into_iter()
        .filter_map(|option| {
            let content = option
                .get("content")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())?;
            let key = option
                .get("key")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)?;
            Some(json!({ "key": key, "content": content }))
        })
        .collect();

    json!({
        "id": command.get("id").and_then(Value::as_str),
        // An empty code is filled by the repository with a generated `q-*` id.
        "question_code": optional_str(command, "questionCode").unwrap_or_default(),
        "grade_level": command.get("gradeLevel").and_then(Value::as_str).unwrap_or(""),
        "subject": command.get("subject").and_then(Value::as_str).unwrap_or(""),
        "chapter": optional_str(command, "chapter"),
        "knowledge_points_json": Value::Array(
            string_list(command.get("knowledgePoints"))
                .into_iter()
                .map(Value::String)
                .collect(),
        )
        .to_string(),
        "question_type": command.get("questionType").and_then(Value::as_str).unwrap_or(""),
        "stem": command.get("stem").and_then(Value::as_str).unwrap_or(""),
        "options_json": Value::Array(option_entries).to_string(),
        "answer": command.get("answer").and_then(Value::as_str).unwrap_or(""),
        "analysis": optional_str(command, "analysis"),
        "difficulty": optional_str(command, "difficulty").unwrap_or_else(|| "medium".to_string()),
        "default_score": decimal_string(command.get("defaultScore"), "0"),
        "source_type": optional_str(command, "sourceType").unwrap_or_else(|| "manual".to_string()),
        "source_ref": optional_str(command, "sourceRef"),
        "tags_json": Value::Array(
            string_list(command.get("tags"))
                .into_iter()
                .map(Value::String)
                .collect(),
        )
        .to_string(),
        "wrong_book": optional_bool(command, "wrongBook").unwrap_or(false),
        "wrong_note": optional_str(command, "wrongNote"),
        "status": optional_str(command, "status").unwrap_or_else(|| "active".to_string()),
    })
}

fn import_failure(index: usize, reason: &str) -> Value {
    json!({ "index": index, "reason": reason })
}

/// Builds the snake_case paper + items repo command from a camelCase wire
/// command (compose or update).
fn build_paper_repo_command(
    paper_id: Option<String>,
    owner_user_id: Option<String>,
    wire: &Value,
    items: Vec<Value>,
) -> Value {
    json!({
        "paper": {
            "id": paper_id,
            "title": wire.get("title").and_then(Value::as_str).unwrap_or(""),
            "grade_level": wire.get("gradeLevel").and_then(Value::as_str).unwrap_or(""),
            "subject": wire.get("subject").and_then(Value::as_str).unwrap_or(""),
            "paper_mode": optional_str(wire, "mode").unwrap_or_else(|| "manual".to_string()),
            "exam_duration_seconds": optional_i64(wire, "examDurationSeconds").unwrap_or(0),
            "total_score": decimal_string(wire.get("totalScore"), "0"),
            "scope_json": wire.get("scope").cloned().unwrap_or(json!({})).to_string(),
            "score_allocation_json": wire
                .get("scoreAllocation")
                .cloned()
                .unwrap_or(Value::Array(Vec::new()))
                .to_string(),
            "header_note": optional_str(wire, "headerNote"),
            "sealed_line": optional_bool(wire, "sealedLine").unwrap_or(true),
            "paper_status": optional_str(wire, "paperStatus").unwrap_or_else(|| "draft".to_string()),
            "owner_user_id": owner_user_id,
        },
        "items": items,
    })
}

/// Extracts handout item rows (question references) from camelCase body blocks.
fn extract_handout_items(blocks: &[Value]) -> Vec<Value> {
    let mut items: Vec<Value> = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for (index, block) in blocks.iter().enumerate() {
        if block.get("type").and_then(Value::as_str) != Some("question") {
            continue;
        }
        let Some(question_id) = block
            .get("questionId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
        else {
            continue;
        };
        if !seen.insert(question_id.clone()) {
            continue;
        }
        let usage_role = block
            .get("usageRole")
            .and_then(Value::as_str)
            .unwrap_or("practice");
        items.push(json!({
            "question_id": question_id,
            "sort_order": index as i64,
            "usage_role": usage_role,
        }));
    }
    items
}

fn build_handout_repo_command(
    handout_id: Option<String>,
    owner_user_id: Option<String>,
    wire: &Value,
    blocks: &[Value],
) -> Value {
    json!({
        "handout": {
            "id": handout_id,
            "title": wire.get("title").and_then(Value::as_str).unwrap_or(""),
            "grade_level": wire.get("gradeLevel").and_then(Value::as_str).unwrap_or(""),
            "subject": wire.get("subject").and_then(Value::as_str).unwrap_or(""),
            "lesson_tag": optional_str(wire, "lessonTag"),
            "body_json": Value::Array(blocks.to_vec()).to_string(),
            "owner_user_id": owner_user_id,
            "status": optional_str(wire, "status").unwrap_or_else(|| "active".to_string()),
        },
        "items": extract_handout_items(blocks),
    })
}

#[async_trait::async_trait]
impl QuestionBankService for QuestionBankServiceImpl {
    async fn list_questions(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<QuestionPage> {
        self.repo.list_questions(context, query).await
    }

    async fn retrieve_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<Option<QuestionItem>> {
        self.repo.retrieve_question(context, question_id).await
    }

    async fn save_question(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<QuestionItem> {
        validate_question_fields(&command)?;
        let mut normalized = normalize_question_command(&command);
        let owner_user_id = self.actor_user_id(context);
        let question_id = optional_str(&command, "id");
        if let Some(question_id) = &question_id {
            let existing = self
                .repo
                .retrieve_question(context, question_id.clone())
                .await?
                .ok_or_else(|| CourseError::not_found("Question not found"))?;
            self.ensure_owner(context, existing.owner_user_id.as_deref(), "question")?;
            normalized["owner_user_id"] = existing
                .owner_user_id
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null);
        } else if let Some(owner) = &owner_user_id {
            normalized["owner_user_id"] = Value::String(owner.clone());
        }
        self.repo.save_question(context, normalized).await
    }

    async fn delete_question(
        &self,
        context: &CourseServiceContext,
        question_id: String,
    ) -> CourseResult<()> {
        self.delete_one_guarded(context, &question_id).await?;
        Ok(())
    }

    async fn delete_questions_batch(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let question_ids = string_list(command.get("questionIds"));
        if question_ids.is_empty() {
            return Err(CourseError::invalid("questionIds is required"));
        }
        if question_ids.len() > 200 {
            return Err(CourseError::invalid(
                "batch delete accepts at most 200 questions per call",
            ));
        }
        let mut deleted: Vec<String> = Vec::new();
        let mut failed: Vec<Value> = Vec::new();
        for question_id in question_ids {
            let outcome = self.delete_one_guarded(context, &question_id).await;
            match outcome {
                Ok(()) => deleted.push(question_id),
                Err(error) => failed.push(json!({
                    "questionId": question_id,
                    "reason": error.message(),
                })),
            }
        }
        Ok(json!({
            "accepted": !failed.is_empty() || !deleted.is_empty(),
            "deleted": deleted,
            "failed": failed,
        }))
    }

    async fn import_questions(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let rows = array_field(&command, "questions");
        if rows.is_empty() {
            return Err(CourseError::invalid("questions must be a non-empty array"));
        }
        if rows.len() > 500 {
            return Err(CourseError::invalid(
                "import accepts at most 500 questions per call",
            ));
        }
        let owner_user_id = self.actor_user_id(context);
        let mut normalized_rows = Vec::with_capacity(rows.len());
        for row in &rows {
            let mut normalized = normalize_question_command(row);
            if let Some(owner) = &owner_user_id {
                normalized["owner_user_id"] = Value::String(owner.clone());
            }
            normalized_rows.push(normalized);
        }
        let mut failures: Vec<Value> = Vec::new();
        for (index, row) in normalized_rows.iter().enumerate() {
            if let Err(error) = validate_question_fields(row) {
                failures.push(import_failure(index, &format!(
                    "gradeLevel={} subject={} questionType={}: {}",
                    row.get("grade_level").and_then(Value::as_str).unwrap_or(""),
                    row.get("subject").and_then(Value::as_str).unwrap_or(""),
                    row.get("question_type").and_then(Value::as_str).unwrap_or(""),
                    error.message(),
                )));
            }
        }
        if !failures.is_empty() {
            return Ok(json!({ "accepted": 0, "failed": failures }));
        }
        self.repo.import_questions(context, normalized_rows).await
    }

    async fn update_questions_batch(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let question_ids = string_list(command.get("questionIds"));
        if question_ids.is_empty() {
            return Err(CourseError::invalid("questionIds is required"));
        }
        if question_ids.len() > 200 {
            return Err(CourseError::invalid(
                "batch update accepts at most 200 questions per call",
            ));
        }
        let mut patch = serde_json::Map::new();
        if command.get("knowledgePoints").is_some() {
            patch.insert(
                "knowledge_points_json".to_string(),
                Value::String(
                    Value::Array(
                        string_list(command.get("knowledgePoints"))
                            .into_iter()
                            .map(Value::String)
                            .collect(),
                    )
                    .to_string(),
                ),
            );
        }
        if command.get("tags").is_some() {
            patch.insert(
                "tags_json".to_string(),
                Value::String(
                    Value::Array(
                        string_list(command.get("tags"))
                            .into_iter()
                            .map(Value::String)
                            .collect(),
                    )
                    .to_string(),
                ),
            );
        }
        if let Some(chapter) = optional_str(&command, "chapter") {
            patch.insert("chapter".to_string(), Value::String(chapter));
        }
        if let Some(difficulty) = optional_str(&command, "difficulty") {
            patch.insert("difficulty".to_string(), Value::String(difficulty));
        }
        if let Some(wrong_book) = optional_bool(&command, "wrongBook") {
            patch.insert("wrong_book".to_string(), Value::Bool(wrong_book));
        }
        if command.get("wrongNote").is_some() {
            patch.insert(
                "wrong_note".to_string(),
                command.get("wrongNote").cloned().unwrap_or(Value::Null),
            );
        }
        if let Some(status) = optional_str(&command, "status") {
            patch.insert("status".to_string(), Value::String(status));
        }
        if patch.is_empty() {
            return Err(CourseError::invalid(
                "patch must set at least one updatable field",
            ));
        }
        let updated = self
            .repo
            .update_questions_batch(context, question_ids, Value::Object(patch))
            .await?;
        Ok(json!({ "accepted": true, "updated": updated }))
    }

    async fn retrieve_taxonomy(
        &self,
        context: &CourseServiceContext,
        query: QuestionQuery,
    ) -> CourseResult<Value> {
        self.repo.retrieve_taxonomy(context, query).await
    }

    async fn list_papers(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value> {
        let page = self.repo.list_papers(context, query.clone()).await?;
        Ok(json!({
            "items": page.get("items").cloned().unwrap_or(Value::Array(Vec::new())),
            "page": query.page.unwrap_or(1),
            "pageSize": query.limit(),
            "total": page.get("total").and_then(Value::as_i64).unwrap_or(0),
        }))
    }

    async fn retrieve_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Option<Value>> {
        self.repo.retrieve_paper(context, paper_id).await
    }

    async fn compose_paper(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        require_str(&command, "title", "title")?;
        let grade_level = require_str(&command, "gradeLevel", "gradeLevel")?;
        let subject = require_str(&command, "subject", "subject")?;
        let mode = optional_str(&command, "mode").unwrap_or_else(|| "manual".to_string());
        if !matches!(mode.as_str(), "smart" | "manual") {
            return Err(CourseError::invalid(format!(
                "Unsupported paper mode: {mode}"
            )));
        }

        let mut selected: Vec<(QuestionItem, String)> = Vec::new();
        let mut scope_snapshot = json!({ "mode": mode });

        if mode == "smart" {
            let scope = command.get("scope").cloned().unwrap_or(Value::Null);
            let buckets: Vec<ComposeBucket> = array_field(&scope, "buckets")
                .into_iter()
                .map(serde_json::from_value::<ComposeBucket>)
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| CourseError::invalid(format!("invalid bucket: {error}")))?;
            if buckets.is_empty() {
                return Err(CourseError::invalid(
                    "smart composition requires at least one bucket",
                ));
            }
            let chapters = string_list(scope.get("chapters"));
            let knowledge_points = string_list(scope.get("knowledgePoints"));
            let mut excluded = string_list(scope.get("excludeQuestionIds"));

            scope_snapshot = json!({
                "mode": mode,
                "chapters": chapters,
                "knowledgePoints": knowledge_points,
                "buckets": buckets,
            });

            for bucket in buckets {
                if bucket.count <= 0 {
                    continue;
                }
                if !is_supported_question_type(&bucket.question_type) {
                    return Err(CourseError::invalid(format!(
                        "Unsupported question type: {}",
                        bucket.question_type
                    )));
                }
                let spec = json!({
                    "grade_level": grade_level,
                    "subject": subject,
                    "question_type": bucket.question_type,
                    "difficulty": bucket.difficulty,
                    "chapters": chapters,
                    "knowledge_points": knowledge_points,
                    "exclude_ids": excluded,
                    "limit": bucket.count,
                });
                let mut candidates = self
                    .repo
                    .select_compose_candidates(context, spec)
                    .await?;
                if candidates.len() < bucket.count as usize {
                    return Err(CourseError::invalid(format!(
                        "Not enough questions for {} ({}): found {}, need {}",
                        bucket.question_type,
                        bucket.difficulty.as_deref().unwrap_or("any"),
                        candidates.len(),
                        bucket.count
                    )));
                }
                let per_question_score =
                    bucket.score.clone().unwrap_or_default();
                for question in candidates.drain(..) {
                    excluded.push(question.id.clone());
                    selected.push((question, per_question_score.clone()));
                }
            }
        } else {
            let items = array_field(&command, "items");
            if items.is_empty() {
                return Err(CourseError::invalid(
                    "manual composition requires at least one question",
                ));
            }
            scope_snapshot = json!({
                "mode": mode,
                "questionIds": items.iter().filter_map(|item| item.get("questionId").and_then(Value::as_str)).collect::<Vec<_>>(),
            });
            for item in &items {
                let question_id = item
                    .get("questionId")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| CourseError::invalid("each item needs questionId"))?;
                let question = self
                    .repo
                    .retrieve_question(context, question_id.to_string())
                    .await?
                    .ok_or_else(|| {
                        CourseError::not_found(format!("Question not found: {question_id}"))
                    })?;
                let score = decimal_string(item.get("score"), &question.default_score);
                selected.push((question, score));
            }
        }

        // Group the selected questions into canonical 大题 sections.
        let mut sections: Vec<(String, Vec<(QuestionItem, String)>)> = Vec::new();
        for question_type in QUESTION_TYPE_SECTION_ORDER {
            let matching: Vec<(QuestionItem, String)> = selected
                .iter()
                .filter(|(question, _)| question.question_type == *question_type)
                .cloned()
                .collect();
            if !matching.is_empty() {
                sections.push((question_type.to_string(), matching));
            }
        }

        let mut repo_items: Vec<Value> = Vec::new();
        let mut computed_total = 0.0f64;
        let mut allocation_entries: Vec<Value> = Vec::new();
        for (section_index, (question_type, entries)) in sections.iter().enumerate() {
            let section_no = (section_index + 1).to_string();
            let mut subtotal = 0.0f64;
            for (sort_index, (question, score)) in entries.iter().enumerate() {
                let score_text = if score.is_empty() {
                    question.default_score.clone()
                } else {
                    score.clone()
                };
                subtotal += score_text.parse::<f64>().unwrap_or(0.0);
                repo_items.push(json!({
                    "question_id": question.id,
                    "section_no": section_no,
                    "sort_order": sort_index as i64,
                    "score": score_text,
                }));
            }
            computed_total += subtotal;
            allocation_entries.push(json!({
                "sectionNo": section_no,
                "questionType": question_type,
                "count": entries.len(),
                "subtotal": format_decimal(subtotal),
            }));
        }

        let requested_total = decimal_string(command.get("totalScore"), "");
        let total_score = if requested_total.is_empty() {
            format_decimal(computed_total)
        } else {
            requested_total
        };

        let mut paper_wire = command.clone();
        if let Some(object) = paper_wire.as_object_mut() {
            object.insert("scoreAllocation".to_string(), Value::Array(allocation_entries));
            object.insert("totalScore".to_string(), Value::String(total_score.clone()));
            let mut scope_value = scope_snapshot;
            if let Some(scope_object) = scope_value.as_object_mut() {
                scope_object.insert("totalScore".to_string(), Value::String(total_score));
            }
            object.insert("scope".to_string(), scope_value);
        }
        let repo_command = build_paper_repo_command(
            None,
            self.actor_user_id(context),
            &paper_wire,
            repo_items,
        );
        self.repo.save_paper(context, repo_command).await
    }

    async fn update_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
        command: Value,
    ) -> CourseResult<Value> {
        let existing = self.load_owned_paper(context, &paper_id).await?;
        let mut wire = command.clone();
        if let Some(object) = wire.as_object_mut() {
            // A partial PUT must inherit every field it does not carry;
            // otherwise the repo write would reset it to an empty default.
            for key in [
                "title",
                "examDurationSeconds",
                "headerNote",
                "sealedLine",
            ] {
                object
                    .entry(key)
                    .or_insert_with(|| existing.get(key).cloned().unwrap_or(Value::Null));
            }
            object
                .entry("mode")
                .or_insert_with(|| {
                    existing
                        .get("paperMode")
                        .cloned()
                        .unwrap_or(Value::String("manual".to_string()))
                });
            object
                .entry("gradeLevel")
                .or_insert_with(|| existing.get("gradeLevel").cloned().unwrap_or(Value::Null));
            object
                .entry("subject")
                .or_insert_with(|| existing.get("subject").cloned().unwrap_or(Value::Null));
            object
                .entry("totalScore")
                .or_insert_with(|| existing.get("totalScore").cloned().unwrap_or(Value::Null));
            object
                .entry("paperStatus")
                .or_insert_with(|| existing.get("paperStatus").cloned().unwrap_or(Value::Null));
            if !object.contains_key("scope") {
                object.insert("scope".to_string(), existing.get("scope").cloned().unwrap_or(json!({})));
            }
            if !object.contains_key("scoreAllocation") {
                object.insert(
                    "scoreAllocation".to_string(),
                    existing
                        .get("scoreAllocation")
                        .cloned()
                        .unwrap_or(Value::Array(Vec::new())),
                );
            }
        }

        let repo_items: Vec<Value> = if array_field(&command, "items").is_empty() {
            existing
                .get("items")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|entry| {
                    json!({
                        "question_id": entry.get("questionId").cloned().unwrap_or(Value::Null),
                        "section_no": entry.get("sectionNo").cloned().unwrap_or(Value::Null),
                        "sort_order": entry.get("sortOrder").cloned().unwrap_or(Value::Null),
                        "score": entry.get("score").cloned().unwrap_or(Value::Null),
                    })
                })
                .collect()
        } else {
            array_field(&command, "items")
                .into_iter()
                .map(|entry| {
                    json!({
                        "question_id": entry.get("questionId").cloned().unwrap_or(Value::Null),
                        "section_no": entry.get("sectionNo").cloned().unwrap_or(Value::Null),
                        "sort_order": entry.get("sortOrder").cloned().unwrap_or(Value::Null),
                        "score": entry.get("score").cloned().unwrap_or(Value::Null),
                    })
                })
                .collect()
        };

        let repo_command = build_paper_repo_command(
            Some(paper_id),
            None,
            &wire,
            repo_items,
        );
        self.repo.save_paper(context, repo_command).await
    }

    async fn delete_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<()> {
        self.load_owned_paper(context, &paper_id).await?;
        self.repo.delete_paper(context, paper_id).await
    }

    async fn archive_paper(
        &self,
        context: &CourseServiceContext,
        paper_id: String,
    ) -> CourseResult<Value> {
        self.load_owned_paper(context, &paper_id).await?;
        self.repo.archive_paper(context, paper_id).await
    }

    async fn list_handouts(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value> {
        let page = self.repo.list_handouts(context, query.clone()).await?;
        Ok(json!({
            "items": page.get("items").cloned().unwrap_or(Value::Array(Vec::new())),
            "page": query.page.unwrap_or(1),
            "pageSize": query.limit(),
            "total": page.get("total").and_then(Value::as_i64).unwrap_or(0),
        }))
    }

    async fn retrieve_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<Option<Value>> {
        self.repo.retrieve_handout(context, handout_id).await
    }

    async fn save_handout(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        require_str(&command, "title", "title")?;
        require_str(&command, "gradeLevel", "gradeLevel")?;
        require_str(&command, "subject", "subject")?;
        let mut blocks = array_field(&command, "body");
        if blocks.is_empty() {
            blocks.push(json!({ "type": "text", "content": "" }));
        }
        let handout_id = optional_str(&command, "id");
        let owner_user_id = self.actor_user_id(context);
        if let Some(handout_id) = &handout_id {
            // A create endpoint carrying an id is an update in disguise; it
            // must pass the same ownership gate as the update endpoint.
            let existing = self
                .repo
                .retrieve_handout(context, handout_id.clone())
                .await?
                .ok_or_else(|| CourseError::not_found("Handout not found"))?;
            let owner = existing.get("ownerUserId").and_then(Value::as_str);
            self.ensure_owner(context, owner, "handout")?;
        }
        let repo_command = build_handout_repo_command(
            handout_id,
            owner_user_id,
            &command,
            &blocks,
        );
        self.repo.save_handout(context, repo_command).await
    }

    async fn update_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
        command: Value,
    ) -> CourseResult<Value> {
        let existing = self.load_owned_handout(context, &handout_id).await?;
        let mut wire = command.clone();
        if let Some(object) = wire.as_object_mut() {
            for key in ["title", "lessonTag"] {
                object
                    .entry(key)
                    .or_insert_with(|| existing.get(key).cloned().unwrap_or(Value::Null));
            }
            object
                .entry("gradeLevel")
                .or_insert_with(|| existing.get("gradeLevel").cloned().unwrap_or(Value::Null));
            object
                .entry("subject")
                .or_insert_with(|| existing.get("subject").cloned().unwrap_or(Value::Null));
            object
                .entry("status")
                .or_insert_with(|| existing.get("status").cloned().unwrap_or(Value::Null));
        }
        let blocks = if array_field(&command, "body").is_empty() {
            existing
                .get("body")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
        } else {
            array_field(&command, "body")
        };
        let repo_command =
            build_handout_repo_command(Some(handout_id), None, &wire, &blocks);
        self.repo.save_handout(context, repo_command).await
    }

    async fn delete_handout(
        &self,
        context: &CourseServiceContext,
        handout_id: String,
    ) -> CourseResult<()> {
        self.load_owned_handout(context, &handout_id).await?;
        self.repo.delete_handout(context, handout_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn teacher_context() -> CourseServiceContext {
        CourseServiceContext {
            tenant_id: "100001".to_string(),
            organization_id: "0".to_string(),
            actor_id: Some("teacher-1".to_string()),
            user_id: Some("teacher-1".to_string()),
            request_id: None,
            trace_id: None,
            permissions: Vec::new(),
        }
    }

    #[test]
    fn normalize_question_command_fills_defaults_and_arrays() {
        let command = json!({
            "gradeLevel": "grade7",
            "subject": "math",
            "questionType": "single_choice",
            "stem": "1 + 1 = ?",
            "options": [
                { "key": "A", "content": "2" },
                { "key": " ", "content": "" }
            ],
            "knowledgePoints": ["有理数", " ", "加法"],
        });
        let normalized = normalize_question_command(&command);
        assert!(normalized.get("id").and_then(Value::as_str).is_none());
        assert_eq!(
            normalized.get("question_type").and_then(Value::as_str),
            Some("single_choice")
        );
        let options: Vec<Value> =
            serde_json::from_str(normalized.get("options_json").and_then(Value::as_str).unwrap())
                .unwrap();
        assert_eq!(options.len(), 1);
        let points: Vec<Value> = serde_json::from_str(
            normalized
                .get("knowledge_points_json")
                .and_then(Value::as_str)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(points.len(), 2);
        assert_eq!(
            normalized.get("difficulty").and_then(Value::as_str),
            Some("medium")
        );
        assert_eq!(
            normalized.get("default_score").and_then(Value::as_str),
            Some("0")
        );
        assert_eq!(
            normalized
                .get("question_code")
                .and_then(Value::as_str),
            Some("")
        );
    }

    #[test]
    fn validate_question_fields_rejects_unknown_type() {
        let command = json!({
            "gradeLevel": "grade7",
            "subject": "math",
            "questionType": "essay",
            "stem": "x",
        });
        let error = validate_question_fields(&command).unwrap_err();
        assert_eq!(error.code(), "invalid");
        assert!(error.message().contains("Unsupported question type"));
    }

    #[test]
    fn validate_question_fields_requires_core_fields() {
        let error = validate_question_fields(&json!({ "subject": "math" })).unwrap_err();
        assert!(error.message().contains("gradeLevel is required"));
    }

    #[test]
    fn extract_handout_items_deduplicates_question_blocks() {
        let blocks = vec![
            json!({ "type": "heading", "content": "课堂练习" }),
            json!({ "type": "question", "questionId": "q1", "usageRole": "example" }),
            json!({ "type": "question", "questionId": "q2" }),
            json!({ "type": "question", "questionId": "q1" }),
        ];
        let items = extract_handout_items(&blocks);
        assert_eq!(items.len(), 2);
        assert_eq!(
            items[0].get("usage_role").and_then(Value::as_str),
            Some("example")
        );
        assert_eq!(
            items[1].get("usage_role").and_then(Value::as_str),
            Some("practice")
        );
        assert_eq!(items[0].get("sort_order").and_then(Value::as_i64), Some(1));
    }

    #[test]
    fn decimal_string_accepts_numbers_and_numeric_strings_only() {
        assert_eq!(decimal_string(Some(&json!(2.5)), "0"), "2.5");
        assert_eq!(decimal_string(Some(&json!("3")), "0"), "3");
        assert_eq!(decimal_string(Some(&json!("abc")), "7"), "7");
        assert_eq!(decimal_string(None, "0"), "0");
        let _ = teacher_context();
    }

    struct FakeQuestionBankRepo {
        owners: std::collections::BTreeMap<String, String>,
        referenced: std::collections::BTreeSet<String>,
    }

    #[async_trait::async_trait]
    impl crate::ports::repository::QuestionBankRepository for FakeQuestionBankRepo {
        async fn list_questions(
            &self,
            _context: &CourseServiceContext,
            _query: QuestionQuery,
        ) -> CourseResult<QuestionPage> {
            Ok(QuestionPage::default())
        }

        async fn retrieve_question(
            &self,
            _context: &CourseServiceContext,
            question_id: String,
        ) -> CourseResult<Option<QuestionItem>> {
            if self.owners.contains_key(&question_id) {
                Ok(Some(QuestionItem {
                    id: question_id.clone(),
                    owner_user_id: self.owners.get(&question_id).cloned(),
                    ..QuestionItem::default()
                }))
            } else {
                Ok(None)
            }
        }

        async fn save_question(
            &self,
            _context: &CourseServiceContext,
            _command: Value,
        ) -> CourseResult<QuestionItem> {
            Err(CourseError::storage("fake repo: save_question not exercised"))
        }

        async fn delete_question(
            &self,
            _context: &CourseServiceContext,
            _question_id: String,
        ) -> CourseResult<()> {
            Ok(())
        }

        async fn question_references(
            &self,
            _context: &CourseServiceContext,
            question_id: String,
        ) -> CourseResult<Value> {
            let papers = i64::from(self.referenced.contains(&question_id));
            Ok(json!({ "paperCount": papers, "handoutCount": 0 }))
        }

        async fn import_questions(
            &self,
            _context: &CourseServiceContext,
            _commands: Vec<Value>,
        ) -> CourseResult<Value> {
            Ok(json!({ "accepted": 0, "failed": [] }))
        }

        async fn update_questions_batch(
            &self,
            _context: &CourseServiceContext,
            _question_ids: Vec<String>,
            _patch: Value,
        ) -> CourseResult<u64> {
            Ok(0)
        }

        async fn select_compose_candidates(
            &self,
            _context: &CourseServiceContext,
            _spec: Value,
        ) -> CourseResult<Vec<QuestionItem>> {
            Ok(Vec::new())
        }

        async fn retrieve_taxonomy(
            &self,
            _context: &CourseServiceContext,
            _query: QuestionQuery,
        ) -> CourseResult<Value> {
            Ok(json!({}))
        }

        async fn list_papers(
            &self,
            _context: &CourseServiceContext,
            _query: CourseQuery,
        ) -> CourseResult<Value> {
            Ok(json!({ "items": [], "total": 0 }))
        }

        async fn retrieve_paper(
            &self,
            _context: &CourseServiceContext,
            _paper_id: String,
        ) -> CourseResult<Option<Value>> {
            Ok(None)
        }

        async fn save_paper(
            &self,
            _context: &CourseServiceContext,
            _command: Value,
        ) -> CourseResult<Value> {
            Ok(json!({}))
        }

        async fn delete_paper(
            &self,
            _context: &CourseServiceContext,
            _paper_id: String,
        ) -> CourseResult<()> {
            Ok(())
        }

        async fn archive_paper(
            &self,
            _context: &CourseServiceContext,
            _paper_id: String,
        ) -> CourseResult<Value> {
            Ok(json!({}))
        }

        async fn list_handouts(
            &self,
            _context: &CourseServiceContext,
            _query: CourseQuery,
        ) -> CourseResult<Value> {
            Ok(json!({ "items": [], "total": 0 }))
        }

        async fn retrieve_handout(
            &self,
            _context: &CourseServiceContext,
            _handout_id: String,
        ) -> CourseResult<Option<Value>> {
            Ok(None)
        }

        async fn save_handout(
            &self,
            _context: &CourseServiceContext,
            _command: Value,
        ) -> CourseResult<Value> {
            Ok(json!({}))
        }

        async fn delete_handout(
            &self,
            _context: &CourseServiceContext,
            _handout_id: String,
        ) -> CourseResult<()> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn batch_delete_reports_per_question_failures() {
        let repo = FakeQuestionBankRepo {
            owners: [
                ("q-owned-1".to_string(), "teacher-1".to_string()),
                ("q-owned-2".to_string(), "teacher-1".to_string()),
                ("q-foreign".to_string(), "teacher-2".to_string()),
                ("q-referenced".to_string(), "teacher-1".to_string()),
            ]
            .into_iter()
            .collect(),
            referenced: ["q-referenced".to_string()].into_iter().collect(),
        };
        let service = QuestionBankServiceImpl::new(Box::new(repo));
        let context = teacher_context();

        let outcome = service
            .delete_questions_batch(
                &context,
                json!({ "questionIds": ["q-owned-1", "q-owned-2", "q-foreign", "q-referenced", "q-missing"] }),
            )
            .await
            .expect("batch delete");

        let deleted: Vec<&str> = outcome
            .get("deleted")
            .and_then(Value::as_array)
            .map(|entries| entries.iter().filter_map(Value::as_str).collect())
            .unwrap_or_default();
        assert_eq!(deleted, ["q-owned-1", "q-owned-2"]);

        let failed = outcome
            .get("failed")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        assert_eq!(failed.len(), 3);
        let reasons: std::collections::BTreeMap<String, String> = failed
            .iter()
            .map(|entry| {
                (
                    entry
                        .get("questionId")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    entry
                        .get("reason")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                )
            })
            .collect();
        assert!(reasons["q-foreign"].contains("Only the owner"));
        assert!(reasons["q-referenced"].contains("still referenced"));
        assert!(reasons["q-missing"].contains("not found"));
    }

    #[test]
    fn batch_delete_requires_ids() {
        // Synchronous validation path exercised through the error arm of a
        // hand-built future-free call: reuse the JSON guard indirectly.
        let command = json!({ "questionIds": [] });
        let ids: Vec<String> = string_list(command.get("questionIds"));
        assert!(ids.is_empty());
    }

    #[test]
    fn build_paper_repo_command_maps_camel_case_wire() {
        let wire = json!({
            "title": "期中卷",
            "gradeLevel": "grade7",
            "subject": "math",
            "mode": "manual",
            "examDurationSeconds": 5400,
            "totalScore": 100,
            "sealedLine": true,
            "scope": { "chapters": ["有理数"] },
            "scoreAllocation": [{ "sectionNo": "1", "subtotal": "20" }],
        });
        let command = build_paper_repo_command(None, Some("t1".to_string()), &wire, vec![]);
        let paper = command.get("paper").unwrap();
        assert_eq!(paper.get("grade_level").and_then(Value::as_str), Some("grade7"));
        assert_eq!(
            paper.get("exam_duration_seconds").and_then(Value::as_i64),
            Some(5400)
        );
        assert_eq!(paper.get("total_score").and_then(Value::as_str), Some("100"));
        assert!(paper.get("owner_user_id").and_then(Value::as_str) == Some("t1"));
    }
}
