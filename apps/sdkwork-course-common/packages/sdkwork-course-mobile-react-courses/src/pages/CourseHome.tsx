import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, ChevronDown } from "lucide-react";
import {
  CourseService,
  CourseCapabilityUnavailableError,
  type CourseData,
  type CourseLiveSessionUI,
} from "../services/CourseService";
import { CourseCard, CourseCategoryTabs, CourseBanner } from "../components";
import { PageLayout, showToast } from "@sdkwork/ui-mobile-react";
import { CourseUnavailableView } from "./CourseUnavailableView";

interface CourseCategoryTab {
  id: string;
  name: string;
}

const COURSE_PAGE_SIZE = 10;

function formatLiveTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

interface LoadState {
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
}

export function CourseHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<CourseCategoryTab[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeKind, setActiveKind] = useState("all");
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [liveSessions, setLiveSessions] = useState<CourseLiveSessionUI[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>({
    loading: true,
    loadingMore: false,
    error: false,
  });
  const [unavailable, setUnavailable] = useState(false);

  // Guards against out-of-order responses while switching tabs.
  const requestSeq = useRef(0);

  const fetchCourses = useCallback(
    async (categoryId: string, kind: string, page: number, append: boolean) => {
      const seq = ++requestSeq.current;
      setLoadState((prev) => ({
        ...prev,
        loading: !append && page === 1,
        loadingMore: append,
        error: false,
      }));
      try {
        const rows = await CourseService.getCourses({
          categoryId: categoryId === "all" ? undefined : categoryId,
          kind: kind === "all" ? undefined : kind,
          page,
          pageSize: COURSE_PAGE_SIZE,
        });
        if (seq !== requestSeq.current) return;
        setCourses((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(rows.length >= COURSE_PAGE_SIZE);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        if (error instanceof CourseCapabilityUnavailableError) {
          setUnavailable(true);
        } else {
          setLoadState((prev) => ({ ...prev, error: true }));
          showToast(t("course.loadCoursesFailed", "获取课程列表失败"));
        }
      } finally {
        if (seq === requestSeq.current) {
          setLoadState((prev) => ({ ...prev, loading: false, loadingMore: false }));
        }
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState((prev) => ({ ...prev, loading: true }));
      try {
        const [categoryRows, liveRows] = await Promise.all([
          CourseService.getCategories(),
          CourseService.getLiveSessions(),
        ]);
        if (cancelled) return;
        setCategories(
          categoryRows.map((category) => ({ id: category.id, name: category.title })),
        );
        setLiveSessions(liveRows.slice(0, 3));
      } catch (error) {
        if (cancelled) return;
        if (error instanceof CourseCapabilityUnavailableError) {
          setUnavailable(true);
          return;
        }
        showToast(t("course.loadCoursesFailed", "获取课程列表失败"));
      }
      if (!cancelled) {
        setLoadState((prev) => ({ ...prev, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    void fetchCourses("all", "all", 1, false);
    return () => {
      requestSeq.current += 1;
    };
  }, [fetchCourses]);

  const handleTabChange = (id: string) => {
    setActiveCategory(id);
    void fetchCourses(id, activeKind, 1, false);
  };

  const handleKindChange = (kind: string) => {
    setActiveKind(kind);
    void fetchCourses(activeCategory, kind, 1, false);
  };

  const handleLoadMore = () => {
    if (loadState.loadingMore || !hasMore) return;
    const nextPage = Math.floor(courses.length / COURSE_PAGE_SIZE) + 1;
    void fetchCourses(activeCategory, activeKind, nextPage, true);
  };

  if (unavailable) {
    return (
      <CourseUnavailableView
        message={t("course.unavailable")}
        onBack={() => navigate(-1)}
        />
    );
  }

  const shownCategories: CourseCategoryTab[] = [
    { id: "all", name: t("course.all", "全部") },
    ...categories,
  ];

  const retryInitial = () => {
    void fetchCourses(activeCategory, activeKind, 1, false);
  };

  return (
    <PageLayout
      title={t("course.title", "课程")}
      bgClass="bg-[#F2F2F7] dark:bg-black"
      rightElement={
        <button
          onClick={() => navigate("/course/search")}
          className="w-9 h-9 flex items-center justify-center rounded-full text-text-sub active:bg-black/5 dark:active:bg-white/10 transition-colors"
          aria-label={t("course.searchPlaceholder", "搜索课程或讲师...")}
        >
          <Search className="w-5 h-5" />
        </button>
      }
    >

      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
        {[
          { id: "all", label: t("course.all", "全部") },
          { id: "standard", label: t("course.kindStandard", "课程") },
          { id: "column", label: t("course.kindColumn", "专栏") },
          { id: "collection", label: t("course.kindCollection", "合集") },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleKindChange(item.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              activeKind === item.id
                ? "bg-slate-900 text-white"
                : "bg-white text-text-sub dark:bg-[#1C1C1E]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <CourseCategoryTabs
        categories={shownCategories}
        activeTab={activeCategory}
        onTabChange={handleTabChange}
      />

      <CourseBanner />

      {liveSessions.length > 0 && (
        <div className="px-4 pb-2">
          <h2 className="text-[15px] font-bold text-text-main mb-3 mt-4">
            {t("course.liveClassroom", "直播课堂")}
          </h2>
          <div className="space-y-3">
            {liveSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden cursor-pointer active:bg-black/5 dark:active:bg-white/5 transition-colors shadow-sm"
                onClick={() => navigate(`/course/${session.id}/live`)}
              >
                <div className="h-24 bg-gradient-to-r from-red-500 to-pink-500 relative">
                  {session.liveStatus === "live" && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold animate-pulse">
                      {t("course.liveNow", "正在直播中")}
                    </span>
                  )}
                  {session.liveStatus === "scheduled" && (
                    <span className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold">
                      {t("course.liveUpcoming", "预告")}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-[14px] text-text-main mb-1 truncate">
                    {session.title}
                  </h3>
                  <p className="text-[12px] text-text-sub">
                    {formatLiveTime(session.scheduledStartAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        {loadState.loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-text-sub text-[13px]">
              {t("course.loading", "加载中...")}
            </span>
          </div>
        ) : loadState.error && courses.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-text-sub text-[13px]">
              {t("course.loadFailed", "加载失败，请重试")}
            </p>
            <button
              onClick={retryInitial}
              className="px-4 py-2 bg-blue-600 text-white rounded-full text-[13px] active:bg-blue-700"
            >
              {t("course.retry", "重试")}
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="text-4xl">📚</div>
            <p className="text-text-sub text-[13px]">
              {t("course.emptyCourses", "暂无课程")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => navigate(`/course/${course.id}`)}
                />
              ))}
            </div>

            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadState.loadingMore}
                className="mt-5 w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-white dark:bg-[#1C1C1E] text-text-sub text-[13px] font-medium active:bg-black/5 dark:active:bg-white/5 transition-colors shadow-sm disabled:opacity-50"
              >
                {loadState.loadingMore ? (
                  <>
                    <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    {t("course.loading", "加载中...")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {t("course.loadMore", "加载更多")}
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
