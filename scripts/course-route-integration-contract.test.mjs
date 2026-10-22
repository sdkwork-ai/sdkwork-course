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

console.log('sdkwork course route integration contract passed.');
