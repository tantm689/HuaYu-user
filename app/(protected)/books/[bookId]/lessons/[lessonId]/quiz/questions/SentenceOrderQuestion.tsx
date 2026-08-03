'use client'

import { useState } from 'react'
import type { SentenceOrderPayload } from '@/lib/db/types'
import { gradeSentenceOrder } from '@/lib/quiz/grading'

export default function SentenceOrderQuestion({
  payload,
  onAnswer,
}: {
  payload: SentenceOrderPayload
  onAnswer: (isCorrect: boolean) => void
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
    onAnswer(gradeSentenceOrder(payload, pickedIndices))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex min-h-14 flex-wrap gap-2 rounded-btn border border-dashed border-card-border bg-accent-bg p-3">
        {pickedIndices.map((wordIndex, position) => (
          <button
            key={position}
            type="button"
            disabled={checked}
            onClick={() => unpick(position)}
            className="rounded-btn border border-brand-red bg-white px-4 py-2 font-han-title font-semibold text-ink disabled:cursor-not-allowed"
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

      {checked && (
        <p className={`text-sm font-semibold ${gradeSentenceOrder(payload, pickedIndices) ? 'text-success-text' : 'text-error-text'}`}>
          {gradeSentenceOrder(payload, pickedIndices)
            ? 'Chính xác!'
            : `Câu đúng: ${payload.correctOrder.map((i) => payload.words[i]).join(' ')}`}
        </p>
      )}
    </div>
  )
}
