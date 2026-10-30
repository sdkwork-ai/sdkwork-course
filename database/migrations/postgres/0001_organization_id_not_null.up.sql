-- sdkwork:migration
-- id: 0001_organization_id_not_null
-- engine: postgres
-- module: sdkwork-course
-- purpose: Enforce organization_id NOT NULL DEFAULT on all tables in the
--   consolidated baseline. NULL rows (pre-standard data anomalies) are
--   backfilled with the platform sentinel before NOT NULL is set, and
--   NOT NULL columns without an explicit default receive the sentinel
--   default, keeping existing deployments consistent with fresh baseline
--   installs.
-- reversible: false
-- rollback: forward-fix (sentinel backfill is the canonical fix; NULL
--   organization rows are data anomalies)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

ALTER TABLE course_category ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_category SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_category ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_category ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_instructor ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_instructor SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_instructor ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_instructor ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_catalog ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_catalog SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_catalog ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_catalog ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_offering ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_offering SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_offering ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_offering ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_section ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_section SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_section ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_section ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_lesson ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_lesson SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_lesson ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_lesson ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_resource_ref ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_resource_ref SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_resource_ref ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_resource_ref ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_live_session ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_live_session SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_live_session ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_live_session ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_enrollment ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_enrollment SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_enrollment ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_enrollment ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_learning_progress ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_learning_progress SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_learning_progress ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_learning_progress ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_lesson_progress ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_lesson_progress SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_lesson_progress ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_lesson_progress ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_reaction ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_reaction SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_reaction ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_reaction ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_catalog_link ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_catalog_link SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_catalog_link ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_catalog_link ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_application ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_application SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_application ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_application ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE course_audit_log ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '0';
UPDATE course_audit_log SET organization_id = '0' WHERE organization_id IS NULL;
ALTER TABLE course_audit_log ALTER COLUMN organization_id SET DEFAULT '0';
ALTER TABLE course_audit_log ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
