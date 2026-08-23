import {
  createClient,
  type SdkworkDriveAppClient,
  type SdkworkAppConfig,
} from '@sdkwork/drive-app-sdk';
import { uuid } from '@sdkwork/utils/id';

import {
  getCourseGlobalTokenManager,
  readCourseSessionTokens,
  resolveAppApiBaseUrl,
  resolveCourseAccessToken,
  resolveCourseAuthToken,
  type CourseSession,
} from './session';

export type DriveAppSdkClient = SdkworkDriveAppClient;
export type DriveAppSdkClientConfig = SdkworkAppConfig;

let driveAppSdkClient: DriveAppSdkClient | null = null;

export function createDriveAppSdkClientConfig(
  session?: CourseSession | null,
): DriveAppSdkClientConfig {
  const currentSession = session ?? readCourseSessionTokens();
  return {
    baseUrl: resolveAppApiBaseUrl(),
    accessToken: resolveCourseAccessToken(currentSession),
    authToken: resolveCourseAuthToken(currentSession),
    platform: 'pc',
    tokenManager: getCourseGlobalTokenManager(),
  };
}

export function getDriveAppSdkClient(): DriveAppSdkClient {
  if (!driveAppSdkClient) {
    driveAppSdkClient = createClient(createDriveAppSdkClientConfig());
  }
  return driveAppSdkClient;
}

export function resetDriveAppSdkClient(): void {
  driveAppSdkClient = null;
}

export interface CourseDriveUploadResult {
  driveNodeId: string;
  driveResourceId: string;
  fileName: string;
  mimeType?: string;
}

export async function uploadCourseMediaFile(file: File): Promise<CourseDriveUploadResult> {
  const driveClient = getDriveAppSdkClient();
  const appResourceId = uuid();
  const uploadResult = await driveClient.uploader.upload({
    file,
    appResourceType: 'course_media',
    appResourceId,
    originalFileName: file.name,
    contentType: file.type || 'application/octet-stream',
  });
  const nodeId = uploadResult.uploadItem.nodeId;
  return {
    driveNodeId: nodeId,
    driveResourceId: nodeId,
    fileName: file.name,
    mimeType: file.type || undefined,
  };
}
