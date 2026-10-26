import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ensureCommentsThread, getCommentsClient } from '@sdkwork/sdkwork-course-pc-core'

export interface LiveChatViewer {
  id: string
  name: string
  avatarUrl?: string
}

export interface LiveChatMessage {
  id: string
  /** Present only for optimistic entries not yet acknowledged by the server. */
  clientId?: string
  authorId: string
  authorName: string
  avatarUrl?: string
  body: string
  createdAt: string
  clientCreatedAt?: number
  pending?: boolean
  failed?: boolean
}

interface UseLiveChatOptions {
  liveSessionId: string
  viewer: LiveChatViewer | null
  /** Poll cadence in ms; `0` disables periodic refresh (closed rooms). */
  pollIntervalMs: number
  enabled: boolean
}

const CHAT_PAGE_SIZE = 50

export type LiveChatConnection = 'connected' | 'connecting' | 'error'

/**
 * Live-room chat over the independent comments capability. Each live session
 * owns one thread (`ownerKind: 'live-session'`); messages are listed newest
 * window first, displayed oldest → newest, kept fresh by polling, and sent
 * optimistically so typing feels instant even on a slow link.
 */
export function useLiveChat({
  liveSessionId,
  viewer,
  pollIntervalMs,
  enabled,
}: UseLiveChatOptions) {
  const threadQuery = useQuery({
    queryKey: ['live-chat-thread', liveSessionId],
    queryFn: async () =>
      ensureCommentsThread('live-session', liveSessionId),
    enabled: enabled && Boolean(liveSessionId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const threadId = threadQuery.data?.id ?? null

  const messagesQuery = useQuery({
    queryKey: ['live-chat-messages', threadId],
    queryFn: async () => {
      const page = await getCommentsClient().comments.comments.list(threadId!, {
        pageSize: CHAT_PAGE_SIZE,
        sort: 'newest',
      })
      return (page.items ?? []).filter((item) => item.status === 'published')
    },
    enabled: Boolean(threadId),
    // Explicit default: interval polls pause while the tab is hidden.
    refetchIntervalInBackground: false,
    refetchInterval: enabled && pollIntervalMs > 0 ? pollIntervalMs : false,
  })

  const [pending, setPending] = useState<LiveChatMessage[]>([])
  const [inFlight, setInFlight] = useState(0)

  const serverMessages = useMemo<LiveChatMessage[]>(() => {
    const items = messagesQuery.data ?? []
    return [...items]
      .sort(
        (a, b) =>
          (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
      )
      .map((item) => ({
        id: item.id,
        authorId: item.authorId,
        authorName: item.authorName || `用户 ${item.authorId.slice(-4)}`,
        avatarUrl: item.authorAvatarUrl,
        body: item.body,
        createdAt: item.createdAt,
      }))
  }, [messagesQuery.data])

  // Reconcile optimistic entries: once a poll carries the same message from
  // the same author, the local echo has been acknowledged and can be dropped.
  useEffect(() => {
    if (serverMessages.length === 0) return
    setPending((current) => {
      const remaining = current.filter(
        (entry) =>
          entry.failed ||
          !serverMessages.some(
            (message) =>
              message.authorId === entry.authorId && message.body === entry.body,
          ),
      )
      return remaining.length === current.length ? current : remaining
    })
  }, [serverMessages])

  const messages = useMemo(
    () => [...serverMessages, ...pending],
    [serverMessages, pending],
  )

  const send = useCallback(
    async (body: string) => {
      const text = body.trim()
      if (!threadId || !viewer || !text) return
      const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const entry: LiveChatMessage = {
        id: clientId,
        clientId,
        authorId: viewer.id,
        authorName: viewer.name,
        avatarUrl: viewer.avatarUrl,
        body: text,
        createdAt: new Date().toISOString(),
        clientCreatedAt: Date.now(),
        pending: true,
      }
      setPending((list) => [...list, entry])
      setInFlight((count) => count + 1)
      try {
        await getCommentsClient().comments.comments.create(threadId, {
          body: text,
          authorName: viewer.name,
          authorAvatarUrl: viewer.avatarUrl,
        })
      } catch {
        setPending((list) =>
          list.map((item) =>
            item.clientId === clientId
              ? { ...item, pending: false, failed: true }
              : item,
          ),
        )
      } finally {
        setInFlight((count) => Math.max(0, count - 1))
      }
    },
    [threadId, viewer],
  )

  const pendingRef = useRef<LiveChatMessage[]>([])
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  const retry = useCallback(
    (clientId: string) => {
      const entry = pendingRef.current.find((item) => item.clientId === clientId)
      if (!entry) return
      setPending((list) => list.filter((item) => item.clientId !== clientId))
      void send(entry.body)
    },
    [send],
  )

  const connection: LiveChatConnection =
    threadQuery.isError || messagesQuery.isError
      ? 'error'
      : messagesQuery.isSuccess || pending.length > 0
        ? 'connected'
        : 'connecting'

  return {
    messages,
    isSending: inFlight > 0,
    threadError:
      (threadQuery.error as Error | null) ??
      (messagesQuery.error as Error | null) ??
      null,
    /** Poll loop healthy and the thread is reachable. */
    connection,
    send,
    retry,
    refresh: () => {
      void messagesQuery.refetch()
    },
  }
}
