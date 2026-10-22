#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const courseRoot = path.resolve(import.meta.dirname, '..');

const schemaContract = JSON.parse(
  fs.readFileSync(path.join(courseRoot, 'specs/openapi/course-operation-schemas.contract.json'), 'utf8'),
);
const backendOpenApi = JSON.parse(
  fs.readFileSync(
    path.join(courseRoot, 'sdks/sdkwork-course-backend-sdk/openapi/sdkwork-course-backend-api.openapi.yaml'),
    'utf8',
  ),
);
const backendManifest = JSON.parse(
  fs.readFileSync(
    path.join(courseRoot, 'sdks/_route-manifests/backend-api/sdkwork-routes-course-backend-api.route-manifest.json'),
    'utf8',
  ),
);
const backendSdkCourses = fs.readFileSync(
  path.join(
    courseRoot,
    'sdks/sdkwork-course-backend-sdk/sdkwork-course-backend-sdk-typescript/generated/server-openapi/src/api/courses.ts',
  ),
  'utf8',
);
const gatewayAssembly = [
  'crates/sdkwork-api-course-assembly/src/lib.rs',
  'crates/sdkwork-api-course-assembly/src/bootstrap.rs',
].map((relativePath) => fs.readFileSync(path.join(courseRoot, relativePath), 'utf8')).join('\n');

assert.ok(schemaContract.schemas?.CourseCatalogCreateRequest, 'schema contract must define CourseCatalogCreateRequest');
assert.ok(schemaContract.operations?.['courses.create']?.request, 'schema contract must map courses.create request DTO');
assert.doesNotMatch(
  JSON.stringify(schemaContract),
  /CourseOperationResult|CourseTypedResult|"requestId"/u,
  'schema contract must not retain legacy HTTP envelopes',
);

const backendSchemas = backendOpenApi.components?.schemas ?? {};
assert.ok(backendSchemas.CourseCommandBody, 'backend OpenAPI must materialize CourseCommandBody');
assert.ok(backendSchemas.SdkWorkResourceResponse, 'backend OpenAPI must materialize SdkWorkResourceResponse');
assert.ok(backendSchemas.SdkWorkListResponse, 'backend OpenAPI must materialize SdkWorkListResponse');
assert.ok(backendSchemas.ProblemDetail, 'backend OpenAPI must materialize ProblemDetail');

const typedCreateRoute = backendManifest.routes.find((route) => route.operationId === 'courses.create');
assert.equal(
  typedCreateRoute?.schemas?.request,
  'CourseCommandBody',
  'backend route manifest must bind courses.create to CourseCommandBody',
);
assert.equal(
  typedCreateRoute?.schemas?.response,
  'SdkWorkResourceResponse',
  'backend route manifest must bind courses.create to SdkWorkResourceResponse',
);

assert.match(
  backendSdkCourses,
  /create\(body: CourseCommandBody(?:, requestOptions\?: ApiRequestOptions)?\): Promise<Record<string, unknown>>/u,
  'regenerated backend SDK must expose CourseCommandBody create API',
);

assert.equal(backendManifest.routes.length, 69, 'backend route manifest must expose 69 operations');

const backendOperationCount = Object.values(backendOpenApi.paths ?? {}).reduce(
  (count, pathItem) => count + Object.keys(pathItem).length,
  0,
);
assert.equal(backendOperationCount, 69, 'backend OpenAPI must expose 69 HTTP operations');

assert.match(
  gatewayAssembly,
  /assemble_embedded_course_application_router_from_env/u,
  'gateway assembly must delegate to embedded bootstrap router assembly',
);

const appHandlers = fs.readFileSync(
  path.join(courseRoot, 'crates/sdkwork-routes-course-app-api/src/handlers.rs'),
  'utf8',
);
const categoryRetrieveStart = appHandlers.indexOf('pub async fn course_categories_retrieve');
const categoryRetrieveEnd = appHandlers.indexOf('pub async fn courses_list', categoryRetrieveStart);
assert.ok(categoryRetrieveStart >= 0 && categoryRetrieveEnd > categoryRetrieveStart);
const categoryRetrieve = appHandlers.slice(categoryRetrieveStart, categoryRetrieveEnd);
assert.match(
  categoryRetrieve,
  /retrieve_category\(/u,
  'course_categories.retrieve must load the requested category instead of listing all categories',
);
assert.doesNotMatch(
  categoryRetrieve,
  /list_categories\(/u,
  'course_categories.retrieve must not return every category to a by-id request',
);

const appRequestMapper = fs.readFileSync(
  path.join(courseRoot, 'crates/sdkwork-routes-course-app-api/src/mapper/request.rs'),
  'utf8',
);
assert.match(
  appRequestMapper,
  /v\.as_str\(\)\.and_then\(\|s\| s\.parse::<i64>\(\)\.ok\(\)\)/u,
  'query extraction must parse numeric strings for page/page_size',
);

const watchStart = appHandlers.indexOf('pub async fn course_lesson_progress_watch_positions_update');
const watchEnd = appHandlers.indexOf('pub async fn course_live_sessions_list', watchStart);
assert.ok(watchStart >= 0 && watchEnd > watchStart);
const watchHandler = appHandlers.slice(watchStart, watchEnd);
assert.match(
  watchHandler,
  /watch_position_seconds:\s*body[\s\S]*?get\("watchPositionSeconds"\)/u,
  'watch_position endpoint must persist the resume position field',
);
assert.match(
  watchHandler,
  /watched_seconds:\s*None/u,
  'watch_position updates must not overwrite total watched seconds',
);

const progressRepository = fs.readFileSync(
  path.join(
    courseRoot,
    'crates/sdkwork-content-course-repository-sqlx/src/repository/postgres_course_repository_port.rs',
  ),
  'utf8',
);
assert.match(
  progressRepository,
  /watch_position_seconds = COALESCE\(\$3, watch_position_seconds\)/u,
  'lesson progress upsert must preserve or update watch_position_seconds',
);

const courseService = fs.readFileSync(
  path.join(courseRoot, 'crates/sdkwork-content-course-service/src/service/course_service.rs'),
  'utf8',
);
const reportsStart = courseService.lastIndexOf('async fn list_reports_overview');
const reportsEnd = courseService.indexOf('async fn list_reports_learning', reportsStart);
assert.ok(reportsStart >= 0 && reportsEnd > reportsStart);
const reports = courseService.slice(reportsStart, reportsEnd);
assert.match(reports, /count_courses\(/u);
assert.match(reports, /count_enrollments\(/u);
assert.match(reports, /count_applications\(/u);
assert.doesNotMatch(
  reports,
  /\.len\(\)/u,
  'report totals must come from COUNT queries rather than the first page of rows',
);

const lessonsStart = courseService.lastIndexOf('async fn list_lessons(');
assert.ok(lessonsStart >= 0);
const lessonsBlock = courseService.slice(lessonsStart, lessonsStart + 2200);
assert.match(lessonsBlock, /has_full_course_access\(/u);
assert.match(lessonsBlock, /lesson\.content = None/u);
assert.match(lessonsBlock, /Lesson content is locked/u);

console.log('sdkwork course route integration contract passed.');
