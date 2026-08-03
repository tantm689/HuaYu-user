'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
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
  userAnswer?: any
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
  const [pendingResult, setPendingResult] = useState<{ isCorrect: boolean; userAnswer?: any } | null>(null)

  const question = questions[index]
  const isLast = index === questions.length - 1

  function handleAnswer(isCorrect: boolean, userAnswer?: any) {
    setPendingResult({ isCorrect, userAnswer })
  }

  function handleNext() {
    if (!pendingResult) return
    const nextResults = [
      ...results,
      { questionId: question.id, isCorrect: pendingResult.isCorrect, userAnswer: pendingResult.userAnswer },
    ]
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
        <div className="animate-slide-up-fade flex items-center justify-between gap-3 rounded-card-sm border border-card-border bg-white p-4 shadow-md">
          <div className="flex items-center gap-2">
            {pendingResult.isCorrect ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-bg text-success-text animate-check-pop">
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-error-bg text-error-text animate-check-pop">
                <X className="h-5 w-5" strokeWidth={3} />
              </span>
            )}
            <div>
              <p
                className={`text-sm font-bold ${
                  pendingResult.isCorrect ? 'text-success-text' : 'text-error-text'
                }`}
              >
                {pendingResult.isCorrect ? 'Chính xác! 🎉' : 'Chưa chính xác'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-brand-red-dark active:scale-95"
          >
            {isLast ? 'Hoàn thành' : 'Tiếp'}
          </button>
        </div>
      )}
    </div>
  )
}
