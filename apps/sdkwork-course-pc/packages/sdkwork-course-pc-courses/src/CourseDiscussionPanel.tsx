import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, formatDate } from '@sdkwork/sdkwork-course-pc-commons'
import {
  ensureCommentsThread,
  getCommentsClient,
} from '@sdkwork/sdkwork-course-pc-core'

export interface CourseDiscussionPanelProps {
  courseId: string
  targetType: 'course' | 'lesson' | 'live_session'
  targetId: string
}

const commentsOwnerKind = {
  course: 'course',
  lesson: 'course-lesson',
  live_session: 'live-session',
} as const

/**
 * Discussion surface backed by the independent sdkwork-comments runtime and
 * generated comments App SDK.
 */
export function CourseDiscussionPanel({
  courseId,
  targetType,
  targetId,
}: CourseDiscussionPanelProps) {
  const queryClient = useQueryClient()
  const [newComment, setNewComment] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['comments', courseId, targetType, targetId],
    queryFn: async () => {
      const thread = await ensureCommentsThread(
        commentsOwnerKind[targetType],
        targetId,
        targetType === 'course' ? '课程讨论' : undefined,
      )
      const page = await getCommentsClient().comments.comments.list(thread.id, { pageSize: 100 })
      return { thread, items: page.items ?? [] }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!data?.thread.id) throw new Error('评论线程尚未准备好')
      return getCommentsClient().comments.comments.create(data.thread.id, { body: content })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', courseId] })
      setNewComment('')
    },
  })

  const comments = (data?.items ?? []).map((comment) => ({
    id: comment.id,
    author: comment.authorId || '同学',
    content: comment.body,
    createdAt: comment.createdAt,
  }))

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">学习讨论</h2>
        <span className="text-xs text-slate-400">{comments.length} 条讨论</span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <textarea
          value={newComment}
          onChange={(event) => setNewComment(event.target.value)}
          placeholder="写下你的问题、笔记或想法..."
          rows={3}
          className="w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">友善交流，课程助教会参与答疑</p>
          <Button
            size="sm"
            loading={createMutation.isPending}
            disabled={!newComment.trim()}
            onClick={() => {
              const content = newComment.trim()
              if (content) createMutation.mutate(content)
            }}
          >
            发表讨论
          </Button>
        </div>
      </div>

      {createMutation.isError ? (
        <p className="mt-3 text-xs text-rose-500">发表失败，请确认登录状态后重试。</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {isLoading ? <p className="text-sm text-slate-400">加载讨论中...</p> : null}
        {error ? <p className="text-sm text-slate-400">讨论加载失败。</p> : null}
        {!isLoading && !error && comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            还没有讨论，来写下第一条笔记吧。
          </div>
        ) : null}
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-xl border border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {comment.author.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-slate-700">{comment.author}</span>
              </div>
              <span className="text-[11px] text-slate-400">{formatDate(comment.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {comment.content}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
