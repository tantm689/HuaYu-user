import type { SupabaseClient } from '@supabase/supabase-js'
import type { LessonListItem } from './types'

export async function getPublishedLessons(
  supabase: SupabaseClient,
  bookId: string
): Promise<LessonListItem[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, book_id, lesson_no, title_zh, title_vi, theme, status, created_at')
    .eq('book_id', bookId)
    .eq('status', 'published')
    .order('lesson_no', { ascending: true })

  if (error) throw new Error(error.message)
  return data as LessonListItem[]
}
