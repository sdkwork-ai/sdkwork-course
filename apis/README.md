# SDKWork Course API Contracts

This directory contains authored API source contracts for `sdkwork-course`.
The route-manifest and OpenAPI materializer consumes these files to produce the
application-owned SDK authorities under `sdks/`.

Files in this directory are review inputs for the next API authority update and
must not contain generated SDK transport output.

## Surfaces

- `app-api/course/operations.json`: app/client operations for learners, course
  discovery, curriculum/collection reads, VOD learning, live sessions, progress,
  comments, reactions, course applications, and the creator studio (`/studio/courses`).
- `backend-api/course/operations.json`: backend-admin operations for course
  management, instructors, offerings, lessons, live sessions, enrollments,
  progress repair, moderation, reports, audit logs, the review queue
  (`/course_reviews`), and course take-down (`/courses/{id}/offline`).
