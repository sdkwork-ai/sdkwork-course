import { create } from 'zustand'

import { restoreCourseIamSession } from './iamSession'
import { loadCourseSession, resetCourseGlobalTokenManager, saveCourseSession } from './session'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export type CourseTheme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'sdkwork-course-theme'

function readInitialTheme(): CourseTheme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

interface AppState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  theme: CourseTheme
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setTheme: (theme: CourseTheme) => void
  logout: () => void
}

const initialSession = loadCourseSession()

export const useAppStore = create<AppState>((set) => ({
  user: initialSession?.user ?? null,
  isAuthenticated: Boolean(initialSession?.accessToken && initialSession?.authToken && initialSession?.user),
  isLoading: Boolean(initialSession),
  error: null,
  theme: readInitialTheme(),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme)
      } catch {
        // Private or hardened embeds may reject storage; the in-memory theme still applies.
      }
    }
    set({ theme })
  },
  logout: () => {
    saveCourseSession(null)
    resetCourseGlobalTokenManager()
    set({ user: null, isAuthenticated: false })
  },
}))

export async function restoreCourseAuthState(): Promise<void> {
  const session = await restoreCourseIamSession()
  useAppStore.setState({
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.accessToken && session?.authToken && session?.user),
    isLoading: false,
  })
}



