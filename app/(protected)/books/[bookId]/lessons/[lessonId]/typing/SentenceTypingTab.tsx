'use client'

import { useState } from 'react'
import { Check, Volume2, X } from 'lucide-react'
import type { DialogueLineForTyping } from '@/lib/db/types'
import { isExactMatch } from '@/lib/typing/normalize'
import { upsertTypingProgress } from '@/lib/db/typingProgress'
import { createBrowserSupabase } from '@/lib/supabase/browser'

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default function SentenceTypingTab({ lines }: { lines: DialogueLineForTyping[] }) {
  const [shuffledLines, setShuffledLines] = useState(() => shuffle(lines))
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
          🎉 Đã luyện xong {shuffledLines.length} câu hội thoại!
        </p>
        <button
          type="button"
          onClick={() => {
            setShuffledLines(shuffle(lines))
            setIndex(0)
            setValue('')
            setGraded(null)
            setSaveError(null)
            setDone(false)
          }}
          className="mx-auto mt-5 rounded-btn bg-brand-red px-7 py-3 font-semibold text-white shadow-sm transition-all hover:bg-brand-red-dark hover:shadow-md active:scale-98"
        >
          Làm lại
        </button>
      </div>
    )
  }

  const line = shuffledLines[index]
  const isLast = index === shuffledLines.length - 1

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
      setSaveError('Không lưu được kết quả, kiểm tra kết nối mạng.')
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

  let cardStyle = 'border-card-border bg-white shadow-sm'
  if (graded === 'correct') {
    cardStyle = 'border-success-border bg-emerald-50/50 shadow-sm animate-bounce-pop'
  } else if (graded === 'incorrect') {
    cardStyle = 'border-error-border bg-rose-50/50 shadow-sm animate-shake-wrong'
  }

  let inputStyle = 'border-card-border bg-white text-ink focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/50'
  if (graded === 'correct') {
    inputStyle = 'border-success-border bg-white text-success-text font-semibold'
  } else if (graded === 'incorrect') {
    inputStyle = 'border-error-border bg-white text-error-text font-semibold'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-ink-faint">
          Câu {index + 1}/{shuffledLines.length}
        </span>
      </div>

      <div className={`flex flex-col gap-4 rounded-card border p-6 transition-all ${cardStyle}`}>
        <div className="flex items-center gap-3">
          <p className="flex-1 font-medium text-ink text-base leading-relaxed">
            {line.translation_vi}
          </p>
          {line.audio_url && (
            <button
              type="button"
              onClick={() => new Audio(line.audio_url!).play()}
              aria-label="Phát âm thanh"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red text-white shadow-sm transition-transform hover:scale-105 hover:bg-brand-red-dark active:scale-95"
            >
              <Volume2 className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="relative flex items-center">
          <input
            type="text"
            value={value}
            readOnly={graded !== null}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && graded === null) grade()
              else if (e.key === 'Enter' && graded !== null) next()
            }}
            className={`w-full rounded-btn border px-4 py-3 pr-10 font-han-title text-xl transition-all focus:outline-none ${inputStyle}`}
          />
          {graded === 'correct' && (
            <Check className="absolute right-3.5 h-5 w-5 text-success-text" strokeWidth={3} />
          )}
          {graded === 'incorrect' && (
            <X className="absolute right-3.5 h-5 w-5 text-error-text" strokeWidth={3} />
          )}
        </div>

        {graded === 'correct' && (
          <div className="flex items-center gap-2 text-sm font-bold text-success-text animate-slide-up-fade">
            <Check className="h-4 w-4" strokeWidth={3} />
            <span>Chính xác! 🎉</span>
          </div>
        )}

        {graded === 'incorrect' && (
          <div className="flex flex-col gap-1 rounded-card-sm border border-red-200/80 bg-white p-3.5 shadow-xs animate-slide-up-fade">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red">
              Đáp án đúng
            </span>
            <span className="font-han-title text-xl font-bold text-ink leading-relaxed">
              {line.text_zh}
            </span>
          </div>
        )}

        {saveError && <p className="text-xs font-medium text-error-text">{saveError}</p>}
      </div>

      {graded === null ? (
        <button
          type="button"
          onClick={grade}
          className="self-start rounded-btn bg-brand-red px-7 py-3 font-semibold text-white shadow-sm transition-all hover:bg-brand-red-dark hover:shadow-md active:scale-98"
        >
          Kiểm tra
        </button>
      ) : (
        <button
          type="button"
          onClick={next}
          className="self-start rounded-btn bg-brand-red px-7 py-3 font-semibold text-white shadow-sm transition-all hover:bg-brand-red-dark hover:shadow-md active:scale-98"
        >
          Tiếp theo ➔
        </button>
      )}
    </div>
  )
}
