'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Home, Repeat } from 'lucide-react'
import type { DueVocabularyCard } from '@/lib/db/getDueVocabularyCards'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import FlashcardReviewer from '@/components/FlashcardReviewer'

export default function ReviewSession({ cards }: { cards: DueVocabularyCard[] }) {
  return <FlashcardReviewer cards={cards} storageKey="due-review-session" renderCompletion={() => <CompletionScreen />} />
}

function CompletionScreen() {
  const router = useRouter()
  // null = đang kiểm tra lại; number = số từ thực sự vẫn đến hạn ngay sau khi
  // vừa hoàn thành phiên. Từ ở box 0 chưa đủ 3 lần đúng liên tiếp được set
  // due_at = ngay bây giờ (xem lib/srs/leitner.ts) nên "học xong 1 lượt" ở
  // đây không đồng nghĩa với "hết từ cần ôn" - phải kiểm tra lại thực tế
  // thay vì mặc định coi phiên vừa xong là đã xong hẳn.
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserSupabase()
    getDueVocabularyCards(supabase)
      .then((due) => {
        if (!cancelled) setRemaining(due.length)
      })
      .catch(() => {
        if (!cancelled) setRemaining(0)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (remaining === null) {
    return (
      <div className="rounded-card border border-card-border bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-ink-faint">Đang kiểm tra...</p>
      </div>
    )
  }

  if (remaining > 0) {
    return (
      <div className="rounded-card border border-card-border bg-white p-10 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-bg text-brand-red">
          <Repeat className="h-9 w-9" strokeWidth={2} />
        </span>
        <p className="mt-4 font-han-title text-2xl font-bold text-ink">Vẫn còn {remaining} từ cần ôn</p>
        <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-ink-faint">
          Từ mới học cần trả lời đúng liên tiếp vài lần mới tính là thuộc, nên các từ này quay lại ngay để bạn ôn thêm.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm gap-3">
          <button
            type="button"
            onClick={() => router.push('/home')}
            className="flex-1 rounded-btn border border-card-border bg-white px-5 py-2.5 font-semibold text-ink shadow-sm transition-colors hover:bg-accent-bg"
          >
            Về trang chủ
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex-1 rounded-btn bg-brand-red px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-red-dark"
          >
            Ôn tiếp
          </button>
        </div>
      </div>
    )
  }

  return (
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
  )
}
