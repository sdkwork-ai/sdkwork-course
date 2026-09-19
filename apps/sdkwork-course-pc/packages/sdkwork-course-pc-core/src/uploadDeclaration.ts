/**
 * Upload declaration constants for the SDKWork Course PC application root.
 *
 * Source of truth: `apps/sdkwork-course-pc/specs/upload.declaration.json`
 * (DRIVE_SPEC.md §18). Upload call sites MUST consume these constants instead of
 * repeating the declared literals inline — §18.3 forbids duplicating a declared
 * value as a bare literal because a duplicate silently diverges from the
 * declaration that the gate validates.
 */

export interface CourseUploadDeclarationEntry {
  readonly appResourceType: string;
  readonly appResourceIdKind: 'application' | 'entity' | 'draft';
  readonly scene: string;
  readonly source: string;
  readonly uploadProfileCode: string;
  readonly retention: 'long_term' | 'temporary';
  readonly retentionTtlSeconds?: number;
  readonly purpose: string;
}

export const COURSE_PC_APP_ID = 'sdkwork-course' as const;
export const COURSE_PC_UPLOAD_SOURCE = 'sdkwork-course-pc' as const;

export const COURSE_PC_MEDIA_ASSET_UPLOAD = {
  appResourceType: 'course.media_asset',
  appResourceIdKind: 'entity',
  scene: 'course-media',
  source: COURSE_PC_UPLOAD_SOURCE,
  uploadProfileCode: 'attachment',
  retention: 'long_term',
  purpose:
    'Course media file (cover image, lesson video, audio, or handout) uploaded to the Drive node bound to a course offering.',
} as const satisfies CourseUploadDeclarationEntry;

export const COURSE_PC_UPLOAD_DECLARATIONS: readonly CourseUploadDeclarationEntry[] = [
  COURSE_PC_MEDIA_ASSET_UPLOAD,
];
