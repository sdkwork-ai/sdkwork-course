// Emit database seed SQL from the fetched Bilibili catalog dataset.
//
// Input:  database/seeds/catalog/bilibili-catalog.json
// Output: database/seeds/common/010_course_catalog_instructors.sql
//         database/seeds/common/011_catalog_<slug>.sql ... per category
//         database/seeds/seed.manifest.json (standard profile file order)
//
// Every statement is an idempotent upsert with deterministic primary keys so
// `pnpm db:seed` can be replayed. The generated SQL follows the seed rules in
// sdkwork-specs/DATABASE_FRAMEWORK_SPEC.md section 8:
//   - language-neutral initialization data lives under seeds/common/
//   - execution order is declared by the manifest, not by directory order
//   - seeds are re-runnable upserts
//   - only full-line `--` comments are used (seed_security.rs rejects inline
//     comments, block comments, and dynamic SQL patterns)
//
// Usage:
//   node scripts/catalog/generate-course-seed-sql.mjs

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { CATALOG_SPEC, SPAM_TITLE } from './catalog-spec.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const DATASET = path.join(ROOT, 'database/seeds/catalog/bilibili-catalog.json')
const SEED_DIR = path.join(ROOT, 'database/seeds/common')
const MANIFEST = path.join(ROOT, 'database/seeds/seed.manifest.json')
const TENANT = '100001'
const ORG = '0'
const ACTOR = 'catalog-seed'

const CATEGORY_CODES = {
  programming: 'PRO',
  ai: 'AI',
  data: 'DATA',
  design: 'DES',
  product: 'PM',
  operations: 'OPS',
  workplace: 'WRK',
  language: 'LANG',
  finance: 'FIN',
  growth: 'GRW',
}

const SEED_FILES = {
  programming: '011_catalog_programming.sql',
  ai: '012_catalog_ai.sql',
  data: '013_catalog_data.sql',
  design: '014_catalog_design.sql',
  product: '015_catalog_product.sql',
  operations: '016_catalog_operations.sql',
  workplace: '017_catalog_workplace.sql',
  language: '018_catalog_language.sql',
  finance: '019_catalog_finance.sql',
  growth: '020_catalog_growth.sql',
}

const INSTRUCTOR_FILE = '010_course_catalog_instructors.sql'

function sqlText(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/;/g, '，')
    // The seed security scanner treats a mid-line `--` as a comment injection and
    // `/* */` as a block comment, so real course copy must never contain them.
    .replace(/-{2,}/g, '—')
    .replace(/\/\*/g, '/')
    .replace(/\*\//g, '/')
    .replace(/'/g, "''")
    .trim()
}

function sqlBool(value) {
  return value ? '1' : '0'
}

function quote(value) {
  return `'${sqlText(value)}'`
}

function quoteJson(value) {
  return quote(JSON.stringify(value ?? []))
}

function nullable(value) {
  return value === null || value === undefined || value === '' ? 'NULL' : quote(value)
}

function renderStatement(table, columns, rows, conflictTarget, updates) {
  const columnList = columns.join(', ')
  const valueBlocks = rows.map((row) => `    (${row.join(', ')})`).join(',\n')
  const updateList = updates.map((column) => `    ${column} = EXCLUDED.${column}`).join(',\n')
  return `INSERT INTO ${table}\n    (${columnList})\nVALUES\n${valueBlocks}\nON CONFLICT (${conflictTarget}) DO UPDATE SET\n${updateList};`
}

function stamp() {
  return 'CURRENT_TIMESTAMP::text'
}

function slugId(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
}

function round(value) {
  return Math.round(Number(value ?? 0))
}

// Deterministic fallback key for creators whose upstream account id is missing.
function stableKey(value) {
  let hash = 0x811c9dc5
  for (const char of String(value ?? '')) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

// Bilibili titles often carry a leading 【decorative】 block such as
// 【郝斌】 or 【2026最新】. It reads like an ad in a catalog list, so it is
// removed when the remaining text is still meaningful and on topic.
function cleanCourseTitle(spec, title) {
  const stripped = String(title ?? '')
    .replace(/^(?:[【\[]([^】\]]{1,12})[】\]]\s*)+/u, '')
    .replace(/^\d{1,3}[.、)）]\s*/u, '')
    .replace(/^[-—–:：|·\s]+/u, '')
    .trim()
  if (stripped.length < 6) return title
  if (!spec.include.test(stripped)) return title
  if (SPAM_TITLE.test(stripped)) return title
  return stripped
}

// Curation gate. The dataset comes from public search results, so off-topic
// seasons, deactivated uploaders, and marketing headlines must be rejected here
// instead of leaking into a commercial catalog. The check is defensive: it also
// protects against an older dataset that has no `searchTitle` provenance field.
function curateCourse(spec, course) {
  const title = String(course.title ?? '').trim()
  const summary = String(course.summary ?? '')
  const searchTitle = String(course.searchTitle ?? '').trim()
  const instructorName = String(course.instructor?.name ?? '').trim()

  if (!title || title.length < 6) return false
  if (!instructorName) return false
  if (/已注销|账号注销|已封禁/u.test(instructorName)) return false
  if (SPAM_TITLE.test(title)) return false

  if (spec.include.test(title)) {
    if (spec.exclude.test(title)) return false
  } else if (searchTitle && spec.include.test(searchTitle) && !spec.exclude.test(searchTitle)) {
    // A season header can differ from the video that matched the query.
  } else if (spec.include.test(`${title} ${summary}`)) {
    // Last resort for generic headers such as "教程(合集)" whose real intro
    // still describes the category topic.
    if (spec.exclude.test(title)) return false
  } else {
    return false
  }

  return Array.isArray(course.sections) && course.sections.length > 0
}

// Tag chips render as small pills in the course center, so anything that is
// really a whole title, an uploader name, or a deactivated account is dropped.
function curateTags(spec, course) {
  const instructorName = String(course.instructor?.name ?? '').trim()
  const tags = []
  for (const raw of [...(spec.tags ?? []), ...(course.tags ?? [])]) {
    const tag = String(raw ?? '').trim()
    if (tag.length < 2 || tag.length > 14) continue
    if (tag === instructorName) continue
    if (tags.includes(tag)) continue
    tags.push(tag)
  }
  return tags.slice(0, 8)
}

function buildCourses(dataset) {
  const result = []
  const seenSources = new Set()
  for (const category of dataset.categories) {
    const spec = CATALOG_SPEC.find((item) => item.slug === category.slug)
    const categoryCode = CATEGORY_CODES[category.slug] ?? category.slug.slice(0, 4).toUpperCase()
    let sequenceIndex = 0
    let dropped = 0
    for (const course of category.courses) {
      const sourceId = slugId(course.idSeed)
      // A public video can be a good fit for two categories. Emit it once so
      // primary keys stay unique across the generated seed files.
      if (seenSources.has(sourceId)) continue
      if (!spec || !curateCourse(spec, course)) {
        dropped += 1
        continue
      }
      seenSources.add(sourceId)
      sequenceIndex += 1
      const sequence = String(sequenceIndex).padStart(3, '0')
      const courseId = `course-bili-${sourceId}`
      const courseCode = `BILI-${categoryCode}-${sequence}`
      const sourceTitle = String(course.title ?? '')
      const title = cleanCourseTitle(spec, sourceTitle)
      result.push({
        ...course,
        title,
        // The generated copy quotes the upstream title, so it is kept in sync
        // with the cleaned display title.
        description:
          title === sourceTitle
            ? course.description
            : String(course.description ?? '').split(sourceTitle).join(title),
        tags: curateTags(spec, course),
        categoryId: category.categoryId,
        categorySlug: category.slug,
        categoryLabel: category.label,
        courseId,
        courseCode,
        offeringId: `offering-bili-${sourceId}`,
        offeringCode: `OFR-${courseCode}`,
        instructorId: `instructor-bili-${
          Number(course.instructor?.mid ?? 0) > 0
            ? course.instructor.mid
            : stableKey(course.instructor?.name ?? course.title)
        }`,
      })
    }
    if (dropped > 0) {
      console.log(`  curation · ${category.slug} · dropped ${dropped} off-topic course(s)`)
    }
  }
  return result
}

function buildInstructors(courses) {
  const map = new Map()
  for (const course of courses) {
    const id = course.instructorId
    if (map.has(id)) {
      const current = map.get(id)
      current.courseTitles.push(course.title)
      for (const tag of course.tags) current.tags.add(tag)
      continue
    }
    map.set(id, {
      id,
      mid: course.instructor.mid,
      name: course.instructor.name,
      avatar: course.instructor.avatar,
      signature: course.instructor.signature,
      categoryLabel: course.categoryLabel,
      tags: new Set(course.tags.slice(0, 5)),
      courseTitles: [course.title],
    })
  }
  return [...map.values()].map((item, index) => ({ ...item, sortOrder: index }))
}

function renderInstructors(instructors) {
  const rows = instructors.map((item) => {
    const signature = sanitizeCopy(item.signature)
    const bio = signature
      ? `B 站知识区创作者：${signature.slice(0, 200)}`
      : `B 站知识区创作者，发布《${item.courseTitles[0]}》等课程。`
    return [
      quote(item.id),
      quote(item.id),
      quote(TENANT),
      quote(ORG),
      'NULL',
      quote(item.name),
      quote(`${item.categoryLabel} · B 站课程讲师`),
      quote(bio.slice(0, 500)),
      nullable(item.avatar),
      quote('[]'),
      quoteJson([...item.tags]),
      quote('verified'),
      String(item.sortOrder),
      quote('active'),
      stamp(),
      quote(ACTOR),
      stamp(),
      quote(ACTOR),
      '0',
    ]
  })
  return renderStatement(
    'course_instructor',
    [
      'id',
      'uuid',
      'tenant_id',
      'organization_id',
      'user_id',
      'display_name',
      'title',
      'bio',
      'avatar_resource_snapshot',
      'profile_links_json',
      'expertise_tags_json',
      'qualification_status',
      'sort_order',
      'status',
      'created_at',
      'created_by',
      'updated_at',
      'updated_by',
      'version',
    ],
    rows,
    'id',
    [
      'display_name',
      'title',
      'bio',
      'avatar_resource_snapshot',
      'expertise_tags_json',
      'qualification_status',
      'sort_order',
      'status',
      'updated_at',
    ],
  )
}

function lessonRows(course) {
  const rows = []
  let lessonIndex = 0
  course.sections.forEach((section, sectionIndex) => {
    section.lessons.forEach((lesson) => {
      lessonIndex += 1
      const lessonNo = String(lessonIndex).padStart(2, '0')
      const sectionNo = String(sectionIndex + 1).padStart(2, '0')
      const externalSource =
        course.sourceType === 'season'
          ? lesson.bvid
          : Number(lesson.page) > 1
            ? `${lesson.bvid}?p=${lesson.page}`
            : lesson.bvid
      const description = `${course.title} · 第 ${lessonIndex} 讲，时长 ${Math.max(
        1,
        Math.round(lesson.duration / 60),
      )} 分钟。`
      rows.push(
        [
          quote(`lesson-bili-${slugId(course.idSeed)}-${lessonNo}`),
          quote(`lesson-bili-${slugId(course.idSeed)}-${lessonNo}`),
          quote(TENANT),
          quote(ORG),
          quote(course.courseId),
          quote(`section-bili-${slugId(course.idSeed)}-${sectionNo}`),
          quote(lessonNo),
          quote('vod_video'),
          quote(lesson.title.slice(0, 180)),
          quote(description.slice(0, 240)),
          String(Math.max(1, round(lesson.duration))),
          'NULL',
          quote(externalSource),
          quote('bilibili'),
          sqlBool(lessonIndex <= 2),
          '1',
          quote('{}'),
          String(lessonIndex - 1),
          'NULL',
          'NULL',
          quote('active'),
          stamp(),
          quote(ACTOR),
          stamp(),
          quote(ACTOR),
          '0',
        ],
      )
    })
  })
  return rows
}

// Uploader descriptions routinely carry funnel copy (WeChat ids, 公众号,
// 网盘 links, 提取码). A paid catalog must not surface those, so clauses that
// look like promotion are dropped and only the real course copy is kept.
const PROMO_CLAUSE =
  /公众号|微信|vx|wx|qq群|企鹅|加v|加我|关注|私信|备注|领取|网盘|提取码|pan\.baidu|https?:|www\.|课程咨询|联系方式|扫码|二维码|优惠|报名|低价|粉丝群|学员群|[Qq]\s*[:：]\s*\d/iu

function sanitizeCopy(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  const kept = text
    .split(/(?<=[。！？；;，,])/u)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length >= 6 && !PROMO_CLAUSE.test(clause))
  return kept.join('').replace(/\s+/g, ' ').trim()
}

function formatHours(seconds) {
  const hours = Number(seconds ?? 0) / 3600
  if (hours >= 1) return `${hours.toFixed(1)} 小时`
  return `${Math.max(1, Math.round(Number(seconds ?? 0) / 60))} 分钟`
}

function renderCourse(course) {
  const lessons = course.sections.flatMap((section) => section.lessons)
  const lessonCount = lessons.length
  const isFree = course.price?.isFree !== false
  const price = isFree ? null : course.price.amount
  const originalPrice = isFree ? null : course.price.originalAmount
  const currency = isFree ? null : course.price.currency ?? 'CNY'

  // Some uploaders leave the video description empty, one line long, or full of
  // funnel copy. A catalog card still needs a readable summary, so promotion is
  // stripped first and a factual summary is derived when nothing usable remains.
  const rawSummary = sanitizeCopy(course.summary)
  const summaryText =
    rawSummary.length >= 30
      ? rawSummary
      : `${course.title}。共 ${lessonCount} 讲，累计 ${formatHours(
          course.durationSeconds,
        )}，由 ${course.instructor?.name ?? 'B站讲师'} 讲解，章节结构完整，可直接在课程播放器中观看。`

  const rawDescription = sanitizeCopy(course.description)
  const descriptionText =
    rawDescription.length >= 80
      ? rawDescription
      : `${summaryText} 课程结构：共 ${course.sections.length} 章 ${lessonCount} 讲，累计 ${formatHours(
          course.durationSeconds,
        )}，视频画面与课程封面同源，可按章节顺序直接播放。`

  const catalogRow = [
    quote(course.courseId),
    quote(course.courseId),
    quote(TENANT),
    quote(ORG),
    quote(course.courseCode),
    quote(course.categoryId),
    quote(course.instructorId),
    quote(course.title.slice(0, 220)),
    quote(course.subtitle.slice(0, 200)),
    quote(summaryText.slice(0, 220)),
    quote(descriptionText.slice(0, 1200)),
    quoteJson(course.objectives),
    quoteJson(course.audience),
    quoteJson(course.prerequisites),
    quote(course.difficulty),
    quote(course.languageCode || 'zh-CN'),
    nullable(course.cover),
    quoteJson(course.tags),
    String(round(course.durationSeconds)),
    String(lessonCount),
    String(round(course.studentCount)),
    quote(course.ratingScore),
    String(round(course.ratingCount)),
    nullable(course.bvid),
    nullable(price),
    nullable(originalPrice),
    nullable(currency),
    sqlBool(isFree),
    '0',
    quote('standard'),
    'NULL',
    quote(course.instructor.name),
    '0',
    quote('tenant'),
    quote('published'),
    quote(course.publishedAt),
    quote('active'),
    stamp(),
    quote(ACTOR),
    stamp(),
    quote(ACTOR),
    '0',
  ]

  const offeringRow = [
    quote(course.offeringId),
    quote(course.offeringId),
    quote(TENANT),
    quote(ORG),
    quote(course.courseId),
    quote(course.offeringCode),
    quote(`${course.title} · ${isFree ? '免费公开课' : '精品付费课'}`.slice(0, 220)),
    quote('vod'),
    quote('self_paced'),
    quote(isFree ? 'free' : 'paid'),
    quote(
      isFree
        ? '{}'
        : JSON.stringify({ priceAmount: price, currency: currency ?? 'CNY' }),
    ),
    quote('{}'),
    '0',
    quote('published'),
    stamp(),
    quote(ACTOR),
    stamp(),
    quote(ACTOR),
    '0',
  ]

  const sectionRows = course.sections.map((section, index) => {
    const duration = section.lessons.reduce((total, lesson) => total + lesson.duration, 0)
    return [
      quote(`section-bili-${slugId(course.idSeed)}-${String(index + 1).padStart(2, '0')}`),
      quote(`section-bili-${slugId(course.idSeed)}-${String(index + 1).padStart(2, '0')}`),
      quote(TENANT),
      quote(ORG),
      quote(course.courseId),
      quote(String(index + 1).padStart(2, '0')),
      quote(section.title.slice(0, 160)),
      quote(`共 ${section.lessons.length} 讲，累计 ${Math.round(duration / 60)} 分钟。`),
      String(index),
      String(section.lessons.length),
      String(round(duration)),
      quote('tenant'),
      quote('active'),
      stamp(),
      quote(ACTOR),
      stamp(),
      quote(ACTOR),
      '0',
    ]
  })

  return {
    catalog: renderStatement(
      'course_catalog',
      [
        'id',
        'uuid',
        'tenant_id',
        'organization_id',
        'course_code',
        'category_id',
        'primary_instructor_id',
        'title',
        'subtitle',
        'summary',
        'description',
        'learning_objectives_json',
        'target_audience_json',
        'prerequisites_json',
        'difficulty_level',
        'language_code',
        'cover_resource_snapshot',
        'tags_json',
        'estimated_duration_seconds',
        'lesson_count_snapshot',
        'student_count_snapshot',
        'rating_score_snapshot',
        'rating_count_snapshot',
        'external_source_id',
        'price_amount',
        'original_price_amount',
        'currency',
        'is_free',
        'is_collection',
        'course_kind',
        'author_user_id',
        'author_display_name',
        'review_round',
        'visibility',
        'publish_status',
        'published_at',
        'status',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'version',
      ],
      [catalogRow],
      'id',
      [
        'category_id',
        'primary_instructor_id',
        'title',
        'subtitle',
        'summary',
        'description',
        'learning_objectives_json',
        'target_audience_json',
        'prerequisites_json',
        'difficulty_level',
        'cover_resource_snapshot',
        'tags_json',
        'estimated_duration_seconds',
        'lesson_count_snapshot',
        'student_count_snapshot',
        'rating_score_snapshot',
        'rating_count_snapshot',
        'price_amount',
        'original_price_amount',
        'currency',
        'is_free',
        'author_display_name',
        'publish_status',
        'published_at',
        'status',
        'updated_at',
      ],
    ),
    offering: renderStatement(
      'course_offering',
      [
        'id',
        'uuid',
        'tenant_id',
        'organization_id',
        'course_id',
        'offering_code',
        'title',
        'offering_type',
        'delivery_mode',
        'access_mode',
        'access_policy_json',
        'completion_rule_json',
        'certificate_enabled',
        'status',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'version',
      ],
      [offeringRow],
      'id',
      [
        'course_id',
        'offering_code',
        'title',
        'access_mode',
        'access_policy_json',
        'status',
        'updated_at',
      ],
    ),
    sections: renderStatement(
      'course_section',
      [
        'id',
        'uuid',
        'tenant_id',
        'organization_id',
        'course_id',
        'section_no',
        'title',
        'description',
        'sort_order',
        'lesson_count_snapshot',
        'duration_seconds_snapshot',
        'visibility',
        'status',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'version',
      ],
      sectionRows,
      'id',
      [
        'course_id',
        'section_no',
        'title',
        'description',
        'sort_order',
        'lesson_count_snapshot',
        'duration_seconds_snapshot',
        'status',
        'updated_at',
      ],
    ),
    lessons: renderStatement(
      'course_lesson',
      [
        'id',
        'uuid',
        'tenant_id',
        'organization_id',
        'course_id',
        'section_id',
        'lesson_no',
        'lesson_kind',
        'title',
        'description',
        'duration_seconds',
        'duration_text',
        'external_source_id',
        'source_provider',
        'free_preview',
        'required_for_completion',
        'completion_rule_json',
        'sort_order',
        'scheduled_start_at',
        'scheduled_end_at',
        'status',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'version',
      ],
      lessonRows(course),
      'id',
      [
        'course_id',
        'section_id',
        'lesson_no',
        'lesson_kind',
        'title',
        'description',
        'duration_seconds',
        'external_source_id',
        'source_provider',
        'free_preview',
        'required_for_completion',
        'sort_order',
        'status',
        'updated_at',
      ],
    ),
  }
}

async function main() {
  const dataset = JSON.parse(await fs.readFile(DATASET, 'utf8'))
  const courses = buildCourses(dataset)
  const instructors = buildInstructors(courses)

  const header = (label) =>
    `-- ${label}\n-- Generated by scripts/catalog/generate-course-seed-sql.mjs from\n-- database/seeds/catalog/bilibili-catalog.json. Do not edit by hand.\n-- Tenant 100001 / org 0. Idempotent upserts keyed by deterministic ids.\n\n`

  await fs.writeFile(
    path.join(SEED_DIR, INSTRUCTOR_FILE),
    `${header('Course catalog instructors (Bilibili knowledge creators).')}${renderInstructors(instructors)}\n`,
    'utf8',
  )
  console.log(`wrote ${INSTRUCTOR_FILE} (${instructors.length} instructors)`)

  const generated = []
  let totalLessons = 0
  for (const category of dataset.categories) {
    const fileName = SEED_FILES[category.slug]
    if (!fileName) continue
    const categoryCourses = courses.filter((course) => course.categorySlug === category.slug)
    const blocks = []
    for (const course of categoryCourses) {
      const rendered = renderCourse(course)
      totalLessons += course.sections.reduce((total, section) => total + section.lessons.length, 0)
      blocks.push(
        [
          `-- ── ${course.courseCode} · ${course.title} ──`,
          '',
          rendered.catalog,
          '',
          rendered.offering,
          '',
          rendered.sections,
          '',
          rendered.lessons,
          '',
        ].join('\n'),
      )
    }
    const content = `${header(`Course catalog · ${category.label} (${category.slug}).`)}${blocks.join('\n')}`
    await fs.writeFile(path.join(SEED_DIR, fileName), content, 'utf8')
    generated.push(`common/${fileName}`)
    console.log(`wrote ${fileName} (${categoryCourses.length} courses)`)
  }

  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'))
  const standard = manifest.profiles?.standard?.common ?? []
  const preserved = standard.filter(
    (entry) => !entry.includes('_catalog_') && entry !== 'common/010_course_catalog_instructors.sql',
  )
  const anchor = preserved.findIndex((entry) => entry === 'common/006_live_sessions.sql')
  const next = [
    ...preserved.slice(0, anchor >= 0 ? anchor + 1 : preserved.length),
    `common/${INSTRUCTOR_FILE}`,
    ...generated,
    ...preserved.slice(anchor >= 0 ? anchor + 1 : preserved.length),
  ]
  manifest.profiles.standard.common = next
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`updated seed.manifest.json standard profile (${next.length} common files)`)
  console.log(`total courses=${courses.length} lessons=${totalLessons}`)
}

await main()
