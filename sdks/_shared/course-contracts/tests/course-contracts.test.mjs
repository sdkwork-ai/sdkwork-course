import assert from "node:assert/strict";
import test from "node:test";

import {
  COURSE_APP_API_OPERATION_IDS,
  COURSE_BACKEND_API_OPERATION_IDS,
  COURSE_TABLE_NAMES,
  SDKWORK_COURSE_APP_OPERATIONS,
  SDKWORK_COURSE_BACKEND_OPERATIONS,
  SDKWORK_COURSE_STANDARD,
} from "../src/index.ts";

test("course contract declares canonical v3 app and backend prefixes", () => {
  assert.equal(SDKWORK_COURSE_STANDARD.api.appPrefix, "/app/v3/api");
  assert.equal(SDKWORK_COURSE_STANDARD.api.backendPrefix, "/backend/v3/api");
  assert.equal(SDKWORK_COURSE_STANDARD.api.openapi, "3.1.2");
});

test("course contract exposes learning content and governance operations", () => {
  assert.ok(COURSE_APP_API_OPERATION_IDS.includes("courseLiveSessions.join"));
  assert.ok(COURSE_APP_API_OPERATION_IDS.includes("courseLessonProgress.watchPositions.update"));
  assert.ok(COURSE_BACKEND_API_OPERATION_IDS.includes("courseLiveSessions.replay.publish"));
  assert.ok(COURSE_BACKEND_API_OPERATION_IDS.includes("courseReports.liveSessions.list"));
  assert.equal(COURSE_APP_API_OPERATION_IDS.length, 40);
  assert.equal(COURSE_BACKEND_API_OPERATION_IDS.length, 72);
  assert.equal(SDKWORK_COURSE_APP_OPERATIONS.courseApplicationsCreate.operationId, "courseApplications.create");
  assert.equal(SDKWORK_COURSE_BACKEND_OPERATIONS.courseApplicationsConvert.operationId, "courseApplications.convert");
  assert.equal(SDKWORK_COURSE_APP_OPERATIONS.studioCoursesSubmit.operationId, "studioCourses.submit");
  assert.equal(SDKWORK_COURSE_BACKEND_OPERATIONS.courseReviewsReview.operationId, "courseReviews.review");
});

test("course contract owns only course tables", () => {
  assert.deepEqual([...COURSE_TABLE_NAMES].sort(), [
    "course_application",
    "course_audit_log",
    "course_catalog",
    "course_catalog_link",
    "course_category",
    "course_comment",
    "course_enrollment",
    "course_instructor",
    "course_learning_progress",
    "course_lesson",
    "course_lesson_progress",
    "course_live_session",
    "course_offering",
    "course_reaction",
    "course_resource_ref",
    "course_section",
  ]);
});
