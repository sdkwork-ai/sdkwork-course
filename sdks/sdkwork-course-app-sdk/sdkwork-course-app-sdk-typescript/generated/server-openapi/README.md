# sdkwork-course-app-sdk

Generated SDKWork v3 dual-token transport SDK.

## Installation

```bash
npm install @sdkwork/course-app-sdk
# or
yarn add @sdkwork/course-app-sdk
# or
pnpm add @sdkwork/course-app-sdk
```

## Quick Start

```typescript
import { SdkworkAppClient } from '@sdkwork/course-app-sdk';

const client = new SdkworkAppClient({
  baseUrl: 'http://localhost:8080',
  timeout: 30000,
});

// Authentication
client.setAuthToken('your-auth-token');
client.setAccessToken('your-access-token');

// Use the SDK
const result = await client.questionBankTaxonomy.retrieve();
```

## Authentication

```text
Authorization: Bearer <authToken>
Access-Token: <accessToken>
```


## Configuration (Non-Auth)

```typescript
import { SdkworkAppClient } from '@sdkwork/course-app-sdk';

const client = new SdkworkAppClient({
  baseUrl: 'http://localhost:8080',
  timeout: 30000, // Request timeout in ms
  headers: {      // Custom headers
    'X-Custom-Header': 'value',
  },
});
```

## API Modules

- `client.courseCategories` - course_categories API
- `client.courses` - courses API
- `client.courseOfferings` - course_offerings API
- `client.courseEnrollments` - course_enrollments API
- `client.courseSections` - course_sections API
- `client.courseLessons` - course_lessons API
- `client.courseLessonResources` - course_lesson_resources API
- `client.courseProgress` - course_progress API
- `client.courseLessonProgress` - course_lesson_progress API
- `client.courseLiveSessions` - course_live_sessions API
- `client.courseEngagement` - course_engagement API
- `client.courseReactions` - course_reactions API
- `client.courseApplications` - course_applications API
- `client.courseCurriculum` - course_curriculum API
- `client.courseCollectionItems` - course_collection_items API
- `client.studioCourses` - studio_courses API
- `client.courseEntitlements` - course_entitlements API
- `client.questionBankQuestions` - question_bank_questions API
- `client.questionBankTaxonomy` - question_bank_taxonomy API
- `client.questionBankPapers` - question_bank_papers API
- `client.questionBankHandouts` - question_bank_handouts API

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

### courses

```typescript
// courses list.
const params = {
  q: 'q',
  page: 2,
  page_size: 3,
  category: 'category',
  level: 'level',
  kind: 'kind',
};
const result = await client.courses.list(params);
```

### course_offerings

```typescript
// course Offerings retrieve.
const offeringId = '1';
const result = await client.courseOfferings.retrieve(offeringId);
```

### course_enrollments

```typescript
// course Enrollments current list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseEnrollments.current.list(params);
```

### course_sections

```typescript
// course Sections list.
const courseId = '1';
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseSections.list(courseId, params);
```

### course_lessons

```typescript
// course Lessons retrieve.
const lessonId = '1';
const result = await client.courseLessons.retrieve(lessonId);
```

### course_lesson_resources

```typescript
// course Lesson Resources list.
const lessonId = '1';
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseLessonResources.list(lessonId, params);
```

### course_progress

```typescript
// course Progress retrieve.
const enrollmentId = '1';
const result = await client.courseProgress.retrieve(enrollmentId);
```

### course_lesson_progress

```typescript
// course Lesson Progress watch Positions update.
const lessonId = '1';
const body = {};
const result = await client.courseLessonProgress.watchPositions.update(lessonId, body);
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

### course_engagement

```typescript
// course Engagement retrieve.
const courseId = '1';
const result = await client.courseEngagement.retrieve(courseId);
```

### course_reactions

```typescript
// course Reactions update.
const body = {};
const idempotencyKey = 'Idempotency-Key';
const params = {
  idempotencyKey,
};
const result = await client.courseReactions.update(body, params);
```

### course_applications

```typescript
// course Applications current list.
const params = {
  q: 'q',
  cursor: 'cursor',
  page: 3,
  page_size: 4,
  status: 'status',
};
const result = await client.courseApplications.current.list(params);
```

### course_curriculum

```typescript
// course Curriculum retrieve.
const courseId = '1';
const result = await client.courseCurriculum.retrieve(courseId);
```

### course_collection_items

```typescript
// course Collection Items list.
const courseId = '1';
const params = {
  page: 1,
  page_size: 2,
};
const result = await client.courseCollectionItems.list(courseId, params);
```

### studio_courses

```typescript
// studio Courses list.
const params = {
  q: 'q',
  page: 2,
  page_size: 3,
  status: 'status',
  kind: 'kind',
};
const result = await client.studioCourses.list(params);
```

### course_entitlements

```typescript
// course Entitlements grant.
const body = {};
const result = await client.courseEntitlements.grant(body);
```

### question_bank_questions

```typescript
// question Bank Questions retrieve.
const questionId = '1';
const result = await client.questionBankQuestions.retrieve(questionId);
```

### question_bank_taxonomy

```typescript
// question Bank Taxonomy retrieve.
const result = await client.questionBankTaxonomy.retrieve();
```

### question_bank_papers

```typescript
// question Bank Papers list.
const params = {
  q: 'q',
  page: 2,
  page_size: 3,
  status: 'status',
  owner_user_id: 'owner_user_id',
};
const result = await client.questionBankPapers.list(params);
```

### question_bank_handouts

```typescript
// question Bank Handouts list.
const params = {
  q: 'q',
  page: 2,
  page_size: 3,
  grade: 'grade',
  subject: 'subject',
  owner_user_id: 'owner_user_id',
};
const result = await client.questionBankHandouts.list(params);
```

## Error Handling

```typescript
import { SdkworkAppClient, NetworkError, TimeoutError, AuthenticationError } from '@sdkwork/course-app-sdk';

try {
  const result = await client.questionBankTaxonomy.retrieve();
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
