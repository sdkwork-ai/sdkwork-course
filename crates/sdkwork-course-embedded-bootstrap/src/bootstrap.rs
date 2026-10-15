use std::sync::Arc;

use axum::Router;
use sdkwork_content_course_repository_sqlx::{
    connect_and_bootstrap_course_database_from_env, PostgresCourseRepository,
};
use sdkwork_content_course_service::{
    ports::repository::{
        CourseApplicationRepository, CourseAuditLogRepository, CourseCatalogRepository,
        CourseCategoryRepository, CourseCommentRepository, CourseEnrollmentRepository,
        CourseInstructorRepository, CourseLessonRepository, CourseLiveSessionRepository,
        CourseOfferingRepository, CourseProgressRepository, CourseReactionRepository,
        CourseResourceRepository,
    },
    CourseApplicationService, CourseServiceImpl,
};
use sdkwork_course_database_host::bootstrap_course_database;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_routes_course_app_api::gateway_mount as mount_course_app_api;
use sdkwork_routes_course_backend_api::gateway_mount as mount_course_backend_api;

use crate::port_factory::build_provider_ports;

fn build_course_service<R>(repo: R) -> Arc<dyn CourseApplicationService>
where
    R: CourseCategoryRepository
        + CourseCatalogRepository
        + CourseInstructorRepository
        + CourseOfferingRepository
        + CourseLessonRepository
        + CourseLiveSessionRepository
        + CourseEnrollmentRepository
        + CourseProgressRepository
        + CourseCommentRepository
        + CourseApplicationRepository
        + CourseAuditLogRepository
        + CourseResourceRepository
        + CourseReactionRepository
        + Clone
        + 'static,
{
    let ports = build_provider_ports();
    Arc::new(CourseServiceImpl::new(
        Box::new(repo.clone()) as Box<dyn CourseCategoryRepository>,
        Box::new(repo.clone()) as Box<dyn CourseCatalogRepository>,
        Box::new(repo.clone()) as Box<dyn CourseInstructorRepository>,
        Box::new(repo.clone()) as Box<dyn CourseOfferingRepository>,
        Box::new(repo.clone()) as Box<dyn CourseLessonRepository>,
        Box::new(repo.clone()) as Box<dyn CourseLiveSessionRepository>,
        Box::new(repo.clone()) as Box<dyn CourseEnrollmentRepository>,
        Box::new(repo.clone()) as Box<dyn CourseProgressRepository>,
        Box::new(repo.clone()) as Box<dyn CourseCommentRepository>,
        Box::new(repo.clone()) as Box<dyn CourseApplicationRepository>,
        Box::new(repo.clone()) as Box<dyn CourseAuditLogRepository>,
        Box::new(repo.clone()) as Box<dyn CourseResourceRepository>,
        Box::new(repo.clone()) as Box<dyn CourseReactionRepository>,
        ports.drive,
        ports.live,
        ports.entitlement,
        ports.notification,
        ports.audit,
    )) as Arc<dyn CourseApplicationService>
}

/// Embedded course assembly: the mounted router plus the pool it was built on.
pub struct EmbeddedCourseAssembly {
    pub router: Router,
    pub database_pool: DatabasePool,
}

/// Course capability runtime on a host-owned database pool.
///
/// Embedded hosts (platform gateways, unified-process compositions) build the
/// service from the pool they already own so every mounted capability shares one
/// connection pool (`API_ASSEMBLY_SPEC` section 6.1 same-origin dependency
/// composition).
pub struct CourseServiceRuntime {
    pub service: Arc<dyn CourseApplicationService>,
    pub database_pool: DatabasePool,
}

/// Builds the course service on an already-created pool.
///
/// The course schema is bootstrapped on that pool first: a host that mounts the
/// capability owns its lifecycle, so the embedded pool entrypoint never assumes
/// the caller already ran the course migrations. `from_env` connects and
/// bootstraps its own pool and therefore must not bootstrap twice.
pub async fn course_service_runtime_from_pool(
    pool: DatabasePool,
) -> Result<CourseServiceRuntime, String> {
    let postgres_pool = pool
        .as_postgres()
        .ok_or_else(|| "embedded Course API requires PostgreSQL".to_owned())?
        .clone();
    let _host = bootstrap_course_database(pool.clone()).await?;
    let service = build_course_service(PostgresCourseRepository::new(postgres_pool));
    Ok(CourseServiceRuntime {
        service,
        database_pool: pool,
    })
}

/// Same as [`course_service_runtime_from_pool`] but connecting the pool from the
/// `COURSE` database profile in the environment.
pub async fn course_service_runtime_from_env() -> Result<CourseServiceRuntime, String> {
    let _ = dotenvy::dotenv();
    let host = connect_and_bootstrap_course_database_from_env().await?;
    let pool = host.pool().clone();
    let postgres_pool = pool
        .as_postgres()
        .ok_or_else(|| "embedded Course API requires PostgreSQL".to_owned())?
        .clone();
    let service = build_course_service(PostgresCourseRepository::new(postgres_pool));
    Ok(CourseServiceRuntime {
        service,
        database_pool: pool,
    })
}

/// Composes the course App + backend business router from the `COURSE` database
/// profile in the environment.
pub async fn assemble_embedded_course_application_router_from_env(
) -> Result<EmbeddedCourseAssembly, String> {
    let runtime = course_service_runtime_from_env().await?;
    Ok(EmbeddedCourseAssembly {
        router: course_application_router(&runtime.service),
        database_pool: runtime.database_pool,
    })
}

/// Same as [`assemble_embedded_course_application_router_from_env`] but from an
/// already-created process pool.
pub async fn assemble_embedded_course_application_router(
    pool: DatabasePool,
) -> Result<EmbeddedCourseAssembly, String> {
    let runtime = course_service_runtime_from_pool(pool).await?;
    Ok(EmbeddedCourseAssembly {
        router: course_application_router(&runtime.service),
        database_pool: runtime.database_pool,
    })
}

/// Composes the course **backend** business router only, for a consuming host
/// that merges it into its own backend plane
/// (`API_ASSEMBLY_SPEC` section 3 federated backend entrypoint).
///
/// The App surface stays out of this entrypoint: the host owns the single App
/// plane and composes capability manifests instead of mounting a dependency's
/// App router.
pub async fn assemble_embedded_course_backend_router(
    pool: DatabasePool,
) -> Result<EmbeddedCourseAssembly, String> {
    let runtime = course_service_runtime_from_pool(pool).await?;
    Ok(EmbeddedCourseAssembly {
        router: course_backend_router(runtime.service),
        database_pool: runtime.database_pool,
    })
}

/// Same as [`assemble_embedded_course_backend_router`] but connecting the pool
/// from the `COURSE` database profile in the environment.
pub async fn assemble_embedded_course_backend_router_from_env(
) -> Result<EmbeddedCourseAssembly, String> {
    let runtime = course_service_runtime_from_env().await?;
    Ok(EmbeddedCourseAssembly {
        router: course_backend_router(runtime.service),
        database_pool: runtime.database_pool,
    })
}

fn course_application_router(service: &Arc<dyn CourseApplicationService>) -> Router {
    let backend = course_backend_router(Arc::clone(service));
    mount_course_app_api(Arc::clone(service)).merge(backend)
}

fn course_backend_router(service: Arc<dyn CourseApplicationService>) -> Router {
    mount_course_backend_api(service)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backend_entrypoint_mounts_only_the_backend_surface() {
        let source = include_str!("bootstrap.rs");
        let start = source
            .find("pub async fn assemble_embedded_course_backend_router(")
            .expect("backend router entrypoint");
        let end = source[start..]
            .find("\n/// Same as [`assemble_embedded_course_backend_router`]")
            .map(|offset| start + offset)
            .unwrap_or(source.len());
        let body = &source[start..end];

        assert!(body.contains("course_backend_router("));
        assert!(
            !body.contains("mount_course_app_api"),
            "the federated backend entrypoint must not mount the App surface"
        );
    }

    #[test]
    fn env_entrypoint_does_not_rebootstrap_the_pool() {
        let source = include_str!("bootstrap.rs");
        let start = source
            .find("pub async fn course_service_runtime_from_env(")
            .expect("env service runtime entrypoint");
        let end = source[start..]
            .find("\n/// Composes the course App + backend business router")
            .map(|offset| start + offset)
            .unwrap_or(source.len());
        let body = &source[start..end];

        assert!(body.contains("connect_and_bootstrap_course_database_from_env()"));
        assert!(
            !body.contains("bootstrap_course_database("),
            "the env entrypoint must not bootstrap a pool that was already bootstrapped"
        );
    }
}
