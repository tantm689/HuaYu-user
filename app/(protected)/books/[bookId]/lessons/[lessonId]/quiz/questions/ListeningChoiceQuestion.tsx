'use client'

import { useMemo, useState } from 'react'
import { Volume2, Check, X } from 'lucide-react'
import type { ListeningChoicePayload } from '@/lib/db/types'
import { gradeChoiceAnswer, shuffleWithIndexMap } from '@/lib/quiz/grading'

export default function ListeningChoiceQuestion({
  payload,
  onAnswer,
}: {
  payload: ListeningChoicePayload
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
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
        Nghe và chọn đáp án đúng
      </p>
      <button
        type="button"
        onClick={() => new Audio(payload.audioUrl).play()}
        aria-label="Phát âm thanh"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red text-white shadow-sm transition-colors hover:bg-brand-red-dark"
      >
        <Volume2 className="h-7 w-7" strokeWidth={2} />
      </button>
      <div className="flex w-full flex-col gap-2.5">
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
              className={`flex items-center justify-between rounded-btn border px-5 py-3 text-left font-han-title text-lg font-semibold transition-all disabled:cursor-not-allowed ${stateClasses}`}
            >
              <span>{choice}</span>
              {answered && isCorrectChoice && (
                <span className="animate-check-pop ml-2 text-success-text">
                  <Check className="h-5 w-5" strokeWidth={3} />
                </span>
              )}
              {answered && isSelected && !isCorrectChoice && (
                <span className="animate-check-pop ml-2 text-error-text">
                  <X className="h-5 w-5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
