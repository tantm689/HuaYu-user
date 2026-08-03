'use client'

import { useState } from 'react'
import type { PinyinChoicePayload } from '@/lib/db/types'
import { gradeChoiceAnswer } from '@/lib/quiz/grading'

export default function PinyinChoiceQuestion({
  payload,
  onAnswer,
}: {
  payload: PinyinChoicePayload
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
      <p className="text-center font-han-title text-3xl font-bold text-ink">{payload.prompt}</p>
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
              className={`rounded-btn border px-5 py-3 text-left font-semibold transition-colors disabled:cursor-not-allowed ${stateClasses}`}
            >
              {choice}
            </button>
          )
        })}
      </div>
    </div>
  )
}
