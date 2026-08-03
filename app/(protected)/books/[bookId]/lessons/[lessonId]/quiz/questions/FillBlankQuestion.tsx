'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { FillBlankPayload } from '@/lib/db/types'
import { gradeChoiceAnswer, shuffleWithIndexMap } from '@/lib/quiz/grading'

export default function FillBlankQuestion({
  payload,
  onAnswer,
}: {
  payload: FillBlankPayload
  onAnswer: (isCorrect: boolean, userAnswer?: number) => void
}) {
  // Trộn vị trí hiển thị của 4 lựa chọn mỗi khi câu hỏi này được mount (key
  // theo question.id ở QuizPlayer) để đáp án đúng không nằm cố định 1 vị trí
  // qua các lần làm lại — payload.choices/correctIndex gốc không đổi, chỉ
  // đổi thứ tự hiển thị.
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
        Chọn từ đúng để điền vào chỗ trống
      </p>
      <div className="text-center">
        <p className="font-han-title text-2xl font-bold text-ink">{payload.contextSentence}</p>
        <p className="mt-1 font-han-title text-2xl font-bold text-ink">{payload.sentence}</p>
      </div>
      <div className="flex flex-col gap-2.5">
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
