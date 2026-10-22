# SDKWork Course Module Plan

Production module layout for the professional course system.

## Boundaries

- Course owns VOD course metadata, live course sessions, blended offerings,
  enrollment, learning progress, comments, reactions, course applications, and
  course audit logs.
- Appbase IAM owns login, tenant, organization, user, role, permission, and
  token-derived request context.
- Drive owns file upload, object storage lifecycle, download grants, and
  Drive-backed `MediaResource` delivery.
- Commerce or an integrating application owns purchase, subscription,
  settlement, refund, and entitlement source-of-truth.
- Live provider adapters own provider-specific room provisioning, short-lived
  join token creation, recording callbacks, and provider error normalization.

## Content Shapes

| Shape | Storage | Publish validation |
| --- | --- | --- |
| 课程 (`standard`) | `course_section` + `course_lesson` | ≥1 chapter and ≥1 lesson |
| 专栏 (`column`) | chapters/lessons; article-first | ≥1 chapter and ≥1 lesson |
| 合集 (`collection`) | `course_catalog_link` ordered published courses | ≥1 published course, no chapters |

UGC ownership lives on `course_catalog.author_user_id`; review state reuses
`publish_status` plus `submitted_at`, `reviewed_at`, `reviewed_by`, `review_note`,
and `review_round`.

## Owned Modules

| Module | Responsibility |
| --- | --- |
| `crates/sdkwork-content-course-service` | Domain service, review validation, provider ports |
| `crates/sdkwork-content-course-repository-sqlx` | SQLx persistence, studio drafts, review queries |
| `crates/sdkwork-routes-course-app-api` | Learner + creator `/app/v3/api` HTTP surface |
| `crates/sdkwork-routes-course-backend-api` | Operator `/backend/v3/api` HTTP surface |
| `crates/sdkwork-routes-course-http-auth` | Dual-token bridge + SdkWork envelopes |
| `crates/sdkwork-course-embedded-bootstrap` | Embedded gateway assembly wiring |
| `crates/sdkwork-course-database-host` | `sdkwork-database` lifecycle host |
| `database/` | Baseline DDL, seeds, drift policy |
| `sdks/sdkwork-course-app-sdk` | Generated app SDK family |
| `sdks/sdkwork-course-backend-sdk` | Generated backend SDK family |
| `apps/sdkwork-course-pc` | Learner center, creator studio, tenant admin console |
| `apps/sdkwork-course-h5` / `mini-program` | Mobile learner surfaces |
| `apps/sdkwork-course-common` | Shared mobile course pages and SDK port |

## Implementation Status

- [x] HTTP runtime uses `sdkwork-web-framework` (`SdkWorkApiResponse`, `ProblemDetail`)
- [x] Database lifecycle owned by `sdkwork-database` baseline + CLI
- [x] Frontend clients consume generated SDKs with TokenManager (no raw course HTTP)
- [x] Drive integration via generated Rust/TS Drive SDKs; course stores references only
- [x] IAM login/session via `@sdkwork/iam-app-sdk`
- [x] OpenAPI authorities materialized with SdkWork v3 envelopes
- [x] `deployments/deploy.yaml` declares cloud runtime dependencies
- [x] UGC authoring: draft document save, submit, withdraw, resubmit
- [x] Operator review queue with approve / return / request-changes and stats
- [x] 专栏 / 合集 / 章节 content shapes and learner surfaces
- [x] Discovery-first learner home: topic panel, featured carousel, 5/4/2/1-column feed, hover play affordance, price and type badges, shuffle, 专栏/合集 entry banners
- [x] Creator studio: dashboard, draft editor, chapter/lesson ordering, Drive media, collection picker, submit checklist, review feedback
- [x] Tenant admin: review queue/detail, approve/return, take-down, course and category governance
- [x] Light/dark/system theme with semantic course tokens, persisted standalone toggle, host-follow embedded surface, and contrast-safe badges/stats
- [x] Pricing surface with default offering creation on publish
- [ ] Commerce entitlement adapter for paid enrollment
- [ ] Creator analytics and payouts

## Deferred Integrations

- Commerce entitlement provider (paid enrollment fails closed today)
- Live provider RPC adapter (port abstraction is in place)
- `sdkwork-discovery` (only required when RPC services are introduced)

## Verification

```bash
pnpm verify
node scripts/materialize-course-openapi.mjs
pnpm --filter @sdkwork/sdkwork-course-pc typecheck
pnpm --filter @sdkwork/sdkwork-course-h5 typecheck
```
