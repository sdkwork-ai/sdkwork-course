-- sdkwork:migration
-- id: 0005_course_live_attendance
-- engine: postgres
-- module: sdkwork-course
-- purpose: Persist learner live-session attendance so join/heartbeat/leave are
--   real lifecycle operations and attendee counts are computed from them.
-- reversible: false
-- rollback: forward-fix (attendance is append/update-only operational data)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

CREATE TABLE IF NOT EXISTS course_live_attendance (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  live_session_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  offering_id TEXT NOT NULL,
  lesson_id TEXT,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  last_heartbeat_at TEXT,
  left_at TEXT,
  attendance_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (tenant_id, live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_live_attendance_session
  ON course_live_attendance (tenant_id, live_session_id, status);

COMMIT;
