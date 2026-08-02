import Link from 'next/link'
import { BookOpen, ChevronRight, ListChecks } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedLessons } from '@/lib/db/getPublishedLessons'
import BackButton from '@/components/BackButton'

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const { bookId } = await params
  const supabase = await createServerSupabase()
  const lessons = await getPublishedLessons(supabase, bookId)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref="/home" />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          <ListChecks className="h-3.5 w-3.5" strokeWidth={2.5} />
          Danh sách bài học
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn bài để ôn tập</h1>
      </div>

      {lessons.length === 0 && (
        <p className="font-semibold text-ink-faint">Quyển này chưa có bài học nào được xuất bản.</p>
      )}

      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/books/${bookId}/lessons/${lesson.id}`}
              className="group flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
                <BookOpen className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1 font-bold text-ink">
                Bài {lesson.lesson_no}: {lesson.title_vi}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
