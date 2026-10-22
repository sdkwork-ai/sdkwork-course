# SDKWork Course PRD

Status: active
Owner: SDKWork maintainers
Application: sdkwork-course
Updated: 2026-10-21
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md

## Document Map

- [PRD-course-center-ugc.md](PRD-course-center-ugc.md) — UGC authoring, 专栏/合集/章节 model, and operator review workflow.

## 1. Background And Problem

The course center started as an operator-curated catalog. Creators had no way to
upload their own content, and the operator console could only create courses and
toggle publish state. That limits supply growth and leaves review, ownership, and
content-shape governance undefined.

## 2. Target Users

- **Learners** browse a published catalog of courses, columns, and collections,
  learn by chapter, and track progress.
- **Creators** upload a course, column, or collection, arrange chapters and
  lessons, and submit it for platform review.
- **Operators** review submitted content, approve or return it with feedback,
  manage published courses, categories, and take-downs.
- **Platform owners** need auditability, content quality gates, and a pricing
  surface that can connect to commerce.

## 3. Goals And Non-Goals

Goals:

- Support creator-owned UGC authoring with draft, submit, withdraw, and resubmit.
- Model 专栏 (serialized column), 合集 (curated collection of courses), and 章节
  (chapter) inside one catalog.
- Provide an operator review queue with decisions, notes, statistics, and audit
  records.
- Keep the learner catalog strictly published-only while authors see their own
  drafts.
- Surface pricing (free/paid) with a clean entitlement boundary.

Non-goals:

- Owning payment, invoicing, refunds, or creator payouts. Commerce remains an
  external entitlement adapter.
- Video transcoding and object storage. Media is uploaded through Drive and
  stored as resource references.

## 4. Scope

- Catalog metadata, cover media, pricing, tags, categories, difficulty.
- Course kinds: `standard` (chapters + lessons), `column` (serialized content
  with chapters/lessons), `collection` (ordered published courses).
- Creator studio: draft editor, chapter/lesson tree, collection picker, upload,
  submit/withdraw/delete, review feedback.
- Operator console: review queue, review detail, approve/return, course
  governance, category management, review statistics.
- Learner surfaces: home merchandising, filterable catalog, detail with
  curriculum, player, my learning.

## 5. User Scenarios

1. A creator creates a column draft, uploads a cover, adds chapters and article
   lessons, submits it, and fixes the issues after an operator returns it.
2. An operator opens the review queue, checks the curriculum and pricing,
   approves the column, and the system publishes it with a default offering.
3. A learner filters the catalog by 专栏, opens a column, reads the free preview,
   enrolls, and continues from the last lesson.
4. An operator builds a 合集 from three published courses and publishes it; the
   learner sees the ordered learning path.
5. An operator takes a published course offline with a reason; the author sees
   the feedback and can revise it.

## 6. Success Metrics

- Time from creator submission to first review decision (target < 48h).
- Review queue backlog and overdue count.
- UGC published ratio and resubmission rate after return.
- Catalog conversion from detail view to enrollment.
- Content quality: submissions rejected for missing cover/summary/curriculum.

## 7. Phases

1. Data model, APIs, review state machine, ownership enforcement.
2. Creator studio and operator review console.
3. Learner catalog/detail/player polish and H5 parity.
4. Commerce entitlement adapter and creator analytics.

## 8. Linked Requirements

- [PRD-course-center-ugc.md](PRD-course-center-ugc.md)
- `specs/design/course-module-plan.md`
- `specs/iam.module.manifest.json` (`course.reviews.read`,
  `course.reviews.review`)

## 9. Open Questions

- Should published-course edits create a revision instead of requiring an
  operator take-down?
- Which commerce provider supplies entitlement for paid content?
- Should creator certification (course applications) gate UGC creation, or stay
  optional?
