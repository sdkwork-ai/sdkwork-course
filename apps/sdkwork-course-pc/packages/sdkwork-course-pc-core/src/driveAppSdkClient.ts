import {
  createClient,
  type SdkworkDriveAppClient,
  type SdkworkAppConfig,
} from '@sdkwork/drive-app-sdk';
import { uuid } from '@sdkwork/utils/id';
import { COURSE_PC_MEDIA_ASSET_UPLOAD } from './uploadDeclaration';

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
let driveApiBaseUrl: string | null = null;

/**
 * Point Drive uploads at the same SDKWork gateway as the host course client.
 * Embedded hosts serve the course surface from an app-protocol origin, so the
 * standalone `window.location.origin` resolution is not usable there.
 */
export function configureCourseDriveApiBaseUrl(baseUrl: string): void {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized || normalized === driveApiBaseUrl) return;
  driveApiBaseUrl = normalized;
  resetDriveAppSdkClient();
}

export function createDriveAppSdkClientConfig(
  session?: CourseSession | null,
): DriveAppSdkClientConfig {
  const currentSession = session ?? readCourseSessionTokens();
  return {
    baseUrl: driveApiBaseUrl ?? resolveAppApiBaseUrl(),
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
  /** Signed preview URL for image assets; refreshed when the cover is edited. */
  previewUrl?: string;
}

export async function uploadCourseMediaFile(file: File): Promise<CourseDriveUploadResult> {
  const driveClient = getDriveAppSdkClient();
  const appResourceId = uuid();
  const uploadResult = await driveClient.uploader.upload({
    file,
    appResourceType: COURSE_PC_MEDIA_ASSET_UPLOAD.appResourceType,
    appResourceId,
    scene: COURSE_PC_MEDIA_ASSET_UPLOAD.scene,
    source: COURSE_PC_MEDIA_ASSET_UPLOAD.source,
    uploadProfileCode: COURSE_PC_MEDIA_ASSET_UPLOAD.uploadProfileCode,
    originalFileName: file.name,
    contentType: file.type || 'application/octet-stream',
  });
  const nodeId = uploadResult.uploadItem.nodeId;
  let previewUrl: string | undefined;
  if (file.type.startsWith('image/')) {
    try {
      const urls = await driveClient.drive.nodes.downloadUrls.retrieve(nodeId, {
        requestedTtlSeconds: 7 * 24 * 60 * 60,
      });
      previewUrl = urls.signedSourceUrl || urls.downloadUrl;
    } catch {
      // The cover can still be saved and resolved later through Drive.
    }
  }
  return {
    driveNodeId: nodeId,
    driveResourceId: nodeId,
    fileName: file.name,
    mimeType: file.type || undefined,
    previewUrl,
  };
}
