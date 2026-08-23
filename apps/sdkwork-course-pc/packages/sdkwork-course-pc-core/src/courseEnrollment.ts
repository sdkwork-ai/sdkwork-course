import { uuid } from '@sdkwork/utils/id';

import type { CourseAppSdkClient } from './courseAppSdkClient';
import { extractSdkListItems } from './courseSdkPayload';

export class CourseEnrollmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseEnrollmentError';
  }
}

export async function enrollInFirstCourseOffering(
  sdk: CourseAppSdkClient,
  courseId: string,
): Promise<string> {
  const offeringsResponse = await sdk.courseOfferings.list(courseId);
  const offerings = extractSdkListItems<{ id?: string }>(offeringsResponse);
  const offeringId = offerings[0]?.id;

  if (!offeringId) {
    throw new CourseEnrollmentError('暂无可报名的课程班次');
  }

  await sdk.courseEnrollments.create(
    offeringId,
    { source: 'self_service' },
    { idempotencyKey: uuid() },
  );

  return offeringId;
}
