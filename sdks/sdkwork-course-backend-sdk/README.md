# SDKWork Course Backend SDK

This SDK family is generated from the `sdkwork-course-backend-api` authority
contract for `/backend/v3/api`.

## Contract

- SDK family: `sdkwork-course-backend-sdk`
- API authority: `sdkwork-course-backend-api`
- API prefix: `/backend/v3/api`
- Audience: backend consoles, operators, control-plane integrations, and admin automation
- Package: `@sdkwork/course-backend-sdk`
- Generated language: TypeScript
- OpenAPI authority: `openapi/sdkwork-course-backend-api.openapi.yaml`
- Generator input: `openapi/sdkwork-course-backend-api.sdkgen.yaml`
- Owner-only operations: `72`
- Generated resource classes: `17`
- SDK dependencies: `[]`

Clients call generated resource methods for course management, instructors,
offerings, sections, lessons, resource references, live sessions, enrollments,
progress, comment moderation, application review, reports, and audit queries.
Auth tokens are supplied through generated SDK auth/bootstrap APIs; clients
must not send `X-Request-Id`.

## Generation

Run from the `sdkwork-course` repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\sdks\sdkwork-course-backend-sdk\bin\generate-sdk.ps1 -Languages typescript
```

The wrapper calls `../sdkwork-sdk-generator/bin/sdkgen.js`
from `@sdkwork/sdk-generator` version `1.0.0` with `--standard-profile sdkwork-v3`.

Generated output:

- TypeScript workspace: `sdkwork-course-backend-sdk-typescript`
- Transport root: `sdkwork-course-backend-sdk-typescript/generated/server-openapi`

Do not hand-edit files under `generated/server-openapi`. Fix the OpenAPI
authority or generator input, then regenerate.

## Verification

```powershell
node --test scripts/course-workspace-boundary.test.mjs
powershell -ExecutionPolicy Bypass -File .\sdks\sdkwork-course-backend-sdk\bin\generate-sdk.ps1 -Languages typescript
node .\sdks\sdkwork-course-backend-sdk\sdkwork-course-backend-sdk-typescript\generated\server-openapi\bin\publish-core.mjs --language typescript --project-dir .\sdks\sdkwork-course-backend-sdk\sdkwork-course-backend-sdk-typescript\generated\server-openapi --action check
node .\sdks\sdkwork-course-backend-sdk\sdkwork-course-backend-sdk-typescript\generated\server-openapi\bin\publish-core.mjs --language typescript --project-dir .\sdks\sdkwork-course-backend-sdk\sdkwork-course-backend-sdk-typescript\generated\server-openapi --action build
```

## SDKWork Documentation Contract

Domain: content
Capability: course
Package type: sdk-family
Status: standard

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- `SdkworkBackendClient`
- `createClient`

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `node --test scripts/course-workspace-boundary.test.mjs`
- `powershell -ExecutionPolicy Bypass -File sdks/sdkwork-course-backend-sdk/bin/generate-sdk.ps1 -Languages typescript`
- `node sdks/sdkwork-course-backend-sdk/sdkwork-course-backend-sdk-typescript/generated/server-openapi/bin/publish-core.mjs --language typescript --project-dir sdks/sdkwork-course-backend-sdk/sdkwork-course-backend-sdk-typescript/generated/server-openapi --action check`
- `node sdks/sdkwork-course-backend-sdk/sdkwork-course-backend-sdk-typescript/generated/server-openapi/bin/publish-core.mjs --language typescript --project-dir sdks/sdkwork-course-backend-sdk/sdkwork-course-backend-sdk-typescript/generated/server-openapi --action build`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.
