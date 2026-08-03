'use client'

import { useState } from 'react'
import type { Vocabulary } from '@/lib/db/types'
import { isExactMatch } from '@/lib/typing/normalize'
import { upsertTypingProgress } from '@/lib/db/typingProgress'
import { createBrowserSupabase } from '@/lib/supabase/browser'

type RowState = 'correct' | 'incorrect' | null

export default function VocabTypingTab({ vocabulary }: { vocabulary: Vocabulary[] }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [streaks, setStreaks] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function grade(vocab: Vocabulary) {
    const typed = values[vocab.id] ?? ''
    const isCorrect = isExactMatch(typed, vocab.word_zh)
    setStates((prev) => ({ ...prev, [vocab.id]: isCorrect ? 'correct' : 'incorrect' }))
    setErrors((prev) => ({ ...prev, [vocab.id]: '' }))

    const prevStreak = streaks[vocab.id] ?? 0
    try {
      const supabase = createBrowserSupabase()
      await upsertTypingProgress(supabase, 'vocabulary', vocab.id, isCorrect, prevStreak)
      setStreaks((prev) => ({ ...prev, [vocab.id]: isCorrect ? prevStreak + 1 : 0 }))
    } catch {
      setErrors((prev) => ({ ...prev, [vocab.id]: 'Không lưu được, kiểm tra kết nối mạng.' }))
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {vocabulary.map((vocab) => {
        const state = states[vocab.id] ?? null
        const stateClasses =
          state === 'correct'
            ? 'border-success-border bg-success-bg'
            : state === 'incorrect'
              ? 'border-error-border bg-error-bg'
              : 'border-card-border bg-white'

        return (
          <div key={vocab.id} className={`flex flex-col gap-2 rounded-card-sm border p-3 sm:flex-row sm:items-center sm:gap-3 ${stateClasses}`}>
            <label htmlFor={`vocab-${vocab.id}`} className="flex-1 font-medium text-ink">
              {vocab.meaning_vi}
            </label>
            <input
              id={`vocab-${vocab.id}`}
              aria-label={vocab.meaning_vi ?? ''}
              data-state={state ?? undefined}
              type="text"
              value={values[vocab.id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [vocab.id]: e.target.value }))}
              onBlur={() => grade(vocab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') grade(vocab)
              }}
              className="w-full rounded-btn border border-card-border bg-white px-3 py-2 font-han-title text-lg text-ink focus:border-brand-red focus:outline-none sm:w-48"
            />
            {errors[vocab.id] && <p className="text-xs font-medium text-error-text">{errors[vocab.id]}</p>}
          </div>
        )
      })}
    </div>
  )
}
