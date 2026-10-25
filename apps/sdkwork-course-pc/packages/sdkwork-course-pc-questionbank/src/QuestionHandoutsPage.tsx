import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, NotebookPen, Trash2 } from 'lucide-react'
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
  TextField,
  cn,
  formatRelativeTime,
} from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk } from '@sdkwork/sdkwork-course-pc-core'
import { createQuestionBankService } from './services/QuestionBankService'
import { GRADE_OPTIONS, SUBJECT_OPTIONS, labelOf } from './questionBankTypes'

export function QuestionHandoutsPage() {
  const sdk = useCourseSdk()
  const service = useMemo(() => createQuestionBankService(sdk), [sdk])
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [keyword, setKeyword] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', gradeLevel: 'grade7', subject: 'math', lessonTag: '' })
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [page, setPage] = useState(1)

  const handoutsQuery = useQuery({
    queryKey: ['question-bank-handouts', { keyword, grade, subject, page }],
    queryFn: () =>
      service.listHandouts({
        q: keyword || undefined,
        grade: grade || undefined,
        subject: subject || undefined,
        page,
        pageSize: 20,
      }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      service.saveHandout({
        title: form.title.trim(),
        gradeLevel: form.gradeLevel,
        subject: form.subject,
        lessonTag: form.lessonTag.trim() || undefined,
        body: [
          { type: 'heading', content: form.title.trim() },
          { type: 'text', content: '' },
        ],
      }),
    onSuccess: (handout) => {
      setCreateOpen(false)
      setMessage({ tone: 'ok', text: `讲义《${handout.title}》已创建。` })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-handouts'] })
      navigate(`/questionbank/handouts/${handout.id}`)
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (handoutId: string) => service.deleteHandout(handoutId),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: '讲义已删除。' })
      void queryClient.invalidateQueries({ queryKey: ['question-bank-handouts'] })
    },
    onError: (error: Error) => {
      setMessage({ tone: 'error', text: error.message })
    },
  })

  const handouts = handoutsQuery.data?.items ?? []
  const total = handoutsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div>
      <PageHeader
        title="讲义制作"
        subtitle="按学科、年级、课时编辑图文讲义，一键插入题库例题与课堂练习，导出后直接打印发放。"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <NotebookPen className="h-4 w-4" /> 新建讲义
          </Button>
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
        <StatCard label="讲义总数" value={String(total)} hint="当前筛选范围" />
        <StatCard
          label="数学讲义"
          value={String(handouts.filter((handout) => handout.subject === 'math').length)}
          hint="本页"
        />
        <StatCard
          label="英语讲义"
          value={String(handouts.filter((handout) => handout.subject === 'english').length)}
          hint="本页"
        />
        <StatCard label="本页页码" value={`${page} / ${totalPages}`} hint="每页 20 份" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <TextField
          label="关键词"
          placeholder="标题 / 编号 / 课时"
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
      </div>

      {handoutsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : handouts.length === 0 ? (
        <EmptyState
          icon="📒"
          title="还没有讲义"
          description="新建讲义后即可编辑图文内容并插入题库试题。"
          action={<Button onClick={() => setCreateOpen(true)}>新建讲义</Button>}
        />
      ) : (
        <div className="space-y-3">
          {handouts.map((handout) => (
            <article
              key={handout.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200"
            >
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="violet">
                    <BookOpenCheck className="mr-1 h-3 w-3" /> {labelOf('grade', handout.gradeLevel)} ·{' '}
                    {labelOf('subject', handout.subject)}
                  </Badge>
                  {handout.lessonTag ? <Badge tone="neutral">{handout.lessonTag}</Badge> : null}
                  <span className="text-slate-400">{handout.handoutCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/questionbank/handouts/${handout.id}`)}
                  className="mt-1 text-left text-sm font-semibold text-slate-900 hover:text-indigo-600"
                >
                  {handout.title}
                </button>
                <p className="mt-1 text-xs text-slate-500">
                  {handout.body.length} 个内容块 · 更新于 {formatRelativeTime(handout.updatedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/questionbank/handouts/${handout.id}`)}>
                  编辑讲义
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('text-rose-600 hover:bg-rose-50')}
                  onClick={() => {
                    if (window.confirm(`确定删除讲义《${handout.title}》吗？`)) {
                      deleteMutation.mutate(handout.id)
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
        open={createOpen}
        title="新建讲义"
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => {
                if (!form.title.trim()) {
                  setMessage({ tone: 'error', text: '请填写讲义标题。' })
                  return
                }
                createMutation.mutate()
              }}
            >
              创建并编辑
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="讲义标题"
            value={form.title}
            placeholder="如：有理数运算 讲义（第3课时）"
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <SelectField
            label="年级"
            value={form.gradeLevel}
            onChange={(event) => setForm({ ...form, gradeLevel: event.target.value })}
            options={GRADE_OPTIONS}
          />
          <SelectField
            label="学科"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            options={SUBJECT_OPTIONS}
          />
        </div>
        <TextField
          label="课时标签"
          className="mt-3"
          placeholder="如：第3课时 / 秋季班 A"
          value={form.lessonTag}
          onChange={(event) => setForm({ ...form, lessonTag: event.target.value })}
        />
      </Modal>
    </div>
  )
}
