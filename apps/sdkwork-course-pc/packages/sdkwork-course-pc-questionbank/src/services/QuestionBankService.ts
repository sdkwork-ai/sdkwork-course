// Thin service factory over the generated course app SDK question bank
// resources. All rows are mapped through the tolerant mappers so the UI never
// touches raw envelopes.

import type { CourseAppSdkClient } from '@sdkwork/sdkwork-course-pc-core'
import { readPageItems, readPageTotal } from '@sdkwork/sdkwork-course-pc-courses'
import type {
  ComposePaperInput,
  Handout,
  Paper,
  Question,
  QuestionInput,
  QuestionPage,
  Taxonomy,
} from '../questionBankTypes'
import { mapHandout, mapPaper, mapQuestion, mapTaxonomy } from '../questionBankTypes'

export interface QuestionListParams {
  q?: string
  page?: number
  pageSize?: number
  grade?: string
  subject?: string
  chapter?: string
  knowledgePoint?: string
  questionType?: string
  difficulty?: string
  tag?: string
  source?: string
  wrongBook?: boolean
  status?: string
}

export interface PaperListParams {
  q?: string
  page?: number
  pageSize?: number
  status?: string
}

export interface HandoutListParams {
  q?: string
  page?: number
  pageSize?: number
  grade?: string
  subject?: string
}

export interface HandoutInput {
  id?: string
  title: string
  gradeLevel: string
  subject: string
  lessonTag?: string
  body: Handout['body']
  status?: string
}

export function createQuestionBankService(sdk: CourseAppSdkClient) {
  return {
    async listQuestions(params: QuestionListParams): Promise<QuestionPage> {
      const response = await sdk.questionBankQuestions.list({
        q: params.q || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        grade: params.grade || undefined,
        subject: params.subject || undefined,
        chapter: params.chapter || undefined,
        knowledgePoint: params.knowledgePoint || undefined,
        questionType: params.questionType || undefined,
        difficulty: params.difficulty || undefined,
        tag: params.tag || undefined,
        source: params.source || undefined,
        wrongBook:
          params.wrongBook === undefined ? undefined : params.wrongBook ? 'true' : 'false',
        status: params.status || undefined,
      })
      return {
        items: readPageItems(response).map(mapQuestion),
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        total: readPageTotal(response),
      }
    },

    async retrieveQuestion(questionId: string): Promise<Question> {
      const response = await sdk.questionBankQuestions.retrieve(questionId)
      return mapQuestion(response)
    },

    async saveQuestion(payload: QuestionInput): Promise<Question> {
      const response =
        payload.id && payload.id.length > 0
          ? await sdk.questionBankQuestions.update(payload.id, payload as unknown as Record<string, unknown>)
          : await sdk.questionBankQuestions.create(payload as unknown as Record<string, unknown>)
      return mapQuestion(response)
    },

    async deleteQuestion(questionId: string): Promise<void> {
      await sdk.questionBankQuestions.delete(questionId)
    },

    async deleteQuestionsBatch(
      questionIds: string[],
    ): Promise<{ deleted: string[]; failed: Array<{ questionId: string; reason: string }> }> {
      const response = await sdk.questionBankQuestions.batchDelete({
        questionIds,
      } as unknown as Record<string, unknown>)
      const record = response as Record<string, unknown>
      const deleted = Array.isArray(record.deleted)
        ? record.deleted.filter((entry): entry is string => typeof entry === 'string')
        : []
      const failedRaw = Array.isArray(record.failed) ? record.failed : []
      return {
        deleted,
        failed: failedRaw.map((entry) => {
          const failure = (entry ?? {}) as Record<string, unknown>
          return {
            questionId: String(failure.questionId ?? ''),
            reason: String(failure.reason ?? ''),
          }
        }),
      }
    },

    async importQuestions(
      questions: Array<QuestionInput>,
    ): Promise<{ accepted: number; failed: Array<{ index: number; reason: string }> }> {
      const response = await sdk.questionBankQuestions.import({
        questions: questions as unknown as Array<Record<string, unknown>>,
      } as unknown as Record<string, unknown>)
      const record = response as Record<string, unknown>
      const failedRaw = Array.isArray(record.failed) ? record.failed : []
      return {
        accepted: typeof record.accepted === 'number' ? record.accepted : 0,
        failed: failedRaw.map((entry) => {
          const failure = (entry ?? {}) as Record<string, unknown>
          return {
            index: typeof failure.index === 'number' ? failure.index : 0,
            reason: String(failure.reason ?? ''),
          }
        }),
      }
    },

    async updateQuestionsBatch(payload: {
      questionIds: string[]
      knowledgePoints?: string[]
      tags?: string[]
      difficulty?: string
      chapter?: string
      wrongBook?: boolean
      wrongNote?: string
      status?: string
    }): Promise<number> {
      const response = await sdk.questionBankQuestions.batchUpdate(
        payload as unknown as Record<string, unknown>,
      )
      const record = response as Record<string, unknown>
      return typeof record.updated === 'number' ? record.updated : 0
    },

    async retrieveTaxonomy(): Promise<Taxonomy> {
      const response = await sdk.questionBankTaxonomy.retrieve()
      return mapTaxonomy(response)
    },

    async listPapers(params: PaperListParams): Promise<{ items: Paper[]; total: number }> {
      const response = await sdk.questionBankPapers.list({
        q: params.q || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status && params.status !== 'all' ? params.status : undefined,
      })
      return {
        items: readPageItems(response).map(mapPaper),
        total: readPageTotal(response),
      }
    },

    async retrievePaper(paperId: string): Promise<Paper> {
      const response = await sdk.questionBankPapers.retrieve(paperId)
      return mapPaper(response)
    },

    async composePaper(payload: ComposePaperInput): Promise<Paper> {
      const response = await sdk.questionBankPapers.create(
        payload as unknown as Record<string, unknown>,
      )
      return mapPaper(response)
    },

    async updatePaper(paperId: string, payload: Record<string, unknown>): Promise<Paper> {
      const response = await sdk.questionBankPapers.update(paperId, payload)
      return mapPaper(response)
    },

    async deletePaper(paperId: string): Promise<void> {
      await sdk.questionBankPapers.delete(paperId)
    },

    async archivePaper(paperId: string): Promise<Paper> {
      const response = await sdk.questionBankPapers.archive(paperId, {})
      return mapPaper(response)
    },

    async listHandouts(
      params: HandoutListParams,
    ): Promise<{ items: Handout[]; total: number }> {
      const response = await sdk.questionBankHandouts.list({
        q: params.q || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        grade: params.grade || undefined,
        subject: params.subject || undefined,
      })
      return {
        items: readPageItems(response).map(mapHandout),
        total: readPageTotal(response),
      }
    },

    async retrieveHandout(handoutId: string): Promise<Handout> {
      const response = await sdk.questionBankHandouts.retrieve(handoutId)
      return mapHandout(response)
    },

    async saveHandout(payload: HandoutInput): Promise<Handout> {
      const response =
        payload.id && payload.id.length > 0
          ? await sdk.questionBankHandouts.update(payload.id, payload as unknown as Record<string, unknown>)
          : await sdk.questionBankHandouts.create(payload as unknown as Record<string, unknown>)
      return mapHandout(response)
    },

    async deleteHandout(handoutId: string): Promise<void> {
      await sdk.questionBankHandouts.delete(handoutId)
    },
  }
}

export type QuestionBankService = ReturnType<typeof createQuestionBankService>
