use crate::domain::commands::{CourseLiveJoinGrant, CourseMediaResourceRef, CourseServiceContext};
use crate::domain::models::CourseResult;

#[async_trait::async_trait]
pub trait CourseDrivePort: Send + Sync {
    async fn validate_resource(
        &self,
        context: &CourseServiceContext,
        resource: CourseMediaResourceRef,
    ) -> CourseResult<CourseMediaResourceRef>;

    /// Validates a whole material set in one call.
    ///
    /// The default keeps the single-resource contract for adapters without a
    /// batch backend: every resource is checked in order and the caller sees the
    /// first failure. An in-process adapter whose Drive backend exposes a
    /// set-based ACL read overrides this to resolve all distinct nodes at once
    /// and keep the per-resource error kinds.
    ///
    /// Input order is preserved in the returned vector.
    async fn validate_resources(
        &self,
        context: &CourseServiceContext,
        resources: Vec<CourseMediaResourceRef>,
    ) -> CourseResult<Vec<CourseMediaResourceRef>> {
        let mut validated = Vec::with_capacity(resources.len());
        for resource in resources {
            validated.push(self.validate_resource(context, resource).await?);
        }
        Ok(validated)
    }

    async fn issue_download_grant(
        &self,
        context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<String>;
}

#[async_trait::async_trait]
pub trait CourseLiveProviderPort: Send + Sync {
    async fn reserve_room(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<String>;

    async fn create_join_grant(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
        learner_user_id: String,
    ) -> CourseResult<CourseLiveJoinGrant>;

    async fn end_room(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseEntitlementPort: Send + Sync {
    async fn verify_learning_access(
        &self,
        context: &CourseServiceContext,
        offering_id: String,
        learner_user_id: String,
    ) -> CourseResult<bool>;
}

#[async_trait::async_trait]
pub trait CourseNotificationPort: Send + Sync {
    async fn notify_live_session_change(
        &self,
        context: &CourseServiceContext,
        live_session_id: String,
    ) -> CourseResult<()>;
}

#[async_trait::async_trait]
pub trait CourseAuditEventPort: Send + Sync {
    async fn publish_audit_event(
        &self,
        context: &CourseServiceContext,
        event_type: String,
    ) -> CourseResult<()>;
}
