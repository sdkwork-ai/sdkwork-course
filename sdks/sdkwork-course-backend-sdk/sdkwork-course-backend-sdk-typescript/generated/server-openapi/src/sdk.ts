import { HttpClient, createHttpClient } from './http/client';
import type { SdkworkBackendConfig } from './types/common';
import type { AuthTokenManager } from '@sdkwork/sdk-common';

import { CourseCategoriesApi, createCourseCategoriesApi } from './api/course-categories';
import { CourseInstructorsApi, createCourseInstructorsApi } from './api/course-instructors';
import { CoursesApi, createCoursesApi } from './api/courses';
import { CourseOfferingsApi, createCourseOfferingsApi } from './api/course-offerings';
import { CourseSectionsApi, createCourseSectionsApi } from './api/course-sections';
import { CourseLessonsApi, createCourseLessonsApi } from './api/course-lessons';
import { CourseResourcesApi, createCourseResourcesApi } from './api/course-resources';
import { CourseLiveSessionsApi, createCourseLiveSessionsApi } from './api/course-live-sessions';
import { CourseEnrollmentsApi, createCourseEnrollmentsApi } from './api/course-enrollments';
import { CourseProgressApi, createCourseProgressApi } from './api/course-progress';
import { CourseLessonProgressApi, createCourseLessonProgressApi } from './api/course-lesson-progress';
import { CourseReactionsApi, createCourseReactionsApi } from './api/course-reactions';
import { CourseApplicationsApi, createCourseApplicationsApi } from './api/course-applications';
import { CourseReportsApi, createCourseReportsApi } from './api/course-reports';
import { CourseAuditLogsApi, createCourseAuditLogsApi } from './api/course-audit-logs';
import { CourseReviewsApi, createCourseReviewsApi } from './api/course-reviews';

export class SdkworkBackendClient {
  private httpClient: HttpClient;

  public readonly courseCategories: CourseCategoriesApi;
  public readonly courseInstructors: CourseInstructorsApi;
  public readonly courses: CoursesApi;
  public readonly courseOfferings: CourseOfferingsApi;
  public readonly courseSections: CourseSectionsApi;
  public readonly courseLessons: CourseLessonsApi;
  public readonly courseResources: CourseResourcesApi;
  public readonly courseLiveSessions: CourseLiveSessionsApi;
  public readonly courseEnrollments: CourseEnrollmentsApi;
  public readonly courseProgress: CourseProgressApi;
  public readonly courseLessonProgress: CourseLessonProgressApi;
  public readonly courseReactions: CourseReactionsApi;
  public readonly courseApplications: CourseApplicationsApi;
  public readonly courseReports: CourseReportsApi;
  public readonly courseAuditLogs: CourseAuditLogsApi;
  public readonly courseReviews: CourseReviewsApi;

  constructor(config: SdkworkBackendConfig) {
    this.httpClient = createHttpClient(config);
    this.courseCategories = createCourseCategoriesApi(this.httpClient);

    this.courseInstructors = createCourseInstructorsApi(this.httpClient);

    this.courses = createCoursesApi(this.httpClient);

    this.courseOfferings = createCourseOfferingsApi(this.httpClient);

    this.courseSections = createCourseSectionsApi(this.httpClient);

    this.courseLessons = createCourseLessonsApi(this.httpClient);

    this.courseResources = createCourseResourcesApi(this.httpClient);

    this.courseLiveSessions = createCourseLiveSessionsApi(this.httpClient);

    this.courseEnrollments = createCourseEnrollmentsApi(this.httpClient);

    this.courseProgress = createCourseProgressApi(this.httpClient);

    this.courseLessonProgress = createCourseLessonProgressApi(this.httpClient);

    this.courseReactions = createCourseReactionsApi(this.httpClient);

    this.courseApplications = createCourseApplicationsApi(this.httpClient);

    this.courseReports = createCourseReportsApi(this.httpClient);

    this.courseAuditLogs = createCourseAuditLogsApi(this.httpClient);

    this.courseReviews = createCourseReviewsApi(this.httpClient);
  }
  setAuthToken(token: string): this {
    this.httpClient.setAuthToken(token);
    return this;
  }

  setAccessToken(token: string): this {
    this.httpClient.setAccessToken(token);
    return this;
  }

  setTokenManager(manager: AuthTokenManager): this {
    this.httpClient.setTokenManager(manager);
    return this;
  }

  get http(): HttpClient {
    return this.httpClient;
  }
}

export function createClient(config: SdkworkBackendConfig): SdkworkBackendClient {
  return new SdkworkBackendClient(config);
}

export default SdkworkBackendClient;
