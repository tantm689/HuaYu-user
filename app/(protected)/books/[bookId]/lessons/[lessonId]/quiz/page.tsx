import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getQuizQuestions, getBestQuizScores } from '@/lib/db/quiz'
import BackButton from '@/components/BackButton'
import QuizPage from './QuizPage'

export default async function LessonQuizPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const [part1Questions, part2Questions, bestScores] = await Promise.all([
    getQuizQuestions(supabase, lessonId, 1),
    getQuizQuestions(supabase, lessonId, 2),
    getBestQuizScores(supabase, lessonId),
  ])

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />

      <div className="mb-5 rounded-card border border-card-border bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Bài {lesson.lesson_no}
        </span>
        <h1 className="font-han-title text-2xl font-bold text-ink">Quiz</h1>
      </div>

      {part1Questions.length === 0 && part2Questions.length === 0 ? (
        <p className="font-semibold text-ink-faint">Bài này chưa có câu hỏi quiz.</p>
      ) : (
        <QuizPage
          lessonId={lessonId}
          part1Questions={part1Questions}
          part2Questions={part2Questions}
          bestScores={bestScores}
        />
      )}
    </div>
  )
}
