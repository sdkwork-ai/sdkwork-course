use serde_json::Value;

use crate::error::{CourseRouteError, CourseRouteResult};
use sdkwork_content_course_service::{
    CourseApplicationService, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLiveSessionCommand, CourseOfferingCommand, CourseQuery, CourseServiceContext,
};

fn ok(data: Value) -> Value {
    data
}

// ── Categories ──────────────────────────────────────────────────────

pub async fn course_categories_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_categories(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_categories_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let result = service.save_category(context, body).await?;
    Ok(ok(result))
}

pub async fn course_categories_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _category_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut cmd = body;
    if let Some(obj) = cmd.as_object_mut() {
        obj.insert("id".to_string(), serde_json::json!(_category_id));
    }
    let result = service.save_category(context, cmd).await?;
    Ok(ok(result))
}

pub async fn course_categories_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    category_id: String,
) -> CourseRouteResult<Value> {
    service.delete_category(context, category_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_categories_reorder(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let result = service.reorder_categories(context, body).await?;
    Ok(ok(result))
}

// ── Instructors ─────────────────────────────────────────────────────

pub async fn course_instructors_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let result = service.list_instructors(context, query).await?;
    Ok(ok(serde_json::to_value(result).unwrap_or_default()))
}

pub async fn course_instructors_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let result = service.save_instructor(context, body).await?;
    Ok(ok(result))
}

pub async fn course_instructors_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    instructor_id: String,
) -> CourseRouteResult<Value> {
    let result = service.retrieve_instructor(context, instructor_id).await?;
    match result {
        Some(instructor) => Ok(ok(instructor)),
        None => Err(CourseRouteError::not_found("Instructor not found")),
    }
}

pub async fn course_instructors_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    instructor_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut cmd = body;
    if let Some(obj) = cmd.as_object_mut() {
        obj.insert("id".to_string(), serde_json::json!(instructor_id));
    }
    let result = service.save_instructor(context, cmd).await?;
    Ok(ok(result))
}

pub async fn course_instructors_status_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    instructor_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let result = service
        .update_instructor_status(context, instructor_id, body)
        .await?;
    Ok(ok(result))
}

// ── Courses ─────────────────────────────────────────────────────────

pub async fn courses_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let page = service.list_courses(context, query).await?;
    Ok(ok(serde_json::to_value(page).unwrap_or_default()))
}

pub async fn courses_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let command: CourseCatalogCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    let item = service.create_course(context, command).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn courses_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.retrieve_course(context, course_id).await?;
    match item {
        Some(course) => Ok(ok(serde_json::to_value(course).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Course not found")),
    }
}

pub async fn courses_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut cmd: CourseCatalogCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    cmd.course_id = Some(_course_id);
    let item = service.save_course(context, cmd).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn courses_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    service.delete_course(context, course_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn courses_publish(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.publish_course(context, course_id).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn courses_unpublish(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let item = service.unpublish_course(context, course_id).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

// ── Offerings ───────────────────────────────────────────────────────

pub async fn course_offerings_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let items = service.list_offerings(context, course_id).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_offerings_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseOfferingCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.course_id = _course_id;
    let id = service.save_offering(context, command).await?;
    Ok(ok(serde_json::json!({ "offeringId": id })))
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

pub async fn course_offerings_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _offering_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseOfferingCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.offering_id = Some(_offering_id);
    let id = service.save_offering(context, command).await?;
    Ok(ok(serde_json::json!({ "offeringId": id })))
}

pub async fn course_offerings_publish(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    offering_id: String,
) -> CourseRouteResult<Value> {
    service
        .transition_offering(context, offering_id, "published".to_string())
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_offerings_close(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    offering_id: String,
) -> CourseRouteResult<Value> {
    service
        .transition_offering(context, offering_id, "closed".to_string())
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_offerings_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    offering_id: String,
) -> CourseRouteResult<Value> {
    service.delete_offering(context, offering_id).await?;
    Ok(ok(serde_json::json!(null)))
}

// ── Sections ────────────────────────────────────────────────────────

pub async fn course_sections_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let items = service.list_sections(context, course_id).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_sections_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let item = service.save_section(context, course_id, body).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn course_sections_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    section_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut cmd = body;
    if let Some(obj) = cmd.as_object_mut() {
        obj.insert("id".to_string(), serde_json::json!(section_id));
    }
    let course_id = cmd
        .get("courseId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let item = service.save_section(context, course_id, cmd).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn course_sections_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    section_id: String,
) -> CourseRouteResult<Value> {
    service.delete_section(context, section_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_sections_reorder(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let section_ids: Vec<String> = body
        .get("sectionIds")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    let items = service
        .reorder_sections(context, course_id, section_ids)
        .await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

// ── Lessons ─────────────────────────────────────────────────────────

pub async fn course_lessons_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let items = service.list_lessons(context, course_id).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_lessons_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseLessonCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.course_id = _course_id;
    let item = service.save_lesson(context, command).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
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

pub async fn course_lessons_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseLessonCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.lesson_id = Some(lesson_id);
    let item = service.save_lesson(context, command).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn course_lessons_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
) -> CourseRouteResult<Value> {
    service.delete_lesson(context, lesson_id).await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_lessons_reorder(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let lesson_ids: Vec<String> = body
        .get("lessonIds")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    let items = service
        .reorder_lessons(context, course_id, lesson_ids)
        .await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

// ── Resources ───────────────────────────────────────────────────────

pub async fn course_resources_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_id: String,
) -> CourseRouteResult<Value> {
    let result = service
        .list_resources(context, "lesson".to_string(), lesson_id)
        .await?;
    Ok(ok(serde_json::to_value(result).unwrap_or_default()))
}

pub async fn course_resources_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _lesson_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut cmd = body;
    if let Some(obj) = cmd.as_object_mut() {
        obj.insert("owner_type".to_string(), serde_json::json!("lesson"));
        obj.insert("owner_id".to_string(), serde_json::json!(_lesson_id));
    }
    let result = service.save_resource_ref(context, cmd).await?;
    Ok(ok(result))
}

pub async fn course_resources_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _resource_ref_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut cmd = body;
    if let Some(obj) = cmd.as_object_mut() {
        obj.insert("id".to_string(), serde_json::json!(_resource_ref_id));
    }
    let result = service.save_resource_ref(context, cmd).await?;
    Ok(ok(result))
}

pub async fn course_resources_delete(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    resource_ref_id: String,
) -> CourseRouteResult<Value> {
    service
        .delete_resource_ref(context, resource_ref_id)
        .await?;
    Ok(ok(serde_json::json!(null)))
}

// ── Live Sessions ───────────────────────────────────────────────────

pub async fn course_live_sessions_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_live_sessions(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_live_sessions_create(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let command: CourseLiveSessionCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    let id = service.save_live_session(context, command).await?;
    Ok(ok(serde_json::json!({ "liveSessionId": id })))
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

pub async fn course_live_sessions_update(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    _live_session_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let mut command: CourseLiveSessionCommand =
        serde_json::from_value(body).map_err(|e| CourseRouteError::invalid(e.to_string()))?;
    command.live_session_id = Some(_live_session_id);
    let id = service.save_live_session(context, command).await?;
    Ok(ok(serde_json::json!({ "liveSessionId": id })))
}

pub async fn course_live_sessions_start(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    service
        .transition_live_session(context, live_session_id, "live".to_string())
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_live_sessions_end(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    service
        .transition_live_session(context, live_session_id, "ended".to_string())
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_live_sessions_cancel(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    service
        .transition_live_session(context, live_session_id, "cancelled".to_string())
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_live_sessions_replay_attach(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let resource_ref_id = body
        .get("resourceRefId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    service
        .attach_live_replay(context, live_session_id, resource_ref_id)
        .await?;
    Ok(ok(serde_json::json!(null)))
}

pub async fn course_live_sessions_replay_publish(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    live_session_id: String,
) -> CourseRouteResult<Value> {
    service
        .transition_live_session(context, live_session_id, "replay_ready".to_string())
        .await?;
    Ok(ok(serde_json::json!(null)))
}

// ── Enrollments ─────────────────────────────────────────────────────

pub async fn course_enrollments_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_enrollments(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_enrollments_grant(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    body: Value,
) -> CourseRouteResult<Value> {
    let command = CourseEnrollmentCommand {
        offering_id: body
            .get("offeringId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        learner_user_id: body
            .get("learnerUserId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        source: "admin_grant".to_string(),
        idempotency_key: body
            .get("idempotencyKey")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };
    let id = service.enroll(context, command).await?;
    Ok(ok(serde_json::json!({ "enrollmentId": id })))
}

pub async fn course_enrollments_revoke(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    enrollment_id: String,
) -> CourseRouteResult<Value> {
    service.revoke_enrollment(context, enrollment_id).await?;
    Ok(ok(serde_json::json!(null)))
}

// ── Progress ────────────────────────────────────────────────────────

pub async fn course_progress_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_progress(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_progress_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    enrollment_id: String,
) -> CourseRouteResult<Value> {
    let item = service.retrieve_progress(context, enrollment_id).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn course_lesson_progress_repair(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    lesson_progress_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    service
        .repair_lesson_progress(context, lesson_progress_id, body)
        .await?;
    Ok(ok(serde_json::json!(null)))
}

// ── Comments ────────────────────────────────────────────────────────

pub async fn course_reactions_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_reactions(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

// ── Applications ────────────────────────────────────────────────────

pub async fn course_applications_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
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
        Some(application) => Ok(ok(serde_json::to_value(application).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Application not found")),
    }
}

pub async fn course_applications_review(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    application_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let status = body
        .get("status")
        .or_else(|| body.get("reviewStatus"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if !matches!(status.as_str(), "approved" | "rejected") {
        return Err(CourseRouteError::invalid(
            "status must be approved or rejected".to_string(),
        ));
    }
    let review_note = body
        .get("reviewNote")
        .or_else(|| body.get("review_note"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    if status == "rejected" && review_note.is_none() {
        return Err(CourseRouteError::invalid(
            "A review note is required when rejecting an application".to_string(),
        ));
    }
    let request = sdkwork_content_course_service::CourseApplicationReviewRequest {
        status,
        review_note,
    };
    let item = service
        .review_application(context, application_id, request)
        .await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn course_applications_convert_to_course(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    application_id: String,
) -> CourseRouteResult<Value> {
    let item = service
        .convert_application_to_course(context, application_id)
        .await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

// ── Reports ─────────────────────────────────────────────────────────

pub async fn course_reports_overview_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
) -> CourseRouteResult<Value> {
    let data = service.list_reports_overview(context).await?;
    Ok(ok(data))
}

pub async fn course_reports_learning_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let data = service.list_reports_learning(context, query).await?;
    Ok(ok(data))
}

pub async fn course_reports_live_sessions_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let data = service.list_reports_live_sessions(context, query).await?;
    Ok(ok(data))
}

// ── Audit Logs ──────────────────────────────────────────────────────

pub async fn course_audit_logs_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let items = service.list_audit_logs(context, query).await?;
    Ok(ok(serde_json::to_value(items).unwrap_or_default()))
}

pub async fn course_audit_logs_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    audit_log_id: String,
) -> CourseRouteResult<Value> {
    let result = service.retrieve_audit_log(context, audit_log_id).await?;
    match result {
        Some(audit_log) => Ok(ok(serde_json::to_value(audit_log).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Audit log not found")),
    }
}
// ── Review workflow ─────────────────────────────────────────────────

pub async fn course_reviews_list(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    query: CourseQuery,
) -> CourseRouteResult<Value> {
    let page = service.list_review_courses(context, query).await?;
    Ok(ok(serde_json::to_value(page).unwrap_or_default()))
}

pub async fn course_reviews_stats(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
) -> CourseRouteResult<Value> {
    let stats = service.review_stats(context).await?;
    Ok(ok(stats))
}

pub async fn course_reviews_retrieve(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
) -> CourseRouteResult<Value> {
    let detail = service.retrieve_review_course(context, course_id).await?;
    match detail {
        Some(detail) => Ok(ok(serde_json::to_value(detail).unwrap_or_default())),
        None => Err(CourseRouteError::not_found("Course not found")),
    }
}

pub async fn course_reviews_review(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let decision = body
        .get("decision")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    if decision.is_empty() {
        return Err(CourseRouteError::invalid(
            "decision is required".to_string(),
        ));
    }
    let note = body
        .get("note")
        .and_then(|value| value.as_str())
        .map(str::to_owned);
    let item = service
        .review_course(
            context,
            course_id,
            sdkwork_content_course_service::CourseReviewDecisionCommand { decision, note },
        )
        .await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}

pub async fn courses_offline(
    service: &dyn CourseApplicationService,
    context: &CourseServiceContext,
    course_id: String,
    body: Value,
) -> CourseRouteResult<Value> {
    let note = body
        .get("note")
        .and_then(|value| value.as_str())
        .map(str::to_owned);
    let item = service.offline_course(context, course_id, note).await?;
    Ok(ok(serde_json::to_value(item).unwrap_or_default()))
}
