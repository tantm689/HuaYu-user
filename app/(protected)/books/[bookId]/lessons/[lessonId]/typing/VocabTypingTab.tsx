'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
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
  const [revealAllHints, setRevealAllHints] = useState(false)
  const [revealedRows, setRevealedRows] = useState<Record<string, boolean>>({})

  async function grade(vocab: Vocabulary) {
    const typed = values[vocab.id] ?? ''
    if (typed.trim() === '') return

    const isCorrect = isExactMatch(typed, vocab.word_zh)
    setStates((prev) => ({ ...prev, [vocab.id]: isCorrect ? 'correct' : 'incorrect' }))
    setErrors((prev) => ({ ...prev, [vocab.id]: '' }))

    const prevStreak = streaks[vocab.id] ?? 0
    try {
      const supabase = createBrowserSupabase()
      await upsertTypingProgress(supabase, 'vocabulary', vocab.id, isCorrect, prevStreak)
      setStreaks((prev) => ({ ...prev, [vocab.id]: isCorrect ? prevStreak + 1 : 0 }))
    } catch {
      setErrors((prev) => ({ ...prev, [vocab.id]: 'Không lưu được kết quả, kiểm tra kết nối mạng.' }))
      if (!isCorrect) {
        setStreaks((prev) => ({ ...prev, [vocab.id]: 0 }))
      }
    }
  }

  function toggleRowHint(id: string) {
    setRevealedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-ink-faint">
          Tổng số: {vocabulary.length} từ vựng
        </span>

        <button
          type="button"
          onClick={() => setRevealAllHints((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-card-border bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-accent-bg"
        >
          {revealAllHints ? (
            <>
              <EyeOff className="h-3.5 w-3.5 text-brand-red" />
              <span>Ẩn tất cả gợi ý</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5 text-brand-red" />
              <span>Hiện tất cả gợi ý</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-card-border bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-card-border bg-accent-bg/70 text-xs font-bold text-ink">
              <th className="w-12 border-r border-card-border px-3 py-2.5 text-center">STT</th>
              <th className="border-r border-card-border px-4 py-2.5">Giải thích (Nghĩa)</th>
              <th className="border-r border-card-border px-4 py-2.5 min-w-[260px]">Luyện tập (Gõ từ mới)</th>
              <th className="border-r border-card-border px-4 py-2.5">Chữ Hán</th>
              <th className="border-r border-card-border px-4 py-2.5">Phiên âm</th>
              <th className="w-16 px-3 py-2.5 text-center">Gợi ý</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/60">
            {vocabulary.map((vocab, index) => {
              const state = states[vocab.id] ?? null
              const isRevealed = revealAllHints || !!revealedRows[vocab.id]

              let inputClass = 'border-card-border bg-white text-ink focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/50'
              if (state === 'correct') {
                inputClass = 'border-success-border bg-success-bg text-success-text font-semibold'
              } else if (state === 'incorrect') {
                inputClass = 'border-error-border bg-error-bg text-error-text font-semibold'
              }

              return (
                <tr key={vocab.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="border-r border-card-border/60 px-3 py-3 text-center text-xs font-semibold text-ink-faint">
                    {index + 1}
                  </td>
                  <td className="border-r border-card-border/60 px-4 py-3 font-medium text-ink">
                    {vocab.meaning_vi}
                  </td>
                  <td className="border-r border-card-border/60 px-4 py-3">
                    <div className="relative flex items-center">
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
                        placeholder="Gõ chữ Hán..."
                        className={`w-full rounded-btn border px-4 py-3 pr-9 font-han-title text-lg transition-all focus:outline-none ${inputClass}`}
                      />
                      {state === 'correct' && (
                        <Check className="absolute right-2.5 h-4 w-4 text-success-text" strokeWidth={3} />
                      )}
                      {state === 'incorrect' && (
                        <X className="absolute right-2.5 h-4 w-4 text-error-text" strokeWidth={3} />
                      )}
                    </div>
                    {errors[vocab.id] && (
                      <p className="mt-1 text-xs font-medium text-error-text">{errors[vocab.id]}</p>
                    )}
                  </td>
                  <td className="border-r border-card-border/60 px-4 py-3">
                    {isRevealed ? (
                      <span className="font-han-title text-lg font-bold text-ink">{vocab.word_zh}</span>
                    ) : (
                      <span className="font-mono text-xs font-semibold tracking-wider text-slate-300">••••••</span>
                    )}
                  </td>
                  <td className="border-r border-card-border/60 px-4 py-3">
                    {isRevealed ? (
                      <span className="font-medium text-ink">{vocab.pinyin}</span>
                    ) : (
                      <span className="font-mono text-xs font-semibold tracking-wider text-slate-300">••••••</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      aria-label={`Gợi ý ${vocab.meaning_vi}`}
                      onClick={() => toggleRowHint(vocab.id)}
                      className="rounded-btn p-1.5 text-ink-faint transition-colors hover:bg-accent-bg hover:text-ink"
                    >
                      {isRevealed ? (
                        <EyeOff className="h-4 w-4 text-brand-red" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
