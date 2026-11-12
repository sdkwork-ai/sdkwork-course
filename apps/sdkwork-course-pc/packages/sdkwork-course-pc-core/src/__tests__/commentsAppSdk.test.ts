import { COURSE_SESSION_CHANGED_EVENT } from '../session'
import { getCommentsClient, resetCommentsClient } from '../commentsAppSdk'

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size
    },
  }
}

const localStorageStub = createStorage()
const sessionStorageStub = createStorage()
const windowListeners = new Map<string, Set<() => void>>()

function setSessionToken(token: string | null): void {
  if (token === null) {
    localStorageStub.removeItem('dsh.iam.session')
    return
  }
  localStorageStub.setItem('dsh.iam.session', JSON.stringify({ accessToken: token }))
}

function emitSessionChanged(): void {
  for (const listener of windowListeners.get(COURSE_SESSION_CHANGED_EVENT) ?? []) {
    listener()
  }
}

function accessTokenOf(client: ReturnType<typeof getCommentsClient>): string | undefined {
  return client.http.getConfig().accessToken
}

beforeAll(() => {
  const globals = globalThis as unknown as Record<string, unknown>
  globals.localStorage = localStorageStub
  if (typeof globals.CustomEvent === 'undefined') {
    globals.CustomEvent = class CustomEvent {
      readonly type: string
      readonly detail: unknown
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type
        this.detail = init?.detail
      }
    }
  }
  globals.window = {
    addEventListener: (type: string, listener: () => void) => {
      const listeners = windowListeners.get(type) ?? new Set()
      listeners.add(listener)
      windowListeners.set(type, listeners)
    },
    removeEventListener: (type: string, listener: () => void) => {
      windowListeners.get(type)?.delete(listener)
    },
    dispatchEvent: () => true,
    localStorage: localStorageStub,
    sessionStorage: sessionStorageStub,
  }
})

beforeEach(() => {
  resetCommentsClient()
  localStorageStub.clear()
  sessionStorageStub.clear()
})

describe('comments client session lifecycle', () => {
  it('reuses the cached client while the session is unchanged', () => {
    setSessionToken('token-a')

    const first = getCommentsClient()
    const second = getCommentsClient()

    expect(second).toBe(first)
    expect(accessTokenOf(second)).toBe('token-a')
  })

  it('rebuilds the client with the new token after reset', () => {
    setSessionToken('token-a')
    const first = getCommentsClient()

    setSessionToken('token-b')
    resetCommentsClient()
    const second = getCommentsClient()

    expect(second).not.toBe(first)
    expect(accessTokenOf(second)).toBe('token-b')
  })

  it('rebuilds the client when the course session changes', () => {
    setSessionToken('token-a')
    const first = getCommentsClient()

    setSessionToken('token-b')
    emitSessionChanged()
    const second = getCommentsClient()

    expect(second).not.toBe(first)
    expect(accessTokenOf(second)).toBe('token-b')
  })

  it('drops the old client when the app store logs out', async () => {
    setSessionToken('token-a')
    const first = getCommentsClient()

    const { useAppStore } = await import('../store')
    useAppStore.getState().logout()

    const signedOut = getCommentsClient()
    // A new client instance is only possible because logout reset the cache.
    expect(signedOut).not.toBe(first)

    setSessionToken('token-b')
    emitSessionChanged()
    const signedInAgain = getCommentsClient()
    expect(signedInAgain).not.toBe(signedOut)
    expect(accessTokenOf(signedInAgain)).toBe('token-b')
  })
})
