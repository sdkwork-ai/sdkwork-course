import React from 'react'
import { cn } from '../../utils/cn'

interface FieldShellProps {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-400'

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  containerClassName?: string
}

export function TextField({
  label,
  hint,
  error,
  containerClassName,
  id,
  className,
  required,
  ...rest
}: TextFieldProps) {
  const fieldId = id ?? rest.name
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={containerClassName}
    >
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(inputClass, error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10' : undefined, className)}
        {...rest}
      />
    </FieldShell>
  )
}

export interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  containerClassName?: string
}

export function TextAreaField({
  label,
  hint,
  error,
  containerClassName,
  id,
  className,
  required,
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  const fieldId = id ?? rest.name
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={containerClassName}
    >
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(inputClass, 'resize-y leading-relaxed', error ? 'border-rose-300' : undefined, className)}
        {...rest}
      />
    </FieldShell>
  )
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  containerClassName?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
}

export function SelectField({
  label,
  hint,
  error,
  containerClassName,
  options,
  id,
  className,
  required,
  ...rest
}: SelectFieldProps) {
  const fieldId = id ?? rest.name
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={containerClassName}
    >
      <select
        id={fieldId}
        required={required}
        className={cn(inputClass, 'appearance-none bg-[length:16px] pr-9', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        }}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
