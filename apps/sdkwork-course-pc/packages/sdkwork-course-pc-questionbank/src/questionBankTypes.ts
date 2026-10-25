// Question bank domain types, option catalogs, and tolerant row mappers.

export interface QuestionOption {
  key: string
  content: string
}

export interface Question {
  id: string
  questionCode: string
  gradeLevel: string
  subject: string
  chapter?: string
  knowledgePoints: string[]
  questionType: string
  stem: string
  options: QuestionOption[]
  answer: string
  analysis?: string
  difficulty: string
  defaultScore: string
  sourceType: string
  sourceRef?: string
  tags: string[]
  wrongBook: boolean
  wrongNote?: string
  ownerUserId?: string
  status: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface QuestionPage {
  items: Question[]
  page: number
  pageSize: number
  total: number
}

export interface PaperItem {
  questionId: string
  sectionNo: string
  sortOrder: number
  score: string
  question?: Question | null
}

export interface PaperScoreAllocationEntry {
  sectionNo: string
  questionType: string
  count: number
  subtotal: string
}

export interface Paper {
  id: string
  paperCode: string
  title: string
  gradeLevel: string
  subject: string
  paperMode: string
  examDurationSeconds: number
  totalScore: string
  scope: Record<string, unknown>
  scoreAllocation: PaperScoreAllocationEntry[]
  headerNote?: string
  sealedLine: boolean
  paperStatus: string
  archivedAt?: string
  ownerUserId?: string
  questionCount: number
  items: PaperItem[]
  createdAt: string
  updatedAt: string
  version: number
}

export type HandoutBlockType = 'heading' | 'text' | 'summary' | 'question'

export interface HandoutBlock {
  type: HandoutBlockType
  content?: string
  questionId?: string
  usageRole?: string
}

export interface HandoutItem {
  questionId: string
  sortOrder: number
  usageRole: string
  question?: Question | null
}

export interface Handout {
  id: string
  handoutCode: string
  title: string
  gradeLevel: string
  subject: string
  lessonTag?: string
  body: HandoutBlock[]
  ownerUserId?: string
  status: string
  createdAt: string
  updatedAt: string
  version: number
  items?: HandoutItem[]
}

export interface TaxonomyEntry {
  value: string
  count: number
  subject?: string
}

export interface Taxonomy {
  grades: TaxonomyEntry[]
  subjects: TaxonomyEntry[]
  chapters: TaxonomyEntry[]
  knowledgePoints: TaxonomyEntry[]
  questionTypes: TaxonomyEntry[]
  difficulties: TaxonomyEntry[]
  tags: TaxonomyEntry[]
}

export interface ComposeBucketInput {
  questionType: string
  difficulty?: string
  count: number
  score?: string
}

export interface ComposePaperInput {
  mode: 'smart' | 'manual'
  title: string
  gradeLevel: string
  subject: string
  examDurationSeconds?: number
  totalScore?: string
  headerNote?: string
  sealedLine?: boolean
  scope?: {
    chapters?: string[]
    knowledgePoints?: string[]
    excludeQuestionIds?: string[]
    buckets?: ComposeBucketInput[]
  }
  items?: Array<{ questionId: string; score?: string }>
}

export interface QuestionInput {
  id?: string
  questionCode?: string
  gradeLevel: string
  subject: string
  chapter?: string
  knowledgePoints?: string[]
  questionType: string
  stem: string
  options?: QuestionOption[]
  answer?: string
  analysis?: string
  difficulty?: string
  defaultScore?: string
  sourceType?: string
  sourceRef?: string
  tags?: string[]
  wrongBook?: boolean
  wrongNote?: string
  status?: string
}

export const GRADE_OPTIONS = [
  { value: 'grade7', label: '七年级' },
  { value: 'grade8', label: '八年级' },
  { value: 'grade9', label: '九年级' },
]

export const SUBJECT_OPTIONS = [
  { value: 'math', label: '数学' },
  { value: 'english', label: '英语' },
  { value: 'history', label: '历史' },
  { value: 'geography', label: '地理' },
  { value: 'biology', label: '生物' },
]

export const QUESTION_TYPE_OPTIONS = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multi_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'solution', label: '解答题' },
  { value: 'analysis', label: '辨析题' },
]

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '较难' },
]

export const SOURCE_TYPE_OPTIONS = [
  { value: 'manual', label: '自编' },
  { value: 'import', label: '批量导入' },
  { value: 'real_exam', label: '真题' },
]

export const SECTION_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八']

const OPTION_SETS = {
  grade: GRADE_OPTIONS,
  subject: SUBJECT_OPTIONS,
  questionType: QUESTION_TYPE_OPTIONS,
  difficulty: DIFFICULTY_OPTIONS,
  sourceType: SOURCE_TYPE_OPTIONS,
} as const

export function labelOf(
  set: keyof typeof OPTION_SETS,
  value: string | null | undefined,
): string {
  if (!value) return '—'
  return OPTION_SETS[set].find((option) => option.value === value)?.label ?? value
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '不限'
  const minutes = Math.round(seconds / 60)
  return `${minutes} 分钟`
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = record[key]
    if (typeof raw === 'string' && raw.length > 0) return raw
  }
  return ''
}

function readStringList(record: Record<string, unknown>, key: string): string[] {
  const raw = record[key]
  if (Array.isArray(raw)) return raw.filter((entry): entry is string => typeof entry === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string')
      }
    } catch {
      return []
    }
  }
  return []
}

function readOptionList(record: Record<string, unknown>, key: string): QuestionOption[] {
  const raw = record[key]
  let entries: unknown[] = []
  if (Array.isArray(raw)) entries = raw
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) entries = parsed
    } catch {
      entries = []
    }
  }
  return entries
    .map((entry) => {
      const option = asRecord(entry)
      return {
        key: String(option.key ?? ''),
        content: String(option.content ?? ''),
      }
    })
    .filter((option) => option.content.length > 0)
}

export function mapQuestion(value: unknown): Question {
  const record = asRecord(value)
  return {
    id: readString(record, 'id'),
    questionCode: readString(record, 'questionCode', 'question_code'),
    gradeLevel: readString(record, 'gradeLevel', 'grade_level'),
    subject: readString(record, 'subject'),
    chapter: typeof record.chapter === 'string' ? record.chapter : undefined,
    knowledgePoints: readStringList(record, 'knowledgePoints'),
    questionType: readString(record, 'questionType', 'question_type'),
    stem: readString(record, 'stem'),
    options: readOptionList(record, 'options'),
    answer: readString(record, 'answer'),
    analysis: typeof record.analysis === 'string' ? record.analysis : undefined,
    difficulty: readString(record, 'difficulty') || 'medium',
    defaultScore: readString(record, 'defaultScore', 'default_score') || '0',
    sourceType: readString(record, 'sourceType', 'source_type') || 'manual',
    sourceRef: typeof record.sourceRef === 'string' ? record.sourceRef : undefined,
    tags: readStringList(record, 'tags'),
    wrongBook: Boolean(record.wrongBook),
    wrongNote: typeof record.wrongNote === 'string' ? record.wrongNote : undefined,
    ownerUserId: typeof record.ownerUserId === 'string' ? record.ownerUserId : undefined,
    status: readString(record, 'status') || 'active',
    createdAt: readString(record, 'createdAt', 'created_at'),
    updatedAt: readString(record, 'updatedAt', 'updated_at'),
    version: typeof record.version === 'number' ? record.version : 0,
  }
}

export function mapPaper(value: unknown): Paper {
  const record = asRecord(value)
  const itemsRaw = Array.isArray(record.items) ? record.items : []
  const allocationRaw = Array.isArray(record.scoreAllocation) ? record.scoreAllocation : []
  return {
    id: readString(record, 'id'),
    paperCode: readString(record, 'paperCode', 'paper_code'),
    title: readString(record, 'title'),
    gradeLevel: readString(record, 'gradeLevel', 'grade_level'),
    subject: readString(record, 'subject'),
    paperMode: readString(record, 'paperMode', 'paper_mode') || 'manual',
    examDurationSeconds:
      typeof record.examDurationSeconds === 'number' ? record.examDurationSeconds : 0,
    totalScore: readString(record, 'totalScore', 'total_score') || '0',
    scope: asRecord(record.scope),
    scoreAllocation: allocationRaw.map((entry) => {
      const allocation = asRecord(entry)
      return {
        sectionNo: String(allocation.sectionNo ?? ''),
        questionType: String(allocation.questionType ?? ''),
        count: typeof allocation.count === 'number' ? allocation.count : 0,
        subtotal: String(allocation.subtotal ?? ''),
      }
    }),
    headerNote: typeof record.headerNote === 'string' ? record.headerNote : undefined,
    sealedLine: record.sealedLine !== false,
    paperStatus: readString(record, 'paperStatus', 'paper_status') || 'draft',
    archivedAt: typeof record.archivedAt === 'string' ? record.archivedAt : undefined,
    ownerUserId: typeof record.ownerUserId === 'string' ? record.ownerUserId : undefined,
    questionCount:
      typeof record.questionCount === 'number'
        ? record.questionCount
        : itemsRaw.length,
    items: itemsRaw.map((entry) => {
      const item = asRecord(entry)
      return {
        questionId: String(item.questionId ?? ''),
        sectionNo: String(item.sectionNo ?? '1'),
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
        score: String(item.score ?? '0'),
        question: item.question ? mapQuestion(item.question) : null,
      }
    }),
    createdAt: readString(record, 'createdAt', 'created_at'),
    updatedAt: readString(record, 'updatedAt', 'updated_at'),
    version: typeof record.version === 'number' ? record.version : 0,
  }
}

export function mapHandout(value: unknown): Handout {
  const record = asRecord(value)
  let body: HandoutBlock[] = []
  const bodyRaw = record.body
  if (Array.isArray(bodyRaw)) body = bodyRaw as HandoutBlock[]
  else if (typeof bodyRaw === 'string' && bodyRaw.trim()) {
    try {
      const parsed = JSON.parse(bodyRaw)
      if (Array.isArray(parsed)) body = parsed as HandoutBlock[]
    } catch {
      body = []
    }
  }
  const itemsRaw = Array.isArray(record.items) ? record.items : []
  return {
    id: readString(record, 'id'),
    handoutCode: readString(record, 'handoutCode', 'handout_code'),
    title: readString(record, 'title'),
    gradeLevel: readString(record, 'gradeLevel', 'grade_level'),
    subject: readString(record, 'subject'),
    lessonTag: typeof record.lessonTag === 'string' ? record.lessonTag : undefined,
    body,
    ownerUserId: typeof record.ownerUserId === 'string' ? record.ownerUserId : undefined,
    status: readString(record, 'status') || 'active',
    createdAt: readString(record, 'createdAt', 'created_at'),
    updatedAt: readString(record, 'updatedAt', 'updated_at'),
    version: typeof record.version === 'number' ? record.version : 0,
    items: itemsRaw.map((entry) => {
      const item = asRecord(entry)
      return {
        questionId: String(item.questionId ?? ''),
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
        usageRole: String(item.usageRole ?? 'practice'),
        question: item.question ? mapQuestion(item.question) : null,
      }
    }),
  }
}

export function mapTaxonomy(value: unknown): Taxonomy {
  const record = asRecord(value)
  const mapEntries = (key: string): TaxonomyEntry[] => {
    const raw = record[key]
    if (!Array.isArray(raw)) return []
    return raw.map((entry) => {
      const item = asRecord(entry)
      return {
        value: String(item.value ?? ''),
        count: typeof item.count === 'number' ? item.count : 0,
        subject: typeof item.subject === 'string' ? item.subject : undefined,
      }
    })
  }
  return {
    grades: mapEntries('grades'),
    subjects: mapEntries('subjects'),
    chapters: mapEntries('chapters'),
    knowledgePoints: mapEntries('knowledgePoints'),
    questionTypes: mapEntries('questionTypes'),
    difficulties: mapEntries('difficulties'),
    tags: mapEntries('tags'),
  }
}
