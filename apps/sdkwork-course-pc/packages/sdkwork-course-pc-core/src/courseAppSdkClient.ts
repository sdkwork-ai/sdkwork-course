import {
  createClient,
  type SdkworkAppClient,
  type SdkworkAppConfig,
} from '@sdkwork/course-app-sdk';

import {
  getCourseGlobalTokenManager,
  readCourseSessionTokens,
  resolveAppApiBaseUrl,
  resolveCourseAccessToken,
  resolveCourseAuthToken,
  type CourseSession,
} from './session';

export type CourseAppSdkClient = SdkworkAppClient;
export type CourseAppSdkClientConfig = SdkworkAppConfig;

let courseAppSdkClient: CourseAppSdkClient | null = null;

export function createCourseAppSdkClientConfig(
  session?: CourseSession | null,
): CourseAppSdkClientConfig {
  const currentSession = session ?? readCourseSessionTokens();
  return {
    baseUrl: resolveAppApiBaseUrl(),
    accessToken: resolveCourseAccessToken(currentSession),
    authToken: resolveCourseAuthToken(currentSession),
    platform: 'pc',
    tokenManager: getCourseGlobalTokenManager(),
  };
}

export function initCourseAppSdkClient(
  config: CourseAppSdkClientConfig = createCourseAppSdkClientConfig(),
): CourseAppSdkClient {
  courseAppSdkClient = createClient(config);
  return courseAppSdkClient;
}

export function getCourseAppSdkClient(): CourseAppSdkClient {
  return courseAppSdkClient ?? initCourseAppSdkClient();
}

export function getCourseAppSdkClientWithSession(
  session = readCourseSessionTokens(),
): CourseAppSdkClient {
  return initCourseAppSdkClient(createCourseAppSdkClientConfig(session));
}

export function resetCourseAppSdkClient(): void {
  courseAppSdkClient = null;
}

export interface CourseEngagement {
  courseId: string;
  likes: number;
  favorites: number;
  shares: number;
  discussions: number;
  viewer: {
    liked: boolean;
    favorited: boolean;
    shared: boolean;
  };
}

function readEngagementNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Read persisted course engagement counters and the current viewer's reactions. */
export async function retrieveCourseEngagement(
  courseId: string,
  client: CourseAppSdkClient = getCourseAppSdkClient(),
): Promise<CourseEngagement> {
  const response = await client.courseEngagement.retrieve(courseId);
  const data = response as Record<string, unknown>;
  const payload =
    data && typeof data === 'object' && 'item' in data && typeof data.item === 'object'
      ? (data.item as Record<string, unknown>)
      : data;
  const viewer =
    payload.viewer && typeof payload.viewer === 'object'
      ? (payload.viewer as Record<string, unknown>)
      : {};
  return {
    courseId,
    likes: readEngagementNumber(payload, 'likes'),
    favorites: readEngagementNumber(payload, 'favorites'),
    shares: readEngagementNumber(payload, 'shares'),
    discussions: readEngagementNumber(payload, 'discussions'),
    viewer: {
      liked: viewer.liked === true,
      favorited: viewer.favorited === true,
      shared: viewer.shared === true,
    },
  };
}

/** @deprecated Use getCourseAppSdkClient() — kept for transitional imports. */
export const createCourseSdk = getCourseAppSdkClient;
export type CourseSdk = CourseAppSdkClient;
export type CourseSdkConfig = CourseAppSdkClientConfig;
