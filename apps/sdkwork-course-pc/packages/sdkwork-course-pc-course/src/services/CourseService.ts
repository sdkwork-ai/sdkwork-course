import type { SdkworkAppClient } from '@sdkwork/course-app-sdk';
import {
  extractCourseEntity,
  extractCourseItems,
  readNumber,
  readOptionalString,
  readString,
} from '../courseApiHelpers';
import { getCoursePcSdkPorts } from '../sdkPorts';

export type CourseCategory = 'all' | 'live' | 'design' | 'frontend' | 'backend' | 'ai';

export interface CourseMessage {
  id: number;
  user: string;
  text: string;
  time: string;
  isPro: boolean;
}

export interface CourseComment {
  id: number;
  user: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
  isLiked: boolean;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  status: 'completed' | 'playing' | 'locked';
}

export interface CourseChapter {
  title: string;
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  type: 'video' | 'live';
  level: string;
  duration: string;
  students: number;
  viewers: number;
  updatedAt?: string;
  cover: string;
  category: CourseCategory;
  rating: number;
  progress: number;
  tags?: string[];
  chapters?: CourseChapter[];
  messages?: CourseMessage[];
  comments?: CourseComment[];
}

function normalizeCategory(record: Record<string, unknown>): CourseCategory {
  const raw = readString(record, 'category', 'categoryId', 'category_id', 'topic').toLowerCase();
  if (raw.includes('live')) {
    return 'live';
  }
  if (raw.includes('design') || raw.includes('ui')) {
    return 'design';
  }
  if (raw.includes('front')) {
    return 'frontend';
  }
  if (raw.includes('back') || raw.includes('cloud') || raw.includes('rust')) {
    return 'backend';
  }
  if (raw.includes('ai') || raw.includes('model')) {
    return 'ai';
  }
  return 'frontend';
}

function resolveCourseType(record: Record<string, unknown>): Course['type'] {
  const deliveryMode = readString(record, 'deliveryMode', 'delivery_mode', 'format').toLowerCase();
  if (deliveryMode.includes('live')) {
    return 'live';
  }
  const status = readString(record, 'status', 'lifecycleStatus', 'lifecycle_status').toLowerCase();
  if (status.includes('live')) {
    return 'live';
  }
  return 'video';
}

function readTags(record: Record<string, unknown>): string[] | undefined {
  const tags = record.tags ?? record.tagList ?? record.tag_list;
  if (!Array.isArray(tags)) {
    return undefined;
  }
  const normalized = tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function mapCourseSummary(record: Record<string, unknown>): Course | null {
  const id = readOptionalString(record, 'id', 'courseId', 'course_id');
  if (!id) {
    return null;
  }
  return {
    id,
    title: readString(record, 'title', 'name'),
    instructor: readString(record, 'instructorName', 'instructor_name', 'instructor', 'authorName', 'author_name'),
    type: resolveCourseType(record),
    level: readString(record, 'level', 'difficulty', 'difficultyLevel', 'difficulty_level'),
    duration: readString(record, 'duration', 'durationLabel', 'duration_label', 'lessonCountLabel', 'lesson_count_label'),
    students: readNumber(record, 'studentCount', 'student_count', 'enrollmentCount', 'enrollment_count') ?? 0,
    viewers: readNumber(record, 'viewerCount', 'viewer_count', 'liveViewerCount', 'live_viewer_count') ?? 0,
    updatedAt: readOptionalString(record, 'updatedAt', 'updated_at'),
    cover: readString(record, 'coverUrl', 'cover_url', 'thumbnailUrl', 'thumbnail_url', 'posterUrl', 'poster_url'),
    category: normalizeCategory(record),
    rating: readNumber(record, 'rating', 'averageRating', 'average_rating') ?? 0,
    progress: readNumber(record, 'progressPercent', 'progress_percent', 'progress') ?? 0,
    tags: readTags(record),
  };
}

function mapLesson(record: Record<string, unknown>): CourseLesson | null {
  const id = readOptionalString(record, 'id', 'lessonId', 'lesson_id');
  if (!id) {
    return null;
  }
  const progress = readNumber(record, 'progressPercent', 'progress_percent', 'progress') ?? 0;
  let status: CourseLesson['status'] = 'locked';
  if (progress >= 100) {
    status = 'completed';
  } else if (progress > 0) {
    status = 'playing';
  }
  return {
    id,
    title: readString(record, 'title', 'name'),
    duration: readString(record, 'duration', 'durationLabel', 'duration_label'),
    status,
  };
}

function mapComment(record: Record<string, unknown>, index: number): CourseComment {
  return {
    id: readNumber(record, 'id') ?? index + 1,
    user: readString(record, 'authorName', 'author_name', 'userName', 'user_name', 'user'),
    avatar: readString(record, 'authorAvatarUrl', 'author_avatar_url', 'avatarUrl', 'avatar_url'),
    text: readString(record, 'content', 'text', 'body'),
    time: readString(record, 'createdAt', 'created_at', 'time'),
    likes: readNumber(record, 'likeCount', 'like_count', 'likes') ?? 0,
    isLiked: Boolean(record.isLiked ?? record.is_liked),
  };
}

function groupLessonsBySection(
  sections: Record<string, unknown>[],
  lessons: Record<string, unknown>[],
): CourseChapter[] {
  if (sections.length === 0) {
    const mappedLessons = lessons
      .map((lesson) => mapLesson(lesson))
      .filter((lesson): lesson is CourseLesson => lesson != null);
    if (mappedLessons.length === 0) {
      return [];
    }
    return [{ title: 'Course lessons', lessons: mappedLessons }];
  }

  const lessonsBySection = new Map<string, CourseLesson[]>();
  for (const lesson of lessons) {
    const mapped = mapLesson(lesson);
    if (!mapped) {
      continue;
    }
    const sectionId = readString(lesson, 'sectionId', 'section_id') || 'default';
    const bucket = lessonsBySection.get(sectionId) ?? [];
    bucket.push(mapped);
    lessonsBySection.set(sectionId, bucket);
  }

  return sections.map((section) => {
    const sectionId = readString(section, 'id', 'sectionId', 'section_id');
    return {
      title: readString(section, 'title', 'name') || 'Section',
      lessons: lessonsBySection.get(sectionId) ?? [],
    };
  });
}

class SdkworkCourseService {
  private client(): SdkworkAppClient {
    return getCoursePcSdkPorts().getCourseClient();
  }

  async getCourses(): Promise<Course[]> {
    const response = await this.client().courses.list();
    return extractCourseItems(response)
      .map((record) => mapCourseSummary(record))
      .filter((course): course is Course => course != null);
  }

  async getFeaturedCourse(): Promise<Course | null> {
    const courses = await this.getCourses();
    return courses.find((course) => course.type === 'live') ?? courses[0] ?? null;
  }

  async getCourseDetail(courseId: string): Promise<Course | null> {
    const retrieveResponse = await this.client().courses.retrieve(courseId);
    const baseRecord = extractCourseEntity(retrieveResponse);
    const summary = baseRecord ? mapCourseSummary(baseRecord) : null;
    if (!summary) {
      return null;
    }

    const [sectionsResponse, lessonsResponse, liveSessionsResponse] = await Promise.all([
      this.client().courseSections.list(courseId),
      this.client().courseLessons.list(courseId),
      this.client().courseLiveSessions.list(),
    ]);

    const chapters = groupLessonsBySection(
      extractCourseItems(sectionsResponse),
      extractCourseItems(lessonsResponse),
    );
    const liveSessions = extractCourseItems(liveSessionsResponse);
    const activeLive = liveSessions.find((session) => {
      const linkedCourseId = readString(session, 'courseId', 'course_id');
      return linkedCourseId === courseId;
    });

    return {
      ...summary,
      type: activeLive ? 'live' : summary.type,
      viewers: readNumber(activeLive ?? {}, 'viewerCount', 'viewer_count') ?? summary.viewers,
      chapters: chapters.length > 0 ? chapters : summary.chapters,
    };
  }
}

export const courseService = new SdkworkCourseService();

const PC_COURSE_COMMENTS_UNAVAILABLE = 'pc course comments contract is not available';
const PC_COURSE_LIVE_CHAT_UNAVAILABLE = 'pc course live chat contract is not available';

export interface CourseInteractionService {
  createComment(_courseId: string, _content: string): Promise<void>;
  sendLiveMessage(_courseId: string, _content: string): Promise<void>;
}

class SdkworkCourseInteractionService implements CourseInteractionService {
  async createComment(_courseId: string, _content: string): Promise<void> {
    throw new Error(PC_COURSE_COMMENTS_UNAVAILABLE);
  }

  async sendLiveMessage(_courseId: string, _content: string): Promise<void> {
    throw new Error(PC_COURSE_LIVE_CHAT_UNAVAILABLE);
  }
}

export const courseInteractionService = new SdkworkCourseInteractionService();

export { PC_COURSE_COMMENTS_UNAVAILABLE, PC_COURSE_LIVE_CHAT_UNAVAILABLE };
