import { configureCourseConsolePcHost } from '@sdkwork/course-pc-console'
import { getCourseBackendSdkClientWithSession } from '@sdkwork/sdkwork-course-pc-core'

/**
 * Standalone course PC app host for the tenant admin console. The console
 * package asks the host for a backend client per request so token refreshes and
 * re-login are picked up without remounting the console.
 */
export function configureCourseAdminHost(): void {
  configureCourseConsolePcHost({
    getBackendClientWithSession: () => getCourseBackendSdkClientWithSession(),
  })
}
