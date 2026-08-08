import type { SupabaseClient } from '@supabase/supabase-js'
import type { DialogueKind } from './types'

export interface DialogueListItem {
  id: string
  kind: DialogueKind
}

export async function getDialoguesForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<DialogueListItem[]> {
  const { data, error } = await supabase
    .from('dialogues')
    .select('id, kind, order')
    .eq('lesson_id', lessonId)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({ id: row.id, kind: row.kind as DialogueKind }))
}
