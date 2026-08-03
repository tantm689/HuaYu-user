'use client'

import { useMemo, useState } from 'react'
import type { MatchingPayload } from '@/lib/db/types'
import { gradeMatching, shuffleWithIndexMap } from '@/lib/quiz/grading'

export default function MatchingQuestion({
  payload,
  onAnswer,
}: {
  payload: MatchingPayload
  onAnswer: (isCorrect: boolean, userAnswer?: number) => void
}) {
  // Shuffle the right column's display order once per mount so the answer
  // isn't given away by matching row positions — left column stays in the
  // original `pairs` order. `key={question.id}` on this component (from
  // QuizPlayer) guarantees a fresh shuffle per question via remount.
  const shuffledRight = useMemo(() => shuffleWithIndexMap(payload.pairs.map((p) => p.right)), [payload.pairs])

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [selectedRight, setSelectedRight] = useState<{ position: number; originalIndex: number } | null>(null)
  const [matchedLeftIndices, setMatchedLeftIndices] = useState<Set<number>>(new Set())
  const [wrongFlash, setWrongFlash] = useState<{ leftIndex: number; rightPosition: number } | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [reported, setReported] = useState(false)

  function attemptMatch(leftIndex: number, rightPosition: number, originalIndex: number) {
    const isCorrect = originalIndex === leftIndex

    if (isCorrect) {
      const nextMatched = new Set(matchedLeftIndices)
      nextMatched.add(leftIndex)
      setMatchedLeftIndices(nextMatched)
      setSelectedLeft(null)
      setSelectedRight(null)

      if (nextMatched.size === payload.pairs.length && !reported) {
        setReported(true)
        onAnswer(gradeMatching(payload.pairs.length, wrongAttempts), wrongAttempts)
      }
    } else {
      setWrongAttempts((n) => n + 1)
      setWrongFlash({ leftIndex, rightPosition })
      setSelectedLeft(null)
      setSelectedRight(null)
      window.setTimeout(() => {
        setWrongFlash(null)
      }, 400)
    }
  }

  function handleLeftClick(leftIndex: number) {
    if (matchedLeftIndices.has(leftIndex)) return

    if (selectedRight !== null) {
      // User selected a Right item first, now clicked Left item -> attempt match
      attemptMatch(leftIndex, selectedRight.position, selectedRight.originalIndex)
    } else {
      // Select left item (or toggle if clicking same item)
      setSelectedLeft((prev) => (prev === leftIndex ? null : leftIndex))
    }
  }

  function handleRightClick(rightPosition: number, originalIndex: number) {
    if (matchedLeftIndices.has(originalIndex)) return

    if (selectedLeft !== null) {
      // User selected a Left item first, now clicked Right item -> attempt match
      attemptMatch(selectedLeft, rightPosition, originalIndex)
    } else {
      // Select right item (or toggle if clicking same item)
      setSelectedRight((prev) =>
        prev?.position === rightPosition ? null : { position: rightPosition, originalIndex }
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-faint">
        Nối chữ Hán với nghĩa tiếng Việt đúng
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          {payload.pairs.map((pair, index) => {
            const isMatched = matchedLeftIndices.has(index)
            const isSelected = selectedLeft === index
            const isWrong = wrongFlash?.leftIndex === index

            let stateClasses = 'border-card-border bg-white hover:bg-accent-bg'
            if (isMatched) stateClasses = 'animate-bounce-pop border-success-border bg-success-bg text-success-text shadow-sm'
            else if (isWrong) stateClasses = 'animate-shake-wrong border-error-border bg-error-bg text-error-text'
            else if (isSelected) stateClasses = 'border-brand-gold bg-amber-50/70 text-ink ring-2 ring-brand-gold/40 shadow-sm'

            return (
              <button
                key={index}
                type="button"
                disabled={isMatched}
                onClick={() => handleLeftClick(index)}
                className={`rounded-btn border px-4 py-3 text-center font-han-title font-semibold transition-all disabled:cursor-not-allowed ${stateClasses}`}
              >
                {pair.left}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2">
          {shuffledRight.map(({ item, originalIndex }, position) => {
            const isMatched = matchedLeftIndices.has(originalIndex)
            const isSelected = selectedRight?.position === position
            const isWrong = wrongFlash?.rightPosition === position

            let stateClasses = 'border-card-border bg-white hover:bg-accent-bg'
            if (isMatched) stateClasses = 'animate-bounce-pop border-success-border bg-success-bg text-success-text shadow-sm'
            else if (isWrong) stateClasses = 'animate-shake-wrong border-error-border bg-error-bg text-error-text'
            else if (isSelected) stateClasses = 'border-brand-gold bg-amber-50/70 text-ink ring-2 ring-brand-gold/40 shadow-sm'

            return (
              <button
                key={position}
                type="button"
                disabled={isMatched}
                onClick={() => handleRightClick(position, originalIndex)}
                className={`rounded-btn border px-4 py-3 text-center font-semibold transition-all disabled:cursor-not-allowed ${stateClasses}`}
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

