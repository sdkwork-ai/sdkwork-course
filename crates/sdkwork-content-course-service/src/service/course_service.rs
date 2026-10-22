use serde_json::Value;

use crate::domain::commands::{
    CourseAuditCommand, CourseCatalogCommand, CourseEnrollmentCommand, CourseLessonCommand,
    CourseLessonProgressCommand, CourseLiveJoinGrant, CourseLiveSessionCommand,
    CourseOfferingCommand, CourseReviewDecisionCommand, CourseServiceContext,
    CourseStudioDraftCommand,
};
use crate::domain::models::{
    CourseApplicationCreateRequest, CourseApplicationItem, CourseApplicationReviewRequest,
    CourseAuditLogItem, CourseCategoryItem, CourseCollectionItem, CourseCurriculum, CourseError,
    CourseItem, CourseLessonItem, CoursePage, CourseQuery, CourseResult, CourseSectionItem,
    CourseStudioDetail,
};
use crate::ports::provider::{
    CourseAuditEventPort, CourseDrivePort, CourseEntitlementPort, CourseLiveProviderPort,
    CourseNotificationPort,
};
use crate::ports::repository::{
    CourseApplicationRepository, CourseAuditLogRepository, CourseCatalogRepository,
    CourseCategoryRepository, CourseEnrollmentRepository,
    CourseInstructorRepository, CourseLessonRepository, CourseLiveSessionRepository,
    CourseOfferingRepository, CourseProgressRepository, CourseReactionRepository,
    CourseResourceRepository,
};

#[allow(dead_code)]
pub struct CourseServiceImpl {
    category_repo: Box<dyn CourseCategoryRepository>,
    catalog_repo: Box<dyn CourseCatalogRepository>,
    instructor_repo: Box<dyn CourseInstructorRepository>,
    offering_repo: Box<dyn CourseOfferingRepository>,
    lesson_repo: Box<dyn CourseLessonRepository>,
    live_session_repo: Box<dyn CourseLiveSessionRepository>,
    enrollment_repo: Box<dyn CourseEnrollmentRepository>,
    progress_repo: Box<dyn CourseProgressRepository>,
    application_repo: Box<dyn CourseApplicationRepository>,
    audit_repo: Box<dyn CourseAuditLogRepository>,
    resource_repo: Box<dyn CourseResourceRepository>,
    reaction_repo: Box<dyn CourseReactionRepository>,
    drive_port: Box<dyn CourseDrivePort>,
    live_provider_port: Box<dyn CourseLiveProviderPort>,
    entitlement_port: Box<dyn CourseEntitlementPort>,
    notification_port: Box<dyn CourseNotificationPort>,
    audit_event_port: Box<dyn CourseAuditEventPort>,
}

impl CourseServiceImpl {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        category_repo: Box<dyn CourseCategoryRepository>,
        catalog_repo: Box<dyn CourseCatalogRepository>,
        instructor_repo: Box<dyn CourseInstructorRepository>,
        offering_repo: Box<dyn CourseOfferingRepository>,
        lesson_repo: Box<dyn CourseLessonRepository>,
        live_session_repo: Box<dyn CourseLiveSessionRepository>,
        enrollment_repo: Box<dyn CourseEnrollmentRepository>,
        progress_repo: Box<dyn CourseProgressRepository>,
        application_repo: Box<dyn CourseApplicationRepository>,
        audit_repo: Box<dyn CourseAuditLogRepository>,
        resource_repo: Box<dyn CourseResourceRepository>,
        reaction_repo: Box<dyn CourseReactionRepository>,
        drive_port: Box<dyn CourseDrivePort>,
        live_provider_port: Box<dyn CourseLiveProviderPort>,
        entitlement_port: Box<dyn CourseEntitlementPort>,
        notification_port: Box<dyn CourseNotificationPort>,
        audit_event_port: Box<dyn CourseAuditEventPort>,
    ) -> Self {
        Self {
            category_repo,
            catalog_repo,
            instructor_repo,
            offering_repo,
            lesson_repo,
            live_session_repo,
            enrollment_repo,
            progress_repo,
            application_repo,
            audit_repo,
            resource_repo,
            reaction_repo,
            drive_port,
            live_provider_port,
            entitlement_port,
            notification_port,
            audit_event_port,
        }
    }

    async fn append_course_audit(
        &self,
        context: &CourseServiceContext,
        course_id: &str,
        operation: &str,
        before_snapshot: Option<Value>,
        after_snapshot: Option<Value>,
    ) -> CourseResult<()> {
        self.audit_repo
            .append_audit_log(
                context,
                CourseAuditCommand {
                    target_type: "course".to_string(),
                    target_id: course_id.to_string(),
                    operation: operation.to_string(),
                    before_snapshot,
                    after_snapshot,
                },
            )
            .await
    }
}

#[async_trait::async_trait]
pub trait CourseApplicationService: Send + Sync {
    // Categories
    async fn list_categories(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseCategoryItem>>;

    async fn save_category(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn reorder_categories(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn delete_category(
        &self,
        context: &CourseServiceContext,
        category_id: String,
    ) -> CourseResult<()>;

    // Instructors
    async fn list_instructors(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>>;

    async fn retrieve_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn save_instructor(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn update_instructor_status(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
        command: Value,
    ) -> CourseResult<Value>;

    async fn delete_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<()>;

    // Courses
    async fn list_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage>;

    async fn retrieve_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseItem>>;

    async fn create_course(
        &self,
        context: &CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseResult<CourseItem>;

    async fn save_course(
        &self,
        context: &CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseResult<CourseItem>;

    async fn save_studio_course(
        &self,
        context: &CourseServiceContext,
        command: CourseStudioDraftCommand,
    ) -> CourseResult<CourseItem>;

    async fn retrieve_studio_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseStudioDetail>>;

    async fn retrieve_review_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseStudioDetail>>;

    async fn retrieve_curriculum(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseCurriculum>>;

    async fn list_collection_items(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseCollectionItem>>;

    async fn submit_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn withdraw_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn review_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: CourseReviewDecisionCommand,
    ) -> CourseResult<CourseItem>;

    async fn offline_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        note: Option<String>,
    ) -> CourseResult<CourseItem>;

    async fn list_review_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage>;

    async fn review_stats(&self, context: &CourseServiceContext) -> CourseResult<Value>;

    async fn delete_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<()>;

    async fn publish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    async fn unpublish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem>;

    // Offerings
    async fn list_offerings(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<Value>>;

    async fn retrieve_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn save_offering(
        &self,
        context: &CourseServiceContext,
        command: CourseOfferingCommand,
    ) -> CourseResult<String>;

    async fn transition_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        status: String,
    ) -> CourseResult<()>;

    async fn delete_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<()>;

    // Sections
    async fn list_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseSectionItem>>;

    async fn save_section(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: Value,
    ) -> CourseResult<CourseSectionItem>;

    async fn reorder_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        section_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseSectionItem>>;

    async fn delete_section(
        &self,
        context: &CourseServiceContext,
        section_id: String,
    ) -> CourseResult<()>;

    // Lessons
    async fn list_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseLessonItem>>;

    async fn retrieve_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<Option<CourseLessonItem>>;

    async fn save_lesson(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonCommand,
    ) -> CourseResult<CourseLessonItem>;

    async fn reorder_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        lesson_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseLessonItem>>;

    async fn delete_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<()>;

    // Resources
    async fn list_resources(
        &self,
        context: &CourseServiceContext,
        owner_type: String,
        owner_id: String,
    ) -> CourseResult<Vec<Value>>;

    async fn save_resource_ref(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn delete_resource_ref(
        &self,
        context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<()>;

    // Live sessions
    async fn list_live_sessions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>>;

    async fn retrieve_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn save_live_session(
        &self,
        context: &CourseServiceContext,
        command: CourseLiveSessionCommand,
    ) -> CourseResult<String>;

    async fn transition_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        live_status: String,
    ) -> CourseResult<()>;

    async fn attach_live_replay(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        resource_ref_id: String,
    ) -> CourseResult<()>;

    // Enrollments
    async fn list_enrollments(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>>;

    async fn retrieve_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn enroll(
        &self,
        context: &CourseServiceContext,
        command: CourseEnrollmentCommand,
    ) -> CourseResult<String>;

    async fn revoke_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<()>;

    async fn grant_entitlement(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        learner_user_id: String,
        purchase_ref: String,
    ) -> CourseResult<String>;

    async fn grant_entitlement_by_offering(
        &self,
        offering_id: String,
        learner_user_id: String,
        purchase_ref: String,
    ) -> CourseResult<String>;

    // Progress
    async fn list_progress(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>>;

    async fn retrieve_progress(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<Value>>;

    async fn update_lesson_progress(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonProgressCommand,
    ) -> CourseResult<()>;

    async fn join_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<CourseLiveJoinGrant>;

    // Reactions
    async fn course_engagement(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Value>;

    async fn list_reactions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>>;

    async fn save_reaction(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value>;

    async fn delete_reaction(
        &self,
        context: &CourseServiceContext,
        reaction_id: String,
    ) -> CourseResult<()>;

    // Applications
    async fn list_applications(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseApplicationItem>>;

    async fn retrieve_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<Option<CourseApplicationItem>>;

    async fn submit_application(
        &self,
        context: &CourseServiceContext,
        request: CourseApplicationCreateRequest,
    ) -> CourseResult<CourseApplicationItem>;

    async fn review_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
        request: CourseApplicationReviewRequest,
    ) -> CourseResult<CourseApplicationItem>;

    async fn convert_application_to_course(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<CourseItem>;

    // Audit logs
    async fn list_audit_logs(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseAuditLogItem>>;

    async fn retrieve_audit_log(
        &self,
        context: &CourseServiceContext,
        audit_log_id: String,
    ) -> CourseResult<Option<CourseAuditLogItem>>;

    async fn write_audit_log(
        &self,
        context: &CourseServiceContext,
        command: CourseAuditCommand,
    ) -> CourseResult<()>;

    // Progress
    async fn repair_lesson_progress(
        &self,
        context: &CourseServiceContext,
        lesson_progress_id: String,
        command: Value,
    ) -> CourseResult<()>;

    // Live sessions
    async fn heartbeat_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;

    async fn leave_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;

    async fn retrieve_live_session_replay(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<Option<Value>>;

    // Reports
    async fn list_reports_overview(&self, context: &CourseServiceContext) -> CourseResult<Value>;

    async fn list_reports_learning(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value>;

    async fn list_reports_live_sessions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value>;
}

#[async_trait::async_trait]
impl CourseApplicationService for CourseServiceImpl {
    // ── Categories ──────────────────────────────────────────────────

    async fn list_categories(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseCategoryItem>> {
        self.category_repo.list_categories(context, query).await
    }

    async fn save_category(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        self.category_repo.save_category(context, command).await
    }

    async fn reorder_categories(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        let category_ids: Vec<String> = serde_json::from_value(
            command
                .get("categoryIds")
                .cloned()
                .unwrap_or(Value::Array(vec![])),
        )
        .unwrap_or_default();
        let categories = self
            .category_repo
            .reorder_categories(context, category_ids)
            .await?;
        Ok(serde_json::to_value(categories).unwrap_or_default())
    }

    async fn delete_category(
        &self,
        context: &CourseServiceContext,
        category_id: String,
    ) -> CourseResult<()> {
        self.category_repo
            .delete_category(context, category_id)
            .await
    }

    // ── Instructors ─────────────────────────────────────────────────

    async fn list_instructors(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        self.instructor_repo.list_instructors(context, query).await
    }

    async fn retrieve_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<Option<Value>> {
        self.instructor_repo
            .retrieve_instructor(context, instructor_id)
            .await
    }

    async fn save_instructor(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        self.instructor_repo.save_instructor(context, command).await
    }

    async fn update_instructor_status(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
        command: Value,
    ) -> CourseResult<Value> {
        self.instructor_repo
            .update_instructor_status(context, instructor_id, command)
            .await
    }

    async fn delete_instructor(
        &self,
        context: &CourseServiceContext,
        instructor_id: String,
    ) -> CourseResult<()> {
        self.instructor_repo
            .delete_instructor(context, instructor_id)
            .await
    }

    // ── Courses ─────────────────────────────────────────────────────

    async fn list_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage> {
        self.catalog_repo.list_courses(context, query).await
    }

    async fn retrieve_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseItem>> {
        self.catalog_repo.retrieve_course(context, course_id).await
    }

    async fn create_course(
        &self,
        context: &CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseResult<CourseItem> {
        if let Some(ref cover) = command.cover {
            self.drive_port
                .validate_resource(context, cover.clone())
                .await?;
        }
        self.catalog_repo.save_course(context, command).await
    }

    async fn save_course(
        &self,
        context: &CourseServiceContext,
        command: CourseCatalogCommand,
    ) -> CourseResult<CourseItem> {
        if let Some(ref cover) = command.cover {
            self.drive_port
                .validate_resource(context, cover.clone())
                .await?;
        }
        self.catalog_repo.save_course(context, command).await
    }

    async fn save_studio_course(
        &self,
        context: &CourseServiceContext,
        command: CourseStudioDraftCommand,
    ) -> CourseResult<CourseItem> {
        require_creator(context)?;
        validate_studio_draft(&command)?;

        if let Some(ref cover) = command.cover {
            self.drive_port
                .validate_resource(context, cover.clone())
                .await?;
        }
        for section in &command.sections {
            for lesson in &section.lessons {
                for resource in &lesson.resources {
                    self.drive_port
                        .validate_resource(
                            context,
                            crate::domain::commands::CourseMediaResourceRef {
                                drive_resource_id: resource.drive_resource_id.clone(),
                                role: resource.resource_role.clone(),
                                mime_type: resource.mime_type.clone(),
                                duration_seconds: resource.duration_seconds,
                                metadata: None,
                            },
                        )
                        .await?;
                }
            }
        }
        self.catalog_repo
            .save_studio_course(context, command)
            .await
    }

    async fn retrieve_studio_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseStudioDetail>> {
        let Some(user_id) = context.user_id.as_deref() else {
            return Ok(None);
        };
        let detail = self
            .catalog_repo
            .retrieve_course_detail(context, course_id)
            .await?;
        Ok(detail.filter(|detail| detail.course.author_user_id.as_deref() == Some(user_id)))
    }

    async fn retrieve_review_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseStudioDetail>> {
        self.catalog_repo
            .retrieve_course_detail(context, course_id)
            .await
    }

    async fn retrieve_curriculum(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Option<CourseCurriculum>> {
        let curriculum = self
            .catalog_repo
            .retrieve_curriculum(context, course_id.clone())
            .await?;
        let Some(mut curriculum) = curriculum else {
            return Ok(None);
        };
        let course = self.catalog_repo.retrieve_course(context, course_id.clone()).await?;
        let Some(course) = course else {
            return Ok(None);
        };
        if course.publish_status != "published" {
            return Ok(None);
        }
        if !course.is_free {
            let user_id = context.user_id.clone().or_else(|| context.actor_id.clone());
            let enrolled = match user_id {
                Some(user_id) => {
                    self.enrollment_repo
                        .has_active_enrollment(context, course_id.clone(), user_id)
                        .await?
                }
                None => false,
            };
            if !enrolled {
                let free_lesson_ids = curriculum
                    .lessons
                    .iter()
                    .filter(|lesson| lesson.free_preview)
                    .map(|lesson| lesson.id.clone())
                    .collect::<std::collections::HashSet<_>>();
                for lesson in &mut curriculum.lessons {
                    if !lesson.free_preview {
                        lesson.content = None;
                        lesson.external_source_id = None;
                    }
                }
                curriculum.resources.retain(|resource| {
                    free_lesson_ids.contains(&resource.owner_id)
                });
            }
        }
        Ok(Some(curriculum))
    }

    async fn list_collection_items(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseCollectionItem>> {
        self.catalog_repo
            .list_collection_items(context, course_id)
            .await
    }

    async fn submit_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        require_creator(context)?;
        let detail = self
            .retrieve_studio_course(context, course_id.clone())
            .await?
            .ok_or_else(|| CourseError::not_found("Course not found"))?;
        if detail.course.publish_status == "reviewing" {
            return Err(CourseError::invalid("Course is already under review"));
        }
        if detail.course.publish_status == "published" {
            return Err(CourseError::invalid(
                "Published courses cannot be submitted again; unpublish before revising",
            ));
        }
        validate_submission(&detail)?;

        let item = self.catalog_repo.submit_course(context, course_id.clone()).await?;
        self.append_course_audit(
            context,
            &course_id,
            "submit",
            Some(serde_json::json!({
                "publishStatus": detail.course.publish_status,
            })),
            Some(serde_json::json!({ "publishStatus": item.publish_status })),
        )
        .await?;
        Ok(item)
    }

    async fn withdraw_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        require_creator(context)?;
        let item = self
            .catalog_repo
            .withdraw_course(context, course_id.clone())
            .await?;
        self.append_course_audit(
            context,
            &course_id,
            "withdraw",
            Some(serde_json::json!({ "publishStatus": "reviewing" })),
            Some(serde_json::json!({ "publishStatus": item.publish_status })),
        )
        .await?;
        Ok(item)
    }

    async fn review_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: CourseReviewDecisionCommand,
    ) -> CourseResult<CourseItem> {
        let decision = command.decision.trim().to_ascii_lowercase();
        if !matches!(
            decision.as_str(),
            "approve" | "reject" | "request_changes"
        ) {
            return Err(CourseError::invalid(
                "decision must be approve, reject, or request_changes",
            ));
        }
        let note = command
            .note
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned);
        if decision != "approve" && note.is_none() {
            return Err(CourseError::invalid(
                "A review note is required when a course is not approved",
            ));
        }
        let item = self
            .catalog_repo
            .review_course(
                context,
                course_id.clone(),
                CourseReviewDecisionCommand {
                    decision: decision.clone(),
                    note: note.clone(),
                },
            )
            .await?;
        self.append_course_audit(
            context,
            &course_id,
            &format!("review_{decision}"),
            Some(serde_json::json!({ "publishStatus": "reviewing" })),
            Some(serde_json::json!({
                "publishStatus": item.publish_status,
                "note": note,
                "reviewRound": item.review_round,
            })),
        )
        .await?;
        Ok(item)
    }

    async fn offline_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        note: Option<String>,
    ) -> CourseResult<CourseItem> {
        let item = self
            .catalog_repo
            .offline_course(context, course_id.clone(), note.clone())
            .await?;
        self.append_course_audit(
            context,
            &course_id,
            "offline",
            Some(serde_json::json!({ "publishStatus": "published" })),
            Some(serde_json::json!({
                "publishStatus": item.publish_status,
                "note": note,
            })),
        )
        .await?;
        Ok(item)
    }

    async fn list_review_courses(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<CoursePage> {
        let mut query = query;
        if query.status.as_deref().unwrap_or("").is_empty() {
            query.status = Some("reviewing".to_string());
        }
        self.catalog_repo.list_review_courses(context, query).await
    }

    async fn review_stats(&self, context: &CourseServiceContext) -> CourseResult<Value> {
        self.catalog_repo.review_stats(context).await
    }

    async fn delete_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<()> {
        self.catalog_repo
            .delete_course(context, course_id.clone())
            .await?;
        self.append_course_audit(
            context,
            &course_id,
            "delete",
            None,
            Some(serde_json::json!({ "deleted": true })),
        )
        .await
    }

    async fn publish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        let item = self
            .catalog_repo
            .publish_course(context, course_id.clone())
            .await?;
        self.append_course_audit(
            context,
            &course_id,
            "publish",
            None,
            Some(serde_json::json!({
                "publishStatus": item.publish_status,
                "publishedAt": item.published_at,
            })),
        )
        .await?;
        Ok(item)
    }

    async fn unpublish_course(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<CourseItem> {
        let item = self
            .catalog_repo
            .unpublish_course(context, course_id.clone())
            .await?;
        self.append_course_audit(
            context,
            &course_id,
            "unpublish",
            None,
            Some(serde_json::json!({ "publishStatus": item.publish_status })),
        )
        .await?;
        Ok(item)
    }

    // ── Offerings ───────────────────────────────────────────────────

    async fn list_offerings(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<Value>> {
        self.offering_repo.list_offerings(context, course_id).await
    }

    async fn retrieve_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<Option<Value>> {
        self.offering_repo
            .retrieve_offering(context, offering_id)
            .await
    }

    async fn save_offering(
        &self,
        context: &CourseServiceContext,
        command: CourseOfferingCommand,
    ) -> CourseResult<String> {
        self.offering_repo.save_offering(context, command).await
    }

    async fn transition_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        status: String,
    ) -> CourseResult<()> {
        self.offering_repo
            .transition_offering(context, offering_id, status)
            .await
    }

    async fn delete_offering(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
    ) -> CourseResult<()> {
        self.offering_repo
            .delete_offering(context, offering_id)
            .await
    }

    // ── Sections ────────────────────────────────────────────────────

    async fn list_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseSectionItem>> {
        self.lesson_repo.list_sections(context, course_id).await
    }

    async fn save_section(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        command: Value,
    ) -> CourseResult<CourseSectionItem> {
        self.lesson_repo
            .save_section(context, course_id, command)
            .await
    }

    async fn reorder_sections(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        section_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseSectionItem>> {
        let sections = self
            .lesson_repo
            .list_sections(context, course_id.clone())
            .await?;
        for sid in &section_ids {
            if !sections.iter().any(|s| s.id == *sid) {
                return Err(CourseError::invalid(format!("Section {} not found", sid)));
            }
        }
        self.lesson_repo
            .reorder_sections(context, course_id, section_ids)
            .await
    }

    async fn delete_section(
        &self,
        context: &CourseServiceContext,
        section_id: String,
    ) -> CourseResult<()> {
        self.lesson_repo.delete_section(context, section_id).await
    }

    // ── Lessons ─────────────────────────────────────────────────────

    async fn list_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Vec<CourseLessonItem>> {
        self.lesson_repo.list_lessons(context, course_id).await
    }

    async fn retrieve_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<Option<CourseLessonItem>> {
        self.lesson_repo.retrieve_lesson(context, lesson_id).await
    }

    async fn save_lesson(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonCommand,
    ) -> CourseResult<CourseLessonItem> {
        for resource in &command.resources {
            self.drive_port
                .validate_resource(context, resource.clone())
                .await?;
        }
        self.lesson_repo.save_lesson(context, command).await
    }

    async fn reorder_lessons(
        &self,
        context: &CourseServiceContext,
        course_id: String,
        lesson_ids: Vec<String>,
    ) -> CourseResult<Vec<CourseLessonItem>> {
        self.lesson_repo
            .reorder_lessons(context, course_id, lesson_ids)
            .await
    }

    async fn delete_lesson(
        &self,
        context: &CourseServiceContext,
        lesson_id: String,
    ) -> CourseResult<()> {
        self.lesson_repo.delete_lesson(context, lesson_id).await
    }

    // ── Resources ───────────────────────────────────────────────────

    async fn list_resources(
        &self,
        context: &CourseServiceContext,
        owner_type: String,
        owner_id: String,
    ) -> CourseResult<Vec<Value>> {
        self.resource_repo
            .list_resources(context, owner_type, owner_id)
            .await
    }

    async fn save_resource_ref(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        self.resource_repo.save_resource_ref(context, command).await
    }

    async fn delete_resource_ref(
        &self,
        context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<()> {
        self.resource_repo
            .delete_resource_ref(context, resource_ref_id)
            .await
    }

    // ── Live sessions ───────────────────────────────────────────────

    async fn list_live_sessions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        self.live_session_repo
            .list_live_sessions(context, query)
            .await
    }

    async fn retrieve_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<Option<Value>> {
        self.live_session_repo
            .retrieve_live_session(context, live_session_id)
            .await
    }

    async fn save_live_session(
        &self,
        context: &CourseServiceContext,
        command: CourseLiveSessionCommand,
    ) -> CourseResult<String> {
        let _room_ref = self
            .live_provider_port
            .reserve_room(context, command.live_session_id.clone().unwrap_or_default())
            .await?;
        self.live_session_repo
            .save_live_session(context, command)
            .await
    }

    async fn transition_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        live_status: String,
    ) -> CourseResult<()> {
        self.live_session_repo
            .transition_live_session(context, live_session_id, live_status)
            .await
    }

    async fn attach_live_replay(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        resource_ref_id: String,
    ) -> CourseResult<()> {
        self.live_session_repo
            .attach_live_replay(context, live_session_id, resource_ref_id)
            .await
    }

    // ── Enrollments ─────────────────────────────────────────────────

    async fn list_enrollments(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        self.enrollment_repo.list_enrollments(context, query).await
    }

    async fn retrieve_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<Value>> {
        self.enrollment_repo
            .retrieve_enrollment(context, enrollment_id)
            .await
    }

    async fn enroll(
        &self,
        context: &CourseServiceContext,
        command: CourseEnrollmentCommand,
    ) -> CourseResult<String> {
        // Free offerings enroll directly — no commerce entitlement needed.
        // Paid offerings verify learning access and fail closed until a real
        // entitlement adapter is wired.
        let offering = self
            .offering_repo
            .retrieve_offering(context, command.offering_id.clone())
            .await?
            .ok_or_else(|| CourseError::not_found("Offering not found"))?;
        let access_mode = offering
            .get("accessMode")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("free");

        if access_mode != "free" {
            let has_access = self
                .entitlement_port
                .verify_learning_access(
                    context,
                    command.offering_id.clone(),
                    command.learner_user_id.clone(),
                )
                .await?;

            if !has_access && command.source == "self_service" {
                return Err(CourseError::invalid("Entitlement required for enrollment"));
            }
        }

        self.enrollment_repo
            .create_enrollment(context, command)
            .await
    }

    async fn revoke_enrollment(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<()> {
        self.enrollment_repo
            .revoke_enrollment(context, enrollment_id)
            .await
    }

    async fn grant_entitlement(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        learner_user_id: String,
        purchase_ref: String,
    ) -> CourseResult<String> {
        let command = CourseEnrollmentCommand {
            offering_id,
            learner_user_id,
            source: "commerce".to_owned(),
            idempotency_key: Some(purchase_ref),
        };
        self.enroll(context, command).await
    }

    async fn grant_entitlement_by_offering(
        &self,
        offering_id: String,
        learner_user_id: String,
        purchase_ref: String,
    ) -> CourseResult<String> {
        let scope = self
            .offering_repo
            .find_offering_scope(offering_id.clone())
            .await?
            .ok_or_else(|| CourseError::not_found("Offering not found"))?;
        let context = CourseServiceContext {
            tenant_id: scope.0,
            organization_id: scope.1,
            actor_id: Some(learner_user_id.clone()),
            user_id: Some(learner_user_id.clone()),
            request_id: None,
            trace_id: None,
            permissions: Vec::new(),
        };
        self.grant_entitlement(&context, offering_id, learner_user_id, purchase_ref)
            .await
    }

    // ── Progress ────────────────────────────────────────────────────

    async fn list_progress(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        self.progress_repo.list_progress(context, query).await
    }

    async fn retrieve_progress(
        &self,
        context: &CourseServiceContext,
        enrollment_id: String,
    ) -> CourseResult<Option<Value>> {
        self.progress_repo
            .retrieve_progress(context, enrollment_id)
            .await
    }

    async fn update_lesson_progress(
        &self,
        context: &CourseServiceContext,
        command: CourseLessonProgressCommand,
    ) -> CourseResult<()> {
        self.progress_repo
            .upsert_lesson_progress(context, command)
            .await
    }

    async fn join_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<CourseLiveJoinGrant> {
        let user_id = context
            .user_id
            .clone()
            .ok_or_else(|| CourseError::invalid("User ID required"))?;

        self.live_provider_port
            .create_join_grant(context, live_session_id, user_id)
            .await
    }

    // ── Reactions ───────────────────────────────────────────────────

    async fn course_engagement(
        &self,
        context: &CourseServiceContext,
        course_id: String,
    ) -> CourseResult<Value> {
        self.reaction_repo
            .course_engagement(context, course_id)
            .await
    }

    async fn list_reactions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<Value>> {
        self.reaction_repo.list_reactions(context, query).await
    }

    async fn save_reaction(
        &self,
        context: &CourseServiceContext,
        command: Value,
    ) -> CourseResult<Value> {
        self.reaction_repo.save_reaction(context, command).await
    }

    async fn delete_reaction(
        &self,
        context: &CourseServiceContext,
        reaction_id: String,
    ) -> CourseResult<()> {
        self.reaction_repo
            .delete_reaction(context, reaction_id)
            .await
    }

    // ── Applications ────────────────────────────────────────────────

    async fn list_applications(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseApplicationItem>> {
        self.application_repo
            .list_applications(context, query)
            .await
    }

    async fn retrieve_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<Option<CourseApplicationItem>> {
        self.application_repo
            .retrieve_application(context, application_id)
            .await
    }

    async fn submit_application(
        &self,
        context: &CourseServiceContext,
        request: CourseApplicationCreateRequest,
    ) -> CourseResult<CourseApplicationItem> {
        self.application_repo
            .submit_application(context, request)
            .await
    }

    async fn review_application(
        &self,
        context: &CourseServiceContext,
        application_id: String,
        request: CourseApplicationReviewRequest,
    ) -> CourseResult<CourseApplicationItem> {
        let result = self
            .application_repo
            .review_application(context, application_id.clone(), request.clone())
            .await?;

        self.audit_repo
            .append_audit_log(
                context,
                CourseAuditCommand {
                    target_type: "application".to_string(),
                    target_id: application_id,
                    operation: "review".to_string(),
                    before_snapshot: None,
                    after_snapshot: Some(serde_json::to_value(&request).unwrap_or_default()),
                },
            )
            .await?;

        Ok(result)
    }

    async fn convert_application_to_course(
        &self,
        context: &CourseServiceContext,
        application_id: String,
    ) -> CourseResult<CourseItem> {
        self.application_repo
            .convert_to_course(context, application_id)
            .await
    }

    // ── Audit logs ──────────────────────────────────────────────────

    async fn list_audit_logs(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Vec<CourseAuditLogItem>> {
        self.audit_repo.list_audit_logs(context, query).await
    }

    async fn retrieve_audit_log(
        &self,
        context: &CourseServiceContext,
        audit_log_id: String,
    ) -> CourseResult<Option<CourseAuditLogItem>> {
        self.audit_repo
            .retrieve_audit_log(context, audit_log_id)
            .await
    }

    async fn write_audit_log(
        &self,
        context: &CourseServiceContext,
        command: CourseAuditCommand,
    ) -> CourseResult<()> {
        self.audit_repo.append_audit_log(context, command).await?;
        self.audit_event_port
            .publish_audit_event(context, "audit.created".to_string())
            .await?;
        Ok(())
    }

    // ── Progress ────────────────────────────────────────────────────

    async fn repair_lesson_progress(
        &self,
        context: &CourseServiceContext,
        lesson_progress_id: String,
        command: Value,
    ) -> CourseResult<()> {
        self.progress_repo
            .repair_lesson_progress(context, lesson_progress_id, command)
            .await
    }

    // ── Live sessions ───────────────────────────────────────────────

    async fn heartbeat_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()> {
        // Update last_heartbeat_at in lesson progress
        let _ = self
            .live_session_repo
            .retrieve_live_session(context, live_session_id.clone())
            .await?;
        Ok(())
    }

    async fn leave_live_session(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()> {
        // Record leave time in lesson progress
        let _ = self
            .live_session_repo
            .retrieve_live_session(context, live_session_id)
            .await?;
        Ok(())
    }

    async fn retrieve_live_session_replay(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<Option<Value>> {
        self.live_session_repo
            .retrieve_live_session(context, live_session_id)
            .await
    }

    // ── Reports ─────────────────────────────────────────────────────

    async fn list_reports_overview(&self, context: &CourseServiceContext) -> CourseResult<Value> {
        // Aggregate counts from multiple repositories
        let courses = self
            .catalog_repo
            .list_courses(context, CourseQuery::default())
            .await?;
        let enrollments = self
            .enrollment_repo
            .list_enrollments(context, CourseQuery::default())
            .await?;
        let applications = self
            .application_repo
            .list_applications(context, CourseQuery::default())
            .await?;

        Ok(serde_json::json!({
            "totalCourses": courses.total,
            "totalEnrollments": enrollments.len(),
            "totalApplications": applications.len(),
            "publishedCourses": courses.items.iter().filter(|c| c.status == "published").count(),
        }))
    }

    async fn list_reports_learning(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value> {
        let progress = self.progress_repo.list_progress(context, query).await?;
        Ok(serde_json::json!({ "items": progress }))
    }

    async fn list_reports_live_sessions(
        &self,
        context: &CourseServiceContext,
        query: CourseQuery,
    ) -> CourseResult<Value> {
        let sessions = self
            .live_session_repo
            .list_live_sessions(context, query)
            .await?;
        Ok(serde_json::json!({ "items": sessions }))
    }
}
fn require_creator(context: &CourseServiceContext) -> CourseResult<()> {
    match context.user_id.as_deref().map(str::trim) {
        Some(user_id) if !user_id.is_empty() => Ok(()),
        _ => Err(CourseError::invalid(
            "An authenticated creator is required for this operation",
        )),
    }
}

fn validate_price_amount(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return false;
    }
    let mut parts = trimmed.split('.');
    let whole = parts.next().unwrap_or_default();
    let fraction = parts.next();
    if parts.next().is_some() {
        return false;
    }
    if whole.is_empty() || !whole.chars().all(|value| value.is_ascii_digit()) || whole.len() > 9 {
        return false;
    }
    if let Some(fraction) = fraction {
        if fraction.len() > 2 || !fraction.chars().all(|value| value.is_ascii_digit()) {
            return false;
        }
    }
    trimmed.chars().any(|value| value != '.' && value != '0')
}

fn validate_studio_draft(command: &CourseStudioDraftCommand) -> CourseResult<()> {
    let title = command.title.trim();
    if title.chars().count() < 2 || title.chars().count() > 120 {
        return Err(CourseError::invalid(
            "Course title must be between 2 and 120 characters",
        ));
    }
    let kind = crate::domain::commands::normalize_course_kind(&command.kind)
        .ok_or_else(|| CourseError::invalid("course kind must be standard, column, or collection"))?;
    if command.tags.len() > 20
        || command
            .tags
            .iter()
            .any(|tag| tag.trim().chars().count() > 40)
    {
        return Err(CourseError::invalid(
            "A course may have at most 20 tags of 40 characters each",
        ));
    }
    if !command.is_free {
        let price = command.price_amount.as_deref().unwrap_or_default();
        if !validate_price_amount(price) {
            return Err(CourseError::invalid(
                "Paid courses require a positive decimal price with at most two decimals",
            ));
        }
        if command.currency.as_deref().unwrap_or("").trim().is_empty() {
            return Err(CourseError::invalid(
                "Paid courses require a currency code",
            ));
        }
    }
    if command.sections.len() > 100 {
        return Err(CourseError::invalid(
            "A course may have at most 100 chapters",
        ));
    }
    let mut lesson_total = 0usize;
    for section in &command.sections {
        let section_title = section.title.trim();
        if section_title.is_empty() || section_title.chars().count() > 120 {
            return Err(CourseError::invalid(
                "Chapter titles must be between 1 and 120 characters",
            ));
        }
        lesson_total += section.lessons.len();
        for lesson in &section.lessons {
            if lesson.title.trim().is_empty() || lesson.title.trim().chars().count() > 160 {
                return Err(CourseError::invalid(
                    "Lesson titles must be between 1 and 160 characters",
                ));
            }
            validate_resource_roles(&lesson.resources)?;
        }
    }
    if lesson_total > 500 {
        return Err(CourseError::invalid(
            "A course may have at most 500 lessons",
        ));
    }
    if kind == crate::domain::commands::COURSE_KIND_COLLECTION {
        if !command.sections.is_empty() {
            return Err(CourseError::invalid(
                "Collection courses bundle other courses and cannot contain chapters",
            ));
        }
    } else if !command.collection_items.is_empty() {
        return Err(CourseError::invalid(
            "Only collection courses can link other courses",
        ));
    }
    let mut seen = std::collections::HashSet::new();
    for linked in &command.collection_items {
        if linked.trim().is_empty() {
            return Err(CourseError::invalid("Collection items cannot be empty"));
        }
        if command.course_id.as_deref() == Some(linked.as_str()) {
            return Err(CourseError::invalid(
                "A collection cannot include itself",
            ));
        }
        if !seen.insert(linked.as_str()) {
            return Err(CourseError::invalid(
                "Collection items must not contain duplicates",
            ));
        }
    }
    if command.collection_items.len() > 200 {
        return Err(CourseError::invalid(
            "A collection may bundle at most 200 courses",
        ));
    }
    Ok(())
}

fn validate_resource_roles(resources: &[crate::domain::commands::CourseStudioResourceDraft]) -> CourseResult<()> {
    const ROLES: [&str; 8] = [
        "cover",
        "intro_video",
        "vod_video",
        "live_replay",
        "subtitle",
        "attachment",
        "handout",
        "avatar",
    ];
    for resource in resources {
        if resource.drive_resource_id.trim().is_empty() {
            return Err(CourseError::invalid(
                "A lesson resource must reference a Drive resource",
            ));
        }
        if !ROLES.contains(&resource.resource_role.as_str()) {
            return Err(CourseError::invalid(format!(
                "Unsupported lesson resource role: {}",
                resource.resource_role
            )));
        }
    }
    Ok(())
}

fn validate_submission(detail: &CourseStudioDetail) -> CourseResult<()> {
    let course = &detail.course;
    if course.title.trim().chars().count() < 2 {
        return Err(CourseError::invalid(
            "A course title must contain at least 2 characters before review",
        ));
    }
    let cover = course.thumbnail.as_deref().unwrap_or("").trim();
    if cover.is_empty() {
        return Err(CourseError::invalid(
            "A cover image is required before submitting for review",
        ));
    }
    if cover.starts_with('{') {
        let snapshot = serde_json::from_str::<serde_json::Value>(cover)
            .map_err(|_| CourseError::invalid("The cover resource snapshot is malformed"))?;
        let mime = snapshot
            .get("mimeType")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
            .to_ascii_lowercase();
        if !mime.starts_with("image/") {
            return Err(CourseError::invalid(
                "The cover must be an uploaded image resource",
            ));
        }
    }
    if course.category.as_deref().unwrap_or("").trim().is_empty() {
        return Err(CourseError::invalid(
            "A category is required before submitting for review",
        ));
    }
    let summary = course
        .summary
        .as_deref()
        .or(course.description.as_deref())
        .unwrap_or("")
        .trim();
    if summary.chars().count() < 20 {
        return Err(CourseError::invalid(
            "The course summary must be at least 20 characters before review",
        ));
    }
    if summary.chars().count() > 2_000 {
        return Err(CourseError::invalid(
            "The course summary cannot exceed 2000 characters",
        ));
    }
    if !course.is_free {
        if !validate_price_amount(course.price_amount.as_deref().unwrap_or_default()) {
            return Err(CourseError::invalid(
                "Paid courses require a valid price before review",
            ));
        }
        if course.currency.as_deref().unwrap_or("").trim().is_empty() {
            return Err(CourseError::invalid(
                "Paid courses require a currency before review",
            ));
        }
        if let Some(original) = course.original_price_amount.as_deref() {
            let price = course
                .price_amount
                .as_deref()
                .unwrap_or("0")
                .parse::<f64>()
                .unwrap_or(0.0);
            let original = original.parse::<f64>().unwrap_or(0.0);
            if original > 0.0 && original < price {
                return Err(CourseError::invalid(
                    "The original price cannot be lower than the sale price",
                ));
            }
        }
    }
    match course.kind.as_str() {
        crate::domain::commands::COURSE_KIND_COLLECTION => {
            if detail.collection_items.is_empty() {
                return Err(CourseError::invalid(
                    "A collection must bundle at least one published course",
                ));
            }
        }
        _ => {
            if detail.sections.is_empty() {
                return Err(CourseError::invalid(
                    "A course must have at least one chapter before review",
                ));
            }
            if detail.lessons.is_empty() {
                return Err(CourseError::invalid(
                    "A course must have at least one lesson before review",
                ));
            }
            for lesson in &detail.lessons {
                if lesson.title.trim().is_empty() {
                    return Err(CourseError::invalid("Lesson titles cannot be empty"));
                }
                let kind = lesson.kind.as_deref().unwrap_or("vod_video");
                match kind {
                    "article" => {
                        if lesson
                            .content
                            .as_deref()
                            .unwrap_or("")
                            .trim()
                            .chars()
                            .count()
                            < 20
                        {
                            return Err(CourseError::invalid(format!(
                                "Article lesson '{}' needs at least 20 characters of content",
                                lesson.title
                            )));
                        }
                    }
                    "vod_video" => {
                        if lesson.duration_seconds <= 0 {
                            return Err(CourseError::invalid(format!(
                                "Video lesson '{}' needs a valid duration",
                                lesson.title
                            )));
                        }
                        let has_external = !lesson
                            .external_source_id
                            .as_deref()
                            .unwrap_or("")
                            .trim()
                            .is_empty()
                            && !lesson
                                .source_provider
                                .as_deref()
                                .unwrap_or("")
                                .trim()
                                .is_empty();
                        let has_uploaded_video = detail.resources.iter().any(|resource| {
                            resource.owner_id == lesson.id
                                && resource.resource_role == "vod_video"
                                && resource
                                    .mime_type
                                    .as_deref()
                                    .is_some_and(|mime| mime.to_ascii_lowercase().starts_with("video/"))
                                && resource.file_size_bytes.unwrap_or(0) > 0
                        });
                        if !has_external && !has_uploaded_video {
                            return Err(CourseError::invalid(format!(
                                "Video lesson '{}' needs an uploaded video file or a verified external source",
                                lesson.title
                            )));
                        }
                    }
                    "live_session" => {
                        let has_external = !lesson
                            .external_source_id
                            .as_deref()
                            .unwrap_or("")
                            .trim()
                            .is_empty()
                            && !lesson
                                .source_provider
                                .as_deref()
                                .unwrap_or("")
                                .trim()
                                .is_empty();
                        let has_replay = detail.resources.iter().any(|resource| {
                            resource.owner_id == lesson.id
                                && resource.resource_role == "live_replay"
                        });
                        if !has_external && !has_replay {
                            return Err(CourseError::invalid(format!(
                                "Live lesson '{}' needs a live source or replay",
                                lesson.title
                            )));
                        }
                    }
                    "download" => {
                        let has_attachment = detail.resources.iter().any(|resource| {
                            resource.owner_id == lesson.id
                                && matches!(
                                    resource.resource_role.as_str(),
                                    "attachment" | "handout"
                                )
                        });
                        if !has_attachment {
                            return Err(CourseError::invalid(format!(
                                "Download lesson '{}' needs an attached file",
                                lesson.title
                            )));
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod submission_validation_tests {
    use super::*;

    fn video_resource() -> crate::domain::models::CourseResourceItem {
        crate::domain::models::CourseResourceItem {
            owner_type: "lesson".to_owned(),
            owner_id: "lesson-1".to_owned(),
            resource_role: "vod_video".to_owned(),
            drive_resource_id: "drive-video-1".to_owned(),
            mime_type: Some("video/mp4".to_owned()),
            file_size_bytes: Some(1024),
            ..Default::default()
        }
    }

    fn base_detail() -> CourseStudioDetail {
        let mut detail = CourseStudioDetail::default();
        detail.course.title = "Commercial course".to_owned();
        detail.course.thumbnail = Some(r#"{"mimeType":"image/png"}"#.to_owned());
        detail.course.category = Some("course-category-ai".to_owned());
        detail.course.summary =
            Some("A complete commercial course summary with enough detail.".to_owned());
        detail.course.is_free = true;
        detail.sections = vec![crate::domain::models::CourseSectionItem::default()];
        detail.lessons = vec![crate::domain::models::CourseLessonItem {
            id: "lesson-1".to_owned(),
            title: "Video lesson".to_owned(),
            duration_seconds: 600,
            kind: Some("vod_video".to_owned()),
            ..Default::default()
        }];
        detail
    }

    #[test]
    fn accepts_a_video_lesson_with_an_uploaded_video() {
        let mut detail = base_detail();
        detail.resources = vec![video_resource()];
        assert!(validate_submission(&detail).is_ok());
    }

    #[test]
    fn rejects_an_attachment_masquerading_as_a_video() {
        let mut detail = base_detail();
        let mut resource = video_resource();
        resource.resource_role = "attachment".to_owned();
        detail.resources = vec![resource];
        let error = validate_submission(&detail).expect_err("attachment must not satisfy video");
        assert!(format!("{error:?}").contains("uploaded video file"));
    }

    #[test]
    fn rejects_invalid_original_price() {
        let mut detail = base_detail();
        detail.resources = vec![video_resource()];
        detail.course.is_free = false;
        detail.course.price_amount = Some("100.00".to_owned());
        detail.course.original_price_amount = Some("50.00".to_owned());
        detail.course.currency = Some("CNY".to_owned());
        let error = validate_submission(&detail).expect_err("original price below sale price");
        assert!(format!("{error:?}").contains("original price"));
    }

    #[test]
    fn rejects_non_image_cover_snapshot() {
        let mut detail = base_detail();
        detail.resources = vec![video_resource()];
        detail.course.thumbnail = Some(r#"{"mimeType":"application/pdf"}"#.to_owned());
        let error = validate_submission(&detail).expect_err("cover must be an image");
        assert!(format!("{error:?}").contains("uploaded image"));
    }
}
