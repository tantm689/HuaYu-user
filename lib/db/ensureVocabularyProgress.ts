import type { SupabaseClient } from '@supabase/supabase-js'

export async function ensureVocabularyProgress(
  supabase: SupabaseClient,
  vocabularyIds: string[]
): Promise<void> {
  if (vocabularyIds.length === 0) return

  const now = new Date().toISOString()
  const rows = vocabularyIds.map((vocabulary_id) => ({
    vocabulary_id,
    box: 0,
    learning_streak: 0,
    due_at: now,
  }))

  const { error } = await supabase
    .from('vocabulary_progress')
    .upsert(rows, { onConflict: 'user_id,vocabulary_id', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}
