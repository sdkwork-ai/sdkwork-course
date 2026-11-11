//! In-process Drive integration for the embedded course runtime.
//!
//! MODULE_SPEC.md §4.2: a packaged SDKWork deployment runs one backend process
//! against one PostgreSQL, so the course module reaches Drive by calling public
//! Drive **service-layer** ports on the shared pool instead of dialing the Drive
//! HTTP surface. The HTTP adapter is kept only as an explicit split-deployment
//! opt-in (see `SdkDriveCoursePort`).
//!
//! # Drive API consumed (all pre-existing public surface)
//!
//! - `SqlUploaderStore::find_active_node(tenant_id, node_id)` via the
//!   `DriveUploaderStore` port — tenant-scoped, active-lifecycle node read that
//!   yields `space_id`.
//! - `SqlUploaderStore::find_active_space(tenant_id, space_id)` via the same
//!   port — the active-space precondition.
//! - `SqlDrivePermissionService::resolve_node_access_batch(..)` — the same
//!   effective-ACL decision (space ownership, direct and inherited node
//!   permissions) for every distinct node id of a studio/material save in one
//!   set-based query; `resolve_effective_node_access(..)` remains for the
//!   single-resource paths (course cover, download grant).
//! - `build_download_token(..)` / `ensure_production_download_token_signing_configured()`
//!   — Drive's download-token minting and its production signing-key guard.
//!
//! No new Drive surface was added for this integration.
//!
//! # What the Drive HTTP path enforced, and where it is reproduced here
//!
//! `GET /app/v3/api/drive/nodes/{nodeId}` (`node_handlers::get_node`) and
//! `POST /app/v3/api/drive/nodes/{nodeId}/download_grants`
//! (`download_handlers::create_node_download_grant`) enforce:
//!
//! | Drive check | Drive source | Reproduced by |
//! | --- | --- | --- |
//! | tenant-scoped node read | `WHERE tenant_id=$1 AND id=$2` | `DriveUploaderStore::find_active_node` |
//! | active lifecycle | `lifecycle_status='active'` | `DriveUploaderStore::find_active_node` |
//! | active space | `validate_space_exists` | `DriveUploaderStore::find_active_space` |
//! | verified subject + `reader` ACL | `acl::ensure_ctx_node_role(.., "reader")` | `resolve_node_access_batch` + `allows_role("reader")` for material saves; `resolve_effective_node_access` + `allows_role("reader")` for single resources |
//! | grant TTL bounds 30..=300s (default 120) | `validate_requested_ttl_seconds` | `GRANT_TTL_SECONDS` / `clamp_grant_ttl` |
//! | download-token signature | `build_download_token` | `build_download_token` (same HMAC key resolution) |
//!
//! ## Organization scoping
//!
//! Drive nodes are tenant-scoped: `dr_drive_node` / `dr_drive_space` carry no
//! organization column (organization appears only in Drive's audit tables, and
//! the Drive request context forwards it without using it for node access). A
//! narrower organization check would be invented rather than reproduced, so the
//! course `organization_id` stays part of the course service context and of
//! course audit/telemetry while the Drive read is scoped by the same tenant the
//! Drive HTTP adapter forwarded.
//!
//! ## Share-link download cap
//!
//! The Drive grant route additionally applies
//! `collaboration_repository::enforce_share_link_download_limit_for_subject`,
//! which caps downloads for a subject holding an **active Drive share-link**
//! permission on the node. A course-issued grant is not that case: the
//! `CourseDrivePort` contract carries only the authenticated course context
//! (tenant, organization, actor/user) and a Drive node id — there is no
//! share-link token, no share-link claim, and no anonymous subject. Course never
//! redeems a Drive share link, so a course grant cannot consume a share-link
//! download slot, and copying the cap here would create a second source of truth
//! for a Drive quota. The cap stays enforced by Drive for Drive share-link
//! traffic.

use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use sqlx::PgPool;

use sdkwork_content_course_service::domain::commands::{
    CourseMediaResourceRef, CourseServiceContext,
};
use sdkwork_content_course_service::domain::models::{CourseError, CourseResult};
use sdkwork_content_course_service::ports::provider::CourseDrivePort;
use sdkwork_drive_workspace_service::application::download_service::{
    build_download_token, ensure_production_download_token_signing_configured,
};
use sdkwork_drive_workspace_service::application::permission_service::{
    ResolveEffectiveNodeAccessCommand, SqlDrivePermissionService,
};
use sdkwork_drive_workspace_service::infrastructure::sql::uploader_store::SqlUploaderStore;
use sdkwork_drive_workspace_service::ports::permission_store::DriveEffectiveNodeAccess;
use sdkwork_drive_workspace_service::ports::uploader_store::{
    DriveUploaderNodeRecord, DriveUploaderStore,
};
use sdkwork_drive_workspace_service::DriveServiceError;
use sdkwork_utils_rust::string::{is_blank, trim};

/// Course's own published origin, used to address the Drive download-token
/// route on the same public ingress. The route path itself
/// (`/app/v3/api/drive/download_tokens/{token}`) is Drive's canonical app-api
/// path and is unchanged.
const COURSE_PUBLIC_BASE_URL_ENV: &str = "SDKWORK_COURSE_APPLICATION_PUBLIC_HTTP_URL";

/// Drive app-api path for a download token (Drive's published route).
const DRIVE_DOWNLOAD_TOKENS_PATH: &str = "/app/v3/api/drive/download_tokens";

/// Drive's download-grant default TTL. The grant route accepts 30..=300 s; the
/// previous HTTP adapter requested 3600 s, which Drive rejected with a
/// validation error, so that path never produced a usable grant.
pub const GRANT_TTL_SECONDS: u32 = 120;

/// Minimum TTL the Drive grant route accepts.
pub const GRANT_MIN_TTL_SECONDS: u32 = 30;

/// Maximum TTL the Drive grant route accepts.
pub const GRANT_MAX_TTL_SECONDS: u32 = 300;

/// The role the Drive node routes require for read access.
const REQUIRED_ROLE: &str = "reader";

/// The Drive subject kind for an authenticated user.
const SUBJECT_TYPE: &str = "user";

/// Drive integration through public Drive service ports on the shared
/// PostgreSQL.
#[derive(Clone)]
pub struct InProcessDriveCoursePort {
    pool: PgPool,
    download_base_url: String,
}

impl InProcessDriveCoursePort {
    /// Builds the in-process port and validates its startup preconditions.
    ///
    /// Fails at startup (never at the first business request) when:
    ///
    /// - the shared database does not contain the Drive schema, i.e. this
    ///   process did not embed the Drive capability — the operator must run the
    ///   integrated topology or opt into a split deployment explicitly; or
    /// - the Drive download-token signing secret is missing in a production
    ///   runtime profile.
    pub async fn from_pool(pool: PgPool) -> Result<Self, String> {
        ensure_drive_schema_present(&pool).await?;
        ensure_production_download_token_signing_configured().map_err(|error| {
            format!("in-process Drive download-token signing is not configured: {error}")
        })?;
        Ok(Self {
            pool,
            download_base_url: course_public_base_url(),
        })
    }

    /// Tenant-scoped, active-only node read (`reader` checks need `space_id`).
    async fn load_active_node(
        &self,
        tenant_id: &str,
        node_id: &str,
    ) -> CourseResult<DriveUploaderNodeRecord> {
        self.uploader_store()
            .find_active_node(tenant_id, node_id)
            .await
            .map_err(map_drive_error)?
            .ok_or_else(|| CourseError::not_found(format!("drive node {node_id} was not found")))
    }

    /// Mirrors `find_active_node`'s `validate_space_exists` precondition.
    async fn ensure_active_space(
        &self,
        tenant_id: &str,
        node: &DriveUploaderNodeRecord,
    ) -> CourseResult<()> {
        self.uploader_store()
            .find_active_space(tenant_id, &node.space_id)
            .await
            .map_err(map_drive_error)?
            .map(|_| ())
            .ok_or_else(|| {
                CourseError::not_found(format!("drive space {} was not found", node.space_id))
            })
    }

    /// Reproduces `acl::ensure_ctx_node_role(.., "reader")`: space ownership or
    /// a direct/inherited node permission must satisfy `reader`.
    async fn ensure_reader(
        &self,
        tenant_id: &str,
        node: &DriveUploaderNodeRecord,
        subject_id: &str,
    ) -> CourseResult<()> {
        let permissions = SqlDrivePermissionService::new(self.pool.clone());
        let access = permissions
            .resolve_effective_node_access(ResolveEffectiveNodeAccessCommand {
                tenant_id: tenant_id.to_string(),
                space_id: node.space_id.clone(),
                node_id: node.id.clone(),
                subject_type: SUBJECT_TYPE.to_string(),
                subject_id: subject_id.to_string(),
            })
            .await
            .map_err(map_drive_error)?;
        require_reader_access(&access, &node.id)
    }

    fn uploader_store(&self) -> SqlUploaderStore {
        SqlUploaderStore::new(self.pool.clone())
    }

    fn download_url(&self, token: &str) -> String {
        build_download_url(&self.download_base_url, token)
    }
}

/// Addresses Drive's canonical download-token route on the public ingress.
fn build_download_url(base_url: &str, token: &str) -> String {
    format!("{base_url}{DRIVE_DOWNLOAD_TOKENS_PATH}/{token}")
}

#[async_trait]
impl CourseDrivePort for InProcessDriveCoursePort {
    async fn validate_resource(
        &self,
        context: &CourseServiceContext,
        resource: CourseMediaResourceRef,
    ) -> CourseResult<CourseMediaResourceRef> {
        if is_blank(Some(resource.drive_resource_id.as_str())) {
            return Err(CourseError::invalid("driveResourceId is required"));
        }
        let tenant_id = require_tenant_id(context)?;
        let subject_id = resolve_subject_id(context)?;
        let drive_resource_id = trim(&resource.drive_resource_id);
        let node = self
            .load_active_node(&tenant_id, &drive_resource_id)
            .await?;
        self.ensure_active_space(&tenant_id, &node).await?;
        self.ensure_reader(&tenant_id, &node, &subject_id).await?;
        Ok(resource)
    }

    /// Material-save path: one batch ACL read for every distinct node instead
    /// of one recursive-CTE query per resource.
    async fn validate_resources(
        &self,
        context: &CourseServiceContext,
        resources: Vec<CourseMediaResourceRef>,
    ) -> CourseResult<Vec<CourseMediaResourceRef>> {
        if resources.is_empty() {
            return Ok(resources);
        }
        let node_ids = distinct_node_ids(&resources)?;
        let tenant_id = require_tenant_id(context)?;
        let subject_id = resolve_subject_id(context)?;

        // Same tenant-scoped active-node and active-space preconditions as the
        // single-resource path, once per distinct node rather than per resource.
        for node_id in &node_ids {
            let node = self.load_active_node(&tenant_id, node_id).await?;
            self.ensure_active_space(&tenant_id, &node).await?;
        }

        let permissions = SqlDrivePermissionService::new(self.pool.clone());
        let access_by_node = permissions
            .resolve_node_access_batch(&tenant_id, &node_ids, SUBJECT_TYPE, &subject_id)
            .await
            .map_err(map_drive_error)?;
        require_batch_reader_access(&access_by_node, &resources)?;
        Ok(resources)
    }

    async fn issue_download_grant(
        &self,
        context: &CourseServiceContext,
        resource_ref_id: String,
    ) -> CourseResult<String> {
        if is_blank(Some(resource_ref_id.as_str())) {
            return Err(CourseError::invalid("resourceRefId is required"));
        }
        let tenant_id = require_tenant_id(context)?;
        let subject_id = resolve_subject_id(context)?;
        let node_id = trim(&resource_ref_id);
        let node = self.load_active_node(&tenant_id, &node_id).await?;
        self.ensure_active_space(&tenant_id, &node).await?;
        self.ensure_reader(&tenant_id, &node, &subject_id).await?;

        let ttl_seconds = clamp_grant_ttl(GRANT_TTL_SECONDS);
        let expires_at_epoch_ms = now_epoch_ms() + i64::from(ttl_seconds) * 1_000;
        let token = build_download_token(&tenant_id, &node.id, expires_at_epoch_ms)
            .map_err(map_drive_error)?;
        Ok(self.download_url(&token))
    }
}

/// Verifies the Drive schema is installed in the shared PostgreSQL so the
/// in-process port fails at startup rather than at the first course mutation.
async fn ensure_drive_schema_present(pool: &PgPool) -> Result<(), String> {
    sqlx::query_scalar::<_, i64>("SELECT 1::bigint FROM dr_drive_node LIMIT 1")
        .fetch_optional(pool)
        .await
        .map(|_| ())
        .map_err(|error| {
            format!(
                "in-process Drive integration requires the Drive schema in the shared PostgreSQL \
                 ({error}); embed the drive capability in this process, or opt into a split \
                 deployment with SDKWORK_DRIVE_APP_API_BASE_URL/SDKWORK_DRIVE_FACADE_URL plus \
                 SDKWORK_ACCESS_TOKEN"
            )
        })
}

fn require_tenant_id(context: &CourseServiceContext) -> CourseResult<String> {
    let tenant_id = trim(&context.tenant_id);
    if is_blank(Some(tenant_id.as_str())) {
        return Err(CourseError::invalid("tenantId is required"));
    }
    Ok(tenant_id)
}

/// The Drive subject: the authenticated user (`user_id`), falling back to the
/// actor id the previous HTTP adapter forwarded as `X-Sdkwork-User-Id`.
fn resolve_subject_id(context: &CourseServiceContext) -> CourseResult<String> {
    context
        .user_id
        .as_deref()
        .map(trim)
        .filter(|value| !is_blank(Some(value.as_str())))
        .or_else(|| {
            context
                .actor_id
                .as_deref()
                .map(trim)
                .filter(|value| !is_blank(Some(value.as_str())))
        })
        .ok_or_else(|| {
            CourseError::invalid(
                "drive access requires an authenticated user in the request context",
            )
        })
}

/// Drive's effective-access verdict must satisfy `reader`; this is the only
/// authorization gate between course and Drive now that the HTTP hop is gone.
fn require_reader_access(access: &DriveEffectiveNodeAccess, node_id: &str) -> CourseResult<()> {
    if access.allows_role(REQUIRED_ROLE) {
        return Ok(());
    }
    Err(CourseError::invalid(format!(
        "permission denied for drive node {node_id}"
    )))
}

/// Distinct, trimmed node ids in first-seen order.
///
/// A blank id keeps the single-resource `driveResourceId is required` error, so
/// the batch path rejects the same inputs the per-resource loop did.
fn distinct_node_ids(resources: &[CourseMediaResourceRef]) -> CourseResult<Vec<String>> {
    let mut seen = HashSet::with_capacity(resources.len());
    let mut node_ids = Vec::new();
    for resource in resources {
        let node_id = trim(&resource.drive_resource_id);
        if node_id.is_empty() {
            return Err(CourseError::invalid("driveResourceId is required"));
        }
        if seen.insert(node_id.clone()) {
            node_ids.push(node_id);
        }
    }
    Ok(node_ids)
}

/// Evaluates every resource against one batch ACL answer, in input order.
///
/// A node absent from the batch has no resolvable access (deleted node or broken
/// ancestry); the single-node resolver reports `NotFound` for that condition, so
/// the same error kind is kept here. A present node whose effective role does
/// not satisfy `reader` keeps the single-node `invalid` denial.
fn require_batch_reader_access(
    access_by_node: &HashMap<String, DriveEffectiveNodeAccess>,
    resources: &[CourseMediaResourceRef],
) -> CourseResult<()> {
    for resource in resources {
        let node_id = trim(&resource.drive_resource_id);
        let access = access_by_node
            .get(&node_id)
            .ok_or_else(|| CourseError::not_found(format!("drive node {node_id} was not found")))?;
        require_reader_access(access, &node_id)?;
    }
    Ok(())
}

/// Keeps the grant TTL inside the bounds the Drive grant route enforced.
fn clamp_grant_ttl(ttl_seconds: u32) -> u32 {
    ttl_seconds.clamp(GRANT_MIN_TTL_SECONDS, GRANT_MAX_TTL_SECONDS)
}

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or_default()
}

/// Course's own published origin for this process; empty means same-origin
/// (relative URL), which is correct for a browser already talking to the ingress.
fn course_public_base_url() -> String {
    std::env::var(COURSE_PUBLIC_BASE_URL_ENV)
        .map(|value| trim(&value).trim_end_matches('/').to_string())
        .unwrap_or_default()
}

/// Maps Drive's typed service errors to the course error kinds the previous
/// HTTP adapter produced: not-found stays `not_found`; permission-denied and
/// validation become `invalid` (the HTTP adapter mapped 403 to `invalid` and
/// pre-validated its own inputs); everything else is a storage failure.
fn map_drive_error(error: DriveServiceError) -> CourseError {
    match error {
        DriveServiceError::NotFound(message) => CourseError::not_found(message),
        DriveServiceError::PermissionDenied(message) => CourseError::invalid(message),
        DriveServiceError::Validation(message) => CourseError::invalid(message),
        DriveServiceError::Conflict(message) => CourseError::storage(message),
        DriveServiceError::Internal(message) => CourseError::storage(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> CourseServiceContext {
        CourseServiceContext {
            tenant_id: "100001".to_string(),
            organization_id: "200001".to_string(),
            actor_id: Some("actor-1".to_string()),
            user_id: Some("user-1".to_string()),
            request_id: None,
            trace_id: None,
            permissions: Vec::new(),
        }
    }

    #[test]
    fn drive_errors_keep_the_http_adapter_error_kinds() {
        assert_eq!(
            map_drive_error(DriveServiceError::NotFound("node".to_string())).code(),
            "not_found"
        );
        assert_eq!(
            map_drive_error(DriveServiceError::PermissionDenied("node".to_string())).code(),
            "invalid"
        );
        assert_eq!(
            map_drive_error(DriveServiceError::Validation("node".to_string())).code(),
            "invalid"
        );
        assert_eq!(
            map_drive_error(DriveServiceError::Conflict("node".to_string())).code(),
            "storage"
        );
        assert_eq!(
            map_drive_error(DriveServiceError::Internal("node".to_string())).code(),
            "storage"
        );
    }

    #[test]
    fn grant_ttl_stays_inside_the_drive_route_bounds() {
        assert_eq!(clamp_grant_ttl(GRANT_TTL_SECONDS), 120);
        assert_eq!(clamp_grant_ttl(1), GRANT_MIN_TTL_SECONDS);
        assert_eq!(clamp_grant_ttl(3_600), GRANT_MAX_TTL_SECONDS);
    }

    #[test]
    fn download_url_uses_the_canonical_drive_app_api_path() {
        assert_eq!(
            build_download_url("https://course.example.com", "dlv2_token"),
            "https://course.example.com/app/v3/api/drive/download_tokens/dlv2_token"
        );
    }

    #[test]
    fn download_url_is_same_origin_when_no_public_base_url_is_configured() {
        assert_eq!(
            build_download_url("", "dlv2_token"),
            "/app/v3/api/drive/download_tokens/dlv2_token"
        );
    }

    #[test]
    fn subject_prefers_the_authenticated_user_then_the_actor() {
        let mut context = context();
        assert_eq!(resolve_subject_id(&context).expect("subject"), "user-1");

        context.user_id = None;
        assert_eq!(resolve_subject_id(&context).expect("subject"), "actor-1");

        context.actor_id = None;
        assert_eq!(
            resolve_subject_id(&context).expect_err("no subject").code(),
            "invalid"
        );
    }

    #[test]
    fn a_blank_tenant_is_rejected_before_any_drive_call() {
        let mut context = context();
        context.tenant_id = "   ".to_string();
        assert_eq!(
            require_tenant_id(&context)
                .expect_err("blank tenant")
                .code(),
            "invalid"
        );
    }

    fn access(role: &str) -> DriveEffectiveNodeAccess {
        DriveEffectiveNodeAccess {
            role: role.to_string(),
            source: "permission".to_string(),
            permission_id: None,
            inherited: false,
            inherited_from_node_id: None,
        }
    }

    #[test]
    fn a_non_reader_subject_is_denied() {
        // Drive's effective role for a subject without a grant, and any unknown
        // role string, must not open the course media path.
        for denied in ["none", "unknown", ""] {
            let error = require_reader_access(&access(denied), "node-1")
                .expect_err("a non-reader must be denied");
            assert_eq!(error.code(), "invalid", "role {denied:?}");
            assert!(error.message().contains("node-1"), "{error}");
        }
    }

    #[test]
    fn every_reader_satisfying_role_is_accepted() {
        for allowed in ["reader", "commenter", "writer", "owner"] {
            assert!(
                require_reader_access(&access(allowed), "node-1").is_ok(),
                "role {allowed:?} satisfies reader"
            );
        }
    }

    fn resource(node_id: &str) -> CourseMediaResourceRef {
        CourseMediaResourceRef {
            drive_resource_id: node_id.to_string(),
            role: "attachment".to_string(),
            mime_type: None,
            duration_seconds: None,
            metadata: None,
        }
    }

    fn production_source() -> &'static str {
        include_str!("drive_in_process.rs")
            .split("#[cfg(test)]")
            .next()
            .expect("the module has a production section")
    }

    /// The production body of one async method, ending at the next method.
    fn method_body<'a>(source: &'a str, name: &str) -> &'a str {
        let start = source
            .rfind(&format!("async fn {name}"))
            .unwrap_or_else(|| panic!("missing async fn {name}"));
        let rest = &source[start..];
        let end = rest[1..]
            .find("\n    async fn ")
            .map(|offset| offset + 1)
            .unwrap_or(rest.len());
        &rest[..end]
    }

    const COURSE_SERVICE_SOURCE: &str =
        include_str!("../../../sdkwork-content-course-service/src/service/course_service.rs");

    fn course_service_production() -> &'static str {
        COURSE_SERVICE_SOURCE
            .split("#[cfg(test)]")
            .next()
            .expect("the service module has a production section")
    }

    #[test]
    fn a_material_save_resolves_every_distinct_node_in_one_batch_acl_query() {
        let body = method_body(production_source(), "validate_resources");
        assert_eq!(
            body.matches(".resolve_node_access_batch(").count(),
            1,
            "the save path must issue exactly one batch ACL query: {body}"
        );
        for single_node in [
            ".resolve_effective_node_access(",
            ".ensure_reader(",
            ".validate_resource(",
        ] {
            assert_eq!(
                body.matches(single_node).count(),
                0,
                "the save path must not use {single_node}: {body}"
            );
        }
    }

    #[test]
    fn duplicate_node_references_collapse_to_one_distinct_id() {
        let resources = [resource("node-1"), resource("node-2"), resource("node-1")];
        assert_eq!(
            distinct_node_ids(&resources).expect("distinct ids"),
            vec!["node-1".to_string(), "node-2".to_string()]
        );
    }

    #[test]
    fn an_empty_material_set_issues_no_node_or_acl_query() {
        assert!(distinct_node_ids(&[]).expect("distinct ids").is_empty());
        let body = method_body(production_source(), "validate_resources");
        let guard = body.find("if resources.is_empty()").expect("empty guard");
        let node_read = body.find(".load_active_node(").expect("node read");
        let acl = body.find(".resolve_node_access_batch(").expect("batch ACL");
        assert!(guard < node_read, "empty guard must precede node reads");
        assert!(guard < acl, "empty guard must precede the batch ACL query");
    }

    #[test]
    fn a_denied_node_keeps_the_single_resource_error_kind() {
        let mut access_by_node = HashMap::new();
        access_by_node.insert("node-1".to_string(), access("reader"));
        access_by_node.insert("node-2".to_string(), access("none"));

        let error =
            require_batch_reader_access(&access_by_node, &[resource("node-1"), resource("node-2")])
                .expect_err("a non-reader must be denied");
        assert_eq!(error.code(), "invalid");
        assert!(error.message().contains("node-2"), "{error}");
    }

    #[test]
    fn a_node_absent_from_the_batch_keeps_the_not_found_kind_in_resource_order() {
        let mut access_by_node = HashMap::new();
        access_by_node.insert("node-1".to_string(), access("reader"));
        access_by_node.insert("node-3".to_string(), access("reader"));

        let error = require_batch_reader_access(
            &access_by_node,
            &[resource("node-1"), resource("node-2"), resource("node-3")],
        )
        .expect_err("node-2 has no batch answer");
        assert_eq!(error.code(), "not_found");
        assert!(error.message().contains("node-2"), "{error}");
    }

    #[test]
    fn the_studio_and_lesson_save_paths_ask_the_port_for_one_batch_validation() {
        let production = course_service_production();
        for name in ["save_studio_course", "save_lesson"] {
            let body = method_body(production, name);
            assert_eq!(
                body.matches(".validate_resources(").count(),
                1,
                "{name} must validate its material set in one call: {body}"
            );
            assert_eq!(
                body.matches(".validate_resource(").count(),
                0,
                "{name} must not validate resources one by one: {body}"
            );
        }
    }
}
