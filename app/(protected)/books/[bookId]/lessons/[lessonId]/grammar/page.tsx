import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import BackButton from '@/components/BackButton'
import GrammarAccordion from './GrammarAccordion'
import { splitGrammarMarkdown } from '@/lib/grammarMarkdownSections'

export default async function GrammarPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const sections = lesson.grammar_markdown ? splitGrammarMarkdown(lesson.grammar_markdown) : []

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lesson.lesson_no}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Ngữ pháp</h1>
      </div>

      {sections.length === 0 ? (
        <p className="font-semibold text-ink-faint">Bài này chưa có nội dung ngữ pháp.</p>
      ) : (
        <GrammarAccordion sections={sections} />
      )}
    </div>
  )
}
