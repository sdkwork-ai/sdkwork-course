# SDKWork Course
repository-kind: application

`sdkwork-course` owns the SDKWork course system. It carries authored API
contracts, database contracts, Rust service and repository crates, route crates,
OpenAPI authority documents, and generated SDK workspaces for app and backend
callers.

This workspace is intentionally separate from `sdkwork-appbase`. Appbase remains
the reusable foundation for IAM, runtime bootstrap, and shared UI concerns.
Course-specific records and APIs live here.

## Boundaries

- Course catalog: categories, instructors, courses, offerings, sections,
  lessons, and Drive-backed resource references.
- Content shapes: 课程 (`standard`), 专栏 (`column`), 合集 (`collection`), and
  章节 (`course_section`) with lessons.
- Course learning: enrollments, learning progress, lesson progress, live
  sessions, and replay handling.
- Course governance: UGC creator studio, submission/review workflow, comment
  moderation, reactions, reports, and audit logs.
- Learner discovery: topic panel, featured carousel, responsive course feed,
  hover-play cards, 专栏/合集 entry banners, and a creator call-to-action.
- Admin console: review queue, approve/return decisions, course take-down,
  category management, and review statistics.
- SDK families: `sdkwork-course-app-sdk` and `sdkwork-course-backend-sdk`.

The course workspace does not own sales, purchase, billing, or settlement flows.
Paid content fails closed until an integrating application supplies the
`CourseEntitlementPort` adapter; learning content and governance stay
independent from those systems.

## Content And Review Model

- Creators own drafts through `course_catalog.author_user_id`.
- `publish_status` drives the state machine: `draft` → `reviewing` →
  `published`, with `unpublished` and `archived` terminal/offline states.
- Returned drafts keep `draft` plus `reviewed_at` and `review_note`, rendered as
  已退回 in the studio.
- Approving a submission creates a default offering (`free`/`paid`) and
  publishes the content.
- Collections are ordered `course_catalog_link` rows pointing at published
  courses.

## Layout

```text
sdkwork-course/
  apis/
  apps/            # PC learner/creator/admin, H5, mini-program
  crates/
  database/
  sdks/
  specs/
  scripts/
```

## Client Surfaces

- PC `/` — merchandised home for courses, columns, and collections.
- PC `/courses`, `/courses/:id` — filterable catalog and curriculum detail.
- PC `/courses/:courseId/learn/:lessonId` — chapter-aware player.
- PC `/studio` — creator dashboard and draft editor (chapters, lessons, upload,
  collection ordering, submit/withdraw).
- PC `/admin` — operator overview, review queue, course governance, categories.
- H5 `/course` — mobile catalog with 课程/专栏/合集 filters and published-only
  content.

## Verification

Run the local governance checks from the repository root:

```powershell
pnpm verify
pnpm run db:validate
pnpm run check:openapi-drift
```

`pnpm verify` includes workspace boundary tests, database contract checks, API envelope validation, OpenAPI drift checks, repository composition checks, PC/H5 TypeScript type checks, and `cargo test --workspace`.

Optional per-app type checks:

```powershell
cd apps/sdkwork-course-pc
pnpm typecheck

cd ../sdkwork-course-h5
pnpm typecheck
```

Build generated SDK runtimes when OpenAPI authorities change:

```powershell
pnpm run api:materialize
cd sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi
pnpm run build
```

Run Rust verification:

```powershell
cargo test --workspace
```


## SDKWork Documentation Contract

Domain: content
Capability: course-workspace
Package type: rust-crate
Status: standard

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- None declared in `specs/component.spec.json`.

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `pnpm verify` (includes `typecheck:apps`)

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.

## Documentation Canon

- [docs/README.md](docs/README.md)
- [docs/product/prd/PRD.md](docs/product/prd/PRD.md)
- [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md)

## Application Roots

- [apps directory index](apps/README.md)
