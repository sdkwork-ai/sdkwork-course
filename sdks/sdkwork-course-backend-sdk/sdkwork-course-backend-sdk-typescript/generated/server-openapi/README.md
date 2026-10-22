# sdkwork-course-backend-sdk

Generated SDKWork v3 dual-token transport SDK.

## Installation

```bash
npm install @sdkwork/course-backend-sdk
# or
yarn add @sdkwork/course-backend-sdk
# or
pnpm add @sdkwork/course-backend-sdk
```

## Quick Start

```typescript
import { SdkworkBackendClient } from '@sdkwork/course-backend-sdk';

const client = new SdkworkBackendClient({
  baseUrl: 'http://localhost:8080',
  timeout: 30000,
});

// Authentication
client.setAuthToken('your-auth-token');
client.setAccessToken('your-access-token');

// Use the SDK
const result = await client.courseReports.overview.retrieve();
```

## Authentication

```text
Authorization: Bearer <authToken>
Access-Token: <accessToken>
```


## Configuration (Non-Auth)

```typescript
import { SdkworkBackendClient } from '@sdkwork/course-backend-sdk';

const client = new SdkworkBackendClient({
  baseUrl: 'http://localhost:8080',
  timeout: 30000, // Request timeout in ms
  headers: {      // Custom headers
    'X-Custom-Header': 'value',
  },
});
```

## API Modules

- `client.courseCategories` - course_categories API
- `client.courseInstructors` - course_instructors API
- `client.courses` - courses API
- `client.courseOfferings` - course_offerings API
- `client.courseSections` - course_sections API
- `client.courseLessons` - course_lessons API
- `client.courseResources` - course_resources API
- `client.courseLiveSessions` - course_live_sessions API
- `client.courseEnrollments` - course_enrollments API
- `client.courseProgress` - course_progress API
- `client.courseLessonProgress` - course_lesson_progress API
- `client.courseReactions` - course_reactions API
- `client.courseApplications` - course_applications API
- `client.courseReports` - course_reports API
- `client.courseAuditLogs` - course_audit_logs API
- `client.courseReviews` - course_reviews API

## Usage Examples

### course_categories

```typescript
// course Categories list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseCategories.list(params);
```

### course_instructors

```typescript
// course Instructors list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseInstructors.list(params);
```

### courses

```typescript
// courses list.
const params = {
  q: 'q',
  page: 2,
  page_size: 3,
  status: 'status',
  kind: 'kind',
  category: 'category',
  level: 'level',
  author_user_id: 'author_user_id',
};
const result = await client.courses.list(params);
```

### course_offerings

```typescript
// course Offerings retrieve.
const offeringId = '1';
const result = await client.courseOfferings.retrieve(offeringId);
```

### course_sections

```typescript
// course Sections delete.
const sectionId = '1';
const result = await client.courseSections.delete(sectionId);
```

### course_lessons

```typescript
// course Lessons retrieve.
const lessonId = '1';
const result = await client.courseLessons.retrieve(lessonId);
```

### course_resources

```typescript
// course Resources delete.
const resourceRefId = '1';
const result = await client.courseResources.delete(resourceRefId);
```

### course_live_sessions

```typescript
// course Live Sessions list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseLiveSessions.list(params);
```

### course_enrollments

```typescript
// course Enrollments list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseEnrollments.list(params);
```

### course_progress

```typescript
// course Progress list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseProgress.list(params);
```

### course_lesson_progress

```typescript
// course Lesson Progress update.
const lessonProgressId = '1';
const body = {};
const result = await client.courseLessonProgress.update(lessonProgressId, body);
```

### course_reactions

```typescript
// course Reactions list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseReactions.list(params);
```

### course_applications

```typescript
// course Applications list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseApplications.list(params);
```

### course_reports

```typescript
// course Reports overview retrieve.
const result = await client.courseReports.overview.retrieve();
```

### course_audit_logs

```typescript
// course Audit Logs list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseAuditLogs.list(params);
```

### course_reviews

```typescript
// course Reviews stats.
const result = await client.courseReviews.stats();
```

## Error Handling

```typescript
import { SdkworkBackendClient, NetworkError, TimeoutError, AuthenticationError } from '@sdkwork/course-backend-sdk';

try {
  const result = await client.courseReports.overview.retrieve();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else {
    throw error;
  }
}
```

## Publishing

This SDK includes cross-platform publish scripts in `bin/`:
- `bin/publish-core.mjs`
- `bin/publish.sh`
- `bin/publish.ps1`

TypeScript check and publish commands materialize workspace dependency versions in a temporary tarball with pnpm. They reject local-only dependency protocols before npm publication and do not rewrite the source `package.json`.

### Check

```bash
./bin/publish.sh --action check
```

### Publish

```bash
./bin/publish.sh --action publish --channel release
```

```powershell
.\bin\publish.ps1 --action publish --channel test --dry-run
```

> Configure npm registry credentials before release publish.

## License

MIT

## Regeneration Contract

- HTTP/OpenAPI generator-owned files are tracked in `.sdkwork/sdkwork-generator-manifest.json`.
- HTTP/OpenAPI generation also writes `.sdkwork/sdkwork-generator-changes.json` so automation can inspect created, updated, deleted, unchanged, scaffolded, and backed-up files plus the classified impact areas, verification plan, and execution decision for the latest generation.
- HTTP/OpenAPI apply mode also writes `.sdkwork/sdkwork-generator-report.json` with the full execution report, including `schemaVersion`, `generator`, stable artifact paths, and the execution handoff commands that match CLI `--json` output.
- CLI JSON output also includes an execution handoff with concrete next commands, including reviewed apply commands for dry-run flows.
- Put HTTP/OpenAPI hand-written wrappers, adapters, and orchestration in `custom/`.
- Files scaffolded under `custom/` are created once and preserved across HTTP/OpenAPI regenerations.
- If an HTTP/OpenAPI generated-owned file was modified locally, its previous content is copied to `.sdkwork/manual-backups/` before overwrite or removal.
- RPC SDK source workspaces use convention-first evidence by default: RPC SDK family naming, language workspace naming, `rpc/*.manifest.json`, proto source references, generated client source, and native package manifests.
- Use `sdkgen inspect --protocol rpc` to verify RPC convention evidence. Request persisted generator evidence only with `--emit-control-plane` for release, CI, audit, or migration workflows; evidence paths are derived by generator convention.
