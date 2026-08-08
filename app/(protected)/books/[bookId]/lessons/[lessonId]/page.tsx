import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookText, ChevronRight, Keyboard, LayoutList, PenSquare, SpellCheck } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import BackButton from '@/components/BackButton'

const modes = [
  { key: 'vocabulary', label: 'Từ vựng', description: 'Flashcard và cách viết chữ', icon: SpellCheck, enabled: true },
  { key: 'dialogue', label: 'Hội thoại', description: 'Ôn lại và luyện nghe nói', icon: BookText, enabled: true },
  { key: 'grammar', label: 'Ngữ pháp', description: 'Xem lại cấu trúc ngữ pháp', icon: LayoutList, enabled: true },
  { key: 'typing', label: 'Gõ phản xạ', description: 'Luyện gõ từ và câu', icon: Keyboard, enabled: true },
  { key: 'quiz', label: 'Quiz', description: 'Kiểm tra lại kiến thức', icon: PenSquare, enabled: true },
] as const

export default async function LessonPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}`} />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lesson.lesson_no}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">{lesson.title_vi}</h1>

        {(lesson.theme || lesson.objectives.length > 0) && (
          <div className="mt-4 flex flex-col gap-3 border-t border-card-border pt-4">
            {lesson.theme && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Chủ đề</p>
                <p className="mt-1 text-sm font-medium text-ink">{lesson.theme}</p>
              </div>
            )}
            {lesson.objectives.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Mục tiêu</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {lesson.objectives.map((objective, index) => (
                    <li key={index} className="text-sm font-medium text-ink">
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {modes.map((mode) => {
          const Icon = mode.icon
          const content = (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-ink">{mode.label}</span>
                <span className="text-sm font-medium text-ink-faint">
                  {mode.enabled ? mode.description : 'Sắp ra mắt'}
                </span>
              </span>
              {mode.enabled && (
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              )}
            </>
          )

          return (
            <li key={mode.key}>
              {mode.enabled ? (
                <Link
                  href={`/books/${bookId}/lessons/${lessonId}/${mode.key}`}
                  className="group flex items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-50/50 hover:shadow-md"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex cursor-not-allowed items-center gap-4 rounded-card-sm border border-card-border bg-white px-5 py-4 opacity-60 shadow-sm">
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
