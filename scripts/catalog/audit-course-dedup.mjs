// Audit the Bilibili course catalog for duplicates and quality regressions.
//
// Usage:
//   node scripts/catalog/audit-course-dedup.mjs
//   node scripts/catalog/audit-course-dedup.mjs --json
//   node scripts/catalog/audit-course-dedup.mjs --min-lessons 6 --strict
//
// Errors (duplicate source ids, duplicate BVIDs, per-category title duplicates,
// incomplete course fields) exit with code 1. Warnings (shared covers, titles
// repeated across categories, which are also real upstream situations) only exit
// with code 1 under `--strict`.

import process from 'node:process'
import { SPAM_TITLE } from './catalog-spec.mjs'
import { CATALOG_PATHS, readCatalog } from './catalog-store.mjs'

const DATASET_FILE = CATALOG_PATHS.CATEGORY_DIR

const args = parseArgs(process.argv.slice(2))
const MIN_LESSONS = Number(args['min-lessons'] ?? 6)
// Mirrors the fetcher: one long single-part video is a complete lesson set.
const SINGLE_MIN_SECONDS = Number(args['single-min-seconds'] ?? 1800)
const JSON_OUT = Boolean(args.json)
const STRICT = Boolean(args.strict)

const PLACEHOLDER_COVER = /viedeo_material_default|material_default|bfs\/templar|static\.hdslb\.com/i
const JUNK_AUTHOR = /已注销|账号注销|已封禁|不再更新|不要关注|停更|未命名/u

function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      parsed[token.slice(2)] = next
      index += 1
    } else {
      parsed[token.slice(2)] = 'true'
    }
  }
  return parsed
}

function normaliseTitle(value) {
  return String(value ?? '')
    .replace(/[【】\[\]（）()《》<>·|｜,，.。!！?？:：'"“”‘’\-—_~、\s]/g, '')
    .toLowerCase()
}

function coverKey(value) {
  const url = String(value ?? '')
  if (!url) return ''
  return url.split('/').pop().split('@')[0].split('?')[0]
}

function lessonCount(course) {
  return (course.sections ?? []).reduce((total, section) => total + (section.lessons?.length ?? 0), 0)
}

function lessonSeconds(course) {
  return (course.sections ?? []).reduce(
    (total, section) => total + (section.lessons ?? []).reduce((sum, lesson) => sum + Number(lesson.duration ?? 0), 0),
    0,
  )
}

const dataset = await readCatalog()
const errors = []
const warnings = []
const push = (bucket, kind, slug, title, detail) => bucket.push({ kind, slug, title, detail })

const byIdSeed = new Map()
const byBvid = new Map()
const byCover = new Map()
const byTitleGlobal = new Map()
const categoryRows = []

function remember(map, key, slug, course) {
  if (!key) return
  const list = map.get(key) ?? []
  list.push({ slug, title: course.title, bvid: course.bvid })
  map.set(key, list)
}

for (const category of dataset.categories ?? []) {
  const slug = category.slug
  const courses = category.courses ?? []
  const titleKeys = new Map()
  let lessons = 0
  let seconds = 0
  let seasons = 0

  for (const course of courses) {
    const count = lessonCount(course)
    const duration = lessonSeconds(course)
    lessons += count
    seconds += duration
    if (course.sourceType === 'season') seasons += 1

    // ── Required fields ─────────────────────────────────────────────
    if (!course.idSeed) push(errors, 'source-missing', slug, course.title, '缺少 idSeed')
    if (!course.title || String(course.title).trim().length < 6) {
      push(errors, 'title-invalid', slug, course.title, '标题为空或过短')
    }
    if (!course.instructor?.name) push(errors, 'instructor-missing', slug, course.title, '缺少讲师')
    else if (JUNK_AUTHOR.test(course.instructor.name)) {
      push(errors, 'instructor-junk', slug, course.title, course.instructor.name)
    }
    if (SPAM_TITLE.test(String(course.title ?? ''))) {
      push(errors, 'title-spam', slug, course.title, '标题命中营销词')
    }

    // ── Cover ───────────────────────────────────────────────────────
    const cover = String(course.cover ?? '')
    if (!cover) push(errors, 'cover-missing', slug, course.title, '缺少封面')
    else if (!/^https:\/\//i.test(cover)) push(errors, 'cover-not-https', slug, course.title, cover)
    else if (PLACEHOLDER_COVER.test(cover)) push(errors, 'cover-placeholder', slug, course.title, cover)

    // ── Curriculum ──────────────────────────────────────────────────
    if (!(course.sections ?? []).length) push(errors, 'sections-empty', slug, course.title, '没有章节')
    if (count < MIN_LESSONS && !(count === 1 && duration >= SINGLE_MIN_SECONDS)) {
      push(errors, 'lessons-below-min', slug, course.title, `${count} < ${MIN_LESSONS} 且时长 ${duration}s < ${SINGLE_MIN_SECONDS}s`)
    }
    if (Math.abs(duration - Number(course.durationSeconds ?? 0)) > 1) {
      push(errors, 'duration-mismatch', slug, course.title, `${duration} != ${course.durationSeconds}`)
    }
    const lessonKeys = new Set()
    for (const section of course.sections ?? []) {
      if (!(section.lessons ?? []).length) push(errors, 'section-empty', slug, course.title, section.title)
      for (const lesson of section.lessons ?? []) {
        if (!lesson.bvid) push(errors, 'lesson-source-missing', slug, course.title, lesson.title)
        // A multi-part video legitimately uses one BVID for several pages, so the
        // lesson identity is BVID + page number.
        else {
          const lessonKey = `${lesson.bvid}#${Number(lesson.page ?? 1)}`
          if (lessonKeys.has(lessonKey)) push(errors, 'lesson-duplicate', slug, course.title, lessonKey)
          else lessonKeys.add(lessonKey)
        }
        if (!(Number(lesson.duration) > 0)) push(errors, 'lesson-duration', slug, course.title, lesson.title)
      }
    }

    // ── Deduplication keys ──────────────────────────────────────────
    remember(byIdSeed, course.idSeed, slug, course)
    if (course.bvid) remember(byBvid, course.bvid, slug, course)
    remember(byCover, coverKey(cover), slug, course)

    const titleKey = normaliseTitle(course.title).slice(0, 22)
    if (titleKey) {
      if (titleKeys.has(titleKey)) {
        push(errors, 'title-duplicate-in-category', slug, course.title, `与《${titleKeys.get(titleKey)}》重复`)
      } else {
        titleKeys.set(titleKey, course.title)
      }
      remember(byTitleGlobal, titleKey, slug, course)
    }
  }

  categoryRows.push({
    slug,
    label: category.label,
    courses: courses.length,
    lessons,
    hours: Number((seconds / 3600).toFixed(1)),
    seasons,
  })
}

for (const [key, list] of byIdSeed) {
  if (list.length > 1) {
    const slugs = [...new Set(list.map((item) => item.slug))]
    push(errors, 'duplicate-source-id', slugs.join(','), list[0].title, key)
  }
}
for (const [key, list] of byBvid) {
  if (list.length > 1) {
    const slugs = [...new Set(list.map((item) => item.slug))]
    push(errors, 'duplicate-bvid', slugs.join(','), list[0].title, key)
  }
}
for (const [key, list] of byTitleGlobal) {
  const slugs = [...new Set(list.map((item) => item.slug))]
  if (slugs.length > 1) {
    push(warnings, 'title-duplicate-across-categories', slugs.join(','), list[0].title, key)
  }
}
for (const [key, list] of byCover) {
  if (list.length > 1) {
    const slugs = [...new Set(list.map((item) => item.slug))]
    push(warnings, 'cover-duplicate', slugs.join(','), list[0].title, `${list.length} 门课程共用 ${key}`)
  }
}

const totalCourses = categoryRows.reduce((total, row) => total + row.courses, 0)
const totalLessons = categoryRows.reduce((total, row) => total + row.lessons, 0)
const totalHours = Number((categoryRows.reduce((total, row) => total + row.hours, 0)).toFixed(1))

const result = {
  file: DATASET_FILE,
  minLessons: MIN_LESSONS,
  stats: { courses: totalCourses, lessons: totalLessons, hours: totalHours },
  categories: categoryRows,
  errors,
  warnings,
}

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`dataset: ${DATASET_FILE} (index + one file per category)`)
  console.log(`courses=${totalCourses} lessons=${totalLessons} hours=${totalHours}\n`)
  console.log('category coverage:')
  for (const row of categoryRows) {
    console.log(
      `  ${String(row.label).padEnd(6, '　')} ${String(row.courses).padStart(5)} 门 · ${String(row.lessons).padStart(6)} 课时` +
        ` · ${String(row.hours).padStart(9)} 小时 · 合集 ${row.seasons}`,
    )
  }

  const groups = new Map()
  for (const issue of errors) groups.set(issue.kind, (groups.get(issue.kind) ?? 0) + 1)
  console.log(`\nerrors: ${errors.length}`)
  for (const [kind, count] of [...groups].sort((left, right) => right[1] - left[1])) {
    console.log(`  ${kind}: ${count}`)
    for (const issue of errors.filter((item) => item.kind === kind).slice(0, 5)) {
      console.log(`    - [${issue.slug}] ${issue.title} · ${issue.detail}`)
    }
  }

  const warningGroups = new Map()
  for (const issue of warnings) warningGroups.set(issue.kind, (warningGroups.get(issue.kind) ?? 0) + 1)
  console.log(`\nwarnings: ${warnings.length}`)
  for (const [kind, count] of [...warningGroups].sort((left, right) => right[1] - left[1])) {
    console.log(`  ${kind}: ${count}`)
    for (const issue of warnings.filter((item) => item.kind === kind).slice(0, 5)) {
      console.log(`    - [${issue.slug}] ${issue.title} · ${issue.detail}`)
    }
  }

  console.log(`\nresult: ${errors.length === 0 && (!STRICT || warnings.length === 0) ? 'PASS' : 'FAIL'}`)
}

process.exit(errors.length > 0 || (STRICT && warnings.length > 0) ? 1 : 0)
