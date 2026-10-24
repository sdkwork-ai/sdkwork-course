// Fetch a real, category-aligned course catalog from the public Bilibili APIs.
//
// Output: database/seeds/catalog/bilibili-catalog.json
//
// The script only reads public metadata (title, cover, duration, uploader,
// multi-part chapter list). It never downloads video or image binaries: the
// player keeps using the official Bilibili iframe and the cover keeps pointing
// at the public image CDN, so cover and video always belong to the same source
// video.
//
// Usage:
//   node scripts/catalog/fetch-bilibili-catalog.mjs
//   node scripts/catalog/fetch-bilibili-catalog.mjs --per-category 30 --max-lessons 120
//
// Adjust `--per-category` to scale the seed to as many courses as the public
// catalog can supply. The resulting dataset stays fully reproducible.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { CATALOG_SPEC, COURSE_SIGNAL, SPAM_AUTHOR, SPAM_TITLE } from './catalog-spec.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT_FILE = path.join(ROOT, 'database/seeds/catalog/bilibili-catalog.json')

const args = parseArgs(process.argv.slice(2))
const PER_CATEGORY = Number(args['per-category'] ?? 20)
const MIN_LESSONS = Number(args['min-lessons'] ?? 6)
const MAX_LESSONS = Number(args['max-lessons'] ?? 120)
const MIN_TOTAL_SECONDS = Number(args['min-seconds'] ?? 1800)
const VIEW_BUDGET = Number(args['view-budget'] ?? 160)
const ONLY = args.only ? String(args.only).split(',') : null

const HEADERS = {
  Referer: 'https://www.bilibili.com',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
  28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25,
  54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

let imgKey = ''
let subKey = ''
let cookie = ''

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

function mixinKey(original) {
  return MIXIN_KEY_ENC_TAB.map((index) => original[index]).join('').slice(0, 32)
}

function signWbi(params) {
  const key = mixinKey(imgKey + subKey)
  const wts = Math.round(Date.now() / 1000)
  const query = { ...params, wts }
  const queryString = Object.keys(query)
    .sort()
    .map((name) => {
      const value = String(query[name]).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
    })
    .join('&')
  const rid = crypto.createHash('md5').update(queryString + key).digest('hex')
  return `${queryString}&w_rid=${rid}`
}

async function boot() {
  const home = await fetch('https://www.bilibili.com', { headers: HEADERS })
  const cookies = home.headers.getSetCookie?.() ?? []
  cookie = cookies.map((item) => item.split(';')[0]).join('; ')
  const nav = await requestJson('https://api.bilibili.com/x/web-interface/nav')
  // A logged-out nav returns code -101 but still ships the wbi keys.
  const navJson = nav ?? (await (await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { ...HEADERS, Cookie: cookie },
  })).json())
  const imgUrl = navJson?.data?.wbi_img?.img_url ?? ''
  const subUrl = navJson?.data?.wbi_img?.sub_url ?? ''
  imgKey = imgUrl.slice(imgUrl.lastIndexOf('/') + 1).split('.')[0]
  subKey = subUrl.slice(subUrl.lastIndexOf('/') + 1).split('.')[0]
  if (!imgKey || !subKey) throw new Error('failed to resolve bilibili wbi keys')
}

async function searchVideos(keyword, page = 1) {
  // `platform=pc` makes the anonymous search endpoint answer with a
  // `v_voucher` anti-crawl challenge for high-volume keywords, so the request
  // intentionally omits it.
  const query = signWbi({
    search_type: 'video',
    keyword,
    page: String(page),
    page_size: '30',
    order: 'totalrank',
  })
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const json = await requestJson(`https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`)
    const result = json?.data?.result
    if (Array.isArray(result) && result.length > 0) return result
    // `v_voucher` means the anonymous request hit anti-crawl verification.
    if (json?.data?.v_voucher || attempt > 0) {
      await sleep(6000 + attempt * 3000)
      await refreshSession()
      continue
    }
    await sleep(3000)
  }
  return []
}

async function refreshSession() {
  try {
    const home = await fetch('https://www.bilibili.com', { headers: HEADERS })
    const cookies = home.headers.getSetCookie?.() ?? []
    cookie = cookies.map((item) => item.split(';')[0]).join('; ')
  } catch {
    // keep the previous cookie jar
  }
}

async function fetchView(bvid) {
  const json = await requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
  return json?.data ?? null
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function displayTitle(value) {
  let title = cleanText(value)
  for (let round = 0; round < 3; round += 1) {
    const match = /^[【\[](.*?)[】\]]\s*/u.exec(title)
    if (!match) break
    if (/全\s*\d+\s*集|整整|白嫖|最新|最全|干货|合集|强推|推荐|完整版/i.test(match[1])) {
      title = title.slice(match[0].length)
      continue
    }
    break
  }
  return (title.replace(/\s*#\S+\s*$/u, '').replace(/\s+/g, ' ').trim() || cleanText(value)).slice(0, 120)
}

function normaliseTitle(value) {
  return cleanText(value)
    .replace(/[【】\[\]（）()《》<>·|｜,，.。!！?？:：'"“”‘’\-—_~、]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

// Topic keywords for tag chips: strip bracket decorations, split on
// punctuation, drop pure numbers and pure English filler.
function titleKeywords(value) {
  return cleanText(value)
    .replace(/[【】\[\]（）()《》<>]/g, ' ')
    .split(/[\s,，、|｜/·:：\-—_+]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token.length <= 12)
    .filter((token) => !/^\d+$/u.test(token))
    .filter((token) => !/^(p|第)$/iu.test(token))
}

function isTopical(spec, title) {
  if (!title || title.length < 6) return false
  if (SPAM_TITLE.test(title)) return false
  if (!spec.include.test(title)) return false
  if (spec.exclude.test(title)) return false
  return true
}

function httpsUrl(value) {
  const trimmed = cleanText(value)
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed.replace(/^http:\/\//i, 'https://')
}

function formatDurationText(seconds) {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${Math.max(1, minutes)} 分钟`
}

function difficultyFor(title, fallback) {
  if (/零基础|入门|基础|小白|新手/i.test(title)) return 'beginner'
  if (/进阶|高级|精通|深入|底层|架构/i.test(title)) return 'advanced'
  if (/实战|项目|系统|完整|全套/i.test(title)) return 'intermediate'
  return fallback
}

function buildLessonTitle(part, index) {
  const cleaned = cleanText(part)
  if (cleaned) return cleaned
  return `第 ${index + 1} 讲`
}

function sectionTitle(index, firstPart) {
  const cleaned = cleanText(firstPart).slice(0, 24)
  return cleaned ? `第 ${index + 1} 章 · ${cleaned}` : `第 ${index + 1} 章`
}

function groupPagesIntoLessons(pages) {
  const lessons = []
  pages.forEach((page, index) => {
    const duration = Number(page.duration ?? 0)
    if (!Number.isFinite(duration) || duration <= 0) return
    lessons.push({
      bvid: page.bvid ?? '',
      page: Number(page.page ?? index + 1),
      title: buildLessonTitle(page.part, lessons.length),
      duration,
    })
  })
  return lessons
}

function groupSeasonEpisodes(sections) {
  const grouped = []
  for (const section of sections ?? []) {
    const lessons = []
    for (const episode of section.episodes ?? []) {
      const duration = Number(episode.arc?.duration ?? 0)
      if (!episode.bvid || !Number.isFinite(duration) || duration <= 0) continue
      lessons.push({
        bvid: episode.bvid,
        page: 1,
        title: buildLessonTitle(episode.title, lessons.length),
        duration,
      })
    }
    if (lessons.length > 0) {
      grouped.push({ title: cleanText(section.title) || `第 ${grouped.length + 1} 章`, lessons })
    }
  }
  return grouped
}

function chunkLessons(lessons, size = 8) {
  const sections = []
  for (let index = 0; index < lessons.length; index += size) {
    const slice = lessons.slice(index, index + size)
    sections.push({ title: sectionTitle(sections.length, slice[0]?.title), lessons: slice })
  }
  return sections
}

function buildStats(stat) {
  const views = Number(stat?.view ?? 0)
  const likes = Number(stat?.like ?? 0)
  const favorites = Number(stat?.favorite ?? 0)
  const replies = Number(stat?.reply ?? 0)
  const ratio = views > 0 ? likes / views : 0
  const score = Math.min(4.9, Math.max(4.2, 4.2 + ratio * 12))
  return {
    view: views,
    like: likes,
    favorite: favorites,
    reply: replies,
    ratingScore: score.toFixed(1),
    ratingCount: Math.max(favorites, replies),
    studentCount: Math.max(0, Math.round(views * 0.25)),
  }
}

function buildPrice(index, totalSeconds) {
  if (index % 5 !== 3) {
    return { isFree: true, amount: null, originalAmount: null, currency: 'CNY' }
  }
  const hours = totalSeconds / 3600
  const amount = hours >= 40 ? '199.00' : hours >= 20 ? '129.00' : hours >= 8 ? '79.00' : '49.00'
  const original = (Number(amount) * 1.6).toFixed(2)
  return { isFree: false, amount, originalAmount: original, currency: 'CNY' }
}

function toCourse(spec, view, seed) {
  const title = cleanText(view.title)
  const owner = view.owner ?? {}
  const instructorName = cleanText(owner.name)
  // Deactivated accounts and SEO aggregators must never become instructors.
  if (!instructorName || /已注销|账号注销|已封禁/u.test(instructorName)) return null
  if (SPAM_AUTHOR.test(instructorName)) return null
  const instructorAvatar = httpsUrl(owner.face)
  const videoCover = httpsUrl(view.pic)
  const season = view.ugc_season
  const seasonSections = season ? groupSeasonEpisodes(season.sections) : []
  const seasonLessonCount = seasonSections.reduce((total, item) => total + item.lessons.length, 0)

  let sections = []
  let cover = videoCover
  let courseTitle = displayTitle(title)
  // The video title is what matched the category query, so it stays as the
  // provenance title even when the emitted course title comes from a season.
  const searchTitle = courseTitle
  let externalRef
  let sourceType = 'video'

  if (season && seasonLessonCount >= MIN_LESSONS && seasonLessonCount <= MAX_LESSONS) {
    sourceType = 'season'
    const seasonTitle = displayTitle(season.title)
    // A season header can be an unrelated playlist name such as "计划采购仓库".
    // Only adopt it when it is itself on topic for the category.
    if (seasonTitle && isTopical(spec, seasonTitle)) courseTitle = seasonTitle
    cover = httpsUrl(season.cover) || videoCover
    sections = seasonSections
    externalRef = `season-${season.id ?? view.bvid}`
  } else {
    const pages = (view.pages ?? []).map((page) => ({ ...page, bvid: view.bvid }))
    const lessons = groupPagesIntoLessons(pages)
    if (lessons.length < MIN_LESSONS || lessons.length > MAX_LESSONS) return null
    sections = chunkLessons(lessons)
    externalRef = view.bvid
  }

  const allLessons = sections.flatMap((item) => item.lessons)
  const totalSeconds = allLessons.reduce((total, lesson) => total + lesson.duration, 0)
  if (totalSeconds < MIN_TOTAL_SECONDS) return null
  if (!cover || !instructorName) return null

  const stats = buildStats(view.stat)
  const desc = cleanText(view.desc)
  const price = buildPrice(seed.index, totalSeconds)
  const summary = desc
    ? desc.slice(0, 110)
    : `${instructorName} 发布的《${courseTitle}》，共 ${allLessons.length} 讲，总时长 ${formatDurationText(totalSeconds)}。`
  const description = [
    desc ? `课程简介：${desc.slice(0, 600)}` : `课程简介：《${courseTitle}》由 ${instructorName} 发布，完整收录 ${allLessons.length} 讲内容。`,
    `课程结构：共 ${sections.length} 章 ${allLessons.length} 讲，累计时长 ${formatDurationText(totalSeconds)}，视频画面与课程封面同源。`,
    `学习方式：按章节顺序观看即可，每讲均可在课程播放器中直接播放 B 站官方视频。`,
  ].join('\n\n')

  const tags = [
    view.tname,
    ...spec.tags,
    // Topic keywords distilled from the real title. Bracket decorations and
    // uploader names are dropped so the tag chips stay clean in the UI.
    ...titleKeywords(courseTitle).slice(0, 3),
  ]
    .filter(Boolean)
    .map((tag) => cleanText(tag))
    .filter((tag) => tag.length >= 2 && tag.length <= 14)
    .filter((tag) => !/已注销|账号注销/u.test(tag))
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, 8)

  return {
    idSeed: externalRef,
    sourceType,
    bvid: view.bvid,
    searchTitle,
    sourceUrl: `https://www.bilibili.com/video/${view.bvid}`,
    title: courseTitle,
    subtitle: `${allLessons.length} 讲完整课程 · ${formatDurationText(totalSeconds)}`,
    summary,
    description,
    difficulty: difficultyFor(courseTitle, spec.difficulty),
    languageCode: 'zh-CN',
    cover,
    durationSeconds: totalSeconds,
    publishedAt: new Date(Number(view.pubdate ?? 0) * 1000).toISOString(),
    stat: { view: stats.view, like: stats.like, favorite: stats.favorite, reply: stats.reply },
    ratingScore: stats.ratingScore,
    ratingCount: stats.ratingCount,
    studentCount: stats.studentCount,
    price,
    tags,
    objectives: spec.objectives,
    audience: spec.audience,
    prerequisites: spec.prerequisites,
    instructor: {
      mid: Number(owner.mid ?? 0),
      name: instructorName,
      avatar: instructorAvatar,
      signature: desc.slice(0, 120),
    },
    sections,
  }
}

function pickCandidates(listByQuery) {
  const queues = listByQuery.map((items) =>
    items.slice().sort((left, right) => (right.play ?? 0) - (left.play ?? 0)),
  )
  const ordered = []
  const seen = new Set()
  let cursor = 0
  while (queues.some((queue) => queue.length > 0)) {
    const queue = queues[cursor % queues.length]
    cursor += 1
    if (queue.length === 0) continue
    const item = queue.shift()
    if (!item?.bvid || seen.has(item.bvid)) continue
    seen.add(item.bvid)
    ordered.push(item)
  }
  return ordered
}

async function collectCategory(spec) {
  const listByQuery = []
  for (const query of spec.queries) {
    // Search engines rarely repeat a long Chinese phrase verbatim in the video
    // title, so any meaningful query token is enough. Topicality is enforced by
    // spec.include / spec.exclude right below.
    const tokens = query
      .split(/\s+/)
      .map((token) => token.toLowerCase())
      .filter((token) => token.length >= 2)
    const results = []
    for (const page of [1, 2]) {
      const items = await searchVideos(query, page)
      results.push(...items)
      await sleep(1400)
      if (items.length < 30) break
    }
    listByQuery.push(
      results.filter((item) => {
        const title = cleanText(item.title)
        const author = cleanText(item.author)
        if (!title || title.length < 6) return false
        if (!tokens.some((token) => title.toLowerCase().includes(token))) return false
        if (!COURSE_SIGNAL.test(title)) return false
        if (SPAM_TITLE.test(title) || SPAM_AUTHOR.test(author)) return false
        if (!spec.include.test(title)) return false
        if (spec.exclude.test(title)) return false
        return true
      }),
    )
    console.log(`  search · ${query} · ${listByQuery[listByQuery.length - 1].length} usable`)
  }

  const ordered = pickCandidates(listByQuery)
  const courses = []
  const titleKeys = new Set()
  const uploaderCount = new Map()
  let attempts = 0

  for (const candidate of ordered) {
    if (courses.length >= PER_CATEGORY) break
    if (attempts >= VIEW_BUDGET) break
    attempts += 1

    const key = normaliseTitle(candidate.title)
    if (!key || titleKeys.has(key.slice(0, 22))) continue

    const view = await fetchView(candidate.bvid)
    await sleep(300)
    if (!view) continue

    const ownerMid = Number(view.owner?.mid ?? 0)
    if ((uploaderCount.get(ownerMid) ?? 0) >= 2) continue

    const course = toCourse(spec, view, { index: courses.length })
    if (!course) continue
    if (!isTopical(spec, course.title)) continue

    const courseKey = normaliseTitle(course.title)
    if (!courseKey || titleKeys.has(courseKey.slice(0, 22))) continue

    titleKeys.add(key.slice(0, 22))
    titleKeys.add(courseKey.slice(0, 22))
    uploaderCount.set(ownerMid, (uploaderCount.get(ownerMid) ?? 0) + 1)
    courses.push(course)
    console.log(
      `  + ${course.sourceType.padEnd(6)} ${course.sections.reduce((total, item) => total + item.lessons.length, 0)
        .toString()
        .padStart(3)} 讲  ${course.instructor.name.slice(0, 12).padEnd(13)} ${course.title.slice(0, 44)}`,
    )
  }

  return courses
}

async function readPreviousDataset() {
  try {
    return JSON.parse(await fs.readFile(OUT_FILE, 'utf8'))
  } catch {
    return null
  }
}

// `--only` refreshes a subset of categories. Unexplored categories and courses
// collected by earlier runs are carried over, so repeated runs deepen the
// catalog instead of replacing it.
function mergeCategoryCourses(previous, spec, courses) {
  const existing = previous?.categories?.find((item) => item.slug === spec.slug)?.courses ?? []
  const merged = new Map()
  for (const course of [...courses, ...existing]) {
    if (!course?.idSeed || merged.has(course.idSeed)) continue
    merged.set(course.idSeed, course)
  }
  return [...merged.values()].slice(0, PER_CATEGORY)
}

async function main() {
  console.log(`fetching bilibili catalog for ${CATALOG_SPEC.length} categories`)
  await boot()
  const previous = await readPreviousDataset()
  const categories = []
  for (const spec of CATALOG_SPEC) {
    if (ONLY && !ONLY.includes(spec.slug)) {
      const kept = previous?.categories?.find((item) => item.slug === spec.slug)
      if (kept) categories.push(kept)
      continue
    }
    console.log(`\n=== ${spec.label} (${spec.slug}) ===`)
    const fetched = await collectCategory(spec)
    const courses = mergeCategoryCourses(previous, spec, fetched)
    categories.push({
      categoryId: spec.categoryId,
      slug: spec.slug,
      label: spec.label,
      courses,
    })
    console.log(`  => ${courses.length} courses (${fetched.length} fetched)`)
  }

  const stats = categories.reduce(
    (total, category) => {
      const lessons = category.courses.reduce(
        (count, course) => count + course.sections.reduce((sum, item) => sum + item.lessons.length, 0),
        0,
      )
      const seconds = category.courses.reduce((count, course) => count + course.durationSeconds, 0)
      return {
        courses: total.courses + category.courses.length,
        lessons: total.lessons + lessons,
        hours: total.hours + seconds / 3600,
      }
    },
    { courses: 0, lessons: 0, hours: 0 },
  )

  const dataset = {
    schemaVersion: 1,
    kind: 'sdkwork.course.catalog',
    generatedAt: new Date().toISOString(),
    source: {
      provider: 'bilibili',
      publicVideoUrl: 'https://www.bilibili.com/video/',
      playerUrl: 'https://player.bilibili.com/player.html',
      notes:
        'Titles, covers, durations, chapters, and uploaders are read from the public Bilibili view API. Covers are the cover images of the same videos used by lesson playback.',
    },
    stats: {
      courses: stats.courses,
      lessons: stats.lessons,
      hours: Number(stats.hours.toFixed(1)),
    },
    categories,
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
  console.log(`\nwrote ${OUT_FILE}`)
  console.log(`courses=${stats.courses} lessons=${stats.lessons} hours=${stats.hours.toFixed(1)}`)
}

await main()
