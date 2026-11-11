use sdkwork_content_course_service::domain::commands::{CourseLiveJoinGrant, CourseServiceContext};
use sdkwork_content_course_service::domain::models::CourseResult;
use sdkwork_content_course_service::ports::provider::{
    CourseAuditEventPort, CourseEntitlementPort, CourseLiveProviderPort, CourseNotificationPort,
};
use sdkwork_content_course_service::CourseError;

macro_rules! integration_unavailable {
    ($capability:expr) => {
        CourseError::storage(format!(
            "{} integration is not configured for embedded course runtime",
            $capability
        ))
    };
}

/// Fail-closed entitlement port for the unified-process embedded runtime.
///
/// Until a commerce entitlement adapter is wired, learning access is denied
/// (`Ok(false)`). Self-service enrollment therefore fails with an entitlement
/// error instead of silently granting paid-course access. Operator visibility
/// is provided by the startup warning in `build_entitlement_port`.
pub struct FailClosedEntitlementPort;

#[async_trait::async_trait]
impl CourseEntitlementPort for FailClosedEntitlementPort {
    async fn verify_learning_access(
        &self,
        _context: &CourseServiceContext,
        _offering_id: String,
        _learner_user_id: String,
    ) -> CourseResult<bool> {
        Ok(false)
    }
}

pub struct UnconfiguredLiveProviderPort;

#[async_trait::async_trait]
impl CourseLiveProviderPort for UnconfiguredLiveProviderPort {
    async fn reserve_room(
        &self,
        _context: &CourseServiceContext,
        _live_session_id: String,
    ) -> CourseResult<String> {
        Err(integration_unavailable!("live"))
    }

    async fn create_join_grant(
        &self,
        _context: &CourseServiceContext,
        _live_session_id: String,
        _learner_user_id: String,
    ) -> CourseResult<CourseLiveJoinGrant> {
        Err(integration_unavailable!("live"))
    }

    async fn end_room(
        &self,
        _context: &CourseServiceContext,
        _live_session_id: String,
    ) -> CourseResult<()> {
        Err(integration_unavailable!("live"))
    }
}

pub struct UnconfiguredNotificationPort;

#[async_trait::async_trait]
impl CourseNotificationPort for UnconfiguredNotificationPort {
    async fn notify_live_session_change(
        &self,
        _context: &CourseServiceContext,
        _live_session_id: String,
    ) -> CourseResult<()> {
        Err(integration_unavailable!("notification"))
    }
}

pub struct UnconfiguredAuditEventPort;

#[async_trait::async_trait]
impl CourseAuditEventPort for UnconfiguredAuditEventPort {
    async fn publish_audit_event(
        &self,
        _context: &CourseServiceContext,
        _event_type: String,
    ) -> CourseResult<()> {
        Err(integration_unavailable!("audit"))
    }
}
