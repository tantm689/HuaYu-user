'use client'

import { useState } from 'react'
import type {
  QuizQuestion,
  PinyinChoicePayload,
  ListeningChoicePayload,
  ToneChoicePayload,
  MatchingPayload,
  FillBlankPayload,
  SentenceOrderPayload,
} from '@/lib/db/types'
import PinyinChoiceQuestion from './questions/PinyinChoiceQuestion'
import ListeningChoiceQuestion from './questions/ListeningChoiceQuestion'
import ToneChoiceQuestion from './questions/ToneChoiceQuestion'
import FillBlankQuestion from './questions/FillBlankQuestion'
import MatchingQuestion from './questions/MatchingQuestion'
import SentenceOrderQuestion from './questions/SentenceOrderQuestion'

export interface QuestionResult {
  questionId: string
  isCorrect: boolean
}

export default function QuizPlayer({
  questions,
  onPartComplete,
}: {
  questions: QuizQuestion[]
  onPartComplete: (results: QuestionResult[]) => void
}) {
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [pendingResult, setPendingResult] = useState<boolean | null>(null)

  const question = questions[index]
  const isLast = index === questions.length - 1

  function handleAnswer(isCorrect: boolean) {
    setPendingResult(isCorrect)
  }

  function handleNext() {
    const nextResults = [...results, { questionId: question.id, isCorrect: pendingResult! }]
    setResults(nextResults)
    setPendingResult(null)

    if (isLast) {
      onPartComplete(nextResults)
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-pill bg-accent-bg">
          <div
            className="h-full rounded-pill bg-brand-gold transition-[width] duration-500 ease-out"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-ink-faint">
          Câu {index + 1}/{questions.length}
        </span>
      </div>

      <div className="rounded-card border border-card-border bg-white p-6 shadow-sm">
        {question.type === 'pinyin_choice' && (
          <PinyinChoiceQuestion key={question.id} payload={question.payload as PinyinChoicePayload} onAnswer={handleAnswer} />
        )}
        {question.type === 'listening_choice' && (
          <ListeningChoiceQuestion key={question.id} payload={question.payload as ListeningChoicePayload} onAnswer={handleAnswer} />
        )}
        {question.type === 'tone_choice' && (
          <ToneChoiceQuestion key={question.id} payload={question.payload as ToneChoicePayload} onAnswer={handleAnswer} />
        )}
        {question.type === 'fill_blank' && (
          <FillBlankQuestion key={question.id} payload={question.payload as FillBlankPayload} onAnswer={handleAnswer} />
        )}
        {question.type === 'matching' && (
          <MatchingQuestion key={question.id} payload={question.payload as MatchingPayload} onAnswer={handleAnswer} />
        )}
        {question.type === 'sentence_order' && (
          <SentenceOrderQuestion key={question.id} payload={question.payload as SentenceOrderPayload} onAnswer={handleAnswer} />
        )}
      </div>

      {pendingResult !== null && (
        <button
          type="button"
          onClick={handleNext}
          className="self-end rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          {isLast ? 'Hoàn thành' : 'Tiếp'}
        </button>
      )}
    </div>
  )
}
