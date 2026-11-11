use sqlx::PgPool;

use sdkwork_content_course_service::ports::provider::{
    CourseAuditEventPort, CourseDrivePort, CourseEntitlementPort, CourseLiveProviderPort,
    CourseNotificationPort,
};

use crate::adapters::{
    HttpCourseAuditEventPort, HttpCourseNotificationPort, InProcessDriveCoursePort,
    LoggingCourseAuditEventPort, LoggingCourseNotificationPort, SdkDriveCoursePort,
};
use crate::provider_ports::{
    FailClosedEntitlementPort, UnconfiguredAuditEventPort, UnconfiguredLiveProviderPort,
    UnconfiguredNotificationPort,
};

const COURSE_AUDIT_URL_ENV: &str = "SDKWORK_COURSE_AUDIT_URL";
const COURSE_NOTIFICATION_URL_ENV: &str = "SDKWORK_COURSE_NOTIFICATION_URL";
const IM_AUDIT_UPSTREAM_ENV: &str = "SDKWORK_IM_AUDIT_SERVICE_UPSTREAM";
const IM_NOTIFICATION_UPSTREAM_ENV: &str = "SDKWORK_IM_NOTIFICATION_SERVICE_UPSTREAM";
const COURSE_INTEGRATION_LOG_ENV: &str = "SDKWORK_COURSE_INTEGRATION_LOG";

/// How the course runtime reaches the Drive module.
///
/// MODULE_SPEC.md §4.2: in-process is the default and the only mode that needs
/// no configuration; HTTP is an explicit opt-in for a real split deployment.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CourseDriveAdapterMode {
    /// Drive service ports on the shared PostgreSQL (default).
    InProcess,
    /// A separately deployed Drive HTTP surface (explicit opt-in).
    Http,
}

impl CourseDriveAdapterMode {
    pub fn label(self) -> &'static str {
        match self {
            Self::InProcess => "in-process",
            Self::Http => "http",
        }
    }
}

/// Pure mode resolution so the defaulting rule stays unit-testable.
fn resolve_drive_adapter_mode(configured_endpoint: Option<&str>) -> CourseDriveAdapterMode {
    match configured_endpoint
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        // A real split deployment: the operator named Drive's HTTP surface.
        Some(_) => CourseDriveAdapterMode::Http,
        None => CourseDriveAdapterMode::InProcess,
    }
}

/// Resolves the Drive adapter mode. Never defaults to HTTP.
pub fn drive_adapter_mode() -> CourseDriveAdapterMode {
    resolve_drive_adapter_mode(SdkDriveCoursePort::configured_endpoint().as_deref())
}

/// Builds the Drive port, validating every startup precondition.
///
/// In-process (default): the Drive schema must be present in the shared
/// PostgreSQL and production download-token signing must be configured.
/// HTTP (explicit opt-in): the endpoint and the service credential must both be
/// present. Either mode fails startup instead of failing the first course
/// mutation after business state already changed.
pub async fn build_drive_port(pool: &PgPool) -> Result<Box<dyn CourseDrivePort>, String> {
    match drive_adapter_mode() {
        CourseDriveAdapterMode::InProcess => Ok(Box::new(
            InProcessDriveCoursePort::from_pool(pool.clone()).await?,
        )),
        CourseDriveAdapterMode::Http => Ok(Box::new(SdkDriveCoursePort::from_env()?)),
    }
}

pub fn build_entitlement_port() -> Box<dyn CourseEntitlementPort> {
    // Fail closed: without a commerce entitlement adapter, learning access is
    // denied and self-service enrollment rejects. Wire a real adapter before
    // enabling paid-course self-service enrollment in production.
    tracing::warn!(
        "course entitlement verification is not configured; learning access fails closed"
    );
    Box::new(FailClosedEntitlementPort)
}

pub fn build_live_provider_port() -> Box<dyn CourseLiveProviderPort> {
    Box::new(UnconfiguredLiveProviderPort)
}

pub fn build_notification_port() -> Box<dyn CourseNotificationPort> {
    if let Some(url) =
        resolve_integration_url(COURSE_NOTIFICATION_URL_ENV, IM_NOTIFICATION_UPSTREAM_ENV)
    {
        return Box::new(HttpCourseNotificationPort::new(url));
    }
    if integration_logging_enabled() {
        return Box::new(LoggingCourseNotificationPort);
    }
    Box::new(UnconfiguredNotificationPort)
}

pub fn build_audit_event_port() -> Box<dyn CourseAuditEventPort> {
    if let Some(url) = resolve_integration_url(COURSE_AUDIT_URL_ENV, IM_AUDIT_UPSTREAM_ENV) {
        return Box::new(HttpCourseAuditEventPort::new(url));
    }
    if integration_logging_enabled() {
        return Box::new(LoggingCourseAuditEventPort);
    }
    Box::new(UnconfiguredAuditEventPort)
}

/// Builds every provider port on the course runtime's shared PostgreSQL pool.
pub async fn build_provider_ports(pool: &PgPool) -> Result<ProviderPorts, String> {
    let drive = build_drive_port(pool).await?;
    tracing::info!(
        mode = drive_adapter_mode().label(),
        "course drive integration resolved"
    );
    Ok(ProviderPorts {
        drive,
        live: build_live_provider_port(),
        entitlement: build_entitlement_port(),
        notification: build_notification_port(),
        audit: build_audit_event_port(),
    })
}

pub struct ProviderPorts {
    pub drive: Box<dyn CourseDrivePort>,
    pub live: Box<dyn CourseLiveProviderPort>,
    pub entitlement: Box<dyn CourseEntitlementPort>,
    pub notification: Box<dyn CourseNotificationPort>,
    pub audit: Box<dyn CourseAuditEventPort>,
}

fn resolve_integration_url(primary_env: &str, fallback_env: &str) -> Option<String> {
    read_env_url(primary_env).or_else(|| read_env_url(fallback_env))
}

fn read_env_url(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn integration_logging_enabled() -> bool {
    matches!(
        std::env::var(COURSE_INTEGRATION_LOG_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("1") | Some("true") | Some("yes") | Some("on")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_integration_url_prefers_primary_env() {
        unsafe {
            std::env::set_var("SDKWORK_COURSE_AUDIT_URL", "http://audit.local");
            std::env::set_var("SDKWORK_IM_AUDIT_SERVICE_UPSTREAM", "http://fallback.local");
        }
        assert_eq!(
            resolve_integration_url(COURSE_AUDIT_URL_ENV, IM_AUDIT_UPSTREAM_ENV).as_deref(),
            Some("http://audit.local")
        );
        unsafe {
            std::env::remove_var("SDKWORK_COURSE_AUDIT_URL");
            std::env::remove_var("SDKWORK_IM_AUDIT_SERVICE_UPSTREAM");
        }
    }

    #[test]
    fn integration_logging_enabled_parses_truthy_values() {
        unsafe {
            std::env::set_var(COURSE_INTEGRATION_LOG_ENV, "true");
        }
        assert!(integration_logging_enabled());
        unsafe {
            std::env::remove_var(COURSE_INTEGRATION_LOG_ENV);
        }
    }

    #[test]
    fn drive_defaults_to_in_process_with_no_configuration() {
        assert_eq!(
            resolve_drive_adapter_mode(None),
            CourseDriveAdapterMode::InProcess
        );
        for blank in ["", "   ", "\t\n"] {
            assert_eq!(
                resolve_drive_adapter_mode(Some(blank)),
                CourseDriveAdapterMode::InProcess,
                "{blank:?} must not select the HTTP adapter"
            );
        }
    }

    #[test]
    fn a_configured_endpoint_is_the_explicit_http_opt_in() {
        assert_eq!(
            resolve_drive_adapter_mode(Some("https://drive.example.com")),
            CourseDriveAdapterMode::Http
        );
        assert_eq!(
            resolve_drive_adapter_mode(Some(" https://drive.example.com ")),
            CourseDriveAdapterMode::Http
        );
    }

    #[test]
    fn the_mode_labels_are_the_documented_spellings() {
        assert_eq!(CourseDriveAdapterMode::InProcess.label(), "in-process");
        assert_eq!(CourseDriveAdapterMode::Http.label(), "http");
    }

    #[test]
    fn the_factory_never_defaults_to_http() {
        let source = include_str!("port_factory.rs");
        let production = source
            .split("#[cfg(test)]")
            .next()
            .expect("the module has a production section");
        assert!(!production.contains("unwrap_or(CourseDriveAdapterMode::Http)"));
        assert!(!production.contains("_FACADE_URL"));
        assert!(!production.contains("_APP_API_BASE_URL"));
        assert!(production.contains("SdkDriveCoursePort::configured_endpoint()"));
        assert!(production.contains("InProcessDriveCoursePort::from_pool"));
    }
}
