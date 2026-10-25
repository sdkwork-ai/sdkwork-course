import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookMarked, Plus, Trash2, Upload } from 'lucide-react'
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
} from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { createQuestionBankService } from './services/QuestionBankService'
import {
  DIFFICULTY_OPTIONS,
  GRADE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  SUBJECT_OPTIONS,
  labelOf,
  mapQuestion,
  type Question,
  type QuestionInput,
} from './questionBankTypes'

const PAGE_SIZE = 20

interface QuestionFormState {
  id?: string
  gradeLevel: string
  subject: string
  chapter: string
  knowledgePoints: string
  questionType: string
  stem: string
  options: QuestionOptionDraft[]
  answer: string
  analysis: string
  difficulty: string
  defaultScore: string
  sourceType: string
  sourceRef: string
  tags: string
  wrongBook: boolean
  wrongNote: string
}

interface QuestionOptionDraft {
  key: string
  content: string
}

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice'])

function emptyForm(): QuestionFormState {
  return {
    gradeLevel: 'grade7',
    subject: 'math',
    chapter: '',
    knowledgePoints: '',
    questionType: 'single_choice',
    stem: '',
    options: [
      { key: 'A', content: '' },
      { key: 'B', content: '' },
      { key: 'C', content: '' },
      { key: 'D', content: '' },
    ],
    answer: '',
    analysis: '',
    difficulty: 'medium',
    defaultScore: '2',
    sourceType: 'manual',
    sourceRef: '',
    tags: '',
    wrongBook: false,
    wrongNote: '',
  }
}

function formFromQuestion(question: Question): QuestionFormState {
  const optionTexts = question.options.map((option) => ({
    key: option.key,
    content: option.content,
  }))
  return {
    id: question.id,
    gradeLevel: question.gradeLevel,
    subject: question.subject,
    chapter: question.chapter ?? '',
    knowledgePoints: question.knowledgePoints.join('、'),
    questionType: question.questionType,
    stem: question.stem,
    options:
      CHOICE_TYPES.has(question.questionType) && optionTexts.length > 0
        ? optionTexts
        : [
            { key: 'A', content: '' },
            { key: 'B', content: '' },
            { key: 'C', content: '' },
            { key: 'D', content: '' },
          ],
    answer: question.answer,
    analysis: question.analysis ?? '',
    difficulty: question.difficulty,
    defaultScore: question.defaultScore,
    sourceType: question.sourceType,
    sourceRef: question.sourceRef ?? '',
    tags: question.tags.join('、'),
    wrongBook: question.wrongBook,
    wrongNote: question.wrongNote ?? '',
  }
}

function formToPayload(form: QuestionFormState): QuestionInput {
  const splitList = (raw: string) =>
    raw
      .split(/[、,，;；\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  return {
    id: form.id,
    gradeLevel: form.gradeLevel,
    subject: form.subject,
    chapter: form.chapter.trim() || undefined,
    knowledgePoints: splitList(form.knowledgePoints),
    questionType: form.questionType,
    stem: form.stem.trim(),
    options: CHOICE_TYPES.has(form.questionType)
      ? form.options.filter((option) => option.content.trim().length > 0)
      : [],
    answer: form.answer.trim(),
    analysis: form.analysis.trim() || undefined,
    difficulty: form.difficulty,
    defaultScore: form.defaultScore || '0',
    sourceType: form.sourceType,
    sourceRef: form.sourceRef.trim() || undefined,
    tags: splitList(form.tags),
    wrongBook: form.wrongBook,
    wrongNote: form.wrongNote.trim() || undefined,
    status: 'active',
  }
}

function questionTypeTone(questionType: string): 'violet' | 'warning' | 'success' | 'neutral' {
  if (questionType === 'single_choice' || questionType === 'multi_choice') return 'violet'
  if (questionType === 'fill_blank' || questionType === 'true_false') return 'success'
  if (questionType === 'analysis') return 'warning'
  return 'neutral'
}

export function QuestionBankPage() {
  const sdk = useCourseSdk()
  const service = useMemo(() => createQuestionBankService(sdk), [sdk])
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [questionType, setQuestionType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [source, setSource] = useState('')
  const [wrongOnly, setWrongOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<QuestionFormState>(emptyForm)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const questionsQuery = useQuery({
    queryKey: [
      'question-bank-questions',
      { keyword, grade, subject, questionType, difficulty, source, wrongOnly, page },
    ],
    queryFn: () =>
      service.listQuestions({
        q: keyword || undefined,
        grade: grade || undefined,
        subject: subject || undefined,
        questionType: questionType || undefined,
        difficulty: difficulty || undefined,
        source: source || undefined,
        wrongBook: wrongOnly ? true : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  const taxonomyQuery = useQuery({
    queryKey: ['question-bank-taxonomy'],
    queryFn: () => service.retrieveTaxonomy(),
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: QuestionInput) => service.saveQuestion(payload),
    onSuccess: () => {
      setEditorOpen(false)
      setMessage({
        tone: 'ok',
        text: form.id ? '题目已更新。' : '题目已录入。',
      })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (questionId: string) => service.deleteQuestion(questionId),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: '题目已删除。' })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const wrongBookMutation = useMutation({
    mutationFn: (input: { question: Question; wrong: boolean }) =>
      service.saveQuestion({
        id: input.question.id,
        gradeLevel: input.question.gradeLevel,
        subject: input.question.subject,
        chapter: input.question.chapter,
        knowledgePoints: input.question.knowledgePoints,
        questionType: input.question.questionType,
        stem: input.question.stem,
        options: input.question.options,
        answer: input.question.answer,
        analysis: input.question.analysis,
        difficulty: input.question.difficulty,
        defaultScore: input.question.defaultScore,
        sourceType: input.question.sourceType,
        sourceRef: input.question.sourceRef,
        tags: input.question.tags,
        wrongBook: input.wrong,
        wrongNote: input.wrong ? input.question.wrongNote ?? '教师标记错题' : undefined,
        status: 'active',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const parsed = JSON.parse(importText) as unknown
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      return service.importQuestions(
        rows.map((row) => mapQuestion(row) as unknown as QuestionInput),
      )
    },
    onSuccess: (outcome) => {
      const failureText =
        outcome.failed.length > 0
          ? `${outcome.failed.length} 条失败：${outcome.failed
              .slice(0, 3)
              .map((failure) => `第${failure.index + 1}条 ${failure.reason}`)
              .join('；')}`
          : ''
      setMessage({
        tone: outcome.failed.length > 0 ? 'error' : 'ok',
        text: `导入完成：成功 ${outcome.accepted} 条。${failureText}`,
      })
      setImportOpen(false)
      setImportText('')
      void queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: `导入失败：${error.message}` })
    },
  })

  const batchWrongBookMutation = useMutation({
    mutationFn: (input: { ids: string[]; wrong: boolean }) =>
      service.updateQuestionsBatch({
        questionIds: input.ids,
        wrongBook: input.wrong,
        wrongNote: input.wrong ? '教师批量标记错题' : undefined,
      }),
    onSuccess: (_result, input) => {
      setSelectedIds([])
      setMessage({
        tone: 'ok',
        text: input.wrong
          ? `已把 ${input.ids.length} 道题加入错题本。`
          : `已把 ${input.ids.length} 道题移出错题本。`,
      })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => service.deleteQuestionsBatch(ids),
    onSuccess: (outcome) => {
      setSelectedIds([])
      const failureText =
        outcome.failed.length > 0
          ? `${outcome.failed.length} 道失败：${outcome.failed
              .slice(0, 3)
              .map((failure) => failure.reason)
              .join('；')}`
          : ''
      setMessage({
        tone: outcome.failed.length > 0 ? 'error' : 'ok',
        text: `批量删除完成：成功 ${outcome.deleted.length} 道。${failureText}`,
      })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-questions'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const toggleSelected = (questionId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? current.includes(questionId)
          ? current
          : [...current, questionId]
        : current.filter((entry) => entry !== questionId),
    )
  }

  const subjectSuggestions = useMemo(() => {
    const known = new Set(SUBJECT_OPTIONS.map((option) => option.value))
    const extra = (taxonomyQuery.data?.subjects ?? [])
      .map((entry) => entry.value)
      .filter((value) => value && !known.has(value))
    return [...SUBJECT_OPTIONS, ...extra.map((value) => ({ value, label: value }))]
  }, [taxonomyQuery.data])

  const chapterSuggestions = (taxonomyQuery.data?.chapters ?? []).map((entry) => entry.value)
  const knowledgePointSuggestions = (taxonomyQuery.data?.knowledgePoints ?? []).map((entry) => entry.value)

  const items = questionsQuery.data?.items ?? []
  const total = questionsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openCreate = () => {
    setForm(emptyForm())
    setEditorOpen(true)
  }

  const openEdit = (question: Question) => {
    setForm(formFromQuestion(question))
    setEditorOpen(true)
  }

  const submitForm = () => {
    if (!form.stem.trim()) {
      setMessage({ tone: 'error', text: '题干不能为空。' })
      return
    }
    if (CHOICE_TYPES.has(form.questionType) && !form.answer.trim()) {
      setMessage({ tone: 'error', text: '选择题需要填写答案。' })
      return
    }
    saveMutation.mutate(formToPayload(form))
  }

  return (
    <div>
      <PageHeader
        title="题库管理"
        subtitle="按年级、学科、章节与知识点组织试题，支持错题收藏与批量导入。"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> 批量导入
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> 录入试题
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
        <StatCard label="题库总数" value={String(total)} hint="当前筛选范围" />
        <StatCard
          label="错题收藏"
          value={String(items.filter((item) => item.wrongBook).length)}
          hint="本页"
        />
        <StatCard
          label="真题数量"
          value={String(items.filter((item) => item.sourceType === 'real_exam').length)}
          hint="本页"
        />
        <StatCard
          label="当前页码"
          value={`${page} / ${totalPages}`}
          hint={`每页 ${PAGE_SIZE} 题`}
        />
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <TextField
            label="关键词"
            placeholder="题干 / 答案 / 编号"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value)
              setPage(1)
            }}
          />
          <SelectField
            label="年级"
            value={grade}
            onChange={(event) => {
              setGrade(event.target.value)
              setPage(1)
            }}
            options={[{ value: '', label: '全部年级' }, ...GRADE_OPTIONS]}
          />
          <SelectField
            label="学科"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value)
              setPage(1)
            }}
            options={[{ value: '', label: '全部学科' }, ...SUBJECT_OPTIONS]}
          />
          <SelectField
            label="题型"
            value={questionType}
            onChange={(event) => {
              setQuestionType(event.target.value)
              setPage(1)
            }}
            options={[{ value: '', label: '全部题型' }, ...QUESTION_TYPE_OPTIONS]}
          />
          <SelectField
            label="难度"
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value)
              setPage(1)
            }}
            options={[{ value: '', label: '全部难度' }, ...DIFFICULTY_OPTIONS]}
          />
          <SelectField
            label="来源"
            value={source}
            onChange={(event) => {
              setSource(event.target.value)
              setPage(1)
            }}
            options={[{ value: '', label: '全部来源' }, ...SOURCE_TYPE_OPTIONS]}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={wrongOnly}
            onChange={(event) => {
              setWrongOnly(event.target.checked)
              setPage(1)
            }}
            className="h-4 w-4 rounded border-slate-300"
          />
          <BookMarked className="h-4 w-4 text-amber-500" />
          只看错题本（可二次组卷、专项练习）
        </label>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
          <span className="text-sm font-semibold text-indigo-800">
            已选 {selectedIds.length} 题
          </span>
          <span className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            loading={batchWrongBookMutation.isPending}
            onClick={() => batchWrongBookMutation.mutate({ ids: selectedIds, wrong: true })}
          >
            <BookMarked className="h-4 w-4" /> 加入错题本
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={batchWrongBookMutation.isPending}
            onClick={() => batchWrongBookMutation.mutate({ ids: selectedIds, wrong: false })}
          >
            移出错题本
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={batchDeleteMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `确定删除选中的 ${selectedIds.length} 道题吗？被试卷或讲义引用的题目会跳过并逐条说明原因。`,
                )
              ) {
                batchDeleteMutation.mutate(selectedIds)
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> 删除所选
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            取消选择
          </Button>
        </div>
      ) : null}

      {questionsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📋"
          title="题库为空"
          description="录入第一道试题，或从现有题库批量导入。"
          action={<Button onClick={openCreate}>录入试题</Button>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((question) => (
            <article
              key={question.id}
              className={
                selectedIds.includes(question.id)
                  ? 'rounded-2xl border border-indigo-300 bg-indigo-50/40 p-4 transition'
                  : 'rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200'
              }
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  aria-label={`选择题目 ${question.questionCode}`}
                  checked={selectedIds.includes(question.id)}
                  onChange={(event) => toggleSelected(question.id, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Badge tone={questionTypeTone(question.questionType)}>
                  {labelOf('questionType', question.questionType)}
                </Badge>
                <Badge tone="neutral">
                  {labelOf('grade', question.gradeLevel)} · {labelOf('subject', question.subject)}
                </Badge>
                <Badge
                  tone={
                    question.difficulty === 'easy'
                      ? 'success'
                      : question.difficulty === 'hard'
                        ? 'warning'
                        : 'violet'
                  }
                >
                  {labelOf('difficulty', question.difficulty)}
                </Badge>
                {question.wrongBook ? <Badge tone="warning">错题本</Badge> : null}
                {question.sourceType === 'real_exam' ? (
                  <Badge tone="violet">真题{question.sourceRef ? ` · ${question.sourceRef}` : ''}</Badge>
                ) : null}
                <span className="text-slate-400">{question.questionCode}</span>
                {question.chapter ? (
                  <span className="text-slate-400">章节：{question.chapter}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">{question.stem}</p>
              {question.options.length > 0 ? (
                <div className="mt-1 grid grid-cols-1 gap-x-6 text-xs text-slate-500 sm:grid-cols-2">
                  {question.options.map((option) => (
                    <span key={option.key}>
                      {option.key}. {option.content}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>答案：{question.answer}</span>
                {question.analysis ? (
                  <span className="max-w-xl truncate">解析：{question.analysis}</span>
                ) : null}
                {question.knowledgePoints.length > 0 ? (
                  <span>知识点：{question.knowledgePoints.join('、')}</span>
                ) : null}
                <span>默认分值：{question.defaultScore}</span>
                {question.tags.length > 0 ? <span>标签：{question.tags.join('、')}</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(question)}>
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={wrongBookMutation.isPending}
                  onClick={() =>
                    wrongBookMutation.mutate({
                      question,
                      wrong: !question.wrongBook,
                    })
                  }
                >
                  {question.wrongBook ? '移出错题本' : '加入错题本'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('text-rose-600 hover:bg-rose-50')}
                  loading={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm('确定删除这道试题吗？')) {
                      deleteMutation.mutate(question.id)
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
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-slate-500">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            下一页
          </Button>
        </div>
      ) : null}

      <Modal
        open={editorOpen}
        title={form.id ? '编辑试题' : '录入试题'}
        size="xl"
        onClose={() => setEditorOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button loading={saveMutation.isPending} onClick={submitForm}>
              保存
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField
            label="年级"
            value={form.gradeLevel}
            onChange={(event) => setForm({ ...form, gradeLevel: event.target.value })}
            options={GRADE_OPTIONS}
          />
          <div>
            <TextField
              label="学科（可输入新学科）"
              list="qb-subject-list"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
            <datalist id="qb-subject-list">
              {subjectSuggestions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <TextField
              label="章节（可输入新章节）"
              list="qb-chapter-list"
              placeholder="如：第一章 有理数"
              value={form.chapter}
              onChange={(event) => setForm({ ...form, chapter: event.target.value })}
            />
            <datalist id="qb-chapter-list">
              {chapterSuggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>
          <SelectField
            label="题型"
            value={form.questionType}
            onChange={(event) => setForm({ ...form, questionType: event.target.value })}
            options={QUESTION_TYPE_OPTIONS}
          />
          <SelectField
            label="难度"
            value={form.difficulty}
            onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
            options={DIFFICULTY_OPTIONS}
          />
          <TextField
            label="默认分值"
            type="number"
            step="0.5"
            value={form.defaultScore}
            onChange={(event) => setForm({ ...form, defaultScore: event.target.value })}
          />
        </div>
        <TextAreaField
          label="题干"
          rows={3}
          className="mt-3"
          placeholder="填空处使用下划线 ______ 表示"
          value={form.stem}
          onChange={(event) => setForm({ ...form, stem: event.target.value })}
        />
        {CHOICE_TYPES.has(form.questionType) ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">选项</p>
            {form.options.map((option, index) => (
              <div key={option.key} className="flex items-center gap-2">
                <span className="w-6 text-sm font-semibold text-slate-500">{option.key}.</span>
                <TextField
                  value={option.content}
                  onChange={(event) => {
                    const options = [...form.options]
                    options[index] = { ...option, content: event.target.value }
                    setForm({ ...form, options })
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="答案"
            placeholder={CHOICE_TYPES.has(form.questionType) ? '如：A 或 ABD' : '参考答案'}
            value={form.answer}
            onChange={(event) => setForm({ ...form, answer: event.target.value })}
          />
          <div>
            <TextField
              label="知识点（可输入新知识点，顿号分隔）"
              list="qb-knowledge-list"
              placeholder="多个用顿号分隔"
              value={form.knowledgePoints}
              onChange={(event) => setForm({ ...form, knowledgePoints: event.target.value })}
            />
            <datalist id="qb-knowledge-list">
              {knowledgePointSuggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>
          <TextAreaField
            label="解析"
            rows={2}
            value={form.analysis}
            onChange={(event) => setForm({ ...form, analysis: event.target.value })}
          />
          <div className="space-y-2">
            <TextField
              label="标签"
              placeholder="如：易错题、专题一"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="来源"
                value={form.sourceType}
                onChange={(event) => setForm({ ...form, sourceType: event.target.value })}
                options={SOURCE_TYPE_OPTIONS}
              />
              <TextField
                label="来源说明"
                placeholder="真题出处（可选）"
                value={form.sourceRef}
                onChange={(event) => setForm({ ...form, sourceRef: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.wrongBook}
                onChange={(event) => setForm({ ...form, wrongBook: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              收入错题本
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="批量导入试题"
        size="xl"
        onClose={() => setImportOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button loading={importMutation.isPending} onClick={() => importMutation.mutate()}>
              开始导入
            </Button>
          </div>
        }
      >
        <p className="mb-2 text-xs text-slate-500">
          粘贴 JSON 数组，每条包含 gradeLevel、subject、questionType、stem 等字段（与录表单一致，支持 options/knowledgePoints/tags 数组）。单次最多 500 条。
        </p>
        <TextAreaField
          rows={12}
          value={importText}
          placeholder={'[\n  {\n    "gradeLevel": "grade7",\n    "subject": "math",\n    "questionType": "fill_blank",\n    "stem": "|-3| = ______",\n    "answer": "3"\n  }\n]'}
          onChange={(event) => setImportText(event.target.value)}
        />
      </Modal>
    </div>
  )
}
