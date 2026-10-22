-- sdkwork:migration
-- id: 0003_drop_course_comment
-- engine: postgres
-- module: sdkwork-course
-- purpose: Retire the course-local comment table after comments and engagement
--   moved to the sdkwork-comments application block.
-- reversible: false
-- rollback: forward-fix (comment data is owned by sdkwork-comments)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

DROP TABLE IF EXISTS course_comment;

COMMIT;
