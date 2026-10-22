import type { CourseAppSdkClient } from '@sdkwork/sdkwork-course-pc-core'
import { mapCourse, mapStudioDetail, readPageItems, readPageTotal } from '@sdkwork/sdkwork-course-pc-courses'
import type { CourseSummary, StudioCourseDetail } from '@sdkwork/sdkwork-course-pc-courses'
import type { StudioCoursePayload } from '../studioTypes'

export interface StudioCourseRow extends CourseSummary {
  updatedAt?: string
}

export interface StudioCoursePage {
  items: StudioCourseRow[]
  total: number
}

type AppSdk = CourseAppSdkClient

function mapRow(value: unknown): StudioCourseRow {
  const course = mapCourse(value)
  const record = value as Record<string, unknown>
  return {
    ...course,
    updatedAt: String(record.updatedAt ?? record.updated_at ?? '') || undefined,
  }
}

export function createCourseStudioService(sdk: AppSdk) {
  return {
    async list(params: { status?: string; kind?: string; q?: string; page?: number; pageSize?: number }): Promise<StudioCoursePage> {
      const response = await sdk.studioCourses.list({
        status: params.status || undefined,
        kind: params.kind || undefined,
        q: params.q || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
      })
      return {
        items: readPageItems(response).map(mapRow),
        total: readPageTotal(response),
      }
    },

    async create(payload: StudioCoursePayload): Promise<CourseSummary> {
      const response = await sdk.studioCourses.create(payload as unknown as Record<string, unknown>)
      return mapCourse(response)
    },

    async retrieve(courseId: string): Promise<StudioCourseDetail> {
      const response = await sdk.studioCourses.retrieve(courseId)
      return mapStudioDetail(response)
    },

    async update(courseId: string, payload: StudioCoursePayload): Promise<CourseSummary> {
      const response = await sdk.studioCourses.update(
        courseId,
        payload as unknown as Record<string, unknown>,
      )
      return mapCourse(response)
    },

    async remove(courseId: string): Promise<void> {
      await sdk.studioCourses.delete(courseId)
    },

    async submit(courseId: string): Promise<CourseSummary> {
      const response = await sdk.studioCourses.submit(courseId, {})
      return mapCourse(response)
    },

    async withdraw(courseId: string): Promise<CourseSummary> {
      const response = await sdk.studioCourses.withdraw(courseId, {})
      return mapCourse(response)
    },
  }
}

export type CourseStudioService = ReturnType<typeof createCourseStudioService>
