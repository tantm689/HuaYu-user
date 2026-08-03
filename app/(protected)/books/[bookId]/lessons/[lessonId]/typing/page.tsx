import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getLessonVocabulary } from '@/lib/db/getLessonVocabulary'
import { getDialogueLines } from '@/lib/db/getDialogueLines'
import BackButton from '@/components/BackButton'
import TypingPage from './TypingPage'

export default async function TypingRoute({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const [dialogueVocabulary, lines] = await Promise.all([
    getLessonVocabulary(supabase, lessonId),
    getDialogueLines(supabase, lessonId),
  ])
  const vocabulary = dialogueVocabulary.flatMap((d) => d.words)

  if (vocabulary.length === 0 && lines.length === 0) {
    return (
      <div className="mx-auto max-w-[660px] px-5 py-6">
        <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />
        <p className="mt-6 text-center text-sm font-medium text-ink-faint">
          Bài học này chưa có từ vựng hoặc câu hội thoại để luyện gõ.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />
      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">Gõ phản xạ</h1>
      <TypingPage vocabulary={vocabulary} lines={lines} />
    </div>
  )
}
