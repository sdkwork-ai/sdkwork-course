import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  Notice,
  SelectField,
  StatCard,
  TextField,
  cn,
  formatRelativeTime,
  kindLabel,
  reviewStateLabel,
  statusLabel,
  reviewTone,
} from '@sdkwork/sdkwork-course-pc-commons'
import { useAppStore, useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { createCourseStudioService } from './services/CourseStudioService'
import {
  COURSE_KIND_OPTIONS,
  emptyDraft,
  toPayload,
  type StudioDraft,
} from './studioTypes'

type StatusFilter = 'all' | 'draft' | 'reviewing' | 'published' | 'unpublished'

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'draft', label: '草稿 / 退回' },
  { id: 'reviewing', label: '审核中' },
  { id: 'published', label: '已发布' },
  { id: 'unpublished', label: '已下架' },
]

export function StudioCourseListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sdk = useCourseSdk()
  const queryClient = useQueryClient()
  const { user } = useAppStore()
  const service = useMemo(() => createCourseStudioService(sdk), [sdk])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1')
  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateOpen(true)
  }, [searchParams])
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState<'standard' | 'column' | 'collection'>('standard')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  )

  const coursesQuery = useQuery({
    queryKey: ['studio-courses', filter],
    queryFn: () =>
      service.list({
        status: filter === 'all' || filter === 'unpublished' ? undefined : filter,
      }),
  })

  const rows = coursesQuery.data?.items ?? []
  const filteredRows =
    filter === 'unpublished'
      ? rows.filter((row) => row.publishStatus === 'unpublished')
      : filter === 'draft'
        ? rows.filter(
            (row) => row.publishStatus === 'draft' || row.publishStatus === 'archived',
          )
        : rows

  const stats = {
    total: rows.length,
    draft: rows.filter((row) => row.publishStatus === 'draft').length,
    reviewing: rows.filter((row) => row.publishStatus === 'reviewing').length,
    published: rows.filter((row) => row.publishStatus === 'published').length,
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const base: StudioDraft = {
        ...emptyDraft(newKind),
        title: newTitle.trim(),
        authorDisplayName: user?.name ?? '',
        summary: '',
        description: '',
        sections: newKind === 'collection' ? [] : [],
        collectionItems: [],
      }
      return service.create(toPayload(base))
    },
    onSuccess: async (course) => {
      setCreateOpen(false)
      setNewTitle('')
      setFeedback({ tone: 'success', message: '草稿已创建，开始编排内容吧。' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
      navigate(`/studio/courses/${course.id}`)
    },
    onError: (error) =>
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : '创建失败，请稍后再试',
      }),
  })

  const submitMutation = useMutation({
    mutationFn: (courseId: string) => service.submit(courseId),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '已提交审核，请等待运营反馈。' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
    },
    onError: (error) =>
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : '提交失败',
      }),
  })

  const withdrawMutation = useMutation({
    mutationFn: (courseId: string) => service.withdraw(courseId),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '已撤回审核，可以继续修改。' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
    },
    onError: (error) =>
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '撤回失败' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => service.remove(courseId),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '草稿已删除。' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
    },
    onError: (error) =>
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '删除失败' }),
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
            Creator Studio
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            创作者中心
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            创建课程、专栏或合集，编排章节与课时，提交平台审核后发布。
          </p>
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)}>
          + 新建内容
        </Button>
      </header>

      {feedback ? (
        <Notice tone={feedback.tone === 'success' ? 'success' : 'error'} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="全部内容" value={stats.total} hint="包含草稿、审核中与已发布" />
        <StatCard label="草稿 / 退回" value={stats.draft} hint="可继续编辑" tone="default" />
        <StatCard label="审核中" value={stats.reviewing} hint="等待运营处理" tone="warning" />
        <StatCard label="已发布" value={stats.published} hint="学习者可见" tone="success" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              filter === item.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {coursesQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : coursesQuery.error ? (
        <Notice tone="error" title="内容列表加载失败">
          <Button size="sm" onClick={() => void coursesQuery.refetch()}>
            重试
          </Button>
        </Notice>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon="✍️"
          title="还没有内容"
          description="创建你的第一门课程、专栏或合集。草稿完成后提交审核，通过后即可发布。"
          action={<Button onClick={() => setCreateOpen(true)}>新建内容</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const state = reviewStateLabel(row.publishStatus, row.reviewedAt, row.reviewNote)
            return (
              <article
                key={row.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={reviewTone(row.publishStatus)} dot>
                      {state}
                    </Badge>
                    <Badge tone="neutral">{kindLabel(row.kind)}</Badge>
                    <span className="text-xs text-slate-400">
                      更新于 {row.updatedAt ? formatRelativeTime(row.updatedAt) : '刚刚'}
                    </span>
                  </div>
                  <h2 className="mt-2 line-clamp-1 text-base font-bold text-slate-900">
                    {row.title || '未命名内容'}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {row.summary ?? row.description ?? '暂无简介'}
                  </p>
                  {row.reviewNote && row.publishStatus === 'draft' ? (
                    <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      审核反馈：{row.reviewNote}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-slate-400">
                    {row.kind === 'collection'
                      ? `${row.itemCount || '—'} 门课程`
                      : `${row.lessonsCount} 课时`}
                    {row.reviewRound > 0 ? ` · 第 ${row.reviewRound} 次提交` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/studio/courses/${row.id}`)}>
                    {row.publishStatus === 'reviewing' ? '查看' : '编辑'}
                  </Button>
                  {row.publishStatus === 'reviewing' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={withdrawMutation.isPending}
                      onClick={() => withdrawMutation.mutate(row.id)}
                    >
                      撤回审核
                    </Button>
                  ) : row.publishStatus === 'published' || row.publishStatus === 'unpublished' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/courses/${row.id}?view=overview`)}
                    >
                      查看详情
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        loading={submitMutation.isPending}
                        onClick={() => submitMutation.mutate(row.id)}
                      >
                        提交审核
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50"
                        loading={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`删除「${row.title}」？该操作不可撤销。`)) {
                            deleteMutation.mutate(row.id)
                          }
                        }}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建内容"
        description="先创建草稿，再补充封面、章节与课时"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={newTitle.trim().length < 2}
              onClick={() => createMutation.mutate()}
            >
              创建并继续
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <TextField
            label="内容标题"
            required
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="例如：AI 效率工作法"
            maxLength={120}
            hint="2–120 个字符，后续可在编辑页修改"
          />
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">内容类型</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {COURSE_KIND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setNewKind(option.value as StudioDraft['kind'])}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    newKind === option.value
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
