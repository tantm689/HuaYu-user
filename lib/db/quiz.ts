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

export async function getBestQuizScores(
  supabase: SupabaseClient,
  lessonId: string
): Promise<{ part1: number | null; part2: number | null }> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('part, score')
    .eq('lesson_id', lessonId)

  if (error) throw new Error(error.message)

  const rows = data as { part: 1 | 2; score: number }[]
  const part1Scores = rows.filter((r) => r.part === 1).map((r) => r.score)
  const part2Scores = rows.filter((r) => r.part === 2).map((r) => r.score)

  return {
    part1: part1Scores.length > 0 ? Math.max(...part1Scores) : null,
    part2: part2Scores.length > 0 ? Math.max(...part2Scores) : null,
  }
}

export async function recordQuizAttempt(
  supabase: SupabaseClient,
  lessonId: string,
  part: 1 | 2,
  score: number,
  total: number
): Promise<void> {
  const { error } = await supabase
    .from('quiz_attempts')
    .insert({ lesson_id: lessonId, part, score, total })

  if (error) throw new Error(error.message)
}
