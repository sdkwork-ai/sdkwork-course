//! Gateway bootstrap for sdkwork-course.
//! Multi-surface merges mount shared infrastructure routes once at the assembly layer
//! so `/healthz`, `/livez`, `/readyz`, and `/metrics` are not duplicated per surface.

use std::sync::Arc;

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
