import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const QUESTION_BANK_TABLES = [
  'course_question',
  'course_question_paper',
  'course_question_paper_item',
  'course_question_handout',
  'course_question_handout_item',
];

const QUESTION_BANK_OPERATIONS = [
  { method: 'GET', path: '/app/v3/api/question_bank/questions', operationId: 'questionBankQuestions.list' },
  { method: 'POST', path: '/app/v3/api/question_bank/questions', operationId: 'questionBankQuestions.create' },
  { method: 'GET', path: '/app/v3/api/question_bank/questions/{questionId}', operationId: 'questionBankQuestions.retrieve' },
  { method: 'PUT', path: '/app/v3/api/question_bank/questions/{questionId}', operationId: 'questionBankQuestions.update' },
  { method: 'DELETE', path: '/app/v3/api/question_bank/questions/{questionId}', operationId: 'questionBankQuestions.delete' },
  { method: 'POST', path: '/app/v3/api/question_bank/questions/import', operationId: 'questionBankQuestions.import' },
  { method: 'POST', path: '/app/v3/api/question_bank/questions/batch_update', operationId: 'questionBankQuestions.batchUpdate' },
  { method: 'POST', path: '/app/v3/api/question_bank/questions/batch_delete', operationId: 'questionBankQuestions.batchDelete' },
  { method: 'GET', path: '/app/v3/api/question_bank/taxonomy', operationId: 'questionBankTaxonomy.retrieve' },
  { method: 'GET', path: '/app/v3/api/question_bank/papers', operationId: 'questionBankPapers.list' },
  { method: 'POST', path: '/app/v3/api/question_bank/papers', operationId: 'questionBankPapers.create' },
  { method: 'GET', path: '/app/v3/api/question_bank/papers/{paperId}', operationId: 'questionBankPapers.retrieve' },
  { method: 'PUT', path: '/app/v3/api/question_bank/papers/{paperId}', operationId: 'questionBankPapers.update' },
  { method: 'DELETE', path: '/app/v3/api/question_bank/papers/{paperId}', operationId: 'questionBankPapers.delete' },
  { method: 'POST', path: '/app/v3/api/question_bank/papers/{paperId}/archive', operationId: 'questionBankPapers.archive' },
  { method: 'GET', path: '/app/v3/api/question_bank/handouts', operationId: 'questionBankHandouts.list' },
  { method: 'POST', path: '/app/v3/api/question_bank/handouts', operationId: 'questionBankHandouts.create' },
  { method: 'GET', path: '/app/v3/api/question_bank/handouts/{handoutId}', operationId: 'questionBankHandouts.retrieve' },
  { method: 'PUT', path: '/app/v3/api/question_bank/handouts/{handoutId}', operationId: 'questionBankHandouts.update' },
  { method: 'DELETE', path: '/app/v3/api/question_bank/handouts/{handoutId}', operationId: 'questionBankHandouts.delete' },
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readSource(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('question bank migration and baseline define the storage tables', () => {
  const migration = readSource('database/migrations/postgres/0006_question_bank.up.sql');
  assert.match(migration, /-- sdkwork:migration/u, 'migration header missing');
  assert.match(migration, /-- id: 0006_question_bank/u);
  assert.match(migration, /BEGIN;/u, 'migration must be transactional');
  assert.match(migration, /COMMIT;/u);
  for (const table of QUESTION_BANK_TABLES) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'u'), `${table} missing from migration`);
    const baseline = readSource('database/ddl/baseline/postgres/0001_course_baseline.sql');
    assert.match(baseline, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'u'), `${table} missing from consolidated baseline`);
  }
});

test('database contract registry materialized the question bank tables', () => {
  const registry = readJson('database/contract/table-registry.json');
  const names = new Set(registry.tables.map((entry) => entry.table_name));
  for (const table of QUESTION_BANK_TABLES) {
    assert.ok(names.has(table), `${table} missing from table registry`);
  }
});

test('app-api operations plan declares the question bank surface', () => {
  const plan = readJson('apis/app-api/course/operations.json');
  for (const expected of QUESTION_BANK_OPERATIONS) {
    const found = plan.operations.find(
      (operation) => operation.method === expected.method && operation.path === expected.path,
    );
    assert.ok(found, `${expected.method} ${expected.path} missing from operations plan`);
    assert.equal(found.operationId, expected.operationId);
    assert.equal(found.authMode, 'dual-token', `${expected.operationId} must require dual-token auth`);
  }
});

test('materialized route manifest and OpenAPI authority carry the question bank routes', () => {
  const manifest = readJson(
    'sdks/_route-manifests/app-api/sdkwork-routes-course-app-api.route-manifest.json',
  );
  for (const expected of QUESTION_BANK_OPERATIONS) {
    const route = manifest.routes.find((entry) => entry.operationId === expected.operationId);
    assert.ok(route, `${expected.operationId} missing from route manifest`);
    assert.equal(route.schemas.problem, 'ProblemDetail');
  }
  const authority = readJson(
    'sdks/sdkwork-course-app-sdk/openapi/sdkwork-course-app-api.openapi.yaml',
  );
  for (const expected of QUESTION_BANK_OPERATIONS) {
    const pathItem = authority.paths?.[expected.path];
    assert.ok(pathItem, `${expected.path} missing from OpenAPI authority`);
    assert.ok(pathItem[expected.method.toLowerCase()], `${expected.operationId} missing from OpenAPI authority`);
  }
});

test('generated app SDK exposes the question bank resources', () => {
  const sdkSource = readSource(
    'sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi/src/sdk.ts',
  );
  for (const resource of ['questionBankQuestions', 'questionBankPapers', 'questionBankHandouts', 'questionBankTaxonomy']) {
    assert.match(sdkSource, new RegExp(`public readonly ${resource}:`, 'u'), `${resource} missing from generated SDK client`);
  }
  const questionsApi = readSource(
    'sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi/src/api/question-bank-questions.ts',
  );
  for (const method of ['list', 'create', 'retrieve', 'update', 'delete', 'import', 'batchUpdate', 'batchDelete']) {
    assert.match(questionsApi, new RegExp(`async ${method}\\(`, 'u'), `questionBankQuestions.${method} missing`);
  }
});

test('rust layers wire the question bank end to end', () => {
  const service = readSource(
    'crates/sdkwork-content-course-service/src/service/question_bank_service.rs',
  );
  assert.match(service, /pub trait QuestionBankService/u);
  assert.match(service, /async fn compose_paper/u, 'smart/manual composition entrypoint missing');

  const repository = readSource(
    'crates/sdkwork-content-course-repository-sqlx/src/repository/postgres_question_bank.rs',
  );
  assert.match(repository, /impl QuestionBankRepository for PostgresCourseRepository/u);
  assert.match(repository, /QUESTION_COMPOSE_SQL/u);
  assert.match(repository, /ORDER BY random\(\) LIMIT/u, 'compose selection must happen store-side');

  const bootstrap = readSource('crates/sdkwork-course-embedded-bootstrap/src/bootstrap.rs');
  assert.match(bootstrap, /QuestionBankServiceImpl::new/u);
  assert.match(bootstrap, /question_bank_service/u);

  const routes = readSource('crates/sdkwork-routes-course-app-api/src/routes.rs');
  for (const path of [
    '/question_bank/questions',
    '/question_bank/questions/{questionId}',
    '/question_bank/taxonomy',
    '/question_bank/papers',
    '/question_bank/papers/{paperId}',
    '/question_bank/papers/{paperId}/archive',
    '/question_bank/handouts',
    '/question_bank/handouts/{handoutId}',
  ]) {
    // routes.rs interpolates through format!, so literal path braces are doubled.
    const sourcePattern = path.replace(
      /[{}]/g,
      (brace) => '\\' + brace + '\\' + brace,
    );
    assert.match(routes, new RegExp(sourcePattern, 'u'), `${path} route missing`);
  }

  const httpManifest = readSource('crates/sdkwork-routes-course-app-api/src/http_route_manifest.rs');
  assert.match(httpManifest, /questionBankQuestions\.list/u);
  assert.match(httpManifest, /questionBankPapers\.archive/u);
});

test('pc app mounts the question bank surface', () => {
  const app = readSource('apps/sdkwork-course-pc/src/App.tsx');
  for (const path of ['/questionbank', '/questionbank/papers', '/questionbank/handouts']) {
    assert.match(app, new RegExp(`path="${path.replace(/\//g, '\\/')}`, 'u'), `${path} route missing from PC app`);
  }
  assert.match(app, /QuestionBankPage/u);
  const pkg = readJson('apps/sdkwork-course-pc/package.json');
  assert.ok(
    pkg.dependencies['@sdkwork/sdkwork-course-pc-questionbank'],
    'PC app must depend on the questionbank package',
  );
});

test('question bank demo seed is registered and tenant scoped', () => {
  const manifest = readJson('database/seeds/seed.manifest.json');
  assert.ok(
    manifest.profiles.standard.common.includes('common/021_question_bank.sql'),
    'question bank seed missing from standard profile',
  );
  const seed = readSource('database/seeds/common/021_question_bank.sql');
  assert.match(seed, /tenant_id/u);
  assert.match(seed, /INSERT INTO course_question/u);
  for (const subject of ['math', 'english', 'history', 'geography', 'biology']) {
    assert.match(seed, new RegExp(`'${subject}'`, 'u'), `seed lacks ${subject} questions`);
  }
});
