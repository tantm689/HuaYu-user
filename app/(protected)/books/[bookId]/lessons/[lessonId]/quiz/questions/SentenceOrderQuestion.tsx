'use client'

import { useState } from 'react'
import type { SentenceOrderPayload } from '@/lib/db/types'
import { gradeSentenceOrder } from '@/lib/quiz/grading'

export default function SentenceOrderQuestion({
  payload,
  onAnswer,
}: {
  payload: SentenceOrderPayload
  onAnswer: (isCorrect: boolean, userAnswer?: number[]) => void
}) {
  const [pickedIndices, setPickedIndices] = useState<number[]>([])
  const [checked, setChecked] = useState(false)

  const remainingIndices = payload.words.map((_, i) => i).filter((i) => !pickedIndices.includes(i))
  const allPicked = pickedIndices.length === payload.words.length

  function pick(index: number) {
    if (checked) return
    setPickedIndices((prev) => [...prev, index])
  }

  function unpick(position: number) {
    if (checked) return
    setPickedIndices((prev) => prev.filter((_, i) => i !== position))
  }

  function handleCheck() {
    setChecked(true)
    onAnswer(gradeSentenceOrder(payload, pickedIndices), pickedIndices)
  }

  const isCorrect = checked ? gradeSentenceOrder(payload, pickedIndices) : false
  const containerAnimClass = checked
    ? isCorrect
      ? 'animate-bounce-pop border-success-border bg-success-bg'
      : 'animate-shake-wrong border-error-border bg-error-bg'
    : 'border-dashed border-card-border bg-accent-bg'

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
        Sắp xếp các từ sau thành câu đúng
      </p>
      <div className={`flex min-h-14 flex-wrap gap-2 rounded-btn border p-3 transition-all ${containerAnimClass}`}>
        {pickedIndices.map((wordIndex, position) => (
          <button
            key={position}
            type="button"
            disabled={checked}
            onClick={() => unpick(position)}
            className="rounded-btn border border-brand-gold bg-amber-50/70 px-4 py-2 font-han-title font-semibold text-ink shadow-xs transition-colors hover:bg-amber-100 disabled:cursor-not-allowed"
          >
            {payload.words[wordIndex]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {remainingIndices.map((wordIndex) => (
          <button
            key={wordIndex}
            type="button"
            onClick={() => pick(wordIndex)}
            className="rounded-btn border border-card-border bg-white px-4 py-2 font-han-title font-semibold text-ink transition-colors hover:bg-accent-bg"
          >
            {payload.words[wordIndex]}
          </button>
        ))}
      </div>

      {allPicked && !checked && (
        <button
          type="button"
          onClick={handleCheck}
          className="rounded-btn bg-brand-red px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Kiểm tra
        </button>
      )}

      {checked && !gradeSentenceOrder(payload, pickedIndices) && (
        <p className="text-sm font-semibold text-error-text">
          Câu đúng: {payload.correctOrder.map((i) => payload.words[i]).join(' ')}
        </p>
      )}
    </div>
  )
}
