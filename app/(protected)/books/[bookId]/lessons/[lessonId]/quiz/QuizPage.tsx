'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'
import type {
  QuizQuestion,
  PinyinChoicePayload,
  ListeningChoicePayload,
  ToneChoicePayload,
  FillBlankPayload,
  SentenceOrderPayload,
} from '@/lib/db/types'
import { recordQuizAttempt } from '@/lib/db/quiz'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import QuizPlayer, { type QuestionResult } from './QuizPlayer'

type ViewState = { mode: 'select' } | { mode: 'playing'; part: 1 | 2 }

function parseView(searchParams: URLSearchParams): ViewState {
  const part = searchParams.get('part')
  if (part === '1' || part === '2') {
    return { mode: 'playing', part: part === '1' ? 1 : 2 }
  }
  return { mode: 'select' }
}

type ResultState = { part: 1 | 2; results: QuestionResult[] } | null

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = parseView(searchParams)

  const [result, setResult] = useState<ResultState>(null)
  const [scores, setScores] = useState(bestScores)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const questionsByPart = { 1: part1Questions, 2: part2Questions } as const

  function goToPart(part: 1 | 2) {
    setResult(null)
    router.push(`${pathname}?part=${part}`)
  }

  function goToSelect() {
    setResult(null)
    router.push(pathname)
  }

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

  if (view.mode === 'select') {
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
                onClick={() => goToPart(part)}
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

  const part = view.part

  if (!result || result.part !== part) {
    return (
      <QuizPlayer
        questions={questionsByPart[part]}
        onPartComplete={(results) => {
          setResult({ part, results })
          submitAttempt(part, results)
        }}
      />
    )
  }

  const score = result.results.filter((r) => r.isCorrect).length
  const total = result.results.length

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-card border border-card-border bg-white p-8 text-center shadow-sm">
        <p className="font-han-title text-3xl font-bold text-ink">
          {score}/{total}
        </p>
        <p className="mt-1 text-sm font-medium text-ink-faint">{PART_META[part].title} hoàn thành</p>
        {saving && <p className="mt-1 text-xs font-medium text-ink-faint">Đang lưu kết quả...</p>}
      </div>

      {saveError && (
        <div className="flex items-center justify-between rounded-card-sm border border-error-border bg-error-bg px-4 py-3">
          <p className="text-sm font-semibold text-error-text">{saveError}</p>
          <button
            type="button"
            disabled={saving}
            onClick={() => submitAttempt(part, result.results)}
            className="rounded-btn border border-error-border bg-white px-4 py-1.5 text-sm font-semibold text-error-text transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {result.results.map((r, i) => {
          const question = questionsByPart[part][i]
          const correctAnswer = !r.isCorrect ? correctAnswerSummary(question) : ''
          return (
            <div
              key={r.questionId}
              className={`rounded-card-sm border px-4 py-3 ${
                r.isCorrect ? 'border-success-border bg-success-bg' : 'border-error-border bg-error-bg'
              }`}
            >
              <p
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  r.isCorrect ? 'text-success-text' : 'text-error-text'
                }`}
              >
                {r.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                Câu {i + 1}: {r.isCorrect ? 'Đúng' : 'Sai'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-ink-faint">{questionSummary(question)}</p>
              {correctAnswer && (
                <p className="mt-0.5 text-xs font-medium text-ink-faint">Đáp án đúng: {correctAnswer}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => goToPart(part)}
          className="rounded-btn border border-card-border bg-white px-5 py-2.5 font-semibold text-ink shadow-sm transition-colors hover:bg-accent-bg"
        >
          Làm lại
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={goToSelect}
          className="rounded-btn bg-brand-red px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark disabled:opacity-50"
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
    default:
      return ''
  }
}

function correctAnswerSummary(question: QuizQuestion): string {
  switch (question.type) {
    case 'pinyin_choice': {
      const payload = question.payload as PinyinChoicePayload
      return payload.choices[payload.correctIndex]
    }
    case 'listening_choice': {
      const payload = question.payload as ListeningChoicePayload
      return payload.choices[payload.correctIndex]
    }
    case 'tone_choice': {
      const payload = question.payload as ToneChoicePayload
      return payload.choices[payload.correctIndex]
    }
    case 'fill_blank': {
      const payload = question.payload as FillBlankPayload
      return payload.choices[payload.correctIndex]
    }
    case 'sentence_order': {
      const payload = question.payload as SentenceOrderPayload
      return payload.correctOrder.map((i) => payload.words[i]).join(' ')
    }
    case 'matching':
      return ''
    default:
      return ''
  }
}
