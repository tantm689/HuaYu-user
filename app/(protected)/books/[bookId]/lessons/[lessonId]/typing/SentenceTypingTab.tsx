'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { DialogueLineForTyping } from '@/lib/db/types'
import { isExactMatch } from '@/lib/typing/normalize'
import { upsertTypingProgress } from '@/lib/db/typingProgress'
import { createBrowserSupabase } from '@/lib/supabase/browser'

export default function SentenceTypingTab({ lines }: { lines: DialogueLineForTyping[] }) {
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [graded, setGraded] = useState<'correct' | 'incorrect' | null>(null)
  const [streaks, setStreaks] = useState<Record<string, number>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (lines.length === 0) {
    return (
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-base text-ink-faint">
          Bài học này chưa có câu hội thoại để luyện gõ.
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-lg font-bold text-ink">
          Đã luyện xong {lines.length} câu
        </p>
      </div>
    )
  }

  const line = lines[index]
  const isLast = index === lines.length - 1

  async function grade() {
    const isCorrect = isExactMatch(value, line.text_zh)
    setGraded(isCorrect ? 'correct' : 'incorrect')
    setSaveError(null)

    const prevStreak = streaks[line.id] ?? 0
    try {
      const supabase = createBrowserSupabase()
      await upsertTypingProgress(supabase, 'dialogue_line', line.id, isCorrect, prevStreak)
      setStreaks((prev) => ({ ...prev, [line.id]: isCorrect ? prevStreak + 1 : 0 }))
    } catch {
      setSaveError('Không lưu được, kiểm tra kết nối mạng.')
    }
  }

  function next() {
    if (isLast) {
      setDone(true)
      return
    }
    setIndex((i) => i + 1)
    setValue('')
    setGraded(null)
  }

  const stateClasses =
    graded === 'correct'
      ? 'border-success-border bg-success-bg'
      : graded === 'incorrect'
        ? 'border-error-border bg-error-bg'
        : 'border-card-border bg-white'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-ink-faint">
        Câu {index + 1}/{lines.length}
      </p>

      <div className={`flex flex-col gap-3 rounded-card border p-5 shadow-sm ${stateClasses}`}>
        <div className="flex items-center gap-3">
          <p className="flex-1 font-medium text-ink">{line.translation_vi}</p>
          {line.audio_url && (
            <button
              type="button"
              onClick={() => new Audio(line.audio_url!).play()}
              aria-label="Phát âm thanh"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-white shadow-sm transition-colors hover:bg-brand-red-dark"
            >
              <Volume2 className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>

        <input
          type="text"
          value={value}
          readOnly={graded !== null}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && graded === null) grade()
          }}
          className="w-full rounded-btn border border-card-border bg-white px-3 py-2 font-han-title text-lg text-ink focus:border-brand-red focus:outline-none"
        />

        {graded === 'incorrect' && (
          <div className="mt-1 flex items-center gap-2 rounded-card-sm border border-error-border/60 bg-error-bg/60 px-3.5 py-2 text-sm text-error-text">
            <span className="text-xs font-semibold text-error-text/80 uppercase tracking-wide">Đáp án đúng:</span>
            <span className="font-han-title text-lg font-bold text-ink">{line.text_zh}</span>
          </div>
        )}

        {saveError && <p className="text-xs font-medium text-error-text">{saveError}</p>}
      </div>

      {graded === null ? (
        <button
          type="button"
          onClick={grade}
          className="self-start rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Kiểm tra
        </button>
      ) : (
        <button
          type="button"
          onClick={next}
          className="self-start rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Tiếp
        </button>
      )}
    </div>
  )
}
