import type { SupabaseClient } from '@supabase/supabase-js'
import type { TypingKind } from './types'

export async function upsertTypingProgress(
  supabase: SupabaseClient,
  kind: TypingKind,
  targetId: string,
  isCorrect: boolean,
  prevStreak: number
): Promise<void> {
  const streak = isCorrect ? prevStreak + 1 : 0

  const { error } = await supabase.from('typing_progress').upsert(
    {
      kind,
      target_id: targetId,
      is_correct: isCorrect,
      streak,
      last_attempted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,kind,target_id' }
  )

  if (error) throw new Error(error.message)
}
