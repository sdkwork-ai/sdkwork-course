import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useCourseSdk,
  extractSdkListItems,
  readEntityString,
} from '@sdkwork/sdkwork-course-pc-core'

interface CommentListProps {
  courseId: string
  targetType: 'course' | 'lesson' | 'live_session'
  targetId: string
}

export function CommentList({ courseId, targetType, targetId }: CommentListProps) {
  const queryClient = useQueryClient()
  const sdk = useCourseSdk()
  const [newComment, setNewComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: async () => sdk.courseComments.list(courseId),
  })

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      return sdk.courseComments.create(courseId, {
        targetType,
        targetId,
        content,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] })
      setNewComment('')
    },
  })

  const comments = extractSdkListItems(data).map((record) => ({
    id: readEntityString(record, 'id', 'commentId'),
    author: readEntityString(record, 'author', 'authorName', 'userName') || undefined,
    content: readEntityString(record, 'content', 'body', 'text'),
    createdAt: readEntityString(record, 'createdAt', 'created_at') || new Date().toISOString(),
  }))

  return (
    <div>
      <h3 className="font-semibold mb-4">评论 ({comments.length})</h3>

      <div className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="写下你的评论..."
          className="w-full px-3 py-2 border border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
        <button
          onClick={() => {
            if (newComment.trim()) {
              createMutation.mutate(newComment.trim())
            }
          }}
          disabled={!newComment.trim() || createMutation.isPending}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? '发送中...' : '发表评论'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 dark:text-zinc-400">加载评论中...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 dark:text-zinc-400">暂无评论，快来发表第一条评论吧</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold">
                      {comment.author?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="font-semibold text-sm">{comment.author || '匿名用户'}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700 dark:text-zinc-200">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
