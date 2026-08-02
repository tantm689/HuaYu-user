'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Layers } from 'lucide-react'
import type { DialogueVocabulary, VocabularyProgress } from '@/lib/db/types'
import { ensureVocabularyProgress } from '@/lib/db/ensureVocabularyProgress'
import { getVocabularyProgressForLesson } from '@/lib/db/getVocabularyProgressForLesson'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import FlashcardReviewer from '@/components/FlashcardReviewer'

type ViewState = { mode: 'list' } | { mode: 'preview' | 'review'; dialogueId: string }

function parseView(searchParams: URLSearchParams): ViewState {
  const dialogueId = searchParams.get('dialogue')
  const mode = searchParams.get('mode')
  if (dialogueId && (mode === 'preview' || mode === 'review')) {
    return { mode, dialogueId }
  }
  return { mode: 'list' }
}

export default function VocabularyFlashcards({
  lessonNo,
  dialogueGroups,
  progress: initialProgress,
}: {
  lessonNo: number
  dialogueGroups: DialogueVocabulary[]
  progress: VocabularyProgress[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = parseView(searchParams)

  const [progress, setProgress] = useState(initialProgress)
  const [startingReview, setStartingReview] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  function goTo(next: ViewState) {
    if (next.mode === 'list') {
      router.push(pathname)
    } else {
      router.push(`${pathname}?dialogue=${next.dialogueId}&mode=${next.mode}`)
    }
  }

  async function startLearning(dialogueId: string) {
    const group = dialogueGroups.find((g) => g.dialogue_id === dialogueId)
    const vocabularyIds = (group?.words ?? []).map((w) => w.id)

    setStartingReview(true)
    setStartError(null)
    try {
      const supabase = createBrowserSupabase()
      await ensureVocabularyProgress(supabase, vocabularyIds)
      const freshProgress = await getVocabularyProgressForLesson(supabase, vocabularyIds)
      setProgress((prev) => {
        const byId = new Map(prev.map((p) => [p.vocabulary_id, p]))
        for (const p of freshProgress) byId.set(p.vocabulary_id, p)
        return [...byId.values()]
      })
      goTo({ mode: 'review', dialogueId })
    } catch {
      setStartError('Không bắt đầu học được, kiểm tra kết nối mạng.')
    } finally {
      setStartingReview(false)
    }
  }

  const dialogueIndex = view.mode !== 'list' ? dialogueGroups.findIndex((g) => g.dialogue_id === view.dialogueId) : -1
  const heading = dialogueIndex >= 0 ? `Từ vựng Hội thoại ${dialogueIndex + 1}` : 'Từ vựng'

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lessonNo}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">{heading}</h1>
      </div>

      {view.mode === 'preview' && (
        <>
          <button
            type="button"
            disabled={startingReview}
            onClick={() => startLearning(view.dialogueId)}
            className="rounded-btn bg-brand-red px-6 py-3 text-center font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark disabled:opacity-50"
          >
            {startingReview ? 'Đang chuẩn bị...' : 'Bắt đầu học với FlashCard'}
          </button>

          {startError && (
            <p role="alert" className="text-sm font-semibold text-error-text">
              {startError}
            </p>
          )}

          <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-sm">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[27%]" />
                <col className="w-[45%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-card-border bg-accent-bg">
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-ink-faint">
                    Chữ Hán
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-ink-faint">
                    Pinyin
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-ink-faint">
                    Nghĩa
                  </th>
                </tr>
              </thead>
              <tbody>
                {(dialogueGroups[dialogueIndex]?.words ?? []).map((w) => (
                  <tr key={w.id} className="border-b border-card-border last:border-b-0">
                    <td className="border-r border-card-border px-4 py-3 align-top font-han-body text-lg font-semibold text-ink">
                      {w.word_zh}
                    </td>
                    <td className="border-r border-card-border px-4 py-3 align-top text-sm font-bold text-ink">
                      {w.pinyin}
                    </td>
                    <td className="px-4 py-3 align-top text-sm font-medium text-ink">{w.meaning_vi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view.mode === 'review' &&
        (() => {
          const group = dialogueGroups[dialogueIndex]
          const progressByVocabId = new Map(progress.map((p) => [p.vocabulary_id, p]))
          const cards = (group?.words ?? [])
            .filter((w) => progressByVocabId.has(w.id))
            .map((w) => ({ vocabulary: w, progress: progressByVocabId.get(w.id)! }))

          // Vào thẳng review mode qua URL (ví dụ back/forward, paste link) mà chưa
          // từng bấm "Bắt đầu học" cho bộ này -> chưa có tiến độ nào, quay về preview
          // thay vì để FlashcardReviewer nhận mảng cards rỗng.
          if (cards.length === 0) {
            return (
              <p className="font-semibold text-ink-faint">
                Chưa bắt đầu học bộ này.{' '}
                <button
                  type="button"
                  onClick={() => goTo({ mode: 'preview', dialogueId: view.dialogueId })}
                  className="font-bold text-brand-red underline-offset-2 hover:underline"
                >
                  Quay lại xem bảng từ vựng
                </button>
              </p>
            )
          }

          return <FlashcardReviewer cards={cards} storageKey={`vocab-review-${view.dialogueId}`} />
        })()}

      {view.mode === 'list' && (
        <ul className="flex flex-col gap-3">
          {dialogueGroups.map((group, index) => (
            <li key={group.dialogue_id}>
              <button
                type="button"
                onClick={() => goTo({ mode: 'preview', dialogueId: group.dialogue_id })}
                className="group flex w-full items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
                  <Layers className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block font-bold text-ink">Từ vựng Hội thoại {index + 1}</span>
                  <span className="text-sm font-medium text-ink-faint">{group.words.length} từ</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
