import type { SupabaseClient } from '@supabase/supabase-js'
import type { DialogueVocabulary, Vocabulary } from './types'

export async function getLessonVocabulary(
  supabase: SupabaseClient,
  lessonId: string
): Promise<DialogueVocabulary[]> {
  const { data, error } = await supabase
    .from('dialogues')
    .select('id, order, vocabulary(id, dialogue_id, order, word_zh, pinyin, meaning_vi, audio_url)')
    .eq('lesson_id', lessonId)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data as unknown as { id: string; order: number; vocabulary: Vocabulary[] }[])
    .map((dialogue) => ({
      dialogue_id: dialogue.id,
      dialogue_order: dialogue.order,
      words: [...dialogue.vocabulary].sort((a, b) => a.order - b.order),
    }))
    .filter((dialogue) => dialogue.words.length > 0)
}
