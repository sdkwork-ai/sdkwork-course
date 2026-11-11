use async_trait::async_trait;
use sdkwork_content_course_service::domain::commands::{
    CourseMediaResourceRef, CourseServiceContext,
};
use sdkwork_content_course_service::domain::models::{CourseError, CourseResult};
use sdkwork_content_course_service::ports::provider::CourseDrivePort;
use sdkwork_drive_app_sdk_generated_rust::{
    CreateDownloadGrantRequest, SdkworkAppClient, SdkworkError,
};
use sdkwork_utils_rust::service_base_url::registry_base_url_or;
use sdkwork_utils_rust::string::{is_blank, trim};

/// Opt-in URL of a separately deployed Drive facade (compatibility name).
const DRIVE_FACADE_URL_ENV: &str = "SDKWORK_DRIVE_FACADE_URL";
/// Opt-in URL of a separately deployed Drive app-api surface.
const DRIVE_APP_API_BASE_ENV: &str = "SDKWORK_DRIVE_APP_API_BASE_URL";
/// Service credential the Drive app-api requires from a split-deployment caller.
const DRIVE_ACCESS_TOKEN_ENV: &str = "SDKWORK_ACCESS_TOKEN";

/// Drive integration over HTTP for a **deliberate split deployment**.
///
/// MODULE_SPEC.md §4.2: this adapter is never the default. The course runtime
/// uses [`InProcessDriveCoursePort`](crate::adapters::InProcessDriveCoursePort)
/// on the shared PostgreSQL unless an operator explicitly configures
/// `SDKWORK_DRIVE_FACADE_URL` or `SDKWORK_DRIVE_APP_API_BASE_URL`. When that
/// opt-in is present, [`SdkDriveCoursePort::from_env`] validates the rest of the
/// split-deployment configuration **at startup** and returns an error instead of
/// letting the first course mutation fail at request time.
///
/// Identity is carried by the service credential: the Drive app-api resolves the
/// verified tenant/organization/actor from the access token, so this client does
/// not project identity through request headers (AGENTS.md HTTP request header
/// contract: identity projection headers must not appear on the wire).
#[derive(Clone)]
pub struct SdkDriveCoursePort {
    base_url: String,
    access_token: String,
}

impl SdkDriveCoursePort {
    /// The configured split-deployment endpoint, if an operator opted in.
    ///
    /// Reading this is the only place course code inspects Drive's HTTP
    /// addresses; it is the explicit opt-in switch for the HTTP branch
    /// (`specs/backend-module-call-boundary.allow.json`).
    ///
    /// The first non-blank variable wins: an empty
    /// `SDKWORK_DRIVE_FACADE_URL` placeholder must not shadow a configured
    /// `SDKWORK_DRIVE_APP_API_BASE_URL`, or the explicit HTTP opt-in would be
    /// silently ignored.
    pub fn configured_endpoint() -> Option<String> {
        [DRIVE_FACADE_URL_ENV, DRIVE_APP_API_BASE_ENV]
            .into_iter()
            .find_map(read_configured_url)
    }

    /// Builds and validates the HTTP adapter at startup.
    ///
    /// Fails — never degrades silently — when the opt-in endpoint or the
    /// service credential is missing, so a split deployment cannot start in a
    /// state where every course mutation fails after business state changed.
    pub fn from_env() -> Result<Self, String> {
        let configured = Self::configured_endpoint().ok_or_else(|| {
            format!(
                "{DRIVE_FACADE_URL_ENV} or {DRIVE_APP_API_BASE_ENV} must be set to select the \
                 HTTP Drive adapter; leave both unset for the default in-process adapter"
            )
        })?;
        // DISCOVERY_SPEC §12.1: a healthy registry instance may supply the URL
        // even when the environment does not; the configured value is fallback.
        let base_url = registry_base_url_or("sdkwork-drive", &configured);
        if base_url.is_empty() {
            return Err(format!(
                "{DRIVE_FACADE_URL_ENV} or {DRIVE_APP_API_BASE_ENV} must be configured, \
                 or the HTTP service registry must have a healthy sdkwork-drive instance"
            ));
        }
        let access_token = std::env::var(DRIVE_ACCESS_TOKEN_ENV)
            .ok()
            .map(|value| trim(&value).to_string())
            .filter(|value| !is_blank(Some(value.as_str())))
            .ok_or_else(|| {
                format!(
                    "{DRIVE_ACCESS_TOKEN_ENV} is required by the split-deployment HTTP Drive \
                     adapter; unset {DRIVE_FACADE_URL_ENV}/{DRIVE_APP_API_BASE_ENV} to use the \
                     default in-process adapter instead"
                )
            })?;
        Ok(Self {
            base_url,
            access_token,
        })
    }

    fn client(&self) -> Result<SdkworkAppClient, CourseError> {
        // Re-resolve per call so a registry failover takes effect without a
        // process restart; the stored value is the degradation fallback.
        let base_url = registry_base_url_or("sdkwork-drive", &self.base_url);
        let client = SdkworkAppClient::new_with_base_url(&base_url).map_err(map_drive_error)?;
        client.set_access_token(self.access_token.clone());
        Ok(client)
    }
}

/// Reads one opt-in endpoint variable, treating unset and blank alike.
fn read_configured_url(env_key: &str) -> Option<String> {
    std::env::var(env_key)
        .ok()
        .map(|value| trim(&value).to_string())
        .filter(|value| !is_blank(Some(value.as_str())))
}

#[async_trait]
impl CourseDrivePort for SdkDriveCoursePort {
    async fn validate_resource(
        &self,
        _context: &CourseServiceContext,
        resource: CourseMediaResourceRef,
    ) -> CourseResult<CourseMediaResourceRef> {
        if is_blank(Some(resource.drive_resource_id.as_str())) {
            return Err(CourseError::invalid("driveResourceId is required"));
        }
        self.client()?
            .drive()
            .nodes_retrieve(&resource.drive_resource_id)
            .await
            .map_err(map_drive_error)?;
        Ok(resource)
    }

    async fn issue_download_grant(
        &self,
        _context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<String> {
        if is_blank(Some(resource_ref_id.as_str())) {
            return Err(CourseError::invalid("resourceRefId is required"));
        }
        let grant = self
            .client()?
            .drive()
            .download_grants_create(
                &resource_ref_id,
                &CreateDownloadGrantRequest {
                    requested_ttl_seconds: Some(120),
                },
            )
            .await
            .map_err(map_drive_error)?;
        Ok(grant.download_url)
    }
}

/// Maps a generated Drive SDK transport error to the course error kinds the
/// adapter always produced: 404 → `not_found`, 403 → `invalid`, else `storage`.
fn map_drive_error(error: SdkworkError) -> CourseError {
    let message = error.to_string();
    if message.contains("404") || message.to_lowercase().contains("not found") {
        CourseError::not_found(message)
    } else if message.contains("403") || message.to_lowercase().contains("forbidden") {
        CourseError::invalid(message)
    } else {
        CourseError::storage(message)
    }
}

#[cfg(test)]
mod tests {
    use super::{SdkDriveCoursePort, DRIVE_APP_API_BASE_ENV, DRIVE_FACADE_URL_ENV};

    #[test]
    fn a_blank_facade_url_does_not_hide_the_app_api_endpoint() {
        unsafe {
            std::env::set_var(DRIVE_FACADE_URL_ENV, "   ");
            std::env::set_var(DRIVE_APP_API_BASE_ENV, "https://drive.example.com");
        }
        let configured = SdkDriveCoursePort::configured_endpoint();
        unsafe {
            std::env::remove_var(DRIVE_FACADE_URL_ENV);
            std::env::remove_var(DRIVE_APP_API_BASE_ENV);
        }
        assert_eq!(configured.as_deref(), Some("https://drive.example.com"));
    }

    #[test]
    fn the_split_deployment_endpoint_is_the_explicit_opt_in() {
        let source = include_str!("drive_sdk.rs");
        let production = source
            .split("#[cfg(test)]")
            .next()
            .expect("the module has a production section");
        assert!(production.contains("SDKWORK_DRIVE_FACADE_URL"));
        assert!(production.contains("SDKWORK_DRIVE_APP_API_BASE_URL"));
        assert!(production.contains("SDKWORK_ACCESS_TOKEN"));
        // The adapter must not project identity through request headers.
        assert!(!production.contains("set_header"));
        assert!(!production.contains("X-Sdkwork-"));
    }

    #[test]
    fn the_grant_ttl_matches_the_drive_route_bounds() {
        assert!((30..=300).contains(&120));
    }
}
