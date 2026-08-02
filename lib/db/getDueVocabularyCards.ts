import type { SupabaseClient } from '@supabase/supabase-js'
import type { Vocabulary, VocabularyProgress } from './types'

export interface DueVocabularyCard {
  progress: VocabularyProgress
  vocabulary: Vocabulary
}

export async function getDueVocabularyCards(supabase: SupabaseClient): Promise<DueVocabularyCard[]> {
  const { data, error } = await supabase
    .from('vocabulary_progress')
    .select(
      'id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at, vocabulary(id, dialogue_id, order, word_zh, pinyin, meaning_vi, audio_url)'
    )
    .lte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (
    data as unknown as (VocabularyProgress & { vocabulary: Vocabulary })[]
  ).map(({ vocabulary, ...progress }) => ({ progress, vocabulary }))
}
