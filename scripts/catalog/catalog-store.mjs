// Storage layout for the Bilibili course catalog.
//
// A single 35 MB JSON file is hard to review, diff, and fine-tune. The catalog is
// therefore stored as one small index plus one file per category, so editing a
// course in `programming` never touches `ai`, `data`, or the other categories.
//
//   database/seeds/catalog/bilibili-catalog.index.json
//   database/seeds/catalog/categories/programming.json
//   database/seeds/catalog/categories/ai.json
//   ...
//
// The index keeps the source metadata and the category order; every category file
// keeps its own courses. `readCatalog` merges both back into the single dataset
// shape that the seed generator, the audit, and the cover refresher already use.

import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CATALOG_DIR = path.join(ROOT, 'database/seeds/catalog')
const INDEX_FILE = path.join(CATALOG_DIR, 'bilibili-catalog.index.json')
const CATEGORY_DIR = path.join(CATALOG_DIR, 'categories')
// The pre-split single file. `split-catalog.mjs` migrates it once and removes it.
const LEGACY_FILE = path.join(CATALOG_DIR, 'bilibili-catalog.json')

export const CATALOG_PATHS = { CATALOG_DIR, INDEX_FILE, CATEGORY_DIR, LEGACY_FILE }

export function categoryFile(slug) {
  return path.join(CATEGORY_DIR, `${slug}.json`)
}

export function catalogStats(categories) {
  const totals = categories.reduce(
    (total, category) => {
      const courses = category.courses ?? []
      const lessons = courses.reduce(
        (count, course) =>
          count +
          (course.sections ?? []).reduce((sum, section) => sum + (section.lessons?.length ?? 0), 0),
        0,
      )
      const seconds = courses.reduce((count, course) => count + Number(course.durationSeconds ?? 0), 0)
      return {
        courses: total.courses + courses.length,
        lessons: total.lessons + lessons,
        hours: total.hours + seconds / 3600,
      }
    },
    { courses: 0, lessons: 0, hours: 0 },
  )
  return {
    courses: totals.courses,
    lessons: totals.lessons,
    hours: Math.round(totals.hours * 10) / 10,
  }
}

// Rebuilds the pre-split dataset shape: `{ schemaVersion, kind, generatedAt,
// source, stats, categories: [{ categoryId, slug, label, courses }] }`.
export async function readCatalog() {
  const index = JSON.parse(await fs.readFile(INDEX_FILE, 'utf8'))
  const categories = []
  for (const entry of index.categories ?? []) {
    const relative = entry.file ?? `categories/${entry.slug}.json`
    const parsed = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, relative), 'utf8'))
    categories.push({
      categoryId: parsed.categoryId ?? entry.categoryId,
      slug: entry.slug,
      label: parsed.label ?? entry.label,
      courses: parsed.courses ?? [],
    })
  }
  return {
    schemaVersion: index.schemaVersion ?? 1,
    kind: index.kind ?? 'sdkwork.course.catalog',
    generatedAt: index.generatedAt,
    source: index.source,
    stats: catalogStats(categories),
    categories,
  }
}

export async function hasSplitCatalog() {
  try {
    await fs.access(INDEX_FILE)
    return true
  } catch {
    return false
  }
}

export async function hasLegacyCatalog() {
  try {
    await fs.access(LEGACY_FILE)
    return true
  } catch {
    return false
  }
}

// Writes the index and every category file. Files whose content did not change
// are left untouched so a rerun produces an empty git diff.
export async function writeCatalog(dataset) {
  await fs.mkdir(CATEGORY_DIR, { recursive: true })
  const written = []
  const unchanged = []

  for (const category of dataset.categories ?? []) {
    const file = categoryFile(category.slug)
    const payload = {
      schemaVersion: dataset.schemaVersion ?? 1,
      categoryId: category.categoryId,
      slug: category.slug,
      label: category.label,
      stats: catalogStats([category]),
      courses: category.courses ?? [],
    }
    const changed = await writeIfChanged(file, payload)
    ;(changed ? written : unchanged).push(category.slug)
  }

  const index = {
    schemaVersion: dataset.schemaVersion ?? 1,
    kind: dataset.kind ?? 'sdkwork.course.catalog',
    generatedAt: dataset.generatedAt ?? new Date().toISOString(),
    source: dataset.source,
    stats: catalogStats(dataset.categories ?? []),
    categories: (dataset.categories ?? []).map((category) => ({
      categoryId: category.categoryId,
      slug: category.slug,
      label: category.label,
      file: `categories/${category.slug}.json`,
      stats: catalogStats([category]),
    })),
  }
  const indexChanged = await writeIfChanged(INDEX_FILE, index)
  ;(indexChanged ? written : unchanged).push('index')

  return { index, written, unchanged, stats: index.stats }
}

async function writeIfChanged(file, payload) {
  const next = `${JSON.stringify(payload, null, 2)}\n`
  try {
    const current = await fs.readFile(file, 'utf8')
    if (current === next) return false
  } catch {
    // first write
  }
  await fs.writeFile(file, next, 'utf8')
  return true
}
