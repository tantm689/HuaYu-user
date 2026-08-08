import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getLesson } from '@/lib/db/getLesson'
import { getDialoguesForLesson } from '@/lib/db/getDialoguesForLesson'
import BackButton from '@/components/BackButton'
import DialoguePickerList from './DialoguePickerList'

export default async function DialoguePickerPage({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string }>
}) {
  const { bookId, lessonId } = await params
  const supabase = await createServerSupabase()
  const lesson = await getLesson(supabase, lessonId)

  if (!lesson) notFound()

  const dialogues = await getDialoguesForLesson(supabase, lessonId)

  return (
    <div className="mx-auto max-w-[660px] px-5 py-6">
      <BackButton fallbackHref={`/books/${bookId}/lessons/${lessonId}`} />
      <h1 className="mb-5 font-han-title text-2xl font-bold text-ink">Hội thoại</h1>
      <DialoguePickerList dialogues={dialogues} bookId={bookId} lessonId={lessonId} />
    </div>
  )
}
