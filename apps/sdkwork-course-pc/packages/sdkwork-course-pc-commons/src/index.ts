export { CourseCard } from './components/CourseCard'
export type { CourseCardProps } from './components/CourseCard'

export { DiscoverCourseCard } from './components/DiscoverCourseCard'
export type { DiscoverCourseCardProps } from './components/DiscoverCourseCard'

export { PageHeader } from './components/PageHeader'
export type { PageHeaderProps } from './components/PageHeader'

export { LoadingSpinner } from './components/LoadingSpinner'
export type { LoadingSpinnerProps } from './components/LoadingSpinner'

export { EmptyState } from './components/EmptyState'
export type { EmptyStateProps } from './components/EmptyState'

export { ErrorBoundary } from './components/ErrorBoundary'

export { Button } from './components/ui/Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/ui/Button'

export { Badge, reviewTone } from './components/ui/Badge'
export type { BadgeProps, BadgeTone } from './components/ui/Badge'

export { Notice } from './components/ui/Notice'
export type { NoticeProps } from './components/ui/Notice'

export { Modal } from './components/ui/Modal'
export type { ModalProps } from './components/ui/Modal'

export { TextField, TextAreaField, SelectField, FieldShell } from './components/ui/Fields'
export type {
  TextFieldProps,
  TextAreaFieldProps,
  SelectFieldProps,
} from './components/ui/Fields'

export { Skeleton, CourseGridSkeleton } from './components/ui/Skeleton'
export { StatCard } from './components/ui/StatCard'
export type { StatCardProps } from './components/ui/StatCard'
export { ProgressBar } from './components/ui/ProgressBar'
export type { ProgressBarProps } from './components/ui/ProgressBar'
export { Tabs } from './components/ui/Tabs'
export type { TabItem, TabsProps } from './components/ui/Tabs'

export { cn } from './utils/cn'
export {
  formatCategory,
  formatCompactCount,
  formatCompactDuration,
  formatCount,
  formatDate,
  formatDuration,
  formatPrice,
  formatRelativeTime,
  kindLabel,
  parseTags,
  resolveCourseCover,
  reviewStateLabel,
  statusLabel,
} from './utils/format'
export type { CourseKind, ResolvedCover } from './utils/format'

export { useDebounce, useLocalStorage, useMediaQuery, useIsMobile } from './hooks'
