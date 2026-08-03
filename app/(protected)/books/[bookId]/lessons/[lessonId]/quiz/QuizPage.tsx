'use client'

import { useState } from 'react'
import type {
  QuizQuestion,
  PinyinChoicePayload,
  ToneChoicePayload,
  FillBlankPayload,
  SentenceOrderPayload,
} from '@/lib/db/types'
import { recordQuizAttempt } from '@/lib/db/quiz'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import QuizPlayer, { type QuestionResult } from './QuizPlayer'

type Stage = { mode: 'select' } | { mode: 'playing'; part: 1 | 2 } | { mode: 'result'; part: 1 | 2; results: QuestionResult[] }

const PART_META = {
  1: { title: 'Phần 1', description: 'Nhận biết từ vựng & phát âm' },
  2: { title: 'Phần 2', description: 'Vận dụng câu & ngữ pháp' },
} as const

export default function QuizPage({
  lessonId,
  part1Questions,
  part2Questions,
  bestScores,
}: {
  lessonId: string
  part1Questions: QuizQuestion[]
  part2Questions: QuizQuestion[]
  bestScores: { part1: number | null; part2: number | null }
}) {
  const [stage, setStage] = useState<Stage>({ mode: 'select' })
  const [scores, setScores] = useState(bestScores)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const questionsByPart = { 1: part1Questions, 2: part2Questions } as const

  async function submitAttempt(part: 1 | 2, results: QuestionResult[]) {
    const score = results.filter((r) => r.isCorrect).length
    const total = results.length

    setSaving(true)
    setSaveError(null)
    try {
      const supabase = createBrowserSupabase()
      await recordQuizAttempt(supabase, lessonId, part, score, total)
      setScores((prev) => ({
        ...prev,
        [part === 1 ? 'part1' : 'part2']: Math.max(prev[part === 1 ? 'part1' : 'part2'] ?? 0, score),
      }))
    } catch {
      setSaveError('Không lưu được, kiểm tra kết nối mạng.')
    } finally {
      setSaving(false)
    }
  }

  if (stage.mode === 'select') {
    return (
      <div className="flex flex-col gap-3">
        {([1, 2] as const).map((part) => {
          const bestScore = part === 1 ? scores.part1 : scores.part2
          return (
            <div key={part} className="rounded-card border border-card-border bg-white p-5 shadow-sm">
              <p className="font-han-title text-lg font-bold text-ink">{PART_META[part].title}</p>
              <p className="text-sm font-medium text-ink-faint">{PART_META[part].description}</p>
              {bestScore !== null && (
                <p className="mt-1 text-sm font-semibold text-brand-red">Điểm cao nhất: {bestScore}/15</p>
              )}
              <button
                type="button"
                onClick={() => setStage({ mode: 'playing', part })}
                className="mt-3 rounded-btn bg-brand-red px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
              >
                {bestScore !== null ? 'Làm lại' : 'Bắt đầu'}
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  if (stage.mode === 'playing') {
    return (
      <QuizPlayer
        questions={questionsByPart[stage.part]}
        onPartComplete={(results) => {
          setStage({ mode: 'result', part: stage.part, results })
          submitAttempt(stage.part, results)
        }}
      />
    )
  }

  const score = stage.results.filter((r) => r.isCorrect).length
  const total = stage.results.length

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-3xl font-bold text-ink">
          {score}/{total}
        </p>
        <p className="mt-1 text-sm font-medium text-ink-faint">{PART_META[stage.part].title} hoàn thành</p>
      </div>

      {saveError && (
        <div className="flex items-center justify-between rounded-card-sm border border-error-border bg-error-bg px-4 py-3">
          <p className="text-sm font-semibold text-error-text">{saveError}</p>
          <button
            type="button"
            disabled={saving}
            onClick={() => submitAttempt(stage.part, stage.results)}
            className="rounded-btn border border-error-border bg-white px-4 py-1.5 text-sm font-semibold text-error-text transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {stage.results.map((result, i) => {
          const question = questionsByPart[stage.part][i]
          return (
            <div
              key={result.questionId}
              className={`rounded-card-sm border px-4 py-3 ${
                result.isCorrect ? 'border-success-border bg-success-bg' : 'border-error-border bg-error-bg'
              }`}
            >
              <p className={`text-sm font-semibold ${result.isCorrect ? 'text-success-text' : 'text-error-text'}`}>
                Câu {i + 1}: {result.isCorrect ? 'Đúng' : 'Sai'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-ink-faint">{questionSummary(question)}</p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStage({ mode: 'playing', part: stage.part })}
          className="rounded-btn border border-card-border bg-white px-5 py-2.5 font-semibold text-ink shadow-sm transition-colors hover:bg-accent-bg"
        >
          Làm lại
        </button>
        <button
          type="button"
          onClick={() => setStage({ mode: 'select' })}
          className="rounded-btn bg-brand-red px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
        >
          Về danh sách Phần
        </button>
      </div>
    </div>
  )
}

function questionSummary(question: QuizQuestion): string {
  switch (question.type) {
    case 'pinyin_choice':
      return (question.payload as PinyinChoicePayload).prompt
    case 'listening_choice':
      return 'Nghe & chọn đáp án'
    case 'tone_choice':
      return (question.payload as ToneChoicePayload).wordZh
    case 'fill_blank':
      return (question.payload as FillBlankPayload).sentence
    case 'matching':
      return 'Ghép nghĩa/nối từ'
    case 'sentence_order':
      return (question.payload as SentenceOrderPayload).words.join(' / ')
  }
}
