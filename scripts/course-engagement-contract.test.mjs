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
