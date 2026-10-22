import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adaptersPath = path.join(
  repoRoot,
  'crates/sdkwork-content-course-repository-sqlx/src/repository/postgres_adapters.rs',
);
const migrationPath = path.join(
  repoRoot,
  'database/migrations/postgres/0004_course_reaction_engagement.up.sql',
);

test('course engagement keeps comments integration optional and typed', () => {
  const source = readFileSync(adaptersPath, 'utf8');
  const engagementStart = source.indexOf('async fn course_engagement(');
  const helperStart = source.indexOf('async fn course_discussion_count(');
  const engagementEnd = source.indexOf('async fn list_reactions(', engagementStart);
  assert.ok(engagementStart >= 0, 'course_engagement implementation is missing');
  assert.ok(helperStart >= 0, 'comments count helper is missing');
  assert.ok(engagementEnd > engagementStart, 'course_engagement body boundary is missing');

  const engagement = source.slice(engagementStart, engagementEnd);
  assert.equal(
    engagement.includes('comments_'),
    false,
    'the main engagement query must only read course-owned tables; comments tables are optional cross-module data',
  );

  const helper = source.slice(helperStart, engagementStart);
  assert.match(helper, /to_regclass\('comments_thread'\)/u);
  assert.match(helper, /to_regclass\('comments_comment'\)/u);
  assert.match(helper, /if !available \{\s*return Ok\(0\);/u);
  assert.match(engagement, /returning 0/u);
  assert.match(
    helper,
    /tenant_id\.parse::<i64>\(\)/u,
    'comments tables use BIGINT tenant ids and must not reuse the TEXT course tenant parameter',
  );
});

test('existing course databases get the reaction table through a migration', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS course_reaction/u);
  assert.match(migration, /idx_course_reaction_target/u);
});

test('live join, heartbeat, and leave persist attendance', () => {
  const repository = readFileSync(
    path.join(
      repoRoot,
      'crates/sdkwork-content-course-repository-sqlx/src/repository/postgres_course_repository_port.rs',
    ),
    'utf8',
  );
  assert.match(repository, /INSERT INTO course_live_attendance/u);
  assert.match(repository, /ON CONFLICT \(tenant_id, live_session_id, user_id\)/u);
  assert.match(repository, /SET last_heartbeat_at = \$1/u);
  assert.match(repository, /SET left_at = \$1/u);

  const service = readFileSync(
    path.join(
      repoRoot,
      'crates/sdkwork-content-course-service/src/service/course_service.rs',
    ),
    'utf8',
  );
  assert.match(service, /record_live_join\(/u);
  assert.match(service, /heartbeat_live_attendance\(/u);
  assert.match(service, /leave_live_attendance\(/u);

  const migration = readFileSync(
    path.join(
      repoRoot,
      'database/migrations/postgres/0005_course_live_attendance.up.sql',
    ),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS course_live_attendance/u);
  assert.match(migration, /UNIQUE \(tenant_id, live_session_id, user_id\)/u);
});
