import React from 'react';
import { CourseAdminConsole } from './CourseAdminConsole';

/**
 * Tenant admin course console.
 *
 * Kept as the stable public entrypoint for the IM console integration and the
 * standalone course PC app; the implementation lives in `CourseAdminConsole`.
 */
export const ConsoleCourse: React.FC = () => <CourseAdminConsole />;
