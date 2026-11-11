//! In-process purchase-to-enrollment grant (`MODULE_SPEC.md` §4.2).
//!
//! The commerce module calls [`CourseEntitlementGrantRepository`] directly on
//! the shared PostgreSQL pool instead of POSTing to the course App API grant
//! endpoint. The grant reuses the same two persisted ports as the route path —
//! the offering scope lookup and the enrollment insert — so both callers write
//! identical `course_enrollment` rows.
//!
//! `course_enrollment` has no dedicated idempotency-key column, and this module
//! adds no schema: the enrollment idempotency key is persisted inside the
//! existing `access_snapshot_json` document under
//! [`ENROLLMENT_IDEMPOTENCY_KEY`]. That is what makes
//! [`CourseEntitlementGrantRepository::list_granted_purchase_refs`] a single
//! tenant-scoped batch query instead of one lookup per purchase.

use std::collections::HashSet;

use sdkwork_content_course_service::{
    ports::repository::{
        CourseEnrollmentRepository, CourseEntitlementGrantRepository, CourseOfferingRepository,
    },
    CourseEnrollmentCommand, CourseError, CourseResult, CourseServiceContext,
};

use crate::repository::course_repository::PostgresCourseRepository;

/// JSON key of the enrollment idempotency key inside
/// `course_enrollment.access_snapshot_json`.
///
/// The commerce relay uses the purchase reference as that key, so the batch
/// lookup below answers "which of these purchases already have an enrollment?"
/// from the rows the grant already persisted. Keeping it in the snapshot column
/// means no schema change and no delivered flag on order storage.
pub(crate) const ENROLLMENT_IDEMPOTENCY_KEY: &str = "idempotencyKey";

/// Serializes the access snapshot for a new enrollment.
///
/// An enrollment created without an idempotency key keeps the column default
/// (`{}`), exactly as before.
pub(crate) fn enrollment_access_snapshot(idempotency_key: Option<&str>) -> String {
    match idempotency_key {
        Some(key) if !key.is_empty() => {
            serde_json::json!({ ENROLLMENT_IDEMPOTENCY_KEY: key }).to_string()
        }
        _ => "{}".to_owned(),
    }
}

/// Backfills the idempotency-key marker on an enrollment that already exists.
///
/// A purchase can be replayed against an enrollment that was created before the
/// marker existed (or by a different enrollment path), so the replay path
/// stamps the key it was called with. The `IS DISTINCT FROM` guard makes the
/// statement a no-op once the marker is already correct.
pub(crate) async fn stamp_enrollment_idempotency_key(
    pool: &sqlx::PgPool,
    tenant_id: &str,
    offering_id: &str,
    learner_user_id: &str,
    idempotency_key: &str,
) -> CourseResult<()> {
    if idempotency_key.is_empty() {
        return Ok(());
    }
    sqlx::query(
        r#"
        UPDATE course_enrollment
        SET access_snapshot_json = jsonb_set(
                CASE
                    WHEN access_snapshot_json IS NULL OR access_snapshot_json = ''
                        THEN '{}'::jsonb
                    ELSE access_snapshot_json::jsonb
                END,
                ARRAY[$4::text],
                to_jsonb($5::text),
                true
            )::text
        WHERE tenant_id = $1
          AND offering_id = $2
          AND user_id = $3
          AND deleted_at IS NULL
          AND access_snapshot_json::jsonb ->> $4::text IS DISTINCT FROM $5::text
        "#,
    )
    .bind(tenant_id)
    .bind(offering_id)
    .bind(learner_user_id)
    .bind(ENROLLMENT_IDEMPOTENCY_KEY)
    .bind(idempotency_key)
    .execute(pool)
    .await
    .map_err(|error| CourseError::storage(error.to_string()))?;
    Ok(())
}

#[async_trait::async_trait]
impl CourseEntitlementGrantRepository for PostgresCourseRepository {
    async fn grant_entitlement_by_offering(
        &self,
        offering_id: String,
        learner_user_id: String,
        purchase_ref: String,
    ) -> CourseResult<String> {
        // The offering is the authority for the tenant scope: the commerce
        // module only knows the offering id, exactly like the HTTP handler.
        let (tenant_id, organization_id) =
            <Self as CourseOfferingRepository>::find_offering_scope(self, offering_id.clone())
                .await?
                .ok_or_else(|| CourseError::not_found("Offering not found"))?;

        let context = CourseServiceContext {
            tenant_id,
            organization_id,
            actor_id: Some(learner_user_id.clone()),
            user_id: Some(learner_user_id.clone()),
            request_id: None,
            trace_id: None,
            permissions: Vec::new(),
        };

        // `purchase_ref` is the enrollment idempotency key; `create_enrollment`
        // persists it in the access snapshot, and also returns the existing
        // enrollment for the same (tenant, offering, learner), so a replayed
        // delivery is a no-op instead of a second row.
        <Self as CourseEnrollmentRepository>::create_enrollment(
            self,
            &context,
            CourseEnrollmentCommand {
                offering_id,
                learner_user_id,
                source: "commerce".to_owned(),
                idempotency_key: Some(purchase_ref),
            },
        )
        .await
    }

    async fn list_granted_purchase_refs(
        &self,
        tenant_id: &str,
        purchase_refs: &[String],
    ) -> CourseResult<HashSet<String>> {
        if purchase_refs.is_empty() {
            return Ok(HashSet::new());
        }

        // One statement for the whole page: tenant scope and the purchase
        // references are both bound, so a page of 50 purchases costs exactly
        // one query instead of 50.
        let granted: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT access_snapshot_json::jsonb ->> $3::text
            FROM course_enrollment
            WHERE tenant_id = $1
              AND deleted_at IS NULL
              AND access_snapshot_json::jsonb ->> $3::text = ANY($2::text[])
            "#,
        )
        .bind(tenant_id)
        .bind(purchase_refs)
        .bind(ENROLLMENT_IDEMPOTENCY_KEY)
        .fetch_all(self.pool())
        .await
        .map_err(|error| CourseError::storage(error.to_string()))?;

        Ok(granted
            .into_iter()
            .filter(|purchase_ref| !purchase_ref.is_empty())
            .collect())
    }
}
