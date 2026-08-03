'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2, Home } from 'lucide-react'
import type { DueVocabularyCard } from '@/lib/db/getDueVocabularyCards'
import FlashcardReviewer from '@/components/FlashcardReviewer'

export default function ReviewSession({ cards }: { cards: DueVocabularyCard[] }) {
  const router = useRouter()

  return (
    <FlashcardReviewer
      cards={cards}
      storageKey="due-review-session"
      renderCompletion={() => (
        <div className="rounded-card border border-card-border bg-white p-10 text-center shadow-sm">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success-text">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
          </span>
          <p className="mt-4 font-han-title text-2xl font-bold text-ink">Đã ôn xong!</p>
          <p className="mt-1 text-sm font-medium text-ink-faint">Quay lại sau khi có thẻ mới đến hạn.</p>
          <button
            type="button"
            onClick={() => router.push('/home')}
            className="mx-auto mt-6 flex items-center gap-1.5 rounded-btn bg-brand-red px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
          >
            <Home className="h-4 w-4" strokeWidth={2.25} />
            Về trang chủ
          </button>
        </div>
      )}
    />
  )
}
