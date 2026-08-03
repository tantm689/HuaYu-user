'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { ListeningChoicePayload } from '@/lib/db/types'
import { gradeChoiceAnswer } from '@/lib/quiz/grading'

export default function ListeningChoiceQuestion({
  payload,
  onAnswer,
}: {
  payload: ListeningChoicePayload
  onAnswer: (isCorrect: boolean) => void
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    onAnswer(gradeChoiceAnswer(payload, index))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => new Audio(payload.audioUrl).play()}
        aria-label="Phát âm thanh"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red text-white shadow-sm transition-colors hover:bg-brand-red-dark"
      >
        <Volume2 className="h-7 w-7" strokeWidth={2} />
      </button>
      <div className="flex w-full flex-col gap-2.5">
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
