import Link from 'next/link'
import { BookMarked, ChevronRight, Library, Sparkles } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedBooks } from '@/lib/db/getPublishedBooks'
import { getDueVocabularyCards } from '@/lib/db/getDueVocabularyCards'

// Số từ "Ôn hôm nay" thay đổi ngay sau khi người dùng đánh giá thẻ hoặc bắt đầu
// học 1 bộ ở trang khác — không được để Next.js dùng bản cache cũ của trang này
// khi điều hướng quay lại qua <Link>, nếu không số liệu hiển thị sẽ trễ 1 nhịp.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const [books, dueCards] = await Promise.all([
    getPublishedBooks(supabase),
    getDueVocabularyCards(supabase),
  ])

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      {dueCards.length > 0 && (
        <Link
          href="/review"
          className="group mb-5 flex items-center gap-4 rounded-card border border-brand-gold/40 bg-accent-bg px-6 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-red text-white">
            <Sparkles className="h-6 w-6" strokeWidth={2} />
          </span>
          <span className="flex-1">
            <span className="block font-han-title text-lg font-bold text-ink">Ôn hôm nay</span>
            <span className="text-sm font-semibold text-ink-faint">{dueCards.length} từ vựng đến hạn ôn</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </Link>
      )}

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          <Library className="h-3.5 w-3.5" strokeWidth={2.5} />
          HuaYu
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn quyển sách</h1>
      </div>

      <ul className="flex flex-col gap-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/books/${book.id}`}
              className="group flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
                <BookMarked className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-ink">{book.title}</span>
                {book.volume && (
                  <span className="text-sm font-medium text-ink-faint">Quyển {book.volume}</span>
                )}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
