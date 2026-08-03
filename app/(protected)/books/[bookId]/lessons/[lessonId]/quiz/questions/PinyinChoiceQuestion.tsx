'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { PinyinChoicePayload } from '@/lib/db/types'
import { gradeChoiceAnswer, shuffleWithIndexMap } from '@/lib/quiz/grading'

export default function PinyinChoiceQuestion({
  payload,
  onAnswer,
}: {
  payload: PinyinChoicePayload
  onAnswer: (isCorrect: boolean, userAnswer?: number) => void
}) {
  const shuffledChoices = useMemo(() => shuffleWithIndexMap(payload.choices), [payload.choices])

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    onAnswer(gradeChoiceAnswer(payload, index), index)
  }

  // prompt có thể là chữ Hán (hỏi pinyin đúng) hoặc pinyin (hỏi chữ Hán
  // đúng), tuỳ Gemini chọn chiều hỏi cho câu này — đề bài đổi theo nội dung
  // prompt để luôn khớp đúng chiều đang hỏi.
  const promptIsHanzi = /[一-鿿㐀-䶿]/.test(payload.prompt)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
        {promptIsHanzi ? 'Chọn pinyin đúng cho chữ Hán sau' : 'Chọn chữ Hán đúng cho pinyin sau'}
      </p>
      <p className="text-center font-han-title text-3xl font-bold text-ink">{payload.prompt}</p>
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
              className={`flex items-center justify-between rounded-btn border px-5 py-3 text-left font-semibold transition-all disabled:cursor-not-allowed ${stateClasses}`}
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
