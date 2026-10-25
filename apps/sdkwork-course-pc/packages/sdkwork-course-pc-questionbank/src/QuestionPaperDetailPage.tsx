import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileDown, Printer, Shuffle } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Notice,
  PageHeader,
  formatRelativeTime,
} from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { createQuestionBankService } from './services/QuestionBankService'
import { downloadPaperWord, printPaper } from './exportDocument'
import { SECTION_LABELS, formatDuration, labelOf } from './questionBankTypes'

const SECTION_TITLES: Record<string, string> = {
  single_choice: '单项选择题',
  multi_choice: '多项选择题',
  true_false: '判断题',
  fill_blank: '填空题',
  solution: '解答题',
  analysis: '辨析题',
}

export function QuestionPaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>()
  const sdk = useCourseSdk()
  const service = useMemo(() => createQuestionBankService(sdk), [sdk])
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const paperQuery = useQuery({
    queryKey: ['question-bank-paper', paperId],
    queryFn: () => service.retrievePaper(paperId ?? ''),
    enabled: Boolean(paperId),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => service.archivePaper(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['question-bank-paper', paperId] })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-papers'] })
    },
  })

  if (paperQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  if (!paperQuery.data) {
    return (
      <EmptyState
        icon="🧪"
        title="试卷不存在"
        description="可能已被删除。"
        action={<Button onClick={() => navigate('/questionbank/papers')}>返回组卷中心</Button>}
      />
    )
  }

  const paper = paperQuery.data
  const sections = new Map<string, typeof paper.items>()
  for (const item of paper.items) {
    const bucket = sections.get(item.sectionNo) ?? []
    bucket.push(item)
    sections.set(item.sectionNo, bucket)
  }
  const sectionOrder = [...sections.keys()].sort((a, b) => Number(a) - Number(b))

  return (
    <div>
      <PageHeader
        title={paper.title}
        subtitle={`${labelOf('grade', paper.gradeLevel)} · ${labelOf('subject', paper.subject)} · 共 ${paper.questionCount} 题 · 总分 ${paper.totalScore} 分 · 考试时长 ${formatDuration(paper.examDurationSeconds)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/questionbank/papers')}>
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
            <Button variant="secondary" onClick={() => printPaper(paper, false)}>
              <Printer className="h-4 w-4" /> 打印 / 导出 PDF
            </Button>
            <Button variant="secondary" onClick={() => downloadPaperWord(paper, false)}>
              <FileDown className="h-4 w-4" /> 导出 Word
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/questionbank/papers?remix=${paper.id}`)}
              title="以这份试卷的题型配比重新随机抽题生成新卷"
            >
              <Shuffle className="h-4 w-4" /> 以此配比重出卷
            </Button>
            <Button onClick={() => printPaper(paper, true)}>打印含答案版</Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={paper.paperMode === 'smart' ? 'violet' : 'neutral'}>
          {paper.paperMode === 'smart' ? '智能组卷' : '手动组卷'}
        </Badge>
        <Badge tone={paper.paperStatus === 'archived' ? 'success' : 'warning'}>
          {paper.paperStatus === 'archived' ? '已归档' : '编辑中'}
        </Badge>
        <span className="text-slate-400">{paper.paperCode}</span>
        <span className="text-slate-400">更新于 {formatRelativeTime(paper.updatedAt)}</span>
        {paper.paperStatus !== 'archived' ? (
          <Button
            variant="ghost"
            size="sm"
            loading={archiveMutation.isPending}
            onClick={() => archiveMutation.mutate(paper.id)}
          >
            归档存档
          </Button>
        ) : null}
      </div>

      <Notice
        tone="info"
        title="排版说明"
      >
        打印视图自带密封线与班级/姓名/学号填写栏；「打印 / 导出 PDF」走浏览器打印对话框，选择「另存为 PDF」即可；导出 Word 生成 .doc 文件，可直接用 Word 打开微调排版。
        className="mb-4"
      </Notice>

      {paper.headerNote ? (
        <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{paper.headerNote}</p>
      ) : null}

      <article className="rounded-2xl border border-slate-200 bg-white p-6 print-doc-preview">
        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold tracking-wide">{paper.title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {labelOf('grade', paper.gradeLevel)} · {labelOf('subject', paper.subject)}　考试时长：
            {formatDuration(paper.examDurationSeconds)}　总分：{paper.totalScore} 分
          </p>
        </div>
        {paper.sealedLine ? (
          <div className="mb-5 flex justify-between rounded-lg border border-dashed border-slate-400 px-4 py-2 text-xs text-slate-600">
            <span>班级：____________</span>
            <span>姓名：____________</span>
            <span>学号：____________</span>
            <span className="hidden sm:inline">✂—————— 密封线内不得答题 ——————✂</span>
          </div>
        ) : null}

        {sectionOrder.length === 0 ? (
          <EmptyState icon="📄" title="试卷为空" description="该试卷还没有题目。" />
        ) : (
          (() => {
            let questionCounter = 0
            return sectionOrder.map((sectionNo, sectionIndex) => {
            const items = sections.get(sectionNo) ?? []
            const questionType = items[0]?.question?.questionType ?? ''
            const subtotal = items.reduce((sum, item) => sum + (Number(item.score) || 0), 0)
            return (
              <section key={sectionNo} className="mb-5">
                <h3 className="mb-2 text-sm font-bold">
                  {SECTION_LABELS[sectionIndex] ?? sectionNo}、
                  {SECTION_TITLES[questionType] ?? '试题'}（共 {items.length} 题，{subtotal} 分）
                </h3>
                <ol className="space-y-3">
                  {items.map((item) => {
                    questionCounter += 1
                    return (
                    <li key={`${item.questionId}-${questionCounter}`} className="text-sm leading-relaxed">
                      <span className="whitespace-pre-wrap">
                        {questionCounter}. {item.question?.stem ?? '（题目已被删除）'}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">（{item.score} 分）</span>
                      {item.question && item.question.options.length > 0 ? (
                        <div className="mt-1 grid grid-cols-1 gap-x-8 pl-6 text-sm text-slate-700 sm:grid-cols-2">
                          {item.question.options.map((option) => (
                            <span key={option.key}>
                              {option.key}. {option.content}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                    )
                  })}
                </ol>
              </section>
            )
            })
          })()
        )}
      </article>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-bold">参考答案与解析（仅教师端可见，不进入打印卷面）</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          {paper.items.map((item, index) => (
            <li key={`answer-${item.questionId}-${index}`}>
              {index + 1}. {item.question?.answer ?? '—'}
              {item.question?.analysis ? (
                <span className="ml-2 text-xs text-slate-500">解析：{item.question.analysis}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
