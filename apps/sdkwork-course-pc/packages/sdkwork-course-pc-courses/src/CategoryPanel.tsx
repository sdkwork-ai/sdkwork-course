import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export interface CategoryPanelProps {
  categories: Array<{ id: string; name: string }>
  /** Render a narrower 4-column topic grid for embedded host surfaces. */
  compact?: boolean
}

const FALLBACK_TOPICS = [
  '编程开发',
  '设计创意',
  'AI 与大模型',
  '商业管理',
  '语言学习',
  '职场效率',
  '数据分析',
  '产品运营',
  '前端开发',
  '后端架构',
  '云原生',
  '人工智能',
  '视觉设计',
  '求职面试',
  '学习方法',
  '职场沟通',
]

const SHORTCUTS = [
  { label: '合集', to: '/courses?kind=collection', icon: '▦' },
  { label: '直播', to: '/live', icon: '◉' },
  { label: '学习路径', to: '/courses?level=beginner', icon: '⌁' },
  { label: '我的学习', to: '/my', icon: '◐' },
  { label: '上传课程', to: '/studio?create=1', icon: '↥' },
  { label: '体系课程', to: '/courses?kind=standard', icon: '▤' },
]

export function CategoryPanel({ categories, compact = false }: CategoryPanelProps) {
  const { pathname, search } = useLocation()
  const activeKind = new URLSearchParams(search).get('kind') ?? ''
  const courseActive =
    pathname.startsWith('/courses') && activeKind !== 'column' && activeKind !== 'collection'
  const columnActive = pathname === '/courses' && activeKind === 'column'
  const categoryLinks = categories
    .filter(
      (category) =>
        category.id !== 'course-category-root' &&
        category.name.trim().toLowerCase() !== 'courses',
    )
    .slice(0, 8)
    .map((category) => ({
      label: category.name,
      to: `/courses?category=${encodeURIComponent(category.id)}`,
    }))
  const staticLinks = FALLBACK_TOPICS.map((label) => ({
    label,
    to: `/courses?q=${encodeURIComponent(label)}`,
  }))
  const topics = [...categoryLinks, ...staticLinks]
    .filter(
      (item, index, list) => list.findIndex((candidate) => candidate.label === item.label) === index,
    )
    .slice(0, 16)

  return (
    <section className="border-y border-slate-200/70 bg-white">
      <div className="flex gap-3 px-2 py-3 sm:px-3">
        <div className="flex shrink-0 gap-2">
          <Link
            to="/courses"
            className={
              courseActive
                ? 'flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 dark:bg-indigo-500 dark:hover:bg-indigo-400'
                : 'flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
            }
          >
            <span className="text-[18px] leading-none">⚡</span>
            <span className="whitespace-nowrap text-[10px] font-semibold">课程中心</span>
          </Link>
          <Link
            to="/courses?kind=column"
            className={
              columnActive
                ? 'flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25'
                : 'flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
            }
          >
            <span className="text-[18px] leading-none">▤</span>
            <span className="text-[11px] font-semibold">专栏</span>
          </Link>
        </div>

        <div
          className={
            compact
              ? 'grid min-w-0 flex-1 grid-cols-8 gap-1.5'
              : 'grid min-w-0 flex-1 grid-cols-4 gap-1.5 lg:grid-cols-8'
          }
        >
          {topics.map((topic) => (
            <Link
              key={topic.label}
              to={topic.to}
              className="flex h-8 min-w-0 items-center justify-center truncate rounded-md bg-slate-50 px-2 text-[12px] font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              {topic.label}
            </Link>
          ))}
        </div>

        <div
          className={
            compact
              ? 'hidden w-[170px] shrink-0 grid-cols-2 gap-x-3 gap-y-2 border-l border-slate-100 pl-3 xl:grid'
              : 'hidden w-[206px] shrink-0 grid-cols-2 gap-x-4 gap-y-2 border-l border-slate-100 pl-4 lg:grid'
          }
        >
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.label}
              to={shortcut.to}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-400 transition hover:text-indigo-600"
            >
              <span className="text-[12px] opacity-80">{shortcut.icon}</span>
              {shortcut.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
