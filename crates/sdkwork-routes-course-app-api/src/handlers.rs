use serde_json::Value;

use crate::error::{CourseRouteError, CourseRouteResult};
use sdkwork_content_course_service::{
    CourseApplicationService, CourseEnrollmentCommand, CourseLessonProgressCommand, CourseQuery,
    CourseServiceContext, CourseStudioDraftCommand,
};

pub(crate) fn ok(data: Value) -> Value {
    data
}

pub async fn course_categories_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_categories(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_categories_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    category_id: String,
) -> CourseRouteResult<Value> {
    let item = service.retrieve_category(context, category_id).await?;
    match item {
        Some(category) => Ok(ok(serde_json::to_value(category).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Course category not found")),
    }
}

pub async fn courses_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    mut query: CourseQuery,
) -> CourseRouteResult<Value> {
    // The learner catalog never exposes drafts or review state. Authoring has
    // its own `/studio/courses` surface.
    query.status = Some("published".to_string());
    query.author_user_id = None;
    let page = service.list_courses(context, query).await?;
    Ok(ok(serde_json::to_value(page).unwrap_or_default()))
}

pub async fn courses_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.retrieve_course(context, course_id).await?;
    match item {
        Some(course) if course.publish_status == "published" => {
            Ok(ok(serde_json::to_value(course).unwrap_or_default()))
        }
        _ => Err(CourseRouteError::not_found("Course not found")),
    }
}

pub async fn course_curriculum_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let curriculum = service.retrieve_curriculum(context, course_id).await?;
    match curriculum {
        Some(curriculum) => Ok(ok(serde_json::to_value(curriculum).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Course not found")),
    }
}

pub async fn course_collection_items_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let course = service
        .retrieve_course(context, course_id.clone())
        .await?
        .filter(|course| course.publish_status == "published")
        .ok_or_else(|| CourseRouteError::not_found("Course not found"))?;
    if course.kind != "collection" {
        return Err(CourseRouteError::invalid(
            "Course is not a collection".to_string(),
        ));
    }
    let items = service
        .list_collection_items(context, course_id)
        .await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_offerings_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let items = service.list_offerings(context, course_id).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_offerings_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    offering_id: String,
) -> CourseRouteResult<Value> {
    let item = service.retrieve_offering(context, offering_id).await?;
    match item {
        Some(offering) => Ok(ok(serde_json::to_value(offering).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Offering not found")),
    }
}

pub async fn course_enrollments_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    offering_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let command = CourseEnrollmentCommand {
        offering_id,
        learner_user_id: context.user_id.clone().unwrap_or_default(),
        source: body
            .get("source")
            .and_then(|v| v.as_str())
            .unwrap_or("self_service")
            .to_string(),
        idempotency_key: body
            .get("idempotencyKey")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };
    let enrollment_id = service.enroll(context, command).await?;
    Ok(ok(
        serde_json::json!({ "enrollmentId": enrollment_id }),
    ))
}

pub async fn course_enrollments_current_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let user_id = context
        .user_id
        .clone()
        .ok_or_else(|| CourseRouteError::invalid("An authenticated user is required".to_string()))?;
    let items = service.list_enrollments(context, query).await?;
    let owned = items
        .into_iter()
        .filter(|item| {
            item.get("userId")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|value| value == user_id.as_str())
        })
        .collect::<Vec<_>>();
    Ok(ok(serde_json::to_value(owned).unwrap_or_default()))
}

pub async fn course_enrollments_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    enrollment_id: String,
) -> CourseRouteResult<Value> {
    let result = service.retrieve_enrollment(context, enrollment_id).await?;
    Ok(ok(serde_json::to_value(result).unwrap_or_default()))
}

pub async fn course_enrollments_cancel(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    enrollment_id: String,
) -> CourseRouteResult<Value> {
    service.revoke_enrollment(context, enrollment_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_sections_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let items = service.list_sections(context, course_id).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_lessons_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let items = service.list_lessons(context, course_id).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_lessons_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
) -> CourseRouteResult<Value> {
    let result = service.retrieve_lesson(context, lesson_id).await?;
    match result {
        Some(lesson) => Ok(ok(serde_json::to_value(lesson).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Lesson not found")),
    }
}

pub async fn course_lesson_resources_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
) -> CourseRouteResult<Value> {
    let result = service
        .list_resources(context, "lesson".to_string(), lesson_id)
        .await?;
    Ok(ok(serde_json::to_value(result).unwrap_or_default()))
}

pub async fn course_progress_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    enrollment_id: String,
) -> CourseRouteResult<Value> {
    let item = service.retrieve_progress(context, enrollment_id).await?;
    match item {
        Some(progress) => Ok(ok(progress)),
        None => Err(CourseRouteError::not_found("Course progress not found")),
    }
}

pub async fn course_lesson_progress_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let completed = body.get("completed").and_then(Value::as_bool);
    let progress_status = if let Some(status) = body.get("progressStatus").and_then(Value::as_str) {
        serde_json::from_value(serde_json::json!(status)).unwrap_or_default()
    } else if completed == Some(true) {
        sdkwork_content_course_service::CourseProgressStatus::Completed
    } else if body.get("watchedSeconds").is_some() || body.get("watchSeconds").is_some() {
        sdkwork_content_course_service::CourseProgressStatus::InProgress
    } else {
        sdkwork_content_course_service::CourseProgressStatus::NotStarted
    };
    let command = CourseLessonProgressCommand {
        enrollment_id: body
            .get("enrollmentId")
            .or_else(|| body.get("enrollment_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        lesson_id,
        progress_status,
        watched_seconds: body
            .get("watchedSeconds")
            .or_else(|| body.get("watchSeconds"))
            .and_then(|v| v.as_i64()),
        watch_position_seconds: body
            .get("watchPositionSeconds")
            .or_else(|| body.get("positionSeconds"))
            .and_then(|v| v.as_i64()),
        completed_at: body
            .get("completedAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        idempotency_key: None,
    };
    let response = serde_json::to_value(&command).unwrap_or_default();
    service.update_lesson_progress(context, command).await?;
    Ok(ok(response))
}

pub async fn course_lesson_progress_watch_positions_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let command = CourseLessonProgressCommand {
        enrollment_id: body
            .get("enrollmentId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        lesson_id,
        progress_status: sdkwork_content_course_service::CourseProgressStatus::InProgress,
        watched_seconds: None,
        watch_position_seconds: body
            .get("watchPositionSeconds")
            .or_else(|| body.get("positionSeconds"))
            .and_then(|v| v.as_i64()),
        completed_at: None,
        idempotency_key: None,
    };
    let response = serde_json::to_value(&command).unwrap_or_default();
    service.update_lesson_progress(context, command).await?;
    Ok(ok(response))
}

pub async fn course_live_sessions_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_live_sessions(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_live_sessions_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    let item = service
        .retrieve_live_session(context, live_session_id)
        .await?;
    match item {
        Some(session) => Ok(ok(serde_json::to_value(session).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Live session not found")),
    }
}

pub async fn course_live_sessions_join(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    let grant = service.join_live_session(context, live_session_id).await?;
    Ok(ok(serde_json::json!({
        "liveSessionId": grant.live_session_id,
    })))
}

pub async fn course_live_sessions_heartbeat(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    service
        .heartbeat_live_session(context, live_session_id)
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_live_sessions_leave(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    service.leave_live_session(context, live_session_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_live_sessions_replay_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    let result = service
        .retrieve_live_session_replay(context, live_session_id)
        .await?;
    match result {
        Some(replay) => Ok(ok(replay)),
        None => Err(CourseRouteError::not_found("Replay not found")),
    }
}

pub async fn course_engagement_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.course_engagement(context, course_id).await?;
    Ok(ok(item))
}

pub async fn course_reactions_replace(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let result = service.save_reaction(context, body).await?;
    Ok(ok(result))
}

pub async fn course_reactions_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    reaction_id: String,
) -> CourseRouteResult<Value> {
    service.delete_reaction(context, reaction_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_applications_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let request = sdkwork_content_course_service::CourseApplicationCreateRequest {
        title: body
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        category: body
            .get("category")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        description: body
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        source_provider: body
            .get("sourceProvider")
            .and_then(|v| v.as_str())
            .unwrap_or("manual")
            .to_string(),
        external_bvid: body
            .get("externalBvid")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        contact_name: body
            .get("contactName")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        contact_email: body
            .get("contactEmail")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        metadata: body.get("metadata").cloned(),
    };
    let item = service.submit_application(context, request).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn course_applications_current_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    mut query: CourseQuery,
) -> CourseRouteResult<Value> {
    query.applicant_user_id = context.user_id.clone();
    if query.applicant_user_id.is_none() {
        return Err(CourseRouteError::invalid(
            "An authenticated user is required".to_string(),
        ));
    }
    let items = service.list_applications(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_applications_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    application_id: String,
) -> CourseRouteResult<Value> {
    let result = service
        .retrieve_application(context, application_id)
        .await?;
    match result {
        Some(application)
            if application.applicant_user_id.as_deref() == context.user_id.as_deref() =>
        {
            Ok(ok(serde_json::to_value(application).unwrap_or_default()))
        }
        _ => Err(CourseRouteError::not_found("Application not found")),
    }
}
// ── Studio (creator authoring) ──────────────────────────────────────

pub async fn studio_courses_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    mut query: CourseQuery,
) -> CourseRouteResult<Value> {
    query.author_user_id = context.user_id.clone();
    if query.author_user_id.is_none() {
        return Err(CourseRouteError::invalid(
            "An authenticated creator is required".to_string(),
        ));
    }
    let page = service.list_courses(context, query).await?;
    Ok(ok(serde_json::to_value(page).unwrap_or_default()))
}

pub async fn studio_courses_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseStudioDraftCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.course_id = None;
    let item = service.save_studio_course(context, command).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn studio_courses_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let detail = service.retrieve_studio_course(context, course_id).await?;
    match detail {
        Some(detail) => Ok(ok(serde_json::to_value(detail).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Course not found")),
    }
}

pub async fn studio_courses_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseStudioDraftCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.course_id = Some(course_id);
    let item = service.save_studio_course(context, command).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn studio_courses_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let owned = service
        .retrieve_studio_course(context, course_id.clone())
        .await?;
    if owned.is_none() {
        return Err(CourseRouteError::not_found("Course not found"));
    }
    service.delete_course(context, course_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn studio_courses_submit(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.submit_course(context, course_id).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn studio_courses_withdraw(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.withdraw_course(context, course_id).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}
