import { createClient, type SdkworkAppClient } from '@sdkwork/comments-app-sdk'

import { COURSE_SESSION_CHANGED_EVENT } from './session'

interface IamSession {
  accessToken?: string
  authToken?: string
}

function readSession(): IamSession {
  try {
    const raw = globalThis.localStorage?.getItem('dsh.iam.session')
    return raw ? (JSON.parse(raw) as IamSession) : {}
  } catch {
    return {}
  }
}

function decodeClaims(token?: string): Record<string, unknown> {
  if (!token) return {}
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function resolveCommentsBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.VITE_COMMENTS_API_BASE_URL?.trim() || 'http://127.0.0.1:3900'
}

let cachedClient: SdkworkAppClient | null = null
let sessionChangeBound = false

/**
 * Drop the memoized comments client.
 *
 * The client snapshots the session's access token when it is created. After a
 * sign-out or an account switch that snapshot is stale, so the cache must be
 * cleared or the next comment is authored with the previous account's token.
 */
export function resetCommentsClient(): void {
  cachedClient = null
}

function bindCommentsSessionChangeReset(): void {
  if (sessionChangeBound) return
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  sessionChangeBound = true
  window.addEventListener(COURSE_SESSION_CHANGED_EVENT, () => {
    resetCommentsClient()
  })
}

export function getCommentsClient(): SdkworkAppClient {
  bindCommentsSessionChangeReset()
  if (cachedClient) return cachedClient
  const session = readSession()
  const claims = decodeClaims(session.accessToken)
  cachedClient = createClient({
    baseUrl: resolveCommentsBaseUrl(),
    accessToken: session.accessToken,
    authToken: session.authToken,
    tenantId: String(claims.tenant_id ?? ''),
    organizationId: String(claims.organization_id ?? '0'),
  })
  return cachedClient
}

export async function ensureCommentsThread(
  ownerKind: 'course' | 'course-lesson' | 'live-session',
  ownerId: string,
  title?: string,
): Promise<{ id: string; ownerId: string; ownerKind: string }> {
  const thread = await getCommentsClient().comments.threads.ensure({ ownerKind, ownerId, title })
  return { id: thread.id, ownerId: thread.ownerId, ownerKind: thread.ownerKind }
}
