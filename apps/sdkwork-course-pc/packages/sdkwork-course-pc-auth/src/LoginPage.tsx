import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  useAppStore,
  getIamAppSdkClient,
  readIamSessionTokens,
  persistIamSession,
  assertIamSessionTokens,
} from '@sdkwork/sdkwork-course-pc-core'

export function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setError } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setErrorLocal] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorLocal('')

    try {
      const iamClient = getIamAppSdkClient()
      const response = await iamClient.auth.sessions.create({ email, password })
      const tokens = readIamSessionTokens(response)
      assertIamSessionTokens(tokens)
      const session = persistIamSession(tokens, email)
      setUser(session.user!)
      navigate('/')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '登录失败，请稍后再试'
      setErrorLocal(message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-zinc-100">
            登录您的账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-zinc-300">
            或者{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              注册新账户
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                邮箱地址
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder-zinc-500 dark:text-zinc-100 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="邮箱地址"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder-zinc-500 dark:text-zinc-100 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="密码"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
