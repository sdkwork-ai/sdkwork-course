import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { formatRelativeTime } from '../../utils/format'
import { EmojiPicker } from './EmojiPicker'

export type CommentSort = 'newest' | 'oldest'

export interface CommentAuthorView {
  id: string
  name: string
  avatarUrl?: string
}

export interface CommentQuoteView {
  id: string
  authorName: string
  body: string
}

export interface CommentItemView {
  id: string
  parentId?: string
  rootId?: string
  author: CommentAuthorView
  body: string
  createdAt: string
  quote?: CommentQuoteView
  replyCount?: number
  editedAt?: string
  likeCount?: number
  viewerLiked?: boolean
  rating?: number
  metadata?: Record<string, unknown>
}

export interface CommentSubmitInput {
  body: string
  parentId?: string
  quoteId?: string
}

export interface CommentThreadProps {
  title?: string
  subtitle?: string
  comments: CommentItemView[]
  totalCount?: number
  averageRating?: number
  ratingCount?: number
  currentUser: CommentAuthorView
  sort: CommentSort
  onSortChange: (sort: CommentSort) => void
  onSubmit: (input: CommentSubmitInput) => Promise<void>
  onLike?: (comment: CommentItemView) => Promise<void>
  onEdit?: (comment: CommentItemView, body: string) => Promise<void>
  onDelete?: (comment: CommentItemView) => Promise<void>
  canDelete?: (comment: CommentItemView) => boolean
  enableRating?: boolean
  rating?: number
  onRatingChange?: (rating: number) => void
  isSubmitting?: boolean
  isLoading?: boolean
  errorMessage?: string | null
  emptyTitle?: string
  emptyDescription?: string
  placeholder?: string
  className?: string
}

const MAX_LENGTH = 1000
const COLLAPSED_REPLIES = 2

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || 'U'
}

function Avatar({
  author,
  size = 'md',
}: {
  author: CommentAuthorView
  size?: 'md' | 'sm'
}) {
  const [failed, setFailed] = useState(false)
  const dimension = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'
  if (author.avatarUrl && !failed) {
    return (
      <img
        src={author.avatarUrl}
        alt={author.name}
        onError={() => setFailed(true)}
        className={cn(
          dimension,
          'shrink-0 rounded-full border border-white dark:border-slate-700! bg-slate-100 dark:bg-slate-800! object-cover shadow-sm',
        )}
      />
    )
  }
  return (
    <span
      className={cn(
        dimension,
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-sm',
      )}
      aria-hidden
    >
      {initials(author.name)}
    </span>
  )
}

function RatingStars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number
  onChange?: (rating: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`评分 ${value} 分`}>
      {[1, 2, 3, 4, 5].map((star) =>
        readOnly || !onChange ? (
          <span
            key={star}
            className={star <= value ? 'text-sm text-amber-400' : 'text-sm text-slate-200 dark:text-slate-700!'}
            aria-hidden
          >
            ★
          </span>
        ) : (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={cn(
              'text-base transition hover:scale-110',
              star <= value ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600!',
            )}
            aria-label={`${star} 星`}
          >
            ★
          </button>
        ),
      )}
    </div>
  )
}

function QuoteBlock({ quote }: { quote: CommentQuoteView }) {
  return (
    <div className="mt-2 rounded-lg border-l-2 border-slate-300 dark:border-slate-600! bg-slate-50 dark:bg-[#232326]! px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400!">
        {quote.authorName}
      </p>
      <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-slate-500 dark:text-slate-400!">
        {quote.body}
      </p>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition',
        active
          ? 'bg-slate-900 text-white dark:bg-slate-100! dark:text-slate-900!'
          : 'text-slate-500 dark:text-slate-400! hover:bg-slate-100 dark:hover:bg-slate-800! hover:text-slate-800 dark:hover:text-slate-200!',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Generic, content-agnostic comment thread.
 *
 * It only understands comment view models and callbacks, so the same surface
 * can back courses, news, documentation, or community feeds. Data loading,
 * authorization, and persistence stay in the host adapter.
 */
export function CommentThread({
  title = '讨论',
  subtitle,
  comments,
  totalCount,
  averageRating,
  ratingCount,
  currentUser,
  sort,
  onSortChange,
  onSubmit,
  onLike,
  onEdit,
  onDelete,
  canDelete,
  enableRating,
  rating,
  onRatingChange,
  isSubmitting,
  isLoading,
  errorMessage,
  emptyTitle = '还没有评论',
  emptyDescription = '成为第一个分享观点的人。',
  placeholder = '写下你的问题、笔记或想法…',
  className,
}: CommentThreadProps) {
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<CommentItemView | null>(null)
  const [mode, setMode] = useState<'reply' | 'quote'>('reply')
  const [localError, setLocalError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CommentItemView | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parentId),
    [comments],
  )
  const repliesByRoot = useMemo(() => {
    const map = new Map<string, CommentItemView[]>()
    for (const comment of comments) {
      if (!comment.parentId) continue
      const key = comment.rootId || comment.parentId
      const list = map.get(key) ?? []
      list.push(comment)
      map.set(key, list)
    }
    return map
  }, [comments])
  const byId = useMemo(
    () => new Map(comments.map((comment) => [comment.id, comment])),
    [comments],
  )

  const focusComposer = useCallback(() => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => textareaRef.current?.focus(), 120)
  }, [])

  const selectTarget = useCallback(
    (comment: CommentItemView, nextMode: 'reply' | 'quote') => {
      setTarget(comment)
      setMode(nextMode)
      setLocalError(null)
      focusComposer()
    },
    [focusComposer],
  )

  const insertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? body.length
    const end = textarea?.selectionEnd ?? body.length
    const next = `${body.slice(0, start)}${emoji}${body.slice(end)}`
    setBody(next.slice(0, MAX_LENGTH))
    window.setTimeout(() => {
      textarea?.focus()
      const position = Math.min(start + emoji.length, MAX_LENGTH)
      textarea?.setSelectionRange(position, position)
    }, 0)
  }, [body])

  const submit = async () => {
    const content = body.trim()
    if (!content || isSubmitting) return
    setLocalError(null)
    const parentId = target
      ? target.parentId
        ? target.rootId || target.parentId
        : target.id
      : undefined
    const quoteId = target && (mode === 'quote' || Boolean(target.parentId))
      ? target.id
      : undefined
    try {
      await onSubmit({ body: content, parentId, quoteId })
      setBody('')
      setTarget(null)
    } catch {
      setLocalError('发送失败，请稍后重试。')
    }
  }

  const replyLabel = target
    ? mode === 'quote'
      ? `引用 @${target.author.name}`
      : `回复 @${target.author.name}`
    : null

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 dark:border-slate-700! bg-white dark:bg-[#1C1C1E]! shadow-sm',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800! bg-white dark:bg-[#1C1C1E]! px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100!">
            {title}
            <span className="rounded-full bg-slate-100 dark:bg-slate-800! px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400!">
              {totalCount ?? comments.length}
            </span>
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500!">{subtitle}</p>
          ) : null}
          {averageRating ? (
            <div className="mt-1.5 flex items-center gap-2">
              <RatingStars value={Math.round(averageRating)} readOnly />
              <span className="text-xs font-semibold text-amber-500">
                {averageRating.toFixed(1)}
              </span>
              {ratingCount ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500!">
                  {ratingCount} 条评价
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800! p-1">
          {(['newest', 'oldest'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSortChange(value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                sort === value
                  ? 'bg-white dark:bg-[#1C1C1E]! text-slate-900 dark:text-slate-100! shadow-sm'
                  : 'text-slate-500 dark:text-slate-400! hover:text-slate-800 dark:hover:text-slate-200!',
              )}
            >
              {value === 'newest' ? '最新' : '最早'}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={composerRef}
        className="border-b border-slate-100 dark:border-slate-800! bg-gradient-to-b from-slate-50/80 to-white dark:from-[#232326] dark:to-[#1C1C1E] px-5 py-4 sm:px-6"
      >
        <div className="flex gap-3">
          <Avatar author={currentUser} />
          <div className="min-w-0 flex-1">
            {replyLabel ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-indigo-100 dark:border-indigo-900! bg-indigo-50/70 dark:bg-indigo-950/40! px-3 py-1.5 text-xs text-indigo-700 dark:text-indigo-300!">
                <span className="font-semibold">{replyLabel}</span>
                <span className="min-w-0 flex-1 truncate text-indigo-500/80 dark:text-indigo-400/80!">
                  {target?.body}
                </span>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="shrink-0 text-indigo-400 hover:text-indigo-700 dark:text-indigo-300! dark:hover:text-indigo-300!"
                  aria-label="取消回复"
                >
                  ×
                </button>
              </div>
            ) : null}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700! bg-white dark:bg-[#1C1C1E]! transition focus-within:border-indigo-300 dark:focus-within:border-indigo-700! focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/40!">
              <textarea
                ref={textareaRef}
                value={body}
                maxLength={MAX_LENGTH}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    void submit()
                  }
                }}
                rows={3}
                placeholder={placeholder}
                className="w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 py-3 text-sm leading-6 text-slate-800 dark:text-slate-100! outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500!"
              />
              {enableRating ? (
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800! px-3 py-1.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400!">评分</span>
                  <RatingStars value={rating ?? 0} onChange={onRatingChange} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800! px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <EmojiPicker onSelect={insertEmoji} disabled={isSubmitting} />
                  <span className="hidden text-[11px] text-slate-400 dark:text-slate-500! sm:inline">
                    Ctrl/⌘ + Enter 快速发送
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[11px] tabular-nums',
                      body.length > MAX_LENGTH - 100
                        ? 'text-amber-500'
                        : 'text-slate-400 dark:text-slate-500!',
                    )}
                  >
                    {body.length}/{MAX_LENGTH}
                  </span>
                  <Button
                    size="sm"
                    loading={isSubmitting}
                    disabled={!body.trim()}
                    onClick={() => void submit()}
                  >
                    发布
                  </Button>
                </div>
              </div>
            </div>
            {localError ? (
              <p className="mt-2 text-xs text-rose-500">{localError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800!">
        {isLoading ? (
          <div className="space-y-4 px-5 py-6 sm:px-6">
            {[0, 1].map((item) => (
              <div key={item} className="flex gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800!" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800!" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800!" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800!" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!isLoading && errorMessage ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500!">
            {errorMessage}
          </div>
        ) : null}
        {!isLoading && !errorMessage && rootComments.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800! text-xl">
              💬
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200!">
              {emptyTitle}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500!">{emptyDescription}</p>
          </div>
        ) : null}
        {rootComments.map((comment, index) => {
          const replies = repliesByRoot.get(comment.id) ?? []
          const visibleReplies = expanded.has(comment.id)
            ? replies
            : replies.slice(0, COLLAPSED_REPLIES)
          return (
            <article key={comment.id} className="px-5 py-4 sm:px-6">
              <div className="flex gap-3">
                <Avatar author={comment.author} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100!">
                      {comment.author.name}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500!">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                    {index === 0 && sort === 'newest' ? (
                      <span className="rounded bg-amber-50 dark:bg-amber-950/40! px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300!">
                        最新
                      </span>
                    ) : null}
                  </div>
                  {comment.rating || comment.metadata?.verifiedPurchase === true ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {comment.rating ? (
                        <RatingStars value={comment.rating} readOnly />
                      ) : null}
                      {comment.metadata?.verifiedPurchase === true ? (
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/40! px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300!">
                          已购买
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {comment.quote ? <QuoteBlock quote={comment.quote} /> : null}
                  {editingId === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editBody}
                        onChange={(event) => setEditBody(event.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-indigo-200 dark:border-indigo-800! px-3 py-2 text-sm leading-6 text-slate-700 dark:text-slate-200! outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40!"
                      />
                      <div className="mt-1 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs text-slate-500 dark:text-slate-400! hover:text-slate-700 dark:hover:text-slate-300!"
                        >
                          取消
                        </button>
                        <Button
                          size="sm"
                          loading={pendingId === comment.id}
                          disabled={!editBody.trim()}
                          onClick={() => {
                            if (!onEdit || !editBody.trim()) return
                            setPendingId(comment.id)
                            void onEdit(comment, editBody.trim())
                              .then(() => setEditingId(null))
                              .finally(() => setPendingId(null))
                          }}
                        >
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200!">
                        {comment.body}
                      </p>
                      {comment.editedAt ? (
                        <span className="mt-1 inline-block text-[10px] text-slate-400 dark:text-slate-500!">
                          已编辑
                        </span>
                      ) : null}
                    </>
                  )}
                  <div className="mt-2 flex items-center gap-1">
                    {onLike ? (
                      <ActionButton
                        active={comment.viewerLiked}
                        onClick={() => {
                          setPendingId(comment.id)
                          void onLike(comment).finally(() => setPendingId(null))
                        }}
                      >
                        {pendingId === comment.id
                          ? '处理中'
                          : `${comment.viewerLiked ? '已赞' : '赞'}${
                              comment.likeCount ? ` ${comment.likeCount}` : ''
                            }`}
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      onClick={() => selectTarget(comment, 'reply')}
                    >
                      回复
                    </ActionButton>
                    <ActionButton
                      onClick={() => selectTarget(comment, 'quote')}
                    >
                      引用
                    </ActionButton>
                    {onEdit && canDelete?.(comment) ? (
                      <ActionButton
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditBody(comment.body)
                        }}
                      >
                        编辑
                      </ActionButton>
                    ) : null}
                    {onDelete && canDelete?.(comment) ? (
                      <ActionButton
                        onClick={() => setDeleteTarget(comment)}
                      >
                        删除
                      </ActionButton>
                    ) : null}
                    {replies.length > 0 ? (
                      <span className="ml-1 text-[11px] text-slate-400 dark:text-slate-500!">
                        {replies.length} 条回复
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {replies.length > 0 ? (
                <div className="ml-12 mt-3 space-y-3 border-l-2 border-slate-100 dark:border-slate-800! pl-4">
                  {visibleReplies.map((reply) => {
                    const parentAuthor = reply.parentId
                      ? byId.get(reply.parentId)?.author.name
                      : undefined
                    return (
                      <div key={reply.id} className="flex gap-2.5">
                        <Avatar author={reply.author} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200!">
                              {reply.author.name}
                            </span>
                            {parentAuthor ? (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500!">
                                回复 @{parentAuthor}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-slate-400 dark:text-slate-500!">
                              {formatRelativeTime(reply.createdAt)}
                            </span>
                          </div>
                          {reply.quote ? (
                            <QuoteBlock quote={reply.quote} />
                          ) : null}
                          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300!">
                            {reply.body}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            {onLike ? (
                              <ActionButton
                                active={reply.viewerLiked}
                                onClick={() => {
                                  setPendingId(reply.id)
                                  void onLike(reply).finally(() =>
                                    setPendingId(null),
                                  )
                                }}
                              >
                                {reply.viewerLiked ? '已赞' : '赞'}
                                {reply.likeCount ? ` ${reply.likeCount}` : ''}
                              </ActionButton>
                            ) : null}
                            <ActionButton
                              onClick={() => selectTarget(reply, 'reply')}
                            >
                              回复
                            </ActionButton>
                            <ActionButton
                              onClick={() => selectTarget(reply, 'quote')}
                            >
                              引用
                            </ActionButton>
                            {onDelete && canDelete?.(reply) ? (
                              <ActionButton
                                onClick={() => setDeleteTarget(reply)}
                              >
                                删除
                              </ActionButton>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {replies.length > COLLAPSED_REPLIES ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current)
                          if (next.has(comment.id)) next.delete(comment.id)
                          else next.add(comment.id)
                          return next
                        })
                      }
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300!"
                    >
                      {expanded.has(comment.id)
                        ? '收起回复'
                        : `展开其余 ${replies.length - COLLAPSED_REPLIES} 条回复`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1C1C1E]! p-5 shadow-2xl">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100!">删除评论</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400!">
              删除后评论将从讨论中移除，且无法恢复。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                className="dark:border-slate-700! dark:bg-slate-800! dark:text-slate-200!"
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={pendingId === deleteTarget.id}
                onClick={() => {
                  if (!onDelete) return
                  setPendingId(deleteTarget.id)
                  void onDelete(deleteTarget)
                    .then(() => setDeleteTarget(null))
                    .finally(() => setPendingId(null))
                }}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
