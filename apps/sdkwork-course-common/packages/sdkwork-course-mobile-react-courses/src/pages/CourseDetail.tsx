import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ThumbsUp, Star, ChevronLeft } from "lucide-react";
import {
  CourseService,
  CourseCapabilityUnavailableError,
  type CourseData,
  type CourseSectionUI,
} from "../services/CourseService";
import {
  CourseHeroHeader,
  CourseBasicInfo,
  CourseCurriculum,
  CourseInstructor,
  PlayerDiscussion,
  CourseFooterBar,
} from "../components";
import { showToast } from "@sdkwork/ui-mobile-react";
import { CourseUnavailableView } from "./CourseUnavailableView";

export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [curriculum, setCurriculum] = useState<CourseSectionUI[]>([]);
  const [collectionItems, setCollectionItems] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reactions, setReactions] = useState<{ like?: boolean; favorite?: boolean }>({});
  const [reacting, setReacting] = useState(false);

  const loadCourse = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const [detail, sections, enrollments] = await Promise.all([
        CourseService.getCourseDetail(id),
        CourseService.getCourseCurriculum(id),
        CourseService.getMyCourses().catch(() => []),
      ]);
      // Reflect the real entitlement: if the current user already enrolled in
      // this course the detail page unlocks it even when the catalog record
      // does not carry the flag.
      const enrolled = enrollments.some((enrollment) => enrollment.courseId === id);
      setCourse({ ...detail, isPurchased: detail.isPurchased ?? enrolled });
      setCurriculum(sections);
      if (detail.kind === "collection") {
        setCollectionItems(await CourseService.getCollectionItems(id).catch(() => []));
      } else {
        setCollectionItems([]);
      }
    } catch (error) {
      if (error instanceof CourseCapabilityUnavailableError) {
        setUnavailable(true);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await loadCourse();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCourse]);

  const handleReaction = async (reactionType: "like" | "favorite") => {
    if (!id || reacting) return;
    setReacting(true);
    try {
      const nextValue = reactions[reactionType] ? "false" : "true";
      await CourseService.setReaction("course", id, reactionType, nextValue);
      setReactions((prev) => ({ ...prev, [reactionType]: !prev[reactionType] }));
    } catch (error) {
      if (error instanceof CourseCapabilityUnavailableError) {
        setUnavailable(true);
      } else {
        showToast(t("course.sendFailed", "发送失败，请重试"));
      }
    } finally {
      setReacting(false);
    }
  };

  if (unavailable) {
    return (
      <CourseUnavailableView
        message={t("course.unavailable")}
        onBack={() => navigate(-1)}
        />
    );
  }

  if (loadFailed) {
    return (
      <CourseUnavailableView
        message={t("course.loadDetailFailed", "加载课程详情失败")}
        onBack={() => navigate(-1)}
        onRetry={() => void loadCourse()}
        />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-black flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-text-sub text-[13px]">
          {t("course.loading", "加载中...")}
        </span>
      </div>
    );
  }

  if (!course) {
    return (
      <CourseUnavailableView
        message={t("course.courseNotFound", "未找到课程")}
        onBack={() => navigate(-1)}
        />
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black pb-24">
      <div className="relative">
        <CourseHeroHeader course={course} id={course.id} navigate={navigate} />
        <button
          onClick={() => {
            // Prefer history back; fall back to the course home when the page
            // was opened directly (no SPA history to pop).
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/course");
            }
          }}
          aria-label={t("course.back", "返回")}
          className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-white active:bg-black/55 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
      <CourseBasicInfo course={course} />

      <div className="px-5 py-5 flex items-center gap-3 bg-white dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5">
        <button
          onClick={() => void handleReaction("like")}
          disabled={reacting}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
            reactions.like
              ? "bg-red-100 text-red-600 dark:bg-red-500/15"
              : "bg-[#F2F2F7] text-text-sub dark:bg-white/5 active:bg-black/5"
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          {reactions.like ? t("course.liked", "已赞") : t("course.like", "点赞")}
        </button>
        <button
          onClick={() => void handleReaction("favorite")}
          disabled={reacting}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
            reactions.favorite
              ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15"
              : "bg-[#F2F2F7] text-text-sub dark:bg-white/5 active:bg-black/5"
          }`}
        >
          <Star className="w-4 h-4" />
          {reactions.favorite ? t("course.favorited", "已藏") : t("course.favorite", "收藏")}
        </button>
      </div>

      {course.description && (
        <div className="px-5 py-5 bg-white dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5">
          <h2 className="text-[15px] font-bold text-text-main mb-2">
            {t("course.highlights", "课程亮点")}
          </h2>
          <p className="text-[13px] text-text-sub leading-relaxed">{course.description}</p>
        </div>
      )}

      {course.instructor && (
        <div className="px-5 py-5 bg-white dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5">
          <CourseInstructor
            instructor={course.instructor}
            instructorDesc={course.instructorDesc ?? ""}
            advantages={course.advantages}
          />
        </div>
      )}

      {course.kind === "collection" ? (
        <div className="px-5 py-5 bg-white dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-text-main">
              {t("course.collectionItems", "合集包含")}
            </h2>
            <span className="text-[11px] text-text-sub">{collectionItems.length} 门课程</span>
          </div>
          <ol className="space-y-2.5">
            {collectionItems.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/course/${item.id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-3 py-3 text-left active:bg-black/5 dark:active:bg-white/5"
                >
                  <span className="w-7 h-7 shrink-0 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-text-main">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-text-sub">
                      {item.author || item.instructor || "平台讲师"} · {item.totalLessons ?? 0} 课时
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-blue-500">进入</span>
                </button>
              </li>
            ))}
            {collectionItems.length === 0 ? (
              <li className="rounded-xl border border-dashed border-black/10 dark:border-white/10 px-4 py-6 text-center text-[12px] text-text-sub">
                合集内容整理中
              </li>
            ) : null}
          </ol>
        </div>
      ) : (
        <CourseCurriculum
          courseId={course.id}
          courseType={course.type ?? "recorded"}
          isPurchased={Boolean(course.isPurchased)}
          curriculum={curriculum.map((section) => ({
            section: section.section,
            lessons: section.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              free: lesson.free,
              kind: lesson.kind,
            })),
          }))}
        />
      )}

      <div className="px-5 py-5 bg-white dark:bg-[#1C1C1E] border-b border-black/5 dark:border-white/5">
        <h2 className="text-[15px] font-bold text-text-main mb-3">
          {t("course.discussionTitle", "互动讨论区")}
        </h2>
        <PlayerDiscussion courseId={course.id} />
      </div>

      <CourseFooterBar course={course} id={course.id} navigate={navigate} />
    </div>
  );
}
