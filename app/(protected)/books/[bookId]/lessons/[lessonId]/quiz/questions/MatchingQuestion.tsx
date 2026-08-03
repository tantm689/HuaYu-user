'use client'

import { useMemo, useState } from 'react'
import type { MatchingPayload } from '@/lib/db/types'
import { gradeMatching, shuffleWithIndexMap } from '@/lib/quiz/grading'

export default function MatchingQuestion({
  payload,
  onAnswer,
}: {
  payload: MatchingPayload
  onAnswer: (isCorrect: boolean) => void
}) {
  // Shuffle the right column's display order once per mount so the answer
  // isn't given away by matching row positions — left column stays in the
  // original `pairs` order. `key={question.id}` on this component (from
  // QuizPlayer) guarantees a fresh shuffle per question via remount.
  const shuffledRight = useMemo(() => shuffleWithIndexMap(payload.pairs.map((p) => p.right)), [payload.pairs])

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [matchedLeftIndices, setMatchedLeftIndices] = useState<Set<number>>(new Set())
  const [wrongFlash, setWrongFlash] = useState<{ leftIndex: number; rightPosition: number } | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [reported, setReported] = useState(false)

  function handleLeftClick(leftIndex: number) {
    if (matchedLeftIndices.has(leftIndex)) return
    setSelectedLeft(leftIndex)
  }

  function handleRightClick(rightPosition: number, originalIndex: number) {
    if (selectedLeft === null) return
    if (matchedLeftIndices.has(selectedLeft)) return

    const isCorrect = originalIndex === selectedLeft

    if (isCorrect) {
      const nextMatched = new Set(matchedLeftIndices)
      nextMatched.add(selectedLeft)
      setMatchedLeftIndices(nextMatched)
      setSelectedLeft(null)

      if (nextMatched.size === payload.pairs.length && !reported) {
        setReported(true)
        onAnswer(gradeMatching(payload.pairs.length, wrongAttempts))
      }
    } else {
      setWrongAttempts((n) => n + 1)
      setWrongFlash({ leftIndex: selectedLeft, rightPosition })
      window.setTimeout(() => {
        setWrongFlash(null)
        setSelectedLeft(null)
      }, 400)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        {payload.pairs.map((pair, index) => {
          const isMatched = matchedLeftIndices.has(index)
          const isSelected = selectedLeft === index
          const isWrong = wrongFlash?.leftIndex === index

          let stateClasses = 'border-card-border bg-white hover:bg-accent-bg'
          if (isMatched) stateClasses = 'border-success-border bg-success-bg text-success-text'
          else if (isWrong) stateClasses = 'border-error-border bg-error-bg text-error-text'
          else if (isSelected) stateClasses = 'border-brand-red bg-red-50'

          return (
            <button
              key={index}
              type="button"
              disabled={isMatched}
              onClick={() => handleLeftClick(index)}
              className={`rounded-btn border px-4 py-3 text-center font-han-title font-semibold transition-colors disabled:cursor-not-allowed ${stateClasses}`}
            >
              {pair.left}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2">
        {shuffledRight.map(({ item, originalIndex }, position) => {
          const isMatched = matchedLeftIndices.has(originalIndex)
          const isWrong = wrongFlash?.rightPosition === position

          let stateClasses = 'border-card-border bg-white hover:bg-accent-bg'
          if (isMatched) stateClasses = 'border-success-border bg-success-bg text-success-text'
          else if (isWrong) stateClasses = 'border-error-border bg-error-bg text-error-text'

          return (
            <button
              key={position}
              type="button"
              disabled={isMatched}
              onClick={() => handleRightClick(position, originalIndex)}
              className={`rounded-btn border px-4 py-3 text-center font-semibold transition-colors disabled:cursor-not-allowed ${stateClasses}`}
            >
              {item}
            </button>
          )
        })}
      </div>
    </div>
  )
}
