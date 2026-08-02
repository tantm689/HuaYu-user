import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getLessonVocabulary } from '@/lib/db/getLessonVocabulary'
import { getVocabularyProgressForLesson } from '@/lib/db/getVocabularyProgressForLesson'
import BackButton from '@/components/BackButton'
import VocabularyFlashcards from './VocabularyFlashcards'

export default async function VocabularyPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const [lesson, dialogueGroups] = await Promise.all([
    getLesson(supabase, lessonId),
    getLessonVocabulary(supabase, lessonId),
  ])

  if (!lesson) notFound()

  const words = dialogueGroups.flatMap((group) => group.words)
  const vocabularyIds = words.map((w) => w.id)

  // Tiến độ chỉ được tạo khi người dùng thực sự bấm "Bắt đầu học với FlashCard"
  // cho 1 bộ cụ thể (xem VocabularyFlashcards) — không tạo hàng loạt ở đây, để
  // việc chỉ vào xem bảng từ vựng (preview) không vô tình đưa cả bài vào "Ôn hôm nay".
  const progress = await getVocabularyProgressForLesson(supabase, vocabularyIds)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />

      {words.length === 0 ? (
        <>
          <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
              Bài {lesson.lesson_no}
            </span>
            <h1 className="font-han-title text-2xl font-bold text-ink">Từ vựng</h1>
          </div>
          <p className="font-semibold text-ink-faint">Bài này chưa có từ vựng.</p>
        </>
      ) : (
        <VocabularyFlashcards lessonNo={lesson.lesson_no} dialogueGroups={dialogueGroups} progress={progress} />
      )}
    </div>
  )
}
