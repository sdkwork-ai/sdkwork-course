import type {
  CourseCategory,
  CourseEnrollment,
  CourseLearningProgress,
  CourseLesson,
  CourseLiveSession,
  CourseReaction,
} from "@sdkwork/course-sdk-ports";
import { getCourseRuntimePort } from "./courseRuntimePort";
import { getCommentsRuntimeClient } from "./commentsRuntime";

export interface CourseLessonUI {
  id: string;
  title: string;
  duration: string;
  durationSeconds?: number;
  description?: string;
  sectionId?: string;
  completed?: boolean;
  free?: boolean;
  videoUrl?: string;
  /** Lesson form: vod_video / live_session / article / download / quiz / assignment. */
  kind?: string;
  /** External source id (e.g. bilibili BV id) for connected lessons. */
  externalSourceId?: string;
  /** External source provider (`bilibili`, `manual`, ...). */
  sourceProvider?: string;
  /** Rich text body for article-style lessons. */
  content?: string;
}

export interface CourseSectionUI {
  section: string;
  lessons: CourseLessonUI[];
}

export interface CourseData {
  id: string;
  title: string;
  instructor: string;
  rating: number;
  students: number;
  price: number;
  originalPrice: number;
  duration: string;
  totalLessons?: number;
  cover: string;
  category: string;
  type?: "live" | "recorded" | string;
  kind?: string;
  author?: string;
  isFree?: boolean;
  priceAmount?: string;
  liveStatus?: string;
  instructorDesc?: string;
  advantages?: string[];
  isPurchased?: boolean;
  description?: string;
  curriculum?: CourseSectionUI[];
}

export interface MyCourseData {
  id: string;
  courseId: string;
  title: string;
  cover: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  lastWatched: string;
  isLive?: boolean;
  enrollmentStatus?: string;
}

export interface CourseDiscussion {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  content: string;
  likes: number;
  time: string;
  reply?: {
    author: string;
    content: string;
  };
}

export interface CourseLiveSessionUI {
  id: string;
  title: string;
  description?: string;
  liveStatus: string;
  scheduledStartAt: string;
  scheduledEndAt?: string;
  actualStartAt?: string;
}

export class CourseCapabilityUnavailableError extends Error {
  constructor() {
    super("Courses are unavailable because the Course owner SDK is not composed by the host.");
    this.name = "CourseCapabilityUnavailableError";
  }
}

export class CourseEnrollmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseEnrollmentError";
  }
}

function port(): ReturnType<typeof getCourseRuntimePort> {
  return getCourseRuntimePort();
}

function formatDuration(durationSeconds?: number): string {
  if (!durationSeconds || durationSeconds <= 0) {
    return "--";
  }
  const minutes = Math.floor(durationSeconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分钟`;
}

function toCourseData(course: {
  id: string;
  title: string;
  thumbnail?: string;
  instructor?: string;
  author?: string;
  lessonsCount?: number;
  studentsCount?: number;
  ratingScore?: string;
  type?: string;
  kind?: string;
  liveStatus?: string;
  price?: number;
  priceAmount?: string;
  isFree?: boolean;
  originalPrice?: number;
  isPurchased?: boolean;
  description?: string;
}): CourseData {
  return {
    id: course.id,
    title: course.title,
    instructor: course.instructor ?? "",
    rating: parseFloat(course.ratingScore ?? "0") || 0,
    students: course.studentsCount ?? 0,
    price: (course.price ?? Number(course.priceAmount ?? "0")) || 0,
    originalPrice: course.originalPrice ?? 0,
    duration: formatDuration(0),
    totalLessons: course.lessonsCount,
    cover: course.thumbnail ?? "",
    category: "",
    type: course.type,
    kind: course.kind,
    author: course.author,
    isFree: course.isFree,
    priceAmount: course.priceAmount,
    liveStatus: course.liveStatus,
    isPurchased: course.isPurchased,
    description: course.description,
  };
}

function toLessonUI(lesson: CourseLesson): CourseLessonUI {
  return {
    id: lesson.id,
    title: lesson.title,
    duration: formatDuration(lesson.durationSeconds),
    durationSeconds: lesson.durationSeconds,
    description: lesson.description,
    sectionId: lesson.sectionId,
    completed: lesson.completed,
    free: lesson.free,
    videoUrl: lesson.videoUrl,
    kind: lesson.kind,
    externalSourceId: lesson.externalSourceId,
    sourceProvider: lesson.sourceProvider,
    content: lesson.content,
  };
}

function toDiscussion(comment: {
  id: string;
  author?: string;
  content: string;
  createdAt: string;
}): CourseDiscussion {
  return {
    id: comment.id,
    user: {
      name: comment.author ?? "匿名",
      avatar: "",
    },
    content: comment.content,
    likes: 0,
    time: new Date(comment.createdAt).toLocaleDateString(),
  };
}

export class CourseService {
  static async getCategories(): Promise<CourseCategory[]> {
    const categories = await port().categories.list();
    return [...categories];
  }

  static async getCourses(
    params: { q?: string; categoryId?: string; kind?: string; level?: string; page?: number; pageSize?: number } = {},
  ): Promise<CourseData[]> {
    const courses = await port().courses.list({
      q: params.q,
      categoryId: params.categoryId,
      kind: params.kind,
      level: params.level,
      page: params.page,
      pageSize: params.pageSize,
    });
    return courses.map(toCourseData);
  }

  static async getCourseDetail(courseId: string): Promise<CourseData> {
    const course = await port().courses.retrieve(courseId);
    return toCourseData(course);
  }

  static async getCollectionItems(courseId: string): Promise<CourseData[]> {
    const courses = await port().courses.collectionItems(courseId);
    return courses.map(toCourseData);
  }

  static async getMyCourses(): Promise<MyCourseData[]> {
    const enrollments = await port().enrollments.current.list();
    return enrollments.map(toMyCourseData);
  }

  static async getMyLearningProgress(enrollmentId: string): Promise<CourseLearningProgress> {
    return port().progress.retrieve(enrollmentId);
  }

  /** Enrolls the current user into the first available offering of a course. */
  static async enrollInCourse(courseId: string): Promise<string> {
    const offerings = await port().offerings.list(courseId);
    const offeringId = offerings[0]?.id;
    if (!offeringId) {
      throw new CourseEnrollmentError("暂无可报名的课程班次");
    }
    await port().enrollments.create(offeringId, { source: "self_service" });
    return offeringId;
  }

  static async getLessons(courseId: string): Promise<CourseLessonUI[]> {
    const lessons = await port().lessons.list(courseId);
    return lessons.map(toLessonUI);
  }

  /** Groups the course sections with their lessons into a curriculum tree. */
  static async getCourseCurriculum(courseId: string): Promise<CourseSectionUI[]> {
    const [sections, lessons] = await Promise.all([
      port().sections.list(courseId),
      port().lessons.list(courseId),
    ]);
    const lessonUIs = lessons.map(toLessonUI);
    const grouped = sections.map((section) => ({
      section: section.title,
      lessons: lessonUIs.filter((lesson) => lesson.id === section.id || lesson.sectionId === section.id),
    }));
    const ungrouped = lessonUIs.filter((lesson) => !lesson.sectionId);
    if (ungrouped.length > 0) {
      grouped.push({ section: "全部课程", lessons: ungrouped });
    }
    return grouped.filter((group) => group.lessons.length > 0 || sections.length === 0);
  }

  static async updateLessonProgress(
    lessonId: string,
    command: { completed?: boolean; progressPercent?: number; watchSeconds?: number },
  ): Promise<void> {
    await port().lessonProgress.update(lessonId, command);
  }

  static async reportWatchPosition(
    lessonId: string,
    positionSeconds: number,
    durationSeconds?: number,
  ): Promise<void> {
    await port().lessonProgress.watchPositions.update(lessonId, {
      positionSeconds,
      durationSeconds,
    });
  }

  static async getLiveSessions(): Promise<CourseLiveSessionUI[]> {
    const sessions = await port().liveSessions.list();
    return sessions.map(toLiveSessionUI);
  }

  static async getLiveSessionDetail(liveSessionId: string): Promise<CourseLiveSessionUI> {
    const session = await port().liveSessions.retrieve(liveSessionId);
    return toLiveSessionUI(session);
  }

  static async joinLiveSession(liveSessionId: string): Promise<CourseLiveSessionUI> {
    const session = await port().liveSessions.join(liveSessionId);
    return toLiveSessionUI(session);
  }

  static async leaveLiveSession(liveSessionId: string): Promise<CourseLiveSessionUI> {
    const session = await port().liveSessions.leave(liveSessionId);
    return toLiveSessionUI(session);
  }

  static async getCourseDiscussions(
    courseId: string,
    lessonId?: string,
  ): Promise<CourseDiscussion[]> {
    const client = getCommentsRuntimeClient();
    const thread = await client.comments.threads.ensure({
      ownerKind: lessonId ? "course-lesson" : "course",
      ownerId: lessonId ?? courseId,
      title: "课程讨论",
    });
    const page = await client.comments.comments.list(thread.id, { pageSize: 50 });
    return (page.items ?? []).map((comment) =>
      toDiscussion({
        id: comment.id,
        author: comment.authorId,
        content: comment.body,
        createdAt: comment.createdAt,
      }),
    );
  }

  static async postDiscussion(
    courseId: string,
    lessonId: string | undefined,
    content: string,
  ): Promise<CourseDiscussion> {
    const client = getCommentsRuntimeClient();
    const thread = await client.comments.threads.ensure({
      ownerKind: lessonId ? "course-lesson" : "course",
      ownerId: lessonId ?? courseId,
      title: "课程讨论",
    });
    const response = await client.comments.comments.create(thread.id, { body: content });
    return toDiscussion({
      id: response.comment.id,
      author: response.comment.authorId,
      content: response.comment.body,
      createdAt: response.comment.createdAt,
    });
  }

  static async setReaction(
    targetType: "course" | "lesson" | "comment" | "live_session",
    targetId: string,
    reactionType: string,
    reactionValue: string,
  ): Promise<CourseReaction> {
    return port().reactions.update({ targetType, targetId, reactionType, reactionValue });
  }
}

function toMyCourseData(enrollment: CourseEnrollment): MyCourseData {
  return {
    id: enrollment.id,
    courseId: enrollment.courseId,
    title: enrollment.courseTitle ?? `课程 ${enrollment.courseId}`,
    cover: enrollment.courseThumbnail ?? "",
    progress: 0,
    totalLessons: 0,
    completedLessons: 0,
    lastWatched: new Date(enrollment.enrolledAt).toLocaleDateString(),
    enrollmentStatus: enrollment.enrollmentStatus,
  };
}

function toLiveSessionUI(session: CourseLiveSession): CourseLiveSessionUI {
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    liveStatus: session.liveStatus,
    scheduledStartAt: session.scheduledStartAt,
    scheduledEndAt: session.scheduledEndAt,
    actualStartAt: session.actualStartAt,
  };
}

export function useCourseService() {
  return CourseService;
}
