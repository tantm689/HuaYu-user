import type { SupabaseClient } from '@supabase/supabase-js'
import type { DialogueLineForTyping } from './types'

export async function getDialogueLines(
  supabase: SupabaseClient,
  lessonId: string
): Promise<DialogueLineForTyping[]> {
  const { data, error } = await supabase
    .from('dialogues')
    .select('id, order, dialogue_lines(id, order, text_zh, translation_vi, audio_url)')
    .eq('lesson_id', lessonId)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)

  type Row = {
    id: string
    order: number
    dialogue_lines: { id: string; order: number; text_zh: string; translation_vi: string | null; audio_url: string | null }[]
  }

  const rows = [...(data as unknown as Row[])].sort((a, b) => a.order - b.order)

  return rows.flatMap((dialogue) =>
    [...dialogue.dialogue_lines]
      .sort((a, b) => a.order - b.order)
      .map((line) => ({
        id: line.id,
        text_zh: line.text_zh,
        translation_vi: line.translation_vi,
        audio_url: line.audio_url,
      }))
  )
}
