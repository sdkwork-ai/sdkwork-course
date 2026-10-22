import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enrollInFirstCourseOffering, getCommentsClient, getDriveAppSdkClient, retrieveCourseEngagement, useCourseSdk, type CourseEngagement } from '@sdkwork/sdkwork-course-pc-core'
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Notice,
  cn,
  formatCompactCount,
  formatCount,
  formatDate,
  formatDuration,
  formatPrice,
  kindLabel,
  resolveCourseCover,
} from '@sdkwork/sdkwork-course-pc-commons'
import {
  buildCurriculumTree,
  findLessonResources,
  mapCollectionItem,
  mapCourse,
  mapCurriculum,
  readPageItems,
  CourseDiscussionPanel,
} from '@sdkwork/sdkwork-course-pc-courses'

export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId?: string }>()
  const [searchParams] = useSearchParams()
  const collectionId = searchParams.get('collection')
  const navigate = useNavigate()
  const sdk = useCourseSdk()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [commentsFavorite, setCommentsFavorite] = useState<boolean | null>(null)
  const [collectionPage, setCollectionPage] = useState(0)
  const [columnPage, setColumnPage] = useState(0)

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => sdk.courses.retrieve(courseId!),
    enabled: Boolean(courseId),
  })
  const collectionQuery = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => sdk.courses.retrieve(collectionId!),
    enabled: Boolean(collectionId),
  })
  const collectionItemsQuery = useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => sdk.courseCollectionItems.list(collectionId!, { pageSize: 200 }),
    enabled: Boolean(collectionId),
  })
  const curriculumQuery = useQuery({
    queryKey: ['course-curriculum', courseId],
    queryFn: () => sdk.courseCurriculum.retrieve(courseId!),
    enabled: Boolean(courseId),
  })
  const enrollmentsQuery = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => sdk.courseEnrollments.current.list(),
    retry: false,
  })
  const relatedQuery = useQuery({
    queryKey: ['related-courses'],
    queryFn: () => sdk.courses.list({ pageSize: 8 }),
    staleTime: 5 * 60 * 1000,
  })
  const engagementQuery = useQuery({
    queryKey: ['course-engagement', courseId],
    queryFn: () => retrieveCourseEngagement(courseId!, sdk),
    enabled: Boolean(courseId),
    retry: false,
  })

  const course = courseQuery.data ? mapCourse(courseQuery.data) : null
  const curriculum = curriculumQuery.data ? mapCurriculum(curriculumQuery.data) : null
  const cover = course ? resolveCourseCover(course.thumbnail, course.title) : null
  const sections = useMemo(
    () => (curriculum ? buildCurriculumTree(curriculum) : []),
    [curriculum],
  )
  const flatLessons = sections.flatMap((group) => group.lessons)
  const totalDurationSeconds = course?.durationSeconds
    ? course.durationSeconds
    : flatLessons.reduce((sum, item) => sum + Math.max(0, item.durationSeconds), 0)
  const entryLessonId = lessonId ?? flatLessons[0]?.id
  const currentIndex = flatLessons.findIndex((item) => item.id === entryLessonId)
  const lesson = currentIndex >= 0 ? flatLessons[currentIndex] : null
  const enrollment = readPageItems(enrollmentsQuery.data)
    .map((value) => value as Record<string, unknown>)
    .find((item) => String(item.courseId ?? item.course_id ?? '') === courseId)
  const relatedCourses = useMemo(
    () =>
      readPageItems(relatedQuery.data)
        .map(mapCourse)
        .filter((item) => item.id !== courseId)
        .slice(0, 4),
    [relatedQuery.data, courseId],
  )
  const collectionCourse = collectionQuery.data ? mapCourse(collectionQuery.data) : null
  const collectionItems = useMemo(
    () => readPageItems(collectionItemsQuery.data).map(mapCollectionItem),
    [collectionItemsQuery.data],
  )
  const collectionIndex = collectionItems.findIndex((item) => item.courseId === courseId)
  const collectionPageSize = 8
  const collectionPageCount = Math.max(1, Math.ceil(collectionItems.length / collectionPageSize))
  const collectionPageItems = collectionItems.slice(
    collectionPage * collectionPageSize,
    (collectionPage + 1) * collectionPageSize,
  )
  const columnPageSize = 10
  const columnPageCount = Math.max(1, Math.ceil(flatLessons.length / columnPageSize))
  const columnPageLessons = flatLessons.slice(
    columnPage * columnPageSize,
    (columnPage + 1) * columnPageSize,
  )

  useEffect(() => {
    if (!collectionId) {
      setCollectionPage(0)
      return
    }
    if (collectionIndex >= 0) {
      setCollectionPage(Math.floor(collectionIndex / collectionPageSize))
    }
  }, [collectionId, collectionIndex])

  useEffect(() => {
    setColumnPage(0)
  }, [courseId])

  useEffect(() => {
    if (!courseId) return
    void getCommentsClient()
      .engagement.visits.create('course-lesson', courseId, { source: 'course-player' })
      .catch(() => undefined)
  }, [courseId])

  useEffect(() => {
    if (!courseId || !curriculum) return
    if (flatLessons.length === 0) {
      navigate(`/courses/${courseId}`, { replace: true })
      return
    }
    if (!lessonId) {
      navigate(`/courses/${courseId}/learn/${flatLessons[0].id}`, { replace: true })
    }
  }, [courseId, curriculum, flatLessons, lessonId, navigate])

  const canWatch = Boolean(course?.isFree || enrollment || lesson?.freePreview)
  const resources = lesson && curriculum ? findLessonResources(curriculum.resources, lesson.id) : []
  const videoResource = resources.find(
    (resource) =>
      ['video', 'vod_video', 'lesson_video'].includes(resource.resourceRole) ||
      resource.mimeType?.startsWith('video/'),
  )
  const bvid = lesson?.sourceProvider === 'bilibili' ? lesson.externalSourceId : undefined
  const directVideoUrl =
    lesson?.externalSourceId && /^https?:\/\//u.test(lesson.externalSourceId)
      ? lesson.externalSourceId
      : undefined

  const videoUrlQuery = useQuery({
    queryKey: ['lesson-video', lesson?.id, videoResource?.driveResourceId],
    queryFn: async () => {
      if (!videoResource?.driveResourceId) throw new Error('视频资源不存在')
      const drive = getDriveAppSdkClient()
      const result = await drive.drive.nodes.downloadUrls.retrieve(videoResource.driveResourceId, {
        requestedTtlSeconds: 7200,
      })
      return result.signedSourceUrl || result.downloadUrl
    },
    enabled: Boolean(canWatch && videoResource?.driveResourceId && !bvid && !directVideoUrl),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) throw new Error('请先报名课程')
      if (!lesson) throw new Error('课时不存在')
      await sdk.courseLessonProgress.update(lesson.id, {
        enrollmentId: String(enrollment.id ?? ''),
        progressStatus: 'completed',
      })
    },
    onSuccess: () => {
      setFeedback('已标记为完成')
      void queryClient.invalidateQueries({ queryKey: ['my-enrollments'] })
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : '操作失败'),
  })

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error('课程不存在')
      return enrollInFirstCourseOffering(sdk, courseId)
    },
    onSuccess: () => {
      setFeedback('报名成功，现在可以记录学习进度')
      void queryClient.invalidateQueries({ queryKey: ['my-enrollments'] })
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : '报名失败'),
  })

  const reactionMutation = useMutation({
    mutationFn: ({
      reactionType,
      reactionValue,
    }: {
      reactionType: 'like' | 'favorite' | 'share'
      reactionValue: boolean
    }) =>
      sdk.courseReactions.update({
        targetType: 'course',
        targetId: courseId!,
        reactionType,
        reactionValue: String(reactionValue),
      }),
    onMutate: async ({ reactionType, reactionValue }) => {
      await queryClient.cancelQueries({ queryKey: ['course-engagement', courseId] })
      const previous = queryClient.getQueryData<CourseEngagement>([
        'course-engagement',
        courseId,
      ])
      if (previous) {
        const viewerKey =
          reactionType === 'like'
            ? 'liked'
            : reactionType === 'favorite'
              ? 'favorited'
              : 'shared'
        const counterKey =
          reactionType === 'like'
            ? 'likes'
            : reactionType === 'favorite'
              ? 'favorites'
              : 'shares'
        const alreadyActive = previous.viewer[viewerKey]
        if (alreadyActive !== reactionValue) {
          queryClient.setQueryData<CourseEngagement>(['course-engagement', courseId], {
            ...previous,
            [counterKey]: Math.max(0, previous[counterKey] + (reactionValue ? 1 : -1)),
            viewer: { ...previous.viewer, [viewerKey]: reactionValue },
          })
        }
      }
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['course-engagement', courseId], context.previous)
      }
      setFeedback(error instanceof Error ? error.message : '操作失败，请稍后重试')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['course-engagement', courseId] })
    },
  })

  const toggleFavorite = () => {
    const active = commentsFavorite ?? Boolean(engagementQuery.data?.viewer.favorited)
    const client = getCommentsClient()
    if (!courseId) return
    setCommentsFavorite(!active)
    const request = active
      ? client.engagement.favorites.delete('course-lesson', courseId)
      : client.engagement.favorites.update('course-lesson', courseId)
    void request.catch((error) => {
      setCommentsFavorite(active)
      setFeedback(error instanceof Error ? error.message : '收藏操作失败，请稍后重试')
    })
  }

  const toggleReaction = (reactionType: 'like') => {
    const engagement = engagementQuery.data
    const active = Boolean(engagement?.viewer.liked)
    reactionMutation.mutate({ reactionType, reactionValue: !active })
  }

  const recordShare = () => {
    if (engagementQuery.data?.viewer.shared) return
    reactionMutation.mutate({ reactionType: 'share', reactionValue: true })
  }

  if (courseQuery.isLoading || curriculumQuery.isLoading) {
    return <LoadingSpinner text="正在进入课堂..." />
  }
  if (courseQuery.error || !course) {
    return <EmptyState icon="!" title="课程不存在" description="该课程可能已下架，请返回课程中心。" />
  }
  if (curriculumQuery.error || !curriculum) {
    return (
      <EmptyState
        icon="!"
        title="课程目录加载失败"
        description="课程数据暂时不可用，请稍后重试或返回课程中心。"
        action={<Button onClick={() => void curriculumQuery.refetch()}>重新加载</Button>}
      />
    )
  }
  if (!course.isFree && enrollmentsQuery.isLoading && !lesson?.freePreview) {
    return <LoadingSpinner text="正在确认学习权益..." />
  }
  if (!lesson) {
    return <EmptyState icon="!" title="课时不存在" description="该课时可能已被调整，请返回课程目录重新选择。" />
  }

  const nextLesson = currentIndex >= 0 ? flatLessons[currentIndex + 1] : undefined
  const previousLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : undefined
  const articleContent = lesson.content?.trim()
  const attachment = resources.find((resource) => ['attachment', 'handout'].includes(resource.resourceRole))

  const goToLesson = (targetId: string) => {
    setFeedback(null)
    navigate(
      `/courses/${courseId}/learn/${targetId}${collectionId ? `?collection=${collectionId}` : ''}`,
    )
  }

  const shareLesson = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setFeedback('课时链接已复制')
      recordShare()
    } catch {
      setFeedback('复制失败，请从地址栏复制链接')
    }
  }

  return (
    <div className="space-y-3 pb-8">
      <div className="min-w-0">
        {collectionId ? (
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
            <Link
              to={`/courses/${collectionId}?view=overview`}
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              合集 · {collectionCourse?.title ?? '合集'}
            </Link>
            <span>第 {Math.max(1, collectionIndex + 1)} / {collectionItems.length} 门</span>
          </div>
        ) : null}
        <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-[20px]">
          {lesson.title}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
          <span>{formatCount(course.studentsCount)} 人在学</span>
          <span>{course.lessonsCount} 课时</span>
          <span>{formatDuration(totalDurationSeconds)}</span>
          {course.publishedAt ? <span>{formatDate(course.publishedAt)}</span> : null}
          {engagementQuery.data ? (
            <>
              <span>{formatCompactCount(engagementQuery.data.likes)} 点赞</span>
              <span>{formatCompactCount(engagementQuery.data.favorites)} 收藏</span>
              <span>{formatCompactCount(engagementQuery.data.discussions)} 评论</span>
            </>
          ) : null}
          <span className="text-slate-300">·</span>
          <Link to={`/courses/${courseId}?view=overview`} className="font-medium text-slate-500 hover:text-indigo-600">
            课程详情
          </Link>
        </div>
      </div>

      {feedback ? <Notice tone="info">{feedback}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-900/5 bg-slate-950 shadow-sm">
            {!canWatch ? (
              <CoursePaywall
                course={course}
                onPurchase={() => setFeedback('在线购买即将开放。请联系运营开通学习权益，开通后即可观看全部课时。')}
                onDetails={() => navigate(`/courses/${courseId}?view=overview`)}
              />
            ) : bvid ? (
              <div className="aspect-video max-h-[calc(100vh-13rem)] w-full">
                <iframe
                  title={lesson.title}
                  src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&autoplay=1&high_quality=1`}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
            ) : directVideoUrl || videoUrlQuery.data ? (
              <div className="aspect-video max-h-[calc(100vh-13rem)] w-full bg-black">
                <video
                  key={lesson.id}
                  src={directVideoUrl ?? videoUrlQuery.data}
                  poster={cover?.url}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="h-full w-full bg-black object-contain"
                />
              </div>
            ) : lesson.kind === 'article' ? (
              <div className="bg-white">
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    图文课时
                  </p>
                  <p className="mt-1 text-sm text-slate-500">边读边记，进度会在阅读后记录</p>
                </div>
                <article className="prose prose-slate max-w-none whitespace-pre-wrap px-6 py-6 text-[15px] leading-8 text-slate-700">
                  {articleContent || '正文内容整理中。'}
                </article>
              </div>
            ) : videoUrlQuery.isLoading ? (
              <div className="flex aspect-video w-full items-center justify-center bg-slate-950 text-slate-300">
                <LoadingSpinner text="正在加载视频..." />
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 text-slate-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium">
                  {videoUrlQuery.error ? '视频暂时无法播放' : '视频正在转码或等待上传'}
                </p>
                <p className="max-w-md text-center text-xs text-slate-400">
                  {videoUrlQuery.error
                    ? '请稍后重试，或联系课程运营检查视频资源。'
                    : lesson.externalSourceId
                      ? `来源：${lesson.sourceProvider ?? 'external'} · ${lesson.externalSourceId}`
                      : '创作者可在创作中心为课时上传视频文件。'}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                aria-label={engagementQuery.data?.viewer.liked ? '取消点赞' : '点赞'}
                aria-pressed={Boolean(engagementQuery.data?.viewer.liked)}
                disabled={reactionMutation.isPending}
                onClick={() => toggleReaction('like')}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition',
                  engagementQuery.data?.viewer.liked
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7 10v10H4V10h3Zm0 0 4.2-7.2a1.6 1.6 0 0 1 2.9 1.1V8h4.4a2 2 0 0 1 2 2.4l-1.2 6.4a2 2 0 0 1-2 1.6H7" strokeLinejoin="round" />
                </svg>
                {formatCompactCount(engagementQuery.data?.likes ?? 0)}
              </button>
              <button
                type="button"
                aria-label={commentsFavorite ?? engagementQuery.data?.viewer.favorited ? '取消收藏' : '收藏'}
                aria-pressed={commentsFavorite ?? Boolean(engagementQuery.data?.viewer.favorited)}
                disabled={reactionMutation.isPending}
                onClick={toggleFavorite}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition',
                  (commentsFavorite ?? engagementQuery.data?.viewer.favorited)
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill={(commentsFavorite ?? engagementQuery.data?.viewer.favorited) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" strokeLinejoin="round" />
                </svg>
                {formatCompactCount(engagementQuery.data?.favorites ?? 0)}
              </button>
              <button
                type="button"
                aria-label="分享课时"
                onClick={() => void shareLesson()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M15 5 21 11l-6 6M21 11H9a5 5 0 0 0-5 5v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {formatCompactCount(engagementQuery.data?.shares ?? 0)}
              </button>
              <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs font-medium text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a8 8 0 0 1-8 8H6l-3 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" strokeLinejoin="round" />
                </svg>
                {formatCompactCount(engagementQuery.data?.discussions ?? 0)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">
                第 {currentIndex + 1} / {flatLessons.length} 课
              </span>
              <Button variant="outline" size="sm" onClick={() => navigate(`/courses/${courseId}?view=overview`)}>
                课程详情
              </Button>
              {canWatch && (enrollment || course.isFree) ? (
                <Button
                  size="sm"
                  variant={enrollment ? 'primary' : 'outline'}
                  loading={completeMutation.isPending || enrollMutation.isPending}
                  onClick={() => {
                    if (enrollment) completeMutation.mutate()
                    else enrollMutation.mutate()
                  }}
                >
                  {enrollment ? '标记完成' : '报名后记录进度'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">本课说明</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {lesson.description || '暂无课时说明'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Badge tone="neutral">
                  {lesson.kind === 'article' ? '图文' : lesson.kind === 'live_session' ? '直播' : '视频'}
                </Badge>
                {lesson.durationSeconds > 0 ? <span>{formatDuration(lesson.durationSeconds)}</span> : null}
                {lesson.freePreview ? <Badge tone="success">可试看</Badge> : null}
              </div>
            </div>
            {attachment ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">课时资料</p>
                  <p className="text-xs text-slate-500">
                    {attachment.mimeType ?? '附件'} · Drive 资源 {attachment.driveResourceId.slice(0, 12)}...
                  </p>
                </div>
                <Badge tone="info">已关联</Badge>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!previousLesson}
                  onClick={() => previousLesson && goToLesson(previousLesson.id)}
                >
                  ← 上一课
                </Button>
                <Button
                  size="sm"
                  disabled={!nextLesson}
                  onClick={() => nextLesson && goToLesson(nextLesson.id)}
                >
                  下一课 →
                </Button>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    collectionId
                      ? `/courses/${collectionId}?view=overview`
                      : `/courses/${courseId}?view=overview`,
                  )
                }
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                {collectionId ? '返回合集介绍' : '返回课程目录'}
              </button>
            </div>
          </div>

          <CourseDiscussionPanel courseId={courseId!} targetType="lesson" targetId={lesson.id} />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-sm font-bold text-white">
              {(course.author ?? '课').slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{course.author ?? '平台讲师'}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">课程作者 · {kindLabel(course.kind)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/courses/${courseId}?view=overview`)}>
              查看
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {collectionId ? '合集目录' : course.kind === 'column' ? '专栏目录' : '课程目录'}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">
                {collectionCourse?.title ?? (collectionId ? '合集' : course.title)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {collectionId
                  ? `第 ${Math.max(1, collectionIndex + 1)} / ${collectionItems.length} 门 · ${flatLessons.length} 课时`
                  : course.kind === 'column'
                    ? `共 ${flatLessons.length} 篇 · 当前第 ${currentIndex + 1} 篇`
                    : `${flatLessons.length} 课时 · 当前第 ${currentIndex + 1} 课`}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{
                    width: `${
                      collectionId
                        ? (Math.max(1, collectionIndex + 1) /
                            Math.max(collectionItems.length, 1)) *
                          100
                        : ((currentIndex + 1) / Math.max(flatLessons.length, 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            {collectionId ? (
              <>
                <div className="max-h-[520px] overflow-y-auto">
                  {collectionPageItems.map((item, index) => {
                    const active = item.courseId === courseId
                    const absoluteIndex = collectionPage * collectionPageSize + index
                    return (
                      <button
                        key={item.courseId}
                        type="button"
                        onClick={() =>
                          navigate(`/courses/${item.courseId}/play?collection=${collectionId}`)
                        }
                        className={cn(
                          'flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-b-0',
                          active ? 'bg-indigo-50' : 'hover:bg-slate-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold',
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {absoluteIndex + 1}
                        </span>
                        <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded bg-slate-100">
                          {item.cover ? (
                            <img src={item.cover} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'line-clamp-2 text-xs font-semibold leading-5',
                              active ? 'text-indigo-700' : 'text-slate-700',
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {item.lessonsCount} 课时
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {collectionPageCount > 1 ? (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                    <button
                      type="button"
                      disabled={collectionPage === 0}
                      onClick={() => setCollectionPage((page) => Math.max(0, page - 1))}
                      className="font-semibold disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <span>
                      {collectionPage + 1} / {collectionPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={collectionPage >= collectionPageCount - 1}
                      onClick={() =>
                        setCollectionPage((page) => Math.min(collectionPageCount - 1, page + 1))
                      }
                      className="font-semibold disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                ) : null}
              </>
            ) : course.kind === 'column' ? (
              <>
                <div className="max-h-[520px] overflow-y-auto">
                  {columnPageLessons.map((item, index) => {
                    const active = item.id === lesson.id
                    const absoluteIndex = columnPage * columnPageSize + index
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => goToLesson(item.id)}
                        className={cn(
                          'flex w-full items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-left text-xs transition last:border-b-0',
                          active
                            ? 'bg-indigo-50 font-semibold text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        <span className="w-5 shrink-0 text-[10px] text-slate-400">
                          {absoluteIndex + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.freePreview ? (
                          <span className="shrink-0 text-[10px] text-emerald-600">试看</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
                {columnPageCount > 1 ? (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                    <button
                      type="button"
                      disabled={columnPage === 0}
                      onClick={() => setColumnPage((page) => Math.max(0, page - 1))}
                      className="font-semibold disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <span>
                      {columnPage + 1} / {columnPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={columnPage >= columnPageCount - 1}
                      onClick={() =>
                        setColumnPage((page) => Math.min(columnPageCount - 1, page + 1))
                      }
                      className="font-semibold disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                {sections.map((group) => (
                  <div key={group.section.id} className="border-b border-slate-50 last:border-b-0">
                    <div className="px-4 py-2.5">
                      <p className="text-xs font-bold text-slate-700">{group.section.title}</p>
                      <p className="text-[10px] text-slate-400">{group.lessons.length} 课时</p>
                    </div>
                    <ul>
                      {group.lessons.map((item, index) => {
                        const active = item.id === lesson.id
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => goToLesson(item.id)}
                              className={cn(
                                'flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition',
                                active
                                  ? 'bg-indigo-50 font-semibold text-indigo-700'
                                  : 'text-slate-600 hover:bg-slate-50',
                              )}
                            >
                              <span className="w-5 shrink-0 text-[10px] text-slate-400">{index + 1}</span>
                              <span className="min-w-0 flex-1 truncate">{item.title}</span>
                              {item.freePreview ? (
                                <span className="shrink-0 text-[10px] text-emerald-600">试看</span>
                              ) : null}
                              {active ? (
                                <span className="shrink-0 text-[10px]">
                                  {canWatch || item.freePreview ? '播放中' : '已锁定'}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {relatedCourses.length > 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">相关课程</h3>
                <Link to="/courses" className="text-[11px] font-semibold text-indigo-600">
                  更多
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {relatedCourses.map((item) => {
                  const itemCover = resolveCourseCover(item.thumbnail, item.title)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/courses/${item.id}/play`)}
                        className="flex w-full items-center gap-2.5 text-left"
                      >
                        <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          {itemCover.url ? (
                            <img src={itemCover.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-bold text-slate-400">
                              {item.title.slice(0, 1)}
                            </span>
                          )}
                          {item.durationSeconds > 0 ? (
                            <span className="absolute bottom-1 right-1 rounded bg-slate-950/70 px-1 py-0.5 text-[9px] font-medium text-white">
                              {formatDuration(item.durationSeconds)}
                            </span>
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-xs font-semibold leading-5 text-slate-700">
                            {item.title}
                          </span>
                          <span className="mt-1 block truncate text-[10px] text-slate-400">
                            {item.author ?? '平台讲师'} · {formatCount(item.studentsCount)} 人在学
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function CoursePaywall({
  course,
  onPurchase,
  onDetails,
}: {
  course: ReturnType<typeof mapCourse>
  onPurchase: () => void
  onDetails: () => void
}) {
  const cover = resolveCourseCover(course.thumbnail, course.title)
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-950">
      {cover.url ? (
        <img src={cover.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      ) : (
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage: `linear-gradient(135deg, hsl(${cover.fallbackHue} 65% 42%), hsl(${(cover.fallbackHue + 42) % 360} 70% 24%))`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
      <div className="relative z-10 flex max-w-lg flex-col items-center px-6 text-center text-white">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <Badge tone="warning" className="mt-4 border-white/15 bg-white/10 text-amber-200">
          付费课程
        </Badge>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">购买后解锁全部视频课时</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
          付费内容由平台统一管理学习权益。完成购买或开通权益后，可直接观看全部课时并记录学习进度。
        </p>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-rose-300">
            {formatPrice(course.priceAmount, false, course.currency)}
          </span>
          {course.originalPriceAmount ? (
            <span className="text-sm text-slate-500 line-through">
              {formatPrice(course.originalPriceAmount, false, course.currency)}
            </span>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={onPurchase}>
            购买课程
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
            onClick={onDetails}
          >
            课程详情
          </Button>
        </div>
      </div>
    </div>
  )
}
