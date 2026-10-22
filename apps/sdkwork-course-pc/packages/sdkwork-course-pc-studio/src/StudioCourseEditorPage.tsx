import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Modal,
  Notice,
  SelectField,
  TextAreaField,
  TextField,
  cn,
  formatDate,
  formatDuration,
  kindLabel,
  reviewStateLabel,
  reviewTone,
} from '@sdkwork/sdkwork-course-pc-commons'
import { uploadCourseMediaFile, useAppStore, useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { mapCourse, readPageItems } from '@sdkwork/sdkwork-course-pc-courses'
import { createCourseStudioService } from './services/CourseStudioService'
import {
  COURSE_KIND_OPTIONS,
  LESSON_KIND_OPTIONS,
  createEmptyLesson,
  createEmptySection,
  draftFromDetail,
  toPayload,
  type StudioDraft,
  type StudioLessonDraft,
  type StudioSectionDraft,
} from './studioTypes'

type EditorTab = 'basic' | 'curriculum' | 'collection' | 'publish'

const TAB_ITEMS: Array<{ id: EditorTab; label: string }> = [
  { id: 'basic', label: '基本信息' },
  { id: 'curriculum', label: '内容编排' },
  { id: 'collection', label: '合集内容' },
  { id: 'publish', label: '发布与审核' },
]

export function StudioCourseEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const queryClient = useQueryClient()
  const { user } = useAppStore()
  const service = useMemo(() => createCourseStudioService(sdk), [sdk])
  const [tab, setTab] = useState<EditorTab>('basic')
  const [draft, setDraft] = useState<StudioDraft | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [lessonEditor, setLessonEditor] = useState<{ sectionId: string; lessonId: string } | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['studio-course', id],
    queryFn: () => service.retrieve(id!),
    enabled: Boolean(id),
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => sdk.courseCategories.list({ pageSize: 50 }),
    staleTime: 5 * 60 * 1000,
  })

  const publishedQuery = useQuery({
    queryKey: ['studio-published-courses'],
    queryFn: () => sdk.courses.list({ pageSize: 100 }),
    enabled: draft?.kind === 'collection',
  })

  React.useEffect(() => {
    if (!detailQuery.data) return
    const next = draftFromDetail(detailQuery.data)
    next.authorDisplayName = next.authorDisplayName || user?.name || ''
    setDraft(next)
    setTab(next.kind === 'collection' ? 'collection' : 'basic')
    setDirty(false)
  }, [detailQuery.data, user?.name])

  React.useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !id) throw new Error('草稿尚未加载')
      return service.update(id, toPayload(draft))
    },
    onSuccess: async () => {
      setDirty(false)
      setFeedback({ tone: 'success', message: '草稿已保存' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
      await queryClient.invalidateQueries({ queryKey: ['studio-course', id] })
    },
    onError: (error) =>
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '保存失败' }),
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !id) throw new Error('草稿尚未加载')
      await service.update(id, toPayload(draft))
      return service.submit(id)
    },
    onSuccess: async () => {
      setDirty(false)
      setFeedback({ tone: 'success', message: '已提交审核，请等待运营反馈。' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
      await queryClient.invalidateQueries({ queryKey: ['studio-course', id] })
    },
    onError: (error) =>
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '提交失败' }),
  })

  const withdrawMutation = useMutation({
    mutationFn: async () => (id ? service.withdraw(id) : Promise.reject(new Error('缺少课程'))),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '已撤回审核，可以继续修改。' })
      await queryClient.invalidateQueries({ queryKey: ['studio-courses'] })
      await queryClient.invalidateQueries({ queryKey: ['studio-course', id] })
    },
    onError: (error) =>
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '撤回失败' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => (id ? service.remove(id) : Promise.reject(new Error('缺少课程'))),
    onSuccess: () => navigate('/studio'),
    onError: (error) =>
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '删除失败' }),
  })

  const patchDraft = (patch: Partial<StudioDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setDirty(true)
  }

  const updateSection = (sectionId: string, patch: Partial<StudioSectionDraft>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) =>
              section.clientId === sectionId ? { ...section, ...patch } : section,
            ),
          }
        : current,
    )
    setDirty(true)
  }

  const updateLesson = (
    sectionId: string,
    lessonId: string,
    patch: Partial<StudioLessonDraft>,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) =>
              section.clientId === sectionId
                ? {
                    ...section,
                    lessons: section.lessons.map((lesson) =>
                      lesson.clientId === lessonId ? { ...lesson, ...patch } : lesson,
                    ),
                  }
                : section,
            ),
          }
        : current,
    )
    setDirty(true)
  }

  const removeLesson = (sectionId: string, lessonId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) =>
              section.clientId === sectionId
                ? { ...section, lessons: section.lessons.filter((lesson) => lesson.clientId !== lessonId) }
                : section,
            ),
          }
        : current,
    )
    setDirty(true)
  }

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current
      const index = current.sections.findIndex((section) => section.clientId === sectionId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.sections.length) return current
      const sections = [...current.sections]
      const [moved] = sections.splice(index, 1)
      sections.splice(target, 0, moved)
      return { ...current, sections }
    })
    setDirty(true)
  }

  const moveLesson = (sectionId: string, lessonId: string, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.clientId !== sectionId) return section
          const index = section.lessons.findIndex((lesson) => lesson.clientId === lessonId)
          const target = index + direction
          if (index < 0 || target < 0 || target >= section.lessons.length) return section
          const lessons = [...section.lessons]
          const [moved] = lessons.splice(index, 1)
          lessons.splice(target, 0, moved)
          return { ...section, lessons }
        }),
      }
    })
    setDirty(true)
  }

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true)
    setFeedback(null)
    try {
      if (!file.type.startsWith('image/')) throw new Error('封面需要是图片文件')
      if (file.size > 10 * 1024 * 1024) throw new Error('封面不能超过 10MB')
      const upload = await uploadCourseMediaFile(file)
      patchDraft({
        cover: {
          driveResourceId: upload.driveResourceId,
          role: 'cover',
          mimeType: upload.mimeType,
          fileName: upload.fileName,
          ...(upload.previewUrl ? { metadata: { previewUrl: upload.previewUrl } } : {}),
        },
        coverPreviewUrl: upload.previewUrl ?? URL.createObjectURL(file),
      })
      setFeedback({ tone: 'success', message: '封面已上传，保存草稿后生效。' })
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '封面上传失败' })
    } finally {
      setUploadingCover(false)
    }
  }

  if (detailQuery.isLoading) {
    return <LoadingSpinner text="正在加载创作草稿..." />
  }
  if (detailQuery.error || !draft) {
    return (
      <EmptyState
        icon="!"
        title="无法打开该内容"
        description="内容不存在、已被删除，或不属于当前账号。"
        action={<Button onClick={() => navigate('/studio')}>返回创作中心</Button>}
      />
    )
  }

  const categoryOptions = readPageItems(categoriesQuery.data)
    .map((value) => {
      const record = value as Record<string, unknown>
      return { value: String(record.id ?? ''), label: String(record.name ?? '未命名分类') }
    })
    .filter(
      (option) =>
        option.value &&
        option.value !== 'course-category-root' &&
        option.label.trim().toLowerCase() !== 'courses',
    )

  const publishedCourses = readPageItems(publishedQuery.data)
    .map(mapCourse)
    .filter((course) => course.id !== draft.courseId)

  const stateLabel = reviewStateLabel(
    detailQuery.data?.course.publishStatus,
    detailQuery.data?.course.reviewedAt,
    detailQuery.data?.course.reviewNote,
  )
  const isReviewing = detailQuery.data?.course.publishStatus === 'reviewing'
  const isPublished = detailQuery.data?.course.publishStatus === 'published'
  const canEdit = !isReviewing && !isPublished

  const checks = buildChecks(draft)

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700"
          >
            ← 返回创作中心
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-slate-900">
              {draft.title || '未命名内容'}
            </h1>
            <Badge tone={reviewTone(detailQuery.data?.course.publishStatus)} dot>
              {stateLabel}
            </Badge>
            <Badge tone="neutral">{kindLabel(draft.kind)}</Badge>
            {dirty ? <Badge tone="warning">未保存</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isPublished
              ? '已发布内容不可直接修改，需由运营下架后再编辑。'
              : isReviewing
                ? '审核中的内容暂不可编辑，可先撤回审核。'
                : '修改后记得保存；提交审核前请完成右侧检查清单。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPublished ? (
            <Button variant="outline" onClick={() => navigate(`/courses/${draft.courseId}`)}>
              查看发布页
            </Button>
          ) : null}
          {isReviewing ? (
            <Button variant="outline" loading={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate()}>
              撤回审核
            </Button>
          ) : null}
          {canEdit ? (
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              保存草稿
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="secondary"
              loading={submitMutation.isPending}
              disabled={checks.some((check) => !check.ok)}
              onClick={() => submitMutation.mutate()}
            >
              提交审核
            </Button>
          ) : null}
        </div>
      </header>

      {feedback ? (
        <Notice tone={feedback.tone} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
        {TAB_ITEMS.filter((item) => item.id !== 'collection' || draft.kind === 'collection').map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {tab === 'basic' ? (
            <BasicPanel
              draft={draft}
              canEdit={canEdit}
              categoryOptions={categoryOptions}
              uploadingCover={uploadingCover}
              onPatch={patchDraft}
              onCoverUpload={handleCoverUpload}
            />
          ) : tab === 'curriculum' ? (
            <CurriculumPanel
              draft={draft}
              canEdit={canEdit}
              onUpdateSection={updateSection}
              onUpdateLesson={updateLesson}
              onRemoveSection={(sectionId) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sections: current.sections.filter((section) => section.clientId !== sectionId),
                      }
                    : current,
                )
                setDirty(true)
              }}
              onRemoveLesson={removeLesson}
              onMoveSection={moveSection}
              onMoveLesson={moveLesson}
              onAddSection={() => {
                patchDraft({
                  sections: [...draft.sections, createEmptySection(draft.sections.length)],
                })
              }}
              onAddLesson={(sectionId) => {
                const section = draft.sections.find((item) => item.clientId === sectionId)
                if (!section) return
                updateSection(sectionId, {
                  lessons: [...section.lessons, createEmptyLesson(section.lessons.length)],
                })
              }}
              onEditLesson={(sectionId, lessonId) => setLessonEditor({ sectionId, lessonId })}
            />
          ) : tab === 'collection' ? (
            <CollectionPanel
              draft={draft}
              canEdit={canEdit}
              publishedCourses={publishedCourses}
              onPatch={patchDraft}
            />
          ) : (
            <PublishPanel
              draft={draft}
              canEdit={canEdit}
              isReviewing={Boolean(isReviewing)}
              checks={checks}
              statusLabel={stateLabel}
              reviewNote={detailQuery.data?.course.reviewNote}
              submittedAt={detailQuery.data?.course.submittedAt}
              reviewedAt={detailQuery.data?.course.reviewedAt}
              onPatch={patchDraft}
            />
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">提交检查</h2>
            <ul className="mt-3 space-y-2">
              {checks.map((check) => (
                <li key={check.key} className="flex items-start gap-2 text-xs">
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      check.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {check.ok ? '✓' : '•'}
                  </span>
                  <span className={check.ok ? 'text-slate-600' : 'text-slate-500'}>{check.label}</span>
                </li>
              ))}
            </ul>
            {!canEdit ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                {isReviewing ? '审核中不可修改。' : '已发布内容需下架后编辑。'}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">审核记录</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">提交次数</dt>
                <dd className="font-semibold text-slate-800">{detailQuery.data?.course.reviewRound ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">最近提交</dt>
                <dd className="font-semibold text-slate-800">
                  {formatDate(detailQuery.data?.course.submittedAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">最近审核</dt>
                <dd className="font-semibold text-slate-800">
                  {formatDate(detailQuery.data?.course.reviewedAt)}
                </dd>
              </div>
            </dl>
            {detailQuery.data?.course.reviewNote ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                审核反馈：{detailQuery.data.course.reviewNote}
              </p>
            ) : null}
          </div>

          {canEdit ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
              <h2 className="text-sm font-bold text-rose-900">危险操作</h2>
              <p className="mt-1 text-xs text-rose-700">删除后无法恢复，已发布的课程请先联系运营下架。</p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                loading={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm('确认删除该草稿？')) deleteMutation.mutate()
                }}
              >
                删除草稿
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      {lessonEditor ? (
        <LessonEditorModal
          lesson={
            draft.sections
              .find((section) => section.clientId === lessonEditor.sectionId)
              ?.lessons.find((lesson) => lesson.clientId === lessonEditor.lessonId) ?? null
          }
          canEdit={canEdit}
          onClose={() => setLessonEditor(null)}
          onSave={(patch) => {
            updateLesson(lessonEditor.sectionId, lessonEditor.lessonId, patch)
            setLessonEditor(null)
          }}
        />
      ) : null}
    </div>
  )
}

function BasicPanel({
  draft,
  canEdit,
  categoryOptions,
  uploadingCover,
  onPatch,
  onCoverUpload,
}: {
  draft: StudioDraft
  canEdit: boolean
  categoryOptions: Array<{ value: string; label: string }>
  uploadingCover: boolean
  onPatch: (patch: Partial<StudioDraft>) => void
  onCoverUpload: (file: File) => void
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="标题"
          required
          value={draft.title}
          disabled={!canEdit}
          maxLength={120}
          onChange={(event) => onPatch({ title: event.target.value })}
        />
        <TextField
          label="副标题"
          value={draft.subtitle ?? ''}
          disabled={!canEdit}
          maxLength={160}
          onChange={(event) => onPatch({ subtitle: event.target.value })}
        />
      </div>
      <TextAreaField
        label="一句话简介"
        required
        value={draft.summary ?? ''}
        disabled={!canEdit}
        rows={2}
        maxLength={300}
        hint="会出现在课程卡片与搜索结果中，至少 20 字更容易通过审核"
        onChange={(event) => onPatch({ summary: event.target.value })}
      />
      <TextAreaField
        label="详细介绍"
        value={draft.description ?? ''}
        disabled={!canEdit}
        rows={7}
        onChange={(event) => onPatch({ description: event.target.value })}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="分类"
          value={draft.categoryId ?? ''}
          disabled={!canEdit}
          onChange={(event) => onPatch({ categoryId: event.target.value })}
          options={[{ value: '', label: '请选择分类' }, ...categoryOptions]}
        />
        <SelectField
          label="难度"
          value={draft.level ?? ''}
          disabled={!canEdit}
          onChange={(event) => onPatch({ level: event.target.value })}
          options={[
            { value: '', label: '不限' },
            { value: 'beginner', label: '入门' },
            { value: 'intermediate', label: '进阶' },
            { value: 'advanced', label: '高级' },
          ]}
        />
      </div>
      <TextField
        label="标签"
        value={draft.tags.join(', ')}
        disabled={!canEdit}
        hint="用英文逗号分隔，最多 20 个"
        onChange={(event) =>
          onPatch({
            tags: event.target.value
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 20),
          })
        }
      />
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">封面</p>
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:flex-row sm:items-center">
          <div className="relative aspect-video w-full max-w-[240px] overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
            {draft.coverPreviewUrl ? (
              <img src={draft.coverPreviewUrl} alt="封面预览" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                暂无封面
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              建议 16:9 图片，JPG/PNG/WebP，不超过 10MB。封面会用于课程卡片与详情页。
            </p>
            <label className={cn('mt-3 inline-flex', !canEdit && 'pointer-events-none opacity-50')}>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="上传封面"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onCoverUpload(file)
                  event.target.value = ''
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600">
                {uploadingCover ? '上传中...' : draft.coverPreviewUrl ? '更换封面' : '上传封面'}
              </span>
            </label>
          </div>
        </div>
      </div>
      <TextField
        label="作者署名"
        value={draft.authorDisplayName ?? ''}
        disabled={!canEdit}
        hint="展示在课程详情页，默认使用当前账号昵称"
        onChange={(event) => onPatch({ authorDisplayName: event.target.value })}
      />
    </section>
  )
}

function CurriculumPanel({
  draft,
  canEdit,
  onUpdateSection,
  onUpdateLesson,
  onRemoveSection,
  onRemoveLesson,
  onMoveSection,
  onMoveLesson,
  onAddSection,
  onAddLesson,
  onEditLesson,
}: {
  draft: StudioDraft
  canEdit: boolean
  onUpdateSection: (sectionId: string, patch: Partial<StudioSectionDraft>) => void
  onUpdateLesson: (sectionId: string, lessonId: string, patch: Partial<StudioLessonDraft>) => void
  onRemoveSection: (sectionId: string) => void
  onRemoveLesson: (sectionId: string, lessonId: string) => void
  onMoveSection: (sectionId: string, direction: -1 | 1) => void
  onMoveLesson: (sectionId: string, lessonId: string, direction: -1 | 1) => void
  onAddSection: () => void
  onAddLesson: (sectionId: string) => void
  onEditLesson: (sectionId: string, lessonId: string) => void
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">章节与课时</h2>
          <p className="mt-1 text-sm text-slate-500">
            按学习顺序编排章节；每个课时至少填写标题，视频课时需要视频来源或上传文件。
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={!canEdit} onClick={onAddSection}>
          + 添加章节
        </Button>
      </div>

      {draft.sections.length === 0 ? (
        <EmptyState
          icon="📑"
          title="还没有章节"
          description="添加第一个章节，然后为它添加课时。"
          action={<Button onClick={onAddSection} disabled={!canEdit}>添加章节</Button>}
        />
      ) : (
        draft.sections.map((section, sectionIndex) => (
          <div key={section.clientId} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                {sectionIndex + 1}
              </span>
              <input
                value={section.title}
                disabled={!canEdit}
                onChange={(event) => onUpdateSection(section.clientId, { title: event.target.value })}
                placeholder="章节标题，例如：第一章 · 建立认知"
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-slate-900 focus:border-slate-300 focus:bg-white focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <IconButton label="上移章节" disabled={!canEdit || sectionIndex === 0} onClick={() => onMoveSection(section.clientId, -1)}>
                  ↑
                </IconButton>
                <IconButton
                  label="下移章节"
                  disabled={!canEdit || sectionIndex === draft.sections.length - 1}
                  onClick={() => onMoveSection(section.clientId, 1)}
                >
                  ↓
                </IconButton>
                <IconButton
                  label="删除章节"
                  disabled={!canEdit}
                  onClick={() => {
                    if (window.confirm(`删除章节「${section.title || '未命名'}」及其课时？`)) {
                      onRemoveSection(section.clientId)
                    }
                  }}
                >
                  ×
                </IconButton>
              </div>
            </div>
            <div className="space-y-1 p-3">
              {section.lessons.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-500">本章还没有课时。</p>
              ) : (
                section.lessons.map((lesson, lessonIndex) => (
                  <div
                    key={lesson.clientId}
                    className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50"
                  >
                    <span className="w-6 shrink-0 text-center text-[11px] text-slate-400">{lessonIndex + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {lesson.title || '未命名课时'}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{LESSON_KIND_OPTIONS.find((item) => item.value === lesson.lessonKind)?.label}</span>
                        {lesson.durationSeconds > 0 ? <span>{formatDuration(lesson.durationSeconds)}</span> : null}
                        {lesson.freePreview ? <span className="text-emerald-600">可试看</span> : null}
                        {lesson.resources.length > 0 ? <span>{lesson.resources.length} 个资料</span> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => onEditLesson(section.clientId, lesson.clientId)}>
                        编辑
                      </Button>
                      <IconButton label="上移课时" disabled={!canEdit || lessonIndex === 0} onClick={() => onMoveLesson(section.clientId, lesson.clientId, -1)}>
                        ↑
                      </IconButton>
                      <IconButton
                        label="下移课时"
                        disabled={!canEdit || lessonIndex === section.lessons.length - 1}
                        onClick={() => onMoveLesson(section.clientId, lesson.clientId, 1)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        label="删除课时"
                        disabled={!canEdit}
                        onClick={() => {
                          if (window.confirm(`删除课时「${lesson.title || '未命名'}」？`)) {
                            onRemoveLesson(section.clientId, lesson.clientId)
                          }
                        }}
                      >
                        ×
                      </IconButton>
                    </div>
                  </div>
                ))
              )}
              <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => onAddLesson(section.clientId)}>
                + 添加课时
              </Button>
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function CollectionPanel({
  draft,
  canEdit,
  publishedCourses,
  onPatch,
}: {
  draft: StudioDraft
  canEdit: boolean
  publishedCourses: ReturnType<typeof mapCourse>[]
  onPatch: (patch: Partial<StudioDraft>) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = publishedCourses.filter((course) =>
    query ? course.title.toLowerCase().includes(query.toLowerCase()) : true,
  )
  const selected = draft.collectionItems
    .map((courseId) => publishedCourses.find((course) => course.id === courseId))
    .filter((course): course is ReturnType<typeof mapCourse> => Boolean(course))

  const toggle = (courseId: string) => {
    onPatch({
      collectionItems: draft.collectionItems.includes(courseId)
        ? draft.collectionItems.filter((item) => item !== courseId)
        : [...draft.collectionItems, courseId],
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= selected.length) return
    const next = [...draft.collectionItems]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onPatch({ collectionItems: next })
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">选择已发布课程</h2>
        <p className="mt-1 text-xs text-slate-500">合集只能包含平台已发布课程，推荐按学习顺序添加。</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索课程..."
          className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">没有可添加的已发布课程。</p>
          ) : (
            filtered.map((course) => {
              const checked = draft.collectionItems.includes(course.id)
              return (
                <label
                  key={course.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                    checked ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-100 hover:border-slate-200',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canEdit}
                    onChange={() => toggle(course.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{course.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {kindLabel(course.kind)} · {course.lessonsCount} 课时 · {course.author ?? '平台'}
                    </span>
                  </span>
                </label>
              )
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">合集顺序（{selected.length}）</h2>
        <p className="mt-1 text-xs text-slate-500">按当前顺序展示给学习者，可上下调整。</p>
        <div className="mt-3 space-y-2">
          {selected.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-500">
              还没有选择课程
            </div>
          ) : (
            selected.map((course, index) => (
              <div key={course.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{course.title}</span>
                <div className="flex items-center gap-1">
                  <IconButton label="上移" disabled={!canEdit || index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </IconButton>
                  <IconButton
                    label="下移"
                    disabled={!canEdit || index === selected.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton label="移除" disabled={!canEdit} onClick={() => toggle(course.id)}>
                    ×
                  </IconButton>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function PublishPanel({
  draft,
  canEdit,
  isReviewing,
  checks,
  statusLabel: statusText,
  reviewNote,
  submittedAt,
  reviewedAt,
  onPatch,
}: {
  draft: StudioDraft
  canEdit: boolean
  isReviewing: boolean
  checks: Array<{ key: string; label: string; ok: boolean }>
  statusLabel: string
  reviewNote?: string
  submittedAt?: string
  reviewedAt?: string
  onPatch: (patch: Partial<StudioDraft>) => void
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">定价与发布</h2>
        <p className="mt-1 text-sm text-slate-500">
          免费内容报名即可学习；付费内容会进入平台收款流程，购买后自动开通学习权益。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <label
            className={cn(
              'flex-1 cursor-pointer rounded-xl border p-4 transition',
              draft.isFree ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-500/10' : 'border-slate-200',
            )}
          >
            <input
              type="radio"
              name="pricing"
              className="sr-only"
              checked={draft.isFree}
              disabled={!canEdit}
              onChange={() => onPatch({ isFree: true, priceAmount: '', originalPriceAmount: '' })}
            />
            <p className="text-sm font-bold text-slate-900">免费内容</p>
            <p className="mt-1 text-xs text-slate-500">扩大传播，适合专栏试读与公开课</p>
          </label>
          <label
            className={cn(
              'flex-1 cursor-pointer rounded-xl border p-4 transition',
              !draft.isFree ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-500/10' : 'border-slate-200',
            )}
          >
            <input
              type="radio"
              name="pricing"
              className="sr-only"
              checked={!draft.isFree}
              disabled={!canEdit}
              onChange={() => onPatch({ isFree: false })}
            />
            <p className="text-sm font-bold text-slate-900">付费内容</p>
            <p className="mt-1 text-xs text-slate-500">平台统一收款，支持退款与售后规则</p>
          </label>
        </div>
        {!draft.isFree ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <TextField
              label="售价"
              type="number"
              min={0}
              step="0.01"
              required
              value={draft.priceAmount ?? ''}
              disabled={!canEdit}
              onChange={(event) => onPatch({ priceAmount: event.target.value })}
            />
            <TextField
              label="划线价"
              type="number"
              min={0}
              step="0.01"
              value={draft.originalPriceAmount ?? ''}
              disabled={!canEdit}
              onChange={(event) => onPatch({ originalPriceAmount: event.target.value })}
            />
            <SelectField
              label="币种"
              value={draft.currency}
              disabled={!canEdit}
              onChange={(event) => onPatch({ currency: event.target.value })}
              options={[
                { value: 'CNY', label: '人民币 CNY' },
                { value: 'USD', label: '美元 USD' },
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">审核状态</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone={isReviewing ? 'warning' : 'info'} dot>
            {statusText}
          </Badge>
          <span className="text-xs text-slate-500">最近提交：{formatDate(submittedAt)}</span>
          <span className="text-xs text-slate-500">最近审核：{formatDate(reviewedAt)}</span>
        </div>
        {reviewNote ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            审核反馈：{reviewNote}
          </p>
        ) : null}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {checks.map((check) => (
            <li
              key={check.key}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                check.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500',
              )}
            >
              <span className="font-bold">{check.ok ? '✓' : '•'}</span>
              {check.label}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          提交审核后内容会锁定，运营可在审核队列中预览封面、章节与定价。审核通过后自动创建默认班次并发布；被退回时可在创作中心查看反馈并修改后重新提交。
        </p>
      </div>
    </section>
  )
}

function LessonEditorModal({
  lesson,
  canEdit,
  onClose,
  onSave,
}: {
  lesson: StudioLessonDraft | null
  canEdit: boolean
  onClose: () => void
  onSave: (patch: Partial<StudioLessonDraft>) => void
}) {
  const [form, setForm] = useState<StudioLessonDraft | null>(lesson)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  React.useEffect(() => {
    setForm(lesson)
  }, [lesson])

  if (!lesson || !form) return null

  const patch = (next: Partial<StudioLessonDraft>) => setForm((current) => (current ? { ...current, ...next } : current))

  const handleResourceUpload = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const isVideoLesson = form.lessonKind === 'vod_video'
      if (isVideoLesson) {
        if (!file.type.startsWith('video/')) {
          throw new Error('视频课时需要上传视频文件（MP4 / WebM / MOV）')
        }
        if (file.size > 2 * 1024 * 1024 * 1024) {
          throw new Error('单个视频不能超过 2GB')
        }
      }
      const durationSeconds = isVideoLesson ? await readVideoDuration(file) : undefined
      const upload = await uploadCourseMediaFile(file)
      const role = isVideoLesson
        ? 'vod_video'
        : form.lessonKind === 'download'
          ? 'attachment'
          : 'attachment'
      patch({
        ...(isVideoLesson && form.durationSeconds <= 0 && durationSeconds
          ? { durationSeconds }
          : {}),
        resources: [
          ...form.resources,
          {
            driveResourceId: upload.driveResourceId,
            resourceRole: role,
            mimeType: upload.mimeType || file.type || undefined,
            fileName: upload.fileName,
            fileSizeBytes: file.size,
            durationSeconds,
          },
        ],
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="编辑课时"
      description="课时内容、视频来源与资料都在这里配置"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!canEdit || !form.title.trim()} onClick={() => onSave(form)}>
            保存课时
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <TextField
            label="课时标题"
            required
            value={form.title}
            disabled={!canEdit}
            onChange={(event) => patch({ title: event.target.value })}
            maxLength={160}
          />
          <SelectField
            label="课时形式"
            value={form.lessonKind}
            disabled={!canEdit}
            onChange={(event) => patch({ lessonKind: event.target.value })}
            options={LESSON_KIND_OPTIONS}
          />
        </div>
        <TextAreaField
          label="课时简介"
          value={form.summary ?? ''}
          disabled={!canEdit}
          rows={2}
          onChange={(event) => patch({ summary: event.target.value })}
        />
        {form.lessonKind === 'article' ? (
          <TextAreaField
            label="正文"
            required
            value={form.content ?? ''}
            disabled={!canEdit}
            rows={10}
            hint="支持纯文本或 Markdown 风格排版，至少 20 字"
            onChange={(event) => patch({ content: event.target.value })}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="时长（分钟）"
                type="number"
                min={0}
                value={Math.round(form.durationSeconds / 60)}
                disabled={!canEdit}
                onChange={(event) => patch({ durationSeconds: Number(event.target.value || 0) * 60 })}
              />
              <label className="flex items-end gap-2 pb-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.freePreview}
                  disabled={!canEdit}
                  onChange={(event) => patch({ freePreview: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                允许未报名用户试看
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="外部视频 ID"
                value={form.externalSourceId ?? ''}
                disabled={!canEdit}
                placeholder="例如 B 站 BV 号"
                onChange={(event) => patch({ externalSourceId: event.target.value })}
              />
              <SelectField
                label="外部来源"
                value={form.sourceProvider ?? ''}
                disabled={!canEdit}
                onChange={(event) => patch({ sourceProvider: event.target.value })}
                options={[
                  { value: '', label: '无 / 使用上传文件' },
                  { value: 'bilibili', label: 'bilibili' },
                  { value: 'external', label: '其他外链' },
                ]}
              />
            </div>
          </>
        )}

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">课时资料</p>
              <p className="text-xs text-slate-500">视频、附件或讲义，通过 Drive 上传</p>
            </div>
            <label className={cn(!canEdit && 'pointer-events-none opacity-50')}>
              <input
                type="file"
                className="hidden"
                aria-label="上传课时资料"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleResourceUpload(file)
                  event.target.value = ''
                }}
                accept={form.lessonKind === 'vod_video' ? 'video/*' : undefined}
              />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                {uploading ? '上传中...' : form.lessonKind === 'vod_video' ? '上传视频' : '上传资料'}
              </span>
            </label>
          </div>
          {uploadError ? <p className="mt-2 text-xs text-rose-600">{uploadError}</p> : null}
          <div className="mt-3 space-y-2">
            {form.resources.length === 0 ? (
              <p className="text-xs text-slate-500">还没有资料。</p>
            ) : (
              form.resources.map((resource, index) => (
                <div key={`${resource.driveResourceId}-${index}`} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                  <span className="text-xs font-semibold text-slate-600">{resource.resourceRole}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                    {resource.fileName ?? resource.driveResourceId}
                  </span>
                  <IconButton
                    label="移除资料"
                    disabled={!canEdit}
                    onClick={() =>
                      patch({ resources: form.resources.filter((_, itemIndex) => itemIndex !== index) })
                    }
                  >
                    ×
                  </IconButton>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('无法读取视频时长，请更换文件后重试'))
    }, 15_000)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      window.clearTimeout(timer)
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0
      cleanup()
      if (duration <= 0) {
        reject(new Error('视频时长无效，请检查文件是否完整'))
        return
      }
      resolve(duration)
    }
    video.onerror = () => {
      window.clearTimeout(timer)
      cleanup()
      reject(new Error('无法读取视频文件，请检查格式是否受支持'))
    }
    video.src = url
  })
}

function buildChecks(draft: StudioDraft): Array<{ key: string; label: string; ok: boolean }> {
  const summary = (draft.summary ?? draft.description ?? '').trim()
  const checks = [
    { key: 'title', label: '标题至少 2 个字符', ok: draft.title.trim().length >= 2 },
    { key: 'summary', label: '简介至少 20 个字符', ok: summary.length >= 20 },
    { key: 'cover', label: '已上传封面', ok: Boolean(draft.cover || draft.coverPreviewUrl) },
    { key: 'category', label: '已选择分类', ok: Boolean(draft.categoryId) },
  ]
  if (draft.kind !== 'collection') {
    const videoLessons = draft.sections.flatMap((section) => section.lessons).filter((lesson) => lesson.lessonKind === 'vod_video')
    if (videoLessons.length > 0) {
      checks.push({
        key: 'video_sources',
        label: '每个视频课时都有视频文件或外链',
        ok: videoLessons.every(
          (lesson) =>
            Boolean(lesson.externalSourceId?.trim()) ||
            lesson.resources.some(
              (resource) =>
                resource.resourceRole === 'vod_video' &&
                Boolean(resource.mimeType?.startsWith('video/')),
            ),
        ),
      })
      checks.push({
        key: 'video_duration',
        label: '视频课时时长完整',
        ok: videoLessons.every((lesson) => lesson.durationSeconds > 0),
      })
    }
  }
  if (draft.kind === 'collection') {
    checks.push({ key: 'items', label: '合集至少包含 1 门已发布课程', ok: draft.collectionItems.length > 0 })
  } else {
    checks.push({ key: 'sections', label: '至少 1 个章节', ok: draft.sections.length > 0 })
    checks.push({
      key: 'lessons',
      label: '至少 1 个有标题的课时',
      ok: draft.sections.some((section) => section.lessons.some((lesson) => lesson.title.trim())),
    })
  }
  if (!draft.isFree) {
    checks.push({
      key: 'price',
      label: '付费内容已填写有效价格',
      ok: Number(draft.priceAmount ?? '') > 0 && Boolean(draft.currency),
    })
  }
  return checks
}
