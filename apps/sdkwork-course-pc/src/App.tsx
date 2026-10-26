import React, { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  LogOut,
  Menu,
  Moon,
  PenLine,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react'
import {
  restoreCourseAuthState,
  useAppStore,
  CourseSdkProvider,
} from '@sdkwork/sdkwork-course-pc-core'
import { LoginPage, RegisterPage } from '@sdkwork/sdkwork-course-pc-auth'
import { CourseDetailPage, CourseListPage, HomePage } from '@sdkwork/sdkwork-course-pc-courses'
import { LessonPlayerPage } from '@sdkwork/sdkwork-course-pc-lessons'
import {
  LiveRoomPage,
  LiveSessionDetailPage,
  LiveSessionListPage,
} from '@sdkwork/sdkwork-course-pc-live'
import { MyLearningPage } from '@sdkwork/sdkwork-course-pc-progress'
import {
  StudioCourseEditorPage,
  StudioCourseListPage,
} from '@sdkwork/sdkwork-course-pc-studio'
import {
  QuestionBankPage,
  QuestionHandoutEditorPage,
  QuestionHandoutsPage,
  QuestionPaperDetailPage,
  QuestionPapersPage,
} from '@sdkwork/sdkwork-course-pc-questionbank'
import { ConsoleCourse } from '@sdkwork/course-pc-console'
import { ErrorBoundary, cn } from '@sdkwork/sdkwork-course-pc-commons'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const NAV_ITEMS = [
  { to: '/', label: '首页', end: true },
  { to: '/courses', label: '课程中心', end: false },
  { to: '/courses?kind=column', label: '专栏', end: true },
  { to: '/courses?kind=collection', label: '合集', end: true },
  { to: '/live', label: '直播', end: false },
  { to: '/questionbank', label: '题库', end: false },
]

function isNavItemActive(
  item: (typeof NAV_ITEMS)[number],
  pathname: string,
  search: string,
): boolean {
  if (item.to === '/') return pathname === '/'
  if (item.to === '/live') return pathname === '/live' || pathname.startsWith('/live/')
  if (item.to === '/questionbank') return pathname.startsWith('/questionbank')
  if (item.to.includes('kind=')) {
    if (pathname !== '/courses') return false
    const kind = new URLSearchParams(search).get('kind')
    return kind === item.to.split('kind=')[1]
  }
  if (item.to === '/courses') {
    if (!pathname.startsWith('/courses')) return false
    const kind = new URLSearchParams(search).get('kind')
    return kind !== 'column' && kind !== 'collection'
  }
  return pathname === item.to
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppStore()
  const location = useLocation()
  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }
  return <>{children}</>
}

function useCourseTheme() {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [isDark])

  return {
    isDark,
    toggleTheme: () => setTheme(isDark ? 'light' : 'dark'),
  }
}

function AppShell() {
  const { isAuthenticated, user, logout } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { isDark, toggleTheme } = useCourseTheme()

  useEffect(() => {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (location.pathname !== '/courses') setSearch('')
  }, [location.pathname])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = search.trim()
    navigate(trimmed ? `/courses?q=${encodeURIComponent(trimmed)}` : '/courses')
  }

  const fullBleedCourseSurface =
    /^\/courses\/[^/]+(?:\/play|\/learn\/[^/]+)?$/.test(location.pathname) ||
    /^\/live\/[^/]+\/room$/.test(location.pathname)

  return (
    <div className="course-app-surface flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div
          className={cn(
            'mx-auto flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8',
            fullBleedCourseSurface ? 'max-w-none' : 'max-w-[1760px]',
          )}
        >
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm shadow-indigo-600/30">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="hidden text-[15px] font-bold tracking-tight text-slate-900 sm:block">
              课程中心
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item, location.pathname, location.search)
              return (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <form onSubmit={submitSearch} className="mx-auto hidden w-full max-w-lg flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">搜索课程</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索课程、专栏、合集..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-100/80 pl-10 pr-12 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
              <button
                type="submit"
                aria-label="搜索"
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-indigo-600"
              >
                <Search className="h-4 w-4" />
              </button>
            </label>
          </form>

          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
              title={isDark ? '切换到浅色模式' : '切换到深色模式'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <ShieldCheck className="h-4 w-4" />
              运营后台
            </Link>
            <Link
              to="/studio"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <PenLine className="h-4 w-4" />
              创作者中心
            </Link>
            <Link
              to="/studio?create=1"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#fb7299] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-500/20 transition hover:bg-[#e55d83]"
            >
              <PenLine className="h-4 w-4" />
              上传课程
            </Link>
          </div>

          {isAuthenticated ? (
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {(user?.name ?? 'U').slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[96px] truncate">{user?.name ?? '同学'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {userMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                >
                  <Link
                    to="/my"
                    role="menuitem"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <BookOpen className="h-4 w-4 text-slate-400" />
                    我的学习
                  </Link>
                  <Link
                    to="/studio"
                    role="menuitem"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <PenLine className="h-4 w-4 text-slate-400" />
                    创作中心
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                注册
              </Link>
            </div>
          )}

          <button
            type="button"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 lg:hidden">
            <form onSubmit={submitSearch} className="mb-3">
              <label className="relative block">
                <span className="sr-only">搜索课程</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索课程..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-indigo-300 focus:bg-white focus:outline-none"
                />
              </label>
            </form>
            <nav className="grid gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item, location.pathname, location.search)
                return (
                  <Link
                    key={`mobile-${item.label}`}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-sm font-semibold',
                      active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <NavLink to="/studio" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                创作中心
              </NavLink>
              <NavLink to="/admin" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                运营后台
              </NavLink>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? '浅色模式' : '深色模式'}
              </button>
              {isAuthenticated ? (
                <>
                  <NavLink to="/my" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    我的学习
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Link to="/login" className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold text-slate-700">
                    登录
                  </Link>
                  <Link to="/register" className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-semibold text-white">
                    注册
                  </Link>
                </div>
              )}
            </nav>
          </div>
        ) : null}
      </header>

      <main
        className={cn(
          'w-full flex-1',
          fullBleedCourseSurface
            ? 'px-4 py-3 sm:px-6 sm:py-4 lg:px-8'
            : 'mx-auto max-w-[1760px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
        )}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/courses" element={<CourseListPage />} />
          <Route path="/courses/:courseId/play" element={<LessonPlayerPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route
            path="/courses/:courseId/learn/:lessonId"
            element={<LessonPlayerPage />}
          />
          <Route path="/live" element={<LiveSessionListPage />} />
          <Route path="/live/:id" element={<LiveSessionDetailPage />} />
          <Route path="/live/:id/room" element={<LiveRoomPage />} />
          <Route
            path="/my"
            element={
              <RequireAuth>
                <MyLearningPage />
              </RequireAuth>
            }
          />
          <Route
            path="/studio"
            element={
              <RequireAuth>
                <StudioCourseListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/studio/courses/:id"
            element={
              <RequireAuth>
                <StudioCourseEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/questionbank"
            element={
              <RequireAuth>
                <QuestionBankPage />
              </RequireAuth>
            }
          />
          <Route
            path="/questionbank/papers"
            element={
              <RequireAuth>
                <QuestionPapersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/questionbank/papers/:paperId"
            element={
              <RequireAuth>
                <QuestionPaperDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/questionbank/handouts"
            element={
              <RequireAuth>
                <QuestionHandoutsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/questionbank/handouts/:handoutId"
            element={
              <RequireAuth>
                <QuestionHandoutEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <ConsoleCourse />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1760px] flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} 课程中心 · 专业在线课程与内容运营平台</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/courses" className="hover:text-slate-800">
              课程中心
            </Link>
            <Link to="/studio" className="hover:text-slate-800">
              创作者中心
            </Link>
            <Link to="/admin" className="hover:text-slate-800">
              运营后台
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-black text-slate-200">404</p>
      <h1 className="mt-4 text-xl font-bold text-slate-900">页面不存在</h1>
      <p className="mt-2 text-sm text-slate-500">链接可能已失效，或内容已被移动。</p>
      <Link to="/" className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">
        返回首页
      </Link>
    </div>
  )
}

function App() {
  const isLoading = useAppStore((state) => state.isLoading)

  useEffect(() => {
    void restoreCourseAuthState()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm text-slate-500">正在恢复登录状态...</span>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <CourseSdkProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </QueryClientProvider>
      </CourseSdkProvider>
    </ErrorBoundary>
  )
}

export default App
