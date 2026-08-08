import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getDialogueById } from '@/lib/db/getDialogueById'
import { getDialoguesForLesson } from '@/lib/db/getDialoguesForLesson'
import { dialogueDisplayNames } from '@/lib/db/dialogueDisplayName'
import DialogueDetailPage from './DialogueDetailPage'

export default async function DialogueDetailRoute({
  params,
}: {
  params: Promise<{ bookId: string; lessonId: string; dialogueId: string }>
}) {
  const { bookId, lessonId, dialogueId } = await params
  const supabase = await createServerSupabase()

  const dialogue = await getDialogueById(supabase, dialogueId)
  if (!dialogue) notFound()

  // Recompute display name from the full lesson's dialogue list so the
  // per-kind counter matches what the picker page showed (a dialogue's
  // display name depends on its position among sibling dialogues, not just
  // itself).
  const siblings = await getDialoguesForLesson(supabase, lessonId)
  const names = dialogueDisplayNames(siblings)
  const displayName = names[siblings.findIndex((d) => d.id === dialogueId)] ?? ''

  return (
    <DialogueDetailPage dialogue={dialogue} displayName={displayName} bookId={bookId} lessonId={lessonId} />
  )
}
