import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileDown, Heading1, ListPlus, NotebookText, Printer, Save, Sparkles } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Modal,
  Notice,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
} from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { createQuestionBankService } from './services/QuestionBankService'
import { downloadHandoutWord, printHandout } from './exportDocument'
import {
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  SUBJECT_OPTIONS,
  labelOf,
  type HandoutBlock,
  type HandoutBlockType,
  type Question,
} from './questionBankTypes'

const BLOCK_TYPE_LABELS: Record<HandoutBlockType, string> = {
  heading: '标题',
  text: '正文',
  summary: '知识点总结',
  question: '试题',
}

export function QuestionHandoutEditorPage() {
  const { handoutId } = useParams<{ handoutId: string }>()
  const sdk = useCourseSdk()
  const service = useMemo(() => createQuestionBankService(sdk), [sdk])
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [blocks, setBlocks] = useState<HandoutBlock[] | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerType, setPickerType] = useState('')
  const [pickerDifficulty, setPickerDifficulty] = useState('')
  const [pickerWrongOnly, setPickerWrongOnly] = useState(false)

  const handoutQuery = useQuery({
    queryKey: ['question-bank-handout', handoutId],
    queryFn: () => service.retrieveHandout(handoutId ?? ''),
    enabled: Boolean(handoutId),
  })

  const handout = handoutQuery.data
  const currentBlocks = blocks ?? handout?.body ?? []

  const saveMutation = useMutation({
    mutationFn: () =>
      service.saveHandout({
        id: handout?.id,
        title: handout?.title ?? '',
        gradeLevel: handout?.gradeLevel ?? 'grade7',
        subject: handout?.subject ?? 'math',
        lessonTag: handout?.lessonTag,
        body: currentBlocks,
        status: handout?.status ?? 'active',
      }),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: '讲义已保存。' })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-handout', handoutId] })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-handouts'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const pickerQuery = useQuery({
    queryKey: [
      'question-bank-handout-picker',
      handout?.gradeLevel,
      handout?.subject,
      pickerType,
      pickerDifficulty,
      pickerWrongOnly,
    ],
    queryFn: () =>
      service.listQuestions({
        grade: handout?.gradeLevel,
        subject: handout?.subject,
        questionType: pickerType || undefined,
        difficulty: pickerDifficulty || undefined,
        wrongBook: pickerWrongOnly || undefined,
        page: 1,
        pageSize: 100,
      }),
    enabled: pickerOpen,
  })

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>()
    for (const item of handout?.items ?? []) {
      if (item.question) map.set(item.questionId, item.question)
    }
    for (const question of pickerQuery.data?.items ?? []) {
      if (!map.has(question.id)) map.set(question.id, question)
    }
    return map
  }, [handout, pickerQuery.data])

  if (handoutQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  if (!handout) {
    return (
      <EmptyState
        icon="📒"
        title="讲义不存在"
        description="可能已被删除。"
        action={<Button onClick={() => navigate('/questionbank/handouts')}>返回讲义列表</Button>}
      />
    )
  }

  const addBlock = (type: HandoutBlockType) => {
    setBlocks([
      ...currentBlocks,
      type === 'question' ? { type, questionId: '', usageRole: 'practice' } : { type, content: '' },
    ])
  }

  const updateBlock = (index: number, next: HandoutBlock) => {
    setBlocks(currentBlocks.map((block, position) => (position === index ? next : block)))
  }

  const moveBlock = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= currentBlocks.length) return
    const next = [...currentBlocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setBlocks(next)
  }

  const insertQuestion = (question: Question, usageRole: string) => {
    setBlocks([...currentBlocks, { type: 'question', questionId: question.id, usageRole }])
  }

  return (
    <div>
      <PageHeader
        title={handout.title}
        subtitle={`${labelOf('grade', handout.gradeLevel)} · ${labelOf('subject', handout.subject)}${handout.lessonTag ? ` · ${handout.lessonTag}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/questionbank/handouts')}>
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
            <Button variant="secondary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save className="h-4 w-4" /> 保存
            </Button>
            <Button
              variant="secondary"
              onClick={() => printHandout({ ...handout, body: currentBlocks }, questionsById)}
            >
              <Printer className="h-4 w-4" /> 打印 / 导出 PDF
            </Button>
            <Button onClick={() => downloadHandoutWord({ ...handout, body: currentBlocks }, questionsById)}>
              <FileDown className="h-4 w-4" /> 导出 Word
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

      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <Button variant="secondary" size="sm" onClick={() => addBlock('heading')}>
          <Heading1 className="h-4 w-4" /> 标题
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addBlock('text')}>
          <NotebookText className="h-4 w-4" /> 正文
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addBlock('summary')}>
          <Sparkles className="h-4 w-4" /> 知识点总结
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
          <ListPlus className="h-4 w-4" /> 从题库插入试题
        </Button>
      </div>

      {currentBlocks.length === 0 ? (
        <EmptyState icon="✍️" title="讲义为空" description="添加标题、正文，或从题库插入例题与课堂练习。" />
      ) : (
        <div className="space-y-3">
          {currentBlocks.map((block, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={block.type === 'question' ? 'violet' : 'neutral'}>
                  {BLOCK_TYPE_LABELS[block.type]}
                </Badge>
                {block.type === 'question' && block.usageRole === 'example' ? (
                  <Badge tone="warning">例题</Badge>
                ) : null}
                {block.type === 'question' && block.usageRole === 'practice' ? (
                  <Badge tone="success">课堂练习</Badge>
                ) : null}
                <span className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => moveBlock(index, -1)}>
                  上移
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveBlock(index, 1)}>
                  下移
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600"
                  onClick={() => setBlocks(currentBlocks.filter((_, position) => position !== index))}
                >
                  删除
                </Button>
              </div>
              {block.type === 'question' ? (
                <div>
                  {block.questionId && questionsById.get(block.questionId) ? (
                    <p className="rounded-xl bg-indigo-50/50 p-2.5 text-sm text-slate-700">
                      <Badge tone="violet">{labelOf('questionType', questionsById.get(block.questionId)?.questionType ?? '')}</Badge>{' '}
                      {questionsById.get(block.questionId)?.stem}
                      <span className="mt-1 block text-xs text-slate-500">
                        答案：{questionsById.get(block.questionId)?.answer}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">尚未选择试题，请删除该块后重新从题库插入。</p>
                  )}
                </div>
              ) : (
                <TextAreaField
                  rows={block.type === 'heading' ? 1 : 3}
                  value={block.content ?? ''}
                  placeholder={
                    block.type === 'heading'
                      ? '标题文字'
                      : block.type === 'summary'
                        ? '本讲知识点总结...'
                        : '正文内容...'
                  }
                  onChange={(event) => updateBlock(index, { ...block, content: event.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <Notice
        tone="info"
        title="导出说明"
      >
        讲义按学科/年级/课时自动归档；打印走浏览器「另存为 PDF」，Word 为 .doc 文件；试题块同时输出答案与解析，适合课堂使用。
        className="mt-6"
      </Notice>

      <Modal
        open={pickerOpen}
        title="从题库插入试题"
        size="xl"
        onClose={() => setPickerOpen(false)}
        footer={<div className="flex justify-end"><Button onClick={() => setPickerOpen(false)}>完成</Button></div>}
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          <SelectField
            label="题型"
            value={pickerType}
            onChange={(event) => setPickerType(event.target.value)}
            options={[{ value: '', label: '全部题型' }, ...QUESTION_TYPE_OPTIONS]}
          />
          <SelectField
            label="难度"
            value={pickerDifficulty}
            onChange={(event) => setPickerDifficulty(event.target.value)}
            options={[{ value: '', label: '全部难度' }, ...DIFFICULTY_OPTIONS]}
          />
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={pickerWrongOnly}
            onChange={(event) => setPickerWrongOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          只看错题本（讲义专项讲评错题）
        </label>
        {pickerQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {pickerQuery.data?.items.map((question) => (
              <li key={question.id} className="rounded-xl border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-slate-700">
                    <Badge tone="neutral">{labelOf('questionType', question.questionType)}</Badge> {question.stem}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => insertQuestion(question, 'example')}
                    >
                      插为例题
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => insertQuestion(question, 'practice')}
                    >
                      插为练习
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}

