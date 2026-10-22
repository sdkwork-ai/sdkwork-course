import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const courseRoot = path.resolve(import.meta.dirname, "..");

const requiredDesignFiles = [
  "apis/README.md",
  "apis/app-api/course/operations.json",
  "apis/backend-api/course/operations.json",
  "specs/database/course-schema.contract.json",
  "specs/database/README.md",
  "specs/design/course-module-plan.md",
  "deployments/deploy.yaml",
  "database/database.manifest.json",
  "database/ddl/baseline/postgres/0001_course_baseline.sql",
  "sdks/_shared/course-contracts/src/course-domain.ts",
  "sdks/_shared/course-contracts/src/course-api.ts",
  "crates/sdkwork-content-course-service/src/domain/commands.rs",
  "crates/sdkwork-content-course-service/src/domain/models.rs",
  "crates/sdkwork-content-course-service/src/ports/repository.rs",
  "crates/sdkwork-content-course-service/src/ports/provider.rs",
  "crates/sdkwork-content-course-service/src/service/course_service.rs",
  "crates/sdkwork-content-course-repository-sqlx/src/db/schema.rs",
  "crates/sdkwork-content-course-repository-sqlx/src/repository/course_repository.rs",
  "crates/sdkwork-routes-course-http-auth/src/api_response.rs",
  "crates/sdkwork-routes-course-app-api/src/routes.rs",
  "crates/sdkwork-routes-course-backend-api/src/routes.rs",
  "crates/sdkwork-routes-course-app-api/src/manifest.rs",
  "crates/sdkwork-routes-course-backend-api/src/manifest.rs",
  "crates/sdkwork-course-embedded-bootstrap/src/adapters/drive_sdk.rs",
  "apps/sdkwork-course-pc/packages/sdkwork-course-pc-core/src/courseAppSdkClient.ts",
  "apps/sdkwork-course-common/packages/sdkwork-course-runtime/src/course-app-sdk-client.ts",
];

const requiredTables = [
  "course_category",
  "course_instructor",
  "course_catalog",
  "course_offering",
  "course_section",
  "course_lesson",
  "course_resource_ref",
  "course_live_session",
  "course_enrollment",
  "course_learning_progress",
  "course_lesson_progress",
  "course_reaction",
  "course_catalog_link",
  "course_application",
  "course_audit_log",
];

const requiredAppOperations = [
  "courseApplications.create",
  "courseApplications.current.list",
  "courseApplications.retrieve",
  "courseCategories.list",
  "courseCategories.retrieve",
  "courseEnrollments.create",
  "courseEnrollments.current.list",
  "courseEnrollments.delete",
  "courseEnrollments.retrieve",
  "courseLessonProgress.update",
  "courseLessonProgress.watchPositions.update",
  "courseLessonResources.list",
  "courseLessons.list",
  "courseLessons.retrieve",
  "courseLiveSessions.heartbeat",
  "courseLiveSessions.join",
  "courseLiveSessions.leave",
  "courseLiveSessions.list",
  "courseLiveSessions.replay.retrieve",
  "courseLiveSessions.retrieve",
  "courseOfferings.list",
  "courseOfferings.retrieve",
  "courseProgress.retrieve",
  "courseReactions.delete",
  "courseReactions.update",
  "courseSections.list",
  "courseCurriculum.retrieve",
  "courseCollectionItems.list",
  "studioCourses.create",
  "studioCourses.delete",
  "studioCourses.list",
  "studioCourses.retrieve",
  "studioCourses.submit",
  "studioCourses.update",
  "studioCourses.withdraw",
  "courses.list",
  "courses.retrieve",
];

const requiredBackendOperations = [
  "courseApplications.convert",
  "courseApplications.list",
  "courseApplications.retrieve",
  "courseApplications.update",
  "courseAuditLogs.list",
  "courseAuditLogs.retrieve",
  "courseCategories.create",
  "courseCategories.delete",
  "courseCategories.list",
  "courseCategories.reorder",
  "courseCategories.update",
  "courseEnrollments.create",
  "courseEnrollments.list",
  "courseEnrollments.revoke",
  "courseInstructors.create",
  "courseInstructors.list",
  "courseInstructors.retrieve",
  "courseInstructors.status.update",
  "courseInstructors.update",
  "courseLessonProgress.update",
  "courseLessons.create",
  "courseLessons.delete",
  "courseLessons.list",
  "courseLessons.retrieve",
  "courseLessons.reorder",
  "courseLessons.update",
  "courseLiveSessions.cancel",
  "courseLiveSessions.create",
  "courseLiveSessions.end",
  "courseLiveSessions.list",
  "courseLiveSessions.replay.create",
  "courseLiveSessions.replay.publish",
  "courseLiveSessions.retrieve",
  "courseLiveSessions.start",
  "courseLiveSessions.update",
  "courseOfferings.close",
  "courseOfferings.create",
  "courseOfferings.delete",
  "courseOfferings.list",
  "courseOfferings.publish",
  "courseOfferings.retrieve",
  "courseOfferings.update",
  "courseProgress.list",
  "courseProgress.retrieve",
  "courseReactions.list",
  "courseReports.learning.list",
  "courseReports.liveSessions.list",
  "courseReports.overview.retrieve",
  "courseResources.create",
  "courseResources.delete",
  "courseResources.list",
  "courseResources.update",
  "courseSections.create",
  "courseSections.delete",
  "courseSections.list",
  "courseSections.reorder",
  "courseSections.update",
  "courses.create",
  "courses.delete",
  "courses.list",
  "courses.publish",
  "courses.retrieve",
  "courses.unpublish",
  "courses.update",
  "courses.offline",
  "courseReviews.list",
  "courseReviews.retrieve",
  "courseReviews.review",
  "courseReviews.stats",
];

function readJson(relativePath) {
  const raw = fs.readFileSync(path.join(courseRoot, relativePath));
  const text =
    raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
      ? raw.slice(3).toString("utf8")
      : raw.toString("utf8");
  return JSON.parse(text);
}

test("course design contract files exist", () => {
  const missingFiles = requiredDesignFiles.filter((relativePath) => !fs.existsSync(path.join(courseRoot, relativePath)));
  assert.deepEqual(missingFiles, []);
});

test("course database contract defines the professional VOD and live course core tables", () => {
  const contract = readJson("specs/database/course-schema.contract.json");
  assert.equal(contract.kind, "sdkwork.course.database.contract");
  assert.equal(contract.domain, "content");
  assert.equal(contract.capability, "course");

  const tables = new Map(contract.tables.map((table) => [table.name, table]));
  assert.deepEqual(requiredTables.filter((tableName) => !tables.has(tableName)), []);

  for (const tableName of requiredTables) {
    const table = tables.get(tableName);
    assert.ok(table.profile, `${tableName} must declare a table profile`);
    assert.ok(table.writeOwner, `${tableName} must declare a write owner`);
    assert.ok(table.lifecycle, `${tableName} must declare lifecycle policy`);
    assert.ok(table.columns.some((column) => column.name === "tenant_id"), `${tableName} must include tenant_id`);
    assert.ok(table.columns.some((column) => column.name === "status"), `${tableName} must include status`);
    assert.ok(table.indexes.length > 0, `${tableName} must include query indexes`);
  }
});

test("course API operation lists define complete app and backend surfaces", () => {
  const app = readJson("apis/app-api/course/operations.json");
  const backend = readJson("apis/backend-api/course/operations.json");

  assert.equal(app.apiAuthority, "sdkwork-course-app-api");
  assert.equal(app.apiPrefix, "/app/v3/api");
  assert.equal(backend.apiAuthority, "sdkwork-course-backend-api");
  assert.equal(backend.apiPrefix, "/backend/v3/api");

  const appOperationIds = app.operations.map((operation) => operation.operationId).sort();
  const backendOperationIds = backend.operations.map((operation) => operation.operationId).sort();
  assert.deepEqual(requiredAppOperations.filter((operationId) => !appOperationIds.includes(operationId)), []);
  assert.deepEqual(requiredBackendOperations.filter((operationId) => !backendOperationIds.includes(operationId)), []);

  for (const operation of [...app.operations, ...backend.operations]) {
    assert.ok(operation.method, `${operation.operationId} must declare method`);
    assert.ok(operation.path, `${operation.operationId} must declare path`);
    assert.ok(operation.resource, `${operation.operationId} must declare resource`);
    assert.ok(operation.authMode, `${operation.operationId} must declare authMode`);
    assert.ok(operation.path.startsWith(app.apiPrefix) || operation.path.startsWith(backend.apiPrefix));
  }
});

test("course production modules integrate sdkwork-web-framework, database, utils, and drive", () => {
  const checks = [
    ["crates/sdkwork-routes-course-http-auth/src/api_response.rs", /SdkWorkApiResponse/u],
    ["crates/sdkwork-routes-course-app-api/src/routes.rs", /build_sdkwork_course/u],
    ["crates/sdkwork-course-embedded-bootstrap/src/adapters/drive_sdk.rs", /sdkwork_drive_app_sdk_generated_rust/u],
    ["crates/sdkwork-course-database-host/src/lib.rs", /LifecycleOrchestrator/u],
    ["apps/sdkwork-course-pc/packages/sdkwork-course-pc-core/src/courseAppSdkClient.ts", /@sdkwork\/course-app-sdk/u],
    ["apps/sdkwork-course-pc/packages/sdkwork-course-pc-core/src/driveAppSdkClient.ts", /@sdkwork\/drive-app-sdk/u],
    ["apps/sdkwork-course-pc/packages/sdkwork-course-pc-core/src/iamAppSdkClient.ts", /@sdkwork\/iam-app-sdk/u],
  ];

  for (const [relativePath, pattern] of checks) {
    const source = fs.readFileSync(path.join(courseRoot, relativePath), "utf8");
    assert.match(source, pattern, `${relativePath} must integrate the expected SDKWork platform module`);
  }
});

test("course Rust implementation uses SDKWork crates responsibility layout", () => {
  const cargo = fs.readFileSync(path.join(courseRoot, "Cargo.toml"), "utf8");
  for (const member of [
    "crates/sdkwork-content-course-service",
    "crates/sdkwork-content-course-repository-sqlx",
    "crates/sdkwork-routes-course-http-auth",
    "crates/sdkwork-routes-course-app-api",
    "crates/sdkwork-routes-course-backend-api",
    "crates/sdkwork-course-embedded-bootstrap",
    "crates/sdkwork-course-database-host",
    "crates/sdkwork-api-course-assembly",
  ]) {
    assert.ok(cargo.includes(member), `Cargo workspace must include ${member}`);
  }

  assert.match(cargo, /sdkwork-web-core/u);
  assert.match(cargo, /sdkwork-utils-rust/u);
  assert.match(cargo, /sdkwork-drive-app-sdk-generated-rust/u);

  assert.ok(
    !fs.existsSync(path.join(courseRoot, "packages/native-rust/course/sdkwork-course-rust/Cargo.toml")),
    "non-standard packages/native-rust/course/sdkwork-course-rust crate must be removed",
  );
  assert.ok(
    !fs.existsSync(path.join(courseRoot, "packages")),
    "application root must not keep top-level packages/ as a generic workspace directory",
  );
});
