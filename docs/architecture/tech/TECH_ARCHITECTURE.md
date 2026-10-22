# SDKWork Course Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-10-21
Specs: `../sdkwork-specs/ARCHITECTURE_DECISION_SPEC.md`, `../sdkwork-specs/DOCUMENTATION_SPEC.md`

## 1. Architecture Overview

`sdkwork-course` is a standalone SDKWork application for online course catalog,
creator UGC authoring, review governance, learning progress, and live sessions.
It ships as:

- Rust gateway assembly (`sdkwork-api-course-assembly`) embedded into the platform HTTP process
- Generated app/backend SDK families for typed clients
- PC/H5/mini-program client roots under `apps/`

Course owns learning-domain records. IAM, Drive, commerce entitlement, and live providers remain external platform capabilities integrated through SDK/RPC ports.

## 2. Technology Choices

| Layer | Choice |
| --- | --- |
| HTTP runtime | Axum route crates + `sdkwork-web-framework` (`WebRequestContext`, `SdkWorkApiResponse`, `ProblemDetail`) |
| Persistence | `sdkwork-database` lifecycle + SQLx repository crate |
| File/media | `sdkwork-drive` app SDK (TS upload) + generated Rust Drive SDK adapter |
| Clients | Generated `@sdkwork/course-app-sdk` with `@sdkwork/sdk-common` TokenManager |
| Utilities | `sdkwork-utils` Rust/TS shared helpers |

## 3. System Boundaries And Modules

- **Course domain service**: `crates/sdkwork-content-course-service`
- **Repository**: `crates/sdkwork-content-course-repository-sqlx`
- **App API routes**: `crates/sdkwork-routes-course-app-api`
- **Backend API routes**: `crates/sdkwork-routes-course-backend-api`
- **HTTP auth bridge**: `crates/sdkwork-routes-course-http-auth`
- **Embedded bootstrap**: `crates/sdkwork-course-embedded-bootstrap`
- **Database host**: `crates/sdkwork-course-database-host`

External integrations:

- IAM for authentication/session (`@sdkwork/iam-app-sdk`)
- Drive for uploads and download grants (`SdkDriveCoursePort`)
- Live/notification/audit via configurable HTTP upstream ports

## 4. Directory And Package Layout

```text
sdkwork-course/
  apps/                 # PC/H5/mini-program client roots
  crates/               # Rust service, routes, gateway assembly
  database/             # sdkwork-database module assets
  deployments/          # deploy.yaml and release topology
  sdks/                 # OpenAPI authorities + generated SDK workspaces
  specs/                # repository contracts and design shards
  tools/                # governance/materialization scripts
```

## 5. API, SDK, And Data Ownership

- OpenAPI authorities: `sdks/sdkwork-course-app-sdk`, `sdks/sdkwork-course-backend-sdk`
- Success envelope: `{ code: 0, data, traceId }` per `API_SPEC.md`
- Error envelope: RFC 9457 `ProblemDetail` with numeric platform `code`
- Database tables: `course_*` prefix owned by this module only

## 6. Security, Privacy, And Observability

- Dual-token auth via `sdkwork-web-framework` + IAM web adapter
- No manual auth headers in frontend business code; TokenManager owns token refresh
- File uploads must go through Drive SDK; course stores `drive_resource_id` references only
- Trace correlation via `traceId` response field and `x-sdkwork-trace-id` header

## 7. Deployment And Runtime Topology

Cloud profile uses embedded gateway assembly mounted at:

- `/app/v3/api` for learner/client operations
- `/backend/v3/api` for operator/admin operations

Database bootstrap:

```bash
pnpm db:bootstrap
pnpm db:seed
pnpm db:drift:check
```

Required runtime env for production media flows:

- `SDKWORK_DRIVE_FACADE_URL` or `SDKWORK_DRIVE_APP_API_BASE_URL`
- `SDKWORK_ACCESS_TOKEN` / IAM session tokens for authenticated calls

## 8. Verification

```bash
pnpm verify
pnpm run check:openapi-drift
pnpm run db:drift:check
cd apps/sdkwork-course-pc && pnpm typecheck
cd ../sdkwork-course-h5 && pnpm typecheck
cargo test --workspace
```

`pnpm verify` includes boundary tests, design contracts, API envelope checks, OpenAPI drift detection, workspace composition validation, and Rust tests.

## 9. Deferred Integrations

- **sdkwork-discovery**: not required until RPC services are introduced
- **Live provider RPC**: remains behind `CourseLiveProviderPort` until provider contracts are wired
- **Commerce entitlement**: paid course access fails closed until an integrating
  application supplies the `CourseEntitlementPort` adapter

## 10. Related Shards

- [TECH-course-ugc-review.md](TECH-course-ugc-review.md) — UGC authoring,
  专栏/合集/章节 model, review state machine, and the operator console.

