//! Gateway bootstrap for sdkwork-course.
//! Multi-surface merges mount shared infrastructure routes once at the assembly layer
//! so `/healthz`, `/livez`, `/readyz`, and `/metrics` are not duplicated per surface.

use std::sync::Arc;

use axum::Router;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_web_bootstrap::{ApiAssemblyContribution, DatabasePoolReadinessCheck, WebModule};
use sdkwork_web_core::HttpRouteManifest;

pub type ApiAssembly = ApiAssemblyContribution;

pub async fn assemble_api_router() -> Result<ApiAssembly, String> {
    let embedded =
        sdkwork_course_embedded_bootstrap::assemble_embedded_course_application_router_from_env()
            .await?;
    contribution_from_embedded(embedded)
}

pub async fn assemble_api_router_with_pool(pool: DatabasePool) -> Result<ApiAssembly, String> {
    let embedded =
        sdkwork_course_embedded_bootstrap::assemble_embedded_course_application_router(pool)
            .await?;
    contribution_from_embedded(embedded)
}

fn contribution_from_embedded(
    embedded: sdkwork_course_embedded_bootstrap::EmbeddedCourseAssembly,
) -> Result<ApiAssembly, String> {
    let mut routes = Vec::new();
    routes.extend_from_slice(
        sdkwork_routes_course_app_api::course_app_api_http_route_manifest().routes(),
    );
    routes.extend_from_slice(
        sdkwork_routes_course_backend_api::course_backend_api_http_route_manifest().routes(),
    );
    ApiAssemblyContribution::from_manifest(
        "sdkwork-course",
        "SDKWork Course API",
        embedded.router,
        HttpRouteManifest::from_owned_routes(routes),
        Vec::new(),
        Arc::new(DatabasePoolReadinessCheck::new(embedded.database_pool)),
    )
}

/// Canonical Web Module definition for this application
/// (API_ASSEMBLY_SPEC §4.1.1): the complete HTTP surface — every route,
/// manifest, and OpenAPI document of this owner — as one installable module.
pub async fn web_module() -> Result<WebModule, String> {
    Ok(WebModule::from_contribution(assemble_api_router().await?))
}

/// Same as [`web_module`] but composed on a process-shared database pool
/// (platform gateways, API_ASSEMBLY_SPEC §4.1.1).
pub async fn web_module_with_pool(pool: DatabasePool) -> Result<WebModule, String> {
    Ok(WebModule::from_contribution(assemble_api_router_with_pool(pool).await?))
}

/// Course backend business router for consuming hosts
/// (API_ASSEMBLY_SPEC §3 federated backend entrypoint).
///
/// The consuming gateway merges [`BusinessRouterAssembly::router`] into its own
/// backend plane and composes
/// `sdkwork_routes_course_backend_api::course_backend_api_http_route_manifest()`
/// into its route inventory, so the Web Framework honors the course routes'
/// declared dual-token authentication and `course.*` permissions. Mirroring the
/// membership/community/promotion backend business assemblies, the host merges
/// the router before installing its own Web Framework layer and never imports
/// the route crate directly.
pub struct BusinessRouterAssembly {
    pub router: Router,
}

/// Composes the course backend business router from the `COURSE` database
/// profile in the environment.
pub async fn assemble_backend_business_router_from_env() -> Result<BusinessRouterAssembly, String> {
    let embedded =
        sdkwork_course_embedded_bootstrap::assemble_embedded_course_backend_router_from_env()
            .await?;
    Ok(BusinessRouterAssembly {
        router: embedded.router,
    })
}

/// Same as [`assemble_backend_business_router_from_env`] but from an
/// already-shared process database pool (platform gateways with a single shared
/// pool; API_ASSEMBLY_SPEC §6.1 same-origin dependency composition).
pub async fn assemble_backend_business_router_with_pool(
    pool: DatabasePool,
) -> Result<BusinessRouterAssembly, String> {
    let embedded =
        sdkwork_course_embedded_bootstrap::assemble_embedded_course_backend_router(pool).await?;
    Ok(BusinessRouterAssembly {
        router: embedded.router,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backend_business_router_uses_the_course_backend_entrypoint() {
        let source = include_str!("bootstrap.rs");

        assert!(source.contains("pub struct BusinessRouterAssembly"));
        assert!(source.contains("pub async fn assemble_backend_business_router_with_pool("));
        assert!(source.contains("pub async fn assemble_backend_business_router_from_env("));
        assert!(source.contains(
            "sdkwork_course_embedded_bootstrap::assemble_embedded_course_backend_router("
        ));
        assert!(source.contains(
            "sdkwork_course_embedded_bootstrap::assemble_embedded_course_backend_router_from_env("
        ));
    }

    #[test]
    fn backend_business_router_does_not_mount_the_app_surface() {
        let source = include_str!("bootstrap.rs");
        let start = source
            .find("pub async fn assemble_backend_business_router_from_env(")
            .expect("backend business router entrypoint");
        // Stop before the test module: the assertions below quote the very
        // tokens they forbid, so a slice that included them would always fail.
        let end = source
            .find("\n#[cfg(test)]")
            .filter(|offset| *offset > start)
            .unwrap_or(source.len());
        let body = &source[start..end];

        assert!(
            !body.contains("assemble_embedded_course_application_router"),
            "the federated backend entrypoint must not mount the App surface"
        );
        assert!(
            !body.contains("ApiAssemblyContribution"),
            "the federated backend entrypoint must not install a Web Framework layer"
        );
    }
}
