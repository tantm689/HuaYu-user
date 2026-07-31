import { createServerSupabase } from '@/lib/supabase/server'
import { getPublishedLessons } from '@/lib/db/getPublishedLessons'

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
      <div className="mb-5 rounded-card border border-card-border bg-card p-6 shadow-[0_10px_30px_rgba(120,90,40,0.06)]">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-red">Danh sách bài học</div>
        <h1 className="font-han-title text-2xl font-bold text-ink">Chọn bài để ôn tập</h1>
      </div>

      {lessons.length === 0 && (
        <p className="font-semibold text-ink-faint">Quyển này chưa có bài học nào được xuất bản.</p>
      )}

      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            className="rounded-card-sm border border-card-border bg-card px-5 py-4 shadow-[0_4px_16px_rgba(120,90,40,0.05)]"
          >
            <span className="font-bold text-ink">Bài {lesson.lesson_no}: {lesson.title_vi}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
