import type { SupabaseClient } from '@supabase/supabase-js'
import type { VocabularyProgress } from './types'

export async function getVocabularyProgressForLesson(
  supabase: SupabaseClient,
  vocabularyIds: string[]
): Promise<VocabularyProgress[]> {
  if (vocabularyIds.length === 0) return []

  const { data, error } = await supabase
    .from('vocabulary_progress')
    .select('id, user_id, vocabulary_id, box, learning_streak, due_at, last_reviewed_at, created_at')
    .in('vocabulary_id', vocabularyIds)

  if (error) throw new Error(error.message)
  return data as VocabularyProgress[]
}
