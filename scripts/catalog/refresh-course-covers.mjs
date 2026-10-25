// Re-resolve course covers from the official Bilibili view API.
//
// Why this exists: a season (`ugc_season`) cover is sometimes Bilibili's
// default placeholder image `viedeo_material_default.png`. The uploader never
// set a season cover, but the episode itself still carries a real archive
// cover in `view.pic`. A course card must never render that placeholder, so
// this script rewrites the dataset with the official episode cover (or any
// other real candidate the API returns).
//
// It also repairs courses whose stored cover no longer matches the official
// `view.pic` / season cover, which catches stale or wrongly mapped images.
//
// Usage:
//   node scripts/catalog/refresh-course-covers.mjs          # broken/mismatched only
//   node scripts/catalog/refresh-course-covers.mjs --all    # re-resolve every course

import process from 'node:process'
import { readCatalog, writeCatalog } from './catalog-store.mjs'

const HEADERS = {
  Referer: 'https://www.bilibili.com',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

// Bilibili serves this image when a video or season has no custom cover. It is
// a generic TV illustration, never a real course cover.
const PLACEHOLDER_COVER =
  /viedeo_material_default|material_default|bfs\/templar|static\.hdslb\.com/i

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let cookie = ''

async function refreshSession() {
  try {
    const home = await fetch('https://www.bilibili.com', { headers: HEADERS })
    const cookies = home.headers.getSetCookie?.() ?? []
    cookie = cookies.map((item) => item.split(';')[0]).join('; ')
  } catch {
    // keep the previous cookie jar
  }
}

async function requestJson(url, retries = 6) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { ...HEADERS, Cookie: cookie } })
      const text = await response.text()
      if (text.startsWith('{')) {
        const json = JSON.parse(text)
        if (json.code === 0) return json
        if (json.code === -412 || json.code === -509 || json.code === -352) {
          await sleep(4000 + attempt * 2000)
          await refreshSession()
          continue
        }
        return json
      }
      await sleep(2500)
    } catch (error) {
      console.error(`  request failed: ${error.message}`)
      await sleep(2500)
    }
  }
  return null
}

function httpsUrl(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed.replace(/^http:\/\//i, 'https://')
}

function normalizeCover(value) {
  return httpsUrl(value).split('@')[0]
}

function realCover(value) {
  const url = httpsUrl(value)
  if (!url) return ''
  if (PLACEHOLDER_COVER.test(url)) return ''
  return url
}

function officialCovers(view) {
  const candidates = [view?.pic, view?.ugc_season?.cover, view?.pages?.[0]?.first_frame]
  return candidates.map(realCover).filter(Boolean)
}

async function main() {
  const args = process.argv.slice(2)
  const all = args.includes('--all')
  const dataset = await readCatalog()

  await refreshSession()

  const report = { inspected: 0, refreshed: 0, mismatched: 0, unresolved: [] }

  for (const category of dataset.categories) {
    for (const course of category.courses) {
      const stored = String(course.cover ?? '')
      const broken = !stored || PLACEHOLDER_COVER.test(stored) || !/^https:\/\//i.test(stored)
      report.inspected += 1
      if (!broken && !all) continue

      const bvid = String(course.bvid ?? '').split('?')[0]
      if (!/^BV/.test(bvid)) {
        report.unresolved.push({ idSeed: course.idSeed, reason: 'missing bvid' })
        continue
      }

      const json = await requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
      const view = json?.data
      if (!view) {
        report.unresolved.push({ idSeed: course.idSeed, reason: `view failed (${json?.code ?? 'no response'})` })
        await sleep(800)
        continue
      }

      const candidates = officialCovers(view)
      if (candidates.length === 0) {
        report.unresolved.push({ idSeed: course.idSeed, reason: 'no official cover' })
        await sleep(200)
        continue
      }

      const matched = candidates.some((url) => normalizeCover(url) === normalizeCover(stored))
      if (!matched) {
        report.mismatched += 1
        course.cover = candidates[0]
        report.refreshed += 1
        console.log(`  fixed  ${course.idSeed} | ${String(course.title).slice(0, 34)} | ${candidates[0]}`)
      } else if (broken) {
        course.cover = candidates[0]
        report.refreshed += 1
        console.log(`  fixed  ${course.idSeed} | ${String(course.title).slice(0, 34)} | ${candidates[0]}`)
      }
      await sleep(160)
    }
  }

  dataset.generatedAt = new Date().toISOString()
  const written = await writeCatalog(dataset)

  console.log('\nreport:', {
    inspected: report.inspected,
    refreshed: report.refreshed,
    mismatched: report.mismatched,
    unresolved: report.unresolved.length,
  })
  for (const item of report.unresolved) console.log(`  unresolved ${item.idSeed} | ${item.reason}`)
  console.log(`files changed: ${written.written.length ? written.written.join(', ') : 'none'}`)
}

await main()
