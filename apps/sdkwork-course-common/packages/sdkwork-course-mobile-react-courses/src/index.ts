import "./i18n";

export * from "./pages/CourseHome";
export * from "./pages/CourseDetail";
export * from "./pages/CoursePurchase";
export * from "./pages/CoursePlayer";
export * from "./pages/MyCourses";
export * from "./pages/CourseLiveRoom";
export * from "./pages/CourseSearch";
export * from "./components";
export * from "./services/CourseService";
export {
  configureCourseRuntimePort,
  resetCourseRuntimePort,
  getCourseRuntimePort,
  isCourseRuntimePortBound,
} from "./services/courseRuntimePort";
export {
  configureCommentsRuntime,
  getCommentsRuntimeClient,
} from "./services/commentsRuntime";
export type { CommentsRuntimeConfig } from "./services/commentsRuntime";
