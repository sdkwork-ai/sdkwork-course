import { createClient as createCommentsClient } from '@sdkwork/comments-app-sdk'
import { configureCommentsRuntime } from '@sdkwork/course-mobile-react-courses'
import { createCourseAppSdkClient, createGeneratedCourseAppSdkPort, type CourseAppSdkClient } from '@sdkwork/course-runtime'
import type { CourseAppSdkPort } from '@sdkwork/course-sdk-ports'
import type { AuthTokenManager } from '@sdkwork/sdk-common'
import { loadRuntimeConfig } from './environment'

export interface CourseH5SdkClients {
  appApiBaseUrl: string
  courseAppSdk: CourseAppSdkClient
  courseAppSdkPort: CourseAppSdkPort
}

export function createSdkClients(tokenManager: AuthTokenManager): CourseH5SdkClients {
  const config = loadRuntimeConfig()
  const courseAppSdk = createCourseAppSdkClient({
    config: { appApiBaseUrl: config.apiBaseUrl },
    tokenManager,
  })
  configureCommentsRuntime({
    client: createCommentsClient({
      baseUrl: config.apiBaseUrl,
      tokenManager,
    }),
  })
  return {
    appApiBaseUrl: config.apiBaseUrl,
    courseAppSdk,
    courseAppSdkPort: createGeneratedCourseAppSdkPort(courseAppSdk.client),
  }
}
