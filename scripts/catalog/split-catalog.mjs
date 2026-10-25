// Migrates the single-file catalog into the split layout.
//
// Usage:
//   node scripts/catalog/split-catalog.mjs            # split and verify
//   node scripts/catalog/split-catalog.mjs --keep-old  # keep the legacy file
//
// The split is verified before the legacy file is removed: every category must
// keep the same course order and the same totals, so nothing silently drops.

import fs from 'node:fs/promises'
import process from 'node:process'
import { CATALOG_PATHS, catalogStats, readCatalog, writeCatalog } from './catalog-store.mjs'

const args = process.argv.slice(2)
const KEEP_OLD = args.includes('--keep-old')

async function main() {
  let legacy
  try {
    legacy = JSON.parse(await fs.readFile(CATALOG_PATHS.LEGACY_FILE, 'utf8'))
  } catch {
    console.log(`${CATALOG_PATHS.LEGACY_FILE} not found; nothing to split`)
    return
  }

  const written = await writeCatalog(legacy)
  const merged = await readCatalog()

  const before = catalogStats(legacy.categories ?? [])
  const after = catalogStats(merged.categories ?? [])
  if (before.courses !== after.courses || before.lessons !== after.lessons) {
    throw new Error(
      `split verification failed: before ${before.courses}/${before.lessons} vs after ${after.courses}/${after.lessons}`,
    )
  }

  for (const category of legacy.categories ?? []) {
    const counterpart = merged.categories.find((item) => item.slug === category.slug)
    const sameOrder =
      counterpart &&
      counterpart.courses.length === category.courses.length &&
      counterpart.courses.every((course, index) => course.idSeed === category.courses[index].idSeed)
    if (!sameOrder) throw new Error(`split verification failed for category ${category.slug}`)
  }

  console.log(`split ok  ${before.courses} courses / ${before.lessons} lessons across ${merged.categories.length} files`)
  for (const category of written.index.categories) {
    console.log(
      `  categories/${category.slug}.json  ${category.stats.courses} 门 / ${category.stats.lessons} 课时`,
    )
  }

  if (KEEP_OLD) {
    console.log('legacy file kept: --keep-old')
    return
  }
  await fs.unlink(CATALOG_PATHS.LEGACY_FILE)
  console.log(`removed ${CATALOG_PATHS.LEGACY_FILE}`)
}

await main()
