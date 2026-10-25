// Fetch a real, category-aligned course catalog from the public Bilibili APIs.
//
// Output: database/seeds/catalog/bilibili-catalog.index.json (metadata + category
// order) and one file per category under database/seeds/catalog/categories/, so a
// single category can be reviewed and edited on its own.
//
// The script only reads public metadata (title, cover, duration, uploader,
// multi-part chapter list). It never downloads video or image binaries: the
// player keeps using the official Bilibili iframe and the cover keeps pointing
// at the public image CDN, so cover and video always belong to the same source
// video.
//
// Usage:
//   node scripts/catalog/fetch-bilibili-catalog.mjs
//   node scripts/catalog/fetch-bilibili-catalog.mjs --per-category 500 --pages 3
//   node scripts/catalog/fetch-bilibili-catalog.mjs --only programming,ai --per-category 300
//   node scripts/catalog/fetch-bilibili-catalog.mjs --reset-state
//   node scripts/catalog/fetch-bilibili-catalog.mjs --single-min-seconds 3600
//   node scripts/catalog/fetch-bilibili-catalog.mjs --reconsider
//
// The run is incremental and resumable:
//   - datasets from earlier runs are kept and extended, never replaced
//   - per-category JSON is flushed after every category, so Ctrl+C loses at most
//     one category of progress
//   - every view-API result is cached in bilibili-catalog.state.json, so reruns
//     do not spend quota on videos that were already accepted or rejected
//   - acceptance keys (source id + BVID) are deduplicated globally, so one video
//     never shows up in two categories
//
// Adjust `--per-category` to scale the seed to as many courses as the public
// catalog can supply. The resulting dataset stays fully reproducible.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { CATALOG_SPEC, COURSE_SIGNAL, SPAM_AUTHOR, SPAM_TITLE } from './catalog-spec.mjs'
import { CATALOG_PATHS, readCatalog, writeCatalog } from './catalog-store.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const STATE_FILE = path.join(ROOT, 'database/seeds/catalog/bilibili-catalog.state.json')

const args = parseArgs(process.argv.slice(2))
// Final number of courses kept per category. Existing courses are preserved and
// the remainder is filled by the current run.
const PER_CATEGORY = Number(args['per-category'] ?? 300)
const MIN_LESSONS = Number(args['min-lessons'] ?? 6)
const MAX_LESSONS = Number(args['max-lessons'] ?? 300)
const MIN_TOTAL_SECONDS = Number(args['min-seconds'] ?? 1800)
// A single-part video has no chapter list, but a long one is still a complete
// lesson set. This threshold decides when a one-page video counts as a course.
const SINGLE_MIN_SECONDS = Number(args['single-min-seconds'] ?? 1800)
// How many view-API calls a single category may spend in one run.
const VIEW_BUDGET = Number(args['view-budget'] ?? 900)
// Caps how many courses a single uploader may contribute per category. Most
// categories keep a small number for variety; raising it unlocks channels that
// publish dozens of full courses.
const MAX_PER_UPLOADER = Number(args['max-per-uploader'] ?? 6)
// Search pages requested for every keyword. 30 results per page on Bilibili.
const SEARCH_PAGES = Math.max(1, Number(args.pages ?? 3))
// Parallel view requests. Search stays sequential to avoid anti-crawl challenges.
const VIEW_CONCURRENCY = Math.max(1, Number(args.concurrency ?? 4))
const SEARCH_DELAY = Math.max(600, Number(args['search-delay'] ?? 1400))
const VIEW_DELAY = Math.max(100, Number(args['view-delay'] ?? 300))
const RESET_STATE = Boolean(args['reset-state'])
// Drops cached rejections so videos turned down by an older gate get another
// chance without re-spending view calls on already accepted ones.
const RECONSIDER = Boolean(args['reconsider'])
// Accounts that are deactivated, abandoned, or ask not to be followed cannot
// credit a paid catalog course.
const JUNK_AUTHOR = /已注销|账号注销|已封禁|不再更新|不要关注|停更|未命名/u
// Bilibili returns this generic TV illustration when a video or season has no
// custom cover. Storing it would render every such course as the same grey
// placeholder card, so it is treated as "no cover".
const PLACEHOLDER_COVER = /viedeo_material_default|material_default|bfs\/templar|static\.hdslb\.com/i
// A season's seed episode can be short while the whole playlist is long, so
// playlist-shaped titles bypass the duration prefilter and reach the view API.
const SEASON_HINT =
  /合集|全集|全套|完结|系列|专辑|全\s*\d+\s*[集讲期pP]|共\s*\d+\s*[集讲期]|第\s*\d+\s*[集讲期]|从入门到|系统(?:课程|教程|学习)|训练营|公开课/i
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

// Returns `{ retryable: true }` when the request never produced a JSON body
// (risk control or network), so the outcome is not cached as a permanent
// rejection. A JSON body with no `data` means the video is really unavailable.
async function fetchView(bvid) {
  const json = await requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
  if (!json) return { retryable: true }
  return { retryable: false, view: json.data ?? null }
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

// Normalise a cover URL and drop Bilibili's default placeholder image.
function realCover(value) {
  const url = httpsUrl(value)
  if (!url || PLACEHOLDER_COVER.test(url)) return ''
  return url
}

function formatDurationText(seconds) {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${Math.max(1, minutes)} 分钟`
}

// Search results report duration as "mm:ss" or "h:mm:ss" instead of seconds.
function searchDurationSeconds(value) {
  const parts = String(value ?? '')
    .trim()
    .split(':')
    .map((part) => Number(part))
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

// Small concurrency helper: runs up to `limit` mappers at a time while keeping
// the result order stable, so acceptance decisions stay deterministic.
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function readFetchState() {
  if (RESET_STATE) return { version: 1, viewed: {} }
  try {
    const parsed = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'))
    const viewed = parsed?.viewed ?? {}
    // A gate change makes old rejections stale, while accepted videos stay
    // accepted, so `--reconsider` drops only the rejected half of the cache.
    if (RECONSIDER) {
      for (const [bvid, outcome] of Object.entries(viewed)) {
        if (outcome !== 'accepted') delete viewed[bvid]
      }
    }
    return { version: 1, viewed }
  } catch {
    return { version: 1, viewed: {} }
  }
}

// The cache keeps only terminal outcomes: `accepted` videos are already in the
// dataset and `rejected` videos failed a stable gate, so neither needs another
// view-API call on the next run.
async function writeFetchState(state) {
  state.updatedAt = new Date().toISOString()
  await fs.writeFile(STATE_FILE, JSON.stringify(state), 'utf8')
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
  if (!instructorName || JUNK_AUTHOR.test(instructorName)) return null
  if (SPAM_AUTHOR.test(instructorName)) return null
  const instructorAvatar = httpsUrl(owner.face)
  const videoCover = realCover(view.pic)
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
    // Many seasons have no custom cover; the episode cover is still real.
    cover = realCover(season.cover) || videoCover
    sections = seasonSections
    externalRef = `season-${season.id ?? view.bvid}`
  } else {
    const pages = (view.pages ?? []).map((page) => ({ ...page, bvid: view.bvid }))
    const lessons = groupPagesIntoLessons(pages)
    const pageSeconds = lessons.reduce((total, lesson) => total + Number(lesson.duration ?? 0), 0)
    // One long single-part video is accepted as a course; anything else still
    // needs a real chapter list.
    const singleLongVideo = lessons.length === 1 && pageSeconds >= SINGLE_MIN_SECONDS
    if (lessons.length > MAX_LESSONS) return null
    if (lessons.length < MIN_LESSONS && !singleLongVideo) return null
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

function emptyReport(spec) {
  return {
    slug: spec.slug,
    queries: spec.queries.length,
    searchResults: 0,
    usable: 0,
    candidates: 0,
    views: 0,
    accepted: 0,
    skippedState: 0,
    skippedDuplicate: 0,
    skippedShort: 0,
    skippedGlobal: 0,
    viewFailed: 0,
    retryable: 0,
    notCourse: 0,
    offTopic: 0,
    uploaderCapped: 0,
  }
}

async function collectCategory(spec, context) {
  const { globalSeen, titleKeys, uploaderCount, state, remaining } = context
  const report = emptyReport(spec)
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
    for (let page = 1; page <= SEARCH_PAGES; page += 1) {
      const items = await searchVideos(query, page)
      results.push(...items)
      await sleep(SEARCH_DELAY)
      if (items.length < 30) break
    }
    report.searchResults += results.length
    const usable = results.filter((item) => {
      const title = cleanText(item.title)
      const author = cleanText(item.author)
      if (!title || title.length < 6) return false
      if (!tokens.some((token) => title.toLowerCase().includes(token))) return false
      if (!COURSE_SIGNAL.test(title)) return false
      if (SPAM_TITLE.test(title) || SPAM_AUTHOR.test(author)) return false
      if (!spec.include.test(title)) return false
      if (spec.exclude.test(title)) return false
      return true
    })
    report.usable += usable.length
    listByQuery.push(usable)
    console.log(`  search · ${query} · ${usable.length} usable`)
  }

  const ordered = pickCandidates(listByQuery)
  const candidates = []
  for (const candidate of ordered) {
    if (candidates.length >= VIEW_BUDGET) break
    if (!candidate?.bvid) continue
    // A cached terminal outcome means the video was already evaluated.
    if (state.viewed[candidate.bvid]) {
      report.skippedState += 1
      continue
    }
    if (globalSeen.has(`bvid:${candidate.bvid}`)) {
      report.skippedGlobal += 1
      state.viewed[candidate.bvid] = 'accepted'
      continue
    }
    const key = normaliseTitle(candidate.title)
    if (!key || titleKeys.has(key.slice(0, 22))) {
      report.skippedDuplicate += 1
      continue
    }
    const title = cleanText(candidate.title)
    const seconds = searchDurationSeconds(candidate.duration)
    // A short single clip is almost never a full course. Playlist-shaped titles
    // are kept because a season's seed episode can be short.
    if (seconds > 0 && seconds < MIN_TOTAL_SECONDS && !SEASON_HINT.test(title)) {
      report.skippedShort += 1
      continue
    }
    candidates.push(candidate)
  }
  report.candidates = candidates.length

  const courses = []
  let stopped = remaining <= 0

  for (let start = 0; start < candidates.length && !stopped; start += VIEW_CONCURRENCY) {
    const batch = candidates.slice(start, start + VIEW_CONCURRENCY)
    const views = await mapLimit(batch, VIEW_CONCURRENCY, async (candidate) => {
      const result = await fetchView(candidate.bvid)
      await sleep(VIEW_DELAY)
      return result
    })
    report.views += batch.length

    for (let index = 0; index < batch.length; index += 1) {
      if (courses.length >= remaining) {
        stopped = true
        break
      }
      const candidate = batch[index]
      const result = views[index]
      if (!result || result.retryable) {
        // Transient failure: leave the cache untouched so the next run retries.
        report.retryable += 1
        continue
      }
      const view = result.view
      if (!view) {
        report.viewFailed += 1
        state.viewed[candidate.bvid] = 'rejected'
        continue
      }

      const ownerMid = Number(view.owner?.mid ?? 0)
      if ((uploaderCount.get(ownerMid) ?? 0) >= MAX_PER_UPLOADER) {
        report.uploaderCapped += 1
        state.viewed[candidate.bvid] = 'rejected'
        continue
      }

      const course = toCourse(spec, view, { index: courses.length })
      if (!course) {
        report.notCourse += 1
        state.viewed[candidate.bvid] = 'rejected'
        continue
      }
      if (!isTopical(spec, course.title)) {
        report.offTopic += 1
        state.viewed[candidate.bvid] = 'rejected'
        continue
      }
      if (globalSeen.has(course.idSeed) || globalSeen.has(`bvid:${course.bvid}`)) {
        report.skippedGlobal += 1
        state.viewed[candidate.bvid] = 'accepted'
        continue
      }

      const courseKey = normaliseTitle(course.title)
      if (!courseKey || titleKeys.has(courseKey.slice(0, 22))) {
        report.skippedDuplicate += 1
        state.viewed[candidate.bvid] = 'rejected'
        continue
      }

      titleKeys.add(normaliseTitle(candidate.title).slice(0, 22))
      titleKeys.add(courseKey.slice(0, 22))
      globalSeen.add(course.idSeed)
      globalSeen.add(`bvid:${course.bvid}`)
      uploaderCount.set(ownerMid, (uploaderCount.get(ownerMid) ?? 0) + 1)
      state.viewed[candidate.bvid] = 'accepted'
      courses.push(course)
      console.log(
        `  + ${course.sourceType.padEnd(6)} ${course.sections.reduce((total, item) => total + item.lessons.length, 0)
          .toString()
          .padStart(3)} 讲  ${course.instructor.name.slice(0, 12).padEnd(13)} ${course.title.slice(0, 44)}`,
      )
    }

    // Flush the cache every ~100 views so an interrupted run keeps its progress
    // without rewriting the state file on every request.
    if ((start / VIEW_CONCURRENCY) % 25 === 0) await writeFetchState(state)
  }

  report.accepted = courses.length
  return { courses, report }
}

async function readPreviousDataset() {
  try {
    return await readCatalog()
  } catch {
    return null
  }
}

// Gates every stored course is re-checked against, so tightened filters also
// prune courses collected by earlier runs.
function passesStoredGates(spec, course) {
  if (!course?.idSeed) return false
  if (!isTopical(spec, course.title)) return false
  if (JUNK_AUTHOR.test(String(course.instructor?.name ?? ''))) return false
  // Older runs stored Bilibili's default placeholder cover; drop those so a
  // rerun refetches the course instead of keeping a grey card.
  if (!course.cover || PLACEHOLDER_COVER.test(String(course.cover))) return false
  // The catalog ships real multi-part courses, plus single-part videos long
  // enough to be a complete lesson set on their own.
  if (!qualifiesAsCourse(courseLessonCount(course), Number(course.durationSeconds ?? 0))) return false
  return true
}

function qualifiesAsCourse(lessonCount, totalSeconds) {
  if (lessonCount <= 0 || lessonCount > MAX_LESSONS) return false
  if (lessonCount >= MIN_LESSONS) return true
  return lessonCount === 1 && totalSeconds >= SINGLE_MIN_SECONDS
}

function courseLessonCount(course) {
  return (course?.sections ?? []).reduce((total, section) => total + (section.lessons?.length ?? 0), 0)
}

// Existing courses are kept first, then the current run's discoveries fill the
// remaining slots. Earlier runs therefore never vanish because of a rerun.
function mergeCategoryCourses(existing, fetched, limit) {
  const merged = new Map()
  for (const course of [...existing, ...fetched]) {
    if (!course?.idSeed || merged.has(course.idSeed)) continue
    merged.set(course.idSeed, course)
  }
  return [...merged.values()].slice(0, limit)
}

// One video must not appear in two categories. The first category in spec order
// keeps it; later duplicates are dropped.
function dedupeAcrossCategories(categories) {
  const seen = new Set()
  let dropped = 0
  for (const category of categories) {
    const kept = []
    for (const course of category.courses ?? []) {
      const keys = [course.idSeed, course.bvid ? `bvid:${course.bvid}` : null].filter(Boolean)
      if (keys.some((key) => seen.has(key))) {
        dropped += 1
        continue
      }
      keys.forEach((key) => seen.add(key))
      kept.push(course)
    }
    category.courses = kept
  }
  return dropped
}

// Flush the dataset after every category so an interrupted run loses at most the
// category that was in flight.
async function writeDataset(snapshotBySlug) {
  const categories = []
  for (const spec of CATALOG_SPEC) {
    const snapshot = snapshotBySlug.get(spec.slug)
    if (!snapshot) continue
    categories.push({ ...snapshot, courses: [...(snapshot.courses ?? [])] })
  }
  const dropped = dedupeAcrossCategories(categories)
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
    categories,
  }
  const result = await writeCatalog(dataset)
  return { dataset: { ...dataset, stats: result.stats }, dropped, touched: result.written }
}

async function main() {
  console.log(`fetching bilibili catalog for ${CATALOG_SPEC.length} categories`)
  await boot()
  const previous = await readPreviousDataset()
  const state = await readFetchState()
  if (RESET_STATE) console.log('fetch state reset: previously rejected videos will be re-evaluated')
  else if (RECONSIDER) console.log('fetch state: cached rejections dropped, accepted videos kept')
  const reports = []

  // Preload every dedup set from the stored dataset so a single video never
  // lands in two categories, even across separate runs. Courses that fail the
  // current gates, repeat a source id/BVID, or repeat a title inside their
  // category are pruned here, which also cleans data from earlier runs.
  const existingBySlug = new Map()
  const snapshotBySlug = new Map()
  const globalSeen = new Set()
  for (const spec of CATALOG_SPEC) {
    const raw = previous?.categories?.find((item) => item.slug === spec.slug)?.courses ?? []
    const stored = []
    const titleKeys = new Set()
    for (const course of raw) {
      if (!passesStoredGates(spec, course)) continue
      const keys = [course.idSeed, course.bvid ? `bvid:${course.bvid}` : null].filter(Boolean)
      if (keys.some((key) => globalSeen.has(key))) continue
      const titleKey = normaliseTitle(course.title).slice(0, 22)
      if (!titleKey || titleKeys.has(titleKey)) continue
      titleKeys.add(titleKey)
      keys.forEach((key) => globalSeen.add(key))
      stored.push(course)
    }
    existingBySlug.set(spec.slug, stored)
    snapshotBySlug.set(spec.slug, {
      categoryId: spec.categoryId,
      slug: spec.slug,
      label: spec.label,
      courses: stored,
    })
  }

  for (const spec of CATALOG_SPEC) {
    const existing = existingBySlug.get(spec.slug) ?? []
    if (ONLY && !ONLY.includes(spec.slug)) {
      console.log(`\n=== ${spec.label} (${spec.slug}) · kept ${existing.length} (not selected) ===`)
      continue
    }
    console.log(`\n=== ${spec.label} (${spec.slug}) · existing ${existing.length} / target ${PER_CATEGORY} ===`)

    const remaining = Math.max(0, PER_CATEGORY - existing.length)
    const titleKeys = new Set(
      existing.map((course) => normaliseTitle(course.title).slice(0, 22)).filter(Boolean),
    )
    const uploaderCount = new Map()
    for (const course of existing) {
      const mid = Number(course.instructor?.mid ?? 0)
      uploaderCount.set(mid, (uploaderCount.get(mid) ?? 0) + 1)
    }

    let report = emptyReport(spec)
    let courses = existing
    if (remaining > 0) {
      const fetched = await collectCategory(spec, {
        globalSeen,
        titleKeys,
        uploaderCount,
        state,
        remaining,
      })
      report = fetched.report
      courses = mergeCategoryCourses(existing, fetched.courses, PER_CATEGORY)
    }

    reports.push(report)
    snapshotBySlug.set(spec.slug, {
      categoryId: spec.categoryId,
      slug: spec.slug,
      label: spec.label,
      courses,
    })
    await writeFetchState(state)
    const written = await writeDataset(snapshotBySlug)
    console.log(`  => ${courses.length} courses (added ${report.accepted}, dropped ${written.dropped})`)
  }

  const written = await writeDataset(snapshotBySlug)
  if (reports.length > 0) {
    console.log('\nsupply report')
    for (const report of reports) {
      console.log(
        `  ${report.slug.padEnd(12)} accepted ${String(report.accepted).padStart(4)}` +
          ` / views ${String(report.views).padStart(5)}` +
          ` · cached ${report.skippedState} dup ${report.skippedDuplicate} short ${report.skippedShort}` +
          ` global ${report.skippedGlobal} not-course ${report.notCourse} off-topic ${report.offTopic}` +
          ` uploader ${report.uploaderCapped} failed ${report.viewFailed} retry ${report.retryable}`,
      )
    }
  }
  console.log(`\nwrote ${CATALOG_PATHS.INDEX_FILE} (+ ${CATALOG_PATHS.CATEGORY_DIR}/*.json)`)
  console.log(`files changed=${written.touched.length} (${written.touched.join(', ')})`)
  console.log(
    `courses=${written.dataset.stats.courses} lessons=${written.dataset.stats.lessons} hours=${written.dataset.stats.hours}`,
  )
  console.log(`cross-category duplicates removed=${written.dropped}`)
}

await main()
