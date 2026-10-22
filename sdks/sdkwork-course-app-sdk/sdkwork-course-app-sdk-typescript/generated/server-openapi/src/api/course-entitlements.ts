import { appApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';

import type { CourseCommandBody, SdkWorkCommandData } from '../types';


export class CourseEntitlementsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** course Entitlements grant. */
  async grant(body: CourseCommandBody, requestOptions?: ApiRequestOptions): Promise<SdkWorkCommandData> {
    return this.client.request<SdkWorkCommandData>(appApiPath(`/course_entitlements/grant`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', skipAuth: true, sdkworkUnwrapKind: 'command' });
  }
}

export function createCourseEntitlementsApi(client: HttpClient): CourseEntitlementsApi {
  return new CourseEntitlementsApi(client);
}
