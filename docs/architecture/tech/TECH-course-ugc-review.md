# TECH — UGC Authoring, Review, And Admin Console

Status: active
Updated: 2026-10-21
Parent: [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md)

## 1. Data Model

`course_catalog` now carries:

| Column | Purpose |
| --- | --- |
| `course_kind` | `standard` / `column` / `collection` |
| `author_user_id` | UGC owner; authoritative from the request principal |
| `author_display_name` | Display-only creator name captured at creation |
| `price_amount`, `original_price_amount`, `currency`, `is_free` | Pricing surface |
| `review_note`, `submitted_at`, `reviewed_at`, `reviewed_by`, `review_round` | Review trail |

`publish_status` remains the publication/review state machine
(`draft`, `reviewing`, `published`, `unpublished`, `archived`). A returned draft
keeps `draft` plus `reviewed_at`/`review_note`, which the UI renders as 已退回.

`course_catalog_link` (previously unregistered) stores ordered collection
membership with `link_type='collection_item'`. It is now part of the database
contract, table registry, and `COURSE_TABLES`.

## 2. Service And Repository

New `CourseCatalogRepository` methods:

- `save_studio_course` — atomic draft replace: metadata + chapters + lessons +
  resources + collection links in one transaction.
- `retrieve_course_detail` — course + chapters + lessons + resources + items.
- `retrieve_curriculum`, `list_collection_items` — learner aggregates.
- `submit_course`, `withdraw_course`, `review_course`, `offline_course`.
- `list_review_courses`, `review_stats`.

Ownership and editability are enforced in SQL (`author_user_id = principal`,
`publish_status IN ('draft','unpublished')`), not only in handlers. Operator
review reads are tenant-scoped. Draft replacement hard-deletes child rows, which
is safe because publishing locks the course and only drafts are editable.

`publish_course` no longer requires a pre-existing offering. It validates the
content shape, creates a default offering (`free` or `paid` from course pricing)
if none exists, and publishes. Review approval reuses the same helper.

## 3. HTTP Surfaces

App API (`/app/v3/api`), 40 operations:

- `courseCurriculum.retrieve`, `courseCollectionItems.list`
- `studioCourses.list/create/retrieve/update/delete/submit/withdraw`

Backend API (`/backend/v3/api`), 72 operations:

- `courseReviews.list/retrieve/review/stats`
- `courses.offline`

Learner `courses.list` forces `status=published` and drops author filters.
Learner `courses.retrieve` returns 404 for non-published content. Studio routes
derive the author from the principal. Review routes carry permissions
`course.reviews.read` / `course.reviews.review`.

OpenAPI materialization now writes the raw operation ids to `.sdkgen.yaml` and
the pattern-aligned projection to `.openapi.yaml`, matching the platform
operation-pattern contract and the SDK generator input.

## 4. Client Architecture

PC app:

- `packages/sdkwork-course-pc-core` — adds `courseBackendSdkClient` sharing the
  existing IAM token manager and session.
- `packages/sdkwork-course-pc-commons` — design primitives (button, badge,
  modal, fields, tabs, skeleton, stat card, notice), cover/format helpers, and
  the accessible course card.
- `packages/sdkwork-course-pc-courses` — home, catalog, detail, curriculum
  mapping.
- `packages/sdkwork-course-pc-studio` — creator dashboard and draft editor.
- `packages/sdkwork-course-pc-console` — tenant admin console; `ConsoleCourse`
  remains the stable entrypoint for the IM host and renders
  `CourseAdminConsole`.

The standalone PC app configures the console host in
`src/bootstrap/consoleHost.ts`; the Vite dev server proxies both `/app/v3/api`
and `/backend/v3/api`.

H5 consumes the same published-only app SDK through
`@sdkwork/course-runtime`; `CourseListParams` carries `kind`/`level` for the new
content shapes.

## 5. Review And Publish Flow

1. Studio `PUT /studio/courses/{id}` replaces the draft atomically.
2. `POST /studio/courses/{id}/submit` validates cover, category, summary,
   curriculum/collection items, lesson media, then sets `reviewing`.
3. Admin `POST /course_reviews/{id}/review` with `approve|reject|request_changes`.
   Non-approve decisions require a note.
4. Approve ensures a default offering and publishes; return leaves the content in
   `draft` with the note visible to the author.
5. Every transition appends a `course_audit_log` record with target and
   before/after snapshots.

## 6. Verification

```bash
node scripts/materialize-course-openapi.mjs --check
node --test scripts/course-design-contract.test.mjs scripts/course-workspace-boundary.test.mjs
node --test sdks/_shared/course-contracts/tests/course-contracts.test.mjs
node scripts/course-route-integration-contract.test.mjs
pnpm db:validate
cargo test --workspace
pnpm --filter @sdkwork/sdkwork-course-pc typecheck
pnpm --filter @sdkwork/sdkwork-course-h5 typecheck
```

The route integration contract pins the backend surface at 72 operations; the
shared contract pins 40 app / 72 backend operation ids and 16 tables.
