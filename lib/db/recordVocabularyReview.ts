import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeitnerResult } from '@/lib/srs/leitner'

export async function recordVocabularyReview(
  supabase: SupabaseClient,
  progressId: string,
  next: LeitnerResult
): Promise<void> {
  const { error } = await supabase
    .from('vocabulary_progress')
    .update({
      box: next.box,
      learning_streak: next.learning_streak,
      due_at: next.due_at,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq('id', progressId)

  if (error) throw new Error(error.message)
}
