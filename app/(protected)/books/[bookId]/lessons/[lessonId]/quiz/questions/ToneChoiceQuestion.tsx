'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ToneChoicePayload } from '@/lib/db/types'
import { gradeChoiceAnswer, shuffleWithIndexMap } from '@/lib/quiz/grading'

export default function ToneChoiceQuestion({
  payload,
  onAnswer,
}: {
  payload: ToneChoicePayload
  onAnswer: (isCorrect: boolean, userAnswer?: number) => void
}) {
  const shuffledChoices = useMemo(() => shuffleWithIndexMap(payload.choices), [payload.choices])

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    onAnswer(gradeChoiceAnswer(payload, index), index)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
        Chọn thanh điệu đúng cho chữ Hán sau
      </p>
      <p className="text-center font-han-title text-3xl font-bold text-ink">{payload.wordZh}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {shuffledChoices.map(({ item: choice, originalIndex }, position) => {
          const isSelected = selectedIndex === originalIndex
          const isCorrectChoice = originalIndex === payload.correctIndex
          const answered = selectedIndex !== null

          let stateClasses = 'border-card-border bg-white hover:bg-accent-bg'
          if (answered && isCorrectChoice) {
            stateClasses = 'animate-bounce-pop border-success-border bg-success-bg text-success-text shadow-sm'
          } else if (answered && isSelected && !isCorrectChoice) {
            stateClasses = 'animate-shake-wrong border-error-border bg-error-bg text-error-text'
          }

          return (
            <button
              key={position}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(originalIndex)}
              className={`flex items-center justify-center gap-2 rounded-btn border px-4 py-3 text-center font-semibold transition-all disabled:cursor-not-allowed ${stateClasses}`}
            >
              <span>{choice}</span>
              {answered && isCorrectChoice && (
                <span className="animate-check-pop text-success-text">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
              {answered && isSelected && !isCorrectChoice && (
                <span className="animate-check-pop text-error-text">
                  <X className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
