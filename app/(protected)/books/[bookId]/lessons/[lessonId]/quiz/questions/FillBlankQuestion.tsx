'use client'

import { useState } from 'react'
import type { FillBlankPayload } from '@/lib/db/types'
import { gradeChoiceAnswer } from '@/lib/quiz/grading'

export default function FillBlankQuestion({
  payload,
  onAnswer,
}: {
  payload: FillBlankPayload
  onAnswer: (isCorrect: boolean) => void
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    onAnswer(gradeChoiceAnswer(payload, index))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="font-han-title text-lg font-medium text-ink-faint">{payload.contextSentence}</p>
        <p className="mt-1 font-han-title text-2xl font-bold text-ink">{payload.sentence}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {payload.choices.map((choice, index) => {
          const isSelected = selectedIndex === index
          const isCorrectChoice = index === payload.correctIndex
          const answered = selectedIndex !== null

          let stateClasses = 'border-card-border bg-white hover:bg-accent-bg'
          if (answered && isCorrectChoice) {
            stateClasses = 'border-success-border bg-success-bg text-success-text'
          } else if (answered && isSelected && !isCorrectChoice) {
            stateClasses = 'border-error-border bg-error-bg text-error-text'
          }

          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(index)}
              className={`rounded-btn border px-5 py-3 text-left font-han-title text-lg font-semibold transition-colors disabled:cursor-not-allowed ${stateClasses}`}
            >
              {choice}
            </button>
          )
        })}
      </div>
    </div>
  )
}
