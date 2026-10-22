import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CommentThread,
  type CommentItemView,
  type CommentSort,
} from '@sdkwork/sdkwork-course-pc-commons'
import {
  ensureCommentsThread,
  getCommentsClient,
  useAppStore,
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

const targetTitle = {
  course: '课程讨论',
  lesson: '课时讨论',
  live_session: '直播讨论',
} as const

/**
 * Course adapter for the generic CommentThread surface. All persistence and
 * authorization stay in the independent comments capability.
 */
export function CourseDiscussionPanel({
  courseId,
  targetType,
  targetId,
}: CourseDiscussionPanelProps) {
  const queryClient = useQueryClient()
  const user = useAppStore((state) => state.user)
  const [sort, setSort] = useState<CommentSort>('newest')

  const currentUser = {
    id: user?.id ?? 'guest',
    name: user?.name?.trim() || '同学',
    avatarUrl: user?.avatar,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['comments', courseId, targetType, targetId, sort],
    queryFn: async () => {
      const thread = await ensureCommentsThread(
        commentsOwnerKind[targetType],
        targetId,
        targetType === 'course' ? '课程讨论' : undefined,
      )
      const page = await getCommentsClient().comments.comments.list(thread.id, {
        pageSize: 200,
        sort,
      })
      return { thread, items: page.items ?? [], totalCount: Number(page.pageInfo?.totalItems ?? page.items?.length ?? 0) }
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: {
      body: string
      parentId?: string
      quoteId?: string
    }) => {
      if (!data?.thread.id) throw new Error('评论线程尚未准备好')
      return getCommentsClient().comments.comments.create(data.thread.id, {
        body: input.body,
        parentId: input.parentId,
        quoteId: input.quoteId,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments', courseId, targetType, targetId],
      })
    },
  })

  const comments: CommentItemView[] = (data?.items ?? []).map((comment) => ({    id: comment.id,
    parentId: comment.parentId,
    rootId: comment.rootId,
    author: {
      id: comment.authorId,
      name:
        comment.authorName ||
        `用户 ${comment.authorId.slice(-4)}`,
      avatarUrl: comment.authorAvatarUrl,
    },
    body: comment.body,
    createdAt: comment.createdAt,
    replyCount: comment.replyCount,
    editedAt: comment.editedAt,
    likeCount: comment.likeCount,
    viewerLiked: comment.viewerLiked,
    rating: comment.rating,
    metadata: comment.metadata,
    quote: comment.quote
      ? {
          id: comment.quote.id,
          authorName:
            comment.quote.authorName ||
            `用户 ${comment.quote.authorId.slice(-4)}`,
          body: comment.quote.body,
        }
      : undefined,
  }))

  return (
    <CommentThread
      title="学习讨论"
      subtitle="分享笔记、提出问题，也欢迎回复和引用其他同学的观点。"
      comments={comments}
      totalCount={data?.totalCount ?? comments.length}
      currentUser={currentUser}
      sort={sort}
      onSortChange={setSort}
      onSubmit={async (input) => {
        await createMutation.mutateAsync(input)
      }}
      onLike={async (comment) => {
        const client = getCommentsClient()
        if (comment.viewerLiked) {
          await client.comments.reactions.delete(comment.id, 'like')
        } else {
          await client.comments.reactions.update(comment.id, 'like')
        }
        await queryClient.invalidateQueries({
          queryKey: ['comments', courseId, targetType, targetId],
        })
      }}
      onEdit={async (comment, body) => {
        await getCommentsClient().comments.comments.update(comment.id, { body })
        await queryClient.invalidateQueries({
          queryKey: ['comments', courseId, targetType, targetId],
        })
      }}
      onDelete={async (comment) => {
        await getCommentsClient().comments.comments.delete(comment.id)
        await queryClient.invalidateQueries({
          queryKey: ['comments', courseId, targetType, targetId],
        })
      }}
      canDelete={(comment) => comment.author.id === currentUser.id}
      isSubmitting={createMutation.isPending}
      isLoading={isLoading}
      errorMessage={error ? '讨论加载失败，请稍后重试。' : null}
      emptyTitle="还没有讨论"
      emptyDescription="写下第一条笔记或问题，开启这门课的学习讨论。"
      placeholder="写下你的问题、笔记或想法，支持表情…"
    />
  )
}
