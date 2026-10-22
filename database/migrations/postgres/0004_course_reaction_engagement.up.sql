-- sdkwork:migration
-- id: 0004_course_reaction_engagement
-- engine: postgres
-- module: sdkwork-course
-- purpose: Ensure older course databases have the reaction table used by the
--   course engagement endpoint; the consolidated baseline creates it for fresh
--   installs but existing databases only had organization_id backfills.
-- reversible: false
-- rollback: forward-fix (drop course_reaction only after moving engagement data)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

CREATE TABLE IF NOT EXISTS course_reaction (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  reaction_value TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (tenant_id, target_type, target_id, actor_user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_course_reaction_target
  ON course_reaction (target_type, target_id, reaction_type, status);

COMMIT;
