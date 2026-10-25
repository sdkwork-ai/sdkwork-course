import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, FilePlus2, Sparkles, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Modal,
  Notice,
  PageHeader,
  SelectField,
  StatCard,
  TextAreaField,
  TextField,
  cn,
  formatRelativeTime,
} from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { createQuestionBankService } from './services/QuestionBankService'
import {
  DIFFICULTY_OPTIONS,
  GRADE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  SUBJECT_OPTIONS,
  formatDuration,
  labelOf,
  type ComposeBucketInput,
  type ComposePaperInput,
  type Question,
} from './questionBankTypes'

interface SmartBucketDraft {
  questionType: string
  difficulty: string
  count: string
  score: string
}

interface SmartFormState {
  title: string
  gradeLevel: string
  subject: string
  durationMinutes: string
  totalScore: string
  headerNote: string
  chapters: string
  buckets: SmartBucketDraft[]
}

interface ManualFormState {
  title: string
  gradeLevel: string
  subject: string
  durationMinutes: string
  totalScore: string
  headerNote: string
}

const PAPER_STATUS_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'draft', label: '编辑中' },
  { id: 'archived', label: '已归档' },
]

function emptySmartForm(): SmartFormState {
  return {
    title: '',
    gradeLevel: 'grade7',
    subject: 'math',
    durationMinutes: '90',
    totalScore: '100',
    headerNote: '',
    chapters: '',
    buckets: [
      { questionType: 'single_choice', difficulty: '', count: '10', score: '3' },
      { questionType: 'fill_blank', difficulty: '', count: '4', score: '5' },
      { questionType: 'solution', difficulty: '', count: '2', score: '10' },
    ],
  }
}

function bucketInput(draft: SmartBucketDraft): ComposeBucketInput | null {
  const count = Number(draft.count)
  if (!Number.isFinite(count) || count <= 0) return null
  return {
    questionType: draft.questionType,
    difficulty: draft.difficulty || undefined,
    count: Math.floor(count),
    score: draft.score || undefined,
  }
}

export function QuestionPapersPage() {
  const sdk = useCourseSdk()
  const service = useMemo(() => createQuestionBankService(sdk), [sdk])
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const remixId = searchParams.get('remix')

  // 「二次编辑」：以已有试卷的配比快照预填智能组卷表单，重新随机出卷。
  const remixQuery = useQuery({
    queryKey: ['question-bank-paper', remixId],
    queryFn: () => service.retrievePaper(remixId ?? ''),
    enabled: Boolean(remixId),
  })

  useEffect(() => {
    const paper = remixQuery.data
    if (!remixId || !paper) return
    const scope = paper.scope as {
      chapters?: string[]
      buckets?: Array<{ questionType?: string; difficulty?: string; count?: number; score?: string }>
    }
    const common = {
      title: paper.title ? `${paper.title}（重出卷）` : '',
      gradeLevel: paper.gradeLevel,
      subject: paper.subject,
      durationMinutes: paper.examDurationSeconds
        ? String(Math.max(1, Math.round(paper.examDurationSeconds / 60)))
        : '90',
      totalScore: paper.totalScore ?? '',
      headerNote: paper.headerNote ?? '',
    }
    if (paper.paperMode === 'manual') {
      // 手动卷二次编辑：带入原卷题目让教师增删后重新生成。
      setManualForm((current) => ({ ...current, ...common }))
      setSelected(
        paper.items
          .map((item) => item.question)
          .filter((question): question is NonNullable<typeof question> => Boolean(question)),
      )
      setManualOpen(true)
    } else {
      const buckets = (scope.buckets ?? []).map((bucket) => ({
        questionType: String(bucket.questionType ?? 'single_choice'),
        difficulty: String(bucket.difficulty ?? ''),
        count: String(bucket.count ?? ''),
        score: String(bucket.score ?? ''),
      }))
      setSmartForm({
        ...common,
        chapters: Array.isArray(scope.chapters) ? scope.chapters.join('、') : '',
        buckets: buckets.length > 0 ? buckets : emptySmartForm().buckets,
      })
      setSmartOpen(true)
    }
    setSearchParams({}, { replace: true })
  }, [remixId, remixQuery.data, setSearchParams])

  const [statusFilter, setStatusFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const [smartOpen, setSmartOpen] = useState(false)
  const [smartForm, setSmartForm] = useState<SmartFormState>(emptySmartForm)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState<ManualFormState>({
    title: '',
    gradeLevel: 'grade7',
    subject: 'math',
    durationMinutes: '90',
    totalScore: '',
    headerNote: '',
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<Question[]>([])

  const papersQuery = useQuery({
    queryKey: ['question-bank-papers', { statusFilter, keyword, page }],
    queryFn: () =>
      service.listPapers({ q: keyword || undefined, status: statusFilter, page, pageSize: 20 }),
  })

  const composeMutation = useMutation({
    mutationFn: (payload: ComposePaperInput) => service.composePaper(payload),
    onSuccess: (paper) => {
      setSmartOpen(false)
      setManualOpen(false)
      setSelected([])
      setMessage({ tone: 'ok', text: `试卷《${paper.title}》已生成并存档。` })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-papers'] })
      navigate(`/questionbank/papers/${paper.id}`)
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (paperId: string) => service.archivePaper(paperId),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: '试卷已归档。' })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-papers'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (paperId: string) => service.deletePaper(paperId),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: '试卷已删除。' })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-papers'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const [pickerWrongOnly, setPickerWrongOnly] = useState(false)
  const pickerQuery = useQuery({
    queryKey: [
      'question-bank-picker',
      manualForm.gradeLevel,
      manualForm.subject,
      pickerWrongOnly,
    ],
    queryFn: () =>
      service.listQuestions({
        grade: manualForm.gradeLevel,
        subject: manualForm.subject,
        wrongBook: pickerWrongOnly || undefined,
        page: 1,
        pageSize: 100,
      }),
    enabled: pickerOpen,
  })

  const submitSmart = () => {
    if (!smartForm.title.trim()) {
      setMessage({ tone: 'error', text: '请填写试卷名称。' })
      return
    }
    const buckets = smartForm.buckets.map(bucketInput).filter((bucket): bucket is ComposeBucketInput => bucket !== null)
    if (buckets.length === 0) {
      setMessage({ tone: 'error', text: '至少需要一条有效的题型配比。' })
      return
    }
    composeMutation.mutate({
      mode: 'smart',
      title: smartForm.title.trim(),
      gradeLevel: smartForm.gradeLevel,
      subject: smartForm.subject,
      examDurationSeconds: Math.max(0, Math.round(Number(smartForm.durationMinutes) * 60)) || 0,
      totalScore: smartForm.totalScore || undefined,
      headerNote: smartForm.headerNote.trim() || undefined,
      scope: {
        chapters: smartForm.chapters
          .split(/[、,，;；\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        buckets,
      },
    })
  }

  const submitManual = () => {
    if (!manualForm.title.trim()) {
      setMessage({ tone: 'error', text: '请填写试卷名称。' })
      return
    }
    if (selected.length === 0) {
      setMessage({ tone: 'error', text: '请先从题库挑选试题。' })
      return
    }
    composeMutation.mutate({
      mode: 'manual',
      title: manualForm.title.trim(),
      gradeLevel: manualForm.gradeLevel,
      subject: manualForm.subject,
      examDurationSeconds: Math.max(0, Math.round(Number(manualForm.durationMinutes) * 60)) || 0,
      totalScore: manualForm.totalScore || undefined,
      headerNote: manualForm.headerNote.trim() || undefined,
      items: selected.map((question) => ({ questionId: question.id })),
    })
  }

  const papers = papersQuery.data?.items ?? []
  const total = papersQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div>
      <PageHeader
        title="智能组卷"
        subtitle="智能随机组卷自动查重不重复；手动组卷自由搭配题目，生成后可打印、导出与二次编辑。"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setManualOpen(true)}>
              <FilePlus2 className="h-4 w-4" /> 手动组卷
            </Button>
            <Button onClick={() => setSmartOpen(true)}>
              <Sparkles className="h-4 w-4" /> 智能组卷
            </Button>
          </div>
        }
      />

      {message ? (
        <Notice
          tone={message.tone === 'ok' ? 'success' : 'error'}
          title={message.text}
          onDismiss={() => setMessage(null)}
          className="mb-4"
        />
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="试卷总数" value={String(total)} hint="当前筛选范围" />
        <StatCard
          label="已归档"
          value={String(papers.filter((paper) => paper.paperStatus === 'archived').length)}
          hint="本页"
        />
        <StatCard
          label="智能组卷"
          value={String(papers.filter((paper) => paper.paperMode === 'smart').length)}
          hint="本页"
        />
        <StatCard label="本页题量" value={String(papers.reduce((sum, paper) => sum + paper.questionCount, 0))} hint="合计" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {PAPER_STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                setStatusFilter(filter.id)
                setPage(1)
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                statusFilter === filter.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="min-w-[220px] flex-1">
          <TextField
            placeholder="搜索试卷名称 / 编号"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {papersQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          icon="🧪"
          title="还没有试卷"
          description="用智能组卷一键生成，或手动挑选题目自由搭配。"
          action={<Button onClick={() => setSmartOpen(true)}>开始智能组卷</Button>}
        />
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <article
              key={paper.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200"
            >
              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={paper.paperMode === 'smart' ? 'violet' : 'neutral'}>
                    {paper.paperMode === 'smart' ? '智能组卷' : '手动组卷'}
                  </Badge>
                  <Badge tone={paper.paperStatus === 'archived' ? 'success' : 'warning'}>
                    {paper.paperStatus === 'archived' ? '已归档' : '编辑中'}
                  </Badge>
                  <span className="text-slate-400">{paper.paperCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/questionbank/papers/${paper.id}`)}
                  className="mt-1 text-left text-sm font-semibold text-slate-900 hover:text-indigo-600"
                >
                  {paper.title}
                </button>
                <p className="mt-1 text-xs text-slate-500">
                  {labelOf('grade', paper.gradeLevel)} · {labelOf('subject', paper.subject)} ·{' '}
                  {paper.questionCount} 题 · 总分 {paper.totalScore} 分 · 时长{' '}
                  {formatDuration(paper.examDurationSeconds)} · 更新于 {formatRelativeTime(paper.updatedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/questionbank/papers/${paper.id}`)}
                >
                  查看排版
                </Button>
                {paper.paperStatus !== 'archived' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate(paper.id)}
                  >
                    <Archive className="h-4 w-4" /> 归档
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (window.confirm(`确定删除试卷《${paper.title}》吗？`)) {
                      deleteMutation.mutate(paper.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> 删除
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            上一页
          </Button>
          <span className="text-sm text-slate-500">
            第 {page} / {totalPages} 页
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            下一页
          </Button>
        </div>
      ) : null}

      <Modal
        open={smartOpen}
        title="智能组卷"
        size="xl"
        onClose={() => setSmartOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSmartOpen(false)}>
              取消
            </Button>
            <Button loading={composeMutation.isPending} onClick={submitSmart}>
              生成试卷
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="试卷名称"
            value={smartForm.title}
            placeholder="如：七年级数学期中模拟卷"
            onChange={(event) => setSmartForm({ ...smartForm, title: event.target.value })}
          />
          <SelectField
            label="年级"
            value={smartForm.gradeLevel}
            onChange={(event) => setSmartForm({ ...smartForm, gradeLevel: event.target.value })}
            options={GRADE_OPTIONS}
          />
          <SelectField
            label="学科"
            value={smartForm.subject}
            onChange={(event) => setSmartForm({ ...smartForm, subject: event.target.value })}
            options={SUBJECT_OPTIONS}
          />
          <TextField
            label="考试时长（分钟）"
            type="number"
            value={smartForm.durationMinutes}
            onChange={(event) => setSmartForm({ ...smartForm, durationMinutes: event.target.value })}
          />
          <TextField
            label="总分（留空按分值合计）"
            type="number"
            value={smartForm.totalScore}
            onChange={(event) => setSmartForm({ ...smartForm, totalScore: event.target.value })}
          />
          <TextField
            label="出题章节（可选，顿号分隔）"
            value={smartForm.chapters}
            placeholder="如：第一章 有理数、第二章 整式的加减"
            onChange={(event) => setSmartForm({ ...smartForm, chapters: event.target.value })}
          />
        </div>
        <TextAreaField
          label="试卷说明（打印在密封线之后）"
          rows={2}
          className="mt-3"
          value={smartForm.headerNote}
          onChange={(event) => setSmartForm({ ...smartForm, headerNote: event.target.value })}
        />
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">题型配比（系统按池随机抽题，卷内不重复）</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSmartForm({
                  ...smartForm,
                  buckets: [
                    ...smartForm.buckets,
                    { questionType: 'single_choice', difficulty: '', count: '5', score: '' },
                  ],
                })
              }
            >
              添加配比
            </Button>
          </div>
          <div className="space-y-2">
            {smartForm.buckets.map((bucket, index) => (
              <div key={index} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto]">
                <SelectField
                  label="题型"
                  value={bucket.questionType}
                  onChange={(event) => {
                    const buckets = [...smartForm.buckets]
                    buckets[index] = { ...bucket, questionType: event.target.value }
                    setSmartForm({ ...smartForm, buckets })
                  }}
                  options={QUESTION_TYPE_OPTIONS}
                />
                <SelectField
                  label="难度"
                  value={bucket.difficulty}
                  onChange={(event) => {
                    const buckets = [...smartForm.buckets]
                    buckets[index] = { ...bucket, difficulty: event.target.value }
                    setSmartForm({ ...smartForm, buckets })
                  }}
                  options={[{ value: '', label: '不限' }, ...DIFFICULTY_OPTIONS]}
                />
                <TextField
                  label="数量"
                  type="number"
                  value={bucket.count}
                  onChange={(event) => {
                    const buckets = [...smartForm.buckets]
                    buckets[index] = { ...bucket, count: event.target.value }
                    setSmartForm({ ...smartForm, buckets })
                  }}
                />
                <TextField
                  label="每题分值"
                  type="number"
                  placeholder="默认"
                  value={bucket.score}
                  onChange={(event) => {
                    const buckets = [...smartForm.buckets]
                    buckets[index] = { ...bucket, score: event.target.value }
                    setSmartForm({ ...smartForm, buckets })
                  }}
                />
                {smartForm.buckets.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600"
                    onClick={() =>
                      setSmartForm({
                        ...smartForm,
                        buckets: smartForm.buckets.filter((_, position) => position !== index),
                      })
                    }
                  >
                    移除
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={manualOpen}
        title="手动组卷"
        size="xl"
        onClose={() => setManualOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setManualOpen(false)}>
              取消
            </Button>
            <Button loading={composeMutation.isPending} onClick={submitManual}>
              生成试卷（{selected.length} 题）
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="试卷名称"
            value={manualForm.title}
            placeholder="如：八年级物理专题练"
            onChange={(event) => setManualForm({ ...manualForm, title: event.target.value })}
          />
          <SelectField
            label="年级"
            value={manualForm.gradeLevel}
            onChange={(event) => {
              setManualForm({ ...manualForm, gradeLevel: event.target.value })
              setSelected([])
            }}
            options={GRADE_OPTIONS}
          />
          <SelectField
            label="学科"
            value={manualForm.subject}
            onChange={(event) => {
              setManualForm({ ...manualForm, subject: event.target.value })
              setSelected([])
            }}
            options={SUBJECT_OPTIONS}
          />
          <TextField
            label="考试时长（分钟）"
            type="number"
            value={manualForm.durationMinutes}
            onChange={(event) => setManualForm({ ...manualForm, durationMinutes: event.target.value })}
          />
          <TextField
            label="总分（留空按分值合计）"
            type="number"
            value={manualForm.totalScore}
            onChange={(event) => setManualForm({ ...manualForm, totalScore: event.target.value })}
          />
          <div className="flex items-end">
            <Button variant="secondary" fullWidth onClick={() => setPickerOpen(true)}>
              从题库选题（已选 {selected.length}）
            </Button>
          </div>
        </div>
        <TextAreaField
          label="试卷说明"
          rows={2}
          className="mt-3"
          value={manualForm.headerNote}
          onChange={(event) => setManualForm({ ...manualForm, headerNote: event.target.value })}
        />
        {selected.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {selected.map((question) => (
              <li key={question.id} className="truncate">
                · [{labelOf('questionType', question.questionType)}] {question.stem}
                <button
                  type="button"
                  className="ml-2 text-rose-500 hover:underline"
                  onClick={() => setSelected((current) => current.filter((entry) => entry.id !== question.id))}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        open={pickerOpen}
        title={`从题库选题（${labelOf('grade', manualForm.gradeLevel)} · ${labelOf('subject', manualForm.subject)}）`}
        size="xl"
        onClose={() => setPickerOpen(false)}
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setPickerOpen(false)}>完成（已选 {selected.length} 题）</Button>
          </div>
        }
      >
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={pickerWrongOnly}
            onChange={(event) => setPickerWrongOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          只看错题本（错题二次组卷 / 专项练习）
        </label>
        {pickerQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (pickerQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon="📋" title="该范围暂无题目" description="先到题库管理录入或调整年级学科。" />
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {pickerQuery.data?.items.map((question) => {
              const picked = selected.some((entry) => entry.id === question.id)
              return (
                <li key={question.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition',
                      picked ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 hover:border-indigo-200',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, question]
                            : current.filter((entry) => entry.id !== question.id),
                        )
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="min-w-0">
                      <Badge tone="neutral">{labelOf('questionType', question.questionType)}</Badge>{' '}
                      <span className="text-slate-700">{question.stem}</span>
                      <span className="ml-1 text-slate-400">默认 {question.defaultScore} 分</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>
    </div>
  )
}
