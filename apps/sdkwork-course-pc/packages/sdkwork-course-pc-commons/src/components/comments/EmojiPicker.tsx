import React, { useEffect, useRef, useState } from 'react'

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  disabled?: boolean
}

const EMOJI_GROUPS = [
  {
    label: '常用',
    emojis: ['👍', '👏', '🎉', '❤️', '🔥', '💡', '✅', '🙏', '💪', '🤝', '🌟', '😊'],
  },
  {
    label: '情绪',
    emojis: ['😀', '😂', '🥰', '😎', '🤔', '😮', '😭', '😅', '😴', '🤯', '🥳', '😤'],
  },
  {
    label: '学习',
    emojis: ['📚', '📝', '✏️', '📖', '🧠', '🎯', '🚀', '🧩', '🔍', '📌', '💻', '🏆'],
  },
] as const

/**
 * A dependency-free emoji picker for comment composers.
 *
 * It emits plain unicode text so the comment API stays transport agnostic and
 * the same picker can be embedded in any content surface.
 */
export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-label="插入表情"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-slate-500 dark:text-slate-400! transition hover:bg-slate-100 dark:hover:bg-slate-800! hover:text-slate-800 dark:hover:text-slate-100! disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden>😊</span>
        <span className="hidden text-xs sm:inline">表情</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-10 z-30 w-72 rounded-2xl border border-slate-200 dark:border-slate-700! bg-white dark:bg-[#232326]! p-3 text-slate-700 dark:text-slate-200! shadow-xl">
          <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800! pb-2">
            {EMOJI_GROUPS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setGroup(index)}
                className={
                  index === group
                    ? 'rounded-md bg-slate-900 dark:bg-slate-100! px-2 py-1 text-[11px] font-semibold text-white dark:text-slate-900!'
                    : 'rounded-md px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400! hover:bg-slate-100 dark:hover:bg-slate-800!'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-8 gap-1">
            {EMOJI_GROUPS[group].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji)
                  setOpen(false)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100 dark:hover:bg-slate-800!"
                aria-label={`插入 ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
