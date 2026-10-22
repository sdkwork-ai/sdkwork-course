# SDKWork Course App SDK

This SDK family is generated from the `sdkwork-course-app-api` authority
contract for `/app/v3/api`.

## Contract

- SDK family: `sdkwork-course-app-sdk`
- API authority: `sdkwork-course-app-api`
- API prefix: `/app/v3/api`
- Audience: app, desktop, mobile, H5, and user-facing clients
- Package: `@sdkwork/course-app-sdk`
- Generated language: TypeScript
- OpenAPI authority: `openapi/sdkwork-course-app-api.openapi.yaml`
- Generator input: `openapi/sdkwork-course-app-api.sdkgen.yaml`
- Owner-only operations: `41`
- Generated resource classes: `17`
- SDK dependencies: `[]`

Clients call generated resource methods for course categories, courses,
offerings, enrollments, sections, lessons, lesson resources, live sessions,
progress, comments, engagement, reactions, and author applications. Auth tokens are
supplied through generated SDK auth/bootstrap APIs; clients must not send
`X-Request-Id`.

## Generation

Run from the `sdkwork-course` repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\sdks\sdkwork-course-app-sdk\bin\generate-sdk.ps1 -Languages typescript
```

The wrapper calls `../sdkwork-sdk-generator/bin/sdkgen.js`
from `@sdkwork/sdk-generator` version `1.0.0` with `--standard-profile sdkwork-v3`.

Generated output:

- TypeScript workspace: `sdkwork-course-app-sdk-typescript`
- Transport root: `sdkwork-course-app-sdk-typescript/generated/server-openapi`

Do not hand-edit files under `generated/server-openapi`. Fix the OpenAPI
authority or generator input, then regenerate.

## Verification

```powershell
node --test scripts/course-workspace-boundary.test.mjs
powershell -ExecutionPolicy Bypass -File .\sdks\sdkwork-course-app-sdk\bin\generate-sdk.ps1 -Languages typescript
node .\sdks\sdkwork-course-app-sdk\sdkwork-course-app-sdk-typescript\generated\server-openapi\bin\publish-core.mjs --language typescript --project-dir .\sdks\sdkwork-course-app-sdk\sdkwork-course-app-sdk-typescript\generated\server-openapi --action check
node .\sdks\sdkwork-course-app-sdk\sdkwork-course-app-sdk-typescript\generated\server-openapi\bin\publish-core.mjs --language typescript --project-dir .\sdks\sdkwork-course-app-sdk\sdkwork-course-app-sdk-typescript\generated\server-openapi --action build
```

## SDKWork Documentation Contract

Domain: content
Capability: course
Package type: sdk-family
Status: standard

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- `SdkworkAppClient`
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
- `powershell -ExecutionPolicy Bypass -File sdks/sdkwork-course-app-sdk/bin/generate-sdk.ps1 -Languages typescript`
- `node sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi/bin/publish-core.mjs --language typescript --project-dir sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi --action check`
- `node sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi/bin/publish-core.mjs --language typescript --project-dir sdks/sdkwork-course-app-sdk/sdkwork-course-app-sdk-typescript/generated/server-openapi --action build`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.
