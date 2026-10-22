import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Undo2,
  XCircle,
} from 'lucide-react';
import { cn } from './utils/cn';
import {
  courseConsoleService,
  type ConsoleCourseCategoryItem,
  type ConsoleCourseItem,
  type ConsoleReviewDetail,
  type ConsoleReviewStats,
} from './services/CourseConsoleService';

type AdminTab = 'overview' | 'reviews' | 'courses' | 'categories';
type ReviewFilter = 'pending' | 'returned' | 'published';

function categoryLabel(value?: string | null): string {
  if (!value) return '未分类';
  if (value.startsWith('course-category-')) {
    return value.slice('course-category-'.length).replace(/-/g, ' ');
  }
  return value;
}

const TAB_ITEMS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: '概览', icon: <Sparkles size={16} /> },
  { id: 'reviews', label: '审核队列', icon: <ShieldCheck size={16} /> },
  { id: 'courses', label: '课程管理', icon: <BookOpen size={16} /> },
  { id: 'categories', label: '分类管理', icon: <Layers size={16} /> },
];

const REVIEW_FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'pending', label: '待审核' },
  { id: 'returned', label: '已退回' },
  { id: 'published', label: '已通过' },
];

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: string): string {
  if (kind === 'column') return '专栏';
  if (kind === 'collection') return '合集';
  return '课程';
}

function stateLabel(course: ConsoleCourseItem): string {
  if (course.publishStatus === 'reviewing') return '待审核';
  if (course.publishStatus === 'published') return '已发布';
  if (course.publishStatus === 'unpublished') return '已下架';
  if (course.reviewedAt && course.reviewNote) return '已退回';
  return '草稿';
}

function stateTone(course: ConsoleCourseItem): string {
  if (course.publishStatus === 'reviewing') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (course.publishStatus === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (course.publishStatus === 'unpublished') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (course.reviewNote) return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-console-border bg-console-bg-panel text-console-text-muted';
}

export const CourseAdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<ConsoleReviewStats | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('pending');
  const [reviews, setReviews] = useState<ConsoleCourseItem[]>([]);
  const [courses, setCourses] = useState<ConsoleCourseItem[]>([]);
  const [categories, setCategories] = useState<ConsoleCourseCategoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [courseStatus, setCourseStatus] = useState('');
  const [courseKind, setCourseKind] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsoleReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'reject' | 'request_changes' | null>(null);
  const [mutating, setMutating] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setStats(await courseConsoleService.reviewStats());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '概览加载失败');
    }
  }, []);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status =
        reviewFilter === 'pending' ? 'reviewing' : reviewFilter === 'published' ? 'published' : 'draft';
      const result = await courseConsoleService.listReviews({ status, q: query.trim() || undefined, limit: 50 });
      setReviews(
        reviewFilter === 'returned'
          ? result.items.filter((item) => Boolean(item.reviewNote && item.reviewedAt))
          : result.items,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '审核队列加载失败');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [query, reviewFilter]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await courseConsoleService.listCourses({
        q: query.trim() || undefined,
        status: courseStatus || undefined,
        kind: courseKind || undefined,
        limit: 100,
      });
      setCourses(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '课程列表加载失败');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [courseKind, courseStatus, query]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await courseConsoleService.listCategories({ q: query.trim() || undefined, limit: 100 });
      setCategories(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '分类列表加载失败');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'reviews') void loadReviews();
    else if (activeTab === 'courses') void loadCourses();
    else if (activeTab === 'categories') void loadCategories();
  }, [activeTab, loadCategories, loadCourses, loadReviews]);

  const openDetail = async (courseId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await courseConsoleService.getReviewDetail(courseId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '审核详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterDecision = async () => {
    await Promise.all([loadStats(), loadReviews(), loadCourses()]);
    setDetail(null);
    setReviewAction(null);
    setReviewNote('');
  };

  const decide = async (decision: 'approve' | 'reject' | 'request_changes', note?: string) => {
    if (!detail) return;
    setMutating(true);
    setError(null);
    try {
      await courseConsoleService.reviewCourse(detail.course.id, decision, note);
      setNotice(
        decision === 'approve'
          ? `已通过「${detail.course.title}」并自动创建默认班次`
          : `已退回「${detail.course.title}」，作者会收到审核反馈`,
      );
      await refreshAfterDecision();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '审核操作失败');
    } finally {
      setMutating(false);
    }
  };

  const offlineCourse = async (course: ConsoleCourseItem) => {
    const note = window.prompt(`下架「${course.title}」的原因（会记录在审核反馈中）`, '运营下架');
    if (note == null) return;
    setMutating(true);
    setError(null);
    try {
      await courseConsoleService.offlineCourse(course.id, note);
      setNotice(`已下架「${course.title}」`);
      await Promise.all([loadStats(), loadCourses(), loadReviews()]);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '下架失败');
    } finally {
      setMutating(false);
    }
  };

  const createCategory = async () => {
    if (!categoryName.trim()) return;
    setMutating(true);
    setError(null);
    try {
      await courseConsoleService.createCategory({ name: categoryName.trim() });
      setCategoryName('');
      setShowCategoryForm(false);
      setNotice('分类已创建');
      await loadCategories();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '创建分类失败');
    } finally {
      setMutating(false);
    }
  };

  const pendingCount = stats?.pending ?? reviews.length;
  const activeReviewCount = reviewFilter === 'pending' ? pendingCount : reviews.length;

  return (
    <div className="flex min-h-[720px] flex-col overflow-hidden rounded-2xl border border-console-border bg-console-bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-console-border bg-console-bg-panel/70 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-console-text-main">课程运营后台</h1>
            <p className="text-xs text-console-text-muted">
              审核创作者内容、管理课程与分类，并跟踪内容健康度
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadStats();
              if (activeTab === 'reviews') void loadReviews();
              if (activeTab === 'courses') void loadCourses();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-console-border px-3 py-2 text-xs font-medium text-console-text-muted transition hover:text-console-text-main"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            待审核 {pendingCount}
          </span>
        </div>
      </div>

      <div className="flex flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-console-border bg-console-bg-root/40 p-3 md:block">
          <nav className="space-y-1">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-console-text-muted hover:bg-console-bg-hover hover:text-console-text-main',
                )}
              >
                {item.icon}
                {item.label}
                {item.id === 'reviews' && pendingCount > 0 ? (
                  <span
                    className={cn(
                      'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      activeTab === 'reviews' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {notice ? (
            <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="text-emerald-500">
                ×
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-rose-500">
                ×
              </button>
            </div>
          ) : null}

          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl bg-console-bg-root/60 p-1 md:hidden">
              {TAB_ITEMS.map((item) => (
                <button
                  key={`mobile-${item.id}`}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-semibold',
                    activeTab === item.id ? 'bg-blue-600 text-white' : 'text-console-text-muted',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' ? (
              <OverviewPanel
                stats={stats}
                onOpenReviews={() => setActiveTab('reviews')}
                onOpenCourses={() => setActiveTab('courses')}
              />
            ) : activeTab === 'reviews' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {REVIEW_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setReviewFilter(filter.id)}
                        className={cn(
                          'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                          reviewFilter === filter.id
                            ? 'bg-slate-900 text-white'
                            : 'border border-console-border text-console-text-muted hover:text-console-text-main',
                        )}
                      >
                        {filter.label}
                        {filter.id === 'pending' && pendingCount > 0 ? ` · ${pendingCount}` : ''}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-console-text-muted" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索标题或作者..."
                      className="w-full rounded-lg border border-console-border bg-console-input-bg py-2 pl-9 pr-3 text-sm text-console-text-main outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {loading ? (
                  <ConsoleLoading label="正在加载审核队列..." />
                ) : reviews.length === 0 ? (
                  <ConsoleEmpty
                    title={reviewFilter === 'pending' ? '暂无待审核内容' : '没有符合条件的内容'}
                    description={
                      reviewFilter === 'pending'
                        ? '创作者提交课程后会自动出现在这里，审核通过即发布。'
                        : '调整筛选条件或搜索关键词后再试。'
                    }
                  />
                ) : (
                  <div className="grid gap-3">
                    {reviews.map((course) => (
                      <article
                        key={course.id}
                        className="flex flex-col gap-4 rounded-xl border border-console-border bg-console-bg-root/30 p-4 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', stateTone(course))}>
                              {stateLabel(course)}
                            </span>
                            <span className="rounded-full border border-console-border px-2 py-0.5 text-[11px] text-console-text-muted">
                              {kindLabel(course.kind)}
                            </span>
                            {course.reviewRound > 0 ? (
                              <span className="text-[11px] text-console-text-muted">
                                第 {course.reviewRound} 次提交
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-2 truncate text-sm font-semibold text-console-text-main">
                            {course.title}
                          </h3>
                          <p className="mt-1 line-clamp-1 text-xs text-console-text-muted">
                            {course.summary ?? '暂无简介'}
                          </p>
                          <p className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-console-text-muted">
                            <span>作者：{course.author ?? '官方内容'}</span>
                            <span>{course.lessonsCount} 课时</span>
                            <span>{course.isFree ? '免费' : `¥${course.priceAmount ?? '—'}`}</span>
                            <span>提交：{formatDate(course.submittedAt)}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openDetail(course.id)}
                            className="rounded-lg border border-console-border px-3 py-2 text-xs font-semibold text-console-text-main hover:bg-console-bg-hover"
                          >
                            查看详情
                          </button>
                          {reviewFilter === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={mutating}
                                onClick={() => void openDetail(course.id)}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                审核
                              </button>
                            </>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : activeTab === 'courses' ? (
              <section className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-console-text-muted" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索课程、编码或作者..."
                      className="w-full rounded-lg border border-console-border bg-console-input-bg py-2 pl-9 pr-3 text-sm text-console-text-main outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={courseStatus}
                    onChange={(event) => setCourseStatus(event.target.value)}
                    className="rounded-lg border border-console-border bg-console-input-bg px-3 py-2 text-sm text-console-text-main"
                  >
                    <option value="">全部状态</option>
                    <option value="draft">草稿 / 退回</option>
                    <option value="reviewing">审核中</option>
                    <option value="published">已发布</option>
                    <option value="unpublished">已下架</option>
                  </select>
                  <select
                    value={courseKind}
                    onChange={(event) => setCourseKind(event.target.value)}
                    className="rounded-lg border border-console-border bg-console-input-bg px-3 py-2 text-sm text-console-text-main"
                  >
                    <option value="">全部类型</option>
                    <option value="standard">课程</option>
                    <option value="column">专栏</option>
                    <option value="collection">合集</option>
                  </select>
                </div>

                {loading ? (
                  <ConsoleLoading label="正在加载课程..." />
                ) : courses.length === 0 ? (
                  <ConsoleEmpty title="暂无课程" description="调整筛选条件，或从创作者中心创建内容。" />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-console-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-console-bg-root/60 text-[11px] uppercase tracking-wide text-console-text-muted">
                        <tr>
                          <th className="px-4 py-3 font-semibold">课程</th>
                          <th className="px-4 py-3 font-semibold">类型</th>
                          <th className="px-4 py-3 font-semibold">状态</th>
                          <th className="px-4 py-3 font-semibold">数据</th>
                          <th className="px-4 py-3 font-semibold">更新时间</th>
                          <th className="px-4 py-3 text-right font-semibold">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-console-border/70">
                        {courses.map((course) => (
                          <tr key={course.id} className="bg-console-bg-panel/40">
                            <td className="px-4 py-3">
                              <p className="max-w-[280px] truncate font-semibold text-console-text-main">
                                {course.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-console-text-muted">
                                {course.courseCode || course.id} · {course.author ?? '官方内容'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-console-text-muted">{kindLabel(course.kind)}</td>
                            <td className="px-4 py-3">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', stateTone(course))}>
                                {stateLabel(course)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-console-text-muted">
                              {course.lessonsCount} 课时 · {course.studentsCount} 人
                            </td>
                            <td className="px-4 py-3 text-xs text-console-text-muted">
                              {formatDate(course.reviewedAt ?? course.submittedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void openDetail(course.id)}
                                  className="rounded-md border border-console-border px-2 py-1 text-[11px] text-console-text-muted hover:text-console-text-main"
                                >
                                  详情
                                </button>
                                {course.publishStatus === 'published' ? (
                                  <button
                                    type="button"
                                    disabled={mutating}
                                    onClick={() => void offlineCourse(course)}
                                    className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    下架
                                  </button>
                                ) : course.publishStatus === 'reviewing' ? (
                                  <button
                                    type="button"
                                    onClick={() => void openDetail(course.id)}
                                    className="rounded-md bg-blue-600 px-2 py-1 text-[11px] text-white"
                                  >
                                    审核
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-console-text-main">课程分类</h2>
                    <p className="mt-1 text-xs text-console-text-muted">分类用于首页筛选与课程归属</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCategoryForm((open) => !open)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={14} />
                    新建分类
                  </button>
                </div>
                {showCategoryForm ? (
                  <div className="flex flex-wrap items-end gap-3 rounded-xl border border-console-border bg-console-bg-root/40 p-4">
                    <label className="min-w-[220px] flex-1">
                      <span className="mb-1 block text-xs font-semibold text-console-text-muted">分类名称</span>
                      <input
                        value={categoryName}
                        onChange={(event) => setCategoryName(event.target.value)}
                        placeholder="例如：AI 与大模型"
                        className="w-full rounded-lg border border-console-border bg-console-input-bg px-3 py-2 text-sm text-console-text-main outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={mutating || !categoryName.trim()}
                      onClick={() => void createCategory()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      保存分类
                    </button>
                  </div>
                ) : null}
                {loading ? (
                  <ConsoleLoading label="正在加载分类..." />
                ) : categories.length === 0 ? (
                  <ConsoleEmpty title="暂无分类" description="创建第一个分类，让课程有清晰的归属。" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="rounded-xl border border-console-border bg-console-bg-root/30 p-4"
                      >
                        <p className="text-sm font-semibold text-console-text-main">{category.name}</p>
                        <p className="mt-1 text-[11px] text-console-text-muted">
                          {category.slug || category.id} · 排序 {category.sortOrder}
                        </p>
                        <span className="mt-2 inline-block rounded-full border border-console-border px-2 py-0.5 text-[10px] text-console-text-muted">
                          {category.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {detail || detailLoading ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-8">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">审核详情</h2>
                <p className="mt-0.5 text-xs text-slate-500">核对内容质量、定价与作者信息后作出决定</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setReviewAction(null);
                }}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            {detailLoading || !detail ? (
              <ConsoleLoading label="正在加载审核详情..." />
            ) : (
              <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', stateTone(detail.course))}>
                        {stateLabel(detail.course)}
                      </span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                        {kindLabel(detail.course.kind)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-slate-900">{detail.course.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{detail.course.summary ?? '暂无简介'}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      作者：{detail.course.author ?? '官方内容'} · 分类：{categoryLabel(detail.course.category)} ·{' '}
                      {detail.course.isFree ? '免费' : `¥${detail.course.priceAmount ?? '—'}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-lg font-bold text-slate-900">{detail.sections.length}</p>
                      <p className="text-[10px] text-slate-500">章节</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-lg font-bold text-slate-900">{detail.lessons.length}</p>
                      <p className="text-[10px] text-slate-500">课时</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-lg font-bold text-slate-900">
                        {detail.collectionItems.length || detail.resources.length}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {detail.course.kind === 'collection' ? '课程' : '资料'}
                      </p>
                    </div>
                  </div>
                </div>

                {detail.course.reviewNote ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    上一次审核反馈：{detail.course.reviewNote}
                  </div>
                ) : null}

                {detail.course.kind === 'collection' ? (
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">合集内容</h4>
                    <ol className="mt-2 space-y-2">
                      {detail.collectionItems.map((item, index) => (
                        <li key={item.courseId} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{item.title}</span>
                          <span className="text-[11px] text-slate-500">{item.lessonsCount} 课时</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">章节与课时</h4>
                    <div className="mt-2 space-y-2">
                      {detail.sections.map((section) => {
                        const lessons = detail.lessons.filter(
                          (lesson) => lesson.sectionId === section.id || (!lesson.sectionId && detail.sections.length === 1),
                        );
                        return (
                          <div key={section.id} className="rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between bg-slate-50/70 px-3 py-2">
                              <span className="text-sm font-semibold text-slate-800">{section.title}</span>
                              <span className="text-[11px] text-slate-500">{lessons.length} 课时</span>
                            </div>
                            <ul className="divide-y divide-slate-50">
                              {lessons.map((lesson) => (
                                <li key={lesson.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                  <span className="min-w-0 truncate text-xs text-slate-700">{lesson.title}</span>
                                  <span className="shrink-0 text-[10px] text-slate-400">
                                    {lesson.kind === 'article' ? '图文' : lesson.kind === 'live_session' ? '直播' : '视频'}
                                    {lesson.freePreview ? ' · 试看' : ''}
                                  </span>
                                </li>
                              ))}
                              {lessons.length === 0 ? (
                                <li className="px-3 py-2 text-[11px] text-slate-400">该章节暂无课时</li>
                              ) : null}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {detail.course.publishStatus === 'reviewing' ? (
                  reviewAction ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {reviewAction === 'reject' ? '退回并说明原因' : '要求作者修改'}
                      </p>
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        rows={4}
                        placeholder="请说明需要修改的具体问题，作者会在创作中心看到这条反馈..."
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewAction(null);
                            setReviewNote('');
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={mutating || reviewNote.trim().length < 5}
                          onClick={() => void decide(reviewAction, reviewNote)}
                          className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          确认退回
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() => setReviewAction('request_changes')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50"
                      >
                        <Clock3 size={14} />
                        要求修改
                      </button>
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() => setReviewAction('reject')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        退回
                      </button>
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() => void decide('approve')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        通过并发布
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDetail(null)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                    >
                      关闭
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

function OverviewPanel({
  stats,
  onOpenReviews,
  onOpenCourses,
}: {
  stats: ConsoleReviewStats | null;
  onOpenReviews: () => void;
  onOpenCourses: () => void;
}) {
  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="待审核" value={stats?.pending ?? 0} hint="需要运营处理" tone="warning" icon={<Clock3 size={18} />} onClick={onOpenReviews} />
        <StatTile label="已退回" value={stats?.changesRequested ?? 0} hint="等待作者修改" tone="default" icon={<Undo2 size={18} />} onClick={onOpenReviews} />
        <StatTile label="已发布" value={stats?.published ?? 0} hint="学习者可见" tone="success" icon={<CheckCircle2 size={18} />} onClick={onOpenCourses} />
        <StatTile label="UGC 内容" value={stats?.ugcTotal ?? 0} hint={`已发布 ${stats?.ugcPublished ?? 0}`} tone="default" icon={<Sparkles size={18} />} onClick={onOpenCourses} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-console-border bg-console-bg-root/30 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-console-text-main">审核健康度</h2>
              <p className="mt-1 text-xs text-console-text-muted">审核时效与积压情况</p>
            </div>
            <ShieldCheck className="text-blue-600" size={20} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-console-bg-panel p-4">
              <p className="text-xs text-console-text-muted">平均审核时长</p>
              <p className="mt-1 text-2xl font-bold text-console-text-main">
                {stats ? `${stats.avgReviewHours.toFixed(1)} h` : '—'}
              </p>
              <p className="mt-1 text-[11px] text-console-text-muted">从提交到首次决定</p>
            </div>
            <div className="rounded-xl bg-console-bg-panel p-4">
              <p className="text-xs text-console-text-muted">超 48h 未处理</p>
              <p className={cn('mt-1 text-2xl font-bold', (stats?.pendingOverdue ?? 0) > 0 ? 'text-amber-600' : 'text-console-text-main')}>
                {stats?.pendingOverdue ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-console-text-muted">建议优先处理</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenReviews}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            进入审核队列
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="rounded-2xl border border-console-border bg-console-bg-root/30 p-5">
          <h2 className="text-sm font-semibold text-console-text-main">运营检查清单</h2>
          <ul className="mt-3 space-y-2 text-xs text-console-text-muted">
            <li className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 text-emerald-600" />核对封面、标题与简介是否与实际内容一致</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 text-emerald-600" />检查课时是否可播放或可阅读，资料是否可下载</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 text-emerald-600" />付费内容核对价格、章节完整度与权益说明</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 text-emerald-600" />合集至少包含 1 门已发布课程</li>
            <li className="flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 text-amber-500" />退回时写明可执行的修改项，避免重复提交</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-console-border bg-console-bg-root/30 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-console-text-main">快捷入口</h2>
            <p className="mt-1 text-xs text-console-text-muted">查看最近提交或进入课程治理</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpenReviews}
            className="flex items-center justify-between rounded-xl border border-console-border bg-white px-4 py-3 text-left transition hover:border-blue-300"
          >
            <span>
              <span className="block text-xs font-semibold text-console-text-main">审核队列</span>
              <span className="mt-0.5 block text-[11px] text-console-text-muted">
                待处理 {stats?.pending ?? 0} 项
              </span>
            </span>
            <ChevronRight size={16} className="text-blue-600" />
          </button>
          <button
            type="button"
            onClick={onOpenCourses}
            className="flex items-center justify-between rounded-xl border border-console-border bg-white px-4 py-3 text-left transition hover:border-blue-300"
          >
            <span>
              <span className="block text-xs font-semibold text-console-text-main">课程治理</span>
              <span className="mt-0.5 block text-[11px] text-console-text-muted">
                已发布 {stats?.published ?? 0} 门内容
              </span>
            </span>
            <ChevronRight size={16} className="text-blue-600" />
          </button>
        </div>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'warning' | 'success' | 'default';
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm',
        tone === 'warning' && 'border-amber-200 bg-amber-50/60',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/60',
        tone === 'default' && 'border-console-border bg-console-bg-root/30',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-console-text-muted">{label}</span>
        <span className="text-console-text-muted">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-console-text-main">{value}</p>
      <p className="mt-1 text-[11px] text-console-text-muted">{hint}</p>
    </button>
  );
}

function ConsoleLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      <span className="text-sm text-console-text-muted">{label}</span>
    </div>
  );
}

function ConsoleEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-console-border bg-console-bg-root/20 p-8 text-center">
      <BookOpen size={28} className="text-console-text-muted/60" />
      <p className="text-sm font-semibold text-console-text-main">{title}</p>
      <p className="max-w-md text-xs text-console-text-muted">{description}</p>
    </div>
  );
}
