-- sdkwork:migration
-- id: 0002_course_center_ugc_review
-- engine: postgres
-- module: sdkwork-course
-- purpose: Add UGC ownership, content shape, pricing, and review metadata to
--   course_catalog, plus the review/collection indexes used by the creator
--   studio and operator review queue. Fresh installs already carry these
--   columns from the consolidated baseline.
-- reversible: false
-- rollback: forward-fix (additive columns and indexes are safe to keep)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

-- UGC authoring, review, content shapes, and pricing.
-- Forward migration for environments initialized before the course center
-- upgrade; fresh installs get the same columns from the consolidated baseline.

ALTER TABLE course_catalog
    ADD COLUMN IF NOT EXISTS original_price_amount TEXT,
    ADD COLUMN IF NOT EXISTS is_free INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS course_kind TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS author_user_id TEXT,
    ADD COLUMN IF NOT EXISTS author_display_name TEXT,
    ADD COLUMN IF NOT EXISTS review_note TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
    ADD COLUMN IF NOT EXISTS review_round INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_course_catalog_review_queue
    ON course_catalog (tenant_id, organization_id, publish_status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_course_catalog_author
    ON course_catalog (tenant_id, author_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_course_catalog_kind_status
    ON course_catalog (tenant_id, organization_id, course_kind, publish_status);
CREATE INDEX IF NOT EXISTS idx_course_catalog_link_course
    ON course_catalog_link (course_id, link_type, sort_order);

-- Existing catalog rows keep `standard`/free defaults. Collection rows that
-- predate `course_kind` are marked explicitly.
UPDATE course_catalog
SET course_kind = 'collection', is_collection = 1
WHERE is_collection = 1 AND course_kind = 'standard';

COMMIT;
