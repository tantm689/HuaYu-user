import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lesson } from './types'

export async function getLesson(supabase: SupabaseClient, lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, book_id, lesson_no, title_zh, title_vi, theme, status, created_at, grammar_markdown')
    .eq('id', lessonId)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Lesson | null
}
