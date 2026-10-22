import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { MobileLoginPage, MobileRegisterPage } from '@sdkwork/sdkwork-course-h5-auth'
import { useAppStore } from '@sdkwork/sdkwork-course-h5-core'
import { AuthGate } from './AuthGate'
import { COURSE_H5_ROUTES } from './routes/courseRoutes'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Course H5 render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center px-8 gap-3">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            页面渲染失败，请刷新重试
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center break-all max-w-xs">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm active:bg-blue-700"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppStore()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1C1C1E] border-t dark:border-white/10 flex justify-around py-2 z-50">
        <Link to="/course" className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-400 active:text-blue-600 dark:active:text-blue-400">
          <span className="text-lg">📚</span>
          <span>课程</span>
        </Link>
        <Link to="/course/search" className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-400 active:text-blue-600 dark:active:text-blue-400">
          <span className="text-lg">🔍</span>
          <span>搜索</span>
        </Link>
        {isAuthenticated ? (
          <Link to="/course/my" className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-400 active:text-blue-600 dark:active:text-blue-400">
            <span className="text-lg">👤</span>
            <span>我的</span>
          </Link>
        ) : (
          <Link to="/login" className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-400 active:text-blue-600 dark:active:text-blue-400">
            <span className="text-lg">👤</span>
            <span>登录</span>
          </Link>
        )}
      </nav>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <AppShell>
          <AppErrorBoundary>
          <Suspense fallback={<div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">加载中...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/course" replace />} />
              <Route path="/login" element={<MobileLoginPage />} />
              <Route path="/register" element={<MobileRegisterPage />} />
              {COURSE_H5_ROUTES.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    route.path === '/course/my' ? (
                      <ProtectedRoute>{route.element}</ProtectedRoute>
                    ) : (
                      route.element
                    )
                  }
                />
              ))}
              <Route path="*" element={<Navigate to="/course" replace />} />
            </Routes>
          </Suspense>
          </AppErrorBoundary>
        </AppShell>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
