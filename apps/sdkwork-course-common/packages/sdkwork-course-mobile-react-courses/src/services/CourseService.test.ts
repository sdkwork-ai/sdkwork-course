import assert from "node:assert/strict";
import test from "node:test";

import type { CourseAppSdkPort } from "@sdkwork/course-sdk-ports";
import { CourseCapabilityUnavailableError, CourseEnrollmentError, CourseService } from "./CourseService";
import { configureCourseRuntimePort, resetCourseRuntimePort } from "./courseRuntimePort";

function createFakePort(): CourseAppSdkPort {
  return {
    categories: {
      async list() {
        return [{ id: "cat_1", title: "前端" }];
      },
    },
    courses: {
      async list() {
        return [
          {
            id: "course_1",
            title: "跨端技术合集",
            thumbnail: "https://example.com/cover.jpg",
            instructor: "讲师甲",
            lessonsCount: 12,
            studentsCount: 1200,
            ratingScore: "4.8",
            type: "vod",
          },
        ];
      },
      async retrieve(courseId) {
        if (courseId !== "course_1") {
          throw new Error("not found");
        }
        return {
          id: "course_1",
          title: "跨端技术合集",
          thumbnail: "https://example.com/cover.jpg",
          instructor: "讲师甲",
          lessonsCount: 12,
          studentsCount: 1200,
          ratingScore: "4.8",
          type: "vod",
        };
      },
      async collectionItems() {
        return [];
      },
    },
    offerings: {
      async list(courseId) {
        return courseId === "course_1" ? [{ id: "offering_1", courseId: "course_1" }] : [];
      },
    },
    enrollments: {
      async create(offeringId) {
        return {
          id: "enrollment_1",
          courseId: "course_1",
          enrollmentStatus: "active",
          enrolledAt: "2026-08-11T00:00:00Z",
        };
      },
      current: {
        async list() {
          return [
            {
              id: "enrollment_1",
              courseId: "course_1",
              enrollmentStatus: "active",
              enrolledAt: "2026-08-11T00:00:00Z",
              courseTitle: "跨端技术合集",
            },
          ];
        },
      },
    },
    sections: {
      async list(courseId) {
        return courseId === "course_1" ? [{ id: "section_1", courseId: "course_1", title: "第一章" }] : [];
      },
    },
    lessons: {
      async list(courseId) {
        return courseId === "course_1"
          ? [
              {
                id: "lesson_1",
                sectionId: "section_1",
                title: "第一节",
                durationSeconds: 600,
                kind: "vod_video",
              },
            ]
          : [];
      },
    },
    lessonProgress: {
      async update(lessonId, command) {
        return { lessonId, ...command };
      },
      watchPositions: {
        async update() {
          return {};
        },
      },
    },
    progress: {
      async retrieve() {
        return {
          completedLessonCount: 3,
          requiredLessonCount: 12,
          progressPercent: "25",
          watchSeconds: 3600,
          progressStatus: "in_progress",
        };
      },
    },
    liveSessions: {
      async list() {
        return [
          {
            id: "live_1",
            title: "直播专场",
            liveStatus: "scheduled",
            scheduledStartAt: "2026-08-12T10:00:00Z",
          },
        ];
      },
      async retrieve(liveSessionId) {
        if (liveSessionId !== "live_1") {
          throw new Error("not found");
        }
        return {
          id: "live_1",
          title: "直播专场",
          liveStatus: "scheduled",
          scheduledStartAt: "2026-08-12T10:00:00Z",
        };
      },
      async join(liveSessionId) {
        return {
          id: liveSessionId,
          title: "直播专场",
          liveStatus: "live",
          scheduledStartAt: "2026-08-12T10:00:00Z",
        };
      },
      async heartbeat(liveSessionId) {
        return { id: liveSessionId, title: "直播专场", liveStatus: "live", scheduledStartAt: "2026-08-12T10:00:00Z" };
      },
      async leave(liveSessionId) {
        return { id: liveSessionId, title: "直播专场", liveStatus: "ended", scheduledStartAt: "2026-08-12T10:00:00Z" };
      },
    },
    comments: {
      async list(courseId) {
        return courseId === "course_1"
          ? [
              {
                id: "comment_1",
                author: "学生甲",
                content: "讲得很清楚",
                createdAt: "2026-08-11T01:00:00Z",
              },
            ]
          : [];
      },
      async create(courseId, command) {
        return {
          id: "comment_2",
          courseId,
          targetType: command.targetType,
          targetId: command.targetId,
          content: command.content,
          createdAt: "2026-08-11T02:00:00Z",
        };
      },
    },
    reactions: {
      async update(command) {
        return {
          targetType: command.targetType,
          targetId: command.targetId,
          reactionType: command.reactionType,
          reactionValue: command.reactionValue,
        };
      },
    },
  };
}

test("course operations fail closed without a host-bound port", async () => {
  resetCourseRuntimePort();
  for (const operation of [
    () => CourseService.getCourses(),
    () => CourseService.getCourseDetail("course-id"),
    () => CourseService.getMyCourses(),
    () => CourseService.enrollInCourse("course-id"),
    () => CourseService.getCourseDiscussions("course-id"),
    () => CourseService.postDiscussion("course-id", undefined, "Comment"),
  ]) {
    await assert.rejects(operation, CourseCapabilityUnavailableError);
  }
});

test("course operations consume the host-injected port", async () => {
  configureCourseRuntimePort(createFakePort());
  try {
    const courses = await CourseService.getCourses({ page: 1, pageSize: 10 });
    assert.equal(courses.length, 1);
    assert.equal(courses[0].title, "跨端技术合集");
    assert.equal(courses[0].rating, 4.8);

    const filtered = await CourseService.getCourses({ q: "合集", categoryId: "cat_1" });
    assert.equal(filtered.length, 1);

    const detail = await CourseService.getCourseDetail("course_1");
    assert.equal(detail.id, "course_1");

    const offeringId = await CourseService.enrollInCourse("course_1");
    assert.equal(offeringId, "offering_1");

    const mine = await CourseService.getMyCourses();
    assert.equal(mine.length, 1);
    assert.equal(mine[0].title, "跨端技术合集");

    const progress = await CourseService.getMyLearningProgress("enrollment_1");
    assert.equal(progress.progressPercent, "25");

    const lessons = await CourseService.getLessons("course_1");
    assert.equal(lessons.length, 1);
    assert.equal(lessons[0].durationSeconds, 600);

    const curriculum = await CourseService.getCourseCurriculum("course_1");
    assert.equal(curriculum.length, 1);
    assert.equal(curriculum[0].section, "第一章");
    assert.equal(curriculum[0].lessons[0].id, "lesson_1");

    await CourseService.updateLessonProgress("lesson_1", { completed: true });
    await CourseService.reportWatchPosition("lesson_1", 30, 600);

    const liveSessions = await CourseService.getLiveSessions();
    assert.equal(liveSessions.length, 1);
    const liveDetail = await CourseService.getLiveSessionDetail("live_1");
    assert.equal(liveDetail.title, "直播专场");
    const joined = await CourseService.joinLiveSession("live_1");
    assert.equal(joined.liveStatus, "live");
    const left = await CourseService.leaveLiveSession("live_1");
    assert.equal(left.liveStatus, "ended");

    const discussions = await CourseService.getCourseDiscussions("course_1");
    assert.equal(discussions.length, 1);
    const posted = await CourseService.postDiscussion("course_1", undefined, "新评论");
    assert.equal(posted.content, "新评论");

    const reaction = await CourseService.setReaction("course", "course_1", "like", "true");
    assert.equal(reaction.reactionValue, "true");
  } finally {
    resetCourseRuntimePort();
  }
});


test("curriculum groups lessons without sections under the catch-all group", async () => {
  const ungroupedPort: CourseAppSdkPort = {
    ...createFakePort(),
    sections: {
      async list() {
        return [];
      },
    },
    lessons: {
      async list() {
        return [
          { id: "lesson_a", title: "无章节课时", durationSeconds: 300, kind: "vod_video" },
          { id: "lesson_b", title: "第二节", durationSeconds: 600, kind: "vod_video" },
        ];
      },
    },
  };
  configureCourseRuntimePort(ungroupedPort);
  try {
    const curriculum = await CourseService.getCourseCurriculum("course_1");
    assert.equal(curriculum.length, 1);
    assert.equal(curriculum[0].section, "全部课程");
    assert.equal(curriculum[0].lessons.length, 2);
  } finally {
    resetCourseRuntimePort();
  }
});

test("enrolling without an offering rejects with a typed error", async () => {
  configureCourseRuntimePort(createFakePort());
  try {
    await assert.rejects(CourseService.enrollInCourse("course_missing"), CourseEnrollmentError);
  } finally {
    resetCourseRuntimePort();
  }
});
