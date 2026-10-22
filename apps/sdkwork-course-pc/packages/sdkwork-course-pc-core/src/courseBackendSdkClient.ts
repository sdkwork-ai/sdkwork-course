import {
  createClient,
  type SdkworkBackendClient,
  type SdkworkBackendConfig,
} from '@sdkwork/course-backend-sdk';

import {
  getCourseGlobalTokenManager,
  readCourseSessionTokens,
  resolveAppApiBaseUrl,
  resolveCourseAccessToken,
  resolveCourseAuthToken,
  type CourseSession,
} from './session';

export type CourseBackendSdkClient = SdkworkBackendClient;
export type CourseBackendSdkClientConfig = SdkworkBackendConfig;

let courseBackendSdkClient: CourseBackendSdkClient | null = null;

export function createCourseBackendSdkClientConfig(
  session?: CourseSession | null,
): CourseBackendSdkClientConfig {
  const currentSession = session ?? readCourseSessionTokens();
  return {
    baseUrl: resolveAppApiBaseUrl(),
    accessToken: resolveCourseAccessToken(currentSession),
    authToken: resolveCourseAuthToken(currentSession),
    platform: 'pc',
    tokenManager: getCourseGlobalTokenManager(),
  };
}

export function initCourseBackendSdkClient(
  config: CourseBackendSdkClientConfig = createCourseBackendSdkClientConfig(),
): CourseBackendSdkClient {
  courseBackendSdkClient = createClient(config);
  return courseBackendSdkClient;
}

export function getCourseBackendSdkClient(): CourseBackendSdkClient {
  return courseBackendSdkClient ?? initCourseBackendSdkClient();
}

export function getCourseBackendSdkClientWithSession(
  session = readCourseSessionTokens(),
): CourseBackendSdkClient {
  return initCourseBackendSdkClient(createCourseBackendSdkClientConfig(session));
}

export function resetCourseBackendSdkClient(): void {
  courseBackendSdkClient = null;
}
