import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dialogue } from './types'

export async function getDialogueById(
  supabase: SupabaseClient,
  dialogueId: string
): Promise<Dialogue | null> {
  const { data, error } = await supabase
    .from('dialogues')
    .select(
      'id, order, kind, audio_url, dialogue_lines(id, order, speaker_zh, text_zh, pinyin, translation_vi, audio_url)'
    )
    .eq('id', dialogueId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  type Row = {
    id: string
    order: number
    kind: Dialogue['kind']
    audio_url: string | null
    dialogue_lines: {
      id: string
      order: number
      speaker_zh: string | null
      text_zh: string
      pinyin: string | null
      translation_vi: string | null
      audio_url: string | null
    }[]
  }

  const row = data as unknown as Row

  return {
    id: row.id,
    order: row.order,
    kind: row.kind,
    audio_url: row.audio_url,
    lines: [...row.dialogue_lines].sort((a, b) => a.order - b.order),
  }
}
