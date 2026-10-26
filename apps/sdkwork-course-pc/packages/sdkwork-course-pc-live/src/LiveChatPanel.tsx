import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn, formatCompactCount } from '@sdkwork/sdkwork-course-pc-commons'
import {
  formatChatClock,
  type LiveSessionView,
} from './liveRoomModel'
import type { LiveChatMessage, LiveChatViewer } from './useLiveChat'

export interface LiveHeart {
  id: number
  drift: number
}

interface LiveChatPanelProps {
  session: LiveSessionView
  messages: LiveChatMessage[]
  viewer: LiveChatViewer | null
  canChat: boolean
  disabledReason: string
  loginHref: string
  viewerCount: number
  connection: 'connected' | 'connecting' | 'error'
  isSending: boolean
  onSend: (body: string) => void
  onRetry: (clientId: string) => void
  onRefresh: () => void
  likeCount: number
  hearts: LiveHeart[]
  onLike: () => void
  className?: string
}

const QUICK_PHRASES = ['老师讲得真好', '这里能再讲一遍吗', '打卡了', '666', '求资料']

const CONNECTION_META: Record<
  'connected' | 'connecting' | 'error',
  { label: string; dotClass: string; textClass: string }
> = {
  connected: { label: '已连接', dotClass: 'bg-emerald-400', textClass: 'text-emerald-300' },
  connecting: { label: '连接中', dotClass: 'bg-amber-300 animate-pulse', textClass: 'text-amber-200' },
  error: { label: '已断开', dotClass: 'bg-slate-500', textClass: 'text-slate-400' },
}

function initials(name: string): string {
  return (name.trim() || '同').slice(0, 1).toUpperCase()
}

function avatarHue(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 17 + id.charCodeAt(index)) % 360
  }
  return hash
}

/**
 * Douyin-PC-style live chat dock: header with online count and connection
 * state, auto-scrolling message list with bottom pinning, quick phrases,
 * free-text input (Enter to send, Shift+Enter for newline), and the floating
 * hearts like interaction.
 */
export function LiveChatPanel({
  session,
  messages,
  viewer,
  canChat,
  disabledReason,
  loginHref,
  viewerCount,
  connection,
  isSending,
  onSend,
  onRetry,
  onRefresh,
  likeCount,
  hearts,
  onLike,
  className,
}: LiveChatPanelProps) {
  const [input, setInput] = useState('')
  const [pinnedToBottom, setPinnedToBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const seenCountRef = useRef(0)

  const connectionMeta = CONNECTION_META[connection]

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || !canChat || isSending) return
    onSend(text)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value)
    const element = event.target
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 96)}px`
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handleScroll = () => {
    const element = listRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    setPinnedToBottom(distance < 80)
  }

  const lastMessage = useMemo(() => messages[messages.length - 1], [messages])

  // While scrolled away from the bottom, count arrivals; reset on return.
  useEffect(() => {
    if (pinnedToBottom) {
      seenCountRef.current = messages.length
      setUnreadCount(0)
      return
    }
    setUnreadCount(Math.max(0, messages.length - seenCountRef.current))
  }, [messages.length, pinnedToBottom])

  useEffect(() => {
    const element = listRef.current
    if (!element || !pinnedToBottom) return
    element.scrollTop = element.scrollHeight
  }, [messages.length, pinnedToBottom, lastMessage?.id])

  return (
    <section
      aria-label="直播互动"
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-900/5 bg-slate-950 text-slate-100 shadow-sm',
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 bg-slate-900/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden />
          <h2 className="text-sm font-bold text-white">实时互动</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
            {formatCompactCount(viewerCount)} 人在线
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <span className={cn('h-1.5 w-1.5 rounded-full', connectionMeta.dotClass)} aria-hidden />
          <span className={connectionMeta.textClass}>{connectionMeta.label}</span>
          {connection === 'error' ? (
            <button
              type="button"
              onClick={onRefresh}
              className="ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-indigo-300 transition hover:bg-white/10 hover:text-indigo-200"
            >
              重连
            </button>
          ) : null}
        </div>
      </header>

      {/* Room notice */}
      <div className="border-b border-white/5 bg-indigo-500/10 px-4 py-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-200">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-400 text-[10px] font-bold text-slate-950" aria-hidden>
            公
          </span>
          欢迎来到直播间，请文明发言，共同维护学习氛围
        </p>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-label="聊天消息列表"
        className="live-chat-scroll relative flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-3xl" aria-hidden>
              💬
            </span>
            <p className="text-sm font-semibold text-slate-300">还没有人发言</p>
            <p className="text-xs text-slate-500">发句「老师好」打个招呼，开启这场直播的讨论</p>
          </div>
        ) : null}

        {messages.map((message) => {
          const own = Boolean(viewer && message.authorId === viewer.id)
          const instructor =
            Boolean(session.instructorName) && message.authorName === session.instructorName
          return (
            <div
              key={message.id}
              className={cn('live-message-in flex gap-2', own ? 'flex-row-reverse' : '')}
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{
                  backgroundImage: `linear-gradient(135deg, hsl(${avatarHue(message.authorId)} 65% 48%), hsl(${(avatarHue(message.authorId) + 40) % 360} 70% 36%))`,
                }}
              >
                {initials(message.authorName)}
              </span>
              <div className={cn('max-w-[78%]', own ? 'items-end text-right' : '')}>
                <div className={cn('flex items-center gap-1.5', own ? 'justify-end' : '')}>
                  {!own ? (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {message.authorName}
                    </span>
                  ) : null}
                  {instructor ? (
                    <span className="rounded-sm bg-gradient-to-r from-amber-400 to-orange-500 px-1 py-px text-[9px] font-bold text-slate-950">
                      讲师
                    </span>
                  ) : null}
                  {own ? (
                    <span className="text-[11px] font-semibold text-indigo-300">我</span>
                  ) : null}
                  <span className="text-[10px] text-slate-600">{formatChatClock(message.createdAt)}</span>
                </div>
                <div
                  className={cn(
                    'mt-1 inline-block break-words rounded-2xl px-3 py-1.5 text-left text-[13px] font-medium leading-relaxed',
                    own
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm bg-white/5 text-slate-200',
                    message.pending ? 'opacity-60' : '',
                    message.failed ? 'border border-rose-500/60 bg-rose-500/10 text-rose-200' : '',
                  )}
                >
                  {message.body}
                </div>
                {message.pending ? (
                  <p className="mt-0.5 text-[10px] text-slate-500">发送中…</p>
                ) : null}
                {message.failed ? (
                  <button
                    type="button"
                    onClick={() => onRetry(message.clientId ?? message.id)}
                    className="mt-0.5 text-[10px] font-semibold text-rose-300 underline-offset-2 hover:underline"
                  >
                    发送失败，点击重试
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Jump to latest */}
      {!pinnedToBottom && messages.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const element = listRef.current
              if (element) element.scrollTop = element.scrollHeight
              setPinnedToBottom(true)
            }}
            className="absolute -top-9 right-4 inline-flex items-center gap-1.5 rounded-full bg-slate-800/95 px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-lg shadow-black/30 ring-1 ring-white/10 transition hover:bg-slate-700"
          >
            回到底部
            {unreadCount > 0 ? (
              <span className="min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14m0 0-6-6m6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Composer */}
      <footer className="border-t border-white/5 bg-slate-900/70 px-4 pb-3 pt-2.5">
        {canChat ? (
          <>
            <div className="live-chat-scroll mb-2 flex gap-2 overflow-x-auto pb-0.5">
              {QUICK_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => {
                    setInput(phrase)
                    inputRef.current?.focus()
                  }}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {phrase}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-inner">
              <label className="sr-only" htmlFor="live-chat-input">
                发送直播弹幕消息
              </label>
              <textarea
                id="live-chat-input"
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="发句友善的话与大家互动…（Enter 发送，Shift+Enter 换行）"
                rows={1}
                maxLength={200}
                aria-describedby={input.length > 160 ? 'live-chat-input-limit' : undefined}
                className="live-chat-scroll max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-slate-600"
              />
              {input.length > 160 ? (
                <span
                  id="live-chat-input-limit"
                  className={cn(
                    'shrink-0 self-end pb-1 text-[10px] font-medium',
                    input.length >= 200 ? 'text-rose-400' : 'text-slate-500',
                  )}
                >
                  {input.length}/200
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || isSending}
                aria-label="发送消息"
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                  input.trim() && !isSending
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500'
                    : 'bg-white/10 text-slate-500',
                )}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M3.4 20.4 21 12 3.4 3.6l.01 6.53L15 12l-11.59 1.87-.01 6.53Z" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5">
            <p className="text-xs text-slate-400">{disabledReason}</p>
            {loginHref ? (
              <a
                href={loginHref}
                className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                去登录
              </a>
            ) : null}
          </div>
        )}

        {/* Like interaction row */}
        <div className="mt-2.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            实时通道刷新中
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={onLike}
              aria-label="为直播点赞"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-red-500 text-white shadow-lg shadow-red-500/25 transition-transform hover:scale-105 active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                <path d="M12 21s-7.5-4.7-10-9.3C.4 8.9 2.4 5.5 5.9 5.1c2-.2 3.9.8 5.1 2.4h2c1.2-1.6 3.1-2.6 5.1-2.4 3.5.4 5.5 3.8 3.9 6.6C19.5 16.3 12 21 12 21Z" />
              </svg>
            </button>
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-slate-800 px-1 text-center text-[10px] font-bold text-white ring-1 ring-white/15">
              {likeCount > 99 ? '99+' : likeCount}
            </span>
            <div aria-hidden className="pointer-events-none absolute bottom-10 right-1 h-44 w-12">
              {hearts.map((heart) => (
                <span
                  key={heart.id}
                  className="live-heart"
                  style={{ '--live-heart-drift': `${heart.drift}px` } as React.CSSProperties}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-rose-500 drop-shadow-lg" aria-hidden>
                    <path d="M12 21s-7.5-4.7-10-9.3C.4 8.9 2.4 5.5 5.9 5.1c2-.2 3.9.8 5.1 2.4h2c1.2-1.6 3.1-2.6 5.1-2.4 3.5.4 5.5 3.8 3.9 6.6C19.5 16.3 12 21 12 21Z" />
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </section>
  )
}
