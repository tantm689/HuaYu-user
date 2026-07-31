import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedBooks } from '@/lib/db/getPublishedBooks'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const books = await getPublishedBooks(supabase)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <div className="mb-5 rounded-card border border-card-border bg-card p-6 shadow-[0_10px_30px_rgba(120,90,40,0.06)]">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-red">TaiwaneseEasy</div>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn quyển sách</h1>
      </div>

      <ul className="flex flex-col gap-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/books/${book.id}`}
              className="flex items-center justify-between rounded-card-sm border border-card-border bg-card px-5 py-4 font-bold text-ink shadow-[0_4px_16px_rgba(120,90,40,0.05)] transition-transform hover:-translate-y-0.5"
            >
              <span>{book.title}</span>
              {book.volume && (
                <span className="text-sm font-semibold text-ink-faint">Quyển {book.volume}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
