'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { QuizQuestion } from '@/lib/db/types'
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

  // "Làm lại" luôn phải bỏ kết quả cũ ngay lập tức: nếu part không đổi (đang
  // xem kết quả Phần 1, bấm Làm lại Phần 1), URL ?part=1 giữ nguyên nên
  // router.replace() không tự kích hoạt render lại - phải setResult(null) ở
  // đây thì nhánh `!result` mới đưa về QuizPlayer thay vì tiếp tục hiện màn
  // kết quả cũ.
  function goToPart(part: 1 | 2) {
    setResult(null)
    if (view.mode === 'playing') {
      router.replace(`${pathname}?part=${part}`)
    } else {
      router.push(`${pathname}?part=${part}`)
    }
  }

  // Ngược lại, "Về danh sách Phần" KHÔNG được xoá `result` ngay - router.replace()
  // của Next.js App Router cập nhật URL bất đồng bộ (round-trip RSC), nên nếu
  // setResult(null) chạy trước khi URL thực sự đổi, có một khoảng render với
  // view.mode vẫn là 'playing' cũ nhưng result đã null -> component tụt xuống
  // nhánh render QuizPlayer (trang làm quiz) trong vài giây trước khi URL kịp
  // cập nhật về 'select'. Nhánh `view.mode === 'select'` return trước khi đọc
  // `result`, nên cứ để result cũ tồn tại đến khi unmount tự nhiên là an toàn.
  function goToSelect() {
    router.replace(pathname)
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
  const percent = total > 0 ? Math.round((score / total) * 100) : 0
  const circumference = 2 * Math.PI * 54

  return (
    <div className="mx-auto w-full max-w-lg rounded-card border border-card-border bg-white p-10 text-center shadow-sm">
      <p className="font-han-title text-2xl font-bold text-ink">{PART_META[part].title} hoàn thành</p>

      <div className="relative mx-auto my-8 h-44 w-44">
        <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#EFE4CE" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#7FBF8C"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (percent / 100) * circumference}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-han-title text-4xl font-bold text-ink">{percent}%</span>
          <span className="mt-0.5 text-sm font-semibold text-ink-faint">
            {score}/{total} câu đúng
          </span>
        </span>
      </div>

      {saving && <p className="text-xs font-medium text-ink-faint">Đang lưu kết quả...</p>}

      {saveError && (
        <div className="mx-auto flex max-w-sm items-center justify-between rounded-card-sm border border-error-border bg-error-bg px-4 py-3">
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

      <div className="mx-auto mt-2 flex max-w-sm gap-3">
        <button
          type="button"
          onClick={() => goToPart(part)}
          className="flex-1 rounded-btn border border-card-border bg-white px-5 py-3 font-semibold text-ink shadow-sm transition-colors hover:bg-accent-bg"
        >
          Làm lại
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={goToSelect}
          className="flex-1 rounded-btn bg-brand-red px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark disabled:opacity-50"
        >
          Về danh sách Phần
        </button>
      </div>
    </div>
  )
}

