# PRD — Course Center UGC And Review

Status: active
Updated: 2026-10-21
Parent: [PRD.md](PRD.md)

## 1. Content Model

| Shape | Learner label | Structure | Publish rule |
| --- | --- | --- | --- |
| `standard` | 课程 | Ordered chapters, each with lessons | At least 1 chapter and 1 lesson |
| `column` | 专栏 | Ordered chapters/lessons; article-first | At least 1 chapter and 1 lesson |
| `collection` | 合集 | Ordered list of published courses | At least 1 published course, no chapters |

Chapter = `course_section`, lesson = `course_lesson`. Lessons support video,
article, live, download, quiz, and assignment forms. Collection membership is
stored in `course_catalog_link` with `link_type='collection_item'`.

## 2. Creator Journey

1. Sign in and open **创作中心**.
2. Create a draft, choose 课程 / 专栏 / 合集.
3. Fill title, subtitle, summary, description, category, difficulty, tags,
   cover, and pricing.
4. Add chapters and lessons; upload video/attachments through Drive.
   - Video lessons accept `video/*` files up to 2 GB. The studio reads the local
     duration before upload and stores it on both the lesson and the resource.
   - The submit gate requires a real `vod_video` resource (MIME `video/*`, file
     size > 0) or a verified external source; attachments and live replays cannot
     satisfy a video lesson.
   - Cover upload accepts images up to 10 MB. A signed preview URL is stored in
     the cover snapshot metadata so the cover renders immediately in discovery,
     detail, and the studio.
5. For a collection, pick published courses and order them.
6. Save the draft. The submit checklist must pass.
7. Submit for review; content becomes read-only while `reviewing`.
8. On approval, the course is published with a default offering. On return, the
   author sees the review note and can edit and resubmit.

### Submission Quality Gates

| Gate | Rule |
| --- | --- |
| Title | At least 2 characters |
| Summary | 20–2,000 characters |
| Cover | Required; uploaded covers must be image MIME |
| Category | Required |
| Paid price | Positive decimal; currency required |
| Original price | Cannot be lower than the sale price |
| Video lesson | Duration > 0 and a `vod_video` resource or external source |
| Article lesson | At least 20 characters |
| Download lesson | Attachment or handout resource |
| Collection | At least one published course |
| Structure | At least one chapter and one lesson for non-collections |

The studio mirrors these checks before enabling **提交审核**; the service repeats
them as the authoritative gate, so direct API callers cannot bypass them.

## 3. Review State Machine

```text
draft ──submit──▶ reviewing ──approve──▶ published
  ▲                   │
  └──withdraw─────────┘
  ▲                   │
  └──return/reject────┘   (publish_status=draft + review_note + reviewed_at)
published ──operator take-down──▶ unpublished ──edit──▶ draft
```

- `submitting` increments `review_round`, clears the previous note, and records
  `submitted_at`.
- `approve` sets `publish_status=published`, `published_at`, `reviewed_at/by`,
  and ensures a default offering (`access_mode=free|paid`).
- `reject` / `request_changes` set `publish_status=draft`, `reviewed_at/by`, and
  require a note.
- A rejected draft is displayed as **已退回** when `reviewed_at` and
  `review_note` are present.

## 4. Operator Console

- **概览**: pending, returned, published, UGC totals, average review hours,
  over-48h backlog.
- **审核队列**: filters for 待审核 / 已退回 / 已通过; detail shows author,
  pricing, chapters, lessons, resources, collection items.
- **Actions**: 通过并发布, 要求修改, 退回 with a required note.
- **课程管理**: all publication states, kind filter, take-down with reason.
- **分类管理**: create/list categories.
- Every decision appends an audit record with target, operation, and before/after
  snapshots.

## 5. Ownership And Security

- Creator endpoints derive ownership from the IAM principal; they never accept
  `authorUserId` from the client.
- Studio reads/writes are restricted to `author_user_id = current user`.
- Learner catalog forces `publish_status=published`; draft ids are not readable
  through learner endpoints.
- Admin endpoints require `course.reviews.read` / `course.reviews.review`;
  take-down requires `course.courses.publish`.

## 6. Learner Discovery Surface

The learner course center uses a video-community discovery layout rather than a
storefront grid:

- Persistent top bar: brand, 首页 / 课程中心 / 专栏 / 合集 / 直播, centered
  search, operator console, and a prominent **上传课程** action.
- The BirdCoder embedded course mode exposes the same **上传课程** action in its
  top bar and the home-page creator card. It mounts the real studio routes
  (`/studio`, `/studio/courses/:id`) inside the host, rather than a placeholder.
- Embedded course detail and player routes use the host's full available width;
  discovery routes keep a 1,440 px reading width. The studio reuses the host IAM
  token and Drive API base URL, so cover and video uploads work inside the host.

- Compact topic panel: two entry tiles, 16 category/shortcut links, and
  secondary links for 专栏、合集、学习路径、直播课堂、全部课程、我的学习.
- Editorial hero: auto-rotating featured courses, cover image, kind and price
  badges, author, lesson count, duration, learners, rating, and two CTAs.
- Five-column discovery feed at wide widths (four at 1280, two at tablet, one
  on mobile); cards use a 16:9 cover, hover play affordance, learner count,
  lesson count, compact duration, two-line title, author/date line, and price.
- "换一换" rotates the recommendation set without a page reload; 查看更多课程
  links into the filtered catalog.
- Dedicated 专栏 / 合集 entry banners keep those two shapes discoverable without
  duplicating feed cards.
- Course cards open the lesson player directly (`/courses/:id/play`); the first
  playable lesson resolves into the canonical `/learn/:lessonId` route. The
  video player, not a marketing landing page, is the primary detail surface;
  course details remain one click away in the player header.
- For free or entitled standard/column courses, `/courses/:id` enters the same
  video detail surface; the informational overview stays available at
  `/courses/:id?view=overview`. Collections and paid locked courses keep the
  overview/paywall so there is no false playback entry.
- The embedded course surface consumes the host `--dsw-alias-*` background,
  layer, label, border, and button tokens, so dark and light modes match the
  surrounding BirdCoder shell; the standalone app falls back to the same neutral
  palette when those tokens are absent.
- The header exposes both the learner live classroom (`/live`) and the creator
  studio (`/studio`), with the primary upload action opening `/studio?create=1`.
  Seed profile `standard` includes live sessions in three states (live,
  scheduled, ended) so the complete learner journey is available after
  `db:seed`.
- Collection cards open the collection's first course immediately; an optional
  `item` query selects a different course. The player keeps the collection
  context, renders the collection as the right-side paginated playlist, and
  highlights the selected course. Column courses use the same player with a
  paginated article rail. The overview remains available through
  `?view=overview`.
- Course engagement is persisted per course and viewer: likes, favorites,
  shares, and discussions are counted from reaction/comment records, and the
  viewer's own reaction state is returned with the counters. The player renders
  the counters as its primary action bar and keeps them optimistic while the
  toggle is in flight.
- The catalog page follows the community category page: compact breadcrumb and
  title, underline text tabs for 课程/专栏/合集, a compact search/category/level
  toolbar, and a five-column card grid at wide widths.
- The player follows the video page: breadcrumb and lesson title, a large 16:9
  player on the left, author card, course curriculum and related courses on the
  right, and a share/detail/progress action bar directly under the player.
- Free courses play immediately. Paid courses render a locked poster/paywall
  with price and purchase CTA until an active enrollment exists; the curriculum
  API also strips paid lesson bodies, external video ids, and Drive resources
  for non-entitled learners.
- All discovery data comes from the published-only learner catalog; paid cards
  show price but the detail page explains that online purchase is not yet open.

## 7. Acceptance Criteria

- A creator can create, edit, submit, withdraw, and resubmit a standard course,
  a column, and a collection.
- A creator cannot read or modify another creator's draft (returns 404).
- A learner cannot list or retrieve unpublished courses.
- Submitting without cover, category, 20-character summary, chapter/lesson, or
  collection item returns a specific validation error.
- Approving a submission publishes it and creates a default offering.
- Rejecting without a note fails; rejecting with a note returns the content to
  the author with visible feedback.
- The operator console lists pending submissions and lets an operator decide
  without leaving the page.
- Paid content displays price and fails enrollment closed until an entitlement
  adapter is configured.
- A video lesson without a valid `vod_video` resource (video MIME, positive file
  size, duration) or external source fails submission with a specific error;
  attachments cannot stand in for video.
- A paid course with an original price below its sale price fails submission.
- The uploaded cover renders from its snapshot preview URL in discovery, detail,
  and studio surfaces.
- Publish, unpublish, delete, submit, withdraw, and review decisions append audit
  records.
- The embedded BirdCoder course mode exposes **上传课程**, opens the real studio,
  uploads cover/video through the host credential, and submits for review.

## 8. Theme And Visual System

- Light, dark, and system-follow themes share one semantic token set for page
  background, surface, muted surface, border, primary/secondary/faint text, and
  brand.
- The standalone PC app exposes a persisted light/dark toggle in the header and
  mobile menu and applies a pre-render theme class to avoid a flash.
- The embedded SDKWork plugin follows the host color scheme through
  `SdkworkHostThemeSurface`; it never forces a light surface inside a dark host.
- Cards, badges, stats, filters, forms, tabs, and the studio/admin consoles keep
  WCAG-readable contrast in both themes; pastel status backgrounds become
  translucent tints and status text switches to light foreground colors.
- H5 follows the system color scheme and uses the existing mobile dark tokens.

## 9. Out Of Scope

Payment, invoicing, refunds, payouts, video transcoding, and recommendation
ranking. These integrate through the existing entitlement boundary and future
adapters.
