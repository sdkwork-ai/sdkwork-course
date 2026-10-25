-- sdkwork:migration
-- id: 0006_question_bank
-- engine: postgres
-- module: sdkwork-course
-- purpose: Local question-bank capability: questions with grade/subject/chapter/
--   knowledge-point binding, papers (smart + manual composition) with item
--   score allocation, and teaching handouts that embed bank questions.
-- reversible: false
-- rollback: forward-fix (teaching content is owner-authored; drops are handled
--   by the owner rows, never by pattern deletion)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

CREATE TABLE IF NOT EXISTS course_question (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  question_code TEXT NOT NULL,
  -- grade7 / grade8 / grade9
  grade_level TEXT NOT NULL,
  -- math / english / history / geography / biology (extensible per tenant)
  subject TEXT NOT NULL,
  chapter TEXT,
  knowledge_points_json TEXT NOT NULL DEFAULT '[]',
  -- single_choice / multi_choice / true_false / fill_blank / solution / analysis
  question_type TEXT NOT NULL,
  stem TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  answer TEXT NOT NULL DEFAULT '',
  analysis TEXT,
  -- easy / medium / hard
  difficulty TEXT NOT NULL DEFAULT 'medium',
  -- decimal score serialized as text, mirroring price_amount on course_catalog
  default_score TEXT NOT NULL DEFAULT '0',
  -- manual / import / real_exam
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  -- teacher-curated wrong-question collection (错题本)
  wrong_book INTEGER NOT NULL DEFAULT 0,
  wrong_note TEXT,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (tenant_id, organization_id, question_code)
);

CREATE TABLE IF NOT EXISTS course_question_paper (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  paper_code TEXT NOT NULL,
  title TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- smart / manual
  paper_mode TEXT NOT NULL DEFAULT 'manual',
  exam_duration_seconds INTEGER NOT NULL DEFAULT 0,
  total_score TEXT NOT NULL DEFAULT '0',
  -- composition scope snapshot: chapters, knowledge points, buckets
  scope_json TEXT NOT NULL DEFAULT '{}',
  -- per-section score allocation snapshot
  score_allocation_json TEXT NOT NULL DEFAULT '[]',
  header_note TEXT,
  sealed_line INTEGER NOT NULL DEFAULT 1,
  -- draft / archived
  paper_status TEXT NOT NULL DEFAULT 'draft',
  archived_at TEXT,
  owner_user_id TEXT,
  question_count_snapshot INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (tenant_id, organization_id, paper_code)
);

CREATE TABLE IF NOT EXISTS course_question_paper_item (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  paper_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  -- section number (大题号), grouped by question type
  section_no TEXT NOT NULL DEFAULT '1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- per-question allocated score, decimal serialized as text
  score TEXT NOT NULL DEFAULT '0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, paper_id, question_id)
);

CREATE TABLE IF NOT EXISTS course_question_handout (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  handout_code TEXT NOT NULL,
  title TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- lesson period label (课时), free-form per tenant
  lesson_tag TEXT,
  -- serialized block list: heading/text/summary/question blocks
  body_json TEXT NOT NULL DEFAULT '[]',
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  UNIQUE (tenant_id, organization_id, handout_code)
);

CREATE TABLE IF NOT EXISTS course_question_handout_item (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT '0',
  handout_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- example / practice
  usage_role TEXT NOT NULL DEFAULT 'practice',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, handout_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_course_question_bank_filter
  ON course_question (tenant_id, organization_id, grade_level, subject, question_type, difficulty);
CREATE INDEX IF NOT EXISTS idx_course_question_chapter
  ON course_question (tenant_id, organization_id, subject, chapter);
CREATE INDEX IF NOT EXISTS idx_course_question_wrong_book
  ON course_question (tenant_id, organization_id, wrong_book, subject);
CREATE INDEX IF NOT EXISTS idx_course_question_owner
  ON course_question (tenant_id, owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_course_question_paper_owner_status
  ON course_question_paper (tenant_id, organization_id, owner_user_id, paper_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_course_question_paper_item_paper
  ON course_question_paper_item (paper_id, section_no, sort_order);
CREATE INDEX IF NOT EXISTS idx_course_question_paper_item_question
  ON course_question_paper_item (question_id);
CREATE INDEX IF NOT EXISTS idx_course_question_handout_owner
  ON course_question_handout (tenant_id, organization_id, owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_course_question_handout_item_handout
  ON course_question_handout_item (handout_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_course_question_handout_item_question
  ON course_question_handout_item (question_id);

COMMIT;
