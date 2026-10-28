// Demo mock for the PC live room: canned course live-session and comments
// APIs (including an IAM current-session endpoint) so the frontend can be
// exercised without the Rust backend stack. Run with `--vite` to also spawn
// the PC dev server on port 5199 with the mock env wired in.
//
//   node scripts/mock-live-demo.mjs           # mock APIs on :18080 / :19000
//   node scripts/mock-live-demo.mjs --vite    # + vite dev server on :5199
import http from 'node:http'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'

const spawnVite = process.argv.includes('--vite')

const startedAt = Date.now()
const elapsedMs = 84 * 60 * 1000 + 12 * 1000
const liveStart = new Date(startedAt - elapsedMs).toISOString()
const liveEnd = new Date(startedAt + 46 * 60 * 1000).toISOString()

const smokeToken = (() => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '')
  const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600
  return `${b64({ alg: 'none' })}.${b64({ sub: 'user-9001', exp, tenant_id: '100001', organization_id: '0' })}.sig`
})()

const smokeUser = { id: 'user-9001', name: '冒烟同学', email: 'smoke@example.com' }

const HLS_TEST_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

const sessions = [
  {
    id: 'live-ai-agent-open-class',
    title: 'AI Agent 公开课：从提示词到可执行工作流',
    description: '从真实业务问题出发，现场拆解 Agent 的任务规划、工具调用与评测方法。',
    liveStatus: 'live',
    scheduledStartAt: liveStart,
    scheduledEndAt: liveEnd,
    actualStartAt: liveStart,
    actualEndAt: null,
    providerRoomRef: 'https://live.bilibili.com/6',
    attendeeCountSnapshot: 1280,
    status: 'active',
    courseId: 'course-ai-agent-development',
    metadata: { instructorName: '平台讲师', playbackUrl: HLS_TEST_STREAM },
  },
  {
    id: 'live-ai-productivity-workshop',
    title: 'AI 效率工作坊：把重复工作交给工作流',
    description: '带着一个真实重复任务来，现场完成信息采集、整理与自动分发的闭环。',
    liveStatus: 'scheduled',
    scheduledStartAt: new Date(startedAt + 26 * 3600 * 1000).toISOString(),
    scheduledEndAt: new Date(startedAt + 27.5 * 3600 * 1000).toISOString(),
    actualStartAt: null,
    actualEndAt: null,
    providerRoomRef: 'https://live.bilibili.com/6',
    attendeeCountSnapshot: 0,
    status: 'active',
    courseId: 'course-column-ai-productivity',
    metadata: { instructorName: '林知远' },
  },
  {
    id: 'live-ai-engineer-career',
    title: 'AI 工程师职业路径答疑：作品集与面试准备',
    description: '围绕 AI 应用工程师的能力栈、项目作品集和面试问题做一次完整答疑。',
    liveStatus: 'replay_ready',
    scheduledStartAt: new Date(startedAt - 72 * 3600 * 1000).toISOString(),
    scheduledEndAt: new Date(startedAt - 70.5 * 3600 * 1000).toISOString(),
    actualStartAt: new Date(startedAt - 72 * 3600 * 1000).toISOString(),
    actualEndAt: new Date(startedAt - 70.5 * 3600 * 1000).toISOString(),
    providerRoomRef: 'https://live.bilibili.com/6',
    attendeeCountSnapshot: 6420,
    status: 'active',
    courseId: 'course-collection-ai-engineer',
    metadata: {},
  },
]

const commentStore = [
  { id: 'c-1', threadId: 'thread-live-1', authorId: 'user-1001', authorName: '林小满', body: '老师好！刚从后端转过来学 Agent，今天的课太及时了', status: 'published', createdAt: new Date(startedAt - 9 * 60 * 1000).toISOString() },
  { id: 'c-2', threadId: 'thread-live-1', authorId: 'user-1002', authorName: '陈默', body: '工具调用那部分能再举个例子吗？', status: 'published', createdAt: new Date(startedAt - 5 * 60 * 1000).toISOString() },
  { id: 'c-3', threadId: 'thread-live-1', authorId: 'instructor-1', authorName: '平台讲师', body: '没问题，讲到 4.3 节会现场演示一次完整的工具编排', status: 'published', createdAt: new Date(startedAt - 3 * 60 * 1000).toISOString() },
]

const send = (res, status, payload) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  })
  res.end(JSON.stringify(payload))
}
const ok = (res, data) => send(res, 200, { code: 0, data, traceId: crypto.randomUUID() })

const guarded = (handler) => (req, res) => {
  try {
    handler(req, res)
  } catch (error) {
    try {
      send(res, 500, { code: 5000, traceId: crypto.randomUUID(), detail: String(error) })
    } catch {
      /* response already closed */
    }
  }
}

const readBody = (req, callback) => {
  let raw = ''
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    try {
      callback(raw)
    } catch (error) {
      send(res2(req), 500, { code: 5000, traceId: crypto.randomUUID(), detail: String(error) })
    }
  })
}
const res2 = (req) => req.__res

const courseServer = http.createServer(
  guarded((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname
    if (req.method === 'OPTIONS') return send(res, 204, {})
    if (path === '/app/v3/api/course_live_sessions') {
      return ok(res, { items: sessions, pageInfo: { mode: 'offset', page: 1, pageSize: 20, totalItems: sessions.length } })
    }
    const detail = path.match(/^\/app\/v3\/api\/course_live_sessions\/([^/]+)$/)
    if (detail) {
      const session = sessions.find((item) => item.id === decodeURIComponent(detail[1]))
      return session ? ok(res, session) : send(res, 404, { code: 40401, traceId: crypto.randomUUID() })
    }
    const command = path.match(/^\/app\/v3\/api\/course_live_sessions\/([^/]+)\/(join|heartbeat|leave)$/)
    if (command) return ok(res, { accepted: true, status: command[2] === 'leave' ? 'left' : 'joined' })
    if (path.match(/^\/app\/v3\/api\/course_live_sessions\/([^/]+)\/replay$/)) return ok(res, {})
    if (path === '/app/v3/api/auth/sessions/current') {
      return ok(res, { item: { accessToken: smokeToken, authToken: smokeToken, refreshToken: smokeToken, user: smokeUser } })
    }
    send(res, 404, { code: 40401, traceId: crypto.randomUUID() })
  }),
)

const commentsServer = http.createServer((req, res) => {
  req.__res = res
  readBody(req, (raw) => {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname
    if (req.method === 'OPTIONS') return send(res, 204, {})
    if (path === '/app/v3/api/comments/threads/ensure') {
      return ok(res, { id: 'thread-live-1', ownerId: 'x', ownerKind: 'live-session' })
    }
    const list = path.match(/^\/app\/v3\/api\/comments\/threads\/([^/]+)\/comments$/)
    if (list && req.method === 'GET') {
      const items = commentStore
        .filter((item) => item.threadId === decodeURIComponent(list[1]))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      return ok(res, { items, pageInfo: { mode: 'offset', page: 1, pageSize: 50, totalItems: items.length } })
    }
    if (list && req.method === 'POST') {
      const body = JSON.parse(raw || '{}')
      const payload = (() => {
        try {
          const token = String(req.headers['access-token'] ?? '')
          return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'))
        } catch { return {} }
      })()
      const item = {
        id: `c-${crypto.randomUUID().slice(0, 8)}`,
        threadId: decodeURIComponent(list[1]),
        authorId: String(payload.sub ?? 'anon'),
        authorName: body.authorName ?? '同学',
        body: String(body.body ?? ''),
        status: 'published',
        createdAt: new Date().toISOString(),
      }
      commentStore.push(item)
      return ok(res, item)
    }
    send(res, 404, { code: 40401, traceId: crypto.randomUUID() })
  })
})

process.on('uncaughtException', (error) => console.error('uncaught:', String(error).slice(0, 200)))
process.on('unhandledRejection', (error) => console.error('rejection:', String(error).slice(0, 200)))

courseServer.listen(18080, () => console.log('mock course api on :18080'))
commentsServer.listen(19000, '127.0.0.1', () => console.log('mock comments api on :19000'))

if (spawnVite) {
  const child = spawn(
    'pnpm',
    ['--filter', '@sdkwork/sdkwork-course-pc', 'exec', 'vite', '--port', '5199', '--strictPort'],
    {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://127.0.0.1:18080',
        VITE_COMMENTS_API_BASE_URL: 'http://127.0.0.1:19000',
      },
    },
  )
  child.on('exit', (code) => console.log(`vite exited with ${code}`))
  const shutdown = () => {
    child.kill()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
