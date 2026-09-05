import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CourseCard, PageHeader, LoadingSpinner, EmptyState } from '@sdkwork/sdkwork-course-pc-commons'
import { useCourseSdk, extractSdkListItems, readEntityString, readEntityNumber } from '@sdkwork/sdkwork-course-pc-core'

interface Course {
  id: string
  courseCode: string
  title: string
  description?: string
  thumbnail?: string
  instructor?: string
  lessonsCount: number
  studentsCount: number
  ratingScore: string
  category?: string
  tags: string[]
  status: string
}

function mapCourse(record: Record<string, unknown>): Course {
  return {
    id: readEntityString(record, 'id', 'courseId'),
    courseCode: readEntityString(record, 'courseCode', 'course_code'),
    title: readEntityString(record, 'title', 'name'),
    description: readEntityString(record, 'description', 'summary') || undefined,
    thumbnail: readEntityString(record, 'thumbnail', 'cover', 'coverUrl') || undefined,
    instructor: readEntityString(record, 'instructor', 'instructorName') || undefined,
    lessonsCount: readEntityNumber(record, 'lessonsCount', 'lessons_count') ?? 0,
    studentsCount: readEntityNumber(record, 'studentsCount', 'students_count', 'students') ?? 0,
    ratingScore: readEntityString(record, 'ratingScore', 'rating', 'rating_score') || '0',
    category: readEntityString(record, 'category', 'categoryId') || undefined,
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    status: readEntityString(record, 'status') || 'draft',
  }
}

export function CourseListPage() {
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['courses', searchQuery, selectedCategory],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (searchQuery) params.q = searchQuery
      if (selectedCategory) params.category = selectedCategory
      return sdk.courses.list(params)
    },
  })

  const courses = extractSdkListItems(data).map(mapCourse)

  if (isLoading) {
    return <LoadingSpinner text="加载课程中..." />
  }

  if (error) {
    return (
      <EmptyState
        icon="❌"
        title="加载失败"
        description="无法加载课程列表，请稍后再试"
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="课程中心"
        subtitle="探索我们的精品课程"
      />

      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="搜索课程..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">所有分类</option>
          <option value="programming">编程开发</option>
          <option value="design">设计创意</option>
          <option value="business">商业管理</option>
          <option value="language">语言学习</option>
        </select>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon="📚"
          title="暂无课程"
          description="没有找到符合条件的课程"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              title={course.title}
              description={course.description}
              thumbnail={course.thumbnail}
              instructor={course.instructor}
              lessonsCount={course.lessonsCount}
              studentsCount={course.studentsCount}
              rating={course.ratingScore}
              onClick={(id) => navigate(`/courses/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
