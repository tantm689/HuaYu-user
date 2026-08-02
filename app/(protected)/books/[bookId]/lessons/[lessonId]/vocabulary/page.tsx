import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getLessonVocabulary } from '@/lib/db/getLessonVocabulary'
import BackButton from '@/components/BackButton'
import VocabularyFlashcards from './VocabularyFlashcards'

export default async function VocabularyPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createServerSupabase()
  const [lesson, dialogueGroups] = await Promise.all([
    getLesson(supabase, lessonId),
    getLessonVocabulary(supabase, lessonId),
  ])

  if (!lesson) notFound()

  const words = dialogueGroups.flatMap((group) => group.words)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lesson.lesson_no}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Từ vựng</h1>
      </div>

      {words.length === 0 ? (
        <p className="font-semibold text-ink-faint">Bài này chưa có từ vựng.</p>
      ) : (
        <VocabularyFlashcards words={words} />
      )}
    </div>
  )
}
