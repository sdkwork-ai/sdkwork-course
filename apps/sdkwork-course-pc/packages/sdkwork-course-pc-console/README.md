# @sdkwork/course-pc-console

Domain: course  
Capability: course-console

Canonical PC course **tenant admin** console (review queue, course governance,
categories). Consumes `@sdkwork/course-backend-sdk` through an IM-wired host
port (`configureCourseConsolePcHost`).

`ConsoleCourse` is the stable entrypoint embedded in IM via
`@sdkwork/im-console-core` → `bootstrapImCourseConsolePcIntegration`. The
standalone course PC app configures the same host in
`src/bootstrap/consoleHost.ts` and routes `/admin` to `ConsoleCourse`.

The implementation lives in `CourseAdminConsole.tsx`:

- **概览** — pending/returned/published/UGC totals, average review hours,
  overdue backlog.
- **审核队列** — pending, returned, and approved filters; review detail with
  chapters, lessons, resources, collection items, and approve/return actions
  (return requires a note).
- **课程管理** — every publication state, kind filter, take-down with reason.
- **分类管理** — list and create categories.

`courseConsoleService` wraps the generated backend SDK and normalizes page
totals from `pageInfo.totalItems`.
