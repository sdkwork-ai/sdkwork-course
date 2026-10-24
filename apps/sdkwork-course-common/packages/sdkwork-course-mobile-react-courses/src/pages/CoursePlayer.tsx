import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Lock } from "lucide-react";
import {
  CourseService,
  CourseCapabilityUnavailableError,
  type CourseLessonUI,
  type CourseSectionUI,
} from "../services/CourseService";
import { VideoPlayer, PlayerCatalog, PlayerDiscussion } from "../components";
import { showToast } from "@sdkwork/ui-mobile-react";
import { CourseUnavailableView } from "./CourseUnavailableView";

export function CoursePlayer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Initial lesson selection is snapshotted once: lesson switches update the
  // URL via replace() and must not re-trigger the whole course load.
  const initialLessonId = useRef(searchParams.get("lesson") ?? "").current;

  const [curriculum, setCurriculum] = useState<CourseSectionUI[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const lastWatchReport = useRef(0);

  const loadPlayer = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      // Entitlement check: the player only unlocks enrolled courses. Free
      // lessons stay watchable through the catalog's per-lesson lock.
      const [sections, enrollments] = await Promise.all([
        CourseService.getCourseCurriculum(id),
        CourseService.getMyCourses().catch(() => []),
      ]);
      const enrolled = enrollments.some((enrollment) => enrollment.courseId === id);
      setCurriculum(sections);
      setIsPurchased(enrolled);
      const allLessons = sections.flatMap((section) => section.lessons);
      setActiveLessonId(
        initialLessonId && allLessons.some((lesson) => lesson.id === initialLessonId)
          ? initialLessonId
          : allLessons[0]?.id ?? "",
      );
    } catch (error) {
      if (error instanceof CourseCapabilityUnavailableError) {
        setUnavailable(true);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, [id, initialLessonId]);

  useEffect(() => {
    void loadPlayer();
  }, [loadPlayer]);

  const selectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setIsPlaying(false);
    lastWatchReport.current = 0;
    if (id) {
      navigate(`/course/${id}/play?lesson=${lessonId}`, { replace: true });
    }
  };

  const handleProgress = (currentTime: number, duration: number) => {
    // Report watch position at most once per 30 seconds of playback so the
    // learning progress stays current without spamming the API.
    if (currentTime - lastWatchReport.current >= 30) {
      lastWatchReport.current = currentTime;
      void CourseService.reportWatchPosition(activeLessonId, currentTime, duration).catch(
        () => {
          // Best-effort; playback continues.
        },
      );
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
        message={t("course.loadLessonsFailed", "加载课程内容失败")}
        onBack={() => navigate(-1)}
        onRetry={() => void loadPlayer()}
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

  const allLessons = curriculum.flatMap((section) => section.lessons);
  const currentLesson = allLessons.find((lesson) => lesson.id === activeLessonId);

  if (!currentLesson) {
    return (
      <CourseUnavailableView
        message={t("course.noContent", "未找到课程内容")}
        onBack={() => navigate(-1)}
        />
    );
  }

  const currentLessonUnlocked = isPurchased || Boolean(currentLesson.free);
  const isBilibiliLesson =
    currentLesson.sourceProvider === "bilibili" && Boolean(currentLesson.externalSourceId);
  const bilibiliPageMatch = isBilibiliLesson
    ? /\?p=(\d+)$/.exec(String(currentLesson.externalSourceId))
    : null;
  const bilibiliPage = bilibiliPageMatch ? Number(bilibiliPageMatch[1]) : 1;
  const bilibiliBvid = isBilibiliLesson
    ? String(currentLesson.externalSourceId).replace(/\?p=\d+$/, "")
    : "";
  const bilibiliOpenUrl = bilibiliBvid
    ? `https://www.bilibili.com/video/${bilibiliBvid}${bilibiliPage > 1 ? `?p=${bilibiliPage}` : ""}`
    : undefined;

  const renderLessonContent = () => {
    if (currentLesson.kind === "article") {
      return (
        <article className="aspect-auto min-h-[240px] bg-white dark:bg-[#1C1C1E] px-5 py-6">
          <h2 className="text-[17px] font-bold text-text-main mb-3">{currentLesson.title}</h2>
          {currentLesson.description && (
            <p className="text-[14px] leading-relaxed text-text-sub mb-4 whitespace-pre-wrap">
              {currentLesson.description}
            </p>
          )}
          {currentLesson.content ? (
            <div className="text-[14px] leading-relaxed text-text-main whitespace-pre-wrap">
              {currentLesson.content}
            </div>
          ) : (
            <p className="text-[13px] text-text-sub">
              {t("course.articlePlaceholder", "图文内容由课程服务提供")}
            </p>
          )}
        </article>
      );
    }

    if (currentLesson.kind === "download") {
      return (
        <div className="aspect-video flex items-center justify-center bg-black">
          <div className="text-white text-center px-6">
            <div className="text-4xl mb-3">⬇</div>
            <p className="text-[14px]">{currentLesson.title}</p>
            <p className="text-[12px] text-gray-400 mt-2 max-w-xs mx-auto">
              {currentLesson.description ||
                t("course.downloadPlaceholder", "本课时提供资料下载,请从课程资源中获取")}
            </p>
          </div>
        </div>
      );
    }

    if (currentLesson.kind === "live_session") {
      return (
        <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-black px-6">
          <span className="text-[12px] font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
            {t("course.liveTag", "直播")}
          </span>
          <p className="text-white text-[14px] text-center">{currentLesson.title}</p>
          <button
            onClick={() => navigate(`/course/${id}/live`)}
            className="bg-red-600 text-white font-medium px-6 py-2 rounded-full text-[13px] active:bg-red-700"
          >
            {t("course.goLive", "进入直播间")}
          </button>
        </div>
      );
    }

    if (isBilibiliLesson) {
      return (
        <div className="relative aspect-video bg-black">
          <iframe
            src={`https://player.bilibili.com/player.html?bvid=${bilibiliBvid}&page=${bilibiliPage}&high_quality=1&danmaku=0`}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
          {bilibiliOpenUrl && (
            <a
              href={bilibiliOpenUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute top-2 right-2 bg-black/60 text-white text-[12px] px-3 py-1.5 rounded-full backdrop-blur active:bg-black/80"
            >
              {t("course.openInBilibili", "在 B 站打开")}
            </a>
          )}
        </div>
      );
    }

    if (currentLesson.videoUrl) {
      return (
        <VideoPlayer
          videoSrc={currentLesson.videoUrl}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onProgress={handleProgress}
          onEnded={() => {
            void CourseService.updateLessonProgress(currentLesson.id, {
              completed: true,
              progressPercent: 100,
            }).catch(() => {
              // Progress reporting is best-effort; playback continues.
            });
          }}
        />
      );
    }

    return (
      <div className="aspect-video flex items-center justify-center">
        <div className="text-white text-center px-6">
          <div className="text-5xl mb-3">▶</div>
          <p className="text-[14px]">{currentLesson.title}</p>
          <p className="text-[12px] text-gray-400 mt-1">
            {t("course.videoPlaceholder", "视频内容由课程服务提供")}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black flex flex-col">
      <div className="bg-black">
        {currentLessonUnlocked ? (
          renderLessonContent()
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center gap-3 px-6">
            <Lock className="w-8 h-8 text-white/60" />
            <p className="text-white text-[14px] text-center">
              {t("course.lockLesson", "报名后解锁该课时")}
            </p>
            <button
              onClick={() => navigate(`/course/${id}/purchase`)}
              className="bg-blue-600 text-white font-medium px-6 py-2 rounded-full text-[13px] active:bg-blue-700"
            >
              {t("course.enrollNow", "立即报名")}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 bg-[#F2F2F7] dark:bg-black">
        <div className="bg-white dark:bg-[#1C1C1E] px-4 py-3 border-b border-black/5 dark:border-white/5 flex gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-[13px] text-text-sub"
          >
            ←
          </button>
          <h1 className="text-[15px] font-bold text-text-main truncate flex-1">
            {currentLesson.title}
          </h1>
        </div>

        <PlayerCatalog
          curriculum={curriculum.map((section) => ({
            section: section.section,
            lessons: section.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              duration: lesson.duration,
              completed: lesson.completed,
              free: lesson.free,
              kind: lesson.kind,
            })),
          }))}
          activeLesson={activeLessonId}
          isPurchased={isPurchased}
          onLessonSelect={selectLesson}
        />

        {currentLessonUnlocked && (
          <div className="px-4 py-4 bg-white dark:bg-[#1C1C1E] mt-2 border-t border-black/5 dark:border-white/5">
            <PlayerDiscussion courseId={id!} lessonId={currentLesson.id} />
          </div>
        )}
      </div>
    </div>
  );
}
