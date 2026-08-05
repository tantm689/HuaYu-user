import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizQuestion } from './types'

export async function getQuizQuestions(
  supabase: SupabaseClient,
  lessonId: string,
  part: 1 | 2
): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, lesson_id, part, type, order, payload')
    .eq('lesson_id', lessonId)
    .eq('part', part)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)
  return data as QuizQuestion[]
}
