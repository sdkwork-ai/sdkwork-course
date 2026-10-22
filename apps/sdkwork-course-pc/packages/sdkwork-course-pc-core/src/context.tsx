import React, { createContext, useContext, useMemo } from 'react';
import {
  getCourseAppSdkClient,
  initCourseAppSdkClient,
  type CourseAppSdkClient,
} from './courseAppSdkClient';
import { createCourseAppSdkClientConfig } from './courseAppSdkClient';

const CourseSdkContext = createContext<CourseAppSdkClient | null>(null);

export interface CourseSdkProviderProps {
  children: React.ReactNode;
  /** Pre-built client supplied by an embedding host (SDKWork plugin, IM, ...). */
  client?: CourseAppSdkClient;
}

export function CourseSdkProvider({ children, client }: CourseSdkProviderProps) {
  const sdk = useMemo(
    () => client ?? initCourseAppSdkClient(createCourseAppSdkClientConfig()),
    [client],
  );
  return (
    <CourseSdkContext.Provider value={sdk}>
      {children}
    </CourseSdkContext.Provider>
  );
}

export function useCourseSdk(): CourseAppSdkClient {
  const sdk = useContext(CourseSdkContext);
  if (!sdk) {
    return getCourseAppSdkClient();
  }
  return sdk;
}
